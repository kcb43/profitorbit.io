import React from 'react';
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

/**
 * Variation 1: Canva Classic Layout
 * 
 * Desktop: 280px left sidebar + large centered canvas
 * Mobile: Bottom toolbar (h-48) + full canvas above
 * Features: Clear tool organization, large touch targets (48px)
 */
export function ImageEditorV1Layout(props) {
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

  const sliderMin = getSliderMin();
  const sliderMax = getSliderMax();
  const sliderValue = getSliderValue();
  const primaryButtonState = getPrimaryButtonState();

  return (
    <div className="ant-modal-body flex flex-col md:flex-row flex-1 min-h-0 overflow-hidden p-2 sm:p-4" style={{ scale: 1, outline: 'none' }}>
      {/* Sidebar - 280px on desktop, collapsible on mobile */}
      <div className="w-full md:w-[280px] bg-gray-50 backdrop-blur-sm md:border-r border-gray-200 overflow-y-auto overflow-x-hidden px-3 md:px-4 py-3 md:py-4 space-y-3 md:space-y-4 flex-shrink-0 max-h-[25dvh] md:max-h-none order-1">
        
        {/* Template Controls */}
        <TemplateControls
          templates={templates}
          selectedTemplate={selectedTemplate}
          onTemplateChange={handleLoadTemplate}
          onSaveTemplate={handleSaveTemplateClick}
          onDeleteTemplate={handleDeleteTemplate}
          onResetTemplate={resetCurrentImage}
        />

        {/* Upload Button */}
        <UploadButton 
          onFileChange={handleFileUpload}
          showLabel={!isMobile}
        />

        {/* Crop Controls */}
        {!isCropping ? (
          <CropControls
            isCropping={false}
            onStartCrop={() => handleTransform('crop')}
            isMobile={isMobile}
          />
        ) : (
          <CropControls
            isCropping={true}
            aspectRatio={aspectRatio}
            onAspectRatioChange={handleAspectRatioChange}
            onApplyCrop={applyCrop}
            onCancelCrop={cancelCrop}
            isMobile={isMobile}
          />
        )}

        {/* Adjustments Section - Hidden when cropping */}
        {!isCropping && (
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
              isMobile={isMobile}
            />
          </>
        )}

        {/* Rotate Controls - Hidden when cropping */}
        {!isCropping && (
          <RotateControls
            onRotateLeft={() => handleTransform('rotate-left')}
            onRotateRight={() => handleTransform('rotate-right')}
            onFlipHorizontal={() => handleTransform('flip-x')}
            onFlipVertical={() => handleTransform('flip-y')}
            showFlipButtons={!isMobile}
          />
        )}

        {/* Action Buttons - Desktop only */}
        {!isMobile && (
          <ActionButtons
            onReset={appliedToAll && currentImageIndex === 0 && hasMultipleImages ? resetAllImages : resetCurrentImage}
            onSave={primaryButtonState.onClick}
            showReset={hasChangesFromOriginal()}
            resetLabel={appliedToAll && currentImageIndex === 0 && hasMultipleImages ? 'Reset All' : 'Reset'}
            saveLabel={primaryButtonState.label}
            disabled={!imgSrc}
          />
        )}
      </div>

      {/* Main Canvas - Image preview */}
      <div className="w-full md:flex-1 flex flex-col min-w-0 flex-1 overflow-hidden bg-transparent dark:bg-transparent mt-1 md:mt-0 md:pl-3 order-2">
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
          className="min-h-[calc(100dvh-35vh)] md:min-h-0"
        />
      </div>

      {/* Mobile Footer - Action buttons only on mobile */}
      {isMobile && !isCropping && (
        <div className="w-full flex gap-2 pt-2 order-3">
          <ActionButtons
            onReset={appliedToAll && currentImageIndex === 0 && hasMultipleImages ? resetAllImages : resetCurrentImage}
            onSave={primaryButtonState.onClick}
            showReset={hasChangesFromOriginal()}
            resetLabel={appliedToAll && currentImageIndex === 0 && hasMultipleImages ? 'Reset All' : 'Reset'}
            saveLabel={primaryButtonState.label}
            disabled={!imgSrc}
            className="flex-1"
          />
        </div>
      )}
    </div>
  );
}
