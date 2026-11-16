import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { notify } from './notify';
import { resultsUserIds } from './notify-recipients';
import { fanPlaceholder } from './public-game-row';
import { scoreNotice, standingResult, type ScoreNoticeGame, type ScoreNoticeResult } from './score-notice';
import type { Organization } from './types';

/**
 * "SCORE SUBMITTED" — THE ONE ENTRY POINT its three senders call (Notifications read at a glance, Stage 5; the words are
 * `lib/score-notice.ts`). Field scores, Results' score entry and Results' forfeit each:
 *
 *   1. `readScoreNoticeGame(id)` BEFORE they save — the one extra read the owner accepted (Q5): both sides' names (the team,
 *      else the bracket's slot words), the division, and the result already standing (a correction's Was row, Q4). A failed
 *      read never stops a score: the notice then says "Visitors" / "Home team".
 *   2. save the score;
 *   3. `sendScoreNotice(...)` fire-and-forget — to the people who can open Results (Q6), never the person who entered it,
 *      and nothing at all when no one else can (an empty list would reach every member).
 */

export interface ScoreNoticeBefore {
  game: ScoreNoticeGame;
  /** The result standing before this save, when the game was already final (completed or forfeit); else null. */
  standing: ScoreNoticeResult | null;
}

type NameRow = { name: string | null } | { name: string | null }[] | null;
const nameOf = (v: NameRow) => (Array.isArray(v) ? v[0]?.name : v?.name)?.trim() || null;

/** Read when the read fails: still the truth, just less of it. */
const UNREAD: ScoreNoticeBefore = { game: { away: 'Visitors', home: 'Home team' }, standing: null };

export async function readScoreNoticeGame(gameId: string): Promise<ScoreNoticeBefore> {
  try {
    return await readGame(gameId);
  } catch (err) {
    console.error('[score-notice] game read failed:', err);
    return UNREAD;
  }
}

async function readGame(gameId: string): Promise<ScoreNoticeBefore> {
  const { data, error } = await supabaseAdmin.from('games')
    .select('status, home_score, away_score, score_submission_source, home_team_id, away_team_id, home_placeholder, away_placeholder, '
      + 'division:divisions(name), home:teams!games_home_team_id_fkey(name), away:teams!games_away_team_id_fkey(name)')
    .eq('id', gameId).maybeSingle();
  if (error) throw error;
  if (!data) return UNREAD;
  const g = data as unknown as {
    status: string; home_score: number | null; away_score: number | null; score_submission_source: string | null;
    home_team_id: string | null; away_team_id: string | null; home_placeholder: string | null; away_placeholder: string | null;
    division: NameRow; home: NameRow; away: NameRow;
  };
  return {
    game: {
      away: (g.away_team_id ? nameOf(g.away) : null) ?? fanPlaceholder(g.away_placeholder),
      home: (g.home_team_id ? nameOf(g.home) : null) ?? fanPlaceholder(g.home_placeholder),
      division: nameOf(g.division),
    },
    standing: standingResult({ status: g.status, homeScore: g.home_score, awayScore: g.away_score, source: g.score_submission_source }),
  };
}

export async function sendScoreNotice(p: {
  org: Pick<Organization, 'id' | 'slug' | 'planId'>;
  actor: { id: string; email?: string | null };
  gameId: string;
  tournamentId: string;
  before: ScoreNoticeBefore;
  result: ScoreNoticeResult;
  held: boolean;
}): Promise<void> {
  const notice = scoreNotice({
    game: p.before.game, result: p.result, held: p.held, enteredBy: p.actor.email, was: p.before.standing,
  });
  const userIds = (await resultsUserIds(p.org, p.tournamentId)).filter(id => id !== p.actor.id);
  if (!userIds.length) return;
  await notify({
    orgId: p.org.id,
    tournamentId: p.tournamentId,
    eventType: 'score_submitted',
    title: notice.title,
    body: notice.body,
    // WI-2: land on Results with THIS game expanded (was Schedule, which has no score tools).
    link: `/${p.org.slug}/admin/tournaments/results?tournamentId=${p.tournamentId}&gameId=${p.gameId}`,
    metadata: { facts: notice.facts },
    userIds,
  });
}
