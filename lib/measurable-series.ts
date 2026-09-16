/**
 * A player's readings for ONE test, read the same way everywhere they are drawn or listed.
 *
 * ⚠ Every reading carries its OWN unit — the type's unit is snapshotted onto the row at log time —
 * and a test's unit is FIXED once a result exists (owner, 2026-09-15: a new unit is a new test),
 * so every reading under one test shares its unit and a line through them is arithmetic in that
 * unit. No conversion is performed anywhere.
 *
 * Pure module: the profile row, the Insights chart and the handout all read through it.
 */

import { formatValue } from './measurable-format';

export interface SeriesReading {
  value: number;
  unit: string;
  /** YYYY-MM-DD, the coach's stated date. */
  recordedOn: string;
  /** Tie-break for same-day readings — the order they were typed. */
  createdAt: string;
}

/** "seconds", "Seconds " and "SECONDS" are one unit; "s" and "seconds" are not — no guessing. */
export const sameUnit = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Oldest → newest — the order a line is drawn in (`groupBySession` hands rows out newest first). */
export function chronological<R extends SeriesReading>(readings: R[]): R[] {
  return [...readings].sort((a, b) => a.recordedOn.localeCompare(b.recordedOn) || a.createdAt.localeCompare(b.createdAt));
}

// ── The headline (owner ruling 2026-09-11: every attempt is recorded) ─────────────────────────────
/**
 * ⚠ ONE HOME for the computation the session rows, the editor preview, the Results view, the
 * progress chart and the handout all read (Phase 1 builds the preview; Phase 2 the rows; Phase 3
 * the chart and the handout). Best, average and spread are computed from the stored attempts,
 * never stored as facts. Arithmetic in the unit, nothing else: no rating, no "consistency score".
 */
export interface HeadlineDefinition {
  aim: 'lower' | 'higher' | 'range' | 'record';
  headline: 'best' | 'average' | 'last' | 'in_range';
  rangeFrom: number | null;
  rangeTo: number | null;
}

const round3 = (v: number) => Number(v.toFixed(3));
/** Display goes through the one formatter (`formatValue`); `round3` is for the arithmetic only. */
const format = formatValue;

/**
 * THE AVERAGE'S PRECISION — one decimal more than its attempts carry, never more than three
 * (re-evaluation stage 4, owner ruling G3, 2026-09-16). Three whole-number changeups (60 · 70 · 61)
 * read 63.7, not 63.667: nothing on the record is known to a thousandth of a mile an hour. Two
 * hundredths sprints (8.31 · 8.24) still read 8.275. Rounded HERE, where the average is computed,
 * so every reader — the records table, the chart's label and description, the session read-back,
 * the Results row's "avg", the family recap — prints the same figure through `formatValue` without
 * each being taught (chart rule 8: one source).
 */
export function averageOf(values: number[]): number | null {
  if (values.length === 0) return null;
  const decimals = Math.min(3, Math.max(...values.map(v => (format(v).split('.')[1] ?? '').length)) + 1);
  return Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(decimals));
}

/** How one attempt landed against a range test's band: in, or how far past the nearer edge. */
export function attemptAgainstRange(value: number, from: number, to: number): { inRange: boolean; delta: number } {
  if (value < from) return { inRange: false, delta: round3(value - from) };
  if (value > to) return { inRange: false, delta: round3(value - to) };
  return { inRange: true, delta: 0 };
}

/**
 * The headline over one session's attempts (in the order they were taken). `null` when there are
 * none. "Best" follows the aim; asked of a range test (which has no best — faster and slower both
 * miss) it answers attempts in range, and of a record-only test (no direction) the last attempt.
 */
export function sessionHeadline(values: number[], def: HeadlineDefinition): number | null {
  if (values.length === 0) return null;
  const inRange = () => (def.rangeFrom == null || def.rangeTo == null
    ? 0
    : values.filter(v => attemptAgainstRange(v, def.rangeFrom!, def.rangeTo!).inRange).length);
  const last = () => values[values.length - 1];
  switch (def.headline) {
    case 'average': return averageOf(values);
    case 'last': return last();
    case 'in_range': return inRange();
    default:
      if (def.aim === 'range') return inRange();
      if (def.aim === 'lower') return Math.min(...values);
      if (def.aim === 'higher') return Math.max(...values);
      return last();
  }
}

/** "in" · "+2" · "−3" — how one attempt reads against a range test's band. */
export function rangeSign(value: number, from: number, to: number): string {
  const r = attemptAgainstRange(value, from, to);
  return r.inRange ? 'in' : r.delta > 0 ? `+${format(r.delta)}` : `−${format(Math.abs(r.delta))}`;
}

/**
 * The LIVE read-back under a session row's fields — `describeHeadline` with the SESSION's planned
 * count for the test (stage 2, C1 — never the definition's), so a row that has fewer attempts than
 * tonight's plan says so ("· 1 of 3 run") and a single attempt of several shows its value (with its
 * range sign) rather than "One attempt". `expected` is null on a session from before the count
 * existed: it claims only what was recorded, so the line never says "of N run".
 */
export function describeAttempts(values: number[], def: HeadlineDefinition, expected: number | null): string {
  // One attempt reads as its value (the box beside it already holds it — "One attempt" would say nothing).
  if (values.length === 1) return `${describeSingle(values[0], def)}${expected !== null && expected > 1 ? ` · 1 of ${expected} run` : ''}`;
  const line = describeHeadline(values, def);
  return expected !== null && values.length > 0 && values.length < expected ? `${line} · ${values.length} of ${expected} run` : line;
}
/** One attempt on its own: the value (with its range sign) — a saved 8.5 reads "8.5", never "One attempt". */
function describeSingle(v: number, def: HeadlineDefinition): string {
  const sign = def.aim === 'range' && def.rangeFrom != null && def.rangeTo != null ? ` (${rangeSign(v, def.rangeFrom, def.rangeTo)})` : '';
  return `${format(v)}${sign}`;
}

/**
 * Which attempt the line leads with — the ONE resolution of "best" (`sessionHeadline`'s own): a
 * range or record-only test has no best, so a "best" headline there reads the last attempt. The
 * read-back, the method beside a headline, the report's line word and the player's attempts cell
 * all say the lead word through this.
 */
export function headlineLead(def: HeadlineDefinition): 'best' | 'average' | 'last' {
  if (def.headline === 'average') return 'average';
  if (def.headline === 'last' || def.aim === 'record' || def.aim === 'range') return 'last';
  return 'best';
}

/**
 * The read-back line — "Best of 3 attempts · 8.12 · 8.05 · 8.2 · average 8.123", or for a range
 * test "1 of 3 in range · 61 (−1) · 64 (in) · 70 (+2)". One attempt says so and nothing more.
 */
export function describeHeadline(values: number[], def: HeadlineDefinition): string {
  if (values.length === 0) return 'No attempts';
  if (values.length === 1) return 'One attempt';
  const n = values.length;
  if (def.aim === 'range' || def.headline === 'in_range') {
    if (def.rangeFrom == null || def.rangeTo == null) return `${n} attempts · set From and To to read them against the range`;
  }
  if (def.aim === 'range' && def.rangeFrom != null && def.rangeTo != null) {
    const marks = values.map(v => `${format(v)} (${rangeSign(v, def.rangeFrom!, def.rangeTo!)})`);
    const inBand = sessionHeadline(values, { ...def, headline: 'in_range' });
    return `${inBand} of ${n} in range · ${marks.join(' · ')}`;
  }
  const lead = headlineLead(def);
  const avg = format(sessionHeadline(values, { ...def, headline: 'average' }) ?? 0);
  return `${lead[0].toUpperCase()}${lead.slice(1)} of ${n} attempts · ${values.map(format).join(' · ')} · average ${avg}`;
}

// ── Rows per session (Phase 2: every attempt is recorded; rows are never people) ──────────────────
/**
 * A reading as the record holds it (`RepPlayerMeasurable` narrowed to what the series needs): its
 * session — null for a single reading — and its attempt within it.
 */
export interface AttemptReading extends SeriesReading {
  id: string;
  sessionId: string | null;
  attemptNo: number;
}

/**
 * ONE session's (or one single reading's) result: every attempt in attempt order, the headline the
 * definition asks for, the average, and the read-back line. Satisfies `SeriesReading` with
 * `value` = what the LINE draws — the headline, except for a range test, whose "headline" is a
 * count of attempts in the band (not a number in the unit), so the line follows its average
 * (plan §8 rule 10: the chart dashes the average and shades the band).
 */
export interface SessionResult<R extends AttemptReading = AttemptReading> extends SeriesReading {
  /** `session:<id>` or `single:<YYYY-MM-DD>` — stable for React keys within one test's rows. */
  key: string;
  sessionId: string | null;
  attempts: R[];
  values: number[];
  headline: number | null;
  average: number | null;
  /** `describeHeadline` for these attempts. */
  readBack: string;
}

/**
 * Group a player's readings for ONE test into rows: one per session (all its attempts, in attempt
 * order) and one per DAY outside a session. NEWEST FIRST — by the date the readings were taken,
 * then by entry order. ⚠ This is the ONE home: the Results view, the Players view's latest, the
 * session screen's read-back, the PDF's rows and (Phase 3) the chart all read rows from here. Three
 * sprints are one row here, so they are one row everywhere.
 *
 * ⚠ A RESULT IS THE SAME THING THROUGH BOTH DOORS (re-evaluation stage 3, owner ruling E7,
 * 2026-09-15). The bench-side sheet records up to five attempts on a date with no session, and the
 * reader groups them by that date — one result, one headline, one point on the line — exactly as a
 * session's attempts are one. Until then every session-less attempt was keyed on its own id, so
 * three sprints timed from the bench on one morning were three results and three points where the
 * same three in a session were one. Two bench-side results on DIFFERENT days stay two.
 */
export function groupBySession<R extends AttemptReading>(readings: R[], def: HeadlineDefinition): SessionResult<R>[] {
  const groups = new Map<string, R[]>();
  for (const r of readings) {
    const key = r.sessionId ? `session:${r.sessionId}` : `single:${r.recordedOn}`;
    const list = groups.get(key) ?? [];
    list.push(r);
    groups.set(key, list);
  }
  const rows: SessionResult<R>[] = [];
  for (const [key, list] of groups) {
    const attempts = [...list].sort((a, b) => a.attemptNo - b.attemptNo || a.createdAt.localeCompare(b.createdAt));
    const values = attempts.map(a => a.value);
    const headline = sessionHeadline(values, def);
    const average = sessionHeadline(values, { ...def, headline: 'average' });
    const first = attempts[0];
    const lineValue = def.aim === 'range' ? average : headline;
    rows.push({
      key, sessionId: first.sessionId, attempts, values, headline, average,
      readBack: describeHeadline(values, def),
      value: lineValue ?? first.value,
      unit: first.unit,
      recordedOn: first.recordedOn,
      // The newest attempt's entry time, so same-day rows order by when they were entered.
      createdAt: attempts[attempts.length - 1].createdAt,
    });
  }
  return rows.sort((a, b) => b.recordedOn.localeCompare(a.recordedOn) || b.createdAt.localeCompare(a.createdAt));
}

/** The latest row — the HEADLINE of the latest session, never the last reading typed. */
export function latestSessionResult<R extends AttemptReading>(rows: SessionResult<R>[]): SessionResult<R> | null {
  return rows[0] ?? null;
}

/** "8.05 seconds" · "2 of 3 in range" — the one figure a row or a cell leads with. */
export function headlineLabel(row: SessionResult, def: HeadlineDefinition): string {
  if (row.headline == null) return '—';
  if (def.aim === 'range' || def.headline === 'in_range') return `${row.headline} of ${row.values.length} in range`;
  return `${formatValue(row.headline)} ${row.unit}`;
}

/**
 * The HOW beside a session's headline — "best of 3 attempts · avg 7.553" — or null when there is
 * nothing to add: one attempt, or a range test, whose headline ("2 of 3 in range") already says
 * how it was read. Kept apart from the label so no screen glues the two halves together twice.
 */
export function headlineMethod(row: SessionResult, def: HeadlineDefinition): string | null {
  if (row.headline == null || row.values.length < 2) return null;
  if (def.aim === 'range' || def.headline === 'in_range') return null;
  const avg = row.average != null && def.headline !== 'average' ? ` · avg ${formatValue(row.average)}` : '';
  return `${headlineLead(def)} of ${row.values.length} attempts${avg}`;
}

// ── A bench-side result's EDIT, planned before a byte moves (re-evaluation stage 3, E7) ──────────
/**
 * What saving the result sheet has to do, decided in one place and tested there: the boxes as the
 * coach left them (box i = the i-th saved attempt IN THE ORDER THE RESULT LISTS THEM; null = a box
 * left or made blank) against the attempts the record holds — a changed value is a CORRECTION (the
 * original kept), a cleared box removes that attempt, a box beyond the saved ones adds one; the note
 * rides the FIRST SURVIVING attempt — sent when it changed, and MOVED when the row that held it is
 * cleared (a coach who clears box 1 and leaves the note alone keeps the note). The caller then
 * executes the plan ONE STEP AT A TIME, so a failure part-way leaves a smaller result the next read
 * shows honestly, never a broken one.
 *
 * ⚠ BY POSITION, NEVER BY ATTEMPT NUMBER (/review 2026-09-15). Every session-less row written before
 * stage 3 is attempt 1, so a day that holds two of them has two rows with one number — keyed on the
 * number, the sheet showed one box and the other row could never be edited or removed. The number
 * is the reader's ORDER; the sheet's boxes are the rows. A new box asks for the next number after
 * the saved ones (the route hands out the next free one when a day already holds it).
 */
export interface ResultEditPlan {
  /** The note rides the first surviving attempt — one post or one patch carries it; the rest carry none. */
  post: { attemptNo: number; value: number; note: string | null }[];
  patch: { id: string; value: number; note?: string | null }[];
  remove: { id: string }[];
}
export function planResultEdit<R extends AttemptReading & { note: string | null }>(
  saved: R[],
  attempts: (number | null)[],
  note: string | null,
): ResultEditPlan {
  const plan: ResultEditPlan = { post: [], patch: [], remove: [] };
  let nextNo = saved.reduce((m, a) => Math.max(m, a.attemptNo), 0);
  // The note's home: the first box that still holds a value — a saved row (patched with the note
  // when its own differs) or a new one (posted with it). Nothing survives = nothing carries it.
  let carrier: { kind: 'saved'; row: R } | { kind: 'new'; index: number } | null = null;
  for (let i = 0; i < Math.max(attempts.length, saved.length); i += 1) {
    const value = attempts[i] ?? null;
    const s = saved[i];
    if (value === null) { if (s) plan.remove.push({ id: s.id }); continue; }
    if (!s) {
      nextNo += 1;
      plan.post.push({ attemptNo: nextNo, value, note: null });
      if (!carrier) carrier = { kind: 'new', index: plan.post.length - 1 };
      continue;
    }
    if (!carrier) carrier = { kind: 'saved', row: s };
    if (value !== s.value) plan.patch.push({ id: s.id, value });
  }
  const wanted = note || null;
  if (carrier?.kind === 'new') plan.post[carrier.index].note = wanted;
  else if (carrier?.kind === 'saved' && (carrier.row.note || null) !== wanted) {
    const row = carrier.row;
    const patch = plan.patch.find(p => p.id === row.id);
    if (patch) patch.note = wanted;
    else plan.patch.push({ id: row.id, value: row.value, note: wanted });
  }
  return plan;
}
