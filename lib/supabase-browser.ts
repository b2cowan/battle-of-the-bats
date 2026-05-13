import { createBrowserClient } from '@supabase/ssr';
import { assertSafeSupabaseBrowserEnvironment } from './supabase-safety';

export function createClient() {
  assertSafeSupabaseBrowserEnvironment('Supabase browser client');

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
