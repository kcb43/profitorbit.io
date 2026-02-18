import React, { useState, useEffect } from 'react';
import { RadialBarChart, RadialBar, ResponsiveContainer } from 'recharts';
import { Cloud, Sun, CloudRain, CloudSnow, CloudLightning, MapPin, TrendingUp, TrendingDown, Activity, Zap, Target } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  const [now, setNow]       = useState(new Date());
  const [weather, setWeather] = useState(null);
  const [city, setCity]       = useState(null);
  const [weatherErr, setWeatherErr] = useState(false);

  // Tick every minute
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Fetch weather via geolocation
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async ({ coords: { latitude: lat, longitude: lon } }) => {
        try {
          const [meteo, geo] = await Promise.all([
            fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weathercode&temperature_unit=celsius&timezone=auto`)
              .then(r => r.json()),
            fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`)
              .then(r => r.json()),
          ]);
          setWeather({
            temp: Math.round(meteo.current?.temperature_2m ?? 0),
            code: meteo.current?.weathercode ?? 0,
          });
          const address = geo.address || {};
          setCity(address.city || address.town || address.village || address.county || null);
        } catch {
          setWeatherErr(true);
        }
      },
      () => setWeatherErr(true),
      { timeout: 8000 }
    );
  }, []);

  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const name    = displayName || 'there';

  return (
    <div className="relative rounded-2xl overflow-hidden bg-card border border-border p-6 flex flex-col justify-between min-h-[180px] lg:min-h-[200px]">
      {/* Background glow */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-primary/10 via-primary/5 to-transparent rounded-full blur-3xl pointer-events-none" />

      {/* Greeting + name */}
      <div className="relative">
        <p className="text-muted-foreground text-sm font-medium">
          {getGreeting()},
        </p>
        <h2 className="text-2xl font-bold text-foreground mt-0.5 truncate">
          {name} <span className="text-primary">✦</span>
        </h2>
        <p className="text-xs text-muted-foreground mt-1">Ready to make today productive?</p>
      </div>

      {/* Time + weather row */}
      <div className="relative flex items-end justify-between mt-4 gap-4">
        {/* Clock */}
        <div>
          <div className="text-4xl font-bold text-foreground tracking-tight tabular-nums">
            {timeStr}
          </div>
          <div className="text-xs text-muted-foreground mt-1">{dateStr}</div>
        </div>

        {/* Weather */}
        {weather && !weatherErr && (
          <div className="flex flex-col items-end gap-1 shrink-0">
            <div className="flex items-center gap-2">
              {getWeatherIcon(weather.code, "w-7 h-7")}
              <span className="text-3xl font-semibold text-foreground tabular-nums">
                {weather.temp}°C
              </span>
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

// ─── InsightsCard ─────────────────────────────────────────────────────────────

const TABS = ['Performance', 'Trends'];

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
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${value}%`, background: color }}
        />
      </div>
    </div>
  );
}

function TrendItem({ label, value, positive }) {
  const Icon = positive ? TrendingUp : TrendingDown;
  const color = positive ? 'text-emerald-400' : 'text-muted-foreground';

  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border/50 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className={cn("flex items-center gap-1.5 text-xs font-semibold", color)}>
        <Icon className="w-3.5 h-3.5" />
        {value}
      </div>
    </div>
  );
}

export function InsightsCard({ salesMetrics, inventoryStats, platformSummary }) {
  const [tab, setTab] = useState('Performance');

  // Derive metrics from real data
  const profitMargin   = Math.min(Math.round(salesMetrics?.profitMargin   ?? 0), 100);
  const totalSales     = salesMetrics?.totalSales ?? 0;
  const totalProfit    = salesMetrics?.totalProfit ?? 0;
  const avgProfit      = salesMetrics?.avgProfit ?? 0;
  const stockCount     = inventoryStats?.totalQuantity ?? 0;
  const platformCount  = (platformSummary ?? []).length;

  // Composite score: weighted average of margin, activity, diversity
  const activityScore  = Math.min(Math.round((totalSales / Math.max(totalSales + 5, 1)) * 100), 100);
  const diversityScore = Math.min(platformCount * 25, 100);
  const overallScore   = Math.round((profitMargin * 0.4 + activityScore * 0.4 + diversityScore * 0.2));

  const radialData = [
    { name: 'score', value: overallScore, fill: 'hsl(var(--primary))' },
  ];

  return (
    <div className="rounded-2xl bg-card border border-border overflow-hidden flex flex-col min-h-[180px] lg:min-h-[200px]">
      {/* Header */}
      <div className="px-5 pt-5 pb-3 flex items-start justify-between">
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
                "px-3 py-1 rounded-md text-xs font-medium transition-colors",
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

      {/* Body */}
      <div className="flex-1 px-5 pb-5">
        {tab === 'Performance' ? (
          <div className="flex gap-4 items-center">
            {/* Donut / Radial */}
            <div className="relative w-28 h-28 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart
                  innerRadius="68%"
                  outerRadius="100%"
                  data={radialData}
                  startAngle={90}
                  endAngle={90 - (overallScore / 100) * 360}
                >
                  <RadialBar
                    dataKey="value"
                    cornerRadius={6}
                    background={{ fill: 'hsl(var(--muted))' }}
                  />
                </RadialBarChart>
              </ResponsiveContainer>
              {/* Center label */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-bold text-foreground tabular-nums">{overallScore}%</span>
              </div>
            </div>

            {/* Metric bars */}
            <div className="flex-1 space-y-3">
              <MetricBar
                label="Profit Margin"
                value={profitMargin}
                color="hsl(var(--primary))"
                icon={Target}
              />
              <MetricBar
                label="Sales Activity"
                value={activityScore}
                color="hsl(212 96% 55%)"
                icon={Activity}
              />
              <MetricBar
                label="Platform Diversity"
                value={diversityScore}
                color="hsl(var(--po-warning))"
                icon={Zap}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-0 mt-1">
            <TrendItem label="Avg Profit per Sale"  value={`$${avgProfit.toFixed(2)}`}   positive={avgProfit > 0} />
            <TrendItem label="Items in Stock"        value={String(stockCount)}            positive={stockCount > 0} />
            <TrendItem label="Active Platforms"      value={String(platformCount)}         positive={platformCount > 0} />
            <TrendItem label="Total Revenue"         value={`$${(totalRevenue||0).toFixed(0)}`} positive={(totalRevenue||0) > 0} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Combined row ─────────────────────────────────────────────────────────────

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
