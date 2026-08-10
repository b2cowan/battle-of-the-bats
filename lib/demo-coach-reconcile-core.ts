/**
 * lib/demo-coach-reconcile-core.ts — the coach sandbox's nightly re-anchor, as pure logic.
 *
 * The coach demo is five teams frozen at five moments (`lib/demo-coach.ts`), and only the
 * CALENDAR moves: the 11U's tryout must always be TODAY, the 12U's next game always THIS
 * Saturday, the 10U always two weeks into its year, the 14U's winter always the same distance
 * from a season that hasn't started. Nothing ticks minute-to-minute (deliberately — the chrome
 * makes no motion claims), so unlike the tournament reconcile this runs nightly, and its whole
 * job is date arithmetic:
 *
 *   · Stateless and diff-only, same discipline as `lib/demo-reconcile-core.ts`: the desired
 *     dates are a pure function of the clock; rows are read first and written only when they
 *     disagree. A missed night is not a missed step — the next run lands on the right dates.
 *   · Shifts preserve WALL-CLOCK time, not instants: a 09:00 game stays a 09:00 game across a
 *     DST boundary (shifting raw epoch ms would quietly turn it into 08:00 for half the year).
 *   · The 13U's closed season is FIXED to last calendar year and is deliberately not touched
 *     here. When the year rolls over it needs its season rebuilt — that is the seed's job, and
 *     this module's job is to NOTICE and say so loudly rather than half-fix it.
 *
 * Takes its DB client as a parameter so the scheduled route and a command-line run share one
 * implementation (`scripts/seed-demo-coach.mjs` remains the full reseed; this is the cheap
 * nightly pass between reseeds).
 */
import {
  DEMO_COACH_TEAMS,
  resolveTryoutDayState, resolveMidSeasonState, resolveOffSeasonState, resolveSeasonStartState,
  demoPaidStampIso, type OffSeasonState, type DemoExpense,
  orgDateWithOffset,
} from './demo-coach.ts';
import { getDemoOrgByKind } from './demo-org.ts';
import { recordSandboxArrival } from './demo-sandbox-heartbeat.ts';
import {
  zonedWallClockToUtc, utcToZonedInputs, addCalendarDays, daysBetweenDateStrings,
} from './timezone.ts';

/** The slice of a supabase client this module needs (same shape trick as DemoReconcileDb). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CoachDemoDb = { from: (table: string) => any };

export interface CoachReconcileResult {
  ok: boolean;
  /** False when the coach sandbox is not seeded in this environment — a normal no-op. */
  seeded: boolean;
  /** Whole days each team's world moved (0 = steady state). */
  tryoutShiftDays: number;
  midSeasonShiftDays: number;
  offSeasonShiftDays: number;
  seasonStartShiftDays: number;
  rowsShifted: number;
  errors: string[];
  notes: string[];
}

/**
 * The arrival heartbeat, written by the job itself once it has actually run — the scheduler's
 * own `coach_sandbox_tick` row only ever proves the database ASKED. One shared discipline for
 * every sandbox reconcile: see `lib/demo-sandbox-heartbeat.ts`.
 */
const ARRIVAL_HEARTBEAT_JOB = 'coach_sandbox_reconcile';

/** The team's open program year must carry the year the clock implies — else demand a reseed. */
async function assertProgramYearLabel(
  db: CoachDemoDb,
  teamId: string,
  statuses: readonly string[],
  wantYear: number,
  label: string,
): Promise<string> {
  const { data, error } = await db.from('rep_program_years')
    .select('id, year').eq('team_id', teamId).in('status', statuses as string[]);
  if (error) throw new Error(error.message);
  const match = (data as { id: string; year: number }[] | null)?.find(y => y.year === wantYear);
  if (!match) {
    throw new Error(`${label} program year ${wantYear} not found — the calendar rolled over; run the seed`);
  }
  // Returns the id as well: every caller needs it for the attendance sweep below, and looking it
  // up a second time would be a second chance for the two to disagree about which year is live.
  return match.id;
}

/** Shift an ISO instant by whole days, preserving its org-timezone wall clock across DST. */
function shiftIsoDays(iso: string, days: number): string {
  const { date, time } = utcToZonedInputs(iso);
  if (!date) return iso;
  return zonedWallClockToUtc(addCalendarDays(date, days), time || '00:00') ?? iso;
}

/**
 * Update every row of `table` with a per-row patch, all round trips in flight together — the
 * shift is uniform, so there is no ordering to respect, and the nightly run walks ~100 rows
 * under the route's 60s ceiling. Throws on the first error (the caller reports and the next
 * night's run repairs whatever landed short).
 *
 * Every write is CONDITIONAL on the value it read (`guard` names the column whose old value must
 * still hold). Two runs can overlap — the nightly cron and a super-admin pressing the tick by
 * hand — and both compute the SAME shift from the same clock; without the guard, a row whose
 * first write landed before the second run's read got shifted twice, and a double-shifted row
 * off the anchor never self-heals (the next night corrects the anchor and moves everything
 * uniformly, so a row that raced differently keeps its offset). With the guard, the loser's
 * write matches zero rows: concurrent same-shift runs are idempotent. A race against a RESEED
 * is out of scope by design — the seed rewrites every row it owns, and re-running it is the
 * repair for any interleaving (`scripts/seed-demo-coach.mjs`).
 */
async function shiftRows<T extends { id: string }>(
  db: CoachDemoDb,
  table: string,
  rows: readonly T[],
  guard: keyof T & string,
  patch: (row: T) => Record<string, unknown>,
): Promise<number> {
  const results = await Promise.all(rows.map(row =>
    db.from(table).update(patch(row)).eq('id', row.id).eq(guard, row[guard]),
  ));
  for (const { error } of results) {
    if (error) throw new Error(`${table}: ${error.message}`);
  }
  return rows.length;
}

export async function reconcileCoachSandbox(
  db: CoachDemoDb,
  now: Date = new Date(),
): Promise<CoachReconcileResult> {
  const result: CoachReconcileResult = {
    ok: true, seeded: false,
    tryoutShiftDays: 0, midSeasonShiftDays: 0, offSeasonShiftDays: 0, seasonStartShiftDays: 0,
    rowsShifted: 0, errors: [], notes: [],
  };
  const fail = (message: string) => { result.ok = false; result.errors.push(message); };

  const demoOrg = getDemoOrgByKind('coach');
  if (!demoOrg) return result; // not registered in this build — nothing to do, nothing to report

  const { data: org, error: orgError } = await db.from('organizations')
    .select('id').eq('slug', demoOrg.slug).maybeSingle();
  if (orgError) { fail(`org lookup: ${orgError.message}`); return result; }
  // Not seeded in this environment: a normal, successful no-op — the schedule is harmless to
  // run anywhere, and starts working the day the seed lands (mirrors reconcileDemoTournament).
  if (!org) return result;
  result.seeded = true;

  const today = orgDateWithOffset(now, 0);

  // ── 12U mid-season: the next game must be THIS Saturday ─────────────────────────────────────
  try {
    const teamId = DEMO_COACH_TEAMS.midSeason.id;
    const state = resolveMidSeasonState(now);
    const desired = state.saturdayDate;
    // Dates can be shifted; the program year's LABEL cannot — after Dec 31 the season name is
    // last year's until a reseed rebuilds it. Notice loudly instead of reporting a green tick
    // over a demo whose masthead says the wrong year (same treatment as the 13U check below).
    const pyId = await assertProgramYearLabel(db, teamId, ['draft', 'active'], state.year, '12U');
    const { data: games, error } = await db.from('rep_team_events')
      .select('id, starts_at')
      .eq('team_id', teamId).eq('event_type', 'league_game').is('result', null);
    if (error) throw new Error(error.message);
    if (!games || games.length !== 1) {
      // The seed guarantees exactly one unresulted game; anything else means the world needs a
      // rebuild, which is the seed's job — half-shifting it here would smear the damage around.
      throw new Error(`expected exactly 1 unresulted 12U game, found ${games?.length ?? 0} — run the seed`);
    }
    const current = utcToZonedInputs(games[0].starts_at).date;
    const shift = daysBetweenDateStrings(current, desired);
    result.midSeasonShiftDays = shift;
    if (shift !== 0) {
      result.rowsShifted += await shiftTeamSchedule(db, teamId, shift, games[0].id);
      result.notes.push(`12U shifted ${shift} day(s); game re-anchored to ${desired}`);
    }
    // The books, restated from the clock and OUTSIDE the shift gate — same argument as the 14U's
    // (a failure landing after the schedule moved would otherwise strand them permanently).
    result.rowsShifted += await restateExpenses(db, teamId, state.expenses);
    result.rowsShifted += await takeAttendanceForNewlyPastPractices(
      db, teamId, pyId, org.id, state.practices, today);
    result.rowsShifted += await clearAttendanceAtEventsStillAhead(db, pyId, today);
  } catch (err) {
    fail(`mid-season: ${err instanceof Error ? err.message : String(err)}`);
  }

  // ── 14U off-season: the winter keeps its distance from a season not yet started ─────────────
  try {
    const teamId = DEMO_COACH_TEAMS.offSeason.id;
    const state = resolveOffSeasonState(now);
    const pyId = await assertProgramYearLabel(db, teamId, ['draft', 'active'], state.year, '14U');
    const { data: events, error } = await db.from('rep_team_events')
      .select('id, starts_at, ends_at').eq('team_id', teamId)
      // `id` breaks ties. The anchor argument below requires the anchor's ROW IDENTITY to be
      // stable between runs, and without a tiebreaker two sessions sharing a `starts_at` could
      // come back in either order — which would let a retry anchor to a different row.
      .order('starts_at', { ascending: true }).order('id', { ascending: true });
    if (error) throw new Error(error.message);
    if (!events?.length) throw new Error('no 14U sessions found — run the seed');
    // The anchor is the FIRST session of the winter; the world module sorts its practices, so
    // the two sides of this comparison are the same row by construction.
    const current = utcToZonedInputs(events[0].starts_at).date;
    const shift = daysBetweenDateStrings(current, state.practices[0].date);
    result.offSeasonShiftDays = shift;
    if (shift !== 0) {
      result.rowsShifted += await shiftTeamSchedule(db, teamId, shift, events[0].id);
      result.notes.push(`14U shifted ${shift} day(s); winter re-anchored to ${state.practices[0].date}`);
    }
    // ⚠ The books and the budget phasing are RESTATED, not shifted, and they run OUTSIDE the
    // `shift !== 0` gate on purpose — this is the one place the delta approach could go silent.
    // Shifted by a delta computed from the SCHEDULE, a failure that landed after the schedule had
    // already moved would strand them for good: the next run reads a correct anchor, computes a
    // zero shift, skips them, and reports a clean green over books that never caught up. Derived
    // from the clock instead, every run reasserts the truth, so a bad night is repaired by the
    // next one rather than surviving until somebody notices the numbers are in the wrong month.
    result.rowsShifted += await restateOffSeasonBooks(db, teamId, state);
    result.rowsShifted += await rederiveBudgetPeriods(db, teamId, state.budgetPeriodDates);
    result.rowsShifted += await takeAttendanceForNewlyPastPractices(
      db, teamId, pyId, org.id, state.practices, today);
    result.rowsShifted += await clearAttendanceAtEventsStillAhead(db, pyId, today);
  } catch (err) {
    fail(`off-season: ${err instanceof Error ? err.message : String(err)}`);
  }

  // ── 10U season start: opening day stays two weeks behind ────────────────────────────────────
  try {
    const teamId = DEMO_COACH_TEAMS.seasonStart.id;
    const state = resolveSeasonStartState(now);
    const pyId = await assertProgramYearLabel(db, teamId, ['draft', 'active'], state.year, '10U');
    const { data: games, error } = await db.from('rep_team_events')
      .select('id, starts_at').eq('team_id', teamId).eq('event_type', 'league_game')
      // Tiebroken by id for the same reason as the 14U's anchor: a stable row, not just a date.
      .order('starts_at', { ascending: true }).order('id', { ascending: true }).limit(1);
    if (error) throw new Error(error.message);
    if (!games?.length) throw new Error('no 10U games found — run the seed');
    const current = utcToZonedInputs(games[0].starts_at).date;
    const shift = daysBetweenDateStrings(current, state.openingDate);
    result.seasonStartShiftDays = shift;
    if (shift !== 0) {
      // Opening day is the anchor, and it is a GAME — so this team's whole schedule (games,
      // practices) and its dues ride the same helper the 12U uses, anchor row first.
      result.rowsShifted += await shiftTeamSchedule(db, teamId, shift, games[0].id);
      result.notes.push(`10U shifted ${shift} day(s); opening day re-anchored to ${state.openingDate}`);
    }
    result.rowsShifted += await restateExpenses(db, teamId, state.expenses);
    result.rowsShifted += await takeAttendanceForNewlyPastPractices(
      db, teamId, pyId, org.id, state.practices, today);
    result.rowsShifted += await clearAttendanceAtEventsStillAhead(db, pyId, today);
  } catch (err) {
    fail(`season start: ${err instanceof Error ? err.message : String(err)}`);
  }

  // ── 11U tryout day: the first session must be TODAY ─────────────────────────────────────────
  try {
    const teamId = DEMO_COACH_TEAMS.tryoutDay.id;
    await assertProgramYearLabel(db, teamId, ['draft', 'active'], resolveTryoutDayState(now).year, '11U');
    const { data: sessions, error } = await db.from('rep_tryout_sessions')
      .select('id, starts_at, ends_at').eq('team_id', teamId).order('starts_at', { ascending: true });
    if (error) throw new Error(error.message);
    if (!sessions?.length) throw new Error('no tryout sessions found — run the seed');
    const firstDate = utcToZonedInputs(sessions[0].starts_at).date;
    const shift = daysBetweenDateStrings(firstDate, today);
    result.tryoutShiftDays = shift;
    if (shift !== 0) {
      result.rowsShifted += await shiftTryoutWorld(db, teamId, sessions, shift, now);
      result.notes.push(`11U shifted ${shift} day(s); tryout re-anchored to ${today}`);
    }
  } catch (err) {
    fail(`tryout day: ${err instanceof Error ? err.message : String(err)}`);
  }

  // ── 13U season's end: noticing, not touching ────────────────────────────────────────────────
  try {
    const teamId = DEMO_COACH_TEAMS.seasonsEnd.id;
    const wantYear = Number(today.slice(0, 4)) - 1;
    const { data: years, error } = await db.from('rep_program_years')
      .select('year, status').eq('team_id', teamId).eq('status', 'completed');
    if (error) throw new Error(error.message);
    if (!years?.some((y: { year: number }) => y.year === wantYear)) {
      // Fires once a year, on purpose: the calendar rolled and "last season" is now two seasons
      // ago. The fix is a reseed (it rebuilds the closed year through the real lifecycle).
      throw new Error(`closed year ${wantYear} not found — the calendar rolled over; run the seed`);
    }
  } catch (err) {
    fail(`season's end: ${err instanceof Error ? err.message : String(err)}`);
  }

  await recordSandboxArrival(db, ARRIVAL_HEARTBEAT_JOB, now, result.ok ? 'ok' : 'error',
    result.ok ? null : result.errors.join('; '));
  return result;
}

/**
 * Shift every dated row of the 12U season: events, dues due-dates and their paid stamps.
 *
 * ⚠ THE ANCHOR MOVES FIRST, ALONE. The next run derives "how far to shift" from the one
 * unresulted game, so which side of a failure that row lands on decides what the retry does:
 *
 *   · Anchor moved LAST would be the trap — a mid-run failure leaves the anchor stale, the
 *     retry recomputes the SAME shift and re-applies it to siblings that already moved
 *     (the conditional guards compare against the retry's own fresh read, so they cannot tell
 *     "already shifted" from "never shifted"). Corruption would compound.
 *   · Anchor moved FIRST: if its own write fails, nothing moved — the retry is clean. If a
 *     LATER sibling write fails, the retry computes zero and touches nothing, so nothing ever
 *     double-shifts; the stale sibling is the alerted residual (`result.ok=false` pages), and
 *     the reseed is the one-command repair (`scripts/seed-demo-coach.mjs`).
 */
async function shiftTeamSchedule(db: CoachDemoDb, teamId: string, days: number, anchorEventId: string): Promise<number> {
  const { data: events, error: eventsError } = await db.from('rep_team_events')
    .select('id, starts_at, ends_at').eq('team_id', teamId);
  if (eventsError) throw new Error(eventsError.message);

  const { data: installments, error: duesError } = await db.from('rep_player_dues_installments')
    .select('id, due_date, paid_at').eq('team_id', teamId);
  if (duesError) throw new Error(duesError.message);

  // The client is deliberately untyped (`CoachDemoDb`), so name the row shapes here — otherwise
  // `shiftRows` infers T from the filter callbacks and the guard column stops typechecking.
  type EventRow = { id: string; starts_at: string; ends_at: string | null };
  type InstallmentRow = { id: string; due_date: string; paid_at: string | null };
  const allEvents = (events ?? []) as EventRow[];
  const siblings = allEvents.filter(e => e.id !== anchorEventId);
  const anchor = allEvents.filter(e => e.id === anchorEventId);
  const shiftEvent = (event: EventRow) => ({
    starts_at: shiftIsoDays(event.starts_at, days),
    ends_at: event.ends_at ? shiftIsoDays(event.ends_at, days) : null,
  });

  return (
    await shiftRows(db, 'rep_team_events', anchor, 'starts_at', shiftEvent)
  ) + (
    await shiftRows(db, 'rep_team_events', siblings, 'starts_at', shiftEvent)
  ) + (
    await shiftRows(db, 'rep_player_dues_installments', (installments ?? []) as InstallmentRow[], 'due_date',
      i => ({
        due_date: addCalendarDays(i.due_date, days),
        paid_at: i.paid_at ? shiftIsoDays(i.paid_at, days) : null,
      }))
  );
}

/**
 * RESTATE the 14U's books onto the dates the clock implies: what was spent and when, what is still
 * owed and when it falls due, and the winter's testing session with the readings taken at it.
 *
 * ⚠ **Restated from the world, not shifted by a delta — and that difference is the whole point.**
 * Every other family of rows here derives a delta from its own anchor and moves by it. The books
 * have no anchor of their own; shifted by the SCHEDULE's delta, they would inherit a failure mode
 * nothing could recover from: if a write here failed after the schedule had already moved, the
 * next run would read a correct schedule anchor, compute a zero shift, skip the books entirely,
 * and report success over books permanently a week behind. Absolute values remove the failure
 * class rather than documenting it — every run reasserts the truth, a bad night is repaired by the
 * next one, and no sequence of partial failures can double-apply anything.
 *
 * Expenses are matched to the world by DESCRIPTION, which is what the seed writes and what the
 * coach reads on screen; the world guarantees they are distinct.
 *
 * ⚠ The testing session and its readings are restated TOGETHER, always. `recorded_on` is stamped
 * from the session's date when a reading is typed, and the product re-stamps every reading
 * whenever the session date is edited (`restampRepSessionMeasurables`). Moving one side and not
 * the other would leave the session disagreeing with its own contents and every trend line
 * plotted on the wrong day — the exact defect that rule exists to prevent.
 */
async function restateOffSeasonBooks(
  db: CoachDemoDb,
  teamId: string,
  state: OffSeasonState,
): Promise<number> {
  const { data: sessions, error: sessionError } = await db
    .from('rep_team_evaluation_sessions').select('id, session_date').eq('team_id', teamId);
  if (sessionError) throw new Error(sessionError.message);

  type SessionRow = { id: string; session_date: string };

  let written = await restateExpenses(db, teamId, state.expenses);

  // The session, then its readings — the order the product's own re-stamp uses, so a failure
  // between them leaves the pair consistent on the OLD date rather than half-moved.
  for (const session of (sessions ?? []) as SessionRow[]) {
    if (session.session_date === state.testingSessionDate) continue;
    const { error } = await db.from('rep_team_evaluation_sessions')
      .update({ session_date: state.testingSessionDate }).eq('id', session.id);
    if (error) throw new Error(`rep_team_evaluation_sessions: ${error.message}`);
    written++;
    const { error: readingError, count } = await db.from('rep_player_measurables')
      .update({ recorded_on: state.testingSessionDate }, { count: 'exact' })
      .eq('session_id', session.id).neq('recorded_on', state.testingSessionDate);
    if (readingError) throw new Error(`rep_player_measurables: ${readingError.message}`);
    written += count ?? 0;
  }

  return written;
}

/**
 * Take attendance at any practice that has CROSSED INTO THE PAST since the last run.
 *
 * ── The defect this closes ───────────────────────────────────────────────────
 *
 * The seed decides `happened` once, at seed time, and writes attendance for exactly those events.
 * The re-anchor then shifts dates but creates nothing — so the first practice to cross the
 * midnight boundary after a seed became a session that had visibly taken place with **nobody
 * marked present or absent**. On the 10U that is a Thursday, so it happened weekly, and it read as
 * a coach who had forgotten to take the register: the single most damaging thing a demo of a
 * coaching product can accidentally depict.
 *
 * Found 2026-08-05 by the health check on the first morning it ran automatically — which is
 * precisely the argument for running it automatically (`DEMO_SANDBOX_DRIFT_GUARDS_PLAN.md`).
 *
 * ⚠ **Coverage is judged per PLAYER, not per event, and the write tolerates a lost race.** Both
 * matter, and the first draft got both wrong:
 *
 *   · Keying "already covered" on the event alone meant one attendance row — from any player —
 *     marked the whole event done for ever. A player added to the roster after an event was first
 *     covered would then keep an empty register permanently: the exact defect this function exists
 *     to close, reintroduced for a subset and never revisited.
 *   · A plain bulk `insert` is one atomic statement, and `rep_team_event_attendance` carries
 *     `UNIQUE(event_id, player_id)`. So if a concurrent run (the cron, a manual tick, and an
 *     arrival-triggered run can all overlap) had already committed rows for ONE event in the
 *     batch, the whole statement aborted — including rows for uncontested events — and the tick
 *     reported a failure and alerted a human over a race that had harmed nothing.
 *
 * `ignoreDuplicates` on the unique index turns that race into a quiet no-op, the same way
 * `createRepPlayerTryoutBaseline` does. Duplicate rows were never possible; a false alarm was.
 *
 * ⚠ Still writes nothing on a steady day: with no uncovered pair there are no rows, and the
 * statement is never issued at all.
 *
 * ⚠ Matched to the world by DATE, after the shift has landed — the same discipline the ledger uses
 * for descriptions. A practice the world no longer describes is left alone; the seed owns creation.
 */
async function takeAttendanceForNewlyPastPractices(
  db: CoachDemoDb,
  teamId: string,
  programYearId: string,
  orgId: string,
  practices: readonly { date: string; absent: readonly number[]; late: readonly number[] }[],
  today: string,
): Promise<number> {
  const [
    { data: events, error: eventError },
    { data: roster, error: rosterError },
  ] = await Promise.all([
    // ⚠ Scoped by PROGRAM YEAR, not just team. The roster and attendance reads below are, and a
    // team carrying a stale prior-year event row would otherwise have that row backfilled with
    // THIS year's attendance — history misfiled under the wrong season. Dormant today (each demo
    // team is seeded with one year) and cheap to make impossible.
    db.from('rep_team_events').select('id, starts_at, event_type')
      .eq('team_id', teamId).eq('program_year_id', programYearId),
    // Ordered server-side, with `id` breaking ties: the world's absent/late lists are plain
    // indexes into this array, so two players sharing (or missing) a display_order must not be
    // free to swap places between runs and mark the wrong child absent.
    db.from('rep_roster_players').select('id, display_order')
      .eq('program_year_id', programYearId).eq('status', 'active')
      .order('display_order', { ascending: true }).order('id', { ascending: true }),
  ]);
  if (eventError) throw new Error(eventError.message);
  if (rosterError) throw new Error(rosterError.message);

  type EventRow = { id: string; starts_at: string; event_type: string };
  type PlayerRow = { id: string; display_order: number | null };

  const past = ((events ?? []) as EventRow[])
    .filter(e => e.event_type === 'practice')
    .map(e => ({ ...e, date: utcToZonedInputs(e.starts_at).date }))
    .filter(e => e.date <= today);
  if (!past.length) return 0;

  const { data: existing, error: attendanceError } = await db
    .from('rep_team_event_attendance').select('event_id, player_id').eq('program_year_id', programYearId);
  if (attendanceError) throw new Error(attendanceError.message);
  // Per PAIR, not per event: an event with a register missing only the player who joined last
  // month is still an event with a player who has no register.
  const covered = new Set(((existing ?? []) as { event_id: string; player_id: string }[])
    .map(a => `${a.event_id}:${a.player_id}`));

  // Already ordered by the query above; the local sort is the tiebreak made explicit so the
  // mapping from world index → player cannot depend on row order coming back from PostgREST.
  const players = ((roster ?? []) as PlayerRow[])
    .slice()
    .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0) || a.id.localeCompare(b.id));
  const byDate = new Map(practices.map(p => [p.date, p]));

  const rows = past.flatMap(event => {
    const world = byDate.get(event.date);
    return players
      .map((player, i) => ({
        event_id: event.id, player_id: player.id,
        program_year_id: programYearId, team_id: teamId, org_id: orgId,
        // A practice the world does not describe still gets a register — a blank one is the defect.
        status: world?.absent.includes(i) ? 'absent' : world?.late.includes(i) ? 'late' : 'attending',
      }))
      .filter(row => !covered.has(`${row.event_id}:${row.player_id}`));
  });

  if (!rows.length) return 0; // the ordinary case — nothing crossed, so no statement is issued

  const { error } = await db.from('rep_team_event_attendance')
    .upsert(rows, { onConflict: 'event_id,player_id', ignoreDuplicates: true });
  if (error) throw new Error(`rep_team_event_attendance: ${error.message}`);
  return rows.length;
}

/**
 * Clear attendance from any event that has ROLLED INTO THE FUTURE — the mirror of
 * `takeAttendanceForNewlyPastPractices`, and the defect the first Sunday after the production
 * launch exposed (2026-08-10): the weekly +7 re-anchor moves last week's practices forward into
 * the COMING week, and their registers ride along, so the demo showed who attended a practice
 * that hasn't happened. The world's own rule is that the `-6..0` band "is allowed to flip" —
 * flipping must work in BOTH directions, and until this function it only worked one way.
 *
 * Same disciplines as its sibling: judged by DATE after the shift has landed, diff-only (a
 * steady day issues no statement), and safe against overlapping runs — both compute the same
 * boundary from the same clock, the two functions' event sets are disjoint (past vs future), and
 * a second deleter simply deletes zero rows.
 */
async function clearAttendanceAtEventsStillAhead(
  db: CoachDemoDb,
  programYearId: string,
  today: string,
): Promise<number> {
  const { data: events, error } = await db.from('rep_team_events')
    .select('id, starts_at').eq('program_year_id', programYearId);
  if (error) throw new Error(error.message);
  const aheadIds = ((events ?? []) as { id: string; starts_at: string }[])
    .filter(e => (utcToZonedInputs(e.starts_at).date ?? '') > today)
    .map(e => e.id);
  if (!aheadIds.length) return 0;

  const { error: deleteError, count } = await db.from('rep_team_event_attendance')
    .delete({ count: 'exact' })
    .eq('program_year_id', programYearId).in('event_id', aheadIds);
  if (deleteError) throw new Error(`rep_team_event_attendance: ${deleteError.message}`);
  return count ?? 0;
}

/**
 * Restate a team's ledger onto the dates the clock now implies.
 *
 * Absolute values, never a delta — see `restateOffSeasonBooks` above for why the books in
 * particular cannot be shifted by the schedule's delta without inventing a failure mode that
 * survives every subsequent run. Shared by three teams since Phase 3 (the 14U's winter, the 12U's
 * season, the 10U's first bills): a bill dated before the season it belongs to is the one thing a
 * money screen must never show, and it would otherwise happen on every one of them.
 *
 * Expenses are matched to the world by DESCRIPTION, which is what the seed writes and what the
 * coach reads on screen; the world guarantees they are distinct within a team.
 */
async function restateExpenses(
  db: CoachDemoDb,
  teamId: string,
  expenses: readonly DemoExpense[],
): Promise<number> {
  const { data, error } = await db.from('rep_team_expenses')
    .select('id, description, expense_paid_at, deposit_due_date, deposit_paid_at, balance_due_date, balance_paid_at')
    .eq('team_id', teamId);
  if (error) throw new Error(error.message);

  type ExpenseRow = {
    id: string; description: string;
    expense_paid_at: string | null;
    deposit_due_date: string | null; deposit_paid_at: string | null;
    balance_due_date: string | null; balance_paid_at: string | null;
  };

  /** The seed's own stamp, not a second spelling of it — see `demoPaidStampIso`. */
  const paidStamp = (date: string | null | undefined) => (date ? demoPaidStampIso(date) : null);
  /**
   * ⚠ Compare timestamps as INSTANTS, not strings. PostgREST hands back
   * `2026-06-21T20:00:00+00:00` where the world produces `2026-06-21T20:00:00.000Z` — the same
   * moment, spelled differently. String equality would call every row changed on every run and
   * rewrite the whole ledger nightly: identical data, but the "a steady day writes nothing"
   * contract quietly broken, and the row counts in the job's report rendered meaningless.
   */
  const sameInstant = (a: string | null, b: string | null) =>
    (a === null || b === null ? a === b : Date.parse(a) === Date.parse(b));

  const desiredByDescription = new Map(expenses.map(e => [e.description, e]));
  let written = 0;

  for (const row of (data ?? []) as ExpenseRow[]) {
    const want = desiredByDescription.get(row.description);
    // An expense the world no longer describes is not this job's to guess at — the seed owns
    // creation and deletion, and inventing dates for an unknown row would be the "confident lie"
    // the rest of this module is careful to avoid.
    if (!want) continue;
    const patch = {
      expense_paid_at: paidStamp(want.paidDate),
      deposit_due_date: want.deposit?.dueDate ?? null,
      deposit_paid_at: paidStamp(want.deposit?.paidDate),
      balance_due_date: want.balance?.dueDate ?? null,
      balance_paid_at: paidStamp(want.balance?.paidDate),
    };
    const unchanged = sameInstant(row.expense_paid_at, patch.expense_paid_at)
      && row.deposit_due_date === patch.deposit_due_date
      && sameInstant(row.deposit_paid_at, patch.deposit_paid_at)
      && row.balance_due_date === patch.balance_due_date
      && sameInstant(row.balance_paid_at, patch.balance_paid_at);
    if (unchanged) continue; // diff-only: a steady day writes nothing
    const { error: writeError } = await db.from('rep_team_expenses').update(patch).eq('id', row.id);
    if (writeError) throw new Error(`rep_team_expenses: ${writeError.message}`);
    written++;
  }

  return written;
}

/**
 * Re-derive the 14U's budget phasing onto the months the clock now implies.
 *
 * Budget periods are the only dated rows in the demo that are NOT shifted, because they are month
 * BUCKETS: sliding them a week at a time would land "August" on the 8th of September and then the
 * 15th, and the month grid this moment lands on would be labelled with months its amounts no
 * longer sit in. Same treatment as the tryout's evaluator expiry — computed, compared, written
 * only when it disagrees.
 *
 * Matching is by `sort_order` within each line, which is exactly how the seed wrote them and how
 * the product's own full-replace write orders them.
 */
async function rederiveBudgetPeriods(
  db: CoachDemoDb,
  teamId: string,
  desiredDates: readonly string[],
): Promise<number> {
  const { data: lines, error: lineError } = await db.from('rep_budget_lines')
    .select('id').eq('team_id', teamId);
  if (lineError) throw new Error(lineError.message);
  const lineIds = (lines ?? []).map((l: { id: string }) => l.id);
  if (!lineIds.length) return 0;

  const { data: periods, error: periodError } = await db.from('rep_budget_periods')
    .select('id, period_date, period_label, sort_order').in('budget_line_id', lineIds);
  if (periodError) throw new Error(periodError.message);

  type PeriodRow = { id: string; period_date: string | null; period_label: string; sort_order: number };
  const stale = ((periods ?? []) as PeriodRow[]).filter(p => {
    const desired = desiredDates[p.sort_order];
    return desired && (p.period_date !== desired || p.period_label !== desired.slice(0, 7));
  });
  if (!stale.length) return 0;

  return shiftRows(db, 'rep_budget_periods', stale, 'period_date', (p: PeriodRow) => ({
    period_date: desiredDates[p.sort_order],
    period_label: desiredDates[p.sort_order].slice(0, 7),
  }));
}

/** Shift the 11U tryout world: sessions, registration paper-trail, evaluator link lifetimes. */
async function shiftTryoutWorld(
  db: CoachDemoDb,
  teamId: string,
  sessions: Array<{ id: string; starts_at: string; ends_at: string | null }>,
  days: number,
  now: Date,
): Promise<number> {
  const { data: registrations, error: regError } = await db.from('rep_tryout_registrations')
    .select('id, submitted_at, consent_at, checked_in_at').eq('team_id', teamId);
  if (regError) throw new Error(regError.message);

  // Evaluator links: always live until tomorrow night, never expired mid-demo.
  const expiry = resolveTryoutDayState(now).evaluatorExpiryIso;
  const { data: evaluators, error: evalError } = await db.from('rep_tryout_evaluator_sessions')
    .select('id, expires_at').eq('team_id', teamId);
  if (evalError) throw new Error(evalError.message);
  type RegistrationRow = { id: string; submitted_at: string; consent_at: string | null; checked_in_at: string | null };
  type EvaluatorRow = { id: string; expires_at: string };
  const staleEvaluators = ((evaluators ?? []) as EvaluatorRow[]).filter(e => e.expires_at !== expiry);

  return (
    await shiftRows(db, 'rep_tryout_sessions', sessions, 'starts_at', session => ({
      starts_at: shiftIsoDays(session.starts_at, days),
      ends_at: session.ends_at ? shiftIsoDays(session.ends_at, days) : null,
    }))
  ) + (
    await shiftRows(db, 'rep_tryout_registrations', (registrations ?? []) as RegistrationRow[], 'submitted_at',
      r => ({
        submitted_at: shiftIsoDays(r.submitted_at, days),
        consent_at: r.consent_at ? shiftIsoDays(r.consent_at, days) : null,
        checked_in_at: r.checked_in_at ? shiftIsoDays(r.checked_in_at, days) : null,
      }))
  ) + (
    await shiftRows(db, 'rep_tryout_evaluator_sessions', staleEvaluators, 'expires_at',
      () => ({ expires_at: expiry }))
  );
}
