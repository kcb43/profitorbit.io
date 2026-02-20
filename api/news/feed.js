/**
 * GET /api/news/feed
 * Paginated news items with optional search + tag filter.
 * Fires a background ingest when items are empty or a feed is stale (>6 h).
 */

import { createClient } from '@supabase/supabase-js';
import { runIngest } from './ingest.js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { q, tag, sort = 'newest', limit = '30', offset = '0' } = req.query;

  // Background ingest: fire-and-forget when items are empty or stale
  try {
    const { count } = await supabase
      .from('news_items')
      .select('id', { count: 'exact', head: true });

    const { data: staleFeeds } = await supabase
      .from('news_feeds')
      .select('id')
      .eq('enabled', true)
      .or(`last_fetched_at.is.null,last_fetched_at.lt.${new Date(Date.now() - SIX_HOURS_MS).toISOString()}`);

    if (count === 0 || (staleFeeds && staleFeeds.length > 0)) {
      runIngest().catch(console.error);
    }
  } catch {
    // Non-fatal
  }

  let query = supabase
    .from('news_items')
    .select(
      'id, feed_id, title, summary, source_name, url, thumbnail, published_at, iso_date, tags, created_at',
      { count: 'exact' }
    );

  if (q && q.trim()) {
    query = query.or(
      `title.ilike.%${q.trim()}%,summary.ilike.%${q.trim()}%,source_name.ilike.%${q.trim()}%`
    );
  }

  if (tag && tag !== 'all') {
    query = query.contains('tags', [tag]);
  }

  if (sort === 'newest') {
    query = query
      .order('iso_date',     { ascending: false, nullsFirst: false })
      .order('published_at', { ascending: false, nullsFirst: false })
      .order('created_at',   { ascending: false });
  } else {
    query = query.order('created_at', { ascending: false });
  }

  const lim = Math.min(parseInt(limit, 10) || 30, 100);
  const off = parseInt(offset, 10) || 0;
  query = query.range(off, off + lim - 1);

  const { data, error, count } = await query;
  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ items: data || [], total: count || 0 });
}
