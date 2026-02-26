
import React, { useState, useEffect, useRef } from "react";
import { apiClient } from "@/api/base44Client";
import { inventoryApi } from "@/api/inventoryApi";
import { uploadApi } from "@/api/uploadApi";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, parseISO, differenceInDays, isAfter } from "date-fns";
import { Plus, Minus, Package, DollarSign, Trash2, Edit, ShoppingCart, Tag, Filter, AlarmClock, Copy, BarChart, Star, X, TrendingUp, Database, ImageIcon, ArchiveRestore, Archive, Grid2X2, Rows, Check, Facebook, Search, GalleryHorizontal, Settings, Download, ChevronDown, ChevronUp, Eye, MoreVertical, AlertTriangle, Link as LinkIcon, Loader2, FolderPlus, Folders } from "lucide-react";
import { Input } from "@/components/ui/input";
import DatePickerInput from "@/components/DatePickerInput";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ProductSearchDialog } from "@/components/ProductSearchDialog";
import { EnhancedProductSearchDialog } from "@/components/EnhancedProductSearchDialog";
import { useInventoryTags } from "@/hooks/useInventoryTags";
import { ImageEditor } from "@/components/ImageEditor";
import { OptimizedImage } from "@/components/OptimizedImage";
import { ImageCarousel } from "@/components/ImageCarousel";
import { InventoryItemViewDialog } from "@/components/InventoryItemViewDialog";
import { FacebookListingDialog } from "@/components/FacebookListingDialog";
import { DuplicateDetectionDialog } from "@/components/DuplicateDetectionDialog";
import { GroupDialog, ManageGroupsDialog } from "@/components/GroupDialog";
import { isConnected } from "@/api/facebookClient";
const EbaySearchDialog = React.lazy(() => import("@/components/EbaySearchDialog"));
import { supabase } from "@/api/supabaseClient";
import { openAuthExport } from "@/utils/exportWithAuth";
import ModeBanner from "@/components/ModeBanner";
import { useIsMobile } from "@/hooks/use-mobile";
import MobileFilterBar from "@/components/mobile/MobileFilterBar";
import SelectionBanner from "@/components/SelectionBanner";

const sourceIcons = {
  "Amazon": "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68e86fb5ac26f8511acce7ec/af08cfed1_Logo.png",
  "eBay": "https://upload.wikimedia.org/wikipedia/commons/1/1b/EBay_logo.svg",
  "Mercari": "https://cdn.brandfetch.io/idjAt9LfED/w/400/h/400/theme/dark/icon.jpeg?c=1dxbfHSJFAPEGdCLU4o5B",
  "Facebook": "https://upload.wikimedia.org/wikipedia/commons/b/b9/2023_Facebook_icon.svg",
  "Facebook Marketplace": "https://upload.wikimedia.org/wikipedia/commons/b/b9/2023_Facebook_icon.svg",
  "Poshmark": "https://cdn.brandfetch.io/idUxsADOAW/theme/dark/symbol.svg?c=1dxbfHSJFAPEGdCLU4o5B",
};

const statusColors = {
  available: "bg-blue-100 text-blue-800 border border-blue-200 hover:bg-blue-100",
  listed: "bg-green-100 text-green-800 border border-green-200 hover:bg-green-100",
  sold: "bg-gray-100 text-gray-800 border border-gray-200 hover:bg-gray-100",
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
  const isMobile = useIsMobile();
  const [filters, setFilters] = useState({ search: "", status: "not_sold", daysInStock: "all" });
  const [sort, setSort] = useState("newest");
  const [filtersDialogOpen, setFiltersDialogOpen] = useState(false);
  const [tempFilters, setTempFilters] = useState({ search: "", status: "not_sold", daysInStock: "all" });
  const [tempSort, setTempSort] = useState("newest");
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
  const [productSearchOpen, setProductSearchOpen] = useState(false);
  const [productSearchQuery, setProductSearchQuery] = useState("");
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
  
  const [showDismissedReturns, setShowDismissedReturns] = useState(false);
  
  // Highlight functionality (for navigation from Import page)
  const [searchParams, setSearchParams] = useSearchParams();
  const highlightId = searchParams.get('highlight');
  const highlightRef = useRef(null);
  
  // Variation configurations
  const gridVariations = {
    1: { // Compact Professional
      containerClass: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3",
      cardClass: "rounded-lg",
      paddingClass: "p-3",
      imageWrapperClass: "aspect-square",
      badgeClass: "text-[9px] px-1.5 py-0.5",
      titleClass: "text-xs font-bold",
      dataTextClass: "text-[10px]",
      hoverEffect: "",
      buttonSizeClass: "h-6 w-6",
      iconSizeClass: "h-3 w-3"
    },
    2: { // Visual Showcase
      containerClass: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6",
      cardClass: "rounded-2xl",
      paddingClass: "p-6",
      imageWrapperClass: "aspect-square",
      badgeClass: "text-xs px-3 py-1.5",
      titleClass: "text-base font-bold",
      dataTextClass: "text-sm",
      hoverEffect: "hover:scale-105 transition-transform duration-300",
      buttonSizeClass: "h-9 w-9",
      iconSizeClass: "h-4 w-4"
    },
    3: { // Mobile-First Hybrid
      containerClass: "grid-cols-2 gap-4",
      cardClass: "rounded-xl",
      paddingClass: "p-4",
      imageWrapperClass: "", // Dynamic height for masonry
      badgeClass: "text-[10px] px-2 py-1",
      titleClass: "text-sm font-bold",
      dataTextClass: "text-xs",
      hoverEffect: "",
      buttonSizeClass: "h-11 w-11", // Larger for touch
      iconSizeClass: "h-4 w-4"
    }
  };

  const listVariations = {
    1: { // Compact Professional
      gridCols: "grid-cols-[100px_1fr_220px]",
      imageHeight: 100,
      padding: "p-3 py-3",
      titleClass: "text-sm font-bold",
      dataTextClass: "text-xs",
      buttonSizeClass: "h-7 w-7",
      iconSizeClass: "h-3.5 w-3.5"
    },
    2: { // Visual Showcase
      gridCols: "grid-cols-[220px_1fr_280px]",
      imageHeight: 220,
      padding: "p-6 py-5",
      titleClass: "text-lg font-bold",
      dataTextClass: "text-base",
      buttonSizeClass: "h-9 w-9",
      iconSizeClass: "h-4 w-4"
    },
    3: { // Mobile-First Hybrid
      gridCols: "grid-cols-[160px_1fr_auto]",
      imageHeight: 160,
      padding: "p-4",
      titleClass: "text-base font-bold",
      dataTextClass: "text-sm",
      buttonSizeClass: "h-11 w-11",
      iconSizeClass: "h-5 w-5"
    }
  };
  
  const [editorOpen, setEditorOpen] = useState(false);
  const [imageToEdit, setImageToEdit] = useState({ url: null, itemId: null });
  const [viewMode, setViewMode] = useState(() => {
    // Load saved view mode from localStorage
    const saved = localStorage.getItem('inventory_view_mode');
    return saved || 'grid';
  });
  
  // Persist view mode changes
  useEffect(() => {
    localStorage.setItem('inventory_view_mode', viewMode);
  }, [viewMode]);
  
  // Hybrid variation logic based on user preference:
  // Desktop Grid = V1 (Compact), Desktop List = V2 (Showcase), Mobile = V2 (Showcase)
  const viewVariation = React.useMemo(() => {
    if (isMobile) return 2; // V2 for all mobile views
    return viewMode === 'grid' ? 1 : 2; // Desktop: V1 for grid, V2 for list
  }, [isMobile, viewMode]);
  
  const [pageSize, setPageSize] = useState(50);
  const [pageIndex, setPageIndex] = useState(0);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [itemToView, setItemToView] = useState(null);
  const [expandedDetails, setExpandedDetails] = useState({});
  const [openDropdown, setOpenDropdown] = useState(null);
  const [facebookListingDialogOpen, setFacebookListingDialogOpen] = useState(false);
  const [itemForFacebookListing, setItemForFacebookListing] = useState(null);
  const [ebaySearchDialogOpen, setEbaySearchDialogOpen] = useState(false);
  const [ebaySearchInitialQuery, setEbaySearchInitialQuery] = useState("");
  const [itemDuplicates, setItemDuplicates] = useState({});
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [selectedItemForDuplicates, setSelectedItemForDuplicates] = useState(null);
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [manageGroupsDialogOpen, setManageGroupsDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [itemGroups, setItemGroups] = useState({});
  const [dismissedDuplicates, setDismissedDuplicates] = useState(() => {
    try {
      const stored = localStorage.getItem('dismissedDuplicateAlerts');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const {
    toggleFavorite,
    addTag,
    removeTag,
    clearTags,
    isFavorite,
    getTags,
    clearRemovedItems,
    tagState,
  } = useInventoryTags();

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

  const inventoryFields = React.useMemo(() => ([
    'id',
    'item_name',
    'status',
    'purchase_price',
    'purchase_date',
    'quantity',
    'quantity_sold',
    'return_deadline',
    'return_deadline_dismissed',
    'deleted_at',
    'image_url',
    'images',
    'photos',
    'source',
    'category',
    'notes',
    'created_at',
    'ebay_item_id',
    'mercari_item_id',
    'facebook_item_id',
    'hitCount',
    'watchCount',
    'likes',
  ].join(',')), []);

  const favoriteIdsCsv = React.useMemo(() => {
    if (!showFavoritesOnly) return '';
    const ids = Object.entries(tagState || {})
      .filter(([, v]) => Boolean(v?.favorite))
      .map(([id]) => id);
    return ids.join(',');
  }, [showFavoritesOnly, tagState]);

  // Reset paging when key filters change
  useEffect(() => {
    setPageIndex(0);
  }, [filters.search, filters.status, showFavoritesOnly, sort, pageSize]);

  const { data: inventoryPage, isLoading } = useQuery({
    queryKey: ['inventoryItems', 'inventory', pageIndex, pageSize, filters.search, filters.status, showFavoritesOnly, sort, favoriteIdsCsv],
    queryFn: async () => {
      const qs = new URLSearchParams();
      qs.set('paged', 'true');
      qs.set('count', 'true');
      qs.set('limit', String(pageSize));
      qs.set('offset', String(pageIndex * pageSize));
      qs.set('fields', inventoryFields);
      qs.set('sort', sort === 'oldest' ? 'purchase_date' : '-purchase_date');

      // Never include deleted items
      qs.set('exclude_deleted', 'true');

      const search = (filters.search || '').trim();
      if (search) qs.set('search', search);

      if (filters.status === 'available' || filters.status === 'listed' || filters.status === 'sold') {
        qs.set('status', filters.status);
      } else if (filters.status === 'not_sold') {
        qs.set('exclude_status', 'sold');
      }

      if (favoriteIdsCsv) qs.set('ids', favoriteIdsCsv);

      return apiGetJson(`/api/inventory?${qs.toString()}`);
    },
    placeholderData: { data: [], total: 0, limit: pageSize, offset: 0 },
    notifyOnChangeProps: 'all',
  });

  const inventoryItems = React.useMemo(() => inventoryPage?.data || [], [inventoryPage]);
  const totalItems = Number.isFinite(Number(inventoryPage?.total)) ? Number(inventoryPage.total) : 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const canPrev = pageIndex > 0;
  const canNext = pageIndex + 1 < totalPages;

  // Don't clear tags/favorites for items not on current page - they should persist
  // Only clear tags for items that are actually deleted (handled elsewhere if needed)
  // useEffect(() => {
  //   if (isLoading) return;
  //   if (Array.isArray(inventoryItems)) {
  //     clearRemovedItems(inventoryItems.map((item) => item.id));
  //   }
  // }, [inventoryItems, clearRemovedItems, isLoading]);

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

  // Scroll to highlighted item when navigating from Import page
  useEffect(() => {
    if (highlightId && !isLoading) {
      console.log('🔍 [Inventory] Highlight effect triggered:', {
        highlightId,
        hasRef: !!highlightRef.current,
        isLoading,
        itemsCount: inventoryItems?.length
      });

      if (highlightRef.current) {
        // Wait for layout to settle
        setTimeout(() => {
          console.log('📍 [Inventory] Scrolling to highlighted item...');
          highlightRef.current?.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center' 
          });
          // Remove highlight parameter after scrolling
          setTimeout(() => {
            setSearchParams({}, { replace: true });
          }, 3000);
        }, 300);
      } else {
        console.warn('⚠️ [Inventory] Highlight ref not found - item may be on a different page or filtered out');
      }
    }
  }, [highlightId, isLoading, inventoryItems, setSearchParams]);

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
          // Hard delete after 30 days (soft delete uses deleted_at).
          itemsToHardDelete.map(item => inventoryApi.delete(item.id, true))
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

  // NEW DELETE FUNCTIONALITY - Permanent delete with confirmation
  const deleteItemMutation = useMutation({
    mutationFn: async (itemId) => {
      console.log("Permanently deleting item:", itemId);
      
      // Hard delete (permanent)
      await inventoryApi.delete(itemId, true);
      
      return itemId;
    },
    onMutate: async (itemId) => {
      // IMMEDIATELY update the cache before server responds
      await queryClient.cancelQueries({ queryKey: ['inventoryItems'] });
      
      // Get the item we're deleting from the current inventoryItems array in scope
      const itemBeingDeleted = inventoryItems.find(item => item.id === itemId);
      
      const previousData = queryClient.getQueryData(['inventoryItems']);
      
      // Immediately remove from cache (permanent delete)
      queryClient.setQueryData(['inventoryItems'], (old = []) => {
        if (!Array.isArray(old)) return old;
        return old.filter(item => item.id !== itemId);
      });
      
      // Remove from selected items
      setSelectedItems(prev => prev.filter(id => id !== itemId));
      
      return { previousData, itemBeingDeleted };
    },
    onSuccess: async (itemId, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['inventoryItems'] });
      
      // Un-mark item in import cache if it was imported from a marketplace
      const itemBeingDeleted = context?.itemBeingDeleted;
      
      try {
        if (itemBeingDeleted?.source) {
          const source = itemBeingDeleted.source.toLowerCase();
          
          console.log(`🔍 Attempting to un-mark deleted item from ${source} import cache:`, {
            inventoryId: itemId,
            source: itemBeingDeleted.source,
            notes: itemBeingDeleted.notes
          });
          
          if (source === 'facebook' || source === 'facebook marketplace') {
            const cachedListings = localStorage.getItem('profit_orbit_facebook_listings');
            if (cachedListings) {
              try {
                const listings = JSON.parse(cachedListings);
                console.log(`📦 Facebook cache has ${listings.length} items. Looking for inventoryId: ${itemId}`);
                
                const matchingItem = listings.find(item => item.inventoryId === itemId);
                console.log('🔍 Matching Facebook item:', matchingItem);
                
                const updatedListings = listings.map(item => {
                  if (item.inventoryId === itemId) {
                    console.log(`✅ Found and un-marking Facebook item:`, item.itemId);
                    return { ...item, imported: false, inventoryId: null };
                  }
                  return item;
                });
                localStorage.setItem('profit_orbit_facebook_listings', JSON.stringify(updatedListings));
                queryClient.setQueryData(['facebook-listings', itemBeingDeleted.user_id], updatedListings);
                console.log('✅ Un-marked Facebook item in import cache');
              } catch (e) {
                console.error('Failed to update Facebook cache:', e);
              }
            } else {
              console.log('⚠️ No Facebook cache found in localStorage');
            }
          } else if (source === 'mercari') {
            const cachedListings = localStorage.getItem('profit_orbit_mercari_listings');
            if (cachedListings) {
              try {
                const listings = JSON.parse(cachedListings);
                console.log(`📦 Mercari cache has ${listings.length} items. Looking for inventoryId: ${itemId}`);
                
                const matchingItem = listings.find(item => item.inventoryId === itemId);
                console.log('🔍 Matching Mercari item:', matchingItem);
                
                const updatedListings = listings.map(item => {
                  if (item.inventoryId === itemId) {
                    console.log(`✅ Found and un-marking Mercari item:`, item.itemId);
                    return { ...item, imported: false, inventoryId: null };
                  }
                  return item;
                });
                localStorage.setItem('profit_orbit_mercari_listings', JSON.stringify(updatedListings));
                queryClient.setQueryData(['mercari-listings', itemBeingDeleted.user_id], updatedListings);
                console.log('✅ Un-marked Mercari item in import cache');
              } catch (e) {
                console.error('Failed to update Mercari cache:', e);
              }
            } else {
              console.log('⚠️ No Mercari cache found in localStorage');
            }
          } else if (source === 'ebay') {
            // eBay doesn't use localStorage cache, just invalidate the query
            queryClient.invalidateQueries(['ebay-listings', itemBeingDeleted.user_id]);
            console.log('✅ Invalidated eBay listings cache');
          }
        } else {
          console.log('⚠️ Item has no source, cannot un-mark in import cache');
        }
      } catch (error) {
        console.error('Error un-marking item in import cache:', error);
      }
      
      toast({
        title: "✅ Item Deleted",
        description: `"${itemBeingDeleted?.item_name || 'Item'}" has been permanently deleted.`,
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
        await inventoryApi.update(itemId, {
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
        // Hard delete (permanent) — bypass soft delete.
        await inventoryApi.delete(itemId, true);
        return itemId;
      } catch (error) {
        throw new Error(`Failed to permanently delete item: ${error.message}`);
      }
    },
    onMutate: async (itemId) => {
      await queryClient.cancelQueries({ queryKey: ['inventoryItems'] });

      const previousData = queryClient.getQueryData(['inventoryItems']);

      // Immediately remove from cache so it disappears from "Viewing Deleted Items".
      queryClient.setQueryData(['inventoryItems'], (old = []) => {
        if (!Array.isArray(old)) return old;
        return old.filter((item) => item.id !== itemId);
      });

      setSelectedItems((prev) => prev.filter((id) => id !== itemId));

      return { previousData };
    },
    onSuccess: (deletedId) => {
      queryClient.invalidateQueries({ queryKey: ['inventoryItems'] });
      
      // Un-mark item in import cache if it was imported from a marketplace
      try {
        const itemToDelete = itemToPermanentlyDelete;
        if (itemToDelete?.source) {
          const source = itemToDelete.source.toLowerCase();
          
          if (source === 'facebook' || source === 'facebook marketplace') {
            const cachedListings = localStorage.getItem('profit_orbit_facebook_listings');
            if (cachedListings) {
              try {
                const listings = JSON.parse(cachedListings);
                const updatedListings = listings.map(item => {
                  if (item.inventoryId === deletedId) {
                    return { ...item, imported: false, inventoryId: null };
                  }
                  return item;
                });
                localStorage.setItem('profit_orbit_facebook_listings', JSON.stringify(updatedListings));
                queryClient.setQueryData(['facebook-listings', itemToDelete.user_id], updatedListings);
                console.log('✅ Un-marked Facebook item in import cache (permanent delete)');
              } catch (e) {
                console.error('Failed to update Facebook cache:', e);
              }
            }
          } else if (source === 'mercari') {
            const cachedListings = localStorage.getItem('profit_orbit_mercari_listings');
            if (cachedListings) {
              try {
                const listings = JSON.parse(cachedListings);
                const updatedListings = listings.map(item => {
                  if (item.inventoryId === deletedId) {
                    return { ...item, imported: false, inventoryId: null };
                  }
                  return item;
                });
                localStorage.setItem('profit_orbit_mercari_listings', JSON.stringify(updatedListings));
                queryClient.setQueryData(['mercari-listings', itemToDelete.user_id], updatedListings);
                console.log('✅ Un-marked Mercari item in import cache (permanent delete)');
              } catch (e) {
                console.error('Failed to update Mercari cache:', e);
              }
            }
          }
        }
      } catch (error) {
        console.error('Error un-marking item in import cache:', error);
      }
      
      toast({
        title: "Item Permanently Deleted",
        description: "The item has been permanently removed and cannot be recovered.",
      });
      setPermanentDeleteDialogOpen(false);
      setItemToPermanentlyDelete(null);
    },
    onError: (error, _itemId, context) => {
      console.error("Permanent delete error:", error);
      if (context?.previousData) {
        queryClient.setQueryData(['inventoryItems'], context.previousData);
      }
      toast({
        title: "Error Permanently Deleting Item",
        description: error.message || "Failed to permanently delete item. Please try again.",
        variant: "destructive",
      });
    },
  });

  // BULK DELETE - Permanent delete with confirmation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (itemIds) => {
      const results = [];
      
      for (const id of itemIds) {
        try {
          // Hard delete (permanent)
          await inventoryApi.delete(id, true);
          results.push({ id, success: true });
        } catch (error) {
          results.push({ id, success: false, error: error.message });
        }
      }
      
      return results;
    },
    onMutate: async (itemIds) => {
      await queryClient.cancelQueries({ queryKey: ['inventoryItems'] });
      
      const previousData = queryClient.getQueryData(['inventoryItems']);
      
      // Get the items being deleted BEFORE removing them from cache
      // Use the current inventoryItems array in scope which has all the data
      const itemsBeingDeleted = inventoryItems.filter(item => itemIds.includes(item.id));
      
      // Immediately remove from cache (permanent delete)
      queryClient.setQueryData(['inventoryItems'], (old = []) => {
        if (!Array.isArray(old)) return old;
        return old.filter(item => !itemIds.includes(item.id));
      });
      
      setSelectedItems([]);
      
      return { previousData, itemsBeingDeleted };
    },
    onSuccess: async (results, variables, context) => {
      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;
      
      setBulkDeleteDialogOpen(false);
      
      queryClient.invalidateQueries({ queryKey: ['inventoryItems'] });
      
      // Un-mark items in import cache
      const successfulIds = results.filter(r => r.success).map(r => r.id);
      const itemsBeingDeleted = context?.itemsBeingDeleted || [];
      
      if (successfulIds.length > 0 && itemsBeingDeleted.length > 0) {
        const sourcesToUpdate = { facebook: [], mercari: [], ebay: [] };
        
        // Use the itemsBeingDeleted from context to get source info
        for (const id of successfulIds) {
          const item = itemsBeingDeleted.find(i => i.id === id);
          if (item?.source) {
            const source = item.source.toLowerCase();
            if (source === 'facebook' || source === 'facebook marketplace') {
              sourcesToUpdate.facebook.push(id);
            } else if (source === 'mercari') {
              sourcesToUpdate.mercari.push(id);
            } else if (source === 'ebay') {
              sourcesToUpdate.ebay.push(id);
            }
          }
        }
        
        // Update Facebook cache
        if (sourcesToUpdate.facebook.length > 0) {
          const cachedListings = localStorage.getItem('profit_orbit_facebook_listings');
          if (cachedListings) {
            try {
              const listings = JSON.parse(cachedListings);
              const updatedListings = listings.map(item => {
                if (sourcesToUpdate.facebook.includes(item.inventoryId)) {
                  return { ...item, imported: false, inventoryId: null };
                }
                return item;
              });
              localStorage.setItem('profit_orbit_facebook_listings', JSON.stringify(updatedListings));
              
              // Also update query cache if available
              const firstDeletedItem = itemsBeingDeleted.find(i => i.source?.toLowerCase().includes('facebook'));
              if (firstDeletedItem?.user_id) {
                queryClient.setQueryData(['facebook-listings', firstDeletedItem.user_id], updatedListings);
              }
              
              console.log(`✅ Un-marked ${sourcesToUpdate.facebook.length} Facebook items (bulk delete)`);
            } catch (e) {
              console.error('Failed to update Facebook cache:', e);
            }
          }
        }
        
        // Update Mercari cache
        if (sourcesToUpdate.mercari.length > 0) {
          const cachedListings = localStorage.getItem('profit_orbit_mercari_listings');
          if (cachedListings) {
            try {
              const listings = JSON.parse(cachedListings);
              const updatedListings = listings.map(item => {
                if (sourcesToUpdate.mercari.includes(item.inventoryId)) {
                  return { ...item, imported: false, inventoryId: null };
                }
                return item;
              });
              localStorage.setItem('profit_orbit_mercari_listings', JSON.stringify(updatedListings));
              
              // Also update query cache if available
              const firstDeletedItem = itemsBeingDeleted.find(i => i.source?.toLowerCase() === 'mercari');
              if (firstDeletedItem?.user_id) {
                queryClient.setQueryData(['mercari-listings', firstDeletedItem.user_id], updatedListings);
              }
              
              console.log(`✅ Un-marked ${sourcesToUpdate.mercari.length} Mercari items (bulk delete)`);
            } catch (e) {
              console.error('Failed to update Mercari cache:', e);
            }
          }
        }
        
        // Invalidate eBay cache (doesn't use localStorage)
        if (sourcesToUpdate.ebay.length > 0) {
          const firstDeletedItem = itemsBeingDeleted.find(i => i.source?.toLowerCase() === 'ebay');
          if (firstDeletedItem?.user_id) {
            queryClient.invalidateQueries(['ebay-listings', firstDeletedItem.user_id]);
            console.log(`✅ Invalidated eBay listings cache (${sourcesToUpdate.ebay.length} items)`);
          }
        }
      }
      
      if (failCount === 0) {
        toast({
          title: `✅ ${successCount} Item${successCount > 1 ? 's' : ''} Deleted`,
          description: "Selected items have been permanently deleted.",
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
          await inventoryApi.update(id, updates);
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
    mutationFn: async ({ itemId, file, imageIndex, photoId }) => {
      // ImageEditor already uploads and passes the final URL string.
      // Only re-upload when a raw File/Blob is passed (legacy path).
      let file_url;
      if (typeof file === 'string') {
        file_url = file;
      } else {
        console.log('Starting image upload:', { itemId, imageIndex, fileSize: file?.size });
        const uploadPayload = file instanceof File ? file : new File([file], file.name || 'edited-image.jpg', { type: file.type || 'image/jpeg' });
        const result = await uploadApi.uploadFile({ file: uploadPayload });
        file_url = result.file_url;
        console.log('File uploaded:', file_url);
      }
      
      // Get the current item
      const item = inventoryItems.find(i => i.id === itemId);
      console.log('Found item:', { itemId, hasImages: !!item?.images, imageCount: item?.images?.length, hasPhotos: !!item?.photos });

      const basePhotos = (() => {
        const p = Array.isArray(item?.photos) ? item.photos.filter(Boolean) : [];
        if (p.length > 0) return p;
        const imgs = Array.isArray(item?.images) ? item.images.filter(Boolean) : [];
        return imgs.map((u, idx) => ({
          id: `img_${idx}`,
          imageUrl: typeof u === 'string' ? u : (u?.imageUrl || u?.url || u?.image_url || ''),
          isMain: idx === 0,
        }));
      })();
      
      // Update both image_url AND images array to ensure Edit page shows edited version
      if (item && item.images && Array.isArray(item.images) && imageIndex !== undefined) {
        // Item has images array - update the specific index
        const updatedImages = [...item.images];
        updatedImages[imageIndex] = file_url;

        const updatedPhotos = basePhotos.map((p, idx) => {
          if (idx !== imageIndex) return p;
          return { ...p, imageUrl: file_url };
        });
        
        console.log('Updating images array:', { imageIndex, updatedCount: updatedImages.length, newImages: updatedImages });
        const updatePayload = { 
          images: updatedImages,
          image_url: updatedImages[0], // First image is main
          photos: updatedPhotos,
        };
        console.log('Update payload:', updatePayload);
        await inventoryApi.update(itemId, updatePayload);
      } else {
        // No images array or not specified - update both image_url and create/update images array
        console.log('Updating single image - updating both image_url and images array');
        const updatedPhotos = basePhotos.length > 0
          ? basePhotos.map((p, idx) => (idx === 0 ? { ...p, imageUrl: file_url, isMain: true } : { ...p, isMain: false }))
          : [{ id: photoId || 'img_0', imageUrl: file_url, isMain: true }];
        const updatePayload = {
          image_url: file_url,
          images: [file_url], // Ensure images array is also updated
          photos: updatedPhotos,
        };
        console.log('Update payload:', updatePayload);
        await inventoryApi.update(itemId, updatePayload);
      }
      
      console.log('Database update complete - new image should be visible');
      return file_url;
    },
    onSuccess: async (fileUrl, variables) => {
      console.log('Image update SUCCESS:', { fileUrl, itemId: variables.itemId, imageIndex: variables.imageIndex });
      
      // Update the stored imageUrl in edit history to the new uploaded URL
      try {
        const keySuffix = variables.photoId ? String(variables.photoId) : String(variables.imageIndex);
        const historyKey = `${variables.itemId}_${keySuffix}`;
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
      
      // Invalidate and refetch both queries to ensure Edit Item page updates
      console.log('Invalidating queries for item:', variables.itemId);
      await queryClient.invalidateQueries({ queryKey: ['inventoryItems'] });
      await queryClient.invalidateQueries({ queryKey: ['inventoryItem', variables.itemId] });
      
      console.log('Forcing refetch of individual item query');
      await queryClient.refetchQueries({ queryKey: ['inventoryItem', variables.itemId] });
      await queryClient.refetchQueries({ queryKey: ['inventoryItems'] });
      
      console.log('Queries refetched - Edit Item page should now show edited image');
      
      // Update imageToEdit to point to new edited URL so editor shows correct image
      setImageToEdit({
        url: fileUrl,
        itemId: variables.itemId
      });
      
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
      await inventoryApi.update(itemId, {
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

  // Function to check for duplicates
  const handleCheckDuplicates = async (itemId = null) => {
    setCheckingDuplicates(true);
    try {
      const response = await apiClient.post('/api/inventory/check-duplicates', {
        itemIds: itemId ? [itemId] : null,
        checkAll: !itemId
      });

      if (response.success) {
        setItemDuplicates(response.duplicates || {});
        toast({
          title: "Duplicate Check Complete",
          description: `Found ${response.duplicatesFound} item${response.duplicatesFound !== 1 ? 's' : ''} with potential duplicates`,
        });
        
        // If checking a single item and duplicates found, open dialog
        if (itemId && response.duplicates[itemId]) {
          const item = inventoryItems.find(i => i.id === itemId);
          setSelectedItemForDuplicates({
            id: itemId,
            item_name: item.item_name,
            purchase_price: item.purchase_price,
            purchase_date: item.purchase_date,
            image_url: item.image_url,
            images: item.images,
            source: item.source,
          });
          setDuplicateDialogOpen(true);
        }
      }
    } catch (error) {
      console.error('Error checking duplicates:', error);
      toast({
        title: "Error",
        description: "Failed to check for duplicates. Please try again.",
        variant: "destructive",
      });
    } finally {
      setCheckingDuplicates(false);
    }
  };

  const handleEditImage = (e, item) => {
    e.preventDefault();
    e.stopPropagation();
    if (item.image_url && item.image_url !== DEFAULT_IMAGE_URL) {
      // Find the index of this image in the item's photos array
      const photos = Array.isArray(item?.photos) ? item.photos : (item?.images || []);
      const toUrl = (p) => typeof p === 'string' ? p : (p?.imageUrl || p?.url || p?.image_url || null);
      const idx = photos.findIndex(p => toUrl(p) === item.image_url);
      setImageToEdit({ url: item.image_url, itemId: item.id, imageIndex: idx >= 0 ? idx : 0 });
      setEditorOpen(true);
    } else {
      toast({
        title: "No Image to Edit",
        description: "This item doesn't have a custom image to edit.",
        variant: "destructive",
      });
    }
  };

  // ImageEditor calls onSave(fileUrl: string, index: number) — file is already uploaded.
  const handleSaveEditedImage = (fileUrl, imageIndex) => {
    if (imageToEdit.itemId) {
      const item = inventoryItems.find((i) => i.id === imageToEdit.itemId);
      const photos = Array.isArray(item?.photos) ? item.photos.filter(Boolean) : [];
      const photoId = photos?.[imageIndex]?.id ? String(photos[imageIndex].id) : undefined;
      updateImageMutation.mutate({
        itemId: imageToEdit.itemId,
        file: fileUrl,       // string URL — mutation skips re-upload
        imageIndex,
        photoId,
      });
    }
  };

  // Apply filters to all images for an inventory item
  const handleApplyFiltersToAll = async (processedImages, settings) => {
    if (!imageToEdit.itemId) return;
    
    try {
      // Find the item from inventory
      const item = inventoryItems.find(i => i.id === imageToEdit.itemId);
      const basePhotos = (() => {
        const p = Array.isArray(item?.photos) ? item.photos.filter(Boolean) : [];
        if (p.length > 0) return p;
        const imgs = Array.isArray(item?.images) ? item.images.filter(Boolean) : [];
        return imgs.map((u, idx) => ({
          id: `img_${idx}`,
          imageUrl: typeof u === 'string' ? u : (u?.imageUrl || u?.url || u?.image_url || ''),
          isMain: idx === 0,
        }));
      })();

      if (!item || basePhotos.length === 0) {
        alert('No images found for this item.');
        return;
      }

      // Upload all processed images
      const uploadedUrls = [];
      for (let i = 0; i < processedImages.length; i++) {
        const processedItem = processedImages[i];
        if (processedItem.file) {
          const { file_url } = await uploadApi.uploadFile({ file: processedItem.file });
          uploadedUrls.push(file_url);
        }
      }
      
      // Update the inventory item with new images
      const updatedPhotos = basePhotos.map((p, idx) => ({
        ...p,
        imageUrl: uploadedUrls[idx] || p.imageUrl,
        isMain: idx === 0,
      }));
      await inventoryApi.update(imageToEdit.itemId, {
        images: uploadedUrls,
        image_url: uploadedUrls[0] || item.image_url,
        photos: updatedPhotos,
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

      // Never show deleted items (they're permanently deleted)
      const isDeleted = item.deleted_at !== null && item.deleted_at !== undefined && item.deleted_at !== '';
      if (isDeleted) return false;

      // Apply all filters
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
  }, [inventoryItems, showFavoritesOnly, showDismissedReturns, filters, isFavorite]);

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

  // Detect duplicate items by title (excluding sold items)
  const duplicateItems = React.useMemo(() => {
    if (!Array.isArray(inventoryItems)) return [];
    const titleMap = new Map();
    const duplicates = [];
    
    inventoryItems.forEach(item => {
      // Skip deleted items and sold items
      if (!item.item_name || item.deleted_at || item.status === "sold") return;
      const normalizedTitle = item.item_name.trim().toLowerCase();
      if (!titleMap.has(normalizedTitle)) {
        titleMap.set(normalizedTitle, []);
      }
      titleMap.get(normalizedTitle).push(item);
    });
    
    titleMap.forEach((items, title) => {
      if (items.length > 1) {
        duplicates.push({
          title: items[0].item_name, // Use original case
          items: items,
          normalizedTitle: title
        });
      }
    });
    
    return duplicates;
  }, [inventoryItems]);

  // Filter out dismissed duplicates
  const activeDuplicates = React.useMemo(() => {
    return duplicateItems.filter(dup => 
      !dismissedDuplicates.includes(dup.normalizedTitle)
    );
  }, [duplicateItems, dismissedDuplicates]);

  const handleDismissDuplicate = (normalizedTitle) => {
    const updated = [...dismissedDuplicates, normalizedTitle];
    setDismissedDuplicates(updated);
    localStorage.setItem('dismissedDuplicateAlerts', JSON.stringify(updated));
  };

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
    // Sort items based on selected sort option
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
    const skipConfirmation = localStorage.getItem('skip_delete_confirmation') === 'true';
    
    if (skipConfirmation) {
      // Skip dialog, delete immediately with toast warning
      toast({
        title: "⚠️ Deleting Item...",
        description: `Permanently removing "${item.item_name}" from your inventory...`,
      });
      deleteItemMutation.mutate(item.id);
    } else {
      // Show confirmation dialog
      setDeleteDialogOpen(true);
    }
  };

  // NEW DELETE CONFIRMATION - Permanent delete
  const confirmDelete = () => {
    if (!itemToDelete) return;
    
    const itemId = itemToDelete.id;
    const itemName = itemToDelete.item_name || 'this item';
    
    // Close dialog immediately
    setDeleteDialogOpen(false);
    
    // Show immediate feedback
    toast({
      title: "⚠️ Deleting Item...",
      description: `Permanently removing "${itemName}" from your inventory...`,
    });
    
    // Trigger delete - optimistic update happens in onMutate
    deleteItemMutation.mutate(itemId);
    setItemToDelete(null);
  };

  const confirmBulkDelete = () => {
    if (selectedItems.length > 0) {
      bulkDeleteMutation.mutate(selectedItems);
    }
  };

  const handleSaveFilters = () => {
    setFilters(tempFilters);
    setSort(tempSort);
    setFiltersDialogOpen(false);
  };

  const handleClearFilters = () => {
    const defaultFilters = { search: "", status: "not_sold", daysInStock: "all" };
    const defaultSort = "newest";
    setTempFilters(defaultFilters);
    setTempSort(defaultSort);
  };

  const handleOpenFiltersDialog = () => {
    // Set temp values to current values when opening
    setTempFilters(filters);
    setTempSort(sort);
    setFiltersDialogOpen(true);
  };

  // Check if filters are active (not default values)
  const hasActiveFilters = filters.status !== "not_sold" || sort !== "newest";

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

  // Determine active mode for banner
  const activeMode = React.useMemo(() => {
    if (viewMode === "gallery") return "gallery";
    if (showFavoritesOnly) return "favorites";
    return null;
  }, [viewMode, showFavoritesOnly]);

  const handleCloseMode = () => {
    if (viewMode === "gallery") setViewMode("grid");
    if (showFavoritesOnly) setShowFavoritesOnly(false);
  };

  const topOffset = React.useMemo(() => {
    let offset = 0;
    if (activeMode) offset += 50;
    if (selectedItems.length > 0) offset += 50;
    return offset > 0 ? (isMobile ? `calc(env(safe-area-inset-top, 0px) + ${offset}px)` : `${offset}px`) : undefined;
  }, [activeMode, selectedItems.length, isMobile]);

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <ModeBanner 
        mode={activeMode} 
        onClose={handleCloseMode}
      />
      <SelectionBanner
        selectedCount={selectedItems.length}
        onClear={() => setSelectedItems([])}
        showAtTop={false}
        threshold={200}
      />
      <div className="p-4 md:p-6 lg:p-8" style={{ paddingTop: topOffset }}>
        <div className="max-w-7xl mx-auto space-y-6 min-w-0">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 min-w-0">
            <div className="flex items-center justify-between w-full sm:w-auto min-w-0">
              <div className="min-w-0">
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground break-words">Inventory</h1>
                <p className="hidden lg:block text-sm text-muted-foreground mt-1">Track items you have for sale.</p>
              </div>
              <Link to={createPageUrl("Settings")} className="lg:hidden inline-flex ml-4">
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                  <Settings className="w-5 h-5" />
                </Button>
              </Link>
            </div>
            <div className="flex flex-wrap gap-2 w-full sm:w-auto min-w-0">
              <Button
                variant="outline"
                onClick={() => setViewMode((m) => (m === "gallery" ? "grid" : "gallery"))}
                className="flex-shrink-0"
              >
                <GalleryHorizontal className="w-4 h-4 mr-2" />
                {viewMode === "gallery" ? "Exit Gallery" : "Gallery Mode"}
              </Button>
              <Button
                onClick={() => handleCheckDuplicates()}
                disabled={checkingDuplicates}
                variant="outline"
                className="flex-shrink-0"
              >
                {checkingDuplicates ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Checking...
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    Check Duplicates
                  </>
                )}
              </Button>
              <Button
                onClick={() => setManageGroupsDialogOpen(true)}
                variant="outline"
                className="flex-shrink-0"
              >
                <Folders className="w-4 h-4 mr-2" />
                Manage Groups
              </Button>
              <Link
                to={createPageUrl("Import")}
                state={returnStateForInventory}
                className="w-full sm:w-auto min-w-0"
              >
                <Button 
                  className="w-full sm:w-auto gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Download className="w-4 h-4" />
                  Import
                </Button>
              </Link>
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

          {/* Mobile Filter Bar */}
          <div className="md:hidden mb-4">
            <MobileFilterBar
              search={filters.search}
              onSearchChange={(val) => setFilters(f => ({ ...f, search: val }))}
              showFavorites={showFavoritesOnly}
              onShowFavoritesToggle={() => setShowFavoritesOnly((prev) => !prev)}
              pageSize={pageSize}
              onPageSizeChange={(val) => {
                if (val === 25 || val === 50 || val === 100 || val === 200) setPageSize(val);
              }}
              onExportCSV={() => {
                const params = { exclude_deleted: 'true', limit: '5000' };
                if (filters.search?.trim()) params.search = filters.search.trim();
                if (filters.status === 'available' || filters.status === 'listed' || filters.status === 'sold') params.status = filters.status;
                else if (filters.status === 'not_sold') params.exclude_status = 'sold';
                if (favoriteIdsCsv) params.ids = favoriteIdsCsv;
                openAuthExport('/api/inventory/export', params);
              }}
              pageInfo={{
                currentPage: pageIndex + 1,
                totalPages,
                totalItems,
              }}
              onPrevPage={() => setPageIndex((p) => Math.max(0, p - 1))}
              onNextPage={() => setPageIndex((p) => p + 1)}
              onOpenFilters={handleOpenFiltersDialog}
              onSaveFilters={handleSaveFilters}
              onClearFilters={handleClearFilters}
              renderAdditionalFilters={() => (
                <>
                  <div>
                    <Label htmlFor="mobile-status" className="text-xs mb-1.5 block">Status</Label>
                    <Select id="mobile-status" value={tempFilters.status} onValueChange={val => setTempFilters(f => ({ ...f, status: val }))}>
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
                    <Label htmlFor="mobile-sort" className="text-xs mb-1.5 block">Sort By</Label>
                    <Select id="mobile-sort" value={tempSort} onValueChange={setTempSort}>
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
                  {tempFilters.daysInStock === "returnDeadline" && (
                    <div>
                      <Button
                        variant={showDismissedReturns ? "default" : "outline"}
                        size="sm"
                        onClick={() => setShowDismissedReturns((prev) => !prev)}
                        className="w-full"
                      >
                        <AlarmClock className="w-4 h-4 mr-2" />
                        {showDismissedReturns ? "Showing Dismissed" : "Show Dismissed"}
                        {dismissedReturnsCount > 0 && (
                          <span className="ml-2 text-xs">({dismissedReturnsCount})</span>
                        )}
                      </Button>
                    </div>
                  )}
                </>
              )}
            />
          </div>

          {/* Desktop Filters Dialog Trigger - Hidden since we show the filter card */}
          <div className="hidden mb-4">
            <div className="flex gap-2">
              <Button
                onClick={handleOpenFiltersDialog}
                variant="outline"
                className="flex-1 justify-between"
                size="lg"
              >
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  <span>Filters & Sort</span>
                  {hasActiveFilters && (
                    <span className="ml-1 px-1.5 py-0.5 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100 rounded">
                      Active
                    </span>
                  )}
                </div>
                <ChevronDown className="w-4 h-4" />
              </Button>
              {hasActiveFilters && (
                <Button
                  onClick={() => {
                    setFilters({ search: "", status: "not_sold", daysInStock: "all" });
                    setSort("newest");
                  }}
                  variant="outline"
                  size="lg"
                  className="px-4"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Filters Dialog (Desktop & Mobile) */}
          <Dialog open={filtersDialogOpen} onOpenChange={setFiltersDialogOpen}>
            <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-3xl w-full">
              <DialogHeader>
                <DialogTitle>Filters & Sort</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="temp-status" className="text-xs mb-1.5 block">Status</Label>
                    <Select id="temp-status" value={tempFilters.status} onValueChange={val => setTempFilters(f => ({ ...f, status: val }))}>
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
                    <Label htmlFor="temp-sort" className="text-xs mb-1.5 block">Sort By</Label>
                    <Select id="temp-sort" value={tempSort} onValueChange={setTempSort}>
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
                <div className="text-xs text-muted-foreground">
                  Showing <span className="font-semibold text-foreground">{inventoryItems.length}</span>
                  {totalItems ? (
                    <>
                      {" "}
                      of <span className="font-semibold text-foreground">{totalItems}</span>
                    </>
                  ) : null}
                  {" "}items
                  {" "}• page <span className="font-semibold text-foreground">{pageIndex + 1}</span>
                  {" "}of <span className="font-semibold text-foreground">{totalPages}</span>
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={handleSaveFilters}
                  className="w-full"
                >
                  Save
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Desktop Filter Card */}
          <Card className="hidden md:block border-0 shadow-lg mb-4">
            <CardHeader className="border-b bg-card">
              <CardTitle className="text-base sm:text-lg text-foreground">Filters & Sort</CardTitle>
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
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
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
                <div className="flex items-end">
                  <div className="text-xs text-muted-foreground">
                    Showing <span className="font-semibold text-foreground">{inventoryItems.length}</span>
                    {totalItems ? (
                      <>
                        {" "}
                        of <span className="font-semibold text-foreground">{totalItems}</span>
                      </>
                    ) : null}
                    {" "}items
                    {" "}• page <span className="font-semibold text-foreground">{pageIndex + 1}</span>
                    {" "}of <span className="font-semibold text-foreground">{totalPages}</span>
                  </div>
                </div>
              </div>
              <div className="mt-4 space-y-3 md:space-y-0 md:flex md:flex-row md:flex-wrap md:items-center md:justify-between md:gap-3 min-w-0 overflow-x-hidden">
                <div className="text-xs text-muted-foreground min-w-0 break-words">
                  Favorites let you flag items for quick actions such as returns.
                </div>
                <div className="flex flex-col md:flex-row gap-2 md:flex-wrap md:items-center items-start min-w-0 w-full md:w-auto">
                  {/* Per Page Selector */}
                  <div className="flex items-center gap-2 w-full md:w-auto">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">Per Page:</span>
                    <Select
                      value={String(pageSize)}
                      onValueChange={(v) => {
                        const n = Number(v);
                        if (n === 50 || n === 100 || n === 200) setPageSize(n);
                      }}
                    >
                      <SelectTrigger className="h-8 w-[85px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                        <SelectItem value="200">200</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Pagination Buttons */}
                  <div className="flex gap-2 items-center w-full md:w-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!canPrev}
                      onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
                      className="flex-1 md:flex-initial"
                    >
                      Prev
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!canNext}
                      onClick={() => setPageIndex((p) => p + 1)}
                      className="flex-1 md:flex-initial"
                    >
                      Next
                    </Button>
                  </div>
                  
                  {/* Export */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const params = { exclude_deleted: 'true', limit: '5000' };
                      if (filters.search?.trim()) params.search = filters.search.trim();
                      if (filters.status === 'available' || filters.status === 'listed' || filters.status === 'sold') params.status = filters.status;
                      else if (filters.status === 'not_sold') params.exclude_status = 'sold';
                      if (favoriteIdsCsv) params.ids = favoriteIdsCsv;
                      openAuthExport('/api/inventory/export', params);
                    }}
                    className="self-start md:self-auto"
                  >
                    Export
                  </Button>
                  
                  {/* Show Dismissed Returns */}
                  {filters.daysInStock === "returnDeadline" && (
                    <Button
                      variant={showDismissedReturns ? "default" : "outline"}
                      size="sm"
                      onClick={() => setShowDismissedReturns((prev) => !prev)}
                      className="flex items-center gap-2 min-w-0 max-w-full"
                    >
                      <AlarmClock className={`w-4 h-4 flex-shrink-0 ${showDismissedReturns ? "" : ""}`} />
                      <span className="truncate">{showDismissedReturns ? "Showing Dismissed" : "Show Dismissed"}</span>
                      {dismissedReturnsCount > 0 && (
                        <span className="text-xs font-normal opacity-80 flex-shrink-0">({dismissedReturnsCount})</span>
                      )}
                    </Button>
                  )}
                  
                  {/* Show Favorites */}
                  {!showFavoritesOnly && (
                    <Button
                      variant={showFavoritesOnly ? "default" : "outline"}
                      size="sm"
                      onClick={() => setShowFavoritesOnly((prev) => !prev)}
                      className="flex items-center gap-2 min-w-0 max-w-full"
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

          {/* Duplicate Items Alert */}
          {activeDuplicates.length > 0 && (
            <Alert className="mb-4 border-orange-200 bg-orange-50 dark:bg-orange-900/20 dark:border-orange-800">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <AlertDescription className="text-orange-800 dark:text-orange-200">
                    <div className="flex items-center gap-2 mb-2">
                      <Package className="w-5 h-5 flex-shrink-0" />
                      <span className="font-semibold">Duplicate Items Detected</span>
                    </div>
                    <p className="text-sm mt-1">
                      Found {activeDuplicates.length} item{activeDuplicates.length === 1 ? '' : 's'} with duplicate titles. Please check:
                    </p>
                    <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                      {activeDuplicates.slice(0, 5).map((dup, idx) => (
                        <li key={idx}>
                          <span className="font-medium">"{dup.title}"</span> - {dup.items.length} item{dup.items.length === 1 ? '' : 's'}
                        </li>
                      ))}
                      {activeDuplicates.length > 5 && (
                        <li className="text-xs opacity-75">...and {activeDuplicates.length - 5} more</li>
                      )}
                    </ul>
                  </AlertDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    activeDuplicates.forEach(dup => handleDismissDuplicate(dup.normalizedTitle));
                  }}
                  className="text-orange-800 hover:bg-orange-100 dark:text-orange-200 dark:hover:bg-orange-900/40 flex-shrink-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </Alert>
          )}

          {showDismissedReturns && (
            <div className="sticky top-0 z-40 mb-4 p-4 bg-gradient-to-r from-blue-500 to-indigo-600 dark:from-blue-600 dark:to-indigo-700 text-white rounded-lg shadow-lg border border-blue-400 dark:border-blue-500">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <AlarmClock className="w-5 h-5 flex-shrink-0" />
                  <span className="font-semibold text-sm sm:text-base">
                    Viewing Dismissed Return Reminders ({dismissedReturnsCount})
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDismissedReturns(false)}
                  className="text-white hover:bg-white/20 flex-shrink-0"
                >
                  <X className="w-4 h-4 mr-1" />
                  <span className="hidden sm:inline">Clear Filter</span>
                </Button>
              </div>
            </div>
          )}

          {selectedItems.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-card rounded-lg min-w-0 overflow-x-hidden">
              <span className="text-sm font-medium min-w-0 break-words">
                {selectedItems.length} item{selectedItems.length === 1 ? "" : "s"} selected
              </span>
              <div className="flex flex-wrap gap-2 min-w-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setGroupDialogOpen(true)}
                  className="min-w-0 max-w-full bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/20 dark:hover:bg-purple-900/30 border-purple-200 dark:border-purple-800"
                >
                  <FolderPlus className="w-4 h-4 mr-2 flex-shrink-0" />
                  <span className="truncate">Create Group</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    resetBulkUpdateForm();
                    setBulkUpdateDialogOpen(true);
                  }}
                  disabled={bulkUpdateMutation.isPending}
                  className="min-w-0 max-w-full"
                >
                  <Edit className="w-4 h-4 mr-2 flex-shrink-0" />
                  <span className="truncate">{bulkUpdateMutation.isPending ? "Updating..." : "Bulk Update"}</span>
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setBulkDeleteDialogOpen(true)}
                  disabled={bulkDeleteMutation.isPending}
                  className="min-w-0 max-w-full"
                >
                  <Trash2 className="w-4 h-4 mr-2 flex-shrink-0" />
                  <span className="truncate">
                    {bulkDeleteMutation.isPending ? "Deleting..." : "Delete"}
                  </span>
                </Button>
              </div>
            </div>
          )}

          {sortedItems.length > 0 && (
            <div className="flex items-center justify-between gap-3 p-4 bg-card rounded-t-lg">
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={selectedItems.length === sortedItems.length && sortedItems.length > 0}
                  onCheckedChange={handleSelectAll}
                  id="select-all"
                  className="!h-[22px] !w-[22px] !bg-transparent !border-green-600 border-2 data-[state=checked]:!bg-green-600 data-[state=checked]:!border-green-600 [&[data-state=checked]]:!bg-green-600 [&[data-state=checked]]:!border-green-600 flex-shrink-0 [&_svg]:!h-[16px] [&_svg]:!w-[16px]"
                />
                <div className="flex flex-col">
                  <label htmlFor="select-all" className="text-sm font-medium cursor-pointer text-foreground">
                    Select All ({sortedItems.length})
                  </label>
                  <span className="text-xs text-gray-600 dark:text-gray-400 md:hidden">
                    Tap image to select
                  </span>
                  <span className="text-xs text-gray-600 dark:text-gray-400 hidden md:block">Click image to select for bulk edit</span>
                </div>
              </div>
              
              {/* View toggle button (mobile and desktop) */}
              <Button
                variant="outline"
                onClick={() => setViewMode((v) => (v === "list" ? "grid" : "list"))}
                className="flex-shrink-0"
                size="sm"
              >
                {viewMode === "list" ? <Grid2X2 className="w-4 h-4 mr-1" /> : <Rows className="w-4 h-4 mr-1" />}
                {viewMode === "list" ? "Grid" : "List"}
              </Button>
            </div>
          )}

          {isLoading ? (
            <div className="p-12 text-center text-muted-foreground">Loading...</div>
          ) : sortedItems.length > 0 ? (
            viewMode === "gallery" ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 overflow-x-hidden max-w-full">
                {sortedItems.map((item) => {
                  const rawQuantity = Number(item.quantity ?? 1);
                  const quantity = Number.isFinite(rawQuantity) && rawQuantity > 0 ? rawQuantity : 1;
                  const rawSold = Number(item.quantity_sold ?? 0);
                  const quantitySold = Number.isFinite(rawSold) && rawSold >= 0 ? rawSold : 0;
                  const remaining = Math.max(quantity - quantitySold, 0);
                  return (
                    <div 
                      key={item.id} 
                      className="group block"
                      ref={highlightId && item.id === highlightId ? highlightRef : null}
                    >
                      <div className={`relative overflow-hidden rounded-2xl border ${selectedItems.includes(item.id) ? 'border-green-500 dark:border-green-500 ring-4 ring-green-500/50 shadow-lg shadow-green-500/30' : highlightId && item.id === highlightId ? 'border-blue-500 dark:border-blue-500 ring-4 ring-blue-500/50 shadow-lg shadow-blue-500/30' : 'border-border/60'} bg-card/60 hover:bg-muted/40 transition-colors`}>
                        <div 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelect(item.id);
                          }}
                          className="relative aspect-square bg-gray-50 dark:bg-card/70 cursor-pointer"
                        >
                          <OptimizedImage
                            src={item.image_url || DEFAULT_IMAGE_URL}
                            alt={item.item_name}
                            fallback={DEFAULT_IMAGE_URL}
                            className="w-full h-full object-cover"
                            lazy={true}
                          />
                          {selectedItems.includes(item.id) && (
                            <div className="absolute top-2 left-2 z-20">
                              <div className="bg-green-600 rounded-full p-1 shadow-lg">
                                <Check className="w-4 h-4 text-white" />
                              </div>
                            </div>
                          )}
                          <div className="absolute top-2 right-2 rounded-full bg-black/70 text-white text-[11px] px-2 py-0.5">
                            x{remaining}
                          </div>
                        </div>
                        <Link
                          to={createPageUrl(`AddInventoryItem?id=${item.id}`)}
                          state={returnStateForInventory}
                          className="block p-3"
                        >
                          <div className="text-sm font-semibold text-foreground line-clamp-2">
                            {item.item_name || "Untitled Item"}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                            <span>${Number(item.purchase_price || 0).toFixed(2)}</span>
                            {item.purchase_date && <span>• {format(parseISO(item.purchase_date), "MMM d, yyyy")}</span>}
                            {item.source && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                {sourceIcons[item.source] && <img src={sourceIcons[item.source]} alt={item.source} className="w-2.5 h-2.5" />}
                                {item.source}
                              </span>
                            )}
                          </div>
                          {/* Show Mercari metrics for items from Mercari source (on_sale/available status only) */}
                          {item.source === 'Mercari' && (item.mercari_likes > 0 || item.mercari_views > 0) && (item.status === 'available' || item.status === 'listed' || item.status === 'on_sale') && (
                            <div className="mt-2 flex items-center gap-2 flex-wrap">
                              {item.mercari_likes > 0 && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200">
                                  <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                                  </svg>
                                  {item.mercari_likes}
                                </span>
                              )}
                              {item.mercari_views > 0 && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                  <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                                    <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                                  </svg>
                                  {item.mercari_views}
                                </span>
                              )}
                            </div>
                          )}
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : viewMode === "list" ? (
              <div className="space-y-6 sm:space-y-6 overflow-x-hidden max-w-full mt-6">
                {sortedItems.map(item => {
                  const today = new Date();
                  const deadline = item.return_deadline ? parseISO(item.return_deadline) : null;
                  const daysRemaining = deadline && isAfter(deadline, today) ? differenceInDays(deadline, today) + 1 : null;
                  const perItemPrice = (item.purchase_price || 0) / (item.quantity > 0 ? item.quantity : 1);
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
                      className="w-full max-w-full"
                      ref={highlightId && item.id === highlightId ? highlightRef : null}
                    >
                      {/* Mobile/Tablet list layout - Restructured */}
                      <div
                        className={`lg:hidden product-list-item relative flex flex-col mb-6 sm:mb-6 min-w-0 w-full bg-white dark:bg-card border ${selectedItems.includes(item.id) ? 'border-green-500 dark:border-green-500' : highlightId && item.id === highlightId ? 'border-blue-500 dark:border-blue-500 ring-4 ring-blue-500/50 shadow-lg shadow-blue-500/30' : 'border-gray-200 dark:border-border'} shadow-sm dark:shadow-lg ${isDeleted ? 'opacity-75' : ''} cursor-pointer hover:shadow-md transition-shadow`}
                        style={{
                          minHeight: 'auto',
                          height: 'auto',
                          borderRadius: '16px',
                          overflow: 'hidden',
                          maxWidth: '100%',
                          width: '100%',
                          boxSizing: 'border-box',
                          flexShrink: 0,
                          paddingBottom: '0'
                        }}
                        onClick={(e) => {
                          const isButton = e.target.closest('button, a, input, [role="button"]');
                          const isImage = e.target.closest('.item-image-clickable');
                          
                          if (isImage) {
                            handleSelect(item.id);
                          } else if (!isButton) {
                            setItemToView(item);
                            setViewDialogOpen(true);
                          }
                        }}
                      >
                      {/* Mobile return banner - attached at top */}
                      {item.return_deadline && daysRemaining !== null && !item.return_deadline_dismissed && (
                        <div className="md:hidden w-full bg-red-500 dark:bg-red-600 text-white px-3 py-2">
                          <p className="font-semibold text-[11px] flex items-center gap-1.5">
                            <AlarmClock className="w-3.5 h-3.5" />
                            Return in {daysRemaining} day{daysRemaining !== 1 ? 's' : ''}
                          </p>
                        </div>
                      )}
                      
                      {/* Row 1: Image and 4 Icon Buttons + Status/Tags */}
                      <div className="flex flex-row items-start gap-3 p-3">
                        {/* Image */}
                        <div className="flex-shrink-0 w-[138px] sm:w-[173px] min-w-[138px] sm:min-w-[173px] max-w-[138px] sm:max-w-[173px]">
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelect(item.id);
                            }}
                            className="item-image-clickable md:cursor-default cursor-pointer glass flex items-center justify-center relative w-[138px] sm:w-[173px] min-w-[138px] sm:min-w-[173px] max-w-[138px] sm:max-w-[173px] h-[138px] sm:h-[173px] transition-all duration-200 overflow-hidden bg-gray-50 dark:bg-card/70 border border-gray-200 dark:border-border hover:opacity-90 hover:shadow-md"
                            style={{
                              borderRadius: '12px',
                              flexShrink: 0
                            }}
                          >
                            {Array.isArray(item.images) && item.images.filter(Boolean).length > 1 ? (
                              <ImageCarousel
                                images={(item.images || [])
                                  .filter(Boolean)
                                  .map((img) => (typeof img === "string" ? img : img.imageUrl || img.url || img))}
                                imageClassName="object-cover"
                                counterPosition="bottom"
                              />
                            ) : (
                              <OptimizedImage
                                src={item.image_url || DEFAULT_IMAGE_URL}
                                alt={item.item_name}
                                fallback={DEFAULT_IMAGE_URL}
                                className="w-full h-full object-cover"
                                lazy={true}
                              />
                            )}
                            {selectedItems.includes(item.id) && (
                              <div className="absolute top-2 left-2 z-20">
                                <div className="bg-green-600 rounded-full p-1 shadow-lg">
                                  <Check className="w-4 h-4 text-white" />
                                </div>
                              </div>
                            )}
                            
                            {/* Quantity badge - bottom right */}
                            {availableToSell > 0 && (
                              <div className="absolute bottom-2 right-2 z-20">
                                <div className="bg-gradient-to-br from-blue-600 to-blue-700 dark:from-blue-500 dark:to-blue-600 rounded-lg px-2 py-1 shadow-lg flex items-center gap-1">
                                  <Package className="w-3 h-3 text-white" />
                                  <span className="text-white font-semibold text-xs">
                                    {availableToSell}
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Search and More Actions buttons + Add Tags + Status - Mobile only */}
                        <div className="sm:hidden flex-1 flex flex-col gap-2">
                          {/* Search and More Actions buttons */}
                          <div className="grid grid-cols-2 gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const query = item.item_name || "";
                                if (isMobile) {
                                  // On mobile, navigate to ProductSearch page with query and return path
                                  navigate(`/product-search?q=${encodeURIComponent(query)}&from=inventory`);
                                } else {
                                  // On desktop, open dialog
                                  setProductSearchQuery(query);
                                  setProductSearchOpen(true);
                                }
                              }}
                              className="inline-flex h-10 items-center justify-center rounded-md border border-gray-200 dark:border-border bg-white dark:bg-card/80 hover:bg-gray-50 dark:hover:bg-slate-900 text-foreground transition-all shadow-md"
                            >
                              <Search className="h-5 w-5" />
                            </button>
                            
                            {/* More Actions Dropdown */}
                            <div className="relative">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenDropdown(openDropdown === item.id ? null : item.id);
                                }}
                                className="inline-flex h-10 w-full items-center justify-center rounded-md border border-gray-200 dark:border-border bg-white dark:bg-card/80 hover:bg-gray-50 dark:hover:bg-slate-900 text-foreground transition-all shadow-md"
                              >
                                <MoreVertical className="h-5 w-5" />
                              </button>
                              
                              {openDropdown === item.id && (
                                <div className="absolute right-0 top-full mt-1 z-50 w-48 bg-white dark:bg-card border border-gray-200 dark:border-border rounded-lg shadow-lg overflow-hidden">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setOpenDropdown(null);
                                      toggleFavorite(item.id);
                                    }}
                                    className={`w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm transition-colors ${
                                      favoriteMarked
                                        ? "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20"
                                        : "text-foreground hover:bg-gray-100 dark:hover:bg-slate-900"
                                    }`}
                                  >
                                    <Star className={`w-4 h-4 ${favoriteMarked ? "fill-current" : ""}`} />
                                    {favoriteMarked ? "Remove from Favorites" : "Set as Favorite"}
                                  </button>
                                  
                                  {item.image_url && item.image_url !== DEFAULT_IMAGE_URL && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setOpenDropdown(null);
                                        handleEditImage(e, item);
                                      }}
                                      className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm text-foreground hover:bg-gray-100 dark:hover:bg-slate-900 transition-colors"
                                    >
                                      <ImageIcon className="w-4 h-4" />
                                      Edit Image
                                    </button>
                                  )}
                                  
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setOpenDropdown(null);
                                      handleDeleteClick(item);
                                    }}
                                    className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                    Delete Item
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Tags button - takes up most of row */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setTagDrafts((prev) => ({ ...prev, [`show_${item.id}`]: !prev[`show_${item.id}`] }));
                            }}
                            className="inline-flex h-7 px-3 items-center justify-center rounded-md border border-gray-300 dark:border-border transition text-muted-foreground hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/20 text-[10px] font-medium w-full"
                          >
                            {tagDrafts[`show_${item.id}`] ? (
                              <Minus className="h-3 w-3 mr-1" />
                            ) : (
                              <Plus className="h-3 w-3 mr-1" />
                            )}
                            Tags
                          </button>

                          {/* Status badge - on its own row, left-aligned */}
                          <div className="flex justify-start">
                            <Badge variant="outline" className={`${statusColors[item.status]} text-[9px] px-1.5 py-0.5`}>
                              {statusLabels[item.status] || statusLabels.available}
                            </Badge>
                          </div>
                        </div>

                        {/* Desktop content - keep original */}
                        <div className="hidden sm:flex flex-1 flex-col justify-start items-start px-2 sm:px-6 py-2 sm:py-6 sm:border-r min-w-0 overflow-hidden relative"
                          style={{
                            borderColor: 'rgba(229, 231, 235, 0.8)',
                            flexShrink: 1,
                            minWidth: 0
                          }}
                        >
                          <div className="absolute left-0 top-0 w-px h-full bg-gray-300"></div>
                          
                          {/* Status badge above title - Desktop only */}
                          <div className="mb-2">
                            <Badge variant="outline" className={`${statusColors[item.status]} text-[10px] px-1.5 py-0.5`}>
                              {statusLabels[item.status] || statusLabels.available}
                            </Badge>
                          </div>
                          
                          <Link to={createPageUrl(`AddInventoryItem?id=${item.id}`)} state={returnStateForInventory} className="block mb-1 sm:mb-3 w-full text-left">
                            <h3 className="text-xl font-bold text-foreground hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer break-words line-clamp-2 text-left"
                              style={{ letterSpacing: '0.3px', lineHeight: '1.35' }}>
                              {item.item_name || 'Untitled Item'}
                            </h3>
                          </Link>

                          <div className="space-y-1.5 text-xs sm:text-sm mb-2 sm:mb-4 text-gray-700 dark:text-gray-300 break-words">
                            <div>
                              <span>Price: </span>
                              <span className="font-medium text-foreground">
                                ${(item.purchase_price || 0).toFixed(2)}
                                {item.quantity > 1 && <span className="text-gray-600 dark:text-gray-400 ml-1">(${(perItemPrice || 0).toFixed(2)} ea)</span>}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span>Qty: {item.quantity}</span>
                              {quantitySold > 0 && (
                                <span className={`font-medium ${isSoldOut ? 'text-red-600 dark:text-red-400 font-bold' : 'text-blue-600 dark:text-blue-400'}`}>
                                  {isSoldOut ? '(Sold Out)' : `(${quantitySold} sold)`}
                                </span>
                              )}
                            </div>
                            <div>
                              <span>Purchase Date: </span>
                              <span className="font-medium text-foreground">
                                {item.purchase_date ? format(parseISO(item.purchase_date), 'MMM dd, yyyy') : '—'}
                              </span>
                            </div>
                            {item.condition && (
                              <div>
                                <span>Condition: </span>
                                <span className="font-medium text-foreground">{item.condition}</span>
                              </div>
                            )}
                            {item.brand && (
                              <div>
                                <span>Brand: </span>
                                <span className="font-medium text-foreground">{item.brand}</span>
                              </div>
                            )}
                            {item.size && (
                              <div>
                                <span>Size: </span>
                                <span className="font-medium text-foreground">{item.size}</span>
                              </div>
                            )}
                            {item.category && (
                              <div>
                                <span>Category: </span>
                                <span className="font-medium text-foreground">{item.category}</span>
                              </div>
                            )}
                            {item.source && (
                              <div>
                                <span>Source: </span>
                                <span className="font-medium text-foreground">{item.source}</span>
                              </div>
                            )}
                            
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
                                  handleDeleteClick(item);
                                }}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-transparent transition text-muted-foreground hover:text-red-400 hover:bg-red-600/20"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>

                          {isDeleted && daysUntilPermanentDelete !== null && (
                            <div className="mt-2 sm:mt-3 p-2 bg-orange-100 border-l-2 border-orange-500 rounded-r text-orange-800">
                              <p className="font-semibold text-xs flex items-center gap-1">
                                <AlarmClock className="w-3 h-3" />
                                {daysUntilPermanentDelete} day{daysUntilPermanentDelete !== 1 ? 's' : ''} until permanent deletion
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Row 2: Title and View Details - Mobile only */}
                      <div className="sm:hidden w-full px-3 pb-3">
                        {/* Title */}
                        <div className="mb-2">
                          <h3 className="text-sm font-bold text-foreground break-words line-clamp-2 text-left"
                            style={{ 
                              letterSpacing: '0.3px', 
                              lineHeight: '1.35',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical'
                            }}>
                            {item.item_name || 'Untitled Item'}
                          </h3>
                        </div>

                        {/* View Details Dropdown */}
                        <div className="border border-gray-200 dark:border-border rounded-lg overflow-hidden">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedDetails(prev => ({ ...prev, [item.id]: !prev[item.id] }));
                            }}
                            className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-card/50 hover:bg-gray-100 dark:hover:bg-card/70 transition-colors"
                          >
                            <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                              <Eye className="w-4 h-4" />
                              View Details
                            </span>
                            {expandedDetails[item.id] ? (
                              <ChevronUp className="w-4 h-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            )}
                          </button>
                          
                          {expandedDetails[item.id] && (
                            <div className="px-3 py-2 space-y-1.5 bg-white dark:bg-card border-t border-gray-200 dark:border-border">
                              <div className="flex justify-between items-center">
                                <span className="text-[11px] text-gray-600 dark:text-gray-400">Status:</span>
                                <Badge variant="outline" className="text-[9px] px-2 py-0.5">
                                  {statusLabels[item.status] || statusLabels.available}
                                </Badge>
                              </div>
                              
                              <div className="flex justify-between items-center">
                                <span className="text-[11px] text-gray-600 dark:text-gray-400">Category:</span>
                                <span className="text-[11px] font-medium text-foreground">{item.category || "—"}</span>
                              </div>
                              
                              <div className="flex justify-between items-center">
                                <span className="text-[11px] text-gray-600 dark:text-gray-400">Price:</span>
                                <span className="text-[11px] font-medium text-foreground">
                                  ${(item.purchase_price || 0).toFixed(2)}
                                  {item.quantity > 1 && (
                                    <span className="text-gray-600 dark:text-gray-400 text-[10px] ml-1">
                                      (${(perItemPrice || 0).toFixed(2)} ea)
                                    </span>
                                  )}
                                </span>
                              </div>
                              
                              <div className="flex justify-between items-center">
                                <span className="text-[11px] text-gray-600 dark:text-gray-400">Quantity:</span>
                                <span className="text-[11px] font-medium text-foreground">
                                  {item.quantity}
                                  {quantitySold > 0 && (
                                    <span className={`ml-1 ${isSoldOut ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>
                                      {isSoldOut ? '(Sold Out)' : `(${quantitySold} sold)`}
                                    </span>
                                  )}
                                </span>
                              </div>
                              
                              <div className="flex justify-between items-center">
                                <span className="text-[11px] text-gray-600 dark:text-gray-400">Purchased:</span>
                                <span className="text-[11px] font-medium text-foreground">
                                  {item.purchase_date ? format(parseISO(item.purchase_date), 'MMM d, yyyy') : '—'}
                                </span>
                              </div>

                              {item.condition && (
                                <div className="flex justify-between items-center">
                                  <span className="text-[11px] text-gray-600 dark:text-gray-400">Condition:</span>
                                  <span className="text-[11px] font-medium text-foreground">{item.condition}</span>
                                </div>
                              )}

                              {item.brand && (
                                <div className="flex justify-between items-center">
                                  <span className="text-[11px] text-gray-600 dark:text-gray-400">Brand:</span>
                                  <span className="text-[11px] font-medium text-foreground">{item.brand}</span>
                                </div>
                              )}

                              {item.size && (
                                <div className="flex justify-between items-center">
                                  <span className="text-[11px] text-gray-600 dark:text-gray-400">Size:</span>
                                  <span className="text-[11px] font-medium text-foreground">{item.size}</span>
                                </div>
                              )}

                              {item.source && (
                                <div className="flex justify-between items-center">
                                  <span className="text-[11px] text-gray-600 dark:text-gray-400">Source:</span>
                                  <Badge variant="outline" className="text-[9px] px-1.5 py-0.5 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-700">
                                    {item.source}
                                  </Badge>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Listing keywords from DB (marketplace-facing, set in Crosslist) */}
                      {Array.isArray(item.listing_keywords) && item.listing_keywords.length > 0 && (
                        <div className="sm:hidden w-full px-3 py-1 flex flex-wrap gap-1">
                          {item.listing_keywords.slice(0, 6).map((kw) => (
                            <span key={kw} className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                              {kw}
                            </span>
                          ))}
                          {item.listing_keywords.length > 6 && (
                            <span className="text-[9px] text-muted-foreground">+{item.listing_keywords.length - 6} more</span>
                          )}
                        </div>
                      )}

                      {/* Row 3: Tags (if any) - Mobile only */}
                      {(itemTags.length > 0 || tagDrafts[`show_${item.id}`]) && (
                        <div className="sm:hidden w-full px-3 py-2 border-t border-gray-200 dark:border-border bg-gray-50 dark:bg-card/50">
                          {itemTags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-2">
                              {itemTags.map((tag) => (
                                <Badge key={tag} variant="secondary" className="flex items-center gap-1 text-[9px]">
                                  {tag}
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRemoveTagFromItem(item.id, tag);
                                    }}
                                    className="text-muted-foreground hover:text-foreground"
                                  >
                                    <X className="h-2.5 w-2.5" />
                                  </button>
                                </Badge>
                              ))}
                            </div>
                          )}
                          {tagDrafts[`show_${item.id}`] && (
                            <div className="flex gap-1">
                              <input
                                type="text"
                                value={tagDrafts[item.id] || ''}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  setTagDrafts((prev) => ({ ...prev, [item.id]: e.target.value }));
                                }}
                                onKeyPress={(e) => {
                                  if (e.key === 'Enter') {
                                    e.stopPropagation();
                                    handleAddTagToItem(item.id, tagDrafts[item.id]);
                                    setTagDrafts((prev) => ({ ...prev, [item.id]: '', [`show_${item.id}`]: false }));
                                  }
                                }}
                                onClick={(e) => e.stopPropagation()}
                                placeholder="Enter tag..."
                                className="flex-1 text-[11px] px-2 py-1 border border-gray-300 dark:border-border rounded-md bg-white dark:bg-card"
                              />
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAddTagToItem(item.id, tagDrafts[item.id]);
                                  setTagDrafts((prev) => ({ ...prev, [item.id]: '', [`show_${item.id}`]: false }));
                                }}
                                className="px-3 py-1 text-[10px] font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-md"
                              >
                                Add
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="hidden sm:flex flex-col items-center justify-center gap-2 px-3 py-3 mr-0 flex-shrink-0 border-t sm:border-t-0 sm:border-l border-gray-200 dark:border-border bg-gray-50 dark:bg-card/80 w-[200px] min-w-[200px] max-w-[200px]"
                        style={{
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
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-3 rounded-md text-center transition-all shadow-md leading-tight text-xs"
                        >
                          View Details
                        </Button>
                      </div>
                      
                      {/* Mobile: Mark Sold and Edit buttons at bottom */}
                      <div className="md:hidden w-full">
                        {/* Buttons */}
                        <div 
                          onClick={(e) => {
                            // Make card clickable for details (except image)
                            const target = e.target;
                            const isImage = target.closest('.glass');
                            const isButton = target.closest('button');
                            if (!isImage && !isButton) {
                              setItemToView(item);
                              setViewDialogOpen(true);
                            }
                          }}
                          className="flex gap-2 px-2 pb-2 border-t border-gray-200 dark:border-border w-full pt-1.5"
                        >
                        {!isSoldOut && item.status !== 'sold' && (
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMarkAsSold(item);
                            }}
                            className="flex-1 text-white font-semibold py-2.5 px-2 rounded-md text-center transition-all shadow-md leading-tight text-sm bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
                          >
                            Mark Sold
                          </Button>
                        )}
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(createPageUrl(`AddInventoryItem?id=${item.id}`), { state: returnStateForInventory });
                          }}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-2 rounded-md text-center transition-all shadow-md leading-tight text-sm"
                        >
                          Edit
                        </Button>
                      </div>
                    </div>
                    </div>
                    
                    {/* Desktop list layout (new) */}
                    <div
                        onClick={(e) => {
                          // Only toggle if NOT clicking on an interactive element
                          const target = e.target;
                          const isInteractive = target.closest('button, a, input, textarea, select, [role="button"]');
                          if (!isInteractive) {
                            handleSelect(item.id);
                          }
                        }}
                        className={`hidden lg:block product-list-item group relative overflow-hidden ${listVariations[viewVariation].gridCols === "grid-cols-[220px_1fr_280px]" ? 'rounded-2xl' : 'rounded-xl'} border cursor-pointer ${selectedItems.includes(item.id) ? 'border-green-500 dark:border-green-500 ring-4 ring-green-500/50 shadow-lg shadow-green-500/30' : highlightId && item.id === highlightId ? 'border-blue-500 dark:border-blue-500 ring-4 ring-blue-500/50 shadow-lg shadow-blue-500/30' : 'border-gray-200/80 dark:border-border'} bg-white/80 dark:bg-card/95 shadow-sm dark:shadow-lg backdrop-blur supports-[backdrop-filter]:bg-white/60 mb-4 ${isDeleted ? 'opacity-75' : ''}`}
                      >
                        <div className={`grid ${listVariations[viewVariation].gridCols} min-w-0`}>
                          {/* Image */}
                          <div className={listVariations[viewVariation].padding}>
                            <div
                              onClick={() => handleSelect(item.id)}
                              className={`relative overflow-hidden rounded-xl border cursor-pointer transition border-gray-200/80 dark:border-border hover:border-gray-300 dark:hover:border-border/80`}
                              style={{ height: listVariations[viewVariation].imageHeight }}
                              title="Click image to select"
                            >
                              {Array.isArray(item.images) && item.images.filter(Boolean).length > 1 ? (
                                <ImageCarousel
                                  images={(item.images || [])
                                    .filter(Boolean)
                                    .map((img) => (typeof img === "string" ? img : img.imageUrl || img.url || img))}
                                  imageClassName="object-cover"
                                  counterPosition="bottom"
                                />
                              ) : (
                                <OptimizedImage
                                  src={item.image_url || DEFAULT_IMAGE_URL}
                                  alt={item.item_name}
                                  fallback={DEFAULT_IMAGE_URL}
                                  className="w-full h-full object-cover"
                                  lazy={true}
                                />
                              )}

                              {selectedItems.includes(item.id) && (
                                <div className="absolute top-2 left-2 z-20">
                                  <div className="bg-green-600 rounded-full p-1 shadow-lg">
                                    <Check className="w-4 h-4 text-white" />
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Details */}
                          <div className={`min-w-0 px-5 ${listVariations[viewVariation].padding} ${selectedItems.includes(item.id) ? '' : 'border-l border-r border-gray-200/70 dark:border-border'}`}>
                            <div className={`flex items-start justify-between gap-3 ${viewVariation === 2 ? 'mb-4' : 'mb-3'}`}>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className={`${statusColors[item.status]} ${gridVariations[viewVariation].badgeClass} rounded-xl`}>
                                  {statusLabels[item.status] || statusLabels.available}
                                </Badge>
                                {item.return_deadline && daysRemaining !== null && !item.return_deadline_dismissed && (
                                  <Badge variant="outline" className="text-[10px] px-2 py-1 rounded-xl border-red-500/40 text-red-700 dark:text-red-300 bg-red-500/10">
                                    Return in {daysRemaining}d
                                  </Badge>
                                )}
                              </div>

                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleFavorite(item.id);
                                  }}
                                  className={`inline-flex ${listVariations[viewVariation].buttonSizeClass} items-center justify-center rounded-lg border border-transparent transition ${
                                    favoriteMarked
                                      ? "bg-amber-500/15 text-amber-500 hover:bg-amber-500/25"
                                      : "text-muted-foreground hover:text-amber-500 hover:bg-muted/40"
                                  }`}
                                  title={favoriteMarked ? "Unfavorite" : "Favorite"}
                                >
                                  <Star className={`${listVariations[viewVariation].iconSizeClass} ${favoriteMarked ? "fill-current" : ""}`} />
                                </button>

                                {item.image_url && item.image_url !== DEFAULT_IMAGE_URL && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEditImage(e, item);
                                    }}
                                    className={`inline-flex ${listVariations[viewVariation].buttonSizeClass} items-center justify-center rounded-lg border border-transparent transition text-muted-foreground hover:text-blue-400 hover:bg-blue-600/20`}
                                    title="Edit photo"
                                  >
                                    <ImageIcon className={listVariations[viewVariation].iconSizeClass} />
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setItemToView(item);
                                    setViewDialogOpen(true);
                                  }}
                                  className={`inline-flex ${listVariations[viewVariation].buttonSizeClass} items-center justify-center rounded-lg border border-transparent transition text-muted-foreground hover:text-green-400 hover:bg-green-600/20`}
                                  title="View details"
                                >
                                  <Search className={listVariations[viewVariation].iconSizeClass} />
                                </button>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteClick(item);
                                  }}
                                  className={`inline-flex ${listVariations[viewVariation].buttonSizeClass} items-center justify-center rounded-lg border border-transparent transition text-muted-foreground hover:text-red-400 hover:bg-red-600/20`}
                                  title="Delete"
                                >
                                  <Trash2 className={listVariations[viewVariation].iconSizeClass} />
                                </button>
                              </div>
                            </div>

                            <Link
                              to={createPageUrl(`AddInventoryItem?id=${item.id}`)}
                              state={returnStateForInventory}
                              className={`block ${viewVariation === 2 ? 'mb-3' : 'mb-2'}`}
                            >
                              <h3 className={`${listVariations[viewVariation].titleClass} text-foreground hover:text-blue-600 dark:hover:text-blue-400 transition-colors break-words line-clamp-2`}>
                                {item.item_name || "Untitled Item"}
                              </h3>
                            </Link>

                            <div className={`grid grid-cols-2 gap-x-8 gap-y-2 ${listVariations[viewVariation].dataTextClass}`}>
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-muted-foreground text-xs font-semibold">Price</span>
                                <span className="font-bold text-foreground tabular-nums">
                                  ${Number(item.purchase_price || 0).toFixed(2)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-muted-foreground text-xs font-semibold">Qty</span>
                                <span className="font-bold text-foreground tabular-nums">
                                  {item.quantity}
                                  {quantitySold > 0 && (
                                    <span className={`ml-2 text-xs font-semibold ${isSoldOut ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>
                                      {isSoldOut ? 'Sold out' : `${quantitySold} sold`}
                                    </span>
                                  )}
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-muted-foreground text-xs font-semibold">Purchased</span>
                                <span className="font-semibold text-foreground tabular-nums">
                                  {item.purchase_date ? format(parseISO(item.purchase_date), 'MMM d, yyyy') : '—'}
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-muted-foreground text-xs font-semibold">Available</span>
                                <span className="font-semibold text-foreground tabular-nums">
                                  {Math.max((item.quantity || 0) - (quantitySold || 0), 0)}
                                </span>
                              </div>
                              {(item.condition || item.brand || item.size || item.category || item.source) && (
                                <>
                                  {item.condition && (
                                    <div className="flex items-center justify-between gap-3">
                                      <span className="text-muted-foreground text-xs font-semibold">Condition</span>
                                      <span className="font-semibold text-foreground text-right truncate">
                                        {item.condition}
                                      </span>
                                    </div>
                                  )}
                                  {item.brand && (
                                    <div className="flex items-center justify-between gap-3">
                                      <span className="text-muted-foreground text-xs font-semibold">Brand</span>
                                      <span className="font-semibold text-foreground text-right truncate">
                                        {item.brand}
                                      </span>
                                    </div>
                                  )}
                                  {item.size && (
                                    <div className="flex items-center justify-between gap-3">
                                      <span className="text-muted-foreground text-xs font-semibold">Size</span>
                                      <span className="font-semibold text-foreground text-right truncate">
                                        {item.size}
                                      </span>
                                    </div>
                                  )}
                                  {item.category && (
                                    <div className="flex items-center justify-between gap-3">
                                      <span className="text-muted-foreground text-xs font-semibold">Category</span>
                                      <span className="font-semibold text-foreground text-right truncate">
                                        {item.category}
                                      </span>
                                    </div>
                                  )}
                                  {item.source && (
                                    <div className="flex items-center justify-between gap-3">
                                      <span className="text-muted-foreground text-xs font-semibold">Source</span>
                                      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                        {sourceIcons[item.source] && <img src={sourceIcons[item.source]} alt={item.source} className="w-3 h-3" />}
                                        {item.source}
                                      </span>
                                    </div>
                                  )}
                                  {/* Show Mercari metrics for items from Mercari (on_sale/available status only) */}
                                  {item.source === 'Mercari' && (item.mercari_likes > 0 || item.mercari_views > 0) && (item.status === 'available' || item.status === 'listed' || item.status === 'on_sale') && (
                                    <>
                                      {item.mercari_likes > 0 && (
                                        <div className="flex items-center justify-between gap-3">
                                          <span className="text-muted-foreground text-xs font-semibold inline-flex items-center gap-1">
                                            <svg className="w-3 h-3 text-pink-600 dark:text-pink-400" fill="currentColor" viewBox="0 0 20 20">
                                              <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                                            </svg>
                                            Likes
                                          </span>
                                          <span className="font-bold text-pink-600 dark:text-pink-400 text-right">
                                            {item.mercari_likes}
                                          </span>
                                        </div>
                                      )}
                                      {item.mercari_views > 0 && (
                                        <div className="flex items-center justify-between gap-3">
                                          <span className="text-muted-foreground text-xs font-semibold inline-flex items-center gap-1">
                                            <svg className="w-3 h-3 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                                              <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                                              <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                                            </svg>
                                            Views
                                          </span>
                                          <span className="font-bold text-blue-600 dark:text-blue-400 text-right">
                                            {item.mercari_views}
                                          </span>
                                        </div>
                                      )}
                                    </>
                                  )}
                                </>
                              )}
                            </div>

                            {itemTags.length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {itemTags.map((tag) => (
                                  <Badge key={tag} variant="secondary" className="flex items-center gap-1 text-[11px]">
                                    {tag}
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveTagFromItem(item.id, tag)}
                                      className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-gray-200 dark:bg-card text-muted-foreground hover:bg-gray-300 dark:hover:bg-card/70"
                                      title="Remove tag"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </Badge>
                                ))}
                              </div>
                            )}

                            {isDeleted && daysUntilPermanentDelete !== null && (
                              <div className="mt-3 p-2 bg-orange-100 dark:bg-orange-900/30 border-l-2 border-orange-500 rounded-r text-orange-800 dark:text-orange-200 text-xs">
                                <p className="font-semibold flex items-center gap-1">
                                  <AlarmClock className="w-3 h-3" />
                                  {daysUntilPermanentDelete} day{daysUntilPermanentDelete !== 1 ? 's' : ''} until permanent deletion
                                </p>
                              </div>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="p-4 bg-gray-50/80 dark:bg-card/80 flex flex-col gap-2">
                            <Button
                              onClick={() => {
                                setItemToView(item);
                                setViewDialogOpen(true);
                              }}
                              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs h-9 shadow-sm"
                            >
                              View Details
                            </Button>

                            {isDeleted ? (
                              <>
                                <Button
                                  onClick={() => recoverItemMutation.mutate(item.id)}
                                  disabled={recoverItemMutation.isPending}
                                  className="w-full bg-green-600 hover:bg-green-700 rounded-xl text-xs h-9"
                                >
                                  <ArchiveRestore className="w-4 h-4 mr-2" />
                                  {recoverItemMutation.isPending ? "Recovering..." : "Recover"}
                                </Button>
                                <Button
                                  onClick={() => {
                                    setItemToPermanentlyDelete(item);
                                    setPermanentDeleteDialogOpen(true);
                                  }}
                                  disabled={permanentDeleteMutation.isPending}
                                  className="w-full bg-red-600 hover:bg-red-700 rounded-xl text-xs h-9"
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  {permanentDeleteMutation.isPending ? "Deleting..." : "Delete Forever"}
                                </Button>
                              </>
                            ) : (
                              <>
                                {!isSoldOut && item.status !== 'sold' && availableToSell > 0 && (
                                  <Button
                                    onClick={() => handleMarkAsSold(item)}
                                    className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-semibold rounded-xl text-xs h-9 shadow-sm shadow-green-500/15"
                                  >
                                    Mark as Sold
                                  </Button>
                                )}

                                <Button
                                  variant="outline"
                                  onClick={() => {
                                    const query = item.item_name || "";
                                    if (isMobile) {
                                      // On mobile, navigate to ProductSearch page
                                      navigate(`/product-search?q=${encodeURIComponent(query)}&from=inventory`);
                                    } else {
                                      // On desktop, open dialog
                                      setProductSearchQuery(query);
                                      setProductSearchOpen(true);
                                    }
                                  }}
                                  className="w-full rounded-xl text-xs h-9 border-gray-300 dark:border-border hover:bg-white dark:hover:bg-slate-900"
                                >
                                  <BarChart className="w-4 h-4 mr-2" />
                                  Search
                                </Button>

                                <Link
                                  to={createPageUrl(`AddInventoryItem?id=${item.id}`)}
                                  state={returnStateForInventory}
                                  className="w-full"
                                >
                                  <Button
                                    variant="outline"
                                    className="w-full rounded-xl text-xs h-9 border-gray-300 dark:border-border hover:bg-white dark:hover:bg-slate-900"
                                  >
                                    <Edit className="w-4 h-4 mr-2" />
                                    Edit Item
                                  </Button>
                                </Link>

                                {isConnected() && !isSoldOut && item.status !== 'sold' && (
                                  <Button
                                    variant="outline"
                                    onClick={() => {
                                      setItemForFacebookListing(item);
                                      setFacebookListingDialogOpen(true);
                                    }}
                                    className="w-full rounded-xl text-xs h-9 border-blue-600/40 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/20"
                                  >
                                    <Facebook className="w-4 h-4 mr-2" />
                                    List on FB
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
            <div className={`grid ${gridVariations[viewVariation].containerClass}`}>
              {sortedItems.map(item => {
                const today = new Date();
                const deadline = item.return_deadline ? parseISO(item.return_deadline) : null;
                const daysRemaining = deadline && isAfter(deadline, today) ? differenceInDays(deadline, today) + 1 : null;
                const perItemPrice = (item.purchase_price || 0) / (item.quantity > 0 ? item.quantity : 1);
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
                className={`group overflow-hidden transition-all duration-300 ${gridVariations[viewVariation].hoverEffect} bg-gradient-to-br from-white to-gray-50 dark:from-card dark:to-card/80 shadow-sm dark:shadow-lg ${gridVariations[viewVariation].cardClass} ${selectedItems.includes(item.id) ? 'border-green-500 dark:border-green-500 ring-4 ring-green-500/50 shadow-lg shadow-green-500/30' : ''} ${isDeleted ? 'opacity-75 border-2 border-red-300 dark:border-red-700' : 'border-gray-200 dark:border-border'}`}
              >
                <div className={`relative ${gridVariations[viewVariation].imageWrapperClass} overflow-hidden bg-gray-50 dark:bg-card/70`}
                >
                  <div
                    onClick={() => handleSelect(item.id)}
                    className="block w-full h-full cursor-pointer"
                  >
                    {Array.isArray(item.images) && item.images.filter(Boolean).length > 1 ? (
                      <ImageCarousel
                        images={(item.images || [])
                          .filter(Boolean)
                          .map((img) => (typeof img === "string" ? img : img.imageUrl || img.url || img))}
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
                    <Badge variant="outline" className={`${statusColors[item.status]} ${gridVariations[viewVariation].badgeClass} backdrop-blur-sm`}>
                      {statusLabels[item.status] || statusLabels.available}
                    </Badge>
                  </div>
                  {itemDuplicates[item.id] && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedItemForDuplicates({
                          id: item.id,
                          item_name: item.item_name,
                          purchase_price: item.purchase_price,
                          purchase_date: item.purchase_date,
                          image_url: item.image_url,
                          images: item.images,
                          source: item.source,
                        });
                        setDuplicateDialogOpen(true);
                      }}
                      className="absolute bottom-2 left-2 z-10"
                    >
                      <Badge 
                        variant="outline" 
                        className="bg-amber-500/90 text-white border-amber-600 backdrop-blur-sm hover:bg-amber-600 cursor-pointer transition-colors"
                      >
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        {itemDuplicates[item.id].duplicate_count} Duplicate{itemDuplicates[item.id].duplicate_count > 1 ? 's' : ''}
                      </Badge>
                    </button>
                  )}
                </div>

                    <CardContent className={gridVariations[viewVariation].paddingClass}>
                      <div className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 ${viewVariation === 2 ? 'mb-4' : 'mb-3'}`}>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => toggleFavorite(item.id)}
                            className={`inline-flex ${gridVariations[viewVariation].buttonSizeClass} items-center justify-center rounded-md border border-transparent transition ${
                              favoriteMarked
                                ? "bg-amber-500/15 text-amber-500 hover:bg-amber-500/25"
                                : "text-gray-700 dark:text-gray-300 hover:text-amber-500 hover:bg-amber-500/10"
                            }`}
                            title={favoriteButtonLabel}
                          >
                            <Star className={`${gridVariations[viewVariation].iconSizeClass} ${favoriteMarked ? "fill-current" : ""}`} />
                            <span className="sr-only">{favoriteButtonLabel}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const query = item.item_name || "";
                              if (isMobile) {
                                // On mobile, navigate to ProductSearch page
                                navigate(`/product-search?q=${encodeURIComponent(query)}&from=inventory`);
                              } else {
                                // On desktop, open dialog
                                setProductSearchQuery(query);
                                setProductSearchOpen(true);
                              }
                            }}
                            className={`inline-flex ${gridVariations[viewVariation].buttonSizeClass} items-center justify-center rounded-md border border-transparent transition text-muted-foreground hover:text-blue-600 hover:bg-blue-600/10`}
                            title="Search"
                          >
                            <BarChart className={gridVariations[viewVariation].iconSizeClass} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteClick(item)}
                            className={`inline-flex ${gridVariations[viewVariation].buttonSizeClass} items-center justify-center rounded-md border border-transparent transition text-muted-foreground hover:text-red-600 hover:bg-red-600/10`}
                            title="Delete"
                          >
                            <Trash2 className={gridVariations[viewVariation].iconSizeClass} />
                          </button>
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                          {/* Edit Photo Button */}
                          {item.image_url && item.image_url !== DEFAULT_IMAGE_URL && (
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              className="h-7 px-2 text-xs gap-1 bg-gray-100 dark:bg-card hover:bg-gray-200 dark:hover:bg-card/70 text-foreground border-gray-300 dark:border-border"
                              onClick={(e) => handleEditImage(e, item)}
                            >
                              <ImageIcon className="h-3 w-3" />
                              Edit
                            </Button>
                          )}
                          {/* Add Tag Button - Full width on mobile */}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-xs gap-1 border-gray-300 dark:border-border text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 flex-1 sm:flex-initial"
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
                        <h3 className={`${gridVariations[viewVariation].titleClass} text-foreground ${viewVariation === 2 ? 'mb-4' : 'mb-3'} line-clamp-2 hover:text-blue-600 dark:hover:text-blue-400 transition-colors`}>
                          {item.item_name || 'Untitled Item'}
                        </h3>
                      </Link>
                      
                      <div className={`space-y-${viewVariation === 2 ? '2' : '1.5'} ${gridVariations[viewVariation].dataTextClass} mb-3`}>
                        <div className="flex justify-between text-gray-700 dark:text-gray-300">
                          <span>Price:</span>
                          <span className="font-semibold text-foreground">
                            ${(item.purchase_price || 0).toFixed(2)}
                            {item.quantity > 1 && (
                              <span className="text-gray-600 dark:text-gray-400 ml-1">(${(perItemPrice || 0).toFixed(2)} ea)</span>
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-gray-700 dark:text-gray-300">
                          <span>Qty:</span>
                          <span className="font-semibold text-foreground">
                            {item.quantity}
                            {quantitySold > 0 && (
                              <span className={`ml-1 ${isSoldOut ? 'text-red-600 dark:text-red-400 font-bold' : 'text-blue-600 dark:text-blue-400'}`}>
                                {isSoldOut ? '(Sold Out)' : `(${quantitySold} sold)`}
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between text-gray-700 dark:text-gray-300">
                          <span>Purchase Date:</span>
                          <span className="text-foreground">{item.purchase_date ? format(parseISO(item.purchase_date), 'MMM dd, yyyy') : '—'}</span>
                        </div>
                        {item.source && (
                          <div className="flex justify-between items-center text-gray-700 dark:text-gray-300">
                            <span>Source:</span>
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                              {sourceIcons[item.source] && <img src={sourceIcons[item.source]} alt={item.source} className="w-3 h-3" />}
                              {item.source}
                            </span>
                          </div>
                        )}
                      </div>

                      {itemTags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {itemTags.map((tag) => (
                            <Badge key={tag} variant="secondary" className="flex items-center gap-1 text-[11px] bg-gray-100 dark:bg-card text-gray-700 dark:text-muted-foreground border-gray-300 dark:border-border">
                              {tag}
                              <button
                                type="button"
                                onClick={() => handleRemoveTagFromItem(item.id, tag)}
                                className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-gray-200 dark:bg-card text-muted-foreground hover:bg-gray-300 dark:hover:bg-card/70"
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
                            <div className="flex gap-2 min-w-0">
                              <Input
                                className="min-w-0 flex-1"
                                value={tagDraftValue}
                                placeholder="e.g. Return Soon"
                                onChange={(e) =>
                                  setTagDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))
                                }
                              />
                              <Button
                                type="button"
                                size="sm"
                                className="whitespace-nowrap flex-shrink-0"
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
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-md"
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
                            <Link
                              to={createPageUrl(`AddInventoryItem?id=${item.id}`)}
                              state={returnStateForInventory}
                              className="flex-1"
                            >
                              <Button variant="outline" size="sm" className="w-full h-8 text-xs border-gray-300 dark:border-border text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700">
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
                                className="h-8 text-xs border-blue-600/50 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              >
                                <Facebook className="w-3 h-3 mr-1" />
                                List on FB
                              </Button>
                            )}
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
              <Package className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <p className="text-muted-foreground text-lg">No inventory items found</p>
              <p className="text-muted-foreground text-sm mt-1">Try adjusting your filters or add a new item.</p>
            </div>
          )}
        </div>
      </div>

      {/* DELETE DIALOG - Permanent delete warning */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={(open) => {
        setDeleteDialogOpen(open);
        if (!open) setItemToDelete(null);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600 dark:text-red-400">
              ⚠️ Permanently Delete Item?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              Are you sure you want to <strong className="text-red-600 dark:text-red-400">permanently delete</strong> <strong>"{itemToDelete?.item_name || 'this item'}"</strong>?
              <br /><br />
              <strong className="text-red-600 dark:text-red-400">This action cannot be undone.</strong> The item will be completely removed from your inventory.
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
              <DatePickerInput
                id="bulk-purchase-date"
                label="Purchase Date"
                value={bulkUpdateForm.purchase_date}
                onChange={(v) => setBulkUpdateForm((prev) => ({ ...prev, purchase_date: v }))}
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
            <AlertDialogTitle className="text-red-600 dark:text-red-400">
              ⚠️ Permanently Delete {selectedItems.length} Items?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              Are you sure you want to <strong className="text-red-600 dark:text-red-400">permanently delete</strong> the {selectedItems.length} selected items?
              <br /><br />
              <strong className="text-red-600 dark:text-red-400">This action cannot be undone.</strong> All selected items will be completely removed from your inventory.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedItems([])}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmBulkDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={bulkDeleteMutation.isPending}
            >
              {bulkDeleteMutation.isPending ? "Deleting..." : "Yes, Delete Permanently"}
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
        allImages={imageToEdit.itemId ? ((inventoryItems.find(i => i.id === imageToEdit.itemId)?.photos) || (inventoryItems.find(i => i.id === imageToEdit.itemId)?.images) || []) : []}
        itemId={imageToEdit.itemId}
        imageIndex={imageToEdit.imageIndex ?? 0}
        onAddImage={async (newImageUrl) => {
          if (!imageToEdit.itemId) return;
          const item = inventoryItems.find(i => i.id === imageToEdit.itemId);
          if (!item) return;
          
          // Add the new image to the item's images array
          const updatedImages = [...(item.images || []), newImageUrl];
          
          try {
            // Update the item with the new images array
            await inventoryApi.update(item.id, {
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

      {/* Product Search Dialog */}
      <EnhancedProductSearchDialog
        open={productSearchOpen}
        onOpenChange={setProductSearchOpen}
        initialQuery={productSearchQuery}
      />

      {ebaySearchDialogOpen ? (
        <React.Suspense fallback={null}>
          <EbaySearchDialog
            open={ebaySearchDialogOpen}
            onOpenChange={setEbaySearchDialogOpen}
            onSelectItem={handleEbayItemSelect}
            initialSearchQuery={ebaySearchInitialQuery}
          />
        </React.Suspense>
      ) : null}

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

      {/* Duplicate Detection Dialog */}
      <DuplicateDetectionDialog
        isOpen={duplicateDialogOpen}
        onClose={() => {
          setDuplicateDialogOpen(false);
          setSelectedItemForDuplicates(null);
        }}
        duplicates={selectedItemForDuplicates ? {
          [selectedItemForDuplicates.id]: {
            importedItem: selectedItemForDuplicates,
            matches: itemDuplicates[selectedItemForDuplicates.id]?.duplicates || []
          }
        } : {}}
        onViewInventory={(inventoryId) => {
          // Highlight the item (already on inventory page)
          const element = document.querySelector(`[data-item-id="${inventoryId}"]`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            element.classList.add('ring-4', 'ring-blue-500');
            setTimeout(() => {
              element.classList.remove('ring-4', 'ring-blue-500');
            }, 2000);
          }
        }}
        onMergeComplete={(primaryItemId) => {
          // Refresh duplicates check after merge
          queryClient.invalidateQueries(['inventoryItems']);
          handleCheckDuplicates();
        }}
      />

      {/* Group Management Dialogs */}
      <GroupDialog
        isOpen={groupDialogOpen}
        onClose={() => {
          setGroupDialogOpen(false);
          setEditingGroup(null);
        }}
        groupType="inventory"
        selectedItemIds={selectedItems}
        existingGroup={editingGroup}
        onSuccess={(groupId) => {
          // Refresh inventory and clear selection
          queryClient.invalidateQueries(['inventoryItems']);
          setSelectedItems([]);
        }}
      />

      <ManageGroupsDialog
        isOpen={manageGroupsDialogOpen}
        onClose={() => setManageGroupsDialogOpen(false)}
        groupType="inventory"
        onEditGroup={(group) => {
          setEditingGroup(group);
          setManageGroupsDialogOpen(false);
          setGroupDialogOpen(true);
        }}
        onDeleteGroup={(groupId) => {
          // Refresh inventory
          queryClient.invalidateQueries(['inventoryItems']);
        }}
      />
    </div>
  );
}
