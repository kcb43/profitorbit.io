/**
 * /api/shipping/track
 * POST: Add a manual tracking record (optionally refresh via Shippo)
 * GET:  Refresh tracking status from Shippo for an existing shipment
 *
 * Shippo tracking API: GET /tracks/{carrier}/{tracking_number}
 */
import { createClient } from '@supabase/supabase-js';
import { getUserIdFromRequest } from '../_utils/auth.js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SHIPPO_API = 'https://api.goshippo.com';

async function shippoTrack(carrier, trackingNumber) {
  const apiKey = process.env.SHIPPO_API_KEY;
  if (!apiKey) return null;

  const carrierSlug = normalizeCarrier(carrier);
  if (!carrierSlug) return null;

  const resp = await fetch(`${SHIPPO_API}/tracks/${carrierSlug}/${trackingNumber}`, {
    headers: { 'Authorization': `ShippoToken ${apiKey}` },
  });
  if (!resp.ok) return null;
  return resp.json();
}

// Map human carrier names → Shippo carrier tokens
function normalizeCarrier(carrier) {
  if (!carrier) return null;
  const map = {
    usps: 'usps', 'us postal': 'usps', 'united states postal': 'usps',
    ups: 'ups', fedex: 'fedex', dhl: 'dhl_express',
    'dhl express': 'dhl_express', amazon: 'amazon', ontrac: 'ontrac',
    lasership: 'lasership', 'first class': 'usps',
  };
  return map[carrier.toLowerCase().trim()] || carrier.toLowerCase().replace(/\s+/g, '_');
}

// Normalize Shippo tracking status → our internal status
function normalizeStatus(shippoStatus) {
  const map = {
    PRE_TRANSIT: 'pre_transit',
    TRANSIT: 'in_transit',
    DELIVERED: 'delivered',
    RETURNED: 'returned',
    FAILURE: 'exception',
    UNKNOWN: 'unknown',
  };
  return map[shippoStatus] || 'unknown';
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-User-Id');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const userId = await getUserIdFromRequest(req, supabase);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  if (req.method === 'POST') {
    return handleAddTracking(req, res, userId);
  }
  if (req.method === 'GET') {
    return handleRefreshTracking(req, res, userId);
  }
  return res.status(405).json({ error: 'Method not allowed' });
}

// POST /api/shipping/track — add a new tracking number manually
async function handleAddTracking(req, res, userId) {
  const { carrier, tracking_number, to_name } = req.body || {};

  if (!tracking_number) {
    return res.status(400).json({ error: 'tracking_number is required' });
  }

  // Check for duplicates
  const { data: existing } = await supabase
    .from('shipments')
    .select('id')
    .eq('user_id', userId)
    .eq('tracking_number', tracking_number)
    .single();

  if (existing) {
    return res.status(409).json({ error: 'This tracking number is already being tracked' });
  }

  // Try to fetch live tracking from Shippo immediately
  let trackingData = null;
  try {
    trackingData = await shippoTrack(carrier, tracking_number);
  } catch (e) {
    // non-fatal
  }

  const events = (trackingData?.tracking_history || []).map(e => ({
    status:      normalizeStatus(e.status),
    message:     e.status_details || '',
    location:    [e.location?.city, e.location?.state, e.location?.country].filter(Boolean).join(', '),
    occurred_at: e.status_date,
  }));

  const latestEvent = trackingData?.tracking_status;
  const status = latestEvent ? normalizeStatus(latestEvent.status) : 'unknown';
  const lastEventAt = latestEvent?.status_date || null;

  const { data, error } = await supabase
    .from('shipments')
    .insert([{
      user_id:            userId,
      source:             'manual',
      carrier:            carrier || trackingData?.carrier || null,
      tracking_number,
      status,
      to_name:            to_name || null,
      events,
      last_event_at:      lastEventAt,
    }])
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  return res.status(201).json(data);
}

// GET /api/shipping/track?id=<shipment_id> — refresh from Shippo
async function handleRefreshTracking(req, res, userId) {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Shipment ID required' });

  const { data: shipment, error: fetchError } = await supabase
    .from('shipments')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (fetchError || !shipment) {
    return res.status(404).json({ error: 'Shipment not found' });
  }

  if (!shipment.tracking_number) {
    return res.status(400).json({ error: 'Shipment has no tracking number' });
  }

  const trackingData = await shippoTrack(shipment.carrier, shipment.tracking_number);
  if (!trackingData) {
    return res.status(200).json({ ...shipment, refreshed: false });
  }

  const events = (trackingData.tracking_history || []).map(e => ({
    status:      normalizeStatus(e.status),
    message:     e.status_details || '',
    location:    [e.location?.city, e.location?.state, e.location?.country].filter(Boolean).join(', '),
    occurred_at: e.status_date,
  }));

  const latestEvent = trackingData.tracking_status;
  const status = latestEvent ? normalizeStatus(latestEvent.status) : shipment.status;
  const lastEventAt = latestEvent?.status_date || shipment.last_event_at;

  const { data: updated, error: updateError } = await supabase
    .from('shipments')
    .update({ status, events, last_event_at: lastEventAt })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();

  if (updateError) return res.status(500).json({ error: updateError.message });
  return res.status(200).json({ ...updated, refreshed: true });
}
