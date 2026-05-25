import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { assertSafeSupabaseServerEnvironment } from './lib/supabase-safety';

export async function proxy(request: NextRequest) {
  assertSafeSupabaseServerEnvironment('Proxy Supabase client');

  // Compute pathname first so it's available for request-header forwarding.
  // Server Components read headers() from REQUEST headers only — setting them
  // on the response (supabaseResponse.headers.set) does NOT make them available
  // via headers() in layouts/pages. We must forward via NextResponse.next request option.
  const { pathname } = request.nextUrl;
  const segments = pathname.split('/').filter(Boolean);

  // Build augmented request headers that include x-pathname and x-org-slug
  // so Server Components can read them via headers() without re-parsing the URL.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-pathname', pathname);
  if (segments.length >= 1) {
    requestHeaders.set('x-org-slug', segments[0]);
  }

  // Redirect legacy /[orgSlug]/admin/tournaments/teams → /[orgSlug]/admin/tournaments/registrations
  if (segments.length >= 4 && segments[1] === 'admin' && segments[2] === 'tournaments' && segments[3] === 'teams') {
    const url = request.nextUrl.clone();
    const remainingPath = segments.slice(4).join('/');
    url.pathname = `/${segments[0]}/admin/tournaments/registrations${remainingPath ? '/' + remainingPath : ''}`;
    return NextResponse.redirect(url, { status: 301 });
  }

  // Redirect legacy org-admin link URLs before auth so login next paths
  // also use the Coaches Portal vocabulary.
  if (segments.length >= 4 && segments[1] === 'admin' && segments[2] === 'org' && segments[3] === 'team-links') {
    const url = request.nextUrl.clone();
    const remainingPath = segments.slice(4).join('/');
    url.pathname = `/${segments[0]}/admin/org/coaches-portal-links${remainingPath ? '/' + remainingPath : ''}`;
    return NextResponse.redirect(url, { status: 307 });
  }

  // Redirect legacy Basic coach portal routes before auth so old links do not
  // strand unauthenticated coaches on /my URLs.
  if (segments[0] === 'my') {
    const url = request.nextUrl.clone();
    if (segments[1] === 'join') {
      url.pathname = '/coaches/join';
      const next = url.searchParams.get('next');
      if (next === '/my') {
        url.searchParams.set('next', '/coaches/tournaments');
      } else if (next?.startsWith('/my/registrations')) {
        url.searchParams.set('next', next.replace('/my/registrations', '/coaches/tournaments'));
      }
    } else if (segments[1] === 'registrations') {
      const remainingPath = segments.slice(2).join('/');
      url.pathname = `/coaches/tournaments${remainingPath ? '/' + remainingPath : ''}`;
    } else {
      url.pathname = '/coaches/tournaments';
    }
    return NextResponse.redirect(url, { status: 307 });
  }

  let supabaseResponse = NextResponse.next({
    request: { headers: requestHeaders },
  });

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
          // Rebuild the Cookie header from the updated request.cookies so that
          // Server Components reading cookies() see the refreshed session tokens.
          // requestHeaders was snapshotted at the start of the request — we must
          // re-derive the cookie string here or auth will fail on token refresh.
          const updatedHeaders = new Headers(requestHeaders);
          updatedHeaders.set(
            'cookie',
            request.cookies.getAll().map(c => `${c.name}=${c.value}`).join('; ')
          );
          supabaseResponse = NextResponse.next({
            request: { headers: updatedHeaders },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh the session if expired - required to keep Server Components in sync
  const { data: { user } } = await supabase.auth.getUser();

  // Protect /[orgSlug]/admin/* routes - second path segment must be 'admin'
  const isOrgAdmin = segments.length >= 2 && segments[1] === 'admin';
  const isLegacyAdmin = segments[0] === 'admin';
  const isOrgScorekeeper = segments.length >= 2 && segments[0] !== 'api' && segments[1] === 'scorekeeper';

  if ((isOrgAdmin || isLegacyAdmin || isOrgScorekeeper) && !user) {
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

  // Protect Basic Coaches Portal tournament records while leaving signup,
  // paid activation, claim, and checkout completion routes public.
  const isRootCoachesSection = segments[0] === 'coaches';
  const isPublicCoachesPath =
    isRootCoachesSection &&
    ['join', 'start', 'claim', 'checkout'].includes(segments[1] ?? '');

  if (isRootCoachesSection && !isPublicCoachesPath && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  if (segments[0] === 'home' && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/:slug/admin',
    '/:slug/admin/:path*',
    '/:slug/scorekeeper/:path*',
    '/admin',
    '/admin/:path*',
    '/auth/:path*',
    '/platform-admin',
    '/platform-admin/:path*',
    '/platform-admin/login',
    '/home',
    '/api/admin/:path*',
    '/api/scorekeeper/:path*',
    '/api/registrations',
    '/api/org-context',
    '/api/dev/:path*',
    '/my',
    '/my/:path*',
    '/coaches',
    '/coaches/:path*',
  ],
};
