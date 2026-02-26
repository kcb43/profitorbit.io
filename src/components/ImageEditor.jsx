import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import FilerobotImageEditor, { TABS } from 'react-filerobot-image-editor';
import finetunesStrsToClasses from 'react-filerobot-image-editor/lib/utils/finetunesStrsToClasses';
import filterStrToClass from 'react-filerobot-image-editor/lib/utils/filterStrToClass';
import Konva from 'konva';
import { Factory as KonvaFactory } from 'konva/lib/Factory';
import { getNumberValidator } from 'konva/lib/Validators';
import { Loader2, Trash2, BookmarkPlus, FolderOpen, Layers, ChevronLeft, ChevronRight, RotateCcw, Undo2 } from 'lucide-react';
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

// ── Ensure Konva uses highest-quality image smoothing ────────────────────────
;(function () {
  if (typeof CanvasRenderingContext2D === 'undefined') return;
  const _orig = CanvasRenderingContext2D.prototype.drawImage;
  if (_orig && _orig._fie_hq) return;
  function hqSmoothing() {
    this.imageSmoothingEnabled = true;
    this.imageSmoothingQuality = 'high';
    return _orig.apply(this, arguments);
  }
  hqSmoothing._fie_hq = true;
  CanvasRenderingContext2D.prototype.drawImage = hqSmoothing;
})();

// ── Template persistence ───────────────────────────────────────────────────────
const TEMPLATES_KEY = 'orben_editor_templates';
const MAX_TEMPLATES = 20;

// Maps finetunesProps keys to FIE finetune string names (for finetunesStrsToClasses).
// FIE stores finetunes as class refs internally; JSON loses them. Infer from props.
const FINETUNE_PROP_TO_NAME = {
  gammaBrightness: 'GammaBrightness',
  shadowsValue: 'Shadows',
  warmth: 'Warmth',
  threshold: 'CustomThreshold',
  brightness: 'Brightness',
  contrast: 'Contrast',
};

// Extracts ONLY reusable, image-agnostic fields from a FIE design state.
// Everything else (imgSrc, annotations, selectionsIds, undo history,
// shownImageDimensions, resize, etc.) is image-specific or internal state
// that corrupts / crashes the editor when deep-merged into a different image.
function extractTemplateFields(ds) {
  if (!ds) return {};
  const tpl = {};
  if (ds.finetunesProps && Object.keys(ds.finetunesProps).length) {
    tpl.finetunesProps = { ...ds.finetunesProps };
    // Infer finetunes string names from props (ds.finetunes may be class refs that
    // don't serialize). FIE's finetunesStrsToClasses needs these for Konva filters.
    const inferred = Object.keys(tpl.finetunesProps)
      .map(k => FINETUNE_PROP_TO_NAME[k])
      .filter(Boolean);
    if (inferred.length) tpl.finetunes = inferred;
  } else if (Array.isArray(ds.finetunes) && ds.finetunes.length) {
    const names = ds.finetunes
      .map(f => (typeof f === 'string' ? f : f?.finetuneName))
      .filter(Boolean);
    if (names.length) tpl.finetunes = names;
  }
  if (ds.filter) tpl.filter = ds.filter;
  if (ds.adjustments) {
    tpl.adjustments = {};
    if (ds.adjustments.crop) {
      tpl.adjustments.crop = {};
      if (ds.adjustments.crop.ratio != null)
        tpl.adjustments.crop.ratio = ds.adjustments.crop.ratio;
      if (ds.adjustments.crop.ratioTitleKey != null)
        tpl.adjustments.crop.ratioTitleKey = ds.adjustments.crop.ratioTitleKey;
    }
    if (ds.adjustments.rotation) tpl.adjustments.rotation = ds.adjustments.rotation;
    if (ds.adjustments.isFlippedX) tpl.adjustments.isFlippedX = ds.adjustments.isFlippedX;
    if (ds.adjustments.isFlippedY) tpl.adjustments.isFlippedY = ds.adjustments.isFlippedY;
  }
  return tpl;
}

function loadTemplates() {
  try {
    const raw = JSON.parse(localStorage.getItem(TEMPLATES_KEY) || '[]');
    // Migrate: re-sanitize every stored template so legacy entries that
    // contain imgSrc, annotations, selectionsIds, etc. are cleaned up.
    const clean = raw.map(t => ({
      ...t,
      designState: extractTemplateFields(t.designState),
    }));
    // Persist the cleaned list back so migration only happens once.
    if (JSON.stringify(clean) !== JSON.stringify(raw))
      localStorage.setItem(TEMPLATES_KEY, JSON.stringify(clean));
    return clean;
  }
  catch { return []; }
}
function persistTemplates(list) {
  localStorage.setItem(TEMPLATES_KEY, JSON.stringify(list));
}

// ── Canvas-based batch adjustment processor ─────────────────────────────────
// Fetches each image as a blob first (avoids CORS canvas taint), then applies:
//   • Finetune adjustments from finetunesProps (Konva filter names → CSS filters)
//   • Rotation / flip from adjustments.rotation / isFlippedX / isFlippedY
//   • Crop from adjustments.crop (explicit coords + ratio, or ratio-only fallback)
// displayDims: { w, h } — the image's display size in the FIE stage, needed to
//   convert crop coordinates from display space to source image space.
// Returns a Promise<Blob>.
async function applyAdjustmentsToCanvas(imgUrl, designState = {}, displayDims = null) {
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

      // ── Crop ─────────────────────────────────────────────────────────────
      const crop = adj.crop || {};
      const cropRatio = crop.ratio;
      let srcX = 0, srcY = 0, srcW = w, srcH = h;

      // Prefer explicit crop coordinates (set when user manually resizes the
      // crop handles).  They are in FIE display coordinates and need to be
      // scaled to the source image's pixel space.
      if (displayDims && displayDims.w > 0 && displayDims.h > 0 &&
          crop.width != null && crop.height != null &&
          crop.width > 0 && crop.height > 0) {
        const sx = w / displayDims.w;
        const sy = h / displayDims.h;
        srcX = Math.max(0, Math.round((crop.x || 0) * sx));
        srcY = Math.max(0, Math.round((crop.y || 0) * sy));
        srcW = Math.min(w - srcX, Math.round(crop.width * sx));
        srcH = Math.min(h - srcY, Math.round(crop.height * sy));
      } else if (cropRatio && cropRatio !== 'original' && typeof cropRatio === 'number') {
        // Fallback: ratio-only crop (centered, maximum size).
        // Used by Apply-to-All where display dims aren't available.
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
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
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
  const apiWorksRef = useRef(false);

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
  const updateStateFnRef = useRef(null);

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

  // ── Same-origin blob source for FIE ──────────────────────────────────────
  // Fetch the original image as a blob so the canvas stays untainted for
  // filters and saves.  NO prescaling or re-encoding — the full-resolution
  // original is passed straight to FIE.  The hqDrawImage multi-step bicubic
  // patch + CSS USM sharpening handle display quality without any lossy
  // intermediate encoding step.
  const [fieSource,        setFieSource]        = useState(null);
  const [fieSourceLoading, setFieSourceLoading] = useState(false);
  const prevBlobUrl = useRef(null);
  const editorAreaRef = useRef(null);
  const fetchGenerationRef = useRef(0);

  useEffect(() => {
    if (!open || !activeSrc || !isValidImgUrl(activeSrc)) {
      setFieSource(activeSrc || null);
      setFieSourceLoading(false);
      return;
    }

    setFieSource(null);
    setFieSourceLoading(true);
    let cancelled = false;
    const gen = ++fetchGenerationRef.current;

    (async () => {
      let blobUrl = null;
      try {
        const resp = await fetch(activeSrc);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const blob = await resp.blob();
        blobUrl = URL.createObjectURL(blob);
      } catch (err) {
        console.warn('[ImageEditor] Blob fetch failed, using original URL:', err.message);
      }

      if (!cancelled && gen === fetchGenerationRef.current) {
        if (prevBlobUrl.current) URL.revokeObjectURL(prevBlobUrl.current);
        prevBlobUrl.current = blobUrl;
        setFieSource(blobUrl || activeSrc);
        setFieSourceLoading(false);
      } else if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    })();

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
    apiWorksRef.current = false;
    let cancelled = false;
    (async () => {
      try {
        const { data: item } = await inventoryApi.get(itemId);
        if (cancelled) return;
        apiWorksRef.current = true;
        if (!item?.image_editor_state) return;
        const states = JSON.parse(item.image_editor_state);
        const saved = states[imageSrc];
        if (saved) setLoadedDesignState(saved);
      } catch { /* non-critical — API may not support this item */ }
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
    // Selected tab + hover: always white (dark mode was showing gray when selected)
    styleEl.textContent = `
      .FIE_tab[aria-selected="true"],
      .FIE_tab[aria-selected="true"] *,
      .FIE_tab[aria-selected="true"] svg,
      .FIE_tab[aria-selected="true"] svg *,
      .FIE_tab:hover,
      .FIE_tab:hover *,
      .FIE_tab:hover svg * {
        color: #ffffff !important;
        fill:  #ffffff !important;
      }
    `;

    function paintTabs() {
      // ── Tab & tool-button colours ──────────────────────────────────────────
      // Clear inline color on ALL deselected elements (tabs AND tool buttons)
      document.querySelectorAll(
        '.FIE_root [aria-selected="false"]',
      ).forEach(el => {
        el.style.removeProperty('color');
        el.querySelectorAll('*').forEach(child => {
          child.style.removeProperty('color');
          child.style.removeProperty('fill');
        });
      });
      // Apply white text only to selected TABS (not tool buttons — those are
      // handled by CSS and the FIE palette).
      document.querySelectorAll('.FIE_tab[aria-selected="true"], .SfxDrawer-item > div[aria-selected="true"]').forEach(el => {
        el.style.setProperty('color', '#ffffff', 'important');
        el.querySelectorAll('*').forEach(child => {
          child.style.setProperty('color', '#ffffff', 'important');
          if (child.tagName === 'svg' || child.closest('svg'))
            child.style.setProperty('fill', '#ffffff', 'important');
        });
      });

      // ── Layout compaction (inline !important beats styled-components) ──────
      // Topbar: align with our custom bar (paddingRight 12 to match left; X/back
      // icons align with Save template, Load, etc. in the bar above).
      const topbar = document.querySelector('.FIE_topbar');
      if (topbar) {
        topbar.style.setProperty('padding', '6px 12px 6px 12px', 'important');
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
        // Read the image's display dimensions from the Konva stage so the
        // crop coordinates can be mapped from display space to source space.
        let displayDims = null;
        try {
          const stage = Konva.stages?.[0];
          const imgNode = stage?.findOne('#FIE_original-image');
          if (imgNode) displayDims = { w: imgNode.width(), h: imgNode.height() };
        } catch { /* non-critical */ }
        const blob = await applyAdjustmentsToCanvas(activeSrc, savedDesignState, displayDims);
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

      // Persist design state to item metadata (only if the initial load succeeded)
      if (itemId && activeSrc && apiWorksRef.current) {
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
      designState: extractTemplateFields(ds),
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
    const safe = extractTemplateFields(tpl.designState);
    const ds = Object.keys(safe).length ? safe : null;
    setLoadedDesignState(ds);
    if (ds) {
      imageDesignStates.current[activeIndex] = ds;
      setModifiedSet(prev => new Set([...prev, activeIndex]));
    }
    setShowTemplateMenu(false);
    toast({ title: `Template "${tpl.name}" applied` });
  }, [activeIndex]);

  // Force template into FIE store when loaded. FIE's loadableDesignState
  // useUpdateEffect can race with tab switches; calling updateStateFnRef
  // directly ensures the Konva Design layer receives finetunes/filters
  // so they persist when switching to Finetune or Watermark tabs.
  const applyLoadedTemplate = useCallback(() => {
    if (!loadedDesignState || Object.keys(loadedDesignState).length === 0) return;
    const payload = {
      ...loadedDesignState,
      finetunes: finetunesStrsToClasses(loadedDesignState.finetunes),
      filter: filterStrToClass(loadedDesignState.filter),
    };
    const fn = updateStateFnRef.current;
    if (fn) fn(payload);
  }, [loadedDesignState]);

  useEffect(() => {
    if (!loadedDesignState || Object.keys(loadedDesignState).length === 0) return;
    applyLoadedTemplate();
    const id = requestAnimationFrame(applyLoadedTemplate);
    return () => cancelAnimationFrame(id);
  }, [loadedDesignState, applyLoadedTemplate]);

  // Re-apply template when switching to Finetune or Watermark tabs.
  // FIE resets Konva state during tab transitions; re-applying at multiple intervals restores the design.
  useEffect(() => {
    if (!open || !loadedDesignState || Object.keys(loadedDesignState).length === 0) return;
    const editorArea = editorAreaRef.current;
    if (!editorArea) return;

    const isAdjustTab = () => !!editorAreaRef.current?.querySelector(
      '[class*="FIE_crop-tool"], [class*="FIE_rotate-tool"], [class*="FIE_flip"]'
    );

    let timeoutIds = [];
    let intervalId = null;

    const scheduleReapply = () => {
      timeoutIds.forEach(id => clearTimeout(id));
      timeoutIds = [];
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
      // Re-apply immediately and at staggered intervals
      [0, 50, 150, 350, 800].forEach((delay) => {
        const id = setTimeout(() => {
          if (!isAdjustTab()) applyLoadedTemplate();
          timeoutIds = timeoutIds.filter(x => x !== id);
        }, delay);
        timeoutIds.push(id);
      });
      // Poll every 200ms for 2s to overcome FIE's async tab-switch resets
      let elapsed = 0;
      intervalId = setInterval(() => {
        elapsed += 200;
        if (elapsed > 2000) {
          clearInterval(intervalId);
          intervalId = null;
          return;
        }
        if (!isAdjustTab()) applyLoadedTemplate();
      }, 200);
    };

    const obs = new MutationObserver(scheduleReapply);
    obs.observe(editorArea, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-selected'],
    });
    return () => {
      obs.disconnect();
      timeoutIds.forEach(id => clearTimeout(id));
      if (intervalId) clearInterval(intervalId);
    };
  }, [open, loadedDesignState, applyLoadedTemplate]);

  // ── Revert template / last change ───────────────────────────────────────
  const handleRevertTemplate = useCallback(() => {
    if (!loadedDesignState || Object.keys(loadedDesignState).length === 0) return;
    setLoadedDesignState(null);
    const fn = updateStateFnRef.current;
    if (fn) fn({ finetunesProps: {}, finetunes: [], filter: null });
    toast({ title: 'Template reverted' });
  }, [loadedDesignState]);

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

  // ── Sharp image overlay ────────────────────────────────────────────────
  // A native <img> element layered between Konva's Design canvas and its
  // Transformers canvas.  The browser's GPU renders <img> with Lanczos
  // filtering — the exact same pipeline Canva uses.
  //
  // Critical quality details:
  //   1. CSS width/height are set to the EFFECTIVE display size (including
  //      zoom).  This forces the browser to rasterize at full resolution
  //      instead of rasterizing small and CSS-scaling up.
  //   2. For the common case (no rotation, no flip) we use left/top
  //      positioning with NO CSS transform at all, so the browser never
  //      creates a compositing layer that could be rasterized at a lower
  //      resolution.
  //   3. Explicit z-index stacking ensures the overlay is always above
  //      the Design Layer (blurry Konva image) and below the Transformers
  //      Layer (crop handles, annotations).
  const overlayRafRef = useRef(null);
  const designStateRef = useRef(null);
  // Overlay uses currentDesignState (from onModify) or loadedDesignState (from template).
  // FIE does not call onModify when applying loadableDesignState, so we need both.
  useEffect(() => {
    designStateRef.current = currentDesignState ?? loadedDesignState;
  }, [currentDesignState, loadedDesignState]);

  useEffect(() => {
    if (!open || !fieSource || fieSourceLoading) return;
    const editorArea = editorAreaRef.current;
    if (!editorArea) return;

    const oImg = document.createElement('img');
    oImg.src = fieSource;
    oImg.draggable = false;
    oImg.style.cssText =
      'position:absolute;pointer-events:none;display:none;' +
      'image-rendering:high-quality;z-index:1;left:0;top:0';

    let imgLoaded = false;
    oImg.onload = () => { imgLoaded = true; };
    oImg.onerror = () => { imgLoaded = false; };

    let inserted = false;
    let prevKey = '';

    function sync() {
      overlayRafRef.current = requestAnimationFrame(sync);

      const stage = Konva.stages?.[0];
      if (!stage) return;
      const imgNode = stage.findOne('#FIE_original-image');
      if (!imgNode) return;
      const konvaDiv = editorArea.querySelector('.konvajs-content');
      if (!konvaDiv) return;

      // Re-insert if Konva rebuilt its DOM (tab switch, etc.)
      if (inserted && !oImg.parentNode) inserted = false;

      if (!inserted) {
        const canvases = konvaDiv.querySelectorAll('canvas');
        if (canvases.length < 2) return;
        if (!imgLoaded) return;
        konvaDiv.insertBefore(oImg, canvases[1]);
        oImg.style.display = 'block';
        // Explicit z-index stacking: Design canvas < overlay < Transformers canvas
        for (let i = 1; i < canvases.length; i++) canvases[i].style.zIndex = '2';
        inserted = true;
      }

      const m = imgNode.getAbsoluteTransform().getMatrix();
      const nodeW = imgNode.width();
      const nodeH = imgNode.height();

      // Decompose scale (includes zoom) out of the matrix
      const sx = Math.hypot(m[0], m[1]) || 1;
      const sy = Math.hypot(m[2], m[3]) || 1;
      const effW = nodeW * sx;
      const effH = nodeH * sy;

      // Unit-scale rotation/flip components
      const ra = m[0] / sx, rb = m[1] / sx;
      const rc = m[2] / sy, rd = m[3] / sy;

      // Detect the common case: no rotation, no flip
      const isSimple = Math.abs(rb) < 0.001 && Math.abs(rc) < 0.001
                     && ra > 0 && rd > 0;

      const key = `${effW},${effH},${m[4]},${m[5]},${isSimple},${ra},${rb},${rc},${rd}`;
      if (key !== prevKey) {
        prevKey = key;
        oImg.style.width  = effW + 'px';
        oImg.style.height = effH + 'px';
        if (isSimple) {
          // No CSS transform at all — browser rasterizes at full CSS size
          // with no compositing layer overhead
          oImg.style.left = m[4] + 'px';
          oImg.style.top  = m[5] + 'px';
          oImg.style.transform = '';
          oImg.style.transformOrigin = '';
        } else {
          oImg.style.left = '0';
          oImg.style.top  = '0';
          oImg.style.transformOrigin = '0 0';
          oImg.style.transform =
            `matrix(${ra},${rb},${rc},${rd},${m[4]},${m[5]})`;
        }
      }

      // Show overlay on Adjust tab for sharp crop/rotate preview.
      // On Finetune/Watermark: keep overlay visible when we have a loaded template
      // (finetunesProps), because FIE's Konva layer often fails to apply loadableDesignState
      // on tab switch — hiding would reveal the raw image. Once Konva has the design,
      // both overlay and Konva match; overlay has pointer-events:none so interaction works.
      const isAdjustTab = !!editorArea.querySelector(
        '[class*="FIE_crop-tool"], [class*="FIE_rotate-tool"], [class*="FIE_flip"]'
      );
      const hasFinetunes = designStateRef.current?.finetunesProps &&
        Object.keys(designStateRef.current.finetunesProps).length > 0;
      if (!isAdjustTab && !hasFinetunes) {
        oImg.style.display = 'none';
        return;
      }
      if (oImg.style.display === 'none' && inserted) oImg.style.display = 'block';

      const fp = designStateRef.current?.finetunesProps || {};
      const br = fp.brightness ?? 0;
      const ct = fp.contrast ?? 0;
      const gm = fp.gammaBrightness ?? 0;
      const parts = [];
      if (br !== 0) parts.push(`brightness(${1 + br})`);
      if (ct !== 0) parts.push(`contrast(${Math.max(0, 1 + ct / 100)})`);
      if (gm !== 0) parts.push(`brightness(${Math.pow(2, gm / 50)})`);
      oImg.style.filter = parts.length ? parts.join(' ') : '';
    }

    const obs = new MutationObserver(() => {
      if (!inserted && editorArea.querySelector('.konvajs-content canvas')) sync();

      // Strip leftover inline color on deselected tool buttons (FIE bug: inline
      // !important color persists after aria-selected flips to false).
      editorArea.querySelectorAll('[class*="tool-button"]:not([aria-selected="true"])')
        .forEach(btn => { if (btn.style.color) btn.style.removeProperty('color'); });
    });
    obs.observe(editorArea, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-selected'] });
    overlayRafRef.current = requestAnimationFrame(sync);

    return () => {
      obs.disconnect();
      if (overlayRafRef.current) cancelAnimationFrame(overlayRafRef.current);
      oImg.remove();
      inserted = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, fieSource, fieSourceLoading, activeIndex]);

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
  const hasTemplate = !!(loadedDesignState && Object.keys(loadedDesignState).length > 0);
  // Show reset button if originals were persisted cross-session OR any save happened in-session OR template/edits applied
  const canReset = !!(persistedOriginals || hasSavedInSession || modifiedSet.size > 0 || hasTemplate);

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
          paddingRight: 12,
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
          {/* Revert template (undo last change when template was applied) */}
          {hasTemplate && (
            <button
              onClick={handleRevertTemplate}
              title="Revert the template you just applied"
              className="flex items-center gap-1.5 px-3 h-8 rounded text-xs font-medium transition-colors shrink-0"
              style={{
                backgroundColor: isDark ? '#1e3a5f' : '#eff6ff',
                color:           isDark ? '#93c5fd' : '#2563eb',
                border:          `1px solid ${isDark ? '#1e40af' : '#bfdbfe'}`,
              }}
            >
              <Undo2 className="w-3.5 h-3.5" />
              Revert
            </button>
          )}
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

      {/* ── Filerobot Image Editor (takes remaining height) ── */}
      <div ref={editorAreaRef} className="flex-1 min-h-0 overflow-hidden relative">
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
          updateStateFnRef={updateStateFnRef}
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
              'bg-active':             '#3b82f6',
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
              'border-primary-stateless': '#404040',
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
              'bg-active':             '#dbeafe',
              'bg-primary-active':     '#3b82f6',
              'bg-secondary-active':   '#e5e5e5',
              'bg-hover':              '#e8e8e8',
              'accent-primary':        '#3b82f6',
              'accent-primary-hover':  '#2563eb',
              'accent-primary-active': '#1d4ed8',
              'accent-stateless':      '#3b82f6',
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
              'border-primary-stateless': '#d4d4d4',
              'link-primary':          '#3b82f6',
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
