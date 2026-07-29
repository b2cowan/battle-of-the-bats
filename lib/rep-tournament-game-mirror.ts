import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import {
  getMergedTournamentHistoryForRepTeam,
  getRegistrationGamesForTeam,
} from './basic-coach-teams';
import {
  planTournamentGameMirror,
  decideOrphanFate,
  type ExistingMirrorRow,
} from './tournament-game-mirror';
import { captureError } from './observability/capture';

/**
 * lib/rep-tournament-game-mirror.ts — real tournament games become first-class team events
 * (Coach Portal Launch Batch 4, P0 #2). The IO half; the reconcile RULES are pure and unit-tested
 * in `lib/tournament-game-mirror.ts`.
 *
 * THE PROBLEM. Attendance (`rep_team_event_attendance`) and lineups (`rep_team_lineups`) can only
 * attach to a `rep_team_events` row. A team's REAL platform tournament game is a tournament-side
 * `games` row reached through its registration, so it had nothing to hang tools on and could only
 * render as a read-only chip. For many teams tournament games ARE the season.
 *
 * THE ANSWER. Mirror each dated tournament game into a `rep_team_events` row tagged with
 * `source_tournament_game_id` (mig 207). Every consumer in the portal ALREADY accepts
 * `event_type='tournament_game'` — the lineups list + save route, the attendance reliability
 * rollup, the canonical record rule (`WRAPPED_RECORD_EVENT_TYPES`), the Overview anchors, Season
 * Wrapped, and the club admin's past-year record — so all of them start working with zero changes.
 *
 * SEASON SCOPE + THE CLOSED-SEASON RULE. Callers resolve the program year through
 * `getActiveRepProgramYear` (`draft|active` only), so a CLOSED season can never be synced into —
 * Batch 3's "no writes against a closed season" holds by construction rather than by a new check.
 * Within the active year, `resolveSeasonFloor` drops games played before the season began.
 */

/** Games are read through the SAME reveal rules the read-only chip used (accepted registration,
 *  published division, opponents resolved from accepted teams only) — `getRegistrationGamesForTeam`
 *  owns that contract for both bridges. Nothing here widens it. */

/**
 * The season's start marker: a game played before this season began belongs to the one that closed.
 *
 * ⚠ THE FLOOR ONLY EXISTS TO SEPARATE CONSECUTIVE SEASONS. Program years carry no start/end date,
 * only a `created_at`, and that instant is often WELL AFTER the season actually started — an org
 * admin sets a team up mid-season, or a team upgrades to Premium in March. Applying a floor to a
 * team's FIRST season would silently drop every tournament game it had already played, with no
 * error and no way to notice. So: no earlier season ⇒ no floor at all. Once a prior season exists,
 * the floor is this year's `created_at` (passed in — the caller already holds the resolved program
 * year), softened by the earliest event already in the year: if the coach has entered something
 * before that instant, the season demonstrably reaches back that far.
 *
 * Residual, accepted: a team whose SECOND season row was created months after that season began,
 * and whose coach entered no events of their own, can still miss already-played games. Rare, and
 * strictly better than the alternative of resurrecting the previous season into the new record.
 */
async function resolveSeasonFloor(
  teamId: string,
  programYearId: string,
  programYearCreatedAt: string | null,
): Promise<string | null> {
  const [{ data: priorYears, error: priorError }, { data: earliest, error: earliestError }] =
    await Promise.all([
      supabaseAdmin.from('rep_program_years').select('id').eq('team_id', teamId).neq('id', programYearId).limit(1),
      supabaseAdmin.from('rep_team_events').select('starts_at').eq('program_year_id', programYearId)
        .order('starts_at', { ascending: true }).limit(1).maybeSingle(),
    ]);
  // A failed lookup must not silently tighten the floor (which drops games) — fail open, no floor.
  if (priorError || earliestError) return null;
  if ((priorYears ?? []).length === 0) return null;

  const days = [
    programYearCreatedAt?.slice(0, 10),
    (earliest?.starts_at as string | undefined)?.slice(0, 10),
  ].filter(Boolean) as string[];
  return days.length === 0 ? null : days.sort()[0];
}

/**
 * Which of these events carry coach work in a child table — i.e. which must never be deleted.
 *
 * Covers EVERY table with an FK to `rep_team_events.id`, not only the cascading ones: an award or
 * an expense is `ON DELETE SET NULL`, so deleting the event doesn't destroy the row but DOES
 * silently sever "which game this was for". A coach who gave a player an award on a tournament
 * game has touched it, even if they never took attendance.
 */
async function loadChildWorkEventIds(eventIds: string[]): Promise<Set<string>> {
  if (eventIds.length === 0) return new Set();
  const results = await Promise.all([
    supabaseAdmin.from('rep_team_event_attendance').select('event_id').in('event_id', eventIds),
    supabaseAdmin.from('rep_team_lineups').select('event_id').in('event_id', eventIds),
    supabaseAdmin.from('rep_team_event_tags').select('event_id').in('event_id', eventIds),
    supabaseAdmin.from('rep_player_awards').select('event_id').in('event_id', eventIds),
    supabaseAdmin.from('rep_team_expenses').select('event_id').in('event_id', eventIds),
  ]);
  const out = new Set<string>();
  for (const result of results) {
    // A failed lookup must read as "this event HAS work" — the safe direction is never deleting.
    if (result.error) {
      for (const id of eventIds) out.add(id);
      continue;
    }
    for (const row of (result.data ?? []) as { event_id: string }[]) out.add(row.event_id);
  }
  return out;
}

/**
 * Best-effort debounce, sized to the ONE thing it is for: a page-set (Overview + Schedule +
 * Lineups) hits the shared events read several times within a couple of seconds, and that should
 * cost one reconcile, not three.
 *
 * Deliberately short. A longer window would mean a coach who reloads after hearing "the game
 * moved" still sees the old time — the exact failure this whole batch exists to avoid — and the
 * reconcile is cheap (a handful of indexed reads that short-circuit entirely for a team with no
 * tournament). Per-process by nature (serverless instances each keep their own), which only ever
 * costs an extra reconcile, never correctness.
 */
const lastSyncedAt = new Map<string, number>();
const DEBOUNCE_MS = 10_000;

/** Anything older than the window is provably dead weight — drop it so the map can't grow for the
 *  life of the process, one entry per program year ever synced by this instance. */
function pruneDebounceMap(now: number): void {
  for (const [key, at] of lastSyncedAt) {
    if (now - at >= DEBOUNCE_MS) lastSyncedAt.delete(key);
  }
}

export interface MirrorSyncResult {
  created: number;
  updated: number;
  cancelled: number;
  deleted: number;
  skipped?: 'debounced';
}

/**
 * Reconcile a team's mirrored tournament games for one season. Awaited by its callers — never
 * fire-and-forget: `after()` has no waitUntil bridge on Amplify, so post-response work can silently
 * never run.
 */
export async function syncTournamentGameMirror(params: {
  repTeamId: string;
  programYearId: string;
  /** The season row's `created_at` — every caller already holds the resolved program year. */
  programYearCreatedAt?: string | null;
  orgId: string;
  /** Skip the debounce — for tests and any caller that must observe the result immediately. */
  force?: boolean;
}): Promise<MirrorSyncResult> {
  const { repTeamId, programYearId, orgId } = params;
  const now = Date.now();
  const last = lastSyncedAt.get(programYearId);
  if (!params.force && last != null && now - last < DEBOUNCE_MS) {
    return { created: 0, updated: 0, cancelled: 0, deleted: 0, skipped: 'debounced' };
  }
  pruneDebounceMap(now);
  lastSyncedAt.set(programYearId, now);

  const [{ history }, existingRes] = await Promise.all([
    getMergedTournamentHistoryForRepTeam(repTeamId),
    supabaseAdmin
      .from('rep_team_events')
      .select('id, source_tournament_game_id, name, starts_at, location, opponent, home_away, team_score, opponent_score, result, status, arrival_time, uniform, field_number, description, resources')
      .eq('program_year_id', programYearId)
      .not('source_tournament_game_id', 'is', null),
  ]);
  if (existingRes.error) throw existingRes.error;
  const existing = (existingRes.data ?? []) as unknown as ExistingMirrorRow[];

  // The overwhelmingly common case — a team with no tournament participation and nothing mirrored —
  // returns here having paid three cheap indexed reads and nothing else. The season floor is
  // deliberately NOT resolved above: it is only consumed by the plan, which this return skips.
  if (history.length === 0 && existing.length === 0) {
    return { created: 0, updated: 0, cancelled: 0, deleted: 0 };
  }

  const [sourceGames, seasonFloor] = await Promise.all([
    history.length > 0 ? getRegistrationGamesForTeam(history) : Promise.resolve([]),
    resolveSeasonFloor(repTeamId, programYearId, params.programYearCreatedAt ?? null),
  ]);
  if (sourceGames.length === 0 && existing.length === 0) {
    return { created: 0, updated: 0, cancelled: 0, deleted: 0 };
  }

  const plan = planTournamentGameMirror(sourceGames, existing, { seasonFloor });

  // ── Write phase ─────────────────────────────────────────────────────────────
  // Every write's `{ error }` is inspected. supabase-js RESOLVES on failure rather than throwing,
  // so an unchecked call fails silently — and a silently-failed update means a rescheduled game
  // never moves on the coach's calendar, which is the one promise this whole batch makes. Failures
  // are collected so partial progress still lands, then raised together for `captureError`.
  const failures: string[] = [];
  const record = (label: string) => ({ error }: { error: { message?: string } | null }) => {
    if (error) failures.push(`${label}: ${error.message ?? 'unknown error'}`);
  };

  const [childWork] = await Promise.all([
    // The orphans' child-work lookup and the inserts are independent — one reads existing rows,
    // the other writes brand-new ones — so they run together rather than in code order.
    plan.orphans.length > 0
      ? loadChildWorkEventIds(plan.orphans.map(o => o.id))
      : Promise.resolve(new Set<string>()),
    // ONE STATEMENT PER ROW, deliberately: Postgres aborts an entire multi-row INSERT on a single
    // conflict, so a batch containing one game a concurrent sync already inserted would silently
    // drop every OTHER new game with it. Per-row, a collision costs only that row — and `23505`
    // on it is the outcome we wanted (the row exists), not a failure.
    ...plan.inserts.map(row =>
      supabaseAdmin.from('rep_team_events').insert({
        ...row,
        program_year_id: programYearId,
        team_id: repTeamId,
        org_id: orgId,
        event_type: 'tournament_game',
      }).then(({ error }) => {
        if (error && error.code !== '23505') {
          failures.push(`insert ${row.source_tournament_game_id}: ${error.message}`);
        }
        return error ? 0 : 1;
      }),
    ),
  ]);

  const toCancel: string[] = [];
  let deleteCandidates: ExistingMirrorRow[] = [];
  for (const orphan of plan.orphans) {
    const fate = decideOrphanFate(orphan, childWork.has(orphan.id));
    if (fate === 'cancel') toCancel.push(orphan.id);
    else if (fate === 'delete') deleteCandidates.push(orphan);
  }

  await Promise.all([
    // Per-row rather than one batched upsert, deliberately: an upsert keyed on `id` would RE-CREATE
    // a row deleted concurrently (by an earlier orphan pass or another instance), resurrecting a
    // game the organizer removed. These run concurrently, so it is one round trip of wall-clock.
    ...plan.updates.map(u =>
      supabaseAdmin.from('rep_team_events').update(u.fields).eq('id', u.id).then(record(`update ${u.id}`)),
    ),
    toCancel.length > 0
      ? supabaseAdmin.from('rep_team_events').update({ status: 'cancelled' }).in('id', toCancel)
          .then(record('cancel'))
      : Promise.resolve(),
  ]);

  // ── Deletes go LAST, and re-decide from a FRESH read ────────────────────────
  // Attendance / lineup / tag rows cascade with the event, so a delete is the only irreversible
  // thing this reconcile does. The child-work read above happened before the writes; a coach can
  // save attendance in that gap, get a success response, and have it cascaded away. Re-reading
  // immediately before deleting closes almost all of that window, and the per-column guards on the
  // statement itself close the rest for anything written onto the event row.
  let deleted = 0;
  if (deleteCandidates.length > 0) {
    const freshChildWork = await loadChildWorkEventIds(deleteCandidates.map(o => o.id));
    deleteCandidates = deleteCandidates.filter(o => !freshChildWork.has(o.id));
    await Promise.all(deleteCandidates.map(o =>
      supabaseAdmin.from('rep_team_events').delete()
        .eq('id', o.id)
        // Atomic: if the coach set any of these between our read and this statement, the row no
        // longer matches and survives untouched.
        .is('arrival_time', null).is('uniform', null).is('field_number', null).is('description', null)
        .then(({ error }) => {
          if (error) failures.push(`delete ${o.id}: ${error.message}`);
          else deleted += 1;
        }),
    ));
  }

  if (failures.length > 0) {
    throw new Error(`tournament-game mirror: ${failures.length} write(s) failed — ${failures.join('; ')}`);
  }

  return {
    created: plan.inserts.length,
    updated: plan.updates.length,
    cancelled: toCancel.length,
    deleted,
  };
}

/**
 * The read-path wrapper every caller should use: never throws, never blocks the page it hangs off.
 * A tournament-side read failing is not a reason a coach can't see their own schedule.
 */
export async function syncTournamentGameMirrorSafely(
  params: Parameters<typeof syncTournamentGameMirror>[0],
): Promise<MirrorSyncResult | null> {
  try {
    return await syncTournamentGameMirror(params);
  } catch (error) {
    await captureError(error, {
      route: 'rep-tournament-game-mirror',
      requestContext: { repTeamId: params.repTeamId, programYearId: params.programYearId },
    });
    return null;
  }
}
