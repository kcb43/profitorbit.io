
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { ChevronDown, Copy, Edit, Trash2, ListChecks, ListX, EyeOff } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { inventoryApi } from "@/api/inventoryApi";

export default function BulkActionsMenu({ selectedItems = [], onActionComplete }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  if (!selectedItems || selectedItems.length === 0) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm" disabled>
            Bulk Actions
            <ChevronDown className="ml-1.5 h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
      </DropdownMenu>
    );
  }

  const handleBulkDelete = async () => {
    setIsProcessing(true);
    try {
      const deletedAt = new Date().toISOString();
      const results = [];
      
      // Soft delete all selected items with verification
      for (const itemId of selectedItems) {
        try {
          await inventoryApi.update(itemId, {
            deleted_at: deletedAt
          });
          // Verify the update was successful
          const updatedItem = await inventoryApi.get(itemId);
          if (!updatedItem.deleted_at) {
            throw new Error("Server did not save deleted_at field");
          }
          results.push({ id: itemId, success: true });
        } catch (error) {
          console.error(`Failed to delete item ${itemId}:`, error);
          results.push({ id: itemId, success: false, error: error.message });
        }
      }

      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;

      // Wait a moment, then refetch to verify server state
      setTimeout(async () => {
        try {
          await queryClient.invalidateQueries({ queryKey: ['inventoryItems'] });
          // Verify all successfully deleted items have deleted_at set on server
          const successfulIds = results.filter(r => r.success).map(r => r.id);
          for (const id of successfulIds) {
            try {
              const updatedItem = await inventoryApi.get(id);
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

      if (onActionComplete) onActionComplete();
      setDeleteDialogOpen(false);
    } catch (error) {
      console.error('Error deleting items:', error);
      toast({
        title: "❌ Delete Failed",
        description: error.message || "Failed to delete items. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkMarkAsNotListed = async () => {
    setIsProcessing(true);
    try {
      const updatePromises = selectedItems.map(itemId =>
        inventoryApi.update(itemId, { status: 'available' })
      );
      await Promise.all(updatePromises);

      toast({
        title: "Items updated",
        description: `${selectedItems.length} item${selectedItems.length === 1 ? '' : 's'} marked as not listed.`,
      });

      queryClient.invalidateQueries(['inventoryItems']);
      if (onActionComplete) onActionComplete();
    } catch (error) {
      console.error('Error updating items:', error);
      toast({
        title: "Error updating items",
        description: error.message || "Failed to update items. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkCopy = async () => {
    setIsProcessing(true);
    try {
      // Fetch items, duplicate them
      const items = await Promise.all(
        selectedItems.map(id => inventoryApi.get(id))
      );

      const copyPromises = items.map(item => {
        const { id, ...itemData } = item;
        return inventoryApi.create({
          ...itemData,
          item_name: `${itemData.item_name || 'Item'} (Copy)`,
        });
      });

      await Promise.all(copyPromises);

      toast({
        title: "Items copied",
        description: `${selectedItems.length} item${selectedItems.length === 1 ? '' : 's'} copied successfully.`,
      });

      queryClient.invalidateQueries(['inventoryItems']);
      if (onActionComplete) onActionComplete();
    } catch (error) {
      console.error('Error copying items:', error);
      toast({
        title: "Error copying items",
        description: error.message || "Failed to copy items. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const comingSoon = (label) =>
    toast({
      title: label,
      description: "This action will be available after marketplace integrations.",
    });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm" disabled={isProcessing}>
            Bulk Actions ({selectedItems.length})
            <ChevronDown className="ml-1.5 h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuItem onClick={() => comingSoon("Delist & Relist")}>
            <ListChecks className="mr-2 h-4 w-4" />
            <span>Delist &amp; Relist</span>
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => comingSoon("Edit Labels")}>
            <Edit className="mr-2 h-4 w-4" />
            <span>Edit Labels</span>
          </DropdownMenuItem>

          <DropdownMenuItem onClick={handleBulkCopy} disabled={isProcessing}>
            <Copy className="mr-2 h-4 w-4" />
            <span>Copy Items</span>
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => setDeleteDialogOpen(true)} disabled={isProcessing}>
            <Trash2 className="mr-2 h-4 w-4" />
            <span>Delete</span>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={() => comingSoon("Delist")} disabled={isProcessing}>
            <ListX className="mr-2 h-4 w-4" />
            <span>Delist</span>
          </DropdownMenuItem>

          <DropdownMenuItem onClick={handleBulkMarkAsNotListed} disabled={isProcessing}>
            <EyeOff className="mr-2 h-4 w-4" />
            <span>Mark as Not Listed</span>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={() => comingSoon("Edit")} disabled={isProcessing}>
            <Edit className="mr-2 h-4 w-4" />
            <span>Edit</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedItems.length} item{selectedItems.length === 1 ? '' : 's'}?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedItems.length} selected item{selectedItems.length === 1 ? '' : 's'}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={isProcessing}
              className="bg-red-600 hover:bg-red-700"
            >
              {isProcessing ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
