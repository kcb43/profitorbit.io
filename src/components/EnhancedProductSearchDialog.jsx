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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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
  Store,
  ChevronDown,
  ChevronUp,
  Truck,
  X,
  RefreshCw
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
import { supabase } from '@/integrations/supabase';
import { ProductCardV1List } from '@/components/ProductCardVariations';
import { getMerchantLogoOrColor } from '@/utils/merchantLogos';

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
  
  // Image lightbox state
  const [lightboxImage, setLightboxImage] = useState(null);
  
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
    
    // Prevent auto-focus on search input when dialog opens
    if (open) {
      // Small delay to let Dialog's focus trap settle, then blur any focused input
      setTimeout(() => {
        if (document.activeElement && document.activeElement.tagName === 'INPUT') {
          document.activeElement.blur();
        }
      }, 50);
    }
  }, [open, initialQuery]);

  // Auto-search for "All Marketplaces" mode when debouncedQuery changes
  useEffect(() => {
    if (searchMode === 'all' && debouncedQuery.trim().length >= 3 && open) {
      handleUniversalSearch();
    }
  }, [debouncedQuery, searchMode, open]);

  // Universal Search function (SerpAPI - like ProductSearch page)
  const handleUniversalSearch = async (forceFresh = false) => {
    const queryToSearch = debouncedQuery.trim() || searchQuery.trim();
    
    if (!queryToSearch) {
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
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        throw new Error('Please log in to search products');
      }

      // Use same endpoint as ProductSearch page
      const ORBEN_API_URL = import.meta.env.VITE_ORBEN_API_URL || 'https://orben-api.fly.dev';
      
      // Use same parameters as ProductSearch page for consistent results
      const params = new URLSearchParams({
        q: queryToSearch,
        providers: 'auto',
        country: 'US',
        page: '1',
        limit: '10',
        cache_version: 'v7_pagination' // Use same cache version as ProductSearch page
      });

      // Add cache_bust parameter if forcing fresh results
      if (forceFresh) {
        params.append('cache_bust', Date.now().toString());
      }

      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/27e41dcb-2d20-4818-a02b-7116067c6ef1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'EnhancedProductSearchDialog.jsx:215',message:'Dialog search params',data:{query:queryToSearch,paramsString:params.toString(),fullUrl:`${ORBEN_API_URL}/v1/search?${params}`,hasToken:!!token,forceFresh},timestamp:Date.now(),hypothesisId:'A,D,E'})}).catch(()=>{});
      // #endregion

      const response = await fetch(`${ORBEN_API_URL}/v1/search?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/27e41dcb-2d20-4818-a02b-7116067c6ef1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'EnhancedProductSearchDialog.jsx:226',message:'Dialog fetch response status',data:{query:queryToSearch,status:response.status,ok:response.ok,forceFresh},timestamp:Date.now(),hypothesisId:'F'})}).catch(()=>{});
      // #endregion

      if (!response.ok) {
        const errorText = await response.text();
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/27e41dcb-2d20-4818-a02b-7116067c6ef1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'EnhancedProductSearchDialog.jsx:232',message:'Dialog search error',data:{query:queryToSearch,status:response.status,errorText:errorText.slice(0,200),forceFresh},timestamp:Date.now(),hypothesisId:'G'})}).catch(()=>{});
        // #endregion
        throw new Error(`Search failed: ${response.status}`);
      }

      const data = await response.json();
      console.log('[Universal Search] Response:', data);

      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/27e41dcb-2d20-4818-a02b-7116067c6ef1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'EnhancedProductSearchDialog.jsx:228',message:'Dialog search response',data:{query:queryToSearch,itemCount:data.items?.length||0,hasItems:!!(data.items?.length),providers:data.providers,cached:data.providers?.[0]?.cached},timestamp:Date.now(),hypothesisId:'A,B'})}).catch(()=>{});
      // #endregion

      // Check for quota/provider errors
      if (data.providers && Array.isArray(data.providers)) {
        const providerErrors = data.providers.filter(p => p.error);
        if (providerErrors.length > 0) {
          console.warn('[Universal Search] Provider errors:', providerErrors);
          
          // Check for quota exceeded
          const quotaError = providerErrors.find(p => 
            p.error?.includes('quota') || p.error?.includes('exceeded') || p.error?.includes('limit')
          );
          
          if (quotaError) {
            toast({
              title: '⚠️ Search Quota Exceeded',
              description: quotaError.error || 'API quota limit reached. Results may be limited.',
              variant: 'destructive',
              duration: 8000
            });
          }
        }
      }

      // Transform SerpAPI results to match expected format
      const transformedProducts = (data.items || []).map(item => ({
        title: item.title || '',
        price: item.price || item.extracted_price || 0,
        originalPrice: item.old_price || item.extracted_old_price || null,
        discountPercentage: item.old_price && item.price
          ? Math.round(((item.old_price - item.price) / item.old_price) * 100)
          : 0,
        rating: item.rating || null,
        reviewCount: item.reviews || item.reviews_count || null,
        marketplace: item.merchant || item.source || 'Unknown',
        productUrl: item.link || item.url || '',
        imageUrl: item.image_url || item.thumbnail || '',
        seller: item.seller || null,
        delivery: item.delivery || null,
        condition: item.condition || null,
        snippet: item.snippet || '',
        immersive_product_page_token: item.immersive_product_page_token || null
      }));

      setUniversalProducts(transformedProducts);

      // Calculate stats
      const prices = transformedProducts.filter(p => p.price > 0).map(p => p.price);
      if (prices.length > 0) {
        setUniversalStats({
          priceStats: {
            lowest: Math.min(...prices),
            highest: Math.max(...prices),
            average: (prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2)
          }
        });
      }

      if (transformedProducts.length === 0) {
        toast({
          title: '⚠️ No results found',
          description: data.providers?.[0]?.error || 'Try a different search term or check your API quota.',
          variant: 'destructive'
        });
      } else {
        toast({
          title: `✅ Found ${transformedProducts.length} products`,
          description: `Search complete from ${data.providers?.map(p => p.provider).join(', ') || 'multiple sources'}`
        });
      }

    } catch (error) {
      console.error('Universal search error:', error);
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/27e41dcb-2d20-4818-a02b-7116067c6ef1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'EnhancedProductSearchDialog.jsx:318',message:'Dialog search exception',data:{query:queryToSearch,errorMsg:error.message,errorName:error.name},timestamp:Date.now(),hypothesisId:'H'})}).catch(()=>{});
      // #endregion
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
          {/* Mobile: Stack search bar and buttons, Desktop: Single row */}
          <div className="flex flex-col sm:flex-row gap-2">
            {/* Search Input - Full width on mobile, flex-1 on desktop */}
            <div className="w-full sm:flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={searchMode === 'all' ? 'Type to search all marketplaces...' : 'Search eBay listings...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchMode === 'ebay' && handleSearch()}
                className="pl-10 h-12 text-base"
                disabled={isLoading}
                autoFocus={false}
              />
            </div>
            
            {/* Buttons Row - Full width on mobile, auto width on desktop */}
            <div className="flex gap-2 w-full sm:w-auto">
              {/* Search button only shown for eBay mode, All Marketplaces is auto-search */}
              {searchMode === 'ebay' && (
                <Button
                  onClick={handleSearch}
                  disabled={isLoading || !searchQuery.trim() || searchQuery.trim().length < 2}
                  size="lg"
                  className="flex-1 sm:flex-none sm:px-8"
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
              )}
              {searchMode === 'all' && (
                <>
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => handleUniversalSearch(true)}
                    disabled={universalLoading || !searchQuery.trim()}
                    className="px-3"
                    title="Force refresh (bypass cache)"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => setShowFilters(!showFilters)}
                    className={cn(showFilters && 'bg-muted')}
                  >
                    <SlidersHorizontal className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
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
              onImageClick={setLightboxImage}
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
      
      {/* Image Lightbox */}
      {lightboxImage && (
        <div 
          className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
        >
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 text-white hover:bg-white/20"
            onClick={() => setLightboxImage(null)}
          >
            <X className="h-6 w-6" />
          </Button>
          <img 
            src={lightboxImage} 
            alt="Product" 
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </Dialog>
  );
}

// Universal Results Component - Table on Desktop, Cards on Mobile
function UniversalResults({ loading, products, onAddToWatchlist, onImageClick }) {
  if (loading) {
    return <LoadingState />;
  }

  if (products.length === 0) {
    return <UniversalEmptyState />;
  }

  return (
    <>
      {/* Mobile View - Card Layout */}
      <div className="md:hidden space-y-3">
        {products.map((product, idx) => (
          <ProductCardV1List 
            key={idx} 
            item={{
              ...product,
              image_url: product.imageUrl,
              link: product.productUrl,
              extracted_price: product.price,
              old_price: product.originalPrice,
              extracted_old_price: product.originalPrice,
              source: product.marketplace,
              reviews_count: product.reviewCount,
            }}
          />
        ))}
      </div>

      {/* Desktop View - Table Layout */}
      <div className="hidden md:block overflow-x-auto">
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
                onImageClick={onImageClick}
              />
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// Product Row (Universal) with merchant offers and image lightbox
function ProductRow({ product, onAddToWatchlist, onImageClick }) {
  const [isOpen, setIsOpen] = useState(false);
  const [merchantOffers, setMerchantOffers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  
  const merchantInfo = getMerchantLogoOrColor(product.marketplace);
  
  const hasDiscount = product.originalPrice && product.originalPrice > product.price;
  const hasToken = product.immersive_product_page_token;

  // Fetch merchant offers when expanded
  const fetchMerchantOffers = async () => {
    if (loaded || !hasToken) return;
    
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      const ORBEN_API_URL = import.meta.env.VITE_ORBEN_API_URL || 'https://orben-api.fly.dev';
      const response = await fetch(`${ORBEN_API_URL}/v1/product/offers`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          immersive_product_page_token: product.immersive_product_page_token
        })
      });

      if (response.ok) {
        const data = await response.json();
        setMerchantOffers(data.offers || []);
      }
    } catch (error) {
      console.error('Error fetching merchant offers:', error);
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  };

  // Fetch when opened
  useEffect(() => {
    if (isOpen && hasToken && !loaded) {
      fetchMerchantOffers();
    }
  }, [isOpen]);

  return (
    <>
      <tr className="border-b last:border-b-0 hover:bg-muted/20">
        <td className="py-2 px-3">
          <div 
            className="w-14 h-14 rounded-md bg-muted overflow-hidden flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-primary transition-all"
            onClick={() => product.imageUrl && onImageClick(product.imageUrl)}
          >
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
            {product.delivery && (
              <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                <Truck className="h-3 w-3" />
                {product.delivery}
              </div>
            )}
          </div>
        </td>
        <td className="py-2 px-3 text-center">
          <div className="flex items-center justify-center gap-2">
            {merchantInfo.hasLogo ? (
              <img 
                src={merchantInfo.logo} 
                alt={product.marketplace} 
                className="h-5 w-auto object-contain"
                onError={(e) => e.target.style.display = 'none'}
                title={product.marketplace}
              />
            ) : (
              <span className="text-xs font-medium capitalize">{product.marketplace}</span>
            )}
          </div>
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
            {hasToken && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0"
                onClick={() => setIsOpen(!isOpen)}
                title="View other stores"
              >
                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            )}
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
      {isOpen && hasToken && (
        <tr className="border-b">
          <td colSpan="8" className="py-2 px-3 bg-muted/10">
            <div className="max-w-4xl">
              <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-2">
                <Store className="h-3 w-3" />
                Other Stores & Prices
              </div>
              {loading ? (
                <div className="flex items-center gap-2 py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-xs text-muted-foreground">Loading offers...</span>
                </div>
              ) : merchantOffers.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {merchantOffers.map((offer, idx) => (
                    <Card key={idx} className="border shadow-sm hover:shadow-md transition-shadow">
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-semibold text-sm">{offer.merchant}</span>
                          <span className="text-lg font-bold text-primary">${offer.price.toFixed(2)}</span>
                        </div>
                        {offer.delivery && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1 mb-2">
                            <Truck className="h-3 w-3" />
                            {offer.delivery}
                          </div>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full"
                          onClick={() => window.open(offer.link, '_blank')}
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          Shop at {offer.merchant}
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground py-2">
                  No other merchant offers available for this product.
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// eBay Results Component - Table Format with All Details
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
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-background z-10">
            <tr className="text-xs text-muted-foreground border-b">
              <th className="py-3 px-3 text-left w-16">Image</th>
              <th className="py-3 px-3 text-left">Item Title</th>
              <th className="py-3 px-3 text-center w-24">Condition</th>
              <th className="py-3 px-3 text-right w-24">Price</th>
              <th className="py-3 px-3 text-center w-28">Buying Option</th>
              <th className="py-3 px-3 text-left w-32">Seller</th>
              <th className="py-3 px-3 text-right w-24">Shipping</th>
              <th className="py-3 px-3 text-left w-32">Location</th>
              <th className="py-3 px-3 text-center w-32">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const isSelected = selectedItem?.itemId === item.itemId;
              const isAvailable = isEbayItemAvailable(item);
              
              return (
                <EbayTableRow
                  key={item.itemId}
                  item={item}
                  isSelected={isSelected}
                  isAvailable={isAvailable}
                  onSelectItem={onSelectItem}
                />
              );
            })}
          </tbody>
        </table>

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

// eBay Table Row Component
function EbayTableRow({ item, isSelected, isAvailable, onSelectItem }) {
  const imageUrl = item?.image?.imageUrl || null;
  const buyingOption = item.buyingOptions && item.buyingOptions.length > 0 
    ? formatEbayBuyingOption(item.buyingOptions) 
    : null;
  const sellerFeedback = item.seller?.feedbackPercentage 
    ? `${item.seller.feedbackPercentage}%`
    : null;
  const itemLocation = item.itemLocation 
    ? `${item.itemLocation.city || ''}, ${item.itemLocation.stateOrProvince || ''}`.trim().replace(/^,\s*/, '')
    : null;

  return (
    <tr 
      className={cn(
        "border-b last:border-b-0 cursor-pointer transition-all",
        isSelected && "bg-primary/10 ring-2 ring-primary ring-inset",
        !isSelected && "hover:bg-muted/20",
        !isAvailable && "opacity-60"
      )}
      onClick={() => isAvailable && onSelectItem(item)}
    >
      {/* Image */}
      <td className="py-2 px-3">
        <div className="w-14 h-14 rounded-md bg-muted overflow-hidden flex-shrink-0 relative">
          {imageUrl ? (
            <img src={imageUrl} alt={item.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
              No img
            </div>
          )}
          {isSelected && (
            <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
              <Check className="w-6 h-6 text-primary" />
            </div>
          )}
        </div>
      </td>

      {/* Item Title */}
      <td className="py-2 px-3">
        <div className="max-w-md">
          <div className="font-medium text-sm line-clamp-2 mb-1">{item.title}</div>
          {!isAvailable && (
            <Badge variant="destructive" className="text-xs">Sold Out</Badge>
          )}
          {item.quantityLimitPerBuyer && (
            <div className="text-xs text-muted-foreground mt-1">Max Qty: {item.quantityLimitPerBuyer}</div>
          )}
        </div>
      </td>

      {/* Condition */}
      <td className="py-2 px-3 text-center">
        {item.condition ? (
          <Badge variant="outline" className="text-xs">
            {formatEbayCondition(item.condition)}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>

      {/* Price */}
      <td className="py-2 px-3 text-right">
        <span className="text-lg font-bold text-primary">
          {formatEbayPrice(item.price)}
        </span>
      </td>

      {/* Buying Option */}
      <td className="py-2 px-3 text-center">
        {buyingOption ? (
          <Badge variant="outline" className="text-xs">
            {buyingOption.text}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>

      {/* Seller Info */}
      <td className="py-2 px-3">
        <div className="text-sm">
          {item.seller?.username && (
            <div className="font-medium truncate">{item.seller.username}</div>
          )}
          {sellerFeedback && (
            <div className="text-xs text-green-600 dark:text-green-400">
              ⭐ {sellerFeedback}
            </div>
          )}
        </div>
      </td>

      {/* Shipping Cost */}
      <td className="py-2 px-3 text-right">
        {item.shippingOptions?.shippingCost?.value ? (
          <div className="text-sm">
            {formatEbayPrice(item.shippingOptions.shippingCost)}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
        {item.estimatedAvailabilities?.length > 0 && item.estimatedAvailabilities[0]?.estimatedAvailabilityDate && (
          <div className="text-xs text-muted-foreground mt-1">
            Est: {new Date(item.estimatedAvailabilities[0].estimatedAvailabilityDate).toLocaleDateString()}
          </div>
        )}
      </td>

      {/* Location */}
      <td className="py-2 px-3">
        <div className="text-xs text-muted-foreground truncate">
          {itemLocation || '—'}
        </div>
        {item.itemId && (
          <div className="text-xs text-muted-foreground mt-1">
            ID: {item.itemId.slice(-8)}
          </div>
        )}
      </td>

      {/* Actions */}
      <td className="py-2 px-3">
        <div className="flex items-center justify-center gap-1">
          <Button
            size="sm"
            variant="default"
            className="h-8 px-3"
            onClick={(e) => {
              e.stopPropagation();
              const ebayUrl = getEbayItemUrl(item.itemId, item.itemWebUrl);
              window.open(ebayUrl, "_blank", "noopener,noreferrer");
            }}
          >
            <ExternalLink className="h-3 w-3 mr-1" />
            View
          </Button>
        </div>
      </td>
    </tr>
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
        Enter any product name to search.
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
