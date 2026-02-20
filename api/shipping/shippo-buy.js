/**
 * /api/shipping/shippo-buy
 * POST: Purchase a label for a selected rate
 *
 * Body: { rate_object_id, shipment_object_id, from_address, to_address, parcel }
 * Creates: shipment + shipping_label records in DB
 * Returns: { label, shipment }
 */
import { createClient } from '@supabase/supabase-js';
import { getUserIdFromRequest } from '../_utils/auth.js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SHIPPO_API = 'https://api.goshippo.com';

async function shippoRequest(path, method = 'GET', body = null) {
  const apiKey = process.env.SHIPPO_API_KEY;
  if (!apiKey) throw new Error('SHIPPO_API_KEY not configured');

  const options = {
    method,
    headers: {
      'Authorization': `ShippoToken ${apiKey}`,
      'Content-Type': 'application/json',
    },
  };
  if (body) options.body = JSON.stringify(body);

  const resp = await fetch(`${SHIPPO_API}${path}`, options);
  const data = await resp.json();

  if (!resp.ok) {
    throw new Error(data?.detail || data?.message || `Shippo error ${resp.status}`);
  }

  return data;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-User-Id');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const userId = await getUserIdFromRequest(req, supabase);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { rate_object_id, shipment_object_id, from_address, to_address, parcel } = req.body || {};

  if (!rate_object_id) {
    return res.status(400).json({ error: 'rate_object_id is required' });
  }

  try {
    // Purchase label via Shippo transactions endpoint
    const transaction = await shippoRequest('/transactions/', 'POST', {
      rate:        rate_object_id,
      label_file_type: 'PDF',
      async:       false,
    });

    if (transaction.status !== 'SUCCESS') {
      throw new Error(
        transaction.messages?.map(m => m.text).join(', ') || 'Label purchase failed'
      );
    }

    // Register tracking with Shippo (webhook-ready)
    let shippoTrackingId = null;
    if (transaction.tracking_number && transaction.tracking_carrier) {
      try {
        const tracking = await shippoRequest('/tracks/', 'POST', {
          carrier:         transaction.tracking_carrier,
          tracking_number: transaction.tracking_number,
        });
        shippoTrackingId = tracking.tracking_number || null;
      } catch (trackErr) {
        console.warn('Tracking registration warning:', trackErr.message);
      }
    }

    // Save shipment record
    const { data: shipmentRow } = await supabase
      .from('shipments')
      .insert([{
        user_id:            userId,
        source:             'shippo',
        carrier:            transaction.tracking_carrier || null,
        tracking_number:    transaction.tracking_number || null,
        status:             'pre_transit',
        shippo_tracking_id: shippoTrackingId,
        to_name:            to_address?.name || null,
        to_address:         to_address || null,
        from_address:       from_address || null,
        events:             [],
      }])
      .select()
      .single();

    // Save label record
    const { data: labelRow } = await supabase
      .from('shipping_labels')
      .insert([{
        user_id:                    userId,
        shipment_id:                shipmentRow?.id || null,
        shippo_shipment_object_id:  shipment_object_id || null,
        shippo_transaction_id:      transaction.object_id,
        rate_amount:                transaction.rate ? Number(transaction.rate.amount) : null,
        rate_currency:              transaction.rate?.currency || 'USD',
        carrier:                    transaction.tracking_carrier || null,
        servicelevel:               transaction.rate?.servicelevel?.name || null,
        label_url:                  transaction.label_url || null,
        tracking_number:            transaction.tracking_number || null,
        status:                     'VALID',
        from_address:               from_address || null,
        to_address:                 to_address || null,
        parcel:                     parcel || null,
      }])
      .select()
      .single();

    return res.status(200).json({
      label:    labelRow,
      shipment: shipmentRow,
      tracking_number: transaction.tracking_number,
      label_url:       transaction.label_url,
    });
  } catch (err) {
    console.error('Shippo buy error:', err);
    return res.status(500).json({ error: err.message || 'Failed to purchase label' });
  }
}
