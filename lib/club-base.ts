/**
 * A CLUB'S OWN ADDRESS, FOR LINKS AND PATHS (Club Tier Stage 4e, Part 4b). Pure; the hook (lib/use-public-pathname.ts) and the
 * server helper (lib/org-links.ts) are thin wrappers, and a plain Node test pins the rules.
 *
 * Two facts about a club's own host, both settled by the spike on the dev server:
 *   1. The browser's address has no club name in it (`/teams`, not `/lakeshore-lynx/teams`), so everything that reads the
 *      address and expects the club's name first (the club frame, the nav, the active tab, the chrome gates) sees a different
 *      path than it does on fieldlogichq.ca.
 *   2. The ROUTE's parameters still name the club, on the server and in the browser (the router matched `/lakeshore-lynx/teams`).
 *
 * So the club's name comes from the route parameter, never from the address, and `internalPath` puts it back in front: the one
 * path every existing parser already understands. A club's own host is recognised by the mismatch itself: a route that names a
 * club whose name the address does not start with.
 */

/** The club named by the route, and whether the address is the club's own (its name is not in the address). */
export interface ClubBase {
  slug: string;
  ownHost: boolean;
}

const startsWithSlug = (pathname: string, slug: string) => pathname === `/${slug}` || pathname.startsWith(`/${slug}/`);

/**
 * The base for this address and route: null when the route names no club (a marketing page, the consumer shell).
 * `routeSlug` is the `orgSlug` route parameter.
 */
export function clubBaseFor(pathname: string, routeSlug: string | null | undefined): ClubBase | null {
  if (!routeSlug) return null;
  return { slug: routeSlug, ownHost: !startsWithSlug(pathname, routeSlug) };
}

/** The path as every existing parser expects it, with the club's name in front, whichever address the visitor is on. */
export function internalPath(pathname: string, routeSlug: string | null | undefined): string {
  const base = clubBaseFor(pathname, routeSlug);
  if (!base || !base.ownHost) return pathname;
  return `/${base.slug}${pathname === '/' ? '' : pathname}`;
}

/**
 * A link to a page of the club, as the visitor's own address spells it: `/teams` on the club's own host, `/lakeshore-lynx/teams`
 * on ours. `path` starts with a slash (`'/teams'`) or is empty/`'/'` for the club's home.
 */
export function orgHref(base: ClubBase, path: string = ''): string {
  const clean = path === '/' ? '' : path;
  if (base.ownHost) return clean || '/';
  return `/${base.slug}${clean}`;
}
