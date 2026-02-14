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
  const [searchQuery, setSearchQuery] = useState('');
  const [displayLimit, setDisplayLimit] = useState(12); // Show 12 initially
  const { toast } = useToast();
  const loadMoreRef = useRef(null);

  // Check if smart routing is enabled
  const disableSmartRouting = localStorage.getItem('orben_disable_smart_routing') === 'true';

  const { data: searchResults, isLoading, refetch, error: queryError } = useQuery({
    queryKey: ['productSearch', searchQuery],
    queryFn: async () => {
      if (!searchQuery) return null;

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
        q: searchQuery,
        providers: providerList,
        country: 'US',
        limit: '50' // Fetch 50 total, display progressively
      });

      console.log('[ProductSearch] Fetching:', `${ORBEN_API_URL}/v1/search?${params}`);

      const response = await fetch(`${ORBEN_API_URL}/v1/search?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      console.log('[ProductSearch] Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[ProductSearch] Error response:', errorText);
        
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

      return data;
    },
    enabled: false // Only run when explicitly triggered
  });

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
    setSearchQuery(query);
    setDisplayLimit(12); // Reset display limit on new search
    refetch();
  };

  // Progressive loading: show more results as user scrolls
  const displayedItems = searchResults?.items?.slice(0, displayLimit) || [];
  const hasMore = searchResults?.items?.length > displayLimit;

  // Intersection observer for auto-load more
  useEffect(() => {
    if (!loadMoreRef.current || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setDisplayLimit(prev => prev + 12); // Load 12 more
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasMore]);

  const groupedResults = {};
  if (displayedItems.length > 0) {
    displayedItems.forEach(item => {
      if (!groupedResults[item.source]) {
        groupedResults[item.source] = [];
      }
      groupedResults[item.source].push(item);
    });
  }

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
              <div className="flex-1">
                <Input
                  placeholder="Search for products..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="text-base sm:text-lg"
                />
              </div>
              <Button type="submit" disabled={isLoading} className="w-full sm:w-auto px-6 sm:px-8">
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

          {/* Search Info */}
          <div className="mt-4 flex items-center gap-2 text-sm text-gray-600">
            <ShoppingCart className="w-4 h-4" />
            <span>
              Searching <span className="font-semibold text-gray-900">Google Shopping</span> via RapidAPI • 
              Real-time pricing from 100+ merchants
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
              No products found for "{searchQuery}". Try a different search term or check:
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
          {/* Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Total Results</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{searchResults.items?.length || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Providers</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 flex-wrap">
                  {searchResults.providers?.map((p, idx) => (
                    <Badge key={idx} variant={p.cached ? 'secondary' : 'default'}>
                      {p.provider} {p.cached && '(cached)'}
                    </Badge>
                  ))}
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
          </div>

          {/* Results by provider */}
          <Tabs defaultValue={Object.keys(groupedResults)[0] || 'all'} className="w-full">
            <TabsList>
              <TabsTrigger value="all">All ({searchResults.items?.length || 0})</TabsTrigger>
              {Object.keys(groupedResults).map(source => (
                <TabsTrigger key={source} value={source} className="capitalize">
                  {source} ({groupedResults[source].length})
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="all" className="mt-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {displayedItems.map((item, idx) => (
                  <ProductCard key={idx} item={item} />
                ))}
              </div>
              
              {/* Load more trigger for infinite scroll */}
              {hasMore && (
                <div ref={loadMoreRef} className="py-6 sm:py-8 text-center">
                  <Button
                    variant="outline"
                    onClick={() => setDisplayLimit(prev => prev + 12)}
                    className="px-6 sm:px-8"
                  >
                    <TrendingUp className="w-4 h-4 mr-2" />
                    <span className="text-sm sm:text-base">
                      Load More ({searchResults.items.length - displayLimit} remaining)
                    </span>
                  </Button>
                </div>
              )}
            </TabsContent>

            {Object.keys(groupedResults).map(source => (
              <TabsContent key={source} value={source} className="mt-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {groupedResults[source].map((item, idx) => (
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
            <h3 className="text-xl font-medium mb-2">Start Searching</h3>
            <p className="text-gray-600">
              Enter a product name to see live pricing and availability across multiple marketplaces
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
          <div className="absolute top-2 right-2">
            <Badge variant="secondary" className="capitalize text-xs">
              {item.source}
            </Badge>
          </div>
        </div>
      )}

      <CardContent className="p-4">
        {/* Title */}
        <h3 className="font-medium text-sm mb-2 line-clamp-2 min-h-[2.5rem]">
          {item.title}
        </h3>

        {/* Merchant */}
        {item.merchant && (
          <p className="text-xs text-gray-600 mb-2">{item.merchant}</p>
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
