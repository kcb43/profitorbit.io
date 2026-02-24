import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import FilerobotImageEditor, { TABS } from 'react-filerobot-image-editor';
import Konva from 'konva';
import { Factory as KonvaFactory } from 'konva/lib/Factory';
import { getNumberValidator } from 'konva/lib/Validators';
import { Loader2, Trash2, BookmarkPlus, FolderOpen, Layers, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { uploadApi } from '@/api/uploadApi';
import { inventoryApi } from '@/api/inventoryApi';

// ── Eagerly register custom Konva filter getter/setters ─────────────────────
// GammaBrightness and Shadows are defined in FIE's patched custom/finetunes.
// Their addGetterSetter calls run when those modules are first imported, but
// if Konva tries to apply a filter before the tool panel loads (e.g. when
// restoring a saved design state), "this.gammaBrightness is not a function"
// is thrown. Registering here at ImageEditor module-load time guarantees the
// getters exist before ANY Konva Image node renders.
;(function () {
  try {
    if (!Konva?.Image?.prototype) return;
    const v = getNumberValidator();
    const after = KonvaFactory.afterSetFilter;
    if (typeof Konva.Image.prototype.gammaBrightness !== 'function')
      KonvaFactory.addGetterSetter(Konva.Image, 'gammaBrightness', 0, v, after);
    if (typeof Konva.Image.prototype.shadowsValue !== 'function')
      KonvaFactory.addGetterSetter(Konva.Image, 'shadowsValue', 0, v, after);
  } catch (_) { /* Konva not ready — the per-module registrations will handle it */ }
})();

// ── Module-level high-quality canvas patch with transform-aware multi-step downscaling ───
// Root cause of blurry preview: Konva applies context.scale(pixelRatio) BEFORE calling
// drawImage(img, 0, 0, cssW, cssH). The CSS destination (e.g. 800px) looks small, but
// the actual physical pixels drawn are 800 × pixelRatio (e.g. 1600px on a 2× screen).
// Our old patch pre-scaled to 800px then the context's 2× transform upscaled it to
// 1600px — throwing away all the quality we just computed.
//
// Fix: read the current transform matrix via getTransform() to find the actual physical
// pixel size, pre-scale to THAT size, then let the context transform produce 1:1 pixels.
// Intermediate canvases are fresh (identity transform) so they don't recurse.
;(function () {
  if (typeof CanvasRenderingContext2D === 'undefined') return;
  const _orig = CanvasRenderingContext2D.prototype.drawImage;
  if (_orig && _orig._fie_hq) return;

  function hqDrawImage(source) {
    this.imageSmoothingEnabled = true;
    this.imageSmoothingQuality = 'high';

    // Only multi-step for HTMLImageElement with explicit dest size.
    // Canvas→canvas skips multi-step (already pre-scaled, no recursion risk).
    if (source instanceof HTMLImageElement && arguments.length >= 5) {
      const is9    = arguments.length >= 9;
      const effSrcW = is9 ? Math.abs(arguments[3]) : source.naturalWidth;
      const effSrcH = is9 ? Math.abs(arguments[4]) : source.naturalHeight;
      const cssDW   = Math.abs(is9 ? arguments[7] : arguments[3]);
      const cssDH   = Math.abs(is9 ? arguments[8] : arguments[4]);

      // ── Detect context scale so we target physical pixels, not CSS pixels ──
      // Konva sets scale(pixelRatio) on cache canvases before calling drawImage.
      // Without this, we'd pre-scale to cssD* then the context's transform would
      // upscale the result, negating all quality gains.
      let sx = 1, sy = 1;
      try {
        if (typeof this.getTransform === 'function') {
          const m = this.getTransform();
          // Extract scale magnitude (handles rotation too: |col₀| = scaleX)
          sx = Math.sqrt(m.a * m.a + m.b * m.b) || 1;
          sy = Math.sqrt(m.c * m.c + m.d * m.d) || 1;
        }
      } catch (_) { /* ignore – older browsers */ }

      // Physical pixel destination (what actually gets drawn on screen/canvas).
      const physDW = Math.round(cssDW * sx);
      const physDH = Math.round(cssDH * sy);

      if (physDW > 0 && physDH > 0 && (effSrcW > physDW * 2 || effSrcH > physDH * 2)) {
        let cur = source;
        let curW = effSrcW;
        let curH = effSrcH;

        // For 9-arg (source crop), extract the crop region onto a temp canvas first.
        if (is9) {
          const crop = document.createElement('canvas');
          crop.width  = effSrcW;
          crop.height = effSrcH;
          const cc = crop.getContext('2d');
          cc.imageSmoothingEnabled = true;
          cc.imageSmoothingQuality = 'high';
          _orig.call(cc, source,
            arguments[1], arguments[2], effSrcW, effSrcH,
            0, 0, effSrcW, effSrcH);
          cur = crop;
        }

        // Halve until within 2× of the PHYSICAL destination.
        // Each step is ≤50% → bilinear chains to Lanczos quality.
        while (curW > physDW * 2 || curH > physDH * 2) {
          const nw = Math.max(Math.round(curW / 2), physDW);
          const nh = Math.max(Math.round(curH / 2), physDH);
          const tmp = document.createElement('canvas');
          tmp.width  = nw;
          tmp.height = nh;
          const tc = tmp.getContext('2d');
          tc.imageSmoothingEnabled = true;
          tc.imageSmoothingQuality = 'high';
          _orig.call(tc, cur, 0, 0, nw, nh);
          cur = tmp; curW = nw; curH = nh;
        }

        // Draw the pre-scaled canvas (physDW×physDH pixels) using CSS coordinates.
        // The context's scale transform maps cssD* → physD* physical pixels → 1:1.
        if (is9) {
          return _orig.call(this, cur, 0, 0, curW, curH,
            arguments[5], arguments[6], cssDW, cssDH);
        }
        return _orig.call(this, cur, arguments[1], arguments[2], cssDW, cssDH);
      }
    }

    return _orig.apply(this, arguments);
  }

  hqDrawImage._fie_hq = true;
  CanvasRenderingContext2D.prototype.drawImage = hqDrawImage;
})();

// ── Template persistence ───────────────────────────────────────────────────────
const TEMPLATES_KEY = 'orben_editor_templates';
const MAX_TEMPLATES = 20;

function loadTemplates() {
  try { return JSON.parse(localStorage.getItem(TEMPLATES_KEY) || '[]'); }
  catch { return []; }
}
function persistTemplates(list) {
  localStorage.setItem(TEMPLATES_KEY, JSON.stringify(list));
}

// ── Canvas-based batch adjustment processor ─────────────────────────────────
// Fetches each image as a blob first (avoids CORS canvas taint), then applies:
//   • Finetune adjustments from finetunesProps (Konva filter names → CSS filters)
//   • Rotation / flip from adjustments.rotation / isFlippedX / isFlippedY
//   • Aspect-ratio crop from adjustments.crop.ratio (centred)
// Returns a Promise<Blob>.
async function applyAdjustmentsToCanvas(imgUrl, designState = {}) {
  if (!imgUrl || !isValidImgUrl(imgUrl)) {
    throw new Error(`Invalid image URL for canvas processing: ${imgUrl}`);
  }
  // Fetch as blob → object URL so the canvas is never cross-origin tainted
  let objectUrl = null;
  try {
    const resp = await fetch(imgUrl);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const blob = await resp.blob();
    objectUrl = URL.createObjectURL(blob);
  } catch {
    // Fallback: try direct URL with crossOrigin (may taint canvas on some hosts)
    objectUrl = imgUrl;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      const adj = designState.adjustments || {};
      const fp  = designState.finetunesProps || {};

      // ── Finetune props (finetunesProps is a FLAT object, keys are prop names) ─
      // GammaBrightness (-100..100): gamma-curve exposure adjustment
      // Brighten (-1..1): legacy linear brightness (kept for old design states)
      // contrast (-100..100): Konva Contrast filter value
      // shadowsVal (-100..100): tonal shadow lift/crush (pixel pass below)
      const gammaBrightness = fp.gammaBrightness ?? 0;
      const legacyBrightness = fp.brightness ?? 0;
      const contrast   = fp.contrast   ?? 0;
      const shadowsVal = fp.shadowsValue ?? 0;

      // CSS filter handles legacy linear brightness and contrast
      const filterParts = [
        legacyBrightness !== 0 ? `brightness(${1 + legacyBrightness})` : '',
        contrast !== 0 ? `contrast(${Math.max(0, 1 + contrast / 100)})` : '',
      ].filter(Boolean);

      // ── Rotation / flip ───────────────────────────────────────────────────
      const rotate = adj.rotation || 0;
      const rad    = (rotate * Math.PI) / 180;
      const cos    = Math.abs(Math.cos(rad));
      const sin    = Math.abs(Math.sin(rad));
      const w = img.naturalWidth;
      const h = img.naturalHeight;

      // ── Centred aspect-ratio crop ─────────────────────────────────────────
      const cropRatio = adj.crop?.ratio;
      let srcX = 0, srcY = 0, srcW = w, srcH = h;
      if (cropRatio && cropRatio !== 'original' && typeof cropRatio === 'number') {
        const imgRatio = w / h;
        if (imgRatio > cropRatio) {
          srcH = h;  srcW = h * cropRatio;  srcX = (w - srcW) / 2;
        } else {
          srcW = w;  srcH = w / cropRatio;  srcY = (h - srcH) / 2;
        }
      }

      // ── Canvas ────────────────────────────────────────────────────────────
      const canvas = document.createElement('canvas');
      canvas.width  = Math.round(srcW * cos + srcH * sin);
      canvas.height = Math.round(srcW * sin + srcH * cos);
      const ctx = canvas.getContext('2d');
      // Force bicubic quality for all drawImage calls (default is 'low')
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      if (filterParts.length) ctx.filter = filterParts.join(' ');

      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      if (rotate)         ctx.rotate(rad);
      if (adj.isFlippedX) ctx.scale(-1,  1);
      if (adj.isFlippedY) ctx.scale( 1, -1);
      ctx.drawImage(img, srcX, srcY, srcW, srcH, -srcW / 2, -srcH / 2, srcW, srcH);
      ctx.restore();

      // ── Gamma brightness pixel pass ────────────────────────────────────────
      // gamma = 2^(-b/50): at b=0 → 1 (no-op); b=100 → 0.25 (bright); b=-100 → 4 (dark)
      if (gammaBrightness !== 0) {
        const gamma = Math.pow(2, -gammaBrightness / 50);
        const lut = new Uint8ClampedArray(256);
        for (let i = 0; i < 256; i++) lut[i] = Math.round(Math.pow(i / 255, gamma) * 255);
        const idata = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const px = idata.data;
        for (let p = 0; p < px.length; p += 4) {
          px[p]     = lut[px[p]];
          px[p + 1] = lut[px[p + 1]];
          px[p + 2] = lut[px[p + 2]];
        }
        ctx.putImageData(idata, 0, 0);
      }

      // ── Shadows pixel pass (linear tonal range, broader than before) ───────
      // Affects pixels below lum=192 linearly. At s=100: dark pixels +100, mid ~+50.
      if (shadowsVal !== 0) {
        const idata = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const px = idata.data;
        for (let p = 0; p < px.length; p += 4) {
          const lum = (px[p] * 299 + px[p + 1] * 587 + px[p + 2] * 114) / 1000;
          const factor = Math.max(0, (192 - lum) / 192);
          if (factor < 0.01) continue;
          const adj2 = Math.round(shadowsVal * factor);
          px[p]     = Math.min(255, Math.max(0, px[p]     + adj2));
          px[p + 1] = Math.min(255, Math.max(0, px[p + 1] + adj2));
          px[p + 2] = Math.min(255, Math.max(0, px[p + 2] + adj2));
        }
        ctx.putImageData(idata, 0, 0);
      }

      if (objectUrl !== imgUrl) URL.revokeObjectURL(objectUrl);

      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error('Canvas toBlob failed')),
        'image/jpeg', 0.95,
      );
    };

    img.onerror = () => {
      if (objectUrl !== imgUrl) URL.revokeObjectURL(objectUrl);
      reject(new Error(`Failed to load image: ${imgUrl}`));
    };

    if (objectUrl === imgUrl) img.crossOrigin = 'anonymous';
    img.src = objectUrl;
  });
}

// ── Helper: extract URL from various image object shapes ──────────────────────
// Only returns strings that look like real network/blob/data URLs.
// This guards against photo IDs (bare UUIDs like "0ca208a6-8ee0-…") being
// mistakenly treated as fetchable URLs.
function isValidImgUrl(s) {
  return typeof s === 'string' &&
    (s.startsWith('http://') || s.startsWith('https://') ||
     s.startsWith('blob:')   || s.startsWith('data:'));
}

function getImgUrl(img) {
  if (!img) return null;
  if (typeof img === 'string') return isValidImgUrl(img) ? img : null;
  const url = img.imageUrl || img.url || img.image_url || img.preview || null;
  return isValidImgUrl(url) ? url : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
function ImageEditorInner({
  open,
  onOpenChange,
  imageSrc,
  onSave,
  fileName = 'edited-image.jpg',
  allImages = [],
  itemId,
  imageIndex = 0,
}) {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  // ── Original URL tracking (for Reset All) ────────────────────────────────
  // Capture the image URLs as they existed when this editor session started.
  // Used to power in-session "Reset All" and cross-session "Reset to Original".
  const ORIG_KEY = itemId ? `orben_editor_originals_${itemId}` : null;
  const originalUrls = useRef(
    allImages.length ? allImages.map(getImgUrl) : imageSrc ? [imageSrc] : [],
  );
  // Originals persisted from a previous session (before earlier edits were saved)
  const [persistedOriginals, setPersistedOriginals] = useState(() => {
    if (!ORIG_KEY) return null;
    try { return JSON.parse(localStorage.getItem(ORIG_KEY) || 'null'); }
    catch { return null; }
  });
  // True once any save (individual or Apply-to-All) has happened this session
  const [hasSavedInSession, setHasSavedInSession] = useState(false);

  // ── Theme ────────────────────────────────────────────────────────────────
  const [isDark, setIsDark] = useState(
    () => document.documentElement.classList.contains('dark'),
  );
  useEffect(() => {
    const root = document.documentElement;
    const obs = new MutationObserver(() => setIsDark(root.classList.contains('dark')));
    obs.observe(root, { attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

  // ── Multi-image navigation ───────────────────────────────────────────────
  const [activeIndex, setActiveIndex] = useState(imageIndex);
  // Per-image design states tracked in-session (ref = no re-render on modify)
  const imageDesignStates = useRef({});
  const [modifiedSet, setModifiedSet]     = useState(new Set()); // reactive mirror of ref keys
  const [currentDesignState, setCurrentDesignState] = useState(null);
  const [loadedDesignState, setLoadedDesignState]   = useState(null);

  // ── Template management ──────────────────────────────────────────────────
  const [templates, setTemplates]           = useState(loadTemplates);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName]     = useState('');
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);

  // ── Apply-to-all progress ────────────────────────────────────────────────
  const [applyingToAll, setApplyingToAll]   = useState(false);
  const [applyProgress, setApplyProgress]   = useState({ done: 0, total: 0 });

  // Active image URL (original, always used for saves and as ground truth)
  const activeSrc = useMemo(() => {
    if (!allImages.length) return imageSrc;
    return getImgUrl(allImages[activeIndex]) || imageSrc;
  }, [allImages, activeIndex, imageSrc]);

  // ── High-quality pre-scaled source for FIE preview ──────────────────────────
  // Strategy: use the browser's own Lanczos resampler (createImageBitmap with
  // resizeQuality:'high') — the SAME algorithm CSS uses to display <img> — to
  // downscale the image to exactly the editor's physical pixel budget.  FIE
  // then receives a source that is ALREADY at display resolution, so Konva
  // draws it 1:1 on the cache canvas (no further downscaling, no quality loss).
  //
  // Why this beats our hqDrawImage multi-step bicubic:
  //   • createImageBitmap 'high' is Lanczos in Chrome/Edge, matching CSS quality.
  //   • Konva bicubic (even chained) is perceptibly softer than Lanczos at >1.5×
  //     reductions (which is the common case: 4032→2000 = 2× on large screens).
  //
  // Saves still use the full-resolution original via applyAdjustmentsToCanvas.
  const [fieSource,        setFieSource]        = useState(null);
  const [fieSourceLoading, setFieSourceLoading] = useState(false);
  const prevBlobUrl = useRef(null);
  const editorAreaRef = useRef(null); // measures the FIE canvas container for physical px

  useEffect(() => {
    if (!open || !activeSrc || !isValidImgUrl(activeSrc)) {
      setFieSource(activeSrc || null);
      setFieSourceLoading(false);
      return;
    }

    setFieSource(null);
    setFieSourceLoading(true);
    let cancelled = false;

    async function prescale() {
      let blobUrl = null;
      try {
        // 1. Fetch as same-origin blob (keeps canvas untainted for filters,
        //    also warms the CORS cache for the later applyAdjustmentsToCanvas).
        const resp = await fetch(activeSrc);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const blob = await resp.blob();

        // 2. Determine the prescale target size.
        //
        //    FIE's image node physically fits srcW:srcH inside the Konva stage.
        //    The stage dimensions ≈ (containerW − 130 px tools panel) × containerH.
        //    However, for HEIGHT-LIMITED images (common for landscape iPhone photos
        //    in a wide editor), tw = containerH × DPR × (srcW/srcH) — and this is
        //    independent of the 130 px tool panel, so using containerW × DPR (no
        //    subtraction) gives a tw that matches the image node's physical width.
        //    For WIDTH-LIMITED images tw = (containerW) × DPR which is ~12 % larger
        //    than the image node (containerW−130), so Konva does a tiny 1.12× step.
        //    Either way the Konva final step is ≤1.15× — tiny compared to the old
        //    1.41× that was softening the image.
        const dpr    = window.devicePixelRatio || 1;
        const el     = editorAreaRef.current;
        const elW    = (el && el.offsetWidth  > 0) ? el.offsetWidth  : window.innerWidth  * 0.65;
        const elH    = (el && el.offsetHeight > 0) ? el.offsetHeight : window.innerHeight * 0.75;
        const physW  = Math.round(elW * dpr);
        const physH  = Math.round(elH * dpr);

        // 3. Check original dimensions.
        const orig   = await createImageBitmap(blob);
        const srcW   = orig.width;
        const srcH   = orig.height;
        orig.close?.();

        if (srcW <= physW && srcH <= physH) {
          // Image already fits at display resolution — no rescale needed.
          blobUrl = URL.createObjectURL(blob);
        } else {
          const ratio = Math.min(physW / srcW, physH / srcH);
          const tw    = Math.max(1, Math.round(srcW * ratio));
          const th    = Math.max(1, Math.round(srcH * ratio));

          // Single-step browser Lanczos resampler.
          // createImageBitmap(blob, {resizeQuality:'high'}) dispatches directly
          // to the browser's highest-quality downsampler (Lanczos in Chrome/Edge)
          // — the same path CSS <img> uses.  Using the blob as source (not a
          // chained ImageBitmap) guarantees the quality option is honoured.
          const scaled = await createImageBitmap(blob, {
            resizeWidth: tw, resizeHeight: th, resizeQuality: 'high',
          });

          // 1:1 copy to canvas — no quality change.
          const cvs = document.createElement('canvas');
          cvs.width  = tw;
          cvs.height = th;
          const ctx  = cvs.getContext('2d');
          ctx.imageSmoothingEnabled = false; // already at target size, no smoothing
          ctx.drawImage(scaled, 0, 0);
          scaled.close?.();

          // WebP at 0.99 ≈ visually lossless (PSNR > 50 dB).
          // Fast to encode (~200 ms) and much smaller than PNG for photos.
          let outBlob = await new Promise(res => cvs.toBlob(res, 'image/webp', 0.99));
          if (!outBlob || outBlob.size < 1000) {
            // Fallback: JPEG q=1.0 for Safari (no WebP encode support).
            outBlob = await new Promise(res => cvs.toBlob(res, 'image/jpeg', 1.0));
          }
          blobUrl = URL.createObjectURL(outBlob || blob);
        }
      } catch (err) {
        console.warn('[ImageEditor] Prescale failed, using original URL:', err.message);
      }

      if (!cancelled) {
        if (prevBlobUrl.current) URL.revokeObjectURL(prevBlobUrl.current);
        prevBlobUrl.current = blobUrl;
        setFieSource(blobUrl || activeSrc);
        setFieSourceLoading(false);
      }
    }

    prescale();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeSrc]);

  // Reset everything when a new item/editor session starts
  useEffect(() => {
    setActiveIndex(imageIndex);
    imageDesignStates.current = {};
    setModifiedSet(new Set());
    setCurrentDesignState(null);
    setLoadedDesignState(null);
  }, [imageIndex, imageSrc]);

  // ── Load saved design state from DB when editor opens ────────────────────
  useEffect(() => {
    if (!open || !itemId || !imageSrc) return;
    let cancelled = false;
    (async () => {
      try {
        const { data: item } = await inventoryApi.get(itemId);
        if (cancelled || !item?.image_editor_state) return;
        const states = JSON.parse(item.image_editor_state);
        const saved = states[imageSrc];
        if (saved) setLoadedDesignState(saved);
      } catch { /* non-critical */ }
    })();
    return () => { cancelled = true; };
  }, [open, itemId, imageSrc]);

  // ── Tab colour fix (MutationObserver) ────────────────────────────────────
  useEffect(() => {
    if (!open) return;

    let rafId = null;

    const styleId = 'fie-tab-hover-fix';
    let styleEl = document.getElementById(styleId);
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }
    // Only hover colours go in the stylesheet — everything else is applied via
    // inline style.setProperty in paintTabs() so it beats styled-components.
    styleEl.textContent = `
      .FIE_tab:hover *,
      .FIE_tab:hover svg * {
        color: #ffffff !important;
        fill:  #ffffff !important;
      }
    `;

    function paintTabs() {
      // ── Tab colours ───────────────────────────────────────────────────────
      document.querySelectorAll(
        '.FIE_tab:not([aria-selected="true"]), .SfxDrawer-item > div:not([aria-selected="true"])',
      ).forEach(el => {
        el.style.removeProperty('color');
        el.querySelectorAll('*').forEach(child => {
          child.style.removeProperty('color');
          child.style.removeProperty('fill');
        });
      });
      document.querySelectorAll('.FIE_root [aria-selected="true"]').forEach(el => {
        el.style.setProperty('color', '#ffffff', 'important');
        el.querySelectorAll('*').forEach(child => {
          child.style.setProperty('color', '#ffffff', 'important');
          if (child.tagName === 'svg' || child.closest('svg'))
            child.style.setProperty('fill', '#ffffff', 'important');
        });
      });

      // ── Layout compaction (inline !important beats styled-components) ──────
      // Topbar: shrink from the default padding:16px (~95px tall) to ~48px.
      // Use asymmetric padding (more on right) so the X close button isn't
      // crowded against the right edge.
      const topbar = document.querySelector('.FIE_topbar');
      if (topbar) {
        topbar.style.setProperty('padding', '6px 48px 6px 12px', 'important');
        topbar.style.setProperty('min-height', 'unset', 'important');
        topbar.style.setProperty('gap', '8px', 'important');
      }

      // Main content: reclaim the vertical space saved from the topbar
      const mainContent = document.querySelector('.FIE_main-container');
      if (mainContent) {
        mainContent.style.setProperty('height', 'calc(100% - 48px)', 'important');
        mainContent.style.setProperty('flex-grow', '1', 'important');
      }

      // Tab sidebar: strip excess left padding (was 16px → 4px) and narrow min-width
      const tabs = document.querySelector('.FIE_tabs');
      if (tabs) {
        tabs.style.setProperty('padding', '12px 8px 12px 4px', 'important');
        tabs.style.setProperty('min-width', '88px', 'important');
      }

      // Canvas column: expand to fill space freed from the narrower sidebar.
      // padding-right + border-box forces a right gap matching the canvas
      // container's left padding (16px), preventing the Konva stage from
      // overflowing and clipping the right side of the canvas area.
      const editorContent = document.querySelector('.FIE_editor-content');
      if (editorContent) {
        editorContent.style.setProperty('width', 'calc(100% - 88px)', 'important');
        editorContent.style.setProperty('padding-right', '16px', 'important');
        editorContent.style.setProperty('box-sizing', 'border-box', 'important');
      }

      // App wrapper: remove border-radius (looks wrong in fullscreen overlay)
      const appWrapper = document.querySelector('.FIE_root');
      if (appWrapper) {
        appWrapper.style.setProperty('border-radius', '0', 'important');
        appWrapper.style.setProperty('overflow', 'hidden', 'important');
      }

      // FIE topbar: truly center the dimensions/zoom element
      const topbarEl = document.querySelector('.FIE_topbar');
      if (topbarEl) {
        topbarEl.style.setProperty('position', 'relative', 'important');
      }
      const centerOptions = document.querySelector('.FIE_topbar-center-options');
      if (centerOptions) {
        centerOptions.style.setProperty('position', 'absolute', 'important');
        centerOptions.style.setProperty('left', '50%', 'important');
        centerOptions.style.setProperty('transform', 'translateX(-50%)', 'important');
        centerOptions.style.setProperty('width', 'fit-content', 'important');
        // Prevent overlap with left/right groups
        centerOptions.style.setProperty('pointer-events', 'auto', 'important');
      }
    }

    function schedule() {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(paintTabs);
    }

    const tabObs = new MutationObserver(schedule);

    function startObserving() {
      const root = document.querySelector('.FIE_root');
      if (root) {
        tabObs.observe(root, {
          childList: true, subtree: true, attributes: true,
          attributeFilter: ['aria-selected', 'aria-pressed', 'class', 'style'],
        });
        paintTabs();
      } else {
        setTimeout(startObserving, 50);
      }
    }
    startObserving();

    return () => {
      tabObs.disconnect();
      if (rafId) cancelAnimationFrame(rafId);
      document.getElementById(styleId)?.remove();
    };
  }, [open, isDark, activeIndex]); // re-attach when FIE remounts on image switch

  // ── Switch to a different image in the filmstrip ─────────────────────────
  const handleSwitchImage = useCallback((newIndex) => {
    if (newIndex === activeIndex) return;
    // Persist current design state for the outgoing image
    if (currentDesignState) {
      imageDesignStates.current[activeIndex] = currentDesignState;
      setModifiedSet(prev => new Set([...prev, activeIndex]));
    }
    // Load in-session state for the incoming image (if previously visited)
    setLoadedDesignState(imageDesignStates.current[newIndex] || null);
    setCurrentDesignState(null);
    setActiveIndex(newIndex);
  }, [activeIndex, currentDesignState]);

  // ── onModify: keep currentDesignState in sync in real time ──────────────
  const handleModify = useCallback((ds) => {
    setCurrentDesignState(ds);
  }, []);

  // ── Persist original URLs before the first save of a session ────────────
  // Called once per session — no-ops on subsequent calls.
  const persistOriginalsIfFirstSave = useCallback(() => {
    if (!ORIG_KEY) return;
    if (localStorage.getItem(ORIG_KEY)) return; // already stored from an earlier save
    const originals = originalUrls.current.filter(Boolean);
    if (!originals.length) return;
    localStorage.setItem(ORIG_KEY, JSON.stringify(originals));
    setPersistedOriginals(originals);
  }, [ORIG_KEY]);

  // ── Save current image ───────────────────────────────────────────────────
  const defaultName = useMemo(() => fileName.replace(/\.[^/.]+$/, ''), [fileName]);

  const handleSave = useCallback(async (editedImageObj, savedDesignState) => {
    persistOriginalsIfFirstSave();
    setHasSavedInSession(true);
    setIsProcessing(true);
    try {
      // Primary path: bypass Konva entirely and process the original
      // full-resolution image directly for maximum quality.
      let file;
      try {
        const blob = await applyAdjustmentsToCanvas(activeSrc, savedDesignState);
        file = new File([blob], `${defaultName}.jpg`, { type: 'image/jpeg' });
      } catch (canvasErr) {
        // Fallback: use FIE's Konva-rendered output if our pipeline fails
        // (e.g. CORS restrictions prevent fetching the original).
        console.warn('[ImageEditor] Direct canvas save failed; using FIE output:', canvasErr.message);
        const base64 = editedImageObj?.imageBase64;
        if (!base64) throw canvasErr;
        const mime  = editedImageObj.mimeType || 'image/jpeg';
        const name  = editedImageObj.fullName  || `${defaultName}.jpg`;
        const bytes = atob(base64.split(',')[1]);
        const buf   = new ArrayBuffer(bytes.length);
        const ua    = new Uint8Array(buf);
        for (let i = 0; i < bytes.length; i++) ua[i] = bytes.charCodeAt(i);
        file = new File([new Blob([buf], { type: mime })], name, { type: mime });
      }

      const { file_url } = await uploadApi.uploadFile({ file });

      // Persist design state to item metadata keyed by original URL
      if (itemId && activeSrc) {
        try {
          const { data: item } = await inventoryApi.get(itemId);
          const existing = item?.image_editor_state
            ? JSON.parse(item.image_editor_state) : {};
          existing[activeSrc] = savedDesignState;
          await inventoryApi.update(itemId, {
            image_editor_state: JSON.stringify(existing),
          });
        } catch { /* non-critical */ }
      }

      if (onSave) await onSave(file_url, activeIndex);

      toast({ title: 'Image saved' });
      if (onOpenChange) onOpenChange(false);
    } catch (err) {
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  }, [onSave, onOpenChange, toast, defaultName, activeIndex, itemId, activeSrc, persistOriginalsIfFirstSave]);

  const handleClose = useCallback(() => {
    setLoadedDesignState(null);
    if (onOpenChange) onOpenChange(false);
  }, [onOpenChange]);

  // ── Apply to all ─────────────────────────────────────────────────────────
  const handleApplyToAll = useCallback(async () => {
    const ds = currentDesignState || imageDesignStates.current[activeIndex];
    if (!ds) return;

    const others = allImages
      .map((img, i) => ({ img, i }))
      .filter(({ i }) => i !== activeIndex);

    if (!others.length) return;

    persistOriginalsIfFirstSave();
    setHasSavedInSession(true);
    setApplyingToAll(true);
    setApplyProgress({ done: 0, total: others.length });
    let done = 0;

    for (const { img, i } of others) {
      const url = getImgUrl(img);
      if (!url) { done++; continue; }
      try {
        // Pass full design state so crop ratio + rotation + finetunes are all applied
        const blob = await applyAdjustmentsToCanvas(url, ds);
        const outFile = new File([blob], `photo-${i + 1}-edited.jpg`, { type: 'image/jpeg' });
        const { file_url } = await uploadApi.uploadFile({ file: outFile });
        if (onSave) await onSave(file_url, i);
        // Don't re-apply the design state to already-processed images.
        // The edits are baked into the uploaded pixels; loading ds on top
        // would re-apply crop coordinates meant for image 1 onto image N.
        imageDesignStates.current[i] = null;
        setModifiedSet(prev => new Set([...prev, i]));
      } catch (err) {
        console.warn(`Apply-to-all: skipped image ${i + 1}`, err.message);
      }
      done++;
      setApplyProgress({ done, total: others.length });
    }

    setApplyingToAll(false);
    toast({ title: 'Edits applied to all images' });
  }, [currentDesignState, activeIndex, allImages, onSave, persistOriginalsIfFirstSave]);

  // ── Template: save ───────────────────────────────────────────────────────
  const handleSaveTemplate = useCallback(() => {
    const ds = currentDesignState;
    if (!ds || !templateName.trim()) return;
    const entry = {
      id: `tpl_${Date.now()}`,
      name: templateName.trim(),
      createdAt: Date.now(),
      designState: ds,
    };
    setTemplates(prev => {
      const next = [entry, ...prev].slice(0, MAX_TEMPLATES);
      persistTemplates(next);
      return next;
    });
    setTemplateName('');
    setShowSaveTemplate(false);
    toast({ title: `Template "${entry.name}" saved` });
  }, [currentDesignState, templateName]);

  // ── Template: load ───────────────────────────────────────────────────────
  const handleLoadTemplate = useCallback((tpl) => {
    setLoadedDesignState(tpl.designState);
    setShowTemplateMenu(false);
    toast({ title: `Template "${tpl.name}" applied` });
  }, []);

  // ── Template: delete ─────────────────────────────────────────────────────
  const handleDeleteTemplate = useCallback((id, e) => {
    e.stopPropagation();
    setTemplates(prev => {
      const next = prev.filter(t => t.id !== id);
      persistTemplates(next);
      return next;
    });
  }, []);

  // ── Reset all images to their original state ──────────────────────────────
  const handleResetAll = useCallback(async () => {
    // Prefer cross-session originals (stored before earlier saves); fall back to
    // in-session originals (captured when the editor opened this time).
    const urlsToRestore = persistedOriginals || originalUrls.current.filter(Boolean);
    if (!urlsToRestore.length) return;

    setIsProcessing(true);
    try {
      for (let i = 0; i < urlsToRestore.length; i++) {
        const url = urlsToRestore[i];
        if (url && onSave) await onSave(url, i);
      }
      // Clear all per-image design states so FIE reloads clean
      imageDesignStates.current = {};
      setModifiedSet(new Set());
      setCurrentDesignState(null);
      setLoadedDesignState(null);
      setHasSavedInSession(false);
      // These restored URLs become the new baseline for this session
      originalUrls.current = urlsToRestore;
      // Remove persisted originals — images are now back to baseline
      if (ORIG_KEY) {
        localStorage.removeItem(ORIG_KEY);
        setPersistedOriginals(null);
      }
      toast({ title: 'All images reset to original' });
    } catch (err) {
      toast({ title: 'Reset failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  }, [persistedOriginals, onSave, toast, ORIG_KEY]);

  // ── Keyboard arrow-key navigation between images ─────────────────────────
  useEffect(() => {
    if (!open || allImages.length <= 1) return;
    const onKey = (e) => {
      // Don't steal keys when the user is typing in an input/textarea
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A')
        handleSwitchImage(Math.max(0, activeIndex - 1));
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D')
        handleSwitchImage(Math.min(allImages.length - 1, activeIndex + 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, allImages.length, activeIndex, handleSwitchImage]);

  // ── Touch swipe on the top bar to navigate ───────────────────────────────
  const swipeTouchStart = useRef(null);
  const handleBarTouchStart = useCallback((e) => {
    swipeTouchStart.current = e.touches[0].clientX;
  }, []);
  const handleBarTouchEnd = useCallback((e) => {
    if (swipeTouchStart.current === null) return;
    const dx = e.changedTouches[0].clientX - swipeTouchStart.current;
    swipeTouchStart.current = null;
    if (Math.abs(dx) < 40) return; // minimum swipe distance
    if (dx < 0) handleSwitchImage(Math.min(allImages.length - 1, activeIndex + 1)); // swipe left → next
    else         handleSwitchImage(Math.max(0, activeIndex - 1));                    // swipe right → prev
  }, [allImages.length, activeIndex, handleSwitchImage]);

  // ── Mobile nav ───────────────────────────────────────────────────────────
  useEffect(() => {
    document.body.classList.toggle('hide-mobile-nav', !!open);
    return () => document.body.classList.remove('hide-mobile-nav');
  }, [open]);

  // ── Close template menu when clicking outside ─────────────────────────────
  useEffect(() => {
    if (!showTemplateMenu) return;
    const handler = (e) => {
      if (!e.target.closest('[data-template-menu]')) setShowTemplateMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showTemplateMenu]);

  if (!open || !imageSrc) return null;

  const hasMultiple = allImages.length > 1;
  const barBg    = isDark ? '#111111' : '#f0f0f0';
  const barBorder= isDark ? '#262626' : '#d4d4d4';
  const btnBase  = isDark
    ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-100 border border-neutral-600'
    : 'bg-white hover:bg-neutral-100 text-neutral-800 border border-neutral-300';
  const canApply = !!(currentDesignState || imageDesignStates.current[activeIndex]);
  // Show reset button if originals were persisted cross-session OR any save happened in-session
  const canReset = !!(persistedOriginals || hasSavedInSession || modifiedSet.size > 0);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col overflow-hidden"
      style={{
        width: '100vw', height: '100vh',
        backgroundColor: isDark ? '#0a0a0a' : '#ffffff',
        colorScheme: isDark ? 'dark' : 'light',
      }}
    >
      {/* ── Top bar: 3-column grid so filmstrip is naturally centred ── */}
      <div
        className="shrink-0"
        onTouchStart={hasMultiple ? handleBarTouchStart : undefined}
        onTouchEnd={hasMultiple ? handleBarTouchEnd : undefined}
        style={{
          height: 60,
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center',
          paddingLeft: 12,
          paddingRight: 48,
          backgroundColor: barBg,
          borderBottom: `1px solid ${barBorder}`,
        }}
      >
        {/* Col 1 – empty spacer (balances the right controls so centre column is truly centred) */}
        <div />

        {/* Col 2 – centred filmstrip with prev/next arrows */}
        <div className="flex items-center gap-2">
          {hasMultiple && (
            <button
              onClick={() => handleSwitchImage(Math.max(0, activeIndex - 1))}
              disabled={activeIndex === 0}
              title="Previous image (← / A)"
              className="shrink-0 flex items-center justify-center w-7 h-7 rounded transition-colors disabled:opacity-25"
              style={{ backgroundColor: isDark ? '#2a2a2a' : '#e5e5e5', color: isDark ? '#fafafa' : '#0a0a0a' }}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}

          {hasMultiple && (
            <div
              className="flex items-center gap-1.5 overflow-x-auto"
              style={{ maxWidth: '60vw', scrollbarWidth: 'none' }}
            >
              {allImages.map((img, idx) => {
                const url   = getImgUrl(img);
                const isAct = idx === activeIndex;
                const isMod = modifiedSet.has(idx) && !isAct;
                return (
                  <button
                    key={idx}
                    onClick={() => handleSwitchImage(idx)}
                    title={`Photo #${idx + 1}`}
                    className="relative shrink-0 rounded overflow-hidden transition-all focus:outline-none"
                    style={{
                      width: 42, height: 42,
                      border: isAct
                        ? '2px solid #3b82f6'
                        : `2px solid ${isDark ? '#404040' : '#d4d4d4'}`,
                      boxShadow: isAct ? '0 0 0 2px rgba(59,130,246,0.3)' : 'none',
                      opacity: applyingToAll && !isAct ? 0.5 : 1,
                    }}
                  >
                    {url ? (
                      <img src={url} alt="" className="w-full h-full object-cover" draggable={false} />
                    ) : (
                      <div
                        className="w-full h-full flex items-center justify-center text-[10px]"
                        style={{ backgroundColor: isDark ? '#2a2a2a' : '#e5e5e5', color: isDark ? '#737373' : '#9ca3af' }}
                      >
                        ?
                      </div>
                    )}
                    <span
                      className="absolute bottom-0 left-0 right-0 text-center text-white text-[9px] font-medium leading-4"
                      style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.7))' }}
                    >
                      #{idx + 1}
                    </span>
                    {isMod && (
                      <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-blue-400 ring-1 ring-black" />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {hasMultiple && (
            <button
              onClick={() => handleSwitchImage(Math.min(allImages.length - 1, activeIndex + 1))}
              disabled={activeIndex === allImages.length - 1}
              title="Next image (→ / D)"
              className="shrink-0 flex items-center justify-center w-7 h-7 rounded transition-colors disabled:opacity-25"
              style={{ backgroundColor: isDark ? '#2a2a2a' : '#e5e5e5', color: isDark ? '#fafafa' : '#0a0a0a' }}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Col 3 – right-side controls, justified to the right */}
        <div className="flex items-center gap-2 justify-end min-w-0">
          {/* Reset All */}
          {canReset && (
            <button
              onClick={handleResetAll}
              disabled={isProcessing}
              title={
                persistedOriginals
                  ? 'Reset all images back to their state before any edits were saved'
                  : 'Reset all images back to how they looked when you opened this editor'
              }
              className="flex items-center gap-1.5 px-3 h-8 rounded text-xs font-medium transition-colors shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                backgroundColor: isDark ? '#3b1515' : '#fef2f2',
                color:           isDark ? '#f87171' : '#dc2626',
                border:          `1px solid ${isDark ? '#7f1d1d' : '#fca5a5'}`,
              }}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset all
            </button>
          )}

          {/* Apply to all */}
          {hasMultiple && (
            <button
              onClick={handleApplyToAll}
              disabled={applyingToAll || !canApply}
              title="Applies brightness, contrast, colour, rotation &amp; aspect-ratio crop to all other images. Manual crop positions and annotations are per-image."
              className={`flex items-center gap-1.5 px-3 h-8 rounded text-xs font-medium transition-colors shrink-0 ${btnBase} disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              {applyingToAll ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  {applyProgress.done}/{applyProgress.total}
                </>
              ) : (
                <>
                  <Layers className="w-3.5 h-3.5" />
                  Apply to all
                </>
              )}
            </button>
          )}

          {/* Load template */}
          <div className="relative shrink-0" data-template-menu>
            <button
              onClick={() => setShowTemplateMenu(v => !v)}
              title="Load a saved edit template"
              className={`flex items-center gap-1.5 px-3 h-8 rounded text-xs font-medium transition-colors ${btnBase}`}
            >
              <FolderOpen className="w-3.5 h-3.5" />
              Load
            </button>
            {showTemplateMenu && (
              <div
                className="absolute right-0 top-full mt-1.5 rounded-lg overflow-hidden z-50"
                style={{
                  width: 220,
                  backgroundColor: isDark ? '#1c1c1c' : '#ffffff',
                  border: `1px solid ${isDark ? '#333' : '#e5e5e5'}`,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                }}
              >
                {templates.length === 0 ? (
                  <div className="px-4 py-3 text-xs text-center" style={{ color: isDark ? '#737373' : '#9ca3af' }}>
                    No templates yet. Make edits<br />then click "Save template".
                  </div>
                ) : (
                  <div className="overflow-y-auto" style={{ maxHeight: 240 }}>
                    {templates.map(tpl => (
                      <div
                        key={tpl.id}
                        className="flex items-center gap-1 px-3 py-2 group cursor-pointer transition-colors"
                        style={{
                          ':hover': { backgroundColor: isDark ? '#2a2a2a' : '#f5f5f5' },
                        }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = isDark ? '#2a2a2a' : '#f5f5f5'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = ''}
                        onClick={() => handleLoadTemplate(tpl)}
                      >
                        <span
                          className="flex-1 text-xs truncate"
                          style={{ color: isDark ? '#e5e5e5' : '#171717' }}
                        >
                          {tpl.name}
                        </span>
                        <button
                          onClick={(e) => handleDeleteTemplate(tpl.id, e)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded"
                          style={{ color: isDark ? '#ef4444' : '#dc2626' }}
                          title="Delete template"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Save template */}
          {showSaveTemplate ? (
            <div className="flex items-center gap-1.5 shrink-0">
              <input
                autoFocus
                value={templateName}
                onChange={e => setTemplateName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleSaveTemplate();
                  if (e.key === 'Escape') setShowSaveTemplate(false);
                }}
                placeholder="Template name"
                maxLength={40}
                className="h-8 px-2 rounded text-xs outline-none"
                style={{
                  width: 140,
                  backgroundColor: isDark ? '#2a2a2a' : '#f5f5f5',
                  border: `1px solid ${isDark ? '#444' : '#d4d4d4'}`,
                  color: isDark ? '#fafafa' : '#0a0a0a',
                }}
              />
              <button
                onClick={handleSaveTemplate}
                disabled={!templateName.trim() || !currentDesignState}
                className="h-8 px-3 rounded text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Save
              </button>
              <button
                onClick={() => { setShowSaveTemplate(false); setTemplateName(''); }}
                className="h-8 px-2 rounded text-xs transition-colors"
                style={{ color: isDark ? '#a3a3a3' : '#737373' }}
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowSaveTemplate(true)}
              disabled={!canApply}
              title="Save current edits as a reusable template"
              className={`flex items-center gap-1.5 px-3 h-8 rounded text-xs font-medium transition-colors shrink-0 ${btnBase} disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              <BookmarkPlus className="w-3.5 h-3.5" />
              Save template
            </button>
          )}
        </div>
      </div>

      {/*
        ── SVG Unsharp Mask filter ──────────────────────────────────────────
        Applied via CSS to the Konva canvas so the image appears as sharp as
        CSS <img> rendering.  This is purely a display post-process — saves
        continue to use applyAdjustmentsToCanvas with the original S3 URL so
        the USM has ZERO effect on saved pixels.
        Formula: sharpened = src + 0.35 × (src − blurred)  (radius 0.9 px)
      */}
      <svg
        aria-hidden="true"
        style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden', pointerEvents: 'none' }}
      >
        <defs>
          <filter id="orben-usm" x="-5%" y="-5%" width="110%" height="110%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="0.9" result="blurred" />
            <feComposite
              operator="arithmetic"
              k1="0" k2="1.35" k3="-0.35" k4="0"
              in="SourceGraphic"
              in2="blurred"
            />
          </filter>
        </defs>
      </svg>
      {/* Apply the USM to every Konva canvas inside the editor area */}
      <style>{`
        .orben-fie-area canvas {
          filter: url('#orben-usm');
          image-rendering: high-quality;
        }
      `}</style>

      {/* ── Filerobot Image Editor (takes remaining height) ── */}
      <div ref={editorAreaRef} className="orben-fie-area flex-1 min-h-0 overflow-hidden relative">
        {/* Loading overlay while pre-scaling for high-quality preview */}
        {fieSourceLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 z-10 gap-2">
            <Loader2 className="w-8 h-8 animate-spin text-white" />
            <span className="text-white text-sm">Preparing image…</span>
          </div>
        )}
        {!fieSourceLoading && fieSource && <FilerobotImageEditor
          key={`fie-${activeIndex}-${fieSource}`}
          source={fieSource}
          onSave={handleSave}
          onBeforeSave={() => false}
          onClose={handleClose}
          onModify={handleModify}
          observePluginContainerSize={true}
          loadableDesignState={loadedDesignState}
          annotationsCommon={{
            fill: '#3b82f6', stroke: '#1d4ed8', strokeWidth: 2,
            shadowOffsetX: 0, shadowOffsetY: 0, shadowBlur: 0, opacity: 1,
          }}
          Text={{
            text: 'Add text...',
            fontFamily: 'Arial',
            fonts: ['Arial','Helvetica','Times New Roman','Courier New','Verdana','Georgia','Comic Sans MS','Trebuchet MS','Impact'],
            fontSize: 24, letterSpacing: 0, lineHeight: 1.2,
            align: 'left', fontStyle: 'normal',
          }}
          Rotate={{ angle: 90, componentType: 'slider' }}
          Crop={{
            minWidth: 50, minHeight: 50, ratio: 'original',
            presetsItems: [
              { titleKey: 'square',    descriptionKey: '1:1',   ratio: 1 },
              { titleKey: 'landscape', descriptionKey: '16:9',  ratio: 16/9 },
              { titleKey: 'portrait',  descriptionKey: '9:16',  ratio: 9/16 },
              { titleKey: 'classicTv', descriptionKey: '4:3',   ratio: 4/3  },
            ],
            presetsFolders: [{
              titleKey: 'socialMedia',
              groups: [
                { titleKey: 'instagram', items: [
                  { titleKey: 'post',  width: 1080, height: 1080, descriptionKey: '1080x1080px' },
                  { titleKey: 'story', width: 1080, height: 1920, descriptionKey: '1080x1920px' },
                ]},
                { titleKey: 'facebook', items: [
                  { titleKey: 'profile',    width: 180,  height: 180,  descriptionKey: '180x180px'   },
                  { titleKey: 'coverPhoto', width: 820,  height: 312,  descriptionKey: '820x312px'   },
                  { titleKey: 'post',       width: 1200, height: 630,  descriptionKey: '1200x630px'  },
                ]},
                { titleKey: 'ebay', items: [
                  { titleKey: 'listing', width: 1600, height: 1600, descriptionKey: '1600x1600px' },
                  { titleKey: 'square',  width: 1000, height: 1000, descriptionKey: '1000x1000px' },
                ]},
              ],
            }],
          }}
          translations={{
            square: 'Square', landscape: 'Landscape', portrait: 'Portrait',
            classicTv: 'Classic TV', socialMedia: 'Social Media',
            instagram: 'Instagram', facebook: 'Facebook', ebay: 'eBay',
            post: 'Post', story: 'Story', profile: 'Profile',
            coverPhoto: 'Cover Photo', listing: 'Listing Photo',
          }}
          tabsIds={[TABS.ADJUST, TABS.FINETUNE, TABS.WATERMARK]}
          defaultTabId={TABS.ADJUST}
          defaultSavedImageName={defaultName}
          defaultSavedImageType="jpeg"
          defaultSavedImageQuality={0.92}
          savingPixelRatio={1}
          previewPixelRatio={window.devicePixelRatio || 2}
          theme={isDark ? {
            palette: {
              'bg-primary':            '#0a0a0a',
              'bg-secondary':          '#171717',
              'bg-stateless':          '#1e1e1e',
              'bg-primary-active':     '#3b82f6',
              'bg-secondary-active':   '#262626',
              'bg-hover':              '#2a2a2a',
              'accent-primary':        '#3b82f6',
              'accent-primary-hover':  '#2563eb',
              'accent-primary-active': '#1d4ed8',
              'accent-stateless':      '#3b82f6',
              'txt-primary':           '#fafafa',
              'txt-secondary':         '#a3a3a3',
              'txt-primary-invert':    '#ffffff',
              'txt-secondary-invert':  '#e5e5e5',
              'btn-primary-text':      '#ffffff',
              'icon-primary':          '#fafafa',
              'icons-secondary':       '#a3a3a3',
              'icons-muted':           '#6b7280',
              'icons-invert':          '#ffffff',
              'borders-primary':       '#262626',
              'borders-secondary':     '#171717',
              'link-primary':          '#60a5fa',
              'error':                 '#ef4444',
              'warning':               '#f59e0b',
              'success':               '#22c55e',
            },
            typography: { fontFamily: 'system-ui, -apple-system, sans-serif' },
          } : {
            palette: {
              'bg-primary':            '#ffffff',
              'bg-secondary':          '#f5f5f5',
              'bg-stateless':          '#f0f0f0',
              'bg-primary-active':     '#171717',
              'bg-secondary-active':   '#e5e5e5',
              'bg-hover':              '#e8e8e8',
              'accent-primary':        '#171717',
              'accent-primary-hover':  '#262626',
              'accent-primary-active': '#0a0a0a',
              'accent-stateless':      '#171717',
              'txt-primary':           '#0a0a0a',
              'txt-secondary':         '#737373',
              'txt-primary-invert':    '#ffffff',
              'txt-secondary-invert':  '#f5f5f5',
              'btn-primary-text':      '#ffffff',
              'icon-primary':          '#0a0a0a',
              'icons-secondary':       '#737373',
              'icons-muted':           '#9ca3af',
              'icons-invert':          '#ffffff',
              'borders-primary':       '#e5e5e5',
              'borders-secondary':     '#f5f5f5',
              'link-primary':          '#171717',
              'error':                 '#ef4444',
              'warning':               '#f59e0b',
              'success':               '#22c55e',
            },
            typography: { fontFamily: 'system-ui, -apple-system, sans-serif' },
          }}
        />}
      </div>

      {/* ── Apply-to-all progress overlay ── */}
      {applyingToAll && (
        <div className="absolute inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.65)' }}>
          <div
            className="rounded-xl px-8 py-6 text-center"
            style={{ backgroundColor: isDark ? '#1c1c1c' : '#ffffff', border: `1px solid ${isDark ? '#333' : '#e5e5e5'}` }}
          >
            <Loader2 className="w-9 h-9 text-blue-400 animate-spin mx-auto mb-3" />
            <p className="font-medium text-sm" style={{ color: isDark ? '#fafafa' : '#0a0a0a' }}>
              Applying edits to all images
            </p>
            <p className="text-xs mt-1" style={{ color: isDark ? '#a3a3a3' : '#737373' }}>
              {applyProgress.done} of {applyProgress.total} done
            </p>
            <div className="mt-3 rounded-full overflow-hidden h-1.5 w-40 mx-auto" style={{ backgroundColor: isDark ? '#333' : '#e5e5e5' }}>
              <div
                className="h-full bg-blue-500 transition-all"
                style={{ width: `${applyProgress.total ? (applyProgress.done / applyProgress.total) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Public wrapper — do not mount the heavy editor unless open
export function ImageEditor(props) {
  if (!props?.open) return null;
  return <ImageEditorInner {...props} />;
}
