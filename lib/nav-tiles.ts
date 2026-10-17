/**
 * lib/nav-tiles.ts — THE CLUB'S PHONE BAR AND THE ADMIN MORE SHEETS' TILES (the nav standard's N8, owner 2026-10-17;
 * `docs/agents/design/NAV_STANDARD.md`). Pure: the admin phone bar (`AdminKitBottomNav`) asks these questions and draws
 * the answer — the tiles with the coach sheet's own row (`MoreSheetTiles`).
 *
 * ⚖ THE CLUB BAR IS ONE BAR (owner, 2026-10-17, on the Families-tab drawing): Overview · Calendar · Rep teams ·
 * Accounting · More, and the three tiles at the top of More are Schedules · House league · Families, "in all instances —
 * we will have consistency, and Calendar would be a more widely used section for all org users anyways". It replaces the
 * plan-aware bar (Overview + the club's first three programs, Club Stage 1 specimen 4); the desktop sidebar keeps its own
 * order. Two build-start calls with it, both the owner's:
 *   · a door this person or plan cannot open is FILLED from Programs — the next program the club runs, in the sidebar's
 *     order (League Plus has no Rep teams or Accounting; a treasurer has no Rep teams; only owners and admins have
 *     Schedules). No door appears twice: what the bar took, the tiles skip.
 *   · House league is a tile only once the club RUNS it (its first season): until then it is the quiet "Also on your
 *     plan" row the club hub ruled (an unrun program never takes a prime spot), and its tile slot is filled like any other.
 * ⚖ NONE, OR THREE tiles (N8): when fewer than three doors are left for them, no tiles — they stay rows. Fixed tiles
 * leave their row (Schedules) or their group (House league, Families leave Programs).
 * ⚖ The tournament's tiles: Check-in · Staff kit · Teams, GAME DAY ONLY (the bar's own game-day test, so Completed and
 * Archived show none). Tiles that come and go stay listed in Operations too. None on a plan without Check-in or Staff kit.
 * A fourth tile, or a sixth tab, is a design decision.
 */
import type { TournamentPhase } from './tournament-phase';

/** A door as the nav lists it. Tiles and tabs name their page exactly as the nav does. */
export type NavTile = { key: string; label: string; href: string };

/** The club bar's three slots between Overview and More, in order. `calendar` is the club calendar's door; the rest are
 *  program keys. */
export const CLUB_BAR_KEYS = ['calendar', 'rep-teams', 'accounting'] as const;

/** The club More sheet's three tiles, in order: the scheduler's door, then two programs. */
export const CLUB_TILE_KEYS = ['schedules', 'house-league', 'families'] as const;

/** The tournament set, in order: the Operations rows' keys (`registrations` is Teams). */
export const TOURNAMENT_TILE_KEYS = ['check-in', 'staff-kit', 'registrations'] as const;

/**
 * The club's phone nav: the bar's slots, the tiles (null for none), the programs More still lists, and whether the
 * Schedules door stays a full row. `programs` are the programs the club RUNS that this person can open, in the sidebar's
 * order (`clubProgramOrder`'s lead); `alsoOnPlan` the ones the plan carries but the club does not run yet — they only
 * ever list in More, never fill a tab or a tile.
 */
export function clubPhoneNav<T extends NavTile>({ calendar, schedules, programs, alsoOnPlan }: {
  calendar: T | null;
  schedules: T | null;
  programs: readonly T[];
  alsoOnPlan: readonly T[];
}): { tabs: T[]; tiles: T[] | null; morePrograms: T[]; schedulesRow: T | null } {
  const program = (key: string) => programs.find(p => p.key === key) ?? null;
  // A set of slots: its fixed doors that exist and are not taken, then the club's next programs, up to the set's size.
  const pick = (fixed: (T | null)[], size: number, taken: ReadonlySet<string>): T[] => {
    const out = fixed.filter((d): d is T => !!d && !taken.has(d.key));
    for (const p of programs) {
      if (out.length >= size) break;
      if (!taken.has(p.key) && !out.includes(p)) out.push(p);
    }
    return out;
  };

  const tabs = pick(CLUB_BAR_KEYS.map(k => (k === 'calendar' ? calendar : program(k))), CLUB_BAR_KEYS.length, new Set());
  const used = new Set(tabs.map(d => d.key));
  const found = pick(CLUB_TILE_KEYS.map(k => (k === 'schedules' ? schedules : program(k))), CLUB_TILE_KEYS.length, used);
  // "None, or three": the tiles take their doors only when all three are found.
  const tiles = found.length === CLUB_TILE_KEYS.length ? found : null;
  tiles?.forEach(t => used.add(t.key));

  return {
    tabs,
    tiles,
    morePrograms: [...programs.filter(p => !used.has(p.key)), ...alsoOnPlan],
    schedulesRow: schedules && !used.has(schedules.key) ? schedules : null,
  };
}

/**
 * The tournament sheet's tiles, or null for none: on game day only, and only when every one of the three is a row this
 * person's Operations group lists (`operations` — the plan, the sandbox and the role have already filtered it).
 */
export function tournamentSheetTiles<T extends NavTile>(phase: TournamentPhase, operations: readonly T[]): T[] | null {
  if (phase !== 'gameday') return null;
  const byKey = new Map(operations.map(t => [t.key, t]));
  const tiles = TOURNAMENT_TILE_KEYS.map(k => byKey.get(k));
  return tiles.every((t): t is T => Boolean(t)) ? tiles : null;
}
