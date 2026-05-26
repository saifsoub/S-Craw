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
  const { error } = await supabase.from('documents').select('id').limit(1);
  if (error && error.code !== 'PGRST116') {
    throw new Error(`Supabase connection failed: ${error.message}`);
  }
  console.log('[db] Connected to Supabase');
}
