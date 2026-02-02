import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { format, parseISO } from 'date-fns';
import { Trash2, Calendar, Package, DollarSign, AlertCircle } from 'lucide-react';
import { OptimizedImage } from './OptimizedImage';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const statusColors = {
  available: "bg-blue-100 text-blue-800 border border-blue-200",
  listed: "bg-green-100 text-green-800 border border-green-200",
  sold: "bg-gray-100 text-gray-800 border border-gray-200",
};

const statusLabels = {
  available: "In Stock",
  listed: "Listed",
  sold: "Sold",
};

const DEFAULT_IMAGE_URL = "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68e86fb5ac26f8511acce7ec/4abea2f77_box.png";

export function DuplicatesModal({ open, onOpenChange, duplicates, onDelete, currentItemId }) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);

  const handleDeleteClick = (item) => {
    setItemToDelete(item);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (itemToDelete && onDelete) {
      await onDelete(itemToDelete.id);
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    }
  };

  // Sort duplicates by created_at (oldest first)
  const sortedDuplicates = [...(duplicates || [])].sort(
    (a, b) => new Date(a.created_at) - new Date(b.created_at)
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Duplicate Items Found ({sortedDuplicates.length})
            </DialogTitle>
            <DialogDescription>
              These items appear to be duplicates based on their title or marketplace item ID. 
              The oldest item is shown first. You can delete any duplicates you don't need.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 mt-4">
            {sortedDuplicates.map((item, index) => {
              const isCurrentItem = item.id === currentItemId;
              const imageUrl = item.images?.[0] || item.image_url || DEFAULT_IMAGE_URL;
              const createdDate = item.created_at ? format(parseISO(item.created_at), 'MMM d, yyyy h:mm a') : 'Unknown';

              return (
                <Card key={item.id} className={`relative ${isCurrentItem ? 'border-2 border-blue-500' : ''}`}>
                  {isCurrentItem && (
                    <Badge className="absolute -top-2 -right-2 bg-blue-500 text-white">
                      Current Item
                    </Badge>
                  )}
                  
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      {/* Image */}
                      <div className="flex-shrink-0">
                        <OptimizedImage
                          src={imageUrl}
                          alt={item.item_name}
                          className="h-24 w-24 object-cover rounded-md"
                        />
                      </div>

                      {/* Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-sm truncate">
                              {item.item_name}
                            </h3>
                            
                            <div className="flex flex-wrap items-center gap-2 mt-2">
                              <Badge className={statusColors[item.status] || statusColors.available}>
                                {statusLabels[item.status] || item.status}
                              </Badge>
                              
                              {item.source && (
                                <Badge variant="outline" className="text-xs">
                                  {item.source}
                                </Badge>
                              )}

                              {item.ebay_item_id && (
                                <Badge variant="outline" className="text-xs">
                                  eBay: {item.ebay_item_id}
                                </Badge>
                              )}
                              
                              {item.facebook_item_id && (
                                <Badge variant="outline" className="text-xs">
                                  Facebook: {item.facebook_item_id}
                                </Badge>
                              )}
                              
                              {item.mercari_item_id && (
                                <Badge variant="outline" className="text-xs">
                                  Mercari: {item.mercari_item_id}
                                </Badge>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                <span>Added: {createdDate}</span>
                              </div>
                              
                              {item.purchase_price && (
                                <div className="flex items-center gap-1">
                                  <DollarSign className="h-3 w-3" />
                                  <span>${parseFloat(item.purchase_price).toFixed(2)}</span>
                                </div>
                              )}
                              
                              {item.quantity > 1 && (
                                <div className="flex items-center gap-1">
                                  <Package className="h-3 w-3" />
                                  <span>Qty: {item.quantity}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Delete Button */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteClick(item)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Duplicate Item?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{itemToDelete?.item_name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
