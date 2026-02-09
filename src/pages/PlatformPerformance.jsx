import React from "react";
import { supabase } from "@/api/supabaseClient";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ArrowLeft, TrendingUp, TrendingDown, DollarSign, Package, Truck, CreditCard, Settings, Eye, EyeOff, ChevronDown, ChevronUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

const PLATFORM_META = {
  ebay: {
    name: "eBay",
    icon: "https://upload.wikimedia.org/wikipedia/commons/1/1b/EBay_logo.svg",
    color: "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800"
  },
  facebook_marketplace: {
    name: "Facebook",
    icon: "https://upload.wikimedia.org/wikipedia/commons/b/b9/2023_Facebook_icon.svg",
    color: "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
  },
  mercari: {
    name: "Mercari",
    icon: "https://cdn.brandfetch.io/idjAt9LfED/w/400/h/400/theme/dark/icon.jpeg?c=1dxbfHSJFAPEGdCLU4o5B",
    color: "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
  },
  etsy: {
    name: "Etsy",
    icon: "https://cdn.brandfetch.io/idzyTAzn6G/theme/dark/logo.svg?c=1dxbfHSJFAPEGdCLU4o5B",
    color: "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800"
  },
  offer_up: {
    name: "OfferUp",
    icon: "https://cdn.brandfetch.io/id5p1Knwlt/theme/dark/symbol.svg?c=1dxbfHSJFAPEGdCLU4o5B",
    color: "bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-800"
  },
  other: {
    name: "Other",
    icon: null,
    color: "bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800"
  }
};

const RANGE_OPTIONS = [
  { label: "90D", value: "90d", helper: "Last 90 days" },
  { label: "180D", value: "180d", helper: "Past 6 months" },
  { label: "12M", value: "365d", helper: "Trailing 12 months" },
  { label: "All", value: "lifetime", helper: "All-time performance" },
];

const RANGE_LABELS = {
  "90d": "90 days",
  "180d": "180 days",
  "365d": "12 months",
  "lifetime": "lifetime",
};

function MetricCard({ label, value, icon: Icon, trend, subtitle }) {
  return (
    <div className="flex items-start justify-between">
      <div className="flex items-start gap-2">
        {Icon && <Icon className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />}
        <div>
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="text-lg font-bold text-foreground mt-0.5">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {trend !== undefined && trend !== null && (
        <Badge variant={trend >= 0 ? "default" : "destructive"} className="text-xs">
          {trend >= 0 ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
          {Math.abs(trend).toFixed(1)}%
        </Badge>
      )}
    </div>
  );
}

function PlatformCard({ platform, isHidden, onToggleVisibility }) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = React.useState(false);
  
  const meta = PLATFORM_META[platform.platformKey] || PLATFORM_META.other;
  const profitColor = platform.profit >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400";
  
  if (isHidden) return null;

  return (
    <>
      <Card className={`border-2 ${meta.color} shadow-sm hover:shadow-md transition-shadow`}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              {meta.icon ? (
                <div className="w-12 h-12 rounded-xl bg-white dark:bg-card shadow-sm border border-border flex items-center justify-center p-2">
                  <img src={meta.icon} alt={meta.name} className="w-full h-full object-contain" />
                </div>
              ) : (
                <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                  <Package className="w-6 h-6 text-muted-foreground" />
                </div>
              )}
              <div>
                <CardTitle className="text-xl font-bold">{meta.name}</CardTitle>
                <CardDescription className="text-xs">
                  {platform.sales} sale{platform.sales !== 1 ? 's' : ''}
                </CardDescription>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onToggleVisibility}
            >
              <EyeOff className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Key Metrics - Always Visible */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium">Total Profit</p>
              <p className={`text-2xl font-bold ${profitColor}`}>
                ${platform.profit.toFixed(2)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium">Revenue</p>
              <p className="text-2xl font-bold text-foreground">
                ${platform.revenue.toFixed(2)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <MetricCard
              label="Avg. Profit/Sale"
              value={`$${platform.avgProfit.toFixed(2)}`}
              icon={DollarSign}
            />
            <MetricCard
              label="Profit Margin"
              value={`${platform.profitMargin.toFixed(1)}%`}
              icon={TrendingUp}
            />
          </div>

          {/* Desktop: Show More Metrics */}
          <div className="hidden md:block space-y-3 pt-3 border-t">
            <div className="grid grid-cols-2 gap-3">
              <MetricCard
                label="Avg. Shipping"
                value={`$${platform.averageShippingCost.toFixed(2)}`}
                icon={Truck}
                subtitle="Per sale"
              />
              <MetricCard
                label="Avg. Fees"
                value={`$${platform.averageFees.toFixed(2)}`}
                icon={CreditCard}
                subtitle="Per sale"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground font-medium mb-1">Total Shipping</p>
                <Badge variant="outline" className="text-sm">
                  ${platform.totalShippingCost.toFixed(2)}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium mb-1">Total Fees</p>
                <Badge variant="outline" className="text-sm">
                  ${platform.totalFees.toFixed(2)}
                </Badge>
              </div>
            </div>
          </div>

          {/* Mobile: Expandable Section */}
          <div className="md:hidden">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-between"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              <span className="text-xs font-medium">
                {isExpanded ? 'Hide Details' : 'Show More Details'}
              </span>
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>

            {isExpanded && (
              <div className="space-y-3 pt-3 border-t mt-3">
                <div className="grid grid-cols-2 gap-3">
                  <MetricCard
                    label="Avg. Shipping"
                    value={`$${platform.averageShippingCost.toFixed(2)}`}
                    icon={Truck}
                  />
                  <MetricCard
                    label="Avg. Fees"
                    value={`$${platform.averageFees.toFixed(2)}`}
                    icon={CreditCard}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">Total Shipping</span>
                    <Badge variant="outline" className="text-xs">
                      ${platform.totalShippingCost.toFixed(2)}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">Total Fees</span>
                    <Badge variant="outline" className="text-xs">
                      ${platform.totalFees.toFixed(2)}
                    </Badge>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* View Full Details Button */}
          <Button
            variant="outline"
            size="sm"
            className="w-full mt-3"
            onClick={() => setShowDetailsDialog(true)}
          >
            <Settings className="w-4 h-4 mr-2" />
            View Full Breakdown
          </Button>
        </CardContent>
      </Card>

      {/* Full Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-3">
              {meta.icon && (
                <div className="w-10 h-10 rounded-lg bg-white dark:bg-card shadow-sm border border-border flex items-center justify-center p-2">
                  <img src={meta.icon} alt={meta.name} className="w-full h-full object-contain" />
                </div>
              )}
              <div>
                <DialogTitle>{meta.name} Detailed Analytics</DialogTitle>
                <DialogDescription>Complete breakdown of all metrics</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {/* Performance Metrics */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-foreground">Performance Overview</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex justify-between p-2 rounded bg-muted/50">
                  <span className="text-muted-foreground">Total Sales</span>
                  <span className="font-semibold">{platform.sales}</span>
                </div>
                <div className="flex justify-between p-2 rounded bg-muted/50">
                  <span className="text-muted-foreground">Revenue</span>
                  <span className="font-semibold">${platform.revenue.toFixed(2)}</span>
                </div>
                <div className="flex justify-between p-2 rounded bg-green-50 dark:bg-green-900/20">
                  <span className="text-muted-foreground">Profit</span>
                  <span className="font-semibold text-green-600 dark:text-green-400">
                    ${platform.profit.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between p-2 rounded bg-muted/50">
                  <span className="text-muted-foreground">Margin</span>
                  <span className="font-semibold">{platform.profitMargin.toFixed(1)}%</span>
                </div>
              </div>
            </div>

            {/* Cost Breakdown */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-foreground">Cost Breakdown</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between p-2 rounded bg-muted/50">
                  <span className="text-muted-foreground">Total Shipping Costs</span>
                  <span className="font-semibold">${platform.totalShippingCost.toFixed(2)}</span>
                </div>
                <div className="flex justify-between p-2 rounded bg-muted/50">
                  <span className="text-muted-foreground">Avg. Shipping/Sale</span>
                  <span className="font-semibold">${platform.averageShippingCost.toFixed(2)}</span>
                </div>
                <div className="flex justify-between p-2 rounded bg-muted/50">
                  <span className="text-muted-foreground">Total Platform Fees</span>
                  <span className="font-semibold">${platform.totalFees.toFixed(2)}</span>
                </div>
                <div className="flex justify-between p-2 rounded bg-muted/50">
                  <span className="text-muted-foreground">Avg. Fees/Sale</span>
                  <span className="font-semibold">${platform.averageFees.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Per-Sale Averages */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-foreground">Per-Sale Averages</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between p-2 rounded bg-blue-50 dark:bg-blue-900/20">
                  <span className="text-muted-foreground">Avg. Profit</span>
                  <span className="font-semibold text-blue-600 dark:text-blue-400">
                    ${platform.avgProfit.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between p-2 rounded bg-muted/50">
                  <span className="text-muted-foreground">Avg. Revenue</span>
                  <span className="font-semibold">
                    ${(platform.revenue / platform.sales).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function PlatformPerformance() {
  const navigate = useNavigate();
  const [range, setRange] = React.useState("lifetime");
  const [hiddenPlatforms, setHiddenPlatforms] = React.useState(() => {
    try {
      const saved = localStorage.getItem('hiddenPlatforms');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [showManageDialog, setShowManageDialog] = React.useState(false);

  async function apiGetJson(path) {
    let session = null;
    for (let i = 0; i < 8; i++) {
      const res = await supabase.auth.getSession();
      session = res?.data?.session || null;
      if (session?.access_token) break;
      await new Promise((r) => setTimeout(r, 150));
    }

    const headers = {
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      ...(session?.user?.id ? { 'x-user-id': session.user.id } : {}),
    };

    const resp = await fetch(path, { headers });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(err.error || `HTTP ${resp.status}`);
    }
    return resp.json();
  }

  const { data: reportSummary, isLoading } = useQuery({
    queryKey: ["reports", "summary", range],
    queryFn: async () => {
      const qs = new URLSearchParams();
      qs.set('range', range);
      return apiGetJson(`/api/reports/summary?${qs.toString()}`);
    },
    placeholderData: null,
  });

  const platforms = React.useMemo(() => {
    return reportSummary?.platforms || [];
  }, [reportSummary]);

  const visiblePlatforms = React.useMemo(() => {
    return platforms.filter(p => !hiddenPlatforms.includes(p.platformKey));
  }, [platforms, hiddenPlatforms]);

  const rangeLabel = RANGE_LABELS[range] ?? "lifetime";
  const hasData = platforms.length > 0;

  const togglePlatformVisibility = (platformKey) => {
    setHiddenPlatforms(prev => {
      const newHidden = prev.includes(platformKey)
        ? prev.filter(k => k !== platformKey)
        : [...prev, platformKey];
      localStorage.setItem('hiddenPlatforms', JSON.stringify(newHidden));
      return newHidden;
    });
  };

  const showAllPlatforms = () => {
    setHiddenPlatforms([]);
    localStorage.setItem('hiddenPlatforms', JSON.stringify([]));
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 min-h-screen bg-background">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate(createPageUrl("Dashboard"))}
              className="flex-shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Platform Performance</h1>
              <p className="text-sm text-muted-foreground mt-1">Comprehensive marketplace analytics and metrics</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowManageDialog(true)}
          >
            <Settings className="w-4 h-4 mr-2" />
            Manage Platforms
          </Button>
        </div>

        {/* Time Range Filter */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
              <div>
                <CardTitle className="text-base font-semibold">Time Range</CardTitle>
                <CardDescription className="text-xs">
                  Viewing {rangeLabel} data • {visiblePlatforms.length} of {platforms.length} platforms shown
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                {RANGE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setRange(opt.value)}
                    className={`
                      px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                      ${
                        range === opt.value
                          ? "bg-primary text-primary-foreground shadow-md"
                          : "bg-muted hover:bg-muted/80 text-muted-foreground"
                      }
                    `}
                    title={opt.helper}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Platform Cards Grid */}
        {isLoading ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-12 text-center">
              <p className="text-muted-foreground">Loading platform data...</p>
            </CardContent>
          </Card>
        ) : !hasData ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-12 text-center">
              <Package className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-semibold text-foreground mb-2">No sales data found</p>
              <p className="text-sm text-muted-foreground">
                Try selecting a different time range or add your first sale
              </p>
            </CardContent>
          </Card>
        ) : visiblePlatforms.length === 0 ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-12 text-center">
              <EyeOff className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-semibold text-foreground mb-2">All platforms hidden</p>
              <p className="text-sm text-muted-foreground mb-4">
                Show at least one platform to view analytics
              </p>
              <Button onClick={showAllPlatforms}>
                <Eye className="w-4 h-4 mr-2" />
                Show All Platforms
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {visiblePlatforms.map((platform) => (
              <PlatformCard
                key={platform.platformKey}
                platform={platform}
                isHidden={hiddenPlatforms.includes(platform.platformKey)}
                onToggleVisibility={() => togglePlatformVisibility(platform.platformKey)}
              />
            ))}
          </div>
        )}

        {/* Manage Platforms Dialog */}
        <Dialog open={showManageDialog} onOpenChange={setShowManageDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Manage Platforms</DialogTitle>
              <DialogDescription>
                Show or hide platforms from your analytics dashboard
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {platforms.map((platform) => {
                const meta = PLATFORM_META[platform.platformKey] || PLATFORM_META.other;
                const isHidden = hiddenPlatforms.includes(platform.platformKey);
                return (
                  <div
                    key={platform.platformKey}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {meta.icon ? (
                        <div className="w-8 h-8 rounded-lg bg-white dark:bg-card shadow-sm border border-border flex items-center justify-center p-1.5">
                          <img src={meta.icon} alt={meta.name} className="w-full h-full object-contain" />
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                          <Package className="w-4 h-4 text-muted-foreground" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-sm">{meta.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {platform.sales} sale{platform.sales !== 1 ? 's' : ''} • ${platform.profit.toFixed(2)} profit
                        </p>
                      </div>
                    </div>
                    <Button
                      variant={isHidden ? "outline" : "default"}
                      size="sm"
                      onClick={() => togglePlatformVisibility(platform.platformKey)}
                    >
                      {isHidden ? (
                        <>
                          <Eye className="w-4 h-4 mr-2" />
                          Show
                        </>
                      ) : (
                        <>
                          <EyeOff className="w-4 h-4 mr-2" />
                          Hide
                        </>
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-2 pt-4 border-t">
              <Button
                variant="outline"
                className="flex-1"
                onClick={showAllPlatforms}
              >
                Show All
              </Button>
              <Button
                className="flex-1"
                onClick={() => setShowManageDialog(false)}
              >
                Done
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
