import { isTeamWorkspaceOrg } from './team-workspace-kind';
import type { Organization } from './types';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * WHO HOLDS A TEAM'S SEASON DOORS — ONE ANSWER, READ BY THE SERVER AND THE SCREENS ALIKE.
 *
 * *Start next season*, *Close the season* and *Reopen* are one power wearing three labels. A
 * standalone Coaches Portal's head coach holds it; for every other team the CLUB holds it (Club
 * Tier Stage 2, Ask 1 (a), owner 2026-09-28) and the portal shows no door.
 *
 * ⚠ PURE AND CLIENT-SAFE ON PURPOSE (Club Tier S2-01). The closed-season page used to decide from
 * the account kind alone, while the server also excluded a team workspace whose portal a club has
 * adopted (`org_owned`) or archived — so that head coach was offered two buttons the server
 * refused, and never read "Seasons are managed by …". One function here, asked by both, is what
 * makes that disagreement impossible rather than merely fixed.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
export type SeasonDoorOrg = Pick<Organization, 'accountKind' | 'planId' | 'teamWorkspaceStatus'>;

/** Does this org's own head coach manage its seasons? True only for a live standalone portal. */
export function orgManagesOwnSeasons(org: SeasonDoorOrg | null | undefined): boolean {
  if (!org || !isTeamWorkspaceOrg(org)) return false;
  return org.teamWorkspaceStatus !== 'org_owned' && org.teamWorkspaceStatus !== 'archived';
}

/** May this coach start, close or reopen a season? Standalone portal AND head coach. */
export function mayManageSeasons(
  org: SeasonDoorOrg | null | undefined,
  coachRole: 'head_coach' | 'assistant_coach' | null | undefined,
): boolean {
  return orgManagesOwnSeasons(org) && coachRole === 'head_coach';
}

/**
 * Who ended a season the coach finds closed. Derived, never stored: a club team's season can only
 * be closed by the club, and a standalone team's only by its own head coach, so the team's kind IS
 * the answer (Club Tier Stage 2, specimen 4 frame C — the refused-save sentence names who).
 */
export function seasonsClosedBy(org: SeasonDoorOrg | null | undefined): 'club' | 'coach' {
  return orgManagesOwnSeasons(org) ? 'coach' : 'club';
}

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE ONE ANSWER TO A SAVE ON A TEAM WITH NO LIVE SEASON (Club Tier Stage 2, specimen 4 frame C).
 *
 * A coach had the roster open when the club closed the season, and pressed Save. Every portal
 * write route used to answer that with a bare 403 "Forbidden" (the live-assignment lookup refuses
 * before any season message is reached). It now answers with one CODED body, so the screen can say
 * the drawn sentence and offer the one door (the closed season's page) — never a year parameter:
 * the door is the team's closed-season page, which already knows its season.
 *
 * `error` carries the sentence for any client that shows `error` as it stands today; `code`,
 * `seasonName` and `closedBy` are what a screen that knows the shape draws from.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
export const SEASON_NOT_LIVE = 'season_not_live' as const;

export interface SeasonNotLiveRefusal {
  error: string;
  code: typeof SEASON_NOT_LIVE;
  /** The team's newest closed season's name ("2026 Season"), or null when it has never had one. */
  seasonName: string | null;
  closedBy: 'club' | 'coach';
}

export function seasonNotLiveRefusal(
  org: SeasonDoorOrg & { name: string },
  seasonName: string | null,
): SeasonNotLiveRefusal {
  const closedBy = seasonsClosedBy(org);
  const error = seasonName == null
    ? 'This team has no season running, so this change wasn’t saved.'
    : closedBy === 'club'
      ? `${org.name} closed the ${seasonName}, so this change wasn’t saved.`
      : `The ${seasonName} has been closed, so this change wasn’t saved.`;
  return { error, code: SEASON_NOT_LIVE, seasonName, closedBy };
}
