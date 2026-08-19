// Practice misses — "Who's missed the most practices?" — PURE, no I/O, no React.
//
// Ask the Front Office, Phase A (ASK_FRONT_OFFICE_PLAN.md).
//
// The season roll-up already behind Roster → Attendance answers "how reliable is everyone" with
// two ratios per player. It cannot answer THIS question, because the answer has to carry receipts:
// the coach is told a name and a number, and must be able to see the four specific practices that
// produced it. So this works from the individual records, not the totals.
//
// ── What it may and may not count ────────────────────────────────────────────
//   • "Missed" is a recorded ABSENCE. A no-reply is not an absence — the coach never marked the
//     player either way, and counting silence against a child is the single most damaging thing
//     this question could get wrong. `known` therefore excludes no-reply, exactly as the season
//     roll-up does, and the two can never disagree because they apply the same rule.
//   • Late counts as attended, not missed. Same as the roll-up.
//   • Cancelled events are the caller's job to exclude (the query already filters to scheduled).
//
// ── Why a window ─────────────────────────────────────────────────────────────
// A coach asking this in August means "lately", not "since April". The window is the most recent
// N practices THE TEAM tracked; a player marked for fewer than all of them reports their own
// smaller denominator, so a mid-season joiner is never described as having missed practices that
// happened before they arrived.
//
// Relative imports WITH the .ts extension so the unit tests run under plain `node --test`.
import { ATTENDANCE_MIN_KNOWN } from './insight-findings.ts';

/** One recorded attendance mark on one practice. */
export interface PracticeAttendanceRecord {
  eventId: string;
  /** The practice's calendar day in the ORG'S zone, `YYYY-MM-DD`. */
  day: string;
  /** How the receipt names it, e.g. "Tuesday practice". */
  label: string;
  playerId: string;
  status: 'unknown' | 'attending' | 'absent' | 'late';
}

export interface PracticeMissPlayer { id: string; name: string }

export interface PracticeMissRow {
  playerId: string;
  name: string;
  /** Recorded absences inside the window. */
  missed: number;
  /** Practices in the window where this player got a definite yes/no. Excludes no-reply. */
  known: number;
  /** The absences themselves, most recent first — the receipts. */
  absences: { eventId: string; day: string; label: string }[];
  /** Weekday name when EVERY absence falls on the same one (and there are ≥2), else null. */
  sameWeekday: string | null;
}

export interface PracticeMissRanking {
  /** Most missed first. Players with zero absences are included, at the bottom. */
  rows: PracticeMissRow[];
  /** Practices inside the window — the team-level denominator. */
  windowPractices: number;
  /** Oldest / newest day in the window. `windowFrom` names the stretch in the full-attendance
   *  sentence; `windowTo` is kept as its pair so a caller never has to re-derive one end. */
  windowFrom: string | null;
  windowTo: string | null;
  /** True when the leader has enough tracked sessions to be worth naming (shared portal bar). */
  reliable: boolean;
}

/** How many recent practices "lately" means. Six ≈ three weeks of a twice-weekly team. */
export const PRACTICE_WINDOW = 6;

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Weekday of a `YYYY-MM-DD` calendar day. Computed from the parts through UTC rather than
 * `new Date(string)`, so the answer can't shift with the runtime's zone — production runs in UTC
 * and a coach's device does not.
 */
export function weekdayOfDay(day: string): string | null {
  return weekdayOfDayImpl(day);
}

/**
 * The weekday EVERY one of these days shares, or null — the "all four are Tuesdays" rule.
 *
 * ⚠ Shared rather than written twice: `lib/coach-attendance-receipts.ts` asks the same question of a
 * season's absences that this module asks of a window's, and the two must never disagree about what
 * counts as a pattern. **Fewer than two days is never a pattern** — one absence on a Tuesday says
 * nothing about Tuesdays, and that guard is the whole reason this is a rule and not a `map`.
 */
export function sameWeekdayAcross(days: string[]): string | null {
  if (days.length < 2) return null;
  const names = days.map(weekdayOfDayImpl);
  const first = names[0];
  return first && names.every(n => n === first) ? first : null;
}

function weekdayOfDayImpl(day: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return isNaN(d.getTime()) ? null : WEEKDAYS[d.getUTCDay()];
}

export interface PracticeMissInput {
  /** Attendance marks on PRACTICE events only — the caller filters by event type. */
  records: PracticeAttendanceRecord[];
  /** Active roster; a mark for someone not here is ignored (an unnamed receipt is no receipt). */
  players: PracticeMissPlayer[];
  /** How many recent practices to judge. Defaults to {@link PRACTICE_WINDOW}. */
  windowSize?: number;
}

export function computePracticeMisses(input: PracticeMissInput): PracticeMissRanking {
  const { records, players } = input;
  const windowSize = input.windowSize ?? PRACTICE_WINDOW;
  const nameById = new Map(players.map(p => [p.id, p.name]));

  // Distinct practices, newest first. A practice exists here only if somebody was marked on it.
  const dayByEvent = new Map<string, { day: string; label: string }>();
  for (const r of records) {
    if (!r.day) continue;
    if (!dayByEvent.has(r.eventId)) dayByEvent.set(r.eventId, { day: r.day, label: r.label });
  }
  const allPractices = [...dayByEvent.entries()]
    .map(([eventId, v]) => ({ eventId, ...v }))
    .sort((a, b) => b.day.localeCompare(a.day) || b.eventId.localeCompare(a.eventId));

  const windowEvents = allPractices.slice(0, windowSize);
  const windowIds = new Set(windowEvents.map(e => e.eventId));

  const rows: PracticeMissRow[] = players.map(p => ({
    playerId: p.id, name: p.name, missed: 0, known: 0, absences: [], sameWeekday: null,
  }));
  const rowById = new Map(rows.map(r => [r.playerId, r]));

  // Newest first, so absences land in receipt order without a second sort.
  const ordered = [...records]
    .filter(r => windowIds.has(r.eventId))
    .sort((a, b) => b.day.localeCompare(a.day) || b.eventId.localeCompare(a.eventId));

  for (const r of ordered) {
    const row = rowById.get(r.playerId);
    if (!row || !nameById.has(r.playerId)) continue;
    if (r.status === 'unknown') continue; // no reply is not evidence, in either direction
    row.known += 1;
    if (r.status !== 'absent') continue;
    row.missed += 1;
    row.absences.push({ eventId: r.eventId, day: r.day, label: r.label });
  }

  for (const row of rows) row.sameWeekday = sameWeekdayAcross(row.absences.map(a => a.day));

  rows.sort((a, b) => b.missed - a.missed || b.known - a.known || a.name.localeCompare(b.name));

  const leader = rows[0];
  // Enough tracked sessions to name someone. The bar is the portal-wide one, except on a team
  // that simply hasn't held four practices yet — there, all the evidence there is IS all the
  // evidence there is. The `> 0` guards are load-bearing: without them a season with nothing
  // recorded reports "reliable" because zero clears a bar of zero.
  const minKnown = Math.min(ATTENDANCE_MIN_KNOWN, windowEvents.length);
  return {
    rows,
    windowPractices: windowEvents.length,
    windowFrom: windowEvents.length ? windowEvents[windowEvents.length - 1].day : null,
    windowTo: windowEvents.length ? windowEvents[0].day : null,
    reliable: !!leader && windowEvents.length > 0 && leader.known > 0 && leader.known >= minKnown,
  };
}
