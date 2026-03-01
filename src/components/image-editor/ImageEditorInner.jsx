import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useToast } from '@/components/ui/use-toast';
import { inventoryApi } from '@/api/inventoryApi';
import { useImageEditorReducer } from './useImageEditorReducer';
import { useImageProcessor } from './useImageProcessor';
import { useTemplates } from './useTemplates';
import { getImgUrl, fetchImageAsBlob } from './utils/imageHelpers';

import TabSidebar from './components/TabSidebar';
import Toolbar from './components/Toolbar';
import CropView from './components/CropView';
import CropPanel from './components/CropPanel';
import PreviewView from './components/PreviewView';
import FinetunePanel from './components/FinetunePanel';
import WatermarkPanel from './components/WatermarkPanel';
import Filmstrip from './components/Filmstrip';
import ProgressOverlay from './components/ProgressOverlay';

export default function ImageEditorInner({
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

  // ── Dark mode detection ─────────────────────────────────────────────────
  const [isDark, setIsDark] = useState(
    () => document.documentElement.classList.contains('dark')
  );
  useEffect(() => {
    const root = document.documentElement;
    const obs = new MutationObserver(() => setIsDark(root.classList.contains('dark')));
    obs.observe(root, { attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

  // ── Core state machine ──────────────────────────────────────────────────
  const { state, currentImage, canRevert, canResetAll, actions } =
    useImageEditorReducer(imageIndex);

  // ── Image blob URL management ───────────────────────────────────────────
  const [blobUrl, setBlobUrl] = useState(null);
  const blobCleanupRef = useRef(null);

  const activeOriginalSrc = allImages.length
    ? getImgUrl(allImages[state.activeImageIndex]) || imageSrc
    : imageSrc;

  // Fetch image as blob URL whenever the active image changes
  useEffect(() => {
    if (!activeOriginalSrc) {
      setBlobUrl(null);
      return;
    }
    let cancelled = false;

    fetchImageAsBlob(activeOriginalSrc)
      .then(({ blobUrl: url, cleanup }) => {
        if (cancelled) {
          cleanup();
          return;
        }
        // Cleanup previous blob
        blobCleanupRef.current?.();
        blobCleanupRef.current = cleanup;
        setBlobUrl(url);
      })
      .catch(() => {
        if (!cancelled) setBlobUrl(activeOriginalSrc); // fallback to direct URL
      });

    return () => {
      cancelled = true;
    };
  }, [activeOriginalSrc]);

  // Cleanup blob on unmount
  useEffect(() => {
    return () => {
      blobCleanupRef.current?.();
    };
  }, []);

  // ── Initialize image state for current index ────────────────────────────
  useEffect(() => {
    actions.initImage(state.activeImageIndex);
  }, [state.activeImageIndex, actions]);

  // ── Load saved design state from DB ─────────────────────────────────────
  useEffect(() => {
    if (!itemId || !imageSrc) return;
    let cancelled = false;
    (async () => {
      try {
        const { data: item } = await inventoryApi.get(itemId);
        if (cancelled || !item?.image_editor_state) return;
        const states = JSON.parse(item.image_editor_state || '{}');

        // Try direct lookup first (keyed by the original image URL)
        let saved = states[imageSrc];

        // If not found, try a filename-basis match — this handles the common
        // case where the gallery replaced the original URL with the newly
        // uploaded edited image (so keys don't match exactly).
        if (!saved) {
          const basename = (u) => {
            if (!u) return '';
            try {
              const p = new URL(u, window.location.href).pathname;
              return p.split('/').pop();
            } catch (err) {
              return u.split('/').pop();
            }
          };
          const targetBase = basename(imageSrc);
          for (const [key, val] of Object.entries(states)) {
            if (basename(key) === targetBase) {
              saved = val;
              break;
            }
          }
        }

        if (!saved) return;

        // Auto-detect legacy FIE format (has 'adjustments') vs new format (has 'crop').
        let converted;
        if (saved.adjustments) {
          converted = {
            crop: {
              position: { x: 0, y: 0 },
              zoom: 1,
              croppedAreaPixels: saved.adjustments.crop || null,
              croppedArea: null,
              aspect: saved.adjustments.crop?.ratio || null,
              aspectLabel: 'Custom',
            },
            finetune: {
              brightness: saved.finetunesProps?.gammaBrightness ?? 0,
              contrast: (saved.finetunesProps?.contrast ?? 0) * 100,
              shadows: saved.finetunesProps?.shadowsValue ?? 0,
            },
            rotation: saved.adjustments.rotation || 0,
            flipH: saved.adjustments.isFlippedX || false,
            flipV: saved.adjustments.isFlippedY || false,
            watermarks: [],
          };
        } else {
          converted = saved;
        }

        // Ensure crop has the minimal fields expected by the editor.
        converted.crop = {
          position: converted.crop?.position ?? { x: 0, y: 0 },
          zoom: converted.crop?.zoom ?? 1,
          croppedAreaPixels: converted.crop?.croppedAreaPixels ?? null,
          croppedArea: converted.crop?.croppedArea ?? null,
          aspect: converted.crop?.aspect ?? null,
          aspectLabel: converted.crop?.aspectLabel ?? 'Custom',
        };

        actions.loadSavedState(imageIndex, converted);
      } catch {
        /* non-critical */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [itemId, imageSrc, imageIndex, actions]);

  // ── Save pipeline ──────────────────────────────────────────────────────
  const {
    isProcessing,
    applyingToAll,
    applyProgress,
    handleSave: processSave,
    handleApplyToAll: processApplyToAll,
    handleResetAllImages,
  } = useImageProcessor({
    allImages,
    itemId,
    onSave,
    onOpenChange,
    toast,
  });

  const handleSave = useCallback(() => {
    if (!currentImage) return;
    processSave(currentImage, state.activeImageIndex, activeOriginalSrc, fileName);
  }, [currentImage, state.activeImageIndex, activeOriginalSrc, fileName, processSave]);

  const handleApplyToAll = useCallback(() => {
    if (!currentImage) return;
    actions.applyToAll();
    processApplyToAll(currentImage, state.activeImageIndex);
  }, [currentImage, state.activeImageIndex, actions, processApplyToAll]);

  const handleResetAll = useCallback(async () => {
    actions.resetAll();
    await handleResetAllImages();
  }, [actions, handleResetAllImages]);

  // ── Templates ──────────────────────────────────────────────────────────
  const templateState = useTemplates();

  const handleSaveTemplate = useCallback(() => {
    if (!currentImage) return;
    const tpl = templateState.saveTemplate(currentImage);
    if (tpl) toast({ title: `Template "${tpl.name}" saved` });
  }, [currentImage, templateState, toast]);

  const handleLoadTemplate = useCallback(
    (tpl) => {
      actions.loadTemplate(tpl);
      toast({ title: `Template "${tpl.name}" applied` });
    },
    [actions, toast]
  );

  // ── Image switching ────────────────────────────────────────────────────
  const handleSwitchImage = useCallback(
    (index) => {
      if (index === state.activeImageIndex) return;
      actions.switchImage(index);
    },
    [state.activeImageIndex, actions]
  );

  // ── Close handler ──────────────────────────────────────────────────────
  const handleClose = useCallback(() => {
    blobCleanupRef.current?.();
    blobCleanupRef.current = null;
    setBlobUrl(null);
    if (onOpenChange) onOpenChange(false);
  }, [onOpenChange]);

  // ── Lock body scroll ──────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const prevBody = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    document.body.classList.add('hide-mobile-nav');
    return () => {
      document.body.style.overflow = prevBody;
      document.documentElement.style.overflow = prevHtml;
      document.body.classList.remove('hide-mobile-nav');
    };
  }, [open]);

  // ── Keyboard navigation ───────────────────────────────────────────────
  useEffect(() => {
    if (!open || allImages.length <= 1) return;
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowLeft') handleSwitchImage(Math.max(0, state.activeImageIndex - 1));
      if (e.key === 'ArrowRight')
        handleSwitchImage(Math.min(allImages.length - 1, state.activeImageIndex + 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, allImages.length, state.activeImageIndex, handleSwitchImage]);

  // ── Render ────────────────────────────────────────────────────────────
  if (!open || !imageSrc) return null;
  if (!currentImage) return null;

  const hasMultiple = allImages.length > 1;
  const canApplyToAll =
    currentImage.finetune.brightness !== 0 ||
    currentImage.finetune.contrast !== 0 ||
    currentImage.finetune.shadows !== 0 ||
    currentImage.rotation !== 0 ||
    currentImage.flipH ||
    currentImage.flipV ||
    currentImage.crop.aspect !== null;

  return createPortal(
    <div
      className="fixed inset-0 flex flex-col"
      style={{
        zIndex: 9990,
        background: isDark ? '#0a0a0a' : '#e5e5e5',
      }}
    >
      {/* Top toolbar */}
      <Toolbar
        canResetAll={canResetAll}
        canApplyToAll={canApplyToAll}
        hasMultiple={hasMultiple}
        isProcessing={isProcessing}
        isDark={isDark}
        onSave={handleSave}
        onResetAll={handleResetAll}
        onApplyToAll={handleApplyToAll}
        onClose={handleClose}
        templates={templateState.templates}
        onSaveTemplate={handleSaveTemplate}
        onLoadTemplate={handleLoadTemplate}
        onDeleteTemplate={templateState.deleteTemplate}
        showSaveDialog={templateState.showSaveDialog}
        setShowSaveDialog={templateState.setShowSaveDialog}
        templateName={templateState.templateName}
        setTemplateName={templateState.setTemplateName}
      />

      {/* Main content area */}
      <div className="flex flex-1 min-h-0">
        {/* Tab sidebar */}
        <TabSidebar
          activeTab={state.activeTab}
          onTabChange={actions.setTab}
          isDark={isDark}
        />

        {/* Canvas / Preview area */}
        <div className="flex flex-1 min-w-0">
          {/* Main view area */}
          <div className="flex-1 min-w-0 relative">
            {state.activeTab === 'adjust' && blobUrl && (
              <CropView
                imageSrc={blobUrl}
                imageState={currentImage}
                actions={actions}
                isDark={isDark}
              />
            )}

            {state.activeTab === 'finetune' && blobUrl && (
              <PreviewView
                imageSrc={blobUrl}
                imageState={currentImage}
                isDark={isDark}
              />
            )}

            {state.activeTab === 'watermark' && blobUrl && (
              <PreviewView
                imageSrc={blobUrl}
                imageState={currentImage}
                isDark={isDark}
              >
                {/* Render draggable watermarks on top of preview */}
                {currentImage.watermarks.map((wm) => (
                  <div
                    key={wm.id}
                    className="absolute select-none cursor-move"
                    style={{
                      left: `${wm.x}%`,
                      top: `${wm.y}%`,
                      transform: 'translate(-50%, -50%)',
                      fontFamily: wm.fontFamily || 'Arial',
                      fontSize: `${wm.fontSize || 24}px`,
                      color: wm.color || '#ffffff',
                      opacity: wm.opacity ?? 1,
                      textShadow: '1px 1px 3px rgba(0,0,0,0.5)',
                      pointerEvents: 'auto',
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      const parent = e.currentTarget.parentElement;
                      const rect = parent.getBoundingClientRect();
                      const onMove = (ev) => {
                        const x = ((ev.clientX - rect.left) / rect.width) * 100;
                        const y = ((ev.clientY - rect.top) / rect.height) * 100;
                        actions.updateWatermark(wm.id, {
                          x: Math.max(0, Math.min(100, x)),
                          y: Math.max(0, Math.min(100, y)),
                        });
                      };
                      const onUp = () => {
                        window.removeEventListener('mousemove', onMove);
                        window.removeEventListener('mouseup', onUp);
                      };
                      window.addEventListener('mousemove', onMove);
                      window.addEventListener('mouseup', onUp);
                    }}
                  >
                    {wm.text || 'Watermark'}
                  </div>
                ))}
              </PreviewView>
            )}

            {/* Loading state */}
            {!blobUrl && (
              <div className="flex items-center justify-center w-full h-full">
                <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
              </div>
            )}
          </div>

          {/* Right sidebar panel (context-dependent) */}
          {state.activeTab === 'adjust' && (
            <CropPanel imageState={currentImage} actions={actions} isDark={isDark} />
          )}
          {state.activeTab === 'finetune' && (
            <FinetunePanel imageState={currentImage} actions={actions} isDark={isDark} />
          )}
          {state.activeTab === 'watermark' && (
            <WatermarkPanel imageState={currentImage} actions={actions} isDark={isDark} />
          )}
        </div>
      </div>

      {/* Bottom filmstrip */}
      <Filmstrip
        allImages={allImages}
        activeIndex={state.activeImageIndex}
        editedIndices={state.editedIndices}
        onSwitchImage={handleSwitchImage}
        isDark={isDark}
      />

      {/* Apply-to-all progress overlay */}
      {applyingToAll && (
        <ProgressOverlay done={applyProgress.done} total={applyProgress.total} />
      )}
    </div>,
    document.body
  );
}
