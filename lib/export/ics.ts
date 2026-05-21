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
