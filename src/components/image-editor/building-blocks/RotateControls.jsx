import React from 'react';
import { Button } from '@/components/ui/button';
import { RotateCcw, RotateCw } from 'lucide-react';

/**
 * RotateControls - Rotate left/right and flip controls
 */
export function RotateControls({
  onRotateLeft,
  onRotateRight,
  onFlipHorizontal,
  onFlipVertical,
  showFlipButtons = true,
  className = ''
}) {
  return (
    <div className={`space-y-2 ${className}`}>
      {/* Rotation Buttons */}
      <div className="grid grid-cols-2 gap-1.5">
        <button
          onClick={onRotateLeft}
          className="flex items-center justify-center gap-1 p-2 rounded-md border bg-white border-gray-300 text-gray-900 hover:bg-indigo-50 hover:border-indigo-400 transition-all duration-200 text-xs h-9"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Left</span>
        </button>
        <button
          onClick={onRotateRight}
          className="flex items-center justify-center gap-1 p-2 rounded-md border bg-white border-gray-300 text-gray-900 hover:bg-indigo-50 hover:border-indigo-400 transition-all duration-200 text-xs h-9"
        >
          <RotateCw className="w-3.5 h-3.5" />
          <span>Right</span>
        </button>
      </div>

      {/* Flip Buttons */}
      {showFlipButtons && (
        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={onFlipHorizontal}
            className="p-2 rounded-md border bg-white border-gray-300 text-gray-900 hover:bg-indigo-50 hover:border-indigo-400 transition-all duration-200 text-xs h-9"
          >
            Flip H
          </button>
          <button
            onClick={onFlipVertical}
            className="p-2 rounded-md border bg-white border-gray-300 text-gray-900 hover:bg-indigo-50 hover:border-indigo-400 transition-all duration-200 text-xs h-9"
          >
            Flip V
          </button>
        </div>
      )}
    </div>
  );
}
