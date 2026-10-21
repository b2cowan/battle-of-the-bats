import 'server-only';
import { cache } from 'react';
import type { Metadata } from 'next';
import { getOrganizationBySlugForServer } from './server-organizations';
import { getLeagueSeasonBySlug, getOrgPublicSiteContent, getRepProgramYears, getRepTeamBySlug } from './db';
import { clubPageTitle } from './club-site';
import { homeCard, shareCardPath } from './club-share';
import { hasModuleEntitlement } from './module-entitlements';
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

/** A team's seasons, once per request (the team and tryout pages, their titles and the tryout page's resolver). */
export const getClubTeamSeasons = cache(getRepProgramYears);

/** A house-league season by slug, once per request (the season pages' titles and bodies). */
export const getClubSeason = cache(getLeagueSeasonBySlug);

/**
 * What a page says about itself beyond its name (Club Tier Stage 4b-2b, End state 8): the description a shared link
 * shows, and its preview card — the card's address (one of the club's generated `opengraph-image` routes) and what it
 * shows, said aloud.
 */
export interface ClubPageMeta {
  name: string | null;
  description?: string | null;
  card?: { path: string; alt: string } | null;
}

/**
 * A club page's metadata: "page · club". `pageName` returns the page's own name (the team's, the season's), or null
 * when the page cannot name itself — then the title is the club's name alone. It may return a `ClubPageMeta` instead, to
 * add its description and its preview card.
 */
export async function clubPageMetadata(
  orgSlug: string,
  pageName: (club: Organization) => Promise<string | ClubPageMeta | null | undefined> | string | ClubPageMeta | null | undefined,
): Promise<Metadata> {
  const club = await getClubBySlug(orgSlug);
  if (!club) return {};
  // A closed club's pages are the neutral refusal: the tab names the club, never the team or season behind it (and the
  // page's own lookup is not spent on a page that will not render).
  if (!isPublicClubSiteOpen(club)) return { title: { absolute: clubPageTitle(null, club.name) } };
  const page = await pageName(club);
  const meta: ClubPageMeta = typeof page === 'object' && page ? page : { name: page ?? null };
  const title = clubPageTitle(meta.name, club.name);
  const description = meta.description?.trim() || undefined;
  // A page that names no card of its own shares the club's (Stage 4b-2b): the same image it would inherit, said aloud.
  const card = meta.card ?? {
    path: shareCardPath.home(orgSlug),
    alt: homeCard({
      clubName: club.name,
      tagline: hasModuleEntitlement(club, 'module_public_site') ? (await getClubSiteContent(club.id))?.tagline ?? null : null,
    }).alt,
  };
  return {
    title: { absolute: title },
    ...(description ? { description } : {}),
    openGraph: {
      title,
      ...(description ? { description } : {}),
      images: [{ url: card.path, width: 1200, height: 630, alt: card.alt }],
    },
  };
}
