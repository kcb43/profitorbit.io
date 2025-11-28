import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { sortSalesByRecency } from "@/utils/sales";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, Trash2, Package, Pencil, Copy, ArchiveRestore, TrendingUp, Zap, CalendarIcon as Calendar, Archive } from "lucide-react";
import { format, parseISO, differenceInDays, endOfDay } from 'date-fns';
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { stripCustomFeeNotes } from "@/utils/customFees";
import { useToast } from "@/components/ui/use-toast";
import { OptimizedImage } from "@/components/OptimizedImage";

const platformIcons = {
  ebay: "https://upload.wikimedia.org/wikipedia/commons/1/1b/EBay_logo.svg",
  facebook_marketplace: "https://upload.wikimedia.org/wikipedia/commons/b/b9/2023_Facebook_icon.svg",
  mercari: "https://cdn.brandfetch.io/idjAt9LfED/w/400/h/400/theme/dark/icon.jpeg?c=1dxbfHSJFAPEGdCLU4o5B",
  etsy: "https://cdn.brandfetch.io/idzyTAzn6G/theme/dark/logo.svg?c=1dxbfHSJFAPEGdCLU4o5B",
  offer_up: "https://cdn.brandfetch.io/id5p1Knwlt/theme/dark/symbol.svg?c=1dxbfHSJFAPEGdCLU4o5B"
};

const platformColors = {
  ebay: "bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100",
  facebook_marketplace: "bg-purple-100 text-purple-800 border-purple-200 hover:bg-purple-100",
  etsy: "bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-100",
  mercari: "bg-pink-100 text-pink-800 border-pink-200 hover:bg-pink-100",
  offer_up: "bg-teal-100 text-teal-800 border-teal-200 hover:bg-teal-100"
};

const platformNames = {
  ebay: "eBay",
  facebook_marketplace: "Facebook",
  etsy: "Etsy",
  mercari: "Mercari",
  offer_up: "OfferUp"
};

// Helper function to determine resale value based on profit/ROI
const getResaleValue = (profit, roi) => {
  if (roi === Infinity || (roi > 0 && profit > 100)) {
    return { label: "High Resale Value", color: "rgb(34, 197, 94)" }; // green-600
  } else if (roi > 50 || profit > 50) {
    return { label: "Medium Resale Value", color: "rgb(20, 141, 250)" }; // blue-500
  } else if (profit > 0) {
    return { label: "Low Resale Value", color: "rgb(251, 146, 60)" }; // orange-400
  } else {
    return { label: "No Profit", color: "rgb(239, 68, 68)" }; // red-500
  }
};

const PREDEFINED_CATEGORIES = [
  "Antiques",
  "Books, Movies & Music",
  "Clothing & Apparel",
  "Collectibles",
  "Electronics",
  "Gym/Workout",
  "Health & Beauty",
  "Home & Garden",
  "Jewelry & Watches",
  "Kitchen",
  "Makeup",
  "Mic/Audio Equipment",
  "Motorcycle",
  "Motorcycle Accessories",
  "Pets",
  "Pool Equipment",
  "Shoes/Sneakers",
  "Sporting Goods",
  "Stereos & Speakers",
  "Tools",
  "Toys & Hobbies",
  "Yoga",
];

export default function SalesHistory() {
  const [filters, setFilters] = useState({
    searchTerm: "",
    platform: "all",
    minProfit: "",
    maxProfit: "",
    startDate: null,
    endDate: null,
  });
  const [sort, setSort] = useState({ by: "sale_date", order: "desc" });

  const [selectedSales, setSelectedSales] = useState([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [saleToDelete, setSaleToDelete] = useState(null);
  const [showDeletedOnly, setShowDeletedOnly] = useState(false);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [permanentDeleteDialogOpen, setPermanentDeleteDialogOpen] = useState(false);
  const [saleToPermanentDelete, setSaleToPermanentDelete] = useState(null);
  const [bulkPermanentDeleteDialogOpen, setBulkPermanentDeleteDialogOpen] = useState(false);
  const [bulkUpdateDialogOpen, setBulkUpdateDialogOpen] = useState(false);
  const [bulkUpdateForm, setBulkUpdateForm] = useState({
    platform: "",
    category: "",
    customCategory: "",
    sale_date: "",
  });
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: rawSales, isLoading } = useQuery({
    queryKey: ['sales'],
    queryFn: () => base44.entities.Sale.list(),
    initialData: [],
  });

  const salesWithMetrics = React.useMemo(() => {
    if (!rawSales) return [];

    const baseSortedSales = sortSalesByRecency(rawSales);

    const salesWithCalculatedMetrics = baseSortedSales.map(sale => {
      const purchasePrice = sale.purchase_price || 0;
      const profit = sale.profit || 0;

      let roi = 0;
      if (purchasePrice > 0) {
        roi = (profit / purchasePrice) * 100;
      } else if (purchasePrice === 0) {
        if (profit > 0) {
          roi = Infinity;
        } else if (profit < 0) {
          roi = -Infinity;
        } else {
          roi = 0;
        }
      }

      const saleDate = parseISO(sale.sale_date);
      const purchaseDate = sale.purchase_date ? parseISO(sale.purchase_date) : null;
      const saleSpeed = purchaseDate ? differenceInDays(saleDate, purchaseDate) : null;

      return { ...sale, profit, roi, saleSpeed };
    });

    if (sort.by === "sale_date") {
      return salesWithCalculatedMetrics;
    }

    return [...salesWithCalculatedMetrics].sort((a, b) => {
      let comparison = 0;
      switch (sort.by) {
        case 'profit':
          comparison = (b.profit || 0) - (a.profit || 0);
          break;
        case 'roi':
          const aRoi = a.roi === Infinity ? Number.MAX_VALUE : (a.roi === -Infinity ? Number.MIN_SAFE_INTEGER : a.roi);
          const bRoi = b.roi === Infinity ? Number.MAX_VALUE : (b.roi === -Infinity ? Number.MIN_SAFE_INTEGER : b.roi);
          comparison = (bRoi || 0) - (aRoi || 0);
          break;
        case 'sale_speed':
          if (a.saleSpeed === null && b.saleSpeed === null) comparison = 0;
          else if (a.saleSpeed === null) comparison = 1;
          else if (b.saleSpeed === null) comparison = -1;
          else comparison = a.saleSpeed - b.saleSpeed;
          break;
        default:
          comparison = 0;
          break;
      }
      
      if (sort.by === 'sale_speed') {
          return comparison;
      }
      
      return comparison;
    });
  }, [rawSales, sort]);

  // Cleanup function to hard delete sales older than 30 days
  const cleanupOldDeletedSales = React.useCallback(async () => {
    if (!Array.isArray(rawSales)) return;
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const salesToHardDelete = rawSales.filter(sale => {
      if (!sale.deleted_at) return false;
      const deletedDate = parseISO(sale.deleted_at);
      return deletedDate < thirtyDaysAgo;
    });

    if (salesToHardDelete.length > 0) {
      try {
        // Update inventory items first
        for (const sale of salesToHardDelete) {
          if (sale.inventory_id) {
            try {
              const inventoryItem = await base44.entities.InventoryItem.get(sale.inventory_id);
              const quantitySoldInSale = sale.quantity_sold || 1;
              const newQuantitySold = Math.max(0, (inventoryItem.quantity_sold || 0) - quantitySoldInSale);
              
              await base44.entities.InventoryItem.update(sale.inventory_id, {
                quantity_sold: newQuantitySold,
                status: newQuantitySold === 0 ? "available" : (newQuantitySold < inventoryItem.quantity ? inventoryItem.status : "sold")
              });
            } catch (error) {
              console.error("Failed to update inventory item on sale cleanup:", error);
            }
          }
        }
        
        // Then hard delete the sales
        await Promise.all(
          salesToHardDelete.map(sale => base44.entities.Sale.delete(sale.id))
        );
        queryClient.invalidateQueries({ queryKey: ['sales'] });
        queryClient.invalidateQueries({ queryKey: ['inventoryItems'] });
      } catch (error) {
        console.error("Error cleaning up old deleted sales:", error);
      }
    }
  }, [rawSales, queryClient]);

  // Run cleanup on mount and when rawSales change
  React.useEffect(() => {
    cleanupOldDeletedSales();
  }, [cleanupOldDeletedSales]);

  // NEW DELETE FUNCTIONALITY FOR SALES - Simple and direct
  const deleteSaleMutation = useMutation({
    mutationFn: async (sale) => {
      const deletedAt = new Date().toISOString();
      console.log("Attempting to soft delete sale:", sale.id, "with deleted_at:", deletedAt);
      
      // First, check if the sale exists and what fields it has
      try {
        const beforeSale = await base44.entities.Sale.get(sale.id);
        console.log("Sale before update:", beforeSale);
        console.log("Sale fields:", Object.keys(beforeSale));
      } catch (e) {
        console.warn("Could not fetch sale before update:", e);
      }
      
      // Soft delete: set deleted_at timestamp
      const updateResult = await base44.entities.Sale.update(sale.id, {
        deleted_at: deletedAt
      });
      console.log("Update response:", updateResult);
      
      // Wait a brief moment for the server to process
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Verify the update was successful by fetching the sale
      let actualDeletedAt = deletedAt;
      try {
        const updatedSale = await base44.entities.Sale.get(sale.id);
        console.log("Sale after update:", updatedSale);
        console.log("Sale fields after update:", Object.keys(updatedSale));
        console.log("deleted_at value:", updatedSale.deleted_at);
        console.log("deletedAt value (camelCase):", updatedSale.deletedAt);
        
        // Check both snake_case and camelCase
        if (!updatedSale.deleted_at && !updatedSale.deletedAt) {
          console.error("Server update failed: deleted_at/deletedAt not set on server", updatedSale);
          throw new Error("Failed to persist deletion - server did not save deleted_at field. The field may not exist in the entity schema. Please check your Base44 entity configuration.");
        }
        
        // Use whichever format was saved
        actualDeletedAt = updatedSale.deleted_at || updatedSale.deletedAt;
      } catch (verifyError) {
        console.error("Failed to verify deletion on server:", verifyError);
        throw new Error("Failed to verify deletion was saved to server: " + verifyError.message);
      }
      
      // Update inventory item quantity
      if (sale.inventory_id) {
        try {
          const inventoryItem = await base44.entities.InventoryItem.get(sale.inventory_id);
          const quantitySoldInSale = sale.quantity_sold || 1;
          const newQuantitySold = Math.max(0, (inventoryItem.quantity_sold || 0) - quantitySoldInSale);
          
          await base44.entities.InventoryItem.update(sale.inventory_id, {
            quantity_sold: newQuantitySold,
            status: newQuantitySold === 0 ? "available" : (newQuantitySold < inventoryItem.quantity ? inventoryItem.status : "sold")
          });
        } catch (error) {
          console.error("Failed to update inventory item on sale deletion:", error);
        }
      }
      
      return { saleId: sale.id, deletedAt: actualDeletedAt };
    },
    onMutate: async (sale) => {
      // IMMEDIATELY update cache - sale disappears right away
      await queryClient.cancelQueries({ queryKey: ['sales'] });
      
      const previousData = queryClient.getQueryData(['sales']);
      const deletedAt = new Date().toISOString();
      
      queryClient.setQueryData(['sales'], (old = []) => {
        return old.map(s => 
          s.id === sale.id ? { ...s, deleted_at: deletedAt } : s
        );
      });
      
      return { previousData };
    },
    onSuccess: async (data, sale) => {
      // Wait a moment, then refetch to verify server state matches our optimistic update
      // This ensures the server has the updated data before we rely on it
      setTimeout(async () => {
        try {
          await queryClient.invalidateQueries({ queryKey: ['sales'] });
          // Update the cache with the verified server data
          const updatedSale = await base44.entities.Sale.get(sale.id);
          if (updatedSale.deleted_at) {
            // Ensure cache has the correct deleted_at value
            queryClient.setQueryData(['sales'], (old = []) => {
              if (!Array.isArray(old)) return old;
              return old.map(s => 
                s.id === sale.id ? { ...s, deleted_at: updatedSale.deleted_at } : s
              );
            });
          }
        } catch (error) {
          console.error("Error verifying deletion on server:", error);
        }
      }, 500);
      
      toast({
        title: "✅ Sale Deleted Successfully",
        description: `"${sale?.item_name || 'Sale'}" has been moved to deleted items. You can recover it within 30 days.`,
      });
      // Only invalidate inventoryItems since we updated quantity_sold
      queryClient.invalidateQueries({ queryKey: ['inventoryItems'] });
      setDeleteDialogOpen(false);
      setSaleToDelete(null);
    },
    onError: (error, sale, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(['sales'], context.previousData);
      }
      toast({
        title: "❌ Delete Failed",
        description: `Failed to delete sale: ${error.message || 'Unknown error'}`,
        variant: "destructive",
      });
      setDeleteDialogOpen(false);
    },
  });

  const recoverSaleMutation = useMutation({
    mutationFn: async (sale) => {
      // Recover: remove deleted_at and restore inventory quantity
      await base44.entities.Sale.update(sale.id, {
        deleted_at: null
      });
      
      // Restore inventory item quantity
      if (sale.inventory_id) {
        try {
          const inventoryItem = await base44.entities.InventoryItem.get(sale.inventory_id);
          const quantitySoldInSale = sale.quantity_sold || 1;
          const newQuantitySold = (inventoryItem.quantity_sold || 0) + quantitySoldInSale;
          
          await base44.entities.InventoryItem.update(sale.inventory_id, {
            quantity_sold: newQuantitySold,
            status: newQuantitySold >= inventoryItem.quantity ? "sold" : inventoryItem.status
          });
        } catch (error) {
          console.error("Failed to update inventory item on sale recovery:", error);
        }
      }
      
      return sale.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['inventoryItems'] });
      toast({
        title: "Sale Restored",
        description: "The sale has been restored to your sales history.",
      });
    },
    onError: (error) => {
      console.error("Failed to recover sale:", error);
      toast({
        title: "Error Restoring Sale",
        description: error.message || "Failed to restore sale. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Permanent delete mutation (hard delete)
  const permanentDeleteSaleMutation = useMutation({
    mutationFn: async (sale) => {
      // First update inventory item quantity if needed
      if (sale.inventory_id) {
        try {
          const inventoryItem = await base44.entities.InventoryItem.get(sale.inventory_id);
          const quantitySoldInSale = sale.quantity_sold || 1;
          const newQuantitySold = Math.max(0, (inventoryItem.quantity_sold || 0) - quantitySoldInSale);
          
          await base44.entities.InventoryItem.update(sale.inventory_id, {
            quantity_sold: newQuantitySold,
            status: newQuantitySold === 0 ? "available" : (newQuantitySold < inventoryItem.quantity ? inventoryItem.status : "sold")
          });
        } catch (error) {
          console.error("Failed to update inventory item on permanent deletion:", error);
        }
      }
      
      // Hard delete the sale
      await base44.entities.Sale.delete(sale.id);
      return sale.id;
    },
    onSuccess: (saleId) => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['inventoryItems'] });
      setPermanentDeleteDialogOpen(false);
      setSaleToPermanentDelete(null);
      toast({
        title: "✅ Sale Permanently Deleted",
        description: "The sale has been permanently deleted and cannot be recovered.",
      });
    },
    onError: (error) => {
      console.error("Failed to permanently delete sale:", error);
      toast({
        title: "❌ Delete Failed",
        description: `Failed to permanently delete sale: ${error.message || 'Unknown error'}`,
        variant: "destructive",
      });
      setPermanentDeleteDialogOpen(false);
    },
  });

  // Bulk permanent delete mutation
  const bulkPermanentDeleteMutation = useMutation({
    mutationFn: async (saleIds) => {
      const salesToDelete = salesWithMetrics.filter(s => saleIds.includes(s.id));
      
      // Update inventory items first
      for (const sale of salesToDelete) {
        if (sale.inventory_id) {
          try {
            const inventoryItem = await base44.entities.InventoryItem.get(sale.inventory_id);
            const quantitySoldInSale = sale.quantity_sold || 1;
            const newQuantitySold = Math.max(0, (inventoryItem.quantity_sold || 0) - quantitySoldInSale);
            
            await base44.entities.InventoryItem.update(sale.inventory_id, {
              quantity_sold: newQuantitySold,
              status: newQuantitySold === 0 ? "available" : (newQuantitySold < inventoryItem.quantity ? inventoryItem.status : "sold")
            });
          } catch (error) {
            console.error("Failed to update inventory item on bulk permanent deletion:", error);
          }
        }
      }
      
      // Hard delete all sales
      await Promise.all(
        saleIds.map(id => base44.entities.Sale.delete(id))
      );
      
      return saleIds;
    },
    onSuccess: (saleIds) => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['inventoryItems'] });
      setSelectedSales([]);
      setBulkPermanentDeleteDialogOpen(false);
      toast({
        title: `✅ ${saleIds.length} Sales Permanently Deleted`,
        description: "Selected sales have been permanently deleted and cannot be recovered.",
      });
    },
    onError: (error) => {
      console.error("Failed to bulk permanently delete sales:", error);
      toast({
        title: "❌ Bulk Delete Failed",
        description: `Failed to permanently delete sales: ${error.message || 'Unknown error'}`,
        variant: "destructive",
      });
      setBulkPermanentDeleteDialogOpen(false);
    },
  });

  // NEW BULK DELETE FOR SALES - Simple and direct
  const bulkDeleteMutation = useMutation({
    mutationFn: async (saleIds) => {
      const salesToDelete = salesWithMetrics.filter(s => saleIds.includes(s.id));
      const deletedAt = new Date().toISOString();
      
      // Soft delete all sales with verification
      await Promise.all(
        saleIds.map(async (id) => {
          await base44.entities.Sale.update(id, { deleted_at: deletedAt });
          // Verify each update
          try {
            const updatedSale = await base44.entities.Sale.get(id);
            if (!updatedSale.deleted_at) {
              console.error(`Server update failed for sale ${id}: deleted_at not set`);
              throw new Error(`Failed to persist deletion for sale ${id}`);
            }
          } catch (verifyError) {
            console.error(`Failed to verify deletion for sale ${id}:`, verifyError);
            throw verifyError;
          }
        })
      );
      
      // Update inventory items
      for (const sale of salesToDelete) {
        if (sale.inventory_id) {
          try {
            const inventoryItem = await base44.entities.InventoryItem.get(sale.inventory_id);
            const quantitySoldInSale = sale.quantity_sold || 1;
            const newQuantitySold = Math.max(0, (inventoryItem.quantity_sold || 0) - quantitySoldInSale);
            
            await base44.entities.InventoryItem.update(sale.inventory_id, {
              quantity_sold: newQuantitySold,
              status: newQuantitySold === 0 ? "available" : (newQuantitySold < inventoryItem.quantity ? inventoryItem.status : "sold")
            });
          } catch (error) {
            console.error("Failed to update inventory item on bulk sale deletion:", error);
          }
        }
      }
      
      return saleIds;
    },
    onMutate: async (saleIds) => {
      // IMMEDIATELY update cache - sales disappear right away
      await queryClient.cancelQueries({ queryKey: ['sales'] });
      
      const previousData = queryClient.getQueryData(['sales']);
      const deletedAt = new Date().toISOString();
      
      queryClient.setQueryData(['sales'], (old = []) => {
        return old.map(s => 
          saleIds.includes(s.id) ? { ...s, deleted_at: deletedAt } : s
        );
      });
      
      // Clear selected sales
      setSelectedSales([]);
      
      return { previousData };
    },
    onSuccess: async (saleIds) => {
      // Wait a moment, then refetch to verify server state matches our optimistic update
      setTimeout(async () => {
        try {
          await queryClient.invalidateQueries({ queryKey: ['sales'] });
          // Verify all sales have deleted_at set on server
          for (const id of saleIds) {
            try {
              const updatedSale = await base44.entities.Sale.get(id);
              if (updatedSale.deleted_at) {
                // Ensure cache has the correct deleted_at value
                queryClient.setQueryData(['sales'], (old = []) => {
                  if (!Array.isArray(old)) return old;
                  return old.map(s => 
                    s.id === id ? { ...s, deleted_at: updatedSale.deleted_at } : s
                  );
                });
              }
            } catch (error) {
              console.error(`Error verifying deletion for sale ${id}:`, error);
            }
          }
        } catch (error) {
          console.error("Error verifying bulk deletion on server:", error);
        }
      }, 500);
      
      // Only invalidate inventoryItems since we updated quantity_sold
      queryClient.invalidateQueries({ queryKey: ['inventoryItems'] });
      setBulkDeleteDialogOpen(false);
      toast({
        title: `✅ ${saleIds.length} Sale${saleIds.length > 1 ? 's' : ''} Deleted`,
        description: `All selected sales have been moved to deleted items. You can recover them within 30 days.`,
      });
    },
    onError: (error, saleIds, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(['sales'], context.previousData);
      }
      toast({
        title: "❌ Bulk Delete Failed",
        description: `Failed to delete sales: ${error.message || 'Unknown error'}`,
        variant: "destructive",
      });
      setBulkDeleteDialogOpen(false);
    },
  });

  const resetBulkUpdateForm = () => {
    setBulkUpdateForm({
      platform: "",
      category: "",
      customCategory: "",
      sale_date: "",
    });
  };

  const buildBulkUpdatePayload = () => {
    const updates = {};
    if (bulkUpdateForm.platform) updates.platform = bulkUpdateForm.platform;
    if (bulkUpdateForm.category) {
      if (bulkUpdateForm.category === "__custom" && bulkUpdateForm.customCategory.trim() !== "") {
        updates.category = bulkUpdateForm.customCategory.trim();
      } else if (bulkUpdateForm.category !== "__custom") {
        updates.category = bulkUpdateForm.category;
      }
    } else if (bulkUpdateForm.customCategory.trim() !== "") {
      updates.category = bulkUpdateForm.customCategory.trim();
    }
    if (bulkUpdateForm.sale_date) updates.sale_date = bulkUpdateForm.sale_date;
    return updates;
  };

  const bulkUpdateMutation = useMutation({
    mutationFn: async ({ ids, updates }) => {
      const results = [];
      for (const id of ids) {
        try {
          await base44.entities.Sale.update(id, updates);
          results.push({ id, success: true });
        } catch (error) {
          results.push({ id, success: false, error: error.message });
        }
      }
      return results;
    },
    onMutate: async ({ ids, updates }) => {
      await queryClient.cancelQueries({ queryKey: ['sales'] });
      const previousSales = queryClient.getQueryData(['sales']);
      queryClient.setQueryData(['sales'], (old = []) => {
        if (!Array.isArray(old)) return old;
        return old.map((sale) => (ids.includes(sale.id) ? { ...sale, ...updates } : sale));
      });
      return { previousSales };
    },
    onError: (error, _variables, context) => {
      console.error("Failed to bulk update sales:", error);
      if (context?.previousSales) {
        queryClient.setQueryData(['sales'], context.previousSales);
      }
      alert("Failed to update selected sales. Please try again.");
    },
    onSuccess: (results) => {
      const successCount = results.filter((r) => r.success).length;
      const failCount = results.length - successCount;
      if (failCount > 0) {
        alert(`Updated ${successCount} sale(s). ${failCount} sale(s) failed.`);
      }
      resetBulkUpdateForm();
      setBulkUpdateDialogOpen(false);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
    },
  });

  const handleAddToInventory = (sale) => {
    const params = new URLSearchParams();
    params.set('itemName', sale.item_name);
    if (sale.purchase_price) params.set('purchasePrice', sale.purchase_price);
    if (sale.purchase_date) params.set('purchaseDate', sale.purchase_date);
    if (sale.source) params.set('source', sale.source);
    if (sale.category) params.set('category', sale.category);
    if (sale.image_url) params.set('imageUrl', sale.image_url);
    const safeNotes = stripCustomFeeNotes(sale.notes || "");
    if (safeNotes) params.set('notes', safeNotes);

    navigate(createPageUrl(`AddInventoryItem?${params.toString()}`));
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const deletedCount = React.useMemo(() => {
    if (!Array.isArray(rawSales)) return 0;
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    return rawSales.filter(sale => {
      if (!sale.deleted_at) return false;
      const deletedDate = parseISO(sale.deleted_at);
      return deletedDate >= thirtyDaysAgo; // Only count sales within 30 days
    }).length;
  }, [rawSales]);

  const filteredSales = React.useMemo(() => {
    return salesWithMetrics.filter(sale => {
      // Filter deleted sales based on showDeletedOnly state
      const deletedMatch = showDeletedOnly 
        ? sale.deleted_at !== null && sale.deleted_at !== undefined
        : !sale.deleted_at;

      // If showing deleted sales, skip other filters except search
      if (showDeletedOnly) {
        const matchesSearch = !filters.searchTerm || 
          (sale.item_name?.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
           sale.category?.toLowerCase().includes(filters.searchTerm.toLowerCase()));
        return deletedMatch && matchesSearch;
      }

      // For non-deleted sales, apply all filters
      if (!deletedMatch) return false;

      const matchesSearch = sale.item_name.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
                           sale.category?.toLowerCase().includes(filters.searchTerm.toLowerCase());
      const matchesPlatform = filters.platform === "all" || sale.platform === filters.platform;

      const profit = sale.profit || 0;
      const matchesMinProfit = filters.minProfit === "" || profit >= parseFloat(filters.minProfit);
      const matchesMaxProfit = filters.maxProfit === "" || profit <= parseFloat(filters.maxProfit);

      const saleDate = parseISO(sale.sale_date);
      const matchesStartDate = !filters.startDate || saleDate >= filters.startDate;
      const matchesEndDate = !filters.endDate || saleDate <= endOfDay(filters.endDate);

      return matchesSearch && matchesPlatform && matchesMinProfit && matchesMaxProfit && matchesStartDate && matchesEndDate;
    });
  }, [salesWithMetrics, showDeletedOnly, filters]);

  const bulkPayloadEmpty = Object.keys(buildBulkUpdatePayload()).length === 0;

  const handleSelect = (saleId) => {
    setSelectedSales(prev =>
      prev.includes(saleId)
        ? prev.filter(id => id !== saleId)
        : [...prev, saleId]
    );
  };

  const handleSelectAll = (checked) => {
    const isChecked = checked === true;
    if (isChecked) {
      setSelectedSales(filteredSales.map((s) => s.id));
    } else {
      setSelectedSales([]);
    }
  };

  // NEW DELETE HANDLER - Clear and immediate
  const handleDeleteClick = (sale) => {
    setSaleToDelete(sale);
    setDeleteDialogOpen(true);
  };

  // NEW DELETE CONFIRMATION - Clear and immediate
  const confirmDeleteSale = () => {
    if (!saleToDelete) return;
    
    const sale = saleToDelete;
    const saleName = sale.item_name || 'this sale';
    
    // Close dialog immediately
    setDeleteDialogOpen(false);
    setSaleToDelete(null);
    
    // Show immediate feedback
    toast({
      title: "🗑️ Deleting Sale...",
      description: `Removing "${saleName}" from your sales history...`,
    });
    
    // Trigger delete - optimistic update happens in onMutate
    deleteSaleMutation.mutate(sale);
  };

  const handleBulkUpdateConfirm = () => {
    const updates = buildBulkUpdatePayload();
    if (selectedSales.length === 0 || Object.keys(updates).length === 0) return;
    bulkUpdateMutation.mutate({ ids: selectedSales, updates });
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 min-h-screen bg-gray-50 dark:bg-gray-900 overflow-x-hidden">
      <div className="max-w-7xl mx-auto min-w-0">
        <div className="mb-8 min-w-0">
          <h1 className="text-3xl font-bold text-foreground break-words">Sales History</h1>
          <p className="text-muted-foreground mt-1 break-words">View and manage all your sales</p>
        </div>

        <Card className="border-0 shadow-lg mb-6">
          <CardHeader className="border-b bg-gray-800 dark:bg-gray-800">
            <CardTitle className="flex items-center gap-2 text-white break-words">
              <Filter className="w-5 h-5 flex-shrink-0" />
              Filters & Sort
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 min-w-0">
              <div className="relative min-w-0">
                <Label htmlFor="search" className="text-xs sm:text-sm mb-1.5 block break-words">Search</Label>
                <Search className="absolute left-3 bottom-2.5 w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground pointer-events-none z-10" />
                <Input
                  id="search"
                  placeholder="Item name or category..."
                  value={filters.searchTerm}
                  onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
                  className="pl-9 sm:pl-10 w-full"
                />
              </div>
              <div className="min-w-0">
                <Label htmlFor="platform" className="text-xs sm:text-sm mb-1.5 block break-words">Platform</Label>
                <Select value={filters.platform} onValueChange={(v) => handleFilterChange('platform', v)}>
                  <SelectTrigger id="platform" className="w-full">
                    <SelectValue placeholder="All Platforms" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Platforms</SelectItem>
                    <SelectItem value="ebay">eBay</SelectItem>
                    <SelectItem value="facebook_marketplace">Facebook</SelectItem>
                    <SelectItem value="etsy">Etsy</SelectItem>
                    <SelectItem value="mercari">Mercari</SelectItem>
                    <SelectItem value="offer_up">OfferUp</SelectItem>
                  </SelectContent>
                </Select>
              </div>
               <div className="grid grid-cols-2 gap-2 min-w-0">
                  <div className="min-w-0">
                    <Label htmlFor="min-profit" className="text-xs sm:text-sm mb-1.5 block break-words">Min Profit</Label>
                    <Input id="min-profit" type="number" placeholder="$ Min" value={filters.minProfit} onChange={e => handleFilterChange('minProfit', e.target.value)} className="w-full" />
                  </div>
                  <div className="min-w-0">
                    <Label htmlFor="max-profit" className="text-xs sm:text-sm mb-1.5 block break-words">Max Profit</Label>
                    <Input id="max-profit" type="number" placeholder="$ Max" value={filters.maxProfit} onChange={e => handleFilterChange('maxProfit', e.target.value)} className="w-full" />
                  </div>
               </div>
               <div className="grid grid-cols-2 gap-2 min-w-0">
                  <div className="min-w-0">
                    <Label className="text-xs sm:text-sm mb-1.5 block break-words">Sale Start Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal text-xs sm:text-sm">
                          <Calendar className="mr-2 h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                          <span className="truncate">{filters.startDate ? format(filters.startDate, "MMM d, yyyy") : "Pick Date"}</span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <CalendarPicker mode="single" selected={filters.startDate} onSelect={d => handleFilterChange('startDate', d)} initialFocus />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="min-w-0">
                    <Label className="text-xs sm:text-sm mb-1.5 block break-words">Sale End Date</Label>
                     <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal text-xs sm:text-sm">
                          <Calendar className="mr-2 h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                          <span className="truncate">{filters.endDate ? format(filters.endDate, "MMM d, yyyy") : "Pick Date"}</span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <CalendarPicker mode="single" selected={filters.endDate} onSelect={d => handleFilterChange('endDate', d)} initialFocus />
                      </PopoverContent>
                    </Popover>
                  </div>
               </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardHeader className="border-b bg-gray-800 dark:bg-gray-800">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 min-w-0">
              {selectedSales.length > 0 ? (
                <>
                  <CardTitle className="text-white break-words">{selectedSales.length} sale(s) selected</CardTitle>
                  <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    <Button
                      variant="outline"
                      onClick={() => {
                        resetBulkUpdateForm();
                        setBulkUpdateDialogOpen(true);
                      }}
                      disabled={bulkUpdateMutation.isPending}
                      className="w-full sm:w-auto"
                    >
                      {bulkUpdateMutation.isPending ? "Updating..." : "Bulk Update"}
                    </Button>
                    {showDeletedOnly ? (
                      <Button
                        variant="destructive"
                        onClick={() => setBulkPermanentDeleteDialogOpen(true)}
                        disabled={bulkPermanentDeleteMutation.isPending}
                        className="w-full sm:w-auto"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        {bulkPermanentDeleteMutation.isPending ? "Permanently Deleting..." : "Permanently Delete Selected"}
                      </Button>
                    ) : (
                      <Button
                        variant="destructive"
                        onClick={() => setBulkDeleteDialogOpen(true)}
                        disabled={bulkDeleteMutation.isPending}
                        className="w-full sm:w-auto"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        {bulkDeleteMutation.isPending ? "Deleting..." : "Delete Selected"}
                      </Button>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <CardTitle className="text-white break-words">
                    {showDeletedOnly ? `Deleted Sales (${filteredSales.length})` : `All Sales (${filteredSales.length})`}
                  </CardTitle>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 min-w-0 w-full sm:w-auto">
                    <Button
                      variant={showDeletedOnly ? "default" : "outline"}
                      size="sm"
                      onClick={() => setShowDeletedOnly((prev) => !prev)}
                      className="flex items-center gap-2 whitespace-nowrap text-xs sm:text-sm"
                    >
                      <Archive className="w-4 h-4" />
                      {showDeletedOnly ? "Showing Deleted" : "Show Deleted"}
                      {deletedCount > 0 && !showDeletedOnly && (
                        <span className="text-xs font-normal opacity-80">({deletedCount})</span>
                      )}
                    </Button>
                    {showDeletedOnly && (
                      <Label htmlFor="sort-by" className="text-xs sm:text-sm font-medium text-white whitespace-nowrap">
                        Sort by:
                      </Label>
                    )}
                    {showDeletedOnly && (
                      <Select value={sort.by} onValueChange={(v) => setSort({ by: v })}>
                        <SelectTrigger id="sort-by" className="w-full sm:w-[180px]">
                          <SelectValue placeholder="Sort by" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sale_date">Most Recent</SelectItem>
                          <SelectItem value="profit">Highest Profit</SelectItem>
                          <SelectItem value="roi">Highest ROI</SelectItem>
                          <SelectItem value="sale_speed">Fastest Sale</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                    {!showDeletedOnly && (
                      <>
                        <Label htmlFor="sort-by" className="text-xs sm:text-sm font-medium text-white whitespace-nowrap">
                          Sort by:
                        </Label>
                        <Select value={sort.by} onValueChange={(v) => setSort({ by: v })}>
                          <SelectTrigger id="sort-by" className="w-full sm:w-[180px]">
                            <SelectValue placeholder="Sort by" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="sale_date">Most Recent</SelectItem>
                            <SelectItem value="profit">Highest Profit</SelectItem>
                            <SelectItem value="roi">Highest ROI</SelectItem>
                            <SelectItem value="sale_speed">Fastest Sale</SelectItem>
                          </SelectContent>
                        </Select>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-x-hidden">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">Loading...</div>
            ) : (
              <div className="w-full min-w-0 max-w-full overflow-x-hidden">
                {filteredSales.length > 0 && (
                  <div className="p-4 sm:p-6 flex items-center gap-3 sm:gap-4 bg-gray-50/50 dark:bg-gray-800/30 min-w-0 mb-4 rounded-lg">
                    <Checkbox
                      checked={selectedSales.length === filteredSales.length && filteredSales.length > 0}
                      onCheckedChange={handleSelectAll}
                      id="select-all"
                      className="!h-[22px] !w-[22px] !bg-transparent !border-green-600 border-2 data-[state=checked]:!bg-green-600 data-[state=checked]:!border-green-600 flex-shrink-0 [&_svg]:!h-[16px] [&_svg]:!w-[16px]"
                    />
                    <label htmlFor="select-all" className="font-medium text-xs sm:text-sm text-foreground cursor-pointer break-words">Select All</label>
                  </div>
                )}
                {filteredSales.length === 0 && (
                  <div className="p-12 text-center">
                    <Package className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground text-base sm:text-lg break-words">No sales found</p>
                    <p className="text-muted-foreground text-xs sm:text-sm mt-1 break-words">
                      {(filters.searchTerm || filters.platform !== "all" || filters.minProfit || filters.maxProfit || filters.startDate || filters.endDate)
                        ? "Try adjusting your filters"
                        : "Start adding sales to see them here"}
                    </p>
                  </div>
                )}
                {filteredSales.map((sale) => {
                  const safeNotes = stripCustomFeeNotes(sale.notes || "");
                  const isDeleted = sale.deleted_at !== null && sale.deleted_at !== undefined;
                  
                  // Calculate days until permanent deletion for deleted sales
                  let daysUntilPermanentDelete = null;
                  if (isDeleted) {
                    const deletedDate = parseISO(sale.deleted_at);
                    const thirtyDaysAfterDelete = new Date(deletedDate);
                    thirtyDaysAfterDelete.setDate(thirtyDaysAfterDelete.getDate() + 30);
                    const today = new Date();
                    if (thirtyDaysAfterDelete > today) {
                      daysUntilPermanentDelete = differenceInDays(thirtyDaysAfterDelete, today);
                    }
                  }

                  const resaleValue = getResaleValue(sale.profit || 0, sale.roi || 0);
                  const totalCosts = ((sale.purchase_price || 0) + (sale.shipping_cost || 0) + (sale.platform_fees || 0) + (sale.other_costs || 0));
                  
                  return (
                  <div key={sale.id} className={`product-list-item relative flex flex-row sm:flex-row items-start sm:items-center mb-4 sm:mb-6 min-w-0 w-full ${isDeleted ? 'opacity-75' : ''}`}
                    style={{
                      minHeight: 'auto',
                      height: 'auto',
                      borderRadius: '16px',
                      border: '1px solid rgba(51, 65, 85, 0.6)',
                      background: 'rgb(30, 41, 59)',
                      boxShadow: 'rgba(0, 0, 0, 0.3) 0px 10px 25px -5px',
                      overflow: 'hidden',
                      maxWidth: '100%'
                    }}>
                    {/* Checkbox - positioned absolutely, right on mobile, left on desktop */}
                    <div className="absolute top-3 right-3 sm:top-4 sm:left-4 sm:right-auto z-20">
                      <Checkbox
                        checked={selectedSales.includes(sale.id)}
                        onCheckedChange={() => handleSelect(sale.id)}
                        id={`select-${sale.id}`}
                        className="!h-[22px] !w-[22px] !bg-transparent !border-green-600 border-2 data-[state=checked]:!bg-green-600 data-[state=checked]:!border-green-600 [&_svg]:!h-[16px] [&_svg]:!w-[16px]"
                      />
                    </div>

                    {/* Product Image Section */}
                    <div className="glass flex items-center justify-center relative flex-shrink-0 m-2 sm:m-4 w-[90px] sm:w-[220px] min-w-[90px] sm:min-w-[220px] h-[90px] sm:h-[210px] p-1.5 sm:p-4"
                      style={{
                        borderRadius: '12px',
                        background: 'rgba(255, 255, 255, 0.1)',
                        border: '1px solid rgba(255, 255, 255, 0.1)'
                      }}>
                      {sale.image_url ? (
                        <OptimizedImage
                          src={sale.image_url}
                          alt={sale.item_name}
                          className="w-full h-full object-contain"
                          style={{ maxHeight: '100%' }}
                          lazy={true}
                        />
                      ) : (
                        <Package className="w-10 h-10 sm:w-24 sm:h-24 text-gray-400" />
                      )}
                      {/* Platform Icon Overlay - hidden on mobile */}
                      {platformIcons[sale.platform] && (
                        <div className="glass absolute top-2 right-2 hidden sm:flex items-center justify-center z-10"
                          style={{
                            width: '43px',
                            height: '55px',
                            borderRadius: '12px',
                            background: 'rgba(255, 255, 255, 0.1)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            padding: '8px'
                          }}>
                          <img 
                            src={platformIcons[sale.platform]} 
                            alt={platformNames[sale.platform]}
                            className="w-6 h-6 object-contain"
                            style={{ filter: sale.platform === 'ebay' ? 'none' : 'brightness(0) invert(1)' }}
                          />
                        </div>
                      )}
                      {/* Profit Badge - Mobile Only, bottom-right of image */}
                      <div className="absolute bottom-0.5 right-0.5 sm:hidden z-10">
                        <div className="px-1.5 py-0.5 rounded text-white text-[10px] font-semibold"
                          style={{
                            background: sale.profit >= 0 ? 'rgba(34, 197, 94, 0.95)' : 'rgba(239, 68, 68, 0.95)',
                            color: 'white',
                            backdropFilter: 'blur(10px)'
                          }}>
                          {sale.profit >= 0 ? '+' : ''}${sale.profit?.toFixed(0) || '0'}
                        </div>
                      </div>
                    </div>

                    {/* Details Section */}
                    <div className="flex-1 flex flex-col justify-between h-full px-2 sm:px-6 py-2 sm:py-6 border-l border-r min-w-0 max-w-full overflow-hidden"
                      style={{
                        borderColor: 'rgba(51, 65, 85, 0.6)'
                      }}>
                      {/* Resale Value Badge - Desktop Only */}
                      <div className="mb-3 hidden sm:block">
                        <div className="glass inline-block px-4 sm:px-6 py-2 rounded-xl text-white text-xs sm:text-sm font-medium"
                          style={{
                            background: resaleValue.color,
                            color: 'white',
                            maxWidth: '100%',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                          {resaleValue.label}
                        </div>
                      </div>

                      {/* Title - Now starts right after image on mobile */}
                      <Link to={createPageUrl(`SoldItemDetail?id=${sale.id}&expandFees=true`)} className="block mb-2 sm:mb-3">
                        <h3 className="text-sm sm:text-xl font-bold text-white hover:text-blue-400 transition-colors cursor-pointer break-words line-clamp-2"
                          style={{ letterSpacing: '0.5px' }}>
                          {sale.item_name || 'Untitled Item'}
                        </h3>
                      </Link>

                      {/* Description/Details */}
                      <p className="text-gray-300 mb-2 sm:mb-4 text-xs sm:text-sm break-words line-clamp-1 sm:line-clamp-2 leading-[18px] sm:leading-[23.8px]"
                        style={{ 
                          letterSpacing: '0.7px'
                        }}>
                        Sold on {format(parseISO(sale.sale_date), 'MMM dd, yyyy')} • ${sale.selling_price?.toFixed(2)}
                        {sale.category && ` • ${sale.category}`}
                        {safeNotes && <span className="hidden sm:inline"> • {safeNotes.substring(0, 50)}{safeNotes.length > 50 ? '...' : ''}</span>}
                      </p>

                      {/* Deletion Warnings */}
                      {isDeleted && daysUntilPermanentDelete !== null && (
                        <div className="mt-3 p-2 bg-orange-900/30 border-l-2 border-orange-500 rounded-r text-orange-200">
                          <p className="font-semibold text-xs flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {daysUntilPermanentDelete} day{daysUntilPermanentDelete !== 1 ? 's' : ''} until permanent deletion
                          </p>
                        </div>
                      )}

                      {isDeleted && daysUntilPermanentDelete === null && (
                        <div className="mt-3 p-2 bg-red-900/30 border-l-2 border-red-500 rounded-r text-red-200">
                          <p className="font-semibold text-xs">
                            Will be permanently deleted soon
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Actions Section */}
                    <div className="flex flex-col items-stretch justify-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-2 sm:py-3 flex-shrink-0 border-t sm:border-t-0 sm:border-l border-gray-700"
                      style={{
                        background: 'rgb(51, 65, 85)',
                        minWidth: 0,
                        width: '100%',
                        maxWidth: '100%'
                      }}>
                      {/* Profit Display - Desktop Only */}
                      <div className="hidden sm:block glass px-3 py-1.5 rounded-xl text-white font-bold text-base text-center border border-gray-700"
                        style={{
                          background: 'rgba(255, 255, 255, 0.1)',
                          borderColor: 'rgb(55, 69, 88)'
                        }}>
                        <span className="font-semibold">Profit: </span>
                        <span className={`${sale.profit >= 0 ? 'text-green-400' : 'text-red-500'}`}>
                          {sale.profit >= 0 ? '+' : ''}${sale.profit?.toFixed(2) || '0.00'}
                        </span>
                      </div>

                      {/* View Details Button */}
                      <Link to={createPageUrl(`SoldItemDetail?id=${sale.id}&expandFees=true`)} className="w-full min-w-0 block">
                        <Button 
                          className="w-full bg-gradient-to-r from-indigo-600 via-indigo-600 to-purple-600 hover:from-indigo-500 hover:via-indigo-600 hover:to-purple-500 text-white font-semibold py-1 sm:py-1.5 px-2 sm:px-3 rounded-lg sm:rounded-xl text-center transition-all duration-300 transform hover:scale-[1.02] active:scale-95 shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40 text-[11px] sm:text-xs min-w-0 max-w-full"
                          style={{ letterSpacing: '0.5px', width: '100%', boxSizing: 'border-box' }}
                        >
                          <span className="flex justify-center items-center gap-1 truncate w-full">
                            View Details
                          </span>
                        </Button>
                      </Link>

                      {/* Action Buttons Row */}
                      <div className="flex items-center justify-center gap-1 sm:gap-1.5 flex-wrap max-w-full w-full">
                        {isDeleted ? (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => recoverSaleMutation.mutate(sale)}
                              disabled={recoverSaleMutation.isPending}
                              className="glass text-green-400 hover:text-green-300 hover:bg-green-900/20 flex-shrink-0 h-7 w-7 sm:h-8 sm:w-8"
                              style={{
                                background: 'rgba(255, 255, 255, 0.1)',
                                borderRadius: '8px',
                                minWidth: '28px',
                                minHeight: '28px'
                              }}
                              title="Recover Sale"
                            >
                              <ArchiveRestore className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setSaleToPermanentDelete(sale);
                                setPermanentDeleteDialogOpen(true);
                              }}
                              disabled={permanentDeleteSaleMutation.isPending}
                              className="glass text-red-400 hover:text-red-300 hover:bg-red-900/20 flex-shrink-0 h-7 w-7 sm:h-8 sm:w-8"
                              style={{
                                background: 'rgba(255, 255, 255, 0.1)',
                                borderRadius: '8px',
                                minWidth: '28px',
                                minHeight: '28px'
                              }}
                              title="Permanently Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Link to={createPageUrl(`AddSale?id=${sale.id}`)} className="flex-shrink-0">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="glass text-blue-400 hover:text-blue-300 hover:bg-blue-900/20 h-7 w-7 sm:h-8 sm:w-8"
                                style={{
                                  background: 'rgba(255, 255, 255, 0.1)',
                                  borderRadius: '8px',
                                  minWidth: '28px',
                                  minHeight: '28px'
                                }}
                                title="Edit"
                              >
                                <Pencil className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                              </Button>
                            </Link>
                            <Link to={createPageUrl(`AddSale?copyId=${sale.id}`)} className="flex-shrink-0">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="glass text-white hover:text-gray-300 hover:bg-gray-700/50 h-7 w-7 sm:h-8 sm:w-8"
                                style={{
                                  background: 'rgba(255, 255, 255, 0.1)',
                                  borderRadius: '8px',
                                  minWidth: '28px',
                                  minHeight: '28px'
                                }}
                                title="Copy"
                              >
                                <Copy className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                              </Button>
                            </Link>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleAddToInventory(sale)}
                              className="glass text-green-400 hover:text-green-300 hover:bg-green-900/20 flex-shrink-0 h-7 w-7 sm:h-8 sm:w-8"
                              style={{
                                background: 'rgba(255, 255, 255, 0.1)',
                                borderRadius: '8px',
                                minWidth: '28px',
                                minHeight: '28px'
                              }}
                              title="Add to Inventory"
                            >
                              <ArchiveRestore className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteClick(sale)}
                              className="glass text-red-400 hover:text-red-300 hover:bg-red-900/20 flex-shrink-0 h-7 w-7 sm:h-8 sm:w-8"
                              style={{
                                background: 'rgba(255, 255, 255, 0.1)',
                                borderRadius: '8px',
                                minWidth: '28px',
                                minHeight: '28px'
                              }}
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )})}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={bulkUpdateDialogOpen}
        onOpenChange={(open) => {
          setBulkUpdateDialogOpen(open);
          if (!open) resetBulkUpdateForm();
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Bulk Update Sales</DialogTitle>
            <DialogDescription>
              Choose the fields you want to update for the {selectedSales.length} selected sale
              {selectedSales.length === 1 ? "" : "s"}. Leave a field blank to keep existing values.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="bulk-platform">Sold On</Label>
              <Select
                value={bulkUpdateForm.platform || "__keep"}
                onValueChange={(value) =>
                  setBulkUpdateForm((prev) => ({
                    ...prev,
                    platform: value === "__keep" ? "" : value,
                  }))
                }
              >
                <SelectTrigger id="bulk-platform">
                  <SelectValue placeholder="Leave unchanged" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__keep">Leave unchanged</SelectItem>
                  <SelectItem value="ebay">eBay</SelectItem>
                  <SelectItem value="facebook_marketplace">Facebook</SelectItem>
                  <SelectItem value="etsy">Etsy</SelectItem>
                  <SelectItem value="mercari">Mercari</SelectItem>
                  <SelectItem value="offer_up">OfferUp</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bulk-category" className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-4 h-4 text-muted-foreground dark:text-muted-foreground">
                  <path fill="currentColor" d="M3 3h4v4H3zM10 3h4v4h-4zM17 3h4v4h-4zM3 10h4v4H3zM10 10h4v4h-4zM17 10h4v4h-4zM3 17h4v4H3zM10 17h4v4h-4zM17 17h4v4h-4z"/>
                </svg>
                Category
              </Label>
              <Select
                value={bulkUpdateForm.category || "__keep"}
                onValueChange={(value) =>
                  setBulkUpdateForm((prev) => ({
                    ...prev,
                    category: value === "__keep" ? "" : value,
                    customCategory:
                      value === "__custom" ? prev.customCategory : "",
                  }))
                }
              >
                <SelectTrigger id="bulk-category">
                  <SelectValue placeholder="Leave unchanged" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__keep">Leave unchanged</SelectItem>
                  {PREDEFINED_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                  <SelectItem value="__custom">Custom...</SelectItem>
                </SelectContent>
              </Select>
              {(bulkUpdateForm.category === "__custom" || bulkUpdateForm.category === "" ) && (
                <Input
                  id="bulk-custom-category"
                  placeholder="Enter custom category"
                  value={bulkUpdateForm.customCategory}
                  onChange={(e) =>
                    setBulkUpdateForm((prev) => ({
                      ...prev,
                      customCategory: e.target.value,
                    }))
                  }
                />
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="bulk-sale-date">Sale Date</Label>
              <Input
                id="bulk-sale-date"
                type="date"
                value={bulkUpdateForm.sale_date}
                onChange={(e) =>
                  setBulkUpdateForm((prev) => ({ ...prev, sale_date: e.target.value }))
                }
              />
            </div>
          </div>
          {bulkPayloadEmpty && (
            <p className="text-xs text-muted-foreground -mt-2">
              Choose at least one field above to enable “Update Sales”.
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
                selectedSales.length === 0 ||
                bulkPayloadEmpty
              }
            >
              {bulkUpdateMutation.isPending ? "Updating..." : "Update Sales"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* NEW DELETE DIALOG FOR SALES - Clear confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={(open) => {
        setDeleteDialogOpen(open);
        if (!open) setSaleToDelete(null);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600 dark:text-red-400">
              🗑️ Delete Sale?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base break-words">
              Are you sure you want to delete the sale for <strong>"{saleToDelete?.item_name || 'this item'}"</strong>?
              <br /><br />
              This sale will be moved to deleted items and can be recovered within 30 days.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteSale}
              disabled={deleteSaleMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleteSaleMutation.isPending ? 'Deleting...' : 'Yes, Delete Sale'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* NEW BULK DELETE DIALOG FOR SALES - Clear confirmation */}
      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600 dark:text-red-400">
              🗑️ Delete {selectedSales.length} Sale{selectedSales.length > 1 ? 's' : ''}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base break-words">
              Are you sure you want to delete <strong>{selectedSales.length} selected sale{selectedSales.length > 1 ? 's' : ''}</strong>?
              <br /><br />
              These sales will be moved to deleted items and can be recovered within 30 days.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setBulkDeleteDialogOpen(false);
                toast({
                  title: `🗑️ Deleting ${selectedSales.length} Sale${selectedSales.length > 1 ? 's' : ''}...`,
                  description: `Removing selected sales from your sales history...`,
                });
                bulkDeleteMutation.mutate(selectedSales);
              }}
              disabled={bulkDeleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {bulkDeleteMutation.isPending ? 'Deleting...' : `Yes, Delete ${selectedSales.length} Sale${selectedSales.length > 1 ? 's' : ''}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Permanent Delete Dialog */}
      <AlertDialog open={permanentDeleteDialogOpen} onOpenChange={setPermanentDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently Delete Sale?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete "{saleToPermanentDelete?.item_name || 'this sale'}"? 
              This action cannot be undone. The sale will be removed from your records forever.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={permanentDeleteSaleMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => permanentDeleteSaleMutation.mutate(saleToPermanentDelete)}
              disabled={permanentDeleteSaleMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {permanentDeleteSaleMutation.isPending ? "Deleting..." : "Permanently Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Permanent Delete Dialog */}
      <AlertDialog open={bulkPermanentDeleteDialogOpen} onOpenChange={setBulkPermanentDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently Delete {selectedSales.length} Sale{selectedSales.length !== 1 ? 's' : ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete {selectedSales.length} selected sale{selectedSales.length !== 1 ? 's' : ''}? 
              This action cannot be undone. These sales will be removed from your records forever.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkPermanentDeleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => bulkPermanentDeleteMutation.mutate(selectedSales)}
              disabled={bulkPermanentDeleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {bulkPermanentDeleteMutation.isPending ? "Deleting..." : `Permanently Delete ${selectedSales.length} Sale${selectedSales.length !== 1 ? 's' : ''}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}