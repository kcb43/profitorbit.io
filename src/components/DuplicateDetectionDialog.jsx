import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { OptimizedImage } from "@/components/OptimizedImage";
import { format, parseISO } from 'date-fns';
import { AlertTriangle, Link as LinkIcon, ExternalLink, X, Loader2 } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import { apiClient } from "@/api/base44Client";

const DEFAULT_IMAGE_URL = "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68e86fb5ac26f8511acce7ec/4abea2f77_box.png";

export function DuplicateDetectionDialog({ 
  isOpen, 
  onClose, 
  duplicates, 
  onViewInventory,
  onMergeComplete
}) {
  const [selectedDuplicates, setSelectedDuplicates] = useState(new Set());
  const [isMerging, setIsMerging] = useState(false);
  const { toast } = useToast();

  if (!duplicates || Object.keys(duplicates).length === 0) {
    return null;
  }

  // Get the first imported item's duplicates for now
  const importedItemId = Object.keys(duplicates)[0];
  const duplicateData = duplicates[importedItemId] || {};
  const importedItem = duplicateData.importedItem;
  const matches = duplicateData.matches || [];

  const toggleSelect = (id) => {
    const newSelected = new Set(selectedDuplicates);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedDuplicates(newSelected);
  };

  const handleMerge = async () => {
    if (selectedDuplicates.size === 0) {
      toast({
        title: "No items selected",
        description: "Please select at least one duplicate to merge",
        variant: "destructive",
      });
      return;
    }

    setIsMerging(true);

    try {
      const response = await apiClient.post('/api/inventory/merge-duplicates', {
        primaryItemId: importedItemId,
        duplicateItemIds: Array.from(selectedDuplicates),
        action: 'merge_and_delete'
      });

      if (response.success) {
        toast({
          title: "Items merged successfully",
          description: `Merged ${response.mergedCount} duplicate${response.mergedCount > 1 ? 's' : ''} into your item`,
        });

        // Call callback to refresh data
        if (onMergeComplete) {
          onMergeComplete(importedItemId);
        }

        onClose();
      } else {
        throw new Error(response.error || 'Failed to merge items');
      }
    } catch (error) {
      console.error('❌ Error merging items:', error);
      toast({
        title: "Merge failed",
        description: error.message || "Failed to merge duplicate items",
        variant: "destructive",
      });
    } finally {
      setIsMerging(false);
    }
  };

  const handleViewInInventory = () => {
    if (onViewInventory) {
      onViewInventory(importedItemId);
    }
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                Potential Duplicates Detected
              </DialogTitle>
              <DialogDescription className="mt-2">
                We found {matches.length} item{matches.length > 1 ? 's' : ''} in your inventory that may be similar to the item you just imported.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800">
          <AlertDescription className="text-sm">
            <strong>Why am I seeing this?</strong> These items have similar titles or match marketplace IDs. Review them to avoid having duplicate inventory.
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          {/* Newly Imported Item */}
          <div className="border-2 border-blue-500 rounded-lg p-4 bg-blue-50 dark:bg-blue-900/20">
            <div className="flex items-center gap-2 mb-3">
              <Badge className="bg-blue-600 text-white">Just Imported</Badge>
              {importedItem?.source && (
                <Badge variant="outline">{importedItem.source}</Badge>
              )}
            </div>
            <div className="flex gap-4">
              <OptimizedImage
                src={importedItem?.image_url || DEFAULT_IMAGE_URL}
                alt={importedItem?.item_name || "Imported item"}
                fallback={DEFAULT_IMAGE_URL}
                className="w-24 h-24 object-cover rounded-md flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground truncate">{importedItem?.item_name || "New Item"}</h3>
                <div className="mt-1 text-sm text-muted-foreground space-y-1">
                  {importedItem?.purchase_price && (
                    <div>Price: ${parseFloat(importedItem.purchase_price).toFixed(2)}</div>
                  )}
                  {importedItem?.purchase_date && (
                    <div>Date: {format(parseISO(importedItem.purchase_date), 'MMM dd, yyyy')}</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Potential Duplicates */}
          <div>
            <h4 className="font-semibold text-sm text-muted-foreground mb-2">
              Potential Duplicates in Your Inventory:
              {selectedDuplicates.size > 0 && (
                <span className="ml-2 text-blue-600">({selectedDuplicates.size} selected)</span>
              )}
            </h4>
            <div className="space-y-2">
              {matches.map((match) => (
                <div 
                  key={match.id}
                  className={`border rounded-lg p-4 transition-colors ${
                    selectedDuplicates.has(match.id) 
                      ? 'bg-blue-50 border-blue-300 dark:bg-blue-900/20 dark:border-blue-700' 
                      : 'hover:bg-muted/50'
                  }`}
                >
                  <div className="flex gap-4">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={selectedDuplicates.has(match.id)}
                        onCheckedChange={() => toggleSelect(match.id)}
                        className="mt-1"
                      />
                      <OptimizedImage
                        src={match.image_url || DEFAULT_IMAGE_URL}
                        alt={match.item_name}
                        fallback={DEFAULT_IMAGE_URL}
                        className="w-20 h-20 object-cover rounded-md flex-shrink-0"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-foreground">{match.item_name}</h3>
                          {match.similarity && (
                            <Badge variant="outline" className="mt-1 text-xs">
                              {match.similarity.toFixed(0)}% match
                            </Badge>
                          )}
                        </div>
                        {match.source && (
                          <Badge variant="outline" className="flex-shrink-0">{match.source}</Badge>
                        )}
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground space-y-0.5">
                        <div className="flex items-center gap-4 flex-wrap">
                          {match.purchase_price && (
                            <span>Price: ${parseFloat(match.purchase_price).toFixed(2)}</span>
                          )}
                          {match.status && (
                            <Badge variant="secondary" className="text-xs">{match.status}</Badge>
                          )}
                          {match.quantity > 1 && (
                            <span className="text-xs">Qty: {match.quantity}</span>
                          )}
                        </div>
                        {(match.ebay_item_id || match.mercari_item_id || match.facebook_item_id) && (
                          <div className="text-xs">
                            {match.ebay_item_id && <span className="mr-3">eBay ID: {match.ebay_item_id}</span>}
                            {match.mercari_item_id && <span className="mr-3">Mercari ID: {match.mercari_item_id}</span>}
                            {match.facebook_item_id && <span>Facebook ID: {match.facebook_item_id}</span>}
                          </div>
                        )}
                        {match.created_at && (
                          <div className="text-xs">Added: {format(parseISO(match.created_at), 'MMM dd, yyyy')}</div>
                        )}
                      </div>
                      
                      {/* Show differences that user may want to merge */}
                      {(match.description || match.brand || match.size || match.condition) && (
                        <div className="mt-2 pt-2 border-t">
                          <div className="text-xs text-muted-foreground">
                            <strong>Additional data in this item:</strong>
                            {match.description && <div>• Has description</div>}
                            {match.brand && <div>• Brand: {match.brand}</div>}
                            {match.size && <div>• Size: {match.size}</div>}
                            {match.condition && <div>• Condition: {match.condition}</div>}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            Found {matches.length} potential duplicate{matches.length > 1 ? 's' : ''}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={isMerging}>
              <X className="w-4 h-4 mr-2" />
              Dismiss
            </Button>
            {selectedDuplicates.size > 0 && (
              <Button 
                onClick={handleMerge} 
                disabled={isMerging}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isMerging ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Merging...
                  </>
                ) : (
                  <>
                    <LinkIcon className="w-4 h-4 mr-2" />
                    Merge {selectedDuplicates.size} Item{selectedDuplicates.size > 1 ? 's' : ''}
                  </>
                )}
              </Button>
            )}
            <Button onClick={handleViewInInventory} disabled={isMerging}>
              <ExternalLink className="w-4 h-4 mr-2" />
              View in Inventory
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
