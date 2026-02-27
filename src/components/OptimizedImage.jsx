import React, { useState, useRef, useEffect } from 'react';

const isFbCdnUrl = (url) =>
  typeof url === 'string' && url.includes('fbcdn.net');

/**
 * OptimizedImage Component
 * Provides lazy loading, loading states, and error handling for images.
 * For Facebook CDN URLs that 403, a credentialed no-cors fetch retry is
 * attempted to work around browser-cached 403 responses and session-gated
 * images (sends cookies regardless of browser 3rd-party-cookie policy).
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
  crossOrigin,
  ...props 
}) {
  const [imageSrc, setImageSrc] = useState(src || fallback);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef(null);
  const [isInView, setIsInView] = useState(!lazy);
  const blobUrlRef = useRef(null);  // blob URL created during retry (needs cleanup)
  const retriedRef = useRef(false); // prevent infinite retry loops

  // Revoke blob URL on unmount or when src changes
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [src]);

  useEffect(() => {
    // Reset states when src changes
    setIsLoading(true);
    setHasError(false);
    retriedRef.current = false;
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
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
        rootMargin: '50px',
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

  const handleError = async () => {
    // For Facebook CDN images that fail, attempt a single credentialed retry.
    //
    // Why this works for the remaining ~10%:
    //  1. Browser-cached 403  – `cache: 'reload'` bypasses any stale 403 the
    //     browser cached while crossOrigin="anonymous" was still set.
    //  2. Session-gated images – `credentials: 'include'` sends the user's
    //     fbcdn.net cookies with the request regardless of the browser's
    //     3rd-party-cookie policy (which can block cookies on plain <img>).
    //  The response is opaque (mode: 'no-cors'), so we can't read its status,
    //  but Chrome/Edge/Firefox do expose the body as a Blob. If the blob is
    //  large enough to be a real image (>500 bytes) we display it via a blob
    //  URL; otherwise we fall through to the generic fallback.
    if (isFbCdnUrl(imageSrc) && !retriedRef.current) {
      retriedRef.current = true;
      try {
        const res = await fetch(imageSrc, {
          mode: 'no-cors',
          credentials: 'include',
          cache: 'reload',
        });
        const blob = await res.blob();
        if (blob && blob.size > 500) {
          const url = URL.createObjectURL(blob);
          blobUrlRef.current = url;
          setIsLoading(true); // show loader while new src renders
          setImageSrc(url);
          return; // wait for onLoad / onError on the new src
        }
      } catch {
        // Network error or opaque-body unavailable — fall through
      }
    }

    // Genuine failure (non-FB, retry exhausted, or blob too small)
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
          referrerPolicy="no-referrer"
          {...(crossOrigin ? { crossOrigin } : {})}
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

