import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, SlidersHorizontal } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Loader2, LoaderCircle, AlertCircle, Grid3x3, List, Table2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { createPageUrl } from '@/utils';
import { useProductSearch } from '@/hooks/useProductSearch';
import { 
  ProductCardV1Grid, 
  ProductCardV1List,
  ProductTableView,
} from '@/components/ProductCardVariations';

export default function ProductSearch() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const fromPage = searchParams.get('from') || '';
  
  const [query, setQuery] = useState(initialQuery);
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const [viewMode, setViewMode] = useState('list'); // 'grid' | 'list' | 'table'
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    minPrice: '',
    maxPrice: '',
    minDiscount: 0,
    marketplace: 'all',
    sortBy: 'relevance',
  });

  const {
    products: rawItems,
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
      debounceTimerRef.current = setTimeout(() => doSearch(query.trim()), 800);
    }
    return () => { if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current); };
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

  // Infinite scroll
  useEffect(() => {
    if (!canLoadMore || isLoadingMore || isLoading) return;
    let throttleTimeout;
    const handleScroll = () => {
      if (throttleTimeout) return;
      throttleTimeout = setTimeout(() => {
        const distanceFromBottom = document.documentElement.scrollHeight - window.innerHeight - window.scrollY;
        if (distanceFromBottom < 500 && canLoadMore && !isLoadingMore && !isLoading) handleLoadMore();
        throttleTimeout = null;
      }, 200);
    };
    window.addEventListener('scroll', handleScroll);
    return () => { window.removeEventListener('scroll', handleScroll); if (throttleTimeout) clearTimeout(throttleTimeout); };
  }, [canLoadMore, isLoadingMore, isLoading, handleLoadMore]);

  // Apply filters + sort
  const displayedItems = useMemo(() => {
    let items = rawItems.map(item => ({
      ...item,
      discountPct: (item.originalPrice && item.originalPrice > item.price)
        ? Math.round(((item.originalPrice - item.price) / item.originalPrice) * 100)
        : 0,
    }));

    if (filters.marketplace !== 'all') {
      items = items.filter(i => (i.marketplace || i.merchant || '') === filters.marketplace);
    }
    if (filters.minPrice !== '' && !isNaN(Number(filters.minPrice))) {
      items = items.filter(i => i.price >= Number(filters.minPrice));
    }
    if (filters.maxPrice !== '' && !isNaN(Number(filters.maxPrice))) {
      items = items.filter(i => i.price <= Number(filters.maxPrice));
    }
    if (filters.minDiscount > 0) {
      items = items.filter(i => i.discountPct >= filters.minDiscount);
    }
    if (filters.sortBy === 'price_low') items = [...items].sort((a, b) => a.price - b.price);
    else if (filters.sortBy === 'price_high') items = [...items].sort((a, b) => b.price - a.price);
    else if (filters.sortBy === 'discount') items = [...items].sort((a, b) => b.discountPct - a.discountPct);
    else if (filters.sortBy === 'rating') items = [...items].sort((a, b) => (b.rating || 0) - (a.rating || 0));

    return items;
  }, [rawItems, filters]);

  // Available marketplaces for filter dropdown
  const marketplaces = useMemo(() => {
    const unique = [...new Set(rawItems.map(i => i.marketplace || i.merchant || 'Unknown'))].sort();
    return unique;
  }, [rawItems]);

  // Group by merchant
  const groupedByMerchant = useMemo(() => {
    const groups = {};
    displayedItems.forEach(item => {
      const m = item.merchant || item.marketplace || 'Unknown';
      if (!groups[m]) groups[m] = [];
      groups[m].push(item);
    });
    return groups;
  }, [displayedItems]);

  const pricesWithValue = displayedItems.filter(i => i.price > 0).map(i => i.price);
  const avgPrice = pricesWithValue.length > 0
    ? pricesWithValue.reduce((s, p) => s + p, 0) / pricesWithValue.length
    : 0;

  const renderItems = (items) => {
    if (viewMode === 'table') return <ProductTableView items={items} />;
    return (
      <div className={viewMode === 'grid'
        ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 md:gap-6'
        : 'flex flex-col gap-3 sm:gap-4'
      }>
        {items.map((item, idx) => viewMode === 'grid'
          ? <ProductCardV1Grid key={idx} item={item} showDebugData={showDebugInfo} />
          : <ProductCardV1List key={idx} item={item} showDebugData={showDebugInfo} />
        )}
      </div>
    );
  };

  return (
    <div className="container mx-auto p-2 sm:p-4 md:p-6 space-y-3 sm:space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="w-full sm:w-auto">
          {fromPage && (
            <Button variant="ghost" onClick={() => {
              if (fromPage === 'inventory') navigate(createPageUrl('Inventory'));
              else if (fromPage === 'crosslist') navigate(createPageUrl('Crosslist'));
              else navigate(-1);
            }} className="mb-2 -ml-2">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to {fromPage === 'inventory' ? 'Inventory' : fromPage === 'crosslist' ? 'Crosslist' : 'Previous Page'}
            </Button>
          )}
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Universal Product Search</h1>
          <p className="text-xs sm:text-sm md:text-base text-gray-600 mt-1">Search Products Across 100+ Marketplaces</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <Button variant="outline" size="sm" onClick={() => setShowDebugInfo(!showDebugInfo)} className="text-[10px] sm:text-xs px-2 sm:px-3">
            {showDebugInfo ? '🐛' : '🔍'}
            <span className="hidden sm:inline ml-1">Debug</span>
          </Button>
        </div>
      </div>

      {/* Search Bar + Filters */}
      <Card>
        <CardContent className="pt-3 sm:pt-4 md:pt-6 px-3 sm:px-4 md:px-6 pb-4">
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
                {isLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /><span>Searching...</span></> : <><Search className="w-4 h-4 mr-2" />Search</>}
              </Button>
              {rawItems.length > 0 && (
                <Button type="button" variant="outline" onClick={() => setShowFilters(!showFilters)} className="w-full sm:w-auto text-sm sm:text-base">
                  <SlidersHorizontal className="w-4 h-4 mr-2" />
                  Filters
                </Button>
              )}
            </div>
          </form>

          {/* Filter Panel */}
          {showFilters && rawItems.length > 0 && (
            <div className="mt-4 pt-4 border-t grid grid-cols-2 md:grid-cols-5 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Min Price</label>
                <Input type="number" placeholder="$0" value={filters.minPrice}
                  onChange={(e) => setFilters({ ...filters, minPrice: e.target.value })} className="h-9 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Max Price</label>
                <Input type="number" placeholder="$9999" value={filters.maxPrice}
                  onChange={(e) => setFilters({ ...filters, maxPrice: e.target.value })} className="h-9 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Min Discount</label>
                <select className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
                  value={filters.minDiscount} onChange={(e) => setFilters({ ...filters, minDiscount: parseInt(e.target.value) })}>
                  <option value={0}>Any</option>
                  <option value={10}>10%+</option>
                  <option value={25}>25%+</option>
                  <option value={50}>50%+</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Marketplace</label>
                <select className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
                  value={filters.marketplace} onChange={(e) => setFilters({ ...filters, marketplace: e.target.value })}>
                  <option value="all">All</option>
                  {marketplaces.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Sort By</label>
                <select className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
                  value={filters.sortBy} onChange={(e) => setFilters({ ...filters, sortBy: e.target.value })}>
                  <option value="relevance">Relevance</option>
                  <option value="price_low">Price: Low to High</option>
                  <option value="price_high">Price: High to Low</option>
                  <option value="discount">Biggest Discounts</option>
                  <option value="rating">Highest Rated</option>
                </select>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* No Results */}
      {!isLoading && !isLoadingMore && rawItems.length === 0 && query.trim().length >= 3 && !searchError && (
        <Card className="p-12 border-yellow-200 bg-yellow-50">
          <div className="text-center">
            <Search className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
            <h3 className="text-xl font-medium mb-2 text-yellow-700">No Results Found</h3>
            <p className="text-yellow-600 mb-4">No products found for "{query.trim()}". Try a different search term.</p>
          </div>
        </Card>
      )}

      {displayedItems.length > 0 && (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
            <Card>
              <CardHeader className="pb-1 sm:pb-2 px-3 sm:px-4 pt-3 sm:pt-4">
                <CardTitle className="text-[10px] sm:text-xs md:text-sm font-medium text-gray-600 flex items-center gap-1">
                  <span className="hidden sm:inline">Results</span><span className="sm:hidden">Results</span>
                  {isLoadingMore && <Loader2 className="w-3 h-3 animate-spin text-blue-500" />}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 sm:px-4 pb-3 sm:pb-4">
                <div className="text-lg sm:text-xl md:text-2xl font-bold">{displayedItems.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1 sm:pb-2 px-3 sm:px-4 pt-3 sm:pt-4">
                <CardTitle className="text-[10px] sm:text-xs md:text-sm font-medium text-gray-600">Avg Price</CardTitle>
              </CardHeader>
              <CardContent className="px-3 sm:px-4 pb-3 sm:pb-4">
                <div className="text-lg sm:text-xl md:text-2xl font-bold text-green-600">
                  {avgPrice > 0 ? `$${avgPrice.toFixed(0)}` : 'N/A'}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1 sm:pb-2 px-3 sm:px-4 pt-3 sm:pt-4">
                <CardTitle className="text-[10px] sm:text-xs md:text-sm font-medium text-gray-600">Price Range</CardTitle>
              </CardHeader>
              <CardContent className="px-3 sm:px-4 pb-3 sm:pb-4">
                <div className="text-xs sm:text-base md:text-xl font-bold">
                  {pricesWithValue.length > 0
                    ? `$${Math.min(...pricesWithValue).toFixed(0)} - $${Math.max(...pricesWithValue).toFixed(0)}`
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

          {/* Results tabs */}
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
              
              {/* View mode buttons - desktop only */}
              <div className="hidden md:flex gap-1 flex-shrink-0">
                {[
                  { mode: 'list', icon: <List className="w-4 h-4" />, label: 'List' },
                  { mode: 'grid', icon: <Grid3x3 className="w-4 h-4" />, label: 'Grid' },
                  { mode: 'table', icon: <Table2 className="w-4 h-4" />, label: 'Table' },
                ].map(({ mode, icon, label }) => (
                  <Button key={mode} size="sm" onClick={() => setViewMode(mode)}
                    variant={viewMode === mode ? 'default' : 'outline'}
                    className={`text-xs ${viewMode === mode ? 'bg-indigo-600 hover:bg-indigo-700' : ''}`}>
                    {icon}
                    <span className="ml-1">{label}</span>
                  </Button>
                ))}
              </div>
            </div>

            <TabsContent value="all" className="mt-3 sm:mt-4 md:mt-6">
              {renderItems(displayedItems)}
              
              {canLoadMore && !isLoadingMore && (
                <div className="text-center py-6 sm:py-8">
                  <Button onClick={handleLoadMore} size="lg" className="min-w-[160px] sm:min-w-[200px]">
                    Load More Results
                  </Button>
                  <p className="text-xs sm:text-sm text-gray-500 mt-2">Showing {displayedItems.length} results</p>
                </div>
              )}
              {isLoadingMore && (
                <div className="text-center py-6 sm:py-8">
                  <LoaderCircle className="w-8 h-8 animate-spin mx-auto text-purple-500" />
                  <p className="text-sm text-gray-500 mt-2">Loading more... ({rawItems.length} items so far)</p>
                </div>
              )}
              {!canLoadMore && displayedItems.length >= 10 && !isLoadingMore && (
                <div className="text-center py-4">
                  <p className="text-sm text-gray-500">All {displayedItems.length} results displayed</p>
                </div>
              )}
            </TabsContent>

            {Object.keys(groupedByMerchant).map(merchant => (
              <TabsContent key={merchant} value={merchant} className="mt-3 sm:mt-4 md:mt-6">
                {renderItems(groupedByMerchant[merchant])}
              </TabsContent>
            ))}
          </Tabs>
        </>
      )}

      {rawItems.length === 0 && !isLoading && !searchError && query.trim().length < 3 && (
        <Card className="p-12">
          <div className="text-center">
            <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-medium mb-2">Search for Products</h3>
            <p className="text-sm text-gray-500">Try: "iPhone 15", "Nike shoes", "PS5", or "Samsung TV"</p>
          </div>
        </Card>
      )}

      {searchError && (
        <Card className="p-12 border-red-200 bg-red-50">
          <div className="text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h3 className="text-xl font-medium mb-2 text-red-700">Search Error</h3>
            <p className="text-red-600 mb-4">{searchError}</p>
            {searchError.includes('log in') && (
              <Button onClick={() => window.location.href = '/login'} variant="destructive">Go to Login</Button>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
