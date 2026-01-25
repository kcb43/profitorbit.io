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

  const toNumberOr0 = (v, fallback = 0) => {
    if (v === null || v === undefined || v === '') return fallback;
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
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
    selling_price: toNumberOr0(selling_price, 0),
    purchase_price: toNumberOr0(purchase_price, 0),
    // Normalize numeric columns returned from Supabase (NUMERICs often come back as strings)
    sale_price: toNumberOr0(row.sale_price ?? row.salePrice ?? null, 0),
    profit: toNumberOr0(row.profit ?? null, 0),
    shipping_cost: toNumberOr0(row.shipping_cost ?? row.shippingCost ?? 0, 0),
    platform_fees: toNumberOr0(row.platform_fees ?? row.platformFees ?? 0, 0),
    vat_fees: toNumberOr0(row.vat_fees ?? row.vatFees ?? 0, 0),
    other_costs: toNumberOr0(row.other_costs ?? row.otherCosts ?? 0, 0),
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

function parseNonNegativeInt(value, { min = 0, max = 500000 } = {}) {
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
    // When fetching by ID, allow deleted sales (user might be viewing a deleted sale detail page)
    const { data, error } = await supabase
      .from('sales')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
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
    const offset = parseNonNegativeInt(queryParams.offset);
    const paged = String(queryParams.paged || '').toLowerCase() === 'true';
    const wantCount = String(queryParams.count || '').toLowerCase() === 'true' || paged;
    const since = queryParams.since ? String(queryParams.since) : null;
    const from = queryParams.from ? String(queryParams.from) : null;
    const to = queryParams.to ? String(queryParams.to) : null;
    const includeDeleted = String(queryParams.include_deleted || '').toLowerCase() === 'true';
    const deletedOnly = String(queryParams.deleted_only || '').toLowerCase() === 'true';
    const search = queryParams.search ? String(queryParams.search).trim() : '';
    const category = queryParams.category ? String(queryParams.category).trim() : '';
    const needsReview = String(queryParams.needs_review || '').toLowerCase() === 'true';
    const platform = queryParams.platform ? String(queryParams.platform).trim() : '';
    const minProfit = queryParams.min_profit !== undefined ? Number(queryParams.min_profit) : null;
    const maxProfit = queryParams.max_profit !== undefined ? Number(queryParams.max_profit) : null;
    const select = buildSelectFromFields(queryParams.fields);

    let query = supabase
      .from('sales')
      .select(select, wantCount ? { count: 'exact' } : undefined)
      .eq('user_id', userId);

    // Default behavior: hide deleted unless explicitly requested.
    if (deletedOnly) {
      query = query.not('deleted_at', 'is', null);
    } else if (!includeDeleted) {
      query = query.is('deleted_at', null);
    }

    if (since) {
      query = query.gte('sale_date', since);
    }
    if (from && isIsoLike(from)) {
      query = query.gte('sale_date', from);
    }
    if (to && isIsoLike(to)) {
      query = query.lte('sale_date', to);
    }

    if (search) {
      // Allow searching by item name, category, or source (UI expects this).
      const q = `%${search}%`;
      query = query.or(`item_name.ilike.${q},category.ilike.${q},source.ilike.${q}`);
    }
    if (category) {
      if (category === '__uncategorized') {
        // Prefer NULL (most common). Empty-string categories are rare.
        query = query.is('category', null);
      } else {
        query = query.eq('category', category);
      }
    }
    if (needsReview) {
      // NOTE: This is an OR filter. UI should avoid combining needs_review with searchTerm.
      // We intentionally do NOT include inventory_id here — many older rows may not have it,
      // and that would make "Needs Review" too broad and appear to "do nothing".
      query = query.or('purchase_date.is.null,source.is.null,category.is.null');
    }
    if (platform) {
      query = query.eq('platform', platform);
    }
    if (Number.isFinite(minProfit)) {
      query = query.gte('profit', minProfit);
    }
    if (Number.isFinite(maxProfit)) {
      query = query.lte('profit', maxProfit);
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

    const finalLimit = limit || (paged ? 50 : null);
    if (finalLimit) {
      if (offset !== null && offset !== undefined) {
        query = query.range(offset, offset + finalLimit - 1);
      } else {
        query = query.limit(finalLimit);
      }
    }

    const { data, error, count } = await query;

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    let rows = (data || []).map(normalizeSaleFromDb);

    // Backfill missing sale.category from inventory item category.
    // 1) Prefer exact inventory_id links
    // 2) Fallback: exact item_name match when unique (helps older imports where inventory_id is null)
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

      const nameNeed = rows
        .filter((r) => !r?.category && !r?.inventory_id && r?.item_name)
        .map((r) => String(r.item_name));
      const itemNames = Array.from(new Set(nameNeed)).filter(Boolean).slice(0, 2000);
      if (itemNames.length > 0) {
        const invByName = await supabase
          .from('inventory_items')
          .select('item_name, category')
          .eq('user_id', userId)
          .in('item_name', itemNames)
          .is('deleted_at', null);

        if (!invByName.error && Array.isArray(invByName.data)) {
          const buckets = new Map();
          for (const it of invByName.data) {
            const name = it?.item_name ? String(it.item_name) : null;
            const cat = it?.category ?? null;
            if (!name || !cat) continue;
            if (!buckets.has(name)) buckets.set(name, new Set());
            buckets.get(name).add(cat);
          }
          rows = rows.map((r) => {
            if (r?.category || r?.inventory_id || !r?.item_name) return r;
            const set = buckets.get(String(r.item_name));
            if (!set || set.size !== 1) return r; // only fill when unambiguous
            const [cat] = Array.from(set);
            return cat ? { ...r, category: cat } : r;
          });
        }
      }
    } catch (e) {
      // Non-fatal; reports can still fall back to Uncategorized.
      console.warn('Category backfill failed:', e?.message || e);
    }

    if (paged) {
      return res.status(200).json({
        data: rows,
        total: typeof count === 'number' ? count : null,
        limit: finalLimit || null,
        offset: offset || 0,
      });
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

