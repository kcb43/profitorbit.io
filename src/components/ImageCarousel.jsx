import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * ImageCarousel Component
 * Displays multiple images with swipe support on mobile and arrow navigation on desktop
 * 
 * @param {Array} images - Array of image URLs or objects with url/imageUrl property
 * @param {string} className - Additional CSS classes for the container
 * @param {string} imageClassName - Additional CSS classes for the images
 * @param {function} onImageClick - Optional callback when an image is clicked
 * @param {number} currentIndex - Optional controlled current index
 * @param {function} onIndexChange - Optional callback when index changes
 * @param {boolean} hideDots - Optional flag to hide dot indicators
 */
export function ImageCarousel({ 
  images = [], 
  className = '', 
  imageClassName = '',
  onImageClick,
  currentIndex: controlledIndex,
  onIndexChange,
  hideDots = false
}) {
  const [internalIndex, setInternalIndex] = useState(0);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const containerRef = useRef(null);

  // Use controlled index if provided, otherwise use internal state
  const currentIndex = controlledIndex !== undefined ? controlledIndex : internalIndex;
  const setCurrentIndex = onIndexChange || setInternalIndex;

  // Normalize images array to always have url property
  const normalizedImages = images.map(img => {
    if (typeof img === 'string') {
      return { url: img };
    }
    return { url: img.imageUrl || img.url || img };
  });

  // Reset index if it's out of bounds
  useEffect(() => {
    if (currentIndex >= normalizedImages.length && normalizedImages.length > 0) {
      setCurrentIndex(0);
    }
  }, [normalizedImages.length, currentIndex, setCurrentIndex]);

  // No images to display
  if (!normalizedImages || normalizedImages.length === 0) {
    return null;
  }

  // Single image - just display it without carousel
  if (normalizedImages.length === 1) {
    return (
      <div className={cn("relative w-full h-full", className)}>
        <img
          src={normalizedImages[0].url}
          alt="Product"
          className={cn("w-full h-full object-cover", imageClassName)}
          onClick={() => onImageClick && onImageClick(normalizedImages[0], 0)}
        />
      </div>
    );
  }

  const goToPrevious = (e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    const newIndex = currentIndex === 0 ? normalizedImages.length - 1 : currentIndex - 1;
    setCurrentIndex(newIndex);
  };

  const goToNext = (e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    const newIndex = currentIndex === normalizedImages.length - 1 ? 0 : currentIndex + 1;
    setCurrentIndex(newIndex);
  };

  const goToIndex = (index, e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    setCurrentIndex(index);
  };

  // Touch handlers for mobile swipe
  const handleTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const minSwipeDistance = 50;
    
    if (distance > minSwipeDistance) {
      // Swiped left - go to next
      goToNext();
    } else if (distance < -minSwipeDistance) {
      // Swiped right - go to previous
      goToPrevious();
    }
  };

  return (
    <div 
      ref={containerRef}
      className={cn("relative w-full h-full group", className)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Main Image */}
      <img
        src={normalizedImages[currentIndex].url}
        alt={`Product ${currentIndex + 1}`}
        className={cn("w-full h-full object-cover", imageClassName)}
        onClick={() => onImageClick && onImageClick(normalizedImages[currentIndex], currentIndex)}
      />

      {/* Desktop Navigation Arrows */}
      <div className="hidden md:block">
        {/* Previous Button */}
        <button
          onClick={goToPrevious}
          className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 hover:bg-white shadow-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 z-10"
          aria-label="Previous image"
        >
          <ChevronLeft className="w-5 h-5 text-gray-800" />
        </button>

        {/* Next Button */}
        <button
          onClick={goToNext}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 hover:bg-white shadow-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 z-10"
          aria-label="Next image"
        >
          <ChevronRight className="w-5 h-5 text-gray-800" />
        </button>
      </div>

      {/* Image Counter */}
      <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full z-10">
        {currentIndex + 1} / {normalizedImages.length}
      </div>

      {/* Dot Indicators */}
      {!hideDots && normalizedImages.length > 1 && normalizedImages.length <= 10 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
          {normalizedImages.map((_, index) => (
            <button
              key={index}
              onClick={(e) => goToIndex(index, e)}
              className={cn(
                "w-2 h-2 rounded-full transition-all duration-200",
                index === currentIndex 
                  ? "bg-white w-4" 
                  : "bg-white/50 hover:bg-white/75"
              )}
              aria-label={`Go to image ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

