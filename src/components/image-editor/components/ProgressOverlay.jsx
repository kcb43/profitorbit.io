import React from 'react';
import { Loader2 } from 'lucide-react';

export default function ProgressOverlay({ done, total }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4 p-8 rounded-2xl bg-neutral-900 border border-neutral-700 shadow-2xl">
        <Loader2 size={32} className="text-blue-500 animate-spin" />
        <div className="text-white text-sm font-medium">
          Applying edits to all images...
        </div>
        <div className="w-48 h-2 rounded-full bg-neutral-700 overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="text-neutral-400 text-xs">
          {done} / {total} images processed
        </div>
      </div>
    </div>
  );
}
