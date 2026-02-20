/**
 * Profit by Month report definition
 * Rows: one row per month with revenue, fees, shipping, cost, profit aggregates
 */

export default {
  id: 'profit-by-month',
  title: 'Profit by Month',
  description: 'Month-over-month breakdown of revenue, fees, costs, and net profit.',
  category: 'Analytics',

  defaultFilters: {
    dateFrom: null,
    dateTo: null,
    marketplace: '',
  },

  columns: [
    { key: 'month',          label: 'Month',        format: 'text'     },
    { key: 'sales_count',    label: 'Sales',        format: 'number'   },
    { key: 'gross_revenue',  label: 'Gross Revenue',format: 'currency' },
    { key: 'total_fees',     label: 'Fees',         format: 'currency' },
    { key: 'total_shipping', label: 'Shipping',     format: 'currency' },
    { key: 'total_cost',     label: 'Cost Basis',   format: 'currency' },
    { key: 'net_profit',     label: 'Net Profit',   format: 'currency' },
    { key: 'profit_margin',  label: 'Margin %',     format: 'percent'  },
  ],

  metricsDefinition: [
    { key: 'months_active',  label: 'Months with Sales', format: 'number'   },
    { key: 'total_gross',    label: 'Total Revenue',     format: 'currency' },
    { key: 'total_net',      label: 'Total Net Profit',  format: 'currency' },
    { key: 'avg_monthly',    label: 'Avg Monthly Profit',format: 'currency' },
    { key: 'best_month',     label: 'Best Month',        format: 'text'     },
    { key: 'best_month_net', label: 'Best Month Profit', format: 'currency' },
  ],

  async fetchRows(supabase, userId, filters, { limit = 50000 } = {}) {
    let q = supabase
      .from('sales')
      .select('sale_date,platform,selling_price,sale_price,platform_fees,shipping_cost,purchase_price,profit')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('sale_date', { ascending: true })
      .limit(limit);

    if (filters.dateFrom) q = q.gte('sale_date', filters.dateFrom);
    if (filters.dateTo)   q = q.lte('sale_date', filters.dateTo);
    if (filters.marketplace) q = q.eq('platform', filters.marketplace);

    const { data, error } = await q;
    if (error) throw new Error(error.message);

    // Aggregate by month
    const byMonth = new Map();

    for (const r of data || []) {
      const monthKey = String(r.sale_date || '').slice(0, 7);
      if (!monthKey) continue;

      const existing = byMonth.get(monthKey) || {
        month: monthKey,
        sales_count: 0,
        gross_revenue: 0,
        total_fees: 0,
        total_shipping: 0,
        total_cost: 0,
        net_profit: 0,
      };

      existing.sales_count   += 1;
      existing.gross_revenue += Number(r.selling_price ?? r.sale_price ?? 0);
      existing.total_fees    += Number(r.platform_fees ?? 0);
      existing.total_shipping+= Number(r.shipping_cost ?? 0);
      existing.total_cost    += Number(r.purchase_price ?? 0);
      existing.net_profit    += Number(r.profit ?? 0);
      byMonth.set(monthKey, existing);
    }

    return Array.from(byMonth.values()).map((m) => ({
      ...m,
      profit_margin: m.gross_revenue > 0 ? (m.net_profit / m.gross_revenue) * 100 : 0,
    }));
  },

  computeMetrics(rows) {
    const months_active = rows.length;
    const total_gross   = rows.reduce((s, r) => s + r.gross_revenue, 0);
    const total_net     = rows.reduce((s, r) => s + r.net_profit, 0);
    const avg_monthly   = months_active > 0 ? total_net / months_active : 0;
    const best          = rows.reduce((best, r) => (!best || r.net_profit > best.net_profit ? r : best), null);
    return {
      months_active,
      total_gross,
      total_net,
      avg_monthly,
      best_month:     best?.month || '—',
      best_month_net: best?.net_profit || 0,
    };
  },

  totalColumns: ['sales_count', 'gross_revenue', 'total_fees', 'total_shipping', 'total_cost', 'net_profit'],
};
