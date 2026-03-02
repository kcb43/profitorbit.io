import React, { useState } from "react";
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
  Plus, DollarSign, Package, Search, Star, X,
  Grid2X2, Rows, GalleryHorizontal, AlertTriangle, Loader2,
  Download, Folders, ChevronLeft, ChevronRight,
  AlarmClock, SlidersHorizontal, Zap,
} from "lucide-react";
import { CROSSLIST_MARKETPLACES } from "@/constants/marketplaces";

/**
 * V3: "Command Bar" — Spotlight/Raycast-inspired
 * Search-first. Large prominent search. Filters as removable pills.
 */
export default function InventoryLayoutV3({
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
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  // Build active filter pills
  const pills = [];
  if (filters.status && filters.status !== "not_sold") {
    const labels = { available: "In Stock", listed: "Listed", sold: "Sold", all: "All Items" };
    pills.push({ key: "status", label: labels[filters.status] || filters.status, onRemove: () => setFilters(f => ({ ...f, status: "not_sold" })) });
  }
  if (sort !== "newest") {
    const sortLabels = { oldest: "Oldest", "price-high": "Price ↓", "price-low": "Price ↑", "name-az": "A-Z", "name-za": "Z-A", "purchase-newest": "Purchase ↓", "purchase-oldest": "Purchase ↑", "return-soon": "Returns" };
    pills.push({ key: "sort", label: `Sort: ${sortLabels[sort] || sort}`, onRemove: () => setSort("newest") });
  }
  if (filters.categoryFilter) {
    pills.push({ key: "category", label: `Category: ${filters.categoryFilter === '__uncategorized__' ? 'Uncategorized' : filters.categoryFilter}`, onRemove: () => setFilters(f => ({ ...f, categoryFilter: "", status: "not_sold" })) });
  }
  if (showFavoritesOnly) {
    pills.push({ key: "favorites", label: "Favorites", onRemove: () => setShowFavoritesOnly(false) });
  }
  if (platformFilter !== "all") {
    pills.push({ key: "platform", label: platformFilter === "listed" ? "Listed Only" : "Not Listed", onRemove: () => setPlatformFilter("all") });
  }
  activeMkts.forEach(mktId => {
    const mkt = CROSSLIST_MARKETPLACES.find(m => m.id === mktId);
    if (mkt) pills.push({ key: `mkt-${mktId}`, label: mkt.label, onRemove: () => setActiveMkts(prev => prev.filter(x => x !== mktId)) });
  });

  return (
    <div className="space-y-3">
      {/* ── Search bar + stats + Add Item ── */}
      <div className="flex flex-col items-center gap-3">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">${inventorySummary.totalInvested.toFixed(2)}</span>
            <span>invested</span>
            <span className="text-muted-foreground/50">·</span>
            <span className="font-semibold text-foreground">{inventorySummary.totalQuantity}</span>
            <span>items</span>
          </div>
          <div className="flex items-center gap-2">
            <Link to={createPageUrl("AddInventoryItem")} state={returnStateForInventory}>
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5">
                <Plus className="w-4 h-4" />
                Add Item
              </Button>
            </Link>
            <Link to={createPageUrl("Import")} state={returnStateForInventory}>
              <Button size="sm" variant="outline" className="gap-1.5">
                <Download className="w-4 h-4" />
                Import
              </Button>
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost" className="px-2 text-muted-foreground">
                  <Zap className="w-4 h-4" />
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

        {/* Large centered search */}
        <div className="relative w-full max-w-2xl mx-auto">
          <Input
            placeholder="Search your inventory..."
            value={filters.search}
            onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
            className="h-12 text-base pl-11 rounded-xl border-border/60 shadow-sm focus-visible:ring-2 focus-visible:ring-primary/30"
          />
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          {filters.search && (
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-muted"
              onClick={() => setFilters(f => ({ ...f, search: "" }))}
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* ── Active filter pills ── */}
      {(pills.length > 0 || filtersExpanded) && (
        <div className="flex flex-wrap items-center gap-1.5 justify-center max-w-2xl mx-auto">
          {pills.map(pill => (
            <Badge
              key={pill.key}
              variant="secondary"
              className="gap-1 pl-2.5 pr-1 py-1 cursor-pointer hover:bg-destructive/10 transition-colors"
              onClick={pill.onRemove}
            >
              {pill.label}
              <X className="w-3 h-3 ml-0.5" />
            </Badge>
          ))}
          {pills.length > 0 && (
            <button
              className="text-xs text-muted-foreground hover:text-foreground underline"
              onClick={() => {
                setFilters({ search: "", status: "not_sold", daysInStock: "all", categoryFilter: "" });
                setSort("newest");
                setPlatformFilter("all");
                setActiveMkts([]);
                setShowFavoritesOnly(false);
              }}
            >
              Clear all
            </button>
          )}
        </div>
      )}

      {/* ── Add Filter panel ── */}
      <div className="flex justify-center">
        <button
          onClick={() => setFiltersExpanded(e => !e)}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          {filtersExpanded ? "Hide filters" : "Add filter +"}
        </button>
      </div>

      {filtersExpanded && (
        <div className="max-w-2xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-3 bg-muted/30 rounded-xl p-4">
          {/* Status */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Status</label>
            <Select value={filters.status} onValueChange={val => setFilters(f => ({ ...f, status: val }))}>
              <SelectTrigger className="h-9">
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

          {/* Sort */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Sort</label>
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="h-9">
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

          {/* Marketplace */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Marketplace</label>
            <Select value={platformFilter} onValueChange={setPlatformFilter}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Items</SelectItem>
                <SelectItem value="listed">Listed</SelectItem>
                <SelectItem value="unlisted">Not Listed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Quick actions */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground mb-0.5 block">Quick</label>
            <Button
              variant={showFavoritesOnly ? "default" : "outline"}
              size="sm"
              className="h-9 justify-start gap-1.5"
              onClick={() => setShowFavoritesOnly(prev => !prev)}
            >
              <Star className={`w-3.5 h-3.5 ${showFavoritesOnly ? "fill-current" : ""}`} />
              Favorites {favoritesCount > 0 && `(${favoritesCount})`}
            </Button>
          </div>

          {/* Marketplace chips */}
          <div className="col-span-2 sm:col-span-4 flex flex-wrap gap-1.5">
            {CROSSLIST_MARKETPLACES.map(m => {
              const active = activeMkts.includes(m.id);
              return (
                <button
                  key={m.id}
                  onClick={() => setActiveMkts(prev => active ? prev.filter(x => x !== m.id) : [...prev, m.id])}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
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
          </div>
        </div>
      )}

      {/* ── Select All ── */}
      {displayItems.length > 0 && (
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={selectedItems.length === displayItems.length && displayItems.length > 0}
              onCheckedChange={handleSelectAll}
              className="!h-[18px] !w-[18px] data-[state=checked]:!bg-emerald-600 data-[state=checked]:!border-emerald-600"
            />
            <span className="text-xs text-muted-foreground">
              {selectedItems.length > 0 ? `${selectedItems.length} selected` : `${displayItems.length} items`}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setViewMode("grid")} className={`p-1.5 rounded-md transition-colors ${viewMode === "grid" ? "bg-muted text-foreground" : "text-muted-foreground"}`}>
              <Grid2X2 className="w-4 h-4" />
            </button>
            <button onClick={() => setViewMode("list")} className={`p-1.5 rounded-md transition-colors ${viewMode === "list" ? "bg-muted text-foreground" : "text-muted-foreground"}`}>
              <Rows className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Children (item grid, alerts, etc.) */}
      {children}

      {/* ── Pagination ── */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <span>
          Showing {pageIndex * pageSize + 1}–{Math.min((pageIndex + 1) * pageSize, totalItems)} of {totalItems}
        </span>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" disabled={!canPrev} onClick={() => setPageIndex(p => Math.max(0, p - 1))} className="h-7 px-2 text-xs">
            Prev
          </Button>
          <Button variant="ghost" size="sm" disabled={!canNext} onClick={() => setPageIndex(p => p + 1)} className="h-7 px-2 text-xs">
            Next
          </Button>
          <Select value={String(pageSize)} onValueChange={v => { const n = Number(v); if ([50, 100, 200].includes(n)) setPageSize(n); }}>
            <SelectTrigger className="h-7 w-[70px] text-xs border-0">
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
