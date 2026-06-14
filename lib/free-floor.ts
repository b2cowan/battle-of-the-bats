import type { Capability } from './roles';
import type { FreeFloor, Organization } from './types';

/**
 * Free-floor entitlement profiles (Free Tier Phase 6).
 *
 * A free floor is a persistent `organizations.free_floor` profile (NOT a new OrgPlan key) that
 * contributes extra module entitlements + server-side caps ON TOP of the org's paid plan. The org
 * keeps its `plan_id` (a free League Starter sits on `plan_id='tournament'`); this layer adds the
 * house-league module + size caps.
 *
 * House-league is MODULE-gated (not cap-gated) today, so these caps are net-new and enforced in the
 * create APIs (count-and-403), mirroring `getEffectiveTournamentLimit`. The admin gate's capability
 * axis is role-based (owner is always allowed), so only the *entitlement* axis (`hasModuleEntitlement`)
 * needs the free-floor union — done via `freeFloorModules()` below.
 *
 * NOTE — intentionally NOT capped: practices and manual game creation are owner-only internal
 * scheduling, not a paid-League differentiator. The schedule generator is structurally bounded by the
 * single included division. Only seasons / divisions / teams carry hard caps.
 */

/** Modules a free floor grants on top of the paid plan. NEVER `module_public_site` — the full
 *  branded org site stays a paid-League differentiator; League Starter gets only the narrow public
 *  league season pages (which gate on `module_house_league`). */
const FREE_FLOOR_MODULES: Record<NonNullable<FreeFloor>, Capability[]> = {
  league_starter: ['module_house_league'],
};

/** Server-enforced house-league size caps per free floor. Paid plans are uncapped (Infinity). */
const FREE_FLOOR_LIMITS: Record<NonNullable<FreeFloor>, {
  houseLeagueSeasons: number;
  houseLeagueDivisionsPerSeason: number;
  houseLeagueTeamsPerSeason: number;
}> = {
  league_starter: {
    houseLeagueSeasons: 1,
    houseLeagueDivisionsPerSeason: 1,
    houseLeagueTeamsPerSeason: 8,
  },
};

type FloorOrg = Pick<Organization, 'freeFloor'>;

export function isFreeFloorLeague(org: FloorOrg): boolean {
  return org.freeFloor === 'league_starter';
}

/** Modules contributed by the org's free floor (empty when there is none). Unioned into
 *  `hasModuleEntitlement`. */
export function freeFloorModules(freeFloor: FreeFloor | undefined): Capability[] {
  if (freeFloor && FREE_FLOOR_MODULES[freeFloor]) return FREE_FLOOR_MODULES[freeFloor];
  return [];
}

/** Max active (non-archived) house-league seasons. Infinity for paid (uncapped). */
export function houseLeagueSeasonCap(org: FloorOrg): number {
  return isFreeFloorLeague(org) ? FREE_FLOOR_LIMITS.league_starter.houseLeagueSeasons : Infinity;
}

/** Max divisions per season. Infinity for paid (uncapped). */
export function houseLeagueDivisionCap(org: FloorOrg): number {
  return isFreeFloorLeague(org) ? FREE_FLOOR_LIMITS.league_starter.houseLeagueDivisionsPerSeason : Infinity;
}

/** Max teams per season. Infinity for paid (uncapped). */
export function houseLeagueTeamCap(org: FloorOrg): number {
  return isFreeFloorLeague(org) ? FREE_FLOOR_LIMITS.league_starter.houseLeagueTeamsPerSeason : Infinity;
}

/** The cap a given house-league create route enforces. */
export type LeagueCapKind = 'league_season' | 'league_division' | 'league_team';

const CAP_MESSAGES: Record<LeagueCapKind, string> = {
  league_season: 'Your free League plan includes one active season. Upgrade to League Plus to run multiple seasons.',
  league_division: 'Your free League plan includes one division. Multiple divisions are part of League Plus.',
  league_team: 'Your free League plan includes up to 8 teams. Upgrade to League Plus for more.',
};

/**
 * Standard cap-hit body. Routes return this with HTTP 403 (mirrors the tournament-slot 403 shape);
 * the admin UI switches on `capHit` to render an upgrade-aware (express-interest) panel.
 * Kept framework-agnostic so both server routes and client gating can import it.
 */
export function leagueCapHit(kind: LeagueCapKind): { error: string; capHit: LeagueCapKind } {
  return { error: CAP_MESSAGES[kind], capHit: kind };
}
