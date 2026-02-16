/**
 * SmartListingSection - Drop-in component for CrosslistComposer
 * Add this component right before the individual marketplace "List" buttons
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Rocket } from 'lucide-react';

export function SmartListingSection({
  selectedMarketplaces,
  toggleMarketplace,
  handleListToSelected,
  isSubmitting,
  isSaving,
}) {
  return (
    <div className="border-t pt-6 mt-6 space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-2">Smart Listing</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Select marketplaces and list to all at once with automatic validation & AI auto-fill
        </p>
      </div>
      
      {/* Marketplace Selection */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
          <Checkbox
            id="select-ebay"
            checked={selectedMarketplaces.includes('ebay')}
            onCheckedChange={(checked) => toggleMarketplace('ebay', checked)}
          />
          <Label
            htmlFor="select-ebay"
            className="cursor-pointer flex-1 font-medium"
          >
            eBay
          </Label>
        </div>
        
        <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
          <Checkbox
            id="select-mercari"
            checked={selectedMarketplaces.includes('mercari')}
            onCheckedChange={(checked) => toggleMarketplace('mercari', checked)}
          />
          <Label
            htmlFor="select-mercari"
            className="cursor-pointer flex-1 font-medium"
          >
            Mercari
          </Label>
        </div>
        
        <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
          <Checkbox
            id="select-facebook"
            checked={selectedMarketplaces.includes('facebook')}
            onCheckedChange={(checked) => toggleMarketplace('facebook', checked)}
          />
          <Label
            htmlFor="select-facebook"
            className="cursor-pointer flex-1 font-medium"
          >
            Facebook
          </Label>
        </div>
      </div>
      
      {/* List to Selected Button */}
      <Button
        onClick={handleListToSelected}
        disabled={selectedMarketplaces.length === 0 || isSubmitting || isSaving}
        className="w-full"
        size="lg"
      >
        <Rocket className="w-4 h-4 mr-2" />
        {isSubmitting 
          ? 'Listing...' 
          : `List to ${selectedMarketplaces.length || 0} Selected Marketplace${selectedMarketplaces.length !== 1 ? 's' : ''}`
        }
      </Button>
      
      {selectedMarketplaces.length > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          AI will auto-fill missing fields and show suggestions for your review
        </p>
      )}
    </div>
  );
}
