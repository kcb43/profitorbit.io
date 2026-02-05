import React from 'react';
import { Sun as BrightnessIcon, Contrast, Palette, Layers } from 'lucide-react';

/**
 * FilterButtons - Grid of filter type buttons
 */
export function FilterButtons({
  activeFilter,
  onFilterChange,
  isMobile = false,
  className = ''
}) {
  const filters = [
    { id: 'brightness', icon: BrightnessIcon, label: 'Bright' },
    { id: 'contrast', icon: Contrast, label: 'Contrast' },
    { id: 'saturate', icon: Palette, label: 'Saturate' },
    { id: 'shadow', icon: Layers, label: 'Shadow' },
  ];

  return (
    <div className={`grid grid-cols-2 gap-1.5 ${className}`}>
      {filters.map(({ id, icon: Icon, label }) => (
        <button
          key={id}
          onClick={() => onFilterChange(id)}
          className={`flex flex-col items-center justify-center gap-1 p-2 rounded-md border transition-all duration-200 ${
            activeFilter === id
              ? 'bg-indigo-600 border-indigo-500 text-white shadow-md'
              : 'bg-white border-gray-300 text-gray-900 hover:bg-indigo-50 hover:border-indigo-400'
          }`}
        >
          <Icon className="w-3.5 h-3.5" />
          <span className="text-[10px] leading-tight">{label}</span>
        </button>
      ))}
    </div>
  );
}
