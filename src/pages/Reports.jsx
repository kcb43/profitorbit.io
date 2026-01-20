import React from "react";
import { supabase } from "@/api/supabaseClient";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Percent, TrendingUp, Timer, Sparkles, Trophy, Target, Activity, Package, DollarSign } from "lucide-react";
import { parseISO, format } from "date-fns";
import MonthlyPnlChart from "../components/reports/MonthlyPnlChart";
import CategoryPerformance from "../components/reports/CategoryPerformance";
import PlatformComparison from "../components/reports/PlatformComparison";
import StatCard from "../components/dashboard/StatCard";
import TaxSummary from "../components/dashboard/TaxSummary";

const PLATFORM_DISPLAY_NAMES = {
  ebay: "eBay",
  facebook_marketplace: "Facebook",
  etsy: "Etsy",
  mercari: "Mercari",
  offer_up: "OfferUp",
};

const RANGE_OPTIONS = [
  { label: "90D", value: "90d", helper: "Last 90 days" },
  { label: "180D", value: "180d", helper: "Past 6 months" },
  { label: "12M", value: "365d", helper: "Trailing 12 months" },
  { label: "All", value: "lifetime", helper: "All-time performance" },
];

const RANGE_TO_DAYS = {
  "90d": 90,
  "180d": 180,
  "365d": 365,
};

const RANGE_LABELS = {
  "90d": "90 days",
  "180d": "180 days",
  "365d": "12 months",
  "lifetime": "lifetime",
};

const currency = (value) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value || 0);

export default function ReportsPage() {
  // Default to lifetime so categories/tax/avg days are populated immediately.
  const [range, setRange] = React.useState("lifetime");

  async function apiGetJson(path) {
    let session = null;
    for (let i = 0; i < 8; i++) {
      // eslint-disable-next-line no-await-in-loop
      const res = await supabase.auth.getSession();
      session = res?.data?.session || null;
      if (session?.access_token) break;
      // eslint-disable-next-line no-await-in-loop
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

  const filteredSales = React.useMemo(() => {
    // For chart components we now pass pre-aggregated series/categories/platforms via the "sales" prop.
    return [];
  }, []);

  const rangeLabel = RANGE_LABELS[range] ?? "lifetime";
  const hasData = Boolean(reportSummary?.totals?.salesCount);

  const metrics = React.useMemo(() => {
    const t = reportSummary?.totals || {};
    return {
      totalProfit: Number(t.totalProfit || 0),
      totalRevenue: Number(t.totalRevenue || 0),
      avgProfit: Number(t.avgProfit || 0),
      profitMargin: Number(t.profitMargin || 0),
      averageSaleSpeed: Number(t.averageSaleSpeed || 0),
    };
  }, [reportSummary]);

  const comparison = React.useMemo(() => {
    return reportSummary?.comparison || null;
  }, [reportSummary]);

  const insights = React.useMemo(() => {
    return reportSummary?.insights || { topPlatform: null, topCategory: null, highestProfitSale: null, fastestSale: null };
  }, [reportSummary]);

  if (isLoading) {
    return (
      <div className="p-8">
        <Skeleton className="w-full h-96" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Reports &amp; Insights</h1>
            <p className="text-muted-foreground mt-2 max-w-xl">
              Explore profitability, platform mix, and speed-to-sale trends. Switching the range updates every chart and
              insight on this page.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {RANGE_OPTIONS.map((option) => {
              const active = option.value === range;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setRange(option.value)}
                  className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium transition ${
                    active
                      ? "border-transparent bg-foreground text-background shadow-sm"
                      : "border-border bg-background/80 text-foreground hover:border-foreground/40"
                  }`}
                  aria-pressed={active}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Profit This Period"
            value={currency(metrics.totalProfit)}
            icon={Sparkles}
            bgGradient="bg-gradient-to-br from-violet-500 to-purple-600"
          />
          <StatCard
            title="Profit Margin"
            value={`${metrics.profitMargin.toFixed(1)}%`}
            icon={Percent}
            bgGradient="bg-gradient-to-br from-orange-500 to-red-600"
          />
          <StatCard
            title="Avg Profit / Sale"
            value={`$${metrics.avgProfit.toFixed(2)}`}
            icon={TrendingUp}
            bgGradient="bg-gradient-to-br from-sky-400 to-cyan-500"
          />
          <StatCard
            title="Avg Days to Sell"
            value={`${metrics.averageSaleSpeed.toFixed(1)}d`}
            icon={Timer}
            bgGradient="bg-gradient-to-br from-teal-400 to-emerald-500"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-6">
          <MonthlyPnlChart sales={reportSummary?.series || []} rangeLabel={rangeLabel} />
          <InsightsPanel
            hasData={hasData}
            rangeLabel={rangeLabel}
            comparison={comparison}
            insights={insights}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CategoryPerformance sales={reportSummary?.categories || []} rangeLabel={rangeLabel} />
          <PlatformComparison sales={reportSummary?.platforms || []} rangeLabel={rangeLabel} />
        </div>

        {/* Tax Summary Section */}
        <div className="mt-6">
          <TaxSummary sales={[]} totalProfit={metrics.totalProfit} ytdProfitOverride={reportSummary?.ytdProfit ?? 0} />
        </div>

        {/* Shipping Info & Fees Section */}
        <div className="mt-6">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl font-semibold text-foreground">
                <Package className="w-5 h-5" />
                Shipping Info & Fees by Platform
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Overview of shipping costs and platform fees across all marketplaces for {rangeLabel}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {reportSummary?.platforms?.length > 0 ? (
                  reportSummary.platforms.map((platform) => {
                    const platformKey = platform.platformKey || platform.platform || 'other';
                    const displayName = PLATFORM_DISPLAY_NAMES[platformKey] || platformKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                    const platformData = {
                      totalShippingCost: platform.totalShippingCost || 0,
                      totalFees: platform.totalFees || 0,
                      averageShippingCost: platform.averageShippingCost || 0,
                      averageFees: platform.averageFees || 0,
                      transactionCount: platform.transactionCount || platform.sales || 0,
                    };

                    return (
                      <Card key={platformKey} className="border border-border/60">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base font-semibold text-foreground">{displayName}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Total Shipping</span>
                            <span className="text-sm font-semibold text-foreground">
                              {currency(platformData.totalShippingCost)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Total Fees</span>
                            <span className="text-sm font-semibold text-foreground">
                              {currency(platformData.totalFees)}
                            </span>
                          </div>
                          <div className="pt-2 border-t border-border/60">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">Avg Shipping</span>
                              <span className="text-xs font-medium text-foreground">
                                {currency(platformData.averageShippingCost)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between mt-1">
                              <span className="text-xs text-muted-foreground">Avg Fees</span>
                              <span className="text-xs font-medium text-foreground">
                                {currency(platformData.averageFees)}
                              </span>
                            </div>
                          </div>
                          {platformData.transactionCount > 0 && (
                            <div className="pt-2 border-t border-border/60">
                              <div className="text-xs text-muted-foreground">
                                {platformData.transactionCount} transaction{platformData.transactionCount !== 1 ? 's' : ''}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })
                ) : (
                  <div className="col-span-full py-8 text-center text-sm text-muted-foreground">
                    No platform data available for this period.
                  </div>
                )}
              </div>
              {!hasData && (
                <div className="mt-6 py-8 text-center text-sm text-muted-foreground">
                  Add sales data to see shipping costs and platform fees breakdown.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function InsightsPanel({ hasData, rangeLabel, comparison, insights }) {
  const descriptor = rangeLabel === "lifetime" ? "your lifetime data" : `the last ${rangeLabel}`;

  return (
    <Card className="border-0 shadow-sm h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-xl font-semibold text-foreground">Quick Insights</CardTitle>
        <CardDescription className="text-muted-foreground">
          Highlights from {descriptor}.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        {!hasData ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Add a few sales in this range to unlock tailored recommendations.
          </div>
        ) : (
          <div className="space-y-5">
            {comparison && (
              <div className="rounded-xl border border-border/60 bg-card/70 backdrop-blur-sm p-4">
                <div className="flex items-center gap-3 mb-3">
                  <Activity className="w-4 h-4 text-emerald-500" />
                  <p className="text-sm font-semibold text-foreground">Momentum vs. prior period</p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Profit change</p>
                    <p className={`font-semibold ${comparison.change >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                      {comparison.change >= 0 ? "+" : "-"}
                      {currency(Math.abs(comparison.change))}
                      {comparison.changePct !== null && (
                        <span className="text-xs text-muted-foreground ml-1">
                          ({comparison.changePct >= 0 ? "+" : ""}
                          {comparison.changePct.toFixed(1)}%)
                        </span>
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Avg profit / sale</p>
                    <p className="font-semibold text-foreground">
                      ${comparison.currentAvg.toFixed(2)}
                      {comparison.avgChangePct !== null && (
                        <span className="text-xs text-muted-foreground ml-1">
                          ({comparison.avgChangePct >= 0 ? "+" : ""}
                          {comparison.avgChangePct.toFixed(1)}%)
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {insights.topPlatform && (
              <InsightRow
                icon={Target}
                title="Top grossing platform"
                primary={`${insights.topPlatform.name}`}
                secondary={`${currency(insights.topPlatform.profit)} profit from ${insights.topPlatform.sales} sales`}
              />
            )}

            {insights.topCategory && (
              <InsightRow
                icon={Sparkles}
                title="Standout category"
                primary={insights.topCategory.name}
                secondary={`${currency(insights.topCategory.profit)} profit • ${insights.topCategory.sales} sales`}
              />
            )}

            {insights.highestProfitSale && (
              <InsightRow
                icon={Trophy}
                title="Biggest flip"
                primary={insights.highestProfitSale.item_name || "Unnamed item"}
                secondary={`${currency(insights.highestProfitSale.profit)} profit • sold ${
                  insights.highestProfitSale.sale_date
                    ? format(parseISO(insights.highestProfitSale.sale_date), "MMM d, yyyy")
                    : "recently"
                }`}
              />
            )}

            {insights.fastestSale && (
              <InsightRow
                icon={Timer}
                title="Fastest sale turnaround"
                primary={`${insights.fastestSale.days} days`}
                secondary={insights.fastestSale.item_name || ""}
              />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function InsightRow({ icon: Icon, title, primary, secondary }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-card/50 p-3">
      <div className="rounded-full bg-primary/10 text-primary p-2">
        <Icon className="w-4 h-4" />
      </div>
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
        <p className="text-sm font-semibold text-foreground">{primary}</p>
        {secondary && <p className="text-xs text-muted-foreground">{secondary}</p>}
      </div>
    </div>
  );
}
