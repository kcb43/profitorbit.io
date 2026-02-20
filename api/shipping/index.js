/**
 * /api/shipping
 * CRUD for shipments (tracking records)
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
    console.error('Shipping API error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}

async function handleGet(req, res, userId) {
  const { id } = req.query;

  if (id) {
    const { data, error } = await supabase
      .from('shipments')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error || !data) return res.status(404).json({ error: 'Shipment not found' });
    return res.status(200).json(data);
  }

  const { data, error } = await supabase
    .from('shipments')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json(data || []);
}

async function handlePost(req, res, userId) {
  const b = req.body || {};
  const { data, error } = await supabase
    .from('shipments')
    .insert([{
      user_id:            userId,
      source:             b.source || 'manual',
      carrier:            b.carrier || null,
      tracking_number:    b.tracking_number || null,
      status:             b.status || 'unknown',
      shippo_tracking_id: b.shippo_tracking_id || null,
      to_name:            b.to_name || null,
      to_address:         b.to_address || null,
      from_address:       b.from_address || null,
      events:             b.events || [],
      last_event_at:      b.last_event_at || null,
    }])
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  return res.status(201).json(data);
}

async function handlePut(req, res, userId) {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Shipment ID required' });

  const b = req.body || {};
  const allowed = [
    'carrier', 'tracking_number', 'status', 'shippo_tracking_id',
    'to_name', 'to_address', 'from_address', 'events', 'last_event_at'
  ];
  const updates = {};
  for (const k of allowed) {
    if (b[k] !== undefined) updates[k] = b[k];
  }

  const { data, error } = await supabase
    .from('shipments')
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
  if (!id) return res.status(400).json({ error: 'Shipment ID required' });

  const { error } = await supabase
    .from('shipments')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) return res.status(400).json({ error: error.message });
  return res.status(200).json({ success: true });
}
