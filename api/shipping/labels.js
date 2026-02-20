/**
 * /api/shipping/labels
 * CRUD for purchased shipping labels
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
      case 'GET':  return handleGet(req, res, userId);
      case 'POST': return handlePost(req, res, userId);
      default:     return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (err) {
    console.error('Labels API error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}

async function handleGet(req, res, userId) {
  const { id, shipment_id } = req.query;

  if (id) {
    const { data, error } = await supabase
      .from('shipping_labels')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error || !data) return res.status(404).json({ error: 'Label not found' });
    return res.status(200).json(data);
  }

  let query = supabase
    .from('shipping_labels')
    .select('*, shipments(status, tracking_number, events, last_event_at)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (shipment_id) {
    query = query.eq('shipment_id', shipment_id);
  }

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json(data || []);
}

async function handlePost(req, res, userId) {
  const b = req.body || {};

  const { data, error } = await supabase
    .from('shipping_labels')
    .insert([{
      user_id:                        userId,
      shipment_id:                    b.shipment_id || null,
      shippo_shipment_object_id:      b.shippo_shipment_object_id || null,
      shippo_transaction_id:          b.shippo_transaction_id || null,
      rate_amount:                    b.rate_amount ? Number(b.rate_amount) : null,
      rate_currency:                  b.rate_currency || 'USD',
      carrier:                        b.carrier || null,
      servicelevel:                   b.servicelevel || null,
      label_url:                      b.label_url || null,
      tracking_number:                b.tracking_number || null,
      status:                         b.status || 'VALID',
      from_address:                   b.from_address || null,
      to_address:                     b.to_address || null,
      parcel:                         b.parcel || null,
    }])
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  return res.status(201).json(data);
}
