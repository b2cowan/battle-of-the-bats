import 'server-only';
import { cache } from 'react';
import type { Metadata } from 'next';
import { getOrganizationBySlugForServer } from './server-organizations';
import { getLeagueSeasonBySlug, getOrgPublicSiteContent, getRepTeamBySlug } from './db';
import { clubPageTitle } from './club-site';
import { isPublicClubSiteOpen } from './public-club-access';
import type { Organization } from './types';

/**
 * lib/club-page-meta.ts — the server reads behind a club page's title and frame (Club Tier Stage 4b-1).
 *
 * Each club page names itself in the browser tab ("15U AAA tryouts · Lakeshore Lynx"). The title is ABSOLUTE rather
 * than the org layout's template, because that layout also titles every tournament page ("Spring Classic | Lakeshore
 * Lynx") and tournament pages are not this stage's to change.
 *
 * The reads are cached for the request (React `cache`), so a page's title, the layout's frame and the page itself ask
 * the database once between them — as long as the page reads through these too.
 */

/** The club behind a slug, once per request. */
export const getClubBySlug = cache(getOrganizationBySlugForServer);

/** The club's public-site content (tagline, contact, social links), once per request. A failed read costs the footer
 *  its contact and links, never the page. */
export const getClubSiteContent = cache((orgId: string) => getOrgPublicSiteContent(orgId).catch(() => null));

/** A club's rep team by slug, once per request (the team and tryout pages' titles and bodies). */
export const getClubTeam = cache(getRepTeamBySlug);

/** A house-league season by slug, once per request (the season pages' titles and bodies). */
export const getClubSeason = cache(getLeagueSeasonBySlug);

/**
 * A club page's metadata: "page · club". `pageName` returns the page's own name (the team's, the season's), or null
 * when the page cannot name itself — then the title is the club's name alone.
 */
export async function clubPageMetadata(
  orgSlug: string,
  pageName: (club: Organization) => Promise<string | null | undefined> | string | null | undefined,
): Promise<Metadata> {
  const club = await getClubBySlug(orgSlug);
  if (!club) return {};
  // A closed club's pages are the neutral refusal: the tab names the club, never the team or season behind it (and the
  // page's own lookup is not spent on a page that will not render).
  if (!isPublicClubSiteOpen(club)) return { title: { absolute: clubPageTitle(null, club.name) } };
  const page = await pageName(club);
  return { title: { absolute: clubPageTitle(page, club.name) } };
}
