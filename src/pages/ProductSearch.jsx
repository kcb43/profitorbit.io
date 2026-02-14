import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Loader2, ExternalLink, TrendingUp, ShoppingCart, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase';
import { useToast } from '@/components/ui/use-toast';

const ORBEN_API_URL = import.meta.env.VITE_ORBEN_API_URL || 'https://orben-api.fly.dev';

export default function ProductSearch() {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [displayLimit, setDisplayLimit] = useState(12); // Show 12 initially
  const [isTyping, setIsTyping] = useState(false); // Track if user is typing
  const [requestedLimit, setRequestedLimit] = useState(20); // Start with 20 items for speed
  const [isLoadingMore, setIsLoadingMore] = useState(false); // Track background loading
  const { toast } = useToast();
  const loadMoreRef = useRef(null);
  const debounceTimerRef = useRef(null);

  // Debounce search query: wait 800ms after user stops typing
  useEffect(() => {
    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Only debounce if query is at least 3 characters
    if (query.trim().length >= 3) {
      setIsTyping(true); // User is typing
      debounceTimerRef.current = setTimeout(() => {
        setDebouncedQuery(query.trim());
        setDisplayLimit(12); // Reset display limit on new search
        setRequestedLimit(20); // Reset to 20 items for fast initial load
        setIsTyping(false); // Done typing
      }, 800); // Wait 800ms after user stops typing
    } else {
      // Clear results if query is too short
      setDebouncedQuery('');
      setIsTyping(false);
    }

    // Cleanup
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [query]);

  // Check if smart routing is enabled
  const disableSmartRouting = localStorage.getItem('orben_disable_smart_routing') === 'true';

  const { data: searchResults, isLoading, error: queryError, refetch } = useQuery({
    queryKey: ['productSearch', debouncedQuery, requestedLimit],
    queryFn: async () => {
      if (!debouncedQuery) return null;

      // #region agent log
      console.log('[DEBUG-A] Frontend: Starting product search', JSON.stringify({
        query: debouncedQuery,
        requestedLimit: requestedLimit,
        orbenApiUrl: ORBEN_API_URL,
        hypothesisId: 'A'
      }));
      // #endregion

      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      console.log('[ProductSearch] Session check:', { 
        hasSession: !!session.data.session, 
        hasToken: !!token,
        tokenPreview: token ? token.substring(0, 20) + '...' : 'none'
      });

      // #region agent log
      console.log('[DEBUG-A] Frontend: Auth token check', JSON.stringify({
        hasToken: !!token,
        tokenLength: token?.length || 0,
        hypothesisId: 'A'
      }));
      // #endregion

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
        limit: String(requestedLimit), // Use dynamic limit: 20 for initial, 50 for "load more"
        // Force fresh results after RapidAPI key was added (cache v5)
        cache_version: 'v5_rapidapi_configured'
      });

      // #region agent log
      console.log('[DEBUG-A] Frontend: Making API request', JSON.stringify({
        url: `${ORBEN_API_URL}/v1/search`,
        params: Object.fromEntries(params),
        requestedLimit: requestedLimit,
        hypothesisId: 'A'
      }));
      // #endregion

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
        requestedLimit: requestedLimit,
        providers: data.providers,
        firstItemTitle: data.items?.[0]?.title || null,
        hypothesisId: 'D'
      }));
      // #endregion

      return data;
    },
    enabled: !!debouncedQuery, // Auto-run when debouncedQuery changes
    keepPreviousData: true // Keep showing previous results while loading more
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
    setDisplayLimit(12);
    setRequestedLimit(20); // Start with 20 for fast initial load
    setIsTyping(false); // Reset typing state
  };

  // Progressive loading: show more results as user scrolls
  const displayedItems = searchResults?.items?.slice(0, displayLimit) || [];
  const hasMore = searchResults?.items?.length > displayLimit;
  const canLoadMore = requestedLimit === 20 && searchResults?.items?.length === 20; // Can fetch 30 more items

  // Intersection observer for auto-load more (display)
  useEffect(() => {
    if (!loadMoreRef.current || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setDisplayLimit(prev => prev + 12); // Show 12 more from already fetched
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasMore]);

  // Background loading: fetch 30 more items when user scrolls to 15th item
  useEffect(() => {
    if (!canLoadMore || isLoadingMore) return;
    if (displayLimit < 15) return; // Wait until user has scrolled a bit

    console.log('[ProductSearch] Auto-loading more results in background (20 → 50)');
    setIsLoadingMore(true);
    setRequestedLimit(50); // Trigger new fetch for 50 items
  }, [displayLimit, canLoadMore, isLoadingMore]);

  // Reset loading state when data arrives
  useEffect(() => {
    if (searchResults?.items?.length > 20) {
      setIsLoadingMore(false);
      console.log('[ProductSearch] Background loading complete:', searchResults.items.length, 'items total');
    }
  }, [searchResults?.items?.length]);

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
  const avgPrice = searchResults?.items?.length > 0
    ? searchResults.items.filter(i => i.price && i.price > 0).reduce((sum, i) => sum + i.price, 0) / searchResults.items.filter(i => i.price && i.price > 0).length
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
                  placeholder="Start typing to search... (min 3 characters)"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="text-base sm:text-lg pr-24"
                />
                {isTyping && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-blue-600 flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Searching...</span>
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
                    Search Now
                  </>
                )}
              </Button>
            </div>
          </form>

          {/* Search Info */}
          <div className="mt-4 flex items-center gap-2 text-sm text-gray-600">
            <ShoppingCart className="w-4 h-4" />
            <span>
              Searching <span className="font-semibold text-gray-900">Google Shopping</span> via RapidAPI • 
              Real-time pricing from 100+ merchants • Auto-search as you type
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {searchResults && searchResults.items?.length === 0 && (
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

      {searchResults && searchResults.items?.length > 0 && (
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
                  {searchResults.items?.length || 0}
                  {requestedLimit === 20 && searchResults.items.length === 20 && (
                    <span className="text-sm text-gray-500 font-normal ml-1">of 50</span>
                  )}
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
                  {searchResults.items?.length > 0
                    ? `$${Math.min(...searchResults.items.filter(i => i.price).map(i => i.price)).toFixed(0)} - $${Math.max(...searchResults.items.filter(i => i.price).map(i => i.price)).toFixed(0)}`
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
              <TabsTrigger value="all">All ({searchResults.items?.length || 0})</TabsTrigger>
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
              
              {/* Invisible load more trigger for infinite scroll */}
              {hasMore && (
                <div ref={loadMoreRef} className="h-20 flex items-center justify-center">
                  <p className="text-sm text-gray-500">
                    Loading more... ({searchResults.items.length - displayLimit} remaining)
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
            <h3 className="text-xl font-medium mb-2">Type to Start Searching</h3>
            <p className="text-gray-600 mb-3">
              Just start typing a product name above - results appear automatically
            </p>
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

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      {/* Image */}
      {item.image_url && (
        <div className="relative h-48 bg-gray-100">
          <img
            src={item.image_url}
            alt={item.title}
            className="w-full h-full object-contain p-2"
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />
        </div>
      )}

      <CardContent className="p-4">
        {/* Title */}
        <h3 className="font-medium text-sm mb-2 line-clamp-2 min-h-[2.5rem]">
          {item.title}
        </h3>

        {/* Merchant Badge - Colorful and prominent */}
        {item.merchant && (
          <div className="mb-3">
            <Badge className={`${getMerchantColor(item.merchant)} font-semibold border`}>
              {item.merchant}
            </Badge>
          </div>
        )}

        {/* Price */}
        {item.price && (
          <div className="mb-3">
            <span className="text-2xl font-bold text-green-600">
              ${item.price.toFixed(2)}
            </span>
            {item.currency && item.currency !== 'USD' && (
              <span className="text-xs text-gray-500 ml-1">{item.currency}</span>
            )}
          </div>
        )}

        {/* Additional info */}
        <div className="flex items-center gap-2 mb-3 text-xs text-gray-600">
          {item.condition && <Badge variant="outline">{item.condition}</Badge>}
          {item.shipping === 0 && <Badge variant="outline">Free Shipping</Badge>}
          {item.rating && (
            <span className="flex items-center">
              ⭐ {item.rating}
            </span>
          )}
        </div>

        {/* Action */}
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => window.open(item.url, '_blank')}
        >
          <ExternalLink className="w-4 h-4 mr-2" />
          View Product
        </Button>
      </CardContent>
    </Card>
  );
}
