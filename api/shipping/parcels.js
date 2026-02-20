/**
 * /api/shipping/parcels
 * CRUD for parcel presets
 */
import { createClient } from '@supabase/supabase-js';
import { getUserIdFromRequest } from '../_utils/auth.js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-User-Id');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const userId = await getUserIdFromRequest(req, supabase);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    switch (req.method) {
      case 'GET':    return handleGet(req, res, userId);
      case 'POST':   return handlePost(req, res, userId);
      case 'PUT':    return handlePut(req, res, userId);
      case 'DELETE': return handleDelete(req, res, userId);
      default:       return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (err) {
    console.error('Parcels API error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}

async function handleGet(req, res, userId) {
  const { data, error } = await supabase
    .from('parcel_presets')
    .select('*')
    .eq('user_id', userId)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json(data || []);
}

async function handlePost(req, res, userId) {
  const b = req.body || {};

  if (b.is_default) {
    await supabase
      .from('parcel_presets')
      .update({ is_default: false })
      .eq('user_id', userId);
  }

  const { data, error } = await supabase
    .from('parcel_presets')
    .insert([{
      user_id:       userId,
      name:          b.name,
      length:        Number(b.length) || 0,
      width:         Number(b.width) || 0,
      height:        Number(b.height) || 0,
      distance_unit: b.distance_unit || 'in',
      weight:        Number(b.weight) || 0,
      mass_unit:     b.mass_unit || 'lb',
      is_default:    b.is_default || false,
    }])
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  return res.status(201).json(data);
}

async function handlePut(req, res, userId) {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Parcel ID required' });

  const b = req.body || {};

  if (b.is_default) {
    await supabase
      .from('parcel_presets')
      .update({ is_default: false })
      .eq('user_id', userId);
  }

  const allowed = ['name', 'length', 'width', 'height', 'distance_unit', 'weight', 'mass_unit', 'is_default'];
  const updates = {};
  for (const k of allowed) {
    if (b[k] !== undefined) updates[k] = b[k];
  }

  const { data, error } = await supabase
    .from('parcel_presets')
    .update(updates)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();

  if (error || !data) return res.status(404).json({ error: error?.message || 'Not found' });
  return res.status(200).json(data);
}

async function handleDelete(req, res, userId) {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Parcel ID required' });

  const { error } = await supabase
    .from('parcel_presets')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) return res.status(400).json({ error: error.message });
  return res.status(200).json({ success: true });
}
