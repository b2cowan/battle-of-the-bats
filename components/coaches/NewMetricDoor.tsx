'use client';
import { useState, type ReactNode } from 'react';
import MetricDefinitionSheet from '@/components/coaches/MetricDefinitionSheet';
import type { MeasurableKind, RepTeamMeasurableType } from '@/lib/types';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';
import css from './NewMetricDoor.module.css';

/** The door's words, one row per kind. The test line's "as everywhere" is true of tests only —
 *  "+ New skill…" exists nowhere else, so the skill line says where the skill ends up instead. */
const WORDING: Readonly<Record<MeasurableKind, { label: string; tail: string }>> = {
  test: { label: '+ New test…', tail: 'defines a whole test, as everywhere.' },
  skill: { label: '+ New skill…', tail: 'defines a whole skill, and it joins your Metrics.' },
};

/**
 * "+ New test…" / "+ New skill…" — define a whole metric without leaving a record sheet (stage 1's
 * precedent, B8). Two sheets use it: Record a result ("+ New test…") and Record an observation
 * ("+ New skill…", owner ruling 2026-09-28 — the observation's door was a switched-off button with a
 * hover-only reason until then). One hook because the second consumer is the extraction point: the
 * wording, the tap floor, the stacking and the kind-fixing live HERE, never twice.
 *
 * Returns two pieces because they belong in two places:
 *  · `link` goes under the host's metric select, inside its form. The host's field is a DIV with a
 *    `<label htmlFor>`, not a wrapping `<label>` — this line is a sentence with a button in it, and
 *    inside a label it would become part of the select's accessible name.
 *  · `sheet` goes BESIDE the host's `QuestionShell`, never inside its `<form>`: the shell renders in
 *    place, so a definition sheet in the form would be a form inside a form whose submit bubbles
 *    into the record's own save.
 *
 * The definition sheet is fixed to `kind` (Kind reads as a fact, "Define a skill"): a result can only
 * be of a test and an observation only of a skill. `onDefined` hands the saved metric to the host,
 * which picks it and adds it to its library. `target` null draws nothing (a host with no door).
 *
 * Not used by the session planner's "+ New test…" — that one is a chip in the plan's chip row, and a
 * skill defined there can join the plan, so its sheet leaves Kind a choice.
 */
export function useNewMetricDoor(
  kind: MeasurableKind,
  target: { orgSlug: string; teamId: string } | null | undefined,
  onDefined: (type: RepTeamMeasurableType) => void,
): { link: ReactNode; sheet: ReactNode } {
  const [open, setOpen] = useState(false);
  if (!target) return { link: null, sheet: null };
  return {
    link: (
      <span className={styles.formHint}>
        <button type="button" className={css.door} onClick={() => setOpen(true)}>{WORDING[kind].label}</button>{' '}
        {WORDING[kind].tail}
      </span>
    ),
    sheet: open && (
      <MetricDefinitionSheet orgSlug={target.orgSlug} teamId={target.teamId} typeId={null} kind={kind}
        onClose={() => setOpen(false)} onSaved={type => { setOpen(false); onDefined(type); }} />
    ),
  };
}
