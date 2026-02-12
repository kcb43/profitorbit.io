import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { ProductSearchDialog } from '@/components/ProductSearchDialog';
import {
  Bell,
  TrendingDown,
  Star,
  Trash2,
  ExternalLink,
  Search,
  Plus,
  AlertTriangle,
  DollarSign,
  Settings,
  Zap,
  Package,
  Flame,
  Ticket,
  Clock,
  Filter,
  Save,
  Target
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Enhanced Pulse Page - Advanced Deal Monitoring
 * Features from Amazon Deal Tracking GitHub Repos:
 * - Warehouse deal detection
 * - Lightning deal tracking
 * - Coupon detection
 * - Category filtering
 * - Smart deal badges
 * - Advanced filtering system
 */
export default function Pulse() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [productSearchOpen, setProductSearchOpen] = useState(false);
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  // Advanced Filters
  const [filters, setFilters] = useState({
    category: 'all',
    dealType: 'all',
    minDiscount: 0,
    minPrice: '',
    maxPrice: '',
    condition: 'all'
  });

  // Fetch deal alerts from LIVE Amazon deals
  const { data: dealAlertsResponse, isLoading: loadingAlerts } = useQuery({
    queryKey: ['dealAlerts', activeTab, filters],
    queryFn: async () => {
      const params = new URLSearchParams({
        type: activeTab === 'all' ? 'all' : activeTab,
        category: filters.category || 'all',
        minDiscount: filters.minDiscount || 0,
        maxPrice: filters.maxPrice || '',
        limit: 100
      });
      
      const res = await fetch(`/api/pulse/amazon-deals-live?${params}`);
      if (!res.ok) throw new Error('Failed to fetch deals');
      const data = await res.json();
      
      // Transform API response to match expected format
      return data.deals?.map(deal => ({
        id: deal.asin,
        product_name: deal.title,
        product_url: deal.productUrl,
        product_image_url: deal.imageUrl,
        current_price: deal.currentPrice,
        original_price: deal.originalPrice,
        discount_percentage: deal.discount,
        deal_type: deal.dealType,
        category: deal.category,
        alert_reason: generateAlertReason(deal),
        is_read: false,
        time_remaining: deal.endsAt ? calculateTimeRemaining(deal.endsAt) : null,
        savings_amount: deal.originalPrice - deal.currentPrice,
        condition: deal.condition || null,
        condition_note: deal.conditionNote || null,
        coupon_code: deal.couponCode || null,
        deal_quality_score: deal.qualityScore || 0
      })) || [];
    },
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
    staleTime: 4 * 60 * 1000 // Consider data stale after 4 minutes
  });

  const dealAlerts = dealAlertsResponse || [];

  // Helper function to generate alert reason
  function generateAlertReason(deal) {
    if (deal.dealType === 'lightning') {
      return `⚡ Lightning Deal! ${deal.discount}% off - Limited time!`;
    } else if (deal.dealType === 'warehouse') {
      return `📦 Warehouse Deal! ${deal.discount}% off - ${deal.condition}`;
    } else if (deal.discount >= 70) {
      return `🔥 MEGA DEAL! ${deal.discount}% off - Historic low!`;
    } else if (deal.discount >= 50) {
      return `💎 Great Deal! ${deal.discount}% off`;
    } else {
      return `💰 Price Drop! ${deal.discount}% off`;
    }
  }

  // Helper function to calculate time remaining
  function calculateTimeRemaining(endsAt) {
    const now = new Date();
    const end = new Date(endsAt);
    const diffMs = end - now;
    
    if (diffMs <= 0) return 'Expired';
    
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours === 0) return `${minutes}m`;
    if (minutes === 0) return `${hours}h`;
    return `${hours}h ${minutes}m`;
  }

  // Fetch price watchlist
  const { data: watchlist = [], isLoading: loadingWatchlist } = useQuery({
    queryKey: ['priceWatchlist'],
    queryFn: async () => {
      const res = await fetch('/api/pulse/watchlist');
      if (!res.ok) throw new Error('Failed to fetch watchlist');
      return res.json();
    }
  });

  // Delete alert mutation
  const deleteMutation = useMutation({
    mutationFn: async (alertId) => {
      const res = await fetch(`/api/pulse/deal-alerts/${alertId}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Failed to delete alert');
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['dealAlerts']);
      toast({
        title: '✅ Alert deleted',
        description: 'Deal alert removed successfully'
      });
    }
  });

  // Mark alert as read mutation
  const markReadMutation = useMutation({
    mutationFn: async (alertId) => {
      const res = await fetch(`/api/pulse/deal-alerts/${alertId}/read`, {
        method: 'POST'
      });
      if (!res.ok) throw new Error('Failed to mark as read');
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['dealAlerts']);
    }
  });

  // Filter and categorize alerts
  const categorizedAlerts = useMemo(() => {
    const categories = {
      all: dealAlerts,
      warehouse: dealAlerts.filter(a => a.deal_type === 'warehouse'),
      lightning: dealAlerts.filter(a => a.deal_type === 'lightning'),
      coupon: dealAlerts.filter(a => a.deal_type === 'coupon'),
      hotDeals: dealAlerts.filter(a => a.discount_percentage >= 70),
      electronics: dealAlerts.filter(a => a.category === 'Electronics'),
      home: dealAlerts.filter(a => a.category === 'Home & Kitchen'),
      toys: dealAlerts.filter(a => a.category === 'Toys & Games'),
      sports: dealAlerts.filter(a => a.category === 'Sports & Outdoors'),
      beauty: dealAlerts.filter(a => a.category === 'Beauty & Personal Care')
    };
    return categories;
  }, [dealAlerts]);

  // Apply filters
  const filteredAlerts = useMemo(() => {
    let filtered = categorizedAlerts[activeTab] || [];

    if (filters.dealType !== 'all') {
      filtered = filtered.filter(a => a.deal_type === filters.dealType);
    }

    if (filters.minDiscount > 0) {
      filtered = filtered.filter(a => a.discount_percentage >= filters.minDiscount);
    }

    if (filters.minPrice) {
      filtered = filtered.filter(a => a.current_price >= parseFloat(filters.minPrice));
    }

    if (filters.maxPrice) {
      filtered = filtered.filter(a => a.current_price <= parseFloat(filters.maxPrice));
    }

    if (filters.condition !== 'all') {
      filtered = filtered.filter(a => a.condition === filters.condition);
    }

    return filtered;
  }, [categorizedAlerts, activeTab, filters]);

  // Stats
  const unreadCount = dealAlerts.filter(alert => !alert.is_read).length;
  const warehouseDeals = categorizedAlerts.warehouse.length;
  const lightningDeals = categorizedAlerts.lightning.length;
  const hotDeals = categorizedAlerts.hotDeals.length;

  return (
    <div className="p-4 md:p-6 lg:p-8 min-h-screen bg-background">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Zap className="h-8 w-8 text-yellow-500" />
              Pulse
              <Badge variant="secondary" className="ml-2 bg-gradient-to-r from-purple-100 to-pink-100 text-purple-800">
                v2.0
              </Badge>
            </h1>
            <p className="text-muted-foreground mt-1">
              Deal monitoring with warehouse deals, lightning deals, coupons & smart alerts
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={() => setShowFilters(!showFilters)}
              variant="outline"
              size="sm"
            >
              <Filter className="w-4 h-4 mr-2" />
              {showFilters ? 'Hide' : 'Show'} Filters
            </Button>
            <Button
              onClick={() => setProductSearchOpen(true)}
              className="bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700 text-white"
            >
              <Search className="w-4 h-4 mr-2" />
              Search Products
            </Button>
          </div>
        </div>

        {/* Enhanced Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Active Alerts</p>
                  <p className="text-2xl font-bold">{unreadCount}</p>
                </div>
                <Bell className="h-10 w-10 text-orange-500 opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-orange-500/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Package className="h-3 w-3" /> Warehouse
                  </p>
                  <p className="text-2xl font-bold text-orange-600">{warehouseDeals}</p>
                </div>
                <Package className="h-10 w-10 text-orange-500 opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-yellow-500/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Zap className="h-3 w-3" /> Lightning
                  </p>
                  <p className="text-2xl font-bold text-yellow-600">{lightningDeals}</p>
                </div>
                <Zap className="h-10 w-10 text-yellow-500 opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-red-500/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Flame className="h-3 w-3" /> Hot Deals
                  </p>
                  <p className="text-2xl font-bold text-red-600">{hotDeals}</p>
                </div>
                <Flame className="h-10 w-10 text-red-500 opacity-20" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Advanced Filters Panel */}
        {showFilters && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Filter className="h-5 w-5" />
                Advanced Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {/* Deal Type */}
                <div>
                  <Label className="text-xs">Deal Type</Label>
                  <select
                    className="w-full mt-1 h-9 px-3 rounded-md border bg-background text-sm"
                    value={filters.dealType}
                    onChange={(e) => setFilters({ ...filters, dealType: e.target.value })}
                  >
                    <option value="all">All Types</option>
                    <option value="warehouse">📦 Warehouse</option>
                    <option value="lightning">⚡ Lightning</option>
                    <option value="coupon">🎫 Coupon</option>
                    <option value="regular">Regular</option>
                  </select>
                </div>

                {/* Min Discount */}
                <div>
                  <Label className="text-xs">Min Discount</Label>
                  <select
                    className="w-full mt-1 h-9 px-3 rounded-md border bg-background text-sm"
                    value={filters.minDiscount}
                    onChange={(e) => setFilters({ ...filters, minDiscount: parseInt(e.target.value) })}
                  >
                    <option value={0}>Any</option>
                    <option value={25}>25%+</option>
                    <option value={50}>50%+ 🔥</option>
                    <option value={70}>70%+ ⚡</option>
                    <option value={90}>90%+ 🚨</option>
                  </select>
                </div>

                {/* Price Range */}
                <div>
                  <Label className="text-xs">Min Price</Label>
                  <Input
                    type="number"
                    placeholder="$0"
                    className="mt-1 h-9 text-sm"
                    value={filters.minPrice}
                    onChange={(e) => setFilters({ ...filters, minPrice: e.target.value })}
                  />
                </div>

                <div>
                  <Label className="text-xs">Max Price</Label>
                  <Input
                    type="number"
                    placeholder="$999"
                    className="mt-1 h-9 text-sm"
                    value={filters.maxPrice}
                    onChange={(e) => setFilters({ ...filters, maxPrice: e.target.value })}
                  />
                </div>

                {/* Condition (for warehouse deals) */}
                <div>
                  <Label className="text-xs">Condition</Label>
                  <select
                    className="w-full mt-1 h-9 px-3 rounded-md border bg-background text-sm"
                    value={filters.condition}
                    onChange={(e) => setFilters({ ...filters, condition: e.target.value })}
                  >
                    <option value="all">All</option>
                    <option value="like_new">Like New</option>
                    <option value="very_good">Very Good</option>
                    <option value="good">Good</option>
                    <option value="acceptable">Acceptable</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-4">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setFilters({
                    category: 'all',
                    dealType: 'all',
                    minDiscount: 0,
                    minPrice: '',
                    maxPrice: '',
                    condition: 'all'
                  })}
                >
                  Clear Filters
                </Button>
                <Button size="sm" variant="default">
                  <Save className="w-3 h-3 mr-1" />
                  Save Preset
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Category Tabs */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Target className="h-5 w-5" />
              Deal Categories
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full h-auto flex-wrap justify-start gap-1 bg-transparent p-0">
                <TabsTrigger value="all" className="text-xs">
                  All Deals ({categorizedAlerts.all.length})
                </TabsTrigger>
                <TabsTrigger value="warehouse" className="text-xs">
                  📦 Warehouse ({categorizedAlerts.warehouse.length})
                </TabsTrigger>
                <TabsTrigger value="lightning" className="text-xs">
                  ⚡ Lightning ({categorizedAlerts.lightning.length})
                </TabsTrigger>
                <TabsTrigger value="coupon" className="text-xs">
                  🎫 Coupons ({categorizedAlerts.coupon.length})
                </TabsTrigger>
                <TabsTrigger value="hotDeals" className="text-xs">
                  🔥 Hot 70%+ ({categorizedAlerts.hotDeals.length})
                </TabsTrigger>
                <TabsTrigger value="electronics" className="text-xs">
                  📱 Electronics ({categorizedAlerts.electronics.length})
                </TabsTrigger>
                <TabsTrigger value="home" className="text-xs">
                  🏠 Home ({categorizedAlerts.home.length})
                </TabsTrigger>
                <TabsTrigger value="toys" className="text-xs">
                  🎮 Toys ({categorizedAlerts.toys.length})
                </TabsTrigger>
              </TabsList>

              <div className="mt-6">
                {loadingAlerts ? (
                  <LoadingSkeleton />
                ) : filteredAlerts.length === 0 ? (
                  <EmptyState
                    icon={activeTab === 'warehouse' ? Package : activeTab === 'lightning' ? Zap : Bell}
                    title={`No ${activeTab === 'all' ? '' : activeTab} deals yet`}
                    description="Search for products and add them to your watchlist to start receiving deal alerts."
                    action={
                      <Button onClick={() => setProductSearchOpen(true)} className="mt-4">
                        <Plus className="w-4 h-4 mr-2" />
                        Search Products
                      </Button>
                    }
                  />
                ) : (
                  <div className="space-y-3">
                    {filteredAlerts.map((alert) => (
                      <EnhancedDealCard
                        key={alert.id}
                        alert={alert}
                        onDelete={() => deleteMutation.mutate(alert.id)}
                        onMarkRead={() => markReadMutation.mutate(alert.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </Tabs>
          </CardContent>
        </Card>

        {/* Price Watchlist */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5" />
              Price Watchlist
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingWatchlist ? (
              <LoadingSkeleton />
            ) : watchlist.length === 0 ? (
              <EmptyState
                icon={Star}
                title="No items in watchlist"
                description="Search for products and add them to your watchlist to track price changes over time."
                action={
                  <Button onClick={() => setProductSearchOpen(true)} className="mt-4">
                    <Plus className="w-4 h-4 mr-2" />
                    Add to Watchlist
                  </Button>
                }
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {watchlist.map((item) => (
                  <WatchlistCard key={item.id} item={item} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Product Search Dialog */}
        <ProductSearchDialog
          open={productSearchOpen}
          onOpenChange={setProductSearchOpen}
        />
      </div>
    </div>
  );
}

// Enhanced Deal Card with Smart Badges
function EnhancedDealCard({ alert, onDelete, onMarkRead }) {
  // Determine deal quality and badge
  const getDealBadge = () => {
    const discount = alert.discount_percentage || 0;
    
    if (discount >= 90) {
      return { icon: '🚨', text: 'MEGA DEAL', class: 'bg-red-600 text-white animate-pulse' };
    } else if (discount >= 70) {
      return { icon: '⚡', text: 'HOT DEAL', class: 'bg-orange-600 text-white' };
    } else if (discount >= 50) {
      return { icon: '🔥', text: 'GREAT DEAL', class: 'bg-yellow-600 text-white' };
    }
    return null;
  };

  const getDealTypeBadge = () => {
    switch (alert.deal_type) {
      case 'warehouse':
        return { icon: '📦', text: 'WAREHOUSE', class: 'bg-orange-100 text-orange-800 border-orange-300' };
      case 'lightning':
        return { icon: '⚡', text: 'LIGHTNING', class: 'bg-yellow-100 text-yellow-800 border-yellow-300' };
      case 'coupon':
        return { icon: '🎫', text: 'COUPON', class: 'bg-purple-100 text-purple-800 border-purple-300' };
      default:
        return null;
    }
  };

  const dealBadge = getDealBadge();
  const typeBadge = getDealTypeBadge();

  // Discount color coding
  const discountClass = alert.discount_percentage >= 70
    ? 'text-red-600 bg-red-100 border-red-300'
    : alert.discount_percentage >= 50
    ? 'text-orange-600 bg-orange-100 border-orange-300'
    : alert.discount_percentage >= 25
    ? 'text-yellow-600 bg-yellow-100 border-yellow-300'
    : 'text-green-600 bg-green-100 border-green-300';

  return (
    <div
      className={cn(
        "border rounded-lg p-4 transition-all",
        alert.is_read ? "bg-muted/30" : "bg-card border-l-4 border-l-orange-500",
        alert.deal_type === 'warehouse' && "border-orange-500/50",
        alert.deal_type === 'lightning' && "border-yellow-500/50"
      )}
    >
      <div className="flex items-start gap-4">
        {/* Product Image */}
        <div className="w-24 h-24 rounded-md bg-muted flex-shrink-0 overflow-hidden relative">
          {alert.product_image_url ? (
            <img
              src={alert.product_image_url}
              alt={alert.product_name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              <DollarSign className="h-10 w-10" />
            </div>
          )}
          {dealBadge && (
            <div className={cn("absolute top-1 right-1 px-2 py-0.5 rounded-full text-[10px] font-bold", dealBadge.class)}>
              {dealBadge.icon}
            </div>
          )}
        </div>

        {/* Alert Content */}
        <div className="flex-1 min-w-0">
          {/* Header with Badges */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1">
              <h4 className="font-semibold text-sm line-clamp-2 mb-2">{alert.product_name}</h4>
              <div className="flex flex-wrap items-center gap-1">
                {!alert.is_read && (
                  <Badge variant="secondary" className="bg-orange-100 text-orange-800 text-[10px]">
                    NEW
                  </Badge>
                )}
                {typeBadge && (
                  <Badge className={cn("text-[10px] border", typeBadge.class)}>
                    {typeBadge.icon} {typeBadge.text}
                  </Badge>
                )}
                {alert.condition && (
                  <Badge variant="outline" className="text-[10px]">
                    {alert.condition}
                  </Badge>
                )}
                {alert.time_remaining && (
                  <Badge className="text-[10px] bg-red-100 text-red-800 border-red-300 animate-pulse">
                    <Clock className="h-3 w-3 mr-1" />
                    {alert.time_remaining}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Pricing */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl font-bold text-primary">
              ${alert.current_price?.toFixed(2)}
            </span>
            {alert.original_price && (
              <span className="text-sm text-muted-foreground line-through">
                ${alert.original_price.toFixed(2)}
              </span>
            )}
            {alert.discount_percentage > 0 && (
              <Badge className={cn("text-xs font-bold border", discountClass)}>
                -{alert.discount_percentage}% OFF
              </Badge>
            )}
            {alert.savings_amount && (
              <span className="text-xs text-green-600 font-semibold">
                Save ${alert.savings_amount.toFixed(2)}
              </span>
            )}
          </div>

          {/* Alert Reason & Condition Note */}
          <div className="space-y-1 mb-3">
            <p className="text-xs text-muted-foreground">{alert.alert_reason}</p>
            {alert.condition_note && (
              <p className="text-xs text-muted-foreground italic">
                📝 {alert.condition_note}
              </p>
            )}
            {alert.coupon_code && (
              <div className="text-xs bg-purple-50 text-purple-800 px-2 py-1 rounded inline-block">
                🎫 Coupon: <code className="font-mono font-bold">{alert.coupon_code}</code>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              variant="default"
              onClick={() => window.open(alert.product_url, '_blank')}
            >
              View Deal <ExternalLink className="ml-1 h-3 w-3" />
            </Button>
            {!alert.is_read && (
              <Button size="sm" variant="outline" onClick={onMarkRead}>
                Mark Read
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={onDelete}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Watchlist Card Component
function WatchlistCard({ item }) {
  const priceChange = item.price_change_percentage || 0;
  const isDecrease = priceChange < 0;

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <div className="aspect-square bg-muted">
        {item.product_image_url ? (
          <img
            src={item.product_image_url}
            alt={item.product_name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <DollarSign className="h-12 w-12" />
          </div>
        )}
      </div>
      <CardContent className="p-4">
        <h4 className="font-medium text-sm line-clamp-2 mb-2">{item.product_name}</h4>
        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-xl font-bold">${item.current_price?.toFixed(2)}</span>
          {priceChange !== 0 && (
            <Badge
              variant="secondary"
              className={cn(
                isDecrease ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
              )}
            >
              {isDecrease ? '↓' : '↑'} {Math.abs(priceChange).toFixed(1)}%
            </Badge>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          className="w-full"
          onClick={() => window.open(item.product_url, '_blank')}
        >
          View Product <ExternalLink className="ml-2 h-3 w-3" />
        </Button>
      </CardContent>
    </Card>
  );
}

// Loading Skeleton
function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex gap-4">
          <Skeleton className="w-24 h-24 rounded-md" />
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

// Empty State
function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Icon className="h-16 w-16 text-muted-foreground mb-4" />
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground max-w-md mb-4">{description}</p>
      {action}
    </div>
  );
}
