/**
 * lib/demo-coach-reconcile-core.ts — the coach sandbox's nightly re-anchor, as pure logic.
 *
 * The coach demo is three teams frozen at three moments (`lib/demo-coach.ts`), and only the
 * CALENDAR moves: the 11U's tryout must always be TODAY, the 12U's next game always THIS
 * Saturday. Nothing ticks minute-to-minute (deliberately — the chrome makes no motion claims),
 * so unlike the tournament reconcile this runs nightly, and its whole job is date arithmetic:
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
  resolveTryoutDayState, resolveMidSeasonState,
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
): Promise<void> {
  const { data, error } = await db.from('rep_program_years')
    .select('year').eq('team_id', teamId).in('status', statuses as string[]);
  if (error) throw new Error(error.message);
  if (!data?.some((y: { year: number }) => y.year === wantYear)) {
    throw new Error(`${label} program year ${wantYear} not found — the calendar rolled over; run the seed`);
  }
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
    tryoutShiftDays: 0, midSeasonShiftDays: 0,
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
    await assertProgramYearLabel(db, teamId, ['draft', 'active'], state.year, '12U');
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
  } catch (err) {
    fail(`mid-season: ${err instanceof Error ? err.message : String(err)}`);
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

  const siblings = (events ?? []).filter((e: { id: string }) => e.id !== anchorEventId);
  const anchor = (events ?? []).filter((e: { id: string }) => e.id === anchorEventId);
  const shiftEvent = (event: { starts_at: string; ends_at: string | null }) => ({
    starts_at: shiftIsoDays(event.starts_at, days),
    ends_at: event.ends_at ? shiftIsoDays(event.ends_at, days) : null,
  });

  return (
    await shiftRows(db, 'rep_team_events', anchor, 'starts_at', shiftEvent)
  ) + (
    await shiftRows(db, 'rep_team_events', siblings, 'starts_at', shiftEvent)
  ) + (
    await shiftRows(db, 'rep_player_dues_installments', installments ?? [], 'due_date',
      (i: { due_date: string; paid_at: string | null }) => ({
        due_date: addCalendarDays(i.due_date, days),
        paid_at: i.paid_at ? shiftIsoDays(i.paid_at, days) : null,
      }))
  );
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
  const staleEvaluators = (evaluators ?? []).filter((e: { expires_at: string }) => e.expires_at !== expiry);

  return (
    await shiftRows(db, 'rep_tryout_sessions', sessions, 'starts_at', session => ({
      starts_at: shiftIsoDays(session.starts_at, days),
      ends_at: session.ends_at ? shiftIsoDays(session.ends_at, days) : null,
    }))
  ) + (
    await shiftRows(db, 'rep_tryout_registrations', registrations ?? [], 'submitted_at',
      (r: { submitted_at: string; consent_at: string | null; checked_in_at: string | null }) => ({
        submitted_at: shiftIsoDays(r.submitted_at, days),
        consent_at: r.consent_at ? shiftIsoDays(r.consent_at, days) : null,
        checked_in_at: r.checked_in_at ? shiftIsoDays(r.checked_in_at, days) : null,
      }))
  ) + (
    await shiftRows(db, 'rep_tryout_evaluator_sessions', staleEvaluators, 'expires_at',
      () => ({ expires_at: expiry }))
  );
}
