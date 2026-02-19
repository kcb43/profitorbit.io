import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, TrendingUp, Bookmark, ExternalLink, DollarSign, Percent, AlertCircle, Loader2, Flame, Target, Package, Zap, Filter, TrendingDown, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

const ORBEN_API_URL = import.meta.env.VITE_ORBEN_API_URL || 'https://orben-api.fly.dev';

export default function Deals() {
  const [inputValue, setInputValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isSticky, setIsSticky] = useState(false);
  const [filters, setFilters] = useState({
    merchant: '',
    category: '',
    minScore: 0
  });
  const { toast } = useToast();
  const loadMoreRef = useRef(null);
  const searchBarRef = useRef(null);
  const searchTimerRef = useRef(null);
  const sentinelRef = useRef(null);

  // Debounced search — fires API call 400ms after user stops typing
  const handleSearchChange = useCallback((value) => {
    setInputValue(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setSearchQuery(value);
    }, 400);
  }, []);

  const clearSearch = useCallback(() => {
    setInputValue('');
    setSearchQuery('');
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
  }, []);

  // Detect when search bar becomes sticky via IntersectionObserver on a sentinel element
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsSticky(!entry.isIntersecting),
      { threshold: 0, rootMargin: '0px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  // Infinite query for deals feed with pagination
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch
  } = useInfiniteQuery({
    queryKey: ['deals', searchQuery, filters],
    queryFn: async ({ pageParam = 0 }) => {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      const params = new URLSearchParams({
        ...(searchQuery && { q: searchQuery }),
        ...(filters.merchant && { merchant: filters.merchant }),
        ...(filters.category && { category: filters.category }),
        min_score: filters.minScore.toString(),
        limit: '20', // Load 20 at a time for better UX
        offset: pageParam.toString()
      });

      const url = `${ORBEN_API_URL}/v1/deals/feed?${params}`;
      console.log('[Deals] Fetching from:', url);
      console.log('[Deals] ORBEN_API_URL:', ORBEN_API_URL);

      const response = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      console.log('[Deals] Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Deals] Error response:', errorText);
        throw new Error(`Failed to fetch deals: ${response.status}`);
      }

      const data = await response.json();
      console.log('[Deals] Received data:', { itemCount: data.items?.length, total: data.total });
      return data;
    },
    getNextPageParam: (lastPage, allPages) => {
      // If we got fewer items than requested, we've reached the end
      if (!lastPage.items || lastPage.items.length < 20) {
        return undefined;
      }
      // Calculate next offset
      return allPages.reduce((acc, page) => acc + (page.items?.length || 0), 0);
    },
    staleTime: 30_000, // Reduced to 30 seconds for fresher deals
    refetchInterval: 60_000 // Auto-refresh every 60 seconds to catch new deals
  });

  // Flatten all pages into single array
  const dealsData = {
    items: data?.pages.flatMap(page => page.items || []) || [],
    total: data?.pages[0]?.total || 0
  };

  // For the new layout, we use the flattened items directly
  const filteredDeals = dealsData.items;

  // Intersection Observer for infinite scroll
  useEffect(() => {
    if (!loadMoreRef.current || !hasNextPage || isFetchingNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Fetch user's saved deals
  const { data: savedDeals, refetch: refetchSaved } = useQuery({
    queryKey: ['savedDeals'],
    queryFn: async () => {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      if (!token) return { items: [] };

      const response = await fetch(`${ORBEN_API_URL}/v1/deals/saved`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to fetch saved deals');
      return response.json();
    }
  });

  const savedDealIds = new Set(savedDeals?.items?.map(d => d.id) || []);

  const handleSaveDeal = async (dealId, isSaved) => {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;

    if (!token) {
      toast({ title: 'Please log in to save deals', variant: 'destructive' });
      return;
    }

    try {
      const method = isSaved ? 'DELETE' : 'POST';
      const response = await fetch(`${ORBEN_API_URL}/v1/deals/${dealId}/save`, {
        method,
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to save deal');

      toast({
        title: isSaved ? 'Deal removed from watchlist' : 'Deal saved to watchlist',
        variant: 'default'
      });

      refetchSaved();
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const getScoreColor = (score) => {
    if (score >= 70) return 'bg-green-500';
    if (score >= 50) return 'bg-yellow-500';
    return 'bg-gray-400';
  };

  const calculateDiscount = (price, originalPrice) => {
    if (!price || !originalPrice || originalPrice <= price) return null;
    return Math.round(((originalPrice - price) / originalPrice) * 100);
  };

  return (
    <div className="p-2 sm:p-4 md:p-6 lg:p-8 min-h-screen bg-background">
      {/* Sentinel element — sits at natural position of search bar so we can detect when it scrolls off screen */}
      <div ref={sentinelRef} className="h-px w-full" aria-hidden="true" />

      {/* Sticky Search Bar */}
      <div
        ref={searchBarRef}
        className={cn(
          "sticky top-0 z-40 -mx-2 sm:-mx-4 md:-mx-6 lg:-mx-8 px-2 sm:px-4 md:px-6 lg:px-8 py-3 mb-4 transition-all duration-300",
          isSticky
            ? "bg-background/80 backdrop-blur-xl border-b border-border/60 shadow-sm"
            : "bg-transparent"
        )}
      >
        <div className="max-w-7xl mx-auto">
          <div className="relative flex items-center">
            {/* Animated search icon */}
            <div className={cn(
              "absolute left-3 flex items-center pointer-events-none transition-all duration-200",
              isSearchFocused ? "text-green-500 scale-110" : "text-muted-foreground"
            )}>
              {isLoading && searchQuery ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </div>

            <Input
              value={inputValue}
              onChange={(e) => handleSearchChange(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              placeholder="Search deals by title, merchant, or category…"
              className={cn(
                "pl-9 pr-10 h-11 rounded-xl border-2 transition-all duration-200 bg-card/60 text-sm",
                isSearchFocused
                  ? "border-green-500/60 shadow-[0_0_0_3px_rgba(34,197,94,0.12)] bg-card"
                  : "border-border/50 hover:border-border"
              )}
            />

            {/* Clear button — fades in when there's text */}
            <button
              onClick={clearSearch}
              aria-label="Clear search"
              className={cn(
                "absolute right-3 flex items-center justify-center w-5 h-5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-200",
                inputValue ? "opacity-100 scale-100" : "opacity-0 scale-75 pointer-events-none"
              )}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Results / status line */}
          <div
            className={cn(
              "overflow-hidden transition-all duration-300",
              searchQuery ? "max-h-8 mt-1.5 opacity-100" : "max-h-0 opacity-0"
            )}
          >
            <p className="text-xs text-muted-foreground px-1">
              {isLoading
                ? "Searching deals…"
                : `${filteredDeals.length} deal${filteredDeals.length !== 1 ? 's' : ''} found${dealsData.total > filteredDeals.length ? ` (showing ${filteredDeals.length} of ${dealsData.total})` : ''}`}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        {/* Header - Pulse Style */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2 flex-wrap">
              <TrendingDown className="h-6 w-6 sm:h-8 sm:w-8 text-green-500" />
              Deal Feed
              <Badge variant="secondary" className="bg-gradient-to-r from-green-100 to-emerald-100 text-green-800 text-xs flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-600"></span>
                </span>
                Live
              </Badge>
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">
              Curated deals from Reddit, Slickdeals, and top deal sites
            </p>
          </div>
          <div className="flex gap-2 w-full lg:w-auto">
            <Button 
              onClick={() => refetch()}
              variant="outline"
              size="sm"
              disabled={isLoading}
              className="flex-1 lg:flex-initial"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Refreshing...
                </>
              ) : (
                <>
                  <TrendingDown className="w-4 h-4 mr-2" />
                  Refresh
                </>
              )}
            </Button>
            <Button 
              onClick={() => window.location.href = '/deals/submit'}
              className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white flex-1 lg:flex-initial"
              size="sm"
            >
              <Package className="w-4 h-4 mr-2" />
              Submit Deal
            </Button>
          </div>
        </div>

        {/* Enhanced Stats Cards - Pulse Style */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="border-2 border-green-500/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Active Deals</p>
                  <p className="text-2xl font-bold text-green-600">{dealsData?.items?.length || 0}</p>
                </div>
                <TrendingDown className="h-10 w-10 text-green-500 opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-blue-500/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Bookmark className="h-3 w-3" /> Saved
                  </p>
                  <p className="text-2xl font-bold text-blue-600">{savedDeals?.items?.length || 0}</p>
                </div>
                <Bookmark className="h-10 w-10 text-blue-500 opacity-20" />
              </div>
            </CardContent>
          </Card>
        </div>

      {/* Deals Feed - Pulse-Style Layout */}
      <Tabs defaultValue="all" className="w-full" onValueChange={(value) => {
        if (value === 'saved') {
          refetchSaved(); // Refresh saved deals when tab is clicked
        }
      }}>
        <TabsList className="mb-6">
          <TabsTrigger value="all" className="flex items-center gap-2">
            <TrendingDown className="w-4 h-4" />
            All Deals ({dealsData?.items?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="saved" className="flex items-center gap-2">
            <Bookmark className="w-4 h-4" />
            Saved ({savedDeals?.items?.length || 0})
          </TabsTrigger>
        </TabsList>

        {/* All Deals Tab */}
        <TabsContent value="all">
          {isLoading ? (
            <LoadingSkeleton />
          ) : filteredDeals?.length === 0 ? (
            <EmptyDealState searchQuery={searchQuery} onClearSearch={clearSearch} />
          ) : (
            <div className="space-y-3">
              {filteredDeals.map((deal) => (
                <EnhancedDealCard
                  key={deal.id}
                  deal={deal}
                  isSaved={savedDealIds.has(deal.id)}
                  onSave={() => handleSaveDeal(deal.id, savedDealIds.has(deal.id))}
                />
              ))}
            </div>
          )}

          {/* Infinite scroll trigger */}
          {hasNextPage && (
            <div ref={loadMoreRef} className="py-8 text-center">
              {isFetchingNextPage ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm text-gray-600">Loading more deals...</span>
                </div>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                >
                  Load More Deals
                </Button>
              )}
            </div>
          )}

          {filteredDeals?.length === 0 && !isLoading && <EmptyDealState searchQuery={searchQuery} onClearSearch={clearSearch} />}
        </TabsContent>

        {/* Saved Deals Tab */}
        <TabsContent value="saved">
          {!savedDeals || savedDeals.items?.length === 0 ? (
            <Card className="p-12">
              <div className="text-center">
                <Bookmark className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-medium mb-2">No Saved Deals</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Save deals by clicking the bookmark icon to view them here later.
                </p>
              </div>
            </Card>
          ) : (
            <div className="space-y-3">
              {savedDeals.items.map((deal) => (
                <EnhancedDealCard
                  key={deal.id}
                  deal={deal}
                  isSaved={true}
                  onSave={() => handleSaveDeal(deal.id, true)}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
}


// Enhanced Deal Card Component - Pulse Style
function EnhancedDealCard({ deal, isSaved, onSave }) {
  const [timeAgo, setTimeAgo] = React.useState('');

  const discount = deal.original_price && deal.price 
    ? Math.round(((deal.original_price - deal.price) / deal.original_price) * 100)
    : 0;

  // Calculate and update time ago (uses user's local timezone automatically)
  React.useEffect(() => {
    const updateTimeAgo = () => {
      if (!deal.posted_at) return;
      
      const now = new Date();
      const posted = new Date(deal.posted_at);
      const diffMs = now - posted;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) {
        setTimeAgo('Just now');
      } else if (diffMins < 60) {
        setTimeAgo(`${diffMins}m ago`);
      } else if (diffHours < 24) {
        setTimeAgo(`${diffHours}h ago`);
      } else if (diffDays < 7) {
        setTimeAgo(`${diffDays}d ago`);
      } else {
        // Show date for older deals (automatically formatted to user's locale/timezone)
        setTimeAgo(posted.toLocaleDateString());
      }
    };

    updateTimeAgo();
    // Update every minute for live countdown
    const interval = setInterval(updateTimeAgo, 60000);
    return () => clearInterval(interval);
  }, [deal.posted_at]);

  // Determine deal quality badge
  const getDealBadge = () => {
    const score = deal.score || 0;
    
    if (score >= 90) {
      return { icon: '🚨', text: 'MEGA DEAL', class: 'bg-red-600 text-white animate-pulse' };
    } else if (score >= 70) {
      return { icon: '⚡', text: 'HOT DEAL', class: 'bg-orange-600 text-white' };
    } else if (score >= 50) {
      return { icon: '🔥', text: 'GREAT DEAL', class: 'bg-yellow-600 text-white' };
    }
    return null;
  };

  const dealBadge = getDealBadge();

  // Discount color coding
  const discountClass = discount >= 70
    ? 'text-red-600 bg-red-100 border-red-300'
    : discount >= 50
    ? 'text-orange-600 bg-orange-100 border-orange-300'
    : discount >= 25
    ? 'text-yellow-600 bg-yellow-100 border-yellow-300'
    : 'text-green-600 bg-green-100 border-green-300';

  return (
    <div
      className={cn(
        "border rounded-lg p-4 transition-all hover:shadow-lg bg-card border-l-4",
        deal.score >= 70 ? "border-l-green-500" : "border-l-blue-500"
      )}
    >
      <div className="flex items-start gap-2 sm:gap-4">
        {/* Product Image */}
        <div className="w-16 h-16 sm:w-24 sm:h-24 rounded-md bg-muted flex-shrink-0 overflow-hidden relative">
          <img
            src={deal.image_url || '/default-deal-image.png'}
            alt={deal.title}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.target.src = '/default-deal-image.png';
            }}
          />
          {dealBadge && (
            <div className={cn("absolute top-0.5 right-0.5 sm:top-1 sm:right-1 px-1 sm:px-2 py-0.5 rounded-full text-[8px] sm:text-[10px] font-bold", dealBadge.class)}>
              {dealBadge.icon}
            </div>
          )}
        </div>

        {/* Deal Content */}
        <div className="flex-1 min-w-0">
          {/* Header with Badges */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-xs sm:text-sm line-clamp-2 mb-1 sm:mb-2">{deal.title}</h4>
              <div className="flex flex-wrap items-center gap-1">
                {deal.score && (
                  <Badge className={`${deal.score >= 70 ? 'bg-green-500' : deal.score >= 50 ? 'bg-yellow-500' : 'bg-gray-400'} text-white text-[8px] sm:text-[10px]`}>
                    Score: {deal.score}
                  </Badge>
                )}
                {deal.merchant && (
                  <Badge variant="outline" className="text-[8px] sm:text-[10px]">
                    {deal.merchant}
                  </Badge>
                )}
                {deal.category && (
                  <Badge variant="secondary" className="text-[8px] sm:text-[10px]">
                    {deal.category}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Pricing */}
          <div className="flex items-center gap-1 sm:gap-2 mb-2 flex-wrap">
            {deal.price ? (
              <>
                <span className="text-lg sm:text-2xl font-bold text-primary">
                  ${deal.price.toFixed(2)}
                </span>
                {deal.original_price && deal.original_price > deal.price && (
                  <>
                    <span className="text-xs sm:text-sm text-muted-foreground line-through">
                      ${deal.original_price.toFixed(2)}
                    </span>
                    <Badge className={cn("text-[10px] sm:text-xs font-bold border", discountClass)}>
                      <Percent className="w-2 h-2 sm:w-3 sm:h-3 mr-0.5" />
                      {discount}% OFF
                    </Badge>
                    <span className="text-[10px] sm:text-xs text-green-600 font-semibold">
                      Save ${(deal.original_price - deal.price).toFixed(2)}
                    </span>
                  </>
                )}
              </>
            ) : (
              <span className="text-sm text-muted-foreground">Price not available</span>
            )}
          </div>

          {/* Coupon Code */}
          {deal.coupon_code && (
            <div className="mb-3 text-xs bg-purple-50 text-purple-800 px-2 py-1 rounded inline-block">
              🎫 Coupon: <code className="font-mono font-bold">{deal.coupon_code}</code>
            </div>
          )}

          {/* Source Info */}
          {deal.source && (
            <p className="text-xs text-muted-foreground mb-2">
              Source: {deal.source}
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              variant="default"
              onClick={() => window.open(deal.url, '_blank')}
              className="text-xs"
            >
              <span className="hidden sm:inline">View Deal</span>
              <span className="sm:hidden">View</span>
              <ExternalLink className="ml-1 h-3 w-3" />
            </Button>
            <Button
              size="sm"
              variant={isSaved ? 'default' : 'outline'}
              onClick={onSave}
              className="text-xs"
            >
              <Bookmark className={`h-3 w-3 sm:h-4 sm:w-4 ${isSaved ? 'fill-current' : ''}`} />
            </Button>
            {timeAgo && (
              <span className="text-[10px] sm:text-xs text-muted-foreground ml-auto flex items-center gap-1">
                <span className="hidden sm:inline">Posted</span>
                <span className="font-medium">{timeAgo}</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Loading Skeleton Component
function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex gap-4 border rounded-lg p-4">
          <Skeleton className="w-16 h-16 sm:w-24 sm:h-24 rounded-md" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-6 w-1/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-8 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Empty State Component
function EmptyDealState({ searchQuery, onClearSearch }) {
  if (searchQuery) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Search className="h-16 w-16 text-muted-foreground mb-4 opacity-40" />
        <h3 className="text-xl font-semibold mb-2">No deals match &ldquo;{searchQuery}&rdquo;</h3>
        <p className="text-muted-foreground max-w-md mb-4">
          Try a different keyword, merchant name, or category.
        </p>
        <Button onClick={onClearSearch} variant="outline">
          <X className="w-4 h-4 mr-2" />
          Clear Search
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Package className="h-16 w-16 text-muted-foreground mb-4" />
      <h3 className="text-xl font-semibold mb-2">No deals found</h3>
      <p className="text-muted-foreground max-w-md mb-4">
        Check back soon for new deals from Reddit, Slickdeals, and top deal sites.
      </p>
      <Button onClick={() => window.location.reload()} variant="outline">
        <TrendingDown className="w-4 h-4 mr-2" />
        Refresh Deals
      </Button>
    </div>
  );
}
