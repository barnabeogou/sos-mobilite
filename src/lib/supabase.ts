import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '@/config/env';

export class NotConfiguredError extends Error {
  constructor() {
    super('SUPABASE_NOT_CONFIGURED');
    this.name = 'NotConfiguredError';
  }
}

/**
 * Client Supabase unique. `null` tant que VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
 * ne sont pas renseignées : l'application affiche alors un écran de configuration
 * au lieu de simuler des données.
 */
export const supabase: SupabaseClient | null = env.isSupabaseConfigured
  ? createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      realtime: { params: { eventsPerSecond: 5 } },
    })
  : null;

export function db(): SupabaseClient {
  if (!supabase) throw new NotConfiguredError();
  return supabase;
}
