/**
 * The support console's dates and times, through the platform's own formatters (`formatStoredDate`, the org zone), so a
 * console screen never hand-rolls a clock: "Oct 25, 2026", "Oct 25", "9:40 a.m.", "Oct 25, 9:40 a.m." (Support console
 * Stage 2; the clock ruling of 2026-08-26 — lowercase with periods, which `en-CA` returns natively).
 */
import { formatInOrgZone, formatStoredDate, orgDayKey, daysBetweenDateStrings, tournamentToday } from './timezone';

/** "Oct 25, 2026" — a date with its year. */
export function consoleDate(iso: string | null | undefined): string {
  return formatStoredDate(iso);
}

/** "Oct 25" — a date in the current year; other years keep theirs. */
export function consoleDay(iso: string | null | undefined): string {
  if (!iso) return '—';
  const sameYear = orgDayKey(iso).slice(0, 4) === tournamentToday().slice(0, 4);
  return formatStoredDate(iso, { withYear: !sameYear });
}

/** "9:40 a.m." */
export function consoleClock(iso: string | null | undefined): string {
  return formatInOrgZone(iso, { hour: 'numeric', minute: '2-digit' });
}

/** "Oct 25, 9:40 a.m." (a Story's When; "Oct 25, 2025, 9:40 a.m." for an earlier year). */
export function consoleWhen(iso: string | null | undefined): string {
  if (!iso) return '—';
  return `${consoleDay(iso)}, ${consoleClock(iso)}`;
}

/** How long ago this browser opened a record, for Find's Recent: "just now", "10 minutes ago", "yesterday", "Oct 22". */
export function consoleAgo(at: number, now: number = Date.now()): string {
  const minutes = Math.max(0, Math.round((now - at) / 60_000));
  if (minutes < 1) return 'just now';
  const iso = new Date(at).toISOString(); // utc-intentional: an instant, formatted in the org zone below
  const days = daysBetweenDateStrings(orgDayKey(iso), tournamentToday(new Date(now)));
  if (days === 0) {
    if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
    const hours = Math.round(minutes / 60);
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }
  if (days === 1) return 'yesterday';
  return consoleDay(iso);
}
