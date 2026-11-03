import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import type { User } from '@supabase/supabase-js';
import { memberDisplayName } from './member-names';
import { getUserDisplayName } from './user-display';
import { isUuid } from './utils';
import type { GameScoreRecord, ScoreRefusal } from './league-coach-scores';

/**
 * THE SCORE RECORD'S SERVER SIDE (House League 9e-3, mig 428). Reads `league_game_scores` (service role only — never on a
 * public read), and calls its four functions. A coach's press is resolved in lib/league-coach-score-press.ts.
 */

// Only what a reader uses: who the reporter was and which team each side entered for stay in the table (mig 428), unread.
const SCORE_COLUMNS = 'game_id, entered_side, entered_by, entered_by_name, entered_at, reported_by, reported_at, report_note, checked_by_name, checked_at, corrected_by_name, corrected_at';

type ScoreRow = {
  game_id: string; entered_side: 'coach' | 'club'; entered_by: string | null; entered_by_name: string; entered_at: string;
  reported_by: string | null; reported_at: string | null; report_note: string | null;
  checked_by_name: string | null; checked_at: string | null; corrected_by_name: string | null; corrected_at: string | null;
};

const toRecord = (r: ScoreRow): GameScoreRecord => ({
  gameId: r.game_id, enteredSide: r.entered_side, enteredBy: r.entered_by, enteredByName: r.entered_by_name, enteredAt: r.entered_at,
  reportedBy: r.reported_by, reportedAt: r.reported_at, reportNote: r.report_note, checkedByName: r.checked_by_name,
  checkedAt: r.checked_at, correctedByName: r.corrected_by_name, correctedAt: r.corrected_at,
});

/** The records of these games (chunked: a season's games can run past one URL's worth of ids). A failed read THROWS. */
export async function readScoreRecords(orgId: string, gameIds: readonly string[]): Promise<Map<string, GameScoreRecord>> {
  const out = new Map<string, GameScoreRecord>();
  for (let i = 0; i < gameIds.length; i += 200) {
    const { data, error } = await supabaseAdmin.from('league_game_scores').select(SCORE_COLUMNS)
      .eq('org_id', orgId).in('game_id', gameIds.slice(i, i + 200));
    if (error) throw new Error(`Couldn't read the score records: ${error.message}`);
    for (const r of (data ?? []) as ScoreRow[]) out.set(r.game_id, toRecord(r));
  }
  return out;
}

/** The season's records, for the club's schedule read ("Scores to check" and the window's tag). */
export async function readSeasonScoreRecords(orgId: string, seasonId: string): Promise<GameScoreRecord[]> {
  const { data, error } = await supabaseAdmin.from('league_game_scores').select(SCORE_COLUMNS)
    .eq('org_id', orgId).eq('season_id', seasonId).limit(5000);
  if (error) throw new Error(`Couldn't read the score records: ${error.message}`);
  return ((data ?? []) as ScoreRow[]).map(toRecord);
}

export async function scoreRpc(fn: string, args: Record<string, unknown>): Promise<ScoreRefusal | null> {
  const { data, error } = await supabaseAdmin.rpc(fn, args);
  if (error) throw new Error(`${fn} failed: ${error.message}`);
  return (data as ScoreRefusal | null) ?? null;
}

/** The club's game PATCH when it carries a score: the game's columns and the record's stamp together (mig 428). */
export function clubWriteGame(p: { orgId: string; gameId: string; seen: string; row: Record<string, unknown>; userId: string; name: string }) {
  return scoreRpc('league_game_club_write', { p_org: p.orgId, p_game: p.gameId, p_seen: p.seen, p_patch: p.row, p_user: p.userId, p_name: p.name });
}

/** Keep (and ✓ with no change): the coach's score, checked — a game of this season only. */
export async function clubKeepScore(p: { orgId: string; seasonId: string; gameId: string; seen: string; userId: string; name: Promise<string> }) {
  if (!isUuid(p.gameId)) { p.name.catch(() => undefined); return 'notFound' as const; }
  // The caller already started reading the name: it is awaited with the game check, not before it.
  const [{ data, error }, name] = await Promise.all([
    supabaseAdmin.from('league_games').select('id').eq('id', p.gameId).eq('org_id', p.orgId).eq('season_id', p.seasonId).maybeSingle(),
    p.name,
  ]);
  if (error) throw new Error(`Couldn't read the game: ${error.message}`);
  if (!data) return 'notFound' as const;
  return scoreRpc('league_game_score_keep', { p_org: p.orgId, p_game: p.gameId, p_user: p.userId, p_name: name, p_seen: p.seen });
}

/** The staff member's name as the club's screens read it ("Checked by Sam Lee"), snapshotted at the press. */
export async function staffName(ctx: { org: { id: string }; user: User }): Promise<string> {
  // A failed name read must not fail a score save: the record gets the account's name, or the plain word.
  const member = await memberDisplayName(ctx.org.id, ctx.user.id).catch(() => '');
  return member || getUserDisplayName(ctx.user) || 'A league admin';
}
