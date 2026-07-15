/**
 * lib/tournament-phase-display.ts
 * Display-level phase helpers shared by the tournament chrome — the desktop
 * top-bar status (TournamentNavStatus) and the mobile unified event header
 * (Navbar's event head). Pure functions over the OrgNav context fields so the
 * two surfaces can never disagree about what phase the event is in.
 */

export type TournamentDisplayPhase = 'pre' | 'live' | 'done' | 'none';

export function phaseOf(
  start: string | null,
  end: string | null,
  status: string | null,
  today: string,
  finished: boolean,
): TournamentDisplayPhase {
  if (status === 'cancelled') return 'none';
  // "Effectively finished" (bracket decided / marked complete / played out past the end
  // date) shows Completed even mid-window, so the pill never reads "In progress" over a
  // finished overview.
  if (status === 'completed' || finished) return 'done';
  if (!start || !end) return 'none';
  if (today < start) return 'pre';
  if (today > end) return 'done';
  return 'live';
}

export function fmtRange(start: string | null, end: string | null): string {
  if (!start) return '';
  const s = new Date(`${start}T12:00:00`);
  if (!end || end === start) return s.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
  const e = new Date(`${end}T12:00:00`);
  const sameMonth = s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth();
  if (sameMonth) return `${s.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}–${e.getDate()}, ${e.getFullYear()}`;
  return `${s.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })} – ${e.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

export function daysUntil(start: string | null, today: string): number {
  if (!start) return 0;
  const ms = new Date(`${start}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime();
  return Math.max(0, Math.round(ms / 86_400_000));
}
