import React from 'react';
import { Button } from '@/components/ui/button';
import { Undo2, Download } from 'lucide-react';

/**
 * ActionButtons - Reset and Save/Done buttons
 */
export function ActionButtons({
  onReset,
  onSave,
  onClose,
  showReset,
  resetLabel = 'Reset',
  saveLabel = 'Save',
  disabled = false,
  className = ''
}) {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {/* Reset Button */}
      {showReset && (
        <Button
          onClick={onReset}
          className="w-full bg-red-600/80 hover:bg-red-500 text-white flex items-center justify-center gap-1.5 text-xs h-7"
        >
          <Undo2 className="w-3 h-3" />
          <span>{resetLabel}</span>
        </Button>
      )}
      
      {/* Save/Done Button */}
      <Button
        onClick={onSave}
        className="w-full bg-green-600/80 hover:bg-green-500 text-white flex items-center justify-center gap-1.5 text-xs h-10 font-medium"
        style={{ paddingTop: '27px', paddingBottom: '27px', height: '40px' }}
        disabled={disabled}
      >
        <Download className="w-3 h-3" />
        <span>{saveLabel}</span>
      </Button>
    </div>
  );
}
