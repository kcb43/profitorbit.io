import React from 'react';
import { Sun, Contrast, CloudMoon } from 'lucide-react';

const SLIDERS = [
  { key: 'brightness', label: 'Brightness', Icon: Sun, min: -100, max: 100 },
  { key: 'contrast', label: 'Contrast', Icon: Contrast, min: -100, max: 100 },
  { key: 'shadows', label: 'Shadows', Icon: CloudMoon, min: -100, max: 100 },
];

export default function FinetunePanel({ imageState, actions, isDark }) {
  const { finetune } = imageState;
  const textColor = isDark ? '#e5e5e5' : '#171717';
  const mutedColor = isDark ? '#a3a3a3' : '#737373';
  const trackBg = isDark ? '#333333' : '#d4d4d4';

  return (
    <div
      className="flex flex-col gap-6 p-4 overflow-y-auto flex-shrink-0"
      style={{
        width: 220,
        background: isDark ? '#111111' : '#fafafa',
        borderLeft: `1px solid ${isDark ? '#262626' : '#d4d4d4'}`,
        color: textColor,
      }}
    >
      <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: mutedColor }}>
        Adjustments
      </h3>

      {SLIDERS.map(({ key, label, Icon, min, max }) => {
        const value = finetune[key] ?? 0;
        const isChanged = value !== 0;

        return (
          <div key={key}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Icon size={14} style={{ color: mutedColor }} />
                <span className="text-xs font-medium">{label}</span>
              </div>
              <span
                className="text-xs font-mono tabular-nums"
                style={{ color: isChanged ? '#2563eb' : mutedColor, minWidth: 32, textAlign: 'right' }}
              >
                {value > 0 ? `+${value}` : value}
              </span>
            </div>
            <div className="relative">
              <input
                type="range"
                min={min}
                max={max}
                step={1}
                value={value}
                onChange={(e) => actions.setFinetunePreview(key, parseInt(e.target.value, 10))}
                onMouseUp={(e) => actions.setFinetune(key, parseInt(e.target.value, 10))}
                onTouchEnd={(e) => actions.setFinetune(key, parseInt(e.target.currentTarget.value, 10))}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-blue-500"
                style={{ background: trackBg }}
              />
              {/* Center marker */}
              <div
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-3 rounded-full"
                style={{ background: isDark ? '#525252' : '#a3a3a3', pointerEvents: 'none' }}
              />
            </div>
          </div>
        );
      })}

      {/* Reset finetune button */}
      {(finetune.brightness !== 0 || finetune.contrast !== 0 || finetune.shadows !== 0) && (
        <button
          onClick={() => {
            // Use resetFinetune if available, else fall back to individual calls.
            // Batching avoids each setFinetune pushing its own undo entry (which
            // caused subsequent calls to see the just-pushed snapshot and skip).
            if (actions.resetFinetune) {
              actions.resetFinetune();
            } else {
              actions.setFinetune('brightness', 0);
              actions.setFinetune('contrast', 0);
              actions.setFinetune('shadows', 0);
            }
          }}
          className="text-xs py-1.5 px-3 rounded transition-colors"
          style={{
            background: isDark ? '#262626' : '#e5e5e5',
            color: mutedColor,
          }}
        >
          Reset Adjustments
        </button>
      )}
    </div>
  );
}
