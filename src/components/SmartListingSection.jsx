/**
 * SmartListingSection - Trigger button for Smart Listing modal
 * Opens the comprehensive modal workflow for multi-marketplace listing
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { Rocket } from 'lucide-react';

export function SmartListingSection({ onOpenModal, disabled }) {
  return (
    <div className="border-t pt-2 sm:pt-6 mt-2 sm:mt-6">
      <Button
        onClick={onOpenModal}
        size="lg"
        className="w-full h-auto py-1.5 sm:py-3"
        variant="default"
        disabled={disabled}
      >
        <Rocket className="w-3.5 h-3.5 sm:w-5 sm:h-5 mr-1.5 sm:mr-2 shrink-0" />
        <span className="text-xs sm:text-base leading-tight">
          Smart Listing
        </span>
      </Button>
      <p className="text-[9px] sm:text-xs text-muted-foreground text-center mt-0.5 sm:mt-2 leading-tight">
        Intelligent multi-marketplace listing with auto-fill & validation
      </p>
    </div>
  );
}
