import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Filter, Search, Archive, Star, Download, ChevronDown } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

export default function MobileFilterBar({
  // Common items (always visible)
  search,
  onSearchChange,
  showDeleted,
  onShowDeletedToggle,
  showFavorites,
  onShowFavoritesToggle,
  pageSize,
  onPageSizeChange,
  onExportCSV,
  pageInfo, // { currentPage, totalPages, totalItems }
  
  // Additional filters (in dropdown)
  additionalFilters = [],
  
  // Custom render function for additional filters
  renderAdditionalFilters,
}) {
  const isMobile = useIsMobile();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  if (!isMobile) {
    // Desktop: render nothing, let parent handle it
    return null;
  }

  return (
    <div className="space-y-3 w-full">
      {/* Always visible: Search, Show Deleted, Show Favorites */}
      <div className="flex flex-col gap-2">
        {/* Search */}
        <div>
          <Label htmlFor="mobile-search" className="text-xs mb-1.5 block">Search</Label>
          <div className="relative">
            <Input
              id="mobile-search"
              placeholder="Search..."
              value={search || ""}
              onChange={(e) => onSearchChange?.(e.target.value)}
              className="pl-8"
            />
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          </div>
        </div>

        {/* Show Deleted & Show Favorites */}
        <div className="flex gap-2">
          <Button
            variant={showDeleted ? "default" : "outline"}
            size="sm"
            onClick={onShowDeletedToggle}
            className="flex-1 flex items-center gap-2"
          >
            <Archive className="w-4 h-4" />
            <span className="truncate">{showDeleted ? "Showing Deleted" : "Show Deleted"}</span>
          </Button>
          <Button
            variant={showFavorites ? "default" : "outline"}
            size="sm"
            onClick={onShowFavoritesToggle}
            className="flex-1 flex items-center gap-2"
          >
            <Star className="w-4 h-4" />
            <span className="truncate">{showFavorites ? "Showing Favorites" : "Show Favorites"}</span>
          </Button>
        </div>
      </div>

      {/* Per Page, Export CSV, Page Info */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Label htmlFor="mobile-page-size" className="text-xs whitespace-nowrap">Per page:</Label>
          <Select value={String(pageSize)} onValueChange={(val) => onPageSizeChange?.(Number(val))}>
            <SelectTrigger id="mobile-page-size" className="w-20 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
              <SelectItem value="200">200</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={onExportCSV}
          className="flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          <span className="hidden sm:inline">Export CSV</span>
          <span className="sm:hidden">Export</span>
        </Button>

        {pageInfo && (
          <div className="text-xs text-muted-foreground ml-auto">
            Page {pageInfo.currentPage} of {pageInfo.totalPages} ({pageInfo.totalItems} items)
          </div>
        )}
      </div>

      {/* Filters & Sort Dropdown */}
      {(additionalFilters.length > 0 || renderAdditionalFilters) && (
        <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="w-full justify-between" size="sm">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4" />
                <span>Filters & Sort</span>
              </div>
              <ChevronDown className={`w-4 h-4 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[calc(100vw-2rem)] max-w-sm">
            <div className="p-3 space-y-3">
              {renderAdditionalFilters ? (
                renderAdditionalFilters()
              ) : (
                additionalFilters.map((filter, idx) => (
                  <div key={idx}>
                    {filter}
                  </div>
                ))
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
