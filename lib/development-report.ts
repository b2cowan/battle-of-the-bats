/**
 * The report vocabulary of Insights → Development and the handout (development lifecycle Phase 3,
 * plan §8 — the ten chart rules are binding; §16 — the range aim, drawn properly).
 *
 * ⚠ ONE SERIES OBJECT. The progress chart, its answer line, the "Records behind the chart" table and
 * the handout's result lines all read `progressSeries(...)` — the rows come from `groupBySession`
 * (Phase 2's one home for "three sprints are one row"), in the test's one unit (fixed once a
 * result exists — a new unit is a new test), and nothing here computes a second headline.
 * Changing the show or the window changes the chart, the summary and the table together (chart
 * rule 8).
 *
 * ⚠ WORDS, NEVER A VERDICT. "0.35 seconds lower since Aug 4" is arithmetic in the unit. A range test
 * says "moved into the range" or "2 mph above the range" — never faster, slower or better. Two
 * points are a CHANGE, never a trend; one point is one point (no fabricated baseline). Nothing here
 * ranks, scores, projects, or compares a child to the team.
 *
 * Pure module: the panel, the chart component, the handout page, the family recap's assembler and
 * the unit tests read it.
 */
import {
  groupBySession, chronological, attemptAgainstRange, headlineLabel, headlineLead,
  type AttemptReading, type SessionResult, type HeadlineDefinition,
} from './measurable-series';
import { HEADLINE_LABELS, aimSentence } from './measurable-definition';
import { formatValue, formatShortDate } from './measurable-format';
// The selectors' unions live with the ADDRESS (they are what `?report=` / `?show=` / `?compare=` may say).
import { DEVELOPMENT_REPORTS, type DevelopmentReport, type ProgressShow, type CompareWindow } from './development-address.ts';

export type { DevelopmentReport, ProgressShow, CompareWindow };

// ── The three reports and the selectors' labels ───────────────────────────────────────────────────
export const REPORT_LABELS: Readonly<Record<DevelopmentReport, string>> = {
  coverage: 'Coverage',
  team: 'Team progress',
  progress: 'Player progress',
  practices: 'Practice review',
};
/** The two comparison choices on screen 5. */
export const COMPARE_LABELS: Readonly<Record<CompareWindow, string>> = { season: 'This season', 'last-two': 'Last two records' };
/**
 * The reports a coach is offered — Practice review only with the schedule grant (its rows are
 * practice content). ONE rule: the panel's Report selector and the Overview's rail count read it,
 * so the rail never says "3 reports" to a coach who can open two (stage 4 housekeeping).
 */
export function developmentReports(withPractices: boolean): DevelopmentReport[] {
  return DEVELOPMENT_REPORTS.filter(r => r !== 'practices' || withPractices);
}

/** The definition a report reads — `RepTeamMeasurableType` narrowed to what the sentences need. */
export interface ReportDefinition extends HeadlineDefinition {
  name: string;
  kind: 'test' | 'skill';
  unit: string | null;
  /** How the test is run, in the coach's words; null = not recorded (legacy). */
  method: string | null;
}

const round3 = (v: number) => Number(v.toFixed(3));
const isRange = (def: HeadlineDefinition) => def.aim === 'range' && def.rangeFrom != null && def.rangeTo != null;

/** Which attempt the line leads with — the one resolution, `headlineLead` (the series module's). */
const effectiveHeadline = headlineLead;
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
  /** The unit the line is drawn in — the test's. */
  unit: string;
  /** The points in the compare window, oldest → newest. */
  points: ProgressPoint<R>[];
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
 * definition (any order). The rows are grouped per session through the one home and become the
 * points, oldest → newest — narrowed to the compare window.
 */
export function progressSeries<R extends AttemptReading>(
  readings: R[], def: ReportDefinition, opts: { show: ProgressShow; compare: CompareWindow },
): ProgressSeries<R> {
  const range = isRange(def);
  // A range test's line is always the average (its "headline" is a count, not a value in the unit).
  const show: ProgressShow = range || def.headline === 'average' ? 'average' : opts.show;
  const rows = chronological(groupBySession(readings, def));
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
  const points = compareWindow(rows.map(toPoint), opts.compare);
  const latest = points[points.length - 1] ?? null;
  const first = points[0] ?? null;
  // The test's unit — fixed once a result exists, so the definition says it; a legacy row from
  // before that rule could differ, and then the LATEST result's unit is the one new results share.
  const unit = def.unit ?? rows[rows.length - 1]?.unit ?? '';

  return {
    def, show, compare: opts.compare, unit, points, band,
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
  const direction = changeDirection(first, latest, def);
  if (!direction) return null;
  const since = formatShortDate(first.row.recordedOn);
  if (isRange(def)) {
    const from = def.rangeFrom!, to = def.rangeTo!;
    // A range test's row headline IS its attempts in range.
    const firstOf = `${first.row.headline ?? 0} of ${first.row.values.length}`;
    const pastBand = (): string => {
      const avg = latest.row.average ?? latest.value;
      if (avg > to) return `${formatValue(round3(avg - to))} ${unit} above the range`;
      if (avg < from) return `${formatValue(round3(from - avg))} ${unit} below the range`;
      return 'attempts either side of the range, none in it';
    };
    switch (direction) {
      case 'into': return `moved into the range since ${since} (${firstOf})`;
      case 'in_both': return `${firstOf} in range on ${since}`;
      case 'out': return `moved out of the range since ${since} (${firstOf}) · ${pastBand()}`;
      default: return pastBand();
    }
  }
  if (direction === 'unchanged') return `unchanged since ${since}`;
  return `${formatValue(round3(Math.abs(latest.value - first.value)))} ${unit} ${direction} since ${since}`;
}

/**
 * The DIRECTION of a change between two points — the one reading `statedChange` writes its sentence
 * from and the Team progress fold counts (owner ruling T3, 2026-09-16): a test reads lower / higher /
 * unchanged in its unit (the aim is stated beside it, never a verdict); a range test reads whether the
 * attempts moved into or out of the band, sat in it on both dates, or outside it on both. Null when
 * the two points are the same point.
 */
export type ChangeDirection = 'lower' | 'higher' | 'unchanged' | 'into' | 'out' | 'in_both' | 'outside_both';
export function changeDirection(first: ProgressPoint, latest: ProgressPoint, def: ReportDefinition): ChangeDirection | null {
  if (first.row.key === latest.row.key) return null;
  if (isRange(def)) {
    const firstIn = first.row.headline ?? 0, latestIn = latest.row.headline ?? 0;
    if (latestIn > 0 && firstIn === 0) return 'into';
    if (latestIn > 0) return 'in_both';
    if (firstIn > 0) return 'out';
    return 'outside_both';
  }
  const delta = round3(latest.value - first.value);
  return delta === 0 ? 'unchanged' : delta < 0 ? 'lower' : 'higher';
}

// ── Team progress — counts of motion per METRIC, naming nobody (owner rulings T1–T8, 2026-09-16) ──
/**
 * ⚠ THE WIRE IS THE NO-RANKING GUARANTEE. The board route computes these counts in the walk it
 * already makes and sends COUNTS; a per-player "first" never reaches the browser, so no screen can
 * grow a column of changes beside names (a ranking by eye — plan §5). Rows on the report are
 * metrics, never players.
 *
 * ⚠ ONE READER BEHIND EVERY NUMBER (§185's guardrail). `lower` is literally the number of players
 * whose Player-progress answer line, on "This season", says "… lower since …": each player's readings
 * go through the same `progressSeries` the chart draws from, and the count is a fold over
 * `changeDirection` on its first and last points. The two screens cannot disagree.
 */
export interface TeamMetricCounts {
  /** Players with at least one result on the metric (a test) or one observation (a skill). */
  withResult: number;
  /** Players with NO result whom a session marked not assessed on it — a result always wins (the Coverage cell's rule). */
  notAssessed: number;
  /** Players with two or more results — the only ones a change can be read for. Always 0 for a skill. */
  withTwo: number;
  /** How many of those moved each way, keyed by `changeDirection`'s own word — a key is present only when its count is. A skill has none. */
  byDirection: Partial<Record<ChangeDirection, number>>;
  /** The latest date ANY player has a result (or an observation) on the metric; null with none. */
  lastRecordedOn: string | null;
}

const emptyCounts = (): TeamMetricCounts => ({ withResult: 0, notAssessed: 0, withTwo: 0, byDirection: {}, lastRecordedOn: null });

/**
 * The fold for ONE test: `perPlayer` holds each active player's readings under the definition (any
 * order; an empty array for a player with none) and `notAssessed` how many of the players with NO
 * result a session marked not assessed. The season window, first to latest, per player.
 */
export function teamMetricCounts<R extends AttemptReading>(perPlayer: R[][], def: ReportDefinition, notAssessed: number): TeamMetricCounts {
  const c = emptyCounts();
  c.notAssessed = notAssessed;
  for (const readings of perPlayer) {
    const s = progressSeries(readings, def, { show: 'headline', compare: 'season' });
    const first = s.points[0], latest = s.points[s.points.length - 1];
    if (!first || !latest) continue;
    c.withResult += 1;
    if (!c.lastRecordedOn || latest.row.recordedOn > c.lastRecordedOn) c.lastRecordedOn = latest.row.recordedOn;
    if (s.points.length < 2) continue;
    c.withTwo += 1;
    const dir = changeDirection(first, latest, def);
    if (dir) c.byDirection[dir] = (c.byDirection[dir] ?? 0) + 1;
  }
  return c;
}

/**
 * The fold for ONE skill: each player's latest observation date, or null — coverage only (T6): no
 * count per descriptor. `notAssessed` counts the players with NO observation whom a session marked
 * not assessed on the skill, exactly as a test row does (the Coverage cell reads a skill that way too).
 */
export function teamSkillCounts(perPlayerLatest: (string | null)[], notAssessed = 0): TeamMetricCounts {
  const c = emptyCounts();
  c.notAssessed = notAssessed;
  for (const on of perPlayerLatest) {
    if (!on) continue;
    c.withResult += 1;
    if (!c.lastRecordedOn || on > c.lastRecordedOn) c.lastRecordedOn = on;
  }
  return c;
}

/** Each direction's word on the Team progress row — `statedChange`'s own vocabulary, said once. */
const DIRECTION_WORDS: Readonly<Record<ChangeDirection, string>> = {
  lower: 'lower', higher: 'higher', unchanged: 'unchanged',
  into: 'moved into the range', out: 'moved out of the range', in_both: 'in the range on both', outside_both: 'outside the range on both',
};
/** The order the cell reads them in — a test's three, or a range test's four. */
const TEST_DIRECTIONS: ReadonlyArray<ChangeDirection> = ['lower', 'higher', 'unchanged'];
const RANGE_DIRECTIONS: ReadonlyArray<ChangeDirection> = ['into', 'out', 'in_both', 'outside_both'];

/**
 * The "Since their first result" cell — its own denominator first, then the direction counts in the
 * aim's own words, zero counts omitted: "3 compared · 2 lower · 1 higher" · "1 compared · 1 moved
 * into the range". "Compared" is the players with two or more results, each against their own first
 * (owner ruling A, 2026-09-17: the separate "Two or more" column read as a bare number nobody could
 * connect to the cell beside it). Null when nobody has two results (the cell shows the dash and the
 * legend says why). Never a percentage, a mean, or a verdict.
 */
export function teamChangeSummary(c: TeamMetricCounts, def: Pick<ReportDefinition, 'aim' | 'headline' | 'rangeFrom' | 'rangeTo'>): string | null {
  // A skill's fold never counts two (`teamSkillCounts`), so this one guard covers both kinds.
  if (c.withTwo === 0) return null;
  const said = (isRange(def) ? RANGE_DIRECTIONS : TEST_DIRECTIONS)
    .filter(d => (c.byDirection[d] ?? 0) > 0)
    .map(d => `${c.byDirection[d]} ${DIRECTION_WORDS[d]}`);
  return [`${c.withTwo} compared`, ...said].join(' · ');
}

/** "4 of 12" for a test · "3 of 12 observed" for a skill · null with nothing recorded (the dash). */
export function teamPlayersCell(c: TeamMetricCounts, total: number, def: Pick<ReportDefinition, 'kind'>): string | null {
  if (c.withResult === 0 && c.notAssessed === 0) return null;
  return def.kind === 'skill' ? `${c.withResult} of ${total} observed` : `${c.withResult} of ${total}`;
}

/**
 * The count line first (Coverage's rule): the whole-roster denominator said once — the same
 * active-roster rows every development count reads. The numerator is the OVERVIEW's "players
 * measured" rule — a result OR an observation (`/review`, 2026-09-16: a player whose only record
 * is an observation counted on one screen and not the other) — and the sentence says both words.
 */
export function teamCountLine(withAny: number, total: number): string {
  return `${playersHave(withAny, total)} at least one result or observation this season`;
}
export const TEAM_COUNT_NOTE = 'counts per metric, never a ranking';
/** The one legend under the table — the dash's meaning (one spelling, `COVERAGE_DASH`), the cell's rule, and the sentence Player progress already prints, said once for the whole table. */
export function teamLegend(): string {
  return `${COVERAGE_DASH} nothing recorded this season · Compared: the players with two or more results this season, each against their own first, in the test’s unit · a single result is a point, not a change`;
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
    : `${playerName}’s ${def.name}, ${series.lineWord} per result, in ${unit}`;
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
}
export type CoverageCellState = 'recorded' | 'none';

/** The one dash — an absence on the Coverage table, whatever the reason: nobody reads it as anything but "no data" (owner, 2026-09-17). */
export const COVERAGE_DASH = '—';

/**
 * ONE cell for the selected metric on the Coverage table (the one roster table since re-evaluation
 * stage 4, G1 — the Skills & Goals Players tab that drew the same cell is gone): the latest headline
 * ("8.31 seconds (of 2)", "2 of 3 in range", a skill's descriptor) with THAT metric's own date; else a
 * DASH — including when a session marked the player not-assessed, because the table answers "is there
 * a result", never "why isn't there one" (owner, 2026-09-17: whether the player was there is noise).
 * ⚠ A result always wins over a not-assessed mark, whatever their dates: coverage describes the
 * records that EXIST, and a later session that took no result does not erase one that was taken.
 * Never a judgement, never a number another child's row could be read against.
 */
export function coverageCell(input: CoverageCellInput, def: Pick<ReportDefinition, 'kind' | 'aim'>): { text: string; on: string | null; state: CoverageCellState } {
  if (def.kind === 'skill') {
    const o = input.latestObservation;
    if (o) return { text: o.descriptor ?? o.note ?? 'Observed', on: o.observedOn, state: 'recorded' };
    return { text: COVERAGE_DASH, on: null, state: 'none' };
  }
  const l = input.latest;
  if (l) {
    const text = def.aim === 'range' && l.inRange != null
      ? `${l.inRange} of ${l.attempts} in range`
      : `${formatValue(l.value)} ${l.unit}${l.attempts > 1 ? ` (of ${l.attempts})` : ''}`;
    return { text, on: l.recordedOn, state: 'recorded' };
  }
  return { text: COVERAGE_DASH, on: null, state: 'none' };
}

/**
 * The count line — the first thing under the toolbar, and the one place the binding coverage
 * wording is said (G1): "4 of 12 players have a 60-yd sprint result this season · roster order, not
 * a ranking". Current focus: "1 of 12 players has a goal being worked on"; a skill: "… a Sets feet
 * before throwing observation this season". The explicit denominator (plan §9) in one sentence; the
 * description, the disclaimer and the heading it used to sit under live in the help.
 */
export function coverageDenominator(recorded: number, total: number, def: Pick<ReportDefinition, 'kind' | 'name'> | 'focus'): string {
  const players = playersHave(recorded, total);
  if (def === 'focus') return `${players} a goal being worked on`;
  return `${players} a ${def.name} ${def.kind === 'skill' ? 'observation' : 'result'} this season`;
}
/** "4 of 12 players have" · "1 of 12 players has" — the one spelling of the count line's opening, on Coverage and Team progress alike. */
function playersHave(n: number, total: number): string {
  return `${n} of ${total} player${total === 1 ? '' : 's'} ${n === 1 ? 'has' : 'have'}`;
}
export const COVERAGE_ORDER_NOTE = 'roster order, not a ranking';

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
 * THE PRINTING RULE for the handout's "We'll look at this together again on …" line (re-evaluation
 * stage 4, owner ruling G5, 2026-09-16): a review date prints only while it is still ahead — today
 * or later, by the COACH's local day. A goal reviewed in June still carries June on the record, and
 * a paper prepared in September must not read it as a promise; with nothing typed and no date
 * ahead, the paper's and the PDF's Next step section is absent altogether (both read the one model).
 */
export function handoutNextReview(reviewOn: string | null | undefined, today: string): string | null {
  return reviewOn && reviewOn >= today ? reviewOn : null;
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
