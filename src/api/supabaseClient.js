import { createClient } from '@supabase/supabase-js';

// Supabase configuration
// These will be set via environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Supabase environment variables not set. Please configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
}

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Prefer PKCE so OAuth doesn't put access tokens in the URL hash.
    // (Supabase will still process legacy hash fragments if they occur.)
    flowType: 'pkce',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// Helper to get current user ID
// This will need to be adapted based on your auth setup
export async function getCurrentUserId() {
  // Prefer session (fast, local) and fall back to getUser (network)
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user?.id) return session.user.id;

  const { data: { user } } = await supabase.auth.getUser();
  return user?.id || null;
}

// Helper for API routes (server-side)
export function createSupabaseClient(accessToken) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

