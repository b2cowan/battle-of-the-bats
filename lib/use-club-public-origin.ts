'use client';
/**
 * THE ADDRESS A CLUB'S PUBLIC PAGES ARE HANDED OUT AT, for the admin and coach screens that copy or print a link to them
 * (Club Tier Stage 4e, Part 5). `https://www.lakeshorelynx.ca` while the club's own web address is handed out (connected or
 * needs attention), else the address the person is on (`window.location.origin`), which is fieldlogichq.ca for every club
 * without one. Asked once per club per page load from /api/public/club-origin and remembered.
 *
 *   const origin = useClubPublicOrigin(orgSlug);
 *   copy(`${origin}${publicPath}`)       // publicPath WITHOUT the club's name when the origin is the club's own: use publicHref
 *
 * ⚠ A link to a club's public page must be spelled for the origin it is built on: `publicHref(origin, orgSlug, '/teams/13u-aa')`
 * is `https://www.lakeshorelynx.ca/teams/13u-aa` on the club's own address and `https://fieldlogichq.ca/lakeshore-lynx/teams/13u-aa`
 * on ours. The screens that hand out a STAFF link (the scorekeeper kit, a tryout evaluator, a chat invite, a coach's private
 * calendar feed) deliberately stay on FieldLogicHQ and never use this: tests/unit/club-share-census.test.ts lists both groups.
 */
import { useEffect, useState } from 'react';

const known = new Map<string, string | null>();
const inflight = new Map<string, Promise<string | null>>();

function ask(slug: string): Promise<string | null> {
  const hit = known.get(slug);
  if (hit !== undefined) return Promise.resolve(hit);
  let p = inflight.get(slug);
  if (!p) {
    p = fetch(`/api/public/club-origin?orgSlug=${encodeURIComponent(slug)}`)
      .then(r => (r.ok ? r.json() : { origin: null }))
      .then((d: { origin?: string | null }) => d.origin ?? null)
      .catch(() => null)
      .then(origin => { known.set(slug, origin); inflight.delete(slug); return origin; });
    inflight.set(slug, p);
  }
  return p;
}

/** The club's own origin when it has one handed out; otherwise the address this page is on ('' before the browser). */
export function useClubPublicOrigin(orgSlug: string | null | undefined): string {
  const [own, setOwn] = useState<string | null>(() => (orgSlug ? known.get(orgSlug) ?? null : null));
  useEffect(() => {
    if (!orgSlug) return;
    let stale = false;
    void ask(orgSlug).then(o => { if (!stale) setOwn(o); });
    return () => { stale = true; };
  }, [orgSlug]);
  return own ?? (typeof window !== 'undefined' ? window.location.origin : '');
}

/**
 * A link to one of the club's public pages on `origin` (from `useClubPublicOrigin`): without the club's name when the origin
 * is the club's own address (it carries no club name), with it on ours. `path` starts with a slash, or is '' for the club's home.
 */
export function publicHref(origin: string, orgSlug: string, path = ''): string {
  const ownAddress = typeof window !== 'undefined' && origin !== window.location.origin;
  return ownAddress ? `${origin}${path || '/'}` : `${origin}/${orgSlug}${path}`;
}
