import { cache } from 'react';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { assertSafeSupabaseServerEnvironment } from './supabase-safety';

export async function createClient() {
  assertSafeSupabaseServerEnvironment('Supabase server client');

  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — middleware handles session refresh
          }
        },
      },
    }
  );
}

/**
 * Request-memoized auth lookup — the sibling of getUserAccessContextsCached (lib/user-contexts).
 * `supabase.auth.getUser()` revalidates the JWT against the Supabase Auth server (a real network
 * round trip, not a cookie decode), and a nested layout tree calls it at every level: before this
 * existed, one /account/* request paid it three times (consumer layout + account layout + page).
 * React cache() collapses those to one call per request. Use this wherever a server component
 * only needs to know WHO the user is; keep calling createClient() directly when you need the
 * client itself (auth flows, RLS-scoped queries).
 */
export const getAuthUserCached = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
});
