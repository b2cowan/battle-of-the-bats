import 'server-only';
import { familyLayerTeamIds, isFamilyLayerEnabled, isPubliclyVisible } from './family-access';
import { getClubRepTeamsForSchedule, getFamilyTeamView, getTeamGameEntriesBetween, markShown, type FamilyScheduleEntry, type FamilyTeamView } from './family-view';
import { isOrgBillingSuspended } from './org-billing-access';
import { orgHref } from './club-base';
import { repMarkWords } from './place-closures-server';
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

/** One Public team's game in a window, with the team it belongs to. */
export interface PublicTeamGame {
  team: { id: string; name: string; slug: string };
  entry: FamilyScheduleEntry;
}

/**
 * THE SAME QUESTION FOR A WHOLE CLUB AT ONCE (Club Website Stage 1, the home's one games read): every team of the club
 * whose schedule anyone may read with no account, and those teams' GAMES in [fromIso, toIso) — in about three reads for
 * all of them, not five per team. The same answer as `getPublicTeamSchedule` team by team, from the same definitions:
 * Public (`isPubliclyVisible`), the club not cancelled, the family layer (`familyLayerTeamIds`, the one-team check's
 * rule), not archived and a live season (`LIVE_SEASON_STATUSES`). Games only: practices, team events, multi-day tournament
 * entries and games copied from a tournament never come out (`getTeamGameEntriesBetween`).
 *
 * ⚠ Like the one-team rule, this does NOT ask whether the club's site is open or its plan carries rep teams: a page gets
 * that from its own door. The home's read asks the site and plan check before calling this. Throws on a failed read.
 */
export async function getPublicTeamGamesBetween(params: {
  org: Pick<Organization, 'id' | 'accountKind' | 'planId' | 'subscriptionStatus'>;
  fromIso: string;
  toIso: string;
  /** The clock the rows' live and over facts are read at (the caller's, so every program reads one instant). */
  now?: number;
}): Promise<{ publicTeams: number; allTeams: number; games: PublicTeamGame[] }> {
  const { teams, shown } = await clubPublicTeams(params.org);
  if (shown.length === 0) return { publicTeams: 0, allTeams: teams.length, games: [] };
  const byId = new Map(shown.map(t => [t.id, { id: t.id, name: t.name, slug: t.slug }]));
  const entries = (await getTeamGameEntriesBetween([...byId.keys()], params.fromIso, params.toIso, params.now))
    .filter(({ teamId }) => byId.has(teamId));
  // The closure marks (Club Website Stage 2, K9) on the games this answer already decided anyone may see, on the entry as
  // `getFamilyTeamView` carries them.
  const marks = await repMarkWords(params.org.id, entries.map(({ entry }) => entry.id));
  return {
    publicTeams: shown.length,
    allTeams: teams.length,
    games: entries.map(({ teamId, entry }) => ({ team: byId.get(teamId)!, entry: { ...entry, mark: markShown(marks[entry.id], entry) } })),
  };
}

/** The club's rep teams (not archived) and those whose schedule anyone may read: Public, the club not cancelled, the
 *  family layer — the batch's definitions, in two reads. */
async function clubPublicTeams(org: Pick<Organization, 'id' | 'accountKind' | 'planId' | 'subscriptionStatus'>) {
  const teams = await getClubRepTeamsForSchedule(org.id);
  if (isOrgBillingSuspended({ subscriptionStatus: org.subscriptionStatus ?? 'active' })) return { teams, shown: [] };
  const publicTeams = teams.filter(t => isPubliclyVisible(t.scheduleVisibility));
  const layered = publicTeams.length ? await familyLayerTeamIds({ org, teamIds: publicTeams.map(t => t.id) }) : new Set<string>();
  return { teams, shown: publicTeams.filter(t => layered.has(t.id)) };
}

/**
 * HOW MANY REP TEAMS SHOW THEIR GAMES ON THE CLUB'S SITE (Club Website Stage 1, G10): for the site editor's one line
 * ("3 of 20 rep teams show their games on your site."), server-side only — the public answer never says how many teams do
 * not show. The same definitions as the batch above, so the line cannot count a team the home leaves out.
 */
export async function countPublicRepTeams(
  org: Pick<Organization, 'id' | 'accountKind' | 'planId' | 'subscriptionStatus'>,
): Promise<{ showing: number; total: number }> {
  const { teams, shown } = await clubPublicTeams(org);
  return { showing: shown.length, total: teams.length };
}

/**
 * The public feed's address: the team page's own, with /calendar on the end — no secret, nothing to reset (Ask 3).
 * `base` (Stage 4e): `{ ownHost: true }` on a club's own web address (`/teams/u11/calendar`); left out = our host.
 */
export function publicTeamFeedPath(orgSlug: string, teamSlug: string, base?: { ownHost: boolean }): string {
  return orgHref({ slug: orgSlug, ownHost: !!base?.ownHost }, `/teams/${teamSlug}/calendar`);
}
