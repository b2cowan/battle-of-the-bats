/**
 * Player Development shared formatting/validation — ONE home for the helpers that were
 * copy-pasted across the 3A card and the 3B pages (hoisted per the 3B /simplify pass;
 * the 3A pass deferred this "until 3B needs it" — 3B crossed the rule-of-three).
 * Pure module: safe for client components AND API routes.
 */

/** Measurable value display: what the coach typed, minus float noise. */
export function formatValue(v: number): string {
  return Number.isInteger(v) ? String(v) : String(Number(v.toFixed(3)));
}

/** Local calendar date (the coach's own "today") — these are coach-chosen dates, not
 *  tournament-timezone dates. en-CA formats as YYYY-MM-DD. */
export function todayLocal(): string {
  return new Date().toLocaleDateString('en-CA');
}

/** "Jul 17" — the short date label used by entry logs and the team board. */
export function formatShortDate(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Reading/session date sanity: YYYY-MM-DD, parseable, year 2000..next — a fat-fingered
 *  year (0202-…) silently corrupts newest-first sorts and trend lines. */
export function isValidRecordDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(new Date(`${date}T00:00:00`).getTime())) return false;
  const year = Number(date.slice(0, 4));
  return year >= 2000 && year <= new Date().getFullYear() + 1;
}
