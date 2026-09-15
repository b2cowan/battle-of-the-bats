/**
 * What a metric DEFINITION means — the vocabulary, the guards and the "changing a definition
 * later" rule (development lifecycle Phase 1, plan §7 + §16; owner ruling 3, 2026-09-11).
 *
 * ⚠ Pure module: the Metrics tab, the editor, the session screen, the routes and the reader all
 * read the same words and the same rule from here, so a label or a rule cannot drift between the
 * screen that shows it and the route that enforces it.
 */
import type { MeasurableAim, MeasurableHeadline, MeasurableKind, RepTeamMeasurableType } from './types';
import { sameUnit } from './measurable-series';
import { formatValue } from './measurable-format';

export const MEASURABLE_KINDS: ReadonlyArray<MeasurableKind> = ['test', 'skill'];
export const MEASURABLE_AIMS: ReadonlyArray<MeasurableAim> = ['lower', 'higher', 'range', 'record'];
export const MEASURABLE_HEADLINES: ReadonlyArray<MeasurableHeadline> = ['best', 'average', 'last', 'in_range'];

/**
 * ONE word per value — the editor's options, the Metrics tab, the scope dialog, the help articles.
 * ⚠ "Test" and "Skill", never "Measured test" / "Observed skill" (re-evaluation stage 1, B1,
 * 2026-09-14): the coach met the two kinds under five labels across the product. The adjective's
 * job is done by the sentence beneath the choice ("a number, the same way each time" / "what you
 * saw, never a score"), not by the label. The record words are fixed the same way (B2): a test
 * produces a RESULT, a skill an OBSERVATION, and the numbers inside a result are ATTEMPTS —
 * "reading" is retired. `tests/unit/development-vocabulary-guard.test.ts` holds the line.
 */
export const KIND_LABELS: Readonly<Record<MeasurableKind, string>> = {
  test: 'Test',
  skill: 'Skill',
};
export const AIM_LABELS: Readonly<Record<MeasurableAim, string>> = {
  lower: 'Lower result',
  higher: 'Higher result',
  range: 'Within a stated range',
  record: 'Record only',
};
export const HEADLINE_LABELS: Readonly<Record<MeasurableHeadline, string>> = {
  best: 'Best attempt',
  average: 'Average of attempts',
  last: 'Last attempt',
  in_range: 'Attempts in range',
};

/** A test that can take a reading: kind `test` WITH a unit. A skill is defined, not measured. */
export type MeasuredTestDefinition = RepTeamMeasurableType & { kind: 'test'; unit: string };
export function isMeasuredTest(t: RepTeamMeasurableType): t is MeasuredTestDefinition {
  return t.kind === 'test' && t.unit != null;
}

/** The tests a session or a single reading may record against today: active measured tests. */
export function activeMeasuredTests<T extends RepTeamMeasurableType>(types: T[]): (T & MeasuredTestDefinition)[] {
  return types.filter((t): t is T & MeasuredTestDefinition => t.isActive && isMeasuredTest(t));
}
/**
 * The tests worth a row where results are read back: every active measured test, plus a retired
 * one that still has history here (`hasHistory`) — its readings are records, and hiding them would
 * be F02 again. A skill has no readings until Phase 2 records observations.
 */
export function measuredTestsWithHistory<T extends RepTeamMeasurableType>(types: T[], hasHistory: (id: string) => boolean): (T & MeasuredTestDefinition)[] {
  return types.filter((t): t is T & MeasuredTestDefinition => isMeasuredTest(t) && (t.isActive || hasHistory(t.id)));
}

/**
 * Which headlines an aim admits. A range test has no "best" — faster and slower both miss the
 * band — so it leads with attempts in range (owner ruling); a record-only test claims no direction,
 * so it has no best either. Directional aims get the ruled default, best, first.
 */
export function headlineOptionsFor(aim: MeasurableAim): MeasurableHeadline[] {
  if (aim === 'range') return ['in_range', 'average', 'last'];
  if (aim === 'record') return ['average', 'last'];
  return ['best', 'average', 'last'];
}

/** The ruled default (ruling 6: best, in the aim's direction) — or what stands in for it. */
export function defaultHeadlineFor(aim: MeasurableAim): MeasurableHeadline {
  if (aim === 'range') return 'in_range';
  if (aim === 'record') return 'last';
  return 'best';
}

/** "lower is the aim" · "higher is the aim" · "aim: 62–68 mph" · "record only". */
export function aimSentence(t: Pick<RepTeamMeasurableType, 'aim' | 'unit' | 'rangeFrom' | 'rangeTo'>): string {
  switch (t.aim) {
    case 'lower': return 'lower is the aim';
    case 'higher': return 'higher is the aim';
    case 'range': return `aim: ${formatEdge(t.rangeFrom)}–${formatEdge(t.rangeTo)}${t.unit ? ` ${t.unit}` : ''}`;
    default: return 'record only';
  }
}
const formatEdge = (v: number | null) => (v == null ? '?' : formatValue(v));

/**
 * The Metrics tab's "What a record means" column. The UNIT is not here (stage 1, B3): the row says
 * it once, beside the name — a range aim keeps it inside the band because "62–68" means nothing
 * without it. A test says how its headline is read ("average of attempts") when that is not the
 * aim's own default — the count per session is the SESSION's fact now (stage 2, C1), so "is this
 * a multi-attempt test" is not a question the definition can answer; the exception is what is
 * said. A skill says what it records and how many descriptors it offers.
 *
 * The method is NOT here either (owner, 2026-09-14): it is the coach's optional note on how the
 * test is run, and a row that said "method not recorded" was a to-do wearing a fact's clothes.
 */
export function recordMeaning(t: RepTeamMeasurableType): string {
  if (t.kind === 'skill') {
    const n = t.descriptors.length;
    return n > 0 ? `what you saw · ${n} descriptor${n === 1 ? '' : 's'}` : 'what you saw';
  }
  const parts = [aimSentence(t)];
  if (t.headline !== defaultHeadlineFor(t.aim)) parts.push(HEADLINE_LABELS[t.headline].toLowerCase());
  return parts.join(' · ');
}

/**
 * The example change the editor's preview shows for a directional aim — running the way the aim
 * runs (stage 1, B4: with a HIGHER aim the preview used to read "8.40 → 8.05 · 0.35 higher", a
 * drop labelled a rise). Null for a range or record-only aim, which read back differently.
 */
export function previewChange(aim: MeasurableAim): { from: number; to: number; delta: number; word: 'lower' | 'higher' } | null {
  if (aim === 'lower') return { from: 8.4, to: 8.05, delta: 0.35, word: 'lower' };
  if (aim === 'higher') return { from: 8.05, to: 8.4, delta: 0.35, word: 'higher' };
  return null;
}

/**
 * ═══ CHANGING A DEFINITION LATER (owner ruling 3, 2026-09-11; narrowed 2026-09-14) ═══
 * Rename fixes a typo and keeps the series. Changing the UNIT on a test that already has readings
 * starts a NEW definition and retires this one — every saved result stays under the unit it was
 * recorded with, and km/h and mph are never drawn as one line (F01). That rule is arithmetic.
 *
 * The METHOD no longer forks a series (owner, 2026-09-14: "I get it is recommended to enforce
 * consistency but that is not always available to coaches, but they still want to see how things
 * like sprint speed change over time"). It is the coach's optional note on how the test is run;
 * writing, changing or erasing it is an edit, and the coach owns the judgment of whether the
 * series is still one series. A unit that differs only in spelling or case is the same unit
 * (`sameUnit`). Aim, range, attempts, headline and descriptors are interpretation, not
 * measurement: they never start a successor. Without readings there is nothing to keep honest, so
 * every edit is an edit.
 */
export type DefinitionChange = { kind: 'keep' } | { kind: 'successor' };

export function definitionChange(
  current: Pick<RepTeamMeasurableType, 'kind' | 'unit'>,
  next: { unit?: string | null; [other: string]: unknown },
  hasReadings: boolean,
): DefinitionChange {
  if (!hasReadings || current.kind !== 'test') return { kind: 'keep' };
  if (next.unit !== undefined && next.unit != null && current.unit != null && !sameUnit(current.unit, next.unit)) {
    return { kind: 'successor' };
  }
  return { kind: 'keep' };
}

/** The sentence the editor and the 409 both say when the rule bites. */
export function successorSentence(name: string): string {
  return `Changing the unit of “${name}” starts a new definition and retires this one — its saved results stay under the unit they were recorded with.`;
}
