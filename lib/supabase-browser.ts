import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { assertSafeSupabaseBrowserEnvironment } from './supabase-safety';

let browserClient: SupabaseClient | null = null;

export function createClient() {
  assertSafeSupabaseBrowserEnvironment('Supabase browser client');

  if (!browserClient) {
    browserClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }

  return browserClient;
}
