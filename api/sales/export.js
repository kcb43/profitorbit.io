import { createClient } from '@supabase/supabase-js';
import { getUserIdFromRequest } from '../_utils/auth.js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

function csvEscape(v) {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function parsePositiveInt(value, { min = 1, max = 5000 } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n);
  if (i < min) return null;
  return Math.min(i, max);
}

function isIsoLike(s) {
  if (!s) return false;
  const str = String(s);
  return /^\d{4}-\d{2}-\d{2}/.test(str);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-User-Id');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const userId = await getUserIdFromRequest(req, supabase);
  if (!userId) return res.status(401).json({ error: 'User ID required' });

  const includeDeleted = String(req.query.include_deleted || '').toLowerCase() === 'true';
  const deletedOnly = String(req.query.deleted_only || '').toLowerCase() === 'true';
  const search = req.query.search ? String(req.query.search).trim() : '';
  const category = req.query.category ? String(req.query.category).trim() : '';
  const needsReview = String(req.query.needs_review || '').toLowerCase() === 'true';
  const platform = req.query.platform ? String(req.query.platform).trim() : '';
  const from = req.query.from ? String(req.query.from) : null;
  const to = req.query.to ? String(req.query.to) : null;
  const minProfit = req.query.min_profit !== undefined ? Number(req.query.min_profit) : null;
  const maxProfit = req.query.max_profit !== undefined ? Number(req.query.max_profit) : null;
  const limit = parsePositiveInt(req.query.limit) || 5000;

  const columns = [
    'id',
    'item_name',
    'platform',
    'category',
    'purchase_date',
    'sale_date',
    'purchase_price',
    'selling_price',
    'sale_price',
    'profit',
    'shipping_cost',
    'platform_fees',
    'vat_fees',
    'other_costs',
    'notes',
    'image_url',
    'deleted_at',
    'created_at',
  ];

  let query = supabase
    .from('sales')
    .select(columns.join(','))
    .eq('user_id', userId);

  if (deletedOnly) query = query.not('deleted_at', 'is', null);
  else if (!includeDeleted) query = query.is('deleted_at', null);

  if (from && isIsoLike(from)) query = query.gte('sale_date', from);
  if (to && isIsoLike(to)) query = query.lte('sale_date', to);
  // NOTE: needs_review uses OR server-side; avoid combining with searchTerm to keep semantics clean.
  if (!needsReview && search) query = query.or(`item_name.ilike.%${search}%,category.ilike.%${search}%,source.ilike.%${search}%`);
  if (category) {
    if (category === '__uncategorized') query = query.is('category', null);
    else query = query.eq('category', category);
  }
  if (needsReview) query = query.or('inventory_id.is.null,purchase_date.is.null,source.is.null,category.is.null');
  if (platform) query = query.eq('platform', platform);
  if (Number.isFinite(minProfit)) query = query.gte('profit', minProfit);
  if (Number.isFinite(maxProfit)) query = query.lte('profit', maxProfit);

  query = query.order('sale_date', { ascending: false }).limit(limit);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  const rows = Array.isArray(data) ? data : [];
  const header = columns.join(',');
  const body = rows
    .map((row) => columns.map((c) => csvEscape(row?.[c])).join(','))
    .join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="sales-export.csv"');
  return res.status(200).send([header, body].filter(Boolean).join('\n'));
}


