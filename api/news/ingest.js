/**
 * POST /api/news/ingest  (or GET for Vercel Cron)
 * Trigger a news ingestion pass:
 *   - type='serpapi_google_news': fetches from SerpAPI (requires SERPAPI_KEY)
 *   - type='rss': fetches any standard RSS 2.0 / Atom feed (free, no key required)
 *
 * Cron: called every 6 hours by Vercel (see vercel.json). Secured with CRON_SECRET.
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const SERPAPI_KEY = process.env.SERPAPI_KEY;
const CRON_SECRET = process.env.CRON_SECRET;

// ── RSS parser (no extra deps, works in Node/Edge) ───────────────────────────

function parseRssXml(xml) {
  const items = [];
  // Handle both <item> (RSS 2.0) and <entry> (Atom)
  const pattern = /<(?:item|entry)>([\s\S]*?)<\/(?:item|entry)>/g;
  let m;
  const decode = (s) =>
    String(s || '')
      .replace(/<[^>]*>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
      .trim();

  while ((m = pattern.exec(xml)) !== null) {
    const block = m[1];

    const titleRaw =
      /<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i.exec(block)?.[1] || '';
    const title = decode(titleRaw) || '(no title)';

    // <link> can be an element (RSS) or attribute href (Atom)
    const linkEl = /<link[^>]*>([\s\S]*?)<\/link>/i.exec(block)?.[1]?.trim();
    const linkAttr = /<link[^>]+href=["'](https?:\/\/[^"']+)["']/i.exec(block)?.[1];
    const link = linkEl?.startsWith('http') ? linkEl : linkAttr || null;

    const descRaw =
      /<(?:description|summary|content)[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/(?:description|summary|content)>/i.exec(block)?.[1] || '';
    const description = decode(descRaw).slice(0, 500) || null;

    const pubDateStr =
      /<(?:pubDate|updated|published)[^>]*>([\s\S]*?)<\/(?:pubDate|updated|published)>/i.exec(block)?.[1]?.trim() || null;
    const pubDate = pubDateStr ? new Date(pubDateStr) : null;

    // Thumbnail
    const thumbAttr =
      /<media:thumbnail[^>]+url=["'](https?:\/\/[^"']+)["']/i.exec(block)?.[1] ||
      /<media:content[^>]+url=["'](https?:\/\/[^"']+)["']/i.exec(block)?.[1] ||
      null;

    if (link) items.push({ title, link, description, pubDate, thumbnail: thumbAttr });
  }
  return items;
}

async function fetchRssFeed(feed) {
  const url = feed.query; // query field stores the RSS URL
  if (!url) return [];
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(12000),
      headers: { 'User-Agent': 'Orben-News/1.0 (reseller news aggregator)' },
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const raw = parseRssXml(xml);
    return raw
      .slice(0, 20)
      .map(item => ({
        feed_id:      feed.id,
        title:        item.title,
        summary:      item.description,
        source_name:  feed.source_name || feed.name,
        url:          item.link,
        thumbnail:    item.thumbnail || null,
        published_at: item.pubDate?.toISOString() || null,
        iso_date:     item.pubDate?.toISOString() || null,
        tags:         feed.tags || [],
        raw:          item,
      }))
      .filter(r => r.url);
  } catch {
    return [];
  }
}

// ── SerpAPI ──────────────────────────────────────────────────────────────────

async function fetchSerpApiFeed(feed) {
  if (!SERPAPI_KEY) return [];
  const params = new URLSearchParams({
    engine: 'google_news',
    api_key: SERPAPI_KEY,
    gl: feed.gl || 'us',
    hl: feed.hl || 'en',
    num: '10',
  });
  if (feed.query)             params.set('q', feed.query);
  if (feed.topic_token)       params.set('topic_token', feed.topic_token);
  if (feed.publication_token) params.set('publication_token', feed.publication_token);
  if (feed.so != null)        params.set('so', String(feed.so));

  try {
    const res = await fetch(`https://serpapi.com/search?${params}`, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return [];
    const data = await res.json();
    return (data?.news_results || [])
      .map(item => ({
        feed_id:      feed.id,
        title:        item.title || '(no title)',
        summary:      item.snippet || null,
        source_name:  item.source?.name || null,
        url:          item.link || item.url || null,
        thumbnail:    item.thumbnail || null,
        published_at: item.date ? new Date(item.date).toISOString() : null,
        iso_date:     item.iso_date ? new Date(item.iso_date).toISOString() : null,
        tags:         feed.tags || [],
        raw:          item,
      }))
      .filter(r => r.url);
  } catch {
    return [];
  }
}

// ── Core ingest logic (shared) ────────────────────────────────────────────────

export async function runIngest() {
  const { data: feeds, error: feedsErr } = await supabase
    .from('news_feeds')
    .select('*')
    .eq('enabled', true);

  if (feedsErr || !feeds?.length) {
    return { ok: false, reason: feedsErr?.message || 'no enabled feeds', totalInserted: 0 };
  }

  let totalInserted = 0;
  const results = [];

  for (const feed of feeds) {
    let items = [];
    if (feed.type === 'rss') {
      items = await fetchRssFeed(feed);
    } else if (feed.type === 'serpapi_google_news') {
      items = await fetchSerpApiFeed(feed);
    }

    if (!items.length) {
      results.push({ feed: feed.name, type: feed.type, inserted: 0 });
      continue;
    }

    const { error: upsertErr, count } = await supabase
      .from('news_items')
      .upsert(items, { onConflict: 'url', ignoreDuplicates: true })
      .select('id', { count: 'exact', head: true });

    const inserted = upsertErr ? 0 : (count || 0);
    totalInserted += inserted;
    results.push({ feed: feed.name, type: feed.type, inserted, error: upsertErr?.message });

    await supabase
      .from('news_feeds')
      .update({ last_fetched_at: new Date().toISOString() })
      .eq('id', feed.id);
  }

  return { ok: true, totalInserted, feeds: feeds.length, results };
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // GET requests are only for Vercel Cron — require CRON_SECRET when set.
  // POST requests are triggered by authenticated clients (any logged-in user can refresh news).
  if (req.method === 'GET' && CRON_SECRET) {
    const authHeader = req.headers['authorization'] || '';
    const secret = authHeader.replace('Bearer ', '');
    if (secret !== CRON_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  try {
    const result = await runIngest();
    return res.status(200).json(result);
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}
