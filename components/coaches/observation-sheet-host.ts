import { observationEditPatch } from '@/lib/development-input';
import { formatShortDate } from '@/lib/measurable-format';
import type { RepPlayerObservation, RepTeamMeasurableType } from '@/lib/types';

/**
 * What a HOST of the observation sheet shares (development lifecycle re-evaluation stage 3, E2,
 * 2026-09-15): the player's Skills & Goals tab and the Notes tab both open `RecordObservationDialog`
 * on a saved observation, send only what changed, and remove it behind one confirm. The wording,
 * the "fixed by its session" shape and the two requests live here once — the session page keeps
 * its own host (its sheet is fixed by the SESSION, and a twin there is a 409 it answers by
 * re-reading), so this is the two player-page hosts' module, not a third door.
 */

/** The confirm the old Observations view's × used; the sheet's Remove asks it now. */
export const REMOVE_OBSERVATION_CONFIRM = {
  title: 'Remove this observation?',
  message: 'For fixing a mis-entry — a dated record of what you saw goes with it.',
  confirmText: 'Remove',
  cancelText: 'Cancel',
  tone: 'danger',
} as const;

export interface FixedObservation {
  skill: RepTeamMeasurableType;
  observedOn: string;
  playerName: string;
  subtitle: string;
  enteredBy?: string | null;
}

/**
 * The sheet's `fixed` shape for an observation a SESSION dates: the skill and the date come from the
 * record (C12's mode), the subtitle says so. Null for one recorded from the bench — that one keeps
 * its date editable in the ordinary edit mode.
 */
export function fixedObservation(
  o: RepPlayerObservation,
  skill: RepTeamMeasurableType | null | undefined,
  playerName: string,
  enteredBy: string | null,
): FixedObservation | null {
  if (!o.sessionId || !skill) return null;
  return {
    skill, observedOn: o.observedOn, playerName, enteredBy,
    subtitle: `${skill.name} · ${formatShortDate(o.observedOn)} · dated by the session it was taken in`,
  };
}

export interface ObservationSheetValues { measurableTypeId: string; observedOn: string; note: string; descriptor: string; goalId: string | null }

/**
 * An edit sends ONLY what changed (a descriptor the skill has since dropped is never re-sent
 * untouched); nothing changed sends nothing and resolves null (/review 2026-09-15). Throws with
 * the server's words on a refusal.
 */
export async function patchObservation(base: string, editing: RepPlayerObservation, v: ObservationSheetValues): Promise<RepPlayerObservation | null> {
  const patch = observationEditPatch(editing, v);
  if (!patch) return null;
  const res = await fetch(`${base}/observations/${editing.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.observation) throw new Error(json?.error ?? 'Could not save the observation — try again.');
  return json.observation as RepPlayerObservation;
}

/** Remove — the host has already asked `REMOVE_OBSERVATION_CONFIRM`. Throws with the server's words. */
export async function deleteObservation(base: string, id: string): Promise<void> {
  const res = await fetch(`${base}/observations/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const json = await res.json().catch(() => null);
    throw new Error(json?.error ?? "Couldn't remove the observation — try again.");
  }
}
