import 'server-only';
import { seasonGameSlots } from './league-time-server';
import { gameSlotsAt } from './league-season-calendar';
import { CHANGES_TO_SEND_WORDS as W } from './league-schedule-words';
import { supabaseAdmin } from './supabase-admin';
import { maskOf } from './field-parts';

/**
 * WHERE A GAME MAY GO (House League 9d-2b, ruling 9d2b·B; the 9d2·3 amendment). A game placed on one of its division's
 * game-time slots — the same start, venue and facility as a slot the club gave the division for games — links to it
 * (`league_games.slot_use_id`, the use's key), so the club moving that time moves the game with it (9d2·13).
 *   · Whoever may place anywhere (`houseLeagueAccess().placeAnywhere`: the owner and admin who give the club's time, or
 *     anyone who runs the season on a plan with no club's schedule) puts a game anywhere; off the time, it has no link.
 *   · A league admin on a plan with the club's schedule places a game ONLY on its division's game time: anything else is
 *     refused, in words that point at House league's time (dividing it is the league admin's own job, 9d2·15).
 * Asked only when a game's when or where changes and it is on: a score, a note, a postpone or a cancel places nothing.
 *
 * ⚖ THE SIDE FOLLOWS THE TIME (owner 2026-11-27, the 2E part 1 review's question A). The pickers offer whole fields (round 2
 * Ask 1 A: house league never splits a field), so the part comes from the club time the game lands on, as the generator
 * takes it: the game's own part when that time is there and free, otherwise the first of the field's parts there that no
 * other game holds. A move from side A onto side B's time is side B; a game picked on a whole field onto time that is only
 * sides takes side A (or B when A is taken). When every one is taken it keeps the first, and the booking check that
 * follows refuses it by name. The answer's `sectionMask` is the part the save writes and checks.
 */
export async function placeGame(p: {
  orgId: string;
  seasonId: string;
  divisionId: string;
  divisionName: string;
  scheduledAt: string | null;
  orgVenueId: string | null;
  orgVenueFacilityId: string | null;
  /** The part the game keeps (`keptPart`); absent = the whole field. */
  sectionMask?: number;
  /** The game being moved: its own link never makes its time taken. Absent on a new game. */
  gameId?: string;
  placeAnywhere: boolean;
}): Promise<{ slotUseId: string | null; sectionMask: number } | { refusal: string }> {
  const kept = maskOf(p.sectionMask);
  // A typed place, or no date: it cannot be on the club's time.
  const slots = p.scheduledAt && p.orgVenueId ? await seasonGameSlots(p.orgId, p.seasonId) : [];
  const here = gameSlotsAt({
    divisionId: p.divisionId, scheduledAt: p.scheduledAt, orgVenueId: p.orgVenueId, orgVenueFacilityId: p.orgVenueFacilityId,
    sectionMask: kept,
  }, slots);
  if (!here.length) return p.placeAnywhere ? { slotUseId: null, sectionMask: kept } : { refusal: W.outsideTime(p.divisionName) };
  const held = here.length > 1 ? await heldSlots(p.orgId, here.map(s => s.slotId), p.gameId) : new Set<string>();
  const slot = here.find(s => !held.has(s.slotId)) ?? here[0];
  return { slotUseId: slot.slotId, sectionMask: maskOf(slot.sectionMask) };
}

/** The slots another live game already sits on (its link): a part holds one game. */
async function heldSlots(orgId: string, slotIds: string[], gameId?: string): Promise<Set<string>> {
  let q = supabaseAdmin.from('league_games').select('slot_use_id')
    .eq('org_id', orgId).in('slot_use_id', slotIds).neq('status', 'cancelled').neq('status', 'postponed');
  if (gameId) q = q.neq('id', gameId);
  // A failed read never reads as every part free (/review 2026-11-27).
  const { data, error } = await q;
  if (error) throw new Error(`Couldn't read which game time is taken: ${error.message}`);
  return new Set((data ?? []).map(r => r.slot_use_id as string));
}
