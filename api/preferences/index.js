/**
 * GET  /api/preferences        → { preferences: {...} }
 * PATCH /api/preferences       → body: { patch: {...} }  → deep-merged, returns { preferences: {...} }
 */

import { createClient } from '@supabase/supabase-js';
import { getUserIdFromRequest } from '../_utils/auth.js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

function deepMerge(target, source) {
  const out = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] !== null &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key])
    ) {
      out[key] = deepMerge(out[key] || {}, source[key]);
    } else {
      out[key] = source[key];
    }
  }
  return out;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-User-Id');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const userId = await getUserIdFromRequest(req, supabase);
  if (!userId) return res.status(401).json({ error: 'User ID required' });

  // ── GET ──────────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('user_preferences')
      .select('preferences')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ preferences: data?.preferences || {} });
  }

  // ── PATCH ─────────────────────────────────────────────────────────────────
  if (req.method === 'PATCH') {
    const { patch } = req.body || {};
    if (!patch || typeof patch !== 'object') {
      return res.status(400).json({ error: '`patch` object is required' });
    }

    const { data: existing } = await supabase
      .from('user_preferences')
      .select('preferences')
      .eq('user_id', userId)
      .maybeSingle();

    const current = existing?.preferences || {};
    const merged  = deepMerge(current, patch);

    const { error } = await supabase
      .from('user_preferences')
      .upsert(
        { user_id: userId, preferences: merged, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' },
      );

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ preferences: merged });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
