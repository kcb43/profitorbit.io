import React from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const PLATFORM_META = {
  ebay: {
    name: "eBay",
    icon: "https://upload.wikimedia.org/wikipedia/commons/1/1b/EBay_logo.svg",
  },
  mercari: {
    name: "Mercari",
    icon: "https://cdn.brandfetch.io/idjAt9LfED/w/400/h/400/theme/dark/icon.jpeg?c=1dxbfHSJFAPEGdCLU4o5B",
  },
  facebook_marketplace: {
    name: "Facebook",
    icon: "https://upload.wikimedia.org/wikipedia/commons/b/b9/2023_Facebook_icon.svg",
  },
  facebook: {
    name: "Facebook",
    icon: "https://upload.wikimedia.org/wikipedia/commons/b/b9/2023_Facebook_icon.svg",
  },
  etsy: {
    name: "Etsy",
  },
  offer_up: {
    name: "OfferUp",
  },
  other: {
    name: "Other",
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

export default function PlatformRevenueTableCard({
  rows,
  title = "Platform Performance",
  reportsHref,
}) {
  const data = React.useMemo(() => {
    const arr = Array.isArray(rows) ? rows : [];
    return arr
      .map((r) => {
        const key = normalizePlatformKey(r?.platform);
        const sales = Number(r?.sales_count ?? 0) || 0;
        const revenue = Number(r?.total_revenue ?? 0) || 0;
        const profit = Number(r?.total_profit ?? 0) || 0;
        const costBasis = revenue - profit;
        const roi = costBasis > 0 ? (profit / costBasis) * 100 : null;
        return {
          key,
          name: PLATFORM_META[key]?.name || key.replace(/_/g, " "),
          icon: PLATFORM_META[key]?.icon || null,
          sales,
          revenue,
          profit,
          roi,
        };
      })
      .filter((d) => d.sales > 0 || d.revenue > 0 || d.profit !== 0)
      .sort((a, b) => b.profit - a.profit);
  }, [rows]);

  return (
    <Card className="border border-gray-200/70 dark:border-gray-800/70 shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base font-semibold text-foreground">{title}</CardTitle>
          {reportsHref ? (
            <Link to={reportsHref}>
              <Button size="sm" className="h-8 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white">
                View Reports
              </Button>
            </Link>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {/* Desktop/tablet: compact table (no horizontal scroll) */}
        <div className="hidden sm:block">
          <div className="grid grid-cols-[minmax(0,1fr)_84px_64px_92px] gap-3 py-2 text-[11px] font-semibold text-muted-foreground border-b border-border/60">
            <div>Platform</div>
            <div className="text-right">ROI</div>
            <div className="text-right">Sales</div>
            <div className="text-right">Profit</div>
          </div>

          <div className="divide-y divide-border/60">
            {data.map((d) => (
              <div
                key={d.key}
                className="grid grid-cols-[minmax(0,1fr)_84px_64px_92px] gap-3 py-3 text-sm"
              >
                <div className="flex items-center justify-start min-w-0">
                  <div className="flex flex-col items-center gap-1 min-w-0">
                    <div className="h-9 w-9 rounded-full border border-border/60 bg-muted/30 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {d.icon ? (
                        <img src={d.icon} alt={d.name} className="h-5 w-5 object-contain" />
                      ) : (
                        <span className="text-xs font-bold text-muted-foreground">
                          {String(d.name || "?").slice(0, 1).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] font-semibold text-foreground truncate max-w-[140px] text-center">
                      {d.name}
                    </div>
                  </div>
                </div>

                <div className="text-right font-medium text-foreground tabular-nums">{fmtPct(d.roi)}</div>
                <div className="text-right font-medium text-foreground tabular-nums">{d.sales.toLocaleString()}</div>
                <div className="text-right font-semibold tabular-nums text-emerald-600 dark:text-emerald-300">
                  {fmtMoney(d.profit)}
                </div>
              </div>
            ))}
            {data.length === 0 ? (
              <div className="py-6 text-sm text-muted-foreground">No platform data yet.</div>
            ) : null}
          </div>
        </div>

        {/* Mobile: stacked row layout (no horizontal scroll) */}
        <div className="sm:hidden space-y-3">
          {data.map((d) => (
            <div
              key={d.key}
              className="rounded-2xl border border-border/60 bg-card/60 px-4 py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-full border border-border/60 bg-muted/30 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {d.icon ? (
                      <img src={d.icon} alt={d.name} className="h-6 w-6 object-contain" />
                    ) : (
                      <span className="text-sm font-bold text-muted-foreground">
                        {String(d.name || "?").slice(0, 1).toUpperCase()}
                      </span>
                    )}
                  </div>
                  {/* Mobile: hide platform name (keep logo). Keep an accessible label for non-icon fallback. */}
                  <span className="sr-only">{d.name}</span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-right">
                  <div className="min-w-0">
                    <div className="text-[10px] text-muted-foreground font-semibold">ROI</div>
                    <div className="text-sm font-semibold text-foreground tabular-nums">{fmtPct(d.roi)}</div>
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] text-muted-foreground font-semibold">Sales</div>
                    <div className="text-sm font-semibold text-foreground tabular-nums">{d.sales.toLocaleString()}</div>
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] text-muted-foreground font-semibold">Profit</div>
                    <div className="text-sm font-semibold text-emerald-600 dark:text-emerald-300 tabular-nums">
                      {fmtMoney(d.profit)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {data.length === 0 ? (
            <div className="py-2 text-sm text-muted-foreground">No platform data yet.</div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}


