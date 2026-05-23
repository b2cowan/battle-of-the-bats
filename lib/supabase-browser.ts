import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { assertSafeSupabaseBrowserEnvironment } from './supabase-safety';

// Use globalThis so the singleton survives Next.js Hot Module Replacement.
// In the browser globalThis === window, which persists across HMR cycles.
// A module-level `let` is reset on every Fast Refresh, creating a second
// GoTrueClient that shares the same auth storage key and triggers a token-
// refresh race that makes subsequent API calls return 401.
const _global = globalThis as typeof globalThis & {
  _supabaseBrowserClient?: SupabaseClient;
};

export function createClient() {
  assertSafeSupabaseBrowserEnvironment('Supabase browser client');

  if (!_global._supabaseBrowserClient) {
    _global._supabaseBrowserClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }

  return _global._supabaseBrowserClient;
}
