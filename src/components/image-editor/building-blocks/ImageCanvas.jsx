import React from 'react';
import { ChevronLeft, ChevronRight, CheckCircle } from 'lucide-react';

/**
 * ImageCanvas - Main canvas preview with navigation and status indicators
 */
export function ImageCanvas({
  imgSrc,
  imageRef,
  previewCanvasRef,
  isCropping,
  hasMultipleImages,
  currentImageIndex,
  totalImages,
  editedImages,
  onPrevImage,
  onNextImage,
  onImageLoad,
  className = ''
}) {
  return (
    <div 
      className={`image-edit-container w-full flex-1 overflow-hidden flex items-center justify-center rounded-lg ${
        isCropping 
          ? 'bg-white dark:bg-card border border-gray-200 dark:border-border' 
          : 'bg-white dark:bg-card border border-gray-200 dark:border-border'
      } ${className}`}
      style={{ scale: 1, outline: 'none' }}
    >
      {imgSrc && (
        <div
          className="relative flex items-center justify-center pb-20 md:pb-0 pt-1 md:pt-0"
          style={{ 
            outline: 'none', 
            border: 'none', 
            width: '100%', 
            height: '100%', 
            backgroundColor: 'rgba(255, 255, 255, 1)' 
          }}
        >
          {/* Image edited checkmark - top right */}
          {editedImages.has(currentImageIndex) && (
            <div className="absolute top-4 right-4 z-20">
              <CheckCircle className="w-8 h-8 text-green-500 fill-white drop-shadow-lg" />
            </div>
          )}

          {/* Multi-image navigation */}
          {hasMultipleImages && (
            <>
              {/* Previous Button */}
              <button
                onClick={onPrevImage}
                disabled={currentImageIndex === 0}
                className={`absolute left-2 top-1/2 -translate-y-1/2 z-20 bg-white/90 hover:bg-white border border-gray-300 rounded-full p-2 shadow-lg transition-all ${
                  currentImageIndex === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:scale-110'
                }`}
                aria-label="Previous image"
              >
                <ChevronLeft className="w-5 h-5 text-gray-900" />
              </button>

              {/* Next Button */}
              <button
                onClick={onNextImage}
                disabled={currentImageIndex === totalImages - 1}
                className={`absolute right-2 top-1/2 -translate-y-1/2 z-20 bg-white/90 hover:bg-white border border-gray-300 rounded-full p-2 shadow-lg transition-all ${
                  currentImageIndex === totalImages - 1 ? 'opacity-30 cursor-not-allowed' : 'hover:scale-110'
                }`}
                aria-label="Next image"
              >
                <ChevronRight className="w-5 h-5 text-gray-900" />
              </button>

              {/* Image counter */}
              <div className="absolute bottom-24 md:bottom-4 left-1/2 -translate-x-1/2 z-20 bg-black/60 text-white px-3 py-1 rounded-full text-xs font-medium backdrop-blur-sm">
                {currentImageIndex + 1} / {totalImages}
              </div>
            </>
          )}

          {/* Canvas for preview */}
          <canvas
            ref={previewCanvasRef}
            className="hidden"
          />

          {/* Image element */}
          <img
            ref={imageRef}
            src={imgSrc}
            alt="Edit preview"
            className="max-w-full max-h-full object-contain"
            onLoad={onImageLoad}
            style={{ 
              maxWidth: '100%', 
              maxHeight: '100%',
              display: isCropping ? 'block' : 'block'
            }}
          />
        </div>
      )}
    </div>
  );
}
