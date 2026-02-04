import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/api/supabaseClient";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ArrowLeft, 
  Package, 
  DollarSign, 
  TrendingUp, 
  Lightbulb, 
  ChevronDown,
  ChevronUp,
  ShoppingBag,
  Percent,
  Truck,
  CreditCard,
  Tag,
  BarChart3
} from "lucide-react";
import { createPageUrl } from "@/utils";

const PLATFORM_META = {
  ebay: {
    name: "eBay",
    icon: "https://upload.wikimedia.org/wikipedia/commons/1/1b/EBay_logo.svg",
    color: "from-blue-500 to-blue-600",
    bgColor: "bg-blue-50 dark:bg-blue-950/20",
  },
  mercari: {
    name: "Mercari",
    icon: "https://cdn.brandfetch.io/idjAt9LfED/w/400/h/400/theme/dark/icon.jpeg?c=1dxbfHSJFAPEGdCLU4o5B",
    color: "from-orange-500 to-orange-600",
    bgColor: "bg-orange-50 dark:bg-orange-950/20",
  },
  facebook_marketplace: {
    name: "Facebook Marketplace",
    icon: "https://upload.wikimedia.org/wikipedia/commons/b/b9/2023_Facebook_icon.svg",
    color: "from-indigo-500 to-indigo-600",
    bgColor: "bg-indigo-50 dark:bg-indigo-950/20",
  },
  facebook: {
    name: "Facebook",
    icon: "https://upload.wikimedia.org/wikipedia/commons/b/b9/2023_Facebook_icon.svg",
    color: "from-indigo-500 to-indigo-600",
    bgColor: "bg-indigo-50 dark:bg-indigo-950/20",
  },
  etsy: {
    name: "Etsy",
    icon: null,
    color: "from-pink-500 to-pink-600",
    bgColor: "bg-pink-50 dark:bg-pink-950/20",
  },
  offer_up: {
    name: "OfferUp",
    icon: null,
    color: "from-green-500 to-green-600",
    bgColor: "bg-green-50 dark:bg-green-950/20",
  },
  other: {
    name: "Other",
    icon: null,
    color: "from-gray-500 to-gray-600",
    bgColor: "bg-gray-50 dark:bg-gray-950/20",
  },
};

function normalizePlatformKey(raw) {
  const v = String(raw ?? "").trim().toLowerCase();
  if (!v) return "other";
  if (v === "facebook marketplace" || v === "facebook_marketplace" || v === "fbmp") return "facebook_marketplace";
  return v.replace(/\s+/g, "_");
}

function fmtMoney(n) {
  const v = Number(n || 0) || 0;
  return `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function fmtPct(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  return `${v.toFixed(1)}%`;
}

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

function PlatformCard({ platformData, meta }) {
  const [tipExpanded, setTipExpanded] = useState(false);
  
  const {
    platformKey,
    sales,
    revenue,
    profit,
    avgProfit,
    profitMargin,
    averageShippingCost,
    averageFees,
    totalShippingCost,
    totalFees,
  } = platformData;

  // Get category breakdown (would come from API in real implementation)
  const topCategories = []; // Placeholder - would be populated from API

  // Mock tip - will be controlled later
  const tip = `Based on your ${sales} sales on ${meta.name}, you're averaging ${fmtMoney(avgProfit)} profit per sale. Consider focusing on items with higher profit margins to maximize your earnings on this platform.`;

  return (
    <Card className="border border-gray-200/70 dark:border-gray-800/70 shadow-sm overflow-hidden">
      <CardHeader className={`bg-gradient-to-r ${meta.color} text-white pb-4`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {meta.icon ? (
              <div className="h-12 w-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center overflow-hidden">
                <img src={meta.icon} alt={meta.name} className="h-8 w-8 object-contain" />
              </div>
            ) : (
              <div className={`h-12 w-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center`}>
                <ShoppingBag className="h-6 w-6 text-white" />
              </div>
            )}
            <div>
              <CardTitle className="text-white text-xl">{meta.name}</CardTitle>
              <p className="text-white/80 text-sm">{sales} {sales === 1 ? 'sale' : 'sales'}</p>
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-6 space-y-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className={`${meta.bgColor} rounded-xl p-4 border border-gray-200/50 dark:border-gray-700/50`}>
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">Total Profit</span>
            </div>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {fmtMoney(profit)}
            </div>
          </div>
          
          <div className={`${meta.bgColor} rounded-xl p-4 border border-gray-200/50 dark:border-gray-700/50`}>
            <div className="flex items-center gap-2 mb-2">
              <Percent className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">Profit Margin</span>
            </div>
            <div className="text-2xl font-bold text-foreground">
              {fmtPct(profitMargin)}
            </div>
          </div>
          
          <div className={`${meta.bgColor} rounded-xl p-4 border border-gray-200/50 dark:border-gray-700/50`}>
            <div className="flex items-center gap-2 mb-2">
              <Truck className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">Avg Shipping</span>
            </div>
            <div className="text-2xl font-bold text-foreground">
              {fmtMoney(averageShippingCost)}
            </div>
          </div>
          
          <div className={`${meta.bgColor} rounded-xl p-4 border border-gray-200/50 dark:border-gray-700/50`}>
            <div className="flex items-center gap-2 mb-2">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">Avg Fees</span>
            </div>
            <div className="text-2xl font-bold text-foreground">
              {fmtMoney(averageFees)}
            </div>
          </div>
        </div>

        {/* Shipping & Fees Breakdown */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="border border-gray-200/50 dark:border-gray-700/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Package className="h-4 w-4" />
                Shipping Costs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total Spent</span>
                  <span className="text-lg font-semibold">{fmtMoney(totalShippingCost)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Per Transaction</span>
                  <span className="text-base font-medium">{fmtMoney(averageShippingCost)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border border-gray-200/50 dark:border-gray-700/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Platform Fees
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total Paid</span>
                  <span className="text-lg font-semibold">{fmtMoney(totalFees)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Per Transaction</span>
                  <span className="text-base font-medium">{fmtMoney(averageFees)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Performance Tip */}
        <Card className={`${meta.bgColor} border-2 border-dashed border-gray-300 dark:border-gray-700`}>
          <CardHeader className="pb-3">
            <button
              onClick={() => setTipExpanded(!tipExpanded)}
              className="flex items-center justify-between w-full text-left"
            >
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                Performance Tip
              </CardTitle>
              {tipExpanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          </CardHeader>
          {tipExpanded && (
            <CardContent>
              <p className="text-sm text-foreground leading-relaxed">{tip}</p>
            </CardContent>
          )}
        </Card>
      </CardContent>
    </Card>
  );
}

export default function PlatformPerformance() {
  const navigate = useNavigate();

  const { data: reportSummary, isLoading } = useQuery({
    queryKey: ["reports", "summary", "lifetime"],
    queryFn: async () => {
      return apiGetJson('/api/reports/summary?range=lifetime');
    },
    placeholderData: null,
  });

  const platforms = React.useMemo(() => {
    if (!reportSummary?.platforms) return [];
    return reportSummary.platforms
      .map((p) => {
        const key = normalizePlatformKey(p?.platformKey || p?.platform || 'other');
        const meta = PLATFORM_META[key] || PLATFORM_META.other;
        return {
          ...p,
          platformKey: key,
          meta,
        };
      })
      .filter((p) => (p.sales || 0) > 0 || (p.revenue || 0) > 0 || (p.profit || 0) !== 0)
      .sort((a, b) => (b.profit || 0) - (a.profit || 0));
  }, [reportSummary]);

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 lg:p-8 min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto space-y-6">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(-1)}
              className="flex-shrink-0"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Platform Performance</h1>
              <p className="text-muted-foreground mt-1">
                Deep dive into your selling performance across each marketplace
              </p>
            </div>
          </div>
        </div>

        {/* Platform Cards */}
        {platforms.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <p className="text-muted-foreground">No platform data available yet.</p>
              <p className="text-sm text-muted-foreground mt-2">
                Start adding sales to see your platform performance insights.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {platforms.map((platform) => (
              <PlatformCard
                key={platform.platformKey}
                platformData={platform}
                meta={platform.meta}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
