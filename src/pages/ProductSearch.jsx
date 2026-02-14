import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Loader2, ExternalLink, TrendingUp, ShoppingCart } from 'lucide-react';
import { supabase } from '@/integrations/supabase';
import { useToast } from '@/components/ui/use-toast';

const ORBEN_API_URL = import.meta.env.VITE_ORBEN_API_URL || 'https://orben-api.fly.dev';

export default function ProductSearch() {
  const [query, setQuery] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [providers, setProviders] = useState(['ebay', 'oxylabs']);
  const { toast } = useToast();

  const { data: searchResults, isLoading, refetch } = useQuery({
    queryKey: ['productSearch', searchQuery],
    queryFn: async () => {
      if (!searchQuery) return null;

      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      if (!token) {
        throw new Error('Please log in to search');
      }

      // Check if smart routing is disabled
      const disableSmartRouting = localStorage.getItem('orben_disable_smart_routing') === 'true';
      
      // If smart routing disabled, only use explicitly selected providers
      // If smart routing enabled, pass 'auto' to let backend decide
      let providerList;
      if (disableSmartRouting) {
        // Manual mode - use only what user selected
        if (providers.length === 0) {
          throw new Error('Please select at least one provider');
        }
        providerList = providers.join(',');
      } else {
        // Smart routing mode - backend decides based on query
        providerList = 'auto';
      }

      const params = new URLSearchParams({
        q: searchQuery,
        providers: providerList,
        country: 'US',
        limit: '20'
      });

      const response = await fetch(`${ORBEN_API_URL}/v1/search?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error('Search failed');
      }

      return response.json();
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
    refetch();
  };

  const groupedResults = {};
  if (searchResults?.items) {
    searchResults.items.forEach(item => {
      if (!groupedResults[item.source]) {
        groupedResults[item.source] = [];
      }
      groupedResults[item.source].push(item);
    });
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Universal Product Search</h1>
        <p className="text-gray-600 mt-1">Search across eBay, Google Shopping, and more</p>
      </div>

      {/* Search Bar */}
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSearch}>
            <div className="flex gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Search for products... (e.g., 'iPhone 15 Pro', 'LEGO Star Wars')"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="text-lg"
                />
              </div>
              <Button type="submit" disabled={isLoading} className="px-8">
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

          {/* Provider selection */}
          <div className="mt-4 flex items-center gap-4">
            <span className="text-sm font-medium">Search providers:</span>
            <div className="flex gap-2">
              {['ebay', 'oxylabs', 'google'].map(provider => (
                <label key={provider} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={providers.includes(provider)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setProviders([...providers, provider]);
                      } else {
                        setProviders(providers.filter(p => p !== provider));
                      }
                    }}
                    className="rounded"
                  />
                  <span className="text-sm capitalize">
                    {provider}
                    {provider === 'oxylabs' && ' (premium)'}
                  </span>
                </label>
              ))}
            </div>
            {localStorage.getItem('orben_disable_smart_routing') === 'true' && (
              <Badge variant="outline" className="ml-auto">
                Manual Mode
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {searchResults && (
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {searchResults.items?.map((item, idx) => (
                  <ProductCard key={idx} item={item} />
                ))}
              </div>
            </TabsContent>

            {Object.keys(groupedResults).map(source => (
              <TabsContent key={source} value={source} className="mt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {groupedResults[source].map((item, idx) => (
                    <ProductCard key={idx} item={item} />
                  ))}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </>
      )}

      {!searchResults && !isLoading && (
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
