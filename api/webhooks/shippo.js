/**
 * /api/webhooks/shippo
 * Receives Shippo tracking webhook events and updates shipments table.
 *
 * Shippo sends POST with JSON body. Verify the webhook using the
 * Shippo-Signature header once you configure a webhook secret.
 *
 * Event: tracking_updated
 * https://docs.goshippo.com/docs/tracking/webhooks/
 */
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SHIPPO_WEBHOOK_SECRET = process.env.SHIPPO_WEBHOOK_SECRET;

function normalizeStatus(shippoStatus) {
  const map = {
    PRE_TRANSIT: 'pre_transit',
    TRANSIT:     'in_transit',
    DELIVERED:   'delivered',
    RETURNED:    'returned',
    FAILURE:     'exception',
    UNKNOWN:     'unknown',
  };
  return map[shippoStatus] || 'unknown';
}

function verifySignature(rawBody, signatureHeader) {
  if (!SHIPPO_WEBHOOK_SECRET) return true; // Skip verification if not configured
  if (!signatureHeader) return false;

  const hmac = crypto
    .createHmac('sha256', SHIPPO_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(hmac),
    Buffer.from(signatureHeader)
  );
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const rawBody = JSON.stringify(req.body);
  const signature = req.headers['shippo-signature'] || '';

  if (!verifySignature(rawBody, signature)) {
    console.warn('Shippo webhook: invalid signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const event = req.body;

  // Only handle tracking_updated events
  if (event?.event !== 'track_updated') {
    return res.status(200).json({ received: true, handled: false });
  }

  const data = event?.data;
  const trackingNumber = data?.tracking_number;
  const carrier = data?.carrier;

  if (!trackingNumber) {
    return res.status(200).json({ received: true, handled: false });
  }

  const latestStatus = data?.tracking_status;
  const status = latestStatus ? normalizeStatus(latestStatus.status) : 'unknown';
  const lastEventAt = latestStatus?.status_date || null;

  const events = (data?.tracking_history || []).map(e => ({
    status:      normalizeStatus(e.status),
    message:     e.status_details || '',
    location:    [e.location?.city, e.location?.state, e.location?.country].filter(Boolean).join(', '),
    occurred_at: e.status_date,
  }));

  // Find all shipments matching this tracking number (could belong to multiple users if same #)
  const { data: shipments } = await supabase
    .from('shipments')
    .select('id, user_id')
    .eq('tracking_number', trackingNumber);

  if (!shipments || shipments.length === 0) {
    return res.status(200).json({ received: true, handled: false, reason: 'no matching shipment' });
  }

  const ids = shipments.map(s => s.id);

  const { error } = await supabase
    .from('shipments')
    .update({ status, events, last_event_at: lastEventAt })
    .in('id', ids);

  if (error) {
    console.error('Shippo webhook DB update error:', error);
    return res.status(500).json({ error: error.message });
  }

  console.log(`Shippo webhook: updated ${ids.length} shipment(s) for tracking ${trackingNumber} → ${status}`);
  return res.status(200).json({ received: true, handled: true, updated: ids.length });
}
