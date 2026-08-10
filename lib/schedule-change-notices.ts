import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { notifyFansForScheduleChange } from './fan-notify';
import { zonedWallClockToUtc } from './timezone';
import { captureError } from './observability';

/**
 * lib/schedule-change-notices.ts — "your game moved" (Free Coach Portal B2.3).
 *
 * THE GAP THIS CLOSES: a single-game schedule edit used to notify nobody — not the coach,
 * not the family who deliberately followed the team and turned alerts on. `notifyFansForGame`
 * only ever fired on a score. This module records person-visible changes to PUBLISHED games
 * and sends ONE batched push per affected team.
 *
 * TWO THINGS KEEP THE VOLUME HONEST:
 *  1. **The publish gate does most of the work.** A division whose `schedule_visibility` is not
 *     'published' produces no notice at all — nobody has been shown those times, so there is
 *     nothing to correct. The "organizer moves twenty games in ten minutes" case is almost
 *     entirely the schedule-BUILDING phase, and it is silent by construction.
 *  2. **A quiet window covers the rest.** The sweep holds a team's pending changes until they
 *     have been quiet for QUIET_WINDOW_MINUTES, then sends one message. An imminent game skips
 *     the wait — a 3:15 kickoff being announced at 3:10 is worse than useless.
 *
 * BINDING: a schedule-change alert is a SERVICE message. It carries no Premium ask on any
 * channel (pressure ladder, Business Decisions Log 2026-07-27). The plan gate lives in
 * fanPushContext; where an organizer's plan means we cannot send, we send nothing and say so
 * elsewhere — we never aim an upgrade prompt at a coach.
 */

/** How long a team's changes must be quiet before the batch goes out. */
const QUIET_WINDOW_MINUTES = 10;
/** Upper bound on holding: an organizer editing one game every 9 minutes can't stall a batch forever. */
const MAX_HOLD_MINUTES = 60;
/** A game starting within this window skips the quiet wait entirely. */
const URGENT_WINDOW_HOURS = 6;
/**
 * Minimum gap between two pushes to the SAME team, urgent or not.
 *
 * Without this the urgent lane has no memory: every 5-minute tick would independently decide a
 * game-day change is urgent and send, so eight edits across twenty minutes became four or five
 * separate buzzes to the same family — precisely the "one message, not twenty" promise this
 * module exists to keep. The first change still goes out immediately; everything after it
 * accumulates and lands as ONE follow-up once the cooldown expires.
 */
const REPEAT_SEND_COOLDOWN_MINUTES = 15;
/** How long the bulk rain-delay tool reserves for the organizer to post their own message. */
export const ORGANIZER_ANNOUNCE_HOLD_MINUTES = 10;
/** Safety rail on one sweep's blast radius; leftovers ride the next tick five minutes later. */
const MAX_NOTICES_PER_SWEEP = 2000;

/** Empty-slot sentinel some games use instead of NULL for an unassigned team. */
const NIL_UUID = '00000000-0000-0000-0000-000000000000';

// The change taxonomy + classifier live in lib/schedule-change-classify.ts (pure,
// unit-tested — this module is server-only and unreachable from the test runner).
// Re-exported so existing importers keep one import site.
import { classifyScheduleChange, type GameChangeKind, type GameScheduleSnapshot } from './schedule-change-classify';
export type { GameChangeKind, GameScheduleSnapshot } from './schedule-change-classify';

export interface GameChangeInput {
  gameId: string;
  divisionId: string | null;
  homeTeamId: string | null;
  awayTeamId: string | null;
  /** Who was in the game BEFORE the edit. When this differs from home/awayTeamId the edit
   *  restructured the matchup, and no "your game moved" message can be told truthfully — see
   *  `teamsChanged` in classify's caller. */
  beforeHomeTeamId?: string | null;
  beforeAwayTeamId?: string | null;
  before: GameScheduleSnapshot;
  after: GameScheduleSnapshot;
}

const classify = classifyScheduleChange;

export interface RecordedChanges {
  /** Queue rows created — hand these to supersedeScheduleChangeNotices if the organizer
   *  posts their own announcement covering the same games. */
  noticeIds: string[];
  /** Teams whose PUBLISHED schedule actually changed. This is the honest input for the
   *  game-day reminder re-sync (◆S1): it inherits the publish gate, so a draft schedule
   *  can't cause reminder emails to be scheduled ahead of publishing. */
  affectedTeamIds: string[];
}

/**
 * Record person-visible changes for a batch of games. Returns the created notice ids so a
 * caller that also offers the organizer their own announcement (the rain-delay hand-off) can
 * supersede them and keep a rain delay to one buzz.
 *
 * Best-effort by contract: never throws, so it can't fail the schedule edit that already
 * succeeded. A change we fail to record is a missed notification, not a broken save.
 */
export async function recordGameScheduleChanges(params: {
  orgId: string;
  tournamentId: string;
  changes: GameChangeInput[];
  /** Reserve a window for the organizer's own announcement before anything automatic sends. */
  holdMinutes?: number;
}): Promise<RecordedChanges> {
  const empty: RecordedChanges = { noticeIds: [], affectedTeamIds: [] };
  try {
    const candidates = params.changes
      .filter(c => {
        // An edit that ALSO reassigned the matchup can't be narrated as "your game moved":
        // the incoming team was never scheduled at the old time, and the outgoing team is no
        // longer in this game at all. Telling either of them a time is stating something
        // false, and a false notification is worse than none. Restructures stay silent; the
        // schedule itself still shows the truth.
        const teamsChanged =
          (c.beforeHomeTeamId !== undefined && c.beforeHomeTeamId !== c.homeTeamId) ||
          (c.beforeAwayTeamId !== undefined && c.beforeAwayTeamId !== c.awayTeamId);
        return !teamsChanged;
      })
      .map(c => ({ ...c, kind: classify(c.before, c.after) }))
      .filter((c): c is GameChangeInput & { kind: GameChangeKind } => c.kind !== null);
    if (candidates.length === 0) return empty;

    // The publish gate. A division that hasn't published its schedule has shown nobody these
    // times, so there is no expectation to correct. Games with no division fall through the
    // same way — they were never on a published division schedule either.
    const divisionIds = Array.from(
      new Set(candidates.map(c => c.divisionId).filter((d): d is string => typeof d === 'string' && d.length > 0)),
    );
    if (divisionIds.length === 0) return empty;
    const { data: divisions } = await supabaseAdmin
      .from('divisions')
      .select('id, schedule_visibility')
      .in('id', divisionIds);
    const published = new Set(
      (divisions ?? [])
        .filter((d: { id: string; schedule_visibility: string | null }) => d.schedule_visibility === 'published')
        .map((d: { id: string }) => d.id),
    );

    // Eligible immediately unless a caller reserves an announce window for the organizer.
    const holdUntil = new Date(
      Date.now() + Math.max(0, params.holdMinutes ?? 0) * 60 * 1000,
    ).toISOString();

    const rows: Record<string, unknown>[] = [];
    const affected = new Set<string>();
    for (const c of candidates) {
      if (!c.divisionId || !published.has(c.divisionId)) continue;
      const teamIds = [c.homeTeamId, c.awayTeamId].filter(
        (t): t is string => typeof t === 'string' && t.length > 0 && t !== NIL_UUID,
      );
      for (const teamId of teamIds) {
        affected.add(teamId);
        rows.push({
          org_id: params.orgId,
          tournament_id: params.tournamentId,
          team_id: teamId,
          game_id: c.gameId,
          kind: c.kind,
          // The state the follower last had reason to believe.
          was_date: c.before.date,
          was_time: c.before.time,
          was_location: c.before.location,
          hold_until: holdUntil,
        });
      }
    }
    if (rows.length === 0) return empty;

    const { data, error } = await supabaseAdmin
      .from('game_change_notices')
      .insert(rows)
      .select('id');
    if (error) throw error;
    return {
      noticeIds: (data ?? []).map((r: { id: string }) => r.id),
      affectedTeamIds: Array.from(affected),
    };
  } catch (err) {
    console.error('[schedule-change-notices] recordGameScheduleChanges failed (non-fatal):', err);
    void captureError(err, {
      route: 'lib/schedule-change-notices (record)',
      severity: 'warning',
      title: 'Schedule-change notice could not be queued',
      requestContext: { tournamentId: params.tournamentId, changeCount: params.changes.length },
    });
    return empty;
  }
}

/**
 * The organizer said it in their own words. Stand down the automatic notices for the games
 * their announcement covered, so a rain delay is one message and not two. Scoped to explicit
 * ids handed back by the reschedule that created them — never a blanket tournament sweep,
 * which would swallow an unrelated pending change.
 *
 * `tournamentId` is REQUIRED and is not decoration: the id list arrives from the client, and
 * the calling route only ever scope-checks the tournament it was given. Without this predicate
 * an org admin could pass notice ids belonging to ANOTHER org and silently suppress that org's
 * "your game moved" alerts to its own coaches and families. Ids that don't belong to the
 * caller's tournament simply don't match and are dropped.
 */
export async function supersedeScheduleChangeNotices(
  tournamentId: string,
  noticeIds: string[],
): Promise<number> {
  const ids = noticeIds.filter(id => typeof id === 'string' && id.length > 0);
  if (ids.length === 0 || !tournamentId) return 0;
  try {
    const { data, error } = await supabaseAdmin
      .from('game_change_notices')
      .update({ superseded_at: new Date().toISOString() })
      .in('id', ids)
      .eq('tournament_id', tournamentId)
      .is('sent_at', null)
      .is('superseded_at', null)
      .select('id');
    if (error) throw error;
    return (data ?? []).length;
  } catch (err) {
    console.error('[schedule-change-notices] supersede failed (non-fatal):', err);
    return 0;
  }
}

// ── the sweep ────────────────────────────────────────────────────────────────

interface NoticeRow {
  id: string;
  tournament_id: string;
  team_id: string;
  game_id: string;
  kind: GameChangeKind;
  was_date: string | null;
  was_time: string | null;
  was_location: string | null;
  created_at: string;
}

interface GameRow {
  id: string;
  game_date: string | null;
  game_time: string | null;
  location: string | null;
  status: string | null;
  home_team_id: string | null;
  away_team_id: string | null;
  division_id: string | null;
}

/** "Sat, Jul 18" — pinned to local noon-free midnight so a date-only string can't print a day early. */
function dateLabel(date: string | null): string | null {
  if (!date) return null;
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' });
}

/** "3:15 p.m." — a wall-clock value formatted in the locale it was parsed in. */
function timeLabel(time: string | null): string | null {
  if (!time) return null;
  return new Date(`1970-01-01T${time}`).toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' });
}

/** "Riverside U13" → "Riverside U13's"; "Riverside Reds" → "Riverside Reds'". Team names are
 *  coach-entered, so a naive `name + "'s"` produces "Reds's" often enough to notice.
 *  (Twin of the helper in CoachTournamentRecord; kept local because that one lives in a
 *  client component and this module is server-only.) */
function possessive(name: string): string {
  return /s$/i.test(name) ? `${name}’` : `${name}’s`;
}

/** "Sat Jul 18, 3:15 p.m. at Diamond 4" — whichever parts actually exist. */
function whenWhere(date: string | null, time: string | null, location: string | null, includeDate: boolean): string {
  const when = [includeDate ? dateLabel(date) : null, timeLabel(time)].filter(Boolean).join(', ');
  if (when && location) return `${when} at ${location}`;
  return when || location || 'a time to be confirmed';
}

/**
 * One entry per changed game: the LATEST state, measured against the EARLIEST baseline. Two
 * moves in one editing session read as one correction ("was 2:00 p.m."), not a history the
 * reader has to unpick — the same rule the in-portal bar follows.
 */
function collapse(notices: NoticeRow[], games: Map<string, GameRow>, stillPublished: Set<string>) {
  // Both picks are order-INDEPENDENT on purpose: the claim step returns rows from an
  // UPDATE … RETURNING, whose order Postgres does not guarantee. Relying on input order here
  // would silently pick the wrong "was" baseline.
  const byGame = new Map<string, { first: NoticeRow; last: NoticeRow }>();
  for (const n of notices) {
    const seen = byGame.get(n.game_id);
    if (!seen) { byGame.set(n.game_id, { first: n, last: n }); continue; }
    // Ties on created_at (two rows written by the same transaction) break on id, so the pick is
    // fully data-driven rather than falling back to iteration order.
    if (n.created_at < seen.first.created_at ||
        (n.created_at === seen.first.created_at && n.id < seen.first.id)) seen.first = n;
    if (n.created_at > seen.last.created_at ||
        (n.created_at === seen.last.created_at && n.id >= seen.last.id)) seen.last = n;
  }

  const entries: Array<{
    gameId: string;
    kind: GameChangeKind;
    was: { date: string | null; time: string | null; location: string | null };
    now: GameRow;
  }> = [];

  for (const [gameId, { first, last }] of byGame) {
    const game = games.get(gameId);
    if (!game) continue; // deleted between queue and sweep — nothing to announce

    // The publish gate is re-tested HERE, not just at enqueue time. An organizer who pulls a
    // division back to draft after making a change has deliberately hidden those times; sending
    // the queued alert anyway would publish exactly what they just withdrew.
    if (!game.division_id || !stillPublished.has(game.division_id)) continue;

    // Read the kind from the game's CURRENT state, not the queued one: a move followed by a
    // cancellation is a cancellation, and that self-heals whatever order the rows arrived in.
    let kind: GameChangeKind = last.kind;
    if (game.status === 'cancelled') kind = 'cancelled';
    else if (last.kind === 'cancelled') kind = 'restored'; // cancelled then reinstated

    // Already played, or the start time has passed — the message would arrive after the fact.
    if (['submitted', 'completed', 'forfeit'].includes(game.status ?? '')) continue;
    const startsAt = zonedWallClockToUtc(game.game_date, game.game_time);
    if (startsAt && new Date(startsAt).getTime() <= Date.now()) continue;

    // Moved and moved back inside one window: nothing to tell anyone.
    if (
      kind === 'moved' &&
      first.was_date === game.game_date &&
      first.was_time === game.game_time &&
      (first.was_location ?? null) === (game.location ?? null)
    ) continue;

    entries.push({
      gameId,
      kind,
      was: { date: first.was_date, time: first.was_time, location: first.was_location },
      now: game,
    });
  }
  return entries;
}

type CollapsedEntry = ReturnType<typeof collapse>[number];

/**
 * The message. One change is named in full — that is the whole value, and a coach in a parking
 * lot should not have to open anything to know where to drive. Two or more collapse to a count,
 * because five stacked sentences on a lock screen is a wall, not an alert. A cancellation
 * outranks a move: it leads whichever form it appears in.
 */
function compose(
  entries: CollapsedEntry[],
  teamName: string,
  tournamentName: string,
  opponentName: (entry: CollapsedEntry) => { name: string; isHome: boolean },
): { title: string; body: string; gameId: string | null } {
  if (entries.length === 1) {
    const e = entries[0];
    const { name, isHome } = opponentName(e);
    const wasTime = timeLabel(e.was.time);
    // A game that never had a time set (a bracket slot getting its first real time) has no
    // "your 2:00 p.m. …" to lead with — "Your game vs X" keeps the sentence whole.
    const which = `${wasTime ? `${wasTime} ` : 'game '}${isHome ? 'vs' : 'at'} ${name}`;

    if (e.kind === 'cancelled') {
      return {
        title: `Your ${which} is cancelled`,
        body: `Cancelled by the organizer · ${tournamentName}`,
        gameId: e.gameId,
      };
    }
    const dateChanged = e.was.date !== e.now.game_date;
    const now = whenWhere(e.now.game_date, e.now.game_time, e.now.location, dateChanged);
    if (e.kind === 'restored') {
      return { title: `Your ${which} is back on`, body: `${now} · ${tournamentName}`, gameId: e.gameId };
    }
    return { title: `Your ${which} moved`, body: `Now ${now} · ${tournamentName}`, gameId: e.gameId };
  }

  const cancelled = entries.filter(e => e.kind === 'cancelled').length;
  return {
    title: `${entries.length} of ${possessive(teamName)} games have changed`,
    body: cancelled > 0
      ? `Including ${cancelled} cancelled · ${tournamentName}`
      : `${tournamentName} · Tap to see the updated schedule`,
    gameId: null,
  };
}

export interface SweepResult {
  groupsConsidered: number;
  groupsHeld: number;
  groupsSent: number;
  groupsEmpty: number;
  pushesSent: number;
  pushesFailed: number;
}

/**
 * Send every batch that is ready. Safe to run at any cadence and safe to double-fire: rows are
 * CLAIMED (sent_at stamped) with a conditional update before the send, so two overlapping runs
 * can never buzz the same follower twice. The cost of that ordering is that a crash between
 * claim and send loses one message — the right trade for a service notification, where a
 * duplicate buzz is more corrosive than a rare miss.
 */
export async function sweepScheduleChangeNotices(now: Date = new Date()): Promise<SweepResult> {
  const result: SweepResult = {
    groupsConsidered: 0, groupsHeld: 0, groupsSent: 0, groupsEmpty: 0, pushesSent: 0, pushesFailed: 0,
  };

  const { data: pending, error } = await supabaseAdmin
    .from('game_change_notices')
    .select('id, tournament_id, team_id, game_id, kind, was_date, was_time, was_location, created_at')
    .is('sent_at', null)
    .is('superseded_at', null)
    // The organizer's own announcement gets first claim on the moment (bulk rain-delay path).
    // `hold_until` is NOT NULL defaulting to now(), so this is a plain comparison — an
    // ordinary edit is eligible on the next tick.
    .lte('hold_until', now.toISOString())
    // `id` is a required tiebreaker, not decoration: one bulk reschedule writes its whole batch
    // in a single transaction, so every row shares a created_at. Without a deterministic second
    // key the LIMIT could slice a team's batch arbitrarily and send it as two messages.
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
    .limit(MAX_NOTICES_PER_SWEEP);
  if (error) throw error;
  const notices = (pending ?? []) as NoticeRow[];
  if (notices.length === 0) return result;

  // One read per lookup table for the whole sweep, not per group.
  const gameIds = Array.from(new Set(notices.map(n => n.game_id)));
  const teamIds = Array.from(new Set(notices.map(n => n.team_id)));
  const tournamentIds = Array.from(new Set(notices.map(n => n.tournament_id)));

  // Rows sent recently, per (tournament, team) — the cooldown that stops the urgent lane from
  // buzzing the same family on every tick.
  const cooldownCutoff = new Date(now.getTime() - REPEAT_SEND_COOLDOWN_MINUTES * 60 * 1000).toISOString();

  const [{ data: gameRows }, { data: teamRows }, { data: tournamentRows }, { data: recentSends }] = await Promise.all([
    supabaseAdmin
      .from('games')
      .select('id, game_date, game_time, location, status, home_team_id, away_team_id, division_id')
      .in('id', gameIds),
    supabaseAdmin.from('teams').select('id, name').in('id', teamIds),
    supabaseAdmin.from('tournaments').select('id, name').in('id', tournamentIds),
    supabaseAdmin
      .from('game_change_notices')
      .select('tournament_id, team_id')
      .in('tournament_id', tournamentIds)
      .gte('sent_at', cooldownCutoff),
  ]);

  const games = new Map<string, GameRow>((gameRows ?? []).map((g: GameRow) => [g.id, g]));
  const recentlyNotified = new Set<string>(
    (recentSends ?? []).map((r: { tournament_id: string; team_id: string }) => `${r.tournament_id}::${r.team_id}`),
  );

  // Publish state re-read at SEND time (see collapse) — a division pulled back to draft since
  // the change was queued must not have its times announced.
  const divisionIds = Array.from(
    new Set(Array.from(games.values()).map(g => g.division_id).filter((d): d is string => !!d)),
  );
  const stillPublished = new Set<string>();
  if (divisionIds.length > 0) {
    const { data: divisionRows } = await supabaseAdmin
      .from('divisions')
      .select('id, schedule_visibility')
      .in('id', divisionIds);
    for (const d of (divisionRows ?? []) as Array<{ id: string; schedule_visibility: string | null }>) {
      if (d.schedule_visibility === 'published') stillPublished.add(d.id);
    }
  }
  const teamNames = new Map<string, string>((teamRows ?? []).map((t: { id: string; name: string }) => [t.id, t.name]));
  const tournamentNames = new Map<string, string>(
    (tournamentRows ?? []).map((t: { id: string; name: string }) => [t.id, t.name]),
  );

  // Opponent names come from the same team table; a game against an unassigned slot has none.
  const opponentIds = new Set<string>();
  for (const g of games.values()) {
    for (const side of [g.home_team_id, g.away_team_id]) {
      if (side && side !== NIL_UUID && !teamNames.has(side)) opponentIds.add(side);
    }
  }
  if (opponentIds.size > 0) {
    const { data: oppRows } = await supabaseAdmin
      .from('teams').select('id, name').in('id', Array.from(opponentIds));
    for (const t of (oppRows ?? []) as Array<{ id: string; name: string }>) teamNames.set(t.id, t.name);
  }

  // Group by (tournament, team) — one message per team, however many of their games moved.
  const groups = new Map<string, NoticeRow[]>();
  for (const n of notices) {
    const key = `${n.tournament_id}::${n.team_id}`;
    const list = groups.get(key);
    if (list) list.push(n); else groups.set(key, [n]);
  }

  const nowMs = now.getTime();
  const urgentCutoffMs = nowMs + URGENT_WINDOW_HOURS * 60 * 60 * 1000;

  for (const [key, group] of groups) {
    result.groupsConsidered++;

    const newestMs = Math.max(...group.map(n => new Date(n.created_at).getTime()));
    const oldestMs = Math.min(...group.map(n => new Date(n.created_at).getTime()));

    // An imminent game skips the wait: in three hours the message stops being useful.
    const urgent = group.some(n => {
      const g = games.get(n.game_id);
      const startsAt = g ? zonedWallClockToUtc(g.game_date, g.game_time) : null;
      if (!startsAt) return false;
      const startMs = new Date(startsAt).getTime();
      return startMs > nowMs && startMs <= urgentCutoffMs;
    });

    const quiet = nowMs - newestMs >= QUIET_WINDOW_MINUTES * 60 * 1000;
    const heldTooLong = nowMs - oldestMs >= MAX_HOLD_MINUTES * 60 * 1000;
    if (!urgent && !quiet && !heldTooLong) { result.groupsHeld++; continue; }

    // The cooldown outranks urgency. This team heard from us in the last few minutes; whatever
    // else has changed since rides the next message rather than becoming a second buzz. Without
    // it, a game-day editing session sends on every tick, which is the failure this whole module
    // is built to prevent. `heldTooLong` remains the escape hatch so nothing waits forever.
    if (recentlyNotified.has(key) && !heldTooLong) { result.groupsHeld++; continue; }

    // Claim before sending. Rows that lost the race (another sweep, or a supersede that landed
    // in between) simply aren't returned, and drop out of this batch.
    const { data: claimed, error: claimErr } = await supabaseAdmin
      .from('game_change_notices')
      .update({ sent_at: now.toISOString() })
      .in('id', group.map(n => n.id))
      .is('sent_at', null)
      .is('superseded_at', null)
      .select('id, tournament_id, team_id, game_id, kind, was_date, was_time, was_location, created_at');
    if (claimErr) {
      console.error('[schedule-change-notices] claim failed; leaving pending for the next tick:', claimErr);
      continue;
    }
    const claimedRows = (claimed ?? []) as NoticeRow[];
    if (claimedRows.length === 0) continue;

    // Isolated per group: these rows are already claimed, so an unexpected throw here would
    // strand them AND abort every group still queued behind this one.
    try {
      const entries = collapse(claimedRows, games, stillPublished);
      if (entries.length === 0) { result.groupsEmpty++; continue; }

      const teamId = claimedRows[0].team_id;
      const tournamentId = claimedRows[0].tournament_id;
      const teamName = teamNames.get(teamId) ?? 'your team';
      const tournamentName = tournamentNames.get(tournamentId) ?? 'your event';

      const payload = compose(entries, teamName, tournamentName, (entry) => {
        const isHome = entry.now.home_team_id === teamId;
        const oppId = isHome ? entry.now.away_team_id : entry.now.home_team_id;
        const name = oppId && oppId !== NIL_UUID ? teamNames.get(oppId) ?? 'your opponent' : 'your opponent';
        return { name, isHome };
      });

      const sendResult = await notifyFansForScheduleChange(tournamentId, teamId, payload);
      result.groupsSent++;
      result.pushesSent += sendResult.sent;
      result.pushesFailed += sendResult.failed;
      // This team is now on cooldown for the rest of this sweep too, not just the next one.
      recentlyNotified.add(key);
    } catch (groupErr) {
      console.error('[schedule-change-notices] group send failed (rows already claimed):', groupErr);
      void captureError(groupErr, {
        route: 'lib/schedule-change-notices (sweep group)',
        severity: 'warning',
        title: 'Schedule-change batch could not be sent',
      });
    }
  }

  return result;
}
