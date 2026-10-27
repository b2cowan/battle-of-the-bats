import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { fetchAllIn } from './supabase-paging';
import { getDivisionsForSeason } from './db';
import { readClubPlaces } from './permit-lookup';
import { weekdayOf } from './permit-time';
import { addCalendarDays, mondayOfDay, utcToZonedInputs } from './timezone';
import { canOpenModule, type MemberAccessInput } from './member-access';
import { loadSchedule, readClubTeams } from './club-schedule-server';
import { HOUSE_LEAGUE } from './club-schedule-holders';
import { practicesStillToCome } from './league-time-server';
import { projectClubSlots, type LeagueClubSchedule, type RawClubSlot } from './league-club-schedule';
import type { EntitlementOrg } from './module-entitlements';
import type { LeagueSeason } from './types';
import type { LeagueUseKind } from './league-time';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE LEAGUE ADMIN IN THE CLUB'S SCHEDULE, SERVER SIDE (Club Tier Stage 11b Part 3, drawings tab 5; ruled card 11).
 * One club schedule's week for whoever reads house league, opened from House league's time.
 *
 * ⚖ WHICH SCHEDULE: a FINAL schedule of this club that house league holds time in — the sources House league's time
 * lists. A draft, or a schedule house league has no time in, is not this page's to read (404, as an unknown one).
 * ⚖ WHAT: `projectClubSlots` (lib/league-club-schedule.ts) — an allow-list, never `scheduleView`: no bill, pricing, asks,
 * replies, sends or money ever leave this file. Rep team names are read only for a viewer who can open Rep teams
 * (`canOpenRepTeams`, here and never in a route file: the house-league guard keeps module checks out of routes).
 * ⚖ WRITES: none here. The one-date Use saves through House league's time's own route (`league_slot_uses_apply`).
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

/** The viewer can open Rep teams — the one gate on a rep team's name reaching this page. */
export const canOpenRepTeams = (member: MemberAccessInput, org: EntitlementOrg) => canOpenModule(member, org, 'module_rep_teams');

/** The week holding `cursor` (any day), read; null when the schedule isn't this page's to read. */
export async function readLeagueClubSchedule(p: {
  orgId: string; org: EntitlementOrg; member: MemberAccessInput; season: LeagueSeason; scheduleId: string; cursor: string;
}): Promise<LeagueClubSchedule | null> {
  const loaded = await loadSchedule(p.orgId, p.scheduleId);
  if (!loaded || loaded.row.state !== 'final') return null;
  const live = loaded.slots.filter(s => !s.removed);
  if (!live.some(s => s.teamIds.includes(HOUSE_LEAGUE))) return null;

  const repTeams = canOpenRepTeams(p.member, p.org);
  const from = mondayOfDay(p.cursor), to = addCalendarDays(from, 6);
  const raw: RawClubSlot[] = loaded.slots.map(s => {
    const start = utcToZonedInputs(s.startsAt), end = utcToZonedInputs(s.endsAt);
    return {
      id: s.id, venueId: s.venueId, facilityId: s.facilityId, startsAt: s.startsAt, day: start.date, weekday: weekdayOf(start.date),
      startClock: start.time, endClock: end.time, houseLeague: s.teamIds.includes(HOUSE_LEAGUE),
      teamIds: s.teamIds.filter(id => id !== HOUSE_LEAGUE), removed: s.removed,
    };
  });
  const weekHl = raw.filter(s => !s.removed && s.houseLeague && s.day >= from && s.day <= to).map(s => s.id);
  const [places, teams, divisions, uses, practices] = await Promise.all([
    readClubPlaces(p.orgId),
    // No Rep teams: no rep team's name is read at all.
    repTeams ? readClubTeams(p.orgId, { repTeams: true }) : Promise.resolve(null),
    getDivisionsForSeason(p.season.id),
    weekHl.length
      ? fetchAllIn<{ slot_id: string; season_id: string; division_id: string; kind: LeagueUseKind }>(weekHl, (c, a, b) => supabaseAdmin
        .from('league_slot_uses').select('slot_id, season_id, division_id, kind').eq('org_id', p.orgId).in('slot_id', c).order('slot_id').range(a, b))
      : Promise.resolve([]),
    practicesStillToCome(p.orgId, p.season.id, weekHl),
  ]);
  const inSeason = (day: string) =>
    (!p.season.seasonStartDate || day >= p.season.seasonStartDate) && (!p.season.seasonEndDate || day <= p.season.seasonEndDate);
  const venueIds = [...new Set(live.map(s => s.venueId))];
  return {
    schedule: { id: loaded.row.id, name: loaded.row.name, startsOn: loaded.row.starts_on, endsOn: loaded.row.ends_on },
    places: venueIds.map(v => ({
      venueId: v, venueName: places.venueName.get(v) ?? '',
      facilities: (places.byVenue.get(v) ?? []).map(f => ({ id: f, name: places.facilityName.get(f) ?? '' })),
    })),
    week: from,
    slots: projectClubSlots({
      slots: raw, week: { from, to }, seasonId: p.season.id,
      uses: new Map(uses.map(u => [u.slot_id, { seasonId: u.season_id, use: { divisionId: u.division_id, kind: u.kind } }])),
      teamName: teams ? new Map(teams.map(t => [t.id, t.name])) : null,
      final: true, now: new Date().toISOString(), inSeason,
    }),
    divisions: divisions.map(d => ({ id: d.id, name: d.name })),
    practices,
  };
}
