
import React from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
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
          costs: 0,
          profit: 0,
          monthLabel: format(startOfMonth(parseISO(sale.sale_date)), 'MMM yyyy'),
          monthKey: month,
        };
      }
      const cost = (sale.purchase_price || 0) + (sale.shipping_cost || 0) + (sale.platform_fees || 0) + (sale.other_costs || 0);
      acc[month].revenue += sale.selling_price || 0;
      acc[month].costs += cost;
      acc[month].profit += sale.profit || 0;
      return acc;
    }, {});

    return Object.values(monthlyData)
      .sort((a, b) => (a.monthKey > b.monthKey ? 1 : -1))
      .slice(-12)
      .map(({ monthLabel, revenue, costs, profit }) => ({
        month: monthLabel,
        revenue,
        costs,
        profit,
      }));
  }, [sales]);

  if (data.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-zinc-950 p-4 shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm text-white/60">Monthly P&L</div>
            <div className="text-lg font-semibold text-white">Revenue vs Costs</div>
          </div>
        </div>
        <div className="h-64 flex items-center justify-center">
          <div className="text-sm text-white/40">Not enough sales in this range to render the chart.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-950 p-4 shadow-lg">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-sm text-white/60">Monthly P&L</div>
          <div className="text-lg font-semibold text-white">Revenue vs Costs</div>
        </div>
        <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
          Profit highlighted
        </div>
      </div>

      <div className="h-64 md:h-96 lg:h-[420px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data}>
            <CartesianGrid strokeDasharray="3 6" stroke="rgba(255,255,255,0.06)" />
            <XAxis
              dataKey="month"
              tick={{ fill: 'rgba(255,255,255,0.6)' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: 'rgba(255,255,255,0.6)' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(value) => `$${value.toFixed(0)}`}
            />
            <Tooltip
              contentStyle={{
                background: 'rgba(10,10,10,0.95)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 12,
              }}
              labelStyle={{ color: 'rgba(255,255,255,0.7)' }}
              formatter={(value) => `$${Number(value).toFixed(2)}`}
            />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="#60a5fa"
              fill="rgba(96,165,250,0.25)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="costs"
              stroke="#fb923c"
              fill="rgba(251,146,60,0.18)"
              strokeWidth={2}
            />
            <Line
              type="monotone"
              dataKey="profit"
              stroke="#22c55e"
              strokeWidth={3}
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        {data.slice(-3).map((d) => (
          <div key={d.month} className="rounded-xl border border-white/10 bg-white/5 p-2">
            <div className="text-white/60">{d.month}</div>
            <div className="text-white font-semibold">${Math.round(d.profit || 0).toLocaleString()}</div>
            <div className="text-white/50">profit</div>
          </div>
        ))}
      </div>
    </div>
  );
}
