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

function buildSelectFromFields(fieldsCsv) {
  if (!fieldsCsv) return '*';
  const allowed = new Set([
    'id',
    'user_id',
    'item_name',
    'purchase_price',
    'purchase_date',
    'source',
    'status',
    'category',
    'notes',
    'image_url',
    'images',
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
  ]);

  const fields = String(fieldsCsv)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((f) => allowed.has(f));

  return fields.length ? fields.join(',') : '*';
}

function normalizeImagesFromBody(body) {
  const b = { ...(body || {}) };

  // `photos` is a UI-only concept; normalize it into `images` (string URL[]) + `image_url` (main image)
  if (Array.isArray(b.photos) && !Array.isArray(b.images)) {
    const urls = b.photos
      .map((p) => (typeof p === 'string' ? p : (p?.imageUrl || p?.url || p?.image_url)))
      .filter(Boolean);
    b.images = urls;

    const main = b.photos.find((p) => typeof p === 'object' && p?.isMain);
    if (!b.image_url) {
      b.image_url = (typeof main === 'object' ? (main?.imageUrl || main?.url || main?.image_url) : null) || urls[0] || b.image_url || '';
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

  // Never send UI-only field to Supabase (avoids "column does not exist" errors).
  delete b.photos;

  return b;
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
    const select = buildSelectFromFields(queryParams.fields);
    const { data, error } = await supabase
      .from('inventory_items')
      .select(select)
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error) {
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
    const limit = parsePositiveInt(queryParams.limit);
    const select = buildSelectFromFields(queryParams.fields);

    let query = supabase
      .from('inventory_items')
      .select(select)
      .eq('user_id', userId);

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
      query = query.limit(limit);
    }

    const { data, error } = await query;

    if (error) {
      return res.status(500).json({ error: error.message });
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

  const { data, error } = await supabase
    .from('inventory_items')
    .insert([itemData])
    .select()
    .single();

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

  const { data, error } = await supabase
    .from('inventory_items')
    .update(updateData)
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

