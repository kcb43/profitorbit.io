import React, { useState, useRef, useEffect } from 'react';

/**
 * OptimizedImage Component
 * Provides lazy loading, loading states, and error handling for images
 * 
 * @param {string} src - Image source URL
 * @param {string} alt - Alt text for the image
 * @param {string} className - Additional CSS classes
 * @param {string} fallback - Fallback image URL if main image fails
 * @param {boolean} lazy - Enable lazy loading (default: true)
 * @param {string} style - Inline styles
 */
export function OptimizedImage({ 
  src, 
  alt = '', 
  className = '', 
  fallback = "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68e86fb5ac26f8511acce7ec/4abea2f77_box.png",
  lazy = true,
  style = {},
  ...props 
}) {
  const [imageSrc, setImageSrc] = useState(src || fallback);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef(null);
  const [isInView, setIsInView] = useState(!lazy);

  useEffect(() => {
    // Reset states when src changes
    setIsLoading(true);
    setHasError(false);
    setImageSrc(src || fallback);

    // Intersection Observer for lazy loading
    if (!lazy) {
      setIsInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: '50px', // Start loading 50px before entering viewport
        threshold: 0.01
      }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => {
      if (imgRef.current) {
        observer.unobserve(imgRef.current);
      }
      observer.disconnect();
    };
  }, [src, fallback, lazy]);

  const handleLoad = () => {
    setIsLoading(false);
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
    if (imageSrc !== fallback) {
      setImageSrc(fallback);
    }
  };

  return (
    <div 
      ref={imgRef}
      className={`relative overflow-hidden ${className}`}
      style={style}
    >
      {/* Loading placeholder */}
      {isLoading && isInView && (
        <div 
          className="absolute inset-0 bg-gray-200 dark:bg-card animate-pulse flex items-center justify-center"
          aria-hidden="true"
        >
          <svg 
            className="w-8 h-8 text-gray-400 dark:text-gray-600" 
            fill="currentColor" 
            viewBox="0 0 20 20"
          >
            <path 
              fillRule="evenodd" 
              d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" 
              clipRule="evenodd" 
            />
          </svg>
        </div>
      )}

      {/* Actual image */}
      {isInView && (
        <img
          src={imageSrc}
          alt={alt}
          className={`transition-opacity duration-300 ${
            isLoading ? 'opacity-0' : 'opacity-100'
          } ${className}`}
          loading={lazy ? 'lazy' : 'eager'}
          decoding="async"
          crossOrigin="anonymous"
          onLoad={handleLoad}
          onError={handleError}
          style={{
            ...style,
            ...(isLoading && { position: 'absolute', visibility: 'hidden' })
          }}
          {...props}
        />
      )}

      {/* Error state */}
      {hasError && imageSrc === fallback && (
        <div 
          className="absolute inset-0 bg-gray-100 dark:bg-card flex items-center justify-center"
          aria-hidden="true"
        >
          <svg 
            className="w-8 h-8 text-gray-400 dark:text-gray-600" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" 
            />
          </svg>
        </div>
      )}
    </div>
  );
}

