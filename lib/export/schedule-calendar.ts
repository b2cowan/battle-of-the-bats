/**
 * lib/export/schedule-calendar.ts
 * What a schedule export WRITES — the calendar entries and the spreadsheet rows — for the coach's
 * Schedule and the house-league admin's schedule. React-free, so `node --test` reads it straight.
 *
 * ⚠⚠ EVERY DAY AND CLOCK HERE IS READ FROM THE INSTANT, IN THE ORG'S ZONE (the Schedule deep dive,
 * defect D-1, fixed 2026-09-25 on the owner's "fix now"). Both exports used to build a calendar
 * entry from `startsAt.slice(0, 10)` — the UNIVERSAL date — paired with a clock read somewhere else
 * (the device's on the coach Schedule, the org's on the house-league screen), then hand the pair to
 * `downloadICS` as a device-local time. Any event whose universal date differs from its local one
 * landed a day late: 2026-09-22T02:45Z (Mon 21 Sep, 10:45 p.m. in Toronto) exported as Tue 22 Sep,
 * 10:45 p.m. That is every event from 8 p.m. in summer, 7 p.m. in winter — 8 of 238 dev events.
 * The spreadsheets carried the same universal date in their Date column.
 *
 * The calendar entries now go out as INSTANTS (`ICSInstantEventInput`, UTC in → UTC out, the way the
 * family feed has always composed them), so the device's zone never enters the arithmetic and a
 * calendar app shows each event at its own time wherever the phone happens to be. The spreadsheets
 * read the org-local day and clock (`orgDayKey`, `formatInOrgZone`) — the day every screen shows.
 *
 * ⚠ A cancelled event goes out CANCELLED (defect D-2): the coach Schedule's export never passed
 * `cancelled`, so a called-off game sat in a coach's calendar as confirmed (the house-league
 * export always did — its mapper here keeps it). Re-importing the file replaces the
 * old entries — the UID is the event's id, unchanged — so the correction reaches a calendar that
 * already holds the wrong day.
 */

import type { ICSInstantEventInput } from './ics';
import type { LeagueGame, RepTeamEvent } from '../types';
import { formatStoredClock } from '../utils';
import { surfaceLabel } from '../sports';
import { opponentSuffix } from '../coach-tournament-games';
import { eventTypeCell } from '../coach-schedule-vocab';
import { formatInOrgZone, orgDayKey } from '../timezone';

/** Length of an entry with no end time — what both exports have always written. */
const DEFAULT_HOURS = 2;

export type CoachCalendarEvent = Pick<
  RepTeamEvent,
  | 'id' | 'name' | 'eventType' | 'isScrimmage' | 'opponent' | 'homeAway' | 'startsAt' | 'endsAt'
  | 'arrivalTime' | 'uniform' | 'description' | 'location' | 'locationAddress' | 'fieldNumber' | 'status'
>;

/** "Diamond 3" joins the place; the street address follows — the entry's one location line. */
function coachLocation(e: CoachCalendarEvent, sport: string): string | undefined {
  const place = [e.location, surfaceLabel(sport, e.fieldNumber)].filter(Boolean).join(' · ');
  return [place, e.locationAddress].filter(Boolean).join(', ') || undefined;
}

/**
 * The coach Schedule's calendar entries. Game-day detail rides each entry: arrival and uniform lead
 * the description so they sync to a phone's calendar, the field/diamond joins the location.
 * ⚠ THE TITLE IS THE LIST'S OWN: the event's name, plus the opponent only when the name does not
 * already carry it (`opponentSuffix`, the rule every schedule row reads). It used to append
 * " vs {opponent}" unconditionally — "vs Ridgeview vs Ridgeview", and "@ Fairhaven vs Fairhaven"
 * on an away game.
 */
export function coachScheduleCalendarEntries(events: readonly CoachCalendarEvent[], sport: string): ICSInstantEventInput[] {
  return events
    .filter(e => e.startsAt)
    .map(e => {
      const lead = [
        e.arrivalTime ? `Arrive by ${formatStoredClock(e.arrivalTime)}` : null,
        e.uniform ? `Uniform: ${e.uniform}` : null,
      ].filter(Boolean).join('\n');
      return {
        uid: e.id,
        title: `${e.name}${opponentSuffix(e)}`,
        startsAtIso: e.startsAt,
        endsAtIso: e.endsAt ?? null,
        durationHours: DEFAULT_HOURS,
        location: coachLocation(e, sport),
        description: [lead, e.description ?? ''].filter(Boolean).join('\n\n') || undefined,
        cancelled: e.status === 'cancelled',
      };
    });
}

/** The coach Schedule's Excel / CSV rows — the org-local day and clock, never the universal date. */
export function coachScheduleSheetRows(events: readonly CoachCalendarEvent[]) {
  return events.map(e => ({
    date:      e.startsAt ? orgDayKey(e.startsAt) : '',
    time:      e.startsAt ? formatInOrgZone(e.startsAt, { hour: 'numeric', minute: '2-digit', hour12: true }) : '',
    arrival:   e.arrivalTime ? formatStoredClock(e.arrivalTime) : '',
    // "Scrimmage" for a ticked Game, else the kind's label — one column, two words (mig 306).
    eventType: eventTypeCell(e),
    name:      e.name,
    opponent:  e.opponent ?? '',
    location:  e.location ?? '',
    address:   e.locationAddress ?? '',
    field:     e.fieldNumber ?? '',
    uniform:   e.uniform ?? '',
    homeAway:  e.homeAway ?? '',
  }));
}

export type HouseLeagueCalendarGame = Pick<LeagueGame, 'id' | 'homeTeamId' | 'awayTeamId' | 'scheduledAt' | 'endsAt' | 'location' | 'status'>;

/** The house-league admin schedule's calendar entries — the same instant rule as the coach's. */
export function houseLeagueCalendarEntries(
  games: readonly HouseLeagueCalendarGame[],
  teamName: (teamId: string) => string | undefined,
): ICSInstantEventInput[] {
  return games
    .filter(g => g.scheduledAt)
    .map(g => ({
      uid: g.id,
      title: `${teamName(g.homeTeamId) ?? 'Home'} vs ${teamName(g.awayTeamId) ?? 'Away'}`,
      startsAtIso: g.scheduledAt!,
      endsAtIso: g.endsAt ?? null,
      durationHours: DEFAULT_HOURS,
      location: g.location ?? undefined,
      cancelled: g.status === 'cancelled',
    }));
}
