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
 *
 * ⚠⚠ THE COACH'S CALENDAR FILE SPEAKS THE FEED'S WORDS (Club Tier Stage 6d, A1/B2, 2026-10-11). Its entries come from
 * `teamFeedEntries` (`./team-feed-words`, the recipe F1–F10) with the COACH reader — the same entries a coach's
 * subscription writes — so the team leads every title, a cancelled event reads "Cancelled · …", a practice with no end
 * is an hour and a half, an outside tournament is all day, and the file carries the tryout days and the organizer's
 * games the screen shows (S6D-05: it wrote the events alone). It used to title an event with the list's own name.
 */

import type { ICSInstantEventInput } from './ics';
import type { LeagueGame, RepTeamEvent } from '../types';
import { formatStoredClock } from '../utils';
import { eventTypeCell } from '../coach-schedule-vocab';
import { formatInOrgZone, orgDayKey } from '../timezone';
import { teamFeedEntries, type FeedEntryKind, type FeedOrganizerGame, type FeedTryoutDay } from './team-feed-words';

/** Length of a house-league game with no end time — what that export has always written. */
const DEFAULT_HOURS = 2;

export type CoachCalendarEvent = Pick<
  RepTeamEvent,
  | 'id' | 'name' | 'eventType' | 'isScrimmage' | 'opponent' | 'homeAway' | 'startsAt' | 'endsAt'
  | 'arrivalTime' | 'uniform' | 'description' | 'location' | 'locationAddress' | 'fieldNumber' | 'status'
> & Partial<Pick<RepTeamEvent, 'sourceTournamentGameId'>>;

/**
 * The coach Schedule's calendar FILE — the coach's feed entries (F1–F10), from what the screen holds: the season's
 * events, the tryout days when this coach runs them (the screen only fetches them if so), and the organizer's games
 * the list doesn't already hold. Game-day detail rides each entry's notes: arrival in the club's clock, uniform, the
 * coach's notes.
 */
export function coachScheduleCalendarEntries(
  events: readonly CoachCalendarEvent[],
  opts: {
    teamName: string;
    sport: string;
    tryoutDays?: readonly FeedTryoutDay[];
    organizerGames?: readonly FeedOrganizerGame[];
    linkFor?: (kind: FeedEntryKind, id: string) => string | null;
  },
): ICSInstantEventInput[] {
  return teamFeedEntries({
    teamName: opts.teamName,
    sport: opts.sport,
    reader: 'coach',
    events,
    tryoutDays: opts.tryoutDays,
    organizerGames: opts.organizerGames,
    linkFor: opts.linkFor,
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
