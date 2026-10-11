import 'server-only';
import { isFamilyLayerEnabled, isPubliclyVisible } from './family-access';
import { getFamilyTeamView, type FamilyTeamView } from './family-view';
import { isOrgBillingSuspended } from './org-billing-access';
import type { Organization, RepTeam } from './types';

/**
 * lib/public-team-schedule.ts — ONE QUESTION, ASKED ONCE: may anyone, with no account, read this team's schedule?
 * (Club Tier Stage 6d, A3 — S6D-09 and D07, ruled 2026-10-11.)
 *
 * Three things answer it and they must never disagree: the team's public page drawing its schedule, the page's
 * Subscribe button, and the team's public calendar feed (`/{org}/teams/{team}/calendar`). Before 6d the page asked
 * less than the feed did — it never asked whether the club had cancelled — so a cancelled club's Public link schedule
 * kept showing on its page while the feed refused it. A tests/unit guard holds that this is the only place the
 * public schedule is decided: the page, the button and the feed all read it.
 *
 * The answer is yes exactly when:
 *   1. the coach set the schedule to Public link — checked FIRST, off the already-loaded team row, so a team that never
 *      turned it on (nearly all of them) pays no query for this on a page that gets public traffic;
 *   2. the club hasn't cancelled — read off the already-loaded org, the same rule as `getOrgForGate`;
 *   3. the team is entitled to the family layer (Premium Coaches Portal / Club — `isFamilyLayerEnabled`);
 *   4. the team isn't archived, and it has a live season — `getFamilyTeamView` re-checks both with the visibility, and
 *      returns the season's events (the family list's allow-list: no uniform, no coach's notes, no child).
 *
 * Returns the view or null. Null on the page means no schedule and no button; on the feed it means an EMPTY calendar
 * under the team's name, so its families' entries leave instead of freezing (S6D-04).
 */
export async function getPublicTeamSchedule(params: {
  org: Pick<Organization, 'id' | 'accountKind' | 'planId' | 'subscriptionStatus'>;
  team: Pick<RepTeam, 'id' | 'scheduleVisibility'>;
}): Promise<FamilyTeamView | null> {
  const { org, team } = params;
  if (!isPubliclyVisible(team.scheduleVisibility)) return null;
  if (isOrgBillingSuspended({ subscriptionStatus: org.subscriptionStatus ?? 'active' })) return null;
  if (!(await isFamilyLayerEnabled({ org, repTeamId: team.id }))) return null;
  return getFamilyTeamView({ repTeamId: team.id, requireVisibility: 'public_link' });
}

/** The public feed's address: the team page's own, with /calendar on the end — no secret, nothing to reset (Ask 3). */
export function publicTeamFeedPath(orgSlug: string, teamSlug: string): string {
  return `/${orgSlug}/teams/${teamSlug}/calendar`;
}
