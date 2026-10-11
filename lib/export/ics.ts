/**
 * lib/export/ics.ts
 * iCal (.ics) event building and download.
 *
 * Built (Phase D, E1 in build order) — `composeICSFromInstants` + `downloadICS` below. (The
 * "STUB" this header carried outlived the implementation; trued 2026-09-25.)
 *
 * Design decisions documented in MERGED_EXPORTS_IMPLEMENTATION_PLAN.md Phase D:
 * - Deterministic UIDs: {gameId}@fieldlogichq.ca — re-importing de-duplicates
 * - Cancelled games: STATUS:CANCELLED
 * - Timezone: America/Toronto for all Canadian orgs (V1)
 * - Duration: 2h default for games, 1.5h for practices
 *
 * ⚠⚠ TWO INPUT SHAPES, AND THE CALLER'S DATA DECIDES WHICH (the Schedule deep dive's D-1,
 * 2026-09-25). `downloadICS` takes a LOCAL date + clock and writes them as the device's local time
 * — right only for a caller that stores a local date and clock (a tournament game's `game_date` /
 * `game_time`, the free team calendar). A caller that holds an INSTANT (`startsAt`, `scheduledAt`)
 * must use `downloadICSFromInstants`: slicing an instant for its date reads the UNIVERSAL day, and
 * every evening event then lands on the next one. Both exports that did exactly that were moved.
 */

import type { EventAttributes } from 'ics';
import { addCalendarDays } from '../timezone';

export interface ICSEventInput {
  /** Stable unique identifier — used to build the event UID */
  gameId: string;
  /** Event title, e.g. "{HomeTeam} vs {AwayTeam} — {Division}" */
  title: string;
  /** ISO date string: "2026-07-12" */
  date: string;
  /** 24-hour time string: "14:00". Absent = all-day event */
  time?: string;
  /** Duration in hours. Default: 2 */
  durationHours?: number;
  location?: string;
  description?: string;
  organizerName?: string;
  organizerEmail?: string;
  /** Link back to the public schedule page */
  url?: string;
  cancelled?: boolean;
}

/** An event identified by a precise INSTANT rather than a local date + time. */
export interface ICSInstantEventInput {
  /** Stable unique identifier — used to build the event UID. */
  uid: string;
  title: string;
  /** Full ISO timestamp, e.g. "2026-08-09T15:00:00.000Z". */
  startsAtIso: string;
  /** Full ISO end timestamp when one is actually known. Preferred over `durationHours` —
   *  a coach who entered an end time meant it, and a fixed default would put the wrong
   *  block on a family's calendar. */
  endsAtIso?: string | null;
  /** Fallback length when no end time was entered. Default: 2. */
  durationHours?: number;
  location?: string;
  description?: string;
  url?: string;
  /** Kept and marked: `STATUS:CANCELLED`, and shown as free time (`TRANSP:TRANSPARENT`) so a called-off game
   *  never blocks the reader's own evening (Club Tier 6d, F2). */
  cancelled?: boolean;
  /**
   * An ALL-DAY entry across these club-local days, inclusive (`YYYY-MM-DD`) — an outside tournament, which has
   * days and no clock (6d, F4; S6D-08: it was written as a two-hour block at its start). Overrides the instant's
   * clock; the instant still orders it.
   */
  allDay?: { start: string; end: string };
}

/**
 * How often a calendar app is told to re-read a feed: FOUR hours, never one (the owner's cost ruling, Club Tier 6d,
 * 2026-10-11 — one hour would bring Apple and Outlook back hourly; Google ignores the hint either way, which is why
 * help says "up to a day"). A dial, lowered only with the stack-health numbers in hand. Written on every calendar
 * this module composes — a downloaded file ignores it, and the library's own hard-coded one-hour line is replaced.
 */
export const FEED_REFRESH_HOURS = 4;

/** The two hint lines, in the header: RFC 7986's `REFRESH-INTERVAL` (Apple) and Outlook's `X-PUBLISHED-TTL`. */
function withRefreshHint(ics: string): string {
  const hint = `REFRESH-INTERVAL;VALUE=DURATION:PT${FEED_REFRESH_HOURS}H\r\nX-PUBLISHED-TTL:PT${FEED_REFRESH_HOURS}H\r\n`;
  return ics.replace(/X-PUBLISHED-TTL:[^\r\n]*\r\n/, '').replace(/(BEGIN:VEVENT\r\n|END:VCALENDAR\r\n)/, `${hint}$1`);
}

/**
 * A length in whole hours and minutes. ⚠ The file's grammar has no fractions: an hour and a half handed over as
 * `{ hours: 1.5 }` wrote `DURATION:PT1.5H`, which a strict calendar app refuses or misreads — the family feed wrote
 * exactly that for every practice from the day it was built (found by the 6d build, 2026-10-11). `PT1H30M`.
 */
function wholeDuration(hours: number): { hours: number; minutes?: number } {
  // A length that isn't a positive number (zero, negative, NaN) falls back to the two hours every caller defaults to.
  const total = Number.isFinite(hours) && hours > 0 ? Math.max(1, Math.round(hours * 60)) : 120;
  const minutes = total % 60;
  return minutes ? { hours: Math.floor(total / 60), minutes } : { hours: total / 60 };
}

/** `YYYY-MM-DD` → the library's date-only triple (a DATE value, no clock, no zone). */
function dayTriple(day: string): [number, number, number] {
  const [y, m, d] = day.split('-').map(Number);
  return [y, m, d];
}

/**
 * Compose an .ics document from precise instants and RETURN it (no browser APIs) — the
 * server half of the calendar story.
 *
 * Instants rather than local date+time on purpose. `downloadICS` builds a floating local
 * time, which is right for a one-off file a person opens next to the schedule they were
 * just reading. A SUBSCRIPTION feed is read by a calendar app that may be in any timezone
 * and re-reads for months, so the events are anchored in UTC and each client renders them
 * in its own zone. Getting this wrong is the classic "practice shows at 3am" bug.
 *
 * ⚠ THE CALENDAR'S NAME IS A HEADER, AND IT IS WRITTEN WHEN THERE ARE NO EVENTS (Club Tier 6d, F8 / F10). It used to
 * ride each event, so an empty feed — a new season, or a link that has stopped and answers empty on purpose — reached
 * a calendar app with no name at all. An EMPTY list composes a named calendar with no entries; that is the answer a
 * stopped link gives, so its events leave the subscriber's calendar instead of freezing there (S6D-04).
 */
export async function composeICSFromInstants(
  events: ICSInstantEventInput[],
  calendarName: string,
  orgDomain = 'fieldlogichq.ca',
): Promise<string | null> {
  const { createEvents } = await import('ics');

  const { error, value } = createEvents(
    events.map((e) => {
      const d = new Date(e.startsAtIso);
      // A real end time beats the default, but only when it is valid AND after the start —
      // a bad row must not produce a negative-length calendar entry.
      const end = e.endsAtIso ? new Date(e.endsAtIso) : null;
      const endIsUsable = !!end && !Number.isNaN(end.getTime()) && end.getTime() > d.getTime();
      const when = e.allDay
        // Days, not instants: a DATE value carries no zone, so every reader sees the tournament's own days.
        //   An all-day entry's end is EXCLUSIVE in the file's grammar: the day after its last, by the calendar.
        ? { start: dayTriple(e.allDay.start), end: dayTriple(addCalendarDays(e.allDay.end, 1)) }
        : {
            start: [
              d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(),
              d.getUTCHours(), d.getUTCMinutes(),
            ] as [number, number, number, number, number],
            startInputType: 'utc',
            startOutputType: 'utc',
            ...(endIsUsable
              ? {
                  end: [
                    end!.getUTCFullYear(), end!.getUTCMonth() + 1, end!.getUTCDate(),
                    end!.getUTCHours(), end!.getUTCMinutes(),
                  ] as [number, number, number, number, number],
                  endInputType: 'utc',
                  endOutputType: 'utc',
                }
              : { duration: wholeDuration(e.durationHours ?? 2) }),
          };
      return {
        uid: `${e.uid}@${orgDomain}`,
        title: e.title,
        ...when,
        location: e.location,
        description: e.description,
        status: (e.cancelled ? 'CANCELLED' : 'CONFIRMED') as EventAttributes['status'],
        ...(e.cancelled ? { transp: 'TRANSPARENT' } : {}),
        url: e.url,
      } as EventAttributes;
    }),
    { productId: '-//FieldLogicHQ//Schedule//EN', method: 'PUBLISH', calName: calendarName },
  );

  if (error || !value) {
    console.error('[export/ics] Failed to compose iCal feed:', error);
    return null;
  }
  return withRefreshHint(value);
}

/**
 * Generate and download an .ics file from a list of events.
 *
 * @param filename  - Full filename including .ics extension
 * @param events    - Events to include
 * @param orgDomain - Domain used for event UIDs. Default: 'fieldlogichq.ca'
 */
export async function downloadICS(
  filename: string,
  events: ICSEventInput[],
  orgDomain = 'fieldlogichq.ca',
): Promise<void> {
  const { createEvents } = await import('ics');

  const { error, value } = createEvents(
    events.map((e) => {
      const [year, month, day] = e.date.split('-').map(Number);
      const start: EventAttributes['start'] = e.time
        ? (() => {
            const [hour, minute] = e.time!.split(':').map(Number);
            return [year, month, day, hour, minute] as [number, number, number, number, number];
          })()
        : [year, month, day];

      return {
        uid: `${e.gameId}@${orgDomain}`,
        title: e.title,
        start,
        duration: { hours: e.durationHours ?? 2 },
        location: e.location,
        description: e.description,
        status: (e.cancelled ? 'CANCELLED' : 'CONFIRMED') as EventAttributes['status'],
        url: e.url,
        organizer: e.organizerEmail
          ? { name: e.organizerName, email: e.organizerEmail }
          : undefined,
      } as EventAttributes;
    }),
  );

  if (error || !value) {
    console.error('[export/ics] Failed to generate iCal events:', error);
    return;
  }
  saveICSFile(filename, value);
}

/**
 * Generate and download an .ics file from events identified by INSTANTS — the browser half of
 * `composeICSFromInstants`. Anchored in UTC, so the entry lands on the event's own day and time
 * whatever zone the downloading device is in (see the header for why an instant must never be
 * sliced into a local date).
 */
export async function downloadICSFromInstants(
  filename: string,
  events: ICSInstantEventInput[],
  calendarName: string,
  orgDomain = 'fieldlogichq.ca',
): Promise<void> {
  const value = await composeICSFromInstants(events, calendarName, orgDomain);
  if (!value) return;
  saveICSFile(filename, value);
}

/** The one blob-and-anchor path both downloads end in. */
function saveICSFile(filename: string, value: string): void {
  const blob = new Blob([value], { type: 'text/calendar;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), {
    href: url,
    download: filename,
    style: 'visibility:hidden',
  });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
