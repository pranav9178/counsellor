import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL  as string | undefined;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * True when both env vars are present and look like real Supabase values.
 * When false the app falls back to localStorage mode automatically.
 */
export const isSupabaseConfigured =
  !!supabaseUrl &&
  !!supabaseKey &&
  supabaseUrl !== 'https://your-project-id.supabase.co' &&
  supabaseKey !== 'your-anon-key-here';

/**
 * Shared Supabase client — null when Supabase is not configured.
 * Always guard with `isSupabaseConfigured` before calling methods.
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseKey!)
  : null;

if (!isSupabaseConfigured) {
  console.warn(
    '[Supabase] No credentials found. Running in localStorage mode.\n' +
    'To enable Supabase: create a .env file with\n' +
    '  VITE_SUPABASE_URL=https://your-project-id.supabase.co\n' +
    '  VITE_SUPABASE_ANON_KEY=your-anon-key-here'
  );
}
