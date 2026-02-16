/**
 * SmartListingSection - Trigger button for Smart Listing modal
 * Opens the comprehensive modal workflow for multi-marketplace listing
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { Rocket } from 'lucide-react';

export function SmartListingSection({ onOpenModal }) {
  return (
    <div className="border-t pt-6 mt-6">
      <Button
        onClick={onOpenModal}
        size="lg"
        className="w-full"
        variant="default"
      >
        <Rocket className="w-5 h-5 mr-2" />
        Smart Listing - List to Multiple Marketplaces
      </Button>
      <p className="text-xs text-muted-foreground text-center mt-2">
        AI-powered multi-marketplace listing with auto-fill & validation
      </p>
    </div>
  );
}
