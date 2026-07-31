// Weekly recurrence for the coach schedule — PURE date math, no I/O, no React.
//
// Chunk C (P1 #6). Before this, "Repeat weekly" took ONE opponent and stamped it onto every game
// it generated, so a 12-game round robin was more work through the feature than without it. The
// fix is not a twelfth opponent field: it is letting the coach SEE the occurrences before any of
// them exist. That makes a recurring series the same shape as an import — a set of proposed rows
// reviewed before commit — so the two share one preview.
//
// This module is the single generator both sides call. The client builds the preview from it; the
// commit route regenerates from the SAME rule and refuses any row whose date it did not produce,
// so a client/server disagreement can never silently write an unreviewed date (or drop a reviewed
// one). Dates the server generates but the client omits are deliberate removals — the bye week.
//
// Relative WITH the .ts extension (not `@/`) so the unit tests can run under plain `node --test`.
import { addCalendarDays, daysBetweenDateStrings } from './timezone.ts';

/** Hard ceiling on one series. A weekly series across a full year is 53; anything past this is a
 *  fat-fingered end date, not a season. */
export const MAX_RECURRENCE_OCCURRENCES = 60;

export interface WeeklyRecurrenceRule {
  /** 0 = Sunday … 6 = Saturday. */
  dayOfWeek: number;
  /** `YYYY-MM-DD` — the first date the series may fall on (inclusive). */
  startDate: string;
  /** `YYYY-MM-DD` — the last date the series may fall on (inclusive). */
  endDate: string;
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Day of week for a `YYYY-MM-DD` string, 0 = Sunday.
 *
 * UTC arithmetic on a DATE-ONLY value, which is zone-free and therefore safe: it never asks what
 * day it is anywhere. The banned idiom is the reverse — deriving a calendar day from an instant
 * (`someDate.toISOString().slice(0, 10)`), which reads the UTC day of a moment.
 */
export function dayOfWeekFor(date: string): number | null {
  if (!DATE_ONLY.test(date)) return null;
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/**
 * Every date a weekly series falls on, `YYYY-MM-DD`, in order.
 *
 * Pure string stepping — no `Date` is constructed to answer "what day is this", and no instant is
 * ever formatted down to a calendar day. Returns [] when the rule is incomplete or malformed, and
 * caps at {@link MAX_RECURRENCE_OCCURRENCES}.
 */
export function generateWeeklyOccurrences(rule: WeeklyRecurrenceRule): string[] {
  const { dayOfWeek, startDate, endDate } = rule;
  if (!DATE_ONLY.test(startDate ?? '') || !DATE_ONLY.test(endDate ?? '')) return [];
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) return [];
  if (daysBetweenDateStrings(startDate, endDate) < 0) return [];

  const firstDow = dayOfWeekFor(startDate);
  if (firstDow == null) return [];

  const out: string[] = [];
  let cursor = addCalendarDays(startDate, (dayOfWeek - firstDow + 7) % 7);
  while (daysBetweenDateStrings(cursor, endDate) >= 0 && out.length < MAX_RECURRENCE_OCCURRENCES) {
    out.push(cursor);
    cursor = addCalendarDays(cursor, 7);
  }
  return out;
}

/** One reviewed occurrence, as the preview edits it and the commit route receives it. */
export interface RecurrenceOccurrenceInput {
  /** `YYYY-MM-DD` — must be one the rule itself generates. */
  date: string;
  /** Per-date opponent. Games only; blank is allowed (the event names itself, as a one-off does). */
  opponent?: string | null;
  /** Per-date home/away. Games only. */
  homeAway?: string | null;
}

export interface ReviewedRecurrence {
  /** Occurrences that will actually be written, in date order. */
  accepted: RecurrenceOccurrenceInput[];
  /** Dates the coach removed from the preview (generated, but not submitted) — the bye week. */
  removed: string[];
  /** Submitted dates the rule does NOT generate. Non-empty means REFUSE the whole commit. */
  unknown: string[];
}

/**
 * Reconcile submitted occurrences against a fresh generation of the same rule.
 *
 * A submitted date the rule cannot produce is `unknown` and must fail the request — never be
 * quietly dropped, and never written. A generated date that was not submitted is a deliberate
 * `removed` (the coach deleted that row before committing).
 */
export function reviewRecurrenceOccurrences(
  rule: WeeklyRecurrenceRule,
  submitted: RecurrenceOccurrenceInput[],
): ReviewedRecurrence {
  const generated = new Set(generateWeeklyOccurrences(rule));
  const accepted: RecurrenceOccurrenceInput[] = [];
  const unknown: string[] = [];
  const seen = new Set<string>();

  for (const row of submitted) {
    const date = (row?.date ?? '').trim();
    if (!generated.has(date) || seen.has(date)) { unknown.push(date); continue; }
    seen.add(date);
    accepted.push({
      date,
      opponent: typeof row.opponent === 'string' ? row.opponent.trim() || null : null,
      homeAway: row.homeAway || null,
    });
  }

  accepted.sort((a, b) => a.date.localeCompare(b.date));
  return {
    accepted,
    removed: [...generated].filter(d => !seen.has(d)).sort(),
    unknown,
  };
}
