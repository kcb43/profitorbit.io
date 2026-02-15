import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Loader2, LoaderCircle, ExternalLink, TrendingUp, ShoppingCart, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase';
import { useToast } from '@/components/ui/use-toast';

const ORBEN_API_URL = import.meta.env.VITE_ORBEN_API_URL || 'https://orben-api.fly.dev';

export default function ProductSearch() {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [prefetchQuery, setPrefetchQuery] = useState(''); // For predictive pre-fetching
  const [isPrefetching, setIsPrefetching] = useState(false); // Track prefetch state (for subtle UI hint)
  const [displayLimit, setDisplayLimit] = useState(10); // No longer needed but keeping for compatibility
  const [currentPage, setCurrentPage] = useState(1); // Track which page we're on for pagination
  const [totalFetched, setTotalFetched] = useState(0); // Track how many items we've fetched so far
  const [isLoadingMore, setIsLoadingMore] = useState(false); // Track background loading
  const [accumulatedItems, setAccumulatedItems] = useState([]); // Accumulate items across multiple fetches
  const { toast } = useToast();
  const debounceTimerRef = useRef(null);
  const prefetchTimerRef = useRef(null);

  // Debounce search query: wait 500ms after user stops typing (REDUCED from 800ms for AGGRESSIVE mode)
  useEffect(() => {
    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Only debounce if query is at least 3 characters
    if (query.trim().length >= 3) {
      debounceTimerRef.current = setTimeout(() => {
        setDebouncedQuery(query.trim());
        setDisplayLimit(10); // Reset display limit on new search
        setCurrentPage(1); // Reset to page 1 for new search
        setTotalFetched(0); // Reset total fetched on new search
      }, 500); // AGGRESSIVE: Reduced to 500ms (was 800ms) - faster searches
    } else {
      // Clear results if query is too short
      setDebouncedQuery('');
    }

    // Cleanup
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [query]);

  // AGGRESSIVE Predictive pre-fetching: Start loading at 2 characters with minimal delay
  useEffect(() => {
    // Clear existing prefetch timer
    if (prefetchTimerRef.current) {
      clearTimeout(prefetchTimerRef.current);
    }

    // Start AGGRESSIVE pre-fetching at 2 characters (before the 3-char threshold)
    if (query.trim().length >= 2) {
      prefetchTimerRef.current = setTimeout(() => {
        console.log('[ProductSearch] AGGRESSIVE pre-fetch triggered for:', query.trim());
        setPrefetchQuery(query.trim());
      }, 300); // AGGRESSIVE: Even shorter delay (300ms) for faster pre-loading
    } else if (query.trim().length < 2) {
      setPrefetchQuery('');
    }

    // Cleanup
    return () => {
      if (prefetchTimerRef.current) {
        clearTimeout(prefetchTimerRef.current);
      }
    };
  }, [query]);

  // Check if smart routing is enabled
  const disableSmartRouting = localStorage.getItem('orben_disable_smart_routing') === 'true';

  // AGGRESSIVE Predictive pre-fetch query (silently loads in background, ZERO UI interference)
  const { isFetching: isPrefetchFetching } = useQuery({
    queryKey: ['productSearchPrefetch', prefetchQuery, 10],
    queryFn: async () => {
      if (!prefetchQuery || prefetchQuery.length < 2) return null;

      console.log('[ProductSearch] AGGRESSIVE Pre-fetching results for:', prefetchQuery);
      setIsPrefetching(true); // Set prefetch indicator

      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      if (!token) {
        setIsPrefetching(false);
        return null; // Silently fail, ZERO UI impact
      }

      const providerList = 'auto';
      const params = new URLSearchParams({
        q: prefetchQuery,
        providers: providerList,
        country: 'US',
        limit: '20', // AGGRESSIVE: Pre-fetch 20 items (double previous)
        cache_version: 'v7_pagination'
      });

      const response = await fetch(`${ORBEN_API_URL}/v1/search?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setIsPrefetching(false); // Clear prefetch indicator

      if (!response.ok) return null; // Silently fail, ZERO UI impact

      return response.json();
    },
    enabled: !!prefetchQuery && prefetchQuery.length >= 2, // Prefetch at 2+ chars
    staleTime: 300000, // Cache for 5 minutes
    cacheTime: 600000, // Keep in cache for 10 minutes
    retry: false, // Don't retry on failure - keeps it silent
    refetchOnMount: false, // CRITICAL: Prevents duplicate fetches
    refetchOnWindowFocus: false // CRITICAL: Prevents duplicate fetches
  });

  // Sync isPrefetching state with query state
  useEffect(() => {
    setIsPrefetching(isPrefetchFetching);
  }, [isPrefetchFetching]);

  // Main search query (displays results)
  const { data: searchResults, isLoading, error: queryError, refetch } = useQuery({
    queryKey: ['productSearch', debouncedQuery, currentPage],
    queryFn: async () => {
      if (!debouncedQuery) return null;

      console.log('[DEBUG-PAGINATION] Frontend: Starting product search', {
        query: debouncedQuery,
        page: currentPage,
        limit: 10,
        orbenApiUrl: ORBEN_API_URL
      });

      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      console.log('[ProductSearch] Session check:', { 
        hasSession: !!session.data.session, 
        hasToken: !!token,
        tokenPreview: token ? token.substring(0, 20) + '...' : 'none'
      });

      if (!token) {
        toast({
          title: 'Authentication required',
          description: 'Please log in to use product search',
          variant: 'destructive'
        });
        throw new Error('Please log in to search');
      }

      // Smart routing is always enabled - backend chooses best provider
      const providerList = 'auto';

      const params = new URLSearchParams({
        q: debouncedQuery,
        providers: providerList,
        country: 'US',
        page: String(currentPage), // Use pagination!
        limit: '10', // Always fetch 10 items per page
        // Force fresh results after RapidAPI key was added (cache v5)
        cache_version: 'v7_pagination'
      });

      console.log('[ProductSearch] Fetching:', `${ORBEN_API_URL}/v1/search?${params}`);

      const response = await fetch(`${ORBEN_API_URL}/v1/search?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      console.log('[ProductSearch] Response status:', response.status);

      // #region agent log
      console.log('[DEBUG-D] Frontend: API response received', JSON.stringify({
        statusCode: response.status,
        ok: response.ok,
        hypothesisId: 'D'
      }));
      // #endregion

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[ProductSearch] Error response:', errorText);
        
        // #region agent log
        console.log('[DEBUG-E] Frontend: API error response', JSON.stringify({
          statusCode: response.status,
          errorText: errorText.slice(0, 200),
          hypothesisId: 'E'
        }));
        // #endregion
        
        if (response.status === 401) {
          toast({
            title: 'Session expired',
            description: 'Please refresh the page and try again',
            variant: 'destructive'
          });
          throw new Error('Authentication failed - please log in again');
        }
        
        throw new Error(`Search failed: ${response.status}`);
      }

      const data = await response.json();
      console.log('[ProductSearch] Results:', { 
        itemCount: data.items?.length || 0,
        providers: data.providers
      });

      // #region agent log
      console.log('[DEBUG-D] Frontend: Results parsed', JSON.stringify({
        itemCount: data.items?.length || 0,
        currentPage: currentPage,
        providers: data.providers,
        firstItemTitle: data.items?.[0]?.title || null,
        hypothesisId: 'D'
      }));
      // #endregion

      return data;
    },
    enabled: !!debouncedQuery, // Auto-run when debouncedQuery changes
    placeholderData: (previousData) => previousData, // Keep showing previous results while loading more
    staleTime: 0 // Always refetch when params change
  });

  // Optional: Allow instant search on Enter key press
  const handleSearch = (e) => {
    e.preventDefault();
    if (!query.trim()) {
      toast({ title: 'Please enter a search query', variant: 'destructive' });
      return;
    }
    // Require at least 3 characters for better search quality
    if (query.trim().length < 3) {
      toast({ title: 'Please enter at least 3 characters', variant: 'destructive' });
      return;
    }
    // Immediately trigger search (bypass debounce)
    setDebouncedQuery(query.trim());
    setCurrentPage(1); // Start with page 1 for new search
    setAccumulatedItems([]); // Clear accumulated items for new search
    setTotalFetched(0); // Reset fetch tracking
  };

  // Accumulate items when new results arrive
  useEffect(() => {
    console.log('[DEBUG-ACCUM] Accumulation useEffect triggered', {
      hasSearchResults: !!searchResults?.items,
      currentItemCount: searchResults?.items?.length,
      accumulatedLength: accumulatedItems.length,
      currentPage,
      isLoadingMore
    });
    
    if (!searchResults?.items) return;
    
    const currentItemCount = searchResults.items.length;
    
    console.log('[DEBUG-ACCUM] Checking replacement condition', {
      currentItemCount,
      accumulatedLength: accumulatedItems.length,
      currentPage: currentPage,
      isLoadingMore: isLoadingMore,
      isNewSearch: currentPage === 1 && !isLoadingMore
    });
    
    // If we got 0 items on a "load more" request, keep existing items and show error
    if (currentItemCount === 0 && isLoadingMore) {
      console.log('[DEBUG-ACCUM] Timeout - keeping existing items', {
        accumulatedLength: accumulatedItems.length
      });
      toast({
        title: 'Load more failed',
        description: 'The search timed out or no additional items are available',
        variant: 'default'
      });
      setIsLoadingMore(false);
      return; // CRITICAL: Return early to prevent replacing items
    }
    
    // If this is page 1 and not a load more, it's a new search - replace everything
    if (currentPage === 1 && !isLoadingMore) {
      console.log('[DEBUG-ACCUM] REPLACING all items (new search detected)', {
        oldCount: accumulatedItems.length,
        newCount: currentItemCount,
        firstItemTitle: searchResults.items[0]?.title
      });
      setAccumulatedItems(searchResults.items);
      setTotalFetched(currentItemCount);
    } 
    // If this is page 2+, accumulate the new items
    else if (currentPage > 1 || isLoadingMore) {
      console.log('[DEBUG-ACCUM] ACCUMULATING items (load more detected)', {
        oldCount: accumulatedItems.length,
        newCount: currentItemCount,
        currentPage: currentPage,
        searchResultsLength: searchResults.items.length
      });
      // Only add new items that aren't duplicates
      const existingIds = new Set(accumulatedItems.map(item => item.link || item.title));
      const newItems = searchResults.items.filter(item => !existingIds.has(item.link || item.title));
      
      console.log('[DEBUG-ACCUM] After deduplication', {
        existingCount: accumulatedItems.length,
        totalInResponse: searchResults.items.length,
        newItemsFound: newItems.length
      });
      
      if (newItems.length > 0) {
        setAccumulatedItems(prev => [...prev, ...newItems]);
        setTotalFetched(accumulatedItems.length + newItems.length);
      }
      setIsLoadingMore(false);
    }
  }, [searchResults?.items]);

  // Show accumulated results
  const displayedItems = accumulatedItems;
  const canLoadMore = searchResults?.items?.length === 10 && accumulatedItems.length < 100; // Can fetch more if last page had 10 items (full page) and haven't hit 100 total

  // Handle load more button click
  const handleLoadMore = () => {
    console.log('[DEBUG-LOAD-MORE] Load More clicked', {
      currentPage: currentPage,
      willIncreaseTo: currentPage + 1,
      currentAccumulatedItems: accumulatedItems.length
    });
    setIsLoadingMore(true);
    setCurrentPage(prev => prev + 1); // Go to next page
  };

  // No longer need this useEffect - handled in accumulation logic above

  // Group by merchant instead of provider
  const groupedByMerchant = {};
  if (displayedItems.length > 0) {
    displayedItems.forEach(item => {
      const merchant = item.merchant || 'Unknown';
      if (!groupedByMerchant[merchant]) {
        groupedByMerchant[merchant] = [];
      }
      groupedByMerchant[merchant].push(item);
    });
  }

  // Calculate average price
  const avgPrice = displayedItems.length > 0
    ? displayedItems.filter(i => i.price && i.price > 0).reduce((sum, i) => sum + i.price, 0) / displayedItems.filter(i => i.price && i.price > 0).length
    : 0;

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Universal Product Search</h1>
        <p className="text-sm sm:text-base text-gray-600 mt-1">Search Google Shopping in real-time</p>
      </div>

      {/* Search Bar */}
      <Card>
        <CardContent className="pt-4 sm:pt-6">
          <form onSubmit={handleSearch}>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <div className="flex-1 relative">
                <Input
                  placeholder="Search products..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className={`text-base sm:text-lg ${isPrefetching ? 'ring-2 ring-blue-300 ring-opacity-50' : ''}`}
                />
                {/* Subtle prefetch indicator - NO TEXT, just a small pulse */}
                {isPrefetching && !isLoading && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" title="Pre-loading results..." />
                  </div>
                )}
              </div>
              <Button type="submit" disabled={isLoading || !query.trim() || query.trim().length < 3} className="w-full sm:w-auto px-6 sm:px-8">
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4 mr-2" />
                    Search
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Results */}
      {searchResults && displayedItems.length === 0 && (
        <Card className="p-12 border-yellow-200 bg-yellow-50">
          <div className="text-center">
            <Search className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
            <h3 className="text-xl font-medium mb-2 text-yellow-700">No Results Found</h3>
            <p className="text-yellow-600 mb-4">
              No products found for "{debouncedQuery}". Try a different search term or check:
            </p>
            <ul className="text-left max-w-md mx-auto text-sm text-yellow-700 space-y-2">
              <li>• Try more general search terms (e.g., "laptop" instead of specific model)</li>
              <li>• Check your spelling</li>
              <li>• Try searching for popular products (iPhone, LEGO, etc.)</li>
            </ul>
          </div>
        </Card>
      )}

      {searchResults && displayedItems.length > 0 && (
        <>
          {/* Summary - now with average price */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                  Total Results
                  {isLoadingMore && (
                    <Loader2 className="w-3 h-3 animate-spin text-blue-500" title="Loading more results..." />
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {displayedItems.length}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Average Price</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {avgPrice > 0 ? `$${avgPrice.toFixed(2)}` : 'N/A'}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Price Range</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {displayedItems.length > 0
                    ? `$${Math.min(...displayedItems.filter(i => i.price).map(i => i.price)).toFixed(0)} - $${Math.max(...displayedItems.filter(i => i.price).map(i => i.price)).toFixed(0)}`
                    : 'N/A'}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Merchants</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{Object.keys(groupedByMerchant).length}</div>
              </CardContent>
            </Card>
          </div>

          {/* Results by merchant */}
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="flex-wrap h-auto">
              <TabsTrigger value="all">All ({displayedItems.length})</TabsTrigger>
              {Object.keys(groupedByMerchant).sort((a, b) => groupedByMerchant[b].length - groupedByMerchant[a].length).slice(0, 8).map(merchant => (
                <TabsTrigger key={merchant} value={merchant}>
                  {merchant} ({groupedByMerchant[merchant].length})
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="all" className="mt-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {displayedItems.map((item, idx) => (
                  <ProductCard key={idx} item={item} />
                ))}
              </div>
              
              {/* Load More Button */}
              {canLoadMore && !isLoadingMore && (
                <div className="text-center py-8">
                  <Button 
                    onClick={handleLoadMore}
                    size="lg"
                    className="min-w-[200px]"
                  >
                    Load More Results
                  </Button>
                  <p className="text-sm text-gray-500 mt-2">
                    Showing {displayedItems.length} results
                  </p>
                </div>
              )}
              
              {/* Loading indicator for background fetch */}
              {isLoadingMore && (
                <div className="text-center py-8">
                  <LoaderCircle className="w-8 h-8 animate-spin mx-auto text-purple-500" />
                  <p className="text-sm text-gray-500 mt-2">Loading more results... (keeping {displayedItems.length} current items)</p>
                </div>
              )}
              
              {/* Show message when all results are displayed */}
              {!canLoadMore && displayedItems.length >= 10 && (
                <div className="text-center py-6">
                  <p className="text-sm text-gray-500">
                    All {displayedItems.length} results displayed
                  </p>
                </div>
              )}
            </TabsContent>

            {Object.keys(groupedByMerchant).map(merchant => (
              <TabsContent key={merchant} value={merchant} className="mt-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {groupedByMerchant[merchant].map((item, idx) => (
                    <ProductCard key={idx} item={item} />
                  ))}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </>
      )}

      {!searchResults && !isLoading && !queryError && (
        <Card className="p-12">
          <div className="text-center">
            <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-medium mb-2">Search for Products</h3>
            <p className="text-sm text-gray-500">
              Try: "iPhone 15", "Nike shoes", "PS5", or "Samsung TV"
            </p>
          </div>
        </Card>
      )}

      {queryError && (
        <Card className="p-12 border-red-200 bg-red-50">
          <div className="text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h3 className="text-xl font-medium mb-2 text-red-700">Search Error</h3>
            <p className="text-red-600 mb-4">
              {queryError.message || 'Failed to fetch search results'}
            </p>
            {queryError.message?.includes('log in') && (
              <Button onClick={() => window.location.href = '/login'} variant="destructive">
                Go to Login
              </Button>
            )}
            {queryError.message?.includes('Session expired') && (
              <Button onClick={() => window.location.reload()} variant="outline">
                Refresh Page
              </Button>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

function ProductCard({ item }) {
  // Get merchant-specific badge color
  const getMerchantColor = (merchant) => {
    const colors = {
      'Walmart': 'bg-blue-100 text-blue-800 border-blue-200',
      'Best Buy': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'Target': 'bg-red-100 text-red-800 border-red-200',
      'Amazon': 'bg-orange-100 text-orange-800 border-orange-200',
      'eBay': 'bg-purple-100 text-purple-800 border-purple-200',
      'T-Mobile': 'bg-pink-100 text-pink-800 border-pink-200',
      'Home Depot': 'bg-orange-100 text-orange-800 border-orange-200',
      'Lowe\'s': 'bg-blue-100 text-blue-800 border-blue-200'
    };
    return colors[merchant] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  // Extract relevant fields from Google Shopping API structure
  // Handles both: normalized format (from backend) and raw SerpAPI format
  const title = item.title || '';
  const imageUrl = item.image_url || item.thumbnail || '';
  const price = item.price || item.extracted_price || 0;
  const oldPrice = item.old_price || item.extracted_old_price || null;
  const merchant = item.merchant || item.source || 'Unknown';
  const productLink = item.url || item.product_link || '';
  const rating = item.rating || null;
  const reviews = item.reviews || null;
  const snippet = item.snippet || '';
  const extensions = item.extensions || [];
  const tag = item.tag || '';
  const delivery = item.delivery || '';
  const condition = item.condition || item.second_hand_condition || '';

  return (
    <Card className="overflow-hidden hover:shadow-xl hover:scale-[1.02] transition-all duration-200 border-2 hover:border-purple-200">
      {/* Image */}
      {imageUrl && (
        <div className="relative h-48 bg-gradient-to-br from-gray-50 to-gray-100">
          {/* Show tag/badge overlay if available (e.g., "22% OFF") */}
          {tag && (
            <div className="absolute top-2 right-2 z-10 animate-pulse">
              <Badge className="bg-gradient-to-r from-red-500 to-pink-500 text-white font-bold shadow-lg">
                {tag}
              </Badge>
            </div>
          )}
          <img
            src={imageUrl}
            alt={title}
            className="w-full h-full object-contain p-2 hover:scale-105 transition-transform duration-300"
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />
        </div>
      )}

      <CardContent className="p-4">
        {/* Title */}
        <h3 className="font-medium text-sm mb-2 line-clamp-2 min-h-[2.5rem]">
          {title}
        </h3>

        {/* Merchant Badge - Colorful and prominent */}
        {merchant && (
          <div className="mb-3 flex items-center gap-2">
            <Badge className={`${getMerchantColor(merchant)} font-semibold border shadow-sm`}>
              {merchant}
            </Badge>
            {item.multiple_sources && (
              <Badge variant="outline" className="text-xs text-purple-600 border-purple-300">
                Multiple stores
              </Badge>
            )}
          </div>
        )}

        {/* Price - Show old price if available */}
        {price > 0 && (
          <div className="mb-3">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-green-600 drop-shadow-sm">
                ${price.toFixed(2)}
              </span>
              {oldPrice && oldPrice > price && (
                <div className="flex flex-col">
                  <span className="text-sm text-gray-400 line-through">
                    ${oldPrice.toFixed(2)}
                  </span>
                  <span className="text-xs text-green-600 font-semibold">
                    Save ${(oldPrice - price).toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Reviews & Rating */}
        {(rating || reviews) && (
          <div className="flex items-center gap-2 mb-2 text-xs">
            {rating && (
              <span className="flex items-center font-semibold text-amber-600 bg-amber-50 px-2 py-1 rounded">
                ⭐ {rating}
              </span>
            )}
            {reviews && (
              <span className="text-gray-600 bg-gray-50 px-2 py-1 rounded">
                ({reviews.toLocaleString()})
              </span>
            )}
          </div>
        )}

        {/* Snippet (e.g., "Tastes good (4,331 user reviews)") */}
        {snippet && (
          <p className="text-xs text-gray-600 mb-2 line-clamp-1 italic">
            💬 {snippet}
          </p>
        )}

        {/* Extensions (e.g., "Nearby, 12 mi", "22% OFF") */}
        {extensions && extensions.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {extensions.slice(0, 3).map((ext, idx) => (
              <Badge key={idx} variant="outline" className="text-xs bg-blue-50 border-blue-200 text-blue-700">
                {ext}
              </Badge>
            ))}
          </div>
        )}

        {/* Delivery info */}
        {delivery && (
          <div className="text-xs text-blue-700 bg-blue-50 px-2 py-1 rounded mb-2 font-medium">
            🚚 {delivery}
          </div>
        )}

        {/* Additional info */}
        <div className="flex items-center gap-2 mb-3 text-xs text-gray-600">
          {condition && <Badge variant="outline">{condition}</Badge>}
          {item.shipping === 0 && <Badge variant="outline">Free Shipping</Badge>}
        </div>

        {/* Action */}
        <Button
          variant="default"
          size="sm"
          className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-md hover:shadow-lg transition-all"
          onClick={() => window.open(productLink, '_blank')}
          disabled={!productLink}
        >
          <ShoppingCart className="w-4 h-4 mr-2" />
          View Deal
        </Button>
      </CardContent>
    </Card>
  );
}
