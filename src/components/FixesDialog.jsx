/**
 * FixesDialog - Shows validation issues and allows users to fix them before listing
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  Eye,
  MapPin,
  Tag,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  getMarketplaceName,
  groupIssuesBySeverity,
  isMarketplaceReady,
} from '@/utils/preflightEngine';
import IssuesList from './IssuesList';

const FB_LOGO = 'https://upload.wikimedia.org/wikipedia/commons/b/b9/2023_Facebook_icon.svg';

function ListingPreview({ listingData }) {
  const { title, description, price, imageUrl, location, condition, category } = listingData || {};
  if (!title && !imageUrl) return null;

  const formattedPrice = price
    ? `$${parseFloat(price).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
    : '$0';

  return (
    <div className="rounded-xl border border-gray-200 dark:border-border bg-white dark:bg-card overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 dark:bg-muted/40 border-b border-gray-200 dark:border-border">
        <img src={FB_LOGO} alt="Facebook" className="w-5 h-5" />
        <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
          Facebook Marketplace Preview
        </span>
      </div>

      <div className="flex flex-col sm:flex-row">
        {/* Image */}
        {imageUrl && (
          <div className="sm:w-[200px] sm:min-w-[200px] aspect-square bg-gray-100 dark:bg-muted overflow-hidden">
            <img
              src={imageUrl}
              alt={title || 'Listing'}
              className="w-full h-full object-cover"
              crossOrigin="anonymous"
            />
          </div>
        )}

        {/* Details */}
        <div className="flex-1 min-w-0 p-4 flex flex-col gap-2">
          <div className="text-xl font-bold text-gray-900 dark:text-white leading-tight">
            {formattedPrice}
          </div>
          <div className="text-sm font-medium text-gray-800 dark:text-gray-200 line-clamp-2">
            {title || 'Untitled Listing'}
          </div>
          {location && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="w-3 h-3" />
              {location}
            </div>
          )}
          <div className="flex flex-wrap gap-1.5 mt-1">
            {condition && (
              <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                <Tag className="w-2.5 h-2.5" />
                {condition}
              </span>
            )}
            {category && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-muted text-muted-foreground border border-gray-200 dark:border-border">
                {category}
              </span>
            )}
          </div>

          {/* Description */}
          {description && (
            <div className="mt-2 border-t border-gray-100 dark:border-border pt-2">
              <div className="text-xs font-medium text-muted-foreground mb-1">Description</div>
              <ScrollArea className="max-h-[120px]">
                <p className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed pr-2">
                  {description}
                </p>
              </ScrollArea>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * FixesDialog component
 * @param {Object} props
 * @param {boolean} props.open - Whether dialog is open
 * @param {Function} props.onClose - Close handler
 * @param {Object} props.preflightResult - Preflight validation results
 * @param {string[]} props.preflightResult.ready - Marketplaces ready to list
 * @param {Array<{marketplace: string, issues: Issue[]}>} props.preflightResult.fixesNeeded - Marketplaces with issues
 * @param {Function} props.onApplyFix - Handler for applying a fix to a field
 * @param {Function} props.onListNow - Handler for submitting listings when ready
 * @param {boolean} props.isSubmitting - Whether listings are being submitted
 */
export default function FixesDialog({
  open,
  onClose,
  preflightResult,
  onApplyFix,
  onListNow,
  isSubmitting = false,
  onSaveEbayDefault,
  onSaveFacebookDefault,
  listingData,
}) {
  const [activeMarketplace, setActiveMarketplace] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  
  // Auto-select first marketplace with issues when dialog opens
  useEffect(() => {
    if (open && preflightResult?.fixesNeeded?.length > 0) {
      setActiveMarketplace(preflightResult.fixesNeeded[0].marketplace);
    }
  }, [open, preflightResult]);
  
  if (!preflightResult) {
    return null;
  }
  
  const { ready, fixesNeeded } = preflightResult;
  const totalMarketplaces = ready.length + fixesNeeded.length;
  const allReady = fixesNeeded.length === 0;
  
  // Get issues for active marketplace
  const activeIssues = activeMarketplace
    ? fixesNeeded.find(mp => mp.marketplace === activeMarketplace)?.issues || []
    : [];
  
  const { blocking: blockingIssues, warning: warningIssues } = groupIssuesBySeverity(activeIssues);
  
  // Check if all marketplaces are ready to list
  const canListNow = fixesNeeded.every(mp => isMarketplaceReady(mp.issues));
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[85vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle>Review & Fix Issues</DialogTitle>
          <DialogDescription>
            {allReady ? (
              <span className="text-green-600 dark:text-green-400 font-medium">
                All {totalMarketplaces} marketplace(s) ready to list!
              </span>
            ) : (
              <>
                {ready.length} ready, {fixesNeeded.length} need attention
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-[250px_1fr] flex-1 min-h-0">
          {/* Left: Marketplaces list */}
          <ScrollArea className="border-r">
            <div className="p-4 space-y-1">
              {/* Ready marketplaces */}
              {ready.map(marketplace => (
                <div
                  key={marketplace}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-md bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800"
                >
                  <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0" />
                  <span className="text-sm font-medium text-green-900 dark:text-green-100">
                    {getMarketplaceName(marketplace)}
                  </span>
                </div>
              ))}
              
              {/* Marketplaces with issues */}
              {fixesNeeded.map(({ marketplace, issues }) => {
                const { blocking, warning } = groupIssuesBySeverity(issues);
                const hasBlocking = blocking.length > 0;
                const isActive = marketplace === activeMarketplace;
                
                return (
                  <button
                    key={marketplace}
                    onClick={() => setActiveMarketplace(marketplace)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors text-left",
                      isActive 
                        ? "bg-primary/10 border-primary" 
                        : "hover:bg-muted border-transparent",
                      "border"
                    )}
                  >
                    {hasBlocking ? (
                      <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-yellow-500 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">
                        {getMarketplaceName(marketplace)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {blocking.length > 0 && (
                          <span className="text-red-600 dark:text-red-400">
                            {blocking.length} blocking
                          </span>
                        )}
                        {blocking.length > 0 && warning.length > 0 && (
                          <span className="mx-1">•</span>
                        )}
                        {warning.length > 0 && (
                          <span className="text-yellow-600 dark:text-yellow-400">
                            {warning.length} warning{warning.length !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                    {isActive && (
                      <ChevronRight className="w-4 h-4 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </ScrollArea>
          
          {/* Right: Issues panel */}
          <div className="flex flex-col min-h-0">
            {activeMarketplace ? (
              <>
                <div className="px-6 py-4 border-b">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">
                      {getMarketplaceName(activeMarketplace)}
                    </h3>
                    <div className="flex gap-2">
                      {blockingIssues.length > 0 && (
                        <Badge variant="destructive">
                          {blockingIssues.length} Blocking
                        </Badge>
                      )}
                      {warningIssues.length > 0 && (
                        <Badge variant="warning" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                          {warningIssues.length} Warning{warningIssues.length !== 1 ? 's' : ''}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                
                <ScrollArea className="flex-1">
                  <div className="p-6">
                    <IssuesList
                      marketplace={activeMarketplace}
                      issues={activeIssues}
                      onApplyFix={onApplyFix}
                      onSaveEbayDefault={onSaveEbayDefault}
                      onSaveFacebookDefault={onSaveFacebookDefault}
                    />
                  </div>
                </ScrollArea>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <div className="text-center">
                  <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-500" />
                  <p className="text-lg font-medium">All Clear!</p>
                  <p className="text-sm">All marketplaces are ready to list</p>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Listing Preview — collapsible */}
        {listingData && (listingData.title || listingData.imageUrl) && (
          <div className="border-t">
            <button
              type="button"
              onClick={() => setPreviewOpen(!previewOpen)}
              className="w-full flex items-center gap-2 px-6 py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <Eye className="w-4 h-4" />
              Listing Preview
              <ChevronDown className={cn('w-4 h-4 ml-auto transition-transform', previewOpen && 'rotate-180')} />
            </button>
            {previewOpen && (
              <div className="px-6 pb-4">
                <ListingPreview listingData={listingData} />
              </div>
            )}
          </div>
        )}

        <DialogFooter className="px-6 py-4 border-t">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={onListNow}
            disabled={!canListNow || isSubmitting}
            className="min-w-[120px]"
          >
            {isSubmitting ? (
              <>
                <span className="mr-2">Listing...</span>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              </>
            ) : (
              <>
                List to {totalMarketplaces} Marketplace{totalMarketplaces !== 1 ? 's' : ''}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
