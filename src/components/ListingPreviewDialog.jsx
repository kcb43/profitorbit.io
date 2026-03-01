/**
 * ListingPreviewDialog - Standalone dialog showing marketplace-styled listing previews
 * Opened from the Preview button on the general form
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { EbayPreview } from './marketplace-previews/EbayPreview';
import { MercariPreview } from './marketplace-previews/MercariPreview';
import { FacebookPreview } from './marketplace-previews/FacebookPreview';

const TABS = [
  { id: 'ebay', name: 'eBay', color: '#3665F3' },
  { id: 'mercari', name: 'Mercari', color: '#EB5757' },
  { id: 'facebook', name: 'Facebook', color: '#1877F2' },
];

export default function ListingPreviewDialog({
  open,
  onClose,
  generalForm,
  ebayForm,
  mercariForm,
  facebookForm,
}) {
  const [activeTab, setActiveTab] = useState('ebay');

  const renderPreview = () => {
    switch (activeTab) {
      case 'ebay':
        return <EbayPreview generalForm={generalForm} marketplaceForm={ebayForm} />;
      case 'mercari':
        return <MercariPreview generalForm={generalForm} marketplaceForm={mercariForm} />;
      case 'facebook':
        return <FacebookPreview generalForm={generalForm} marketplaceForm={facebookForm} />;
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="p-0 w-[95vw] max-w-[95vw] sm:w-full sm:max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 border-b shrink-0">
          <DialogTitle>Listing Preview</DialogTitle>
          <DialogDescription>
            See how your listing will appear on each marketplace
          </DialogDescription>
        </DialogHeader>

        {/* Marketplace tabs */}
        <div className="flex border-b px-4 sm:px-6 shrink-0">
          {TABS.map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "px-4 py-2.5 text-sm font-medium transition-colors relative",
                activeTab === tab.id
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.name}
              {activeTab === tab.id && (
                <div
                  className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                  style={{ backgroundColor: tab.color }}
                />
              )}
            </button>
          ))}
        </div>

        {/* Preview content */}
        <ScrollArea className="flex-1 overflow-auto">
          <div className="p-4 sm:p-6">
            {renderPreview()}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
