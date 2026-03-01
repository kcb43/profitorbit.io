import React, { useMemo } from 'react';

export default function PreviewView({ imageSrc, imageState, isDark, children }) {
  const { finetune, crop, rotation, flipH, flipV } = imageState;

  // CSS filter for real-time finetune preview
  const filter = useMemo(() => {
    const parts = [];
    if (finetune.brightness !== 0) {
      // Gamma brightness preview: brightness(2^(b/50))
      parts.push(`brightness(${Math.pow(2, finetune.brightness / 50)})`);
    }
    if (finetune.contrast !== 0) {
      parts.push(`contrast(${Math.max(0, 1 + finetune.contrast / 100)})`);
    }
    // Shadows can't be done in CSS — approximated by adjusting low-end brightness
    // Exact pixel math runs only at save time
    if (finetune.shadows !== 0) {
      // Subtle approximation: shadows > 0 lifts darks, < 0 crushes
      const shadowFactor = 1 + finetune.shadows * 0.002;
      parts.push(`brightness(${shadowFactor})`);
    }
    return parts.join(' ') || 'none';
  }, [finetune]);

  // CSS transform for rotation and flip
  const transform = useMemo(() => {
    const parts = [];
    if (rotation) parts.push(`rotate(${rotation}deg)`);
    if (flipH) parts.push('scaleX(-1)');
    if (flipV) parts.push('scaleY(-1)');
    return parts.join(' ') || 'none';
  }, [rotation, flipH, flipV]);

  // Crop clipping via object-position + object-fit or clip-path
  const cropStyle = useMemo(() => {
    const cp = crop?.croppedAreaPixels;
    if (!cp || cp.width <= 0 || cp.height <= 0) return {};

    // Use clip-path inset based on percentage crop area
    const ca = crop?.croppedArea;
    if (ca) {
      return {
        clipPath: `inset(${ca.y}% ${100 - ca.x - ca.width}% ${100 - ca.y - ca.height}% ${ca.x}%)`,
      };
    }
    return {};
  }, [crop]);

  return (
    <div
      className="relative w-full h-full flex items-center justify-center overflow-hidden"
      style={{ background: isDark ? '#0a0a0a' : '#e5e5e5' }}
    >
      <img
        src={imageSrc}
        alt="Preview"
        draggable={false}
        className="max-w-full max-h-full object-contain select-none"
        style={{
          filter,
          transform,
          ...cropStyle,
          imageRendering: 'high-quality',
        }}
      />
      {/* Watermark overlays and panel controls render here */}
      {children}
    </div>
  );
}
