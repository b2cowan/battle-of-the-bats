import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { getDivisionsForSeason, getTeamsForDivision } from './db';
import { readClubPlaces } from './permit-lookup';
import { weekdayOf } from './permit-time';
import { utcToZonedInputs } from './timezone';
import { formatVenueLocation } from './venue-label';
import { houseLeagueSlotRows, usesOf } from './league-time-server';
import { LEAGUE_TIME_REFUSALS } from './league-time';
import {
  DEFAULT_SETTINGS, planPractices, readSettings, sameIds, PRACTICE_TIME_REFUSALS as R,
  type HandOutBody, type PracticeTimeRead, type PracticeTimeSlot,
} from './league-practice-time';
import type { LeagueSeason } from './types';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * PRACTICE TIME, SERVER SIDE (Club Tier Stage 11b Part 4; frame h1; plan HOUSE_LEAGUE_STAGE9_PLAN.md §0h 9d2·5, 9d2·15,
 * 11b·B). The window's read and the hand-out — through the SQL step `league_practices_hand_out` (migs 392–393), which
 * locks each slot in id order, checks every slot is still this division's practice time and every row sits inside its
 * slot, writes each row with the SLOT's place, removes the practices still to come on those slots the rows no longer
 * name (played ones stay), and refuses `slot_full` / `team_twice` past its floors. TypeScript never writes a practice
 * or its slot link itself (the scheduler guard holds both to the SQL steps).
 *
 * ⚖ WHO: the route asks `houseLeagueRefusal` — `read` for the window, `run` on the season for a hand-out (owner, admin,
 * league admin on a live season). The registrar never reaches the window (its Tools item is absent).
 * ⚖ THE SERVER PLANS: a hand-out re-reads the division's practice time and teams, refuses `changed` when they aren't
 * what the window planned over (`saw`), and plans again with lib/league-practice-time.ts — the client's rows are never
 * sent, let alone trusted. Only slots still to come are read (lib/league-time-server.ts), so a started slot is history.
 * ⚖ Teams at once is Practice time's own (11b·B): the club's sharing rules never name house league.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

/** THE WINDOW: a division's practice time still to come, its teams and its settings. Null when the division isn't the
 *  season's. */
export async function readPracticeTime(orgId: string, season: LeagueSeason, divisionId: string): Promise<PracticeTimeRead | null> {
  const divisions = await getDivisionsForSeason(season.id);
  const division = divisions.find(d => d.id === divisionId);
  if (!division) return null;
  const [rows, places, teams, stored] = await Promise.all([
    houseLeagueSlotRows(orgId, season),
    readClubPlaces(orgId),
    getTeamsForDivision(divisionId),
    supabaseAdmin.from('league_practice_time').select('practice_minutes, teams_at_once')
      .eq('org_id', orgId).eq('season_id', season.id).eq('division_id', divisionId).maybeSingle(),
  ]);
  if (stored.error) throw stored.error;
  const uses = await usesOf(orgId, rows.map(r => r.id));
  const slots = rows
    .filter(r => { const u = uses.get(r.id); return u && u.season_id === season.id && u.division_id === divisionId && u.kind === 'practices'; })
    .map((r): PracticeTimeSlot => {
      const start = utcToZonedInputs(r.starts_at), end = utcToZonedInputs(r.ends_at);
      const venue = places.venueName.get(r.org_venue_id) ?? '';
      return {
        id: r.id, day: start.date, weekday: weekdayOf(start.date), start: start.time, end: end.time, startsAt: r.starts_at,
        place: (r.facility_id ? places.facilityName.get(r.facility_id) : null) ?? venue,
        placeKey: `${r.org_venue_id}|${r.facility_id ?? ''}`, venue,
      };
    })
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.placeKey.localeCompare(b.placeKey));
  const saved = stored.data ? readSettings({ practiceMinutes: stored.data.practice_minutes, teamsAtOnce: stored.data.teams_at_once }) : null;
  return {
    division: { id: division.id, name: division.name },
    slots,
    teams: teams.map(t => ({ id: t.id, name: t.name })),
    settings: saved ?? DEFAULT_SETTINGS,
    saved: !!saved,
  };
}

export type HandOutResult =
  | { ok: true; written: number; removed: number; practicesAWeek: number }
  | { ok: false; status: number; code: string; error: string };

const refused = (status: number, code: string, error: string): HandOutResult => ({ ok: false, status, code, error });

/** THE HAND-OUT: read again, check it is what the window saw, plan again, and write through the step. */
export async function handOutPractices(p: { orgId: string; season: LeagueSeason; actorId: string; body: HandOutBody }): Promise<HandOutResult> {
  const read = await readPracticeTime(p.orgId, p.season, p.body.divisionId);
  if (!read) return refused(404, 'not_found', LEAGUE_TIME_REFUSALS.notFound);
  const changed = () => refused(409, 'changed', R.changed(read.division.name));
  if (!sameIds(read.slots.map(s => s.id), p.body.saw.slotIds) || !sameIds(read.teams.map(t => t.id), p.body.saw.teamIds)) return changed();

  const plan = planPractices({ slots: read.slots, teams: read.teams, settings: p.body.settings });
  if (!plan.rows.length) return refused(400, 'nothing', R.nothing);
  const slot = new Map(read.slots.map(s => [s.id, s]));
  const rows = plan.rows.map(r => {
    const s = slot.get(r.slotId)!;
    // The display cache, as a picked venue writes it (lib/league-venue.ts); the step writes the slot's venue and facility.
    return { ...r, location: s.venue && s.place !== s.venue ? formatVenueLocation(s.venue, s.place) : s.place };
  });

  const { data, error } = await supabaseAdmin.rpc('league_practices_hand_out', {
    p_org: p.orgId, p_season: p.season.id, p_division: read.division.id, p_actor: p.actorId,
    p_slots: plan.slotIds, p_rows: rows, p_settings: p.body.settings,
  });
  if (error) {
    const message = error.message ?? '';
    if (/\bslot_full\b/.test(message)) return refused(409, 'slot_full', R.slotFull);
    const twice = /\bteam_twice: (.+) has two practices at once/.exec(message);
    if (twice) return refused(409, 'team_twice', R.teamTwice(twice[1]));
    // A deadlock with the club's own writers (rolled back whole), a division deleted or a practice written under the
    // hand-out: the time changed, so the window reads again.
    if (error.code === '40P01' || error.code === '23503' || error.code === '23505') return changed();
    throw error;
  }
  const r = (data ?? {}) as { ok?: boolean; code?: string; written?: number; removed?: number };
  if (r.ok) return { ok: true, written: r.written ?? rows.length, removed: r.removed ?? 0, practicesAWeek: plan.practicesAWeek };
  if (r.code === 'bad_settings') return refused(400, 'bad_settings', R.badSettings);
  if (r.code === 'not_found') return refused(404, 'not_found', LEAGUE_TIME_REFUSALS.notFound);
  if (r.code === 'season_closed') return refused(423, 'season_closed', R.seasonClosed);
  return changed();
}
