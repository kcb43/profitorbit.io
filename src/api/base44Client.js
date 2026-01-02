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
const useLegacyBase44Sdk = import.meta.env.VITE_USE_LEGACY_BASE44_SDK === 'true';

export const base44 = useLegacyBase44Sdk
  ? createClient({
      appId: '68e86fb5ac26f8511acce7ec',
      requiresAuth: false,
    })
  : newApiClient;
