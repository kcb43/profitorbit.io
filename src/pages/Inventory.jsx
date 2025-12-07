
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, parseISO, differenceInDays, isAfter } from "date-fns";
import { Plus, Package, DollarSign, Trash2, Edit, ShoppingCart, Tag, Filter, AlarmClock, Copy, BarChart, Star, X, TrendingUp, Database, ImageIcon, ArchiveRestore, Archive, Grid2X2, Rows, Check, Facebook, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectValue, SelectTrigger } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import SoldLookupDialog from "../components/SoldLookupDialog";
import { useInventoryTags } from "@/hooks/useInventoryTags";
import { ImageEditor } from "@/components/ImageEditor";
import { OptimizedImage } from "@/components/OptimizedImage";
import { ImageCarousel } from "@/components/ImageCarousel";
import { InventoryItemViewDialog } from "@/components/InventoryItemViewDialog";
import { FacebookListingDialog } from "@/components/FacebookListingDialog";
import { isConnected } from "@/api/facebookClient";
import EbaySearchDialog from "@/components/EbaySearchDialog";

const sourceIcons = {
  "Amazon": "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68e86fb5ac26f8511acce7ec/af08cfed1_Logo.png",
};

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

const QUICK_TAGS = ["Return Soon", "Restock", "Consignment", "Gift", "High Priority"];

const DEFAULT_IMAGE_URL = "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68e86fb5ac26f8511acce7ec/4abea2f77_box.png";

export default function InventoryPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [filters, setFilters] = useState({ search: "", status: "not_sold", daysInStock: "all" });
  const [sort, setSort] = useState("newest");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [permanentDeleteDialogOpen, setPermanentDeleteDialogOpen] = useState(false);
  const [itemToPermanentlyDelete, setItemToPermanentlyDelete] = useState(null);
  const [selectedItems, setSelectedItems] = useState([]);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [bulkUpdateDialogOpen, setBulkUpdateDialogOpen] = useState(false);
  const [quantityDialogOpen, setQuantityDialogOpen] = useState(false);
  const [itemToSell, setItemToSell] = useState(null);
  const [quantityToSell, setQuantityToSell] = useState(1);
  const [soldDialogOpen, setSoldDialogOpen] = useState(false);
  const [soldDialogName, setSoldDialogName] = useState("");
  const [titlePreview, setTitlePreview] = useState(null);
  const [bulkUpdateForm, setBulkUpdateForm] = useState({
    status: "",
    category: "",
    source: "",
    purchase_date: "",
  });
  const [tagEditorFor, setTagEditorFor] = useState(null);
  const [tagDrafts, setTagDrafts] = useState({});
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [showDeletedOnly, setShowDeletedOnly] = useState(false);
  const [showDismissedReturns, setShowDismissedReturns] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [imageToEdit, setImageToEdit] = useState({ url: null, itemId: null });
  const [viewMode, setViewMode] = useState("grid"); // "list" or "grid"
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [itemToView, setItemToView] = useState(null);
  const [facebookListingDialogOpen, setFacebookListingDialogOpen] = useState(false);
  const [itemForFacebookListing, setItemForFacebookListing] = useState(null);
  const [ebaySearchDialogOpen, setEbaySearchDialogOpen] = useState(false);
  const [ebaySearchInitialQuery, setEbaySearchInitialQuery] = useState("");

  const {
    toggleFavorite,
    addTag,
    removeTag,
    clearTags,
    isFavorite,
    getTags,
    clearRemovedItems,
  } = useInventoryTags();
  const returnStateForInventory = React.useMemo(() => ({
    from: {
      pathname: location.pathname,
      search: location.search || "",
      filters: { ...filters },
    },
  }), [location.pathname, location.search, filters]);

  const resetBulkUpdateForm = () => {
    setBulkUpdateForm({
      status: "",
      category: "",
      source: "",
      purchase_date: "",
    });
  };

  const buildBulkUpdatePayload = () => {
    const updates = {};
    if (bulkUpdateForm.status) updates.status = bulkUpdateForm.status;
    if (bulkUpdateForm.category && bulkUpdateForm.category.trim()) updates.category = bulkUpdateForm.category.trim();
    if (bulkUpdateForm.source && bulkUpdateForm.source.trim()) updates.source = bulkUpdateForm.source.trim();
    if (bulkUpdateForm.purchase_date) updates.purchase_date = bulkUpdateForm.purchase_date;
    return updates;
  };

  const { data: inventoryItems, isLoading } = useQuery({
    queryKey: ['inventoryItems'],
    queryFn: () => base44.entities.InventoryItem.list('-purchase_date'),
    initialData: [],
    notifyOnChangeProps: 'all', // Ensure we get notified of all changes for optimistic updates
  });

  useEffect(() => {
    if (isLoading) return;
    if (Array.isArray(inventoryItems)) {
      clearRemovedItems(inventoryItems.map((item) => item.id));
    }
  }, [inventoryItems, clearRemovedItems, isLoading]);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const filterParam = searchParams.get('filter');
    const statusParam = searchParams.get('status');
    
    if (filterParam === 'stale') {
      setFilters(prev => ({ ...prev, daysInStock: "stale", status: "not_sold" }));
    } else if (filterParam === 'returnDeadline') {
      setFilters(prev => ({ ...prev, daysInStock: "returnDeadline", status: "not_sold" }));
    }

    if (statusParam) {
      const normalizedStatus = statusParam.toLowerCase();
      const allowedStatuses = ["all", "not_sold", "available", "listed", "sold"];
      if (allowedStatuses.includes(normalizedStatus)) {
        setFilters(prev => ({ ...prev, status: normalizedStatus }));
      }
    }
  }, [location.search]);

  useEffect(() => {
    if (location.state?.filters) {
      setFilters(prev => ({ ...prev, ...location.state.filters }));
    }
  }, [location.state]);

  // Cleanup function to hard delete items older than 30 days
  const cleanupOldDeletedItems = React.useCallback(async () => {
    if (!Array.isArray(inventoryItems)) return;
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const itemsToHardDelete = inventoryItems.filter(item => {
      if (!item.deleted_at) return false;
      const deletedDate = parseISO(item.deleted_at);
      return deletedDate < thirtyDaysAgo;
    });

    if (itemsToHardDelete.length > 0) {
      try {
        await Promise.all(
          itemsToHardDelete.map(item => base44.entities.InventoryItem.delete(item.id))
        );
        queryClient.invalidateQueries({ queryKey: ['inventoryItems'] });
      } catch (error) {
        console.error("Error cleaning up old deleted items:", error);
      }
    }
  }, [inventoryItems, queryClient]);

  // Run cleanup on mount and when inventoryItems change
  useEffect(() => {
    cleanupOldDeletedItems();
  }, [cleanupOldDeletedItems]);

  // NEW DELETE FUNCTIONALITY - Simple and direct
  const deleteItemMutation = useMutation({
    mutationFn: async (itemId) => {
      const deletedAt = new Date().toISOString();
      console.log("Attempting to soft delete item:", itemId, "with deleted_at:", deletedAt);
      
      // First, check if the item exists and what fields it has
      try {
        const beforeItem = await base44.entities.InventoryItem.get(itemId);
        console.log("Item before update:", beforeItem);
        console.log("Item fields:", Object.keys(beforeItem));
      } catch (e) {
        console.warn("Could not fetch item before update:", e);
      }
      
      // Perform the update
      const updateResponse = await base44.entities.InventoryItem.update(itemId, {
        deleted_at: deletedAt
      });
      console.log("Update response:", updateResponse);
      
      // Wait a brief moment for the server to process
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Verify the update was successful by fetching the item
      try {
        const updatedItem = await base44.entities.InventoryItem.get(itemId);
        console.log("Item after update:", updatedItem);
        console.log("Item fields after update:", Object.keys(updatedItem));
        console.log("deleted_at value:", updatedItem.deleted_at);
        console.log("deletedAt value (camelCase):", updatedItem.deletedAt);
        
        // Check both snake_case and camelCase
        if (!updatedItem.deleted_at && !updatedItem.deletedAt) {
          console.error("Server update failed: deleted_at/deletedAt not set on server", updatedItem);
          throw new Error("Failed to persist deletion - server did not save deleted_at field. The field may not exist in the entity schema. Please check your Base44 entity configuration.");
        }
        
        // Use whichever format was saved
        const actualDeletedAt = updatedItem.deleted_at || updatedItem.deletedAt;
        return { itemId, deletedAt: actualDeletedAt };
      } catch (verifyError) {
        console.error("Failed to verify deletion on server:", verifyError);
        throw new Error("Failed to verify deletion was saved to server: " + verifyError.message);
      }
    },
    onMutate: async (itemId) => {
      // IMMEDIATELY update the cache before server responds
      await queryClient.cancelQueries({ queryKey: ['inventoryItems'] });
      
      const previousData = queryClient.getQueryData(['inventoryItems']);
      const deletedAt = new Date().toISOString();
      
      // Update cache immediately - item disappears right away
      queryClient.setQueryData(['inventoryItems'], (old = []) => {
        return old.map(item => 
          item.id === itemId ? { ...item, deleted_at: deletedAt } : item
        );
      });
      
      // Remove from selected items
      setSelectedItems(prev => prev.filter(id => id !== itemId));
      
      return { previousData };
    },
    onSuccess: async (data, itemId) => {
      // Wait a moment, then refetch to verify server state matches our optimistic update
      setTimeout(async () => {
        try {
          await queryClient.invalidateQueries({ queryKey: ['inventoryItems'] });
          // Update the cache with the verified server data
          const updatedItem = await base44.entities.InventoryItem.get(itemId);
          if (updatedItem.deleted_at) {
            // Ensure cache has the correct deleted_at value
            queryClient.setQueryData(['inventoryItems'], (old = []) => {
              if (!Array.isArray(old)) return old;
              return old.map(item => 
                item.id === itemId ? { ...item, deleted_at: updatedItem.deleted_at } : item
              );
            });
          }
        } catch (error) {
          console.error("Error verifying deletion on server:", error);
        }
      }, 500);
      
      toast({
        title: "✅ Item Deleted Successfully",
        description: `"${itemToDelete?.item_name || 'Item'}" has been moved to deleted items. You can recover it within 30 days.`,
      });
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    },
    onError: (error, itemId, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(['inventoryItems'], context.previousData);
      }
      toast({
        title: "❌ Delete Failed",
        description: `Failed to delete item: ${error.message || 'Unknown error'}`,
        variant: "destructive",
      });
    },
  });

  const recoverItemMutation = useMutation({
    mutationFn: async (itemId) => {
      try {
        await base44.entities.InventoryItem.update(itemId, {
          deleted_at: null
        });
        return itemId;
      } catch (error) {
        throw new Error(`Failed to recover item: ${error.message}`);
      }
    },
    onSuccess: (recoveredId) => {
      queryClient.invalidateQueries({ queryKey: ['inventoryItems'] });
      toast({
        title: "Item Recovered",
        description: "The item has been restored to your inventory.",
      });
    },
    onError: (error) => {
      console.error("Recover error:", error);
      toast({
        title: "Error Recovering Item",
        description: error.message || "Failed to recover item. Please try again.",
        variant: "destructive",
      });
    },
  });

  const permanentDeleteMutation = useMutation({
    mutationFn: async (itemId) => {
      try {
        await base44.entities.InventoryItem.delete(itemId);
        return itemId;
      } catch (error) {
        throw new Error(`Failed to permanently delete item: ${error.message}`);
      }
    },
    onSuccess: (deletedId) => {
      queryClient.invalidateQueries({ queryKey: ['inventoryItems'] });
      toast({
        title: "Item Permanently Deleted",
        description: "The item has been permanently removed and cannot be recovered.",
      });
      setPermanentDeleteDialogOpen(false);
      setItemToPermanentlyDelete(null);
    },
    onError: (error) => {
      console.error("Permanent delete error:", error);
      toast({
        title: "Error Permanently Deleting Item",
        description: error.message || "Failed to permanently delete item. Please try again.",
        variant: "destructive",
      });
    },
  });

  // NEW BULK DELETE - Simple and direct
  const bulkDeleteMutation = useMutation({
    mutationFn: async (itemIds) => {
      const deletedAt = new Date().toISOString();
      const results = [];
      
      for (const id of itemIds) {
        try {
          await base44.entities.InventoryItem.update(id, {
            deleted_at: deletedAt
          });
          results.push({ id, success: true });
        } catch (error) {
          results.push({ id, success: false, error: error.message });
        }
      }
      
      return results;
    },
    onMutate: async (itemIds) => {
      // IMMEDIATELY update cache - items disappear right away
      await queryClient.cancelQueries({ queryKey: ['inventoryItems'] });
      
      const previousData = queryClient.getQueryData(['inventoryItems']);
      const deletedAt = new Date().toISOString();
      
      queryClient.setQueryData(['inventoryItems'], (old = []) => {
        return old.map(item => 
          itemIds.includes(item.id) ? { ...item, deleted_at: deletedAt } : item
        );
      });
      
      // Clear selected items
      setSelectedItems([]);
      
      return { previousData };
    },
    onSuccess: async (results) => {
      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;
      
      setBulkDeleteDialogOpen(false);
      
      // Wait a moment, then refetch to verify server state matches our optimistic update
      setTimeout(async () => {
        try {
          await queryClient.invalidateQueries({ queryKey: ['inventoryItems'] });
          // Verify all successfully deleted items have deleted_at set on server
          const successfulIds = results.filter(r => r.success).map(r => r.id);
          for (const id of successfulIds) {
            try {
              const updatedItem = await base44.entities.InventoryItem.get(id);
              if (updatedItem.deleted_at) {
                // Ensure cache has the correct deleted_at value
                queryClient.setQueryData(['inventoryItems'], (old = []) => {
                  if (!Array.isArray(old)) return old;
                  return old.map(item => 
                    item.id === id ? { ...item, deleted_at: updatedItem.deleted_at } : item
                  );
                });
              }
            } catch (error) {
              console.error(`Error verifying deletion for item ${id}:`, error);
            }
          }
        } catch (error) {
          console.error("Error verifying bulk deletion on server:", error);
        }
      }, 500);
      
      if (failCount === 0) {
        toast({
          title: `✅ ${successCount} Item${successCount > 1 ? 's' : ''} Deleted`,
          description: `All selected items have been moved to deleted items. You can recover them within 30 days.`,
        });
      } else {
        toast({
          title: `⚠️ Partial Delete Complete`,
          description: `${successCount} item${successCount > 1 ? 's' : ''} deleted. ${failCount} failed.`,
          variant: "destructive",
        });
      }
    },
    onError: (error, itemIds, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(['inventoryItems'], context.previousData);
      }
      toast({
        title: "❌ Bulk Delete Failed",
        description: `Failed to delete items: ${error.message || 'Unknown error'}`,
        variant: "destructive",
      });
      setBulkDeleteDialogOpen(false);
    },
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: async ({ ids, updates }) => {
      const results = [];
      for (const id of ids) {
        try {
          await base44.entities.InventoryItem.update(id, updates);
          results.push({ id, success: true });
        } catch (error) {
          results.push({ id, success: false, error: error.message });
        }
      }
      return results;
    },
    onMutate: async ({ ids, updates }) => {
      await queryClient.cancelQueries({ queryKey: ['inventoryItems'] });
      const previousItems = queryClient.getQueryData(['inventoryItems']);

      queryClient.setQueryData(['inventoryItems'], (old = []) => {
        if (!Array.isArray(old)) return old;
        return old.map((item) => (ids.includes(item.id) ? { ...item, ...updates } : item));
      });

      return { previousItems };
    },
    onError: (error, _variables, context) => {
      console.error("Bulk update failed:", error);
      if (context?.previousItems) {
        queryClient.setQueryData(['inventoryItems'], context.previousItems);
      }
      toast({
        title: "Bulk update failed",
        description: "We couldn’t update those items. Please try again.",
        variant: "destructive",
      });
    },
    onSuccess: (results) => {
      const successCount = results.filter((r) => r.success).length;
      const failCount = results.length - successCount;
      toast({
        title: "Bulk update complete",
        description:
          failCount === 0
            ? `Updated ${successCount} item${successCount === 1 ? "" : "s"}.`
            : `Updated ${successCount} item${successCount === 1 ? "" : "s"}. ${failCount} failed.`,
        variant: failCount === 0 ? "default" : "destructive",
      });
      resetBulkUpdateForm();
      setBulkUpdateDialogOpen(false);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['inventoryItems'] });
    },
  });

  // Mutation for updating item image
  const updateImageMutation = useMutation({
    mutationFn: async ({ itemId, file, imageIndex }) => {
      console.log('Starting image update:', { itemId, imageIndex, fileSize: file?.size });
      
      // Upload the edited image
      const uploadPayload = file instanceof File ? file : new File([file], file.name || 'edited-image.jpg', { type: file.type || 'image/jpeg' });
      console.log('Uploading file...', { fileName: uploadPayload.name, size: uploadPayload.size });
      
      const { file_url } = await base44.integrations.Core.UploadFile({ file: uploadPayload });
      console.log('File uploaded:', file_url);
      
      // Get the current item
      const item = inventoryItems.find(i => i.id === itemId);
      console.log('Found item:', { itemId, hasImages: !!item?.images, imageCount: item?.images?.length });
      
      // If item has multiple images, update the images array
      if (item && item.images && item.images.length > 1 && imageIndex !== undefined) {
        const updatedImages = [...item.images];
        updatedImages[imageIndex] = file_url;
        
        console.log('Updating multiple images:', { imageIndex, updatedCount: updatedImages.length });
        await base44.entities.InventoryItem.update(itemId, { 
          images: updatedImages,
          image_url: updatedImages[0] // First image is main
        });
      } else {
        // Single image - just update image_url
        console.log('Updating single image');
        await base44.entities.InventoryItem.update(itemId, { image_url: file_url });
      }
      
      console.log('Database update complete');
      return file_url;
    },
    onSuccess: (fileUrl, variables) => {
      console.log('Image update SUCCESS:', { fileUrl, itemId: variables.itemId, imageIndex: variables.imageIndex });
      
      // Update the stored imageUrl in edit history to the new uploaded URL
      try {
        const historyKey = `${variables.itemId}_${variables.imageIndex}`;
        const stored = localStorage.getItem('imageEditHistory');
        if (stored) {
          const historyMap = new Map(JSON.parse(stored));
          const settings = historyMap.get(historyKey);
          if (settings) {
            settings.imageUrl = fileUrl; // Update to new uploaded URL
            historyMap.set(historyKey, settings);
            localStorage.setItem('imageEditHistory', JSON.stringify(Array.from(historyMap.entries())));
            console.log('Updated imageUrl in edit history:', historyKey, fileUrl);
          }
        }
      } catch (e) {
        console.error('Failed to update imageUrl in edit history:', e);
      }
      
      queryClient.invalidateQueries({ queryKey: ['inventoryItems'] });
      toast({
        title: "Image Updated",
        description: "The item image has been successfully updated.",
      });
      // Don't close editor if multiple images - let user continue editing
      const item = inventoryItems.find(i => i.id === variables.itemId);
      if (!item?.images || item.images.length <= 1) {
        setEditorOpen(false);
        setImageToEdit({ url: null, itemId: null });
      }
    },
    onError: (error) => {
      console.error("Error updating image:", error);
      toast({
        title: "Error Updating Image",
        description: "Failed to update the image. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Mutation for dismissing/undismissing return deadline
  const toggleReturnDeadlineDismissMutation = useMutation({
    mutationFn: async ({ itemId, dismissed }) => {
      await base44.entities.InventoryItem.update(itemId, {
        return_deadline_dismissed: dismissed
      });
      return { itemId, dismissed };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['inventoryItems'] });
      toast({
        title: data.dismissed ? "Return Reminder Dismissed" : "Return Reminder Restored",
        description: data.dismissed 
          ? "This item will no longer appear in return deadline alerts." 
          : "This item will now appear in return deadline alerts.",
      });
    },
    onError: (error) => {
      console.error("Error toggling return deadline dismiss:", error);
      toast({
        title: "Error",
        description: "Failed to update return deadline status. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleEditImage = (e, item) => {
    e.preventDefault();
    e.stopPropagation();
    if (item.image_url && item.image_url !== DEFAULT_IMAGE_URL) {
      setImageToEdit({ url: item.image_url, itemId: item.id });
      setEditorOpen(true);
    } else {
      toast({
        title: "No Image to Edit",
        description: "This item doesn't have a custom image to edit.",
        variant: "destructive",
      });
    }
  };

  const handleSaveEditedImage = (editedFile, imageIndex) => {
    if (imageToEdit.itemId) {
      updateImageMutation.mutate({ 
        itemId: imageToEdit.itemId, 
        file: editedFile,
        imageIndex: imageIndex 
      });
    }
  };

  // Apply filters to all images for an inventory item
  const handleApplyFiltersToAll = async (processedImages, settings) => {
    if (!imageToEdit.itemId) return;
    
    try {
      // Find the item from inventory
      const item = inventoryItems.find(i => i.id === imageToEdit.itemId);
      if (!item || !item.images || item.images.length === 0) {
        alert('No images found for this item.');
        return;
      }

      // Upload all processed images
      const uploadedUrls = [];
      for (let i = 0; i < processedImages.length; i++) {
        const processedItem = processedImages[i];
        if (processedItem.file) {
          const { file_url } = await base44.integrations.Core.UploadFile({ file: processedItem.file });
          uploadedUrls.push(file_url);
        }
      }
      
      // Update the inventory item with new images
      await base44.entities.InventoryItem.update(imageToEdit.itemId, {
        images: uploadedUrls,
        image_url: uploadedUrls[0] || item.image_url
      });
      
      // Invalidate and refetch
      queryClient.invalidateQueries(['inventoryItems']);
      
      toast({
        title: "Filters Applied",
        description: `✓ Successfully applied edits to ${processedImages.length} image(s)!`,
      });
    } catch (error) {
      console.error("Error applying filters to all images:", error);
      toast({
        title: "Error",
        description: "Failed to apply filters to all images. Please try again.",
        variant: "destructive",
      });
    }
  };

  const inventorySummary = React.useMemo(() => {
    const items = Array.isArray(inventoryItems) ? inventoryItems : [];

    const trackableItems = items.filter(item => {
      const status = (item.status || "").toLowerCase();
      return status === "available" || status === "listed";
    });

    const totalInvested = trackableItems.reduce((sum, item) => {
      const rawPurchasePrice = Number(item.purchase_price ?? 0);
      const purchasePrice = Number.isFinite(rawPurchasePrice) && rawPurchasePrice >= 0 ? rawPurchasePrice : 0;

      const rawQuantity = Number(item.quantity ?? 1);
      const quantity = Number.isFinite(rawQuantity) && rawQuantity > 0 ? rawQuantity : 1;

      const rawSold = Number(item.quantity_sold ?? 0);
      const quantitySold = Number.isFinite(rawSold) && rawSold >= 0 ? rawSold : 0;

      const remaining = Math.max(quantity - quantitySold, 0);
      
      if (quantity > 0 && remaining > 0) {
        const perItemPrice = purchasePrice / quantity;
        const investedForRemaining = perItemPrice * remaining;
        return sum + investedForRemaining;
      }
      
      return sum;
    }, 0);

    const totalQuantity = trackableItems.reduce((sum, item) => {
      const rawQuantity = Number(item.quantity ?? 1);
      const quantity = Number.isFinite(rawQuantity) && rawQuantity > 0 ? rawQuantity : 1;

      const rawSold = Number(item.quantity_sold ?? 0);
      const quantitySold = Number.isFinite(rawSold) && rawSold > 0 ? rawSold : 0;

      const remaining = Math.max(quantity - quantitySold, 0);
      return sum + remaining;
    }, 0);

    return { totalInvested, totalQuantity };
  }, [inventoryItems]);

  const filteredItems = React.useMemo(() => {
    if (!Array.isArray(inventoryItems)) return [];
    return inventoryItems.filter(item => {
      const today = new Date();

      // Filter deleted items based on showDeletedOnly state
      // Check for truthy deleted_at (null, undefined, or empty string means not deleted)
      const isDeleted = item.deleted_at !== null && item.deleted_at !== undefined && item.deleted_at !== '';
      const deletedMatch = showDeletedOnly ? isDeleted : !isDeleted;

    // If showing deleted items, skip other filters
    if (showDeletedOnly) {
      const searchMatch = item.item_name?.toLowerCase().includes(filters.search.toLowerCase()) ||
        item.category?.toLowerCase().includes(filters.search.toLowerCase()) ||
        item.source?.toLowerCase().includes(filters.search.toLowerCase());
      return deletedMatch && searchMatch;
    }

    // For non-deleted items, apply all filters
    if (!deletedMatch) return false;

    const statusMatch = filters.status === "all" ||
      (filters.status === "not_sold" && item.status !== "sold") ||
      item.status === filters.status;
    const searchMatch = item.item_name.toLowerCase().includes(filters.search.toLowerCase()) ||
      item.category?.toLowerCase().includes(filters.search.toLowerCase()) ||
      item.source?.toLowerCase().includes(filters.search.toLowerCase());
    const favoriteMatch = !showFavoritesOnly || isFavorite(item.id);
    
    let daysInStockMatch = true;
    if (filters.daysInStock !== "all" && item.status !== "sold") {
      if (filters.daysInStock === "stale") {
        if (item.purchase_date) {
          const daysSincePurchase = differenceInDays(today, parseISO(item.purchase_date));
          daysInStockMatch = daysSincePurchase >= 14;
        } else {
          daysInStockMatch = false;
        }
      } else if (filters.daysInStock === "returnDeadline") {
        if (item.return_deadline) {
          const deadline = parseISO(item.return_deadline);
          const daysUntilDeadline = differenceInDays(deadline, today);
          const isWithinDeadline = daysUntilDeadline >= 0 && daysUntilDeadline <= 10;
          const isDismissed = item.return_deadline_dismissed === true;
          
          // If showing dismissed items, show all items within deadline
          // If not showing dismissed, only show non-dismissed items
          daysInStockMatch = isWithinDeadline && (showDismissedReturns || !isDismissed);
        } else {
          daysInStockMatch = false;
        }
      }
    }
    
      return statusMatch && searchMatch && daysInStockMatch && favoriteMatch;
    });
  }, [inventoryItems, showDeletedOnly, showFavoritesOnly, showDismissedReturns, filters, isFavorite]);

  const deletedCount = React.useMemo(() => {
    if (!Array.isArray(inventoryItems)) return 0;
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    return inventoryItems.filter(item => {
      if (!item.deleted_at) return false;
      const deletedDate = parseISO(item.deleted_at);
      return deletedDate >= thirtyDaysAgo; // Only count items within 30 days
    }).length;
  }, [inventoryItems]);

  const favoritesCount = React.useMemo(() => {
    if (!Array.isArray(inventoryItems)) return 0;
    return inventoryItems.reduce((count, item) => count + (isFavorite(item.id) ? 1 : 0), 0);
  }, [inventoryItems, isFavorite]);

  const dismissedReturnsCount = React.useMemo(() => {
    if (!Array.isArray(inventoryItems)) return 0;
    const today = new Date();
    return inventoryItems.filter(item => {
      if (!item.return_deadline || !item.return_deadline_dismissed) return false;
      const deadline = parseISO(item.return_deadline);
      const daysUntilDeadline = differenceInDays(deadline, today);
      // Only count items with return deadline within 10 days that are dismissed
      return daysUntilDeadline >= 0 && daysUntilDeadline <= 10;
    }).length;
  }, [inventoryItems]);

  const handleTagEditorToggle = (itemId) => {
    setTagEditorFor((prev) => (prev === itemId ? null : itemId));
    setTagDrafts((prev) => ({ ...prev, [itemId]: prev[itemId] || "" }));
  };

  const handleAddTagToItem = (itemId, value) => {
    const cleanValue = (value ?? "").trim();
    if (!cleanValue) return;
    addTag(itemId, cleanValue);
    setTagDrafts((prev) => ({ ...prev, [itemId]: "" }));
    toast({
      title: "Tag added",
      description: `Tagged "${cleanValue}"`,
    });
  };

  const handleRemoveTagFromItem = (itemId, value) => {
    removeTag(itemId, value);
    toast({
      title: "Tag removed",
      description: `Removed "${value}"`,
    });
  };

  const handleQuickTag = (itemId, value) => {
    handleAddTagToItem(itemId, value);
  };

  const handleClearTagsForItem = (itemId) => {
    clearTags(itemId);
    toast({
      title: "Tags cleared",
      description: "All tags removed from this item.",
    });
  };

  const sortedItems = React.useMemo(() => {
    // If showing deleted items, sort by deletion date (newest deleted first)
    if (showDeletedOnly) {
      const sorted = [...filteredItems].sort((a, b) => {
        if (!a.deleted_at && !b.deleted_at) return 0;
        if (!a.deleted_at) return 1;
        if (!b.deleted_at) return -1;
        const dateA = parseISO(a.deleted_at);
        const dateB = parseISO(b.deleted_at);
        return dateB - dateA; // Newest first
      });
      return sorted;
    }
    
    // Regular sorting for non-deleted items
    return [...filteredItems].sort((a, b) => {
      switch (sort) {
        case "newest":
          return new Date(b.created_date) - new Date(a.created_date);
        case "oldest":
          return new Date(a.created_date) - new Date(b.created_date);
        case "price-high":
          return (b.purchase_price || 0) - (a.purchase_price || 0);
        case "price-low":
          return (a.purchase_price || 0) - (b.purchase_price || 0);
        case "name-az":
          return a.item_name.localeCompare(b.item_name);
        case "name-za":
          return b.item_name.localeCompare(a.item_name);
        case "purchase-newest":
          return new Date(b.purchase_date) - new Date(a.purchase_date);
        case "purchase-oldest":
          return new Date(a.purchase_date) - new Date(b.purchase_date);
        case "return-soon":
          // Sort by return deadline, soonest first (null deadlines go to the end)
          const deadlineA = a.return_deadline ? parseISO(a.return_deadline) : null;
          const deadlineB = b.return_deadline ? parseISO(b.return_deadline) : null;
          if (!deadlineA && !deadlineB) return 0;
          if (!deadlineA) return 1;
          if (!deadlineB) return -1;
          return deadlineA - deadlineB;
        default:
          return 0;
      }
    });
  }, [filteredItems, sort]);

  const handleSelect = (itemId) => {
    setSelectedItems(prev =>
      prev.includes(itemId)
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const handleSelectAll = (checked) => {
    const isChecked = checked === true;
    if (isChecked) {
      setSelectedItems(sortedItems.map((item) => item.id));
    } else {
      setSelectedItems([]);
    }
  };

  const handleDeleteClick = (item) => {
    setItemToDelete(item);
    setDeleteDialogOpen(true);
  };

  // NEW DELETE CONFIRMATION - Clear and immediate
  const confirmDelete = () => {
    if (!itemToDelete) return;
    
    const itemId = itemToDelete.id;
    const itemName = itemToDelete.item_name || 'this item';
    
    // Close dialog immediately
    setDeleteDialogOpen(false);
    setItemToDelete(null);
    
    // Show immediate feedback
    toast({
      title: "🗑️ Deleting Item...",
      description: `Removing "${itemName}" from your inventory...`,
    });
    
    // Trigger delete - optimistic update happens in onMutate
    deleteItemMutation.mutate(itemId);
  };

  const confirmBulkDelete = () => {
    if (selectedItems.length > 0) {
      bulkDeleteMutation.mutate(selectedItems);
    }
  };

  const handleBulkUpdateConfirm = () => {
    const updates = buildBulkUpdatePayload();
    if (selectedItems.length === 0 || Object.keys(updates).length === 0) return;
    bulkUpdateMutation.mutate({ ids: selectedItems, updates });
  };

  const proceedToAddSale = (item, quantity) => {
    const params = new URLSearchParams();
    params.set('inventoryId', item.id);
    params.set('itemName', item.item_name);

    const perItemPrice = item.purchase_price / (item.quantity > 0 ? item.quantity : 1);
    params.set('purchasePrice', perItemPrice.toFixed(2));
    
    params.set('purchaseDate', item.purchase_date);
    if (item.source) params.set('source', item.source);
    if (item.category) params.set('category', item.category);
    if (item.image_url) params.set('imageUrl', item.image_url);
    params.set('inventoryQuantity', item.quantity);
    params.set('soldQuantity', quantity);

    navigate(createPageUrl(`AddSale?${params.toString()}`));
  };

  const handleMarkAsSold = (item) => {
    const availableToSell = item.quantity - (item.quantity_sold || 0);
    if (availableToSell > 1) {
      setItemToSell(item);
      setQuantityToSell(1);
      setQuantityDialogOpen(true);
    } else if (availableToSell === 1) {
      proceedToAddSale(item, 1);
    }
  };

  const handleEbayItemSelect = (inventoryData) => {
    // Navigate to Add Inventory page with pre-filled data
    const params = new URLSearchParams();
    if (inventoryData.item_name) params.set('name', inventoryData.item_name);
    if (inventoryData.purchase_price) params.set('price', inventoryData.purchase_price);
    if (inventoryData.image_url) params.set('imageUrl', inventoryData.image_url);
    if (inventoryData.category) params.set('category', inventoryData.category);
    if (inventoryData.source) params.set('source', inventoryData.source);
    
    navigate(createPageUrl(`AddInventoryItem?${params.toString()}`));
  };

  const handleToggleReturnDeadlineDismiss = (itemId, currentDismissed) => {
    toggleReturnDeadlineDismissMutation.mutate({ 
      itemId, 
      dismissed: !currentDismissed 
    });
  };

  const handleQuantityDialogConfirm = () => {
    const availableToSell = itemToSell.quantity - (itemToSell.quantity_sold || 0);
    if (itemToSell && quantityToSell > 0 && quantityToSell <= availableToSell) {
      proceedToAddSale(itemToSell, quantityToSell);
      setQuantityDialogOpen(false);
      setItemToSell(null);
      setQuantityToSell(1);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 overflow-x-hidden">
      <div className="p-4 md:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto min-w-0">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 min-w-0">
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground break-words">Inventory</h1>
              <p className="text-sm text-muted-foreground mt-1">Track items you have for sale.</p>
            </div>
            <div className="flex flex-wrap gap-2 w-full sm:w-auto min-w-0">
              <Button
                variant="outline"
                onClick={() => setViewMode(viewMode === "list" ? "grid" : "list")}
                className="flex-shrink-0"
              >
                {viewMode === "list" ? <Grid2X2 className="w-4 h-4 mr-2" /> : <Rows className="w-4 h-4 mr-2" />}
                {viewMode === "list" ? "Grid View" : "List View"}
              </Button>
              <Link
                to={createPageUrl("AddInventoryItem")}
                state={returnStateForInventory}
                className="w-full sm:w-auto min-w-0"
              >
                <Button className="bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white shadow-md w-full sm:w-auto">
                  <Plus className="w-5 h-5 mr-2 flex-shrink-0" />
                  Add Item
                </Button>
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg flex-shrink-0">
                  <DollarSign className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Invested</p>
                  <p className="text-xl font-bold text-foreground">${inventorySummary.totalInvested.toFixed(2)}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex-shrink-0">
                  <Package className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Items in Stock</p>
                  <p className="text-xl font-bold text-foreground">{inventorySummary.totalQuantity}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-0 shadow-lg mb-4">
            <CardHeader className="border-b bg-gray-800 dark:bg-gray-800">
              <CardTitle className="text-base sm:text-lg text-white">Filters & Sort</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <Label htmlFor="search" className="text-xs mb-1.5 block">Search</Label>
                  <div className="relative">
                    <Input 
                      id="search"
                      placeholder="Search..." 
                      value={filters.search} 
                      onChange={e => setFilters(f => ({ ...f, search: e.target.value }))} 
                      className="pl-8"
                    />
                    <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  </div>
                </div>
                <div>
                  <Label htmlFor="status" className="text-xs mb-1.5 block">Status</Label>
                  <Select id="status" value={filters.status} onValueChange={val => setFilters(f => ({ ...f, status: val }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="not_sold">In Stock/Listed</SelectItem>
                      <SelectItem value="available">In Stock</SelectItem>
                      <SelectItem value="listed">Listed</SelectItem>
                      <SelectItem value="sold">Sold</SelectItem>
                      <SelectItem value="all">All Items</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="sort" className="text-xs mb-1.5 block">Sort By</Label>
                  <Select id="sort" value={sort} onValueChange={setSort}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                  <SelectItem value="newest">Newest First</SelectItem>
                      <SelectItem value="oldest">Oldest First</SelectItem>
                      <SelectItem value="price-high">Price: High to Low</SelectItem>
                      <SelectItem value="price-low">Price: Low to High</SelectItem>
                      <SelectItem value="name-az">Name: A to Z</SelectItem>
                      <SelectItem value="name-za">Name: Z to A</SelectItem>
                      <SelectItem value="purchase-newest">Purchase: Newest</SelectItem>
                      <SelectItem value="purchase-oldest">Purchase: Oldest</SelectItem>
                      <SelectItem value="return-soon">Return Soon</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 min-w-0">
                <div className="text-xs text-muted-foreground min-w-0 break-words">
                  {showDeletedOnly 
                    ? "Recover deleted items within 30 days. Items older than 30 days are permanently deleted."
                    : "Favorites let you flag items for quick actions such as returns."}
                </div>
                <div className="flex gap-2 flex-wrap min-w-0">
                  <Button
                    variant={showDeletedOnly ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setShowDeletedOnly((prev) => !prev);
                      setShowFavoritesOnly(false); // Disable favorites when showing deleted
                    }}
                    className="flex items-center gap-2 whitespace-nowrap flex-shrink-0"
                  >
                    <Archive className={`w-4 h-4 flex-shrink-0 ${showDeletedOnly ? "" : ""}`} />
                    <span className="truncate">{showDeletedOnly ? "Showing Deleted" : "Show Deleted"}</span>
                    {deletedCount > 0 && (
                      <span className="text-xs font-normal opacity-80 flex-shrink-0">({deletedCount})</span>
                    )}
                  </Button>
                  {!showDeletedOnly && filters.daysInStock === "returnDeadline" && (
                    <Button
                      variant={showDismissedReturns ? "default" : "outline"}
                      size="sm"
                      onClick={() => setShowDismissedReturns((prev) => !prev)}
                      className="flex items-center gap-2 whitespace-nowrap flex-shrink-0"
                    >
                      <AlarmClock className={`w-4 h-4 flex-shrink-0 ${showDismissedReturns ? "" : ""}`} />
                      <span className="truncate">{showDismissedReturns ? "Showing Dismissed" : "Show Dismissed"}</span>
                      {dismissedReturnsCount > 0 && (
                        <span className="text-xs font-normal opacity-80 flex-shrink-0">({dismissedReturnsCount})</span>
                      )}
                    </Button>
                  )}
                  {!showDeletedOnly && (
                    <Button
                      variant={showFavoritesOnly ? "default" : "outline"}
                      size="sm"
                      onClick={() => setShowFavoritesOnly((prev) => !prev)}
                      className="flex items-center gap-2 whitespace-nowrap flex-shrink-0"
                    >
                      <Star className={`w-4 h-4 flex-shrink-0 ${showFavoritesOnly ? "fill-current" : ""}`} />
                      <span className="truncate">{showFavoritesOnly ? "Showing Favorites" : "Show Favorites"}</span>
                      {favoritesCount > 0 && (
                        <span className="text-xs font-normal opacity-80 flex-shrink-0">({favoritesCount})</span>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {(showDeletedOnly || showDismissedReturns) && (
            <div className="sticky top-0 z-40 mb-4 p-4 bg-gradient-to-r from-blue-500 to-indigo-600 dark:from-blue-600 dark:to-indigo-700 text-white rounded-lg shadow-lg border border-blue-400 dark:border-blue-500">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {showDeletedOnly && (
                    <>
                      <Archive className="w-5 h-5 flex-shrink-0" />
                      <span className="font-semibold text-sm sm:text-base">
                        Viewing Deleted Items ({deletedCount})
                      </span>
                    </>
                  )}
                  {showDismissedReturns && !showDeletedOnly && (
                    <>
                      <AlarmClock className="w-5 h-5 flex-shrink-0" />
                      <span className="font-semibold text-sm sm:text-base">
                        Viewing Dismissed Return Reminders ({dismissedReturnsCount})
                      </span>
                    </>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (showDeletedOnly) setShowDeletedOnly(false);
                    if (showDismissedReturns) setShowDismissedReturns(false);
                  }}
                  className="text-white hover:bg-white/20 flex-shrink-0"
                >
                  <X className="w-4 h-4 mr-1" />
                  <span className="hidden sm:inline">Clear Filter</span>
                </Button>
              </div>
            </div>
          )}

          {selectedItems.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg mb-4 min-w-0">
              <span className="text-sm font-medium min-w-0 break-words">
                {selectedItems.length} item{selectedItems.length === 1 ? "" : "s"} selected
              </span>
              <div className="flex flex-wrap gap-2 min-w-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    resetBulkUpdateForm();
                    setBulkUpdateDialogOpen(true);
                  }}
                  disabled={bulkUpdateMutation.isPending}
                  className="whitespace-nowrap flex-shrink-0"
                >
                  <Edit className="w-4 h-4 mr-2 flex-shrink-0" />
                  <span className="truncate">{bulkUpdateMutation.isPending ? "Updating..." : "Bulk Update"}</span>
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setBulkDeleteDialogOpen(true)}
                  disabled={bulkDeleteMutation.isPending}
                  className="whitespace-nowrap flex-shrink-0"
                >
                  <Trash2 className="w-4 h-4 mr-2 flex-shrink-0" />
                  <span className="truncate">{bulkDeleteMutation.isPending ? "Deleting..." : "Delete"}</span>
                </Button>
              </div>
            </div>
          )}

          {sortedItems.length > 0 && (
            <div className="flex items-center gap-3 p-4 bg-gray-800 dark:bg-gray-800 rounded-t-lg">
              <Checkbox
                checked={selectedItems.length === sortedItems.length && sortedItems.length > 0}
                onCheckedChange={handleSelectAll}
                id="select-all"
                className="!h-[22px] !w-[22px] !bg-transparent !border-green-600 border-2 data-[state=checked]:!bg-green-600 data-[state=checked]:!border-green-600 [&[data-state=checked]]:!bg-green-600 [&[data-state=checked]]:!border-green-600 flex-shrink-0 [&_svg]:!h-[16px] [&_svg]:!w-[16px]"
              />
              <div className="flex flex-col">
                <label htmlFor="select-all" className="text-sm font-medium cursor-pointer text-white">
                  Select All ({sortedItems.length})
                </label>
                <span className="text-xs text-gray-400 md:hidden">
                  {viewMode === "list" ? "Tap image to select for bulk edit" : "Tap image to select for bulk edit"}
                </span>
                <span className="text-xs text-gray-400 hidden md:block">Click image to select for bulk edit</span>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="p-12 text-center text-muted-foreground">Loading...</div>
          ) : sortedItems.length > 0 ? (
            viewMode === "list" ? (
              <div className="space-y-6 sm:space-y-6 overflow-x-hidden max-w-full">
                {sortedItems.map(item => {
                  const today = new Date();
                  const deadline = item.return_deadline ? parseISO(item.return_deadline) : null;
                  const daysRemaining = deadline && isAfter(deadline, today) ? differenceInDays(deadline, today) + 1 : null;
                  const perItemPrice = item.purchase_price / (item.quantity > 0 ? item.quantity : 1);
                  const quantitySold = item.quantity_sold || 0;
                  const isSoldOut = quantitySold >= item.quantity;
                  const availableToSell = item.quantity - quantitySold;
                  const itemTags = getTags(item.id);
                  const favoriteMarked = isFavorite(item.id);
                  const isDeleted = item.deleted_at !== null && item.deleted_at !== undefined;
                  
                  let daysUntilPermanentDelete = null;
                  if (isDeleted) {
                    const deletedDate = parseISO(item.deleted_at);
                    const thirtyDaysAfterDelete = new Date(deletedDate);
                    thirtyDaysAfterDelete.setDate(thirtyDaysAfterDelete.getDate() + 30);
                    if (isAfter(thirtyDaysAfterDelete, today)) {
                      daysUntilPermanentDelete = differenceInDays(thirtyDaysAfterDelete, today);
                    }
                  }

                  return (
                    <div 
                      key={item.id} 
                      className={`product-list-item relative flex flex-row flex-wrap sm:flex-nowrap items-stretch sm:items-center mb-6 sm:mb-6 min-w-0 w-full ${isDeleted ? 'opacity-75' : ''} ${selectedItems.includes(item.id) ? 'ring-2 ring-green-500' : ''}`}
                      style={{
                        minHeight: 'auto',
                        height: 'auto',
                        borderRadius: '16px',
                        border: '1px solid rgba(51, 65, 85, 0.6)',
                        background: 'rgb(30, 41, 59)',
                        boxShadow: selectedItems.includes(item.id) ? 'rgba(34, 197, 94, 0.4) 0px 10px 30px -5px' : 'rgba(0, 0, 0, 0.3) 0px 10px 25px -5px',
                        overflow: 'hidden',
                        maxWidth: '100%',
                        width: '100%',
                        boxSizing: 'border-box',
                        flexShrink: 0,
                        paddingBottom: window.innerWidth < 768 ? '2.50rem' : '0'
                      }}
                    >
                      <div className="flex flex-col sm:block flex-shrink-0 m-1 sm:m-4">
                        <div
                          onClick={() => handleSelect(item.id)}
                          className={`md:cursor-default cursor-pointer glass flex items-center justify-center relative w-[130px] sm:w-[220px] min-w-[130px] sm:min-w-[220px] max-w-[130px] sm:max-w-[220px] h-[130px] sm:h-[210px] p-1 sm:p-1 transition-all duration-200 overflow-hidden ${selectedItems.includes(item.id) ? 'opacity-80 shadow-lg shadow-green-500/50' : 'hover:opacity-90 hover:shadow-md'}`}
                          style={{
                            borderRadius: '12px',
                            background: 'rgba(255, 255, 255, 0.1)',
                            border: selectedItems.includes(item.id) ? '2px solid rgba(34, 197, 94, 0.6)' : '1px solid rgba(255, 255, 255, 0.1)',
                            flexShrink: 0
                          }}
                        >
                          {item.images && item.images.length > 1 ? (
                            <ImageCarousel
                              images={item.images.map(img => img.imageUrl || img.url || img)}
                              imageClassName="object-contain rounded-lg"
                              counterPosition="bottom"
                            />
                          ) : (
                            <OptimizedImage
                              src={item.image_url || DEFAULT_IMAGE_URL}
                              alt={item.item_name}
                              fallback={DEFAULT_IMAGE_URL}
                              className="w-full h-full object-contain rounded-lg"
                              style={{ maxHeight: '100%' }}
                              lazy={true}
                            />
                          )}
                          {selectedItems.includes(item.id) && (
                            <div className="absolute top-2 left-2 z-20">
                              <div className="bg-green-600 rounded-full p-1 shadow-lg">
                                <Check className="w-4 h-4 sm:w-2.5 sm:h-2.5 text-white" />
                              </div>
                            </div>
                          )}
                          
                          {/* Desktop link overlay */}
                          <Link
                            to={createPageUrl(`AddInventoryItem?id=${item.id}`)}
                            state={returnStateForInventory}
                            className="hidden sm:block absolute inset-0 z-5"
                          />
                        </div>
                        
                        {/* Mobile: Favorite, Edit Image icons, and Status badge below image */}
                        <div className="md:hidden mt-2">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFavorite(item.id);
                              }}
                              className={`inline-flex h-7 w-7 items-center justify-center rounded-md border border-transparent transition ${
                                favoriteMarked
                                  ? "bg-amber-500/15 text-amber-500 hover:bg-amber-500/25"
                                  : "text-muted-foreground hover:text-amber-500 hover:bg-muted/40"
                              }`}
                            >
                              <Star className={`h-3.5 w-3.5 ${favoriteMarked ? "fill-current" : ""}`} />
                            </button>
                            {item.image_url && item.image_url !== DEFAULT_IMAGE_URL && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditImage(e, item);
                                }}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-transparent transition text-muted-foreground hover:text-blue-400 hover:bg-blue-600/20"
                              >
                                <ImageIcon className="h-3.5 w-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setItemToView(item);
                                setViewDialogOpen(true);
                              }}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-transparent transition text-muted-foreground hover:text-green-400 hover:bg-green-600/20"
                            >
                              <Search className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteItem(item.id);
                              }}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-transparent transition text-muted-foreground hover:text-red-400 hover:bg-red-600/20"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <div className="absolute right-2 top-[140px]">
                            <Badge variant="outline" className={`${statusColors[item.status]} text-[9px] px-1.5 py-0.5`}>
                              {statusLabels[item.status] || statusLabels.available}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      <div className="flex-1 flex flex-col justify-start items-start px-2 sm:px-6 py-2 sm:py-6 sm:border-r min-w-0 overflow-hidden relative"
                        style={{
                          borderColor: 'rgba(51, 65, 85, 0.6)',
                          flexShrink: 1,
                          minWidth: 0
                        }}
                      >
                        <div className="absolute left-0 top-0 w-px h-[130px] sm:h-full bg-slate-600/60"></div>
                        
                        {/* Status badge above title - Desktop only */}
                        <div className="hidden sm:block mb-2">
                          <Badge variant="outline" className={`${statusColors[item.status]} text-[10px] px-1.5 py-0.5`}>
                            {statusLabels[item.status] || statusLabels.available}
                          </Badge>
                        </div>
                        
                        <Link to={createPageUrl(`AddInventoryItem?id=${item.id}`)} state={returnStateForInventory} className="block mb-1 sm:mb-3 w-full text-left">
                          <h3 className="text-sm sm:text-xl font-bold text-white hover:text-blue-400 transition-colors cursor-pointer break-words line-clamp-3 sm:line-clamp-2 text-left"
                            style={{ letterSpacing: '0.3px', lineHeight: '1.35' }}>
                            {item.item_name || 'Untitled Item'}
                          </h3>
                        </Link>

                        <div className="mb-1 sm:hidden space-y-0.5 w-full text-left">
                          <p className="text-gray-300 text-[11px] break-words leading-[14px]">
                            <span className="font-semibold">Qty:</span> {item.quantity}
                            {quantitySold > 0 && (
                              <span className={isSoldOut ? 'text-red-400' : 'text-blue-400'}>
                                {isSoldOut ? ' (Sold Out)' : ` (${quantitySold} sold)`}
                              </span>
                            )}
                          </p>
                          
                          <p className="text-gray-300 text-[11px] break-words leading-[14px] pt-1">
                            <span className="font-semibold">Price:</span> ${item.purchase_price.toFixed(2)}
                            {item.quantity > 1 && (
                              <span className="text-gray-400 text-[10px] ml-1">
                                (${perItemPrice.toFixed(2)} ea)
                              </span>
                            )}
                          </p>
                        </div>

                        <div className="hidden sm:block space-y-1.5 text-xs sm:text-sm mb-2 sm:mb-4 text-gray-300 break-words">
                          <div>
                            <span>Price: </span>
                            <span className="font-medium text-white">
                              ${item.purchase_price.toFixed(2)}
                              {item.quantity > 1 && <span className="text-gray-400 ml-1">(${perItemPrice.toFixed(2)} ea)</span>}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span>Qty: {item.quantity}</span>
                            {quantitySold > 0 && (
                              <span className={`font-medium ${isSoldOut ? 'text-red-400 font-bold' : 'text-blue-400'}`}>
                                {isSoldOut ? '(Sold Out)' : `(${quantitySold} sold)`}
                              </span>
                            )}
                          </div>
                          <div>
                            <span>Purchase Date: </span>
                            <span className="font-medium text-white">
                              {item.purchase_date ? format(parseISO(item.purchase_date), 'MMM dd, yyyy') : '—'}
                            </span>
                          </div>
                          
                          {/* Action icons below Purchase Date - Desktop only */}
                          <div className="flex items-center gap-2 mt-3">
                            <button
                              type="button"
                              onClick={() => toggleFavorite(item.id)}
                              className={`inline-flex h-7 w-7 items-center justify-center rounded-md border border-transparent transition ${
                                favoriteMarked
                                  ? "bg-amber-500/15 text-amber-500 hover:bg-amber-500/25"
                                  : "text-muted-foreground hover:text-amber-500 hover:bg-muted/40"
                              }`}
                            >
                              <Star className={`h-3.5 w-3.5 ${favoriteMarked ? "fill-current" : ""}`} />
                            </button>
                            {item.image_url && item.image_url !== DEFAULT_IMAGE_URL && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditImage(e, item);
                                }}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-transparent transition text-muted-foreground hover:text-blue-400 hover:bg-blue-600/20"
                              >
                                <ImageIcon className="h-3.5 w-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setItemToView(item);
                                setViewDialogOpen(true);
                              }}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-transparent transition text-muted-foreground hover:text-green-400 hover:bg-green-600/20"
                            >
                              <Search className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteItem(item.id);
                              }}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-transparent transition text-muted-foreground hover:text-red-400 hover:bg-red-600/20"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        {itemTags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-2 sm:mb-3">
                            {itemTags.map((tag) => (
                              <Badge key={tag} variant="secondary" className="flex items-center gap-1 text-[9px] sm:text-[11px]">
                                {tag}
                                <button
                                  type="button"
                                  onClick={() => handleRemoveTagFromItem(item.id, tag)}
                                  className="inline-flex h-3 w-3 sm:h-4 sm:w-4 items-center justify-center rounded-full bg-black/10 text-muted-foreground hover:bg-black/20"
                                >
                                  <X className="h-2 w-2 sm:h-3 sm:w-3" />
                                </button>
                              </Badge>
                            ))}
                          </div>
                        )}

                        {isDeleted && daysUntilPermanentDelete !== null && (
                          <div className="mt-2 sm:mt-3 p-2 bg-orange-900/30 border-l-2 border-orange-500 rounded-r text-orange-200">
                            <p className="font-semibold text-xs flex items-center gap-1">
                              <AlarmClock className="w-3 h-3" />
                              {daysUntilPermanentDelete} day{daysUntilPermanentDelete !== 1 ? 's' : ''} until permanent deletion
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="hidden sm:flex flex-col items-center justify-center gap-2 px-3 py-3 mr-0 flex-shrink-0 border-t sm:border-t-0 sm:border-l border-gray-700 w-[200px] min-w-[200px] max-w-[200px]"
                        style={{
                          background: 'rgb(51, 65, 85)',
                          flexShrink: 0
                        }}
                      >
                        {/* Desktop: Mark as Sold button */}
                        {!isSoldOut && item.status !== 'sold' && (
                          <Button
                            onClick={() => handleMarkAsSold(item)}
                            className="w-full text-white font-semibold py-2 px-3 rounded-md text-center transition-all shadow-md leading-tight text-xs bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
                          >
                            Mark as Sold
                          </Button>
                        )}
                        
                        {/* Desktop: View Details button */}
                        <Button
                          onClick={() => {
                            setItemToView(item);
                            setViewDialogOpen(true);
                          }}
                          className={`w-full text-white font-semibold py-2 px-3 rounded-md text-center transition-all shadow-md leading-tight text-xs ${
                            item.status === 'listed' 
                              ? 'bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600' 
                              : 'bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600'
                          }`}
                        >
                          View Details
                        </Button>
                      </div>
                      
                      {/* Mobile: Mark Sold and View Details buttons at bottom */}
                      <div className="md:hidden flex gap-2 px-2 pt-3 mt-5 border-t border-gray-700 w-full -mb-2">
                        {!isSoldOut && item.status !== 'sold' && (
                          <Button
                            onClick={() => handleMarkAsSold(item)}
                            className="flex-1 text-white font-semibold py-2 px-2 rounded-md text-center transition-all shadow-md leading-tight text-[11px] bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
                          >
                            Mark Sold
                          </Button>
                        )}
                        <Button
                          onClick={() => {
                            setItemToView(item);
                            setViewDialogOpen(true);
                          }}
                          className={`flex-1 text-white font-semibold py-2 px-2 rounded-md text-center transition-all shadow-md leading-tight text-[11px] ${
                            item.status === 'listed' 
                              ? 'bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600' 
                              : 'bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600'
                          }`}
                        >
                          View Details
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
              {sortedItems.map(item => {
                const today = new Date();
                const deadline = item.return_deadline ? parseISO(item.return_deadline) : null;
                const daysRemaining = deadline && isAfter(deadline, today) ? differenceInDays(deadline, today) + 1 : null;
                const perItemPrice = item.purchase_price / (item.quantity > 0 ? item.quantity : 1);
                const quantitySold = item.quantity_sold || 0;
                const isSoldOut = quantitySold >= item.quantity;
                const availableToSell = item.quantity - quantitySold;
                const itemTags = getTags(item.id);
                const favoriteMarked = isFavorite(item.id);
                const tagDraftValue = tagDrafts[item.id] ?? "";
                const favoriteButtonLabel = favoriteMarked ? "Remove from favorites" : "Add to favorites";
                
                // Calculate days until permanent deletion for deleted items
                const isDeleted = item.deleted_at !== null && item.deleted_at !== undefined;
                let daysUntilPermanentDelete = null;
                if (isDeleted) {
                  const deletedDate = parseISO(item.deleted_at);
                  const thirtyDaysAfterDelete = new Date(deletedDate);
                  thirtyDaysAfterDelete.setDate(thirtyDaysAfterDelete.getDate() + 30);
                  if (isAfter(thirtyDaysAfterDelete, today)) {
                    daysUntilPermanentDelete = differenceInDays(thirtyDaysAfterDelete, today);
                  }
                }

            const truncatedTitle = (() => {
              const words = (item.item_name || "").split(/\s+/).filter(Boolean);
              if (words.length <= 8) return item.item_name;
              return `${words.slice(0, 8).join(" ")}…`;
            })();

            return (
              <Card 
                key={item.id} 
                className={`group overflow-hidden transition-all duration-300 hover:shadow-2xl hover:scale-[1.02] ${isDeleted ? 'opacity-75 border-2 border-red-300 dark:border-red-700' : 'border-slate-700/50'}`}
                style={{
                  background: 'linear-gradient(135deg, rgb(30, 41, 59) 0%, rgb(51, 65, 85) 100%)',
                  borderRadius: '16px',
                  boxShadow: 'rgba(0, 0, 0, 0.3) 0px 10px 25px -5px',
                }}
              >
                <div className="relative aspect-square overflow-hidden"
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                  }}
                >
                  <div
                    onClick={() => handleSelect(item.id)}
                    className="block w-full h-full cursor-pointer"
                  >
                    {item.images && item.images.length > 1 ? (
                      <ImageCarousel
                        images={item.images.map(img => img.imageUrl || img.url || img)}
                        imageClassName="object-cover rounded-lg"
                      />
                    ) : (
                      <OptimizedImage
                        src={item.image_url || DEFAULT_IMAGE_URL}
                        alt={item.item_name}
                        fallback={DEFAULT_IMAGE_URL}
                        className="w-full h-full object-cover rounded-lg"
                        lazy={true}
                      />
                    )}
                  </div>
                  {selectedItems.includes(item.id) && (
                    <div className="absolute top-2 left-2 z-20">
                      <div className="bg-green-600 rounded-full p-1 shadow-lg">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    </div>
                  )}
                  <div className="absolute bottom-2 right-2 z-10">
                    <Badge variant="outline" className={`${statusColors[item.status]} text-[10px] px-1.5 py-0.5 backdrop-blur-sm`}>
                      {statusLabels[item.status] || statusLabels.available}
                    </Badge>
                  </div>
                </div>

                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <button
                          type="button"
                          onClick={() => toggleFavorite(item.id)}
                          className={`inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent transition ${
                            favoriteMarked
                              ? "bg-amber-500/15 text-amber-500 hover:bg-amber-500/25"
                              : "text-gray-300 hover:text-amber-500 hover:bg-amber-500/10"
                          }`}
                        >
                          <Star className={`h-4 w-4 ${favoriteMarked ? "fill-current" : ""}`} />
                          <span className="sr-only">{favoriteButtonLabel}</span>
                        </button>
                        <div className="flex items-center gap-2">
                          {/* Edit Photo Button */}
                          {item.image_url && item.image_url !== DEFAULT_IMAGE_URL && (
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              className="h-7 px-2 text-xs gap-1 bg-slate-700/50 hover:bg-slate-600/50 text-white border-slate-600"
                              onClick={(e) => handleEditImage(e, item)}
                            >
                              <ImageIcon className="h-3 w-3" />
                              Edit
                            </Button>
                          )}
                          {/* Add Tag Button */}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-xs gap-1 border-slate-600 text-gray-300 hover:bg-slate-700/50"
                            onClick={() => handleTagEditorToggle(item.id)}
                          >
                            <Tag className="h-3.5 w-3.5" />
                            {tagEditorFor === item.id ? "Close" : "Add Tag"}
                          </Button>
                        </div>
                      </div>

                      <Link
                        to={createPageUrl(`AddInventoryItem?id=${item.id}`)}
                        state={returnStateForInventory}
                      >
                        <h3 className="font-bold text-white text-sm mb-3 line-clamp-2 hover:text-blue-400 transition-colors">
                          {item.item_name || 'Untitled Item'}
                        </h3>
                      </Link>
                      
                      <div className="space-y-1.5 text-xs mb-3">
                        <div className="flex justify-between text-gray-300">
                          <span>Price:</span>
                          <span className="font-semibold text-white">
                            ${item.purchase_price.toFixed(2)}
                            {item.quantity > 1 && (
                              <span className="text-gray-400 ml-1">(${perItemPrice.toFixed(2)} ea)</span>
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-gray-300">
                          <span>Qty:</span>
                          <span className="font-semibold text-white">
                            {item.quantity}
                            {quantitySold > 0 && (
                              <span className={`ml-1 ${isSoldOut ? 'text-red-400 font-bold' : 'text-blue-400'}`}>
                                {isSoldOut ? '(Sold Out)' : `(${quantitySold} sold)`}
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between text-gray-300">
                          <span>Purchase Date:</span>
                          <span className="text-white">{item.purchase_date ? format(parseISO(item.purchase_date), 'MMM dd, yyyy') : '—'}</span>
                        </div>
                      </div>

                      {itemTags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {itemTags.map((tag) => (
                            <Badge key={tag} variant="secondary" className="flex items-center gap-1 text-[11px] bg-slate-700/50 text-gray-300 border-slate-600">
                              {tag}
                              <button
                                type="button"
                                onClick={() => handleRemoveTagFromItem(item.id, tag)}
                                className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-black/20 text-gray-400 hover:bg-black/30"
                              >
                                <X className="h-3 w-3" />
                                <span className="sr-only">Remove tag</span>
                              </button>
                            </Badge>
                          ))}
                        </div>
                      )}

                      {tagEditorFor === item.id && (
                        <div className="mb-3 space-y-3 rounded-lg border border-dashed border-muted-foreground/40 bg-muted/40 p-3">
                          <div>
                            <Label className="text-xs mb-1.5 block text-muted-foreground">Add a tag</Label>
                            <div className="flex gap-2">
                              <Input
                                value={tagDraftValue}
                                placeholder="e.g. Return Soon"
                                onChange={(e) =>
                                  setTagDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))
                                }
                              />
                              <Button
                                type="button"
                                size="sm"
                                className="whitespace-nowrap"
                                onClick={() => handleAddTagToItem(item.id, tagDraftValue)}
                              >
                                Add
                              </Button>
                            </div>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-2">Quick tags</p>
                            <div className="flex flex-wrap gap-2">
                              {QUICK_TAGS.map((quickTag) => (
                                <Button
                                  key={quickTag}
                                  type="button"
                                  size="sm"
                                  variant="secondary"
                                  className="h-7 px-2 text-xs"
                                  onClick={() => handleQuickTag(item.id, quickTag)}
                                >
                                  {quickTag}
                                </Button>
                              ))}
                              {itemTags.length > 0 && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 text-xs"
                                  onClick={() => handleClearTagsForItem(item.id)}
                                >
                                  Clear tags
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {daysRemaining !== null && !isDeleted && (
                        <div className="mb-3 p-1.5 bg-red-100 dark:bg-red-900/30 border-l-2 border-red-500 rounded-r text-red-800 dark:text-red-200">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-semibold text-[10px] flex items-center gap-1">
                              <AlarmClock className="w-3 h-3" />
                              {daysRemaining}d to return
                            </p>
                            {filters.daysInStock === "returnDeadline" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleToggleReturnDeadlineDismiss(item.id, item.return_deadline_dismissed);
                                }}
                                className="h-5 px-2 py-0 text-[10px] text-red-700 hover:text-red-900 hover:bg-red-200 dark:text-red-300 dark:hover:text-red-100 dark:hover:bg-red-800"
                              >
                                {item.return_deadline_dismissed ? 'Restore' : 'Dismiss'}
                              </Button>
                            )}
                          </div>
                        </div>
                      )}

                      {isDeleted && daysUntilPermanentDelete !== null && (
                        <div className="mb-3 p-1.5 bg-orange-100 dark:bg-orange-900/30 border-l-2 border-orange-500 rounded-r text-orange-800 dark:text-orange-200">
                          <p className="font-semibold text-[10px] flex items-center gap-1">
                            <AlarmClock className="w-3 h-3" />
                            {daysUntilPermanentDelete} day{daysUntilPermanentDelete !== 1 ? 's' : ''} until permanent deletion
                          </p>
                        </div>
                      )}

                      {isDeleted && daysUntilPermanentDelete === null && (
                        <div className="mb-3 p-1.5 bg-red-100 dark:bg-red-900/30 border-l-2 border-red-500 rounded-r text-red-800 dark:text-red-200">
                          <p className="font-semibold text-[10px]">
                            Will be permanently deleted soon
                          </p>
                        </div>
                      )}

                      <div className="space-y-2">
                        <Button 
                          onClick={() => {
                            setItemToView(item);
                            setViewDialogOpen(true);
                          }}
                          className={`w-full text-white font-semibold text-xs shadow-md ${
                            item.status === 'listed' 
                              ? 'bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600' 
                              : 'bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600'
                          }`}
                        >
                          View Details
                        </Button>
                        {isDeleted ? (
                          <>
                            <Button 
                              onClick={() => recoverItemMutation.mutate(item.id)} 
                              disabled={recoverItemMutation.isPending}
                              className="w-full bg-green-600 hover:bg-green-700 h-8 text-xs"
                            >
                              <ArchiveRestore className="w-3 h-3 mr-1.5" />
                              {recoverItemMutation.isPending ? "Recovering..." : "Recover Item"}
                            </Button>
                            <Button 
                              onClick={() => {
                                setItemToPermanentlyDelete(item);
                                setPermanentDeleteDialogOpen(true);
                              }} 
                              disabled={permanentDeleteMutation.isPending}
                              className="w-full bg-red-600 hover:bg-red-700 h-8 text-xs"
                            >
                              <Trash2 className="w-3 h-3 mr-1.5" />
                              {permanentDeleteMutation.isPending ? "Deleting..." : "Permanently Delete"}
                            </Button>
                          </>
                        ) : (
                          <div className="grid grid-cols-2 gap-2">
                            {!isSoldOut && item.status !== 'sold' && availableToSell > 0 && (
                              <Button 
                                onClick={() => handleMarkAsSold(item)} 
                                className="bg-green-600 hover:bg-green-700 h-8 text-xs"
                              >
                                <ShoppingCart className="w-3 h-3 mr-1" />
                                Mark Sold
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSoldDialogName(item.item_name || "");
                                setSoldDialogOpen(true);
                              }}
                              className="w-full dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700 dark:hover:bg-gray-700 dark:hover:text-white text-xs h-8"
                            >
                              <BarChart className="w-3.5 h-3.5 mr-1" />
                              Search
                            </Button>
                            <Link
                              to={createPageUrl(`AddInventoryItem?id=${item.id}`)}
                              state={returnStateForInventory}
                              className="flex-1"
                            >
                              <Button variant="outline" size="sm" className="w-full h-8 text-xs border-slate-600 text-gray-300 hover:bg-slate-700/50">
                                <Edit className="w-3 h-3 mr-1" />
                                Edit
                              </Button>
                            </Link>
                            {isConnected() && !isSoldOut && item.status !== 'sold' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setItemForFacebookListing(item);
                                  setFacebookListingDialogOpen(true);
                                }}
                                className="h-8 text-xs border-blue-600/50 text-blue-400 hover:text-blue-300 hover:bg-blue-900/20"
                              >
                                <Facebook className="w-3 h-3 mr-1" />
                                List on FB
                              </Button>
                            )}
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => handleDeleteClick(item)} 
                              disabled={deleteItemMutation.isPending && itemToDelete?.id === item.id}
                              className="text-red-400 hover:text-red-300 hover:bg-red-900/20 h-8 text-xs border-red-600/50"
                            >
                              <Trash2 className="w-3 h-3 mr-1" />
                              Delete
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            )
          ) : (
            <div className="text-center py-20">
              <Package className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-muted-foreground text-lg">No inventory items found</p>
              <p className="text-muted-foreground text-sm mt-1">Try adjusting your filters or add a new item.</p>
            </div>
          )}
        </div>
      </div>

      {/* NEW DELETE DIALOG - Clear confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={(open) => {
        setDeleteDialogOpen(open);
        if (!open) setItemToDelete(null);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600 dark:text-red-400">
              🗑️ Delete Inventory Item?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              Are you sure you want to delete <strong>"{itemToDelete?.item_name || 'this item'}"</strong>?
              <br /><br />
              This item will be moved to deleted items and can be recovered within 30 days.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              disabled={deleteItemMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleteItemMutation.isPending ? 'Deleting...' : 'Yes, Delete Item'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* PERMANENT DELETE DIALOG */}
      <AlertDialog open={permanentDeleteDialogOpen} onOpenChange={(open) => {
        setPermanentDeleteDialogOpen(open);
        if (!open) setItemToPermanentlyDelete(null);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600 dark:text-red-400">
              ⚠️ Permanently Delete Item?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              Are you absolutely sure you want to <strong>permanently delete</strong> <strong>"{itemToPermanentlyDelete?.item_name || 'this item'}"</strong>?
              <br /><br />
              <strong className="text-red-600 dark:text-red-400">This action cannot be undone.</strong> The item will be completely removed from your inventory and cannot be recovered.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => permanentDeleteMutation.mutate(itemToPermanentlyDelete?.id)}
              disabled={permanentDeleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {permanentDeleteMutation.isPending ? 'Deleting...' : 'Yes, Permanently Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={bulkUpdateDialogOpen}
        onOpenChange={(open) => {
          setBulkUpdateDialogOpen(open);
          if (!open) resetBulkUpdateForm();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Update Items</DialogTitle>
            <DialogDescription>
              Choose the fields you want to update for the {selectedItems.length} selected item
              {selectedItems.length === 1 ? "" : "s"}. Leave a field blank to keep existing values.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="bulk-status">Status</Label>
              <Select
                value={bulkUpdateForm.status}
                onValueChange={(value) =>
                  setBulkUpdateForm((prev) => ({
                    ...prev,
                    status: value === "__keep" ? "" : value,
                  }))
                }
              >
                <SelectTrigger id="bulk-status">
                  <SelectValue placeholder="Leave unchanged" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__keep">Leave unchanged</SelectItem>
                  <SelectItem value="available">In Stock</SelectItem>
                  <SelectItem value="listed">Listed</SelectItem>
                  <SelectItem value="sold">Sold</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bulk-category">Category</Label>
              <Input
                id="bulk-category"
                value={bulkUpdateForm.category}
                onChange={(e) => setBulkUpdateForm((prev) => ({ ...prev, category: e.target.value }))}
                placeholder="Leave blank to keep current"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bulk-source">Source</Label>
              <Input
                id="bulk-source"
                value={bulkUpdateForm.source}
                onChange={(e) => setBulkUpdateForm((prev) => ({ ...prev, source: e.target.value }))}
                placeholder="Leave blank to keep current"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bulk-purchase-date">Purchase Date</Label>
              <Input
                id="bulk-purchase-date"
                type="date"
                value={bulkUpdateForm.purchase_date}
                onChange={(e) => setBulkUpdateForm((prev) => ({ ...prev, purchase_date: e.target.value }))}
              />
            </div>
          </div>
          {Object.keys(buildBulkUpdatePayload()).length === 0 && (
            <p className="text-xs text-muted-foreground -mt-2">
              Choose at least one field above to enable “Update Items”.
            </p>
          )}
          <DialogFooter className="flex flex-col sm:flex-row sm:justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                resetBulkUpdateForm();
                setBulkUpdateDialogOpen(false);
              }}
              disabled={bulkUpdateMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleBulkUpdateConfirm}
              disabled={
                bulkUpdateMutation.isPending ||
                selectedItems.length === 0 ||
                Object.keys(buildBulkUpdatePayload()).length === 0
              }
            >
              {bulkUpdateMutation.isPending ? "Updating..." : "Update Items"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Multiple Items?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the {selectedItems.length} selected items? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedItems([])}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmBulkDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={bulkDeleteMutation.isPending}
            >
              {bulkDeleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={quantityDialogOpen} onOpenChange={setQuantityDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>How many did you sell?</DialogTitle>
            <DialogDescription>
              You have {itemToSell?.quantity - (itemToSell?.quantity_sold || 0)} of "{itemToSell?.item_name}" available. How many are you marking as sold?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="quantity-to-sell">Quantity Sold</Label>
            <Input
              id="quantity-to-sell"
              type="number"
              min="1"
              max={itemToSell ? itemToSell.quantity - (itemToSell.quantity_sold || 0) : 1}
              value={quantityToSell}
              onChange={(e) => setQuantityToSell(parseInt(e.target.value, 10) || 1)}
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuantityDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleQuantityDialogConfirm}
              className="bg-green-600 hover:bg-green-700"
              disabled={quantityToSell < 1 || quantityToSell > (itemToSell ? itemToSell.quantity - (itemToSell.quantity_sold || 0) : 1)}
            >
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    <Dialog open={!!titlePreview} onOpenChange={(isOpen) => !isOpen && setTitlePreview(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Full Item Title</DialogTitle>
        </DialogHeader>
        <div className="text-sm text-foreground break-words">
          {titlePreview}
        </div>
        <DialogFooter className="pt-4">
          <Button variant="outline" onClick={() => setTitlePreview(null)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

      {/* Image Editor */}
      <ImageEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        imageSrc={imageToEdit.url}
        onSave={handleSaveEditedImage}
        fileName={`${imageToEdit.itemId}-edited.jpg`}
        allImages={imageToEdit.itemId ? (inventoryItems.find(i => i.id === imageToEdit.itemId)?.images || []) : []}
        onApplyToAll={handleApplyFiltersToAll}
        itemId={imageToEdit.itemId}
        onAddImage={async (newImageUrl) => {
          if (!imageToEdit.itemId) return;
          const item = inventoryItems.find(i => i.id === imageToEdit.itemId);
          if (!item) return;
          
          // Add the new image to the item's images array
          const updatedImages = [...(item.images || []), newImageUrl];
          
          try {
            // Update the item with the new images array
            await base44.entities.InventoryItem.update(item.id, {
              images: updatedImages
            });
            
            // Invalidate and refetch inventory items to update the UI
            await queryClient.invalidateQueries({ queryKey: ['inventoryItems'] });
            
            toast({
              title: "Image added",
              description: `New image has been added successfully. Total: ${updatedImages.length} images.`,
            });
            
            // Update the imageToEdit to point to the newly added image
            setImageToEdit({
              url: newImageUrl,
              itemId: imageToEdit.itemId
            });
          } catch (error) {
            console.error('Error adding image:', error);
            toast({
              title: "Error",
              description: "Failed to add image. Please try again.",
              variant: "destructive",
            });
          }
        }}
      />

      {/* Inventory Item View Dialog */}
      {itemToView && (
        <InventoryItemViewDialog
          item={itemToView}
          isOpen={viewDialogOpen}
          onClose={() => {
            setViewDialogOpen(false);
            setItemToView(null);
          }}
          tags={getTags(itemToView.id)}
          isFavorite={isFavorite(itemToView.id)}
        />
      )}

      <SoldLookupDialog
        open={soldDialogOpen}
        onOpenChange={setSoldDialogOpen}
        itemName={soldDialogName}
        onEbaySearch={() => {
          setEbaySearchInitialQuery(soldDialogName || "");
          setEbaySearchDialogOpen(true);
        }}
      />

      <EbaySearchDialog
        open={ebaySearchDialogOpen}
        onOpenChange={setEbaySearchDialogOpen}
        onSelectItem={handleEbayItemSelect}
        initialSearchQuery={ebaySearchInitialQuery}
      />

      <FacebookListingDialog
        open={facebookListingDialogOpen}
        onOpenChange={setFacebookListingDialogOpen}
        item={itemForFacebookListing}
        onSuccess={() => {
          toast({
            title: "Success",
            description: "Item listed on Facebook Marketplace successfully.",
          });
        }}
      />
    </div>
  );
}
