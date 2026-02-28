import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
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

// Normalises a FIE design state to a stable JSON string for change-detection.
// Strips volatile runtime fields (the HTMLImageElement, display dimensions,
// blob URL, undo-stack internals) so only semantically meaningful edits
// — finetunes, filter, crop ratio, rotation, flip — trigger a diff.
function normalizeForComparison(ds) {
  if (!ds) return '';
  // Destructure away fields that change on every render / aren't user edits.
  // eslint-disable-next-line no-unused-vars
  const { originalImage, imgSrc, shownImageDimensions, selectionsIds,
          isDesignState, ...rest } = ds;
  // Normalise finetune class-refs to plain strings so the comparison is stable
  // across React re-renders that may produce different class instances.
  if (rest.finetunes) {
    rest.finetunes = (rest.finetunes || [])
      .map(f => (typeof f === 'string' ? f : (f?.finetuneName ?? '')))
      .filter(Boolean)
      .sort();
  }
  // Exclude crop entirely from change detection:
  //   - x, y, width, height: free-dragging the adjuster box is NOT a user edit
  //   - ratio, ratioTitleKey: preset clicks are tracked separately via presetHistoryRef
  // Rotation and flip stay in `adjustments` and ARE detected as user edits.
  if (rest.adjustments) {
    // eslint-disable-next-line no-unused-vars
    const { crop, ...adjWithoutCrop } = rest.adjustments;
    rest.adjustments = adjWithoutCrop;
  }
  return JSON.stringify(rest);
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
  // ── Stable reference for FIE's loadableDesignState prop ──────────────────
  // CRITICAL: This must use useMemo so the object reference is stable across
  // renders. The old IIFE `(() => {...})()` in the JSX created a NEW object on
  // every render. Every call to setCurrentDesignState (fired by handleModify on
  // every onModify during drag) triggered a re-render which produced a new
  // loadableDesignState reference, causing FIE's internal useUpdateEffect to
  // re-apply the stored design state (including crop position) mid-drag —
  // SNAPPING THE CROP BOX BACK. useMemo only recomputes when loadedDesignState
  // itself changes (template load / reset), never during normal drag rendering.
  const stableLoadableDesignState = useMemo(() => {
    if (!loadedDesignState) return null;
    // eslint-disable-next-line no-unused-vars
    const { imgSrc, ...rest } = loadedDesignState;
    return rest;
  }, [loadedDesignState]);
  // Suppresses onModify calls during image switches. FIE fires onModify as part
  // of its internal reset/dimension-recalc when resetOnImageSourceChange fires.
  // That is not a real user edit and should not light up the Reset All button.
  const ignoringModify = useRef(false);
  // Tracks whether the user has made any meaningful edit (including crop/flip/rotate)
  // by comparing subsequent onModify calls to the first (baseline) FIE fires on load.
  const initialDesignStateRef = useRef(null);
  const [userHasEdited, setUserHasEdited] = useState(false);
  const userHasEditedRef = useRef(false); // mirror of userHasEdited usable inside closures
  // Ref mirror of currentDesignState updated synchronously in handleModify.
  // Used by the Adjust-tab click handler to capture the pre-action state for Revert.
  const currentDesignStateRef = useRef(null);
  // The design state to restore when the user clicks Revert.
  // Set to the pre-template state when a template is loaded, and to the
  // pre-edit baseline when the first manual change is detected.
  const prevDesignStateRef = useRef(null);

  // ── Preset history for Revert (Issues 4 & 5) ────────────────────────────
  // Each entry is the full design state captured BEFORE a crop preset button
  // (Portrait, Landscape, Ellipse, etc.) was clicked. Revert pops these one
  // at a time. Free dragging the adjuster box does NOT add an entry.
  const presetHistoryRef = useRef([]);
  const [presetHistoryLen, setPresetHistoryLen] = useState(0); // reactive for UI
  // Tracks whether any finetune/filter/watermark edits were made this session.
  // Only these trigger the Reset All button (per Issue 5).
  const hasFinetuneEditsRef = useRef(false);
  const [hasFinetuneEdits, setHasFinetuneEdits] = useState(false);

  // ── Template management ──────────────────────────────────────────────────
  const [templates, setTemplates]           = useState(loadTemplates);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName]     = useState('');
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const [menuPos, setMenuPos] = useState(null); // fixed-position coords for Load dropdown
  const loadBtnRef = useRef(null);

  // ── Apply-to-all progress ────────────────────────────────────────────────
  const [applyingToAll, setApplyingToAll]   = useState(false);
  const [applyProgress, setApplyProgress]   = useState({ done: 0, total: 0 });

  // Monotonic counter — guarantees a unique FIE key on every image switch
  // so React never reuses a stale FIE instance.
  const [switchCount, setSwitchCount] = useState(0);

  // Track whether the current loadedDesignState came from a TEMPLATE (safe
  // to pass to FIE) vs from an image switch (must be null to avoid swap).
  const designStateSourceRef = useRef('none'); // 'none' | 'template' | 'db'

  // The original URL for the active image (used for thumbnails and saves).
  const activeOriginalSrc = allImages.length
    ? (getImgUrl(allImages[activeIndex]) || imageSrc)
    : imageSrc;

  // We pass an already-loaded HTMLImageElement to FIE instead of a URL.
  //
  // WHY: FIE's App component has a module-level `isFieMounted` flag that gets
  // reset to `true` when a NEW FIE instance mounts. If the OLD instance has an
  // async image load in flight, the completion fires into the NEW instance's
  // dispatch, writing the wrong image onto the canvas. Passing a pre-loaded
  // HTMLImageElement bypasses FIE's async loadImage path entirely — FIE sees
  // `img.complete === true` and dispatches SET_ORIGINAL_IMAGE synchronously.
  //
  // The pre-loading pipeline: fetch → blob → blobUrl → new Image → img.onload
  // → setActiveSrc(img). FIE receives the element, checks it's complete,
  // dispatches immediately. Zero async window for a race condition.
  const [activeSrc, setActiveSrc] = useState(null);
  const blobUrlRef = useRef(null); // tracks the blob URL so we can revoke it

  useEffect(() => {
    if (!activeOriginalSrc) { setActiveSrc(null); return; }
    let cancelled = false;
    // Do NOT null activeSrc here — keeping FIE mounted while fetching is
    // intentional. FIE stays alive showing the previous image until the new
    // HTMLImageElement is ready, then source prop changes (not a remount).
    // This eliminates the isFieMounted race that caused the image swap.
    //
    // Blob URL revocation: we intentionally do NOT revoke in the cleanup.
    // Revoking in cleanup means the old blob URL (still set as img_old.src,
    // still referenced by FIE's internal state) gets invalidated while FIE
    // is mid-transition. That causes ERR_FILE_NOT_FOUND in the console.
    // Instead, we revoke the previous blob URL inside the .then callback,
    // right before we create the new one — at that point FIE has the new
    // HTMLImageElement and the old blob URL is safe to release.

    fetch(activeOriginalSrc)
      .then(r => r.blob())
      .then(blob => {
        if (cancelled) return;
        // Revoke the previous blob URL now that we have the new data ready.
        // It is safe here because we are about to replace activeSrc entirely.
        if (blobUrlRef.current) {
          URL.revokeObjectURL(blobUrlRef.current);
          blobUrlRef.current = null;
        }
        const blobUrl = URL.createObjectURL(blob);
        blobUrlRef.current = blobUrl;
        const img = new Image();
        img.onload = () => {
          if (cancelled) return;
          console.log('[ImageEditor] HTMLImg ready idx=', activeIndex,
            'src=', activeOriginalSrc.slice(-20), 'w=', img.naturalWidth);
          setActiveSrc(img); // pass the already-loaded element to FIE
          // FIE will fire onModify as part of its internal reset
          // (resetOnImageSourceChange / dimension recalc). Give it ~300 ms to
          // finish so we can ignore those auto-modifications.
          setTimeout(() => { ignoringModify.current = false; }, 300);
        };
        img.onerror = () => {
          if (!cancelled) {
            setActiveSrc(activeOriginalSrc); // fallback to URL
            ignoringModify.current = false;
          }
        };
        img.src = blobUrl;
      })
      .catch(() => {
        if (!cancelled) {
          setActiveSrc(activeOriginalSrc);
          ignoringModify.current = false;
        }
      });

    return () => { cancelled = true; };
    // No blob revocation in cleanup — see comment above.
  }, [activeOriginalSrc, switchCount, activeIndex]);

  const editorAreaRef = useRef(null);

  // ── Post-mount safety net: verify FIE shows the correct image ─────────────
  // The pre-loaded HTMLImageElement is the correct source, but FIE's internal
  // isFieMounted race can still write the wrong originalImage into its store.
  // We poll at 50 ms, 300 ms, and 1 500 ms after activeSrc is set.
  //   • If Konva's image node has no image yet, FIE is still loading — skip
  //     and let the later interval catch it (prevents correcting too early and
  //     having FIE's own load overwrite us with the wrong image afterwards).
  //   • If the node holds a DIFFERENT HTMLImageElement than correctImg, FIE
  //     loaded the wrong image: fix its store via UPDATE_STATE (deepMerge.js
  //     treats HTMLElement as a direct-assign, not a deep merge) and also
  //     patch Konva directly for instant visual feedback.
  useEffect(() => {
    if (!(activeSrc instanceof HTMLImageElement) || !editorAreaRef.current) return;
    const correctImg = activeSrc;
    const capturedIndex = activeIndex;

    const findStage = () =>
      // Prefer the stage that lives inside our editor wrapper; fall back to
      // Konva.stages[0] so the check still works if contains() fails.
      Konva.stages?.find(s => {
        try { return editorAreaRef.current?.contains(s.container()); } catch { return false; }
      }) ?? Konva.stages?.[0];

    const check = () => {
      if (!editorAreaRef.current) return;
      const stage = findStage();
      const imgNode = stage?.findOne?.('#FIE_original-image');
      const konvaImg = imgNode?.image?.();

      // If FIE hasn't placed an image yet, do nothing — a later interval will retry.
      if (!konvaImg) return;

      // Object-identity is the reliable comparison: FIE's setOriginalImage
      // stores the passed HTMLImageElement directly into state and into Konva.
      if (konvaImg !== correctImg) {
        console.warn(
          '[ImageEditor] FIE rendered wrong image for idx=', capturedIndex,
          '— forcing correction via store + Konva',
        );
        // 1. Fix FIE's internal store so edits/saves use the right image.
        updateStateFnRef.current?.({ originalImage: correctImg, imgSrc: correctImg.src });
        // 2. Patch Konva directly for immediate visual update.
        if (imgNode) {
          imgNode.image(correctImg);
          try { imgNode.clearCache(); imgNode.cache({ pixelRatio: window.devicePixelRatio || 1 }); } catch (_) {}
          stage.batchDraw();
        }
      }
    };

    const t1 = setTimeout(check,   50);
    const t2 = setTimeout(check,  300);
    const t3 = setTimeout(check, 1500);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  // editorAreaRef is a stable ref — intentionally not in deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSrc, activeIndex, switchCount]);

  // Reset everything when a new item/editor session starts
  useEffect(() => {
    setActiveIndex(imageIndex);
    imageDesignStates.current = {};
    setModifiedSet(new Set());
    setCurrentDesignState(null);
    setLoadedDesignState(null);
    initialDesignStateRef.current = null;
    prevDesignStateRef.current = null;
    userHasEditedRef.current = false;
    setUserHasEdited(false);
    presetHistoryRef.current = [];
    setPresetHistoryLen(0);
    hasFinetuneEditsRef.current = false;
    setHasFinetuneEdits(false);
  }, [imageIndex, imageSrc]);

  // ── Lock body + html scroll while editor is open ─────────────────────────
  useEffect(() => {
    if (!open) return;
    const prevBody = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevBody;
      document.documentElement.style.overflow = prevHtml;
    };
  }, [open]);

  // ── Adjust-tab: direct click detection ───────────────────────────────────
  // FIE does not always fire onModify for every action inside the Adjust tab
  // (crop-profile select, rotate, flip). We listen for clicks on those controls
  // directly so the Revert/Reset buttons appear the moment the user interacts,
  // without waiting for them to switch to another tab.
  useEffect(() => {
    if (!open) return;
    const editorArea = editorAreaRef.current;
    if (!editorArea) return;

    const handleClick = (e) => {
      // Crop preset clicks are handled separately by the presetHistoryRef system
      // (in the unlockCrop useEffect below). Do not capture revert here for them.
      if (e.target.closest('[class*="FIE_crop-presets"], [class*="FIE_crop-preset"]')) return;

      // Target FIE's rotate and flip buttons only.
      const hit = e.target.closest(
        '[class*="FIE_rotate-"], [class*="FIE_flip-"], ' +
        '[class*="FIE_resize-options"] *'
      );
      if (!hit) return;
      if (ignoringModify.current) return; // image switch in progress — skip

      // Capture the revert point SYNCHRONOUSLY (before FIE processes the click
      // and before any 150ms delay). currentDesignStateRef holds the latest
      // design state updated by handleModify. This is the state to return to
      // when Revert is clicked, regardless of whether the user has already
      // made other edits (we always want "undo last discrete action").
      const stateToRevert = currentDesignStateRef.current || initialDesignStateRef.current;
      prevDesignStateRef.current = extractTemplateFields(stateToRevert || {});

      // After a short delay, mark the user as having edited so Revert/Reset
      // buttons appear (FIE needs time to commit the action to its store).
      setTimeout(() => {
        if (ignoringModify.current) return;
        setUserHasEdited(true);
        userHasEditedRef.current = true;
      }, 150);
    };

    editorArea.addEventListener('click', handleClick, true);
    return () => editorArea.removeEventListener('click', handleClick, true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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
        if (saved) {
          const { imgSrc: _strip, ...safeState } = saved;
          designStateSourceRef.current = 'db';
          setLoadedDesignState(safeState);
        }
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
    // Selected tab + hover: always white (dark mode was showing gray when selected, no hover)
    styleEl.textContent = `
      .FIE_tab[aria-selected="true"],
      .FIE_tab[aria-selected="true"] *,
      .FIE_tab[aria-selected="true"] svg,
      .FIE_tab[aria-selected="true"] svg *,
      .FIE_tab[aria-selected="true"] path,
      .SfxDrawer-item > div[aria-selected="true"],
      .SfxDrawer-item > div[aria-selected="true"] *,
      .SfxDrawer-item > div[aria-selected="true"] svg,
      .SfxDrawer-item > div[aria-selected="true"] path,
      .FIE_tab:hover,
      .FIE_tab:hover *,
      .FIE_tab:hover svg * {
        color: #ffffff !important;
        fill:  #ffffff !important;
        stroke: #ffffff !important;
      }
      .FIE_root ::-webkit-scrollbar { display: none !important; }
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
      // Apply white text/icon to selected TABS (Adjust, Finetune, Watermark)
      document.querySelectorAll('.FIE_tab[aria-selected="true"], .SfxDrawer-item > div[aria-selected="true"]').forEach(el => {
        el.style.setProperty('color', '#ffffff', 'important');
        el.querySelectorAll('*').forEach(child => {
          child.style.setProperty('color', '#ffffff', 'important');
          if (child.tagName === 'svg' || child.closest('svg')) {
            child.style.setProperty('fill', '#ffffff', 'important');
            child.style.setProperty('stroke', '#ffffff', 'important');
          }
        });
        // Target SVG paths directly (FIE icons use path elements)
        el.querySelectorAll('path').forEach(p => {
          p.style.setProperty('fill', '#ffffff', 'important');
          p.style.setProperty('stroke', '#ffffff', 'important');
        });
      });

      // ── Layout compaction (inline !important beats styled-components) ──────
      // Topbar: align with our custom bar (paddingRight 48px) so X/back icons
      // align with Save template, Load, etc. in the bar above.
      const topbar = document.querySelector('.FIE_topbar');
      if (topbar) {
        topbar.style.setProperty('padding', '6px 12px', 'important');
        topbar.style.setProperty('min-height', 'unset', 'important');
        topbar.style.setProperty('width', '100%', 'important');
        topbar.style.setProperty('box-sizing', 'border-box', 'important');
        // Left-side group (save button) — align with the Adjust tab in the sidebar below.
        // The sidebar (FIE_tabs) is 88px wide; centering the save button in that width
        // makes it visually aligned with the tab icons underneath.
        const leftGroup = topbar.querySelector('[class*="21g986-1"]') || topbar.firstElementChild;
        if (leftGroup) {
          leftGroup.style.setProperty('padding-left', '0', 'important');
          leftGroup.style.setProperty('width', '88px', 'important');
          leftGroup.style.setProperty('display', 'flex', 'important');
          leftGroup.style.setProperty('justify-content', 'center', 'important');
          leftGroup.style.setProperty('flex-shrink', '0', 'important');
          leftGroup.style.setProperty('margin-left', '-0.5rem', 'important');
        }
        // Right-side group (undo/redo/close) — compact children, NO absolute positioning
        const rightGroup = topbar.querySelector('[class*="21g986-2"]') || topbar.lastElementChild;
        if (rightGroup) {
          rightGroup.style.setProperty('display', 'flex', 'important');
          rightGroup.style.setProperty('gap', '0px', 'important');
          rightGroup.style.setProperty('align-items', 'center', 'important');
          rightGroup.querySelectorAll(':scope > *').forEach(btn => {
            btn.style.setProperty('margin', '0', 'important');
            btn.style.setProperty('padding', '4px', 'important');
          });
        }
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
      // Also hide any vertical scrollbar that FIE may render
      const appWrapper = document.querySelector('.FIE_root');
      if (appWrapper) {
        appWrapper.style.setProperty('border-radius', '0', 'important');
        appWrapper.style.setProperty('overflow', 'hidden', 'important');
      }
      document.querySelectorAll('.FIE_root, .FIE_root *').forEach(el => {
        el.style.setProperty('scrollbar-width', 'none', 'important');
      });

      // FIE topbar: three independent sections on one line.
      // 1. Left (save button) — fixed 88px width, centred within, aligned with tab sidebar
      // 2. Centre (pixel dimensions / zoom) — absolutely centred on the full topbar width
      // 3. Right (undo/redo/close) — pushed to far right edge, tight gap
      const topbarEl = document.querySelector('.FIE_topbar');
      if (topbarEl) {
        topbarEl.style.setProperty('position', 'relative', 'important');
        topbarEl.style.setProperty('display', 'flex', 'important');
        topbarEl.style.setProperty('justify-content', 'space-between', 'important');
        topbarEl.style.setProperty('align-items', 'center', 'important');

        // ── Center element: centred over the canvas area (not the full topbar) ──
        // The FIE_tabs sidebar is 88px wide, so the canvas spans from 88px → 100%.
        // Its midpoint is at 88/2 + 50% = 44px + 50% of the topbar width.
        const centerEl = topbarEl.querySelector('.FIE_topbar-center-options')
          || topbarEl.querySelector('[class*="topbar-center"]');
        if (centerEl) {
          centerEl.style.setProperty('position', 'absolute', 'important');
          centerEl.style.setProperty('left', 'calc(50% + 44px)', 'important');
          centerEl.style.setProperty('top', '50%', 'important');
          centerEl.style.setProperty('transform', 'translate(-50%,-50%)', 'important');
          centerEl.style.setProperty('pointer-events', 'auto', 'important');
          centerEl.style.setProperty('z-index', '0', 'important');
        }

        // ── Right group (undo/redo/close): in flex flow, 1rem from right edge ──
        // Find it via the close button so the selector is build-independent.
        const closeBtn = topbarEl.querySelector('.FIE_topbar-close-button')
          || topbarEl.querySelector('[class*="topbar-close"]');
        const rightGroup = closeBtn?.parentElement && closeBtn.parentElement !== topbarEl
          ? closeBtn.parentElement
          : (topbarEl.querySelector('[class*="21g986-2"]') || topbarEl.lastElementChild);
        if (rightGroup) {
          // Hide FIE's built-in undo/redo/close — our custom bar handles these
          rightGroup.style.setProperty('display', 'none', 'important');
        }
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
    const stateToPersist = currentDesignState || loadedDesignState;
    if (stateToPersist) {
      imageDesignStates.current[activeIndex] = stateToPersist;
      setModifiedSet(prev => new Set([...prev, activeIndex]));
    }
    setLoadedDesignState(null);
    designStateSourceRef.current = 'none';
    setCurrentDesignState(null);
    // Do NOT null activeSrc here — that would unmount FIE, flip isFieMounted
    // false→true, and create the exact race condition we're trying to avoid.
    // Instead, activeSrc transitions directly from img_old → img_new via the
    // loading effect, and FIE's own useUpdateEffect([source]) handles the swap.
    //
    // Suppress onModify during the switch: FIE fires onModify internally when
    // resetOnImageSourceChange resets its state and when it recalculates the
    // displayed image dimensions for the new image. Neither of those is a real
    // user edit. The flag is cleared in img.onload + a 300 ms grace period.
    ignoringModify.current = true;
    initialDesignStateRef.current = null; // reset baseline for the incoming image
    prevDesignStateRef.current = null;    // no revert point on a fresh image
    userHasEditedRef.current = false;
    setUserHasEdited(false);
    presetHistoryRef.current = [];
    setPresetHistoryLen(0);
    hasFinetuneEditsRef.current = false;
    setHasFinetuneEdits(false);
    setActiveIndex(newIndex);
    setSwitchCount(c => c + 1);
  }, [activeIndex, currentDesignState, loadedDesignState]);

  // ── onModify: keep currentDesignState in sync in real time ──────────────
  const handleModify = useCallback((ds) => {
    // Ignore modifications fired by FIE's internal reset/recalc during image switches.
    if (ignoringModify.current) return;
    setCurrentDesignState(ds);
    currentDesignStateRef.current = ds; // sync ref for click-handler capture

    // First call after (re)load = FIE's baseline state. Store it and do nothing else.
    if (initialDesignStateRef.current === null) {
      initialDesignStateRef.current = ds;
      return;
    }

    // On subsequent calls, compare the normalised state against the baseline.
    // normalizeForComparison excludes crop (so free-dragging and preset clicks
    // don't trigger this path) and detects finetune / rotation / flip changes.
    const base = initialDesignStateRef.current;
    const changed = normalizeForComparison(ds) !== normalizeForComparison(base);

    if (changed && !userHasEditedRef.current) {
      // First meaningful change since the last checkpoint. Save the pre-edit
      // baseline as the Revert target.
      prevDesignStateRef.current = extractTemplateFields(base);
      userHasEditedRef.current = true;
      setUserHasEdited(true);
    } else if (changed) {
      userHasEditedRef.current = true;
      setUserHasEdited(true);
    }

    // Track finetune/filter changes specifically so Reset All can show only
    // when these (not just crop) have been modified.
    if (base && !hasFinetuneEditsRef.current) {
      const baseFt = JSON.stringify({
        fp: base.finetunesProps ?? {},
        f:  base.filter ?? null,
        fi: (base.finetunes ?? [])
              .map(x => (typeof x === 'string' ? x : (x?.finetuneName ?? '')))
              .filter(Boolean).sort(),
      });
      const curFt = JSON.stringify({
        fp: ds.finetunesProps ?? {},
        f:  ds.filter ?? null,
        fi: (ds.finetunes ?? [])
              .map(x => (typeof x === 'string' ? x : (x?.finetuneName ?? '')))
              .filter(Boolean).sort(),
      });
      if (baseFt !== curFt) {
        hasFinetuneEditsRef.current = true;
        setHasFinetuneEdits(true);
      }
    }
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
        const blob = await applyAdjustmentsToCanvas(activeOriginalSrc, savedDesignState, displayDims);
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
      if (itemId && activeOriginalSrc && apiWorksRef.current) {
        try {
          const { data: item } = await inventoryApi.get(itemId);
          const existing = item?.image_editor_state
            ? JSON.parse(item.image_editor_state) : {};
          existing[activeOriginalSrc] = savedDesignState;
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
  }, [onSave, onOpenChange, toast, defaultName, activeIndex, itemId, activeOriginalSrc, persistOriginalsIfFirstSave]);

  const handleClose = useCallback(() => {
    setLoadedDesignState(null);
    setActiveSrc(null);
    // Revoke the last blob URL now that the editor is closing.
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    ignoringModify.current = false;
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
    // Save the current state as the Revert target BEFORE applying the template,
    // so clicking Revert after a template load undoes the template application.
    prevDesignStateRef.current = currentDesignState
      ? extractTemplateFields(currentDesignState)
      : {};

    const safe = extractTemplateFields(tpl.designState);
    const ds = Object.keys(safe).length ? safe : null;
    designStateSourceRef.current = 'template';
    setLoadedDesignState(ds);
    if (ds) {
      imageDesignStates.current[activeIndex] = ds;
      setModifiedSet(prev => new Set([...prev, activeIndex]));
    }
    setShowTemplateMenu(false);
    setMenuPos(null);
    // Loading a template is a finetune/edit action → show Reset All button.
    hasFinetuneEditsRef.current = true;
    setHasFinetuneEdits(true);
    // Reset edit tracking so that manual edits made AFTER the template
    // will correctly capture the template state as their own revert point.
    initialDesignStateRef.current = null;
    setUserHasEdited(false);
    toast({ title: `Template "${tpl.name}" applied` });
  }, [activeIndex, currentDesignState]);

  // Force template into FIE store when loaded. FIE's loadableDesignState
  // useUpdateEffect can race with tab switches; calling updateStateFnRef
  // directly ensures the Konva Design layer receives finetunes/filters
  // so they persist when switching to Finetune or Watermark tabs.
  //
  // includeAdjustments=true  → called on initial load/template apply.
  //   Uses the adjustments from loadedDesignState (restores saved crop/rotation/flip).
  //
  // includeAdjustments=false → called from MutationObserver tab-switch recovery.
  //   Uses the USER'S CURRENT adjustments from currentDesignStateRef, NOT the
  //   stored template adjustments. This is critical for two reasons:
  //     1. The user's crop must be visible in Finetune/Watermark tab previews —
  //        FIE partially reinitialises its canvas on tab transitions, so we must
  //        re-inject the adjustments explicitly.
  //     2. We must NOT revert to the originally-loaded crop (that caused the
  //        old snap-back bug); using currentDesignStateRef gives us whatever
  //        the user has right now, including any drag repositioning they did.
  const applyLoadedTemplate = useCallback((includeAdjustments = false) => {
    if (!loadedDesignState || Object.keys(loadedDesignState).length === 0) return;
    const { adjustments: loadedAdjustments, ...withoutAdjustments } = loadedDesignState;

    // Determine which adjustments to include in the payload.
    let adjustmentsPayload;
    if (includeAdjustments) {
      // Initial load: restore the saved crop/rotation/flip from the template/DB.
      adjustmentsPayload = loadedAdjustments;
    } else {
      // Tab-switch recovery: use the user's live adjustments so their crop
      // appears correctly in Finetune/Watermark and isn't snapped back.
      adjustmentsPayload = currentDesignStateRef.current?.adjustments ?? null;
    }

    const payload = {
      ...withoutAdjustments,
      ...(adjustmentsPayload ? { adjustments: adjustmentsPayload } : {}),
      finetunes: finetunesStrsToClasses(loadedDesignState.finetunes),
      filter: filterStrToClass(loadedDesignState.filter),
    };
    const fn = updateStateFnRef.current;
    if (fn) fn(payload);
  }, [loadedDesignState]);

  useEffect(() => {
    if (!loadedDesignState || Object.keys(loadedDesignState).length === 0) return;
    // Pass true so the initial application restores crop / rotation / flip from
    // the DB or template.  The recurring MutationObserver path calls
    // applyLoadedTemplate() with the default false (adjustments excluded).
    applyLoadedTemplate(true);
    const id = requestAnimationFrame(() => applyLoadedTemplate(true));
    return () => cancelAnimationFrame(id);
  }, [loadedDesignState, applyLoadedTemplate]);

  // Re-apply design state when the user switches away from the Adjust tab.
  //
  // Problem: FIE partially reinitialises its Konva canvas on every tab transition.
  // This clears two things:
  //   a) Finetune / filter state (from a loaded template or DB)
  //   b) The user's current crop / rotation / flip adjustments (so the cropped
  //      image is NOT shown in the Finetune or Watermark previews)
  //
  // Fix: after any aria-selected change fires (which happens on real tab clicks
  // AND on crop-preset button selection), if we are now on a non-Adjust tab:
  //   • Re-inject the current adjustments (user's live crop/rotation/flip) so
  //     Finetune and Watermark always show the cropped image.
  //   • If a saved template/DB state is loaded, also re-inject its
  //     finetunes + filter (which FIE resets on transitions).
  //
  // Snap-back prevention: we use currentDesignStateRef.current (the live state
  // at the moment of calling) rather than any stored template adjustments, so
  // the user's dragged crop position is always honoured.
  useEffect(() => {
    if (!open) return;
    const editorArea = editorAreaRef.current;
    if (!editorArea) return;

    // Returns true only when the Adjust tab is CURRENTLY VISIBLE.
    // FIE may keep all tab panels in the DOM and toggle display:none, so
    // a simple querySelector is not enough — we must check visibility.
    // offsetParent === null  ⟹  element (or an ancestor) has display:none.
    const isAdjustTab = () => {
      const area = editorAreaRef.current;
      if (!area) return false;
      const cropTool = area.querySelector('[class*="FIE_crop-tool"]');
      if (cropTool) return cropTool.offsetParent !== null;
      // Fallback: check rotate / flip controls
      const fallback = area.querySelector('[class*="FIE_rotate-tool"], [class*="FIE_flip"]');
      return !!fallback && fallback.offsetParent !== null;
    };

    // ── Drag guard ───────────────────────────────────────────────────────────
    // Track whether the user is actively pressing a pointer inside the editor.
    // doApply() must never call updateStateFnRef during a drag because FIE would
    // treat the incoming state as a new position and snap the crop back.
    let pointerDown = false;
    const onPointerDown = () => { pointerDown = true; };
    const onPointerUp   = () => { setTimeout(() => { pointerDown = false; }, 150); };
    editorArea.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('pointerup', onPointerUp, true);

    let timeoutIds = [];
    let intervalId = null;

    const doApply = () => {
      if (pointerDown) return;          // never interfere during a drag
      if (isAdjustTab()) return;        // never interfere while crop handles are visible

      if (loadedDesignState && Object.keys(loadedDesignState).length > 0) {
        // Has a saved state / template: re-apply finetunes + filter AND current adjustments.
        applyLoadedTemplate();
      } else {
        // Fresh image (no template/DB state): just re-inject the user's current
        // adjustments so their crop is visible in Finetune / Watermark.
        const adjustments = currentDesignStateRef.current?.adjustments;
        if (adjustments) {
          updateStateFnRef.current?.({ adjustments });
        }
      }
    };

    const scheduleReapply = () => {
      timeoutIds.forEach(id => clearTimeout(id));
      timeoutIds = [];
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
      // Re-apply at staggered intervals to overcome FIE's async tab-switch resets
      [0, 50, 150, 350, 800].forEach((delay) => {
        const id = setTimeout(() => {
          doApply();
          timeoutIds = timeoutIds.filter(x => x !== id);
        }, delay);
        timeoutIds.push(id);
      });
      // Poll every 200ms for 2s to overcome FIE's lingering async resets
      let elapsed = 0;
      intervalId = setInterval(() => {
        elapsed += 200;
        if (elapsed > 2000) {
          clearInterval(intervalId);
          intervalId = null;
          return;
        }
        doApply();
      }, 200);
    };

    // Fire scheduleReapply when a FIE navigation tab (Adjust/Finetune/Watermark)
    // changes its aria-selected, but NOT when a crop-preset button does.
    //
    // FIE uses at least two DOM patterns for nav tabs (.FIE_tab, and
    // .SfxDrawer-item > div) — both set aria-selected. We catch all of these
    // by EXCLUDING crop-preset elements (which also use aria-selected) rather
    // than trying to match a specific nav-tab class name.
    const obs = new MutationObserver((mutations) => {
      const hasTabSwitch = mutations.some(
        (m) =>
          m.type === 'attributes' &&
          m.attributeName === 'aria-selected' &&
          // Exclude crop-preset buttons (they also flip aria-selected on click)
          !m.target.closest?.('[class*="FIE_crop-presets"]') &&
          !(
            typeof m.target.className === 'string' &&
            m.target.className.includes('FIE_crop-preset')
          )
      );
      if (hasTabSwitch) scheduleReapply();
    });
    obs.observe(editorArea, {
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-selected'],
    });
    return () => {
      obs.disconnect();
      editorArea.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('pointerup', onPointerUp, true);
      timeoutIds.forEach(id => clearTimeout(id));
      if (intervalId) clearInterval(intervalId);
    };
  }, [open, loadedDesignState, applyLoadedTemplate]);

  // ── Auto-switch to Custom after any sized preset to allow free drag ─────────
  //
  // FIE's fixed-ratio presets (Landscape, Portrait, Square, etc.) internally
  // re-normalise the crop box position on every state update, snapping the box
  // back to its "natural" centred/max-fit position.  Switching to "Custom" mode
  // keeps the preset shape but disables the normalisation, so the user can
  // drag the crop box freely.
  //
  // Detection: we watch for aria-selected changes on crop-preset elements via
  // MutationObserver.  This is more reliable than a click listener because
  // FIE may call stopPropagation() internally on preset button clicks.
  //
  // Timing: we wait 150 ms after the preset's aria-selected changes so that
  // FIE has had time to call onModify (which populates currentDesignStateRef
  // with the crop's x/y/width/height).  We then click "Custom" to switch FIE's
  // UI to free-form mode.
  useEffect(() => {
    if (!open) return;
    const editorArea = editorAreaRef.current;
    if (!editorArea) return;

    let timer = null;

    // ── Helpers ───────────────────────────────────────────────────────────
    // Find the leaf preset elements (individual buttons, not container wrappers).
    // e.g. querySelectorAll('[class*="FIE_crop-preset"]') returns BOTH the
    // "FIE_crop-presets" container (whose textContent includes ALL preset labels)
    // AND the individual "FIE_crop-preset-item" buttons. We must filter to only
    // the leaf nodes so textContent comparisons match single-button labels.
    const getLeafPresets = (area) => {
      const all = area.querySelectorAll('[class*="FIE_crop-preset"]');
      return Array.from(all).filter(el => !el.querySelector('[class*="FIE_crop-preset"]'));
    };

    // Primary: directly zero out the ratio in FIE's state via updateStateFnRef.
    // Secondary: also click the "Custom" DOM button so FIE's UI reflects it.
    // Using updateStateFnRef as the primary means snap-back prevention works
    // even if the "Custom" button can't be found (e.g. FIE changes its class).
    const unlockCrop = () => {
      // Direct state push: preserve crop position but clear ratio constraint.
      const fn  = updateStateFnRef.current;
      const adj = currentDesignStateRef.current?.adjustments;
      if (fn && adj?.crop) {
        fn({
          adjustments: {
            ...adj,
            crop: { ...adj.crop, ratio: undefined, ratioTitleKey: 'custom' },
          },
        });
      }
      // UI sync: try to click the "Custom" leaf button so FIE's preset row shows it.
      const area = editorAreaRef.current;
      if (area) {
        const leafPresets = getLeafPresets(area);
        const customBtn = leafPresets.find(
          btn => (btn.textContent ?? '').trim().toLowerCase().includes('custom')
        );
        if (customBtn && customBtn.getAttribute('aria-selected') !== 'true') {
          customBtn.click();
        }
      }
    };

    // ── Capture-phase click listener ──────────────────────────────────────
    // Fires BEFORE FIE processes the click, so we can capture the pre-click
    // state for the preset history (Revert) and schedule unlockCrop afterward.
    const onPresetClick = (e) => {
      // Walk up from e.target to find the first leaf preset element.
      // A leaf is a FIE_crop-preset element that contains no other such elements
      // (i.e. it's an individual button, not a container or group header).
      let el = e.target;
      let leafPreset = null;
      while (el && el !== editorArea) {
        if (
          typeof el.className === 'string' &&
          el.className.includes('FIE_crop-preset') &&
          !el.querySelector('[class*="FIE_crop-preset"]')
        ) {
          leafPreset = el;
          break;
        }
        el = el.parentElement;
      }
      if (!leafPreset) return;

      const label = (leafPreset.textContent ?? '').trim().toLowerCase();
      if (label.includes('custom')) return; // Custom is auto-clicked by us — skip

      // ── Capture pre-click state for Revert history ────────────────────
      // currentDesignStateRef has the state BEFORE FIE processes this click.
      const snap = currentDesignStateRef.current
        ? { adjustments: currentDesignStateRef.current.adjustments ?? null }
        : {};
      presetHistoryRef.current.push(snap);
      setPresetHistoryLen(presetHistoryRef.current.length);

      // Schedule unlockCrop with a longer delay than rAF so FIE's onModify
      // has time to fire and populate currentDesignStateRef with the preset's
      // crop position (especially important for "Original" which is computed).
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { timer = null; unlockCrop(); }, 200);
    };
    editorArea.addEventListener('click', onPresetClick, true); // capture phase

    // ── MutationObserver fallback ─────────────────────────────────────────
    // Belt-and-suspenders: also watch aria-selected changes in case the click
    // event doesn't propagate (e.g. FIE calls stopPropagation internally).
    const obs = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type !== 'attributes' || m.attributeName !== 'aria-selected') continue;
        if (m.target.getAttribute('aria-selected') !== 'true') continue;

        // Must be a leaf crop-preset element (not a container or nav tab)
        const isLeafPreset =
          typeof m.target.className === 'string' &&
          m.target.className.includes('FIE_crop-preset') &&
          !m.target.querySelector?.('[class*="FIE_crop-preset"]');
        if (!isLeafPreset) continue;

        const label = (m.target.textContent ?? '').trim().toLowerCase();
        if (label.includes('custom')) continue; // skip our own auto-click

        // The click listener (capture phase) fires before FIE handlers, so it
        // usually captures state and sets the timer first. The MutationObserver
        // is a last-resort fallback for edge cases where the click listener
        // didn't run (e.g. non-click activations). Only act when timer is unset.
        if (!timer) {
          // Also capture state so Revert has an entry.
          const fallbackSnap = currentDesignStateRef.current
            ? { adjustments: currentDesignStateRef.current.adjustments ?? null }
            : {};
          presetHistoryRef.current.push(fallbackSnap);
          setPresetHistoryLen(presetHistoryRef.current.length);
          timer = setTimeout(() => { timer = null; unlockCrop(); }, 200);
        }
      }
    });

    obs.observe(editorArea, {
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-selected'],
    });

    return () => {
      obs.disconnect();
      editorArea.removeEventListener('click', onPresetClick, true);
      if (timer) clearTimeout(timer);
    };
  }, [open]);

  // ── Revert: restore the state that existed before the last significant action ──
  // Priority order:
  //   1. Crop preset history (Issue 4): each preset click (Portrait, Landscape…)
  //      pushed the pre-click state onto presetHistoryRef. Revert pops one entry
  //      and restores just the crop — or remounts FIE if there was no prior crop.
  //   2. Template / rotation / flip revert (existing behaviour): prevDesignStateRef
  //      captures the state before a template load or a rotate/flip action.
  const handleRevertTemplate = useCallback(() => {
    const fn = updateStateFnRef.current;

    // Builds an explicit adjustments object that FIE can safely deep-merge.
    //
    // IMPORTANT: Never include `crop: null` — FIE crashes immediately trying to
    // read null.x / null.ratio inside its crop-calculation pipeline.
    // When there is no previous crop to restore, omit the crop key entirely.
    // Crop state is cleared by the setSwitchCount(…) remount below instead.
    const buildAdjustments = (src) => {
      const adj = {
        rotation:   src?.rotation   || 0,
        isFlippedX: src?.isFlippedX || false,
        isFlippedY: src?.isFlippedY || false,
      };
      if (src?.crop && typeof src.crop === 'object') adj.crop = src.crop;
      return adj;
    };

    // ── 1. Preset history revert ──────────────────────────────────────────
    if (presetHistoryRef.current.length > 0) {
      const snap = presetHistoryRef.current.pop();
      setPresetHistoryLen(presetHistoryRef.current.length);

      const prevAdj = snap?.adjustments ?? null;
      const prevCrop = prevAdj?.crop;

      if (prevCrop && typeof prevCrop === 'object') {
        // Restore the crop from before the last preset click.
        // This brings back whatever shape/position was active previously.
        fn?.({
          adjustments: buildAdjustments(prevAdj),
        });
      } else {
        // The state before the last preset had no crop (original full image).
        // We must remount FIE to clear the crop (setting crop: null crashes FIE).
        // Preserve any existing finetunes so they survive the remount.
        const cur = currentDesignStateRef.current;
        if (cur) {
          const preserve = extractTemplateFields(cur);
          // Strip crop from the preserved state so remount starts with no crop.
          if (preserve.adjustments?.crop) delete preserve.adjustments.crop;
          if (Object.keys(preserve).length > 0) {
            designStateSourceRef.current = 'template';
            setLoadedDesignState(preserve);
          }
        }
        setSwitchCount(c => c + 1); // remount FIE → full image, no crop
      }
      toast({ title: 'Reverted' });
      return;
    }

    // ── 2. Template / rotation / flip revert (existing behaviour) ────────
    const prevState = prevDesignStateRef.current;
    prevDesignStateRef.current = null;

    if (prevState && Object.keys(prevState).length > 0) {
      if (fn) {
        fn({
          finetunesProps: prevState.finetunesProps || {},
          finetunes: finetunesStrsToClasses(prevState.finetunes || []),
          filter: filterStrToClass(prevState.filter),
          adjustments: buildAdjustments(prevState.adjustments),
        });
      }
      const clean = extractTemplateFields(prevState);
      if (Object.keys(clean).length > 0) {
        designStateSourceRef.current = 'template';
        setLoadedDesignState(clean);
      } else {
        setLoadedDesignState(null);
      }
      toast({ title: 'Reverted' });
    } else {
      setLoadedDesignState(null);
      if (fn) fn({
        finetunesProps: {},
        finetunes: [],
        filter: null,
        adjustments: { rotation: 0, isFlippedX: false, isFlippedY: false },
      });
      setSwitchCount(c => c + 1);
      toast({ title: 'Edits cleared' });
    }

    // Reset edit tracking so the next change starts fresh.
    initialDesignStateRef.current = null;
    prevDesignStateRef.current = null;
    userHasEditedRef.current = false;
    setUserHasEdited(false);
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
    // ── Session reset (Issue 5): reset the current image to how it looked
    // when the editor was first opened this session. This clears all edits:
    // crop, finetune, watermark, loaded templates, etc.
    // If there are cross-session saved originals, also restore those URLs.
    const urlsToRestore = persistedOriginals || originalUrls.current.filter(Boolean);

    setIsProcessing(true);
    try {
      // 1. Restore original URLs to the database (only when saved originals exist).
      if (urlsToRestore.length) {
        for (let i = 0; i < urlsToRestore.length; i++) {
          const url = urlsToRestore[i];
          if (url && onSave) await onSave(url, i);
        }
      }

      // 2. Clear all per-image design states.
      imageDesignStates.current = {};
      setModifiedSet(new Set());
      setCurrentDesignState(null);
      setLoadedDesignState(null);
      designStateSourceRef.current = 'none';
      setHasSavedInSession(false);

      // 3. Clear all edit tracking refs.
      initialDesignStateRef.current = null;
      prevDesignStateRef.current = null;
      userHasEditedRef.current = false;
      setUserHasEdited(false);
      presetHistoryRef.current = [];
      setPresetHistoryLen(0);
      hasFinetuneEditsRef.current = false;
      setHasFinetuneEdits(false);

      // 4. These restored URLs become the new baseline for this session.
      if (urlsToRestore.length) originalUrls.current = urlsToRestore;

      // 5. Remove persisted originals — images are now back to baseline.
      if (ORIG_KEY) {
        localStorage.removeItem(ORIG_KEY);
        setPersistedOriginals(null);
      }

      // 6. Force FIE to remount with the original image source so the canvas
      //    reflects the reset pixels even before the parent query refetches.
      setSwitchCount(c => c + 1);

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
    if (!open || !activeSrc) return;
    const editorArea = editorAreaRef.current;
    if (!editorArea) return;

    const oImg = document.createElement('img');
    // activeSrc may be an HTMLImageElement (when using pre-load approach)
    // or a string URL (fallback). Always use the string src.
    oImg.src = activeSrc instanceof HTMLImageElement ? activeSrc.src : activeSrc;
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

      // ── Overlay visibility & crop clipping ─────────────────────────────────
      //
      // The overlay is a full-resolution <img> that sits between Konva's canvas
      // layers.  On the Adjust tab it provides a sharper image behind the crop
      // handles.  On Finetune/Watermark we use CSS clip-path to show ONLY the
      // selected crop region, so the user always sees the correctly cropped
      // preview regardless of whether FIE's Konva layer has applied the crop.
      //
      // Coordinate system: crop.x / crop.y / crop.width / crop.height are in
      // display-space pixels relative to the image node — the same coordinate
      // space as effW / effH — so they map directly to inset() values.
      //
      // isAdjustTab uses offsetParent (null == display:none) so the check is
      // correct whether FIE unmounts the tab panel or just hides it with CSS.
      const cropToolEl = editorArea.querySelector('[class*="FIE_crop-tool"]');
      const adjFallback = editorArea.querySelector('[class*="FIE_rotate-tool"], [class*="FIE_flip"]');
      const isAdjustTab = (cropToolEl && cropToolEl.offsetParent !== null) ||
                          (adjFallback && adjFallback.offsetParent !== null);

      // Use the synchronously-updated ref so we always have the latest state
      // even if the designStateRef useEffect hasn't committed yet this frame.
      const liveState  = currentDesignStateRef.current ?? designStateRef.current;
      const cropAdj    = liveState?.adjustments?.crop;
      const hasCropCoords = cropAdj &&
        cropAdj.x != null && cropAdj.y != null &&
        cropAdj.width != null && cropAdj.height != null;
      const hasAnyFinetunes = !!(liveState?.finetunesProps &&
        Object.keys(liveState.finetunesProps).length > 0);

      if (!isAdjustTab) {
        if (hasCropCoords) {
          // Clip overlay to the crop rectangle so Finetune/Watermark show the
          // cropped preview at full <img> quality (no reliance on FIE canvas).
          const top    = Math.max(0, cropAdj.y);
          const right  = Math.max(0, effW - (cropAdj.x + cropAdj.width));
          const bottom = Math.max(0, effH - (cropAdj.y + cropAdj.height));
          const left   = Math.max(0, cropAdj.x);
          const cv = `inset(${top}px ${right}px ${bottom}px ${left}px)`;
          if (oImg.style.clipPath !== cv) oImg.style.clipPath = cv;
        } else if (cropAdj) {
          // Crop preset selected but coordinates not yet populated → hide
          // overlay to avoid flashing the full uncropped image.
          oImg.style.display = 'none';
          return;
        } else if (!hasAnyFinetunes) {
          // No crop, no finetunes → overlay not needed on Finetune/Watermark.
          oImg.style.display = 'none';
          return;
        } else {
          // Finetune-only (no crop) → show full overlay with CSS filter.
          if (oImg.style.clipPath) oImg.style.clipPath = '';
        }
      } else {
        // Adjust tab → full overlay, no clip.
        if (oImg.style.clipPath) oImg.style.clipPath = '';
      }

      if (oImg.style.display === 'none' && inserted) oImg.style.display = 'block';

      const fp = liveState?.finetunesProps || {};
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
  }, [open, activeSrc, activeIndex]);

  // NOTE: The "Preserve crop adjustments across tab switches" effect was removed.
  // It used childList:true which fired on every canvas repaint during crop-handle
  // dragging. FIE briefly removes/re-adds crop-tool DOM elements when a preset is
  // selected, causing the observer's isAdjust check to return false momentarily.
  // That false negative scheduled fn({adjustments}) timeouts that fired mid-drag,
  // snapping the crop box back to its pre-drag position. The scheduleReapply effect
  // above (aria-selected only, no childList) covers this use-case without the bug.

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

  // ── Recalculate portal position whenever the menu opens ───────────────────
  // useLayoutEffect fires synchronously after the DOM is painted, so the
  // button's bounding rect is always fresh — no click-handler timing issues.
  useEffect(() => {
    if (!showTemplateMenu) { setMenuPos(null); return; }
    if (!loadBtnRef.current) return;
    const r = loadBtnRef.current.getBoundingClientRect();
    setMenuPos({ top: r.bottom + 6, right: window.innerWidth - r.right });
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
  // True when the user has applied non-zero finetunes, a filter, or annotations in the current session
  const hasCurrentEdits = !!(
    currentDesignState && (
      (currentDesignState.finetunesProps &&
        Object.values(currentDesignState.finetunesProps).some(v => v != null && v !== 0)) ||
      currentDesignState.filter ||
      currentDesignState.finetunes?.length ||
      currentDesignState.annotations?.length
    )
  );
  // Revert button: shows when there is a preset in history (Portrait, Landscape…),
  // a loaded template, or a rotation/flip edit to undo (userHasEdited).
  // Does NOT show for free crop-box dragging (crop excluded from normalizeForComparison).
  const canRevert = presetHistoryLen > 0 || hasTemplate || userHasEdited;
  // Reset All button: shows only for finetune/filter/watermark edits and loaded
  // templates (per Issue 5). Does NOT show for crop-only or drag-only changes.
  // Also shows when there are saved images to restore (persisted originals).
  const canResetAll = hasFinetuneEdits || hasTemplate || persistedOriginals || hasSavedInSession;
  // Keep canReset for any other downstream usage that may reference it.
  const canReset = canRevert || canResetAll;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col overflow-hidden"
      style={{
        width: '100vw', height: '100vh',
        backgroundColor: isDark ? '#0a0a0a' : '#ffffff',
        colorScheme: isDark ? 'dark' : 'light',
      }}
    >
      {/* ── Top bar: flex centers the filmstrip, right controls are absolute ── */}
      <div
        className="shrink-0"
        onTouchStart={hasMultiple ? handleBarTouchStart : undefined}
        onTouchEnd={hasMultiple ? handleBarTouchEnd : undefined}
        style={{
          height: 60,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          position: 'relative',
          backgroundColor: barBg,
          borderBottom: `1px solid ${barBorder}`,
        }}
      >
        {/* Filmstrip – centred by parent's justify-content: center */}
        {hasMultiple && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleSwitchImage(Math.max(0, activeIndex - 1))}
              disabled={activeIndex === 0}
              title="Previous image (← / A)"
              className="shrink-0 flex items-center justify-center w-7 h-7 rounded transition-colors disabled:opacity-25"
              style={{ backgroundColor: isDark ? '#2a2a2a' : '#e5e5e5', color: isDark ? '#fafafa' : '#0a0a0a' }}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

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

            <button
              onClick={() => handleSwitchImage(Math.min(allImages.length - 1, activeIndex + 1))}
              disabled={activeIndex === allImages.length - 1}
              title="Next image (→ / D)"
              className="shrink-0 flex items-center justify-center w-7 h-7 rounded transition-colors disabled:opacity-25"
              style={{ backgroundColor: isDark ? '#2a2a2a' : '#e5e5e5', color: isDark ? '#fafafa' : '#0a0a0a' }}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Right-side controls – absolutely positioned at top-right */}
        <div
          className="flex items-center gap-2 min-w-0"
          style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)' }}
        >
          {/* Revert – shown for preset changes (Portrait/Landscape/…), template
               loads, rotation, and flip. NOT shown for free crop-box dragging. */}
          {canRevert && (
            <button
              onClick={handleRevertTemplate}
              title={
                presetHistoryLen > 0
                  ? 'Undo the last crop preset (go back one step)'
                  : 'Revert filter and adjustment edits on this image'
              }
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
          {/* Reset All – shown only for finetune/watermark changes or loaded
               templates. Resets the image back to its session-initial state. */}
          {canResetAll && (
            <button
              onClick={handleResetAll}
              disabled={isProcessing}
              title={
                persistedOriginals
                  ? 'Reset all images back to their state before any edits were saved'
                  : 'Reset all edits (finetune, watermark, templates) for this session'
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
              ref={loadBtnRef}
              onClick={() => setShowTemplateMenu(v => !v)}
              title="Load a saved edit template"
              className={`flex items-center gap-1.5 px-3 h-8 rounded text-xs font-medium transition-colors ${btnBase}`}
            >
              <FolderOpen className="w-3.5 h-3.5" />
              Load
            </button>
            {showTemplateMenu && menuPos && createPortal(
              <div
                data-template-menu
                className="rounded-lg overflow-hidden"
                style={{
                  position: 'fixed',
                  top: menuPos.top,
                  right: menuPos.right,
                  width: 220,
                  backgroundColor: isDark ? '#1c1c1c' : '#ffffff',
                  border: `1px solid ${isDark ? '#333' : '#e5e5e5'}`,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                  zIndex: 999999,
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
              </div>,
              document.body
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

          {/* Close button – sits after Save Template with breathing room from screen edge */}
          <button
            onClick={handleClose}
            title="Close editor"
            className="flex items-center justify-center w-8 h-8 rounded text-sm font-medium transition-colors shrink-0 ml-2"
            style={{
              backgroundColor: isDark ? '#2a2a2a' : '#f0f0f0',
              color: isDark ? '#a3a3a3' : '#555',
              border: `1px solid ${isDark ? '#404040' : '#d4d4d4'}`,
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* ── Filerobot Image Editor (takes remaining height) ── */}
      {/* FIE uses a STABLE key so it never remounts during image switches.     */}
      {/* Switching images changes the `source` prop; FIE's own                */}
      {/* useUpdateEffect([source]) reloads the image without an               */}
      {/* unmount→mount cycle. That cycle was flipping isFieMounted            */}
      {/* false→true and creating the race condition that swapped images.      */}
      <div ref={editorAreaRef} className="flex-1 min-h-0 overflow-hidden relative">
        {activeSrc && <FilerobotImageEditor
          key={`fie-${imageSrc}`}
          source={activeSrc}
          resetOnImageSourceChange={true}
          onSave={handleSave}
          onBeforeSave={() => false}
          onClose={handleClose}
          onModify={handleModify}
          observePluginContainerSize={true}
          loadableDesignState={stableLoadableDesignState}
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
