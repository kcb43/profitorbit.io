import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const COLORS = ["#6366f1", "#60a5fa", "#34d399", "#f472b6", "#fbbf24", "#94a3b8"];

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
};

function normalizePlatformKey(raw) {
  const v = String(raw ?? "").trim().toLowerCase();
  if (!v) return "other";
  if (v === "facebook marketplace" || v === "facebook_marketplace" || v === "fbmp") return "facebook_marketplace";
  return v.replace(/\s+/g, "_");
}

export default function PlatformDonutCard({ rows, title = "Platform Mix", reportsHref }) {
  const data = React.useMemo(() => {
    const arr = Array.isArray(rows) ? rows : [];
    return arr
      .map((r) => ({
        key: normalizePlatformKey(r?.platform),
        name: PLATFORM_META[normalizePlatformKey(r?.platform)]?.name || String(r?.platform || "Other"),
        value: Number(r?.total_revenue ?? r?.selling_price ?? 0) || 0,
      }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [rows]);

  const total = React.useMemo(
    () => data.reduce((sum, d) => sum + d.value, 0),
    [data]
  );

  return (
    <Card className="border border-gray-200/70 dark:border-gray-800/70 shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base font-semibold text-foreground">{title}</CardTitle>
          {reportsHref ? (
            <Link to={reportsHref}>
              <Button variant="outline" size="sm" className="h-8">
                View Reports
              </Button>
            </Link>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip
                formatter={(v, _name, props) => {
                  const label = props?.payload?.name || "Revenue";
                  return [`$${Number(v || 0).toFixed(2)}`, label];
                }}
                contentStyle={{
                  backgroundColor: "hsl(var(--background))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  color: "hsl(var(--foreground))",
                }}
                labelStyle={{ color: "hsl(var(--foreground))" }}
                itemStyle={{ color: "hsl(var(--foreground))" }}
              />
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius={70}
                outerRadius={92}
                paddingAngle={2}
                stroke="transparent"
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-3 flex items-center justify-center text-sm text-muted-foreground">
          Total: <span className="ml-2 font-semibold text-foreground">${total.toFixed(2)}</span>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground">
          {data.map((d, i) => (
            <div key={d.name} className="flex items-center gap-2">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: COLORS[i % COLORS.length] }}
              />
              {PLATFORM_META[d.key]?.icon ? (
                <img
                  src={PLATFORM_META[d.key].icon}
                  alt={d.name}
                  className="h-4 w-4 object-contain"
                />
              ) : null}
              <span>{d.name}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}


