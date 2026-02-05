import React, { useState } from 'react';
import {
  TemplateControls,
  UploadButton,
  CropControls,
  FilterSlider,
  FilterButtons,
  RotateControls,
  ImageCanvas,
  ActionButtons
} from '../building-blocks';
import { Button } from '@/components/ui/button';
import { SlidersHorizontal, X } from 'lucide-react';

/**
 * Variation 2: Minimalist Pro Layout
 * 
 * Desktop: Top horizontal toolbar + maximized canvas + floating adjustment panel (right)
 * Mobile: Full canvas + floating FAB menu (bottom-right) + slide-up panels
 * Features: Icon-only interface, maximum canvas space
 */
export function ImageEditorV2Layout(props) {
  const {
    // State
    isMobile,
    isCropping,
    aspectRatio,
    activeFilter,
    filters,
    transform,
    imgSrc,
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

  const [showAdjustPanel, setShowAdjustPanel] = useState(false);
  const sliderMin = getSliderMin();
  const sliderMax = getSliderMax();
  const sliderValue = getSliderValue();
  const primaryButtonState = getPrimaryButtonState();

  return (
    <div className="ant-modal-body flex flex-col flex-1 min-h-0 overflow-hidden" style={{ scale: 1, outline: 'none' }}>
      {/* Top Toolbar - Desktop only */}
      {!isMobile && (
        <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-gray-50 border-b border-gray-200">
          <TemplateControls
            templates={templates}
            selectedTemplate={selectedTemplate}
            onTemplateChange={handleLoadTemplate}
            onSaveTemplate={handleSaveTemplateClick}
            onDeleteTemplate={handleDeleteTemplate}
            onResetTemplate={resetCurrentImage}
            className="flex-1"
          />
          
          <UploadButton onFileChange={handleFileUpload} showLabel={false} />
          
          {!isCropping && (
            <Button
              onClick={() => setShowAdjustPanel(!showAdjustPanel)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white h-7 px-3"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </Button>
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
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* Canvas */}
        <ImageCanvas
          imgSrc={imgSrc}
          imageRef={imageRef}
          previewCanvasRef={previewCanvasRef}
          isCropping={isCropping}
          hasMultipleImages={hasMultipleImages}
          currentImageIndex={currentImageIndex}
          totalImages={normalizedImages.length}
          editedImages={editedImages}
          onPrevImage={handlePrevImage}
          onNextImage={handleNextImage}
          className="flex-1"
        />

        {/* Floating Adjustment Panel - Desktop, shown when toggle is on */}
        {!isMobile && showAdjustPanel && !isCropping && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 w-64 bg-white rounded-lg shadow-2xl border border-gray-200 p-4 space-y-4 z-30">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Adjustments</h3>
              <button
                onClick={() => setShowAdjustPanel(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
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
              isMobile={false}
            />

            <RotateControls
              onRotateLeft={() => handleTransform('rotate-left')}
              onRotateRight={() => handleTransform('rotate-right')}
              onFlipHorizontal={() => handleTransform('flip-x')}
              onFlipVertical={() => handleTransform('flip-y')}
            />
          </div>
        )}

        {/* Crop Controls Overlay - Desktop */}
        {!isMobile && isCropping && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 w-64 bg-white rounded-lg shadow-2xl border border-gray-200 p-4 z-30">
            <CropControls
              isCropping={true}
              aspectRatio={aspectRatio}
              onAspectRatioChange={handleAspectRatioChange}
              onApplyCrop={applyCrop}
              onCancelCrop={cancelCrop}
            />
          </div>
        )}
      </div>

      {/* Mobile FAB + Slide-up Panel */}
      {isMobile && (
        <>
          {/* Floating Action Button */}
          <button
            onClick={() => setShowAdjustPanel(!showAdjustPanel)}
            className="fixed bottom-20 right-4 z-40 w-14 h-14 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full shadow-2xl flex items-center justify-center transition-transform hover:scale-110"
          >
            <SlidersHorizontal className="w-6 h-6" />
          </button>

          {/* Slide-up Panel */}
          {showAdjustPanel && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 bg-black/50 z-40"
                onClick={() => setShowAdjustPanel(false)}
              />

              {/* Panel */}
              <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl z-50 p-4 space-y-4 max-h-[70vh] overflow-y-auto">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-gray-900">Edit Tools</h3>
                  <button
                    onClick={() => setShowAdjustPanel(false)}
                    className="p-2 hover:bg-gray-100 rounded-full"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

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

                    <CropControls
                      isCropping={false}
                      onStartCrop={() => {
                        handleTransform('crop');
                        setShowAdjustPanel(false);
                      }}
                      isMobile={true}
                    />

                    <RotateControls
                      onRotateLeft={() => handleTransform('rotate-left')}
                      onRotateRight={() => handleTransform('rotate-right')}
                      onFlipHorizontal={() => handleTransform('flip-x')}
                      onFlipVertical={() => handleTransform('flip-y')}
                      showFlipButtons={true}
                    />

                    <ActionButtons
                      onReset={appliedToAll && currentImageIndex === 0 && hasMultipleImages ? resetAllImages : resetCurrentImage}
                      onSave={() => {
                        primaryButtonState.onClick();
                        setShowAdjustPanel(false);
                      }}
                      showReset={hasChangesFromOriginal()}
                      resetLabel={appliedToAll && currentImageIndex === 0 && hasMultipleImages ? 'Reset All' : 'Reset'}
                      saveLabel={primaryButtonState.label}
                      disabled={!imgSrc}
                    />
                  </>
                ) : (
                  <CropControls
                    isCropping={true}
                    aspectRatio={aspectRatio}
                    onAspectRatioChange={handleAspectRatioChange}
                    onApplyCrop={() => {
                      applyCrop();
                      setShowAdjustPanel(false);
                    }}
                    onCancelCrop={() => {
                      cancelCrop();
                      setShowAdjustPanel(false);
                    }}
                    isMobile={true}
                  />
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
