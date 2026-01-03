import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { format, parseISO, subDays, isAfter, isBefore } from "date-fns";

function buildSeries(sales, range, customRange) {
  const s = Array.isArray(sales) ? sales : [];
  const points = {};

  if (range === "14d") {
    const cutoff = subDays(new Date(), 13);
    s.forEach((x) => {
      if (!x?.sale_date) return;
      try {
        const d = parseISO(String(x.sale_date));
        if (isBefore(d, cutoff)) return;
        const k = format(d, "yyyy-MM-dd");
        points[k] = (points[k] || 0) + (Number(x.profit ?? 0) || 0);
      } catch (_) {}
    });
    return Object.keys(points)
      .sort()
      .map((k) => ({ k, date: format(parseISO(k), "MMM dd"), v: points[k] }));
  }

  if (range === "monthly") {
    s.forEach((x) => {
      if (!x?.sale_date) return;
      try {
        const d = parseISO(String(x.sale_date));
        const k = format(d, "yyyy-MM");
        points[k] = (points[k] || 0) + (Number(x.profit ?? 0) || 0);
      } catch (_) {}
    });
    return Object.keys(points)
      .sort()
      .slice(-12)
      .map((k) => ({ k, date: format(parseISO(`${k}-01`), "MMM yy"), v: points[k] }));
  }

  if (range === "custom") {
    const from = customRange?.from || null;
    const to = customRange?.to || null;
    if (!from || !to) return [];
    s.forEach((x) => {
      if (!x?.sale_date) return;
      try {
        const d = parseISO(String(x.sale_date));
        if (isBefore(d, from) || isAfter(d, to)) return;
        const k = format(d, "yyyy-MM-dd");
        points[k] = (points[k] || 0) + (Number(x.profit ?? 0) || 0);
      } catch (_) {}
    });
    return Object.keys(points)
      .sort()
      .map((k) => ({ k, date: format(parseISO(k), "MMM dd"), v: points[k] }));
  }

  // yearly
  s.forEach((x) => {
    if (!x?.sale_date) return;
    try {
      const d = parseISO(String(x.sale_date));
      const k = format(d, "yyyy");
      points[k] = (points[k] || 0) + (Number(x.profit ?? 0) || 0);
    } catch (_) {}
  });
  return Object.keys(points)
    .sort()
    .slice(-6)
    .map((k) => ({ k, date: k, v: points[k] }));
}

export default function ProfitTrendCard({ sales, range, onRangeChange, customRange, onCustomRangeChange }) {
  const data = React.useMemo(() => buildSeries(sales, range, customRange), [sales, range, customRange]);
  const total = React.useMemo(() => data.reduce((sum, p) => sum + (Number(p.v || 0) || 0), 0), [data]);
  const stroke = "hsl(var(--po-positive))";

  return (
    <Card className="border border-gray-200/70 dark:border-gray-800/70 shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle className="text-base font-semibold text-foreground">Profit Trend</CardTitle>
            <div className="mt-1 text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">${total.toFixed(0)}</span>{" "}
              <span className="text-muted-foreground">total</span>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
            <Tabs value={range} onValueChange={onRangeChange}>
              <TabsList className="bg-muted/40 w-full sm:w-auto flex flex-wrap justify-start">
                <TabsTrigger value="14d">14 Days</TabsTrigger>
                <TabsTrigger value="monthly">Monthly</TabsTrigger>
                <TabsTrigger value="yearly">Yearly</TabsTrigger>
              </TabsList>
            </Tabs>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={range === "custom" ? "default" : "outline"}
                  className={`${range === "custom" ? "" : "border-gray-300 dark:border-gray-700"} w-full sm:w-auto`}
                >
                  {customRange?.from && customRange?.to
                    ? `${format(customRange.from, "MMM d, yyyy")} – ${format(customRange.to, "MMM d, yyyy")}`
                    : "Date Range"}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-auto p-0">
                <Calendar
                  mode="range"
                  selected={customRange}
                  onSelect={(next) => {
                    onCustomRangeChange?.(next);
                    if (next?.from && next?.to) {
                      onRangeChange?.("custom");
                    }
                  }}
                  numberOfMonths={2}
                />
                <div className="flex justify-end gap-2 p-3 border-t">
                  <Button
                    variant="outline"
                    onClick={() => {
                      onCustomRangeChange?.(undefined);
                      onRangeChange?.("14d");
                    }}
                  >
                    Clear
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
              <defs>
                <linearGradient id="poProfitGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={stroke} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={stroke} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 2" stroke="rgba(148,163,184,0.25)" />
              <XAxis dataKey="date" axisLine={false} tickLine={false} fontSize={12} />
              <YAxis
                axisLine={false}
                tickLine={false}
                fontSize={12}
                tickFormatter={(v) => `$${Number(v || 0).toFixed(0)}`}
              />
              <Tooltip
                formatter={(v) => [`$${Number(v || 0).toFixed(2)}`, "Profit"]}
                contentStyle={{
                  backgroundColor: "hsl(var(--background))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
              />
              <Area
                type="monotone"
                dataKey="v"
                stroke={stroke}
                strokeWidth={2}
                fill="url(#poProfitGrad)"
                dot={false}
                isAnimationActive={true}
                animationDuration={450}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}


