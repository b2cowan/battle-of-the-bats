/**
 * Provincial tryout-window heads-up (Phase 2A) — a NON-BINDING advisory only.
 *
 * Keyed by sport (and, later, province). V1 = Ontario governing bodies (OBA for baseball, Softball
 * Ontario for softball), which default-apply with an explicit "ignore if not affiliated" framing in
 * the UI. Adding another province/body is a config entry here, not a code change. Window dates live
 * in app config — never in the DB.
 */

export interface TryoutWindow {
  /** The governing body named in the notice. */
  body: string;
  start: { month: number; day: number }; // month 1-12
  end: { month: number; day: number };
}

// Ontario rep tryout window ≈ July 1 → mid-September (advisory; confirm exact dates per body).
const ONTARIO_BASEBALL: TryoutWindow = { body: 'OBA', start: { month: 7, day: 1 }, end: { month: 9, day: 14 } };
const ONTARIO_SOFTBALL: TryoutWindow = { body: 'Softball Ontario', start: { month: 7, day: 1 }, end: { month: 9, day: 14 } };

function windowFor(sport: string | null | undefined): TryoutWindow {
  return (sport ?? '').toLowerCase() === 'baseball' ? ONTARIO_BASEBALL : ONTARIO_SOFTBALL;
}

/**
 * Returns a non-blocking advisory string when `date` falls OUTSIDE the (Ontario V1) tryout window,
 * else null. The notice names the governing body and the window, and tells non-affiliated teams to
 * ignore it. `date` is a local Date.
 */
export function getTryoutWindowNotice(date: Date, opts: { sport?: string | null }): string | null {
  if (isNaN(date.getTime())) return null;
  const w = windowFor(opts.sport);
  const y = date.getFullYear();
  const start = new Date(y, w.start.month - 1, w.start.day, 0, 0, 0);
  const end = new Date(y, w.end.month - 1, w.end.day, 23, 59, 59);
  if (date >= start && date <= end) return null;
  const fmt = (m: number, d: number) =>
    new Date(2000, m - 1, d).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
  return `This date is outside the standard ${w.body} rep tryout window (${fmt(w.start.month, w.start.day)} – ${fmt(w.end.month, w.end.day)}). If your team isn't ${w.body}-affiliated, you can ignore this.`;
}
