import { COACH_GAME_EVENT_TYPES } from './coach-tournament-games';
import { FAMILY_ANSWER_NOTE_MAX, type CoachFamilyLine, type FamilyAnswer } from './family-availability-words';
import type { RepAttendanceStatus } from './types';

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

// ── The coach's side (Session 2, Parts 4–5): one count per player, the drift warning, what "Use" may copy ────────────────────

export interface Headcount { total: number; in: number; out: number; maybe: number }

/**
 * ONE count per player (ask 8): the coach's mark first (In or Late = in, Out = out), else the family's answer. A player nobody has
 * marked or answered for counts nowhere. `total` is the players the room lists for the count (the active roster; no call-ups).
 */
export function headcountOf(players: readonly { status: RepAttendanceStatus; family: FamilyAnswer | null }[]): Headcount {
  const c: Headcount = { total: players.length, in: 0, out: 0, maybe: 0 };
  for (const p of players) {
    if (p.status === 'attending' || p.status === 'late') c.in++;
    else if (p.status === 'absent') c.out++;
    else if (p.family) c[p.family]++;
  }
  return c;
}

/** Ask 7: players not out are fewer than the sport's field positions. Never for a sport with none; counts OUTS, never ins. */
export function isShort(c: Headcount, fieldPositions: number): boolean {
  return fieldPositions > 0 && c.out > 0 && c.total - c.out < fieldPositions;
}

/** Does the family's answer say the same as the coach's mark? (Maybe never agrees with a mark.) */
function answerAgreesWithMark(status: RepAttendanceStatus, answer: FamilyAnswer): boolean {
  return answer === 'in' ? status === 'attending' || status === 'late' : answer === 'out' && status === 'absent';
}

/**
 * The amber warning (Part 5): the family's answer came AFTER the coach marked this player and says something else. Tapping the
 * player's mark again (even the same one) moves the mark's time and clears it. A player the coach hasn't marked never drifts.
 */
export function familyDrifted(
  book: { status: RepAttendanceStatus; markedAt: string | null },
  family: { answer: FamilyAnswer; answeredAt: string } | null,
): boolean {
  if (!family || book.status === 'unknown' || !book.markedAt) return false;
  return Date.parse(family.answeredAt) > Date.parse(book.markedAt) && !answerAgreesWithMark(book.status, family.answer);
}

/** What "Use N family answers" may copy (ask 3): only into a player the coach hasn't marked; In → In, Out → Out, Maybe stays. */
export function usableFamilyMark(status: RepAttendanceStatus, answer: FamilyAnswer | null): 'attending' | 'absent' | null {
  if (status !== 'unknown' || !answer || answer === 'maybe') return null;
  return answer === 'in' ? 'attending' : 'absent';
}

/** One rostered player in the room, as the family side adds to it (the coach's room route sends these; a call-up never appears). */
export interface RoomFamilyRow {
  playerId: string;
  /** A parent of this player is in the app (the card's "have no parent in the app" counts the others once). */
  connected: boolean;
  /** What the family said, or null when nobody has answered. */
  line: CoachFamilyLine | null;
  /** When they said it (compared with the coach's mark time for the amber warning). */
  answeredAt: string | null;
}

export type LiveFamilyAnswersSetting = Exclude<FamilyAnswersSetting, 'off'>;

/** The room's family side for one event (the coach's room route answers this; null = nothing about answers exists). */
export interface RoomFamilyAnswers {
  setting: LiveFamilyAnswersSetting;
  /** Where this event stands for families: `open` before the start, `closed` after, `cancelled` (the room then shows nothing). */
  state: Exclude<FamilyAnswerState, 'not_covered'>;
  rows: RoomFamilyRow[];
}

/** The room's Families card and its two actions, decided in ONE place from the book and the family rows. */
export interface RoomFamilySummary {
  answered: number;
  haveNot: number;
  noParent: number;
  /** Players whose family changed after the coach marked them (the amber warning), in roster order. */
  changed: string[];
  /** What "Use N family answers" would write: only players the coach hasn't marked, In → attending, Out → absent. */
  usable: { playerId: string; status: 'attending' | 'absent' }[];
}

export function roomFamilySummary(
  book: readonly { playerId: string; status: RepAttendanceStatus; markedAt: string | null }[],
  family: readonly RoomFamilyRow[],
): RoomFamilySummary {
  const byPlayer = new Map(family.map(f => [f.playerId, f]));
  const out: RoomFamilySummary = { answered: 0, haveNot: 0, noParent: 0, changed: [], usable: [] };
  for (const b of book) {
    const f = byPlayer.get(b.playerId);
    if (!f) continue; // a call-up: no family line, not counted
    if (f.line) out.answered++;
    else if (f.connected) out.haveNot++;
    else out.noParent++;
    if (f.line && f.answeredAt && familyDrifted(b, { answer: f.line.answer, answeredAt: f.answeredAt })) out.changed.push(b.playerId);
    const use = usableFamilyMark(b.status, f.line?.answer ?? null);
    if (use) out.usable.push({ playerId: b.playerId, status: use });
  }
  return out;
}

/**
 * The coach's mark time for one book row being saved (mig 479): it moves only when the mark changed or the coach tapped it
 * (`confirmed`: picking the mark it already had keeps the mark and clears the room's "family changed after you marked"). Every
 * other row in the batch keeps its own. "Not marked" has no mark time.
 */
export function bookMarkedAt(
  prior: { status: RepAttendanceStatus; markedAt: string | null } | undefined, status: RepAttendanceStatus, confirmed: boolean, now: string,
): string | null {
  if (status === 'unknown') return null;
  if (!prior || prior.status !== status || confirmed) return now;
  return prior.markedAt;
}
