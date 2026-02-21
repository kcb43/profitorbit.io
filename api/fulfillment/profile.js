/**
 * GET  /api/fulfillment/profile  – fetch the current user's fulfillment profile
 * POST /api/fulfillment/profile  – upsert (create or update) the profile
 */

import { createClient } from '@supabase/supabase-js';
import { getUserIdFromRequest } from '../_utils/auth.js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  const userId = await getUserIdFromRequest(req, supabase);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('user_fulfillment_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data || {});
  }

  if (req.method === 'POST' || req.method === 'PUT') {
    const {
      pickup_enabled,
      pickup_location_line,
      pickup_notes,
      shipping_enabled,
      shipping_notes,
      platform_notes,
    } = req.body || {};

    const payload = {
      user_id: userId,
      pickup_enabled:       Boolean(pickup_enabled),
      pickup_location_line: pickup_location_line || null,
      pickup_notes:         pickup_notes || null,
      shipping_enabled:     pickup_enabled === undefined ? true : Boolean(shipping_enabled),
      shipping_notes:       shipping_notes || null,
      platform_notes:       platform_notes || {},
    };

    const { data, error } = await supabase
      .from('user_fulfillment_profiles')
      .upsert(payload, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
