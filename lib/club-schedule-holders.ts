/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * WHO HOLDS THE CLUB'S TIME (Club Tier Stage 11b — plan HOUSE_LEAGUE_STAGE9_PLAN.md §0h, rulings 9d2·15, 11b·A–B; mig
 * 392). A slot is held by rep teams or by HOUSE LEAGUE AS A WHOLE, never both. Inside the scheduler (the settings, the
 * engine, the grid, Fair shares) house league is one more holder with the fixed id `HOUSE_LEAGUE`, so every list and every
 * share reads it as a row; at each edge it is taken back out:
 *   · the database: a slot's `program` (club_schedule_slot_programs), never a `club_schedule_slot_teams` row;
 *   · the bill: never billed (11b·A) — `billShares` and `sharesAtRate` leave it out;
 *   · the sends: never a rep team's audience, practice row, season or credit (the send's teams never include it);
 *   · the rules: it shares a slot with nobody (11b·B), holds many slots at once (its league admins divide them among
 *     divisions and teams), and no team rule — a day off, a day cap, back-to-back — reaches it.
 * Pure and client-safe.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

/** The one program that holds club time, as a holder id beside the rep teams' ids. */
export const HOUSE_LEAGUE = 'house_league' as const;

export const isProgramHolder = (id: string): boolean => id === HOUSE_LEAGUE;

/** The rep teams of a holder list (house league taken out). */
export const teamsOnly = (ids: readonly string[]): string[] => ids.filter(id => !isProgramHolder(id));

/** A slot's holders as the database stores them: its rep teams, and its program (or null). */
export function storedHolders(ids: readonly string[]): { teamIds: string[]; program: typeof HOUSE_LEAGUE | null } {
  return { teamIds: teamsOnly(ids), program: ids.some(isProgramHolder) ? HOUSE_LEAGUE : null };
}
