import React, { useState } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectValue, SelectTrigger } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
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
  AlarmClock, SlidersHorizontal,
} from "lucide-react";
import { CROSSLIST_MARKETPLACES } from "@/constants/marketplaces";

/**
 * V2: "Sidebar Filters" — Shopify Admin-inspired
 * Filters in a persistent left panel on desktop, Sheet on mobile.
 */
export default function InventoryLayoutV2({
  inventorySummary,
  filters, setFilters,
  sort, setSort,
  platformFilter, setPlatformFilter,
  activeMkts, setActiveMkts,
  pageSize, setPageSize, pageIndex, setPageIndex,
  totalPages, totalItems, canPrev, canNext,
  inventoryItems,
  selectedItems, displayItems, handleSelectAll,
  viewMode, setViewMode,
  onGalleryToggle, onCheckDuplicates, checkingDuplicates,
  onManageGroups, onExport,
  showFavoritesOnly, setShowFavoritesOnly, favoritesCount,
  categoryFilter,
  returnStateForInventory,
  showDismissedReturns, setShowDismissedReturns, dismissedReturnsCount,
  daysInStockFilter,
  hasActiveFilters,
  children,
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const statusOptions = [
    { value: "not_sold", label: "In Stock/Listed" },
    { value: "available", label: "In Stock" },
    { value: "listed", label: "Listed" },
    { value: "sold", label: "Sold" },
    { value: "all", label: "All Items" },
  ];

  const sortOptions = [
    { value: "newest", label: "Newest First" },
    { value: "oldest", label: "Oldest First" },
    { value: "price-high", label: "Price: High to Low" },
    { value: "price-low", label: "Price: Low to High" },
    { value: "name-az", label: "Name: A to Z" },
    { value: "name-za", label: "Name: Z to A" },
    { value: "purchase-newest", label: "Purchase: Newest" },
    { value: "purchase-oldest", label: "Purchase: Oldest" },
    { value: "return-soon", label: "Return Soon" },
  ];

  const FilterPanel = () => (
    <div className="space-y-5">
      {/* Search */}
      <div>
        <Label className="text-xs text-muted-foreground mb-1.5 block">Search</Label>
        <div className="relative">
          <Input
            placeholder="Search items..."
            value={filters.search}
            onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
            className="pl-8 h-9"
          />
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-border" />

      {/* Status - selectable list */}
      <div>
        <Label className="text-xs text-muted-foreground mb-2 block">Status</Label>
        <div className="space-y-0.5">
          {statusOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => setFilters(f => ({ ...f, status: opt.value }))}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                filters.status === opt.value
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-foreground hover:bg-muted/60"
              }`}
            >
              {filters.status === opt.value && (
                <div className="w-0.5 h-4 bg-primary rounded-full" />
              )}
              <span className={filters.status === opt.value ? "" : "ml-2.5"}>{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-border" />

      {/* Sort */}
      <div>
        <Label className="text-xs text-muted-foreground mb-1.5 block">Sort By</Label>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sortOptions.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Divider */}
      <div className="h-px bg-border" />

      {/* Marketplace filters */}
      <div>
        <Label className="text-xs text-muted-foreground mb-2 block">Marketplace</Label>
        <Select value={platformFilter} onValueChange={setPlatformFilter}>
          <SelectTrigger className="h-8 mb-2">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Items</SelectItem>
            <SelectItem value="listed">Listed</SelectItem>
            <SelectItem value="unlisted">Not Listed</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex flex-col gap-1">
          {CROSSLIST_MARKETPLACES.map(m => {
            const active = activeMkts.includes(m.id);
            return (
              <button
                key={m.id}
                onClick={() => setActiveMkts(prev => active ? prev.filter(x => x !== m.id) : [...prev, m.id])}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                  active
                    ? "bg-foreground text-background"
                    : "hover:bg-muted/60 text-foreground"
                }`}
              >
                <img src={m.icon} alt={m.label} className="w-4 h-4 object-contain" />
                {m.label}
              </button>
            );
          })}
        </div>
        {(platformFilter !== "all" || activeMkts.length > 0) && (
          <button className="text-xs text-muted-foreground hover:text-foreground underline mt-2" onClick={() => { setPlatformFilter("all"); setActiveMkts([]); }}>
            Clear marketplace filters
          </button>
        )}
      </div>

      {/* Divider */}
      <div className="h-px bg-border" />

      {/* Favorites + Return Deadline */}
      <div className="space-y-2">
        <Button
          variant={showFavoritesOnly ? "default" : "outline"}
          size="sm"
          className="w-full justify-start gap-2"
          onClick={() => setShowFavoritesOnly(prev => !prev)}
        >
          <Star className={`w-4 h-4 ${showFavoritesOnly ? "fill-current" : ""}`} />
          {showFavoritesOnly ? "Showing Favorites" : "Show Favorites"}
          {favoritesCount > 0 && <span className="ml-auto text-xs opacity-70">{favoritesCount}</span>}
        </Button>

        {daysInStockFilter === "returnDeadline" && (
          <Button
            variant={showDismissedReturns ? "default" : "outline"}
            size="sm"
            className="w-full justify-start gap-2"
            onClick={() => setShowDismissedReturns(prev => !prev)}
          >
            <AlarmClock className="w-4 h-4" />
            {showDismissedReturns ? "Showing Dismissed" : "Show Dismissed"}
            {dismissedReturnsCount > 0 && <span className="ml-auto text-xs opacity-70">{dismissedReturnsCount}</span>}
          </Button>
        )}
      </div>

      {/* Clear all */}
      {hasActiveFilters && (
        <>
          <div className="h-px bg-border" />
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-muted-foreground"
            onClick={() => {
              setFilters({ search: "", status: "not_sold", daysInStock: "all", categoryFilter: "" });
              setSort("newest");
            }}
          >
            <X className="w-3.5 h-3.5 mr-1.5" />
            Clear all filters
          </Button>
        </>
      )}
    </div>
  );

  return (
    <div className="flex gap-0 md:gap-5">
      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:block w-[260px] flex-shrink-0">
        <div className="sticky top-4 bg-card border border-border rounded-xl p-4 space-y-0">
          <FilterPanel />
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="flex-1 min-w-0 space-y-3">
        {/* Stats bar */}
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

        {/* Header row: title + actions */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-foreground">Inventory</h1>
            {/* Mobile filter trigger */}
            <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="md:hidden gap-1.5">
                  <SlidersHorizontal className="w-4 h-4" />
                  Filters
                  {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[300px] overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Filters</SheetTitle>
                </SheetHeader>
                <div className="mt-4">
                  <FilterPanel />
                </div>
              </SheetContent>
            </Sheet>
          </div>
          <div className="flex items-center gap-2">
            <Link to={createPageUrl("AddInventoryItem")} state={returnStateForInventory}>
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5">
                <Plus className="w-4 h-4" />
                Add Item
              </Button>
            </Link>
            <Link to={createPageUrl("Import")} state={returnStateForInventory}>
              <Button size="sm" variant="outline" className="gap-1.5 border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-400 dark:hover:bg-blue-950">
                <Download className="w-4 h-4" />
                Import
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
                  Check Duplicates
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

        {/* Category filter banner */}
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

        {/* Select all + view toggle */}
        {displayItems.length > 0 && (
          <div className="flex items-center justify-between px-3 py-2.5 bg-card rounded-lg">
            <div className="flex items-center gap-2.5">
              <Checkbox
                checked={selectedItems.length === displayItems.length && displayItems.length > 0}
                onCheckedChange={handleSelectAll}
                className="!h-[18px] !w-[18px] data-[state=checked]:!bg-emerald-600 data-[state=checked]:!border-emerald-600"
              />
              <span className="text-sm text-muted-foreground">
                {selectedItems.length > 0 ? `${selectedItems.length} selected` : `Select All (${displayItems.length})`}
              </span>
            </div>
            <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-0.5">
              <button onClick={() => setViewMode("grid")} className={`p-1.5 rounded-md transition-colors ${viewMode === "grid" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                <Grid2X2 className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setViewMode("list")} className={`p-1.5 rounded-md transition-colors ${viewMode === "list" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                <Rows className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Children (item grid, alerts, etc.) */}
        {children}

        {/* Pagination */}
        <div className="flex items-center justify-center gap-2 py-2">
          <Button variant="ghost" size="sm" disabled={!canPrev} onClick={() => setPageIndex(p => Math.max(0, p - 1))} className="h-7 px-2 text-xs">
            <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Prev
          </Button>
          {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
            let page;
            if (totalPages <= 5) {
              page = i;
            } else if (pageIndex < 3) {
              page = i;
            } else if (pageIndex > totalPages - 4) {
              page = totalPages - 5 + i;
            } else {
              page = pageIndex - 2 + i;
            }
            return (
              <button
                key={page}
                onClick={() => setPageIndex(page)}
                className={`h-7 w-7 rounded-md text-xs font-medium transition-colors ${
                  page === pageIndex ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {page + 1}
              </button>
            );
          })}
          <Button variant="ghost" size="sm" disabled={!canNext} onClick={() => setPageIndex(p => p + 1)} className="h-7 px-2 text-xs">
            Next <ChevronRight className="w-3.5 h-3.5 ml-1" />
          </Button>
          <div className="ml-2">
            <Select value={String(pageSize)} onValueChange={v => { const n = Number(v); if ([50, 100, 200].includes(n)) setPageSize(n); }}>
              <SelectTrigger className="h-7 w-[70px] text-xs">
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
    </div>
  );
}
