import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Loader2, Package, ExternalLink, Check, BarChart } from "lucide-react";
import { useEbaySearch, useEbaySearchInfinite } from "@/hooks/useEbaySearch";
import {
  ebayItemToInventory,
  formatEbayPrice,
  formatEbayCondition,
  formatEbayBuyingOption,
  getEbayItemUrl,
  isEbayItemAvailable,
} from "@/utils/ebayHelpers";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";

function EbaySearchDialogInner({
  open,
  onOpenChange,
  onSelectItem,
  initialSearchQuery = "",
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);
  const [limit] = useState(100); // Increased to 100 items
  const scrollAreaRef = React.useRef(null);

  // Set initial search query when dialog opens
  useEffect(() => {
    if (open && initialSearchQuery) {
      setSearchQuery(initialSearchQuery);
      setDebouncedQuery(initialSearchQuery);
    } else if (!open) {
      // Reset when dialog closes
      setSearchQuery("");
      setDebouncedQuery("");
      setSelectedItem(null);
    }
  }, [open, initialSearchQuery]);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Perform search - only when we have a valid query (2+ characters after trim)
  const trimmedQuery = debouncedQuery?.trim() || '';
  const hasValidQuery = trimmedQuery.length >= 2;

  const {
    data: searchResultsData,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useEbaySearchInfinite(
    {
      q: trimmedQuery,
      limit,
      // No sort parameter specified - eBay defaults to "Best Match" sorting
      // Best Match considers relevance, popularity, seller performance, etc.
      // This ensures the most relevant items (like consoles for "Gamecube") appear first
    },
    {
      enabled: hasValidQuery, // Only search if we have a valid query
      retry: false, // Don't retry failed searches automatically
      refetchOnWindowFocus: false, // Don't refetch when window regains focus
    }
  );

  // Flatten all pages into a single array of itemSummaries
  const searchResults = React.useMemo(() => {
    if (!searchResultsData?.pages) return null;
    
    // Combine all itemSummaries from all pages
    const allItems = searchResultsData.pages
      .flatMap((page) => page?.itemSummaries || [])
      .filter(Boolean);
    
    // Get total from the first page (should be same across all pages)
    const total = searchResultsData.pages[0]?.total || 0;
    
    return {
      itemSummaries: allItems,
      total,
    };
  }, [searchResultsData]);

  // Set up infinite scroll - detect when user scrolls near bottom
  useEffect(() => {
    if (!scrollAreaRef.current || !hasNextPage || isFetchingNextPage) return;

    const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
    if (!viewport) return;

    const handleScroll = () => {
      const scrollTop = viewport.scrollTop;
      const scrollHeight = viewport.scrollHeight;
      const clientHeight = viewport.clientHeight;
      
      // Load more when within 200px of bottom
      if (scrollHeight - scrollTop - clientHeight < 200 && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    };

    viewport.addEventListener('scroll', handleScroll);
    return () => viewport.removeEventListener('scroll', handleScroll);
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Use eBay's native "Best Match" sorting (default when no sort parameter is specified)
  // eBay's Best Match algorithm considers:
  // - Relevance to search terms
  // - Listing popularity and performance
  // - Seller performance and feedback
  // - Category relevance
  // - Item quality and condition
  // We preserve the original order from eBay's API results (sorted by Best Match)
  const items = React.useMemo(() => {
    if (!searchResults?.itemSummaries) return [];
    
    // Return items in their original order from eBay (sorted by Best Match/relevance)
    // This matches what users see on eBay.com when searching
    return (searchResults.itemSummaries || [])
      .filter(Boolean);
  }, [searchResults?.itemSummaries]);

  const handleSearch = () => {
    const trimmedQuery = searchQuery.trim();
    if (trimmedQuery.length >= 2) {
      // Immediately update debouncedQuery to bypass debounce delay when user clicks search
      setDebouncedQuery(trimmedQuery);
    }
  };

  const handleSelectItem = (item) => {
    setSelectedItem(item);
  };

  const handleConfirmSelection = () => {
    if (selectedItem) {
      const inventoryData = ebayItemToInventory(selectedItem);
      onSelectItem?.(inventoryData);
      handleClose();
    }
  };

  const handleClose = (openState) => {
    if (!openState) {
      setSearchQuery("");
      setDebouncedQuery("");
      setSelectedItem(null);
    }
    onOpenChange?.(openState);
  };

  // Build eBay sold listings URL
  const ebaySoldUrl = React.useMemo(() => {
    if (!debouncedQuery || debouncedQuery.trim().length < 2) {
      return "https://www.ebay.com/sch/i.html?_nkw=&LH_Sold=1&LH_Complete=1";
    }
    const query = debouncedQuery.trim();
    return `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&LH_Sold=1&LH_Complete=1`;
  }, [debouncedQuery]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[95vw] sm:w-[92vw] max-w-[70rem] max-h-[90vh] flex flex-col p-0">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-4 h-4" />
            Search eBay for Items
          </DialogTitle>
          <DialogDescription>
            Live listings. Select item &gt; add to inventory & edit.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 flex flex-col min-h-0">
          {/* Search Input */}
          <div className="space-y-2">
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  placeholder="Search eBay... (e.g., iPhone 15 Pro, Nike Sneakers)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleSearch();
                    }
                  }}
                />
              </div>
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
            {/* View Sold Button */}
            {hasValidQuery && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    window.open(ebaySoldUrl, "_blank", "noopener,noreferrer");
                  }}
                  disabled={isLoading}
                  className="gap-2"
                >
                  <BarChart className="w-4 h-4" />
                  View All Sold
                </Button>
              </div>
            )}
            {searchQuery && searchQuery.trim().length < 2 && (
              <p className="text-xs text-muted-foreground">
                Enter at least 2 characters to search
              </p>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>
                {error.message || "Failed to search eBay. Please try again."}
              </AlertDescription>
            </Alert>
          )}

          {/* Search Results */}
          <ScrollArea 
            ref={scrollAreaRef}
            className="h-[500px] w-full"
          >
            <div className="pr-4 space-y-3">
              {isLoading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">
                    Searching eBay...
                  </span>
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

              {!isLoading && !error && items.length > 0 && (
                <>
                {items.map((item) => {
                  const isSelected = selectedItem?.itemId === item.itemId;
                  const isAvailable = isEbayItemAvailable(item);
                  const imageUrl = item?.image?.imageUrl || null;

                  return (
                    <Card
                      key={item.itemId}
                      className={`cursor-pointer transition-all ${
                        isSelected
                          ? "ring-2 ring-primary border-primary"
                          : "hover:border-primary/50"
                      } ${!isAvailable ? "opacity-60" : ""}`}
                      onClick={() => isAvailable && handleSelectItem(item)}
                    >
                      <CardContent className="p-4">
                        <div className="flex gap-4">
                          {/* Item Image */}
                          {imageUrl && (
                            <img
                              src={imageUrl}
                              alt={item.title}
                              className="w-24 h-24 object-cover rounded-lg flex-shrink-0"
                            />
                          )}

                          {/* Item Details */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <h3 className="font-semibold text-sm line-clamp-2">
                                {item.title}
                              </h3>
                              {isSelected && (
                                <Check className="w-5 h-5 text-primary flex-shrink-0" />
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <Badge variant="default" className="font-semibold">
                                {formatEbayPrice(item.price)}
                              </Badge>
                              {item.buyingOptions && item.buyingOptions.length > 0 && (() => {
                                const buyingOption = formatEbayBuyingOption(item.buyingOptions);
                                return (
                                  <Badge variant="outline" className="text-foreground">
                                    {buyingOption.text}
                                  </Badge>
                                );
                              })()}
                              {item.condition && (
                                <Badge variant="outline" className="text-foreground">
                                  {formatEbayCondition(item.condition)}
                                </Badge>
                              )}
                              {!isAvailable && (
                                <Badge variant="destructive" className="font-semibold">Sold</Badge>
                              )}
                            </div>

                            <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                              {item.seller?.username && (
                                <span>Seller: {item.seller.username}</span>
                              )}
                              {item.shippingOptions?.shippingCost?.value && (
                                <span>
                                  Shipping:{" "}
                                  {formatEbayPrice(item.shippingOptions.shippingCost)}
                                </span>
                              )}
                              {item.quantityLimitPerBuyer && (
                                <span>Max Qty: {item.quantityLimitPerBuyer}</span>
                              )}
                              {item.itemLocation?.city && item.itemLocation.stateOrProvince && (
                                <span>
                                  Location: {item.itemLocation.city}, {item.itemLocation.stateOrProvince}
                                </span>
                              )}
                              {item.estimatedAvailabilities?.length > 0 && (
                                <span>
                                  Est. Delivery: {item.estimatedAvailabilities[0]?.estimatedAvailabilityDate 
                                    ? new Date(item.estimatedAvailabilities[0].estimatedAvailabilityDate).toLocaleDateString()
                                    : 'N/A'}
                                </span>
                              )}
                            </div>

                            {item.itemId && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="mt-2 h-7 text-xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const ebayUrl = getEbayItemUrl(item.itemId, item.itemWebUrl);
                                  window.open(ebayUrl, "_blank", "noopener,noreferrer");
                                }}
                              >
                                <ExternalLink className="w-3 h-3 mr-1" />
                                View on eBay
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
                
                {/* Loading indicator for next page */}
                {isFetchingNextPage && (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mr-2" />
                    <span className="text-sm text-muted-foreground">Loading more items...</span>
                  </div>
                )}
                
                {/* End of results message */}
                {!hasNextPage && items.length > 0 && (
                  <div className="text-center py-4 text-sm text-muted-foreground">
                    <p>No more items to load</p>
                  </div>
                )}
                </>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-4 border-t">
          <div className="flex flex-col gap-2">
            <div className="text-sm text-muted-foreground">
              {items.length > 0 && (
                <span>
                  Showing {items.length} {items.length === 1 ? "item" : "items"}
                  {searchResults?.total && searchResults.total > items.length && (
                    <span> of {searchResults.total} total</span>
                  )}
                </span>
              )}
            </div>
            {debouncedQuery && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-primary p-0"
                onClick={() => {
                  const ebaySearchUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(debouncedQuery)}`;
                  window.open(ebaySearchUrl, "_blank", "noopener,noreferrer");
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
            <Button
              onClick={handleConfirmSelection}
              disabled={!selectedItem}
            >
              Use Selected Item
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Wrapper: don't mount the heavy dialog (and its hooks) unless it's actually open.
// This prevents crashes on pages that include the dialog component but keep it closed.
export default function EbaySearchDialog(props) {
  if (!props?.open) return null;
  return <EbaySearchDialogInner {...props} />;
}

