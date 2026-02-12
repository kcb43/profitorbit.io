import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import {
  Search,
  Filter,
  TrendingDown,
  Star,
  ExternalLink,
  X,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Heart,
  TrendingUp,
  BarChart3
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

/**
 * Universal Product Search Dialog
 * Searches products across all marketplaces using Google Shopping scraper
 */
export function ProductSearchDialog({ open, onOpenChange, initialQuery = '' }) {
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [priceHistory, setPriceHistory] = useState(null);
  const { toast } = useToast();

  // Filters
  const [filters, setFilters] = useState({
    minPrice: '',
    maxPrice: '',
    minDiscount: 0,
    minRating: 0,
    condition: 'all',
    sortBy: 'relevance',
    marketplaces: ['all']
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

      toast({
        title: '✅ Search complete',
        description: `Found ${data.totalResults} products across ${Object.keys(data.stats?.marketplaceCounts || {}).length} marketplaces`
      });

    } catch (error) {
      console.error('Search error:', error);
      toast({
        title: '❌ Search failed',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

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
          target_price: product.price * 0.85, // Alert at 15% discount
          notify_on_drop: true
        })
      });

      if (!response.ok) throw new Error('Failed to add to watchlist');

      toast({
        title: '⭐ Added to watchlist',
        description: `You'll be notified when ${product.title} drops below $${(product.price * 0.85).toFixed(2)}`
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

  // View price history
  const handleViewHistory = async (product) => {
    setSelectedProduct(product);
    
    // For now, generate mock history data
    // In production, this would fetch from price_history table
    const mockHistory = Array.from({ length: 30 }, (_, i) => ({
      date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toLocaleDateString(),
      price: product.price + (Math.random() - 0.5) * product.price * 0.2
    }));
    
    setPriceHistory(mockHistory);
  };

  // Auto-search on mount if initialQuery provided
  useEffect(() => {
    if (open && initialQuery && !products.length) {
      handleSearch();
    }
  }, [open, initialQuery]);

  // Grouped products by marketplace
  const groupedProducts = useMemo(() => {
    const groups = {};
    products.forEach(product => {
      if (!groups[product.marketplace]) {
        groups[product.marketplace] = [];
      }
      groups[product.marketplace].push(product);
    });
    return groups;
  }, [products]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[90vh] flex flex-col p-0">
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
                placeholder="Search any product (e.g., Nike Air Max 90, iPhone 15 Pro, KitchenAid Mixer...)"
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
            <div className="mt-4 p-4 bg-background border rounded-lg grid grid-cols-2 md:grid-cols-4 gap-4">
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
          <div className="px-6 py-3 bg-muted/30 border-b">
            <div className="flex items-center gap-6 text-sm">
              <span className="font-semibold">{products.length} Results</span>
              <span className="text-muted-foreground">
                Price Range: ${stats.priceStats.lowest} - ${stats.priceStats.highest}
              </span>
              <span className="text-muted-foreground">
                Avg: ${stats.priceStats.average}
              </span>
              {stats.averageDiscount > 0 && (
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  Avg {stats.averageDiscount}% off
                </Badge>
              )}
              <div className="ml-auto flex gap-2">
                {Object.entries(stats.marketplaceCounts).map(([marketplace, count]) => (
                  <Badge key={marketplace} variant="outline" className="text-xs">
                    {marketplace}: {count}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <LoadingState />
          ) : products.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedProducts).map(([marketplace, items]) => (
                <MarketplaceGroup
                  key={marketplace}
                  marketplace={marketplace}
                  products={items}
                  onAddToWatchlist={handleAddToWatchlist}
                  onViewHistory={handleViewHistory}
                />
              ))}
            </div>
          )}
        </div>

        {/* Price History Modal */}
        {selectedProduct && priceHistory && (
          <div className="absolute inset-0 bg-background z-50 p-6 overflow-y-auto">
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-2xl font-bold">{selectedProduct.title}</h3>
                  <p className="text-muted-foreground">30-day price history</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setSelectedProduct(null);
                    setPriceHistory(null);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Price Chart */}
              <div className="bg-card border rounded-lg p-6 mb-6">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={priceHistory}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 12 }}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis 
                      tick={{ fontSize: 12 }}
                      domain={['dataMin - 5', 'dataMax + 5']}
                    />
                    <Tooltip 
                      formatter={(value) => `$${value.toFixed(2)}`}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))'
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="price" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-card border rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">Current Price</p>
                  <p className="text-2xl font-bold">${selectedProduct.price.toFixed(2)}</p>
                </div>
                <div className="bg-card border rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">Lowest (30d)</p>
                  <p className="text-2xl font-bold text-green-600">
                    ${Math.min(...priceHistory.map(h => h.price)).toFixed(2)}
                  </p>
                </div>
                <div className="bg-card border rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">Highest (30d)</p>
                  <p className="text-2xl font-bold text-red-600">
                    ${Math.max(...priceHistory.map(h => h.price)).toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <Button
                  className="flex-1"
                  onClick={() => handleAddToWatchlist(selectedProduct)}
                >
                  <Heart className="h-4 w-4 mr-2" />
                  Add to Watchlist
                </Button>
                <Button
                  variant="outline"
                  onClick={() => window.open(selectedProduct.productUrl, '_blank')}
                >
                  View Product <ExternalLink className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Marketplace Group Component
function MarketplaceGroup({ marketplace, products, onAddToWatchlist, onViewHistory }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Group Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 bg-muted/50 flex items-center justify-between hover:bg-muted transition-colors"
      >
        <div className="flex items-center gap-3">
          {products[0]?.marketplaceLogo && (
            <img
              src={products[0].marketplaceLogo}
              alt={marketplace}
              className="h-6 w-auto object-contain"
            />
          )}
          <span className="font-semibold capitalize">{marketplace}</span>
          <Badge variant="secondary">{products.length} items</Badge>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {/* Products Grid */}
      {expanded && (
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((product, idx) => (
            <ProductCard
              key={idx}
              product={product}
              onAddToWatchlist={onAddToWatchlist}
              onViewHistory={onViewHistory}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Product Card Component
function ProductCard({ product, onAddToWatchlist, onViewHistory }) {
  return (
    <div className="border rounded-lg p-4 hover:shadow-md transition-shadow bg-card">
      {/* Image */}
      <div className="aspect-square bg-muted rounded-md mb-3 overflow-hidden">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            No image
          </div>
        )}
      </div>

      {/* Title */}
      <h4 className="font-medium text-sm line-clamp-2 mb-2 min-h-[2.5rem]">
        {product.title}
      </h4>

      {/* Price & Discount */}
      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-2xl font-bold text-primary">
          ${product.price.toFixed(2)}
        </span>
        {product.originalPrice && product.originalPrice > product.price && (
          <>
            <span className="text-sm text-muted-foreground line-through">
              ${product.originalPrice.toFixed(2)}
            </span>
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              -{product.discountPercentage}%
            </Badge>
          </>
        )}
      </div>

      {/* Rating */}
      {product.rating && (
        <div className="flex items-center gap-1 text-sm text-muted-foreground mb-3">
          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
          <span className="font-medium text-foreground">{product.rating}</span>
          {product.reviewCount && (
            <span>({product.reviewCount.toLocaleString()})</span>
          )}
        </div>
      )}

      {/* Seller & Condition */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
        {product.seller && <span>by {product.seller}</span>}
        {product.condition !== 'new' && (
          <Badge variant="outline" className="text-xs">
            {product.condition}
          </Badge>
        )}
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => onAddToWatchlist(product)}
        >
          <Heart className="h-3 w-3 mr-1" />
          Watch
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => onViewHistory(product)}
        >
          <BarChart3 className="h-3 w-3 mr-1" />
          History
        </Button>
      </div>

      {/* Buy Button */}
      <Button
        variant="default"
        size="sm"
        className="w-full mt-2"
        onClick={() => window.open(product.productUrl, '_blank')}
      >
        View Product <ExternalLink className="ml-2 h-3 w-3" />
      </Button>
    </div>
  );
}

// Loading State
function LoadingState() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="border rounded-lg p-4">
          <Skeleton className="h-6 w-32 mb-4" />
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((j) => (
              <div key={j} className="space-y-3">
                <Skeleton className="aspect-square rounded-md" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// Empty State
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center py-12">
      <Search className="h-16 w-16 text-muted-foreground mb-4" />
      <h3 className="text-xl font-semibold mb-2">Search Products Across the Web</h3>
      <p className="text-muted-foreground max-w-md">
        Enter any product name to search across Amazon, eBay, Walmart, Best Buy, Target,
        and 100+ more marketplaces. Compare prices, find deals, and discover the best offers.
      </p>
    </div>
  );
}

export default ProductSearchDialog;
