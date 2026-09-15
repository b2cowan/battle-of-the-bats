/**
 * A player's readings for ONE test, made honest before anything draws them (development lifecycle
 * Phase 0, F01).
 *
 * ⚠ Every reading carries its OWN unit — the type's unit is snapshotted onto the row at log time,
 * so a later unit edit on the test never rewrites history. The trend line used to ignore that and
 * plot the numbers alone: change "Throw speed" from mph to km/h and 50 → 80 became one rising
 * line. No conversion is performed anywhere (none would be honest — the method may have changed
 * with the unit), so the only truthful drawing is a series that BREAKS wherever the unit changes.
 *
 * Pure module: the profile row, the Insights chart (Phase 3) and the handout all read through it.
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

export interface UnitSegment<R extends SeriesReading = SeriesReading> {
  /** The unit as the coach wrote it on the first reading of the segment. */
  unit: string;
  /** Oldest → newest. */
  readings: R[];
}

/** "seconds", "Seconds " and "SECONDS" are one unit; "s" and "seconds" are not — no guessing. */
export const sameUnit = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Oldest → newest, split at EVERY change of unit — not grouped by unit. A test that went mph →
 * km/h → mph has three segments: joining the two mph runs across the km/h gap would draw a line
 * through readings that were never comparable with what sits between them.
 */
export function splitSeriesByUnit<R extends SeriesReading>(readings: R[]): UnitSegment<R>[] {
  const chrono = [...readings].sort((a, b) =>
    a.recordedOn.localeCompare(b.recordedOn) || a.createdAt.localeCompare(b.createdAt));
  const segments: UnitSegment<R>[] = [];
  for (const r of chrono) {
    const last = segments[segments.length - 1];
    if (last && sameUnit(last.unit, r.unit)) last.readings.push(r);
    else segments.push({ unit: r.unit, readings: [r] });
  }
  return segments;
}

/** The segment a line may be drawn from: the CURRENT one, which the latest reading belongs to. */
export function drawableSegment<R extends SeriesReading>(segments: UnitSegment<R>[]): UnitSegment<R> | null {
  return segments.length > 0 ? segments[segments.length - 1] : null;
}

/**
 * The sentence beneath a row whose earlier readings are not drawn. Null when there is nothing to
 * say. Names the count and the unit(s) so the coach knows what the list holds that the line does
 * not — "listed, not drawn" is the whole promise.
 */
export function unitSplitNote(segments: UnitSegment[]): string | null {
  if (segments.length < 2) return null;
  const earlier = segments.slice(0, -1);
  const count = earlier.reduce((n, s) => n + s.readings.length, 0);
  const units = [...new Set(earlier.map(s => s.unit.trim()))];
  const inUnits = `in ${units.length <= 1 ? units[0] : `${units.slice(0, -1).join(', ')} and ${units.at(-1)}`}`;
  return `Units changed — ${count} earlier result${count === 1 ? '' : 's'} ${inUnits} ${count === 1 ? 'is' : 'are'} listed but not drawn on this line.`;
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
    case 'average': return round3(values.reduce((a, b) => a + b, 0) / values.length);
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
  const lead = def.headline === 'average' ? 'Average of' : def.headline === 'last' ? 'Last of' : 'Best of';
  const avg = format(sessionHeadline(values, { ...def, headline: 'average' }) ?? 0);
  return `${lead} ${n} attempts · ${values.map(format).join(' · ')} · average ${avg}`;
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
  /** `session:<id>` or `single:<reading id>` — stable for React keys and evidence links. */
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
 * order) and one per single reading. NEWEST FIRST — by the date the readings were taken, then by
 * entry order. ⚠ This is the ONE home: the Results view, the Players view's latest, the session
 * screen's read-back, the PDF's rows and (Phase 3) the chart all read rows from here. Three sprints
 * are one row here, so they are one row everywhere.
 */
export function groupBySession<R extends AttemptReading>(readings: R[], def: HeadlineDefinition): SessionResult<R>[] {
  const groups = new Map<string, R[]>();
  for (const r of readings) {
    const key = r.sessionId ? `session:${r.sessionId}` : `single:${r.id}`;
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
  const lead = def.headline === 'average' ? 'average of' : def.headline === 'last' ? 'last of' : 'best of';
  const avg = row.average != null && def.headline !== 'average' ? ` · avg ${formatValue(row.average)}` : '';
  return `${lead} ${row.values.length} attempts${avg}`;
}
