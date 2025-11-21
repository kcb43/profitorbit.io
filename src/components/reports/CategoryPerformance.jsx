import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export default function CategoryPerformance({ sales, rangeLabel }) {
  const descriptor = React.useMemo(() => {
    if (!rangeLabel) return "recent period";
    return rangeLabel.toLowerCase() === "lifetime" ? "lifetime data" : `last ${rangeLabel}`;
  }, [rangeLabel]);
  const categoryData = React.useMemo(() => {
    const categories = sales.reduce((acc, sale) => {
      const category = sale.category || "Uncategorized";
      if (!acc[category]) {
        acc[category] = { sales: 0, revenue: 0, profit: 0 };
      }
      acc[category].sales += 1;
      acc[category].revenue += sale.selling_price || 0;
      acc[category].profit += sale.profit || 0;
      return acc;
    }, {});

    const totalProfit = Object.values(categories).reduce((sum, cat) => sum + cat.profit, 0);
    return Object.entries(categories)
      .map(([name, data]) => ({ name, ...data, percentage: totalProfit > 0 ? (data.profit / totalProfit) * 100 : 0}))
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 6);
  }, [sales]);

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-xl font-semibold text-foreground">Top Performing Categories</CardTitle>
        <CardDescription className="text-muted-foreground">
          Share of profit across categories from your {descriptor}.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        {categoryData.length > 0 ? (
          <div className="space-y-5">
            {categoryData.map(cat => (
              <div key={cat.name} className="rounded-lg border border-border/70 p-4 hover:border-primary/50 transition">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-semibold text-foreground">{cat.name}</p>
                    <p className="text-xs text-muted-foreground">{cat.sales} sales • ${cat.revenue.toFixed(2)} revenue</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-emerald-500 text-base">${cat.profit.toFixed(2)}</p>
                    <p className="text-[11px] text-muted-foreground">Profit</p>
                  </div>
                </div>
                <Progress
                  value={cat.percentage}
                  className="h-2 [&>div]:bg-gradient-to-r [&>div]:from-emerald-400 [&>div]:to-sky-500"
                />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-sm text-muted-foreground py-12">
            No categorized sales in this range yet.
          </p>
        )}
      </CardContent>
    </Card>
  );
}