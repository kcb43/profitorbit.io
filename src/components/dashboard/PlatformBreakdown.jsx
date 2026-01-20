
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const platformColors = {
  ebay: "bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100",
  facebook_marketplace: "bg-purple-100 text-purple-800 border-purple-200 hover:bg-purple-100",
  etsy: "bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-100",
  mercari: "bg-pink-100 text-pink-800 border-pink-200 hover:bg-pink-100",
  offer_up: "bg-teal-100 text-teal-800 border-teal-200 hover:bg-teal-100"
};

const platformNames = {
  ebay: "eBay",
  facebook_marketplace: "Facebook",
  etsy: "Etsy",
  mercari: "Mercari",
  offer_up: "OfferUp"
};

const platformIcons = {
  ebay: "https://upload.wikimedia.org/wikipedia/commons/1/1b/EBay_logo.svg",
  facebook_marketplace: "https://upload.wikimedia.org/wikipedia/commons/b/b9/2023_Facebook_icon.svg",
  mercari: "https://cdn.brandfetch.io/idjAt9LfED/w/400/h/400/theme/dark/icon.jpeg?c=1dxbfHSJFAPEGdCLU4o5B",
  etsy: "https://cdn.brandfetch.io/idzyTAzn6G/theme/dark/logo.svg?c=1dxbfHSJFAPEGdCLU4o5B",
  offer_up: "https://cdn.brandfetch.io/id5p1Knwlt/theme/dark/symbol.svg?c=1dxbfHSJFAPEGdCLU4o5B"
};

export default function PlatformBreakdown({ sales, variant }) {
  const isMosaic = variant === 'mosaic';
  const platformStats = React.useMemo(() => {
    // Accept either:
    // - raw sales rows: { platform, selling_price, profit }
    // - RPC summary rows: { platform, sales_count, total_revenue, total_profit }
    const stats = (sales ?? []).reduce((acc, row) => {
      const key = row?.platform || 'other';
      if (!acc[key]) acc[key] = { count: 0, revenue: 0, profit: 0 };

      const countInc =
        Number(row?.sales_count ?? row?.count ?? 1) || 0;
      const revenueInc =
        Number(row?.total_revenue ?? row?.selling_price ?? 0) || 0;
      const profitInc =
        Number(row?.total_profit ?? row?.profit ?? 0) || 0;

      acc[key].count += countInc;
      acc[key].revenue += revenueInc;
      acc[key].profit += profitInc;
      return acc;
    }, {});

    return Object.entries(stats)
      .sort(([, a], [, b]) => b.profit - a.profit)
      .slice(0, 5);
  }, [sales]);

  return (
    <Card className={isMosaic ? "border border-gray-200/70 dark:border-gray-800/70 shadow-sm" : "border-0 shadow-sm"}>
      <CardHeader>
        <CardTitle className="text-xl font-bold text-foreground">Platform Performance</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {platformStats.map(([platform, stats]) => (
            <div key={platform} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <div className="flex items-center gap-3">
                <Badge className={`${platformColors[platform]} border px-3 py-1 flex items-center justify-center`}>
                  {platformIcons[platform] ? (
                    <img src={platformIcons[platform]} alt={platformNames[platform]} className="w-8 h-8 object-contain" />
                  ) : (
                    platformNames[platform] || platform
                  )}
                </Badge>
                <div>
                  <p className="text-sm font-medium text-foreground">{stats.count} sales</p>
                  <p className="text-xs text-muted-foreground">${stats.revenue.toFixed(2)} revenue</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-green-600 dark:text-green-400">${stats.profit.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">profit</p>
              </div>
            </div>
          ))}
          {platformStats.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p>No sales data yet</p>
              <p className="text-sm mt-1">Start adding sales to see platform breakdown</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
