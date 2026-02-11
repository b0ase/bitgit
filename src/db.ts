/**
 * Supabase admin client (shared Hetzner instance)
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { BitConfig } from './config.js';

let _client: SupabaseClient | null = null;

/**
 * Get or create a Supabase admin client.
 * Uses env vars from config, or falls back to common names.
 */
export function getDb(config?: BitConfig): SupabaseClient {
  if (_client) return _client;

  const urlEnv = config?.db?.supabase_url_env || 'NEXT_PUBLIC_SUPABASE_URL';
  const keyEnv = config?.db?.supabase_key_env || 'SUPABASE_SERVICE_ROLE_KEY';

  const url = process.env[urlEnv];
  const key = process.env[keyEnv];

  if (!url || !key) {
    throw new Error(
      `Supabase not configured. Set ${urlEnv} and ${keyEnv} in your environment.`,
    );
  }

  _client = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return _client;
}
