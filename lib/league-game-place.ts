import 'server-only';
import { seasonGameSlots } from './league-time-server';
import { gameSlotOf } from './league-season-calendar';
import { CHANGES_TO_SEND_WORDS as W } from './league-schedule-words';

/**
 * WHERE A GAME MAY GO (House League 9d-2b, ruling 9d2b·B; the 9d2·3 amendment). A game placed on one of its division's
 * game-time slots — the same start, venue and facility as a slot the club gave the division for games — links to it
 * (`league_games.slot_use_id`, the use's key), so the club moving that time moves the game with it (9d2·13).
 *   · Whoever may place anywhere (`houseLeagueAccess().placeAnywhere`: the owner and admin who give the club's time, or
 *     anyone who runs the season on a plan with no club's schedule) puts a game anywhere; off the time, it has no link.
 *   · A league admin on a plan with the club's schedule places a game ONLY on its division's game time: anything else is
 *     refused, in words that point at House league's time (dividing it is the league admin's own job, 9d2·15).
 * Asked only when a game's when or where changes and it is on: a score, a note, a postpone or a cancel places nothing.
 */
export async function placeGame(p: {
  orgId: string;
  seasonId: string;
  divisionId: string;
  divisionName: string;
  scheduledAt: string | null;
  orgVenueId: string | null;
  orgVenueFacilityId: string | null;
  placeAnywhere: boolean;
}): Promise<{ slotUseId: string | null } | { refusal: string }> {
  // A typed place, or no date: it cannot be on the club's time.
  const slots = p.scheduledAt && p.orgVenueId ? await seasonGameSlots(p.orgId, p.seasonId) : [];
  const slot = gameSlotOf({
    divisionId: p.divisionId, scheduledAt: p.scheduledAt, orgVenueId: p.orgVenueId, orgVenueFacilityId: p.orgVenueFacilityId,
  }, slots);
  if (slot) return { slotUseId: slot.slotId };
  return p.placeAnywhere ? { slotUseId: null } : { refusal: W.outsideTime(p.divisionName) };
}
