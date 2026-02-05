import React from 'react';
import { Button } from '@/components/ui/button';
import { Upload } from 'lucide-react';

/**
 * UploadButton - File upload input and button
 * Used across all variations for consistency
 */
export function UploadButton({ onFileChange, className = '', showLabel = true }) {
  return (
    <div className={className}>
      <input
        type="file"
        id="imageUploader"
        accept="image/*"
        onChange={onFileChange}
        className="hidden"
      />
      <Button
        onClick={() => document.getElementById('imageUploader')?.click()}
        className="w-full bg-white hover:bg-gray-100 text-gray-900 flex items-center justify-center gap-1.5 text-xs h-7 border border-gray-300"
      >
        <Upload className="w-3 h-3" />
        {showLabel && <span>Upload</span>}
      </Button>
    </div>
  );
}
