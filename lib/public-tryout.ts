import 'server-only';
import { getOrganizationBySlug, getRepProgramYears, getRepTeamBySlug } from './db';
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
}

export async function resolvePublicTryout(orgSlug: string, teamSlug: string): Promise<PublicTryoutContext | null> {
  const org = await getOrganizationBySlug(orgSlug);
  if (!org) return null;
  const team = await getRepTeamBySlug(org.id, teamSlug);
  if (!team) return null;
  const seasons = await getRepProgramYears(team.id);
  return {
    org, team, seasons,
    live: liveSeasonOf(seasons),
    open: publicTryoutSeasonOf(team, seasons),
  };
}

export { publicTryoutHref, publicTryoutRegisterHref } from './public-tryout-links';
