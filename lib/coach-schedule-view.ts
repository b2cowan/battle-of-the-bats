/**
 * THE SCHEDULE'S SMALL SHARED READS — what the coach Schedule's calendar views, its event sheet and
 * its add/edit form each compute from an event: its club-local day, a tournament's span, the clock
 * and date labels, the result hue. React-free.
 *
 * ⚠ One copy for three files. These lived at the top of the 4,211-line schedule page until the
 * Schedule deep dive's split (stage 1 · S6, owner ruling 2026-09-25: "split first, a pure move");
 * they moved here unchanged when the page's sheet, form and views became files of their own, so
 * that the three could not grow three spellings of "the day an event falls on".
 */
import type { RepEventType, RepTeamEvent } from './types';
import { COACH_GAME_EVENT_TYPES } from './coach-tournament-games';
import { formatInOrgZone, orgDayKey } from './timezone';

// Chunk C (C0): every schedule surface reads the stored instant in the ORG'S timezone, never the
// device's. A game starts when it starts — a coach travelling, or a family watching from another
// province, must see the game's local start time. `new Date(iso).toLocaleTimeString()` renders in
// whatever zone the device happens to be in, which is how a 6:00 PM game read back 2:00 PM.
export function fmtDate(iso: string) {
  return formatInOrgZone(iso, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

export function fmtTime(iso: string) {
  return formatInOrgZone(iso, { hour: 'numeric', minute: '2-digit', hour12: true });
}

export const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const GAME_EVENT_TYPES = COACH_GAME_EVENT_TYPES as RepEventType[];

export function isLineupEvent(event: RepTeamEvent | null) {
  return event ? GAME_EVENT_TYPES.includes(event.eventType) : false;
}

/** Win/loss/tie badge colour (reuses the semantic status tokens; tie falls through to warning). */
export function resultColor(result: string): string {
  return result === 'win' ? 'var(--success)' : result === 'loss' ? 'var(--danger)' : 'var(--warning)';
}

export function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function monthKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function weekKey(iso: string) {
  const d = new Date(iso);
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return monday.toISOString().slice(0, 10);
}

// ── Multi-day tournament spanning ───────────────────────────────────────────────
// A tournament container (external_tournament) occupies every day from its start date
// through its end date inclusive; every other event occupies only its start day.
/** The calendar day an event falls on IN THE ORG'S ZONE. Slicing the raw string instead reads the
 *  UTC day, which is a different date for every event after 8 PM Eastern (C0). */
export function dayStr(iso: string) { return orgDayKey(iso); }

// Whole days between two YYYY-MM-DD keys (UTC anchored so DST never shifts the count).
export function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}

export function shortDate(dayKey: string) {
  return new Date(`${dayKey}T00:00:00`).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
}

export function tournamentSpan(e: RepTeamEvent): { start: string; end: string; days: number } | null {
  if (e.eventType !== 'external_tournament' || !e.startsAt) return null;
  const start = dayStr(e.startsAt);
  const end = e.endsAt && dayStr(e.endsAt) >= start ? dayStr(e.endsAt) : start;
  return { start, end, days: daysBetween(start, end) + 1 };
}

export function eventOnDay(e: RepTeamEvent, dayKey: string): boolean {
  if (!e.startsAt) return false;
  const span = tournamentSpan(e);
  if (span) return dayKey >= span.start && dayKey <= span.end;
  return dayStr(e.startsAt) === dayKey;
}

// Order a single day's events: all-day tournaments first, then by start time.
export function sortDayEvents(list: RepTeamEvent[]): RepTeamEvent[] {
  return [...list].sort((a, b) => {
    const at = a.eventType === 'external_tournament' ? 0 : 1;
    const bt = b.eventType === 'external_tournament' ? 0 : 1;
    if (at !== bt) return at - bt;
    return (a.startsAt ?? '').localeCompare(b.startsAt ?? '');
  });
}
