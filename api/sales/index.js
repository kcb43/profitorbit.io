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

function toNumberOrUndefined(v) {
  if (v === null || v === undefined || v === '') return undefined;
  const n = typeof v === 'string' ? Number(v) : Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function cleanUndefined(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj || {})) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

function normalizeSaleFromDb(row) {
  if (!row || typeof row !== 'object') return row;

  const toNumberOrNull = (v) => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const selling_price =
    row.selling_price ??
    row.sale_price ??
    row.salePrice ??
    null;
  const purchase_price =
    row.purchase_price ??
    row.purchasePrice ??
    null;
  return {
    ...row,
    // Always provide the fields the frontend expects:
    selling_price: toNumberOrNull(selling_price),
    purchase_price: toNumberOrNull(purchase_price),
    // Normalize numeric columns returned from Supabase (NUMERICs often come back as strings)
    sale_price: toNumberOrNull(row.sale_price ?? row.salePrice ?? null),
    profit: toNumberOrNull(row.profit ?? null),
    shipping_cost: toNumberOrNull(row.shipping_cost ?? row.shippingCost ?? 0) ?? 0,
    platform_fees: toNumberOrNull(row.platform_fees ?? row.platformFees ?? 0) ?? 0,
    vat_fees: toNumberOrNull(row.vat_fees ?? row.vatFees ?? 0) ?? 0,
    other_costs: toNumberOrNull(row.other_costs ?? row.otherCosts ?? 0) ?? 0,
  };
}

function buildSaleCandidates(body, userId) {
  const b = body || {};

  const sellingPrice = toNumberOrUndefined(
    b.selling_price ?? b.sellingPrice ?? b.sale_price ?? b.salePrice ?? b.price
  );
  const purchasePrice = toNumberOrUndefined(
    b.purchase_price ?? b.purchasePrice ?? b.cost
  );

  const base = cleanUndefined({
    user_id: userId,
    inventory_id: b.inventory_id ?? b.inventoryId ?? null,
    item_name: b.item_name ?? b.itemName ?? null,
    purchase_date: b.purchase_date ?? b.purchaseDate ?? null,
    sale_date: b.sale_date ?? b.saleDate ?? null,
    platform: b.platform ?? b.marketplace ?? null,
    source: b.source ?? null,
    category: b.category ?? null,
    quantity_sold: toNumberOrUndefined(b.quantity_sold ?? b.quantitySold),
    return_deadline: b.return_deadline ?? b.returnDeadline ?? null,
    shipping_cost: toNumberOrUndefined(b.shipping_cost ?? b.shippingCost) ?? 0,
    platform_fees: toNumberOrUndefined(b.platform_fees ?? b.platformFees) ?? 0,
    vat_fees: toNumberOrUndefined(b.vat_fees ?? b.vatFees) ?? 0,
    other_costs: toNumberOrUndefined(b.other_costs ?? b.otherCosts) ?? 0,
    profit: toNumberOrUndefined(b.profit),
    notes: b.notes ?? null,
    image_url: b.image_url ?? b.imageUrl ?? null,
    deleted_at: b.deleted_at ?? null,
  });

  // We don't know the exact deployed schema (some DBs have `selling_price`, others `sale_price`,
  // and `purchase_price` might not exist). Try a small set of compatible payloads.
  const candidates = [];

  const withPurchase = purchasePrice !== undefined
    ? { ...base, purchase_price: purchasePrice }
    : base;

  // Prefer frontend field names first.
  candidates.push(cleanUndefined({ ...withPurchase, selling_price: sellingPrice }));
  candidates.push(cleanUndefined({ ...base, selling_price: sellingPrice }));

  // Fallback to initial schema field name.
  candidates.push(cleanUndefined({ ...withPurchase, sale_price: sellingPrice }));
  candidates.push(cleanUndefined({ ...base, sale_price: sellingPrice }));

  // De-dupe identical candidates
  const seen = new Set();
  const unique = [];
  for (const c of candidates) {
    const key = JSON.stringify(c);
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(c);
    }
  }
  return unique;
}

function parsePositiveInt(value, { min = 1, max = 5000 } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n);
  if (i < min) return null;
  return Math.min(i, max);
}

function buildSelectFromFields(fieldsCsv) {
  if (!fieldsCsv) return '*';
  const allowed = new Set([
    'id',
    'user_id',
    'inventory_id',
    'item_name',
    'purchase_date',
    'sale_date',
    'platform',
    'source',
    'category',
    'quantity_sold',
    'return_deadline',
    'shipping_cost',
    'platform_fees',
    'vat_fees',
    'other_costs',
    'profit',
    'notes',
    'image_url',
    'deleted_at',
    'created_at',
    'selling_price',
    'sale_price',
    'purchase_price',
  ]);

  const fields = String(fieldsCsv)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((f) => allowed.has(f));

  return fields.length ? fields.join(',') : '*';
}

function isIsoLike(s) {
  if (!s) return false;
  const str = String(s);
  // Accept ISO date or datetime strings (best-effort).
  return /^\d{4}-\d{2}-\d{2}/.test(str);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-User-Id');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const userId = (await getUserIdFromRequest(req, supabase)) || getUserId(req);

  try {
    switch (req.method) {
      case 'GET':
        return handleGet(req, res, userId);
      case 'POST':
        return handlePost(req, res, userId);
      case 'PUT':
        return handlePut(req, res, userId);
      case 'DELETE':
        return handleDelete(req, res, userId);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Sales API error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

// GET /api/sales - List all sales
// GET /api/sales?id=xxx - Get single sale
async function handleGet(req, res, userId) {
  const { id, ...queryParams } = req.query;

  if (id) {
    const { data, error } = await supabase
      .from('sales')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .single();

    if (error) {
      return res.status(404).json({ error: 'Sale not found' });
    }

    return res.status(200).json(normalizeSaleFromDb(data));
  } else {
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }
    
    const limit = parsePositiveInt(queryParams.limit);
    const since = queryParams.since ? String(queryParams.since) : null;
    const from = queryParams.from ? String(queryParams.from) : null;
    const to = queryParams.to ? String(queryParams.to) : null;
    const select = buildSelectFromFields(queryParams.fields);

    let query = supabase
      .from('sales')
      .select(select)
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (since) {
      query = query.gte('sale_date', since);
    }
    if (from && isIsoLike(from)) {
      query = query.gte('sale_date', from);
    }
    if (to && isIsoLike(to)) {
      query = query.lte('sale_date', to);
    }

    // Handle sorting
    if (queryParams.sort) {
      const sortField = queryParams.sort.startsWith('-') 
        ? queryParams.sort.substring(1) 
        : queryParams.sort;
      const ascending = !queryParams.sort.startsWith('-');
      query = query.order(sortField, { ascending });
    } else {
      query = query.order('sale_date', { ascending: false });
    }

    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    let rows = (data || []).map(normalizeSaleFromDb);

    // Backfill missing sale.category from linked inventory item category (common when imports didn't populate sales.category).
    // Only runs when inventory_id is present on returned rows.
    try {
      const need = rows.filter((r) => !r?.category && r?.inventory_id).map((r) => r.inventory_id);
      const inventoryIds = Array.from(new Set(need)).filter(Boolean);
      if (inventoryIds.length > 0) {
        const invRes = await supabase
          .from('inventory_items')
          .select('id, category')
          .eq('user_id', userId)
          .in('id', inventoryIds);

        if (!invRes.error && Array.isArray(invRes.data)) {
          const map = new Map(invRes.data.map((it) => [it.id, it.category]));
          rows = rows.map((r) => {
            if (r?.category) return r;
            const cat = r?.inventory_id ? map.get(r.inventory_id) : null;
            return cat ? { ...r, category: cat } : r;
          });
        }
      }
    } catch (e) {
      // Non-fatal; reports can still fall back to Uncategorized.
      console.warn('Category backfill failed:', e?.message || e);
    }

    return res.status(200).json(rows);
  }
}

// POST /api/sales - Create new sale
async function handlePost(req, res, userId) {
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const candidates = buildSaleCandidates(req.body, userId);
  let lastError = null;

  for (const saleData of candidates) {
    const { data, error } = await supabase
      .from('sales')
      .insert([saleData])
      .select()
      .single();

    if (!error) {
      return res.status(201).json(normalizeSaleFromDb(data));
    }

    lastError = error;

    // If it's a schema column mismatch, try the next candidate.
    const msg = String(error.message || '');
    const isMissingColumn =
      msg.includes("Could not find the 'purchase_price' column") ||
      msg.includes("Could not find the 'selling_price' column") ||
      msg.includes("Could not find the 'sale_price' column");
    if (isMissingColumn) continue;

    // Any other error should fail fast.
    return res.status(400).json({ error: error.message });
  }

  return res.status(400).json({ error: lastError?.message || 'Failed to insert sale' });
}

// PUT /api/sales?id=xxx - Update sale
async function handlePut(req, res, userId) {
  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Sale ID required' });
  }

  // Reuse the candidate builder, but without overriding user_id.
  const body = { ...(req.body || {}) };
  delete body.id;
  delete body.user_id;
  delete body.created_at;

  const candidates = buildSaleCandidates(body, undefined).map((c) => {
    // Ensure we never attempt to change ownership.
    delete c.user_id;
    return c;
  });

  let lastError = null;
  for (const updateData of candidates) {
    const { data, error } = await supabase
      .from('sales')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (!error) {
      if (!data) return res.status(404).json({ error: 'Sale not found' });
      return res.status(200).json(normalizeSaleFromDb(data));
    }

    lastError = error;
    const msg = String(error.message || '');
    const isMissingColumn =
      msg.includes("Could not find the 'purchase_price' column") ||
      msg.includes("Could not find the 'selling_price' column") ||
      msg.includes("Could not find the 'sale_price' column");
    if (isMissingColumn) continue;

    return res.status(400).json({ error: error.message });
  }

  return res.status(400).json({ error: lastError?.message || 'Failed to update sale' });
}

// DELETE /api/sales?id=xxx - Delete sale (soft delete)
async function handleDelete(req, res, userId) {
  const { id, hard } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Sale ID required' });
  }

  if (hard === 'true') {
    const { error } = await supabase
      .from('sales')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({ success: true });
  } else {
    const { data, error } = await supabase
      .from('sales')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    if (!data) {
      return res.status(404).json({ error: 'Sale not found' });
    }

    return res.status(200).json(data);
  }
}

