import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { sortSalesByRecency } from "@/utils/sales";
import { salesApi } from "@/api/salesApi";
import { inventoryApi } from "@/api/inventoryApi";
import { splitBase44Tags } from "@/utils/base44Notes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, Trash2, Package, Pencil, Copy, ArchiveRestore, TrendingUp, Zap, CalendarIcon as Calendar, Archive, Check, X, Grid2X2, Rows, Link2 } from "lucide-react";
import { format, parseISO, differenceInDays, endOfDay, isAfter } from 'date-fns';
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
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/api/supabaseClient";

import ebayLogo from "@/assets/ebay-logo.svg";
import facebookLogo from "@/assets/facebook-logo.svg";
import amazonLogo from "@/assets/amazon-logo.svg";

const platformIcons = {
  ebay: ebayLogo,
  facebook_marketplace: facebookLogo,
  amazon: amazonLogo,
  mercari: "https://cdn.brandfetch.io/idjAt9LfED/w/400/h/400/theme/dark/icon.jpeg?c=1dxbfHSJFAPEGdCLU4o5B",
  etsy: "https://cdn.brandfetch.io/idzyTAzn6G/theme/dark/logo.svg?c=1dxbfHSJFAPEGdCLU4o5B",
  offer_up: "https://cdn.brandfetch.io/id5p1Knwlt/theme/dark/symbol.svg?c=1dxbfHSJFAPEGdCLU4o5B"
};

const platformColors = {
  ebay: "bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100",
  facebook_marketplace: "bg-purple-100 text-purple-800 border-purple-200 hover:bg-purple-100",
  amazon: "bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-100",
  etsy: "bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-100",
  mercari: "bg-pink-100 text-pink-800 border-pink-200 hover:bg-pink-100",
  offer_up: "bg-teal-100 text-teal-800 border-teal-200 hover:bg-teal-100"
};

const platformNames = {
  ebay: "eBay",
  facebook_marketplace: "Facebook",
  amazon: "Amazon",
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
    category: "all",
    minProfit: "",
    maxProfit: "",
    startDate: null,
    endDate: null,
    needsReview: false,
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
  const [viewMode, setViewMode] = useState("grid"); // "list" or "grid" (grid = inventory-style rows)
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [pageSize, setPageSize] = useState(50);
  const [pageIndex, setPageIndex] = useState(0);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [saleToLink, setSaleToLink] = useState(null);
  const [linkSearch, setLinkSearch] = useState("");

  // Mobile-only: keep Sales History in Grid view (no List view on mobile)
  React.useEffect(() => {
    if (isMobile && viewMode !== "grid") setViewMode("grid");
  }, [isMobile, viewMode]);

  async function apiGetJson(path) {
    // Wait briefly for Supabase session hydration.
    let session = null;
    for (let i = 0; i < 8; i++) {
      // eslint-disable-next-line no-await-in-loop
      const res = await supabase.auth.getSession();
      session = res?.data?.session || null;
      if (session?.access_token) break;
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 150));
    }

    const headers = {
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      ...(session?.user?.id ? { 'x-user-id': session.user.id } : {}),
    };

    const resp = await fetch(path, { headers });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(err.error || `HTTP ${resp.status}`);
    }
    return resp.json();
  }

  const salesFields = React.useMemo(() => ([
    'id',
    'inventory_id',
    'item_name',
    'purchase_date',
    'sale_date',
    'platform',
    'source',
    'category',
    'quantity_sold',
    'shipping_cost',
    'platform_fees',
    'vat_fees',
    'other_costs',
    'profit',
    'notes',
    'image_url',
    'deleted_at',
    'selling_price',
    'sale_price',
    'purchase_price',
    'created_at',
  ].join(',')), []);

  // Reset paging when filters change.
  useEffect(() => {
    setPageIndex(0);
  }, [
    filters.searchTerm,
    filters.platform,
    filters.category,
    filters.minProfit,
    filters.maxProfit,
    filters.startDate,
    filters.endDate,
    filters.needsReview,
    showDeletedOnly,
    pageSize,
  ]);

  const { data: salesPage, isLoading } = useQuery({
    queryKey: ['sales', 'salesHistory', pageIndex, pageSize, filters, showDeletedOnly],
    queryFn: async () => {
      const qs = new URLSearchParams();
      qs.set('paged', 'true');
      qs.set('count', 'true');
      qs.set('sort', '-sale_date');
      qs.set('limit', String(pageSize));
      qs.set('offset', String(pageIndex * pageSize));
      qs.set('fields', salesFields);

      if (showDeletedOnly) qs.set('deleted_only', 'true');
      else qs.set('include_deleted', 'false');

      // NOTE: needs_review uses an OR filter on the server; don't combine it with searchTerm (also uses OR).
      if (!filters.needsReview && filters.searchTerm?.trim()) qs.set('search', filters.searchTerm.trim());
      if (filters.platform && filters.platform !== 'all') qs.set('platform', filters.platform);
      if (filters.category && filters.category !== 'all') qs.set('category', filters.category);
      if (filters.minProfit !== '') qs.set('min_profit', String(filters.minProfit));
      if (filters.maxProfit !== '') qs.set('max_profit', String(filters.maxProfit));
      if (filters.startDate) qs.set('from', filters.startDate.toISOString().slice(0, 10));
      if (filters.endDate) qs.set('to', filters.endDate.toISOString().slice(0, 10));
      if (filters.needsReview) qs.set('needs_review', 'true');

      return apiGetJson(`/api/sales?${qs.toString()}`);
    },
    placeholderData: { data: [], total: 0, limit: pageSize, offset: 0 },
  });

  const isNeedsReviewSale = React.useCallback((sale) => {
    // Keep this consistent with the server's needs_review filter:
    // focus on missing purchase_date/source/category (NOT inventory_id).
    return (
      !sale?.purchase_date ||
      !sale?.source ||
      !sale?.category
    );
  }, []);

  const isMissingInventoryLink = React.useCallback((sale) => {
    return !sale?.inventory_id;
  }, []);

  const { data: needsReviewCountPage } = useQuery({
    queryKey: ['sales', 'salesHistory', 'needsReviewCount', showDeletedOnly],
    enabled: !showDeletedOnly,
    queryFn: async () => {
      const qs = new URLSearchParams();
      qs.set('paged', 'true');
      qs.set('count', 'true');
      qs.set('limit', '1');
      qs.set('offset', '0');
      qs.set('fields', 'id');
      qs.set('include_deleted', 'false');
      qs.set('needs_review', 'true');
      return apiGetJson(`/api/sales?${qs.toString()}`);
    },
    placeholderData: { data: [], total: 0, limit: 1, offset: 0 },
    staleTime: 30_000,
  });
  const needsReviewTotal = Number.isFinite(Number(needsReviewCountPage?.total)) ? Number(needsReviewCountPage.total) : 0;

  const inventoryLinkFields = React.useMemo(
    () => ['id', 'item_name', 'purchase_date', 'source', 'category', 'image_url', 'deleted_at', 'status'].join(','),
    []
  );
  const { data: linkInventoryPage, isLoading: isLoadingLinkInventory } = useQuery({
    queryKey: ['inventoryItems', 'salesHistory', 'link', saleToLink?.id, linkSearch],
    enabled: linkDialogOpen && !!saleToLink,
    queryFn: async () => {
      const term = (linkSearch || saleToLink?.item_name || '').trim();
      const qs = new URLSearchParams();
      qs.set('paged', 'true');
      qs.set('count', 'true');
      qs.set('limit', '25');
      qs.set('offset', '0');
      qs.set('fields', inventoryLinkFields);
      qs.set('include_deleted', 'false');
      if (term) qs.set('search', term);
      return apiGetJson(`/api/inventory?${qs.toString()}`);
    },
    placeholderData: { data: [], total: 0, limit: 25, offset: 0 },
  });
  const linkInventoryResults = React.useMemo(() => linkInventoryPage?.data || [], [linkInventoryPage]);

  const linkSaleToInventoryMutation = useMutation({
    mutationFn: async ({ sale, inventoryItem }) => {
      const patch = {
        inventory_id: inventoryItem.id,
      };
      if (!sale.purchase_date && inventoryItem.purchase_date) patch.purchase_date = inventoryItem.purchase_date;
      if (!sale.source && inventoryItem.source) patch.source = inventoryItem.source;
      if (!sale.category && inventoryItem.category) patch.category = inventoryItem.category;
      await salesApi.update(sale.id, patch);
      return patch;
    },
    onSuccess: () => {
      toast({
        title: '✅ Linked sale to inventory',
        description: 'Updated inventory link + backfilled missing fields where possible.',
      });
      setLinkDialogOpen(false);
      setSaleToLink(null);
      setLinkSearch('');
      queryClient.invalidateQueries({ queryKey: ['sales', 'salesHistory'] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
    },
    onError: (error) => {
      toast({
        title: '❌ Failed to link sale',
        description: error.message || 'Please try again.',
        variant: 'destructive',
      });
    },
  });

  const rawSales = React.useMemo(() => salesPage?.data || [], [salesPage]);
  const totalSales = Number.isFinite(Number(salesPage?.total)) ? Number(salesPage.total) : 0;
  const totalPages = Math.max(1, Math.ceil(totalSales / pageSize));
  const canPrev = pageIndex > 0;
  const canNext = pageIndex + 1 < totalPages;

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
              const inventoryItem = await inventoryApi.get(sale.inventory_id);
              const quantitySoldInSale = sale.quantity_sold || 1;
              const newQuantitySold = Math.max(0, (inventoryItem.quantity_sold || 0) - quantitySoldInSale);
              
              await inventoryApi.update(sale.inventory_id, {
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
          salesToHardDelete.map(sale => salesApi.delete(sale.id, true))
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
        const beforeSale = await salesApi.get(sale.id);
        console.log("Sale before update:", beforeSale);
        console.log("Sale fields:", Object.keys(beforeSale));
      } catch (e) {
        console.warn("Could not fetch sale before update:", e);
      }
      
      // Soft delete: set deleted_at timestamp
      const updateResult = await salesApi.update(sale.id, {
        deleted_at: deletedAt
      });
      console.log("Update response:", updateResult);
      
      // Wait a brief moment for the server to process
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Verify the update was successful by fetching the sale
      let actualDeletedAt = deletedAt;
      try {
        const updatedSale = await salesApi.get(sale.id);
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
          const inventoryItem = await inventoryApi.get(sale.inventory_id);
          const quantitySoldInSale = sale.quantity_sold || 1;
          const newQuantitySold = Math.max(0, (inventoryItem.quantity_sold || 0) - quantitySoldInSale);
          
          await inventoryApi.update(sale.inventory_id, {
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
          const updatedSale = await salesApi.get(sale.id);
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
      await salesApi.update(sale.id, {
        deleted_at: null
      });
      
      // Restore inventory item quantity
      if (sale.inventory_id) {
        try {
          const inventoryItem = await inventoryApi.get(sale.inventory_id);
          const quantitySoldInSale = sale.quantity_sold || 1;
          const newQuantitySold = (inventoryItem.quantity_sold || 0) + quantitySoldInSale;
          
          await inventoryApi.update(sale.inventory_id, {
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
          const inventoryItem = await inventoryApi.get(sale.inventory_id);
          const quantitySoldInSale = sale.quantity_sold || 1;
          const newQuantitySold = Math.max(0, (inventoryItem.quantity_sold || 0) - quantitySoldInSale);
          
          await inventoryApi.update(sale.inventory_id, {
            quantity_sold: newQuantitySold,
            status: newQuantitySold === 0 ? "available" : (newQuantitySold < inventoryItem.quantity ? inventoryItem.status : "sold")
          });
        } catch (error) {
          console.error("Failed to update inventory item on permanent deletion:", error);
        }
      }
      
      // Hard delete the sale
      await salesApi.delete(sale.id, true);
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
            const inventoryItem = await inventoryApi.get(sale.inventory_id);
            const quantitySoldInSale = sale.quantity_sold || 1;
            const newQuantitySold = Math.max(0, (inventoryItem.quantity_sold || 0) - quantitySoldInSale);
            
            await inventoryApi.update(sale.inventory_id, {
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
        saleIds.map(id => salesApi.delete(id, true))
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
          await salesApi.update(id, { deleted_at: deletedAt });
          // Verify each update
          try {
            const updatedSale = await salesApi.get(id);
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
            const inventoryItem = await inventoryApi.get(sale.inventory_id);
            const quantitySoldInSale = sale.quantity_sold || 1;
            const newQuantitySold = Math.max(0, (inventoryItem.quantity_sold || 0) - quantitySoldInSale);
            
            await inventoryApi.update(sale.inventory_id, {
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
              const updatedSale = await salesApi.get(id);
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
          await salesApi.update(id, updates);
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
    setFilters((prev) => {
      if (key === 'needsReview') {
        const nextNeeds = value === true || value === 'true';
        return {
          ...prev,
          needsReview: nextNeeds,
          // needs_review uses OR server-side; keep semantics clean by clearing searchTerm.
          ...(nextNeeds ? { searchTerm: '' } : {}),
        };
      }
      return { ...prev, [key]: value };
    });
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
        const term = (filters.searchTerm || '').toLowerCase();
        const matchesSearch = !term || 
          (sale.item_name?.toLowerCase().includes(term) ||
           sale.category?.toLowerCase().includes(term) ||
           sale.source?.toLowerCase().includes(term));
        return deletedMatch && matchesSearch;
      }

      // For non-deleted sales, apply all filters
      if (!deletedMatch) return false;

      const term = (filters.searchTerm || '').toLowerCase();
      const matchesSearch = !term ||
        sale.item_name?.toLowerCase().includes(term) ||
        sale.category?.toLowerCase().includes(term) ||
        sale.source?.toLowerCase().includes(term);
      const matchesPlatform = filters.platform === "all" || sale.platform === filters.platform;
      const matchesCategory =
        filters.category === 'all'
          ? true
          : filters.category === '__uncategorized'
          ? !sale.category
          : sale.category === filters.category;
      const matchesNeedsReview = !filters.needsReview || isNeedsReviewSale(sale);

      const profit = sale.profit || 0;
      const matchesMinProfit = filters.minProfit === "" || profit >= parseFloat(filters.minProfit);
      const matchesMaxProfit = filters.maxProfit === "" || profit <= parseFloat(filters.maxProfit);

      const saleDate = parseISO(sale.sale_date);
      const matchesStartDate = !filters.startDate || saleDate >= filters.startDate;
      const matchesEndDate = !filters.endDate || saleDate <= endOfDay(filters.endDate);

      return matchesSearch && matchesPlatform && matchesCategory && matchesNeedsReview && matchesMinProfit && matchesMaxProfit && matchesStartDate && matchesEndDate;
    });
  }, [salesWithMetrics, showDeletedOnly, filters, isNeedsReviewSale]);

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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 overflow-x-hidden w-full" style={{ width: '100%', maxWidth: '100vw', overflowX: 'hidden' }}>
      <div className="p-4 md:p-6 lg:p-8 w-full" style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
        <div className="max-w-7xl mx-auto min-w-0 w-full" style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
        <div className="mb-8 min-w-0 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground break-words">Sales History</h1>
            <p className="text-muted-foreground mt-1 break-words">View and manage all your sales</p>
          </div>
          {!isMobile && (
            <Button
              variant="outline"
              onClick={() => setViewMode(viewMode === "list" ? "grid" : "list")}
              className="flex-shrink-0"
            >
              {viewMode === "list" ? <Grid2X2 className="w-4 h-4 mr-2" /> : <Rows className="w-4 h-4 mr-2" />}
              {viewMode === "list" ? "Grid View" : "List View"}
            </Button>
          )}
        </div>

        <Card className="border-0 shadow-lg mb-6">
          <CardHeader className="border-b bg-gray-50 dark:bg-gray-800">
            <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white break-words">
              <Filter className="w-5 h-5 flex-shrink-0" />
              Filters & Sort
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4">
              <div className="text-xs text-muted-foreground">
                Showing <span className="font-semibold text-foreground">{rawSales.length}</span>
                {totalSales ? (
                  <>
                    {" "}
                    of <span className="font-semibold text-foreground">{totalSales}</span>
                  </>
                ) : null}
                {" "}sales
                {" "}• page <span className="font-semibold text-foreground">{pageIndex + 1}</span>
                {" "}of <span className="font-semibold text-foreground">{totalPages}</span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Label className="text-xs text-muted-foreground">Per page</Label>
                <Select
                  value={String(pageSize)}
                  onValueChange={(v) => {
                    const n = Number(v);
                    if (n === 50 || n === 100 || n === 200) setPageSize(n);
                  }}
                >
                  <SelectTrigger className="h-9 w-[110px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                    <SelectItem value="200">200</SelectItem>
                  </SelectContent>
                </Select>

                <Button
                  variant="outline"
                  disabled={!canPrev}
                  onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
                  className="h-9"
                >
                  Prev
                </Button>
                <Button
                  variant="outline"
                  disabled={!canNext}
                  onClick={() => setPageIndex((p) => p + 1)}
                  className="h-9"
                >
                  Next
                </Button>

                <Button
                  variant="outline"
                  className="h-9"
                  onClick={() => {
                    const qs = new URLSearchParams();
                    // Match current filters; export up to 5000 rows.
                    if (showDeletedOnly) qs.set('deleted_only', 'true');
                    else qs.set('include_deleted', 'false');
                    if (!filters.needsReview && filters.searchTerm?.trim()) qs.set('search', filters.searchTerm.trim());
                    if (filters.platform && filters.platform !== 'all') qs.set('platform', filters.platform);
                    if (filters.category && filters.category !== 'all') qs.set('category', filters.category);
                    if (filters.minProfit !== '') qs.set('min_profit', String(filters.minProfit));
                    if (filters.maxProfit !== '') qs.set('max_profit', String(filters.maxProfit));
                    if (filters.startDate) qs.set('from', filters.startDate.toISOString().slice(0, 10));
                    if (filters.endDate) qs.set('to', filters.endDate.toISOString().slice(0, 10));
                    if (filters.needsReview) qs.set('needs_review', 'true');
                    qs.set('limit', '5000');
                    window.open(`/api/sales/export?${qs.toString()}`, '_blank');
                  }}
                >
                  Export CSV
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 min-w-0">
              <div className="relative min-w-0">
                <Label htmlFor="search" className="text-xs sm:text-sm mb-1.5 block break-words">Search</Label>
                <Search className="absolute left-3 bottom-2.5 w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground pointer-events-none z-10" />
                <Input
                  id="search"
                  placeholder={filters.needsReview ? "Needs Review enabled (search disabled)" : "Item name, category, source..."}
                  value={filters.searchTerm}
                  onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
                  disabled={filters.needsReview}
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
              <div className="min-w-0">
                <Label htmlFor="category" className="text-xs sm:text-sm mb-1.5 block break-words">Category</Label>
                <Select value={filters.category} onValueChange={(v) => handleFilterChange('category', v)}>
                  <SelectTrigger id="category" className="w-full">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="__uncategorized">Uncategorized</SelectItem>
                    {PREDEFINED_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
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

            <div className="mt-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="needs-review"
                  checked={filters.needsReview}
                  onCheckedChange={(v) => handleFilterChange('needsReview', v)}
                />
                <Label htmlFor="needs-review" className="text-xs sm:text-sm text-foreground">
                  Needs Review (missing inventory link / purchase date / source / category)
                </Label>
              </div>
              {!showDeletedOnly && needsReviewTotal > 0 && (
                <Button
                  variant={filters.needsReview ? "default" : "outline"}
                  size="sm"
                  className="whitespace-nowrap text-xs sm:text-sm"
                  onClick={() => handleFilterChange('needsReview', !filters.needsReview)}
                >
                  {filters.needsReview ? "Showing Needs Review" : `Review (${needsReviewTotal})`}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg w-full min-w-0 max-w-full overflow-x-hidden">
          <CardHeader className="border-b bg-gray-50 dark:bg-gray-800">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 min-w-0">
              {selectedSales.length > 0 ? (
                <>
                  <CardTitle className="text-gray-900 dark:text-white break-words">{selectedSales.length} sale(s) selected</CardTitle>
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
              <div className="w-full min-w-0 max-w-full overflow-x-hidden" style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box', overflowX: 'hidden' }}>
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
                {viewMode === "grid" ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                    {filteredSales.map((sale) => {
                      const safeNotes = splitBase44Tags(stripCustomFeeNotes(sale.notes || "")).clean;
                      const isDeleted = sale.deleted_at !== null && sale.deleted_at !== undefined;
                      const resaleValue = getResaleValue(sale.profit || 0, sale.roi || 0);
                      
                      let daysUntilPermanentDelete = null;
                      if (isDeleted) {
                        const deletedDate = parseISO(sale.deleted_at);
                        const thirtyDaysAfterDelete = new Date(deletedDate);
                        thirtyDaysAfterDelete.setDate(thirtyDaysAfterDelete.getDate() + 30);
                        if (isAfter(thirtyDaysAfterDelete, new Date())) {
                          daysUntilPermanentDelete = differenceInDays(thirtyDaysAfterDelete, new Date());
                        }
                      }

                      return (
                        <Card 
                          key={sale.id} 
                          className={`group overflow-hidden transition-all duration-300 hover:shadow-2xl hover:scale-[1.02] bg-gradient-to-br from-white to-gray-50 dark:from-slate-800 dark:to-slate-700 ${isDeleted ? 'opacity-75 border-2 border-red-300 dark:border-red-700' : 'border-gray-200 dark:border-slate-700/50'} shadow-sm dark:shadow-lg`}
                          style={{
                            borderRadius: '16px',
                          }}
                        >
                          <div className="relative">
                            <div 
                              onClick={() => handleSelect(sale.id)}
                              className={`relative aspect-square overflow-hidden cursor-pointer transition-all duration-200 bg-gray-50 dark:bg-slate-900/50 ${selectedSales.includes(sale.id) ? 'ring-2 ring-green-500 ring-offset-2' : ''}`}
                            >
                              {sale.image_url ? (
                                <OptimizedImage
                                  src={sale.image_url}
                                  alt={sale.item_name}
                                  className="w-full h-full object-cover"
                                  lazy={true}
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Package className="w-16 h-16 text-gray-400" />
                                </div>
                              )}
                              {selectedSales.includes(sale.id) && (
                                <div className="absolute top-2 left-2 z-20">
                                  <div className="bg-green-600 rounded-full p-1 shadow-lg">
                                    <Check className="w-4 h-4 text-white" />
                                  </div>
                                </div>
                              )}
                              {platformIcons[sale.platform] && (
                                <div className="absolute top-2 right-2 z-10 bg-white/90 backdrop-blur-sm rounded-lg p-1.5 border border-gray-200 shadow-md">
                                  <img 
                                    src={platformIcons[sale.platform]} 
                                    alt={platformNames[sale.platform]}
                                    className="w-5 h-5 object-contain"
                                    style={{ filter: sale.platform === 'ebay' ? 'none' : 'none' }}
                                  />
                                </div>
                              )}
                              <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                                <div className="px-2 py-1 rounded-lg text-white text-xs font-semibold backdrop-blur-sm"
                                  style={{
                                    background: resaleValue.color,
                                  }}>
                                  {resaleValue.label}
                                </div>
                                <div className={`px-2 py-1 rounded-lg text-white text-xs font-bold backdrop-blur-sm ${sale.profit >= 0 ? 'bg-green-600/90' : 'bg-red-600/90'}`}>
                                  {sale.profit >= 0 ? '+' : ''}${sale.profit?.toFixed(0) || '0'}
                                </div>
                              </div>
                            </div>
                          </div>
                          <CardContent className="p-4">
                            <Link to={createPageUrl(`SoldItemDetail?id=${sale.id}&expandFees=true`)}>
                              <h3 className="font-bold text-gray-900 dark:text-white text-sm mb-2 line-clamp-2 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                                {sale.item_name || 'Untitled Item'}
                              </h3>
                            </Link>
                            <div className="space-y-1.5 text-xs mb-3">
                              <div className="flex justify-between text-gray-700 dark:text-gray-300">
                                <span>Sold Price:</span>
                                <span className="font-semibold text-gray-900 dark:text-white">${sale.selling_price?.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between text-gray-700 dark:text-gray-300">
                                <span>Date:</span>
                                <span className="text-gray-900 dark:text-white">{format(parseISO(sale.sale_date), 'MM/dd/yyyy')}</span>
                              </div>
                              <div className="flex justify-between text-gray-700 dark:text-gray-300">
                                <span>Profit:</span>
                                <span className={`font-bold ${sale.profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                  {sale.profit >= 0 ? '+' : ''}${sale.profit?.toFixed(2) || '0.00'}
                                </span>
                              </div>
                            </div>
                            {isDeleted && daysUntilPermanentDelete !== null && (
                              <div className="mb-3 p-2 bg-orange-100 border-l-2 border-orange-500 rounded-r text-orange-800 text-xs">
                                <p className="font-semibold flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {daysUntilPermanentDelete} day{daysUntilPermanentDelete !== 1 ? 's' : ''} until deletion
                                </p>
                              </div>
                            )}
                            <Link to={createPageUrl(`SoldItemDetail?id=${sale.id}&expandFees=true`)} className="block">
                              <Button 
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-sm"
                              >
                                View Details
                              </Button>
                            </Link>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                ) : (
                  <div>
                    {filteredSales.map((sale) => {
                      const safeNotes = splitBase44Tags(stripCustomFeeNotes(sale.notes || "")).clean;
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
                    <div key={sale.id} className="w-full max-w-full">
                      {/* Mobile/Tablet list layout (unchanged) */}
                      <div className={`lg:hidden product-list-item relative flex flex-row flex-wrap sm:flex-nowrap items-stretch sm:items-center mb-6 sm:mb-6 min-w-0 w-full max-w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700/50 shadow-sm dark:shadow-lg ${isDeleted ? 'opacity-75' : ''}`}
                      style={{
                        minHeight: 'auto',
                        height: 'auto',
                        borderRadius: '16px',
                        overflow: 'hidden',
                        maxWidth: '100%',
                        width: '100%',
                        boxSizing: 'border-box',
                        flexShrink: 0
                      }}>
                    {/* Image and Description Container - Mobile stacked, desktop side-by-side */}
                    <div className="flex flex-col sm:block flex-shrink-0 m-1 sm:m-4">
                      {/* Product Image Section - Clickable */}
                      <div 
                        onClick={() => handleSelect(sale.id)}
                        className={`glass flex items-center justify-center relative w-[130px] sm:w-[220px] min-w-[130px] sm:min-w-[220px] max-w-[130px] sm:max-w-[220px] h-[130px] sm:h-[210px] p-1 sm:p-4 cursor-pointer transition-all duration-200 bg-gray-50 dark:bg-slate-900/50 border ${selectedSales.includes(sale.id) ? 'border-green-500 dark:border-green-500 opacity-80 shadow-lg shadow-green-500/50' : 'border-gray-200 dark:border-slate-700/50 hover:opacity-90 hover:shadow-md'}`}
                        style={{
                          borderRadius: '12px',
                          flexShrink: 0
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
                          <Package className="w-8 h-8 sm:w-24 sm:h-24 text-gray-400" />
                        )}
                        {/* Platform Icon Overlay - hidden on mobile */}
                        {platformIcons[sale.platform] && (
                          <div className="glass absolute top-2 right-2 hidden sm:flex items-center justify-center z-10 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 shadow-md"
                            style={{
                              width: '43px',
                              height: '55px',
                              borderRadius: '12px',
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
                        {/* Selection Indicator - Top center when selected */}
                        {selectedSales.includes(sale.id) && (
                          <div className="absolute top-0.5 left-1/2 transform -translate-x-1/2 z-20">
                            <div className="bg-green-600 rounded-full p-0.5 shadow-lg">
                              <Check className="w-2.5 h-2.5 text-white" />
                            </div>
                          </div>
                        )}
                      {/* Profit Badge - Mobile Only, bottom-right of image */}
                      <div className="absolute bottom-0.5 right-0.5 sm:hidden z-10">
                        <div className="px-1 py-0.5 rounded text-white text-[8px] font-semibold"
                          style={{
                            background: sale.profit >= 0 ? 'rgba(34, 197, 94, 0.95)' : 'rgba(239, 68, 68, 0.95)',
                            color: 'white',
                            backdropFilter: 'blur(10px)'
                          }}>
                          {sale.profit >= 0 ? '+' : ''}${sale.profit?.toFixed(0) || '0'}
                        </div>
                      </div>
                      </div>
                    </div>

                    {/* Details Section */}
                    <div className="flex-1 flex flex-col justify-start px-1.5 sm:px-6 py-1 sm:py-6 border-r min-w-0 overflow-hidden relative"
                      style={{
                        borderColor: 'rgba(229, 231, 235, 0.8)',
                        flexShrink: 1,
                        minWidth: 0
                      }}>
                      {/* Vertical Divider - Centered on mobile */}
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-px h-[60%] sm:h-full sm:top-0 sm:translate-y-0 bg-gray-300"></div>
                      {/* Resale Value Badge - Desktop Only */}
                      <div className="mb-2 sm:mb-3 hidden sm:block">
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
                      <Link to={createPageUrl(`SoldItemDetail?id=${sale.id}&expandFees=true`)} className="block mb-0.5 sm:mb-3">
                        <h3 className="text-xs sm:text-xl font-bold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer break-words line-clamp-3 sm:line-clamp-2"
                          style={{ letterSpacing: '0.5px', lineHeight: '1.25' }}>
                          {sale.item_name || 'Untitled Item'}
                        </h3>
                      </Link>

                      {/* Sold Price - Under title on mobile */}
                      <div className="mb-0 sm:hidden">
                        <p className="text-gray-700 dark:text-gray-300 text-[9px] break-words leading-[12px]"
                          style={{ letterSpacing: '0.4px' }}>
                          <span className="font-semibold">Sold Price:</span> ${sale.selling_price?.toFixed(2)}
                        </p>
                      </div>

                      {/* Date - Under sold price on mobile */}
                      <div className="mb-0.5 sm:hidden">
                        <p className="text-gray-700 dark:text-gray-300 text-[9px] break-words leading-[12px]"
                          style={{ letterSpacing: '0.4px' }}>
                          {format(parseISO(sale.sale_date), 'MM/dd/yyyy')}
                        </p>
                      </div>

                      {/* Description/Details - Desktop only (mobile shows under image and under title) */}
                      <p className="hidden sm:block text-gray-700 dark:text-gray-300 mb-2 sm:mb-4 text-xs sm:text-sm break-words line-clamp-1 sm:line-clamp-2 leading-[18px] sm:leading-[23.8px]"
                        style={{ 
                          letterSpacing: '0.7px'
                        }}>
                        Sold {format(parseISO(sale.sale_date), 'MM/dd/yyyy')} • ${sale.selling_price?.toFixed(2)}
                        {safeNotes && <span className="hidden sm:inline"> • {safeNotes.substring(0, 50)}{safeNotes.length > 50 ? '...' : ''}</span>}
                      </p>

                      {/* Deletion Warnings */}
                      {isDeleted && daysUntilPermanentDelete !== null && (
                        <div className="mt-3 p-2 bg-orange-100 border-l-2 border-orange-500 rounded-r text-orange-800">
                          <p className="font-semibold text-xs flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {daysUntilPermanentDelete} day{daysUntilPermanentDelete !== 1 ? 's' : ''} until permanent deletion
                          </p>
                        </div>
                      )}

                      {isDeleted && daysUntilPermanentDelete === null && (
                        <div className="mt-3 p-2 bg-red-100 border-l-2 border-red-500 rounded-r text-red-800">
                          <p className="font-semibold text-xs">
                            Will be permanently deleted soon
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Actions Section */}
                    <div className="flex flex-col items-center justify-center gap-1 sm:gap-2 px-1 sm:px-3 py-1 sm:py-3 mr-1.5 sm:mr-0 flex-shrink-0 border-t sm:border-t-0 sm:border-l border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/80 w-[75px] sm:w-[200px] min-w-[75px] sm:min-w-[200px] max-w-[75px] sm:max-w-[200px]"
                      style={{
                        flexShrink: 0
                      }}>
                      {/* Profit Display - Desktop Only */}
                      <div className="hidden sm:block glass px-3 py-1.5 rounded-xl font-bold text-base text-center border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white">
                        <span className="font-semibold">Profit: </span>
                        <span className={`${sale.profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {sale.profit >= 0 ? '+' : ''}${sale.profit?.toFixed(2) || '0.00'}
                        </span>
                      </div>

                      {/* View Details Button */}
                      <Link to={createPageUrl(`SoldItemDetail?id=${sale.id}&expandFees=true`)} className="w-full min-w-0 flex justify-center">
                        <Button 
                          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-0.5 sm:py-1.5 px-1 sm:px-3 rounded-md sm:rounded-xl text-center transition-all duration-200 active:scale-95 shadow-md text-[7px] sm:text-xs"
                          style={{ letterSpacing: '0.3px', fontSize: '7px', width: 'auto', minWidth: '60px', maxWidth: '70px', boxSizing: 'border-box' }}
                        >
                          <span className="whitespace-nowrap">
                            <span className="sm:hidden">Details</span>
                            <span className="hidden sm:inline">View Details</span>
                          </span>
                        </Button>
                      </Link>

                      {/* Action Buttons Row */}
                      <div className="flex items-center justify-center gap-1 sm:gap-1.5 flex-wrap max-w-full w-full mx-auto">
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
                                className="glass text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-700 h-7 w-7 sm:h-8 sm:w-8"
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
                            {(isNeedsReviewSale(sale) || isMissingInventoryLink(sale)) && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setSaleToLink(sale);
                                  setLinkSearch(sale?.item_name || "");
                                  setLinkDialogOpen(true);
                                }}
                                className="glass text-amber-500 hover:text-amber-400 hover:bg-amber-900/10 flex-shrink-0 h-7 w-7 sm:h-8 sm:w-8"
                                style={{
                                  background: 'rgba(255, 255, 255, 0.1)',
                                  borderRadius: '8px',
                                  minWidth: '28px',
                                  minHeight: '28px'
                                }}
                                title="Link to Inventory"
                              >
                                <Link2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                              </Button>
                            )}
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

                      {/* Desktop list layout (new) */}
                      <div
                        className={`hidden lg:block product-list-item group relative overflow-hidden rounded-2xl border border-gray-200/80 dark:border-slate-700/60 bg-white/80 dark:bg-slate-900/70 shadow-sm dark:shadow-lg backdrop-blur supports-[backdrop-filter]:bg-white/60 mb-4 ${isDeleted ? 'opacity-75' : ''} ${selectedSales.includes(sale.id) ? 'ring-2 ring-green-500' : ''}`}
                      >
                        <div className="grid grid-cols-[168px_1fr_260px] min-w-0">
                          {/* Image */}
                          <div className="p-4">
                            <div
                              onClick={() => handleSelect(sale.id)}
                              className={`relative overflow-hidden rounded-xl border bg-gray-50 dark:bg-slate-900/40 flex items-center justify-center cursor-pointer transition ${
                                selectedSales.includes(sale.id)
                                  ? "border-green-500 shadow-lg shadow-green-500/20"
                                  : "border-gray-200/80 dark:border-slate-700/60 hover:border-gray-300 dark:hover:border-slate-600"
                              }`}
                              style={{ height: 140 }}
                              title="Click image to select"
                            >
                              {sale.image_url ? (
                                <OptimizedImage
                                  src={sale.image_url}
                                  alt={sale.item_name}
                                  className="w-full h-full object-contain"
                                  lazy={true}
                                />
                              ) : (
                                <Package className="w-10 h-10 text-gray-400" />
                              )}

                              {platformIcons[sale.platform] && (
                                <div className="absolute top-2 right-2 rounded-lg bg-white/90 dark:bg-slate-900/80 border border-gray-200/70 dark:border-slate-700/60 p-1.5 shadow-sm">
                                  <img
                                    src={platformIcons[sale.platform]}
                                    alt={platformNames[sale.platform]}
                                    className="w-5 h-5 object-contain"
                                  />
                                </div>
                              )}

                              {selectedSales.includes(sale.id) && (
                                <div className="absolute top-2 left-2 z-20">
                                  <div className="bg-green-600 rounded-full p-1 shadow-lg">
                                    <Check className="w-4 h-4 text-white" />
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Details */}
                          <div className="min-w-0 border-l border-r border-gray-200/70 dark:border-slate-700/60 px-5 py-4">
                            <div className="flex items-center justify-between gap-3 mb-3">
                              <div className="flex items-center gap-2 min-w-0">
                                <div
                                  className="inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-semibold text-white"
                                  style={{ background: resaleValue.color }}
                                  title="Resale value"
                                >
                                  {resaleValue.label}
                                </div>
                                <div className="text-xs text-muted-foreground truncate">
                                  {platformNames[sale.platform] || "—"} • {format(parseISO(sale.sale_date), "MMM d, yyyy")}
                                </div>
                              </div>

                              <div className="text-sm font-bold tabular-nums">
                                <span className="text-muted-foreground text-xs font-semibold mr-2">Profit</span>
                                <span className={`${(sale.profit || 0) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                  {(sale.profit || 0) >= 0 ? '+' : ''}${(sale.profit || 0).toFixed(2)}
                                </span>
                              </div>
                            </div>

                            <Link to={createPageUrl(`SoldItemDetail?id=${sale.id}&expandFees=true`)} className="block mb-2">
                              <h3 className="text-base font-bold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors break-words line-clamp-2">
                                {sale.item_name || "Untitled Item"}
                              </h3>
                            </Link>

                            <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-muted-foreground text-xs font-semibold">Sold</span>
                                <span className="font-bold text-gray-900 dark:text-white tabular-nums">
                                  ${Number(sale.selling_price || 0).toFixed(2)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-muted-foreground text-xs font-semibold">ROI</span>
                                <span className="font-semibold text-gray-900 dark:text-white tabular-nums">
                                  {Number.isFinite(Number(sale.roi)) ? `${Number(sale.roi).toFixed(0)}%` : "—"}
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-muted-foreground text-xs font-semibold">Costs</span>
                                <span className="font-semibold text-gray-900 dark:text-white tabular-nums">
                                  ${Number(totalCosts || 0).toFixed(2)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-muted-foreground text-xs font-semibold">Net</span>
                                <span className="font-semibold text-gray-900 dark:text-white tabular-nums">
                                  ${Number((sale.selling_price || 0) - (totalCosts || 0)).toFixed(2)}
                                </span>
                              </div>
                            </div>

                            {safeNotes && (
                              <div className="mt-3 text-xs text-muted-foreground line-clamp-2">
                                {safeNotes}
                              </div>
                            )}

                            {isDeleted && daysUntilPermanentDelete !== null && (
                              <div className="mt-3 p-2 bg-orange-100 dark:bg-orange-900/30 border-l-2 border-orange-500 rounded-r text-orange-800 dark:text-orange-200 text-xs">
                                <p className="font-semibold flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {daysUntilPermanentDelete} day{daysUntilPermanentDelete !== 1 ? 's' : ''} until permanent deletion
                                </p>
                              </div>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="p-4 bg-gray-50/80 dark:bg-slate-800/40 flex flex-col gap-2">
                            <Link to={createPageUrl(`SoldItemDetail?id=${sale.id}&expandFees=true`)} className="w-full">
                              <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs h-9 shadow-sm">
                                View Details
                              </Button>
                            </Link>

                            {isDeleted ? (
                              <>
                                <Button
                                  onClick={() => recoverSaleMutation.mutate(sale)}
                                  disabled={recoverSaleMutation.isPending}
                                  className="w-full bg-green-600 hover:bg-green-700 rounded-xl text-xs h-9"
                                >
                                  <ArchiveRestore className="w-4 h-4 mr-2" />
                                  {recoverSaleMutation.isPending ? "Recovering..." : "Recover"}
                                </Button>
                                <Button
                                  onClick={() => {
                                    setSaleToPermanentDelete(sale);
                                    setPermanentDeleteDialogOpen(true);
                                  }}
                                  disabled={permanentDeleteSaleMutation.isPending}
                                  className="w-full bg-red-600 hover:bg-red-700 rounded-xl text-xs h-9"
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Delete Forever
                                </Button>
                              </>
                            ) : (
                              <>
                                <Link to={createPageUrl(`AddSale?id=${sale.id}`)} className="w-full">
                                  <Button variant="outline" className="w-full rounded-xl text-xs h-9 border-gray-300 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-900">
                                    <Pencil className="w-4 h-4 mr-2" />
                                    Edit
                                  </Button>
                                </Link>
                                <Link to={createPageUrl(`AddSale?copyId=${sale.id}`)} className="w-full">
                                  <Button variant="outline" className="w-full rounded-xl text-xs h-9 border-gray-300 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-900">
                                    <Copy className="w-4 h-4 mr-2" />
                                    Copy
                                  </Button>
                                </Link>
                                {(isNeedsReviewSale(sale) || isMissingInventoryLink(sale)) && (
                                  <Button
                                    variant="outline"
                                    onClick={() => {
                                      setSaleToLink(sale);
                                      setLinkSearch(sale?.item_name || "");
                                      setLinkDialogOpen(true);
                                    }}
                                    className="w-full rounded-xl text-xs h-9 border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/20"
                                  >
                                    <Link2 className="w-4 h-4 mr-2" />
                                    Link Inventory
                                  </Button>
                                )}
                                <Button
                                  variant="outline"
                                  onClick={() => handleDeleteClick(sale)}
                                  disabled={deleteSaleMutation.isPending}
                                  className="w-full rounded-xl text-xs h-9 border-red-500/40 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Delete
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
              {bulkPermanentDeleteMutation.isPending ? "Deleting..." : `Permanently Delete ${selectedSales.length} Sale${selectedSales.length !== 1 ? "s" : ""}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Link Sale to Inventory Dialog */}
      <Dialog
        open={linkDialogOpen}
        onOpenChange={(open) => {
          setLinkDialogOpen(open);
          if (!open) {
            setSaleToLink(null);
            setLinkSearch('');
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Link Sale to Inventory</DialogTitle>
            <DialogDescription>
              Pick the correct inventory item for this sale. We’ll save the inventory link and fill missing purchase date/source/category when available.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="rounded-lg border p-3 bg-muted/30">
              <div className="text-sm font-semibold text-foreground break-words">
                Sale: {saleToLink?.item_name || '—'}
              </div>
              <div className="text-xs text-muted-foreground">
                Missing: {!saleToLink?.inventory_id ? 'inventory link' : null}
                {!saleToLink?.purchase_date ? `${saleToLink?.inventory_id ? '' : ', '}purchase date` : null}
                {!saleToLink?.source ? `${(!saleToLink?.inventory_id || !saleToLink?.purchase_date) ? ', ' : ''}source` : null}
                {!saleToLink?.category ? `${(!saleToLink?.inventory_id || !saleToLink?.purchase_date || !saleToLink?.source) ? ', ' : ''}category` : null}
              </div>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input
                value={linkSearch}
                onChange={(e) => setLinkSearch(e.target.value)}
                placeholder="Search inventory..."
                className="pl-9"
              />
            </div>

            <div className="max-h-[380px] overflow-auto rounded-lg border">
              {isLoadingLinkInventory ? (
                <div className="p-4 text-sm text-muted-foreground">Loading inventory…</div>
              ) : linkInventoryResults.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">No inventory matches found.</div>
              ) : (
                <div className="divide-y">
                  {linkInventoryResults.map((inv) => (
                    <div key={inv.id} className="p-3 flex items-center gap-3">
                      <div className="w-12 h-12 rounded-md border bg-muted/30 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {inv.image_url ? (
                          <img src={inv.image_url} alt={inv.item_name} className="w-full h-full object-contain" />
                        ) : (
                          <Package className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-sm text-foreground truncate">{inv.item_name || '—'}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {inv.category || 'Uncategorized'} • {inv.source || '—'} • {inv.purchase_date ? inv.purchase_date : '—'}
                        </div>
                      </div>
                      <Button
                        className="whitespace-nowrap"
                        disabled={linkSaleToInventoryMutation.isPending || !saleToLink}
                        onClick={() => linkSaleToInventoryMutation.mutate({ sale: saleToLink, inventoryItem: inv })}
                      >
                        Link
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}