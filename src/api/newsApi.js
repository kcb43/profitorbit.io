import { supabase } from '@/integrations/supabase';

const ORBEN_API_URL = import.meta.env.VITE_ORBEN_API_URL || 'https://orben-api.fly.dev';

async function getAuthToken() {
  const session = await supabase.auth.getSession();
  return session.data.session?.access_token || null;
}

async function apiFetch(path, options = {}) {
  const token = await getAuthToken();
  const res = await fetch(`${ORBEN_API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * Fetch paginated news feed.
 * @param {{ q?: string, tag?: string, sort?: 'newest'|'relevance', limit?: number, offset?: number }} params
 */
export async function getNewsFeed({ q, tag, sort = 'newest', limit = 30, offset = 0 } = {}) {
  const params = new URLSearchParams({ sort, limit: String(limit), offset: String(offset) });
  if (q) params.set('q', q);
  if (tag && tag !== 'all') params.set('tag', tag);
  return apiFetch(`/v1/news/feed?${params}`);
}

/**
 * Fetch feed definitions for the sidebar.
 */
export async function getNewsFeeds() {
  return apiFetch('/v1/news/feeds');
}

/**
 * Check if there are unread news items.
 * Returns { hasNew: boolean }
 */
export async function getNewsBadge() {
  return apiFetch('/v1/news/badge');
}

/**
 * Mark news as seen (resets the badge).
 */
export async function markNewsSeen() {
  return apiFetch('/v1/news/seen', { method: 'POST' });
}
