import React, { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  Search,
  Loader2,
  Package,
  ExternalLink,
  Check,
  ChevronLeft,
  Truck,
  Star,
  MapPin,
  Eye,
} from "lucide-react";
import { useEbaySearchInfinite } from "@/hooks/useEbaySearch";
import {
  ebayItemToInventory,
  formatEbayPrice,
  formatEbayCondition,
  formatEbayBuyingOption,
  getEbayItemUrl,
  isEbayItemAvailable,
} from "@/utils/ebayHelpers";
import { cn } from "@/lib/utils";

// ─── Active Item Detail Panel ─────────────────────────────────────────────────

function ActiveItemDetail({ item, onClose }) {
  if (!item) return null;
  const imageUrl = item?.image?.imageUrl;
  const price = formatEbayPrice(item.price);
  const condition = item.condition ? formatEbayCondition(item.condition) : null;
  const buyingOption = item.buyingOptions?.length
    ? formatEbayBuyingOption(item.buyingOptions)
    : null;
  const sellerFeedback = item.seller?.feedbackPercentage
    ? `${item.seller.feedbackPercentage}%`
    : null;
  const location = item.itemLocation
    ? [item.itemLocation.city, item.itemLocation.stateOrProvince].filter(Boolean).join(', ')
    : null;
  const shippingCost = item.shippingOptions?.shippingCost;
  const ebayUrl = getEbayItemUrl(item.itemId, item.itemWebUrl);

  return (
    <div className="space-y-4">
      <button
        onClick={onClose}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors lg:hidden"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to results
      </button>

      {imageUrl && (
        <div className="bg-muted rounded-lg overflow-hidden aspect-square w-full max-w-[220px] mx-auto">
          <img src={imageUrl} alt={item.title} className="w-full h-full object-contain p-2" />
        </div>
      )}

      <div className="space-y-2">
        <p className="font-semibold text-base leading-snug">{item.title}</p>
        <div className="flex flex-wrap items-center gap-2">
          {price && (
            <Badge className="bg-primary hover:bg-primary text-primary-foreground font-bold text-base px-3 py-1">
              {price}
            </Badge>
          )}
          {condition && <Badge variant="outline" className="text-xs">{condition}</Badge>}
          {buyingOption && <Badge variant="outline" className="text-xs">{buyingOption.text}</Badge>}
        </div>
      </div>

      <Separator />

      {(shippingCost || item.shippingOptions) && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Truck className="w-3.5 h-3.5" />
            <span>Shipping</span>
          </div>
          <div className="text-sm text-muted-foreground">
            {shippingCost?.value != null
              ? (parseFloat(shippingCost.value) === 0 ? 'Free Shipping' : formatEbayPrice(shippingCost))
              : 'See listing for shipping details'}
          </div>
        </div>
      )}

      {(item.seller?.username || sellerFeedback) && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Star className="w-3.5 h-3.5" />
            <span>Seller</span>
          </div>
          <div className="flex flex-wrap gap-3 text-muted-foreground">
            {item.seller?.username && (
              <span className="text-sm font-medium text-foreground">{item.seller.username}</span>
            )}
            {sellerFeedback && (
              <span className="text-xs flex items-center gap-0.5">
                <Star className="w-3 h-3 text-amber-400" />
                {sellerFeedback} positive
              </span>
            )}
          </div>
        </div>
      )}

      {location && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <MapPin className="w-3.5 h-3.5" />
            <span>Location</span>
          </div>
          <div className="text-sm text-muted-foreground">{location}</div>
        </div>
      )}

      {item.watchCount != null && item.watchCount > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Eye className="w-3.5 h-3.5" />
            <span>Watchers</span>
          </div>
          <div className="text-sm text-muted-foreground">
            {item.watchCount.toLocaleString()} watching
          </div>
        </div>
      )}

      {item.itemId && (
        <>
          <Separator />
          <p className="text-xs text-muted-foreground">Item ID: {item.itemId}</p>
        </>
      )}

      <Button
        variant="outline"
        className="w-full gap-2"
        onClick={() => window.open(ebayUrl, '_blank', 'noopener,noreferrer')}
      >
        <ExternalLink className="w-4 h-4" />
        View Full Listing on eBay
      </Button>
    </div>
  );
}

// ─── Main Dialog ──────────────────────────────────────────────────────────────

function EbaySearchDialogInner({
  open,
  onOpenChange,
  onSelectItem,
  initialSearchQuery = "",
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [limit] = useState(100);
  const scrollAreaRef = React.useRef(null);

  useEffect(() => {
    if (open && initialSearchQuery) {
      setSearchQuery(initialSearchQuery);
      setDebouncedQuery(initialSearchQuery);
    } else if (!open) {
      setSearchQuery("");
      setDebouncedQuery("");
      setSelectedItem(null);
      setShowDetail(false);
    }
  }, [open, initialSearchQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const trimmedQuery = debouncedQuery?.trim() || '';
  const hasValidQuery = trimmedQuery.length >= 2;

  const {
    data: searchResultsData,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useEbaySearchInfinite(
    { q: trimmedQuery, limit },
    {
      enabled: hasValidQuery,
      retry: false,
      refetchOnWindowFocus: false,
    }
  );

  const searchResults = useMemo(() => {
    if (!searchResultsData?.pages) return null;
    const allItems = searchResultsData.pages
      .flatMap((page) => page?.itemSummaries || [])
      .filter(Boolean);
    const total = searchResultsData.pages[0]?.total || 0;
    return { itemSummaries: allItems, total };
  }, [searchResultsData]);

  // Infinite scroll
  useEffect(() => {
    if (!scrollAreaRef.current || !hasNextPage || isFetchingNextPage) return;
    const container = scrollAreaRef.current;
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      if (scrollHeight - scrollTop - clientHeight < 200 && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    };
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const items = useMemo(() => {
    if (!searchResults?.itemSummaries) return [];
    return (searchResults.itemSummaries || []).filter(Boolean);
  }, [searchResults?.itemSummaries]);

  // Price stats for active listings
  const priceStats = useMemo(() => {
    if (!items.length) return null;
    const prices = items
      .map(item => parseFloat(item.price?.value))
      .filter(p => !isNaN(p) && p > 0);
    if (!prices.length) return null;
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const avg = prices.reduce((s, p) => s + p, 0) / prices.length;
    return { min, max, avg };
  }, [items]);

  const handleSearch = () => {
    const trimmed = searchQuery.trim();
    if (trimmed.length >= 2) {
      setDebouncedQuery(trimmed);
    }
  };

  const handleSelectItem = (item) => {
    if (selectedItem?.itemId === item.itemId && showDetail) {
      setShowDetail(false);
      setSelectedItem(null);
    } else {
      setSelectedItem(item);
      setShowDetail(true);
    }
  };

  const handleConfirmSelection = () => {
    if (selectedItem) {
      const inventoryData = ebayItemToInventory(selectedItem);
      onSelectItem?.(inventoryData);
      handleClose(false);
    }
  };

  const handleClose = (openState) => {
    if (!openState) {
      setSearchQuery("");
      setDebouncedQuery("");
      setSelectedItem(null);
      setShowDetail(false);
    }
    onOpenChange?.(openState);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[95vw] sm:w-[92vw] max-w-[80rem] max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-4 h-4" />
            Search eBay for Items
          </DialogTitle>
          <DialogDescription>
            Live listings. Select item &gt; add to inventory &amp; edit.
          </DialogDescription>
        </DialogHeader>

        {/* Search bar */}
        <div className="px-6 py-3 border-b flex-shrink-0">
          <div className="flex gap-2">
            <Input
              placeholder="Search eBay... (e.g., iPhone 15 Pro, Nike Sneakers)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
            />
            <Button
              onClick={handleSearch}
              disabled={isLoading || searchQuery.trim().length < 2}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Search className="w-4 h-4 mr-2" />
              )}
              Search
            </Button>
          </div>
          {searchQuery && searchQuery.trim().length < 2 && (
            <p className="text-xs text-muted-foreground mt-1">
              Enter at least 2 characters to search
            </p>
          )}
        </div>

        {/* Price stats bar */}
        {priceStats && !isLoading && items.length > 0 && (
          <div className="px-6 py-2 bg-muted/30 border-b text-sm flex items-center gap-6 flex-shrink-0">
            <span className="font-semibold">{items.length} Active Listings</span>
            <span className="text-muted-foreground">
              ${priceStats.min.toFixed(2)} – ${priceStats.max.toFixed(2)}
            </span>
            <span className="text-muted-foreground">Avg: ${priceStats.avg.toFixed(2)}</span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="px-6 pt-3 flex-shrink-0">
            <Alert variant="destructive">
              <AlertDescription>
                {error.message || "Failed to search eBay. Please try again."}
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Two-panel results area */}
        <div className={cn('flex-1 min-h-0 flex overflow-hidden', showDetail ? 'flex-col lg:flex-row' : 'flex-col')}>
          {/* Results list */}
          <div
            ref={scrollAreaRef}
            className={cn(
              'flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-3',
              showDetail && 'lg:max-w-sm lg:border-r'
            )}
          >
            {isLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">Searching eBay...</span>
              </div>
            )}

            {!isLoading && !error && debouncedQuery && items.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No items found. Try a different search term.</p>
              </div>
            )}

            {!isLoading && !error && !debouncedQuery && (
              <div className="text-center py-8 text-muted-foreground">
                <Search className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Enter a search term to find items on eBay</p>
              </div>
            )}

            {!isLoading && !error && items.length > 0 && items.map((item) => {
              const isSelected = selectedItem?.itemId === item.itemId;
              const isAvailable = isEbayItemAvailable(item);
              const imageUrl = item?.image?.imageUrl || null;

              return (
                <div
                  key={item.itemId}
                  className={cn(
                    'flex gap-3 p-3 rounded-lg border cursor-pointer transition-all',
                    isSelected
                      ? 'border-primary ring-1 ring-primary bg-primary/5'
                      : 'hover:border-primary/50 hover:bg-muted/30',
                    !isAvailable && 'opacity-60'
                  )}
                  onClick={() => isAvailable && handleSelectItem(item)}
                >
                  {imageUrl && (
                    <img
                      src={imageUrl}
                      alt={item.title}
                      className="w-16 h-16 object-cover rounded-md flex-shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="font-medium text-sm line-clamp-2 leading-snug">{item.title}</p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="default" className="font-semibold text-xs">
                        {formatEbayPrice(item.price)}
                      </Badge>
                      {item.buyingOptions?.length > 0 && (() => {
                        const opt = formatEbayBuyingOption(item.buyingOptions);
                        return <Badge variant="outline" className="text-xs">{opt.text}</Badge>;
                      })()}
                      {item.condition && (
                        <Badge variant="outline" className="text-xs">
                          {formatEbayCondition(item.condition)}
                        </Badge>
                      )}
                      {!isAvailable && (
                        <Badge variant="destructive" className="text-xs">Sold</Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      {item.seller?.username && <span>Seller: {item.seller.username}</span>}
                      {item.shippingOptions?.shippingCost?.value && (
                        <span>Shipping: {formatEbayPrice(item.shippingOptions.shippingCost)}</span>
                      )}
                      {item.itemLocation?.city && (
                        <span>{item.itemLocation.city}{item.itemLocation.stateOrProvince ? `, ${item.itemLocation.stateOrProvince}` : ''}</span>
                      )}
                      {item.watchCount != null && item.watchCount > 0 && (
                        <span className="flex items-center gap-0.5">
                          <Eye className="w-3 h-3" />{item.watchCount.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex-shrink-0 flex items-center text-muted-foreground">
                    {isSelected
                      ? <Check className="w-4 h-4 text-primary" />
                      : <ExternalLink className="w-3.5 h-3.5 opacity-40" />
                    }
                  </div>
                </div>
              );
            })}

            {isFetchingNextPage && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mr-2" />
                <span className="text-sm text-muted-foreground">Loading more items...</span>
              </div>
            )}

            {!hasNextPage && items.length > 0 && !isFetchingNextPage && (
              <div className="text-center py-3 text-xs text-muted-foreground">
                Showing all {items.length}{searchResults?.total && searchResults.total > items.length ? ` of ${searchResults.total}` : ''} items
              </div>
            )}
          </div>

          {/* Detail panel */}
          {showDetail && selectedItem && (
            <div className="lg:w-[400px] flex-shrink-0 border-t lg:border-t-0 overflow-y-auto">
              <div className="p-4">
                <ActiveItemDetail
                  item={selectedItem}
                  onClose={() => { setShowDetail(false); setSelectedItem(null); }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex-shrink-0 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            {items.length > 0 && (
              <span className="text-sm text-muted-foreground">
                {items.length} {items.length === 1 ? "item" : "items"}
                {searchResults?.total && searchResults.total > items.length && (
                  <span> of {searchResults.total} total</span>
                )}
              </span>
            )}
            {debouncedQuery && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-primary p-0"
                onClick={() => {
                  window.open(
                    `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(debouncedQuery)}`,
                    "_blank",
                    "noopener,noreferrer"
                  );
                }}
              >
                <ExternalLink className="w-3 h-3 mr-1" />
                Search more on eBay
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => handleClose(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmSelection} disabled={!selectedItem}>
              Use Selected Item
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function EbaySearchDialog(props) {
  if (!props?.open) return null;
  return <EbaySearchDialogInner {...props} />;
}
