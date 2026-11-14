import { COACH_GAME_EVENT_TYPES } from './coach-tournament-games';
import { ANSWER_STATUSES, FAMILY_ANSWER_NOTE_MAX, type AnswerStatus, type CoachAnswerLine } from './family-availability-words';
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
 * Where one event stands for a family's answer, decided in ONE place (the parent's page, the writer and the coach's Remind call it). `not_covered`: the switch doesn't ask about this kind of event. `cancelled`: kept, hidden. `closed`: it has
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
  return familyEventOpen(event, now.getTime()) ? 'open' : 'closed';
}

/** Not cancelled and not started: a family can answer it, and only then does a family Out flag a lineup (owner, Session 4). The
 *  one "is it still open" test for the server's `familyAnswerState` and the clients' minute clock. */
export function familyEventOpen(event: { status: string; startsAt: string | null }, nowMs: number): boolean {
  return event.status !== 'cancelled' && !!event.startsAt && Date.parse(event.startsAt) > nowMs;
}

/** One attendance record (ruling 1): a family answers in the record's own words, In · Late · Maybe · Out (null = clear it). */
export const isAnswerStatus = (v: unknown): v is AnswerStatus => ANSWER_STATUSES.includes(v as AnswerStatus);

/** The record's status as an answer: null for Not marked (or nothing there). */
export function answerOfStatus(status: RepAttendanceStatus | null | undefined): AnswerStatus | null {
  return status && status !== 'unknown' ? status : null;
}

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

// ── The coach's side: one count per player, the room's Families card ─────────────────────────────────────────────────────────
// One attendance record (owner ruling 2026-11-13): the family's answer IS the player's status, so nothing here compares a family
// answer with a coach mark — there is one answer per player, with who set it (Stage 4b's drift warning and "Use N family answers"
// are gone with the second record).

export interface Headcount { total: number; in: number; out: number; maybe: number }

/**
 * ONE count per player, from the record alone: In or Late = in, Out = out, Maybe = maybe, whoever set it. A player nobody has
 * answered for counts nowhere. `total` is the players the room lists for the count (the active roster; no call-ups).
 */
export function headcountOf(players: readonly { status: RepAttendanceStatus }[]): Headcount {
  const c: Headcount = { total: players.length, in: 0, out: 0, maybe: 0 };
  for (const p of players) {
    if (p.status === 'attending' || p.status === 'late') c.in++;
    else if (p.status === 'absent') c.out++;
    else if (p.status === 'maybe') c.maybe++;
  }
  return c;
}

/** Ask 7: players not out are fewer than the sport's field positions. Never for a sport with none; counts OUTS, never ins. */
export function isShort(c: Headcount, fieldPositions: number): boolean {
  return fieldPositions > 0 && c.out > 0 && c.total - c.out < fieldPositions;
}

/** One rostered player in the room, as the family side adds to it (the coach's room route sends these; a call-up never appears). */
export interface RoomFamilyRow {
  playerId: string;
  /** A parent of this player is in the app (the card's "have no parent in the app" counts the others once). */
  connected: boolean;
}

export type LiveFamilyAnswersSetting = Exclude<FamilyAnswersSetting, 'off'>;

/** The room's family side for one event (the coach's room route answers this; null = nothing about answers exists). */
export interface RoomFamilyAnswers {
  setting: LiveFamilyAnswersSetting;
  /** Where this event stands for families: `open` before the start, `closed` after, `cancelled` (the room then shows nothing). */
  state: Exclude<FamilyAnswerState, 'not_covered'>;
  rows: RoomFamilyRow[];
  /** Per player with an answer: who set it and when, the family's note, the answer before (ruling 4). The attendance PATCH's
   *  reply carries the same map, so the line follows every save. */
  lines: Record<string, CoachAnswerLine>;
  /** When Remind was last used on this event (any coach), or null (Part 7: the card's "Reminded at … again tomorrow at …"). */
  remindedAt: string | null;
}

/** The room's Families card, decided in ONE place from the record and who has a parent in the app. */
export interface RoomFamilySummary {
  /** Players whose current answer a FAMILY set. */
  answered: number;
  /** Not marked, with a parent in the app (exactly Remind's list). */
  haveNot: number;
  /** Not marked, and no parent in the app. */
  noParent: number;
  /** Players whose families Remind would reach (`remindPlan`): a parent in the app, and nobody has answered. */
  remind: string[];
}

export function roomFamilySummary(
  book: readonly { playerId: string; status: RepAttendanceStatus; setByKind: string | null }[],
  family: readonly RoomFamilyRow[],
): RoomFamilySummary {
  const byPlayer = new Map(family.map(f => [f.playerId, f]));
  const out: RoomFamilySummary = { answered: 0, haveNot: 0, noParent: 0, remind: [] };
  const plan: { playerId: string; status: RepAttendanceStatus; answered: boolean; connected: boolean }[] = [];
  for (const b of book) {
    const f = byPlayer.get(b.playerId);
    if (!f) continue; // a call-up: no family line, not counted
    const answered = b.status !== 'unknown' && b.setByKind === 'family';
    if (answered) out.answered++;
    else if (b.status === 'unknown') {
      if (f.connected) out.haveNot++;
      else out.noParent++;
    }
    plan.push({ playerId: b.playerId, status: b.status, answered, connected: f.connected });
  }
  out.remind = remindPlan(plan).remind;
  return out;
}

// ── The lineup (Session 3, Part 6; drawing tab 5) ─────────────────────────────────────────────────────────────────────────────
// ONE rule for the builder's pool words and warning and the event window's Lineup row (ask 13). One attendance record: they read
// the status itself; the family side adds only WHO said Out and when (the lineup read's family-set rows, no note, no name).

/** One rostered player's answer when a FAMILY set it, as the lineup reads it: the status and when. No note, no name. */
export interface LineupFamilyAnswer { playerId: string; status: AnswerStatus; answeredAt: string }

/** One player as the lineup's rule reads them: the status as it stands in this screen, and the family's answer, if they set it. */
export interface LineupFamilyPlayer {
  playerId: string;
  status: RepAttendanceStatus;
  family: { status: AnswerStatus; answeredAt: string } | null;
}

/** The word on a pool pill ("Not in the lineup"): Out or Maybe, whoever set it. In, Late or Not marked: no word. */
export function lineupTagWord(status: RepAttendanceStatus): 'out' | 'maybe' | null {
  return status === 'absent' ? 'out' : status === 'maybe' ? 'maybe' : null;
}

/** A lineup player a family said Out about. `afterSave`: the Out came after the lineup was saved. */
export interface LineupFamilyOut { playerId: string; afterSave: boolean }

/**
 * The players IN the lineup whose answer is a FAMILY's Out (the status as this screen holds it is still Out, and the family set
 * it): the builder words it as the family's ("Maya's family said Out after you saved this lineup"), so the coach's own "marked
 * Out but still in the lineup" leaves these players out (callers subtract them). A coach who taps In takes them off the list.
 */
export function lineupFamilyOuts(
  players: readonly LineupFamilyPlayer[], inLineup: ReadonlySet<string>, savedAt: string | null,
  /** `familyEventOpen`: a started or cancelled game flags nothing (owner, Session 4; the pool's words still show). Required, so
   *  every surface decides it. */
  open: boolean,
): LineupFamilyOut[] {
  if (!open) return [];
  const out: LineupFamilyOut[] = [];
  for (const p of players) {
    if (!inLineup.has(p.playerId) || p.status !== 'absent' || p.family?.status !== 'absent') continue;
    out.push({ playerId: p.playerId, afterSave: !!savedAt && Date.parse(p.family.answeredAt) > Date.parse(savedAt) });
  }
  return out;
}

// ── Remind (Session 3, Part 7; ask 2; drawing tab 4) ─────────────────────────────────────────────────────────────────────────

/** Once per event per 24 hours for the whole staff (the database's claim holds it; this is the same gap for the words). */
export const REMIND_GAP_MS = 24 * 60 * 60 * 1000;

/** When Remind is offered again after a reminder sent at `remindedAt`. */
export function remindAgainAt(remindedAt: string): string {
  return new Date(Date.parse(remindedAt) + REMIND_GAP_MS).toISOString();
}

/**
 * WHO A REMINDER IS FOR (ask 2), decided in ONE place for the room's "Remind N", the confirm and the send:
 *   · remind   — a parent is in the app, the family hasn't answered, and the coach hasn't marked the player;
 *   · marked   — the family hasn't answered, but the coach marked the player: settled, never reminded;
 *   · noParent — the family hasn't answered, nobody marked the player, and no parent is in the app: reported, never emailed.
 * A family that answered is left alone. A call-up is never passed in. One attendance record (ruling 6; owner 2026-11-13, S2):
 * "unanswered" is Not marked, whoever would have set it, and a standing Maybe IS an answer, so it is never reminded (ruling 2
 * counts it as Not marked in the STATS only).
 */
export function remindPlan(players: readonly { playerId: string; status: RepAttendanceStatus; answered: boolean; connected: boolean }[]): {
  remind: string[]; marked: string[]; noParent: string[];
} {
  const out = { remind: [] as string[], marked: [] as string[], noParent: [] as string[] };
  for (const p of players) {
    if (p.answered) continue;
    if (!p.connected) { if (p.status === 'unknown') out.noParent.push(p.playerId); continue; }
    (p.status === 'unknown' ? out.remind : out.marked).push(p.playerId);
  }
  return out;
}

// ── The coach's bell (Session 3, Part 8; ask 12; drawing tab 6) ──────────────────────────────────────────────────────────────

/** "In the 48 hours before the event" (ask 12). */
export const COACH_BELL_LATE_MS = 48 * 60 * 60 * 1000;
/** Answers inside this window fold into the coach's existing unread line (ask 12's bundling). */
export const COACH_BELL_BUNDLE_MS = 60 * 60 * 1000;

/**
 * Does this save ring the coach's bell? A family's Out at any time, and an Out TAKEN BACK at any time (owner, Session 4: else the
 * coach's unread line keeps saying "Out" after the family changed it); any other CHANGE (including a cleared answer) inside the
 * 48 hours before the event. Never a first In, Late or Maybe, never a note-only re-send, never a routine In. `prior` is the record's answer
 * before the save, whoever set it (a parent's In over the coach's Late is a change).
 */
export function coachBellFires(prior: AnswerStatus | null, next: AnswerStatus | null, startsAt: string, now: Date): boolean {
  if (prior === next) return false;
  if (next === 'absent' || prior === 'absent') return true;
  return prior !== null && Date.parse(startsAt) - now.getTime() <= COACH_BELL_LATE_MS;
}

/** One family answer as the coach's bell carries it. Never the note's words: only that there is one (ask 12, /legal). */
export interface CoachBellItem {
  eventId: string;
  /** "Sat vs Lakeshore" / "Thu, Apr 29 practice". */
  eventLabel: string;
  /** "Sat, May 1" (a family's run of events lists these). */
  eventDay: string;
  childId: string;
  child: string;
  /** The answer after this save, and the one before it (any setter: the record's status), null = Not marked. */
  answer: AnswerStatus | null;
  prior: AnswerStatus | null;
  /** The answering parent's first name, or null ("A parent"). */
  parent: string | null;
  hasNote: boolean;
  /** The event's count after this answer ("9 of 13 in · 1 out · 1 maybe"), or null. */
  count: string | null;
}

/** One bell line: one event's answers, or one family's run of events. */
export interface CoachBellBundle { kind: 'event' | 'family'; teamId: string; items: CoachBellItem[] }

/**
 * Fold a new answer into the coach's unread lines from the last hour (ask 12): first a line about the SAME event (one line per
 * event; the same child's newer answer replaces theirs), else a line that is only about THIS family (one line per family across
 * events), else a new line. Returns the line to write and which existing line it replaces (null = a new one).
 */
export function mergeCoachBell(
  open: readonly { id: string; bundle: CoachBellBundle }[], item: CoachBellItem, teamId: string,
): { id: string | null; bundle: CoachBellBundle } {
  const sameEvent = open.find(o => o.bundle.teamId === teamId && o.bundle.kind === 'event' && o.bundle.items.every(i => i.eventId === item.eventId));
  if (sameEvent) {
    return { id: sameEvent.id, bundle: { ...sameEvent.bundle, items: [...sameEvent.bundle.items.filter(i => i.childId !== item.childId), item] } };
  }
  const sameFamily = open.find(o => o.bundle.teamId === teamId && o.bundle.items.length > 0 && o.bundle.items.every(i => i.childId === item.childId));
  if (sameFamily) {
    return { id: sameFamily.id, bundle: { kind: 'family', teamId, items: [...sameFamily.bundle.items.filter(i => i.eventId !== item.eventId), item] } };
  }
  return { id: null, bundle: { kind: 'event', teamId, items: [item] } };
}
