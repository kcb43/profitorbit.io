import React from 'react';
import { RotateCcw, RotateCw, FlipHorizontal, FlipVertical } from 'lucide-react';

const CROP_PRESETS = [
  { label: 'Original', aspect: null, desc: 'Free' },
  { label: 'Square', aspect: 1, desc: '1:1' },
  { label: 'Portrait', aspect: 9 / 16, desc: '9:16' },
  { label: 'Landscape', aspect: 16 / 9, desc: '16:9' },
  { label: 'Classic TV', aspect: 4 / 3, desc: '4:3' },
];

const SOCIAL_PRESETS = [
  {
    group: 'Instagram',
    items: [
      { label: 'Post', aspect: 1, desc: '1080×1080' },
      { label: 'Story', aspect: 9 / 16, desc: '1080×1920' },
    ],
  },
  {
    group: 'Facebook',
    items: [
      { label: 'Profile', aspect: 1, desc: '180×180' },
      { label: 'Cover', aspect: 820 / 312, desc: '820×312' },
      { label: 'Post', aspect: 1200 / 630, desc: '1200×630' },
    ],
  },
  {
    group: 'eBay',
    items: [
      { label: 'Listing', aspect: 1, desc: '1600×1600' },
      { label: 'Square', aspect: 1, desc: '1000×1000' },
    ],
  },
];

export default function CropPanel({ imageState, actions, isDark }) {
  const { crop, rotation, flipH, flipV } = imageState;

  const presetBg = isDark ? '#262626' : '#e5e5e5';
  const presetActiveBg = isDark ? '#2563eb' : '#2563eb';
  const textColor = isDark ? '#e5e5e5' : '#171717';
  const mutedColor = isDark ? '#a3a3a3' : '#737373';

  const renderPresetButton = (preset) => {
    // Compare aspect ratios with tolerance for floating point
    const isActive =
      preset.aspect === null
        ? crop.aspect === null
        : crop.aspect !== null && Math.abs(crop.aspect - preset.aspect) < 0.001;

    return (
      <button
        key={`${preset.label}-${preset.desc}`}
        onClick={() => actions.setAspect(preset.aspect, preset.label)}
        className="flex flex-col items-center justify-center rounded-lg px-2 py-2 text-xs transition-colors"
        style={{
          background: isActive ? presetActiveBg : presetBg,
          color: isActive ? '#ffffff' : textColor,
          minWidth: 64,
        }}
      >
        <span className="font-medium">{preset.label}</span>
        <span className="text-[10px] opacity-70">{preset.desc}</span>
      </button>
    );
  };

  return (
    <div
      className="flex flex-col gap-4 p-4 overflow-y-auto flex-shrink-0"
      style={{
        width: 200,
        background: isDark ? '#111111' : '#fafafa',
        borderLeft: `1px solid ${isDark ? '#262626' : '#d4d4d4'}`,
        color: textColor,
      }}
    >
      {/* Crop presets */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: mutedColor }}>
          Crop
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {CROP_PRESETS.map(renderPresetButton)}
        </div>
      </div>

      {/* Social presets */}
      {SOCIAL_PRESETS.map(({ group, items }) => (
        <div key={group}>
          <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: mutedColor }}>
            {group}
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {items.map(renderPresetButton)}
          </div>
        </div>
      ))}

      {/* Rotation & Flip */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: mutedColor }}>
          Transform
        </h3>
        <div className="flex gap-2">
          <button
            onClick={actions.rotateLeft}
            className="flex items-center justify-center rounded-lg p-2 transition-colors"
            style={{ background: presetBg, color: textColor }}
            title="Rotate Left"
          >
            <RotateCcw size={18} />
          </button>
          <button
            onClick={actions.rotateRight}
            className="flex items-center justify-center rounded-lg p-2 transition-colors"
            style={{ background: presetBg, color: textColor }}
            title="Rotate Right"
          >
            <RotateCw size={18} />
          </button>
          <button
            onClick={actions.flipH}
            className="flex items-center justify-center rounded-lg p-2 transition-colors"
            style={{
              background: flipH ? presetActiveBg : presetBg,
              color: flipH ? '#ffffff' : textColor,
            }}
            title="Flip Horizontal"
          >
            <FlipHorizontal size={18} />
          </button>
          <button
            onClick={actions.flipV}
            className="flex items-center justify-center rounded-lg p-2 transition-colors"
            style={{
              background: flipV ? presetActiveBg : presetBg,
              color: flipV ? '#ffffff' : textColor,
            }}
            title="Flip Vertical"
          >
            <FlipVertical size={18} />
          </button>
        </div>
        {rotation !== 0 && (
          <p className="text-[10px] mt-1" style={{ color: mutedColor }}>
            Rotation: {rotation}°
          </p>
        )}
      </div>
    </div>
  );
}
