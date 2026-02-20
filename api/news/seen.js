/**
 * POST /api/news/seen
 * Mark news as seen for the authenticated user (updates last_seen_at).
 */

import { createClient } from '@supabase/supabase-js';
import { getUserIdFromRequest } from '../_utils/auth.js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const userId = await getUserIdFromRequest(req, supabase);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { error } = await supabase
    .from('news_user_state')
    .upsert({ user_id: userId, last_seen_at: new Date().toISOString() }, { onConflict: 'user_id' });

  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ ok: true });
}
