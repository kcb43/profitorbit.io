import React from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Crop } from 'lucide-react';

/**
 * CropControls - Crop button, aspect ratio selector, and apply/cancel actions
 */
export function CropControls({
  isCropping,
  aspectRatio,
  onStartCrop,
  onAspectRatioChange,
  onApplyCrop,
  onCancelCrop,
  isMobile = false,
  className = ''
}) {
  if (isCropping) {
    return (
      <div className={`space-y-2 ${className}`}>
        {/* Aspect Ratio Selector */}
        <Select value={aspectRatio} onValueChange={onAspectRatioChange}>
          <SelectTrigger className="w-full bg-white border-gray-300 text-gray-900 text-xs h-7">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="free">Free</SelectItem>
            <SelectItem value="square">Square (1:1)</SelectItem>
            <SelectItem value="4:3">Landscape (4:3)</SelectItem>
            <SelectItem value="16:9">Widescreen (16:9)</SelectItem>
            <SelectItem value="4:5">Portrait (4:5)</SelectItem>
            <SelectItem value="9:16">Vertical (9:16)</SelectItem>
          </SelectContent>
        </Select>
        
        {/* Apply/Cancel Buttons */}
        <div className="flex gap-1.5">
          <Button
            onClick={onCancelCrop}
            className="flex-1 bg-red-600/80 hover:bg-red-500 text-white text-xs h-7"
          >
            Cancel
          </Button>
          <Button
            onClick={onApplyCrop}
            className="flex-1 bg-green-600/80 hover:bg-green-500 text-white text-xs h-7"
          >
            ✓ Apply
          </Button>
        </div>
      </div>
    );
  }

  // Not cropping - show crop button
  return (
    <div className={className}>
      <button
        onClick={onStartCrop}
        className="w-full p-2 rounded-md border bg-white border-gray-300 text-gray-900 hover:bg-indigo-50 hover:border-indigo-400 transition-all duration-200 flex items-center justify-center gap-1.5 text-xs h-9 sm:h-[54px]"
      >
        <Crop className="w-3.5 h-3.5" />
        <span>Crop</span>
      </button>
    </div>
  );
}
