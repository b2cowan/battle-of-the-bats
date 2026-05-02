import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
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

  // Refresh the session if expired — required to keep Server Components in sync
  const { data: { user } } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Protect /[orgSlug]/admin/* routes — second path segment must be 'admin'
  const segments = pathname.split('/').filter(Boolean);
  const isOrgAdmin = segments.length >= 2 && segments[1] === 'admin';

  if (isOrgAdmin && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  // Pass org slug downstream so server components can read it without re-parsing the URL
  if (segments.length >= 1) {
    supabaseResponse.headers.set('x-org-slug', segments[0]);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/:slug/admin/:path*', '/auth/:path*'],
};
