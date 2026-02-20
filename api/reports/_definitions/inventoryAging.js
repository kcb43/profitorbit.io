/**
 * Inventory Aging report definition
 * Rows: active inventory items with days listed, cost, and aging bucket
 */

export default {
  id: 'inventory-aging',
  title: 'Inventory Aging',
  description: 'Active inventory items showing how long each has been sitting unsold.',
  category: 'Inventory',

  defaultFilters: {
    ageBucket: '',    // '30', '60', '90', '90+'
    status: 'available',
  },

  columns: [
    { key: 'item_name',      label: 'Item',             format: 'text'     },
    { key: 'category',       label: 'Category',         format: 'text'     },
    { key: 'purchase_date',  label: 'Acquired',         format: 'date'     },
    { key: 'days_held',      label: 'Days in Inventory',format: 'number'   },
    { key: 'age_bucket',     label: 'Age Bucket',       format: 'text'     },
    { key: 'purchase_price', label: 'Cost Basis',       format: 'currency' },
    { key: 'status',         label: 'Status',           format: 'text'     },
    { key: 'source',         label: 'Source',           format: 'text'     },
  ],

  metricsDefinition: [
    { key: 'total_items',    label: 'Total Items',       format: 'number'   },
    { key: 'total_cost',     label: 'Capital at Risk',   format: 'currency' },
    { key: 'avg_days',       label: 'Avg Days Held',     format: 'number'   },
    { key: 'items_over_90',  label: 'Items 90+ Days',    format: 'number'   },
    { key: 'cost_over_90',   label: 'Cost 90+ Days',     format: 'currency' },
    { key: 'oldest_days',    label: 'Oldest Item (days)',format: 'number'   },
  ],

  async fetchRows(supabase, userId, filters, { limit = 10000 } = {}) {
    let q = supabase
      .from('inventory_items')
      .select('id,item_name,category,purchase_date,purchase_price,status,source')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('purchase_date', { ascending: true })
      .limit(limit);

    if (filters.status) q = q.eq('status', filters.status);

    const { data, error } = await q;
    if (error) throw new Error(error.message);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const rows = (data || []).map((r) => {
      let days_held = 0;
      if (r.purchase_date) {
        const pd = new Date(r.purchase_date);
        days_held = Math.max(0, Math.floor((today - pd) / (1000 * 60 * 60 * 24)));
      }

      let age_bucket;
      if (days_held <= 30) age_bucket = '0–30 days';
      else if (days_held <= 60) age_bucket = '31–60 days';
      else if (days_held <= 90) age_bucket = '61–90 days';
      else age_bucket = '90+ days';

      return {
        item_name:      r.item_name || '',
        category:       r.category || 'Uncategorized',
        purchase_date:  r.purchase_date,
        days_held,
        age_bucket,
        purchase_price: Number(r.purchase_price ?? 0),
        status:         r.status || '',
        source:         r.source || '',
      };
    });

    // Filter by age bucket if specified
    if (filters.ageBucket === '30')   return rows.filter((r) => r.days_held <= 30);
    if (filters.ageBucket === '60')   return rows.filter((r) => r.days_held > 30 && r.days_held <= 60);
    if (filters.ageBucket === '90')   return rows.filter((r) => r.days_held > 60 && r.days_held <= 90);
    if (filters.ageBucket === '90+')  return rows.filter((r) => r.days_held > 90);

    return rows;
  },

  computeMetrics(rows) {
    const total_items  = rows.length;
    const total_cost   = rows.reduce((s, r) => s + r.purchase_price, 0);
    const avg_days     = total_items > 0 ? rows.reduce((s, r) => s + r.days_held, 0) / total_items : 0;
    const over90       = rows.filter((r) => r.days_held > 90);
    const items_over_90= over90.length;
    const cost_over_90 = over90.reduce((s, r) => s + r.purchase_price, 0);
    const oldest_days  = rows.reduce((max, r) => Math.max(max, r.days_held), 0);
    return { total_items, total_cost, avg_days, items_over_90, cost_over_90, oldest_days };
  },

  totalColumns: ['purchase_price', 'days_held'],
};
