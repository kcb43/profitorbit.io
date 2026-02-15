import { useState, useEffect, useMemo, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Search,
  Star,
  ExternalLink,
  SlidersHorizontal,
  Heart,
  BarChart3,
  TrendingDown,
  Filter,
  Loader2,
  Package,
  Check,
  Globe,
  Store
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEbaySearchInfinite } from '@/hooks/useEbaySearch';
import {
  ebayItemToInventory,
  formatEbayPrice,
  formatEbayCondition,
  formatEbayBuyingOption,
  getEbayItemUrl,
  isEbayItemAvailable,
} from '@/utils/ebayHelpers';

/**
 * Enhanced Product Search Dialog
 * Combines Universal Product Search (all marketplaces) + eBay-specific search
 */
export function EnhancedProductSearchDialog({ open, onOpenChange, initialQuery = '', onSelectItem }) {
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [searchMode, setSearchMode] = useState('all'); // 'all' or 'ebay'
  const [showFilters, setShowFilters] = useState(false);
  const { toast } = useToast();
  const scrollAreaRef = useRef(null);

  // Universal Search State
  const [universalProducts, setUniversalProducts] = useState([]);
  const [universalLoading, setUniversalLoading] = useState(false);
  const [universalStats, setUniversalStats] = useState(null);

  // eBay Search State (using existing hook)
  const [selectedEbayItem, setSelectedEbayItem] = useState(null);
  
  // Filters
  const [filters, setFilters] = useState({
    minPrice: '',
    maxPrice: '',
    minDiscount: 0,
    minRating: 0,
    sortBy: 'relevance',
    marketplace: 'all'
  });

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // eBay Search Setup
  const trimmedQuery = debouncedQuery?.trim() || '';
  const hasValidQuery = trimmedQuery.length >= 2;

  const {
    data: ebaySearchResultsData,
    isLoading: ebayLoading,
    error: ebayError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useEbaySearchInfinite(
    {
      q: trimmedQuery,
      limit: 100,
    },
    {
      enabled: hasValidQuery && searchMode === 'ebay' && open,
      retry: false,
      refetchOnWindowFocus: false,
    }
  );

  // Flatten eBay results
  const ebaySearchResults = useMemo(() => {
    if (!ebaySearchResultsData?.pages) return null;
    const allItems = ebaySearchResultsData.pages
      .flatMap((page) => page?.itemSummaries || [])
      .filter(Boolean);
    const total = ebaySearchResultsData.pages[0]?.total || 0;
    return { itemSummaries: allItems, total };
  }, [ebaySearchResultsData]);

  const ebayItems = useMemo(() => {
    if (!ebaySearchResults?.itemSummaries) return [];
    return ebaySearchResults.itemSummaries.filter(Boolean);
  }, [ebaySearchResults?.itemSummaries]);

  // Set up infinite scroll for eBay
  useEffect(() => {
    if (!scrollAreaRef.current || !hasNextPage || isFetchingNextPage || searchMode !== 'ebay') return;

    const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
    if (!viewport) return;

    const handleScroll = () => {
      const scrollTop = viewport.scrollTop;
      const scrollHeight = viewport.scrollHeight;
      const clientHeight = viewport.clientHeight;
      
      if (scrollHeight - scrollTop - clientHeight < 200 && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    };

    viewport.addEventListener('scroll', handleScroll);
    return () => viewport.removeEventListener('scroll', handleScroll);
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, searchMode]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setSearchQuery('');
      setDebouncedQuery('');
      setUniversalProducts([]);
      setSelectedEbayItem(null);
      setUniversalStats(null);
    } else if (initialQuery) {
      setSearchQuery(initialQuery);
      setDebouncedQuery(initialQuery);
    }
  }, [open, initialQuery]);

  // Universal Search function
  const handleUniversalSearch = async () => {
    if (!searchQuery.trim()) {
      toast({
        title: 'Search query required',
        description: 'Please enter a product name to search',
        variant: 'destructive'
      });
      return;
    }

    setUniversalLoading(true);
    setUniversalProducts([]);
    setUniversalStats(null);

    try {
      const response = await fetch('/api/product-search/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchQuery,
          filters: {
            ...filters,
            minPrice: filters.minPrice ? parseFloat(filters.minPrice) : undefined,
            maxPrice: filters.maxPrice ? parseFloat(filters.maxPrice) : undefined,
          }
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Search failed');
      }

      setUniversalProducts(data.products || []);
      setUniversalStats(data.stats || null);

      toast({
        title: `✅ Search complete (${data.searchTime || '0s'})`,
        description: `Found ${data.totalResults || 0} products${data.sources ? ` from ${data.sources.join(', ')}` : ''}`
      });

    } catch (error) {
      console.error('Universal search error:', error);
      toast({
        title: '❌ Search failed',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setUniversalLoading(false);
    }
  };

  // Handle search based on mode
  const handleSearch = () => {
    if (searchMode === 'all') {
      handleUniversalSearch();
    } else {
      // eBay search is automatic via useEbaySearchInfinite hook
      setDebouncedQuery(searchQuery.trim());
    }
  };

  // Handle eBay item selection
  const handleSelectEbayItem = (item) => {
    setSelectedEbayItem(item);
  };

  const handleConfirmEbaySelection = () => {
    if (selectedEbayItem && onSelectItem) {
      const inventoryData = ebayItemToInventory(selectedEbayItem);
      onSelectItem(inventoryData);
      onOpenChange(false);
    }
  };

  // Add to watchlist (universal products)
  const handleAddToWatchlist = async (product) => {
    try {
      const response = await fetch('/api/pulse/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_name: product.title,
          product_url: product.productUrl,
          product_image_url: product.imageUrl,
          marketplace: product.marketplace,
          initial_price: product.price,
          target_price: product.price * 0.85,
          notify_on_drop: true
        })
      });

      if (!response.ok) throw new Error('Failed to add to watchlist');

      toast({
        title: '⭐ Added to watchlist',
        description: `You'll be notified when price drops below $${(product.price * 0.85).toFixed(2)}`
      });
    } catch (error) {
      console.error('Watchlist error:', error);
      toast({
        title: '❌ Failed to add to watchlist',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  // Filtered universal products
  const filteredProducts = useMemo(() => {
    let filtered = universalProducts;

    if (filters.marketplace !== 'all') {
      filtered = filtered.filter(p => p.marketplace === filters.marketplace);
    }

    if (filters.minDiscount > 0) {
      filtered = filtered.filter(p => p.discountPercentage >= filters.minDiscount);
    }

    if (filters.minRating > 0) {
      filtered = filtered.filter(p => p.rating && p.rating >= filters.minRating);
    }

    return filtered;
  }, [universalProducts, filters]);

  // Get unique marketplaces from universal results
  const marketplaces = useMemo(() => {
    const unique = [...new Set(universalProducts.map(p => p.marketplace))];
    return unique.sort();
  }, [universalProducts]);

  // Build eBay sold listings URL
  const ebaySoldUrl = useMemo(() => {
    if (!debouncedQuery || debouncedQuery.trim().length < 2) {
      return "https://www.ebay.com/sch/i.html?_nkw=&LH_Sold=1&LH_Complete=1";
    }
    const query = debouncedQuery.trim();
    return `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&LH_Sold=1&LH_Complete=1`;
  }, [debouncedQuery]);

  const isLoading = searchMode === 'all' ? universalLoading : ebayLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] h-[90vh] flex flex-col p-0">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <Search className="h-6 w-6" />
            Product Search
          </DialogTitle>
          <DialogDescription>
            Search all marketplaces or focus on eBay listings
          </DialogDescription>
        </DialogHeader>

        {/* Search Mode Selector */}
        <div className="px-6 pt-4 pb-2">
          <Tabs value={searchMode} onValueChange={setSearchMode} className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="all" className="flex items-center gap-2">
                <Globe className="w-4 h-4" />
                All Marketplaces
              </TabsTrigger>
              <TabsTrigger value="ebay" className="flex items-center gap-2">
                <Store className="w-4 h-4" />
                eBay Only
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Search Bar */}
        <div className="px-6 pb-4 border-b bg-muted/20">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={searchMode === 'all' ? 'Search any product across 100+ stores...' : 'Search eBay listings...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10 h-12 text-base"
                disabled={isLoading}
              />
            </div>
            <Button
              onClick={handleSearch}
              disabled={isLoading || !searchQuery.trim() || searchQuery.trim().length < 2}
              size="lg"
              className="px-8"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Searching...
                </>
              ) : (
                'Search'
              )}
            </Button>
            {searchMode === 'all' && (
              <Button
                variant="outline"
                size="lg"
                onClick={() => setShowFilters(!showFilters)}
                className={cn(showFilters && 'bg-muted')}
              >
                <SlidersHorizontal className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* eBay View Sold Button */}
          {searchMode === 'ebay' && hasValidQuery && (
            <div className="flex items-center gap-2 mt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(ebaySoldUrl, "_blank", "noopener,noreferrer")}
                disabled={isLoading}
                className="gap-2"
              >
                <BarChart3 className="w-4 h-4" />
                View All Sold
              </Button>
            </div>
          )}

          {/* Filters Panel (Universal only) */}
          {searchMode === 'all' && showFilters && (
            <div className="mt-4 p-4 bg-background border rounded-lg grid grid-cols-2 md:grid-cols-5 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Min Price</label>
                <Input
                  type="number"
                  placeholder="$0"
                  value={filters.minPrice}
                  onChange={(e) => setFilters({ ...filters, minPrice: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Max Price</label>
                <Input
                  type="number"
                  placeholder="$9999"
                  value={filters.maxPrice}
                  onChange={(e) => setFilters({ ...filters, maxPrice: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Min Discount</label>
                <select
                  className="w-full h-10 px-3 rounded-md border bg-background"
                  value={filters.minDiscount}
                  onChange={(e) => setFilters({ ...filters, minDiscount: parseInt(e.target.value) })}
                >
                  <option value={0}>Any</option>
                  <option value={10}>10%+</option>
                  <option value={25}>25%+</option>
                  <option value={50}>50%+</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Marketplace</label>
                <select
                  className="w-full h-10 px-3 rounded-md border bg-background"
                  value={filters.marketplace}
                  onChange={(e) => setFilters({ ...filters, marketplace: e.target.value })}
                >
                  <option value="all">All Marketplaces</option>
                  {marketplaces.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Sort By</label>
                <select
                  className="w-full h-10 px-3 rounded-md border bg-background"
                  value={filters.sortBy}
                  onChange={(e) => setFilters({ ...filters, sortBy: e.target.value })}
                >
                  <option value="relevance">Relevance</option>
                  <option value="price_low">Price: Low to High</option>
                  <option value="price_high">Price: High to Low</option>
                  <option value="discount">Biggest Discounts</option>
                  <option value="rating">Highest Rated</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Stats Bar (Universal) */}
        {searchMode === 'all' && universalStats && !universalLoading && (
          <div className="px-6 py-2 bg-muted/30 border-b text-sm flex items-center gap-6">
            <span className="font-semibold">{filteredProducts.length} Results</span>
            {universalStats.priceStats.lowest !== Infinity && (
              <>
                <span className="text-muted-foreground">
                  ${universalStats.priceStats.lowest.toFixed(2)} - ${universalStats.priceStats.highest.toFixed(2)}
                </span>
                <span className="text-muted-foreground">
                  Avg: ${universalStats.priceStats.average}
                </span>
              </>
            )}
          </div>
        )}

        {/* Results */}
        <div className="flex-1 overflow-auto px-6 py-4 min-h-0">
          {searchMode === 'all' ? (
            <UniversalResults
              loading={universalLoading}
              products={filteredProducts}
              onAddToWatchlist={handleAddToWatchlist}
            />
          ) : (
            <EbayResults
              loading={ebayLoading}
              error={ebayError}
              items={ebayItems}
              selectedItem={selectedEbayItem}
              onSelectItem={handleSelectEbayItem}
              hasNextPage={hasNextPage}
              isFetchingNextPage={isFetchingNextPage}
              searchQuery={debouncedQuery}
              scrollAreaRef={scrollAreaRef}
              total={ebaySearchResults?.total}
            />
          )}
        </div>

        {/* Footer (eBay mode only) */}
        {searchMode === 'ebay' && ebayItems.length > 0 && onSelectItem && (
          <div className="px-6 py-4 border-t flex justify-between items-center">
            <div className="text-sm text-muted-foreground">
              {selectedEbayItem ? 'Item selected - click "Use Selected" to add to inventory' : 'Select an item to continue'}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleConfirmEbaySelection}
                disabled={!selectedEbayItem}
              >
                Use Selected Item
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Universal Results Component
function UniversalResults({ loading, products, onAddToWatchlist }) {
  if (loading) {
    return <LoadingState />;
  }

  if (products.length === 0) {
    return <UniversalEmptyState />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-background z-10">
          <tr className="text-xs text-muted-foreground border-b">
            <th className="py-3 px-3 text-left w-16">Image</th>
            <th className="py-3 px-3 text-left">Product</th>
            <th className="py-3 px-3 text-center w-28">Marketplace</th>
            <th className="py-3 px-3 text-right w-24">Price</th>
            <th className="py-3 px-3 text-right w-24">Was</th>
            <th className="py-3 px-3 text-center w-20">Discount</th>
            <th className="py-3 px-3 text-center w-24">Rating</th>
            <th className="py-3 px-3 text-center w-32">Actions</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product, idx) => (
            <ProductRow
              key={idx}
              product={product}
              onAddToWatchlist={onAddToWatchlist}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Product Row (Universal)
function ProductRow({ product, onAddToWatchlist }) {
  const hasDiscount = product.originalPrice && product.originalPrice > product.price;

  return (
    <tr className="border-b last:border-b-0 hover:bg-muted/20">
      <td className="py-2 px-3">
        <div className="w-14 h-14 rounded-md bg-muted overflow-hidden flex-shrink-0">
          {product.imageUrl ? (
            <img src={product.imageUrl} alt={product.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
              No img
            </div>
          )}
        </div>
      </td>
      <td className="py-2 px-3">
        <div className="max-w-md">
          <div className="font-medium text-sm line-clamp-2 mb-1">{product.title}</div>
          {product.seller && (
            <div className="text-xs text-muted-foreground">by {product.seller}</div>
          )}
        </div>
      </td>
      <td className="py-2 px-3 text-center">
        <span className="text-xs font-medium capitalize">{product.marketplace}</span>
      </td>
      <td className="py-2 px-3 text-right">
        <span className="text-lg font-bold text-primary">${product.price.toFixed(2)}</span>
      </td>
      <td className="py-2 px-3 text-right">
        {hasDiscount ? (
          <span className="text-sm text-muted-foreground line-through">${product.originalPrice.toFixed(2)}</span>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </td>
      <td className="py-2 px-3 text-center">
        {product.discountPercentage > 0 ? (
          <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
            -{product.discountPercentage}%
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
      <td className="py-2 px-3 text-center">
        {product.rating ? (
          <div className="flex items-center justify-center gap-1">
            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
            <span className="text-sm font-medium">{product.rating}</span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
      <td className="py-2 px-3">
        <div className="flex items-center justify-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0"
            onClick={() => onAddToWatchlist(product)}
            title="Add to Watchlist"
          >
            <Heart className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="default"
            className="h-8 px-3"
            onClick={() => window.open(product.productUrl, '_blank')}
          >
            <ExternalLink className="h-3 w-3" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

// eBay Results Component
function EbayResults({ loading, error, items, selectedItem, onSelectItem, hasNextPage, isFetchingNextPage, searchQuery, scrollAreaRef, total }) {
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {error.message || "Failed to search eBay. Please try again."}
        </AlertDescription>
      </Alert>
    );
  }

  if (loading && items.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Searching eBay...</span>
      </div>
    );
  }

  if (!loading && !searchQuery && items.length === 0) {
    return <EbayEmptyState />;
  }

  if (!loading && searchQuery && items.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p>No items found. Try a different search term.</p>
      </div>
    );
  }

  return (
    <ScrollArea ref={scrollAreaRef} className="h-full w-full">
      <div className="pr-4 space-y-3">
        {items.map((item) => {
          const isSelected = selectedItem?.itemId === item.itemId;
          const isAvailable = isEbayItemAvailable(item);
          const imageUrl = item?.image?.imageUrl || null;

          return (
            <Card
              key={item.itemId}
              className={cn(
                "cursor-pointer transition-all",
                isSelected && "ring-2 ring-primary border-primary",
                !isSelected && "hover:border-primary/50",
                !isAvailable && "opacity-60"
              )}
              onClick={() => isAvailable && onSelectItem(item)}
            >
              <CardContent className="p-4">
                <div className="flex gap-4">
                  {imageUrl && (
                    <img
                      src={imageUrl}
                      alt={item.title}
                      className="w-24 h-24 object-cover rounded-lg flex-shrink-0"
                    />
                  )}

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
                        <span>Shipping: {formatEbayPrice(item.shippingOptions.shippingCost)}</span>
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

        {isFetchingNextPage && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mr-2" />
            <span className="text-sm text-muted-foreground">Loading more items...</span>
          </div>
        )}

        {!hasNextPage && items.length > 0 && (
          <div className="text-center py-4 text-sm text-muted-foreground">
            <p>Showing {items.length} {total && total > items.length ? `of ${total}` : ''} items</p>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}

// Loading State
function LoadingState() {
  return (
    <div className="space-y-2">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex gap-3 items-center">
          <Skeleton className="w-14 h-14 rounded-md" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  );
}

// Empty States
function UniversalEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center py-12 px-6">
      <Globe className="h-16 w-16 text-muted-foreground mb-4" />
      <h3 className="text-xl font-semibold mb-2">Search Products Across 100+ Marketplaces</h3>
      <p className="text-muted-foreground max-w-md">
        Enter any product name to search across Amazon, Walmart, Best Buy, Target, and more.
        Compare prices instantly.
      </p>
    </div>
  );
}

function EbayEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center py-12 px-6">
      <Store className="h-16 w-16 text-muted-foreground mb-4" />
      <h3 className="text-xl font-semibold mb-2">Search eBay Listings</h3>
      <p className="text-muted-foreground max-w-md">
        Enter a search term to find live eBay listings. Perfect for sourcing inventory and price comparison.
      </p>
    </div>
  );
}

export default EnhancedProductSearchDialog;
