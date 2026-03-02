import React from 'react';
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import {
  Percent, TrendingUp, TrendingDown, Timer, Sparkles, Trophy, Target, Activity,
  Download, Receipt, ChevronRight,
  Footprints, Home, Dumbbell, Monitor, Shirt, BookOpen, Gamepad2, Gem, Watch, Car,
  Camera, Headphones, Package, ShoppingBag, Palette, Utensils, ChevronDown,
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

const platformColors = {
  ebay: { bg: "bg-blue-500", text: "text-blue-500", light: "bg-blue-100 dark:bg-blue-900/30" },
  facebook_marketplace: { bg: "bg-sky-500", text: "text-sky-500", light: "bg-sky-100 dark:bg-sky-900/30" },
  mercari: { bg: "bg-red-500", text: "text-red-500", light: "bg-red-100 dark:bg-red-900/30" },
  etsy: { bg: "bg-orange-500", text: "text-orange-500", light: "bg-orange-100 dark:bg-orange-900/30" },
  offer_up: { bg: "bg-teal-500", text: "text-teal-500", light: "bg-teal-100 dark:bg-teal-900/30" },
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
 * V1: "Executive Dashboard" — Dark hero, all-new sections
 */
export default function ReportsV1({
  reportSummary, range, setRange, isLoading, hasData,
  metrics, comparison, insights, rangeLabel,
  onExportOpen, onAnalyticsPdfOpen,
  taxYear, setTaxYear,
}) {
  const navigate = useNavigate();
  const series = reportSummary?.series || [];
  const categories = reportSummary?.categories || [];
  const platforms = reportSummary?.platforms || [];
  const ytdProfit = reportSummary?.ytdProfit ?? 0;
  const estimatedTax = ytdProfit * 0.275;
  const thisYear = new Date().getFullYear();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background">
      {/* Dark Hero Banner */}
      <div className="relative overflow-hidden bg-slate-900 px-4 py-12 md:px-8 md:py-16">
        <div className="relative max-w-7xl mx-auto">
          {/* Header row */}
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6 mb-10">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">Reports & Insights</h1>
              <p className="text-indigo-200/70 mt-2 max-w-xl text-sm">
                Your business at a glance. Switch ranges to explore profitability trends.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {RANGE_OPTIONS.map((opt) => {
                const active = opt.value === range;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setRange(opt.value)}
                    className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
                      active
                        ? "bg-white/15 text-white border border-white/30 shadow-lg shadow-indigo-500/20 backdrop-blur-sm"
                        : "text-indigo-200/60 hover:text-white hover:bg-white/5 border border-transparent"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
              <Button
                size="sm"
                variant="outline"
                className="gap-2 ml-1 border-white/20 text-white hover:bg-white/10 bg-transparent"
                onClick={onAnalyticsPdfOpen}
              >
                <Download className="w-4 h-4" />
                Export PDF
              </Button>
            </div>
          </div>

          {/* Hero Profit Number */}
          <div className="text-center mb-10">
            <p className="text-indigo-300/60 text-sm font-medium uppercase tracking-widest mb-2">Total Profit</p>
            <p className="text-5xl md:text-7xl font-black text-white tracking-tight">
              {currency(metrics.totalProfit)}
            </p>
            {comparison && (
              <div className="flex items-center justify-center gap-2 mt-3">
                {comparison.change >= 0 ? (
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-rose-400" />
                )}
                <span className={`text-sm font-medium ${comparison.change >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {comparison.change >= 0 ? "+" : ""}{currency(comparison.change)}
                  {comparison.changePct !== null && ` (${comparison.changePct >= 0 ? "+" : ""}${comparison.changePct.toFixed(1)}%)`}
                </span>
                <span className="text-indigo-300/50 text-sm">vs prior period</span>
              </div>
            )}
          </div>

          {/* Glass KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            {[
              { label: "Profit Margin", value: `${metrics.profitMargin.toFixed(1)}%`, icon: Percent, accent: "text-violet-300" },
              { label: "Avg Profit / Sale", value: `$${metrics.avgProfit.toFixed(2)}`, icon: TrendingUp, accent: "text-sky-300" },
              { label: "Avg Days to Sell", value: `${metrics.averageSaleSpeed.toFixed(1)}d`, icon: Timer, accent: "text-emerald-300" },
              { label: "Total Revenue", value: currency(metrics.totalRevenue), icon: Sparkles, accent: "text-amber-300" },
            ].map((kpi) => {
              const Icon = kpi.icon;
              return (
                <div key={kpi.label} className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-5 md:p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Icon className={`w-4 h-4 ${kpi.accent}`} />
                    <span className="text-xs font-medium text-indigo-200/60 uppercase tracking-wide">{kpi.label}</span>
                  </div>
                  <p className="text-2xl md:text-3xl font-bold text-white">{kpi.value}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content below hero */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 mt-6 space-y-6 pb-12">

        {/* Profit Trend Chart */}
        <div className="rounded-2xl bg-card border border-border/40 shadow-lg p-5 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Profit Trend</h2>
              <p className="text-xs text-muted-foreground">Monthly revenue and profit</p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />Profit</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-400" />Revenue</span>
            </div>
          </div>
          {series.length > 0 ? (
            <div className="h-72 md:h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 6" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                    axisLine={false} tickLine={false}
                    tickFormatter={(v) => { try { return format(parseISO(v + '-01'), 'MMM'); } catch { return v; } }}
                  />
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
                    formatter={(v) => currencyFull(v)}
                    labelFormatter={(v) => { try { return format(parseISO(v + '-01'), 'MMM yyyy'); } catch { return v; } }}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#60a5fa" strokeWidth={1.5} fill="#60a5fa" fillOpacity={0.1} />
                  <Area type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={2.5} fill="#10b981" fillOpacity={0.15} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-72 flex items-center justify-center text-sm text-muted-foreground">
              Not enough sales data to render the chart.
            </div>
          )}
        </div>

        {/* Insights row */}
        {hasData && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {insights.topPlatform && (
              <GlassInsight icon={Target} title="Top Platform" primary={insights.topPlatform.name} secondary={`${currency(insights.topPlatform.profit)} profit`} />
            )}
            {insights.topCategory && (
              <GlassInsight icon={Sparkles} title="Top Category" primary={insights.topCategory.name} secondary={`${currency(insights.topCategory.profit)} profit`} />
            )}
            {insights.highestProfitSale && (
              <GlassInsight icon={Trophy} title="Biggest Flip" primary={insights.highestProfitSale.item_name || "Unnamed"} secondary={`${currency(insights.highestProfitSale.profit)} profit`} />
            )}
            {insights.fastestSale && (
              <GlassInsight icon={Timer} title="Fastest Sale" primary={`${insights.fastestSale.days} days`} secondary={insights.fastestSale.item_name || ""} />
            )}
          </div>
        )}

        {/* Categories + Platforms */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-2xl bg-card border border-border/40 shadow-sm p-5 md:p-6">
            <h2 className="text-lg font-semibold text-foreground mb-1">Top Categories</h2>
            <p className="text-xs text-muted-foreground mb-5">Profit share across categories</p>
            {categories.length > 0 ? (
              <div className="space-y-3">
                {categories.slice(0, 6).map((cat, i) => {
                  const colors = ["bg-emerald-500", "bg-blue-500", "bg-violet-500", "bg-amber-500", "bg-rose-500", "bg-cyan-500"];
                  const CatIcon = getCategoryIcon(cat.name);
                  return (
                    <button
                      key={cat.name}
                      onClick={() => navigate(createPageUrl(`Inventory?category=${encodeURIComponent(cat.name)}`))}
                      className="flex items-center gap-3 w-full text-left rounded-lg p-2 -mx-2 hover:bg-muted/50 transition-colors group cursor-pointer"
                    >
                      <div className={`w-8 h-8 rounded-lg ${colors[i % colors.length]} bg-opacity-15 flex items-center justify-center flex-shrink-0`}>
                        <CatIcon className="w-4 h-4 text-foreground/70" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between">
                          <span className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">{cat.name}</span>
                          <span className="text-sm font-bold text-emerald-500 ml-2">{currency(cat.profit)}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <div className="flex-1 h-1.5 rounded-full bg-muted/50 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${colors[i % colors.length]} transition-all duration-700`}
                              style={{ width: `${Math.max(cat.percentage || 0, 3)}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-muted-foreground w-10 text-right">{(cat.percentage || 0).toFixed(0)}%</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{cat.sales} sales &middot; {currency(cat.revenue)} rev</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary transition-colors flex-shrink-0" />
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">No category data yet.</p>
            )}
          </div>

          {/* Platforms */}
          <div className="rounded-2xl bg-card border border-border/40 shadow-sm p-5 md:p-6">
            <h2 className="text-lg font-semibold text-foreground mb-1">Platform Performance</h2>
            <p className="text-xs text-muted-foreground mb-5">Revenue and profit by marketplace</p>
            {platforms.length > 0 ? (
              <div className="space-y-3">
                {platforms.map((p) => {
                  const name = platformNames[p.platformKey] || p.platformKey;
                  const color = platformColors[p.platformKey] || platformColors.ebay;
                  const logo = platformIcons[p.platformKey];
                  const totalProfit = platforms.reduce((s, pl) => s + (pl.profit || 0), 0);
                  const share = totalProfit > 0 ? ((p.profit || 0) / totalProfit * 100) : 0;
                  return (
                    <div key={p.platformKey} className="rounded-xl border border-border/50 p-4 hover:border-primary/30 transition">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2.5">
                          {logo ? (
                            <img src={logo} alt={name} className="w-7 h-7 object-contain flex-shrink-0" />
                          ) : (
                            <div className={`w-2 h-8 rounded-full ${color.bg}`} />
                          )}
                          <div>
                            <p className="text-sm font-semibold text-foreground">{name}</p>
                            <p className="text-[10px] text-muted-foreground">{p.sales} sales &middot; {(p.profitMargin || 0).toFixed(1)}% margin</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-base font-bold text-emerald-500">{currency(p.profit)}</p>
                          <p className="text-[10px] text-muted-foreground">{share.toFixed(0)}% of total</p>
                        </div>
                      </div>
                      <div className="h-1 rounded-full bg-muted/40 overflow-hidden">
                        <div className={`h-full rounded-full ${color.bg} transition-all duration-700`} style={{ width: `${Math.max(share, 3)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">No platform data yet.</p>
            )}
          </div>
        </div>

        {/* Tax Summary */}
        <div className="rounded-2xl border border-border/40 bg-emerald-50 dark:bg-emerald-950/20 shadow-sm p-5 md:p-6">
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
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">{taxYear === thisYear ? "YTD" : taxYear} Profit</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{currencyFull(ytdProfit)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Est. Tax (~27.5%)</p>
              <p className="text-2xl font-bold text-foreground">{currencyFull(estimatedTax)}</p>
            </div>
            <div className="col-span-2 md:col-span-1 flex items-end">
              <p className="text-[10px] text-muted-foreground leading-tight">
                *Rough estimate only. Consult a tax professional for accurate calculations.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function GlassInsight({ icon: Icon, title, primary, secondary }) {
  return (
    <div className="rounded-xl border border-border/50 bg-card/80 backdrop-blur-sm p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2 mb-2">
        <div className="rounded-full bg-indigo-500/10 p-2">
          <Icon className="w-4 h-4 text-indigo-500" />
        </div>
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</span>
      </div>
      <p className="text-sm font-semibold text-foreground truncate">{primary}</p>
      {secondary && <p className="text-xs text-muted-foreground mt-0.5 truncate">{secondary}</p>}
    </div>
  );
}
