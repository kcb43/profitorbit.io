import React, { useCallback, useEffect, useState } from 'react';
import Cropper from 'react-easy-crop';

export default function CropView({ imageSrc, imageState, actions, isDark }) {
  const { crop, rotation, flipH, flipV } = imageState;
  const [natural, setNatural] = useState({ width: 0, height: 0 });

  // Load natural image size for pixel display
  useEffect(() => {
    if (!imageSrc) return;
    let mounted = true;
    const img = new Image();
    img.onload = () => {
      if (!mounted) return;
      setNatural({ width: img.naturalWidth || img.width, height: img.naturalHeight || img.height });
    };
    img.onerror = () => {
      if (!mounted) return;
      setNatural({ width: 0, height: 0 });
    };
    try { img.crossOrigin = 'anonymous'; } catch (e) {}
    img.src = imageSrc;
    return () => { mounted = false; };
  }, [imageSrc]);

  // When aspect is null ("Original"), use the image's natural aspect ratio
  // so the crop grid covers the entire image instead of a small box.
  const effectiveAspect = crop.aspect != null
    ? crop.aspect
    : (natural.width && natural.height ? natural.width / natural.height : undefined);

  const onCropChange = useCallback(
    (position) => {
      actions.setCropPosition(position, crop.zoom);
    },
    [actions, crop.zoom]
  );

  const onZoomChange = useCallback(
    (zoom) => {
      actions.setCropPosition(crop.position, zoom);
    },
    [actions, crop.position]
  );

  const onCropComplete = useCallback(
    (croppedArea, croppedAreaPixels) => {
      actions.setCropComplete(croppedArea, croppedAreaPixels);
    },
    [actions]
  );

  // Build CSS transform for flip
  const mediaTransform = [
    flipH ? 'scaleX(-1)' : '',
    flipV ? 'scaleY(-1)' : '',
  ]
    .filter(Boolean)
    .join(' ') || undefined;

  return (
    <div className="relative w-full h-full" style={{ background: isDark ? '#0a0a0a' : '#e5e5e5' }}>
      <Cropper
        image={imageSrc}
        crop={crop.position}
        zoom={crop.zoom}
        aspect={effectiveAspect}
        rotation={rotation}
        onCropChange={onCropChange}
        onZoomChange={onZoomChange}
        onCropComplete={onCropComplete}
        minZoom={1}
        maxZoom={5}
        zoomSpeed={0.2}
        showGrid={true}
        style={{
          containerStyle: {
            background: isDark ? '#0a0a0a' : '#e5e5e5',
          },
          cropAreaStyle: {
            border: '2px solid rgba(255, 255, 255, 0.7)',
          },
          mediaStyle: mediaTransform ? { transform: mediaTransform } : undefined,
        }}
        objectFit="contain"
      />
      {/* Bottom bar: pixel size + zoom */}
      <div
        className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-2 rounded-full"
        style={{
          background: isDark ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.8)',
          backdropFilter: 'blur(8px)',
        }}
      >
        {natural.width > 0 && natural.height > 0 && (
          <span className="text-xs" style={{ color: isDark ? '#a3a3a3' : '#525252' }}>
            {natural.width} × {natural.height}px
          </span>
        )}
        <span className="text-xs" style={{ color: isDark ? '#a3a3a3' : '#525252' }}>
          Zoom
        </span>
        <input
          type="range"
          min={1}
          max={5}
          step={0.01}
          value={crop.zoom}
          onChange={(e) => onZoomChange(parseFloat(e.target.value))}
          className="w-28 accent-blue-500"
        />
        <span className="text-xs w-10 text-right" style={{ color: isDark ? '#e5e5e5' : '#171717' }}>
          {Math.round(crop.zoom * 100)}%
        </span>
      </div>
    </div>
  );
}
