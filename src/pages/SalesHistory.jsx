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
      
      // Soft delete: set deleted_at timestamp
      await base44.entities.Sale.update(sale.id, {
        deleted_at: deletedAt
      });
      
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
      
      return { saleId: sale.id, deletedAt };
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
    onSuccess: (data, sale) => {
      // Don't invalidate - the optimistic update already updated the cache
      // The item should already be filtered out by the filteredSales logic
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
      alert("The sale has been restored.");
    },
    onError: (error) => {
      console.error("Failed to recover sale:", error);
      alert("Failed to recover sale. Please try again.");
    },
  });

  // NEW BULK DELETE FOR SALES - Simple and direct
  const bulkDeleteMutation = useMutation({
    mutationFn: async (saleIds) => {
      const salesToDelete = salesWithMetrics.filter(s => saleIds.includes(s.id));
      const deletedAt = new Date().toISOString();
      
      // Soft delete all sales
      await Promise.all(
        saleIds.map(id => 
          base44.entities.Sale.update(id, { deleted_at: deletedAt })
        )
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
    onSuccess: (saleIds) => {
      // Don't invalidate - the optimistic update already updated the cache
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
                    <Button
                      variant="destructive"
                      onClick={() => setBulkDeleteDialogOpen(true)}
                      disabled={bulkDeleteMutation.isPending}
                      className="w-full sm:w-auto"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      {bulkDeleteMutation.isPending ? "Deleting..." : "Delete Selected"}
                    </Button>
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
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">Loading...</div>
            ) : (
              <div className="divide-y">
                {filteredSales.length > 0 && (
                  <div className="p-4 sm:p-6 flex items-center gap-3 sm:gap-4 bg-gray-50/50 dark:bg-gray-800/30 min-w-0">
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
                  
                  return (
                  <div key={sale.id} className={`flex items-start gap-3 sm:gap-4 p-3 sm:p-6 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors duration-200 min-w-0 ${isDeleted ? 'opacity-75 border-l-4 border-red-300 dark:border-red-700' : ''}`}>
                    <Checkbox
                      checked={selectedSales.includes(sale.id)}
                      onCheckedChange={() => handleSelect(sale.id)}
                      id={`select-${sale.id}`}
                      className="mt-1 !h-[22px] !w-[22px] !bg-transparent !border-green-600 border-2 data-[state=checked]:!bg-green-600 data-[state=checked]:!border-green-600 flex-shrink-0 [&_svg]:!h-[16px] [&_svg]:!w-[16px]"
                    />
                    <div className="flex-1 min-w-0 w-full">
                      <div className="flex flex-col gap-3 sm:gap-4 min-w-0">
                        <div className="flex-1 min-w-0 w-full">
                          <div className="flex flex-col sm:flex-row items-start gap-2 sm:gap-3 mb-2 min-w-0">
                            <Link to={createPageUrl(`SoldItemDetail?id=${sale.id}`)} className="flex-1 min-w-0">
                              <h3 className="font-semibold text-foreground text-base sm:text-lg break-words hover:text-blue-500 dark:hover:text-blue-400 transition-colors cursor-pointer">{sale.item_name}</h3>
                            </Link>
                            <Badge className={`${platformColors[sale.platform]} border flex-shrink-0 text-xs sm:text-sm whitespace-nowrap`}>
                              {platformIcons[sale.platform] && <img src={platformIcons[sale.platform]} alt={platformNames[sale.platform]} className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-1.5 rounded-sm object-contain flex-shrink-0" />}
                              {platformNames[sale.platform]}
                            </Badge>
                          </div>

                          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 text-xs sm:text-sm mb-3 min-w-0">
                            <div className="min-w-0">
                              <p className="text-muted-foreground break-words">Sale Date</p>
                              <p className="font-medium text-foreground break-words">
                                {format(parseISO(sale.sale_date), 'MMM dd, yyyy')}
                              </p>
                            </div>
                            <div className="min-w-0">
                              <p className="text-muted-foreground break-words">Selling Price</p>
                              <p className="font-medium text-foreground break-words">${sale.selling_price?.toFixed(2)}</p>
                            </div>
                            <div className="min-w-0">
                              <p className="text-muted-foreground break-words">Total Costs</p>
                              <p className="font-medium text-foreground break-words">
                                ${((sale.purchase_price || 0) + (sale.shipping_cost || 0) + (sale.platform_fees || 0) + (sale.other_costs || 0)).toFixed(2)}
                              </p>
                            </div>
                            <div className="min-w-0">
                              <p className="text-muted-foreground break-words">Profit</p>
                              <p className={`font-bold text-base sm:text-lg break-words ${sale.profit >= 0 ? 'text-green-400 dark:text-green-400' : 'text-red-600'} ${sale.profit >= 0 ? 'dark:[text-shadow:0_0_6px_rgba(34,197,94,0.5)]' : ''}`}>
                                ${sale.profit?.toFixed(2) || '0.00'}
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 items-center mt-4 min-w-0">
                            <div className="flex flex-wrap items-center gap-x-4 sm:gap-x-5 gap-y-2 text-xs sm:text-sm text-foreground min-w-0">
                              <div className="flex items-center text-foreground min-w-0" title="Return on Investment">
                                <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-blue-500 flex-shrink-0" />
                                <span className="font-semibold whitespace-nowrap text-sm sm:text-base">ROI:</span>
                                <span className="ml-2 font-bold text-blue-600 dark:text-blue-400 break-words text-sm sm:text-lg">
                                  {isFinite(sale.roi) ? `${sale.roi.toFixed(1)}%` : (sale.roi > 0 ? '∞%' : '-∞%')}
                                </span>
                              </div>
                              <div className="flex items-center text-foreground min-w-0" title="Sale Speed">
                                <Zap className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-orange-500 flex-shrink-0" />
                                <span className="font-semibold whitespace-nowrap text-sm sm:text-base">Sold in:</span>
                                <span className="ml-2 font-bold text-orange-600 dark:text-orange-400 break-words text-sm sm:text-lg">
                                  {sale.saleSpeed !== null ? `${sale.saleSpeed} day(s)` : 'N/A'}
                                </span>
                              </div>
                              {sale.category && (
                                <p className="break-words min-w-0 text-sm sm:text-base">
                                  <span className="font-semibold">Category:</span> {sale.category}
                                </p>
                              )}
                            </div>

                          {(sale.image_url || safeNotes) && (
                            <div className="flex flex-col md:flex-col md:items-end md:gap-3 gap-2 sm:gap-3">
                              {sale.image_url && (
                                <img
                                  src={sale.image_url}
                                  alt={sale.item_name}
                                  className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 lg:w-36 lg:h-36 object-cover rounded-md border flex-shrink-0"
                                />
                              )}
                              {safeNotes && (
                                <p className="italic text-sm sm:text-base text-foreground md:max-w-xs md:text-right">
                                  <span className="font-medium not-italic">Notes:</span> "{safeNotes}"
                                </p>
                              )}
                            </div>
                          )}
                          </div>
                        </div>

                        {isDeleted && daysUntilPermanentDelete !== null && (
                          <div className="mb-3 p-2 bg-orange-100 dark:bg-orange-900/30 border-l-2 border-orange-500 rounded-r text-orange-800 dark:text-orange-200">
                            <p className="font-semibold text-xs flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {daysUntilPermanentDelete} day{daysUntilPermanentDelete !== 1 ? 's' : ''} until permanent deletion
                            </p>
                          </div>
                        )}

                        {isDeleted && daysUntilPermanentDelete === null && (
                          <div className="mb-3 p-2 bg-red-100 dark:bg-red-900/30 border-l-2 border-red-500 rounded-r text-red-800 dark:text-red-200">
                            <p className="font-semibold text-xs">
                              Will be permanently deleted soon
                            </p>
                          </div>
                        )}

                        <div className="flex flex-wrap items-center justify-start md:justify-end gap-1 sm:gap-2 md:gap-[10.4px] min-w-0 w-full border-t border-gray-200 dark:border-gray-700 pt-3">
                          {isDeleted ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => recoverSaleMutation.mutate(sale)}
                              disabled={recoverSaleMutation.isPending}
                              className="text-green-500 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20 flex-shrink-0 h-8 w-8 sm:h-10 sm:w-10 md:h-[52px] md:w-[52px]"
                              title="Recover Sale"
                            >
                              <ArchiveRestore className="w-4 h-4 sm:w-5 sm:h-5 md:w-[26px] md:h-[26px]" />
                            </Button>
                          ) : (
                            <>
                              <Link to={createPageUrl(`AddSale?id=${sale.id}`)} className="flex-shrink-0">
                                <Button variant="ghost" size="icon" className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 h-8 w-8 sm:h-10 sm:w-10 md:h-[52px] md:w-[52px]">
                                  <Pencil className="w-4 h-4 sm:w-5 sm:h-5 md:w-[26px] md:h-[26px]" />
                                </Button>
                              </Link>
                              <Link to={createPageUrl(`AddSale?copyId=${sale.id}`)} className="flex-shrink-0">
                                <Button variant="ghost" size="icon" className="text-foreground hover:text-foreground/80 hover:bg-muted/50 h-8 w-8 sm:h-10 sm:w-10 md:h-[52px] md:w-[52px]">
                                  <Copy className="w-4 h-4 sm:w-5 sm:h-5 md:w-[26px] md:h-[26px]" />
                                </Button>
                              </Link>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleAddToInventory(sale)}
                                className="text-green-500 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20 flex-shrink-0 h-8 w-8 sm:h-10 sm:w-10 md:h-[52px] md:w-[52px]"
                              >
                                <ArchiveRestore className="w-4 h-4 sm:w-5 sm:h-5 md:w-[26px] md:h-[26px]" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteClick(sale)}
                                className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 flex-shrink-0 h-8 w-8 sm:h-10 sm:w-10 md:h-[52px] md:w-[52px]"
                              >
                                <Trash2 className="w-4 h-4 sm:w-5 sm:h-5 md:w-[26px] md:h-[26px]" />
                              </Button>
                            </>
                          )}
                        </div>
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
    </div>
  );
}