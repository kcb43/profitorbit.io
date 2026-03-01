import { useState, useCallback, useRef } from 'react';
import { applyAdjustmentsToCanvas } from './utils/applyAdjustmentsToCanvas';
import { getImgUrl } from './utils/imageHelpers';
import { uploadApi } from '@/api/uploadApi';
import { inventoryApi } from '@/api/inventoryApi';

export function useImageProcessor({
  allImages,
  itemId,
  onSave,
  onOpenChange,
  toast,
}) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [applyingToAll, setApplyingToAll] = useState(false);
  const [applyProgress, setApplyProgress] = useState({ done: 0, total: 0 });
  const originalUrls = useRef(null);
  const ORIG_KEY = itemId ? `orben_editor_originals_${itemId}` : null;

  // Capture original URLs on first save
  const persistOriginalsIfFirstSave = useCallback(() => {
    if (!ORIG_KEY) return;
    if (localStorage.getItem(ORIG_KEY)) return;
    const originals = (allImages || []).map(getImgUrl).filter(Boolean);
    if (!originals.length) return;
    localStorage.setItem(ORIG_KEY, JSON.stringify(originals));
    originalUrls.current = originals;
  }, [ORIG_KEY, allImages]);

  // ── Save single image ────────────────────────────────────────────────────
  const handleSave = useCallback(
    async (imageState, activeIndex, activeOriginalSrc, fileName) => {
      persistOriginalsIfFirstSave();
      setIsProcessing(true);
      try {
        const blob = await applyAdjustmentsToCanvas(
          activeOriginalSrc,
          imageState,
          imageState.watermarks || []
        );
        const name = (fileName || 'edited-image').replace(/\.[^/.]+$/, '');
        const file = new File([blob], `${name}.jpg`, { type: 'image/jpeg' });
        const { file_url } = await uploadApi.uploadFile({ file });

        // Persist design state to item metadata
        if (itemId && activeOriginalSrc) {
          try {
            const { data: item } = await inventoryApi.get(itemId);
            const existing = item?.image_editor_state
              ? JSON.parse(item.image_editor_state)
              : {};
            // Store in our new format
            existing[activeOriginalSrc] = {
              crop: imageState.crop,
              finetune: imageState.finetune,
              rotation: imageState.rotation,
              flipH: imageState.flipH,
              flipV: imageState.flipV,
            };
            await inventoryApi.update(itemId, {
              image_editor_state: JSON.stringify(existing),
            });
          } catch {
            /* non-critical */
          }
        }

        if (onSave) await onSave(file_url, activeIndex);
        toast?.({ title: 'Image saved' });
        if (onOpenChange) onOpenChange(false);
      } catch (err) {
        toast?.({ title: 'Save failed', description: err.message, variant: 'destructive' });
      } finally {
        setIsProcessing(false);
      }
    },
    [itemId, onSave, onOpenChange, toast, persistOriginalsIfFirstSave]
  );

  // ── Apply to all images ──────────────────────────────────────────────────
  const handleApplyToAll = useCallback(
    async (imageState, activeIndex) => {
      if (!allImages || allImages.length <= 1) return;
      persistOriginalsIfFirstSave();

      const others = allImages
        .map((img, i) => ({ img, i }))
        .filter(({ i }) => i !== activeIndex);

      if (!others.length) return;

      setApplyingToAll(true);
      setApplyProgress({ done: 0, total: others.length });
      let done = 0;

      for (const { img, i } of others) {
        const url = getImgUrl(img);
        if (!url) {
          done++;
          continue;
        }
        try {
          // Apply finetune + rotation + flip + aspect ratio (but not absolute crop position)
          const stateForOther = {
            ...imageState,
            crop: {
              ...imageState.crop,
              // Clear absolute crop position - use ratio only for other images
              croppedAreaPixels: null,
              croppedArea: null,
              position: { x: 0, y: 0 },
              zoom: 1,
            },
          };
          const blob = await applyAdjustmentsToCanvas(url, stateForOther, imageState.watermarks || []);
          const outFile = new File([blob], `photo-${i + 1}-edited.jpg`, { type: 'image/jpeg' });
          const { file_url } = await uploadApi.uploadFile({ file: outFile });
          if (onSave) await onSave(file_url, i);
        } catch (err) {
          console.warn(`Apply-to-all: skipped image ${i + 1}`, err.message);
        }
        done++;
        setApplyProgress({ done, total: others.length });
      }

      setApplyingToAll(false);
      toast?.({ title: 'Edits applied to all images' });
    },
    [allImages, onSave, toast, persistOriginalsIfFirstSave]
  );

  // ── Reset all (restore originals) ────────────────────────────────────────
  const handleResetAllImages = useCallback(async () => {
    if (!ORIG_KEY) return;
    setIsProcessing(true);
    try {
      let originals;
      try {
        originals = JSON.parse(localStorage.getItem(ORIG_KEY) || 'null');
      } catch {
        originals = null;
      }

      if (originals && originals.length && onSave) {
        for (let i = 0; i < originals.length; i++) {
          const url = originals[i];
          if (url) await onSave(url, i);
        }
      }

      // Clear persisted originals — images are back to baseline
      localStorage.removeItem(ORIG_KEY);
      toast?.({ title: 'All images reset to original' });
    } catch (err) {
      toast?.({ title: 'Reset failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  }, [ORIG_KEY, onSave, toast]);

  return {
    isProcessing,
    applyingToAll,
    applyProgress,
    handleSave,
    handleApplyToAll,
    handleResetAllImages,
  };
}
