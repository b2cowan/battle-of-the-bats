import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { assertSafeSupabaseServerEnvironment } from './lib/supabase-safety';
import { isOwnHost } from './lib/own-hosts';
import { clubHostResponse } from './lib/club-host-response';
import { RESERVED_ORG_SLUGS } from './lib/reserved-slugs';
import { getSignedInUser } from './lib/two-step-session';

/**
 * One percent-decode of a path segment, as the router decodes it before a page sees it, so a reserved-name test here
 * agrees with the page that serves the request. A malformed escape is compared raw.
 */
function decodePathSegment(segment: string): string {
  if (!segment.includes('%')) return segment; // the overwhelmingly common case, untouched
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

export async function proxy(request: NextRequest) {
  assertSafeSupabaseServerEnvironment('Proxy Supabase client');

  // Compute pathname first so it's available for request-header forwarding.
  // Server Components read headers() from REQUEST headers only — setting them
  // on the response (supabaseResponse.headers.set) does NOT make them available
  // via headers() in layouts/pages. We must forward via NextResponse.next request option.
  const { pathname } = request.nextUrl;

  // ── A club's OWN web address (Club Tier Stage 4e) ──────────────────────────────────────────────
  // A host that is not ours is a club's own address: serve that club's public pages at the host's root and nothing else. This
  // comes first and returns, so such a request pays only an in-memory host lookup: no session work, none of
  // the guards below (a club's own host has no session and no operator surface). The matcher below runs the proxy
  // for these hosts and for no other public page, so www's pages still pay nothing. See lib/club-host-response.ts.
  if (!isOwnHost(request.headers.get('host'))) return clubHostResponse(request);

  const segments = pathname.split('/').filter(Boolean);

  // Build augmented request headers that include x-pathname and x-org-slug
  // so Server Components can read them via headers() without re-parsing the URL.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-pathname', pathname);
  // The address's query, for a layout (layouts are not handed searchParams): the admin layout reads `?tournamentId` /
  // `?tournamentSlug` from it so a linked event is named on the first paint (Navigation Phase 0). Forwarded on an org's
  // admin pages only (no other reader, and a query can carry a token elsewhere) and DELETED everywhere else, so a
  // browser-sent value never survives. A preference only: the layout looks it up in the scoped list.
  if (segments[1] === 'admin') requestHeaders.set('x-search', request.nextUrl.search);
  else requestHeaders.delete('x-search');
  if (segments.length >= 1) {
    requestHeaders.set('x-org-slug', segments[0]);
  }

  // Observability: stamp one x-request-id on every request so the client can read it off the
  // response and attach it to a feedback report (Phase 3 bug→error deep-link). withObservability
  // adopts this same id when a wrapped route runs, so the stored error_events.request_id matches.
  const requestId = crypto.randomUUID();
  requestHeaders.set('x-request-id', requestId);

  // Cheap fast-path for API routes that don't need the session work below: stamp the id and return
  // immediately — no Supabase getUser() round-trip. /api/admin/* is excluded so it keeps the full
  // proxy flow (its existing unauthenticated → login guard below is preserved unchanged).
  if (pathname.startsWith('/api/') && !pathname.startsWith('/api/admin')) {
    const apiRes = NextResponse.next({ request: { headers: requestHeaders } });
    apiRes.headers.set('x-request-id', requestId);
    return apiRes;
  }

  // ── A club's Coaches Portal pages: the headers, and nothing else ──────────────────────────────────
  // Matched ONLY so `x-pathname` is the proxy's, never the browser's: the coaches layout opens its billing exception on the
  // suspended wall (and its zero-team door) when this header names the billing page, and a header the browser sent itself
  // used to reach it unchanged (Plan & billing Stage 4b Part 4, owner yes 2026-10-31). No session round-trip, as before: the
  // portal never had proxy work of its own and the layout authorizes. A reserved first segment (`/platform-admin/coaches`,
  // `/my/…`, `/api/…`) is not a club and falls through to its own rules below.
  if (segments[1] === 'coaches' && !RESERVED_ORG_SLUGS.has(decodePathSegment(segments[0]))) {
    const coachesRes = NextResponse.next({ request: { headers: requestHeaders } });
    coachesRes.headers.set('x-request-id', requestId);
    return coachesRes;
  }

  // ── The family join page: the headers, and nothing else (GST/HST Stage 6 step 6.3, owner yes 2026-11-09) ──────────────
  // Matched ONLY so `x-pathname` is the proxy's: the consumer shell lets its own account doors render instead of the Terms
  // sign-in screen (lib/legal-acceptance-rules.ts CONSUMER_SHELL_DOORS), and this page — with its own third Terms box — is
  // the one such door the matcher did not already reach (`/auth/*` is matched below). No session round-trip.
  if (segments[0] === 'family' && segments[1] === 'claim') {
    const claimRes = NextResponse.next({ request: { headers: requestHeaders } });
    claimRes.headers.set('x-request-id', requestId);
    return claimRes;
  }

  // Redirect legacy /[orgSlug]/admin/tournaments/teams → /[orgSlug]/admin/tournaments/registrations
  if (segments.length >= 4 && segments[1] === 'admin' && segments[2] === 'tournaments' && segments[3] === 'teams') {
    const url = request.nextUrl.clone();
    const remainingPath = segments.slice(4).join('/');
    url.pathname = `/${segments[0]}/admin/tournaments/registrations${remainingPath ? '/' + remainingPath : ''}`;
    return NextResponse.redirect(url, { status: 301 });
  }

  // Redirect legacy org-admin link URLs before auth so login next paths use today's page — Rep Teams ›
  // Bring in a coach's team (Club Tier Stage 2; it was Organization › Coaches portal links). One hop.
  if (segments.length >= 4 && segments[0] !== 'api' && segments[1] === 'admin' && segments[2] === 'org' && segments[3] === 'team-links') {
    const url = request.nextUrl.clone();
    const remainingPath = segments.slice(4).join('/');
    url.pathname = `/${segments[0]}/admin/rep-teams/bring-in${remainingPath ? '/' + remainingPath : ''}`;
    return NextResponse.redirect(url, { status: 307 });
  }

  // The Tournaments list has ONE address (Retire the old tournament-only menu, step 1, 2026-11-20): the duplicate under
  // Organization forwards to it, search kept (`?create=1` opens the setup wizard — the Tournament plan's org layout used
  // to drop it). Before auth, so a login `next` already names today's page. 307 as above: a cached 301 outlives a change.
  if (segments.length >= 4 && segments[0] !== 'api' && segments[1] === 'admin' && segments[2] === 'org' && segments[3] === 'tournaments') {
    const url = request.nextUrl.clone();
    url.pathname = `/${segments[0]}/admin/tournaments/manage`;
    return NextResponse.redirect(url, { status: 307 });
  }

  // ⚖ The club's money pages MOVED to Accounting (Club Tier Stage 3a, Ask 2 option B): Rep Teams › Cost
  // allocation (and every allocation's own address, and New), Rep Teams › Payment requests, and a
  // ledger's own address (→ the Ledger tab on that book). Forwarded HERE, before auth and before the Rep
  // Teams layout — which sends a treasurer away, so a page-level forward would never reach the person
  // these pages now belong to (an old bookmark, a notification sent before the move). One hop each.
  if (segments.length >= 4 && segments[0] !== 'api' && segments[1] === 'admin') {
    /* ⚖ Stage 3c retired the New allocation PAGE into the line's window (Ask 6) and the shared payee's report page
       into the payee's window (Ask 7). Their addresses — and the older ones that forwarded to them — land in one hop:
       New allocation → Allocations with the window open (`?new=1`), or, from a line (`?line=`), the Budget with that
       line open; a payee's report → Payees with that payee's window open (`?payee=`). */
    const newAllocation = (segments[2] === 'rep-teams' || segments[2] === 'accounting') && segments[3] === 'allocations'
      && segments[4] === 'new' && segments.length === 5;
    const fromLine = newAllocation ? request.nextUrl.searchParams.get('line') : null;
    /* ⚖ Stage 3d retired the Payees PAGE and an allocation's PAGE into windows (Asks 1 and 3). Payees opens over the
       Ledger — `?payees=1` for the list, `?payee=` at one payee (the report page 3c retired goes straight there, and
       `accounting/payees?payee=` keeps its payee). An allocation opens over Allocations — `?allocation=`, its `?bill=`
       kept — from its own old address and from the Rep Teams one 3a moved. Notices already in people's bells carry
       these addresses. */
    const allocationId = (segments[2] === 'rep-teams' || segments[2] === 'accounting') && segments[3] === 'allocations'
      && segments.length >= 5 && !newAllocation ? segments[4] : null;
    const payees = segments[2] === 'accounting' && segments[3] === 'payees' && segments.length <= 5;
    const moved =
      newAllocation
        ? `/${segments[0]}/admin/accounting/${fromLine ? 'budget' : 'allocations'}`
      : allocationId || (segments[2] === 'rep-teams' && segments[3] === 'allocations')
        ? `/${segments[0]}/admin/accounting/allocations`
      : segments[2] === 'rep-teams' && segments[3] === 'payment-requests' && segments.length === 4
        ? `/${segments[0]}/admin/accounting/payment-requests`
      : segments[2] === 'accounting' && segments[3] === 'ledger' && segments.length === 5
        ? `/${segments[0]}/admin/accounting/ledger`
      : payees
        ? `/${segments[0]}/admin/accounting/ledger`
      // Stage 3b retired the budget line's own Allocate page into New allocation, opened from the line (3c: its window).
      : segments[2] === 'accounting' && segments[3] === 'budget' && segments[4] === 'allocate' && segments.length === 6
        ? `/${segments[0]}/admin/accounting/budget`
      : null;
    if (moved) {
      const url = request.nextUrl.clone();
      url.pathname = moved;
      if (segments[3] === 'ledger') url.searchParams.set('book', segments[4]);
      if (segments[3] === 'budget') url.searchParams.set('line', segments[5]);
      if (payees) {
        if (segments.length === 5) url.searchParams.set('payee', segments[4]);
        else if (!url.searchParams.get('payee')) url.searchParams.set('payees', '1');
      }
      if (allocationId) url.searchParams.set('allocation', allocationId);
      if (newAllocation) {
        url.searchParams.delete('year');
        if (!fromLine) url.searchParams.set('new', '1');
      }
      return NextResponse.redirect(url, { status: 307 });
    }
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

  // Refresh the session if expired - required to keep Server Components in sync. A person with two-step on whose session
  // has not typed the code counts as signed OUT here (lib/two-step-session.ts), so a protected page sends them to sign-in,
  // which opens on its code step.
  const user = await getSignedInUser(supabase);

  // Protect /[orgSlug]/admin/* routes - second path segment must be 'admin'
  const isOrgAdmin = segments.length >= 2 && segments[1] === 'admin';
  const isLegacyAdmin = segments[0] === 'admin';
  const isOrgScorekeeper = segments.length >= 2 && segments[0] !== 'api' && segments[1] === 'scorekeeper';
  const isOrgCheckIn = segments.length >= 2 && segments[0] !== 'api' && segments[1] === 'check-in';

  if ((isOrgAdmin || isLegacyAdmin || isOrgScorekeeper || isOrgCheckIn) && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/login';
    // WI-2: preserve the query string so a deep-linked score push (…/results?tournamentId=&gameId=)
    // survives the sign-in round-trip. Only this branch carries a meaningful query; the legacy /admin
    // redirect keeps its bare path. safeNextPath already preserves `search` on the login side.
    url.searchParams.set('next', isLegacyAdmin ? '/admin' : pathname + request.nextUrl.search);
    return NextResponse.redirect(url);
  }

  // No Tournament-tier bounce here (Support console Stage 4, owner 2026-10-25): which plan a club is on right now is
  // free time's question, answered by the door on the server (lib/entitlement-grants.ts). The org-admin layout asks
  // it and is the boundary; a proxy-side copy read the stored plan and would bounce a club on free Club time.

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

  // Protect Basic Coaches Portal tournament records while leaving signup, paid activation,
  // and checkout completion public — checkout completion (design_decisions S1-2) must render for a
  // just-signed-up coach whether or not the browser session is established yet, and it exposes
  // nothing sensitive.
  const isRootCoachesSection = segments[0] === 'coaches';
  const isPublicCoachesPath =
    isRootCoachesSection &&
    ['join', 'start', 'checkout'].includes(segments[1] ?? '');

  if (isRootCoachesSection && !isPublicCoachesPath && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  // (/home is no longer auth-gated here — Unified Home retired the workspace launchpad;
  //  /home is now a permanent redirect to the PUBLIC Home (/discover), so anon visitors
  //  following an old /home link must reach Home, not bounce through login.)

  // Carry the request id onto the response so the client can read it (pages + /api/admin/*).
  supabaseResponse.headers.set('x-request-id', requestId);
  return supabaseResponse;
}

export const config = {
  matcher: [
    '/:slug/admin',
    '/:slug/admin/:path*',
    '/:slug/scorekeeper/:path*',
    '/:slug/check-in/:path*',
    '/admin',
    '/admin/:path*',
    '/auth/:path*',
    '/platform-admin',
    '/platform-admin/:path*',
    '/platform-admin/login',
    // All API routes: /api/admin/* runs the full proxy below; every other /api/* hits the cheap
    // x-request-id fast-path at the top (no session work). Replaces the prior per-prefix /api entries.
    '/api/:path*',
    '/my',
    '/my/:path*',
    '/coaches',
    '/coaches/:path*',
    // A club's Coaches Portal: so `x-pathname` is ours (the early return above sets the headers and stops).
    '/:slug/coaches',
    '/:slug/coaches/:path*',
    // The family join page: so `x-pathname` is ours (the early return above, step 6.3).
    '/family/claim/:path*',
    // ── A club's own web address (Club Tier Stage 4e): every request to a host that is NOT ours ──────────
    // Evaluated by the router before the proxy runs, so a request to www.fieldlogichq.ca pays nothing for this entry.
    // ⚠ The host pattern is a LITERAL copy of OWN_HOST_PATTERN (lib/own-hosts.ts): matcher values must be statically analyzable
    // and a variable is silently ignored. tests/unit/club-host.test.ts pins the two together.
    { source: '/((?!_next/static|_next/image).*)',
      missing: [{ type: 'host', value: '(?:(?:[a-z0-9-]+\\.)*fieldlogichq\\.(?:ca|com)|(?:[a-z0-9-]+\\.)*amplifyapp\\.com|localhost|(?:\\d{1,3}\\.){3}\\d{1,3})' }] },
  ],
};
