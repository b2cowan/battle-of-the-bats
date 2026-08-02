import 'server-only';
import { getRepProgramYear, getRepRosterPlayer, getRepTeam } from './db';
import {
  getEnabledFamilyOrg,
  isVisibleToFamilies,
  getTeamFamilyAccess,
  type FamilyLink,
} from './family-access';
import { guardianLinkEarnsPlayerData } from './family-guardian-view';
import type { RepProgramYear, RepTeam } from './types';

/**
 * lib/family-recap.ts — may this family read their child's season recap, and which season?
 *
 * ⚠ THIS IS THE ARCHIVE EXEMPTION, and it is deliberate. Every other family surface reads the
 * team's ACTIVE season. This one resolves the season from the guardian's OWN LINK — a guardian
 * link is tied to a season-scoped roster row, so the link itself names which season this family
 * may read. That is the approved decision-#2 exemption (a family reads their own past season);
 * it is confined to this file, it reaches nothing on the coach side, and it touches neither
 * `APPROVED_ARCHIVE_DOORS` nor `APPROVED_SEASON_AWARE_ROUTES` because it is not a coach route.
 *
 * A recap that vanished when the season closed would be self-defeating: the season's end is
 * the only moment it is for.
 *
 * ⚠ THIS MODULE ONLY READS. Recording that a family opened their recap is a WRITE and lives at
 * the page that represents the opening — see `lib/family-engagement.ts`. Every resolver in the
 * family layer (`getFamilyTeamView`, `resolveGuardianPayloadForLink`, this one) is a pure read,
 * and a function shaped like its siblings must not be the one that quietly mutates: a future
 * caller wanting the recap for a digest or an export would stamp a phantom view.
 */

export type FamilyRecapAvailability =
  /** Everything checks out; the season is closed and the recap can be assembled. */
  | {
      status: 'ready';
      team: RepTeam;
      programYear: RepProgramYear;
      playerId: string;
      linkId: string;
      orgName: string;
    }
  /** Connected, but the season is still being played — the recap is not written yet. */
  | { status: 'season_open'; seasonName: string }
  /** Nothing to show, and no reason to explain which of the many reasons it was. */
  | { status: 'unavailable' };

/**
 * The gates, in fail-closed order: tier, entitlement, visibility, roster row, season status.
 *
 * ⚠ THE CALLER SUPPLIES THE VERIFIED LINK. `getVerifiedLinkForUserTeam(userId, teamId)` is the
 * one place that decides whether a signed-in person is connected to a team, and both callers
 * already hold its answer for their own reasons. Taking the link rather than a user id keeps
 * that decision in exactly one function instead of being re-derived here — and makes this
 * resolver's contract the honest one: *given a proven link, is there a recap behind it?*
 *
 * No client-supplied player id is accepted anywhere: the child is whoever the coach attached
 * to this link, which is what makes "guardian of player A cannot reach player B" structural
 * rather than checked.
 */
export async function resolveFamilyRecapAvailability(params: {
  /** Already proven by `getVerifiedLinkForUserTeam` for the signed-in user AND this team. */
  link: FamilyLink;
  repTeamId: string;
  /**
   * The premium gate's answer, when the caller already has it. Omitted ⇒ resolved here. The
   * family team page runs the same gate to decide whether to serve a schedule at all, so
   * passing it through saves that request a second entitlement round-trip; a caller that
   * omits it is never LESS gated, only slower.
   */
  org?: { name: string } | null;
}): Promise<FamilyRecapAvailability> {
  const { link, repTeamId } = params;

  // The tier boundary — the same predicate the guardian payload uses, not a second copy.
  // A follower reaching this URL gets `unavailable`, which is also what a stranger gets.
  if (!guardianLinkEarnsPlayerData(link)) return { status: 'unavailable' };
  if (link.repTeamId !== repTeamId) return { status: 'unavailable' };

  const org = params.org ?? await getEnabledFamilyOrg(link.orgId, repTeamId);
  if (!org) return { status: 'unavailable' };

  // The coach's one master switch for family-facing surfaces. It is named for the schedule
  // because that is what it started as, but a coach who sets a team to "Staff only" means
  // "families see nothing right now" — leaving a child's recap open behind that would be a
  // surprise, and surprises are how a privacy setting loses its meaning.
  const access = await getTeamFamilyAccess(repTeamId);
  if (!access || !isVisibleToFamilies(access.scheduleVisibility)) return { status: 'unavailable' };

  const player = await getRepRosterPlayer(link.playerId);
  // A deleted roster row, or one belonging to another team: both unavailable.
  if (!player || player.teamId !== repTeamId) return { status: 'unavailable' };

  const programYear = await getRepProgramYear(player.programYearId);
  if (!programYear || programYear.teamId !== repTeamId) return { status: 'unavailable' };

  // A season still in play has no recap. Closing the season IS the release act: afterwards no
  // write to that season is accepted anywhere in the portal, so what the coach previewed
  // during the season is exactly what the family now reads.
  if (programYear.status !== 'completed' && programYear.status !== 'archived') {
    return { status: 'season_open', seasonName: programYear.name };
  }

  const team = await getRepTeam(repTeamId);
  if (!team) return { status: 'unavailable' };

  return {
    status: 'ready',
    team,
    programYear,
    playerId: link.playerId,
    linkId: link.id,
    orgName: org.name,
  };
}
