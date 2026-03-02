import React from 'react';
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine,
} from 'recharts';
import {
  TrendingUp, TrendingDown, Download, Receipt, ChevronRight,
  Footprints, Home, Dumbbell, Monitor, Shirt, Sparkles, BookOpen, Gamepad2, Gem, Watch, Car,
  Camera, Headphones, Package, ShoppingBag, Palette, Utensils,
} from "lucide-react";
import { parseISO, format } from "date-fns";

const currency = (v) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v || 0);

const currencyFull = (v) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(v || 0);

const RANGE_OPTIONS = [
  { label: "90 Days", value: "90d" },
  { label: "180 Days", value: "180d" },
  { label: "12 Months", value: "365d" },
  { label: "All Time", value: "lifetime" },
];

const platformNames = {
  ebay: "eBay", facebook_marketplace: "Facebook", etsy: "Etsy", mercari: "Mercari", offer_up: "OfferUp",
};

const platformIcons = {
  ebay: "https://upload.wikimedia.org/wikipedia/commons/1/1b/EBay_logo.svg",
  facebook_marketplace: "https://upload.wikimedia.org/wikipedia/commons/b/b9/2023_Facebook_icon.svg",
  mercari: "https://cdn.brandfetch.io/idjAt9LfED/w/400/h/400/theme/dark/icon.jpeg?c=1dxbfHSJFAPEGdCLU4o5B",
  etsy: "https://cdn.brandfetch.io/idzyTAzn6G/theme/dark/logo.svg?c=1dxbfHSJFAPEGdCLU4o5B",
  offer_up: "https://cdn.brandfetch.io/id5p1Knwlt/theme/dark/symbol.svg?c=1dxbfHSJFAPEGdCLU4o5B",
};

const CATEGORY_ICONS = {
  shoes: Footprints, sneakers: Footprints, footwear: Footprints,
  home: Home, furniture: Home, decor: Home, household: Home,
  sports: Dumbbell, fitness: Dumbbell, outdoor: Dumbbell,
  electronics: Monitor, tech: Monitor, computer: Monitor, phone: Monitor,
  clothing: Shirt, clothes: Shirt, apparel: Shirt, fashion: Shirt,
  anime: Sparkles, collectibles: Sparkles, misc: Sparkles,
  books: BookOpen, reading: BookOpen,
  toys: Gamepad2, games: Gamepad2, gaming: Gamepad2,
  jewelry: Gem,
  accessories: Watch, watches: Watch,
  automotive: Car, auto: Car,
  camera: Camera, photography: Camera,
  audio: Headphones, music: Headphones,
  art: Palette, crafts: Palette,
  kitchen: Utensils, food: Utensils,
  bags: ShoppingBag, handbags: ShoppingBag, purses: ShoppingBag,
};

function getCategoryIcon(name) {
  const lower = (name || "").toLowerCase();
  for (const [key, Icon] of Object.entries(CATEGORY_ICONS)) {
    if (lower.includes(key)) return Icon;
  }
  return Package;
}

/**
 * V3: "Scrollable Narrative" — Single column, editorial style, all new sections
 */
export default function ReportsV3({
  reportSummary, range, setRange, isLoading, hasData,
  metrics, comparison, insights, rangeLabel,
  onExportOpen, onAnalyticsPdfOpen,
  taxYear, setTaxYear,
}) {
  const descriptor = rangeLabel === "lifetime" ? "all time" : `the last ${rangeLabel}`;
  const navigate = useNavigate();
  const series = reportSummary?.series || [];
  const categories = reportSummary?.categories || [];
  const platforms = reportSummary?.platforms || [];
  const ytdProfit = reportSummary?.ytdProfit ?? 0;
  const estimatedTax = ytdProfit * 0.275;
  const thisYear = new Date().getFullYear();

  const chartData = series.map((s) => ({
    ...s,
    label: (() => { try { return format(parseISO(s.month + '-01'), 'MMM yy'); } catch { return s.month; } })(),
  }));

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background">
      <div className="max-w-3xl mx-auto px-4 md:px-6 py-8 md:py-12">

        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground tracking-tight leading-tight">
            Your Business Report
          </h1>
          <p className="text-muted-foreground mt-3 text-lg">
            A summary of your reselling performance across {descriptor}.
          </p>

          <div className="flex items-center gap-1 mt-6 border-b border-border">
            {RANGE_OPTIONS.map((opt) => {
              const active = opt.value === range;
              return (
                <button
                  key={opt.value}
                  onClick={() => setRange(opt.value)}
                  className={`px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px ${
                    active
                      ? "border-foreground text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
            <div className="flex-1" />
            <Button size="sm" variant="ghost" className="gap-2 mb-1" onClick={onAnalyticsPdfOpen}>
              <Download className="w-4 h-4" /> Export
            </Button>
          </div>
        </div>

        {/* Hero Profit Number */}
        <section className="mb-16 text-center">
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-widest mb-3">Total Profit</p>
          <p className="text-6xl md:text-8xl font-black text-foreground tracking-tighter leading-none">
            {currency(metrics.totalProfit)}
          </p>
          {comparison && (
            <div className="flex items-center justify-center gap-3 mt-4">
              <span className={`inline-flex items-center gap-1 text-base font-semibold ${
                comparison.change >= 0 ? "text-emerald-500" : "text-rose-500"
              }`}>
                {comparison.change >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                {comparison.change >= 0 ? "+" : ""}{currency(comparison.change)}
              </span>
              <span className="text-muted-foreground">compared to prior period</span>
            </div>
          )}

          <div className="flex justify-center gap-8 md:gap-12 mt-8 text-center">
            <div>
              <p className="text-2xl font-bold text-foreground">{metrics.profitMargin.toFixed(1)}%</p>
              <p className="text-xs text-muted-foreground mt-1">Profit Margin</p>
            </div>
            <div className="w-px bg-border" />
            <div>
              <p className="text-2xl font-bold text-foreground">${metrics.avgProfit.toFixed(0)}</p>
              <p className="text-xs text-muted-foreground mt-1">Avg per Sale</p>
            </div>
            <div className="w-px bg-border" />
            <div>
              <p className="text-2xl font-bold text-foreground">{metrics.averageSaleSpeed.toFixed(0)}d</p>
              <p className="text-xs text-muted-foreground mt-1">Avg Days to Sell</p>
            </div>
          </div>
        </section>

        <hr className="border-border mb-12" />

        {/* Profit Trend */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-foreground mb-2">Profit Trend</h2>
          <p className="text-muted-foreground text-sm mb-6">Monthly profit with zero reference line.</p>
          {chartData.length > 0 ? (
            <div className="h-64 md:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 10, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 6" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                    axisLine={false} tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                    axisLine={false} tickLine={false}
                    tickFormatter={(v) => `$${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`}
                    width={50}
                  />
                  <ReferenceLine y={0} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--popover))", color: "hsl(var(--foreground))",
                      border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12,
                    }}
                    formatter={(v) => [currencyFull(v), "Profit"]}
                  />
                  <Line
                    type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={2.5}
                    dot={{ r: 4, fill: "#10b981", stroke: "hsl(var(--background))", strokeWidth: 2 }}
                    activeDot={{ r: 6, fill: "#10b981" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-sm text-muted-foreground rounded-xl border border-border/50">
              Not enough data yet.
            </div>
          )}

          {/* Mini month summaries */}
          {chartData.length > 0 && (
            <div className="flex gap-3 mt-4 overflow-x-auto pb-1">
              {chartData.slice(-4).map((d) => (
                <div key={d.label} className="flex-shrink-0 rounded-lg border border-border/50 px-3 py-2 text-center min-w-[80px]">
                  <p className="text-[10px] text-muted-foreground">{d.label}</p>
                  <p className={`text-sm font-bold ${d.profit >= 0 ? "text-emerald-500" : "text-rose-500"}`}>{currency(d.profit)}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Categories */}
        {categories.length > 0 && (
          <>
            <hr className="border-border mb-12" />
            <section className="mb-16">
              <h2 className="text-2xl font-bold text-foreground mb-2">Top Categories</h2>
              <p className="text-muted-foreground text-sm mb-6">Where your profit comes from.</p>
              <div className="space-y-4">
                {categories.slice(0, 6).map((cat) => {
                  const CatIcon = getCategoryIcon(cat.name);
                  return (
                    <button
                      key={cat.name}
                      onClick={() => navigate(createPageUrl(`Inventory?category=${encodeURIComponent(cat.name)}`))}
                      className="block w-full text-left rounded-lg p-3 -mx-3 hover:bg-muted/50 transition-colors group cursor-pointer"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="flex items-center gap-2 text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                          <CatIcon className="w-4 h-4 text-muted-foreground" />
                          {cat.name}
                        </span>
                        <div className="flex items-center gap-1.5 ml-2">
                          <span className="text-sm font-semibold text-emerald-500">{currency(cat.profit)}</span>
                          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                        </div>
                      </div>
                      <div className="relative h-3 rounded-full bg-muted/50 overflow-hidden">
                        <div
                          className="absolute inset-y-0 left-0 rounded-full bg-emerald-500 transition-all duration-500"
                          style={{ width: `${Math.max(cat.percentage || 0, 2)}%` }}
                        />
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-muted-foreground">{cat.sales} sales</span>
                        <span className="text-xs text-muted-foreground">{currency(cat.revenue)} revenue</span>
                        <span className="text-xs text-muted-foreground">{(cat.percentage || 0).toFixed(0)}% of profit</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          </>
        )}

        {/* Platforms */}
        {platforms.length > 0 && (
          <>
            <hr className="border-border mb-12" />
            <section className="mb-16">
              <h2 className="text-2xl font-bold text-foreground mb-2">Platform Rankings</h2>
              <p className="text-muted-foreground text-sm mb-6">Performance across your selling channels.</p>
              <div className="space-y-4">
                {platforms.map((p, i) => {
                  const name = platformNames[p.platformKey] || p.platformKey;
                  const logo = platformIcons[p.platformKey];
                  return (
                    <div
                      key={p.platformKey}
                      className="flex items-center gap-4 rounded-xl border border-border/60 p-4 hover:border-primary/30 transition"
                    >
                      <span className={`text-2xl font-black ${
                        i === 0 ? "text-amber-500" : i === 1 ? "text-gray-400" : i === 2 ? "text-amber-700" : "text-muted-foreground/40"
                      }`}>
                        #{i + 1}
                      </span>
                      {logo ? (
                        <img src={logo} alt={name} className="w-7 h-7 object-contain flex-shrink-0" />
                      ) : (
                        <span className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                          {(name || "?")[0]}
                        </span>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-base font-semibold text-foreground">{name}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.sales} sales &middot; {currency(p.revenue)} revenue &middot; {(p.profitMargin || 0).toFixed(1)}% margin
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-emerald-500">{currency(p.profit)}</p>
                        <p className="text-xs text-muted-foreground">profit</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}

        {/* Insights */}
        {hasData && (
          <>
            <hr className="border-border mb-12" />
            <section className="mb-16">
              <h2 className="text-2xl font-bold text-foreground mb-6">Notable Highlights</h2>
              <div className="space-y-4">
                {insights.highestProfitSale && (
                  <Callout
                    accent="border-l-emerald-500"
                    title="Biggest Flip"
                    value={`${insights.highestProfitSale.item_name || "Unnamed"} — ${currency(insights.highestProfitSale.profit)} profit`}
                    sub={insights.highestProfitSale.sale_date
                      ? `Sold ${format(parseISO(insights.highestProfitSale.sale_date), "MMM d, yyyy")}`
                      : null}
                  />
                )}
                {insights.fastestSale && (
                  <Callout
                    accent="border-l-sky-500"
                    title="Fastest Turnaround"
                    value={`${insights.fastestSale.days} days — ${insights.fastestSale.item_name || ""}`}
                  />
                )}
                {insights.topPlatform && (
                  <Callout
                    accent="border-l-violet-500"
                    title="Top Platform"
                    value={`${insights.topPlatform.name} with ${currency(insights.topPlatform.profit)} profit from ${insights.topPlatform.sales} sales`}
                  />
                )}
              </div>
            </section>
          </>
        )}

        {/* Tax */}
        <hr className="border-border mb-12" />
        <section className="mb-12">
          <div className="rounded-xl border-l-4 border-l-emerald-500 bg-emerald-50 dark:bg-emerald-950/15 p-5 md:p-6">
            <div className="flex items-center gap-2 mb-4">
              <Receipt className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-lg font-semibold text-foreground">Tax Estimate</h2>
              <select
                value={taxYear}
                onChange={(e) => setTaxYear(Number(e.target.value))}
                className="ml-2 bg-transparent border border-border/50 rounded-lg px-2 py-1 text-sm font-semibold text-foreground cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              >
                {[thisYear, thisYear - 1, thisYear - 2, thisYear - 3].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-8">
              <div>
                <p className="text-xs text-muted-foreground mb-1">{taxYear === thisYear ? "YTD" : taxYear} Profit</p>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{currencyFull(ytdProfit)}</p>
              </div>
              <div className="w-px h-10 bg-border" />
              <div>
                <p className="text-xs text-muted-foreground mb-1">Est. Tax (~27.5%)</p>
                <p className="text-2xl font-bold text-foreground">{currencyFull(estimatedTax)}</p>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground mt-3">*Rough estimate. Consult a tax professional for accurate calculations.</p>
          </div>
        </section>
      </div>
    </div>
  );
}

function Callout({ accent, title, value, sub }) {
  return (
    <div className={`border-l-4 ${accent} rounded-r-lg bg-card/80 p-4 pl-5`}>
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">{title}</p>
      <p className="text-sm font-semibold text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}
