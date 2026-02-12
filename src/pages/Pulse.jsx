import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Pulse Page - Deal Monitoring & Price Intelligence
 * Monitors prices, tracks deals, and sends alerts
 */
export default function Pulse() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [productSearchOpen, setProductSearchOpen] = useState(false);
  const [alertsEnabled, setAlertsEnabled] = useState(true);

  // Fetch deal alerts
  const { data: dealAlerts = [], isLoading: loadingAlerts } = useQuery({
    queryKey: ['dealAlerts'],
    queryFn: async () => {
      const res = await fetch('/api/pulse/deal-alerts');
      if (!res.ok) throw new Error('Failed to fetch alerts');
      return res.json();
    }
  });

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

  // Unread alerts count
  const unreadCount = dealAlerts.filter(alert => !alert.is_read).length;

  return (
    <div className="p-4 md:p-6 lg:p-8 min-h-screen bg-background">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Zap className="h-8 w-8 text-yellow-500" />
              Pulse
            </h1>
            <p className="text-muted-foreground mt-1">
              Deal monitoring, price intelligence, and smart alerts
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={() => setProductSearchOpen(true)}
              className="bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700 text-white"
            >
              <Search className="w-4 h-4 mr-2" />
              Search Products
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Alerts</p>
                  <p className="text-3xl font-bold">{unreadCount}</p>
                </div>
                <Bell className="h-12 w-12 text-orange-500 opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Watching</p>
                  <p className="text-3xl font-bold">{watchlist.length}</p>
                </div>
                <Star className="h-12 w-12 text-yellow-500 opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Alerts</p>
                  <p className="text-3xl font-bold">{dealAlerts.length}</p>
                </div>
                <TrendingDown className="h-12 w-12 text-green-500 opacity-20" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Alert Settings */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Alert Settings
              </span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-normal text-muted-foreground">
                  Notifications
                </span>
                <Switch
                  checked={alertsEnabled}
                  onCheckedChange={setAlertsEnabled}
                />
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Coming Soon:</strong> Configure custom alert thresholds, notification preferences,
                and deal categories. Background monitoring will automatically scan for deals matching your criteria.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Deal Alerts */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Deal Alerts
              {unreadCount > 0 && (
                <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                  {unreadCount} new
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingAlerts ? (
              <LoadingSkeleton />
            ) : dealAlerts.length === 0 ? (
              <EmptyState
                icon={Bell}
                title="No alerts yet"
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
                {dealAlerts.map((alert) => (
                  <DealAlertCard
                    key={alert.id}
                    alert={alert}
                    onDelete={() => deleteMutation.mutate(alert.id)}
                    onMarkRead={() => markReadMutation.mutate(alert.id)}
                  />
                ))}
              </div>
            )}
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

// Deal Alert Card Component
function DealAlertCard({ alert, onDelete, onMarkRead }) {
  const discountColor = alert.discount_percentage >= 50
    ? 'text-red-600 bg-red-100'
    : alert.discount_percentage >= 25
    ? 'text-orange-600 bg-orange-100'
    : 'text-green-600 bg-green-100';

  return (
    <div
      className={cn(
        "border rounded-lg p-4 transition-all",
        alert.is_read ? "bg-muted/30" : "bg-card border-l-4 border-l-orange-500"
      )}
    >
      <div className="flex items-start gap-4">
        {/* Product Image */}
        <div className="w-20 h-20 rounded-md bg-muted flex-shrink-0 overflow-hidden">
          {alert.product_image_url ? (
            <img
              src={alert.product_image_url}
              alt={alert.product_name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              <DollarSign className="h-8 w-8" />
            </div>
          )}
        </div>

        {/* Alert Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h4 className="font-semibold text-sm line-clamp-2">{alert.product_name}</h4>
            {!alert.is_read && (
              <Badge variant="secondary" className="bg-orange-100 text-orange-800 text-xs">
                NEW
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl font-bold text-primary">
              ${alert.current_price?.toFixed(2)}
            </span>
            {alert.original_price && (
              <span className="text-sm text-muted-foreground line-through">
                ${alert.original_price.toFixed(2)}
              </span>
            )}
            <Badge className={discountColor}>
              -{alert.discount_percentage}%
            </Badge>
          </div>

          <p className="text-xs text-muted-foreground mb-3">{alert.alert_reason}</p>

          <div className="flex items-center gap-2">
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
          <Skeleton className="w-20 h-20 rounded-md" />
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
