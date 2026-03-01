/**
 * GET /api/mercari/session-status
 *
 * Returns whether the current user has a valid server-side Mercari session
 * (i.e., tokens captured on desktop and saved via /api/mercari/save-session).
 *
 * Used by the frontend on mobile to show "Connected via desktop session" or
 * "Connect on desktop first".
 */

import { createClient } from '@supabase/supabase-js';
import { getUserIdFromRequest } from '../_utils/auth.js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

function setCors(req, res) {
  const origin = req.headers?.origin;
  const allowed =
    !origin ||
    origin === 'https://orben.io' ||
    /^https:\/\/([a-z0-9-]+\.)?profitorbit\.io$/i.test(origin) ||
    /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin) ||
    /^http:\/\/localhost:\d+$/i.test(origin);

  if (allowed && origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const userId = await getUserIdFromRequest(req, supabase);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { data, error } = await supabase
    .from('user_marketplace_sessions')
    .select('captured_at, updated_at, source_url, auth_headers')
    .eq('user_id', userId)
    .eq('marketplace', 'mercari')
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(200).json({ connected: false });

  const hdrs = data.auth_headers || {};
  const hasAuth   = Boolean(hdrs.authorization);
  const hasCsrf   = Boolean(hdrs['x-csrf-token']);
  const hasDevice = Boolean(hdrs['x-de-device-token']);
  const isValid   = hasAuth && hasCsrf;

  // Determine staleness (Mercari sessions typically last a few hours to a day)
  const updatedMs = data.updated_at ? Date.parse(data.updated_at) : 0;
  const ageMs = Date.now() - updatedMs;
  const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
  const isStale = ageMs > 23 * 60 * 60 * 1000; // warn after 23 hours

  return res.status(200).json({
    connected: isValid,
    hasDevice,
    isStale,
    capturedAt: data.captured_at,
    updatedAt: data.updated_at,
    ageDays,
    ageHours: Math.floor(ageMs / (1000 * 60 * 60)),
    sourceUrl: data.source_url,
  });
}
