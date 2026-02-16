/**
 * SmartListingSection - Trigger button for Smart Listing modal
 * Opens the comprehensive modal workflow for multi-marketplace listing
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { Rocket } from 'lucide-react';

export function SmartListingSection({ onOpenModal }) {
  return (
    <div className="border-t pt-3 sm:pt-6 mt-3 sm:mt-6">
      <Button
        onClick={onOpenModal}
        size="lg"
        className="w-full h-auto py-2 sm:py-3"
        variant="default"
      >
        <Rocket className="w-4 h-4 sm:w-5 sm:h-5 mr-2 shrink-0" />
        <span className="text-sm sm:text-base leading-tight">
          Smart Listing - List to Multiple Marketplaces
        </span>
      </Button>
      <p className="text-[10px] sm:text-xs text-muted-foreground text-center mt-1 sm:mt-2">
        Intelligent multi-marketplace listing with auto-fill & validation
      </p>
    </div>
  );
}
