import 'server-only';
import { getClubSiteContent, getClubTeam, getClubTeamSeasons } from './club-page-meta';
import { resolvePublicClub } from './public-club-page';
import { liveSeasonOf, publicTryoutSeasonOf } from './season-live';
import type { Organization, RepProgramYear, RepTeam } from './types';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * A TEAM'S PUBLIC TRYOUT, RESOLVED ONCE (Club Tier Stage 2, B07 — routing and rules only; the
 * public pages' look is Stage 4's).
 *
 * `/{org}/teams/{team}/tryouts` always means the team's LIVE season with tryouts open. The old
 * season-numbered addresses redirect there when their season is the live one, and otherwise say
 * the team isn't taking sign-ups. Every public reader — these pages, the team page's banner, the
 * sign-up API and the club homepage's list — asks `publicTryoutSeasonOf`, so no two of them can
 * advertise or accept different seasons again.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
export interface PublicTryoutContext {
  org: Organization;
  team: RepTeam;
  seasons: RepProgramYear[];
  /** The team's live season (draft or active), whatever its tryouts switch says. */
  live: RepProgramYear | null;
  /** The season a family can sign up for right now, or null. */
  open: RepProgramYear | null;
  /**
   * Where a family's questions go: the club's public-site contact (Admin › Public site, "Families' questions go to").
   * ⚠ Never `org.contactEmail` — it maps `organizations.contact_email`, a column that does not exist, so it is always
   * empty and the closed tryout's "Contact us" never showed (F09, Club Tier Stage 4a).
   */
  contactEmail: string | null;
}

export async function resolvePublicTryout(orgSlug: string, teamSlug: string): Promise<PublicTryoutContext | null> {
  // The one rule (Club Tier Stage 4a, lib/public-club-access.ts): every tryout address and the sign-up form come through
  // here, so none of them renders for a club that refuses it.
  const org = await resolvePublicClub(orgSlug, 'teams');
  if (!org) return null;
  // Cached for the request: the page's title read the same team (Club Tier Stage 4b-1).
  const team = await getClubTeam(org.id, teamSlug);
  if (!team) return null;
  // Read beside the seasons (no added wait). Always read: the old season-numbered pages show the closed state whatever
  // the live season is doing, and their "Contact us" needs it too.
  const [seasons, siteContent] = await Promise.all([getClubTeamSeasons(team.id), getClubSiteContent(org.id)]);
  return {
    org, team, seasons,
    contactEmail: siteContent?.contactEmail ?? null,
    live: liveSeasonOf(seasons),
    open: publicTryoutSeasonOf(team, seasons),
  };
}

export { publicTryoutHref, publicTryoutRegisterHref } from './public-tryout-links';
