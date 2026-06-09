import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config';

/**
 * Admin Supabase client (anon key).
 * For user-specific operations, call createUserClient(token) instead —
 * it scopes requests to that user's session so RLS policies apply.
 */
export const supabase: SupabaseClient = createClient(
  config.supabaseUrl,
  config.supabaseAnonKey,
  { auth: { persistSession: false } },
);

/**
 * Returns a Supabase client scoped to a specific user's access token.
 * All DB operations go through PostgREST with RLS enforced.
 */
export function createUserClient(accessToken: string): SupabaseClient {
  return createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

export async function checkDatabaseConnection(): Promise<void> {
  // Supabase is accessed from the browser client directly in this environment.
  // The backend has no outbound HTTP access, so we skip the connectivity check.
  console.log('[db] Skipping Supabase connectivity check (browser-direct mode)');
}
