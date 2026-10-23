/**
 * lib/sponsor-logo.ts — WHERE A CLUB SPONSOR'S LOGO LIVES AND WHAT ADDRESS MAY NAME IT (Club Tier Stage 4d).
 *
 * A sponsor's logo is shown to the public, so the only address the product will store or render is one its own upload route
 * wrote: https, this project's storage host, the public `org-logos` bucket, inside THIS club's `sponsors` folder, one
 * file named by a random id. The address also drives a service-role delete, so it must never name another club's file.
 * Pure (no storage client), so the editor's window and the route share it; the re-encode is lib/sponsor-logo-image.ts.
 * Words: CLUB_TIER_STAGE4D_COPY.md. Tested in tests/unit/club-stage4d.test.ts.
 */

import { ORG_LOGO_BUCKET } from './org-image-limits';

export const SPONSOR_LOGO_FOLDER = 'sponsors';

/** The stored size: three times the editor's 160 by 72 box, so it stays sharp on a phone's dense screen. */
export const SPONSOR_LOGO_MAX_WIDTH = 480;
export const SPONSOR_LOGO_MAX_HEIGHT = 216;

const FILE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.png$/;

/** The path (after the host) a made file is served from. */
export function sponsorLogoPublicPath(orgId: string, fileName: string): string {
  return `/storage/v1/object/public/${ORG_LOGO_BUCKET}/${orgId}/${SPONSOR_LOGO_FOLDER}/${fileName}`;
}

/** The bucket path of a made file. */
export function sponsorLogoObjectPath(orgId: string, fileName: string): string {
  return `${orgId}/${SPONSOR_LOGO_FOLDER}/${fileName}`;
}

/** A new file name: a random id (the file is not tied to a sponsor, which has no id until it is saved). */
export function newSponsorLogoFileName(): string {
  return `${crypto.randomUUID()}.png`;
}

/**
 * The bucket path `url` names, or null for anything that is not one of `orgId`'s own sponsor logos. `origin` is the
 * project's storage origin (defaults to NEXT_PUBLIC_SUPABASE_URL). No query, no fragment, no login part, no nesting.
 */
export function parseSponsorLogoUrl(
  url: string | null | undefined,
  orgId: string,
  origin: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_URL,
): { objectPath: string } | null {
  if (!url || !origin || !orgId) return null;
  let u: URL;
  let o: URL;
  try { u = new URL(url); o = new URL(origin); } catch { return null; }
  if (u.protocol !== 'https:' || u.host !== o.host || u.username || u.password || u.search || u.hash) return null;
  const prefix = sponsorLogoPublicPath(orgId, '');
  if (!u.pathname.startsWith(prefix)) return null;
  const file = u.pathname.slice(prefix.length);
  return FILE.test(file) ? { objectPath: sponsorLogoObjectPath(orgId, file) } : null;
}

/** Whether `url` is one of `orgId`'s own sponsor logos. */
export const isOwnSponsorLogo = (url: string | null | undefined, orgId: string, origin?: string): boolean =>
  parseSponsorLogoUrl(url, orgId, origin) !== null;
