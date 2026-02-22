/**
 * Orben API service for the mobile app.
 * Handles auth, token storage, and API calls to profitorbit.io.
 */

import * as SecureStore from 'expo-secure-store';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

export const ORBEN_API_BASE = 'https://profitorbit.io';

const SUPABASE_URL  = 'https://hlcwhpajorzbleabavcr.supabase.co';
const SUPABASE_ANON = 'sb_publishable_AmJEyN9K_q2OJAUCGiO3eA_NZYf6rXm';

// Custom Supabase storage adapter using Expo SecureStore
const ExpoSecureStoreAdapter = {
  getItem:    (key) => SecureStore.getItemAsync(key),
  setItem:    (key, value) => SecureStore.setItemAsync(key, value),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    storage:            ExpoSecureStoreAdapter,
    autoRefreshToken:   true,
    persistSession:     true,
    detectSessionInUrl: false,
  },
});

/** Get the current user's Supabase JWT access token */
export async function getOrbenToken() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
}

/** Authenticated fetch to the Orben API */
export async function orbenFetch(path, options = {}) {
  const token = await getOrbenToken();
  const res = await fetch(`${ORBEN_API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

// ── Mercari session ────────────────────────────────────────────────────────────

export async function getMercariSession() {
  try {
    const raw = await SecureStore.getItemAsync('mercari_auth_headers');
    const ts  = await SecureStore.getItemAsync('mercari_session_ts');
    if (!raw) return null;
    const headers = JSON.parse(raw);
    const ageMs = ts ? Date.now() - Number(ts) : Infinity;
    const hasAny = Boolean(
      headers.authorization || headers['x-csrf-token'] ||
      headers.cookie || Object.keys(headers).length > 0
    );
    return {
      headers,
      ageMs,
      ageHours: Math.floor(ageMs / (1000 * 60 * 60)),
      isStale:  ageMs > 23 * 60 * 60 * 1000,
      isValid:  hasAny,
    };
  } catch (_) {
    return null;
  }
}

export async function clearMercariSession() {
  await SecureStore.deleteItemAsync('mercari_auth_headers').catch(() => {});
  await SecureStore.deleteItemAsync('mercari_session_ts').catch(() => {});
}

// ── Inventory ──────────────────────────────────────────────────────────────────

export async function getInventoryItems(search = '', limit = 50) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (search) params.set('search', search);
  return orbenFetch(`/api/inventory?${params}`);
}

export async function getInventoryItem(id) {
  return orbenFetch(`/api/inventory?id=${id}`);
}

export async function createInventoryItem(data) {
  return orbenFetch('/api/inventory', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateInventoryItem(id, data) {
  return orbenFetch(`/api/inventory?id=${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteInventoryItem(id) {
  return orbenFetch(`/api/inventory?id=${id}`, { method: 'DELETE' });
}

// ── Sales ──────────────────────────────────────────────────────────────────────

export async function getSales(params = {}) {
  const query = new URLSearchParams();
  if (params.limit)    query.set('limit', String(params.limit));
  if (params.platform) query.set('platform', params.platform);
  if (params.from)     query.set('from', params.from);
  if (params.to)       query.set('to', params.to);
  const qs = query.toString();
  return orbenFetch(`/api/sales${qs ? `?${qs}` : ''}`);
}

export async function getRecentSales(limit = 5) {
  return getSales({ limit });
}

export async function recordSale(data) {
  return orbenFetch('/api/sales', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getSalesSummary() {
  return orbenFetch('/api/reports/summary');
}

// ── Mercari listing via server proxy ──────────────────────────────────────────

export async function createMercariListingServerSide(payload) {
  return orbenFetch('/api/mercari/create-listing', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getMercariSessionStatus() {
  return orbenFetch('/api/mercari/session-status');
}
