/**
 * GET /api/news/badge
 * Returns { hasNew: boolean } — whether any news items are newer than
 * the authenticated user's last_seen_at. Returns { hasNew: false } for
 * unauthenticated requests (no badge).
 */

import { createClient } from '@supabase/supabase-js';
import { getUserIdFromRequest } from '../_utils/auth.js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const userId = await getUserIdFromRequest(req, supabase);
  if (!userId) return res.status(200).json({ hasNew: false });

  // Get user's last_seen_at
  const { data: state } = await supabase
    .from('news_user_state')
    .select('last_seen_at')
    .eq('user_id', userId)
    .single();

  const lastSeen = state?.last_seen_at ? new Date(state.last_seen_at) : new Date(0);

  // Get the newest news item date
  const { data: latest } = await supabase
    .from('news_items')
    .select('iso_date, published_at, created_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!latest) return res.status(200).json({ hasNew: false });

  const latestDate = new Date(
    latest.iso_date || latest.published_at || latest.created_at
  );

  return res.status(200).json({ hasNew: latestDate > lastSeen });
}
