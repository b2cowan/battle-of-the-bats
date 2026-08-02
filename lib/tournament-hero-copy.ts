/**
 * lib/tournament-hero-copy.ts
 * The tournament hero's date/countdown STRINGS — one source, two renderers.
 *
 * The real public hero (components/public/TournamentHomeContent.tsx) is a server
 * component reading live data; it cannot re-render per keystroke. The setup wizard's
 * live preview (components/admin/TournamentCreationPreview.tsx) is therefore a
 * purpose-built client mimic. The standing risk is that one drifts from the other and
 * the organizer is shown a page that never ships. Everything textual the two share
 * lives HERE so a wording change lands on both at once; tests/unit/tournament-hero-copy
 * pins the output.
 *
 * Pure + client-safe on purpose: no `new Date()` for "today" (callers pass
 * `tournamentToday()` in — see the date-correctness guardrail), no locale APIs (a
 * server render in UTC and a browser render in Toronto must produce the same string).
 */
import { daysBetweenDateStrings, parseDateOnlyParts } from './timezone';

/** The hero badge when an organizer has not committed to dates yet. */
export const HERO_DATES_TBD = 'Dates To Be Determined';

/** Default first-pitch wall-clock when no game has a start time yet. */
const DEFAULT_FIRST_PITCH_TIME = '09:00';

const LONG_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * The hero badge's date range: "August 8 - August 10, 2026", or both years when the
 * event crosses a New Year ("December 30, 2026 - January 2, 2027"). Falls back to
 * {@link HERO_DATES_TBD} until BOTH dates exist.
 *
 * Deliberately not `formatEventDateRange` (lib/timezone.ts) — that one is the coach
 * portal's compact "Aug 14–16" form. The hero speaks long months; both formatters are
 * single-sourced, they just serve different surfaces.
 */
export function formatHeroDateRange(
  start: string | null | undefined,
  end: string | null | undefined,
): string {
  const s = parseDateOnlyParts(start);
  const e = parseDateOnlyParts(end);
  if (!s || !e) return HERO_DATES_TBD;

  const sMonthDay = `${LONG_MONTHS[s.m - 1]} ${s.d}`;
  const eMonthDay = `${LONG_MONTHS[e.m - 1]} ${e.d}`;
  if (s.y === e.y) return `${sMonthDay} - ${eMonthDay}, ${e.y}`;
  return `${sMonthDay}, ${s.y} - ${eMonthDay}, ${e.y}`;
}

/**
 * The badge's lifecycle line — "12 days to go" / "Tournament in progress" /
 * "Tournament complete". Empty string until both dates exist (the badge then shows the
 * date range alone). `today` is a `YYYY-MM-DD` in the ORG's zone: callers pass
 * `tournamentToday()` rather than letting this derive a day from the runtime clock.
 */
export function heroCountdownText(
  start: string | null | undefined,
  end: string | null | undefined,
  today: string,
): string {
  if (!start || !end) return '';
  if (today < start) {
    const days = daysBetweenDateStrings(today, start);
    return `${days} days to go`;
  }
  if (today >= start && today <= end) return 'Tournament in progress';
  return 'Tournament complete';
}

/**
 * The live countdown's single-largest-unit duration — "41 days", "6 hours", "8 minutes".
 * Plain words beat "41d 19h": the hours are noise that far out, and granularity tightens
 * on its own as the event nears. Rendered by components/public/Countdown.tsx (the real
 * hero AND the wizard preview both mount that component, so this stays one behaviour).
 */
export function formatCountdownDuration(ms: number): string {
  const totalMin = Math.floor(ms / 60_000);
  const days = Math.floor(totalMin / 1440);
  const hours = Math.floor((totalMin % 1440) / 60);
  const mins = totalMin % 60;
  if (days >= 1) return `${days} day${days === 1 ? '' : 's'}`;
  if (hours >= 1) return `${hours} hour${hours === 1 ? '' : 's'}`;
  // Floor at one minute so the last seconds read "1 minute", not "0 minutes" — and
  // pluralise off the CLAMPED value (the pre-extraction version tested the raw one and
  // printed "1 minutes" in the final minute before first pitch).
  const shownMins = Math.max(mins, 1);
  return `${shownMins} minute${shownMins === 1 ? '' : 's'}`;
}

/**
 * The ISO instant the "First pitch in …" countdown targets: the first scheduled game's
 * start, or 9 AM on the given day when nothing is scheduled yet (the wizard preview is
 * always in that second case — a draft has no games). `time` may arrive as "HH:MM" or
 * "HH:MM:SS"; normalised so the ISO string is always parseable (an invalid one makes
 * Countdown render nothing at all).
 */
export function heroFirstPitchISO(
  date: string | null | undefined,
  time?: string | null,
): string | null {
  if (!date) return null;
  return `${date}T${time ? time.slice(0, 5) : DEFAULT_FIRST_PITCH_TIME}:00`;
}

/**
 * The hero's third stat when divisions are not all age-style: the event's length in
 * calendar days, inclusive of both ends (Aug 8–10 = 3). Null until both dates exist.
 */
export function tournamentDayCount(
  start: string | null | undefined,
  end: string | null | undefined,
): number | null {
  if (!start || !end) return null;
  return Math.max(1, daysBetweenDateStrings(start, end) + 1);
}
