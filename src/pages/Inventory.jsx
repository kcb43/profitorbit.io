
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, parseISO, differenceInDays, isAfter } from "date-fns";
import { Plus, Package, DollarSign, Trash2, Edit, ShoppingCart, Tag, Filter, AlarmClock, Copy, BarChart, Star, X, TrendingUp, Database } from "lucide-react";
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

const sourceIcons = {
  "Amazon": "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68e86fb5ac26f8511acce7ec/af08cfed1_Logo.png",
};

const statusColors = {
  available: "bg-blue-100 text-blue-800 border border-blue-200",
  listed: "bg-yellow-100 text-yellow-800 border border-yellow-200",
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

  const deleteItemMutation = useMutation({
    mutationFn: async (itemId) => {
      try {
        await base44.entities.InventoryItem.delete(itemId);
        return itemId;
      } catch (error) {
        throw new Error(`Failed to delete item: ${error.message}`);
      }
    },
    onSuccess: (deletedId) => {
      queryClient.invalidateQueries({ queryKey: ['inventoryItems'] });
      setDeleteDialogOpen(false);
      setItemToDelete(null);
      toast({
        title: "Item Deleted",
        description: "The inventory item has been successfully removed.",
      });
    },
    onError: (error) => {
      console.error("Delete error:", error);
      toast({
        title: "Error Deleting Item",
        description: error.message || "Failed to delete item. Please try again.",
        variant: "destructive",
      });
      setDeleteDialogOpen(false);
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (itemIds) => {
      const results = [];
      for (const id of itemIds) {
        try {
          await base44.entities.InventoryItem.delete(id);
          results.push({ id, success: true });
        } catch (error) {
          results.push({ id, success: false, error: error.message });
        }
      }
      return results;
    },
    onSuccess: (results) => {
      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;
      
      queryClient.invalidateQueries({ queryKey: ['inventoryItems'] });
      setSelectedItems([]);
      setBulkDeleteDialogOpen(false);
      
      if (failCount === 0) {
        toast({
          title: "Items Deleted",
          description: `${successCount} selected items have been successfully removed.`,
        });
      } else {
        toast({
          title: "Bulk Delete Completed",
          description: `Deleted ${successCount} items. ${failCount} items failed to delete.`,
          variant: failCount === results.length ? "destructive" : "default",
        });
      }
    },
    onError: (error) => {
      console.error("Bulk delete error:", error);
      toast({
        title: "Error Deleting Items",
        description: "Failed to delete items. Please try again.",
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

  const filteredItems = inventoryItems.filter(item => {
    const today = new Date();

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
          daysInStockMatch = daysUntilDeadline >= 0 && daysUntilDeadline <= 10;
        } else {
          daysInStockMatch = false;
        }
      }
    }
    
    return statusMatch && searchMatch && daysInStockMatch && favoriteMatch;
  });

  const favoritesCount = React.useMemo(() => {
    if (!Array.isArray(inventoryItems)) return 0;
    return inventoryItems.reduce((count, item) => count + (isFavorite(item.id) ? 1 : 0), 0);
  }, [inventoryItems, isFavorite]);

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

  const confirmDelete = () => {
    if (itemToDelete) {
      deleteItemMutation.mutate(itemToDelete.id);
    }
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="p-4 md:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Inventory</h1>
              <p className="text-sm text-muted-foreground mt-1">Track items you have for sale.</p>
            </div>
            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                className="w-full sm:w-auto border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/30"
                disabled
              >
                <TrendingUp className="w-4 h-4 mr-2" />
                Discover Items
                <span className="ml-2 text-xs opacity-60">(Feed API)</span>
              </Button>
              <Link
                to={createPageUrl("AddInventoryItem")}
                state={returnStateForInventory}
                className="w-full sm:w-auto"
              >
                <Button className="bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white shadow-md w-full sm:w-auto">
                  <Plus className="w-5 h-5 mr-2" />
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
                  <Label htmlFor="days" className="text-xs mb-1.5 block">Age</Label>
                  <Select id="days" value={filters.daysInStock} onValueChange={val => setFilters(f => ({ ...f, daysInStock: val }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                  <SelectItem value="all">All Ages</SelectItem>
                      <SelectItem value="stale">14+ Days</SelectItem>
                      <SelectItem value="returnDeadline">Return Soon</SelectItem>
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
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs text-muted-foreground">
                  Favorites let you flag items for quick actions such as returns.
                </div>
                <Button
                  variant={showFavoritesOnly ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowFavoritesOnly((prev) => !prev)}
                  className="flex items-center gap-2 whitespace-nowrap"
                >
                  <Star className={`w-4 h-4 ${showFavoritesOnly ? "fill-current" : ""}`} />
                  {showFavoritesOnly ? "Showing Favorites" : "Show Favorites"}
                  {favoritesCount > 0 && (
                    <span className="text-xs font-normal opacity-80">({favoritesCount})</span>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {selectedItems.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg mb-4">
              <span className="text-sm font-medium">
                {selectedItems.length} item{selectedItems.length === 1 ? "" : "s"} selected
              </span>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    resetBulkUpdateForm();
                    setBulkUpdateDialogOpen(true);
                  }}
                  disabled={bulkUpdateMutation.isPending}
                  className="whitespace-nowrap"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  {bulkUpdateMutation.isPending ? "Updating..." : "Bulk Update"}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setBulkDeleteDialogOpen(true)}
                  disabled={bulkDeleteMutation.isPending}
                  className="whitespace-nowrap"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  {bulkDeleteMutation.isPending ? "Deleting..." : "Delete"}
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
              <label htmlFor="select-all" className="text-sm font-medium cursor-pointer text-white">
                Select All ({sortedItems.length})
              </label>
            </div>
          )}

          {isLoading ? (
            <div className="p-12 text-center text-muted-foreground">Loading...</div>
          ) : sortedItems.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3">
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

            const truncatedTitle = (() => {
              const words = (item.item_name || "").split(/\s+/).filter(Boolean);
              if (words.length <= 8) return item.item_name;
              return `${words.slice(0, 8).join(" ")}…`;
            })();

            return (
                  <Card key={item.id} className="group overflow-hidden shadow-sm hover:shadow-lg transition-shadow">
                    <div className="relative">
                      <div className="absolute top-2 left-2 z-10">
                        <Checkbox
                          checked={selectedItems.includes(item.id)}
                          onCheckedChange={() => handleSelect(item.id)}
                          id={`select-${item.id}`}
                          className="!h-[22px] !w-[22px] !bg-transparent !border-green-600 border-2 data-[state=checked]:!bg-green-600 data-[state=checked]:!border-green-600 [&[data-state=checked]]:!bg-green-600 [&[data-state=checked]]:!border-green-600 backdrop-blur [&_svg]:!h-[16px] [&_svg]:!w-[16px]"
                        />
                      </div>
                      
                  <Link
                    to={createPageUrl(`AddInventoryItem?id=${item.id}`)}
                    state={returnStateForInventory}
                  >
                    <div className="relative aspect-square bg-gray-100 dark:bg-gray-800">
                      <img 
                        src={item.image_url || DEFAULT_IMAGE_URL}
                        alt={item.item_name} 
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      <div className="absolute top-2 right-2">
                        <Badge variant="outline" className={`${statusColors[item.status]} text-[10px] px-1.5 py-0.5`}>
                          {statusLabels[item.status] || statusLabels.available}
                        </Badge>
                      </div>
                    </div>
                  </Link>
                    </div>

                    <CardContent className="p-3">
                      <div className="flex items-center justify-between mb-2">
                        <button
                          type="button"
                          onClick={() => toggleFavorite(item.id)}
                          className={`inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent transition ${
                            favoriteMarked
                              ? "bg-amber-500/15 text-amber-500 hover:bg-amber-500/25"
                              : "text-muted-foreground hover:text-amber-500 hover:bg-muted/40"
                          }`}
                        >
                          <Star className={`h-4 w-4 ${favoriteMarked ? "fill-current" : ""}`} />
                          <span className="sr-only">{favoriteButtonLabel}</span>
                        </button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs gap-1"
                          onClick={() => handleTagEditorToggle(item.id)}
                        >
                          <Tag className="h-3.5 w-3.5" />
                          {tagEditorFor === item.id ? "Close" : "Add Tag"}
                        </Button>
                      </div>

                      <button
                        type="button"
                        onClick={() => setTitlePreview(item.item_name)}
                        className="font-semibold text-sm leading-tight mb-2 min-h-[2.5rem] text-foreground text-left hover:text-primary transition-colors group/item focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 rounded"
                        aria-label={`View full title for ${item.item_name}`}
                      >
                        <span className="block line-clamp-2 break-words">
                          {truncatedTitle}
                        </span>
                      </button>
                      
                      <div className="space-y-1.5 text-xs mb-3">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Price:</span>
                          <span className="font-medium text-foreground">
                            ${item.purchase_price.toFixed(2)}
                            {item.quantity > 1 && (
                              <span className="text-muted-foreground ml-1">(${perItemPrice.toFixed(2)} ea)</span>
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Qty:</span>
                          <span className="font-medium text-foreground">
                            {item.quantity}
                            {quantitySold > 0 && (
                              <span className={`ml-1 ${isSoldOut ? 'text-red-600 font-bold' : 'text-blue-600'}`}>
                                {isSoldOut ? '(Sold Out)' : `(${quantitySold} sold)`}
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Purchase Date:</span>
                          <span className="font-medium text-foreground">{item.purchase_date ? format(parseISO(item.purchase_date), 'MMM dd, yyyy') : '—'}</span>
                        </div>
                      </div>

                      {itemTags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {itemTags.map((tag) => (
                            <Badge key={tag} variant="secondary" className="flex items-center gap-1 text-[11px]">
                              {tag}
                              <button
                                type="button"
                                onClick={() => handleRemoveTagFromItem(item.id, tag)}
                                className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-black/10 text-muted-foreground hover:bg-black/20"
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

                      {daysRemaining !== null && (
                        <div className="mb-3 p-1.5 bg-red-100 dark:bg-red-900/30 border-l-2 border-red-500 rounded-r text-red-800 dark:text-red-200">
                          <p className="font-semibold text-[10px] flex items-center gap-1">
                            <AlarmClock className="w-3 h-3" />
                            {daysRemaining}d to return
                          </p>
                        </div>
                      )}

                      <div className="space-y-1.5">
                        {!isSoldOut && item.status !== 'sold' && availableToSell > 0 && (
                          <Button 
                            onClick={() => handleMarkAsSold(item)} 
                            className="w-full bg-green-600 hover:bg-green-700 h-8 text-xs"
                          >
                            <ShoppingCart className="w-3 h-3 mr-1.5" />
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
                          className="w-full h-8 text-xs"
                        >
                          <BarChart className="w-3.5 h-3.5 mr-2" />
                          Search Sold
                        </Button>
                        <div className="grid grid-cols-3 gap-1">
                          <Link
                            to={createPageUrl(`AddInventoryItem?id=${item.id}`)}
                            state={returnStateForInventory}
                            className="flex-1"
                          >
                            <Button variant="outline" size="sm" className="w-full h-7 px-2">
                              <Edit className="w-3 h-3" />
                            </Button>
                          </Link>
                          <Link
                            to={createPageUrl(`AddInventoryItem?copyId=${item.id}`)}
                            state={returnStateForInventory}
                            className="flex-1"
                          >
                            <Button variant="outline" size="sm" className="w-full h-7 px-2">
                              <Copy className="w-3 h-3" />
                            </Button>
                          </Link>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleDeleteClick(item)} 
                            disabled={deleteItemMutation.isPending && itemToDelete?.id === item.id}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 h-7 px-2"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-20">
              <Package className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-muted-foreground text-lg">No inventory items found</p>
              <p className="text-muted-foreground text-sm mt-1">Try adjusting your filters or add a new item.</p>
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Item?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{itemToDelete?.item_name}"? This is permanent.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setItemToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              disabled={deleteItemMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteItemMutation.isPending ? 'Deleting...' : 'Delete'}
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

      <SoldLookupDialog
        open={soldDialogOpen}
        onOpenChange={setSoldDialogOpen}
        itemName={soldDialogName}
      />
    </div>
  );
}
