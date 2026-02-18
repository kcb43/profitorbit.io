import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Loader2, LoaderCircle, ExternalLink, TrendingUp, ShoppingCart, AlertCircle, Grid3x3, List } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { createPageUrl } from '@/utils';
import { useProductSearch } from '@/hooks/useProductSearch';
import { 
  ProductCardV1Grid, 
  ProductCardV1List
} from '@/components/ProductCardVariations';

export default function ProductSearch() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const fromPage = searchParams.get('from') || '';
  
  const [query, setQuery] = useState(initialQuery);
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const [viewMode, setViewMode] = useState('list');
  
  const {
    products: displayedItems,
    loading: isLoading,
    loadingMore: isLoadingMore,
    hasMore: canLoadMore,
    error: searchError,
    search: doSearch,
    loadMore: handleLoadMore,
  } = useProductSearch();
  
  const { toast } = useToast();
  const debounceTimerRef = useRef(null);

  // Initialize search with query parameter on mount
  useEffect(() => {
    if (initialQuery && initialQuery.trim().length >= 3) {
      doSearch(initialQuery.trim());
    }
  }, []); // Only run on mount

  // Force list view on mobile
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) setViewMode('list');
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Debounce search query
  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    if (query.trim().length >= 3) {
      debounceTimerRef.current = setTimeout(() => {
        doSearch(query.trim());
      }, 800);
    }

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [query, doSearch]);

  // Handle search form submit (bypass debounce)
  const handleSearch = (e) => {
    e.preventDefault();
    if (!query.trim() || query.trim().length < 3) {
      toast({ title: 'Please enter at least 3 characters', variant: 'destructive' });
      return;
    }
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    doSearch(query.trim());
  };

  // Infinite scroll: auto-load more when near bottom
  useEffect(() => {
    if (!canLoadMore || isLoadingMore || isLoading) return;
    
    let throttleTimeout;
    const handleScroll = () => {
      if (throttleTimeout) return;
      throttleTimeout = setTimeout(() => {
        const distanceFromBottom = document.documentElement.scrollHeight - window.innerHeight - window.scrollY;
        if (distanceFromBottom < 500 && canLoadMore && !isLoadingMore && !isLoading) {
          handleLoadMore();
        }
        throttleTimeout = null;
      }, 200);
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (throttleTimeout) clearTimeout(throttleTimeout);
    };
  }, [canLoadMore, isLoadingMore, isLoading, handleLoadMore]);

  // Group by merchant
  const groupedByMerchant = {};
  if (displayedItems.length > 0) {
    displayedItems.forEach(item => {
      const merchant = item.merchant || item.marketplace || 'Unknown';
      if (!groupedByMerchant[merchant]) {
        groupedByMerchant[merchant] = [];
      }
      groupedByMerchant[merchant].push(item);
    });
  }

  const avgPrice = displayedItems.length > 0
    ? displayedItems.filter(i => i.price && i.price > 0).reduce((sum, i) => sum + i.price, 0) / displayedItems.filter(i => i.price && i.price > 0).length
    : 0;

  return (
    <div className="container mx-auto p-2 sm:p-4 md:p-6 space-y-3 sm:space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="w-full sm:w-auto">
          {fromPage && (
            <Button
              variant="ghost"
              onClick={() => {
                if (fromPage === 'inventory') {
                  navigate(createPageUrl('Inventory'));
                } else if (fromPage === 'crosslist') {
                  navigate(createPageUrl('Crosslist'));
                } else {
                  navigate(-1);
                }
              }}
              className="mb-2 -ml-2"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to {fromPage === 'inventory' ? 'Inventory' : fromPage === 'crosslist' ? 'Crosslist' : 'Previous Page'}
            </Button>
          )}
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Universal Product Search</h1>
          <p className="text-xs sm:text-sm md:text-base text-gray-600 mt-1">
            Search Products Across 100+ Marketplaces
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDebugInfo(!showDebugInfo)}
            className="text-[10px] sm:text-xs px-2 sm:px-3"
          >
            {showDebugInfo ? '🐛' : '🔍'}
            <span className="hidden sm:inline ml-1">Debug</span>
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <Card>
        <CardContent className="pt-3 sm:pt-4 md:pt-6 px-3 sm:px-4 md:px-6">
          <form onSubmit={handleSearch}>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 md:gap-4">
              <div className="flex-1 relative">
                <Input
                  placeholder="Search products..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="text-base md:text-lg"
                />
              </div>
              <Button type="submit" disabled={isLoading || !query.trim() || query.trim().length < 3} className="w-full sm:w-auto px-4 sm:px-6 md:px-8 text-sm sm:text-base">
                {isLoading ? (
                  <>
                    <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 animate-spin" />
                    <span className="hidden sm:inline">Searching...</span>
                    <span className="sm:hidden">...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                    Search
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* No Results */}
      {!isLoading && !isLoadingMore && displayedItems.length === 0 && query.trim().length >= 3 && !searchError && (
        <Card className="p-12 border-yellow-200 bg-yellow-50">
          <div className="text-center">
            <Search className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
            <h3 className="text-xl font-medium mb-2 text-yellow-700">No Results Found</h3>
            <p className="text-yellow-600 mb-4">
              No products found for "{query.trim()}". Try a different search term.
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
          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
            <Card>
              <CardHeader className="pb-1 sm:pb-2 px-3 sm:px-4 pt-3 sm:pt-4">
                <CardTitle className="text-[10px] sm:text-xs md:text-sm font-medium text-gray-600 flex items-center gap-1 sm:gap-2">
                  <span className="hidden sm:inline">Total Results</span>
                  <span className="sm:hidden">Results</span>
                  {isLoadingMore && (
                    <Loader2 className="w-2 h-2 sm:w-3 sm:h-3 animate-spin text-blue-500" title="Loading more results..." />
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 sm:px-4 pb-3 sm:pb-4">
                <div className="text-lg sm:text-xl md:text-2xl font-bold">
                  {displayedItems.length}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1 sm:pb-2 px-3 sm:px-4 pt-3 sm:pt-4">
                <CardTitle className="text-[10px] sm:text-xs md:text-sm font-medium text-gray-600">
                  <span className="hidden sm:inline">Average Price</span>
                  <span className="sm:hidden">Avg</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 sm:px-4 pb-3 sm:pb-4">
                <div className="text-lg sm:text-xl md:text-2xl font-bold text-green-600">
                  {avgPrice > 0 ? `$${avgPrice.toFixed(0)}` : 'N/A'}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1 sm:pb-2 px-3 sm:px-4 pt-3 sm:pt-4">
                <CardTitle className="text-[10px] sm:text-xs md:text-sm font-medium text-gray-600">
                  <span className="hidden sm:inline">Price Range</span>
                  <span className="sm:hidden">Range</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 sm:px-4 pb-3 sm:pb-4">
                <div className="text-xs sm:text-base md:text-xl font-bold">
                  {displayedItems.filter(i => i.price > 0).length > 0
                    ? `$${Math.min(...displayedItems.filter(i => i.price > 0).map(i => i.price)).toFixed(0)} - $${Math.max(...displayedItems.filter(i => i.price > 0).map(i => i.price)).toFixed(0)}`
                    : 'N/A'}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1 sm:pb-2 px-3 sm:px-4 pt-3 sm:pt-4">
                <CardTitle className="text-[10px] sm:text-xs md:text-sm font-medium text-gray-600">Merchants</CardTitle>
              </CardHeader>
              <CardContent className="px-3 sm:px-4 pb-3 sm:pb-4">
                <div className="text-lg sm:text-xl md:text-2xl font-bold">{Object.keys(groupedByMerchant).length}</div>
              </CardContent>
            </Card>
          </div>

          {/* Results by merchant */}
          <Tabs defaultValue="all" className="w-full">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3 sm:mb-4">
              <TabsList className="flex-wrap h-auto w-full sm:w-auto justify-start overflow-x-auto">
                <TabsTrigger value="all" className="text-xs sm:text-sm whitespace-nowrap">
                  All ({displayedItems.length})
                </TabsTrigger>
                {Object.keys(groupedByMerchant).sort((a, b) => groupedByMerchant[b].length - groupedByMerchant[a].length).slice(0, 8).map(merchant => (
                  <TabsTrigger key={merchant} value={merchant} className="text-xs sm:text-sm whitespace-nowrap">
                    {merchant} ({groupedByMerchant[merchant].length})
                  </TabsTrigger>
                ))}
              </TabsList>
              
              <div className="hidden md:flex gap-2 w-full sm:w-auto">
                <Button
                  onClick={() => setViewMode('grid')}
                  variant={viewMode === 'grid' ? 'default' : 'outline'}
                  size="sm"
                  className={`flex-1 sm:flex-initial text-xs sm:text-sm ${viewMode === 'grid' ? 'bg-indigo-600 hover:bg-indigo-700' : ''}`}
                >
                  <Grid3x3 className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                  Grid
                </Button>
                <Button
                  onClick={() => setViewMode('list')}
                  variant={viewMode === 'list' ? 'default' : 'outline'}
                  size="sm"
                  className={`flex-1 sm:flex-initial text-xs sm:text-sm ${viewMode === 'list' ? 'bg-indigo-600 hover:bg-indigo-700' : ''}`}
                >
                  <List className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                  List
                </Button>
              </div>
            </div>

            <TabsContent value="all" className="mt-3 sm:mt-4 md:mt-6">
              <div className={
                viewMode === 'grid'
                  ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 md:gap-6'
                  : 'flex flex-col gap-3 sm:gap-4'
              }>
                {displayedItems.map((item, idx) => {
                  const cardProps = { item, showDebugData: showDebugInfo };
                  return viewMode === 'grid' 
                    ? <ProductCardV1Grid key={idx} {...cardProps} />
                    : <ProductCardV1List key={idx} {...cardProps} />;
                })}
              </div>
              
              {canLoadMore && !isLoadingMore && (
                <div className="text-center py-6 sm:py-8">
                  <Button 
                    onClick={handleLoadMore}
                    size="lg"
                    className="min-w-[160px] sm:min-w-[200px] text-sm sm:text-base"
                  >
                    Load More Results
                  </Button>
                  <p className="text-xs sm:text-sm text-gray-500 mt-2">
                    Showing {displayedItems.length} results
                  </p>
                </div>
              )}
              
              {isLoadingMore && (
                <div className="text-center py-6 sm:py-8">
                  <LoaderCircle className="w-6 h-6 sm:w-8 sm:h-8 animate-spin mx-auto text-purple-500" />
                  <p className="text-xs sm:text-sm text-gray-500 mt-2">Loading more... ({displayedItems.length} items so far)</p>
                </div>
              )}
              
              {!canLoadMore && displayedItems.length >= 10 && !isLoadingMore && (
                <div className="text-center py-4 sm:py-6">
                  <p className="text-xs sm:text-sm text-gray-500">
                    All {displayedItems.length} results displayed
                  </p>
                </div>
              )}
            </TabsContent>

            {Object.keys(groupedByMerchant).map(merchant => (
              <TabsContent key={merchant} value={merchant} className="mt-3 sm:mt-4 md:mt-6">
                <div className={
                  viewMode === 'grid'
                    ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 md:gap-6'
                    : 'flex flex-col gap-3 sm:gap-4'
                }>
                  {groupedByMerchant[merchant].map((item, idx) => {
                    const cardProps = { item, showDebugData: showDebugInfo };
                    return viewMode === 'grid' 
                      ? <ProductCardV1Grid key={idx} {...cardProps} />
                      : <ProductCardV1List key={idx} {...cardProps} />;
                  })}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </>
      )}

      {displayedItems.length === 0 && !isLoading && !searchError && query.trim().length < 3 && (
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

      {searchError && (
        <Card className="p-12 border-red-200 bg-red-50">
          <div className="text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h3 className="text-xl font-medium mb-2 text-red-700">Search Error</h3>
            <p className="text-red-600 mb-4">
              {searchError}
            </p>
            {searchError.includes('log in') && (
              <Button onClick={() => window.location.href = '/login'} variant="destructive">
                Go to Login
              </Button>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
