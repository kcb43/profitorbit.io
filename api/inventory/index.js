import { createClient } from '@supabase/supabase-js';
import { getUserIdFromRequest } from '../_utils/auth.js';

// Initialize Supabase client for server-side use
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use service role key for admin access

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('⚠️ Supabase environment variables not configured');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
    'item_name',
    'brand',
    'condition',
    'size',
    'sku',
    'zip_code',
    'color1',
    'color2',
    'package_details',
    'package_weight',
    'package_length',
    'package_width',
    'package_height',
    'purchase_price',
    'listing_price',
    'purchase_date',
    'source',
    'status',
    'category',
    'notes',
    'description',
    'image_url',
    'images',
    'photos',
    'quantity',
    'quantity_sold',
    'return_deadline',
    'return_deadline_dismissed',
    'deleted_at',
    'created_at',
    'updated_at',
    // crosslist fields that may exist in some schemas
    'ebay_listing_id',
    'facebook_listing_id',
    'mercari_listing_id',
    'marketplace_listings',
    // marketplace item IDs (for dedup on import)
    'ebay_item_id',
    'mercari_item_id',
    'facebook_item_id',
    // tags + fulfillment
    'internal_tags',
    'listing_keywords',
    'is_favorite',
  ]);

  const fields = String(fieldsCsv)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((f) => allowed.has(f));

  return fields.length ? fields.join(',') : '*';
}

function extractMissingColumnFromSupabaseError(message) {
  const msg = String(message || '');
  // Example: Could not find the 'images' column of 'inventory_items' in the schema cache
  const m1 = msg.match(/Could not find the '([^']+)' column of 'inventory_items'/i);
  if (m1?.[1]) return m1[1];
  // Example: column inventory_items.images does not exist
  const m2 = msg.match(/column\s+(?:inventory_items\.)?("?)([a-zA-Z0-9_]+)\1\s+does not exist/i);
  if (m2?.[2]) return m2[2];
  return null;
}

function stripColumnFromSelect(select, col) {
  const s = String(select || '').trim();
  if (!s || s === '*') return s;
  const parts = s.split(',').map((p) => p.trim()).filter(Boolean);
  const next = parts.filter((p) => p !== col);
  return next.length ? next.join(',') : '*';
}

function normalizeImagesFromBody(body) {
  const b = { ...(body || {}) };

  // `photos` is a rich array of photo objects. Normalize it into:
  // - `photos` (jsonb array of objects)
  // - `images` (string URL[])
  // - `image_url` (main image)
  if (Array.isArray(b.photos)) {
    const normalizedPhotos = b.photos
      .filter(Boolean)
      .map((p, idx) => {
        if (typeof p === 'string') {
          return { id: `img_${idx}`, imageUrl: p, isMain: idx === 0 };
        }
        const imageUrl = p?.imageUrl || p?.url || p?.image_url || p?.preview;
        return {
          id: p?.id || `img_${idx}`,
          imageUrl,
          isMain: Boolean(p?.isMain ?? idx === 0),
          fileName: p?.fileName,
        };
      })
      .filter((p) => Boolean(p?.imageUrl));

    b.photos = normalizedPhotos;
    if (!Array.isArray(b.images)) {
      b.images = normalizedPhotos.map((p) => p.imageUrl).filter(Boolean);
    }
    if (!b.image_url) {
      const main = normalizedPhotos.find((p) => p?.isMain) || normalizedPhotos[0];
      b.image_url = main?.imageUrl || b.image_url || '';
    }
  }

  // If we already have images, ensure it is a string array and backfill image_url.
  if (Array.isArray(b.images)) {
    b.images = b.images
      .map((img) => (typeof img === 'string' ? img : (img?.imageUrl || img?.url || img?.image_url)))
      .filter(Boolean);
    if (!b.image_url && b.images.length > 0) {
      b.image_url = b.images[0];
    }
  }

  return b;
}

async function insertWithOptionalPhotos(table, row) {
  let attemptRow = { ...(row || {}) };
  let lastErr = null;

  for (let attempt = 0; attempt < 5; attempt++) {
    // eslint-disable-next-line no-await-in-loop
    const { data, error } = await supabase.from(table).insert([attemptRow]).select().single();
    if (!error) return { data, error: null };
    lastErr = error;
    const missing = extractMissingColumnFromSupabaseError(error.message);
    if (!missing) break;
    if (!(missing in attemptRow)) break;
    const next = { ...attemptRow };
    delete next[missing];
    attemptRow = next;
  }

  return { data: null, error: lastErr };
}

async function updateWithOptionalPhotos(table, id, userId, patch) {
  let attemptPatch = { ...(patch || {}) };
  let lastErr = null;

  for (let attempt = 0; attempt < 5; attempt++) {
    // eslint-disable-next-line no-await-in-loop
    const { data, error } = await supabase
      .from(table)
      .update(attemptPatch)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();
    if (!error) return { data, error: null };
    lastErr = error;
    const missing = extractMissingColumnFromSupabaseError(error.message);
    if (!missing) break;
    if (!(missing in attemptPatch)) break;
    const next = { ...attemptPatch };
    delete next[missing];
    attemptPatch = next;
  }

  return { data: null, error: lastErr };
}

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-User-Id');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const userId = await getUserIdFromRequest(req, supabase);

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
    console.error('Inventory API error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

// GET /api/inventory - List all inventory items
// GET /api/inventory?id=xxx - Get single item
async function handleGet(req, res, userId) {
  const { id, ...queryParams } = req.query;

  if (id) {
    // Get single item
    let select = buildSelectFromFields(queryParams.fields);
    let lastError = null;
    let data = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      // eslint-disable-next-line no-await-in-loop
      const res1 = await supabase
        .from('inventory_items')
        .select(select)
        .eq('id', id)
        .eq('user_id', userId)
        .single();
      if (!res1.error) {
        data = res1.data;
        lastError = null;
        break;
      }
      lastError = res1.error;
      const missing = extractMissingColumnFromSupabaseError(res1.error.message);
      if (!missing) break;
      const next = stripColumnFromSelect(select, missing);
      if (next === select) break;
      select = next;
    }

    if (lastError) {
      return res.status(404).json({ error: 'Item not found' });
    }

    return res.status(200).json(data);
  } else {
    // List all items
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }
    
    const includeDeleted = String(queryParams.include_deleted || '').toLowerCase() === 'true';
    const deletedOnly = String(queryParams.deleted_only || '').toLowerCase() === 'true';
    // Back-compat: if client passes limit/offset/count, treat it as a paged request.
    const paged =
      String(queryParams.paged || '').toLowerCase() === 'true' ||
      queryParams.offset !== undefined ||
      String(queryParams.count || '').toLowerCase() === 'true';
    const wantCount = String(queryParams.count || '').toLowerCase() === 'true' || paged;
    const limit = parsePositiveInt(queryParams.limit) || (paged ? 50 : null);
    const offset = parseNonNegativeInt(queryParams.offset);
    let select = buildSelectFromFields(queryParams.fields);
    const search = queryParams.search ? String(queryParams.search).trim() : '';
    const status = queryParams.status ? String(queryParams.status).trim() : '';
    const excludeStatus = queryParams.exclude_status ? String(queryParams.exclude_status).trim() : '';
    const categoryFilter = queryParams.category ? String(queryParams.category).trim() : '';
    const idsCsv = queryParams.ids ? String(queryParams.ids) : '';
    const ids = idsCsv
      ? idsCsv.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 5000)
      : null;

    const runQuery = async (selectStr) => {
      let query = supabase
        .from('inventory_items')
        .select(selectStr, wantCount ? { count: 'exact' } : undefined)
        .eq('user_id', userId);

      if (ids && ids.length) {
        query = query.in('id', ids);
      }

      if (search) {
        // Allow searching by item name, category, or source (UI expects this).
        const q = `%${search}%`;
        query = query.or(`item_name.ilike.${q},category.ilike.${q},source.ilike.${q}`);
      }

      if (categoryFilter) {
        if (categoryFilter === '__uncategorized__') {
          query = query.or('category.is.null,category.eq.');
        } else {
          query = query.eq('category', categoryFilter);
        }
      }

      if (status) {
        query = query.eq('status', status);
      }

      if (excludeStatus) {
        query = query.neq('status', excludeStatus);
      }

      // Default behavior: hide deleted items unless explicitly requested.
      if (deletedOnly) {
        query = query.not('deleted_at', 'is', null);
      } else if (!includeDeleted) {
        query = query.is('deleted_at', null);
      }

      // Handle sorting
      if (queryParams.sort) {
        const sortField = queryParams.sort.startsWith('-')
          ? queryParams.sort.substring(1)
          : queryParams.sort;
        const ascending = !queryParams.sort.startsWith('-');
        query = query.order(sortField, { ascending });
      } else {
        query = query.order('purchase_date', { ascending: false });
      }

      if (limit) {
        if (offset !== null && offset !== undefined) {
          query = query.range(offset, offset + limit - 1);
        } else {
          query = query.limit(limit);
        }
      }

      // Execute the query here so callers can reliably destructure { data, error, count }.
      return await query;
    };

    let data = null;
    let count = null;
    let lastError = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      // eslint-disable-next-line no-await-in-loop
      const { data: d, error: e, count: c } = await runQuery(select);
      if (!e) {
        data = d || [];
        count = c;
        lastError = null;
        break;
      }
      lastError = e;
      const missing = extractMissingColumnFromSupabaseError(e.message);
      if (!missing) break;
      const next = stripColumnFromSelect(select, missing);
      if (next === select) break;
      select = next;
    }

    if (lastError) {
      return res.status(500).json({ error: lastError.message });
    }

    if (paged) {
      return res.status(200).json({
        data: data || [],
        total: typeof count === 'number' ? count : null,
        limit: limit || null,
        offset: offset || 0,
      });
    }

    return res.status(200).json(data || []);
  }
}

// POST /api/inventory - Create new inventory item
async function handlePost(req, res, userId) {
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const normalized = normalizeImagesFromBody(req.body);
  const itemData = {
    ...normalized,
    user_id: userId,
  };

  const { data, error } = await insertWithOptionalPhotos('inventory_items', itemData);

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  return res.status(201).json(data);
}

// PUT /api/inventory?id=xxx - Update inventory item
async function handlePut(req, res, userId) {
  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Item ID required' });
  }

  const updateData = normalizeImagesFromBody(req.body);
  delete updateData.id; // Don't allow ID updates
  delete updateData.user_id; // Don't allow user_id updates
  delete updateData.created_at; // Don't allow created_at updates

  const { data, error } = await updateWithOptionalPhotos('inventory_items', id, userId, updateData);

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  if (!data) {
    return res.status(404).json({ error: 'Item not found' });
  }

  return res.status(200).json(data);
}

// DELETE /api/inventory?id=xxx - Delete inventory item (soft delete)
async function handleDelete(req, res, userId) {
  const { id, hard } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Item ID required' });
  }

  if (hard === 'true') {
    // Hard delete
    const { error } = await supabase
      .from('inventory_items')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({ success: true });
  } else {
    // Soft delete
    const { data, error } = await supabase
      .from('inventory_items')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    if (!data) {
      return res.status(404).json({ error: 'Item not found' });
    }

    return res.status(200).json(data);
  }
}

