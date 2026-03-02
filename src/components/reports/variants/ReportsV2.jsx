import React from 'react';
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
} from 'recharts';
import {
  Percent, TrendingUp, TrendingDown, Timer, Sparkles, Trophy, Target, Activity,
  Download, Receipt, ChevronRight,
  Footprints, Home, Dumbbell, Monitor, Shirt, BookOpen, Gamepad2, Gem, Watch, Car,
  Camera, Headphones, Package, ShoppingBag, Palette, Utensils,
} from "lucide-react";
import { parseISO, format } from "date-fns";

const currency = (v) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v || 0);

const currencyFull = (v) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(v || 0);

const RANGE_OPTIONS = [
  { label: "90D", value: "90d" },
  { label: "180D", value: "180d" },
  { label: "12M", value: "365d" },
  { label: "All", value: "lifetime" },
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
 * V2: "Bento Grid" — Modern mosaic with all-new inline sections
 */
export default function ReportsV2({
  reportSummary, range, setRange, isLoading, hasData,
  metrics, comparison, insights, rangeLabel,
  onExportOpen, onAnalyticsPdfOpen,
  taxYear, setTaxYear,
}) {
  const navigate = useNavigate();
  const descriptor = rangeLabel === "lifetime" ? "your lifetime data" : `the last ${rangeLabel}`;
  const series = reportSummary?.series || [];
  const categories = reportSummary?.categories || [];
  const platforms = reportSummary?.platforms || [];
  const ytdProfit = reportSummary?.ytdProfit ?? 0;
  const estimatedTax = ytdProfit * 0.275;
  const thisYear = new Date().getFullYear();

  const chartData = series.map((s) => ({
    ...s,
    label: (() => { try { return format(parseISO(s.month + '-01'), 'MMM'); } catch { return s.month; } })(),
  }));

  return (
    <div className="p-4 md:p-6 lg:p-8 min-h-screen bg-gray-50 dark:bg-background">
      <div className="max-w-7xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground tracking-tight">Reports & Insights</h1>
            <p className="text-muted-foreground mt-1 text-sm">Performance overview for {descriptor}.</p>
          </div>
          <div className="flex items-center gap-1">
            <div className="inline-flex rounded-xl bg-muted/60 p-1 border border-border/50">
              {RANGE_OPTIONS.map((opt) => {
                const active = opt.value === range;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setRange(opt.value)}
                    className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-all ${
                      active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <Button size="sm" variant="outline" className="gap-2 ml-2" onClick={onAnalyticsPdfOpen}>
              <Download className="w-4 h-4" />
              PDF
            </Button>
          </div>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 auto-rows-min">

          {/* Profit — spans 2 cols */}
          <BentoCard className="col-span-2 bg-violet-50 dark:bg-violet-950/20 border-violet-200/50 dark:border-violet-800/30">
            <p className="text-xs font-medium uppercase tracking-widest text-violet-500 dark:text-violet-400 mb-1">Profit This Period</p>
            <p className="text-5xl md:text-6xl font-black text-foreground tracking-tight leading-none">
              {currency(metrics.totalProfit)}
            </p>
            {comparison && (
              <div className="flex items-center gap-2 mt-3">
                {comparison.change >= 0 ? (
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-rose-500" />
                )}
                <span className={`text-sm font-semibold ${comparison.change >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                  {comparison.change >= 0 ? "+" : ""}{currency(comparison.change)}
                  {comparison.changePct !== null && ` (${comparison.changePct >= 0 ? "+" : ""}${comparison.changePct.toFixed(1)}%)`}
                </span>
              </div>
            )}
          </BentoCard>

          {/* Margin */}
          <BentoCard className="bg-orange-50 dark:bg-orange-950/20 border-orange-200/50 dark:border-orange-800/30">
            <div className="flex items-center gap-2 mb-2">
              <Percent className="w-4 h-4 text-orange-500" />
              <span className="text-xs font-medium uppercase tracking-wide text-orange-600 dark:text-orange-400">Margin</span>
            </div>
            <p className="text-4xl font-black text-foreground">{metrics.profitMargin.toFixed(1)}%</p>
          </BentoCard>

          {/* Speed */}
          <BentoCard className="bg-teal-50 dark:bg-teal-950/20 border-teal-200/50 dark:border-teal-800/30">
            <div className="flex items-center gap-2 mb-2">
              <Timer className="w-4 h-4 text-teal-500" />
              <span className="text-xs font-medium uppercase tracking-wide text-teal-600 dark:text-teal-400">Avg Days</span>
            </div>
            <p className="text-4xl font-black text-foreground">{metrics.averageSaleSpeed.toFixed(1)}d</p>
          </BentoCard>

          {/* Chart — Bar chart, spans 3 cols */}
          <BentoCard className="col-span-2 lg:col-span-3 lg:row-span-2">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-base font-semibold text-foreground">Monthly Profit</h3>
                <p className="text-xs text-muted-foreground">Green = positive, Red = negative</p>
              </div>
            </div>
            {chartData.length > 0 ? (
              <div className="h-64 md:h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 6" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                      axisLine={false} tickLine={false}
                      tickFormatter={(v) => `$${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`}
                      width={50}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--popover))", color: "hsl(var(--foreground))",
                        border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12,
                      }}
                      formatter={(v, name) => [currencyFull(v), name === 'profit' ? 'Profit' : name]}
                      labelFormatter={(v) => v}
                    />
                    <Bar dataKey="profit" radius={[6, 6, 0, 0]} maxBarSize={40}>
                      {chartData.map((entry, i) => (
                        <Cell key={i} fill={entry.profit >= 0 ? "#10b981" : "#f43f5e"} fillOpacity={0.85} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
                Not enough data for the chart.
              </div>
            )}
          </BentoCard>

          {/* Insights — 1 col, 2 rows tall */}
          <BentoCard className="col-span-2 lg:col-span-1 lg:row-span-2 flex flex-col gap-4">
            <p className="text-sm font-semibold text-foreground">Quick Insights</p>
            {!hasData ? (
              <p className="text-sm text-muted-foreground py-4">Add sales to see insights.</p>
            ) : (
              <div className="space-y-3 flex-1">
                {insights.topPlatform && (
                  <MiniInsight icon={Target} label="Top Platform" value={insights.topPlatform.name} sub={`${currency(insights.topPlatform.profit)} profit`} />
                )}
                {insights.topCategory && (
                  <MiniInsight icon={Sparkles} label="Top Category" value={insights.topCategory.name} sub={`${insights.topCategory.sales} sales`} />
                )}
                {insights.highestProfitSale && (
                  <MiniInsight icon={Trophy} label="Best Flip" value={insights.highestProfitSale.item_name || "—"} sub={`${currency(insights.highestProfitSale.profit)}`} />
                )}
                {insights.fastestSale && (
                  <MiniInsight icon={Timer} label="Fastest" value={`${insights.fastestSale.days}d`} sub={insights.fastestSale.item_name || ""} />
                )}
                {comparison && (
                  <MiniInsight
                    icon={Activity}
                    label="Momentum"
                    value={`${comparison.changePct >= 0 ? "+" : ""}${comparison.changePct?.toFixed(1) ?? 0}%`}
                    sub="vs prior period"
                  />
                )}
              </div>
            )}
          </BentoCard>

          {/* Categories */}
          <BentoCard className="col-span-2">
            <h3 className="text-base font-semibold text-foreground mb-1">Top Categories</h3>
            <p className="text-xs text-muted-foreground mb-4">Profit share across product types</p>
            {categories.length > 0 ? (
              <div className="space-y-2.5">
                {categories.slice(0, 6).map((cat, i) => {
                  const hues = ["bg-emerald-500", "bg-blue-500", "bg-violet-500", "bg-amber-500", "bg-rose-500", "bg-cyan-500"];
                  const CatIcon = getCategoryIcon(cat.name);
                  return (
                    <button
                      key={cat.name}
                      onClick={() => navigate(createPageUrl(`Inventory?category=${encodeURIComponent(cat.name)}`))}
                      className="flex items-center gap-3 w-full text-left rounded-lg p-2 -mx-2 hover:bg-muted/50 transition-colors group cursor-pointer"
                    >
                      <div className={`w-8 h-8 rounded-lg ${hues[i % hues.length]} bg-opacity-15 flex items-center justify-center flex-shrink-0`}>
                        <CatIcon className="w-4 h-4 text-foreground/70" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between">
                          <span className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">{cat.name}</span>
                          <span className="text-sm font-bold text-emerald-500 ml-2 flex-shrink-0">{currency(cat.profit)}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <div className="flex-1 h-1 rounded-full bg-muted/40 overflow-hidden">
                            <div className={`h-full rounded-full ${hues[i % hues.length]} transition-all duration-700`} style={{ width: `${Math.max(cat.percentage || 0, 3)}%` }} />
                          </div>
                          <span className="text-[10px] text-muted-foreground flex-shrink-0">{cat.sales} sales</span>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary transition-colors flex-shrink-0" />
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-6 text-center">No category data.</p>
            )}
          </BentoCard>

          {/* Platforms */}
          <BentoCard className="col-span-2">
            <h3 className="text-base font-semibold text-foreground mb-1">Platforms</h3>
            <p className="text-xs text-muted-foreground mb-4">Performance by marketplace</p>
            {platforms.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {platforms.map((p) => {
                  const name = platformNames[p.platformKey] || p.platformKey;
                  const logo = platformIcons[p.platformKey];
                  return (
                    <div key={p.platformKey} className="rounded-xl border border-border/50 p-4 hover:border-primary/30 transition flex items-center gap-3">
                      {logo ? (
                        <img src={logo} alt={name} className="w-8 h-8 object-contain flex-shrink-0" />
                      ) : (
                        <span className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                          {(name || "?")[0]}
                        </span>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">{name}</p>
                        <p className="text-[10px] text-muted-foreground">{p.sales} sales &middot; {(p.profitMargin || 0).toFixed(1)}% margin</p>
                      </div>
                      <div className="text-right">
                        <p className="text-base font-bold text-emerald-500">{currency(p.profit)}</p>
                        <p className="text-[10px] text-muted-foreground">{currency(p.revenue)} rev</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-6 text-center">No platform data.</p>
            )}
          </BentoCard>

          {/* Tax */}
          <BentoCard className="col-span-2 lg:col-span-4 bg-emerald-50 dark:bg-emerald-950/15 border-emerald-200/40 dark:border-emerald-800/20">
            <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-8">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-base font-semibold text-foreground">Tax Estimate</h3>
                <select
                  value={taxYear}
                  onChange={(e) => setTaxYear(Number(e.target.value))}
                  className="ml-1 bg-transparent border border-border/50 rounded-lg px-2 py-1 text-sm font-semibold text-foreground cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                >
                  {[thisYear, thisYear - 1, thisYear - 2, thisYear - 3].map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-6">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{taxYear === thisYear ? "YTD" : taxYear} Profit</p>
                  <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{currencyFull(ytdProfit)}</p>
                </div>
                <div className="w-px h-8 bg-border" />
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Est. Tax (~27.5%)</p>
                  <p className="text-xl font-bold text-foreground">{currencyFull(estimatedTax)}</p>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground md:ml-auto">*Rough estimate. Consult a tax professional.</p>
            </div>
          </BentoCard>
        </div>
      </div>
    </div>
  );
}

function BentoCard({ children, className = "" }) {
  return (
    <div className={`rounded-3xl border border-border/60 bg-card p-6 md:p-8 shadow-sm hover:shadow-md transition-shadow ${className}`}>
      {children}
    </div>
  );
}

function MiniInsight({ icon: Icon, label, value, sub }) {
  return (
    <div className="flex items-start gap-3">
      <div className="rounded-lg bg-primary/10 p-1.5 mt-0.5">
        <Icon className="w-3.5 h-3.5 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold text-foreground truncate">{value}</p>
        {sub && <p className="text-xs text-muted-foreground truncate">{sub}</p>}
      </div>
    </div>
  );
}
