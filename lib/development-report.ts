/**
 * The report vocabulary of Insights → Development and the handout (development lifecycle Phase 3,
 * plan §8 — the ten chart rules are binding; §16 — the range aim, drawn properly).
 *
 * ⚠ ONE SERIES OBJECT. The progress chart, its answer line, the "Records behind the chart" table and
 * the handout's result lines all read `progressSeries(...)` — the rows come from `groupBySession`
 * (Phase 2's one home for "three sprints are one row"), the unit split from Phase 0's
 * `splitSeriesByUnit` (a changed unit is a BREAK, never an implied conversion), and nothing here
 * computes a second headline. Changing the show or the window changes the chart, the summary and
 * the table together (chart rule 8).
 *
 * ⚠ WORDS, NEVER A VERDICT. "0.35 seconds lower since Aug 4" is arithmetic in the unit. A range test
 * says "moved into the range" or "2 mph above the range" — never faster, slower or better. Two
 * points are a CHANGE, never a trend; one point is one point (no fabricated baseline). Nothing here
 * ranks, scores, projects, or compares a child to the team.
 *
 * Pure module: the panel, the chart component, the handout page, the Players view and the unit
 * tests read it.
 */
import {
  groupBySession, splitSeriesByUnit, drawableSegment, unitSplitNote, attemptAgainstRange, headlineLabel,
  type AttemptReading, type SessionResult, type HeadlineDefinition,
} from './measurable-series';
import { HEADLINE_LABELS, aimSentence } from './measurable-definition';
import { formatValue, formatShortDate } from './measurable-format';
// The selectors' unions live with the ADDRESS (they are what `?report=` / `?show=` / `?compare=` may say).
import type { DevelopmentReport, ProgressShow, CompareWindow } from './development-address.ts';

export type { DevelopmentReport, ProgressShow, CompareWindow };

// ── The three reports and the selectors' labels ───────────────────────────────────────────────────
export const REPORT_LABELS: Readonly<Record<DevelopmentReport, string>> = {
  coverage: 'Coverage',
  progress: 'Player progress',
  practices: 'Practice review',
};
/** The two comparison choices on screen 5. */
export const COMPARE_LABELS: Readonly<Record<CompareWindow, string>> = { season: 'This season', 'last-two': 'Last two records' };

/** The definition a report reads — `RepTeamMeasurableType` narrowed to what the sentences need. */
export interface ReportDefinition extends HeadlineDefinition {
  name: string;
  kind: 'test' | 'skill';
  unit: string | null;
  /** How the test is run, in the coach's words; null = not recorded (legacy). */
  method: string | null;
  attemptsPerSession: number;
}

const round3 = (v: number) => Number(v.toFixed(3));
const isRange = (def: HeadlineDefinition) => def.aim === 'range' && def.rangeFrom != null && def.rangeTo != null;

/**
 * Which attempt the line leads with — `sessionHeadline`'s own resolution of "best": a range or
 * record-only test has no best, so a "best" headline there reads the last attempt.
 */
function effectiveHeadline(def: HeadlineDefinition): 'best' | 'average' | 'last' {
  if (def.headline === 'average') return 'average';
  if (def.headline === 'last' || def.aim === 'record' || def.aim === 'range') return 'last';
  return 'best';
}
const HEADLINE_WORDS: Readonly<Record<'best' | 'average' | 'last', string>> = {
  best: 'best attempt', average: 'average of attempts', last: 'last attempt',
};

/**
 * The Show choices for a test: Best (or Last, when the test leads with it) and Average — the two the
 * mockup draws. A range test offers none: its line is the average, its headline attempts in range.
 * A test that already leads with the average has one choice, so the screen shows no selector.
 */
export function showOptions(def: ReportDefinition): { id: ProgressShow; label: string }[] {
  if (def.kind === 'skill' || isRange(def)) return [];
  const lead = effectiveHeadline(def);
  if (lead === 'average') return [{ id: 'average', label: HEADLINE_LABELS.average }];
  return [{ id: 'headline', label: HEADLINE_LABELS[lead] }, { id: 'average', label: HEADLINE_LABELS.average }];
}

/** "With a reminder — one verbal cue — One cue was enough during partner work." — the one spelling of an observation's words. */
export function observationText(o: { descriptor: string | null; note: string | null }): string {
  return [o.descriptor, o.note].filter(Boolean).join(' — ');
}

// ── The series ────────────────────────────────────────────────────────────────────────────────────
export interface ProgressMark {
  value: number;
  /** In the band, past it, or null for a test with no band. */
  inRange: boolean | null;
}

/** One point on the line: the row behind it (the table lists it, the handout quotes it) and what the line draws for it. */
export interface ProgressPoint<R extends AttemptReading = AttemptReading> {
  row: SessionResult<R>;
  /** What the LINE draws for this session: the headline, the average, or (range test) always the average. */
  value: number;
  /** The figure above the point: "8.05" or "2 of 3 in range". */
  label: string;
  /** Every attempt at its own value — the quiet marks. */
  marks: ProgressMark[];
}

export interface ProgressSeries<R extends AttemptReading = AttemptReading> {
  def: ReportDefinition;
  show: ProgressShow;
  compare: CompareWindow;
  /** The unit the line is drawn in — the CURRENT one, which the latest reading belongs to. */
  unit: string;
  /** The points in the compare window, oldest → newest. */
  points: ProgressPoint<R>[];
  /** Earlier segments under another unit — listed, never drawn (F01). Oldest → newest. */
  earlier: { unit: string; rows: SessionResult<R>[] }[];
  unitNote: string | null;
  band: { from: number; to: number } | null;
  /** What the line follows, in words. */
  lineWord: string;
  /** The latest result on its date, or null with nothing recorded. */
  answer: { value: string; on: string } | null;
  /** The stated change since the first point in the window — words, never a verdict; null for one point. */
  change: string | null;
}

/**
 * The series for ONE player and ONE definition. `readings` is the player's every reading under the
 * definition (any order). The rows are grouped per session through the one home, split at every
 * unit change, and the CURRENT unit's rows become the points — narrowed to the compare window.
 */
export function progressSeries<R extends AttemptReading>(
  readings: R[], def: ReportDefinition, opts: { show: ProgressShow; compare: CompareWindow },
): ProgressSeries<R> {
  const range = isRange(def);
  // A range test's line is always the average (its "headline" is a count, not a value in the unit).
  const show: ProgressShow = range || def.headline === 'average' ? 'average' : opts.show;
  const rows = groupBySession(readings, def); // newest first
  const segments = splitSeriesByUnit(rows);
  const current = drawableSegment(segments);
  const earlier = segments.slice(0, -1).map(s => ({ unit: s.unit, rows: [...s.readings].reverse() }));
  const band = range ? { from: def.rangeFrom!, to: def.rangeTo! } : null;

  const toPoint = (row: SessionResult<R>): ProgressPoint<R> => {
    const value = show === 'average' ? (row.average ?? row.value) : row.value;
    return {
      row,
      value,
      label: range ? `${row.headline ?? 0} of ${row.values.length} in range` : formatValue(value),
      marks: row.values.map(v => ({ value: v, inRange: band ? attemptAgainstRange(v, band.from, band.to).inRange : null })),
    };
  };
  const points = compareWindow(current ? current.readings.map(toPoint) : [], opts.compare);
  const latest = points[points.length - 1] ?? null;
  const first = points[0] ?? null;
  const unit = current?.unit ?? def.unit ?? '';

  return {
    def, show, compare: opts.compare, unit, points, earlier, band,
    unitNote: unitSplitNote(segments),
    lineWord: show === 'average' ? HEADLINE_WORDS.average : HEADLINE_WORDS[effectiveHeadline(def)],
    answer: latest ? { value: headlineLabel(latest.row, def), on: latest.row.recordedOn } : null,
    change: first && latest ? statedChange(first, latest, def, unit) : null,
  };
}

/** The comparison window: the whole season, or the newest two records. */
export function compareWindow<P>(points: P[], window: CompareWindow): P[] {
  return window === 'last-two' && points.length > 2 ? points.slice(-2) : points;
}

/**
 * The change between two points, in words (chart rules 3 and 4; §16 for a range):
 *  · "0.35 seconds lower since Aug 4" — arithmetic in the unit; "higher" / "unchanged" the same way.
 *    Never "faster", "worse" or "better": the scope line states the aim and the coach reads it.
 *  · a range test: "moved into the range since Aug 25 (0 of 3)", "moved out of the range …", or how
 *    far the average sits past the band — "2 mph above the range".
 * Null when the two points are the same point.
 */
export function statedChange(first: ProgressPoint, latest: ProgressPoint, def: ReportDefinition, unit: string): string | null {
  if (first.row.key === latest.row.key) return null;
  const since = formatShortDate(first.row.recordedOn);
  if (isRange(def)) {
    const from = def.rangeFrom!, to = def.rangeTo!;
    // A range test's row headline IS its attempts in range.
    const firstIn = first.row.headline ?? 0, latestIn = latest.row.headline ?? 0;
    const firstOf = `${firstIn} of ${first.row.values.length}`;
    const pastBand = (): string => {
      const avg = latest.row.average ?? latest.value;
      if (avg > to) return `${formatValue(round3(avg - to))} ${unit} above the range`;
      if (avg < from) return `${formatValue(round3(from - avg))} ${unit} below the range`;
      return 'attempts either side of the range, none in it';
    };
    if (latestIn > 0 && firstIn === 0) return `moved into the range since ${since} (${firstOf})`;
    if (latestIn > 0) return `${firstOf} in range on ${since}`;
    if (firstIn > 0) return `moved out of the range since ${since} (${firstOf}) · ${pastBand()}`;
    return pastBand();
  }
  const delta = round3(latest.value - first.value);
  if (delta === 0) return `unchanged since ${since}`;
  return `${formatValue(Math.abs(delta))} ${unit} ${delta < 0 ? 'lower' : 'higher'} since ${since}`;
}

/**
 * The scope line under the answer: how many results and attempts the window holds, and the aim in
 * the Metrics tab's own words. One result adds the reminder that a point is not a change. The
 * METHOD is not claimed here (owner, 2026-09-14): a method change no longer forks the series, so
 * "same method throughout" is not something the product can know.
 */
export function scopeLine(series: ProgressSeries): string {
  const n = series.points.length;
  const attempts = series.points.reduce((sum, p) => sum + p.row.values.length, 0);
  const parts = [`${n} recorded result${n === 1 ? '' : 's'}`];
  if (attempts > n) parts.push(`${attempts} attempts`);
  parts.push(aimSentence(series.def));
  if (isRange(series.def)) parts.push('a range has no “best”');
  if (n === 1) parts.push('a single result is a point, not a change');
  return parts.join(' · ');
}

/** The chart's accessible sentence: a title and a description that enumerates every point (W3C complex-image guidance). */
export function describeSeries(series: ProgressSeries, playerName: string): { title: string; description: string } {
  const { def, unit } = series;
  const range = isRange(def);
  const title = range
    ? `${playerName}’s ${def.name}, attempts against the ${formatValue(def.rangeFrom!)}–${formatValue(def.rangeTo!)} ${unit} aim`
    : `${playerName}’s ${def.name}, ${series.lineWord} per session, in ${unit}`;
  const items = series.points.map(p => {
    const n = p.row.values.length;
    const attempts = `${n} attempt${n === 1 ? '' : 's'}: ${p.marks.map(m => formatValue(m.value)).join(', ')}`;
    return range
      ? `${formatShortDate(p.row.recordedOn)}: ${p.label}, ${attempts} ${unit}, average ${formatValue(p.row.average ?? p.value)}`
      : `${formatShortDate(p.row.recordedOn)}: ${formatValue(p.value)} ${unit} (${attempts})`;
  });
  const tail = `${range ? 'The shaded band is the aim. ' : ''}Dates are spaced by elapsed time. Every attempt follows in a table.`;
  return { title, description: `${items.join('; ')}. ${tail}` };
}

// ── The axes ──────────────────────────────────────────────────────────────────────────────────────
/** A "nice" step for a span: 1, 2 or 5 × 10^k, aiming at about three intervals. */
function niceStep(span: number): number {
  const raw = span / 3;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return step * mag;
}

/**
 * The y scale: narrowed to the values (and the band, for a range test) with clearly labelled ticks
 * (chart rule 5) — deterministic for the same values, so the scale is stable while the same
 * test/window is compared. Never a fill beneath it; the chart draws none.
 */
export function progressAxis(values: number[], band: { from: number; to: number } | null): { min: number; max: number; ticks: number[] } {
  const all = [...values, ...(band ? [band.from, band.to] : [])];
  if (all.length === 0) return { min: 0, max: 1, ticks: [0, 1] };
  let lo = Math.min(...all), hi = Math.max(...all);
  if (hi === lo) {
    const pad = Math.max(1, Math.abs(lo) * 0.1);
    lo -= pad; hi += pad;
  }
  const step = niceStep(hi - lo);
  const min = round3(Math.floor(lo / step - 1e-9) * step);
  const max = round3(Math.ceil(hi / step + 1e-9) * step);
  const ticks: number[] = [];
  for (let t = min; t <= max + 1e-9; t = round3(t + step)) ticks.push(t);
  return { min, max, ticks };
}

/** Actual calendar time on x: each date's fraction of the elapsed span (chart rule 2). One point sits in the middle. */
export function xFractions(dates: string[]): number[] {
  const days = dates.map(d => Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10))) / 86_400_000);
  const first = Math.min(...days), last = Math.max(...days);
  const span = last - first;
  return days.map(d => (span > 0 ? (d - first) / span : 0.5));
}

// ── Coverage (screen 5, F12) ──────────────────────────────────────────────────────────────────────
export interface CoverageCellInput {
  latest: { value: number; unit: string; recordedOn: string; attempts: number; inRange: number | null } | null;
  latestObservation: { descriptor: string | null; note: string | null; observedOn: string } | null;
  /** The date of the latest session that marked this player not assessed on this metric. */
  notAssessedOn: string | null;
}
export type CoverageCellState = 'recorded' | 'not_assessed' | 'none';

/**
 * ONE cell for the selected metric — the Coverage table and the Players view both read it: the
 * latest headline ("8.31 seconds (of 2)", "2 of 3 in range", a skill's descriptor) with THAT
 * metric's own date; "Not assessed" when a session marked it and NO result exists; else an absence
 * of records, stated as one. ⚠ A result always wins over a not-assessed mark, whatever their dates:
 * coverage describes the records that EXIST, and a later session that took no result does not
 * erase one that was taken. Never a judgement, never a number another child's row could be read
 * against.
 */
export function coverageCell(input: CoverageCellInput, def: Pick<ReportDefinition, 'kind' | 'aim'>): { text: string; on: string | null; state: CoverageCellState } {
  if (def.kind === 'skill') {
    const o = input.latestObservation;
    if (o) return { text: o.descriptor ?? o.note ?? 'Observed', on: o.observedOn, state: 'recorded' };
    if (input.notAssessedOn) return { text: 'Not assessed', on: input.notAssessedOn, state: 'not_assessed' };
    return { text: 'No observation recorded for this skill this season', on: null, state: 'none' };
  }
  const l = input.latest;
  if (l) {
    const text = def.aim === 'range' && l.inRange != null
      ? `${l.inRange} of ${l.attempts} in range`
      : `${formatValue(l.value)} ${l.unit}${l.attempts > 1 ? ` (of ${l.attempts})` : ''}`;
    return { text, on: l.recordedOn, state: 'recorded' };
  }
  if (input.notAssessedOn) return { text: 'Not assessed', on: input.notAssessedOn, state: 'not_assessed' };
  return { text: 'No result recorded for this test this season', on: null, state: 'none' };
}

/** "4 of 6 players have a 60-yd sprint result recorded this season." — the explicit denominator (plan §9). */
export function coverageDenominator(recorded: number, total: number, def: Pick<ReportDefinition, 'kind' | 'name'>): string {
  const noun = def.kind === 'skill' ? 'observation' : 'result';
  return `${recorded} of ${total} player${total === 1 ? '' : 's'} ${total === 1 ? 'has' : 'have'} a ${def.name} ${noun} recorded this season.`;
}
export const COVERAGE_DENOMINATOR_NOTE = 'This describes the records that exist. It does not assess the attention a player received.';

// ── The handout (screen 6) — the same rows, in a handout's words ──────────────────────────────────
/** "Sep 8 · best 8.05 of 3 (8.12 · 8.05 · 8.2)" · "Sep 8 · 2 of 3 in range (66 · 70 · 64)" · "Aug 1 · 8.41 seconds". */
export function logLine(row: SessionResult, def: ReportDefinition): string {
  const date = formatShortDate(row.recordedOn);
  const n = row.values.length;
  if (n <= 1) return `${date} · ${headlineLabel(row, def)}`;
  const attempts = row.values.map(formatValue).join(' · ');
  if (isRange(def)) return `${date} · ${row.headline ?? 0} of ${n} in range (${attempts})`;
  return `${date} · ${effectiveHeadline(def)} ${formatValue(row.headline ?? row.value)} of ${n} (${attempts})`;
}

/**
 * The line under a selected result: how the headline was read ("Best of 3 attempts that day (8.12 ·
 * 8.05 · 8.2).") and the method quoted from the definition. Null when there is nothing to say — one
 * attempt and no written method.
 */
export function handoutResultNote(row: SessionResult, def: ReportDefinition): string | null {
  const n = row.values.length;
  const parts: string[] = [];
  if (n > 1) {
    const attempts = row.values.map(formatValue).join(' · ');
    if (isRange(def)) parts.push(`${row.headline ?? 0} of ${n} in range that day (${attempts}).`);
    else {
      const lead = effectiveHeadline(def);
      parts.push(`${lead[0].toUpperCase()}${lead.slice(1)} of ${n} attempts that day (${attempts}).`);
    }
  }
  if (def.method) parts.push(def.method);
  return parts.length > 0 ? parts.join(' ') : null;
}
