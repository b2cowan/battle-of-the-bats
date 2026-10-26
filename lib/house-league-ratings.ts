import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { chunked } from './supabase-paging';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * A PLAYER'S RATING — THE ONLY DOOR (Club Tier Stage 9c, rulings 9c·2a/b/c, owner 2026-10-26).
 *
 * A rating is a number from 1 to 5, no comment, read and written by the people who run the league (the gate's
 * `seeRatings` / `rate`), never by the registrar, a coach or a family. It lives in league_player_ratings, NOT on the
 * registration row, because whole registration rows reach the registrar's screens and exports; and it is erased when the
 * season finishes, by the database (mig 377's season trigger), so nothing here has to remember to.
 *
 * `tests/unit/house-league-ratings-guard.test.ts` fails the build if anything but the runner-gated routes it lists imports
 * this module or names the table.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

export type PlayerRating = 1 | 2 | 3 | 4 | 5;

export function isPlayerRating(value: unknown): value is PlayerRating {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5;
}

/** The ratings of these registrations (one season's), by registration id. A player with none is absent. */
export async function getRatings(seasonId: string, registrationIds: readonly string[]): Promise<Map<string, PlayerRating>> {
  const out = new Map<string, PlayerRating>();
  for (const chunk of chunked([...registrationIds])) {
    const { data, error } = await supabaseAdmin.from('league_player_ratings')
      .select('registration_id, rating').eq('season_id', seasonId).in('registration_id', chunk);
    if (error) throw new Error(`Couldn't read ratings: ${error.message}`);
    for (const row of data ?? []) {
      if (isPlayerRating(row.rating)) out.set(row.registration_id as string, row.rating);
    }
  }
  return out;
}

/** Rate these registrations (or clear their rating with null). The database takes the org and season from each one. */
export async function setRatings(
  registrationIds: readonly string[],
  rating: PlayerRating | null,
  actorId: string,
): Promise<void> {
  if (registrationIds.length === 0) return;
  for (const chunk of chunked([...registrationIds])) {
    if (rating === null) {
      const { error } = await supabaseAdmin.from('league_player_ratings').delete().in('registration_id', chunk);
      if (error) throw new Error(`Couldn't clear ratings: ${error.message}`);
      continue;
    }
    // org_id and season_id are overwritten by the row's trigger from the registration; these satisfy NOT NULL only.
    const rows = chunk.map(id => ({ registration_id: id, org_id: id, season_id: id, rating, rated_by: actorId }));
    const { error } = await supabaseAdmin.from('league_player_ratings').upsert(rows, { onConflict: 'registration_id' });
    if (error) throw new Error(`Couldn't save ratings: ${error.message}`);
  }
}
