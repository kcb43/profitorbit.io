import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Loader2, LoaderCircle, ExternalLink, TrendingUp, ShoppingCart, AlertCircle, Grid3x3, List } from 'lucide-react';
import { supabase } from '@/integrations/supabase';
import { useToast } from '@/components/ui/use-toast';
import { 
  ProductCardV1Grid, 
  ProductCardV1List
} from '@/components/ProductCardVariations';

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
  const [showDebugInfo, setShowDebugInfo] = useState(false); // Toggle debug mode
  
  // View Mode State
  const [viewMode, setViewMode] = useState('grid'); // 'grid', 'list'
  
  // Quota monitoring state
  const [quotaInfo, setQuotaInfo] = useState(null); // { current: 102, limit: 100, provider: 'google' }
  const [showQuotaWarning, setShowQuotaWarning] = useState(false);
  
  const { toast } = useToast();
  const debounceTimerRef = useRef(null);
  const prefetchTimerRef = useRef(null);

  // Debounce search query: wait 800ms after user stops typing
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
        setAccumulatedItems([]); // Clear accumulated items for new search
        isAccumulatingRef.current = false; // Reset accumulation mode
      }, 800); // 800ms delay to reduce API quota usage
    } else {
      // Clear results if query is too short
      setDebouncedQuery('');
      setAccumulatedItems([]); // Also clear items when query is cleared
      isAccumulatingRef.current = false; // Reset accumulation mode
    }

    // Cleanup
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [query]);

  // DISABLED: Aggressive pre-fetching was burning through SerpAPI quota
  // Pre-fetching has been disabled to conserve API quota
  // Search only triggers when user presses Enter or stops typing for 500ms
  // useEffect(() => {
  //   // Clear existing prefetch timer
  //   if (prefetchTimerRef.current) {
  //     clearTimeout(prefetchTimerRef.current);
  //   }

  //   // Start AGGRESSIVE pre-fetching at 2 characters (before the 3-char threshold)
  //   if (query.trim().length >= 2) {
  //     prefetchTimerRef.current = setTimeout(() => {
  //       console.log('[ProductSearch] AGGRESSIVE pre-fetch triggered for:', query.trim());
  //       setPrefetchQuery(query.trim());
  //     }, 300); // AGGRESSIVE: Even shorter delay (300ms) for faster pre-loading
  //   } else if (query.trim().length < 2) {
  //     setPrefetchQuery('');
  //   }

  //   // Cleanup
  //   return () => {
  //     if (prefetchTimerRef.current) {
  //       clearTimeout(prefetchTimerRef.current);
  //     }
  //   };
  // }, [query]);

  // Check if smart routing is enabled
  const disableSmartRouting = localStorage.getItem('orben_disable_smart_routing') === 'true';

  // DISABLED: Predictive pre-fetch query (was burning through API quota)
  // const { isFetching: isPrefetchFetching } = useQuery({
  //   queryKey: ['productSearchPrefetch', prefetchQuery, 10],
  //   queryFn: async () => {
  //     if (!prefetchQuery || prefetchQuery.length < 2) return null;

  //     console.log('[ProductSearch] AGGRESSIVE Pre-fetching results for:', prefetchQuery);
  //     setIsPrefetching(true); // Set prefetch indicator

  //     const session = await supabase.auth.getSession();
  //     const token = session.data.session?.access_token;

  //     if (!token) {
  //       setIsPrefetching(false);
  //       return null; // Silently fail, ZERO UI impact
  //     }

  //     const providerList = 'auto';
  //     const params = new URLSearchParams({
  //       q: prefetchQuery,
  //       providers: providerList,
  //       country: 'US',
  //       limit: '20', // AGGRESSIVE: Pre-fetch 20 items (double previous)
  //       cache_version: 'v7_pagination'
  //     });

  //     const response = await fetch(`${ORBEN_API_URL}/v1/search?${params}`, {
  //       headers: { Authorization: `Bearer ${token}` }
  //     });

  //     setIsPrefetching(false); // Clear prefetch indicator

  //     if (!response.ok) return null; // Silently fail, ZERO UI impact

  //     return response.json();
  //   },
  //   enabled: !!prefetchQuery && prefetchQuery.length >= 2, // Prefetch at 2+ chars
  //   staleTime: 300000, // Cache for 5 minutes
  //   cacheTime: 600000, // Keep in cache for 10 minutes
  //   retry: false, // Don't retry on failure - keeps it silent
  //   refetchOnMount: false, // CRITICAL: Prevents duplicate fetches
  //   refetchOnWindowFocus: false // CRITICAL: Prevents duplicate fetches
  // });

  // // Sync isPrefetching state with query state
  // useEffect(() => {
  //   setIsPrefetching(isPrefetchFetching);
  // }, [isPrefetchFetching]);

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
        providers: data.providers,
        firstThreeItems: data.items?.slice(0, 3)
      });

      // Extract quota information from providers
      if (data.providers && Array.isArray(data.providers)) {
        data.providers.forEach(provider => {
          if (provider.error && provider.error.includes('quota exceeded')) {
            // Parse quota info: "User quota exceeded: 102/100"
            const match = provider.error.match(/(\d+)\/(\d+)/);
            if (match) {
              const current = parseInt(match[1]);
              const limit = parseInt(match[2]);
              setQuotaInfo({ current, limit, provider: provider.provider });
              setShowQuotaWarning(true);
              
              toast({
                title: '⚠️ API Quota Exceeded',
                description: `${provider.provider} quota: ${current}/${limit}. Results may be limited.`,
                variant: 'destructive',
                duration: 10000
              });
            }
          } else if (provider.quota) {
            // If backend provides explicit quota info
            setQuotaInfo(provider.quota);
            if (provider.quota.current >= provider.quota.limit * 0.9) {
              setShowQuotaWarning(true);
            }
          }
        });
      }

      // #region agent log
      console.log('[DEBUG-D] Frontend: Results parsed', JSON.stringify({
        itemCount: data.items?.length || 0,
        currentPage: currentPage,
        providers: data.providers,
        firstItemTitle: data.items?.[0]?.title || null,
        hasItems: !!data.items,
        isArray: Array.isArray(data.items),
        hypothesisId: 'D'
      }));
      // #endregion
      
      // CRITICAL: Slice to respect the requested limit for pagination
      // Backend might return more items than requested
      if (data.items && data.items.length > 10) {
        console.log('[DEBUG-SLICE] Slicing items from', data.items.length, 'to 10');
        data.items = data.items.slice(0, 10);
      }

      return data;
    },
    enabled: !!debouncedQuery, // Auto-run when debouncedQuery changes
    keepPreviousData: true, // Keep showing previous results while loading more (React Query v5 syntax)
    staleTime: 0, // Always refetch when params change
    refetchOnMount: false,
    refetchOnWindowFocus: false
  });

  // Log when query is fetching
  useEffect(() => {
    console.log('[DEBUG-QUERY] Query state changed', {
      isLoading,
      isFetching: isLoading,
      hasData: !!searchResults,
      itemCount: searchResults?.items?.length,
      currentPage
    });
  }, [isLoading, searchResults, currentPage]);

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
    isAccumulatingRef.current = false; // Reset accumulation mode
  };

  // Track last query to detect new searches
  const lastQueryRef = useRef('');
  const isAccumulatingRef = useRef(false); // Track if we're in accumulation mode
  
  // Accumulate items when new results arrive
  useEffect(() => {
    console.log('[DEBUG-ACCUM] Accumulation useEffect triggered', {
      hasSearchResults: !!searchResults?.items,
      currentItemCount: searchResults?.items?.length,
      accumulatedLength: accumulatedItems.length,
      currentPage,
      isLoadingMore,
      currentQuery: debouncedQuery,
      lastQuery: lastQueryRef.current,
      isAccumulating: isAccumulatingRef.current
    });
    
    if (!searchResults?.items) return;
    
    const currentItemCount = searchResults.items.length;
    
    // Check if this is a NEW search (query changed from last time)
    const queryChanged = debouncedQuery !== lastQueryRef.current;
    const isNewSearch = queryChanged && accumulatedItems.length === 0;
    
    console.log('[DEBUG-ACCUM] Checking replacement condition', {
      currentItemCount,
      accumulatedLength: accumulatedItems.length,
      currentPage: currentPage,
      isLoadingMore: isLoadingMore,
      isNewSearch,
      queryChanged,
      lastQuery: lastQueryRef.current,
      currentQuery: debouncedQuery
    });
    
    // If we got 0 items on a "load more" request, keep existing items and show error
    if (currentItemCount === 0 && (isLoadingMore || currentPage > 1)) {
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
    
    // If this is a NEW search (query changed AND no items accumulated), replace everything
    if (isNewSearch) {
      console.log('[DEBUG-ACCUM] REPLACING all items (NEW search detected)', {
        oldQuery: lastQueryRef.current,
        newQuery: debouncedQuery,
        oldCount: accumulatedItems.length,
        newCount: currentItemCount,
        firstItemTitle: searchResults.items[0]?.title
      });
      
      lastQueryRef.current = debouncedQuery; // Update last query
      isAccumulatingRef.current = true; // Now in accumulation mode
      
      // Mark items as not loaded yet
      const itemsWithLoadingState = searchResults.items.map(item => ({
        ...item,
        merchantOffersLoaded: false,
        merchantOffers: []
      }));
      
      setAccumulatedItems(itemsWithLoadingState);
      setTotalFetched(currentItemCount);
      
      // Pre-fetch merchant offers for items with immersive_product_page_token
      prefetchMerchantOffers(itemsWithLoadingState);
    } 
    // If we're in accumulation mode (same query), ALWAYS accumulate new items
    else if (isAccumulatingRef.current && debouncedQuery === lastQueryRef.current) {
      console.log('[DEBUG-ACCUM] ACCUMULATING items (same query, accumulation mode)', {
        query: debouncedQuery,
        oldCount: accumulatedItems.length,
        newCount: currentItemCount,
        currentPage: currentPage,
        searchResultsLength: searchResults.items.length
      });
      
      // Use product_id or URL+title combo for deduplication
      const existingIds = new Set(
        accumulatedItems.map(item => 
          item.product_id || `${item.product_link || item.url}:${item.title}`
        )
      );
      
      const newItems = searchResults.items.filter(item => {
        const itemId = item.product_id || `${item.product_link || item.url}:${item.title}`;
        return !existingIds.has(itemId);
      });
      
      console.log('[DEBUG-ACCUM] After deduplication', {
        existingCount: accumulatedItems.length,
        totalInResponse: searchResults.items.length,
        newItemsFound: newItems.length,
        firstNewItem: newItems[0]?.title
      });
      
      if (newItems.length > 0) {
        // Mark new items as not loaded yet
        const newItemsWithLoadingState = newItems.map(item => ({
          ...item,
          merchantOffersLoaded: false,
          merchantOffers: []
        }));
        
        console.log('[DEBUG-ACCUM] Adding new items to accumulator', {
          previousTotal: accumulatedItems.length,
          adding: newItemsWithLoadingState.length,
          willBe: accumulatedItems.length + newItemsWithLoadingState.length
        });
        
        setAccumulatedItems(prev => {
          const updated = [...prev, ...newItemsWithLoadingState];
          console.log('[DEBUG-ACCUM] State updated, new total:', updated.length);
          return updated;
        });
        setTotalFetched(prev => prev + newItemsWithLoadingState.length);
        
        // Pre-fetch merchant offers for new items
        prefetchMerchantOffers(newItemsWithLoadingState);
      } else {
        console.log('[DEBUG-ACCUM] No new items to add (all duplicates or empty)');
      }
      
      setIsLoadingMore(false);
    }
    // Edge case: If we have items but query changed, it means debounce fired - replace
    else if (queryChanged && accumulatedItems.length > 0) {
      console.log('[DEBUG-ACCUM] Query changed while items exist - REPLACING', {
        oldQuery: lastQueryRef.current,
        newQuery: debouncedQuery,
        hadItems: accumulatedItems.length
      });
      
      lastQueryRef.current = debouncedQuery;
      isAccumulatingRef.current = true;
      
      const itemsWithLoadingState = searchResults.items.map(item => ({
        ...item,
        merchantOffersLoaded: false,
        merchantOffers: []
      }));
      
      setAccumulatedItems(itemsWithLoadingState);
      setTotalFetched(currentItemCount);
      prefetchMerchantOffers(itemsWithLoadingState);
    }
  }, [searchResults?.items, currentPage, debouncedQuery]); // Add debouncedQuery to dependencies

  // Pre-fetch direct merchant links for products with immersive tokens
  const prefetchMerchantOffers = async (items) => {
    const itemsWithTokens = items.filter(item => item.immersive_product_page_token);
    
    if (itemsWithTokens.length === 0) {
      console.log('[Prefetch] No items with immersive tokens');
      return;
    }

    console.log(`[Prefetch] Fetching merchant offers for ${itemsWithTokens.length} items`);

    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;

    if (!token) {
      console.warn('[Prefetch] No auth token available');
      return;
    }

    // Fetch merchant offers for each item (in batches to avoid overwhelming the API)
    const batchSize = 3; // Fetch 3 at a time
    for (let i = 0; i < itemsWithTokens.length; i += batchSize) {
      const batch = itemsWithTokens.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (item) => {
        try {
          const response = await fetch(`${ORBEN_API_URL}/v1/product/offers`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              immersive_product_page_token: item.immersive_product_page_token
            })
          });

          if (response.ok) {
            const data = await response.json();
            console.log(`[Prefetch] Got ${data.offers?.length || 0} offers for: ${item.title.substring(0, 30)}...`);
            
            // Store offers in the item (update accumulated items)
            // Use product_id or title as unique identifier
            const itemId = item.product_id || item.title;
            
            setAccumulatedItems(prev => prev.map(i => {
              const iId = i.product_id || i.title;
              return iId === itemId
                ? { ...i, merchantOffers: data.offers, merchantOffersLoaded: true }
                : i;
            }));
          } else {
            // Mark as loaded but with no offers
            const itemId = item.product_id || item.title;
            setAccumulatedItems(prev => prev.map(i => {
              const iId = i.product_id || i.title;
              return iId === itemId
                ? { ...i, merchantOffers: [], merchantOffersLoaded: true }
                : i;
            }));
          }
        } catch (error) {
          console.error(`[Prefetch] Error fetching offers for item:`, error.message);
          // Mark as loaded with error
          const itemId = item.product_id || item.title;
          setAccumulatedItems(prev => prev.map(i => {
            const iId = i.product_id || i.title;
            return iId === itemId
              ? { ...i, merchantOffers: [], merchantOffersLoaded: true }
              : i;
          }));
        }
      }));
      
      // Small delay between batches
      if (i + batchSize < itemsWithTokens.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  };

  // Show accumulated results
  const displayedItems = accumulatedItems;
  
  // Can load more if:
  // 1. Last API response had 10 items (meaning there might be more)
  // 2. Haven't hit our 100 item limit
  // 3. Not currently loading
  const lastFetchCount = searchResults?.items?.length || 0;
  const canLoadMore = lastFetchCount === 10 && accumulatedItems.length < 100 && !isLoadingMore && !isLoading;
  
  console.log('[DEBUG-DISPLAY] Display state', {
    displayedItemsLength: displayedItems.length,
    accumulatedLength: accumulatedItems.length,
    lastFetchCount,
    canLoadMore,
    isLoadingMore,
    isLoading,
    hasSearchResults: !!searchResults,
    searchResultsItemCount: searchResults?.items?.length
  });

  // Handle load more button click
  const handleLoadMore = () => {
    console.log('[DEBUG-LOAD-MORE] Load More clicked', {
      currentPage: currentPage,
      willIncreaseTo: currentPage + 1,
      currentAccumulatedItems: accumulatedItems.length,
      lastFetchCount: searchResults?.items?.length
    });
    
    // Ensure we're not already loading
    if (isLoadingMore || isLoading) {
      console.log('[DEBUG-LOAD-MORE] Already loading, ignoring click');
      return;
    }
    
    setIsLoadingMore(true);
    setCurrentPage(prev => {
      const newPage = prev + 1;
      console.log('[DEBUG-LOAD-MORE] Page state updated:', { from: prev, to: newPage });
      return newPage;
    });
  };

  // Infinite scroll: Auto-load more when near bottom of page
  useEffect(() => {
    if (!canLoadMore) return; // Don't set up listener if can't load more
    
    const handleScroll = () => {
      // Check if user is near bottom (within 500px)
      const scrollPosition = window.innerHeight + window.scrollY;
      const bottomPosition = document.documentElement.scrollHeight;
      const distanceFromBottom = bottomPosition - scrollPosition;
      
      console.log('[INFINITE-SCROLL] Scroll check', {
        distanceFromBottom,
        canLoadMore,
        isLoadingMore,
        isLoading
      });
      
      // If within 500px of bottom and can load more
      if (distanceFromBottom < 500 && canLoadMore && !isLoadingMore && !isLoading) {
        console.log('[INFINITE-SCROLL] Triggering auto-load');
        handleLoadMore();
      }
    };
    
    // Throttle scroll events (check at most once per 200ms)
    let throttleTimeout;
    const throttledScroll = () => {
      if (throttleTimeout) return;
      throttleTimeout = setTimeout(() => {
        handleScroll();
        throttleTimeout = null;
      }, 200);
    };
    
    window.addEventListener('scroll', throttledScroll);
    
    // Cleanup
    return () => {
      window.removeEventListener('scroll', throttledScroll);
      if (throttleTimeout) clearTimeout(throttleTimeout);
    };
  }, [canLoadMore, isLoadingMore, isLoading, currentPage]); // Re-attach when these change

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Universal Product Search</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">
            Search Google Shopping in real-time · Compare prices · Read reviews
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Quota Monitor */}
          {quotaInfo && (
            <div className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 ${
              quotaInfo.current >= quotaInfo.limit 
                ? 'bg-red-100 text-red-800 border border-red-300' 
                : quotaInfo.current >= quotaInfo.limit * 0.9
                ? 'bg-yellow-100 text-yellow-800 border border-yellow-300'
                : 'bg-green-100 text-green-800 border border-green-300'
            }`}>
              <span className={`w-2 h-2 rounded-full ${
                quotaInfo.current >= quotaInfo.limit 
                  ? 'bg-red-500 animate-pulse' 
                  : quotaInfo.current >= quotaInfo.limit * 0.9
                  ? 'bg-yellow-500 animate-pulse'
                  : 'bg-green-500'
              }`}></span>
              API: {quotaInfo.current}/{quotaInfo.limit}
              {quotaInfo.current >= quotaInfo.limit && ' (Exceeded)'}
              {quotaInfo.current >= quotaInfo.limit * 0.9 && quotaInfo.current < quotaInfo.limit && ' (Warning)'}
            </div>
          )}
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDebugInfo(!showDebugInfo)}
            className="text-xs"
          >
            {showDebugInfo ? '🐛 Debug ON' : '🔍 Debug OFF'}
          </Button>
        </div>
      </div>

      {/* Quota Warning Banner */}
      {showQuotaWarning && quotaInfo && (
        <Card className="bg-gradient-to-r from-red-50 to-orange-50 border-2 border-red-300">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-bold text-red-900 mb-1">⚠️ API Quota Exceeded</h3>
                <p className="text-sm text-red-800 mb-2">
                  Your SerpAPI quota has been exceeded ({quotaInfo.current}/{quotaInfo.limit} searches used). 
                  Search results may be limited or unavailable until your quota resets.
                </p>
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => setShowQuotaWarning(false)}
                    className="text-xs border-red-300 text-red-700 hover:bg-red-100"
                  >
                    Dismiss
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    className="text-xs border-red-300 text-red-700 hover:bg-red-100"
                    asChild
                  >
                    <a href="https://serpapi.com/manage-api-key" target="_blank" rel="noopener noreferrer">
                      Check Quota
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
      {searchResults && displayedItems.length === 0 && !isLoadingMore && (
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

      {displayedItems.length > 0 && (
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

          {/* UI Variation & View Mode Controls */}
          <Card className="bg-gradient-to-r from-purple-50 via-pink-50 to-blue-50 border-2 border-purple-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                {/* View Mode Selector */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    View Mode
                  </label>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => setViewMode('grid')}
                      variant={viewMode === 'grid' ? 'default' : 'outline'}
                      size="sm"
                      className={viewMode === 'grid' ? 'bg-indigo-600 hover:bg-indigo-700' : ''}
                    >
                      <Grid3x3 className="w-4 h-4 mr-2" />
                      Grid
                    </Button>
                    <Button
                      onClick={() => setViewMode('list')}
                      variant={viewMode === 'list' ? 'default' : 'outline'}
                      size="sm"
                      className={viewMode === 'list' ? 'bg-indigo-600 hover:bg-indigo-700' : ''}
                    >
                      <List className="w-4 h-4 mr-2" />
                      List
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

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
              {/* Dynamic Grid/List based on variation and view mode */}
              <div className={
                viewMode === 'grid'
                  ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
                  : 'flex flex-col gap-4'
              }>
                {displayedItems.map((item, idx) => {
                  // Always use V1 - Modern Minimal
                  return viewMode === 'grid' 
                    ? <ProductCardV1Grid key={idx} item={item} />
                    : <ProductCardV1List key={idx} item={item} />;
                })}
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
                <div className={
                  viewMode === 'grid'
                    ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
                    : 'flex flex-col gap-4'
                }>
                  {groupedByMerchant[merchant].map((item, idx) => {
                    // Always use V1 - Modern Minimal
                    return viewMode === 'grid' 
                      ? <ProductCardV1Grid key={idx} item={item} />
                      : <ProductCardV1List key={idx} item={item} />;
                  })}
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

function ProductCard({ item, showDebug = false }) {
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

  // Debug: Log all available fields
  if (showDebug) {
    console.log('[ProductCard] Available Fields:', Object.keys(item));
    console.log('[ProductCard] Full Item Data:', item);
  }

  // Extract relevant fields from API structure
  // Handles multiple provider formats: RapidAPI, SerpAPI, Oxylabs
  const title = item.title || '';
  const imageUrl = item.image_url || item.thumbnail || '';
  const price = item.price || item.extracted_price || 0;
  const oldPrice = item.old_price || item.extracted_old_price || null;
  const merchant = item.merchant || item.source || 'Unknown';
  
  // RapidAPI: item.url is DIRECT merchant link (e.g., walmart.com/product/123)
  // SerpAPI: item.product_link is Google Shopping page, item.url might be merchant link
  // Use merchantOffers if pre-fetched, otherwise use URL from API
  const productLink = item.url || item.product_link || item.link || '';
  
  const rating = item.rating || null;
  const reviews = item.reviews || item.reviews_count || null;
  const snippet = item.snippet || '';
  const extensions = item.extensions || [];
  const tag = item.tag || '';
  const badge = item.badge || '';
  const delivery = item.delivery || '';
  const condition = item.condition || item.second_hand_condition || '';
  const position = item.position || null; // Product ranking position
  const sourceIcon = item.source_icon || ''; // Merchant logo/icon
  const productId = item.product_id || ''; // Unique product identifier
  
  // Additional metadata that might be available
  const installment = item.installment || ''; // Installment payment info
  const alternativePrice = item.alternative_price || ''; // Alternative pricing
  const currency = item.currency || 'USD';
  const secondHandCondition = item.second_hand_condition || '';
  
  // Check if this is a RapidAPI result (has direct merchant link)
  const hasDirectLink = item.url && !item.product_link;
  const isRapidApiResult = item.source === 'google_rapidapi' || hasDirectLink;

  // Log unused fields for debugging
  if (showDebug) {
    const usedFields = ['title', 'image_url', 'thumbnail', 'price', 'extracted_price', 
      'old_price', 'extracted_old_price', 'merchant', 'source', 'link', 'url', 'product_link',
      'rating', 'reviews', 'snippet', 'extensions', 'tag', 'badge', 'delivery', 'condition',
      'second_hand_condition', 'position', 'source_icon', 'product_id', 'multiple_sources',
      'installment', 'alternative_price', 'currency', 'shipping'];
    const allFields = Object.keys(item);
    const unusedFields = allFields.filter(f => !usedFields.includes(f));
    console.log('[ProductCard] UNUSED FIELDS:', unusedFields);
    console.log('[ProductCard] Unused field values:', 
      Object.fromEntries(unusedFields.map(f => [f, item[f]]))
    );
  }

  return (
    <Card className="overflow-hidden hover:shadow-xl hover:scale-[1.02] transition-all duration-200 border-2 hover:border-purple-200">
      {/* Image */}
      {imageUrl && (
        <div className="relative h-48 bg-gradient-to-br from-gray-50 to-gray-100">
          {/* Position Badge - Top Left */}
          {position && (
            <div className="absolute top-2 left-2 z-10">
              <Badge className="bg-gray-900 text-white font-bold shadow-lg">
                #{position}
              </Badge>
            </div>
          )}
          
          {/* Show tag/badge overlay if available (e.g., "22% OFF") */}
          {tag && (
            <div className="absolute top-2 right-2 z-10 animate-pulse">
              <Badge className="bg-gradient-to-r from-red-500 to-pink-500 text-white font-bold shadow-lg">
                {tag}
              </Badge>
            </div>
          )}
          
          {/* Show badge if available (e.g., "Best Price") */}
          {badge && !tag && (
            <div className="absolute top-2 right-2 z-10">
              <Badge className="bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold shadow-lg">
                {badge}
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
          <div className="mb-3 flex items-center gap-2 flex-wrap">
            <Badge className={`${getMerchantColor(merchant)} font-semibold border shadow-sm`}>
              {merchant}
            </Badge>
            {item.multiple_sources && (
              <Badge variant="outline" className="text-xs text-purple-600 border-purple-300">
                Multiple stores
              </Badge>
            )}
            {isRapidApiResult && (
              <Badge variant="outline" className="text-xs text-green-600 border-green-300">
                ✓ Direct link
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
            {/* Installment pricing if available */}
            {installment && (
              <p className="text-xs text-gray-600 mt-1">
                💳 {installment}
              </p>
            )}
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
          <p className="text-xs text-gray-600 mb-2 line-clamp-2 italic bg-gray-50 px-2 py-1 rounded">
            💬 {snippet}
          </p>
        )}

        {/* Delivery info - PROMINENT POSITION */}
        {delivery && (
          <div className="text-xs text-blue-700 bg-blue-50 px-2 py-1.5 rounded mb-2 font-medium border border-blue-200">
            🚚 {delivery}
          </div>
        )}

        {/* Extensions (e.g., "Nearby, 12 mi", "22% OFF") - SHOW ALL */}
        {extensions && extensions.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {extensions.map((ext, idx) => (
              <Badge key={idx} variant="outline" className="text-xs bg-blue-50 border-blue-200 text-blue-700">
                {ext}
              </Badge>
            ))}
          </div>
        )}

        {/* Additional info */}
        <div className="flex items-center gap-2 mb-3 text-xs text-gray-600">
          {condition && <Badge variant="outline">{condition}</Badge>}
          {item.shipping === 0 && <Badge variant="outline">Free Shipping</Badge>}
        </div>

        {/* Action - Smart button based on data source */}
        {isRapidApiResult && productLink ? (
          // RapidAPI: Direct merchant link available
          <Button
            variant="default"
            size="sm"
            className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-md hover:shadow-lg transition-all"
            onClick={() => window.open(productLink, '_blank')}
            title={`Shop at ${merchant}`}
          >
            <ShoppingCart className="w-4 h-4 mr-2" />
            Buy at {merchant}
          </Button>
        ) : item.merchantOffersLoaded && item.merchantOffers?.length > 0 ? (
          // SerpAPI: Pre-fetched merchant offers available
          <Button
            variant="default"
            size="sm"
            className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-md hover:shadow-lg transition-all"
            onClick={() => window.open(item.merchantOffers[0].link, '_blank')}
            title={`Buy from ${item.merchantOffers[0].merchant} - ${item.merchantOffers.length} store${item.merchantOffers.length > 1 ? 's' : ''} available`}
          >
            <ShoppingCart className="w-4 h-4 mr-2" />
            Buy at {item.merchantOffers[0].merchant}
          </Button>
        ) : item.merchantOffersLoaded === false && item.immersive_product_page_token ? (
          // SerpAPI: Loading merchant links
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            disabled
          >
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Finding stores...
          </Button>
        ) : (
          // Fallback: Generic link (could be Google Shopping or direct)
          <Button
            variant="default"
            size="sm"
            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-md hover:shadow-lg transition-all"
            onClick={() => window.open(productLink, '_blank')}
            disabled={!productLink}
            title={hasDirectLink ? `Shop at ${merchant}` : "View full product details and all available merchant offers"}
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            {hasDirectLink ? `Shop Now` : 'View Item'}
          </Button>
        )}
        
        {/* Show alternate merchant options if available */}
        {item.merchantOffers?.length > 1 && (
          <details className="mt-2">
            <summary className="text-xs text-blue-600 cursor-pointer hover:underline">
              +{item.merchantOffers.length - 1} more store{item.merchantOffers.length > 2 ? 's' : ''}
            </summary>
            <div className="mt-1 space-y-1">
              {item.merchantOffers.slice(1, 4).map((offer, idx) => (
                <button
                  key={idx}
                  onClick={() => window.open(offer.link, '_blank')}
                  className="w-full text-left text-xs p-1 hover:bg-gray-50 rounded flex justify-between items-center"
                >
                  <span className="font-medium">{offer.merchant}</span>
                  <span className="text-green-600">${offer.price.toFixed(2)}</span>
                </button>
              ))}
            </div>
          </details>
        )}
        
        {/* Show "Multiple stores" indicator */}
        {item.multiple_sources && (
          <p className="text-xs text-green-600 text-center mt-1 font-medium">
            ✓ Multiple stores available
          </p>
        )}
        
        {/* Debug Info Panel */}
        {showDebug && (
          <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
            <p className="font-bold text-yellow-800 mb-1">🐛 Debug Info:</p>
            <p className="text-yellow-700 break-all">
              <strong>Link:</strong> {productLink || 'MISSING'}
            </p>
            <p className="text-yellow-700">
              <strong>Fields:</strong> {Object.keys(item).length} total
            </p>
            <details className="mt-1">
              <summary className="cursor-pointer text-yellow-800 font-semibold">
                View All Fields
              </summary>
              <pre className="mt-1 text-xs bg-white p-1 rounded overflow-auto max-h-40">
                {JSON.stringify(item, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
