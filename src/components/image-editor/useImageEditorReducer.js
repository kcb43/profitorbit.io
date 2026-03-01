import { useReducer, useCallback } from 'react';

// ── Default state for a single image ────────────────────────────────────────
const DEFAULT_IMAGE_STATE = {
  crop: {
    position: { x: 0, y: 0 },
    zoom: 1,
    croppedAreaPixels: null, // { x, y, width, height } in source pixels
    croppedArea: null,       // { x, y, width, height } in percentages
    aspect: null,            // null = free, number = locked (e.g. 1, 16/9)
    aspectLabel: 'Original',
  },
  finetune: {
    brightness: 0,  // -100..100 (gamma curve)
    contrast: 0,    // -100..100
    shadows: 0,     // -100..100 (luminance-weighted)
  },
  rotation: 0,      // 0, 90, 180, 270
  flipH: false,
  flipV: false,
  watermarks: [],   // [{ id, text, fontFamily, fontSize, color, x, y, opacity }]
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function cloneImageState(state) {
  return JSON.parse(JSON.stringify(state));
}

function snapshotForUndo(imageState) {
  // Clone everything except undoStack and sessionStart (avoid circular nesting)
  const { undoStack, sessionStart, ...rest } = imageState;
  return cloneImageState(rest);
}

function pushUndo(imageState) {
  return {
    ...imageState,
    undoStack: [...imageState.undoStack, snapshotForUndo(imageState)],
  };
}

function getOrInitImage(state, index) {
  if (state.images[index]) return state.images[index];
  const fresh = {
    ...cloneImageState(DEFAULT_IMAGE_STATE),
    undoStack: [],
    sessionStart: cloneImageState(DEFAULT_IMAGE_STATE),
  };
  return fresh;
}

function updateCurrentImage(state, updater) {
  const idx = state.activeImageIndex;
  const current = getOrInitImage(state, idx);
  const updated = updater(current);
  return {
    ...state,
    images: { ...state.images, [idx]: updated },
  };
}

function markEdited(state, index) {
  if (state.editedIndices.includes(index)) return state.editedIndices;
  return [...state.editedIndices, index];
}

// Check if an image has been modified from its session start.
// Excludes auto-computed crop fields (croppedAreaPixels, croppedArea,
// position, zoom) because react-easy-crop fires onCropComplete on mount,
// which would falsely flag brand-new images as "modified".
function isModified(imageState) {
  if (!imageState || !imageState.sessionStart) return false;
  const strip = (obj) => {
    const { undoStack, sessionStart, ...rest } = obj;
    const clone = JSON.parse(JSON.stringify(rest));
    // Zero out auto-set crop fields
    if (clone.crop) {
      delete clone.crop.croppedAreaPixels;
      delete clone.crop.croppedArea;
      delete clone.crop.position;
      delete clone.crop.zoom;
    }
    return clone;
  };
  return JSON.stringify(strip(imageState)) !== JSON.stringify(strip({ ...imageState.sessionStart, undoStack: [], sessionStart: null }));
}

// ── Reducer ─────────────────────────────────────────────────────────────────

function imageEditorReducer(state, action) {
  switch (action.type) {
    // ── Tab navigation ────────────────────────────────────────────────────
    case 'SET_TAB':
      return { ...state, activeTab: action.tab };

    // ── Image initialization ──────────────────────────────────────────────
    case 'INIT_IMAGE': {
      const { index } = action;
      if (state.images[index]) return state; // already initialized
      const fresh = {
        ...cloneImageState(DEFAULT_IMAGE_STATE),
        undoStack: [],
        sessionStart: cloneImageState(DEFAULT_IMAGE_STATE),
      };
      return {
        ...state,
        images: { ...state.images, [index]: fresh },
      };
    }

    // ── Crop: position during drag (no undo) ──────────────────────────────
    case 'SET_CROP_POSITION':
      return updateCurrentImage(state, (img) => ({
        ...img,
        crop: {
          ...img.crop,
          position: action.position,
          zoom: action.zoom ?? img.crop.zoom,
        },
      }));

    // ── Crop: final area on drag end (no undo, just records coordinates) ──
    case 'SET_CROP_COMPLETE':
      return updateCurrentImage(state, (img) => ({
        ...img,
        crop: {
          ...img.crop,
          croppedAreaPixels: action.croppedAreaPixels,
          croppedArea: action.croppedArea,
        },
      }));

    // ── Crop: aspect ratio preset (pushes undo) ──────────────────────────
    case 'SET_ASPECT':
      return updateCurrentImage(state, (img) => {
        const withUndo = pushUndo(img);
        return {
          ...withUndo,
          crop: {
            ...withUndo.crop,
            aspect: action.aspect,
            aspectLabel: action.aspectLabel || 'Custom',
            // Reset position/zoom when changing aspect so crop recenters
            position: { x: 0, y: 0 },
            zoom: 1,
            croppedAreaPixels: null,
            croppedArea: null,
          },
        };
      });

    // ── Finetune: preview during slider drag (no undo) ────────────────────
    case 'SET_FINETUNE_PREVIEW':
      return updateCurrentImage(state, (img) => ({
        ...img,
        finetune: { ...img.finetune, [action.key]: action.value },
      }));

    // ── Finetune: committed value on slider release (pushes undo) ─────────
    case 'SET_FINETUNE':
      return updateCurrentImage(state, (img) => {
        // Only push undo if value actually changed from the last undo snapshot
        const lastUndo = img.undoStack[img.undoStack.length - 1];
        const prevValue = lastUndo?.finetune?.[action.key] ?? img.sessionStart?.finetune?.[action.key] ?? 0;
        if (prevValue === action.value) return img; // no change

        const withUndo = pushUndo({
          ...img,
          // Restore the finetune to the pre-drag value before pushing undo
          // so the undo snapshot captures the state BEFORE the drag started
          finetune: {
            ...img.finetune,
            [action.key]: prevValue,
          },
        });
        return {
          ...withUndo,
          finetune: { ...withUndo.finetune, [action.key]: action.value },
        };
      });

    // ── Finetune: reset all three sliders in one undo step ─────────────────
    case 'RESET_FINETUNE':
      return updateCurrentImage(state, (img) => {
        const { brightness, contrast, shadows } = img.finetune;
        // Skip if already zeroed
        if (brightness === 0 && contrast === 0 && shadows === 0) return img;
        const withUndo = pushUndo(img);
        return {
          ...withUndo,
          finetune: { brightness: 0, contrast: 0, shadows: 0 },
        };
      });

    // ── Rotation (pushes undo) ────────────────────────────────────────────
    case 'ROTATE_LEFT':
      return updateCurrentImage(state, (img) => {
        const withUndo = pushUndo(img);
        return { ...withUndo, rotation: (withUndo.rotation + 270) % 360 };
      });

    case 'ROTATE_RIGHT':
      return updateCurrentImage(state, (img) => {
        const withUndo = pushUndo(img);
        return { ...withUndo, rotation: (withUndo.rotation + 90) % 360 };
      });

    // ── Flip (pushes undo) ────────────────────────────────────────────────
    case 'FLIP_H':
      return updateCurrentImage(state, (img) => {
        const withUndo = pushUndo(img);
        return { ...withUndo, flipH: !withUndo.flipH };
      });

    case 'FLIP_V':
      return updateCurrentImage(state, (img) => {
        const withUndo = pushUndo(img);
        return { ...withUndo, flipV: !withUndo.flipV };
      });

    // ── Watermarks ────────────────────────────────────────────────────────
    case 'ADD_WATERMARK':
      return updateCurrentImage(state, (img) => {
        const withUndo = pushUndo(img);
        return {
          ...withUndo,
          watermarks: [...withUndo.watermarks, action.watermark],
        };
      });

    case 'UPDATE_WATERMARK':
      return updateCurrentImage(state, (img) => ({
        ...img,
        watermarks: img.watermarks.map((wm) =>
          wm.id === action.id ? { ...wm, ...action.updates } : wm
        ),
      }));

    case 'REMOVE_WATERMARK':
      return updateCurrentImage(state, (img) => {
        const withUndo = pushUndo(img);
        return {
          ...withUndo,
          watermarks: withUndo.watermarks.filter((wm) => wm.id !== action.id),
        };
      });

    // ── Templates ─────────────────────────────────────────────────────────
    case 'LOAD_TEMPLATE':
      return updateCurrentImage(state, (img) => {
        const withUndo = pushUndo(img);
        const tpl = action.template;
        return {
          ...withUndo,
          finetune: tpl.finetune
            ? { ...withUndo.finetune, ...tpl.finetune }
            : withUndo.finetune,
          crop: tpl.crop
            ? {
                ...withUndo.crop,
                aspect: tpl.crop.aspect ?? null,
                aspectLabel: tpl.crop.aspectLabel ?? 'Custom',
                position: { x: 0, y: 0 },
                zoom: 1,
                croppedAreaPixels: null,
                croppedArea: null,
              }
            : withUndo.crop,
          rotation: tpl.rotation ?? withUndo.rotation,
          flipH: tpl.flipH ?? withUndo.flipH,
          flipV: tpl.flipV ?? withUndo.flipV,
        };
      });

    // ── Revert (pop one undo entry) ───────────────────────────────────────
    case 'REVERT': {
      const idx = state.activeImageIndex;
      const img = state.images[idx];
      if (!img || img.undoStack.length === 0) return state;
      const prev = img.undoStack[img.undoStack.length - 1];
      return {
        ...state,
        images: {
          ...state.images,
          [idx]: {
            ...prev,
            undoStack: img.undoStack.slice(0, -1),
            sessionStart: img.sessionStart,
          },
        },
      };
    }

    // ── Reset All (restore session start) ─────────────────────────────────
    case 'RESET_ALL': {
      const idx = state.activeImageIndex;
      const img = state.images[idx];
      if (!img) return state;
      return {
        ...state,
        images: {
          ...state.images,
          [idx]: {
            ...cloneImageState(img.sessionStart),
            undoStack: [],
            sessionStart: img.sessionStart,
          },
        },
        editedIndices: state.editedIndices.filter((i) => i !== idx),
      };
    }

    // ── Reset ALL images (full session reset) ─────────────────────────────
    case 'RESET_ALL_IMAGES': {
      const resetImages = {};
      for (const [idx, img] of Object.entries(state.images)) {
        resetImages[idx] = {
          ...cloneImageState(img.sessionStart),
          undoStack: [],
          sessionStart: img.sessionStart,
        };
      }
      return {
        ...state,
        images: resetImages,
        editedIndices: [],
      };
    }

    // ── Switch image (state persists in images map) ───────────────────────
    case 'SWITCH_IMAGE':
      return { ...state, activeImageIndex: action.index };

    // ── Mark image as edited ──────────────────────────────────────────────
    case 'MARK_EDITED':
      return {
        ...state,
        editedIndices: markEdited(state, action.index),
      };

    // ── Apply to All: copy finetune + rotation + flip + aspect to all ─────
    case 'APPLY_TO_ALL': {
      const sourceImg = state.images[state.activeImageIndex];
      if (!sourceImg) return state;
      const newImages = { ...state.images };
      const allIndices = Object.keys(newImages).map(Number);
      for (const idx of allIndices) {
        if (idx === state.activeImageIndex) continue;
        const target = newImages[idx];
        if (!target) continue;
        newImages[idx] = {
          ...pushUndo(target),
          finetune: { ...sourceImg.finetune },
          rotation: sourceImg.rotation,
          flipH: sourceImg.flipH,
          flipV: sourceImg.flipV,
          crop: {
            ...target.crop,
            aspect: sourceImg.crop.aspect,
            aspectLabel: sourceImg.crop.aspectLabel,
            // Reset position for each image since crop position is image-specific
            position: { x: 0, y: 0 },
            zoom: 1,
            croppedAreaPixels: null,
            croppedArea: null,
          },
        };
      }
      return {
        ...state,
        images: newImages,
        editedIndices: allIndices,
      };
    }

    // ── Load saved state from DB ──────────────────────────────────────────
    case 'LOAD_SAVED_STATE': {
      const { index, savedState } = action;
      const current = getOrInitImage(state, index);
      return {
        ...state,
        images: {
          ...state.images,
          [index]: {
            ...current,
            ...savedState,
            undoStack: [],
            sessionStart: { ...savedState },
          },
        },
      };
    }

    default:
      return state;
  }
}

// ── Initial state factory ───────────────────────────────────────────────────

function createInitialState(imageIndex = 0) {
  return {
    activeTab: 'adjust',
    activeImageIndex: imageIndex,
    images: {},
    editedIndices: [],
  };
}

// ── Hook ────────────────────────────────────────────────────────────────────

export function useImageEditorReducer(imageIndex = 0) {
  const [state, dispatch] = useReducer(imageEditorReducer, imageIndex, createInitialState);

  // Convenience getters
  const currentImage = state.images[state.activeImageIndex] || null;
  const canRevert = currentImage?.undoStack?.length > 0;
  const canResetAll = currentImage ? isModified(currentImage) : false;

  // Action creators
  const actions = {
    setTab: useCallback((tab) => dispatch({ type: 'SET_TAB', tab }), []),
    initImage: useCallback((index) => dispatch({ type: 'INIT_IMAGE', index }), []),
    setCropPosition: useCallback((position, zoom) =>
      dispatch({ type: 'SET_CROP_POSITION', position, zoom }), []),
    setCropComplete: useCallback((croppedArea, croppedAreaPixels) =>
      dispatch({ type: 'SET_CROP_COMPLETE', croppedArea, croppedAreaPixels }), []),
    setAspect: useCallback((aspect, aspectLabel) =>
      dispatch({ type: 'SET_ASPECT', aspect, aspectLabel }), []),
    setFinetunePreview: useCallback((key, value) =>
      dispatch({ type: 'SET_FINETUNE_PREVIEW', key, value }), []),
    setFinetune: useCallback((key, value) =>
      dispatch({ type: 'SET_FINETUNE', key, value }), []),
    rotateLeft: useCallback(() => dispatch({ type: 'ROTATE_LEFT' }), []),
    rotateRight: useCallback(() => dispatch({ type: 'ROTATE_RIGHT' }), []),
    flipH: useCallback(() => dispatch({ type: 'FLIP_H' }), []),
    flipV: useCallback(() => dispatch({ type: 'FLIP_V' }), []),
    addWatermark: useCallback((watermark) =>
      dispatch({ type: 'ADD_WATERMARK', watermark }), []),
    updateWatermark: useCallback((id, updates) =>
      dispatch({ type: 'UPDATE_WATERMARK', id, updates }), []),
    removeWatermark: useCallback((id) =>
      dispatch({ type: 'REMOVE_WATERMARK', id }), []),
    loadTemplate: useCallback((template) =>
      dispatch({ type: 'LOAD_TEMPLATE', template }), []),
    resetFinetune: useCallback(() => dispatch({ type: 'RESET_FINETUNE' }), []),
    revert: useCallback(() => dispatch({ type: 'REVERT' }), []),
    resetAll: useCallback(() => dispatch({ type: 'RESET_ALL' }), []),
    resetAllImages: useCallback(() => dispatch({ type: 'RESET_ALL_IMAGES' }), []),
    switchImage: useCallback((index) => dispatch({ type: 'SWITCH_IMAGE', index }), []),
    markEdited: useCallback((index) => dispatch({ type: 'MARK_EDITED', index }), []),
    applyToAll: useCallback(() => dispatch({ type: 'APPLY_TO_ALL' }), []),
    loadSavedState: useCallback((index, savedState) =>
      dispatch({ type: 'LOAD_SAVED_STATE', index, savedState }), []),
  };

  return { state, dispatch, currentImage, canRevert, canResetAll, actions };
}

export { DEFAULT_IMAGE_STATE };
