/**
 * THE PROXY'S ANSWER ON A CLUB'S OWN ADDRESS (Club Tier Stage 4e, Part 4a). `proxy.ts` calls this first for any host that is
 * not ours, and returns what it returns: the request never reaches the session work, the sandbox rules or the guards, because
 * a club's own host has no session (cookies are host-only), no sandbox and none of the operator surfaces.
 *
 * What a path means is `routeClubHostPath` (lib/club-host.ts); this only turns that into a Next response. The host is read from
 * the plain `Host` header and nothing else: Amplify's edge refuses a Host it does not serve, so it is the one a visitor cannot
 * choose (see lib/request-host.ts).
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { bareHost } from './own-hosts';
import { clubHosts, routeClubHostPath, type ClubHostCache } from './club-host';

const text = (body: string, status: number, extra: Record<string, string> = {}) =>
  new NextResponse(body, { status, headers: { 'content-type': 'text/plain; charset=utf-8', ...extra } });

export async function clubHostResponse(request: NextRequest, cache: ClubHostCache = clubHosts): Promise<NextResponse> {
  const host = bareHost(request.headers.get('host'));
  const found = await cache.lookup(host);

  // The table could not be read and nothing is remembered yet: say so, so a crawler or a person tries again, not a 404 they keep.
  if (found === 'unavailable') return text('This address is not available right now. Try again in a moment.', 503, { 'retry-after': '30' });
  if (!found) return text('Not found', 404);

  const requestId = crypto.randomUUID();
  const headers = new Headers(request.headers);
  headers.set('x-request-id', requestId);
  const url = request.nextUrl.clone();
  const route = routeClubHostPath(found.slug, request.nextUrl.pathname);

  let res: NextResponse;
  switch (route.kind) {
    case 'pass':
      res = NextResponse.next({ request: { headers } });
      break;
    case 'redirect': {
      // Built from the host the visitor used, never from the server's own idea of its address (behind the edge that can be an
      // internal name). Always https in production; a local run keeps its own scheme and port.
      const dev = process.env.NODE_ENV !== 'production';
      const origin = dev ? `${request.nextUrl.protocol}//${request.headers.get('host') ?? host}` : `https://${host}`;
      // 308: the same method and body, and a link that still carries the club's name keeps working, permanently.
      res = NextResponse.redirect(new URL(`${route.to}${request.nextUrl.search}`, origin), 308);
      break;
    }
    case 'notfound':
      return text('Not found', 404);
    case 'rewrite':
      url.pathname = route.to;
      res = NextResponse.rewrite(url, { request: { headers } });
      break;
  }
  res.headers.set('x-request-id', requestId);
  return res;
}
