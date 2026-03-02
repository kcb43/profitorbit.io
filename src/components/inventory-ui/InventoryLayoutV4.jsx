import React, { useState } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectValue, SelectTrigger } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Plus, DollarSign, Package, Search, Star, X,
  Grid2X2, Rows, GalleryHorizontal, AlertTriangle, Loader2,
  Download, Folders, ChevronLeft, ChevronRight,
  AlarmClock,
} from "lucide-react";
import { CROSSLIST_MARKETPLACES } from "@/constants/marketplaces";

/**
 * V4: "Segmented Dashboard" — Apple HIG-inspired
 * Clean sections. Prominent search. Rounded containers with whitespace.
 */
export default function InventoryLayoutV4({
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
  const activeFilterCount = [
    filters.status !== "not_sold",
    showFavoritesOnly,
    platformFilter !== "all",
    activeMkts.length > 0,
    !!filters.categoryFilter,
  ].filter(Boolean).length;

  const sortItems = [
    { value: "newest", label: "Newest" },
    { value: "oldest", label: "Oldest" },
    { value: "price-high", label: "Price ↓" },
    { value: "price-low", label: "Price ↑" },
    { value: "name-az", label: "A-Z" },
    { value: "name-za", label: "Z-A" },
    { value: "purchase-newest", label: "Purch ↓" },
    { value: "purchase-oldest", label: "Purch ↑" },
    { value: "return-soon", label: "Returns" },
  ];

  return (
    <div className="space-y-4">
      {/* ── Top row: Title + Stats badges + Action buttons ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-2xl font-bold text-foreground">Inventory</h1>
          <div className="hidden sm:flex items-center gap-2">
            <Badge variant="secondary" className="font-mono text-xs gap-1">
              <DollarSign className="w-3 h-3" />
              {inventorySummary.totalInvested.toFixed(2)}
            </Badge>
            <span className="text-muted-foreground text-xs">·</span>
            <Badge variant="secondary" className="font-mono text-xs gap-1">
              <Package className="w-3 h-3" />
              {inventorySummary.totalQuantity} items
            </Badge>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <Link to={createPageUrl("AddInventoryItem")} state={returnStateForInventory}>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl gap-1.5 h-10 px-5">
              <Plus className="w-4 h-4" />
              Add Item
            </Button>
          </Link>
          <Link to={createPageUrl("Import")} state={returnStateForInventory}>
            <Button variant="outline" className="rounded-xl h-10 gap-1.5">
              <Download className="w-4 h-4" />
              Import
            </Button>
          </Link>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" className="rounded-full h-10 w-10" onClick={onGalleryToggle}>
                  <GalleryHorizontal className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{viewMode === "gallery" ? "Exit Gallery" : "Gallery Mode"}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" className="rounded-full h-10 w-10" onClick={onCheckDuplicates} disabled={checkingDuplicates}>
                  {checkingDuplicates ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Check Duplicates</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" className="rounded-full h-10 w-10" onClick={onManageGroups}>
                  <Folders className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Manage Groups</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Mobile stats row */}
      <div className="flex sm:hidden items-center gap-2">
        <Badge variant="secondary" className="font-mono text-xs gap-1">
          <DollarSign className="w-3 h-3" />
          ${inventorySummary.totalInvested.toFixed(2)}
        </Badge>
        <Badge variant="secondary" className="font-mono text-xs gap-1">
          <Package className="w-3 h-3" />
          {inventorySummary.totalQuantity} items
        </Badge>
      </div>

      {/* ── Search bar ── */}
      <div className="relative">
        <Input
          placeholder="Search your inventory..."
          value={filters.search}
          onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
          className="h-11 text-sm pl-10 rounded-xl border-border/60"
        />
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        {filters.search && (
          <button className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-muted" onClick={() => setFilters(f => ({ ...f, search: "" }))}>
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* ── Category filter banner ── */}
      {filters.categoryFilter && (
        <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2">
          <span className="text-sm text-foreground">
            Category: <span className="font-semibold">{filters.categoryFilter === '__uncategorized__' ? 'Uncategorized' : filters.categoryFilter}</span>
          </span>
          <Button variant="ghost" size="sm" className="ml-auto h-7 px-2 text-xs" onClick={() => setFilters(prev => ({ ...prev, categoryFilter: "", status: "not_sold" }))}>
            <X className="w-3.5 h-3.5 mr-1" /> Clear
          </Button>
        </div>
      )}

      {/* ── Segmented Filters / Sort tabs ── */}
      <Tabs defaultValue="filters" className="w-full">
        <TabsList className="grid w-full grid-cols-2 h-10 rounded-xl bg-muted/50 p-1">
          <TabsTrigger value="filters" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm text-sm gap-1.5">
            Filters
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="h-5 w-5 p-0 justify-center text-[10px]">
                {activeFilterCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="sort" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm text-sm">
            Sort
          </TabsTrigger>
        </TabsList>

        <TabsContent value="filters" className="mt-3 space-y-3">
          {/* Status pills */}
          <div className="flex flex-wrap gap-1.5">
            {[
              { value: "not_sold", label: "In Stock/Listed" },
              { value: "available", label: "In Stock" },
              { value: "listed", label: "Listed" },
              { value: "sold", label: "Sold" },
              { value: "all", label: "All" },
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => setFilters(f => ({ ...f, status: opt.value }))}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  filters.status === opt.value
                    ? "bg-foreground text-background"
                    : "bg-muted/60 text-foreground hover:bg-muted"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Marketplace chips */}
          <div className="flex flex-wrap gap-1.5 items-center">
            <Select value={platformFilter} onValueChange={setPlatformFilter}>
              <SelectTrigger className="h-8 w-[130px] rounded-lg text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Items</SelectItem>
                <SelectItem value="listed">Listed</SelectItem>
                <SelectItem value="unlisted">Not Listed</SelectItem>
              </SelectContent>
            </Select>
            {CROSSLIST_MARKETPLACES.map(m => {
              const active = activeMkts.includes(m.id);
              return (
                <button
                  key={m.id}
                  onClick={() => setActiveMkts(prev => active ? prev.filter(x => x !== m.id) : [...prev, m.id])}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-xs font-medium transition-colors ${
                    active ? "bg-foreground text-background border-foreground" : "bg-muted/40 text-foreground border-border hover:bg-muted"
                  }`}
                >
                  <img src={m.icon} alt={m.label} className="w-3.5 h-3.5 object-contain" />
                  {m.label}
                </button>
              );
            })}
          </div>

          {/* Favorites + return deadline */}
          <div className="flex gap-2">
            <Button
              variant={showFavoritesOnly ? "default" : "outline"}
              size="sm"
              className="rounded-full gap-1.5"
              onClick={() => setShowFavoritesOnly(prev => !prev)}
            >
              <Star className={`w-3.5 h-3.5 ${showFavoritesOnly ? "fill-current" : ""}`} />
              Favorites
              {favoritesCount > 0 && <span className="text-xs opacity-70">({favoritesCount})</span>}
            </Button>
            {daysInStockFilter === "returnDeadline" && (
              <Button
                variant={showDismissedReturns ? "default" : "outline"}
                size="sm"
                className="rounded-full gap-1.5"
                onClick={() => setShowDismissedReturns(prev => !prev)}
              >
                <AlarmClock className="w-3.5 h-3.5" />
                Dismissed
                {dismissedReturnsCount > 0 && <span className="text-xs opacity-70">({dismissedReturnsCount})</span>}
              </Button>
            )}
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="rounded-full text-muted-foreground ml-auto"
                onClick={() => {
                  setFilters({ search: "", status: "not_sold", daysInStock: "all", categoryFilter: "" });
                  setSort("newest");
                  setPlatformFilter("all");
                  setActiveMkts([]);
                  setShowFavoritesOnly(false);
                }}
              >
                <X className="w-3.5 h-3.5 mr-1" />
                Clear all
              </Button>
            )}
          </div>
        </TabsContent>

        <TabsContent value="sort" className="mt-3">
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {sortItems.map(opt => (
              <button
                key={opt.value}
                onClick={() => setSort(opt.value)}
                className={`p-3 rounded-xl border text-xs font-medium text-center transition-colors ${
                  sort === opt.value
                    ? "bg-foreground text-background border-foreground"
                    : "bg-card text-foreground border-border hover:bg-muted/60"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Select All ── */}
      {displayItems.length > 0 && (
        <div className="flex items-center justify-between rounded-xl bg-muted/40 p-3">
          <div className="flex items-center gap-3">
            <Checkbox
              checked={selectedItems.length === displayItems.length && displayItems.length > 0}
              onCheckedChange={handleSelectAll}
              className="!h-5 !w-5 data-[state=checked]:!bg-emerald-600 data-[state=checked]:!border-emerald-600"
            />
            <span className="text-sm text-foreground">
              {selectedItems.length > 0
                ? `${selectedItems.length} item${selectedItems.length === 1 ? "" : "s"} selected`
                : `Select all ${displayItems.length} items`}
            </span>
          </div>
          {/* Capsule view toggle */}
          <div className="flex items-center bg-muted rounded-full p-0.5">
            <button
              onClick={() => setViewMode("grid")}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                viewMode === "grid" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
              }`}
            >
              <Grid2X2 className="w-3.5 h-3.5 inline mr-1" />
              Grid
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                viewMode === "list" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
              }`}
            >
              <Rows className="w-3.5 h-3.5 inline mr-1" />
              List
            </button>
          </div>
        </div>
      )}

      {/* Children (item grid, alerts, etc.) */}
      {children}

      {/* ── Pagination ── */}
      <div className="flex items-center justify-center gap-1 py-2">
        <button
          onClick={() => setPageIndex(p => Math.max(0, p - 1))}
          disabled={!canPrev}
          className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-30 px-2 py-1"
        >
          Previous
        </button>
        {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
          let page;
          if (totalPages <= 7) {
            page = i;
          } else if (pageIndex < 4) {
            page = i;
          } else if (pageIndex > totalPages - 5) {
            page = totalPages - 7 + i;
          } else {
            page = pageIndex - 3 + i;
          }
          return (
            <button
              key={page}
              onClick={() => setPageIndex(page)}
              className={`h-8 w-8 rounded-full text-xs font-medium transition-colors ${
                page === pageIndex
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {page + 1}
            </button>
          );
        })}
        <button
          onClick={() => setPageIndex(p => p + 1)}
          disabled={!canNext}
          className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-30 px-2 py-1"
        >
          Next
        </button>
        <div className="ml-3">
          <Select value={String(pageSize)} onValueChange={v => { const n = Number(v); if ([50, 100, 200].includes(n)) setPageSize(n); }}>
            <SelectTrigger className="h-8 w-[70px] text-xs rounded-full">
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
