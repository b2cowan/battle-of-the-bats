const KNOWN_PROD_SUPABASE_REFS = new Set([
  'qcttcboqysynwcdyghil',
]);

function projectRefFromUrl(url?: string) {
  if (!url) return null;
  const match = url.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/i);
  return match?.[1] ?? null;
}

function isLocalHostname(value?: string | null) {
  if (!value) return false;
  return value.includes('localhost') || value.includes('127.0.0.1') || value.includes('::1');
}

export function assertSafeSupabaseServerEnvironment(context: string) {
  if (process.env.ALLOW_LOCAL_PROD_SUPABASE === 'true') return;
  if (process.env.NEXT_PHASE === 'phase-production-build') return;

  const ref = projectRefFromUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const isLocalRuntime = process.env.NODE_ENV === 'development' || isLocalHostname(appUrl);

  if (isLocalRuntime && ref && KNOWN_PROD_SUPABASE_REFS.has(ref)) {
    throw new Error(
      `${context} refused to use the production Supabase project from a local runtime. ` +
      'Update .env.local with the dev Supabase URL and keys.'
    );
  }
}

export function assertSafeSupabaseBrowserEnvironment(context: string) {
  if (process.env.NEXT_PUBLIC_ALLOW_LOCAL_PROD_SUPABASE === 'true') return;

  const ref = projectRefFromUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const isLocalRuntime = typeof window !== 'undefined' && isLocalHostname(window.location.hostname);

  if (isLocalRuntime && ref && KNOWN_PROD_SUPABASE_REFS.has(ref)) {
    throw new Error(
      `${context} refused to use the production Supabase project from localhost. ` +
      'Update .env.local with the dev Supabase URL and anon key.'
    );
  }
}
