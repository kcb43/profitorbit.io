import React from 'react';
import { ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { getImgUrl } from '../utils/imageHelpers';

export default function Filmstrip({
  allImages,
  activeIndex,
  editedIndices,
  onSwitchImage,
  isDark,
}) {
  if (!allImages || allImages.length <= 1) return null;

  const borderColor = isDark ? '#262626' : '#d4d4d4';

  return (
    <div
      className="flex items-center justify-center gap-2 px-4 flex-shrink-0"
      style={{
        height: 80,
        background: isDark ? '#111111' : '#f0f0f0',
        borderTop: `1px solid ${borderColor}`,
      }}
    >
      {/* Previous button */}
      <button
        onClick={() => onSwitchImage(Math.max(0, activeIndex - 1))}
        disabled={activeIndex === 0}
        className="p-1.5 rounded-lg transition-colors"
        style={{
          color: activeIndex === 0 ? (isDark ? '#404040' : '#d4d4d4') : (isDark ? '#a3a3a3' : '#525252'),
        }}
      >
        <ChevronLeft size={18} />
      </button>

      {/* Thumbnails */}
      <div className="flex items-center gap-1.5 overflow-x-auto max-w-[80%] py-1">
        {allImages.map((img, i) => {
          const url = getImgUrl(img);
          const isActive = i === activeIndex;
          const isEdited = editedIndices.includes(i);

          return (
            <button
              key={i}
              onClick={() => onSwitchImage(i)}
              className="relative flex-shrink-0 rounded-md overflow-hidden transition-all"
              style={{
                width: 52,
                height: 52,
                border: isActive
                  ? '2px solid #2563eb'
                  : `1px solid ${borderColor}`,
                opacity: isActive ? 1 : 0.7,
                transform: isActive ? 'scale(1.05)' : 'scale(1)',
              }}
            >
              {url ? (
                <img
                  src={url}
                  alt={`Photo ${i + 1}`}
                  className="w-full h-full object-cover"
                  draggable={false}
                />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center text-[10px]"
                  style={{ background: isDark ? '#262626' : '#e5e5e5', color: isDark ? '#525252' : '#a3a3a3' }}
                >
                  {i + 1}
                </div>
              )}
              {/* Edited indicator */}
              {isEdited && (
                <div className="absolute top-0.5 right-0.5 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                  <Check size={10} className="text-white" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Next button */}
      <button
        onClick={() => onSwitchImage(Math.min(allImages.length - 1, activeIndex + 1))}
        disabled={activeIndex === allImages.length - 1}
        className="p-1.5 rounded-lg transition-colors"
        style={{
          color: activeIndex === allImages.length - 1
            ? (isDark ? '#404040' : '#d4d4d4')
            : (isDark ? '#a3a3a3' : '#525252'),
        }}
      >
        <ChevronRight size={18} />
      </button>

      {/* Counter */}
      <span className="text-xs ml-2" style={{ color: isDark ? '#737373' : '#a3a3a3' }}>
        {activeIndex + 1} / {allImages.length}
      </span>
    </div>
  );
}
