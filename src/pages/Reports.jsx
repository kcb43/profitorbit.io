import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Percent, TrendingUp, Timer, Sparkles, Trophy, Target, Activity } from "lucide-react";
import { differenceInDays, parseISO, subDays, format } from "date-fns";
import MonthlyPnlChart from "../components/reports/MonthlyPnlChart";
import CategoryPerformance from "../components/reports/CategoryPerformance";
import PlatformComparison from "../components/reports/PlatformComparison";
import StatCard from "../components/dashboard/StatCard";
import TaxSummary from "../components/dashboard/TaxSummary";
import { sortSalesByRecency } from "@/utils/sales";

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
  const { data: sales, isLoading } = useQuery({
    queryKey: ["sales"],
    queryFn: () => base44.entities.Sale.list(),
    initialData: [],
  });

  const [range, setRange] = React.useState("90d");

  const sortedSales = React.useMemo(() => sortSalesByRecency(sales ?? []), [sales]);

  const filteredSales = React.useMemo(() => {
    if (!sortedSales || sortedSales.length === 0) return [];
    if (range === "lifetime") return sortedSales;
    const days = RANGE_TO_DAYS[range];
    const cutoff = subDays(new Date(), days);
    return sortedSales.filter((sale) => {
      if (!sale.sale_date) return false;
      try {
        return parseISO(sale.sale_date) >= cutoff;
      } catch {
        return false;
      }
    });
  }, [sales, range]);

  const rangeLabel = RANGE_LABELS[range] ?? "lifetime";
  const hasData = filteredSales.length > 0;

  const metrics = React.useMemo(() => {
    const totalProfit = filteredSales.reduce((sum, sale) => sum + (sale.profit || 0), 0);
    const totalRevenue = filteredSales.reduce((sum, sale) => sum + (sale.selling_price || 0), 0);
    const avgProfit = filteredSales.length > 0 ? totalProfit / filteredSales.length : 0;
    const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    const salesWithSpeed = filteredSales
      .map((sale) => {
        if (!sale.purchase_date || !sale.sale_date) return null;
        try {
          return Math.max(0, differenceInDays(parseISO(sale.sale_date), parseISO(sale.purchase_date)));
        } catch {
          return null;
        }
      })
      .filter((speed) => speed !== null);

    const totalDays = salesWithSpeed.reduce((sum, speed) => sum + speed, 0);
    const averageSaleSpeed = salesWithSpeed.length > 0 ? totalDays / salesWithSpeed.length : 0;

    return { totalProfit, totalRevenue, avgProfit, profitMargin, averageSaleSpeed };
  }, [filteredSales]);

  const comparison = React.useMemo(() => {
    if (range === "lifetime") return null;
    const days = RANGE_TO_DAYS[range];
    const now = new Date();
    const currentStart = subDays(now, days);
    const previousStart = subDays(currentStart, days);

    const inWindow = (sale, start, end) => {
      if (!sale.sale_date) return false;
      const date = parseISO(sale.sale_date);
      return date >= start && date < end;
    };

    const currentProfit = filteredSales.reduce((sum, sale) => sum + (sale.profit || 0), 0);
    const previousSales = sortedSales.filter((sale) => inWindow(sale, previousStart, currentStart));
    const previousProfit = previousSales.reduce((sum, sale) => sum + (sale.profit || 0), 0);

    const change = currentProfit - previousProfit;
    const changePct = previousProfit > 0 ? (change / previousProfit) * 100 : null;

    const currentAvg = filteredSales.length > 0 ? currentProfit / filteredSales.length : 0;
    const previousAvg = previousSales.length > 0 ? previousProfit / previousSales.length : 0;
    const avgChange = currentAvg - previousAvg;
    const avgChangePct = previousAvg > 0 ? (avgChange / previousAvg) * 100 : null;

    return {
      previousProfit,
      change,
      changePct,
      currentAvg,
      previousAvg,
      avgChange,
      avgChangePct,
    };
  }, [range, filteredSales, sales]);

  const insights = React.useMemo(() => {
    if (!hasData) {
      return {
        topPlatform: null,
        topCategory: null,
        highestProfitSale: null,
        fastestSale: null,
      };
    }

    const platformMap = filteredSales.reduce((acc, sale) => {
      const key = sale.platform || "other";
      if (!acc[key]) {
        acc[key] = {
          key,
          name: PLATFORM_DISPLAY_NAMES[key] || key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
          profit: 0,
          sales: 0,
        };
      }
      acc[key].profit += sale.profit || 0;
      acc[key].sales += 1;
      return acc;
    }, {});

    const categoryMap = filteredSales.reduce((acc, sale) => {
      const key = sale.category || "Uncategorized";
      if (!acc[key]) acc[key] = { profit: 0, sales: 0 };
      acc[key].profit += sale.profit || 0;
      acc[key].sales += 1;
      return acc;
    }, {});

    const topPlatform = Object.values(platformMap)
      .sort((a, b) => b.profit - a.profit)[0] || null;

    const topCategory = Object.entries(categoryMap)
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.profit - a.profit)[0] || null;

    const highestProfitSale = [...filteredSales].sort((a, b) => (b.profit || 0) - (a.profit || 0))[0] || null;

    const fastestSale = filteredSales
      .map((sale) => {
        if (!sale.sale_date || !sale.purchase_date) return null;
        try {
          const days = Math.max(0, differenceInDays(parseISO(sale.sale_date), parseISO(sale.purchase_date)));
          return { ...sale, days };
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .sort((a, b) => a.days - b.days)[0] || null;

    return { topPlatform, topCategory, highestProfitSale, fastestSale };
  }, [filteredSales, hasData]);

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
          <MonthlyPnlChart sales={filteredSales} rangeLabel={rangeLabel} />
          <InsightsPanel
            hasData={hasData}
            rangeLabel={rangeLabel}
            comparison={comparison}
            insights={insights}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CategoryPerformance sales={filteredSales} rangeLabel={rangeLabel} />
          <PlatformComparison sales={filteredSales} rangeLabel={rangeLabel} />
        </div>

        {/* Tax Summary Section */}
        <div className="mt-6">
          <TaxSummary sales={sortedSales} totalProfit={metrics.totalProfit} />
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
