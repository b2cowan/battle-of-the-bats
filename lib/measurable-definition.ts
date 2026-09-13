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

/** ONE word per value — the editor's options, the Metrics tab's Kind column, the help articles. */
export const KIND_LABELS: Readonly<Record<MeasurableKind, string>> = {
  test: 'Measured test',
  skill: 'Observed skill',
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
 * The Metrics tab's "What a record means" column — the one line that lets a coach tell a defined
 * test from a legacy one at a glance. A legacy test says its method was not recorded, because it
 * was not, and the product never guesses one.
 */
export function recordMeaning(t: RepTeamMeasurableType): string {
  if (t.kind === 'skill') {
    const n = t.descriptors.length;
    return n > 0 ? `What you saw, in a stated setting · ${n} descriptor${n === 1 ? '' : 's'}` : 'What you saw, in a stated setting';
  }
  const parts = [t.unit ?? '', aimSentence(t)];
  if (!t.method) parts.push('method not recorded');
  return parts.filter(Boolean).join(' · ');
}

/**
 * ═══ CHANGING A DEFINITION LATER (owner ruling 3, 2026-09-11) ═══
 * Rename fixes a typo and keeps the series. Changing the UNIT or a WRITTEN method on a test that
 * already has readings starts a NEW definition and retires this one — every saved result stays
 * under the name and unit it was recorded with, and the two are never drawn as one line (F01).
 *
 * Two deliberate softenings, both in the coach's favour:
 *   · a unit that differs only in spelling or case is the same unit (`sameUnit`);
 *   · writing a method where NONE was recorded is not a change of method — the readings' method
 *     was "not recorded", and the coach is now recording it. Only changing a written one forks —
 *     and ERASING a written one is a change too (the readings were taken under it; a definition
 *     that then read "method not recorded" would be lying about them).
 * Aim, range, attempts, headline and descriptors are interpretation, not measurement: they never
 * start a successor. Without readings there is nothing to keep honest, so every edit is an edit.
 */
export type DefinitionChangeReason = 'unit' | 'method';
export type DefinitionChange = { kind: 'keep' } | { kind: 'successor'; reasons: DefinitionChangeReason[] };

export function definitionChange(
  current: Pick<RepTeamMeasurableType, 'kind' | 'unit' | 'method'>,
  next: { unit?: string | null; method?: string | null; [other: string]: unknown },
  hasReadings: boolean,
): DefinitionChange {
  if (!hasReadings || current.kind !== 'test') return { kind: 'keep' };
  const reasons: DefinitionChangeReason[] = [];
  if (next.unit !== undefined && next.unit != null && current.unit != null && !sameUnit(current.unit, next.unit)) reasons.push('unit');
  if (next.method !== undefined && current.method) {
    const written = (next.method ?? '').trim();
    if (written !== current.method.trim()) reasons.push('method');
  }
  return reasons.length ? { kind: 'successor', reasons } : { kind: 'keep' };
}

/** The sentence the editor and the 409 both say when the rule bites. */
export function successorSentence(reasons: DefinitionChangeReason[], name: string): string {
  const what = reasons.length === 2 ? 'unit and method' : reasons[0] === 'unit' ? 'unit' : 'method';
  return `Changing the ${what} of “${name}” starts a new definition and retires this one — its saved results stay under the ${what} they were recorded with.`;
}
