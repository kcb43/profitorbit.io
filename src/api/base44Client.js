import newApiClient from './newApiClient';

/**
 * Data client compatibility layer.
 *
 * Historically the codebase referenced `base44.entities.*`. We now route all entity operations
 * through our Supabase-backed Vercel API routes via `newApiClient`.
 *
 * IMPORTANT: the legacy `@base44/sdk` path has been removed.
 */
export const base44 = newApiClient;

try {
  const mode = 'supabase-api';
  // eslint-disable-next-line no-console
  console.log('🟢 DATA CLIENT MODE:', mode);
  localStorage.setItem('profit_orbit_data_client_mode', mode);
} catch (_) {}
