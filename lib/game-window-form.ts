/**
 * THE GAME WINDOW'S FORM (Tournament admin redesign Stage 3, S2 — A35, A36). Pure: the window
 * (`app/[orgSlug]/admin/tournaments/schedule/components/GameWindow.tsx`) and a unit test read the same rules.
 *
 *   · A game reads into the form, and the form writes back ONLY what changed (the games route's `update`).
 *   · A move is a change of day, start or place — the published-game question (A36) is about those alone.
 *   · Day and start are changed, never emptied: the route keeps what it has when either is absent.
 *   · The question's two bodies follow the alerts' own lanes (`lib/schedule-change-notices.ts`): a game whose NEW
 *     start falls in the next 6 hours is told at the next sweep; any other waits for 10 quiet minutes.
 */
import type { Game, Venue } from './types';
import { EMPTY_WHERE, type WhereValue } from './where-field.ts';
import { placeOfWhere, samePlace, whereOfGame } from './tournament-where.ts';
import { zonedWallClockToUtc } from './timezone.ts';

export interface GameWindowForm {
  divisionId: string;
  stage: 'pool' | 'playoff';
  date: string;
  time: string;
  /** '' = the chain decides (the game's own box empty, A39). */
  durationMinutes: string;
  where: WhereValue;
  awayTeamId: string;
  homeTeamId: string;
  awayPlaceholder: string;
  homePlaceholder: string;
  awaySlotId: string;
  homeSlotId: string;
  notes: string;
}

/** What an edit sends (the games route's `update`): only the keys that changed. */
export type GamePatch = {
  date?: string | null; time?: string | null; durationMinutes?: number | null;
  venueId?: string | null; venueFacilityId?: string | null; location?: string | null; notes?: string | null;
  homeTeamId?: string | null; awayTeamId?: string | null; homePlaceholder?: string | null; awayPlaceholder?: string | null;
};

const hhmm = (t: string | null | undefined) => (t ?? '').slice(0, 5);

export function formOfGame(g: Game, venues: readonly Venue[]): GameWindowForm {
  return {
    divisionId: g.divisionId,
    stage: g.isPlayoff ? 'playoff' : 'pool',
    date: g.date ?? '',
    time: hhmm(g.time),
    durationMinutes: typeof g.durationMinutes === 'number' && g.durationMinutes > 0 ? String(g.durationMinutes) : '',
    where: whereOfGame(g, venues),
    awayTeamId: g.awayTeamId ?? '',
    homeTeamId: g.homeTeamId ?? '',
    awayPlaceholder: g.awayPlaceholder ?? '',
    homePlaceholder: g.homePlaceholder ?? '',
    awaySlotId: g.awaySlotId ?? '',
    homeSlotId: g.homeSlotId ?? '',
    notes: g.notes ?? '',
  };
}

export function emptyGameForm(divisionId: string, stage: 'pool' | 'playoff', date: string): GameWindowForm {
  return {
    divisionId, stage, date, time: '09:00', durationMinutes: '', where: { ...EMPTY_WHERE },
    awayTeamId: '', homeTeamId: '', awayPlaceholder: '', homePlaceholder: '', awaySlotId: '', homeSlotId: '', notes: '',
  };
}

/** The Length box as minutes: a whole number 1–600 (the route's own bounds), or null for "the chain decides". */
export function lengthOfBox(v: string): number | null {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? Math.min(600, n) : null;
}

/** When or where moved: a change of day, start or place (A36's question is about these alone). */
export function whenWhereChanged(f: GameWindowForm, s: GameWindowForm): boolean {
  return f.date !== s.date || f.time !== s.time || !samePlace(f.where, s.where);
}

/** The patch for what changed. `whenWhere` false leaves day, start and place out (held for ✓, or refused). */
export function changesOf(f: GameWindowForm, s: GameWindowForm, opts: { whenWhere: boolean; playoff: boolean }): GamePatch {
  const out: GamePatch = {};
  if (opts.whenWhere) {
    if (f.date !== s.date && f.date) out.date = f.date;
    if (f.time !== s.time && f.time) out.time = f.time;
    if (!samePlace(f.where, s.where)) Object.assign(out, placeOfWhere(f.where));
  }
  if (f.durationMinutes !== s.durationMinutes) out.durationMinutes = lengthOfBox(f.durationMinutes);
  if (f.notes !== s.notes) out.notes = f.notes.trim() || null;
  if (opts.playoff) {
    // A playoff side is a team OR its slot (a seed, a winner, a loser): both keys go together.
    if (f.homeTeamId !== s.homeTeamId || f.homePlaceholder !== s.homePlaceholder) { out.homeTeamId = f.homeTeamId || null; out.homePlaceholder = f.homePlaceholder || null; }
    if (f.awayTeamId !== s.awayTeamId || f.awayPlaceholder !== s.awayPlaceholder) { out.awayTeamId = f.awayTeamId || null; out.awayPlaceholder = f.awayPlaceholder || null; }
  } else {
    // A round-robin game never sends its placeholders: a slot game keeps its slot's name there.
    if (f.homeTeamId !== s.homeTeamId) out.homeTeamId = f.homeTeamId || null;
    if (f.awayTeamId !== s.awayTeamId) out.awayTeamId = f.awayTeamId || null;
  }
  return out;
}

/** The alerts' urgent lane, in hours — `URGENT_WINDOW_HOURS` in `lib/schedule-change-notices.ts` (a test holds the two equal). */
export const MOVE_ALERT_URGENT_HOURS = 6;

/** The moved game's NEW start falls in the alerts' urgent lane: after now, within the next 6 hours (the org's clock). */
export function startsInUrgentLane(date: string, time: string, nowMs: number): boolean {
  const iso = zonedWallClockToUtc(date, time);
  if (!iso) return false;
  const startMs = Date.parse(iso);
  return startMs > nowMs && startMs <= nowMs + MOVE_ALERT_URGENT_HOURS * 3600_000;
}
