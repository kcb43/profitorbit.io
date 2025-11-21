
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { format, parseISO, startOfMonth } from 'date-fns';

export default function MonthlyPnlChart({ sales, rangeLabel }) {
  const descriptor = React.useMemo(() => {
    if (!rangeLabel) return "Recent period";
    return rangeLabel.toLowerCase() === "lifetime" ? "Lifetime view" : `Last ${rangeLabel}`;
  }, [rangeLabel]);
  const data = React.useMemo(() => {
    const monthlyData = sales.reduce((acc, sale) => {
      if (!sale.sale_date) {
        return acc;
      }
      const month = format(startOfMonth(parseISO(sale.sale_date)), 'yyyy-MM');
      if (!acc[month]) {
        acc[month] = {
          revenue: 0,
          cost: 0,
          profit: 0,
          monthLabel: format(startOfMonth(parseISO(sale.sale_date)), 'MMM yyyy'),
          monthKey: month,
        };
      }
      const cost = (sale.purchase_price || 0) + (sale.shipping_cost || 0) + (sale.platform_fees || 0) + (sale.other_costs || 0);
      acc[month].revenue += sale.selling_price || 0;
      acc[month].cost += cost;
      acc[month].profit += sale.profit || 0;
      return acc;
    }, {});
    
    return Object.values(monthlyData)
      .sort((a, b) => (a.monthKey > b.monthKey ? 1 : -1))
      .slice(-12)
      .map(({ monthLabel, revenue, cost, profit }) => ({
        month: monthLabel,
        revenue,
        cost,
        profit,
      }));
  }, [sales]);

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-xl font-semibold text-foreground">Monthly Profit &amp; Loss</CardTitle>
        <CardDescription className="text-muted-foreground">
          {descriptor} of revenue, costs, and net profit.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height={360}>
            <BarChart data={data} margin={{ top: 12, right: 16, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="month" stroke="#6b7280" style={{ fontSize: '12px' }} tickLine={false} axisLine={false} />
              <YAxis
                stroke="#6b7280"
                style={{ fontSize: '12px' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `$${value.toFixed(0)}`}
              />
              <Tooltip
                formatter={(value) => `$${Number(value).toFixed(2)}`}
                cursor={{ fill: 'rgba(59, 130, 246, 0.08)' }}
                contentStyle={{
                  borderRadius: '12px',
                  border: '1px solid hsl(var(--border))',
                  boxShadow: '0 10px 30px -12px rgba(15, 23, 42, 0.35)',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '13px', paddingTop: 12 }} />
              <Bar dataKey="revenue" fill="#2563eb" name="Revenue" radius={[6, 6, 0, 0]} />
              <Bar dataKey="cost" fill="#f97316" name="Costs" radius={[6, 6, 0, 0]} />
              <Bar dataKey="profit" fill="#16a34a" name="Profit" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="py-16 text-center text-sm text-muted-foreground">
            Not enough sales in this range to render the chart.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
