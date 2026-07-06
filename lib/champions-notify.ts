/**
 * lib/champions-notify.ts — the "Champions crowned" completion moment (server-only).
 *
 * Mirror of announcePlayoffsIfFirstTime, but fired from the shared scoring chokepoint
 * (tournament-scoring-service `onScored`) whenever a terminal playoff score COMPLETES the
 * whole tournament's playoffs. Atomically claims tournaments.champions_crowned_at
 * (NULL → now()) so it fires EXACTLY once — a later re-score / revert-and-re-complete never
 * re-blasts. On the winning claim it sends the staff bell/push (notify) + anonymous fan push
 * (notifyFansForChampions). Fire-and-forget: never throws, so it can't break score submission.
 *
 * The bracket has already advanced by the time this runs (advancePlayoffs executes inside
 * updateGame, before onScored), so the double-elim if-necessary reset is already cancelled
 * when unneeded — the completion check sees the true final state.
 */
import { supabaseAdmin } from './supabase-admin';
import { notify } from './notify';
import { notifyFansForChampions } from './fan-notify';
import { deriveChampions, isTournamentPlayoffsComplete } from './champions';
import type { Game, Division, GameStatus } from './types';

/** Map the minimal snake_case columns the champions helpers read into the Game shape. */
function mapGameRow(r: {
  is_playoff: boolean | null; division_id: string | null;
  bracket_code: string | null; bracket_id: string | null; bracket_label: string | null;
  home_team_id: string | null; away_team_id: string | null;
  home_score: number | null; away_score: number | null; status: string;
}): Game {
  return {
    isPlayoff: r.is_playoff === true,
    divisionId: r.division_id,
    bracketCode: r.bracket_code ?? null,
    bracketId: r.bracket_id ?? null,
    bracketLabel: r.bracket_label ?? null,
    homeTeamId: r.home_team_id ?? null,
    awayTeamId: r.away_team_id ?? null,
    homeScore: r.home_score,
    awayScore: r.away_score,
    status: r.status as GameStatus,
  } as unknown as Game;
}

export async function announceChampionsIfComplete(gameId: string): Promise<void> {
  try {
    // 1. The just-scored game — only a terminal PLAYOFF result can complete the bracket.
    const { data: g } = await supabaseAdmin
      .from('games')
      .select('tournament_id, is_playoff, status, score_submitted_by_user_id')
      .eq('id', gameId)
      .maybeSingle();
    if (!g || g.is_playoff !== true) return;
    if (g.status !== 'completed' && g.status !== 'forfeit') return;
    const tournamentId = g.tournament_id as string;

    // 2. Full playoff picture for the tournament (games + divisions + team names).
    const [gameRes, divRes, teamRes] = await Promise.all([
      supabaseAdmin
        .from('games')
        .select('is_playoff, division_id, bracket_code, bracket_id, bracket_label, home_team_id, away_team_id, home_score, away_score, status')
        .eq('tournament_id', tournamentId),
      supabaseAdmin.from('divisions').select('id, name').eq('tournament_id', tournamentId),
      supabaseAdmin.from('teams').select('id, name').eq('tournament_id', tournamentId),
    ]);
    const games = (gameRes.data ?? []).map(mapGameRow);
    const divisions = (divRes.data ?? []).map(d => ({ id: d.id, name: d.name } as Division));
    if (!isTournamentPlayoffsComplete(games, divisions)) return;

    // 3. Fire once — atomic NULL → now() claim. Only the winning write announces.
    const { data: claimed } = await supabaseAdmin
      .from('tournaments')
      .update({ champions_crowned_at: new Date().toISOString() })
      .eq('id', tournamentId)
      .is('champions_crowned_at', null)
      .select('id, slug, org_id')
      .maybeSingle();
    if (!claimed) return; // already announced (or lost the race) — never re-blast.

    const { data: org } = await supabaseAdmin
      .from('organizations')
      .select('slug')
      .eq('id', claimed.org_id)
      .maybeSingle();
    if (!org) return;

    // 4. Headline champion line — the top-tier champion per division.
    const teams = (teamRes.data ?? []).map(t => ({ id: t.id, name: t.name }));
    const champs = deriveChampions(games, teams, divisions);
    const headline =
      champs.length === 0 ? undefined
      : champs.length === 1 ? champs[0].champion
      : champs.map(c => c.champion).join(', ');

    const link = `/${org.slug}/${claimed.slug}/champions`;
    notify({
      orgId: claimed.org_id,
      tournamentId,
      eventType: 'champions_crowned',
      title: '🏆 Champions crowned',
      body: headline ? `${headline} — see the final results` : 'The playoffs are complete — see the final results.',
      link,
      excludeUserIds: g.score_submitted_by_user_id ? [g.score_submitted_by_user_id] : [],
    }).catch(console.error);
    // Anonymous fans following any team in the tournament (Tournament Plus+, gated inside).
    notifyFansForChampions(tournamentId, headline).catch(console.error);
  } catch (err) {
    console.error('[champions-notify] announceChampionsIfComplete error:', err);
  }
}
