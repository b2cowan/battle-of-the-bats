import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { fetchAll, fetchAllIn } from './supabase-paging';
import { getDivisionsForSeason } from './db';
import { readClubPlaces } from './permit-lookup';
import { weekdayOf } from './permit-time';
import { utcToZonedInputs } from './timezone';
import { HOUSE_LEAGUE } from './club-schedule-holders';
import {
  groupLeagueTime, keyOfUse, LEAGUE_TIME_REFUSALS as R,
  type LeagueTime, type LeagueTimeSchedule, type LeagueTimeSlot, type LeagueUse, type LeagueUseKind,
} from './league-time';
import type { LeagueSeason } from './types';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * HOUSE LEAGUE'S TIME, SERVER SIDE (Club Tier Stage 11b Part 3; plan HOUSE_LEAGUE_STAGE9_PLAN.md §0h 9d2·5 + 9d2·15).
 * The read behind the window (lib/league-time.ts groups it) and the league admin's one write: giving house-league slots to
 * a division's game time or practice time, or back to Not given yet — through the SQL step `league_slot_uses_set`
 * (migs 392–393), which locks each slot in id order and reads it again. TypeScript never writes a use or a practice's
 * slot link itself (the scheduler guard holds both to the SQL steps).
 *
 * ⚖ WHO: the routes ask `houseLeagueRefusal` — `read` for the window (owner, admin, league admin, the registrar), `run` on
 * the season for a give (owner, admin, league admin on a live season). Never `isScheduleBuilder`: the league admin reaches
 * house league's time through house league, never through the club's scheduler gate.
 * ⚖ WHAT: live slots of FINAL schedules house league holds, still to come, inside the season's dates when it has them, and
 * not another season's (lib/league-time.ts, the header). A give asks the same of every slot it names, here and again in
 * SQL; a slot that stopped being one of them in between refuses `changed`, and the window reads again.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

type SlotRow = {
  id: string; schedule_id: string; block_id: string | null; org_venue_id: string; facility_id: string | null;
  starts_at: string; ends_at: string;
};

/** The season's dates as a club-day test (a season with no dates takes every day). */
const inSeason = (season: Pick<LeagueSeason, 'seasonStartDate' | 'seasonEndDate'>, day: string) =>
  (!season.seasonStartDate || day >= season.seasonStartDate) && (!season.seasonEndDate || day <= season.seasonEndDate);

/** House league's live slots of final schedules, still to come, inside the season (ids alone when `ids` narrows it). */
async function houseLeagueSlotRows(orgId: string, season: LeagueSeason, ids?: readonly string[]): Promise<SlotRow[]> {
  const now = new Date().toISOString();
  const columns = 'id, schedule_id, block_id, org_venue_id, facility_id, starts_at, ends_at, club_schedule_slot_programs!inner(program), club_schedules!inner(state)';
  const rows = ids
    ? await fetchAllIn<SlotRow>(ids, (c, a, b) => supabaseAdmin.from('club_schedule_slots').select(columns)
      .eq('org_id', orgId).in('id', c).is('removed_at', null).gt('starts_at', now)
      .eq('club_schedule_slot_programs.program', HOUSE_LEAGUE).eq('club_schedules.state', 'final').order('id').range(a, b))
    : await fetchAll<SlotRow>((a, b) => supabaseAdmin.from('club_schedule_slots').select(columns)
      .eq('org_id', orgId).is('removed_at', null).gt('starts_at', now)
      .eq('club_schedule_slot_programs.program', HOUSE_LEAGUE).eq('club_schedules.state', 'final').order('id').range(a, b));
  return rows.filter(r => inSeason(season, utcToZonedInputs(r.starts_at).date));
}

/** Each slot's use, by slot. */
async function usesOf(orgId: string, slotIds: readonly string[]) {
  const rows = await fetchAllIn<{ slot_id: string; season_id: string; division_id: string; kind: LeagueUseKind }>(slotIds, (c, a, b) => supabaseAdmin
    .from('league_slot_uses').select('slot_id, season_id, division_id, kind').eq('org_id', orgId).in('slot_id', c).order('slot_id').range(a, b));
  return new Map(rows.map(r => [r.slot_id, r]));
}

/** THE WINDOW: everything the club gave house league that this season can divide, grouped. */
export async function readLeagueTime(orgId: string, season: LeagueSeason): Promise<LeagueTime> {
  const [rows, divisions, places] = await Promise.all([
    houseLeagueSlotRows(orgId, season),
    getDivisionsForSeason(season.id),
    readClubPlaces(orgId),
  ]);
  const uses = await usesOf(orgId, rows.map(r => r.id));
  // Another season's slot is that season's to divide.
  const mine = rows.filter(r => { const u = uses.get(r.id); return !u || u.season_id === season.id; });
  const scheduleIds = [...new Set(mine.map(r => r.schedule_id))];
  const schedules = scheduleIds.length
    ? await fetchAllIn<{ id: string; name: string; starts_on: string; ends_on: string }>(scheduleIds, (c, a, b) => supabaseAdmin
      .from('club_schedules').select('id, name, starts_on, ends_on').eq('org_id', orgId).in('id', c).order('id').range(a, b))
    : [];
  const slots = mine.map((r): LeagueTimeSlot => {
    const start = utcToZonedInputs(r.starts_at), end = utcToZonedInputs(r.ends_at);
    const u = uses.get(r.id);
    return {
      id: r.id, scheduleId: r.schedule_id, blockId: r.block_id, venueId: r.org_venue_id, facilityId: r.facility_id,
      day: start.date, weekday: weekdayOf(start.date), start: start.time, end: end.time,
      use: u ? { divisionId: u.division_id, kind: u.kind } : null,
    };
  });
  const ordered: LeagueTimeSchedule[] = schedules
    .map(s => ({ id: s.id, name: s.name, startsOn: s.starts_on, endsOn: s.ends_on }))
    .sort((a, b) => a.startsOn.localeCompare(b.startsOn) || a.name.localeCompare(b.name));
  const divisionList = divisions.map(d => ({ id: d.id, name: d.name }));
  return {
    sources: groupLeagueTime({
      slots, schedules: ordered, divisions: divisionList,
      placeOf: (v, f) => (f ? places.facilityName.get(f) : null) ?? places.venueName.get(v) ?? '',
      venueOf: v => places.venueName.get(v) ?? '',
    }),
    divisions: divisionList,
  };
}

export type GiveResult =
  | { ok: true; slots: number; practicesRemoved: number }
  | { ok: false; status: number; code: string; error: string };

const refused = (status: number, code: string, error: string): GiveResult => ({ ok: false, status, code, error });

/**
 * THE GIVE: the slots to a division's game time or practice time, or back to Not given yet. Every slot must still be one
 * the window offers (house league's, live, final, still to come, in the season, not another season's): a slot that
 * stopped being one refuses `changed`, whole — never a give of part of what the league admin picked.
 */
export async function giveLeagueTime(p: {
  orgId: string; season: LeagueSeason; actorId: string;
  slotIds: string[]; divisionId: string | null; kind: LeagueUseKind | null; from: LeagueUse | null;
}): Promise<GiveResult> {
  const rows = await houseLeagueSlotRows(p.orgId, p.season, p.slotIds);
  if (rows.length !== p.slotIds.length) return refused(409, 'changed', R.changed);
  // Each slot still holds what the window saw — never a give over a division's time the league admin didn't see taken.
  // (A read before the step: the step locks each slot, so the window between is a request's width, not a stale window's.)
  const uses = await usesOf(p.orgId, p.slotIds);
  const seen = keyOfUse(p.from);
  if (p.slotIds.some(id => { const u = uses.get(id); return keyOfUse(u ? { divisionId: u.division_id, kind: u.kind } : null) !== seen; })) {
    return refused(409, 'changed', R.changed);
  }
  const { data, error } = await supabaseAdmin.rpc('league_slot_uses_set', {
    p_org: p.orgId, p_season: p.season.id, p_actor: p.actorId, p_slots: p.slotIds, p_division: p.divisionId, p_kind: p.kind,
  });
  if (error) {
    const msg = error.message ?? '';
    if (/\buse_(kind|division)\b/.test(msg)) return refused(400, 'bad_request', R.badRequest);
    if (/\buse_(slot|season)\b/.test(msg)) return refused(409, 'changed', R.changed);
    throw error;
  }
  const r = (data ?? {}) as { ok?: boolean; code?: string; slots?: number; practicesRemoved?: number };
  if (r.ok) return { ok: true, slots: r.slots ?? p.slotIds.length, practicesRemoved: r.practicesRemoved ?? 0 };
  if (r.code === 'not_found') return refused(404, 'not_found', R.notFound);
  if (r.code === 'season_closed') return refused(423, 'season_closed', R.seasonClosed);
  return refused(409, 'changed', R.changed);
}
