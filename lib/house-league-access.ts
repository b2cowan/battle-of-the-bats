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
 *   · Email families — the same people as registrations. Nobody else reads the sent log either (it lists families' email).
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
 * A coach (if Q7) becomes a column of this same gate in 9c — their own team only.
 *
 * Client-safe (no server imports): the screens read the same answer to decide what to render, and a control a person
 * can't use is absent, not greyed.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

/** The roles that run the league: they edit its seasons, divisions, teams and schedule. Q17: club admin = league admin. */
const LEAGUE_RUNNER_ROLES: readonly OrgRole[] = ['owner', 'admin', 'league_admin'];
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
  /** Email the season's families. Stays open on a finished season. */
  email: boolean;
  /** Read the season's sent-email log. */
  readEmail: boolean;
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
    readEmail: desk,
    finished,
  };
}

/** One action, for a route: `if (!canHouseLeague(ctx, ctx.org, 'run', season)) return forbidden();`. */
export function canHouseLeague(
  member: MemberAccessInput,
  org: EntitlementOrg,
  action: HouseLeagueAction,
  season?: { status: LeagueSeasonStatus | string } | null,
): boolean {
  return houseLeagueAccess(member, org, season)[action];
}
