/**
 * /api/shipping/shippo-rates
 * POST: Create a Shippo shipment and return available rates
 *
 * Body: { from_address, to_address, parcel }
 * Returns: { shipment_object_id, rates: [...] }
 */
import { getUserIdFromRequest } from '../_utils/auth.js';
import { createClient } from '@supabase/supabase-js';

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

  const { from_address, to_address, parcel } = req.body || {};

  if (!from_address || !to_address || !parcel) {
    return res.status(400).json({ error: 'from_address, to_address, and parcel are required' });
  }

  try {
    const shipment = await shippoRequest('/shipments/', 'POST', {
      address_from: {
        name:    from_address.name,
        company: from_address.company || '',
        street1: from_address.street1,
        street2: from_address.street2 || '',
        city:    from_address.city,
        state:   from_address.state,
        zip:     from_address.zip,
        country: from_address.country || 'US',
        phone:   from_address.phone || '',
        email:   from_address.email || '',
      },
      address_to: {
        name:    to_address.name,
        company: to_address.company || '',
        street1: to_address.street1,
        street2: to_address.street2 || '',
        city:    to_address.city,
        state:   to_address.state,
        zip:     to_address.zip,
        country: to_address.country || 'US',
        phone:   to_address.phone || '',
        email:   to_address.email || '',
      },
      parcels: [{
        length:        String(parcel.length),
        width:         String(parcel.width),
        height:        String(parcel.height),
        distance_unit: parcel.distance_unit || 'in',
        weight:        String(parcel.weight),
        mass_unit:     parcel.mass_unit || 'lb',
      }],
      async:           false,
    });

    const rates = (shipment.rates || []).map(r => ({
      object_id:       r.object_id,
      carrier:         r.provider,
      servicelevel:    r.servicelevel?.name || r.servicelevel?.token || '',
      amount:          r.amount,
      currency:        r.currency,
      days:            r.estimated_days,
      arrives_by:      r.arrives_by,
    }));

    return res.status(200).json({
      shipment_object_id: shipment.object_id,
      rates,
    });
  } catch (err) {
    console.error('Shippo rates error:', err);
    return res.status(500).json({ error: err.message || 'Failed to get rates' });
  }
}
