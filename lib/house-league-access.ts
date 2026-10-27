import { canOpenModule, type MemberAccessInput } from './member-access';
import { hasModuleEntitlement, type EntitlementOrg } from './module-entitlements';
import type { LeagueSeasonStatus, OrgRole } from './types';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * WHO MAY DO WHAT IN HOUSE LEAGUE — THE ONE GATE (Club Tier Stage 9a, Part 1; owner Q16 + Q17, 2026-10-24).
 *
 * Every house-league route and every house-league screen asks THIS, never a role list of its own. Before it, sixteen
 * writers checked `owner || league_admin` by name after a gate that let the club admin in (ruling D8), so a club admin
 * opened every page and saved nothing (F01); fee and status writes had a third list. `tests/unit/house-league-gate-guard
 * .test.ts` fails the build if a house-league route names a role again.
 *
 * The matrix (frame F, ruled Q17):
 *   · Seasons, divisions, teams, schedule — owner, club admin and league admin edit; everyone else who opens house league reads.
 *   · Registrations (approve, decline, withdraw, notes, add by hand), fees received and refunds — the above plus the registrar.
 *   · Email families — the same people as registrations, and only they read the sent log (it lists families' email).
 *   · Money — read by everyone who opens house league, AND by whoever holds the club's Accounting (the treasurer), on an org
 *     that carries house league. Nobody "edits" Money: it is written only by marking a fee received or recording a refund.
 *   · Status changes (open, close, reopen, complete, archive) — the people who edit the season.
 * "Opens house league" is `canOpenModule` (the person's capability AND the plan), so a member whose House league program was
 * switched off reads nothing, whatever their role.
 *
 * ⚖ A finished season (Q16) reads in place, locked through THIS gate, not a branch per screen: once a season is completed or
 * archived, registrations, teams, the schedule and the season's settings are refused. Three things stay open: fees received
 * and refunds (money arrives after the last game), the status change that reopens or archives it, and Email families
 * (owner 2026-10-24, 9a build: a note to families is not a change to the season's record, and the Families window cannot
 * reach a finished season). Pass the season to get that answer; leave it out (a new season) and nothing is finished.
 *
 * ⚖ Ratings (9c·2a): read and written by the people who run the league, nobody else — not the registrar, a coach or a
 *   family, on any screen or export. They live in their own table (`lib/house-league-ratings.ts`), so no whole-row read can
 *   carry one; `tests/unit/house-league-ratings-guard.test.ts` holds who may import it.
 *
 * ⚖ A coach (9c·1, Q7) is a column of this gate that no ROLE opens: a house-league coach is a row of
 *   league_team_coaches, so a registrar or a club admin can coach a team without their role changing, and a `coach` member
 *   gets nothing here. `houseLeagueCoachAccess` below answers for one person and one team: their own team's players and
 *   each family's name, email and phone, and nothing else.
 *
 * Client-safe (no server imports): the screens read the same answer to decide what to render, and a control a person
 * can't use is absent, not greyed.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

/** The roles that run the league: they edit its seasons, divisions, teams and schedule. Q17: club admin = league admin. */
export const LEAGUE_RUNNER_ROLES: readonly OrgRole[] = ['owner', 'admin', 'league_admin'];
/** The roles that work its registrations, fees and family email: the runners plus the registrar. */
const LEAGUE_DESK_ROLES: readonly OrgRole[] = [...LEAGUE_RUNNER_ROLES, 'league_registrar'];

/** A season that has ended its life: it reads, and only its money still moves. */
export function isFinishedLeagueSeason(season: { status: LeagueSeasonStatus | string } | null | undefined): boolean {
  return season?.status === 'completed' || season?.status === 'archived';
}

export interface HouseLeagueAccess {
  /** Open house league at all: every season page, read. */
  read: boolean;
  /** Read the season's Money page. */
  readMoney: boolean;
  /** Edit the season's settings, divisions, teams, the draft and the schedule (and create a season). */
  run: boolean;
  /** Move the season between statuses, including reopening a finished one. */
  changeStatus: boolean;
  /** Work registrations: approve, waitlist, decline, withdraw, notes, add by hand. */
  register: boolean;
  /** Mark a fee received (or not) and record a refund. Stays open on a finished season. */
  takeFees: boolean;
  /** Email the season's families and read what was sent. Stays open on a finished season. */
  email: boolean;
  /** Read players' ratings (9c·2a): the runners only, never the registrar. Absent everywhere else, exports included. */
  seeRatings: boolean;
  /** Rate players (9c·2): the runners, on a live season (a finished season's ratings are erased, 9c·2b). */
  rate: boolean;
  /** The season is completed or archived. */
  finished: boolean;
}

export type HouseLeagueAction = Exclude<keyof HouseLeagueAccess, 'finished'>;

/**
 * The whole answer for one member, one org and (optionally) one season. A screen renders from it; a route asks
 * `can(..., action)` below. Never recompute a piece of it at a call site.
 */
export function houseLeagueAccess(
  member: MemberAccessInput,
  org: EntitlementOrg,
  season?: { status: LeagueSeasonStatus | string } | null,
): HouseLeagueAccess {
  const opens = canOpenModule(member, org, 'module_house_league');
  // The treasurer has Accounting, not House league (lib/roles.ts). Money is theirs to read only where the club runs one.
  const holdsBooks = hasModuleEntitlement(org, 'module_house_league') && canOpenModule(member, org, 'module_accounting');
  const runner = opens && LEAGUE_RUNNER_ROLES.includes(member.role);
  const desk = opens && LEAGUE_DESK_ROLES.includes(member.role);
  const finished = isFinishedLeagueSeason(season);
  return {
    read: opens,
    readMoney: opens || holdsBooks,
    run: runner && !finished,
    changeStatus: runner,
    register: desk && !finished,
    takeFees: desk,
    email: desk,
    seeRatings: runner,
    rate: runner && !finished,
    finished,
  };
}

/** One action as a yes/no (the fee write's `canMarkLeagueFeePaid`). A route refuses through `houseLeagueRefusal` instead. */
export function canHouseLeague(
  member: MemberAccessInput,
  org: EntitlementOrg,
  action: HouseLeagueAction,
  season?: { status: LeagueSeasonStatus | string } | null,
): boolean {
  return houseLeagueAccess(member, org, season)[action];
}

/** How long a coach's team page stays after the season finishes, before the page and the sign-in card go (copy §10.3). */
export const COACH_PAGE_DAYS_AFTER_FINISH = 30;

/** One row of league_team_coaches, as the coach column reads it. */
export interface HouseLeagueCoachLink {
  teamId: string;
  userId: string | null;
  acceptedAt: string | null;
  removedAt: string | null;
}

/**
 * What one signed-in person may read of one house-league team (9c·1):
 *   · `open` — they coach it: the team's accepted players and each family's name, email and phone.
 *   · `finished` — the same, with the season-finished line, for 30 days after the season finishes.
 *   · `ended` — the season finished more than 30 days ago: no players, the finished line only; the card is gone.
 *   · `gone` — they coached it and were removed ("You're no longer a coach of {team}").
 *   · `none` — they never coached it: nothing, not even that the team exists.
 * The answer reads ONLY rows that carry this person's id for THIS team: a coach of the Jays reads nothing of the
 * Cardinals however their links are passed in.
 */
export type HouseLeagueCoachView = 'open' | 'finished' | 'ended' | 'gone' | 'none';

export function houseLeagueCoachAccess(
  links: readonly HouseLeagueCoachLink[],
  userId: string,
  teamId: string,
  season: { status: LeagueSeasonStatus | string; finishedAt: string | null } | null,
  now: Date = new Date(),
): HouseLeagueCoachView {
  const mine = links.filter(l => l.userId === userId && l.teamId === teamId && l.acceptedAt);
  if (mine.length === 0) return 'none';
  if (!mine.some(l => !l.removedAt)) return 'gone';
  if (!isFinishedLeagueSeason(season)) return 'open';
  return coachPageOpenUntil(season?.finishedAt ?? null, now) ? 'finished' : 'ended';
}

/** The day a finished season's coach page closes, or null once it has (or when the finish time is unknown). */
export function coachPageOpenUntil(finishedAt: string | null, now: Date = new Date()): Date | null {
  if (!finishedAt) return null;
  const until = new Date(new Date(finishedAt).getTime() + COACH_PAGE_DAYS_AFTER_FINISH * 24 * 60 * 60 * 1000);
  return until.getTime() > now.getTime() ? until : null;
}
