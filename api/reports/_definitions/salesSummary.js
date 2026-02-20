/**
 * Sales Summary report definition
 * Rows: individual sales with revenue, fees, shipping, cost, profit
 */

export default {
  id: 'sales-summary',
  title: 'Sales Summary',
  description: 'Individual sale transactions with revenue, fees, shipping costs, and net profit breakdown.',
  category: 'Sales',

  defaultFilters: {
    dateFrom: null,
    dateTo: null,
    marketplace: '',
    includeReturns: false,
  },

  columns: [
    { key: 'sale_date',       label: 'Sale Date',    format: 'date'     },
    { key: 'platform',        label: 'Platform',     format: 'text'     },
    { key: 'item_name',       label: 'Item',         format: 'text'     },
    { key: 'category',        label: 'Category',     format: 'text'     },
    { key: 'selling_price',   label: 'Sale Price',   format: 'currency' },
    { key: 'platform_fees',   label: 'Fees',         format: 'currency' },
    { key: 'shipping_cost',   label: 'Shipping',     format: 'currency' },
    { key: 'purchase_price',  label: 'Cost Basis',   format: 'currency' },
    { key: 'profit',          label: 'Net Profit',   format: 'currency' },
  ],

  metricsDefinition: [
    { key: 'row_count',      label: 'Items Sold',     format: 'number'   },
    { key: 'total_gross',    label: 'Gross Revenue',  format: 'currency' },
    { key: 'total_fees',     label: 'Total Fees',     format: 'currency' },
    { key: 'total_shipping', label: 'Shipping Paid',  format: 'currency' },
    { key: 'total_cost',     label: 'Total Cost',     format: 'currency' },
    { key: 'total_net',      label: 'Net Profit',     format: 'currency' },
    { key: 'avg_profit',     label: 'Avg Profit/Sale',format: 'currency' },
    { key: 'profit_margin',  label: 'Profit Margin',  format: 'percent'  },
  ],

  async fetchRows(supabase, userId, filters, { limit = 10000 } = {}) {
    let q = supabase
      .from('sales')
      .select('id,sale_date,platform,item_name,category,selling_price,sale_price,platform_fees,shipping_cost,purchase_price,profit')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('sale_date', { ascending: false })
      .limit(limit);

    if (filters.dateFrom) q = q.gte('sale_date', filters.dateFrom);
    if (filters.dateTo)   q = q.lte('sale_date', filters.dateTo);
    if (filters.marketplace) q = q.eq('platform', filters.marketplace);

    const { data, error } = await q;
    if (error) throw new Error(error.message);

    return (data || []).map((r) => ({
      id:             r.id,
      sale_date:      r.sale_date,
      platform:       r.platform || '',
      item_name:      r.item_name || '',
      category:       r.category || 'Uncategorized',
      selling_price:  Number(r.selling_price ?? r.sale_price ?? 0),
      platform_fees:  Number(r.platform_fees ?? 0),
      shipping_cost:  Number(r.shipping_cost ?? 0),
      purchase_price: Number(r.purchase_price ?? 0),
      profit:         Number(r.profit ?? 0),
    }));
  },

  computeMetrics(rows) {
    const row_count      = rows.length;
    const total_gross    = rows.reduce((s, r) => s + r.selling_price, 0);
    const total_fees     = rows.reduce((s, r) => s + r.platform_fees, 0);
    const total_shipping = rows.reduce((s, r) => s + r.shipping_cost, 0);
    const total_cost     = rows.reduce((s, r) => s + r.purchase_price, 0);
    const total_net      = rows.reduce((s, r) => s + r.profit, 0);
    const avg_profit     = row_count > 0 ? total_net / row_count : 0;
    const profit_margin  = total_gross > 0 ? (total_net / total_gross) * 100 : 0;
    return { row_count, total_gross, total_fees, total_shipping, total_cost, total_net, avg_profit, profit_margin };
  },

  // Columns to sum in the Excel totals row
  totalColumns: ['selling_price', 'platform_fees', 'shipping_cost', 'purchase_price', 'profit'],
};
