import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OptimizedImage } from "@/components/OptimizedImage";
import { format, parseISO } from 'date-fns';
import { AlertTriangle, Trash2, Merge, CheckCircle2, Loader2, Package, ShoppingCart } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import { apiClient } from "@/api/base44Client";
import { salesApi } from "@/api/salesApi";

const DEFAULT_IMAGE_URL = "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68e86fb5ac26f8511acce7ec/4abea2f77_box.png";

export function DuplicateDetectionDialog({
  isOpen,
  onClose,
  inventoryDuplicates = [],
  saleDuplicates = [],
  onRefresh,
}) {
  const [deletingId, setDeletingId] = useState(null);
  const [mergingGroupIdx, setMergingGroupIdx] = useState(null);
  const [primarySelections, setPrimarySelections] = useState({});
  const { toast } = useToast();

  const invCount = inventoryDuplicates.length;
  const saleCount = saleDuplicates.length;
  const totalCount = invCount + saleCount;

  // ── Delete handlers ──────────────────────────────────────────────

  const handleDeleteInventoryItem = async (itemId) => {
    setDeletingId(itemId);
    try {
      await apiClient.delete(`/api/inventory/${itemId}`);
      toast({ title: "Item deleted", description: "Duplicate item has been removed." });
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Delete error:', err);
      toast({ title: "Delete failed", description: err.message || "Could not delete item.", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteSale = async (saleId) => {
    setDeletingId(saleId);
    try {
      await salesApi.delete(saleId, true);
      toast({ title: "Sale deleted", description: "Duplicate sale has been removed." });
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Delete error:', err);
      toast({ title: "Delete failed", description: err.message || "Could not delete sale.", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  // ── Merge handler ────────────────────────────────────────────────

  const handleMergeGroup = async (groupIdx) => {
    const group = inventoryDuplicates[groupIdx];
    if (!group || group.items.length < 2) return;

    const primaryId = primarySelections[groupIdx] || group.items[0].id;
    const duplicateIds = group.items.filter(it => it.id !== primaryId).map(it => it.id);

    setMergingGroupIdx(groupIdx);
    try {
      const response = await apiClient.post('/api/inventory/merge-duplicates', {
        primaryItemId: primaryId,
        duplicateItemIds: duplicateIds,
        action: 'merge_and_delete',
      });

      if (response.success) {
        toast({
          title: "Items merged",
          description: `Merged ${duplicateIds.length} duplicate${duplicateIds.length > 1 ? 's' : ''} into one item.`,
        });
        if (onRefresh) onRefresh();
      } else {
        throw new Error(response.error || 'Merge failed');
      }
    } catch (err) {
      console.error('Merge error:', err);
      toast({ title: "Merge failed", description: err.message || "Could not merge items.", variant: "destructive" });
    } finally {
      setMergingGroupIdx(null);
    }
  };

  // ── Render ───────────────────────────────────────────────────────

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            {totalCount > 0 ? (
              <>
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                {totalCount} Duplicate Group{totalCount > 1 ? 's' : ''} Found
              </>
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                No Duplicates Found
              </>
            )}
          </DialogTitle>
          {totalCount === 0 && (
            <DialogDescription>
              Your inventory and sales look clean — no duplicate entries detected.
            </DialogDescription>
          )}
        </DialogHeader>

        {totalCount > 0 && (
          <Tabs defaultValue="inventory" className="mt-2">
            <TabsList className="w-full">
              <TabsTrigger value="inventory" className="flex-1 gap-1.5">
                <Package className="w-3.5 h-3.5" />
                Inventory ({invCount})
              </TabsTrigger>
              <TabsTrigger value="sales" className="flex-1 gap-1.5">
                <ShoppingCart className="w-3.5 h-3.5" />
                Sales ({saleCount})
              </TabsTrigger>
            </TabsList>

            {/* ── Inventory Tab ─────────────────────────────────── */}
            <TabsContent value="inventory" className="space-y-4 mt-4">
              {invCount === 0 ? (
                <EmptyState text="No inventory duplicates found." />
              ) : (
                inventoryDuplicates.map((group, gIdx) => (
                  <InventoryGroup
                    key={gIdx}
                    group={group}
                    groupIdx={gIdx}
                    primaryId={primarySelections[gIdx] || group.items[0].id}
                    onSetPrimary={(id) => setPrimarySelections(prev => ({ ...prev, [gIdx]: id }))}
                    onDelete={handleDeleteInventoryItem}
                    onMerge={() => handleMergeGroup(gIdx)}
                    deletingId={deletingId}
                    isMerging={mergingGroupIdx === gIdx}
                  />
                ))
              )}
            </TabsContent>

            {/* ── Sales Tab ─────────────────────────────────────── */}
            <TabsContent value="sales" className="space-y-4 mt-4">
              {saleCount === 0 ? (
                <EmptyState text="No sale duplicates found." />
              ) : (
                saleDuplicates.map((group, gIdx) => (
                  <SalesGroup
                    key={gIdx}
                    group={group}
                    onDelete={handleDeleteSale}
                    deletingId={deletingId}
                  />
                ))
              )}
            </TabsContent>
          </Tabs>
        )}

        <div className="flex justify-end pt-3 border-t">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Sub-components ──────────────────────────────────────────────────

function EmptyState({ text }) {
  return (
    <div className="text-center py-8">
      <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-green-500" />
      <p className="text-muted-foreground text-sm">{text}</p>
    </div>
  );
}

function InventoryGroup({ group, groupIdx, primaryId, onSetPrimary, onDelete, onMerge, deletingId, isMerging }) {
  return (
    <div className="border border-amber-200 dark:border-amber-800 rounded-lg overflow-hidden">
      <div className="bg-amber-50 dark:bg-amber-900/20 px-4 py-2 flex items-center justify-between">
        <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
          {group.items.length} similar items
        </span>
        <Button
          size="sm"
          onClick={onMerge}
          disabled={isMerging || group.items.length < 2}
          className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white"
        >
          {isMerging ? (
            <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Merging...</>
          ) : (
            <><Merge className="w-3 h-3 mr-1" /> Merge All</>
          )}
        </Button>
      </div>
      <div className="divide-y divide-border">
        {group.items.map((item) => {
          const isPrimary = item.id === primaryId;
          return (
            <div key={item.id} className={`flex gap-3 p-3 ${isPrimary ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}>
              <OptimizedImage
                src={item.image_url || DEFAULT_IMAGE_URL}
                alt={item.item_name}
                fallback={DEFAULT_IMAGE_URL}
                className="w-16 h-16 object-cover rounded-md flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="text-sm font-medium text-foreground truncate">{item.item_name || 'Untitled'}</h4>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-xs text-muted-foreground">
                      <span>${Number(item.purchase_price || 0).toFixed(2)}</span>
                      {item.size && <span>Size: {item.size}</span>}
                      <span>Qty: {item.quantity || 1}</span>
                      <Badge variant="secondary" className="text-[9px] px-1.5 py-0">{item.status || 'available'}</Badge>
                      {item.created_at && <span>Added {format(parseISO(item.created_at), 'MMM d, yyyy')}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {isPrimary ? (
                      <Badge className="bg-blue-600 text-white text-[9px] px-1.5">Keep</Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-1.5 text-[10px] text-blue-600 hover:text-blue-700"
                        onClick={() => onSetPrimary(item.id)}
                      >
                        Set as primary
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                      onClick={() => onDelete(item.id)}
                      disabled={deletingId === item.id}
                    >
                      {deletingId === item.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SalesGroup({ group, onDelete, deletingId }) {
  return (
    <div className="border border-amber-200 dark:border-amber-800 rounded-lg overflow-hidden">
      <div className="bg-amber-50 dark:bg-amber-900/20 px-4 py-2">
        <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
          {group.items.length} matching sales
        </span>
      </div>
      <div className="divide-y divide-border">
        {group.items.map((sale) => (
          <div key={sale.id} className="flex items-center gap-3 p-3">
            {sale.image_url && (
              <OptimizedImage
                src={sale.image_url}
                alt={sale.item_name}
                fallback={DEFAULT_IMAGE_URL}
                className="w-12 h-12 object-cover rounded-md flex-shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-medium text-foreground truncate">{sale.item_name || 'Untitled'}</h4>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-xs text-muted-foreground">
                <span>${Number(sale.selling_price ?? sale.sale_price ?? 0).toFixed(2)}</span>
                {sale.sale_date && <span>{format(parseISO(sale.sale_date), 'MMM d, yyyy')}</span>}
                {sale.platform && <Badge variant="secondary" className="text-[9px] px-1.5 py-0">{sale.platform}</Badge>}
              </div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex-shrink-0"
              onClick={() => onDelete(sale.id)}
              disabled={deletingId === sale.id}
            >
              {deletingId === sale.id ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Trash2 className="w-3.5 h-3.5" />
              )}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
