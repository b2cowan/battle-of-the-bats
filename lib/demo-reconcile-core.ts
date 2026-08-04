import type { SupabaseClient } from '@supabase/supabase-js';
import { getDemoOrgByKind, DEMO_TOURNAMENT_SLUG } from './demo-org.ts';
import {
  resolveDemoState, demoBracketSeeds, DEMO_BRACKET_CODES, DEMO_DIVISIONS, ROUND_ROBIN_PAIRS,
  type DemoState,
} from './demo-tournament.ts';

/**
 * lib/demo-reconcile.ts — drag the demo tournament back to the state the clock implies.
 *
 * This is the whole "keep it live" mechanism, and it is ONE operation rather than the three the
 * plan originally imagined (a tick, a reset loop, a nightly date re-anchor). Because
 * `resolveDemoState(now)` is a pure function of the clock — dates included — those three are the
 * same job looked at over different timescales:
 *
 *   • run it two minutes apart and it looks like a TICK (the live score has moved on);
 *   • run it either side of a cycle boundary and it looks like a RESET (everything is back at
 *     the top of the story);
 *   • run it tomorrow and it looks like a DATE RE-ANCHOR (the event is "today" again).
 *
 * The properties that matter operationally:
 *
 *   • **Self-healing.** It never asks where the demo got to; it computes where it should be and
 *     writes that. A run that was missed, timed out, or died halfway is repaired by the next one.
 *     There is no cursor to get stuck on — the failure mode behind a frozen "live" demo, which is
 *     worse than no demo at all.
 *   • **Idempotent.** Running it twice in the same minute writes the same values twice.
 *   • **Diff-only.** It compares before writing, so a steady state costs zero writes and the
 *     returned summary is a truthful account of what actually changed.
 *   • **Stateless.** No cursor table, no job row — and therefore no migration.
 *
 * It writes with the service-role client DIRECTLY rather than through the app's scoring service,
 * which is deliberate: the app's write paths fire notifications, and a demo org must never
 * contact anyone. (`lib/notify.ts` and `lib/fan-notify.ts` would refuse it anyway — that is the
 * independent second guarantee — but the right thing is not to reach for the trigger at all.)
 *
 * The database client is a PARAMETER rather than an import so this one implementation serves both
 * callers: the scheduled route (which passes `supabaseAdmin`) and the command-line tick used in
 * development (which passes its own service-role client). The alternative — importing the app's
 * admin client here — would have made the module unreachable from a plain Node script and left
 * the two paths to drift apart, which for a self-healing job is exactly the wrong risk.
 */

/** The database handle. Typed as the real client so every query here is checked, not `any`. */
export type DemoReconcileDb = SupabaseClient;

export interface DemoReconcileResult {
  ok: boolean;
  /** Null when the sandbox is not seeded in this environment — not an error. */
  phase: DemoState['phase'] | null;
  minuteInCycle: number | null;
  eventDate: string | null;
  gamesExamined: number;
  gamesUpdated: number;
  /** Human-readable one-liners for the audit log — what actually moved, not what was checked. */
  changes: string[];
  errors: string[];
}

interface GameRow {
  id: string;
  division_id: string;
  home_team_id: string | null;
  away_team_id: string | null;
  bracket_code: string | null;
  game_date: string | null;
  game_time: string | null;
  status: string;
  home_score: number | null;
  away_score: number | null;
  is_playoff: boolean;
}

/**
 * The heartbeat this job writes ITSELF, once it has actually run.
 *
 * Migration 183's scheduler wrapper heartbeats `demo_sandbox_tick` when it *dispatches* the HTTP
 * request. `pg_net` is fire-and-forget, so that row proves the database asked — never that the app
 * answered. The gap is not theoretical: on 2026-08-03 the demo sat a full two-hour cycle behind the
 * clock while `demo_sandbox_tick` reported a run one minute earlier, because the scheduler was
 * posting to a base URL that does not reach that environment. The platform-admin freshness panel
 * read green on a demo that was, to any visitor, a screenshot.
 *
 * Two halves, two rows. `demo_sandbox_tick` = asked. `demo_sandbox_reconcile` = arrived and did the
 * work. A widening gap between them names the failure precisely — the schedule is fine, the
 * delivery isn't — which is the one thing a single row could never say. Written here rather than in
 * the route so the command-line runner counts as an arrival too: what matters is that the demo's
 * clock moved, not who moved it.
 */
const ARRIVAL_HEARTBEAT_JOB = 'demo_sandbox_reconcile';

async function recordArrival(
  db: DemoReconcileDb,
  now: Date,
  status: 'ok' | 'error',
  errorDetail: string | null,
): Promise<void> {
  try {
    await db.from('observability_cron_heartbeat').upsert(
      {
        job_name: ARRIVAL_HEARTBEAT_JOB,
        // Only a run that actually reconciled moves the clock forward — migration 183's discipline.
        // A failure records the reason and leaves `last_run_at` alone, so the chip goes stale
        // rather than reporting a healthy failure.
        ...(status === 'ok' ? { last_run_at: now.toISOString() } : {}),
        status,
        error_detail: errorDetail,
      },
      { onConflict: 'job_name' },
    );
  } catch {
    // Never let bookkeeping fail the tick. A missed heartbeat costs visibility for one cycle; a
    // thrown one would cost the demo its clock, which is the thing being protected.
  }
}

/**
 * Stable identity for a pool game: a round-robin pairing occurs exactly once per division.
 *
 * Exported because the demo's verification scripts need the same key to match a database row to the
 * state the clock implies — and a second copy of this formula would let them disagree about which
 * row is which, which is the one thing a smoke test must never do.
 */
export function poolKeyFor(divisionName: string, homeTeamName: string, awayTeamName: string): string | null {
  const division = DEMO_DIVISIONS.find(d => d.name === divisionName);
  if (!division) return null;
  const index = ROUND_ROBIN_PAIRS.findIndex(([h, a]) =>
    division.teams[h]?.name === homeTeamName && division.teams[a]?.name === awayTeamName);
  return index === -1 ? null : `RR-${divisionName}-${index}`;
}

export async function reconcileDemoTournament(
  db: DemoReconcileDb,
  now: Date = new Date(),
): Promise<DemoReconcileResult> {
  const empty: DemoReconcileResult = {
    ok: true, phase: null, minuteInCycle: null, eventDate: null,
    gamesExamined: 0, gamesUpdated: 0, changes: [], errors: [],
  };

  const demoOrg = getDemoOrgByKind('tournament');
  if (!demoOrg) return { ...empty, errors: ['no tournament demo org registered'], ok: false };

  const { data: org, error: orgError } = await db
    .from('organizations').select('id').eq('slug', demoOrg.slug).maybeSingle();
  if (orgError) return { ...empty, ok: false, errors: [`org lookup: ${orgError.message}`] };
  // Not seeded here (e.g. a fresh environment). Nothing to do, and not a failure — a missing
  // sandbox must not page anybody at 3am.
  if (!org) return empty;

  const { data: tournament, error: tournamentError } = await db
    .from('tournaments').select('id, start_date, end_date')
    .eq('org_id', org.id).eq('slug', DEMO_TOURNAMENT_SLUG).maybeSingle();
  if (tournamentError) return { ...empty, ok: false, errors: [`tournament lookup: ${tournamentError.message}`] };
  if (!tournament) return empty;

  const [{ data: divisions }, { data: teams }, { data: games }] = await Promise.all([
    db.from('divisions').select('id, name').eq('tournament_id', tournament.id),
    db.from('teams').select('id, name').eq('tournament_id', tournament.id),
    db.from('games')
      .select('id, division_id, home_team_id, away_team_id, bracket_code, game_date, game_time, status, home_score, away_score, is_playoff')
      .eq('tournament_id', tournament.id)
      .returns<GameRow[]>(),
  ]);

  if (!divisions?.length || !teams?.length || !games?.length) {
    return { ...empty, ok: false, errors: ['demo tournament is missing divisions, teams or games — reseed it'] };
  }

  const divisionName = new Map(divisions.map(d => [d.id as string, d.name as string]));
  const teamName = new Map(teams.map(t => [t.id as string, t.name as string]));
  const teamIdByName = new Map(teams.map(t => [t.name as string, t.id as string]));

  const state = resolveDemoState(now);
  const desiredByKey = new Map(state.games.map(g => [g.key, g]));

  // The Final's home slot: unresolved until the semifinal ends, then the top seed. That slot
  // filling in IS the "the bracket fills itself in" beat, so it is reconciled explicitly rather
  // than left to whatever the row happens to hold.
  const topSeedName = demoBracketSeeds()[0]?.name;
  const topSeedId = topSeedName ? teamIdByName.get(topSeedName) ?? null : null;

  const changes: string[] = [];
  const errors: string[] = [];
  let updated = 0;

  for (const game of games) {
    const key = game.bracket_code
      ?? poolKeyFor(
        divisionName.get(game.division_id) ?? '',
        teamName.get(game.home_team_id ?? '') ?? '',
        teamName.get(game.away_team_id ?? '') ?? '',
      );
    if (!key) continue;
    const desired = desiredByKey.get(key);
    if (!desired) continue;

    const patch: Record<string, unknown> = {};
    if (game.game_date !== desired.date) patch.game_date = desired.date;
    if ((game.game_time ?? '').slice(0, 8) !== desired.time) patch.game_time = desired.time;
    if (game.status !== desired.status) patch.status = desired.status;
    if (game.home_score !== desired.homeScore) patch.home_score = desired.homeScore;
    if (game.away_score !== desired.awayScore) patch.away_score = desired.awayScore;

    // A completed game needs the provenance a real completed game carries, or the admin score
    // screens show a result with no submission trail. A reverted one must lose it again.
    if (desired.status === 'completed' && game.status !== 'completed') {
      patch.score_submission_source = 'admin_results';
      patch.score_submitted_at = now.toISOString();
    } else if (desired.status !== 'completed' && game.status === 'completed') {
      patch.score_submission_source = null;
      patch.score_submitted_at = null;
    }

    if (key === DEMO_BRACKET_CODES.FIN) {
      const desiredHome = state.finalIsSeeded ? topSeedId : null;
      if (game.home_team_id !== desiredHome) {
        patch.home_team_id = desiredHome;
        changes.push(desiredHome
          ? `Final seeded — "Winner SF1" resolved to ${topSeedName}`
          : 'Final reset to "Winner SF1"');
      }
    }

    if (Object.keys(patch).length === 0) continue;

    const { error } = await db.from('games').update(patch).eq('id', game.id);
    if (error) {
      errors.push(`${key}: ${error.message}`);
      continue;
    }
    updated++;
    if (patch.home_score !== undefined || patch.status !== undefined) {
      changes.push(`${key} → ${desired.status} ${desired.homeScore ?? '-'}–${desired.awayScore ?? '-'}`);
    }
  }

  // Keep the event's own window honest, or the tournament header and every date range around it
  // drift away from the games underneath them.
  const poolDates = state.games.filter(g => g.key.startsWith('RR-')).map(g => g.date).sort();
  const startDate = poolDates[0] ?? state.eventDate;
  if (tournament.start_date !== startDate || tournament.end_date !== state.eventDate) {
    const { error } = await db.from('tournaments')
      .update({ start_date: startDate, end_date: state.eventDate })
      .eq('id', tournament.id);
    if (error) errors.push(`tournament window: ${error.message}`);
    else changes.push(`event window → ${startDate} … ${state.eventDate}`);
  }

  // Only heartbeat where a sandbox actually exists. An environment with nothing seeded returns
  // early above and never reaches here, so it grows no freshness chip for a demo it doesn't run.
  await recordArrival(db, now, errors.length === 0 ? 'ok' : 'error', errors.join('; ') || null);

  return {
    ok: errors.length === 0,
    phase: state.phase,
    minuteInCycle: state.minuteInCycle,
    eventDate: state.eventDate,
    gamesExamined: games.length,
    gamesUpdated: updated,
    changes,
    errors,
  };
}
