// Attendance receipts — "which sessions is this number made of?" — PURE, no I/O, no React.
//
// Insights Reports Portal P2 (COACH_INSIGHTS_REPORTS_PORTAL_PLAN.md §3 P2.1). The Attendance report
// shows every player two fractions; this turns a fraction back into the records that produced it.
//
// ── ⚠ THIS IS A RECEIPT, NOT A RANKING (owner ruling, 2026-08-19) ──────────────
// The mockup this phase was built from had the table SORTABLE with a "Missed most practices" badge
// on a named child. The owner ruled against both: the table keeps roster order and wears no flag,
// because a support read that orders children by who turns up least is a leaderboard however
// neutrally it is drawn — the same family as `memory/decision_playing_time_vocabulary.md`
// (measurement in context, never a verdict) and the Development report's "checklist, never a
// ranking". Naming the least-reliable player stays the job of ONE sentence in "What stands out",
// which fires only above a tracked-sessions bar.
//
// So this module returns rows keyed by player and **sorts nothing by absence count**. If a future
// caller wants "worst first", that is a decision to re-open with the owner, not a `.sort()` to add.
//
// ── What may and may not be counted ──────────────────────────────────────────
//   • "Missed" is a recorded ABSENCE. A no-reply is NOT an absence — the coach never marked the
//     player either way, and counting silence against a child is the single most damaging thing
//     this report could get wrong. This is the same rule the season roll-up applies, which is why
//     the receipts can never contradict the fraction they explain.
//   • Late counts as attended, not missed. Same as the roll-up.
//   • Cancelled events are the caller's job to exclude (`getRepTeamAttendanceMarks` already does,
//     with the same filter the roll-up uses).
//   • A mark for someone not on the supplied roster is dropped: an unnamed receipt is no receipt.
//
// ── No window ────────────────────────────────────────────────────────────────
// Deliberately UNLIKE `lib/coach-practice-misses.ts`, which judges the most recent N practices
// because "who's missed the most lately" is a question about lately. This explains a SEASON
// fraction, so it must cover the same season — a windowed list under a season number would be a
// list that visibly fails to add up.
//
// Relative import WITH the .ts extension so the unit tests run under plain `node --test`.
import { sameWeekdayAcross } from './coach-practice-misses.ts';

export type AttendanceMarkStatus = 'unknown' | 'attending' | 'absent' | 'late';

/**
 * The ONE rule for what a mark counts toward — `known` excludes no-reply (nobody was ever marked
 * either way, so it carries no reliability signal), `attended` treats late as present.
 *
 * ⚠ This rule has a twin in `lib/db.ts`'s `getRepTeamAttendanceReliability` (the per-player season
 * roll-up), written inline there rather than sourced from here — that function predates this module
 * and isn't touched by callers of this one. If either rule changes, check the other; they must never
 * quietly disagree about what "known" or "attended" means for the same mark.
 */
export function classifyAttendanceMark(status: AttendanceMarkStatus): { known: boolean; attended: boolean } {
  if (status === 'attending' || status === 'late') return { known: true, attended: true };
  if (status === 'absent') return { known: true, attended: false };
  return { known: false, attended: false }; // 'unknown' — no reply, never counted against anyone
}

/** One recorded attendance mark on one event. */
export interface AttendanceMarkRecord {
  eventId: string;
  /** The event's calendar day in the ORG'S zone, `YYYY-MM-DD`. */
  day: string;
  /** How the receipt names it, e.g. "vs Thunder" or "Tuesday practice". Caller supplies the words. */
  label: string;
  /** Which of the report's two columns this event belongs to. */
  kind: 'game' | 'practice';
  playerId: string;
  status: AttendanceMarkStatus;
}

export interface AttendanceReceiptPlayer { id: string }

/** One missed session — a receipt line. */
export interface AttendanceAbsence {
  eventId: string;
  day: string;
  label: string;
  kind: 'game' | 'practice';
}

export interface AttendanceReceipt {
  playerId: string;
  /** Recorded absences, MOST RECENT FIRST. Empty for a player who has missed nothing. */
  absences: AttendanceAbsence[];
  /**
   * Weekday name when EVERY absence falls on the same one (and there are ≥2), else null.
   *
   * The one piece of interpretation here, and it earns its place: "all four are Tuesdays" is a
   * scheduling fact a coach can act on (a clashing lesson, a shared ride) where four scattered
   * dates are just four dates. It describes the CALENDAR, never the child.
   */
  sameWeekday: string | null;
}

export interface AttendanceReceiptsInput {
  records: AttendanceMarkRecord[];
  /** Active roster. A mark for anyone else is ignored. */
  players: AttendanceReceiptPlayer[];
}

/**
 * Every player's absences, keyed by player id. Players with nothing missed are PRESENT with an
 * empty list — the report offers the same affordance on every row, so every row needs an answer.
 */
export function computeAttendanceReceipts(input: AttendanceReceiptsInput): Map<string, AttendanceReceipt> {
  const { records, players } = input;
  const out = new Map<string, AttendanceReceipt>();
  for (const p of players) out.set(p.id, { playerId: p.id, absences: [], sameWeekday: null });

  // Newest first, so absences land in receipt order without a second sort. The eventId tie-break
  // matters for two sessions on one calendar day (a double-header, a practice after a game): the
  // query has no ORDER BY, so without it the two would arrive in whatever order Postgres returned.
  const ordered = [...records]
    .filter(r => r.day && r.status === 'absent')
    .sort((a, b) => b.day.localeCompare(a.day) || b.eventId.localeCompare(a.eventId));

  for (const r of ordered) {
    const row = out.get(r.playerId);
    if (!row) continue; // not on the roster we were given — an unnamed receipt is no receipt
    row.absences.push({ eventId: r.eventId, day: r.day, label: r.label, kind: r.kind });
  }

  // ⚠ ONE definition of "a pattern", shared with `coach-practice-misses` — the two ask the same
  // question of the same kind of list, and a season's answer must not disagree with a window's.
  for (const row of out.values()) row.sameWeekday = sameWeekdayAcross(row.absences.map(a => a.day));

  return out;
}
