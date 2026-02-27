import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import {
  Search,
  Star,
  ExternalLink,
  SlidersHorizontal,
  Heart,
  BarChart3,
  TrendingDown,
  Filter
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Universal Product Search Dialog - Compact Table View
 * Searches products across all marketplaces
 */
export function ProductSearchDialog({ open, onOpenChange, initialQuery = '' }) {
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const { toast } = useToast();

  // Filters
  const [filters, setFilters] = useState({
    minPrice: '',
    maxPrice: '',
    minDiscount: 0,
    minRating: 0,
    condition: 'all',
    sortBy: 'relevance',
    marketplace: 'all'
  });

  // Search function
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast({
        title: 'Search query required',
        description: 'Please enter a product name to search',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    setProducts([]);
    setStats(null);

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

      setProducts(data.products || []);
      setStats(data.stats || null);

      // Show helpful message based on search performance
      if (data.note || data.suggestion) {
        toast({
          title: `✅ Found ${data.totalResults} products (${data.searchTime})`,
          description: data.note || data.suggestion?.message,
          duration: 5000
        });
      } else {
        toast({
          title: `✅ Search complete (${data.searchTime})`,
          description: `Found ${data.totalResults} products${data.sources ? ` from ${data.sources.join(', ')}` : ''}`
        });
      }

    } catch (error) {
      console.error('Search error:', error);
      
      // Show helpful setup message if it's a "no API keys" error
      if (error.message.includes('No API keys')) {
        toast({
          title: '⚡ Speed Up Your Searches',
          description: 'Add FREE API keys for 2-3 second searches across 100+ marketplaces. See setup guide.',
          variant: 'default',
          duration: 8000
        });
      } else {
        toast({
          title: '❌ Search failed',
          description: error.message,
          variant: 'destructive'
        });
      }
    } finally {
      setLoading(false);
    }
  };

  // Auto-search on mount if initialQuery provided
  useEffect(() => {
    if (open && initialQuery && !products.length) {
      handleSearch();
    }
  }, [open, initialQuery]);

  // Add to watchlist
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

  // Filtered products
  const filteredProducts = useMemo(() => {
    let filtered = products;

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
  }, [products, filters]);

  // Get unique marketplaces
  const marketplaces = useMemo(() => {
    const unique = [...new Set(products.map(p => p.marketplace))];
    return unique.sort();
  }, [products]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:w-[92vw] max-w-[80rem] max-h-[90vh] flex flex-col p-0">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <Search className="h-6 w-6" />
            Universal Product Search
          </DialogTitle>
        </DialogHeader>

        {/* Search Bar */}
        <div className="px-6 py-4 border-b bg-muted/20">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search any product (e.g., Nike Air Max 90, iPhone 15 Pro...)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10 h-12 text-base"
                disabled={loading}
              />
            </div>
            <Button
              onClick={handleSearch}
              disabled={loading}
              size="lg"
              className="px-8"
            >
              {loading ? 'Searching...' : 'Search'}
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => setShowFilters(!showFilters)}
              className={cn(showFilters && 'bg-muted')}
            >
              <SlidersHorizontal className="h-4 w-4" />
            </Button>
          </div>

          {/* Filters Panel */}
          {showFilters && (
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

        {/* Stats Bar */}
        {stats && !loading && (
          <div className="px-6 py-2 bg-muted/30 border-b text-sm flex items-center gap-6">
            <span className="font-semibold">{filteredProducts.length} Results</span>
            {stats.priceStats.lowest !== Infinity && (
              <>
                <span className="text-muted-foreground">
                  ${stats.priceStats.lowest.toFixed(2)} - ${stats.priceStats.highest.toFixed(2)}
                </span>
                <span className="text-muted-foreground">
                  Avg: ${stats.priceStats.average}
                </span>
              </>
            )}
          </div>
        )}

        {/* Results Table */}
        <div className="flex-1 overflow-auto px-6 py-4">
          {loading ? (
            <LoadingState />
          ) : filteredProducts.length === 0 ? (
            <EmptyState />
          ) : (
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
                  {filteredProducts.map((product, idx) => (
                    <ProductRow
                      key={idx}
                      product={product}
                      onAddToWatchlist={handleAddToWatchlist}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Product Row Component
function ProductRow({ product, onAddToWatchlist }) {
  const hasDiscount = product.originalPrice && product.originalPrice > product.price;

  return (
    <tr className="border-b last:border-b-0 hover:bg-muted/20">
      {/* Image */}
      <td className="py-2 px-3">
        <div className="w-14 h-14 rounded-md bg-muted overflow-hidden flex-shrink-0">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
              No img
            </div>
          )}
        </div>
      </td>

      {/* Product Title */}
      <td className="py-2 px-3">
        <div className="max-w-md">
          <div className="font-medium text-sm line-clamp-2 mb-1">{product.title}</div>
          {product.seller && (
            <div className="text-xs text-muted-foreground">by {product.seller}</div>
          )}
        </div>
      </td>

      {/* Marketplace */}
      <td className="py-2 px-3 text-center">
        <div className="flex flex-col items-center gap-1">
          {product.marketplaceLogo ? (
            <img
              src={product.marketplaceLogo}
              alt={product.marketplace}
              className="h-5 w-auto object-contain"
            />
          ) : (
            <span className="text-xs font-medium capitalize">{product.marketplace}</span>
          )}
        </div>
      </td>

      {/* Current Price */}
      <td className="py-2 px-3 text-right">
        <span className="text-lg font-bold text-primary">
          ${product.price.toFixed(2)}
        </span>
      </td>

      {/* Original Price */}
      <td className="py-2 px-3 text-right">
        {hasDiscount ? (
          <span className="text-sm text-muted-foreground line-through">
            ${product.originalPrice.toFixed(2)}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </td>

      {/* Discount */}
      <td className="py-2 px-3 text-center">
        {product.discountPercentage > 0 ? (
          <Badge variant="secondary" className="bg-green-100 text-green-800">
            -{product.discountPercentage}%
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>

      {/* Rating */}
      <td className="py-2 px-3 text-center">
        {product.rating ? (
          <div className="flex items-center justify-center gap-1">
            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
            <span className="text-sm font-medium">{product.rating}</span>
            {product.reviewCount && (
              <span className="text-xs text-muted-foreground">({product.reviewCount})</span>
            )}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>

      {/* Actions */}
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

// Empty State
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center py-12 px-6">
      <Search className="h-16 w-16 text-muted-foreground mb-4" />
      <h3 className="text-xl font-semibold mb-2">Search Products Across the Web</h3>
      <p className="text-muted-foreground max-w-md mb-6">
        Enter any product name to search across Amazon, eBay, Walmart, Best Buy, Target,
        and 100+ more marketplaces. Compare prices instantly.
      </p>
      
      {/* Quick Setup Tips */}
      <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg max-w-lg text-left">
        <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2 flex items-center gap-2">
          ⚡ Speed Tip: Add FREE API Keys
        </h4>
        <p className="text-sm text-blue-800 dark:text-blue-200 mb-2">
          For <strong>2-3 second searches</strong> across 100+ marketplaces:
        </p>
        <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1 list-disc list-inside">
          <li><strong>RapidAPI:</strong> 500 FREE searches/month</li>
          <li><strong>SerpAPI:</strong> 100 FREE searches/month</li>
        </ul>
        <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
          See <code>docs/FREE_API_SETUP.md</code> for 5-minute setup
        </p>
      </div>
    </div>
  );
}

export default ProductSearchDialog;
