import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { fetchAll } from './supabase-paging';
import { readClubPlaces } from './permit-lookup';
import { clubDayOf, weekdayOf } from './permit-time';
import { utcToZonedInputs } from './timezone';
import { formatVenueLocation } from './venue-label';
import { checkLeagueBookings } from './league-venue';
import { clashReportForLeagueRows } from './venue-clash-lookup';
import { clashOtherName, clashTimeRange } from './venue-clash-words';
import { formatTimeRange } from './utils';
import { dayWords } from './calendar-recipe';
import { houseLeagueSlotRows, usesOf } from './league-time-server';
import { buildLeagueScheduleHealth, leagueHealthPracticeFromRow } from './league-schedule-health';
import {
  summaryOf,
  type CheckedGame, type GamePlan, type GameTeam, type GameTimeSlot, type GenerateCheckReply, type GenerateSaveReply, type GenerateWarning,
} from './league-game-generator';
import type { LeagueSeason } from './types';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * GENERATE GAMES, SERVER SIDE (House League Stage 9d-2a step 5; ruling 9d2·3 + the owner's amendment, plan
 * HOUSE_LEAGUE_STAGE9_PLAN.md §0h; frames c1–c4). The pairing is lib/league-game-generator.ts's; this file reads what it
 * pairs into and says what the club's records answer about the result.
 *
 * ⚖ THE DIVISION'S GAME TIME is the house-league slots a league admin gave it (`league_slot_uses` kind `games`, this
 * season), live, of final schedules, still to come and inside the season — the same read House league's time draws
 * (`houseLeagueSlotRows`), so the window and the route never count two different sets of slots.
 * ⚖ THE CHECK warns, never blocks (blocks are the plan's: too few slots, too few teams): outside the club's permit, a
 * booking at the place the club's schedule does not hold (another program's — `clashReportForLeagueRows`; or one of house
 * league's own typed or hand-booked games and practices — `checkLeagueBookings`, house league's own rule), a team twice in
 * a day, byes back to back.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

/** The division's game time as the generator takes it, in the club's zone, place named. */
export async function divisionGameTime(orgId: string, season: LeagueSeason, divisionId: string): Promise<GameTimeSlot[]> {
  const rows = await houseLeagueSlotRows(orgId, season);
  if (!rows.length) return [];
  const [uses, places] = await Promise.all([usesOf(orgId, rows.map(r => r.id)), readClubPlaces(orgId)]);
  return rows
    .filter(r => {
      const u = uses.get(r.id);
      return !!u && u.season_id === season.id && u.division_id === divisionId && u.kind === 'games';
    })
    .map(r => {
      const start = utcToZonedInputs(r.starts_at), end = utcToZonedInputs(r.ends_at);
      return {
        id: r.id, day: start.date, weekday: weekdayOf(start.date), start: start.time, end: end.time,
        startsAt: r.starts_at, endsAt: r.ends_at,
        place: (r.facility_id ? places.facilityName.get(r.facility_id) : null) ?? places.venueName.get(r.org_venue_id) ?? '',
        placeKey: `${r.org_venue_id}|${r.facility_id ?? ''}`,
        venueId: r.org_venue_id, facilityId: r.facility_id,
      };
    });
}

/** A division with any game, whatever became of it, is not generated (9d2·11 until 9d-2b publishes: "has any games"). */
export async function divisionHasGames(divisionId: string): Promise<boolean> {
  const { count, error } = await supabaseAdmin.from('league_games').select('id', { count: 'exact', head: true }).eq('division_id', divisionId);
  if (error) throw error;
  return (count ?? 0) > 0;
}

/** Every slot the same length → that length in minutes; otherwise null. */
export function slotMinutesOf(slots: readonly GameTimeSlot[]): number | null {
  const lengths = new Set(slots.map(s => Math.round((Date.parse(s.endsAt) - Date.parse(s.startsAt)) / 60_000)));
  return lengths.size === 1 ? [...lengths][0] : null;
}

/** The planned games as the club's checks read them: `new-{i}`, on their slot's venue and facility. */
function proposedRows(plan: GamePlan, slotOf: Map<string, GameTimeSlot>) {
  return plan.games.map((g, i) => {
    const s = slotOf.get(g.slotId)!;
    return { id: `new-${i}`, scheduledAt: g.scheduledAt, endsAt: g.endsAt, status: 'scheduled', orgVenueId: s.venueId, orgVenueFacilityId: s.facilityId };
  });
}

/** THE CHECK (c3): the plan's games, what the club's records say about them, and their Schedule health. */
export async function checkGeneratedGames(p: {
  orgId: string; season: LeagueSeason; divisionId: string; teams: readonly GameTeam[]; slots: readonly GameTimeSlot[]; plan: GamePlan;
}): Promise<GenerateCheckReply> {
  const { plan } = p;
  const summary = summaryOf(plan);
  if (plan.block) return { plan: summary, games: [], warnings: [], health: null, slotIds: [] };

  const slotOf = new Map(p.slots.map(s => [s.id, s]));
  const rows = proposedRows(plan, slotOf);
  const nameOf = new Map(p.teams.map(t => [t.id, t.name]));
  const [club, own, practices] = await Promise.all([
    // Another program's booking there, and the permit (the report reads both; a failed read says nothing, as every save
    // reply does).
    clashReportForLeagueRows(p.orgId, p.season, 'game', rows),
    // House league's own bookings there (a typed place, a hand-booked game or practice, another season's).
    checkLeagueBookings({
      orgId: p.orgId,
      proposed: rows.map((r, i) => ({
        id: r.id, kind: 'game' as const, startsAt: r.scheduledAt, endsAt: r.endsAt, status: 'scheduled',
        orgVenueId: r.orgVenueId, orgVenueFacilityId: r.orgVenueFacilityId,
        label: `${nameOf.get(plan.games[i].homeTeamId) ?? ''} vs ${nameOf.get(plan.games[i].awayTeamId) ?? ''}`,
      })),
    }),
    fetchAll<Parameters<typeof leagueHealthPracticeFromRow>[0]>((a, b) => supabaseAdmin.from('league_practices')
      .select('id, division_id, team_id, scheduled_at, ends_at, status, org_venue_id, org_venue_facility_id, location, club_schedule_slot_id')
      .eq('season_id', p.season.id).eq('division_id', p.divisionId).order('id').range(a, b)),
  ]);

  const warnings: GenerateWarning[] = [];
  // The permit: once per venue, with the first game's line.
  const permitVenues = new Set<string>();
  rows.forEach((r, i) => {
    const o = club.permits[r.id];
    if (!o || permitVenues.has(o.venueName)) return;
    permitVenues.add(o.venueName);
    warnings.push({ kind: 'permit', venue: o.venueName || slotOf.get(plan.games[i].slotId)!.place, line: club.permitLines[r.id] ?? '', permitId: o.permitId });
  });
  // A booking there: once per place and booking.
  const seen = new Set<string>();
  const booking = (place: string, other: string) => {
    if (seen.has(`${place}|${other}`)) return;
    seen.add(`${place}|${other}`);
    warnings.push({ kind: 'booking', place, other });
  };
  rows.forEach((r, i) => {
    const place = slotOf.get(plan.games[i].slotId)!.place;
    for (const f of club.findings[r.id] ?? []) {
      booking(place, `${clashOtherName(f.other)}, ${dayWords(clubDayOf(f.other.startMs))}, ${clashTimeRange(f.other.startMs, f.other.endMs)}`);
    }
  });
  for (const c of [...own.blocking, ...own.warnings]) {
    // A generated game against another generated game cannot happen (one game per slot); this is the club's pool.
    if (!c.partnerStartsAt) continue;
    const s = utcToZonedInputs(c.partnerStartsAt);
    const time = formatTimeRange(s.time, c.partnerEndsAt ? utcToZonedInputs(c.partnerEndsAt).time : null);
    booking(c.fieldLabel, `${c.partnerLabel}, ${dayWords(s.date)}, ${time}`);
  }
  warnings.push(...plan.warnings);

  const games: CheckedGame[] = plan.games.map(g => ({
    homeTeamId: g.homeTeamId, awayTeamId: g.awayTeamId, scheduledAt: g.scheduledAt, endsAt: g.endsAt, place: slotOf.get(g.slotId)!.place,
  }));
  const health = buildLeagueScheduleHealth({
    games: plan.games.map((g, i) => ({
      id: rows[i].id, divisionId: p.divisionId, homeTeamId: g.homeTeamId, awayTeamId: g.awayTeamId,
      scheduledAt: g.scheduledAt, endsAt: g.endsAt, status: 'scheduled',
      venueId: rows[i].orgVenueId, facilityId: rows[i].orgVenueFacilityId, location: null,
    })),
    practices: practices.map(leagueHealthPracticeFromRow),
    teams: p.teams.map(t => ({ id: t.id, name: t.name, divisionId: p.divisionId })),
  });
  return { plan: summary, games, warnings, health: health.score, slotIds: plan.games.map(g => g.slotId) };
}

/**
 * SAVE: the plan's games, each on its slot's venue and facility, the place said the way a picked venue says it; then the
 * one cross-program check on what was written (Club Tier Stage 6a), whose permit lines are the shipped after-save.
 */
export async function insertGeneratedGames(p: {
  orgId: string; season: LeagueSeason; divisionId: string; slots: readonly GameTimeSlot[]; plan: GamePlan;
}): Promise<GenerateSaveReply> {
  const slotOf = new Map(p.slots.map(s => [s.id, s]));
  const places = await readClubPlaces(p.orgId);
  const location = (s: GameTimeSlot) => {
    const venue = places.venueName.get(s.venueId) ?? '';
    const facility = s.facilityId ? places.facilityName.get(s.facilityId) ?? null : null;
    return facility ? formatVenueLocation(venue, facility) : venue || null;
  };
  const { data, error } = await supabaseAdmin.from('league_games').insert(p.plan.games.map(g => {
    const s = slotOf.get(g.slotId)!;
    return {
      org_id: p.orgId, season_id: p.season.id, division_id: p.divisionId,
      home_team_id: g.homeTeamId, away_team_id: g.awayTeamId,
      scheduled_at: g.scheduledAt, ends_at: g.endsAt,
      org_venue_id: s.venueId, org_venue_facility_id: s.facilityId, location: location(s),
    };
  })).select('id, scheduled_at, ends_at, status, org_venue_id, org_venue_facility_id');
  if (error) throw error;
  const saved = (data ?? []).map(r => ({
    id: r.id as string, scheduledAt: r.scheduled_at as string | null, endsAt: r.ends_at as string | null, status: r.status as string,
    orgVenueId: r.org_venue_id as string | null, orgVenueFacilityId: r.org_venue_facility_id as string | null,
  }));
  const report = await clashReportForLeagueRows(p.orgId, p.season, 'game', saved);
  return { saved: saved.length, permitLines: Object.values(report.permitLines).filter(Boolean) };
}
