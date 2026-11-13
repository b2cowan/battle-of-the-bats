import { COACH_GAME_EVENT_TYPES } from './coach-tournament-games';
import { FAMILY_ANSWER_NOTE_MAX, type FamilyAnswer } from './family-availability-words';

/**
 * THE RULES OF "FAMILIES SAY IF THEY'RE COMING", PURE (Signed-in family accounts Stage 4b). No database here: lib/family-availability.ts
 * reads the facts and calls these, so each rule is unit-tested (tests/unit/family-availability.test.ts). Not server-only.
 */

export type FamilyAnswersSetting = 'off' | 'games' | 'games_and_practices';
export const FAMILY_ANSWERS_SETTINGS: readonly FamilyAnswersSetting[] = ['off', 'games', 'games_and_practices'];

/** An unknown or missing value is OFF: a team never falls to a more open setting than it chose. */
export function normalizeFamilyAnswers(value: string | null | undefined): FamilyAnswersSetting {
  return FAMILY_ANSWERS_SETTINGS.includes(value as FamilyAnswersSetting) ? (value as FamilyAnswersSetting) : 'off';
}

/** Does the switch cover this kind of event? Games = the product's one game list (league games incl. scrimmages, tournament
 *  games); "Games and practices" adds practices. The tournament container and team events are never asked. */
export function familyAnswersCover(setting: FamilyAnswersSetting, eventType: string): boolean {
  if (setting === 'off') return false;
  if (COACH_GAME_EVENT_TYPES.includes(eventType)) return true;
  return setting === 'games_and_practices' && eventType === 'practice';
}

/**
 * Where one event stands for a family's answer, decided in ONE place (the parent's page and the writer both call it; the coach's
 * Remind will too). `not_covered`: the switch doesn't ask about this kind of event. `cancelled`: kept, hidden. `closed`: it has
 * started (the row shows the answer, no control). `open`: answerable now.
 */
export type FamilyAnswerState = 'not_covered' | 'cancelled' | 'closed' | 'open';
export function familyAnswerState(
  setting: FamilyAnswersSetting,
  event: { eventType: string; status: string; startsAt: string },
  now: Date,
): FamilyAnswerState {
  if (!familyAnswersCover(setting, event.eventType)) return 'not_covered';
  if (event.status === 'cancelled') return 'cancelled';
  return Date.parse(event.startsAt) > now.getTime() ? 'open' : 'closed';
}

const ANSWERS: readonly FamilyAnswer[] = ['in', 'out', 'maybe'];
export const isFamilyAnswer = (v: unknown): v is FamilyAnswer => ANSWERS.includes(v as FamilyAnswer);

/** The longest first name the accept page takes and the sheet shows. */
export const FIRST_NAME_MAX = 50;

/** A first name that is safe to show to ANOTHER person: control, zero-width and bidirectional-override characters gone, runs of
 *  space collapsed, at most 50 characters, and at least one visible letter or digit. Null otherwise. A parent can edit their own
 *  account's name outside our forms, so what the other parent reads is cleaned HERE, whichever way it arrived. */
export function cleanFirstName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const s = raw
    .replace(/[\u0000-\u001f\u007f-\u009f­​-‏‪-‮⁠-⁩﻿]/g, '')
    .replace(/\s+/g, ' ').trim().slice(0, FIRST_NAME_MAX).trim();
  return /[\p{L}\p{N}]/u.test(s) ? s : null;
}

/** A person's FIRST name from their account (O2): `first_name`, else the first word of `full_name` / `display_name`. Null when
 *  the account holds none (or nothing safe to show); never made from an email address. */
export function firstNameOf(meta: Record<string, unknown> | null | undefined): string | null {
  const m = meta ?? {};
  const pick = (k: string) => (typeof m[k] === 'string' ? (m[k] as string).trim() : '');
  return cleanFirstName(pick('first_name') || pick('full_name').split(/\s+/)[0] || pick('display_name').split(/\s+/)[0]);
}

/** The note as stored: one plain line, trimmed, control characters gone, at most 200 characters; empty = no note. */
export function cleanFamilyNote(raw: unknown): { ok: true; note: string | null } | { ok: false } {
  if (raw === undefined || raw === null) return { ok: true, note: null };
  if (typeof raw !== 'string') return { ok: false };
  const note = raw.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (note.length > FAMILY_ANSWER_NOTE_MAX) return { ok: false };
  return { ok: true, note: note || null };
}
