import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import {
  Plus, Package, CalendarDays, Layers, BarChart3,
  AlarmClock, Lightbulb, ArrowRight, TrendingUp, Eye, ExternalLink, X,
} from 'lucide-react';
import { supabase } from '@/api/supabaseClient';
import { Button } from '@/components/ui/button';
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  ResponsiveContainer, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip,
} from 'recharts';
import { format, parseISO, subDays, isAfter, isBefore, differenceInDays } from 'date-fns';
import RecentSales from '../RecentSales';

// ─── V3: "Command Center" — Bloomberg/Grafana inspired ─────────────────────
// Data-dense, tight spacing, dark-friendly. Every pixel counts.

// ─── Chart data builder (from ProfitTrendCard) ─────────────────────────────

function buildSeries(sales, range, customRange) {
  const s = Array.isArray(sales) ? sales : [];
  const points = {};

  if (range === '14d') {
    const cutoff = subDays(new Date(), 13);
    s.forEach((x) => {
      if (!x?.sale_date) return;
      try {
        const d = parseISO(String(x.sale_date));
        if (isBefore(d, cutoff)) return;
        const k = format(d, 'yyyy-MM-dd');
        points[k] = (points[k] || 0) + (Number(x.profit ?? 0) || 0);
      } catch (_) {}
    });
    return Object.keys(points).sort().map((k) => ({ k, date: format(parseISO(k), 'MMM dd'), v: points[k] }));
  }

  if (range === 'monthly') {
    s.forEach((x) => {
      if (!x?.sale_date) return;
      try {
        const d = parseISO(String(x.sale_date));
        const k = format(d, 'yyyy-MM');
        points[k] = (points[k] || 0) + (Number(x.profit ?? 0) || 0);
      } catch (_) {}
    });
    return Object.keys(points).sort().slice(-12).map((k) => ({ k, date: format(parseISO(`${k}-01`), 'MMM yy'), v: points[k] }));
  }

  if (range === 'custom') {
    const from = customRange?.from || null;
    const to = customRange?.to || null;
    if (!from || !to) return [];
    s.forEach((x) => {
      if (!x?.sale_date) return;
      try {
        const d = parseISO(String(x.sale_date));
        if (isBefore(d, from) || isAfter(d, to)) return;
        const k = format(d, 'yyyy-MM-dd');
        points[k] = (points[k] || 0) + (Number(x.profit ?? 0) || 0);
      } catch (_) {}
    });
    return Object.keys(points).sort().map((k) => ({ k, date: format(parseISO(k), 'MMM dd'), v: points[k] }));
  }

  // yearly
  s.forEach((x) => {
    if (!x?.sale_date) return;
    try {
      const d = parseISO(String(x.sale_date));
      const k = format(d, 'yyyy');
      points[k] = (points[k] || 0) + (Number(x.profit ?? 0) || 0);
    } catch (_) {}
  });
  return Object.keys(points).sort().slice(-6).map((k) => ({ k, date: k, v: points[k] }));
}

// ─── Platform helpers (from PlatformRevenueTableCard) ───────────────────────

const PLATFORM_META = {
  ebay: { name: 'eBay', icon: 'https://upload.wikimedia.org/wikipedia/commons/1/1b/EBay_logo.svg' },
  mercari: { name: 'Mercari', icon: 'https://cdn.brandfetch.io/idjAt9LfED/w/400/h/400/theme/dark/icon.jpeg?c=1dxbfHSJFAPEGdCLU4o5B' },
  facebook_marketplace: { name: 'Facebook', icon: 'https://upload.wikimedia.org/wikipedia/commons/b/b9/2023_Facebook_icon.svg' },
  facebook: { name: 'Facebook', icon: 'https://upload.wikimedia.org/wikipedia/commons/b/b9/2023_Facebook_icon.svg' },
  etsy: { name: 'Etsy' },
  offer_up: { name: 'OfferUp' },
  other: { name: 'Other' },
};

function normalizePlatformKey(raw) {
  const v = String(raw ?? '').trim().toLowerCase();
  if (!v) return 'other';
  if (v === 'facebook marketplace' || v === 'facebook_marketplace' || v === 'fbmp') return 'facebook_marketplace';
  return v.replace(/\s+/g, '_');
}

function fmtK(n) {
  const v = Number(n || 0);
  if (v >= 10000) return `$${(v / 1000).toFixed(1)}k`;
  return `$${v.toFixed(0)}`;
}

function fmtMoney(n) {
  const v = Number(n || 0) || 0;
  return `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

const tips = [
  'Check comps, not your feelings.',
  'Source like a sniper, not a vacuum.',
  'Listing speed is your superpower.',
  'Small margins add up. Big margins pay rent.',
  'The more you list, the more you sell.',
];

// ─── Sub-components ─────────────────────────────────────────────────────────

function KpiCell({ label, value, sub, borderColor = 'border-t-emerald-500' }) {
  return (
    <div className={`bg-card border border-border ${borderColor} border-t-2 rounded-lg px-3 py-2.5`}>
      <p className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider truncate">{label}</p>
      <p className="text-lg font-bold text-foreground tabular-nums mt-0.5 leading-tight">{value}</p>
      {sub && <p className="text-[12px] text-muted-foreground mt-0.5 truncate">{sub}</p>}
    </div>
  );
}

function MiniSparkline({ data }) {
  if (!data || data.length < 2) return null;
  return (
    <div className="h-6 w-16">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="v3SparkGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="v" stroke="hsl(var(--primary))" strokeWidth={1.5} fill="url(#v3SparkGrad)" dot={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function HeroProfitCard({ totalProfit, profitMargin, totalRevenue, sparkData, isLoading }) {
  return (
    <div className="bg-card border border-border border-t-2 border-t-emerald-500 rounded-lg px-4 py-3 flex flex-col justify-between h-full">
      <div>
        <p className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider">Total Profit</p>
        <div className="flex items-end gap-2 mt-1">
          <span className="text-3xl font-bold text-foreground tabular-nums tracking-tight">
            {isLoading ? '...' : fmtK(totalProfit)}
          </span>
          <MiniSparkline data={sparkData} />
        </div>
      </div>
      <div className="flex items-center gap-4 mt-2 text-[12px] text-muted-foreground">
        <div><span className="font-semibold text-foreground">{(profitMargin || 0).toFixed(1)}%</span> margin</div>
        <div><span className="font-semibold text-foreground">{fmtK(totalRevenue)}</span> revenue</div>
      </div>
    </div>
  );
}

// ─── Swipeable Info Card panels ─────────────────────────────────────────────

function ReturnDeadlinesPanel({ items }) {
  const list = (items || []).slice(0, 5);
  const count = (items || []).length;
  if (list.length === 0) return <p className="text-xs text-muted-foreground py-4 text-center">No upcoming deadlines</p>;
  return (
    <div>
      {count > 0 && (
        <div className="mb-2">
          <span className="bg-red-500/15 text-red-500 text-[12px] font-bold px-2 py-0.5 rounded-full">
            {count} due soon
          </span>
        </div>
      )}
      {list.map((item) => {
        const daysLeft = differenceInDays(parseISO(item.return_deadline), new Date());
        const urgent = daysLeft <= 2;
        return (
          <div key={item.id} className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0">
            <span className="text-xs text-foreground truncate mr-3 max-w-[150px]">{item.item_name}</span>
            <span className={`text-[12px] font-medium tabular-nums flex-shrink-0 px-1.5 py-0.5 rounded ${urgent ? 'bg-red-500/15 text-red-500' : 'text-muted-foreground'}`}>
              {daysLeft === 0 ? 'Today' : daysLeft === 1 ? 'Tomorrow' : `in ${daysLeft}d`}
            </span>
          </div>
        );
      })}
      <Link to={createPageUrl('Inventory?filter=returnDeadline')} className="text-[12px] text-primary hover:underline mt-2 inline-block">
        View all →
      </Link>
    </div>
  );
}

function NeedsListingPanel({ items }) {
  const list = (items || []).slice(0, 5);
  if (list.length === 0) return <p className="text-xs text-muted-foreground py-4 text-center">All items listed</p>;
  return (
    <div>
      {list.map((item) => {
        const daysAgo = differenceInDays(new Date(), parseISO(item.purchase_date));
        return (
          <div key={item.id} className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0">
            <span className="text-xs text-foreground truncate mr-3 max-w-[150px]">{item.item_name}</span>
            <span className="text-xs font-medium tabular-nums flex-shrink-0 text-amber-500">
              {daysAgo}d ago
            </span>
          </div>
        );
      })}
      <Link to={createPageUrl('Inventory?filter=stale')} className="text-[12px] text-primary hover:underline mt-2 inline-block">
        View all →
      </Link>
    </div>
  );
}

const ORBEN_API_URL = import.meta.env.VITE_ORBEN_API_URL || 'https://orben-api.fly.dev';

function TrendsPanel() {
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const didFetch = useRef(false);

  useEffect(() => {
    if (didFetch.current) return;
    didFetch.current = true;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const res = await fetch(`${ORBEN_API_URL}/v1/deals/feed?limit=4&offset=0`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error('Failed');
        const json = await res.json();
        setDeals(json.items?.slice(0, 4) || []);
      } catch {
        setDeals([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        {[0, 1, 2].map(i => (
          <div key={i} className="h-12 rounded-lg bg-muted/40 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!deals.length) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
        No trending deals right now
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 overflow-y-auto max-h-full">
      {deals.map(deal => {
        const discount = deal.original_price && deal.price
          ? Math.round(((deal.original_price - deal.price) / deal.original_price) * 100) : 0;
        const score = deal.score || 0;
        const tierLabel = score >= 90 ? 'MEGA' : score >= 70 ? 'HOT' : score >= 50 ? 'GREAT' : null;
        const tierColor = score >= 90
          ? 'bg-red-500/90 text-white'
          : score >= 70
          ? 'bg-orange-500/90 text-white'
          : score >= 50
          ? 'bg-emerald-500/90 text-white'
          : '';

        return (
          <a
            key={deal.id}
            href={deal.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-muted/60 transition-colors group"
          >
            <div className="w-9 h-9 rounded-md bg-muted flex-shrink-0 overflow-hidden relative">
              <img
                src={deal.image_url || '/default-deal-image.png'}
                alt=""
                className="w-full h-full object-cover"
                onError={e => { e.target.src = '/default-deal-image.png'; }}
              />
              {tierLabel && (
                <div className={`absolute bottom-0 inset-x-0 text-center text-[6px] font-bold leading-tight ${tierColor}`}>
                  {tierLabel}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-medium leading-tight line-clamp-1">{deal.title}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[12px] font-semibold text-foreground">${Number(deal.price || 0).toFixed(2)}</span>
                {deal.original_price && deal.original_price > deal.price && (
                  <span className="text-[9px] text-muted-foreground line-through">${Number(deal.original_price).toFixed(2)}</span>
                )}
                {discount > 0 && (
                  <span className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400">-{discount}%</span>
                )}
              </div>
            </div>
            <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 flex-shrink-0 transition-opacity" />
          </a>
        );
      })}
      <Link
        to={createPageUrl("Deals")}
        className="flex items-center justify-center gap-1 text-[12px] text-muted-foreground hover:text-foreground pt-1 transition-colors"
      >
        View all deals <ArrowRight className="w-3 h-3" />
      </Link>
    </div>
  );
}

const PANELS = [
  { key: 'returns', label: 'Return Deadlines', icon: AlarmClock },
  { key: 'listing', label: 'Needs Listing', icon: Eye },
  { key: 'trends',  label: 'Pulse Deals',      icon: TrendingUp },
];

function SwipeableInfoCard({ itemsWithUpcomingReturns, staleItems }) {
  const [activePanel, setActivePanel] = useState(0);
  const [paused, setPaused] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef(null);
  const containerRef = useRef(null);
  const resumeTimer = useRef(null);

  // Auto-scroll
  useEffect(() => {
    if (paused) return;
    const timer = setInterval(() => {
      setActivePanel((prev) => (prev + 1) % 3);
    }, 12000);
    return () => clearInterval(timer);
  }, [paused]);

  const pauseAutoScroll = useCallback(() => {
    setPaused(true);
    clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => setPaused(false), 15000);
  }, []);

  const handleDotClick = (i) => {
    setActivePanel(i);
    pauseAutoScroll();
  };

  // Swipe / drag handlers
  const getX = (e) => (e.touches ? e.touches[0].clientX : e.clientX);

  const onDragStart = useCallback((e) => {
    dragStart.current = getX(e);
    setIsDragging(true);
  }, []);

  const onDragMove = useCallback((e) => {
    if (dragStart.current === null) return;
    const diff = getX(e) - dragStart.current;
    setDragOffset(diff);
  }, []);

  const onDragEnd = useCallback(() => {
    if (dragStart.current === null) return;
    const threshold = 50;
    if (dragOffset < -threshold && activePanel < 2) {
      setActivePanel(activePanel + 1);
      pauseAutoScroll();
    } else if (dragOffset > threshold && activePanel > 0) {
      setActivePanel(activePanel - 1);
      pauseAutoScroll();
    }
    dragStart.current = null;
    setDragOffset(0);
    setIsDragging(false);
  }, [dragOffset, activePanel, pauseAutoScroll]);

  // Clean up resume timer
  useEffect(() => () => clearTimeout(resumeTimer.current), []);

  // Compute translateX including live drag offset
  const panelWidth = containerRef.current?.offsetWidth || 0;
  const baseTranslate = activePanel * (100 / 3);
  const dragPct = panelWidth > 0 ? (dragOffset / (panelWidth * 3)) * 100 : 0;

  return (
    <div className="rounded-lg border border-border bg-card h-full flex flex-col select-none">
      <div className="flex items-center justify-between px-3 pt-3 pb-2">
        <h3 className="text-xs font-semibold text-foreground flex items-center gap-1.5 transition-opacity duration-300">
          {React.createElement(PANELS[activePanel].icon, { className: 'w-3.5 h-3.5' })}
          <span key={activePanel} className="animate-[fadeIn_400ms_ease-out]">{PANELS[activePanel].label}</span>
        </h3>
        <div className="flex gap-1">
          {PANELS.map((p, i) => (
            <button
              key={p.key}
              onClick={() => handleDotClick(i)}
              className={`w-1.5 h-1.5 rounded-full transition-colors ${i === activePanel ? 'bg-primary' : 'bg-muted-foreground/30'}`}
            />
          ))}
        </div>
      </div>
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden cursor-grab active:cursor-grabbing"
        onMouseDown={onDragStart}
        onMouseMove={isDragging ? onDragMove : undefined}
        onMouseUp={onDragEnd}
        onMouseLeave={isDragging ? onDragEnd : undefined}
        onTouchStart={onDragStart}
        onTouchMove={onDragMove}
        onTouchEnd={onDragEnd}
      >
        <div
          className="flex h-full"
          style={{
            width: '300%',
            transform: `translateX(-${baseTranslate - dragPct}%)`,
            transition: isDragging ? 'none' : 'transform 600ms cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          <div className="w-1/3 px-3 pb-3"><ReturnDeadlinesPanel items={itemsWithUpcomingReturns} /></div>
          <div className="w-1/3 px-3 pb-3"><NeedsListingPanel items={staleItems} /></div>
          <div className="w-1/3 px-3 pb-3"><TrendsPanel /></div>
        </div>
      </div>
    </div>
  );
}

// ─── Platform Performance Section ───────────────────────────────────────────

function PlatformPerformanceSection({ rows }) {
  const [showAll, setShowAll] = useState(false);

  const data = useMemo(() => {
    const arr = Array.isArray(rows) ? rows : [];
    return arr
      .map((r) => {
        const key = normalizePlatformKey(r?.platform);
        return {
          key,
          name: PLATFORM_META[key]?.name || key.replace(/_/g, ' '),
          icon: PLATFORM_META[key]?.icon || null,
          sales: Number(r?.sales_count ?? 0) || 0,
          profit: Number(r?.total_profit ?? 0) || 0,
        };
      })
      .filter((d) => d.sales > 0 || d.profit !== 0)
      .sort((a, b) => b.profit - a.profit);
  }, [rows]);

  const visible = showAll ? data : data.slice(0, 4);

  if (data.length === 0) return null;

  const showInline = visible.length < 4;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-foreground">Platform Performance</h3>
        {!showInline && (
          <Link to={createPageUrl('PlatformPerformance')} className="text-[12px] text-primary hover:underline">
            Full report →
          </Link>
        )}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {visible.map((d) => (
          <div key={d.key} className="bg-card border border-border rounded-lg px-3 py-2.5 flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-full border border-border/60 bg-muted/30 flex items-center justify-center overflow-hidden flex-shrink-0">
              {d.icon ? (
                <img src={d.icon} alt={d.name} className="h-4 w-4 object-contain" />
              ) : (
                <span className="text-[12px] font-bold text-muted-foreground">
                  {String(d.name || '?').slice(0, 1).toUpperCase()}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-semibold text-foreground truncate">{d.name}</p>
              <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                <span>{d.sales} sales</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{fmtMoney(d.profit)}</span>
              </div>
            </div>
          </div>
        ))}
        {showInline && (
          <Link to={createPageUrl('PlatformPerformance')}
            className="bg-card border border-border rounded-lg px-3 py-2.5 flex items-center justify-center text-[12px] text-primary hover:underline hover:bg-muted/30 transition-colors">
            Full report →
          </Link>
        )}
      </div>
      {data.length > 4 && !showAll && (
        <button onClick={() => setShowAll(true)} className="text-[12px] text-primary hover:underline mt-2">
          Show {data.length - 4} more platforms
        </button>
      )}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function DashboardV3({
  salesMetrics,
  inventoryStats,
  platformSummary,
  isLoading,
  sales,
  recentSales,
  itemsWithUpcomingReturns,
  staleItems,
  displayName,
  profitRange,
  onProfitRangeChange,
  customRange,
  onCustomRangeChange,
}) {
  const location = useLocation();
  const { totalProfit, totalRevenue, totalSales, avgProfit, profitMargin, averageSaleSpeed } = salesMetrics || {};

  const [tip, setTip] = useState(() => tips[Math.floor(Math.random() * tips.length)]);
  const [tipDismissed, setTipDismissed] = useState(() => {
    try {
      const stored = localStorage.getItem('orben_tip_dismissed');
      if (!stored) return false;
      return stored === new Date().toISOString().slice(0, 10);
    } catch { return false; }
  });
  const dismissTip = useCallback(() => {
    setTipDismissed(true);
    try { localStorage.setItem('orben_tip_dismissed', new Date().toISOString().slice(0, 10)); } catch {}
  }, []);
  const cycleTip = useCallback(() => {
    setTip(prev => {
      const others = tips.filter(t => t !== prev);
      return others[Math.floor(Math.random() * others.length)] || prev;
    });
    setTipDismissed(false);
    try { localStorage.removeItem('orben_tip_dismissed'); } catch {}
  }, []);

  const sparkData = useMemo(
    () => (sales || []).slice(0, 20).reverse().map((s) => ({ v: Number(s?.profit ?? 0) || 0 })),
    [sales]
  );

  const chartData = useMemo(() => buildSeries(sales, profitRange, customRange), [sales, profitRange, customRange]);
  const chartTotal = useMemo(() => chartData.reduce((sum, p) => sum + (Number(p.v || 0) || 0), 0), [chartData]);

  const RANGES = [
    { key: '14d', label: '14D' },
    { key: 'monthly', label: 'Mo' },
    { key: 'yearly', label: 'Yr' },
  ];

  return (
    <div className="space-y-3">
      {/* ── 1. Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">Dashboard</h1>
        <div className="flex items-center gap-1.5">
          <div className="flex items-center">
            {/* Tip bubble — slides out from the lightbulb */}
            <div
              className={`overflow-hidden transition-all duration-500 ease-out ${tipDismissed ? 'max-w-0 opacity-0 mr-0' : 'max-w-[280px] opacity-100 mr-1'}`}
            >
              <div className="flex items-center gap-1.5 bg-yellow-500/15 border border-yellow-500/30 rounded-full pl-3 pr-1.5 py-1 whitespace-nowrap">
                <span className="text-[11px] text-yellow-600 dark:text-yellow-400 font-medium">"{tip}"</span>
                <button
                  onClick={dismissTip}
                  className="flex-shrink-0 h-4 w-4 rounded-full flex items-center justify-center text-yellow-600/60 dark:text-yellow-400/60 hover:text-yellow-700 dark:hover:text-yellow-300 hover:bg-yellow-500/20 transition-colors"
                  aria-label="Dismiss tip"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-yellow-500 hover:bg-yellow-500 hover:text-white transition-colors" onClick={cycleTip}>
              <Lightbulb className="w-3.5 h-3.5" />
            </Button>
          </div>
          <Link to={createPageUrl('AddSale')}>
            <Button size="sm" variant="outline" className="h-8 text-[13px] px-3 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10">
              <Plus className="w-3.5 h-3.5 mr-1" />
              Sale
            </Button>
          </Link>
          <Link to={createPageUrl('AddInventoryItem')} state={{ from: location.pathname }}>
            <Button size="sm" className="h-8 text-[13px] px-3 bg-blue-600 hover:bg-blue-700 text-white">
              <Plus className="w-3.5 h-3.5 mr-1" />
              Inventory
            </Button>
          </Link>
        </div>
      </div>

      {/* ── 2. Hero Profit (5col) + 3 KPI cells (7col) ────────────────────── */}
      <div className="grid grid-cols-12 gap-2">
        <div className="col-span-12 md:col-span-5">
          <HeroProfitCard
            totalProfit={totalProfit}
            profitMargin={profitMargin}
            totalRevenue={totalRevenue}
            sparkData={sparkData}
            isLoading={isLoading?.salesSummary}
          />
        </div>
        <div className="col-span-12 md:col-span-7 grid grid-cols-3 gap-2">
          <KpiCell
            label="Revenue"
            value={isLoading?.salesSummary ? '...' : fmtK(totalRevenue)}
            sub="all-time"
            borderColor="border-t-blue-500"
          />
          <KpiCell
            label="Sales"
            value={isLoading?.salesSummary ? '...' : String(totalSales || 0)}
            sub={avgProfit ? `$${avgProfit.toFixed(0)} avg` : 'items'}
            borderColor="border-t-indigo-500"
          />
          <KpiCell
            label="Stock"
            value={isLoading?.inventory ? '...' : String(inventoryStats?.totalQuantity || 0)}
            sub={`${staleItems?.length || 0} stale`}
            borderColor="border-t-purple-500"
          />
        </div>
      </div>

      {/* ── 3. Profit Chart (8col) + Swipeable Info Card (4col) ────────────── */}
      <div className="grid grid-cols-12 gap-3">
        <div className="col-span-12 lg:col-span-8">
          <div className="rounded-lg border border-border bg-card p-3">
            {/* Chart header with pill range buttons */}
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-xs font-semibold text-foreground">Profit Trend</h3>
                <p className="text-[12px] text-muted-foreground mt-0.5">
                  <span className="font-semibold text-foreground">${chartTotal.toFixed(0)}</span> total
                </p>
              </div>
              <div className="flex items-center gap-1">
                {RANGES.map((r) => (
                  <button
                    key={r.key}
                    onClick={() => onProfitRangeChange(r.key)}
                    className={`px-2 py-0.5 rounded-full text-[12px] font-medium transition-colors ${
                      profitRange === r.key
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      className={`px-2 py-0.5 rounded-full text-[12px] font-medium transition-colors ${
                        profitRange === 'custom'
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                      }`}
                    >
                      {customRange?.from && customRange?.to
                        ? `${format(customRange.from, 'M/d')}–${format(customRange.to, 'M/d')}`
                        : 'Custom'}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-auto p-0">
                    <Calendar
                      mode="range"
                      selected={customRange}
                      onSelect={(next) => {
                        onCustomRangeChange?.(next);
                        if (next?.from && next?.to) onProfitRangeChange?.('custom');
                      }}
                      numberOfMonths={2}
                    />
                    <div className="flex justify-end gap-2 p-3 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          onCustomRangeChange?.(undefined);
                          onProfitRangeChange?.('14d');
                        }}
                      >
                        Clear
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            {/* Area chart */}
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                  <defs>
                    <linearGradient id="v3ProfitGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--po-positive))" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="hsl(var(--po-positive))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 2" stroke="rgba(148,163,184,0.15)" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} fontSize={10} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    fontSize={10}
                    width={40}
                    tickFormatter={(v) => `$${v}`}
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <ChartTooltip
                    formatter={(v) => [`$${Number(v || 0).toFixed(2)}`, 'Profit']}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                      fontSize: '11px',
                    }}
                  />
                  <Area type="monotone" dataKey="v" stroke="hsl(var(--po-positive))" strokeWidth={2} fill="url(#v3ProfitGrad)" dot={false} animationDuration={450} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
        <div className="col-span-12 lg:col-span-4">
          <SwipeableInfoCard
            itemsWithUpcomingReturns={itemsWithUpcomingReturns}
            staleItems={staleItems}
          />
        </div>
      </div>

      {/* ── 4. Quick Actions — V1-style horizontal text links ──────────────── */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 py-1.5">
        {[
          { title: 'Add Inventory', icon: Package, href: createPageUrl('AddInventoryItem') },
          { title: 'Profit Calendar', icon: CalendarDays, href: createPageUrl('ProfitCalendar') },
          { title: 'Create Listing', icon: Layers, href: createPageUrl('Crosslist') },
          { title: 'View Reports', icon: BarChart3, href: createPageUrl('Reports') },
        ].map(({ title, icon: Icon, href }) => (
          <Link
            key={title}
            to={href}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors group"
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{title}</span>
            <ArrowRight className="w-3 h-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
          </Link>
        ))}
      </div>

      {/* ── 5. Platform Performance — full width horizontal cards ───────────── */}
      <PlatformPerformanceSection rows={platformSummary} />

      {/* ── 6. Recent Sales carousel ───────────────────────────────────────── */}
      <RecentSales sales={recentSales} />
    </div>
  );
}
