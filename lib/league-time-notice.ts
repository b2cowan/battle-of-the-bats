/**
 * "The club gave house league time", opened — the part of house league's time notice the message block reads (Notifications
 * read at a glance, Stage 2). Kept apart from `lib/league-time-handoff.ts` on purpose: that module reaches the club
 * scheduler and, through it, the coach portal's ~945KB stylesheet, and the message block renders on every admin page
 * (notification-open-in-place-guard). Pure and client-safe; it imports only the shared facts shape.
 */
import { FACT_LABELS, capFactList, factRow, noticeFacts, type NoticeFacts } from './notification-facts';
import { pluralize } from './utils';

/** [marketing] The next step, under the rows, only when the week grew. */
export const TIME_GIVEN_NEXT = 'Divide it into games and practices.';

/** The slot lines' fold (Q3): "Show 3 more slots". [marketing] */
const SLOT_NOUN = { one: 'slot', many: 'slots' } as const;
/** [marketing] Past 30 slot shapes in one notice. */
const slotsMore = (n: number) => `and ${pluralize(n, 'more slot', 'more slots')} on the schedule`;

/** One half of a time notice: "Gives · 2 hours a week · Mar 13 – Apr 3" over its slots, one to a line. Also the shape a
 *  notice sent on 2026-11-14 STORED (`metadata.timeChange`), before the shared shape. */
export interface TimeChangeBlock { label: string; hours: string; range: string; lines: string[] }
export interface TimeChangeFacts { schedule: string; season: string; grows: boolean; blocks: TimeChangeBlock[] }

/** The time notice's rows on the shared shape: Season, Schedule, then each block with the hours as the bold lead, the dates
 *  as the quieter detail and the slots as a list under it; the next step only when the week grew. */
export function timeChangeAsFacts(f: TimeChangeFacts): NoticeFacts {
  return noticeFacts(
    [
      factRow(FACT_LABELS.season, f.season),
      factRow(FACT_LABELS.schedule, f.schedule),
      ...f.blocks.map(b => factRow(b.label, b.hours, { lead: true, detail: b.range, list: capFactList(b.lines, SLOT_NOUN, slotsMore) })),
    ],
    f.grows ? TIME_GIVEN_NEXT : null,
  );
}

const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every(x => typeof x === 'string');

/** A notice sent with the first, bespoke stored shape (`metadata.timeChange`), read onto the shared one; null for anything
 *  else (a notice sent before either keeps its paragraph). */
export function readTimeChangeFacts(meta: unknown): NoticeFacts | null {
  const f = (meta as { timeChange?: unknown } | null | undefined)?.timeChange as Partial<TimeChangeFacts> | undefined;
  if (!f || typeof f.schedule !== 'string' || typeof f.season !== 'string' || typeof f.grows !== 'boolean' || !Array.isArray(f.blocks) || !f.blocks.length) return null;
  const blocks = f.blocks.filter((b): b is TimeChangeBlock =>
    !!b && typeof b.label === 'string' && typeof b.hours === 'string' && typeof b.range === 'string' && strings(b.lines));
  return blocks.length === f.blocks.length ? timeChangeAsFacts({ schedule: f.schedule, season: f.season, grows: f.grows, blocks }) : null;
}
