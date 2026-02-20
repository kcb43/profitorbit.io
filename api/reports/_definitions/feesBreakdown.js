/**
 * Fees Breakdown report definition
 * Rows: per-platform fee summary within a date range
 */

export default {
  id: 'fees-breakdown',
  title: 'Fees Breakdown',
  description: 'Platform fees and shipping costs breakdown by marketplace for a date range.',
  category: 'Analytics',

  defaultFilters: {
    dateFrom: null,
    dateTo: null,
    marketplace: '',
  },

  columns: [
    { key: 'platform',          label: 'Platform',         format: 'text'     },
    { key: 'sales_count',       label: 'Sales',            format: 'number'   },
    { key: 'gross_revenue',     label: 'Gross Revenue',    format: 'currency' },
    { key: 'total_fees',        label: 'Platform Fees',    format: 'currency' },
    { key: 'total_shipping',    label: 'Shipping Costs',   format: 'currency' },
    { key: 'total_vat',         label: 'VAT / Other',      format: 'currency' },
    { key: 'total_deductions',  label: 'Total Deductions', format: 'currency' },
    { key: 'fee_rate',          label: 'Effective Fee %',  format: 'percent'  },
    { key: 'net_profit',        label: 'Net Profit',       format: 'currency' },
  ],

  metricsDefinition: [
    { key: 'total_sales',       label: 'Total Sales',         format: 'number'   },
    { key: 'total_gross',       label: 'Total Revenue',       format: 'currency' },
    { key: 'total_fees',        label: 'Total Fees Paid',     format: 'currency' },
    { key: 'total_shipping',    label: 'Total Shipping',      format: 'currency' },
    { key: 'total_deductions',  label: 'Total Deductions',    format: 'currency' },
    { key: 'avg_fee_rate',      label: 'Avg Effective Fee %', format: 'percent'  },
    { key: 'net_profit',        label: 'Net Profit',          format: 'currency' },
  ],

  async fetchRows(supabase, userId, filters, { limit = 50000 } = {}) {
    let q = supabase
      .from('sales')
      .select('sale_date,platform,selling_price,sale_price,platform_fees,shipping_cost,vat_fees,other_costs,profit')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('sale_date', { ascending: false })
      .limit(limit);

    if (filters.dateFrom) q = q.gte('sale_date', filters.dateFrom);
    if (filters.dateTo)   q = q.lte('sale_date', filters.dateTo);
    if (filters.marketplace) q = q.eq('platform', filters.marketplace);

    const { data, error } = await q;
    if (error) throw new Error(error.message);

    // Aggregate by platform
    const byPlatform = new Map();

    for (const r of data || []) {
      const key = r.platform || 'other';
      const existing = byPlatform.get(key) || {
        platform: key,
        sales_count: 0,
        gross_revenue: 0,
        total_fees: 0,
        total_shipping: 0,
        total_vat: 0,
        net_profit: 0,
      };

      existing.sales_count    += 1;
      existing.gross_revenue  += Number(r.selling_price ?? r.sale_price ?? 0);
      existing.total_fees     += Number(r.platform_fees ?? 0);
      existing.total_shipping += Number(r.shipping_cost ?? 0);
      existing.total_vat      += Number(r.vat_fees ?? 0) + Number(r.other_costs ?? 0);
      existing.net_profit     += Number(r.profit ?? 0);
      byPlatform.set(key, existing);
    }

    return Array.from(byPlatform.values())
      .map((p) => {
        const total_deductions = p.total_fees + p.total_shipping + p.total_vat;
        const fee_rate = p.gross_revenue > 0 ? (p.total_fees / p.gross_revenue) * 100 : 0;
        return { ...p, total_deductions, fee_rate };
      })
      .sort((a, b) => b.gross_revenue - a.gross_revenue);
  },

  computeMetrics(rows) {
    const total_sales      = rows.reduce((s, r) => s + r.sales_count, 0);
    const total_gross      = rows.reduce((s, r) => s + r.gross_revenue, 0);
    const total_fees       = rows.reduce((s, r) => s + r.total_fees, 0);
    const total_shipping   = rows.reduce((s, r) => s + r.total_shipping, 0);
    const total_deductions = rows.reduce((s, r) => s + r.total_deductions, 0);
    const net_profit       = rows.reduce((s, r) => s + r.net_profit, 0);
    const avg_fee_rate     = total_gross > 0 ? (total_fees / total_gross) * 100 : 0;
    return { total_sales, total_gross, total_fees, total_shipping, total_deductions, avg_fee_rate, net_profit };
  },

  totalColumns: ['sales_count', 'gross_revenue', 'total_fees', 'total_shipping', 'total_vat', 'total_deductions', 'net_profit'],
};
