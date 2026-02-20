/**
 * Authenticated export helper
 *
 * Appends the current Supabase access token as ?token=... so the API
 * can identify the user even for direct browser-navigation (window.open)
 * requests that can't carry Authorization headers.
 */
import { supabase } from '@/api/supabaseClient';

/**
 * Open an export URL in a new tab with the auth token injected.
 * @param {string} baseUrl - API route, e.g. "/api/sales/export"
 * @param {Record<string,string|number|boolean>} params - additional query params
 */
export async function openAuthExport(baseUrl, params = {}) {
  let token = null;
  try {
    const { data } = await supabase.auth.getSession();
    token = data?.session?.access_token || null;
  } catch {
    // Non-fatal — request will get a 401 instead of succeeding
  }

  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  }
  if (token) qs.set('token', token);

  window.open(`${baseUrl}?${qs.toString()}`, '_blank');
}
