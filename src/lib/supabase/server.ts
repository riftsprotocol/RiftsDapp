/**
 * Supabase Server Client (Service Role)
 * SECURITY: Use ONLY on server-side for admin operations
 * NEVER expose service role key to the client
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  console.error('🚨 NEXT_PUBLIC_SUPABASE_URL is not set');
}

if (!supabaseServiceKey) {
  console.warn('⚠️ SUPABASE_SERVICE_ROLE_KEY is not set');
  console.warn('⚠️ Server operations will not work properly');
  console.warn('⚠️ Set this environment variable for production');
}

// Create service role client (admin access)
let supabaseServerClient: SupabaseClient;

if (supabaseUrl && supabaseServiceKey) {
  supabaseServerClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
  console.log('✅ Supabase server client initialized (service role)');
} else {
  // Create dummy client for development
  console.warn('⚠️ Using dummy Supabase client - server operations will fail');
  supabaseServerClient = createClient(
    'https://dummy.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR1bW15IiwiaWF0IjoxNjAwMDAwMDAwLCJleHAiOjIwMDAwMDAwMDB9.dummykey'
  );
}

/**
 * Export the server client
 * SECURITY: Only use in server-side code (API routes, getServerSideProps, etc.)
 */
export const supabaseServer = supabaseServerClient;

/**
 * Helper to check if service role is configured
 */
export const isServiceRoleConfigured = !!(supabaseUrl && supabaseServiceKey);

/**
 * Helper to ensure service role is available (throws if not configured)
 */
export function requireServiceRole(): SupabaseClient {
  if (!isServiceRoleConfigured) {
    throw new Error(
      'Service role not configured. Set SUPABASE_SERVICE_ROLE_KEY environment variable.'
    );
  }
  return supabaseServer;
}
