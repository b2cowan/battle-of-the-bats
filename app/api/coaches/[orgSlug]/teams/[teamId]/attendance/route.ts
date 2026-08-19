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
export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachTeamRead(orgSlug, teamId);
  if ('error' in resolved) return resolved.error;
  const { capabilities, programYear } = resolved;
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

  const [players, reliability, marks] = await Promise.all([
    getRepRosterPlayers(programYear.id),
    getRepTeamAttendanceReliability(programYear.id),
    // Not fetched at all when it may not be shown — a read made and then discarded is how the next
    // change accidentally renders it.
    canReadReceipts ? getRepTeamAttendanceMarks(programYear.id) : Promise.resolve([]),
  ]);

  const active = players.filter(p => p.status === 'active');

  // One day-key per EVENT, not per mark. `orgDayKey` builds an Intl formatter on every call and
  // there is one mark per player per event — a full season was ~450 conversions of the same ~30
  // dates. (The same memo the retired Ask route carried, for the same query shape.)
  const dayByEvent = new Map<string, string>();
  const dayOf = (eventId: string, startsAt: string) => {
    let day = dayByEvent.get(eventId);
    if (day === undefined) { day = orgDayKey(startsAt); dayByEvent.set(eventId, day); }
    return day;
  };

  const records: AttendanceMarkRecord[] = marks.flatMap(m => {
    const kind = kindOf(m.eventType);
    // Neither a game nor a practice — the roll-up would not have counted it, so neither do we.
    if (!kind) return [];
    return [{
      eventId: m.eventId,
      day: dayOf(m.eventId, m.startsAt),
      // The words the receipt shows: the opponent when we know one, else the event's own name —
      // never a fabricated label. Same rule the position-recency assembly states for games.
      label: m.opponent ? `vs ${m.opponent}` : (m.eventName || (kind === 'practice' ? 'Practice' : 'Game')),
      kind,
      playerId: m.playerId,
      status: m.status,
    }];
  });

  const receipts = computeAttendanceReceipts({ records, players: active.map(p => ({ id: p.id })) });

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
  return NextResponse.json({ players: rows, receipts: canReadReceipts });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/attendance' });
