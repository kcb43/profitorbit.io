import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

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

export default function PlatformComparison({ sales, rangeLabel }) {
  const descriptor = React.useMemo(() => {
    if (!rangeLabel) return "recent period";
    return rangeLabel.toLowerCase() === "lifetime" ? "lifetime data" : `last ${rangeLabel}`;
  }, [rangeLabel]);
  const platformData = React.useMemo(() => {
    // Prefer pre-aggregated platforms when available (server-side reports summary).
    if (Array.isArray(sales) && sales.length > 0 && sales[0]?.platformKey && sales[0]?.profit !== undefined && sales[0]?.revenue !== undefined) {
      return sales;
    }

    const platforms = sales.reduce((acc, sale) => {
      const platform = sale.platform;
      if (!acc[platform]) {
        acc[platform] = { 
          platformKey: platform,
          name: platformNames[platform], 
          sales: 0, 
          revenue: 0, 
          profit: 0 
        };
      }
      acc[platform].sales += 1;
      acc[platform].revenue += sale.selling_price || 0;
      acc[platform].profit += sale.profit || 0;
      return acc;
    }, {});

    return Object.values(platforms).map(p => ({
      ...p,
      avgProfit: p.sales > 0 ? p.profit / p.sales : 0,
      profitMargin: p.revenue > 0 ? (p.profit / p.revenue) * 100 : 0
    })).sort((a, b) => b.profit - a.profit);
  }, [sales]);

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-xl font-semibold text-foreground">Platform Comparison</CardTitle>
        <CardDescription className="text-muted-foreground">
          Snapshot of platform performance from your {descriptor}.
        </CardDescription>
      </CardHeader>
      
      {/* --- Mobile View --- */}
      <div className="md:hidden p-4 space-y-4">
        {platformData.map(p => (
          <div key={p.name} className="rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm p-4 shadow-sm">
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                {p.platformKey && platformIcons[p.platformKey] && (
                  <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-lg p-1.5 shadow-sm border border-white/20 dark:border-gray-700/50">
                    <img 
                      src={platformIcons[p.platformKey]} 
                      alt={p.name} 
                      className="w-5 h-5 object-contain"
                    />
                  </div>
                )}
                <span className="font-semibold text-base text-foreground">{p.name}</span>
              </div>
              <Badge className="bg-emerald-100 text-emerald-700 border-transparent dark:bg-emerald-900/40 dark:text-emerald-200">
                ${p.profit.toFixed(2)}
              </Badge>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm text-muted-foreground">
              <div>
                <dt className="font-medium text-foreground">Total Sales</dt>
                <dd>{p.sales}</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Avg. Profit</dt>
                <dd>${p.avgProfit.toFixed(2)}</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Revenue</dt>
                <dd>${p.revenue.toFixed(2)}</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Margin</dt>
                <dd>{p.profitMargin.toFixed(1)}%</dd>
              </div>
            </dl>
          </div>
        ))}
        {platformData.length === 0 && <p className="text-center text-gray-500 py-8">No platform data to compare.</p>}
      </div>

      {/* --- Desktop View --- */}
      <CardContent className="p-0 hidden md:block">
        <div className="overflow-x-auto rounded-b-xl border border-border/60">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-foreground">Platform</TableHead>
                <TableHead className="text-right text-foreground">Total Sales</TableHead>
                <TableHead className="text-right text-foreground">Revenue</TableHead>
                <TableHead className="text-right text-foreground">Profit</TableHead>
                <TableHead className="text-right text-foreground">Avg. Profit</TableHead>
                <TableHead className="text-right text-foreground">Margin</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {platformData.map(p => (
                <TableRow key={p.name}>
                  <TableCell className="font-medium whitespace-nowrap text-foreground">
                    <div className="flex items-center gap-2">
                      {p.platformKey && platformIcons[p.platformKey] && (
                        <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-lg p-1.5 shadow-sm border border-white/20 dark:border-gray-700/50">
                          <img 
                            src={platformIcons[p.platformKey]} 
                            alt={p.name} 
                            className="w-5 h-5 object-contain"
                          />
                        </div>
                      )}
                      <span>{p.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-foreground">{p.sales}</TableCell>
                  <TableCell className="text-right text-foreground">${p.revenue.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-semibold text-emerald-500">${p.profit.toFixed(2)}</TableCell>
                  <TableCell className="text-right text-foreground">${p.avgProfit.toFixed(2)}</TableCell>
                  <TableCell className="text-right text-foreground">{p.profitMargin.toFixed(1)}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {platformData.length === 0 && <p className="text-center text-gray-500 py-8">No platform data to compare.</p>}
        </div>
      </CardContent>
    </Card>
  );
}