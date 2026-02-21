/**
 * Client-side API wrapper for the user fulfillment profile.
 * Pickup/shipping details used to power AI description generation.
 */
import { supabase } from '@/integrations/supabase';

async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function apiFetch(path, options = {}) {
  const headers = await getAuthHeaders();
  const res = await fetch(path, { ...options, headers: { ...headers, ...(options.headers || {}) } });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

/** Fetch the current user's fulfillment profile. Returns {} if not set yet. */
export async function getFulfillmentProfile() {
  return apiFetch('/api/fulfillment/profile');
}

/**
 * Save (upsert) the fulfillment profile.
 * @param {Object} profile
 * @param {boolean} profile.pickup_enabled
 * @param {string}  profile.pickup_location_line
 * @param {string}  profile.pickup_notes
 * @param {boolean} profile.shipping_enabled
 * @param {string}  profile.shipping_notes
 * @param {Object}  profile.platform_notes   e.g. { facebook: "...", mercari: "..." }
 */
export async function saveFulfillmentProfile(profile) {
  return apiFetch('/api/fulfillment/profile', {
    method: 'POST',
    body: JSON.stringify(profile),
  });
}
