import { createClient } from '@base44/sdk';
import newApiClient from './newApiClient';

/**
 * Base44 client compatibility layer.
 *
 * The app originally used `@base44/sdk` (`base44.entities.*` + `base44.integrations.Core.UploadFile`).
 * After migrating auth + storage to Supabase, the most reliable way to keep the UI working
 * is to route entity operations through our Vercel API routes (Supabase-backed).
 *
 * You can opt back into the legacy Base44 SDK by setting:
 *   VITE_USE_LEGACY_BASE44_SDK=true
 */
let useLegacyBase44Sdk = import.meta.env.VITE_USE_LEGACY_BASE44_SDK === 'true';

// Safety: never use the legacy Base44 SDK on the production site.
// It can cause data to appear "missing" and it bypasses our `/api/*` routes (Supabase-backed).
try {
  if (typeof window !== 'undefined') {
    const host = window.location?.hostname || '';
    if (import.meta.env.PROD && /(^|\.)profitorbit\.io$/i.test(host)) {
      useLegacyBase44Sdk = false;
    }
  }
} catch (_) {}

export const base44 = useLegacyBase44Sdk
  ? createClient({
      appId: '68e86fb5ac26f8511acce7ec',
      requiresAuth: false,
    })
  : newApiClient;

try {
  const mode = useLegacyBase44Sdk ? 'legacy-base44-sdk' : 'supabase-api';
  // eslint-disable-next-line no-console
  console.log('🟢 DATA CLIENT MODE:', mode);
  localStorage.setItem('profit_orbit_data_client_mode', mode);
} catch (_) {}
