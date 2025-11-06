import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, Trash2, Package, Pencil, Copy, ArchiveRestore, TrendingUp, Zap, CalendarIcon as Calendar } from "lucide-react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";

const platformIcons = {
  ebay: "https://upload.wikimedia.org/wikipedia/commons/1/1b/EBay_logo.svg",
  facebook_marketplace: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68e86fb5ac26f8511acce7ec/f0f473258_sdfsdv.jpeg",
  mercari: "https://cdn.brandfetch.io/idjAt9LfED/w/400/h/400/theme/dark/icon.jpeg?c=1dxbfHSJFAPEGdCLU4o5B",
  etsy: "https://cdn.brandfetch.io/idzyTAzn6G/theme/dark/logo.svg?c=1dxbfHSJFAPEGdCLU4o5B",
  offer_up: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68e86fb5ac26f8511acce7ec/c0f886f60_Symbol.png"
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
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const navigate = useNavigate();

  const queryClient = useQueryClient();

  const { data: rawSales, isLoading } = useQuery({
    queryKey: ['sales'],
    queryFn: () => base44.entities.Sale.list(),
    initialData: [],
  });

  const salesWithMetrics = React.useMemo(() => {
    if (!rawSales) return [];

    const salesWithCalculatedMetrics = rawSales.map(sale => {
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
          comparison = new Date(b.created_date).getTime() - new Date(a.created_date).getTime();
          break;
      }
      
      if (sort.by === 'sale_speed') {
          return comparison;
      }
      
      return comparison;
    });
  }, [rawSales, sort]);

  const deleteSaleMutation = useMutation({
    mutationFn: async (sale) => {
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
      
      return base44.entities.Sale.delete(sale.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['inventoryItems'] });
      setDeleteDialogOpen(false);
      setSaleToDelete(null);
    },
    onError: (error) => {
      console.error("Failed to delete sale:", error);
      alert("Failed to delete sale. Please try again.");
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (saleIds) => {
      const salesToDelete = salesWithMetrics.filter(s => saleIds.includes(s.id));
      
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
      
      return Promise.all(saleIds.map(id => base44.entities.Sale.delete(id)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['inventoryItems'] });
      setSelectedSales([]);
      setBulkDeleteDialogOpen(false);
    },
    onError: (error) => {
      console.error("Failed to bulk delete sales:", error);
      alert("Failed to delete sales. Please try again.");
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
    if (sale.notes) params.set('notes', sale.notes);

    navigate(createPageUrl(`AddInventoryItem?${params.toString()}`));
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const filteredSales = salesWithMetrics.filter(sale => {
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

  const handleSelect = (saleId) => {
    setSelectedSales(prev =>
      prev.includes(saleId)
        ? prev.filter(id => id !== saleId)
        : [...prev, saleId]
    );
  };

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedSales(filteredSales.map(s => s.id));
    } else {
      setSelectedSales([]);
    }
  };

  const handleDeleteClick = (sale) => {
    setSaleToDelete(sale);
    setDeleteDialogOpen(true);
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
                  <Button variant="destructive" onClick={() => setBulkDeleteDialogOpen(true)} className="w-full sm:w-auto">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Selected
                  </Button>
                </>
              ) : (
                <>
                  <CardTitle className="text-white break-words">All Sales ({filteredSales.length})</CardTitle>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 min-w-0 w-full sm:w-auto">
                    <Label htmlFor="sort-by" className="text-xs sm:text-sm font-medium text-white whitespace-nowrap">Sort by:</Label>
                     <Select value={sort.by} onValueChange={(v) => setSort({ by: v })}>
                        <SelectTrigger id="sort-by" className="w-full sm:w-[180px]">
                           <SelectValue placeholder="Sort by"/>
                        </SelectTrigger>
                        <SelectContent>
                           <SelectItem value="sale_date">Most Recent</SelectItem>
                           <SelectItem value="profit">Highest Profit</SelectItem>
                           <SelectItem value="roi">Highest ROI</SelectItem>
                           <SelectItem value="sale_speed">Fastest Sale</SelectItem>
                        </SelectContent>
                     </Select>
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
                      className="!bg-transparent !border-green-600 border-2 data-[state=checked]:!bg-green-600 data-[state=checked]:!border-green-600 flex-shrink-0"
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
                {filteredSales.map((sale) => (
                  <div key={sale.id} className="flex items-start gap-3 sm:gap-4 p-3 sm:p-6 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors duration-200 min-w-0">
                    <Checkbox
                      checked={selectedSales.includes(sale.id)}
                      onCheckedChange={() => handleSelect(sale.id)}
                      id={`select-${sale.id}`}
                      className="mt-1 !bg-transparent !border-green-600 border-2 data-[state=checked]:!bg-green-600 data-[state=checked]:!border-green-600 flex-shrink-0"
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

                          <div className="flex flex-wrap items-center gap-x-3 sm:gap-x-4 gap-y-1 text-xs sm:text-sm border-t border-gray-200 dark:border-gray-700 pt-3 min-w-0">
                             <div className="flex items-center text-foreground min-w-0" title="Return on Investment">
                                <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-1.5 text-blue-500 flex-shrink-0"/>
                                <span className="font-medium whitespace-nowrap">ROI:</span>
                                <span className="ml-1 font-semibold text-blue-600 dark:text-blue-400 break-words">
                                  {isFinite(sale.roi) ? `${sale.roi.toFixed(1)}%` : (sale.roi > 0 ? '∞%' : '-∞%')}
                                </span>
                             </div>
                             <div className="flex items-center text-foreground min-w-0" title="Sale Speed">
                                <Zap className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-1.5 text-orange-500 flex-shrink-0"/>
                                <span className="font-medium whitespace-nowrap">Sold in:</span>
                                <span className="ml-1 font-semibold text-orange-600 dark:text-orange-400 break-words">
                                  {sale.saleSpeed !== null ? `${sale.saleSpeed} day(s)` : 'N/A'}
                                </span>
                             </div>
                          </div>
                          
                          {(sale.category || sale.notes || sale.image_url) && (
                            <div className="flex flex-wrap items-center gap-x-3 sm:gap-x-4 gap-y-2 text-xs sm:text-sm text-foreground mt-3 min-w-0">
                              {sale.image_url && (
                                <img src={sale.image_url} alt={sale.item_name} className="w-8 h-8 sm:w-10 sm:h-10 object-cover rounded-md border flex-shrink-0" />
                              )}
                              {sale.category && (
                                <p className="break-words min-w-0">
                                  <span className="font-medium">Category:</span> {sale.category}
                                </p>
                              )}
                              {sale.notes && (
                                <p className="italic break-words min-w-0">
                                  <span className="font-medium not-italic">Notes:</span> "{sale.notes}"
                                </p>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-1 sm:gap-2 min-w-0 w-full">
                          <Link to={createPageUrl(`AddSale?id=${sale.id}`)} className="flex-shrink-0">
                            <Button variant="ghost" size="icon" className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 h-8 w-8 sm:h-10 sm:w-10">
                              <Pencil className="w-4 h-4 sm:w-5 sm:h-5" />
                            </Button>
                          </Link>
                          <Link to={createPageUrl(`AddSale?copyId=${sale.id}`)} className="flex-shrink-0">
                            <Button variant="ghost" size="icon" className="text-foreground hover:text-foreground/80 hover:bg-muted/50 h-8 w-8 sm:h-10 sm:w-10">
                              <Copy className="w-4 h-4 sm:w-5 sm:h-5" />
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleAddToInventory(sale)}
                            className="text-green-500 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20 flex-shrink-0 h-8 w-8 sm:h-10 sm:w-10"
                          >
                            <ArchiveRestore className="w-4 h-4 sm:w-5 sm:h-5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteClick(sale)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 flex-shrink-0 h-8 w-8 sm:h-10 sm:w-10"
                          >
                            <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Sale?</AlertDialogTitle>
            <AlertDialogDescription className="break-words">
              Are you sure you want to delete "{saleToDelete?.item_name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteSaleMutation.mutate(saleToDelete)}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Multiple Sales?</AlertDialogTitle>
            <AlertDialogDescription className="break-words">
              Are you sure you want to delete the {selectedSales.length} selected sales? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => bulkDeleteMutation.mutate(selectedSales)}
              className="bg-red-600 hover:bg-red-700"
              disabled={bulkDeleteMutation.isPending}
            >
              {bulkDeleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}