import { createClient } from '@supabase/supabase-js';
import { getUserIdFromRequest } from '../_utils/auth.js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('⚠️ Supabase environment variables not configured');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

function getUserId(req) {
  return req.headers['x-user-id'] || null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-User-Id');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = (await getUserIdFromRequest(req, supabase)) || getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Prefer SQL RPC (fast + reliable across schema variants).
    const rpcRes = await supabase.rpc('po_sales_summary', { p_user_id: userId });
    if (!rpcRes.error) {
      const row = Array.isArray(rpcRes.data) ? rpcRes.data[0] : rpcRes.data;
      return res.status(200).json({
        totalProfit: Number(row?.total_profit ?? 0) || 0,
        totalRevenue: Number(row?.total_revenue ?? 0) || 0,
        totalSales: Number(row?.total_sales ?? 0) || 0,
      });
    }

    // If the function doesn't exist yet (migration not run), fall back to PostgREST aggregates.
    const rpcMsg = String(rpcRes.error?.message || '');
    const isMissingFn =
      rpcMsg.includes('function') && (rpcMsg.includes('does not exist') || rpcMsg.includes('not found'));
    if (!isMissingFn) {
      return res.status(500).json({ error: rpcRes.error.message });
    }

    // PostgREST aggregates (fast, server-side) — tolerate either `selling_price` or `sale_price`.
    const candidates = [
      'profit_sum:profit.sum(), revenue_sum:selling_price.sum(), sales_count:id.count()',
      'profit_sum:profit.sum(), revenue_sum:sale_price.sum(), sales_count:id.count()',
      'profit_sum:profit.sum(), sales_count:id.count()',
    ];

    let data = null;
    let lastError = null;

    for (const select of candidates) {
      // eslint-disable-next-line no-await-in-loop
      const res2 = await supabase
        .from('sales')
        .select(select)
        .eq('user_id', userId)
        .is('deleted_at', null);

      if (!res2.error) {
        data = res2.data;
        lastError = null;
        break;
      }

      lastError = res2.error;
      const msg = String(res2.error.message || '');
      const isMissingColumn =
        msg.includes("Could not find the 'selling_price' column") ||
        msg.includes("Could not find the 'sale_price' column");
      if (!isMissingColumn) break;
    }

    if (lastError) {
      return res.status(500).json({ error: lastError.message });
    }

    const row = Array.isArray(data) ? data[0] : data;
    const totalProfit = Number(row?.profit_sum ?? 0) || 0;
    const totalRevenue = Number(row?.revenue_sum ?? 0) || 0;
    const totalSales = Number(row?.sales_count ?? 0) || 0;

    return res.status(200).json({
      totalProfit,
      totalRevenue,
      totalSales,
    });
  } catch (e) {
    console.error('Sales summary API error:', e);
    return res.status(500).json({ error: e?.message || 'Internal server error' });
  }
}


