/**
 * SmartListingSection - Action buttons row for the general form
 * Save, Preview, and Smart Listing buttons in a compact row
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { Rocket, Save, Eye } from 'lucide-react';

export function SmartListingSection({ onOpenModal, onSave, onPreview, disabled }) {
  return (
    <div className="border-t pt-2 sm:pt-6 mt-2 sm:mt-6">
      <div className="flex gap-2">
        {onSave && (
          <Button
            variant="outline"
            onClick={onSave}
            className="h-9 sm:h-11 px-3 sm:px-4 text-xs sm:text-sm gap-1.5"
          >
            <Save className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            Save
          </Button>
        )}
        {onPreview && (
          <Button
            variant="outline"
            onClick={onPreview}
            className="h-9 sm:h-11 px-3 sm:px-4 text-xs sm:text-sm gap-1.5"
          >
            <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            Preview
          </Button>
        )}
        <Button
          onClick={onOpenModal}
          disabled={disabled}
          className="flex-1 h-9 sm:h-11 text-xs sm:text-sm gap-1.5"
        >
          <Rocket className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          Smart Listing
        </Button>
      </div>
      <p className="text-[9px] sm:text-xs text-muted-foreground text-center mt-0.5 sm:mt-2 leading-tight">
        Save your progress, preview listings, or launch Smart Listing
      </p>
    </div>
  );
}
