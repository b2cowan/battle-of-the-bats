// Monthly recurrence for coach payables — PURE date math, no I/O, no React.
//
// The sibling of `coach-recurrence.ts`, and deliberately a separate module rather than a mode on
// it. Weekly stepping has no hard question in it: every week has the same seven days, so "the
// Tuesday series" means one thing. Monthly stepping has exactly one hard question — **what does
// "the 31st" mean in February** — and the answer is a product ruling, not arithmetic (plan §3.3).
// It lives here, with the rule that owns it, rather than in `lib/timezone.ts` with the date
// primitives, which must stay opinion-free.
//
// The interaction is the one the schedule already established: the coach SEES the occurrences
// before any of them exist, edits the list, and commits it. The client builds the preview from this
// module; the commit route regenerates from the SAME rule and refuses any date it did not itself
// produce, so a client/server disagreement can never quietly write an unreviewed payable — or drop
// a reviewed one. Dates generated but not submitted are deliberate removals (the month off).
//
// Four deliberate differences from the weekly sibling, each with a reason:
//   1. An occurrence is an OBJECT, not a string. `clamped` is what the preview row renders its
//      "February has no 31st" note from — a coach must never be handed a date they did not type
//      without being told why.
//   2. The ceiling REFUSES; it does not truncate. Weekly caps a fat-fingered end date at 60 and
//      carries on. Here a silently truncated preview is a promise the commit route cannot keep
//      (it enforces the same ceiling and would refuse the rest), so an over-long run produces
//      nothing at all — see {@link MAX_MONTHLY_OCCURRENCES}.
//   3. The end of a run has two shapes — a last date, or a number of payments. "Six payments" is
//      how an invoice term is actually worded, and it is the shape that cannot be miscounted.
//   4. The ceiling counts the SERIES, not the request (§3.4/§5.3), which a weekly schedule series
//      has no equivalent of. That is why {@link reviewMonthlyOccurrences} REQUIRES the number of
//      occurrences the series already holds: a run of 20 extended by 6 is 26, and each half of
//      that passes a per-request check on its own. The parameter is required rather than
//      defaulted so a commit route cannot forget the question — it has to answer 0 out loud.
//
// Relative WITH the .ts extension (not `@/`) so the unit tests can run under plain `node --test`.
import { parseDateOnlyParts } from './timezone.ts';

/**
 * Hard ceiling on one series — TWO full seasons of monthly payments (plan §3.4).
 *
 * The weekly module's 60 is right for 53 weeks and far too loose here: monthly across a season is
 * 12, across two is 24, and anything beyond that is a mistyped end date, not a commitment.
 *
 * **A run that exceeds this is REFUSED, not trimmed**: {@link generateMonthlyOccurrences} returns
 * `[]`. The commit route enforces the same ceiling with the same message (the precedent is
 * `MAX_INSTALLMENTS` on the dues generator — a roster-sized multiplier on an unbounded input,
 * reachable by anyone who can already write money here, must refuse identically in both places).
 *
 * ⚠ **{@link generateMonthlyOccurrences} caps ONE run — it cannot see rows that already exist.**
 * §5.3's rule is that the ceiling counts the SERIES, so extending a run of 20 by 6 must be refused
 * even though 6 and 20 each pass on their own. That sum is enforced in
 * {@link reviewMonthlyOccurrences}, which every write goes through (§3.5) and which therefore takes
 * the series' existing occurrence count as a **required** argument.
 *
 * ⚠ **An empty result has THREE causes, not one**, and a caller that explains it to the coach must
 * tell them apart: a malformed rule, this ceiling, or — on an `until` run only — a window too
 * narrow to hold a single occurrence ("the 20th, from the 15th until the 18th"). Once the rule's
 * parts are known good, a `{ count }` run can only be the ceiling; an `{ until }` run is separated
 * by re-asking with `{ count: 1 }` — if that date comes back *after* `until`, the window was empty
 * rather than the run too long.
 */
export const MAX_MONTHLY_OCCURRENCES = 24;

export interface MonthlyRecurrenceRule {
  /** 1–31, or `'last'` for the month's last day — a first-class value, NOT sugar for 31. An
   *  invoice term usually means the last day, and saying so sidesteps the clamp entirely. */
  dayOfMonth: number | 'last';
  /** `YYYY-MM-DD` — the first date the series may fall on (inclusive). It need not itself be on
   *  `dayOfMonth`; the run starts at the first matching date on or after it. */
  startDate: string;
  /** How the run ends: on a last date (inclusive), or after a number of payments. */
  end: { until: string } | { count: number };
}

/** One generated date, and whether it is the date the coach asked for. */
export interface MonthlyOccurrence {
  /** `YYYY-MM-DD`. */
  date: string;
  /** True when the month is too short for `dayOfMonth` and this date was pulled back to the last
   *  day of it. Always false for `dayOfMonth: 'last'` — that date IS what was asked for. */
  clamped: boolean;
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Days in a calendar month, `month` 1–12. Pure arithmetic — the Gregorian leap rule in full,
 *  including the century exception, so 2100 is not silently given a 29th of February. */
function daysInMonth(year: number, month: number): number {
  if (month === 2) return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 29 : 28;
  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31;
}

/** `YYYY-MM-DD` from calendar parts. Zero-padded, which is what makes plain string `<`/`>`
 *  comparison a correct date comparison everywhere below — no `Date` is constructed to compare. */
function toDateString(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * A `YYYY-MM-DD` that is a **real calendar date**, split into its parts — or null.
 *
 * The shape check is not enough on its own, and this module cannot borrow the weekly sibling's
 * tolerance for that: `dayOfWeekFor` hands `2026-13-01` to `Date.UTC`, which NORMALISES it to
 * January 2027, so the weekly generator can only ever emit real dates. Stepping months by hand has
 * no such backstop — an unvalidated month 13 walks on to "2026-14-01", a string that is not a date
 * at all, and the reconcile would then accept it as a legitimate due date to write. So the range
 * check happens here, once, on the way in.
 */
function parseCalendarDate(value: string | null | undefined): { y: number; m: number; d: number } | null {
  if (!DATE_ONLY.test(value ?? '')) return null;
  const parts = parseDateOnlyParts(value);
  if (!parts) return null;
  if (parts.m < 1 || parts.m > 12) return null;
  if (parts.d < 1 || parts.d > daysInMonth(parts.y, parts.m)) return null;
  return parts;
}

/**
 * The day this rule falls on in a given month, and whether the month was too short for it.
 *
 * THE PRODUCT RULING (plan §3.3): a short month CLAMPS to its last day and keeps its place in the
 * run. Skipping it instead would hand back five payables from a six-month rule — the coach's count
 * silently wrong. Clamping without saying so would hand back a date they never typed. So: clamp,
 * keep the count, and flag the row.
 */
function resolveDayInMonth(year: number, month: number, dayOfMonth: number | 'last'): MonthlyOccurrence {
  const lastDay = daysInMonth(year, month);
  if (dayOfMonth === 'last') return { date: toDateString(year, month, lastDay), clamped: false };
  return dayOfMonth > lastDay
    ? { date: toDateString(year, month, lastDay), clamped: true }
    : { date: toDateString(year, month, dayOfMonth), clamped: false };
}

/**
 * Every date a monthly series falls on, in order, each flagged if its month was too short.
 *
 * Pure string stepping over calendar parts — no `Date` is constructed to answer "what day is
 * this", and no instant is ever formatted down to a calendar day (`toISOString().slice(0, 10)` is
 * the banned idiom; see the date-correctness guardrail). Returns `[]` rather than throwing when
 * the rule is incomplete or malformed, and rather than truncating when the run would exceed
 * {@link MAX_MONTHLY_OCCURRENCES}.
 */
export function generateMonthlyOccurrences(rule: MonthlyRecurrenceRule): MonthlyOccurrence[] {
  const { dayOfMonth, startDate, end } = rule ?? ({} as MonthlyRecurrenceRule);
  const start = parseCalendarDate(startDate);
  if (!start) return [];
  if (dayOfMonth !== 'last' && (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31)) return [];

  const rawCount = (end as { count?: unknown } | undefined)?.count;
  const rawUntil = (end as { until?: unknown } | undefined)?.until;
  const count = typeof rawCount === 'number' ? rawCount : null;
  // A blank `until` is an EMPTY form field, not an end date — a coach who typed a date, switched to
  // "after N payments" and left the old input behind must not have their rule refused for it.
  const until = typeof rawUntil === 'string' && rawUntil.trim() !== '' ? rawUntil.trim() : null;
  // EXACTLY one end shape. A rule carrying both says two different things about when the run stops,
  // and silently letting one win is how `until` becomes inert while still showing in the form.
  if (count == null && until == null) return [];
  if (count != null && until != null) return [];
  // The count is checked against the ceiling up front, so a fat-fingered "60 payments" is refused
  // before a single date is stepped.
  if (count != null && (!Number.isInteger(count) || count < 1 || count > MAX_MONTHLY_OCCURRENCES)) return [];
  if (until != null && (parseCalendarDate(until) == null || until < startDate)) return [];

  const out: MonthlyOccurrence[] = [];
  let year = start.y;
  let month = start.m;
  // At most one leading month can be skipped (when the start date falls after this month's day),
  // so the ceiling is reachable inside this many steps; the bound is a backstop, never the exit.
  for (let step = 0; step <= MAX_MONTHLY_OCCURRENCES + 1; step++) {
    const occurrence = resolveDayInMonth(year, month, dayOfMonth);
    if (occurrence.date >= startDate) {
      if (until != null && occurrence.date > until) break;
      out.push(occurrence);
      if (count != null && out.length >= count) break;
      if (out.length > MAX_MONTHLY_OCCURRENCES) return []; // refuse the run; never a silent 24 of 60
    }
    if (month === 12) { year += 1; month = 1; } else { month += 1; }
  }
  // A count run that ran out of steps produced FEWER dates than were asked for. Handing that back
  // is the five-payables-from-a-six-month-rule defect this module exists to prevent, so refuse it
  // instead. Only reachable past the year 9999, where a five-digit year stops sorting as a date.
  if (count != null && out.length < count) return [];
  return out;
}

/** One reviewed occurrence, as the preview edits it and the commit route receives it. */
export interface MonthlyOccurrenceInput {
  /** `YYYY-MM-DD` — must be one the rule itself generates. */
  date: string;
  /** Per-occurrence amount, when the coach has overridden the shared one (§4.1).
   *  The ONLY per-row override there is: §4.6 rules out per-occurrence descriptions, so the
   *  description belongs to the series and is not carried here. */
  amount?: number | null;
}

/** An accepted occurrence: the coach's values, with `clamped` taken from the FRESH generation
 *  rather than the submission, so the per-date result can name a clamped month truthfully. */
export interface AcceptedMonthlyOccurrence {
  date: string;
  clamped: boolean;
  amount: number | null;
}

export interface ReviewedMonthlyRecurrence {
  /** Occurrences that will actually be written, in date order. */
  accepted: AcceptedMonthlyOccurrence[];
  /** Dates the coach removed from the preview (generated, but not submitted) — the month off. */
  removed: string[];
  /** Submitted dates the rule does NOT generate. Non-empty means REFUSE the whole commit. */
  unknown: string[];
  /** What the series would hold once this request is written: the occurrences it already has plus
   *  the accepted ones. This — not the request — is what {@link MAX_MONTHLY_OCCURRENCES} caps. */
  seriesTotal: number;
  /** True when `seriesTotal` breaks the ceiling. **Everything else comes back EMPTY when it is**,
   *  so a route that writes `accepted` without reading this flag writes nothing rather than a
   *  40-row series — it fails closed. Read the flag to tell the coach WHY nothing happened. */
  exceedsCeiling: boolean;
}

/**
 * Reconcile submitted occurrences against a fresh generation of the same rule (plan §3.5).
 *
 * Identical in spirit to `reviewRecurrenceOccurrences`: a submitted date the rule cannot produce
 * is `unknown` and must fail the whole request — never quietly dropped, and never written. A
 * generated date that was not submitted is a deliberate `removed` (the coach deleted that row
 * before committing). A date submitted twice is `unknown` too, rather than billing a family for
 * the same month twice.
 *
 * It is also where the SERIES ceiling is enforced (§3.4/§5.3), because this is the one place every
 * write passes through. `existingInSeries` is the number of occurrences the series already holds —
 * **0 when creating a new one**, and the real count when extending. It is required, and deliberately
 * not defaulted: a route that never had to answer it is a route that silently allows a 26-row
 * series, which is the defect the plan names by name.
 *
 * ⚠ This is for CREATION and EXTENSION only. Editing a series that already exists reconciles
 * against no rule — those rows exist, and the individual row edits the product already allows must
 * keep working.
 */
export function reviewMonthlyOccurrences(
  rule: MonthlyRecurrenceRule,
  submitted: MonthlyOccurrenceInput[],
  existingInSeries: number,
): ReviewedMonthlyRecurrence {
  const generated = new Map(generateMonthlyOccurrences(rule).map(o => [o.date, o.clamped]));
  const accepted: AcceptedMonthlyOccurrence[] = [];
  const unknown: string[] = [];
  const seen = new Set<string>();

  for (const row of submitted ?? []) {
    const date = (row?.date ?? '').trim();
    if (!generated.has(date) || seen.has(date)) { unknown.push(date); continue; }
    seen.add(date);
    // `clamped` is taken from the FRESH generation, never from the submitted row — the server's own
    // arithmetic decides what February was, whatever the client claims about it.
    accepted.push({
      date,
      clamped: generated.get(date)!,
      amount: typeof row.amount === 'number' && Number.isFinite(row.amount) ? row.amount : null,
    });
  }

  accepted.sort((a, b) => a.date.localeCompare(b.date));

  // An unusable existing-count is treated as ALREADY over the ceiling. Refusing a legitimate
  // extension is a message the coach can act on; writing a series twice the length of the one the
  // product allows is not recoverable without hand-deleting money rows.
  const existing = Number.isInteger(existingInSeries) && existingInSeries >= 0
    ? existingInSeries
    : MAX_MONTHLY_OCCURRENCES + 1;
  // The ceiling counts what the series will actually HOLD, so unticking two months to come back
  // under it works exactly as a coach would expect.
  const seriesTotal = existing + accepted.length;
  if (seriesTotal > MAX_MONTHLY_OCCURRENCES) {
    return { accepted: [], removed: [], unknown: [], seriesTotal, exceedsCeiling: true };
  }

  return {
    accepted,
    removed: [...generated.keys()].filter(d => !seen.has(d)).sort(),
    unknown,
    seriesTotal,
    exceedsCeiling: false,
  };
}
