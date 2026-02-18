import React, { useState, useEffect, useRef } from 'react';
import { RadialBarChart, RadialBar, ResponsiveContainer } from 'recharts';
import { Cloud, Sun, CloudRain, CloudSnow, CloudLightning, MapPin, TrendingUp, Activity, Zap, Target, ExternalLink, Flame } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/api/supabaseClient';

const ORBEN_API_URL = import.meta.env.VITE_ORBEN_API_URL || 'https://orben-api.fly.dev';

// ─── Weather helpers ──────────────────────────────────────────────────────────

function getWeatherIcon(code, className = "w-8 h-8") {
  if (code === 0) return <Sun className={cn(className, "text-yellow-400")} />;
  if (code <= 3)  return <Cloud className={cn(className, "text-slate-400")} />;
  if (code <= 48) return <Cloud className={cn(className, "text-slate-500")} />;
  if (code <= 67) return <CloudRain className={cn(className, "text-blue-400")} />;
  if (code <= 77) return <CloudSnow className={cn(className, "text-sky-300")} />;
  if (code <= 82) return <CloudRain className={cn(className, "text-blue-500")} />;
  return <CloudLightning className={cn(className, "text-yellow-500")} />;
}

function getWeatherLabel(code) {
  if (code === 0) return "Clear sky";
  if (code <= 3)  return "Partly cloudy";
  if (code <= 48) return "Foggy";
  if (code <= 57) return "Drizzle";
  if (code <= 67) return "Rainy";
  if (code <= 77) return "Snowy";
  if (code <= 82) return "Showers";
  return "Thunderstorm";
}

function getGreeting() {
  const h = new Date().getHours();
  if (h >= 5  && h < 12) return "Good morning";
  if (h >= 12 && h < 17) return "Good afternoon";
  if (h >= 17 && h < 21) return "Good evening";
  return "Good night";
}

// ─── WelcomeCard ─────────────────────────────────────────────────────────────

function WelcomeCard({ displayName }) {
  const [now, setNow]           = useState(new Date());
  const [weather, setWeather]   = useState(null);
  const [city, setCity]         = useState(null);
  const [weatherErr, setWeatherErr] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async ({ coords: { latitude: lat, longitude: lon } }) => {
        try {
          const [meteo, geo] = await Promise.all([
            fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weathercode&temperature_unit=celsius&timezone=auto`).then(r => r.json()),
            fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`).then(r => r.json()),
          ]);
          setWeather({ temp: Math.round(meteo.current?.temperature_2m ?? 0), code: meteo.current?.weathercode ?? 0 });
          const a = geo.address || {};
          setCity(a.city || a.town || a.village || a.county || null);
        } catch { setWeatherErr(true); }
      },
      () => setWeatherErr(true),
      { timeout: 8000 }
    );
  }, []);

  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div className="relative rounded-2xl overflow-hidden bg-card border border-border p-6 flex flex-col justify-between min-h-[180px] lg:min-h-[200px]">
      <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-primary/10 via-primary/5 to-transparent rounded-full blur-3xl pointer-events-none" />

      <div className="relative">
        <p className="text-muted-foreground text-sm font-medium">{getGreeting()},</p>
        <h2 className="text-2xl font-bold text-foreground mt-0.5 truncate">
          {displayName || 'there'} <span className="text-primary">✦</span>
        </h2>
        <p className="text-xs text-muted-foreground mt-1">Ready to make today productive?</p>
      </div>

      <div className="relative flex items-end justify-between mt-4 gap-4">
        <div>
          <div className="text-4xl font-bold text-foreground tracking-tight tabular-nums">{timeStr}</div>
          <div className="text-xs text-muted-foreground mt-1">{dateStr}</div>
        </div>
        {weather && !weatherErr && (
          <div className="flex flex-col items-end gap-1 shrink-0">
            <div className="flex items-center gap-2">
              {getWeatherIcon(weather.code, "w-7 h-7")}
              <span className="text-3xl font-semibold text-foreground tabular-nums">{weather.temp}°C</span>
            </div>
            <span className="text-xs text-muted-foreground">{getWeatherLabel(weather.code)}</span>
            {city && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="w-3 h-3" /> {city}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── MetricBar ────────────────────────────────────────────────────────────────

function MetricBar({ label, value, color, icon: Icon }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          {Icon && <Icon className="w-3.5 h-3.5" />}
          <span>{label}</span>
        </div>
        <span className="font-semibold text-foreground tabular-nums">{value}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted/50 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${value}%`, background: color }} />
      </div>
    </div>
  );
}

// ─── DealRow ─────────────────────────────────────────────────────────────────

function DealRow({ deal, index }) {
  return (
    <a
      href={deal.url || deal.deal_url || '#'}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2.5 py-2 border-b border-border/40 last:border-0 group hover:bg-muted/30 -mx-1 px-1 rounded transition-colors"
      style={{ animationDelay: `${index * 40}ms` }}
    >
      {/* Thumbnail */}
      <div className="w-9 h-9 rounded-md overflow-hidden bg-muted flex-shrink-0 border border-border/50">
        {deal.image_url ? (
          <img
            src={deal.image_url}
            alt=""
            className="w-full h-full object-cover"
            onError={e => { e.target.style.display = 'none'; }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Flame className="w-4 h-4 text-orange-400" />
          </div>
        )}
      </div>

      {/* Title + meta */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground truncate leading-tight group-hover:text-primary transition-colors">
          {deal.title}
        </p>
        {(deal.merchant || deal.price || deal.sale_price) && (
          <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
            {deal.merchant && <span className="capitalize">{deal.merchant}</span>}
            {(deal.price || deal.sale_price) && (
              <span className="ml-1 text-emerald-400 font-semibold">
                ${Number(deal.sale_price || deal.price || 0).toFixed(0)}
              </span>
            )}
          </p>
        )}
      </div>

      <ExternalLink className="w-3 h-3 text-muted-foreground/40 group-hover:text-muted-foreground flex-shrink-0 transition-colors" />
    </a>
  );
}

// ─── InsightsCard ─────────────────────────────────────────────────────────────

const TABS = ['Performance', 'Trends'];

export function InsightsCard({ salesMetrics, inventoryStats, platformSummary }) {
  const [tab, setTab] = useState('Performance');
  const [deals, setDeals]     = useState([]);
  const [dealsLoading, setDealsLoading] = useState(false);
  const didFetch = useRef(false);

  // Fetch top deals once when the component mounts (lazy — only hit the API once)
  useEffect(() => {
    if (didFetch.current) return;
    didFetch.current = true;

    const fetchDeals = async () => {
      setDealsLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const res = await fetch(`${ORBEN_API_URL}/v1/deals/feed?limit=2&offset=0`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        if (!res.ok) throw new Error('Failed');
        const json = await res.json();
        setDeals(json.items?.slice(0, 2) || []);
      } catch {
        setDeals([]);
      } finally {
        setDealsLoading(false);
      }
    };

    fetchDeals();
  }, []);

  // Metrics
  const profitMargin   = Math.min(Math.round(salesMetrics?.profitMargin   ?? 0), 100);
  const totalSales     = salesMetrics?.totalSales     ?? 0;
  const platformCount  = (platformSummary ?? []).length;
  const activityScore  = Math.min(Math.round((totalSales / Math.max(totalSales + 5, 1)) * 100), 100);
  const diversityScore = Math.min(platformCount * 25, 100);
  const overallScore   = Math.round(profitMargin * 0.4 + activityScore * 0.4 + diversityScore * 0.2);
  const radialData     = [{ name: 'score', value: overallScore, fill: 'hsl(var(--primary))' }];

  const activeIdx = tab === 'Performance' ? 0 : 1;

  return (
    <div className="rounded-2xl bg-card border border-border overflow-hidden flex flex-col min-h-[180px] lg:min-h-[200px]">
      {/* Header */}
      <div className="px-5 pt-5 pb-3 flex items-start justify-between shrink-0">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Insights</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Performance analytics</p>
        </div>

        {/* Tab pills */}
        <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-0.5">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "px-3 py-1 rounded-md text-xs font-medium transition-all duration-200",
                tab === t
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t === 'Performance' ? '◎' : '↗'} {t}
            </button>
          ))}
        </div>
      </div>

      {/* Sliding body */}
      <div className="flex-1 overflow-hidden">
        {/* Track — two panels side by side, slide via translateX */}
        <div
          className="flex h-full"
          style={{
            transform: `translateX(-${activeIdx * 50}%)`,
            width: '200%',
            transition: 'transform 420ms cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          {/* ── Performance panel ── */}
          <div className="w-1/2 px-5 pb-5 flex items-center gap-4">
            {/* Radial donut */}
            <div className="relative w-28 h-28 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart
                  innerRadius="68%"
                  outerRadius="100%"
                  data={radialData}
                  startAngle={90}
                  endAngle={90 - (overallScore / 100) * 360}
                >
                  <RadialBar dataKey="value" cornerRadius={6} background={{ fill: 'hsl(var(--muted))' }} />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xl font-bold text-foreground tabular-nums">{overallScore}%</span>
              </div>
            </div>

            {/* Metric bars */}
            <div className="flex-1 space-y-3">
              <MetricBar label="Profit Margin"      value={profitMargin}   color="hsl(var(--primary))"     icon={Target} />
              <MetricBar label="Sales Activity"     value={activityScore}  color="hsl(212 96% 55%)"        icon={Activity} />
              <MetricBar label="Platform Diversity" value={diversityScore} color="hsl(var(--po-warning))"  icon={Zap} />
            </div>
          </div>

          {/* ── Trends (Deal Feed) panel ── */}
          <div className="w-1/2 px-5 pb-4 flex flex-col overflow-hidden">
            <div className="flex items-center gap-1.5 mb-2 shrink-0">
              <Flame className="w-3.5 h-3.5 text-orange-400" />
              <span className="text-xs font-semibold text-foreground">Top Incoming Deals</span>
              <a
                href="/deals"
                className="ml-auto text-[10px] text-primary hover:underline"
                onClick={e => e.stopPropagation()}
              >
                View all →
              </a>
            </div>

            <div className="flex-1 overflow-hidden">
              {dealsLoading ? (
                <div className="space-y-2 mt-1">
                  {[...Array(2)].map((_, i) => (
                    <div key={i} className="flex items-center gap-2.5 py-1.5">
                      <div className="w-9 h-9 rounded-md bg-muted animate-pulse shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-2.5 bg-muted rounded animate-pulse w-3/4" />
                        <div className="h-2 bg-muted rounded animate-pulse w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : deals.length === 0 ? (
                <p className="text-xs text-muted-foreground mt-3 text-center">No deals available right now</p>
              ) : (
                <div>
                  {deals.map((deal, i) => (
                    <DealRow key={deal.id || i} deal={deal} index={i} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Combined row export ──────────────────────────────────────────────────────

export default function WelcomeInsightsRow({ displayName, salesMetrics, inventoryStats, platformSummary }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
      <WelcomeCard displayName={displayName} />
      <InsightsCard
        salesMetrics={salesMetrics}
        inventoryStats={inventoryStats}
        platformSummary={platformSummary}
      />
    </div>
  );
}
