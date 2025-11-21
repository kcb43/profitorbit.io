
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, parseISO, subDays, compareAsc } from 'date-fns';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ProfitChart({ sales, range, onRangeChange }) {
  const { chartData, baseTitle, badgeLabel, badgeClass } = React.useMemo(() => {
    const badgeConfig = {
      '14d': { label: 'Last 14 Days', className: 'bg-emerald-500' },
      'monthly': { label: 'Monthly', className: 'bg-indigo-500' },
      'yearly': { label: 'Yearly', className: 'bg-amber-500' },
    };

    const { label, className } = badgeConfig[range] || { label: 'Overview', className: 'bg-slate-500' };

    if (!sales || sales.length === 0) {
      return { chartData: [], baseTitle: "Profit Trend", badgeLabel: label, badgeClass: className };
    }

    let groupedData = {};

    if (range === '14d') {
      const fourteenDaysAgo = subDays(new Date(), 14);
      const relevantSales = sales.filter(s => compareAsc(parseISO(s.sale_date), fourteenDaysAgo) >= 0);

      groupedData = relevantSales.reduce((acc, sale) => {
        const dateKey = format(parseISO(sale.sale_date), 'yyyy-MM-dd');
        if (!acc[dateKey]) {
          acc[dateKey] = { date: format(parseISO(sale.sale_date), 'MMM dd'), profit: 0 };
        }
        acc[dateKey].profit += sale.profit || 0;
        return acc;
      }, {});

    } else if (range === 'monthly') {
      groupedData = sales.reduce((acc, sale) => {
        const dateKey = format(parseISO(sale.sale_date), 'yyyy-MM');
        if (!acc[dateKey]) {
          acc[dateKey] = { date: format(parseISO(sale.sale_date), 'MMM yy'), profit: 0 };
        }
        acc[dateKey].profit += sale.profit || 0;
        return acc;
      }, {});

    } else if (range === 'yearly') {
      groupedData = sales.reduce((acc, sale) => {
        const dateKey = format(parseISO(sale.sale_date), 'yyyy');
        if (!acc[dateKey]) {
          acc[dateKey] = { date: dateKey, profit: 0 };
        }
        acc[dateKey].profit += sale.profit || 0;
        return acc;
      }, {});
    }

    // Convert to array and sort by the original date key to ensure correct order
    const finalData = Object.keys(groupedData)
      .sort()
      .map(key => groupedData[key]);

    return { chartData: finalData, baseTitle: "Profit Trend", badgeLabel: label, badgeClass: className };

  }, [sales, range]);

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <CardTitle className="text-xl font-bold text-foreground flex items-center flex-wrap gap-3">
              <span className="leading-tight">{baseTitle}</span>
              {badgeLabel ? (
                <span className={`inline-flex items-center rounded-md border border-transparent px-2.5 py-0.5 text-xs font-semibold text-white shadow-sm ${badgeClass}`}>
                  {badgeLabel}
                </span>
              ) : null}
            </CardTitle>
            <Tabs value={range} onValueChange={onRangeChange}>
              <TabsList>
                <TabsTrigger value="14d">14 Days</TabsTrigger>
                <TabsTrigger value="monthly">Monthly</TabsTrigger>
                <TabsTrigger value="yearly">Yearly</TabsTrigger>
              </TabsList>
            </Tabs>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" stroke="#9ca3af" style={{ fontSize: '12px' }} />
            <YAxis stroke="#9ca3af" style={{ fontSize: '12px' }} tickFormatter={(value) => `$${value.toFixed(0)}`}/>
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(var(--background))', 
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
              }}
              formatter={(value, name) => [`$${value.toFixed(2)}`, 'Profit']}
              labelFormatter={(label) => `Date: ${label}`}
            />
            <Area 
              type="monotone" 
              dataKey="profit" 
              stroke="#22c55e" 
              strokeWidth={2}
              fillOpacity={1} 
              fill="url(#profitGradient)" 
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
