import newApiClient from './newApiClient';

/**
 * API Client for making authenticated requests to backend.
 *
 * This client routes all operations through our Supabase-backed Vercel API routes.
 * Previously named `base44` for legacy compatibility - now renamed to `apiClient` for clarity.
 */
export const apiClient = newApiClient;

// Legacy export for backwards compatibility (will be removed in future)
export const base44 = newApiClient;

try {
  const mode = 'supabase-api';
  // eslint-disable-next-line no-console
  console.log('🟢 DATA CLIENT MODE:', mode);
  localStorage.setItem('profit_orbit_data_client_mode', mode);
} catch (_) {}
