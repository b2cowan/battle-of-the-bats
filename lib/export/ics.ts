/**
 * lib/export/ics.ts
 * iCal (.ics) event building and download.
 *
 * STUB — Full implementation in Phase D (E1 in build order).
 *
 * Design decisions documented in MERGED_EXPORTS_IMPLEMENTATION_PLAN.md Phase D:
 * - Deterministic UIDs: {gameId}@fieldlogichq.ca — re-importing de-duplicates
 * - Cancelled games: STATUS:CANCELLED
 * - Timezone: America/Toronto for all Canadian orgs (V1)
 * - Duration: 2h default for games, 1.5h for practices
 */

import type { EventAttributes } from 'ics';

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
  cancelled?: boolean;
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
      return {
        uid: `${e.uid}@${orgDomain}`,
        title: e.title,
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
          : { duration: { hours: e.durationHours ?? 2 } }),
        location: e.location,
        description: e.description,
        status: (e.cancelled ? 'CANCELLED' : 'CONFIRMED') as EventAttributes['status'],
        url: e.url,
        calName: calendarName,
      } as EventAttributes;
    }),
  );

  if (error || !value) {
    console.error('[export/ics] Failed to compose iCal feed:', error);
    return null;
  }
  return value;
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
