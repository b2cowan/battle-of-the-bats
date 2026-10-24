'use client';
/**
 * `usePathname()` for every surface a club's own address can show (Club Tier Stage 4e, Part 4b): the same path on a club's own
 * host as on fieldlogichq.ca, with the club's name in front, so the club frame, the nav, the active tab and the chrome gates all
 * decide exactly as they do on ours. On our own hosts, and on every route that names no club, it is `usePathname()` itself.
 * The club's name comes from the route parameter: see lib/club-base.ts for why that, and not the address, is the truth.
 *
 * A component that reads the address to decide what to draw uses this, never `usePathname` from next/navigation (a test pins it).
 */
import { useParams, usePathname } from 'next/navigation';
import { clubBaseFor, internalPath, orgHref, wwwHref, type ClubBase } from './club-base';

export function usePublicPathname(): string {
  const pathname = usePathname();
  const params = useParams<{ orgSlug?: string | string[] }>();
  const slug = Array.isArray(params?.orgSlug) ? params.orgSlug[0] : params?.orgSlug;
  return internalPath(pathname, slug);
}

/** The club this route names and whether the visitor is on its own address; null on a route that names no club. */
export function useClubBase(): ClubBase | null {
  const pathname = usePathname();
  const params = useParams<{ orgSlug?: string | string[] }>();
  const slug = Array.isArray(params?.orgSlug) ? params.orgSlug[0] : params?.orgSlug;
  return clubBaseFor(pathname, slug);
}

/**
 * `href('/teams')` -> the link to the club's Teams page in the address the visitor is on. Falls back to the club slug passed in
 * (a component that was handed it) on a route that names no club, so it is safe anywhere.
 */
export function useOrgHref(fallbackSlug?: string): (path?: string) => string {
  const base = useClubBase();
  return (path = '') => {
    const b: ClubBase | null = base ?? (fallbackSlug ? { slug: fallbackSlug, ownHost: false } : null);
    return b ? orgHref(b, path) : path || '/';
  };
}

/** The site's own address, inlined at build (the same variable the server uses for the canonical address). */
const APP_ORIGIN = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.fieldlogichq.ca';

/**
 * `www('/auth/login')` -> that path on our own hosts, `https://www.fieldlogichq.ca/auth/login` on a club's own address: sign-in,
 * the coaches portal and password reset exist only on FieldLogicHQ (lib/club-base.ts wwwHref).
 */
export function useWwwHref(): (path: string) => string {
  const base = useClubBase();
  return path => wwwHref(base, APP_ORIGIN, path);
}
