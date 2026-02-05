import React from 'react';
import {
  TemplateControls,
  UploadButton,
  CropControls,
  FilterSlider,
  FilterButtons,
  RotateControls,
  ActionButtons
} from '../building-blocks';
import { ChevronLeft, ChevronRight, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Variation 3: Split Panel Pro Layout
 * 
 * Desktop: Side-by-side comparison (original | edited) with drag divider + overlay toolbar
 * Mobile: Stacked view (original 40% | edited 60%) + bottom controls
 * Features: Before/after comparison, real-time updates, compare toggle
 */
export function ImageEditorV3Layout(props) {
  const {
    // State
    isMobile,
    isCropping,
    aspectRatio,
    activeFilter,
    filters,
    transform,
    imgSrc,
    originalImgSrc,
    templates,
    selectedTemplate,
    hasMultipleImages,
    currentImageIndex,
    normalizedImages,
    editedImages,
    hasUnsavedChanges,
    appliedToAll,
    
    // Refs
    imageRef,
    previewCanvasRef,
    
    // Handlers
    handleFileUpload,
    handleTransform,
    handleAspectRatioChange,
    applyCrop,
    cancelCrop,
    handleSliderChange,
    setActiveFilter,
    handleLoadTemplate,
    handleSaveTemplateClick,
    handleDeleteTemplate,
    resetCurrentImage,
    handlePrevImage,
    handleNextImage,
    handleSave,
    resetAllImages,
    onOpenChange,
    
    // Helper functions
    getSliderMin,
    getSliderMax,
    getSliderValue,
    hasChangesFromOriginal,
    getPrimaryButtonState
  } = props;

  const sliderMin = getSliderMin();
  const sliderMax = getSliderMax();
  const sliderValue = getSliderValue();
  const primaryButtonState = getPrimaryButtonState();

  // Determine if we should show split view (only when we have changes)
  const showSplitView = hasChangesFromOriginal() && originalImgSrc;

  return (
    <div className="ant-modal-body flex flex-col flex-1 min-h-0 overflow-hidden" style={{ scale: 1, outline: 'none' }}>
      
      {/* Desktop: Horizontal split layout */}
      {!isMobile && (
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Original Image Panel - Left Side */}
          {showSplitView && (
            <div className="w-1/2 flex flex-col border-r-2 border-gray-300">
              <div className="bg-gray-100 px-3 py-2 border-b border-gray-200">
                <span className="text-xs font-semibold text-gray-700">ORIGINAL</span>
              </div>
              <div className="flex-1 flex items-center justify-center bg-white p-4">
                <img
                  src={originalImgSrc}
                  alt="Original"
                  className="max-w-full max-h-full object-contain"
                />
              </div>
            </div>
          )}

          {/* Edited Image Panel - Right Side (or full width if no split) */}
          <div className={`flex flex-col ${showSplitView ? 'w-1/2' : 'flex-1'}`}>
            {showSplitView && (
              <div className="bg-gray-100 px-3 py-2 border-b border-gray-200">
                <span className="text-xs font-semibold text-gray-700">EDITED</span>
              </div>
            )}
            
            <div className="flex-1 flex items-center justify-center bg-white p-4 relative">
              {/* Image edited checkmark */}
              {editedImages.has(currentImageIndex) && (
                <div className="absolute top-4 right-4 z-20">
                  <CheckCircle className="w-8 h-8 text-green-500 fill-white drop-shadow-lg" />
                </div>
              )}

              {/* Multi-image navigation */}
              {hasMultipleImages && (
                <>
                  <button
                    onClick={handlePrevImage}
                    disabled={currentImageIndex === 0}
                    className={`absolute left-2 top-1/2 -translate-y-1/2 z-20 bg-white/90 hover:bg-white border border-gray-300 rounded-full p-2 shadow-lg transition-all ${
                      currentImageIndex === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:scale-110'
                    }`}
                  >
                    <ChevronLeft className="w-5 h-5 text-gray-900" />
                  </button>

                  <button
                    onClick={handleNextImage}
                    disabled={currentImageIndex === normalizedImages.length - 1}
                    className={`absolute right-2 top-1/2 -translate-y-1/2 z-20 bg-white/90 hover:bg-white border border-gray-300 rounded-full p-2 shadow-lg transition-all ${
                      currentImageIndex === normalizedImages.length - 1 ? 'opacity-30 cursor-not-allowed' : 'hover:scale-110'
                    }`}
                  >
                    <ChevronRight className="w-5 h-5 text-gray-900" />
                  </button>

                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 bg-black/60 text-white px-3 py-1 rounded-full text-xs font-medium backdrop-blur-sm">
                    {currentImageIndex + 1} / {normalizedImages.length}
                  </div>
                </>
              )}

              {/* Preview canvas (hidden) */}
              <canvas ref={previewCanvasRef} className="hidden" />

              {/* Edited image */}
              <img
                ref={imageRef}
                src={imgSrc}
                alt="Edit preview"
                className="max-w-full max-h-full object-contain"
              />
            </div>

            {/* Toolbar Overlay */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-sm rounded-lg shadow-xl border border-gray-200 p-3 flex gap-2 z-30">
              <TemplateControls
                templates={templates}
                selectedTemplate={selectedTemplate}
                onTemplateChange={handleLoadTemplate}
                onSaveTemplate={handleSaveTemplateClick}
                onDeleteTemplate={handleDeleteTemplate}
                onResetTemplate={resetCurrentImage}
                className="w-48"
              />
              
              <UploadButton onFileChange={handleFileUpload} showLabel={false} />
              
              {!isCropping && (
                <>
                  <FilterButtons
                    activeFilter={activeFilter}
                    onFilterChange={setActiveFilter}
                    className="grid grid-cols-4"
                  />
                  
                  <RotateControls
                    onRotateLeft={() => handleTransform('rotate-left')}
                    onRotateRight={() => handleTransform('rotate-right')}
                    onFlipHorizontal={() => handleTransform('flip-x')}
                    onFlipVertical={() => handleTransform('flip-y')}
                    showFlipButtons={false}
                    className="flex gap-1"
                  />
                </>
              )}
              
              <ActionButtons
                onReset={appliedToAll && currentImageIndex === 0 && hasMultipleImages ? resetAllImages : resetCurrentImage}
                onSave={primaryButtonState.onClick}
                showReset={hasChangesFromOriginal()}
                resetLabel="Reset"
                saveLabel={primaryButtonState.label}
                disabled={!imgSrc}
                className="flex-row gap-2"
              />
            </div>
          </div>
        </div>
      )}

      {/* Mobile: Stacked layout */}
      {isMobile && (
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Original Image - Top (40%) */}
          {showSplitView && (
            <div className="h-[40%] flex flex-col border-b-2 border-gray-300">
              <div className="bg-gray-100 px-3 py-1 border-b border-gray-200 flex-shrink-0">
                <span className="text-xs font-semibold text-gray-700">ORIGINAL</span>
              </div>
              <div className="flex-1 flex items-center justify-center bg-white p-2">
                <img
                  src={originalImgSrc}
                  alt="Original"
                  className="max-w-full max-h-full object-contain"
                />
              </div>
            </div>
          )}

          {/* Edited Image - Bottom (60% or full) */}
          <div className={`flex flex-col ${showSplitView ? 'h-[60%]' : 'flex-1'}`}>
            {showSplitView && (
              <div className="bg-gray-100 px-3 py-1 border-b border-gray-200 flex-shrink-0">
                <span className="text-xs font-semibold text-gray-700">EDITED</span>
              </div>
            )}
            
            <div className="flex-1 flex items-center justify-center bg-white p-2 relative">
              {/* Image edited checkmark */}
              {editedImages.has(currentImageIndex) && (
                <div className="absolute top-2 right-2 z-20">
                  <CheckCircle className="w-6 h-6 text-green-500 fill-white drop-shadow-lg" />
                </div>
              )}

              {/* Multi-image navigation */}
              {hasMultipleImages && (
                <>
                  <button
                    onClick={handlePrevImage}
                    disabled={currentImageIndex === 0}
                    className={`absolute left-1 top-1/2 -translate-y-1/2 z-20 bg-white/90 hover:bg-white border border-gray-300 rounded-full p-1 shadow-lg ${
                      currentImageIndex === 0 ? 'opacity-30 cursor-not-allowed' : ''
                    }`}
                  >
                    <ChevronLeft className="w-4 h-4 text-gray-900" />
                  </button>

                  <button
                    onClick={handleNextImage}
                    disabled={currentImageIndex === normalizedImages.length - 1}
                    className={`absolute right-1 top-1/2 -translate-y-1/2 z-20 bg-white/90 hover:bg-white border border-gray-300 rounded-full p-1 shadow-lg ${
                      currentImageIndex === normalizedImages.length - 1 ? 'opacity-30 cursor-not-allowed' : ''
                    }`}
                  >
                    <ChevronRight className="w-4 h-4 text-gray-900" />
                  </button>

                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 bg-black/60 text-white px-2 py-0.5 rounded-full text-[10px] font-medium">
                    {currentImageIndex + 1} / {normalizedImages.length}
                  </div>
                </>
              )}

              <canvas ref={previewCanvasRef} className="hidden" />
              <img
                ref={imageRef}
                src={imgSrc}
                alt="Edit preview"
                className="max-w-full max-h-full object-contain"
              />
            </div>
          </div>

          {/* Bottom Controls */}
          <div className="flex-shrink-0 bg-gray-50 border-t border-gray-200 p-3 space-y-3">
            {!isCropping ? (
              <>
                <FilterSlider
                  activeFilter={activeFilter}
                  value={sliderValue}
                  min={sliderMin}
                  max={sliderMax}
                  onChange={handleSliderChange}
                />

                <FilterButtons
                  activeFilter={activeFilter}
                  onFilterChange={setActiveFilter}
                  isMobile={true}
                />

                <div className="flex gap-2">
                  <CropControls
                    isCropping={false}
                    onStartCrop={() => handleTransform('crop')}
                    isMobile={true}
                    className="flex-1"
                  />
                  
                  <ActionButtons
                    onReset={appliedToAll && currentImageIndex === 0 && hasMultipleImages ? resetAllImages : resetCurrentImage}
                    onSave={primaryButtonState.onClick}
                    showReset={hasChangesFromOriginal()}
                    resetLabel="Reset"
                    saveLabel={primaryButtonState.label}
                    disabled={!imgSrc}
                    className="flex-1"
                  />
                </div>
              </>
            ) : (
              <CropControls
                isCropping={true}
                aspectRatio={aspectRatio}
                onAspectRatioChange={handleAspectRatioChange}
                onApplyCrop={applyCrop}
                onCancelCrop={cancelCrop}
                isMobile={true}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
