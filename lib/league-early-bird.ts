import { getDivisionsForSeason } from '@/lib/db';
import { earlyBirdOffer, type EarlyBirdOffer } from '@/lib/league-price';
import { promotesEarlyBird, type RegDated } from '@/lib/league-registration-state';
import { tournamentToday } from '@/lib/timezone';
import type { LeagueSeason } from '@/lib/types';

/**
 * THE EARLY BIRD ON A PUBLIC ROW (owner 2026-10-25: "wouldn't the club want early bird prices shown… on the home page
 * with the registrations?"). A season that promotes its early bird (sign-ups open or about to open, never closed; its
 * status and dates together, never the status alone), whose early-bird day has not passed and whose divisions have an
 * early amount, gets `earlyBird` for its row's "Save $20 · early bird through Oct 31" line; every other season gets null.
 * One read of the divisions, and only for the seasons that could carry one. A read that fails costs the row its line,
 * never the page.
 */
export async function withEarlyBird<T extends RegDated & Pick<LeagueSeason, 'id' | 'registrationFee' | 'earlyBirdUntil'>>(
  seasons: readonly T[],
  today: string = tournamentToday(),
): Promise<(T & { earlyBird: EarlyBirdOffer | null })[]> {
  return Promise.all(seasons.map(async s => {
    if (!promotesEarlyBird(s)) return { ...s, earlyBird: null };
    try {
      return { ...s, earlyBird: earlyBirdOffer(await getDivisionsForSeason(s.id), s, today) };
    } catch {
      return { ...s, earlyBird: null };
    }
  }));
}
