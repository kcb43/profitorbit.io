import React, { useState } from 'react';
import { Plus, Trash2, RotateCcw } from 'lucide-react';

const FONTS = ['Arial', 'Georgia', 'Courier New', 'Verdana', 'Impact', 'Comic Sans MS'];
const COLORS = ['#ffffff', '#000000', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'];

export default function WatermarkPanel({ imageState, actions, isDark }) {
  const { watermarks } = imageState;
  const textColor = isDark ? '#e5e5e5' : '#171717';
  const mutedColor = isDark ? '#a3a3a3' : '#737373';
  const inputBg = isDark ? '#262626' : '#e5e5e5';
  const [editingId, setEditingId] = useState(null);

  const handleAdd = () => {
    actions.addWatermark({
      id: crypto.randomUUID(),
      text: 'Watermark',
      fontFamily: 'Arial',
      fontSize: 24,
      color: '#ffffff',
      opacity: 0.7,
      x: 50,
      y: 50,
    });
  };

  return (
    <div
      className="flex flex-col gap-4 p-4 overflow-y-auto flex-shrink-0"
      style={{
        width: 220,
        background: isDark ? '#111111' : '#fafafa',
        borderLeft: `1px solid ${isDark ? '#262626' : '#d4d4d4'}`,
        color: textColor,
      }}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: mutedColor }}>
          Text
        </h3>
        <button
          onClick={handleAdd}
          className="flex items-center gap-1 text-xs py-1 px-2 rounded transition-colors"
          style={{ background: '#2563eb', color: '#ffffff' }}
        >
          <Plus size={12} />
          Add
        </button>
      </div>

      {watermarks.length === 0 && (
        <p className="text-xs text-center py-4" style={{ color: mutedColor }}>
          No watermarks added yet.
          <br />
          Click "Add" to add text.
        </p>
      )}

      {/* Clear all watermarks */}
      {watermarks.length > 1 && (
        <button
          onClick={() => watermarks.forEach((wm) => actions.removeWatermark(wm.id))}
          className="flex items-center justify-center gap-1.5 text-xs py-1.5 px-3 rounded transition-colors"
          style={{
            background: isDark ? '#262626' : '#e5e5e5',
            color: mutedColor,
          }}
        >
          <RotateCcw size={12} />
          Clear All Watermarks
        </button>
      )}

      {watermarks.map((wm) => (
        <div
          key={wm.id}
          className="flex flex-col gap-2 p-2 rounded-lg"
          style={{ background: isDark ? '#1a1a1a' : '#f0f0f0' }}
        >
          {/* Text input */}
          <input
            type="text"
            value={wm.text}
            onChange={(e) => actions.updateWatermark(wm.id, { text: e.target.value })}
            className="w-full text-xs px-2 py-1.5 rounded"
            style={{ background: inputBg, color: textColor, border: 'none', outline: 'none' }}
            placeholder="Watermark text..."
          />

          {/* Font select */}
          <select
            value={wm.fontFamily}
            onChange={(e) => actions.updateWatermark(wm.id, { fontFamily: e.target.value })}
            className="w-full text-xs px-2 py-1.5 rounded"
            style={{ background: inputBg, color: textColor, border: 'none' }}
          >
            {FONTS.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>

          {/* Size + Opacity row */}
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-[10px]" style={{ color: mutedColor }}>Size</label>
              <input
                type="number"
                value={wm.fontSize}
                onChange={(e) => actions.updateWatermark(wm.id, { fontSize: parseInt(e.target.value, 10) || 12 })}
                className="w-full text-xs px-2 py-1 rounded"
                style={{ background: inputBg, color: textColor, border: 'none' }}
                min={8}
                max={200}
              />
            </div>
            <div className="flex-1">
              <label className="text-[10px]" style={{ color: mutedColor }}>Opacity</label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={wm.opacity ?? 1}
                onChange={(e) => actions.updateWatermark(wm.id, { opacity: parseFloat(e.target.value) })}
                className="w-full accent-blue-500"
              />
            </div>
          </div>

          {/* Color picker */}
          <div className="flex gap-1 flex-wrap">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => actions.updateWatermark(wm.id, { color: c })}
                className="w-5 h-5 rounded-full border-2 transition-all"
                style={{
                  background: c,
                  borderColor: wm.color === c ? '#2563eb' : isDark ? '#333' : '#ccc',
                  transform: wm.color === c ? 'scale(1.2)' : 'scale(1)',
                }}
              />
            ))}
          </div>

          {/* Position (drag hint) + Delete */}
          <div className="flex items-center justify-between">
            <span className="text-[10px]" style={{ color: mutedColor }}>
              Drag on image to position
            </span>
            <button
              onClick={() => actions.removeWatermark(wm.id)}
              className="p-1 rounded transition-colors hover:bg-red-500/20"
              style={{ color: '#ef4444' }}
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
