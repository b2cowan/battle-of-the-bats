/**
 * lib/nav-tiles.ts — THE ADMIN MORE SHEETS' TILES (the nav standard's N8, Asks C1–C3, owner 2026-10-17;
 * `docs/agents/design/NAV_STANDARD.md`). Pure: the admin phone bar (`AdminKitBottomNav`) asks these two questions and
 * draws the answer with the coach sheet's own tile row (`MoreSheetTiles`).
 *
 * ⚖ NONE, OR THREE, right after Notifications, for pages reached again and again from a phone. A plan (or a person)
 * that lacks one of a portal's three gets no tiles at all — never two, which would read as a half-built row.
 *   · Club admin       Calendar · Schedules · Families — FIXED tiles, so each leaves its full row (Calendar, Schedules)
 *                      or its group (Families leaves Programs): a fixed tile listed twice is a sheet that repeats itself.
 *   · Tournament admin Check-in · Staff kit · Teams — GAME DAY ONLY (the bar's own game-day test, so Completed and
 *                      Archived show none). Tiles that come and go stay listed in Operations too, so the groups never
 *                      change under your thumb. None on a plan without Check-in or Staff kit (an invite-only event).
 * A fourth tile is a design decision (the coach sheet's rule, `coach-nav-groups.test.ts`).
 */
import type { TournamentPhase } from './tournament-phase';

/** A tile names its page exactly as the nav does; each label fits one line at 360px (12px bold). */
export type NavTile = { key: string; label: string; href: string };

/** The club set, in order. The keys are the nav's own (the calendar and scheduler links, the Families program). */
export const CLUB_TILE_KEYS = ['calendar', 'schedules', 'families'] as const;

/** The tournament set, in order: the Operations rows' keys (`registrations` is Teams). */
export const TOURNAMENT_TILE_KEYS = ['check-in', 'staff-kit', 'registrations'] as const;

/**
 * The club sheet's tiles, or null for none. `familiesOnBar`: the club's shape put Families among the bar's first three
 * programs (a club that runs no house league) — a tile would repeat a tab, so no tiles then (owner call at the build,
 * 2026-10-17; the ruling did not cover it).
 */
export function clubSheetTiles({ calendar, schedules, families, familiesOnBar }: {
  calendar: NavTile | null;
  schedules: NavTile | null;
  families: NavTile | null;
  familiesOnBar: boolean;
}): NavTile[] | null {
  if (!calendar || !schedules || !families || familiesOnBar) return null;
  return [calendar, schedules, families];
}

/**
 * The tournament sheet's tiles, or null for none: on game day only, and only when every one of the three is a row this
 * person's Operations group lists (`operations` — the plan, the sandbox and the role have already filtered it).
 */
export function tournamentSheetTiles(phase: TournamentPhase, operations: readonly NavTile[]): NavTile[] | null {
  if (phase !== 'gameday') return null;
  const byKey = new Map(operations.map(t => [t.key, t]));
  const tiles = TOURNAMENT_TILE_KEYS.map(k => byKey.get(k));
  return tiles.every((t): t is NavTile => Boolean(t)) ? tiles : null;
}
