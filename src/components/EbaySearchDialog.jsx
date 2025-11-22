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
import { Label } from "@/components/ui/label";
import { Search, Loader2, Package, ExternalLink, Check } from "lucide-react";
import { useEbaySearch } from "@/hooks/useEbaySearch";
import {
  ebayItemToInventory,
  formatEbayPrice,
  formatEbayCondition,
  getEbayItemUrl,
  isEbayItemAvailable,
} from "@/utils/ebayHelpers";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function EbaySearchDialog({
  open,
  onOpenChange,
  onSelectItem,
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);
  const [limit] = useState(100); // Increased to 100 items

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Perform search
  const {
    data: searchResults,
    isLoading,
    error,
    refetch,
  } = useEbaySearch(
    {
      q: debouncedQuery,
      limit,
      // Removed sort: "price" - let eBay use best match (relevance) instead of sorting by cheapest
      // This will show more relevant results like actual iPhones instead of just cases
      filter: "buyingOptions:{FIXED_PRICE}",
    },
    {
      enabled: !!debouncedQuery && debouncedQuery.length >= 2,
      retry: 1,
    }
  );

  // Filter and sort items for better relevance
  const items = React.useMemo(() => {
    if (!searchResults?.itemSummaries) return [];
    
    const allItems = searchResults.itemSummaries;
    const queryLower = debouncedQuery.toLowerCase();
    
    // Split query into words
    const queryWords = queryLower.split(/\s+/).filter(w => w.length > 0);
    
    // Score items based on relevance
    const scoredItems = allItems.map(item => {
      const titleLower = (item.title || '').toLowerCase();
      let score = 0;
      
      // Exact phrase match gets highest score
      if (titleLower.includes(queryLower)) {
        score += 100;
      }
      
      // Word matches
      queryWords.forEach(word => {
        if (titleLower.includes(word)) {
          score += 10;
        }
      });
      
      // Penalize common accessory keywords
      const accessoryKeywords = ['case', 'cover', 'protector', 'screen protector', 'charger', 'cable', 'adapter'];
      accessoryKeywords.forEach(keyword => {
        if (titleLower.includes(keyword) && !queryLower.includes(keyword)) {
          score -= 5;
        }
      });
      
      // Boost items that start with query words
      queryWords.forEach(word => {
        if (titleLower.startsWith(word)) {
          score += 5;
        }
      });
      
      return { ...item, _relevanceScore: score };
    });
    
    // Sort by relevance score (highest first), then by price
    return scoredItems.sort((a, b) => {
      if (b._relevanceScore !== a._relevanceScore) {
        return b._relevanceScore - a._relevanceScore;
      }
      // If scores are equal, sort by price (lower first)
      const priceA = a.price?.value || 0;
      const priceB = b.price?.value || 0;
      return priceA - priceB;
    });
  }, [searchResults?.itemSummaries, debouncedQuery]);

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

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-4 h-4" />
            Search eBay for Items
          </DialogTitle>
          <DialogDescription>
            Search for items on eBay to quickly fill in inventory details.
            Select an item to auto-populate the form.
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
          <ScrollArea className="flex-1 min-h-0 h-[400px]">
            <div className="pr-4">
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
                <div className="space-y-3">
                {items.map((item) => {
                  const isSelected = selectedItem?.itemId === item.itemId;
                  const isAvailable = isEbayItemAvailable(item);

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
                          {item.image?.imageUrl && (
                            <img
                              src={item.image.imageUrl}
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
                              {item.condition && (
                                <Badge variant="outline">
                                  {formatEbayCondition(item.condition)}
                                </Badge>
                              )}
                              {!isAvailable && (
                                <Badge variant="destructive">Ended</Badge>
                              )}
                            </div>

                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              {item.seller?.username && (
                                <span>Seller: {item.seller.username}</span>
                              )}
                              {item.shippingOptions?.shippingCost?.value && (
                                <span>
                                  Shipping:{" "}
                                  {formatEbayPrice(item.shippingOptions.shippingCost)}
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
                </div>
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

