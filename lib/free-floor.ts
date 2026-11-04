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

/**
 * How many live house-league seasons the plan runs at once (9f·5): getting ready, registration open or closed, or running.
 * A finished season holds nothing — `lib/league-season-slot.ts` is the one home of that count. Infinity for paid (uncapped).
 */
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
  league_season: 'Your free League plan runs one season at a time, and a finished one stays on your site. Complete your current season to start the next, or upgrade to League Plus to run several seasons.',
  league_division: 'Your free League plan includes one division. Multiple divisions are part of League Plus.',
  league_team: 'Your free League plan includes up to 8 teams. Upgrade to League Plus for more.',
};

/** The season holding the free League plan's one slot, named so a refusal can say which one (9f·5). */
export type SeasonSlotHolder = { name: string; status: string };

/**
 * Standard cap-hit body. Routes return this with HTTP 403 (mirrors the tournament-slot 403 shape);
 * the admin UI switches on `capHit` to render an upgrade-aware (express-interest) panel. A season refusal also carries the
 * season holding the slot, so the window can name it (copy 9f §6.1).
 * Kept framework-agnostic so both server routes and client gating can import it.
 */
export function leagueCapHit(kind: LeagueCapKind, holder?: SeasonSlotHolder | null): { error: string; capHit: LeagueCapKind; holder?: SeasonSlotHolder } {
  return { error: CAP_MESSAGES[kind], capHit: kind, ...(holder ? { holder: { name: holder.name, status: holder.status } } : {}) };
}

// ── The free League plan's one season, in words (copy HOUSE_LEAGUE_STAGE9F_COPY.md §6) ─────────────────────────────

const LEAGUE_PLUS_LINE = 'League Plus runs several seasons and age groups side by side.';

/**
 * The Create season refusal window's body (copy §6.1): the holder named when one season holds the slot — a getting-ready
 * one cannot be completed, so it is only stated — and the generic body when no single holder is named.
 */
export function seasonCapBody(holder?: SeasonSlotHolder | null): string {
  if (!holder) {
    return `Your free League plan runs one season at a time, and a finished one stays on your site. Complete your current season to start the next. ${LEAGUE_PLUS_LINE}`;
  }
  if (holder.status === 'draft') {
    return `Your free League plan runs one season at a time, and ${holder.name} holds it while it’s getting ready. ${LEAGUE_PLUS_LINE}`;
  }
  return `Your free League plan runs one season at a time, and ${holder.name} holds it. Once you complete it, you can start the next. It stays on your site. ${LEAGUE_PLUS_LINE}`;
}

/** The Reopen window's refusal, in place of "What changes" (copy §6.2): the holder named, then the League Plus line. */
export function reopenRefusal(holder: SeasonSlotHolder): string[] {
  return [
    holder.status === 'draft'
      ? `Your free League plan runs one season at a time, and ${holder.name} is still getting ready.`
      : `Your free League plan runs one season at a time, and ${holder.name} isn’t finished. Complete it first, then you can reopen this one.`,
    LEAGUE_PLUS_LINE,
  ];
}

/** The season PATCH's refusal when a request skips the Reopen window (copy §6.2). */
export const REOPEN_CAP_ERROR = 'Your free League plan runs one season at a time. Complete your current season before you reopen this one.';
