import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectValue, SelectTrigger } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus, DollarSign, Package, Search, Filter, Star, X,
  Grid2X2, Rows, GalleryHorizontal, AlertTriangle, Loader2,
  Download, Folders, MoreHorizontal, ChevronLeft, ChevronRight,
  AlarmClock,
} from "lucide-react";
import { CROSSLIST_MARKETPLACES } from "@/constants/marketplaces";

/**
 * V1: "Unified Toolbar" — Notion/Linear-inspired
 * Everything in a single compact toolbar strip. Content-first.
 */
export default function InventoryLayoutV1({
  // Stats
  inventorySummary,
  // Filters
  filters, setFilters,
  sort, setSort,
  platformFilter, setPlatformFilter,
  activeMkts, setActiveMkts,
  // Pagination
  pageSize, setPageSize, pageIndex, setPageIndex,
  totalPages, totalItems, canPrev, canNext,
  inventoryItems,
  // Selection
  selectedItems, displayItems, handleSelectAll,
  // View
  viewMode, setViewMode,
  // Actions
  onGalleryToggle, onCheckDuplicates, checkingDuplicates,
  onManageGroups, onExport,
  // Favorites
  showFavoritesOnly, setShowFavoritesOnly, favoritesCount,
  // Category filter
  categoryFilter,
  // Return state for navigation
  returnStateForInventory,
  // Return deadline
  showDismissedReturns, setShowDismissedReturns, dismissedReturnsCount,
  daysInStockFilter,
  // Active filters
  hasActiveFilters,
  children,
}) {
  // Listen for floating search bar events from Layout
  React.useEffect(() => {
    const handler = (e) => {
      setFilters(f => ({ ...f, search: e.detail || '' }));
    };
    window.addEventListener('floating-search', handler);
    return () => window.removeEventListener('floating-search', handler);
  }, [setFilters]);

  return (
    <div className="space-y-2">
      {/* ── Stats bar ── */}
      <div className="flex items-center gap-4 bg-muted/30 rounded-xl px-4 py-3">
        <div className="flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-emerald-600" />
          <span className="text-sm font-semibold text-foreground">${inventorySummary.totalInvested.toFixed(2)}</span>
          <span className="text-xs text-muted-foreground">invested</span>
        </div>
        <div className="w-px h-5 bg-border" />
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-semibold text-foreground">{inventorySummary.totalQuantity}</span>
          <span className="text-xs text-muted-foreground">items</span>
        </div>
      </div>

      {/* ── Header: Title + actions ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-foreground">Inventory</h1>
        <div className="flex items-center gap-2">
          <Link to={createPageUrl("Sales") + "?import=open"}>
            <Button size="sm" variant="outline" className="gap-1.5 border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-400 dark:hover:bg-blue-950">
              <Download className="w-4 h-4" />
              Import
            </Button>
          </Link>
          <Link to={createPageUrl("AddInventoryItem")} state={returnStateForInventory}>
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5">
              <Plus className="w-4 h-4" />
              Add Item
            </Button>
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" className="px-2">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onGalleryToggle}>
                <GalleryHorizontal className="w-4 h-4 mr-2" />
                {viewMode === "gallery" ? "Exit Gallery" : "Gallery Mode"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onCheckDuplicates} disabled={checkingDuplicates}>
                {checkingDuplicates ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <AlertTriangle className="w-4 h-4 mr-2" />}
                {checkingDuplicates ? "Checking..." : "Check Duplicates"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onManageGroups}>
                <Folders className="w-4 h-4 mr-2" />
                Manage Groups
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onExport}>
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>


      {/* ── Category filter banner ── */}
      {filters.categoryFilter && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
          <span className="text-sm text-foreground">
            Category: <span className="font-semibold">{filters.categoryFilter === '__uncategorized__' ? 'Uncategorized' : filters.categoryFilter}</span>
          </span>
          <Button variant="ghost" size="sm" className="ml-auto h-7 px-2 text-xs" onClick={() => setFilters(prev => ({ ...prev, categoryFilter: "", status: "not_sold" }))}>
            <X className="w-3.5 h-3.5 mr-1" /> Clear
          </Button>
        </div>
      )}

      {/* ── Unified filter bar ── */}
      <div className="hidden md:flex items-center gap-2 bg-muted/40 rounded-xl p-2.5">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Input
            placeholder="Search..."
            value={filters.search}
            onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
            className="pl-8 h-9 bg-background border-border/50"
          />
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        </div>

        {/* Separator */}
        <div className="w-px h-6 bg-border/60" />

        {/* Status */}
        <Select value={filters.status} onValueChange={val => setFilters(f => ({ ...f, status: val }))}>
          <SelectTrigger className="h-9 w-[140px] bg-background border-border/50">
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

        {/* Sort */}
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="h-9 w-[150px] bg-background border-border/50">
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

        {/* Separator */}
        <div className="w-px h-6 bg-border/60" />

        {/* Marketplace chips */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {CROSSLIST_MARKETPLACES.map((m) => {
            const active = activeMkts.includes(m.id);
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setActiveMkts(prev => active ? prev.filter(x => x !== m.id) : [...prev, m.id])}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-xs font-medium transition-colors ${
                  active
                    ? "bg-foreground text-background border-foreground"
                    : "bg-background text-foreground border-border/50 hover:bg-muted/60"
                }`}
              >
                <img src={m.icon} alt={m.label} className="w-3.5 h-3.5 object-contain" />
                {m.label}
              </button>
            );
          })}
          {activeMkts.length > 0 && (
            <button className="text-xs text-muted-foreground hover:text-foreground underline" onClick={() => { setPlatformFilter("all"); setActiveMkts([]); }}>
              Clear
            </button>
          )}
        </div>

        {/* Separator */}
        <div className="w-px h-6 bg-border/60" />

        {/* Favorites */}
        <Button
          variant={showFavoritesOnly ? "default" : "ghost"}
          size="sm"
          className="h-8 px-2 gap-1"
          onClick={() => setShowFavoritesOnly(prev => !prev)}
        >
          <Star className={`w-3.5 h-3.5 ${showFavoritesOnly ? "fill-current" : ""}`} />
          {favoritesCount > 0 && <span className="text-xs">{favoritesCount}</span>}
        </Button>

        {/* Dismissed returns */}
        {daysInStockFilter === "returnDeadline" && (
          <Button
            variant={showDismissedReturns ? "default" : "ghost"}
            size="sm"
            className="h-8 px-2 gap-1"
            onClick={() => setShowDismissedReturns(prev => !prev)}
          >
            <AlarmClock className="w-3.5 h-3.5" />
            {dismissedReturnsCount > 0 && <span className="text-xs">{dismissedReturnsCount}</span>}
          </Button>
        )}

        {/* Clear all filters */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-muted-foreground hover:text-foreground"
            onClick={() => {
              setFilters({ search: "", status: "not_sold", daysInStock: "all", categoryFilter: "" });
              setSort("newest");
            }}
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>

      {/* ── Select all + view toggle strip ── */}
      {displayItems.length > 0 && (
        <div className="flex items-center justify-between px-3 py-2 border-b border-border/40">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={selectedItems.length === displayItems.length && displayItems.length > 0}
              onCheckedChange={handleSelectAll}
              className="!h-[18px] !w-[18px] !border-muted-foreground/40 data-[state=checked]:!bg-emerald-600 data-[state=checked]:!border-emerald-600"
            />
            <span className={`text-xs ${selectedItems.length > 0 ? "text-emerald-600 font-medium" : "text-muted-foreground"}`}>
              {selectedItems.length > 0
                ? `${selectedItems.length} selected`
                : `Select All (${displayItems.length})`}
            </span>
          </div>
          <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-md transition-colors ${viewMode === "grid" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Grid2X2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded-md transition-colors ${viewMode === "list" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Rows className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Children (item grid, alerts, etc.) */}
      {children}

      {/* ── Pagination footer ── */}
      <div className="flex items-center justify-between px-1 py-2 text-xs text-muted-foreground">
        <span>
          Page {pageIndex + 1} of {totalPages}
          {totalItems > 0 && <span className="ml-1">· {totalItems} items</span>}
        </span>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" disabled={!canPrev} onClick={() => setPageIndex(p => Math.max(0, p - 1))} className="h-7 w-7 p-0">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" disabled={!canNext} onClick={() => setPageIndex(p => p + 1)} className="h-7 w-7 p-0">
            <ChevronRight className="w-4 h-4" />
          </Button>
          <div className="w-px h-4 bg-border/60" />
          <Select value={String(pageSize)} onValueChange={v => { const n = Number(v); if ([50, 100, 200].includes(n)) setPageSize(n); }}>
            <SelectTrigger className="h-7 w-[70px] text-xs border-0 bg-transparent">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
              <SelectItem value="200">200</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
