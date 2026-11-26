import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { normalizeSupabaseUrl } from '../utils/supabaseMappers';

const rawSupabaseUrl = (
  import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL
)?.trim();
const supabaseUrl = normalizeSupabaseUrl(rawSupabaseUrl);
const supabasePublishableKey = (
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
)?.trim();

export const SUPABASE_CONFIG_ERROR =
  'Supabase URL or Publishable Key is missing. Check your environment variables (VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY).';

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabasePublishableKey &&
    !supabaseUrl.includes('your-project-ref') &&
    !supabasePublishableKey.includes('your_supabase_publishable_key')
);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl as string, supabasePublishableKey as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(SUPABASE_CONFIG_ERROR);
  }
  return supabase;
}
