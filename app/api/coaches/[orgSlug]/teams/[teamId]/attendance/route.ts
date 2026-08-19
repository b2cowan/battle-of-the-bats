import { NextResponse } from 'next/server';
import {
  getRepRosterPlayers,
  getRepTeamAttendanceReliability,
  getRepTeamAttendanceMarks,
} from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { resolveCoachTeamRead } from '@/lib/coach-team-read';
import { denyUnless, canViewSchedule } from '@/lib/coach-capabilities';
import { computeAttendanceReceipts, type AttendanceMarkRecord } from '@/lib/coach-attendance-receipts';
import { computeMonthlyAttendance, type MonthlyAttendanceMark } from '@/lib/coach-monthly-attendance';
import { orgDayKey } from '@/lib/timezone';
import { ATTENDANCE_GAME_TYPES } from '@/lib/db';

const EMPTY_STAT = { attended: 0, known: 0, recorded: 0 };

/**
 * Which of the report's two columns an event belongs to — or null for anything that is neither.
 *
 * ⚠ **THE `null` BRANCH IS DEFENCE, NOT DEAD CODE.** `getRepTeamAttendanceMarks` already filters to
 * the roll-up's own two buckets, so in principle nothing else arrives. But the first version mapped
 * *anything non-practice* to `'game'` with no fallback, while the roll-up beside it explicitly skips
 * a type it does not recognise — so a single new event type, or any drift in that query's filter,
 * would put an absence in the receipts that the season fraction never counted. **The receipts
 * disagreeing with the number they explain is the single most damaging thing this report can do**
 * (its module header says so), and it is not worth resting that on one query clause holding.
 */
const kindOf = (eventType: string): 'game' | 'practice' | null => {
  if (eventType === 'practice') return 'practice';
  return ATTENDANCE_GAME_TYPES.includes(eventType) ? 'game' : null;
};

/**
 * Season attendance reliability for the whole active roster (Coaches Portal Phase 4 F3).
 * Gated on the attendance duty (A1, 2026-08-03 — it was roster view, back when names were a
 * grantable thing). Attendance is not guardian PII. Active players with no recorded
 * attendance come back with zeroed stats so the view can show them as "not tracked yet".
 *
 * ⚠ **IT ALSO CARRIES THE RECEIPTS** (Reports Portal P2, 2026-08-19): the specific sessions behind
 * every fraction, so a coach can open any row and see what the number is made of. They ride this
 * existing call rather than a second endpoint because the payload is small (a season's absences for
 * one roster is tens of rows, not thousands) and because a drill-in that fetches on click has a
 * spinner where the answer should be — and, more importantly, a per-click fetch is a second place
 * for the counting rules to be applied and to drift from the totals beside them. One read, one rule.
 */
export const GET = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachTeamRead(orgSlug, teamId);
  if ('error' in resolved) return resolved.error;
  const { capabilities, programYear } = resolved;
  // ⚠⚠ OPT-IN, same shape as `lib/team-season-analytics.ts`'s `?recency=1` (Reports Portal P2) —
  // this route has a SECOND caller besides the Insights Attendance tab (the team Overview page's
  // attendance tile), which reads only `players` and never touches `monthly`. Fetching marks
  // unconditionally made that caller pay for a query its own response discards, on the highest-
  // traffic coach screen. Only the caller that wants the chart asks for it.
  const wantsMonthly = new URL(req.url).searchParams.get('monthly') === '1';
  // A1 (2026-08-03): was `canViewRoster` — attendance rode roster visibility because the report
  // lists players by name, and names were grantable. They are baseline now, so this gates on the
  // duty the screen is actually for. A helper holds no attendance grant, so it stays shut for them.
  const denied = denyUnless(capabilities.attendance, 'You do not have access to attendance. Ask the head coach to grant it.');
  if (denied) return denied;

  /**
   * ⚠⚠ **THE RECEIPTS TAKE THE SCHEDULE'S GATE AS WELL AS ATTENDANCE'S, AND THE FRACTIONS DO NOT.**
   *
   * `attendance` and `schedule` are independently grantable, and a coach can hold the first without
   * the second. The season fractions this route has always returned are pure attendance facts —
   * names and counts — and stay on the attendance grant alone.
   *
   * The RECEIPTS are different: each line carries an event's DATE and NAME (`vs Thunder`), so across
   * a roster they enumerate the season's opponents and calendar. That is schedule content, and this
   * codebase already decided how to treat a second door onto it — `season-results` gates on
   * `hasRecordAccess(...) && canViewSchedule(...)` precisely because it is "a second entry point to
   * facts the schedule read has always gated", and the events list is `canViewSchedule` too.
   * Shipping the receipts on the attendance grant alone would have handed an attendance-only
   * assistant the whole season's fixture list through a report about turnout.
   *
   * ⚠ It withholds the RECEIPTS, never the report — an attendance-only coach keeps every number.
   * And it is reported as a FLAG rather than by sending empty lists, because "no absences" and "not
   * allowed to see them" must never render as the same sentence.
   */
  const canReadReceipts = canViewSchedule(capabilities);
  // Marks are read whenever EITHER downstream consumer needs them — receipts (schedule-gated, as
  // always) or the opted-in monthly chart (schedule-blind — see `lib/coach-monthly-attendance.ts`'s
  // header for why that read is safe without `canReadReceipts`). Neither alone forces the fetch for
  // a caller that wants only the season fractions.
  const needsMarks = canReadReceipts || wantsMonthly;

  const [players, reliability, marks] = await Promise.all([
    getRepRosterPlayers(programYear.id),
    getRepTeamAttendanceReliability(programYear.id),
    needsMarks ? getRepTeamAttendanceMarks(programYear.id) : Promise.resolve([]),
  ]);

  const active = players.filter(p => p.status === 'active');
  const activeIds = new Set(active.map(p => p.id));

  // One day-key per EVENT, not per mark. `orgDayKey` builds an Intl formatter on every call and
  // there is one mark per player per event — a full season was ~450 conversions of the same ~30
  // dates. (The same memo the retired Ask route carried, for the same query shape.)
  const dayByEvent = new Map<string, string>();
  const dayOf = (eventId: string, startsAt: string) => {
    let day = dayByEvent.get(eventId);
    if (day === undefined) { day = orgDayKey(startsAt); dayByEvent.set(eventId, day); }
    return day;
  };

  // ONE pass over `marks` builds both downstream inputs — each mark's kind/day is classified once
  // rather than twice. `records` (per-event, carries a date and an opponent-derived label) is gated
  // on `canReadReceipts`; `monthlyMarks` (schedule-blind, gating decision 2b — see
  // `lib/coach-monthly-attendance.ts`) is not.
  const records: AttendanceMarkRecord[] = [];
  const monthlyMarks: MonthlyAttendanceMark[] = [];
  for (const m of marks) {
    const kind = kindOf(m.eventType);
    if (!kind) continue; // neither a game nor a practice — the roll-up would not have counted it either
    const day = dayOf(m.eventId, m.startsAt);
    // ⚠ ACTIVE ROSTER ONLY — same scope every other figure on this route uses (`rows` below is
    // built from `active`, and `computeAttendanceReceipts` silently drops anyone else it's handed).
    // Without this, a released/inactive player's history quietly inflated the month totals while
    // being invisible everywhere else on the same screen — the season tiles and this chart would
    // disagree about the same team for no reason a coach could see.
    if (wantsMonthly && activeIds.has(m.playerId)) {
      monthlyMarks.push({ month: day.slice(0, 7), kind, status: m.status });
    }
    // ⚠ Gated, not just built-then-discarded — `records` carries a date and an opponent-derived
    // label, which is schedule content P2's review closed off from a coach without that grant.
    if (canReadReceipts) {
      records.push({
        eventId: m.eventId,
        day,
        // The words the receipt shows: the opponent when we know one, else the event's own name —
        // never a fabricated label. Same rule the position-recency assembly states for games.
        label: m.opponent ? `vs ${m.opponent}` : (m.eventName || (kind === 'practice' ? 'Practice' : 'Game')),
        kind,
        playerId: m.playerId,
        status: m.status,
      });
    }
  }

  const receipts = computeAttendanceReceipts({ records, players: active.map(p => ({ id: p.id })) });
  const monthly = computeMonthlyAttendance(monthlyMarks);

  const rows = active.map(p => {
    const r = reliability.get(p.id);
    const receipt = receipts.get(p.id);
    return {
      playerId: p.id,
      playerFirstName: p.playerFirstName,
      playerLastName: p.playerLastName,
      games: r?.games ?? EMPTY_STAT,
      practices: r?.practices ?? EMPTY_STAT,
      absences: receipt?.absences ?? [],
      sameWeekday: receipt?.sameWeekday ?? null,
    };
  });

  // `receipts` says whether the drill-in is available AT ALL. Without it the panel could not tell
  // "this player missed nothing" from "you may not see what they missed", and would say the first.
  return NextResponse.json({ players: rows, receipts: canReadReceipts, monthly });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/attendance' });
