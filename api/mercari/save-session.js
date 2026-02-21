/**
 * POST /api/mercari/save-session
 *
 * Called by the browser extension after it successfully captures Mercari
 * auth headers (and optionally cookies). Stores the session server-side so
 * mobile devices can create listings without the extension.
 *
 * Body:
 *   {
 *     authHeaders: { authorization, 'x-csrf-token', 'x-de-device-token', ... },
 *     cookies: { name: value, ... },   // optional, captured via chrome.cookies
 *     sourceUrl: string,               // optional, URL where captured
 *   }
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
    origin === 'https://profitorbit.io' ||
    /^https:\/\/([a-z0-9-]+\.)?profitorbit\.io$/i.test(origin) ||
    /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin) ||
    /^http:\/\/localhost:\d+$/i.test(origin) ||
    /^chrome-extension:\/\//i.test(origin);

  if (allowed && origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const userId = await getUserIdFromRequest(req, supabase);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { authHeaders, cookies, sourceUrl } = req.body || {};

  if (!authHeaders || typeof authHeaders !== 'object') {
    return res.status(400).json({ error: 'authHeaders required' });
  }

  // Validate the minimum required headers are present
  const hasAuth   = Boolean(authHeaders?.authorization || authHeaders?.Authorization);
  const hasCsrf   = Boolean(authHeaders?.['x-csrf-token']);
  const hasDevice = Boolean(authHeaders?.['x-de-device-token']);

  if (!hasAuth || !hasCsrf) {
    return res.status(400).json({
      error: 'authHeaders must include authorization and x-csrf-token',
      hasAuth,
      hasCsrf,
      hasDevice,
    });
  }

  // Normalize header keys to lowercase
  const normalizedHeaders = {};
  for (const [k, v] of Object.entries(authHeaders)) {
    if (v && typeof v === 'string') normalizedHeaders[k.toLowerCase()] = v;
  }

  const payload = {
    user_id:      userId,
    marketplace:  'mercari',
    auth_headers: normalizedHeaders,
    cookies:      (cookies && typeof cookies === 'object') ? cookies : {},
    captured_at:  new Date().toISOString(),
    source_url:   typeof sourceUrl === 'string' ? sourceUrl : null,
  };

  const { error } = await supabase
    .from('user_marketplace_sessions')
    .upsert(payload, { onConflict: 'user_id,marketplace' });

  if (error) {
    console.error('[mercari/save-session] DB error:', error);
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({
    ok: true,
    hasDevice,
    capturedAt: payload.captured_at,
  });
}
