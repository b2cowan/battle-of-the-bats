import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { assertSafeSupabaseServerEnvironment } from './lib/supabase-safety';

export async function proxy(request: NextRequest) {
  assertSafeSupabaseServerEnvironment('Proxy Supabase client');

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh the session if expired - required to keep Server Components in sync
  const { data: { user } } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const segments = pathname.split('/').filter(Boolean);

  // Protect /[orgSlug]/admin/* routes - second path segment must be 'admin'
  const isOrgAdmin = segments.length >= 2 && segments[1] === 'admin';
  const isLegacyAdmin = segments[0] === 'admin';

  if ((isOrgAdmin || isLegacyAdmin) && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/login';
    url.searchParams.set('next', isLegacyAdmin ? '/admin' : pathname);
    return NextResponse.redirect(url);
  }

  // Protect /platform-admin/* with an optimistic session check.
  // Full platform-admin authorization happens in the layout and API routes.
  const isPlatformAdmin = segments[0] === 'platform-admin';
  const isPlatformLogin = isPlatformAdmin && segments[1] === 'login';

  if (isPlatformAdmin && !isPlatformLogin && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/platform-admin/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  // Expose pathname to server layouts so they can make route-aware decisions
  supabaseResponse.headers.set('x-pathname', pathname);

  // Pass org slug downstream so server components can read it without re-parsing the URL
  if (segments.length >= 1) {
    supabaseResponse.headers.set('x-org-slug', segments[0]);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/:slug/admin/:path*', '/admin', '/admin/:path*', '/auth/:path*', '/platform-admin', '/platform-admin/:path*', '/platform-admin/login', '/api/dev/:path*'],
};
