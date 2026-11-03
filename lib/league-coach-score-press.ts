import 'server-only';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from './supabase-admin';
import { getAuthenticatedUser } from './api-auth';
import { houseLeagueCoachAccess } from './house-league-access';
import { readCoachFeedTeam } from './house-league-coach';
import { refusalOf, type ScoreRefusal } from './league-coach-scores';
import { scoreRpc } from './league-coach-scores-server';
import { isUuid } from './utils';
import type { LeagueGame } from './types';

/**
 * A COACH'S SCORE OR REPORT PRESS (House League 9e-3): the signed-in person's OWN seat on the team in the URL, that team's
 * live season, and a game of that team (Q7: nothing past the coach's own team), then the database's function (mig 428).
 */

// ── The press ─────────────────────────────────────────────────────────────────────────────────────────────────

export type CoachPressParams = Promise<{ orgSlug: string; seasonSlug: string; teamId: string; gameId: string }>;

export interface CoachPress {
  userId: string;
  orgId: string;
  game: Pick<LeagueGame, 'id' | 'homeTeamId' | 'awayTeamId'>;
  /** The URL's team: the one the person's own seat names. */
  teamId: string;
  /** This person's live seat on the game's home team (a coach of both teams is the home coach), or null. */
  homeSeat: { name: string } | null;
  /** Their live seat on the URL's team. */
  seat: { name: string };
  names: { home: string; away: string; team: string; season: string };
}

export const NOT_FOUND = () => NextResponse.json({ error: 'Not found' }, { status: 404 });

/**
 * Both coach routes' one preamble: the ids are ids, a person is signed in, the team is in the URL's club and season,
 * the person's OWN seat on it is live on a live season, and the game is that team's. Anything else is a 404 — not
 * even that the game exists — except the two the coach can act on: removed from the team, and a finished season.
 */
export async function resolveCoachPress(params: CoachPressParams): Promise<{ error: Response } | CoachPress> {
  const { orgSlug, seasonSlug, teamId, gameId } = await params;
  if (!isUuid(teamId) || !isUuid(gameId)) return { error: NOT_FOUND() };
  // The team read does not need the person, so the two go together (a signed-out press reads a team it then discards).
  const [user, team] = await Promise.all([getAuthenticatedUser(), readCoachFeedTeam(teamId)]);
  if (!user) return { error: NextResponse.json({ error: 'Sign in to enter a score.' }, { status: 401 }) };
  if (!team || team.card.orgSlug !== orgSlug || team.card.seasonSlug !== seasonSlug) return { error: NOT_FOUND() };

  const { data: game, error: gameError } = await supabaseAdmin.from('league_games')
    .select('id, home_team_id, away_team_id').eq('id', gameId).eq('org_id', team.card.orgId).eq('season_id', team.seasonId)
    .maybeSingle<{ id: string; home_team_id: string; away_team_id: string }>();
  if (gameError) throw new Error(`Couldn't read the game: ${gameError.message}`);
  if (!game || (game.home_team_id !== teamId && game.away_team_id !== teamId)) return { error: NOT_FOUND() };

  // This person's seats on the game's two teams — keyed by their own id, never anyone else's.
  const sides = [game.home_team_id, game.away_team_id];
  const [{ data: links, error: linkError }, { data: teams }] = await Promise.all([
    supabaseAdmin.from('league_team_coaches')
      .select('team_id, user_id, accepted_at, removed_at, name').eq('user_id', user.id).in('team_id', sides),
    supabaseAdmin.from('league_teams').select('id, name').in('id', sides),
  ]);
  if (linkError) throw new Error(`Couldn't read the coaching link: ${linkError.message}`);
  const rows = (links ?? []) as { team_id: string; user_id: string; accepted_at: string | null; removed_at: string | null; name: string }[];
  const asLinks = rows.map(r => ({ teamId: r.team_id, userId: r.user_id, acceptedAt: r.accepted_at, removedAt: r.removed_at }));
  const view = houseLeagueCoachAccess(asLinks, user.id, teamId, team.season);

  const teamName = new Map(((teams ?? []) as { id: string; name: string }[]).map(t => [t.id, t.name]));
  const names = {
    home: teamName.get(game.home_team_id) ?? 'A team', away: teamName.get(game.away_team_id) ?? 'A team',
    team: team.card.teamName, season: team.card.seasonName,
  };
  if (view === 'gone') return { error: refusalResponse('gone', names) };
  if (view === 'finished' || view === 'ended') return { error: refusalResponse('finished', names) };
  if (view !== 'open') return { error: NOT_FOUND() };

  const live = (id: string) => rows.find(r => r.team_id === id && r.user_id === user.id && r.accepted_at && !r.removed_at) ?? null;
  const homeSeat = live(game.home_team_id);
  return {
    userId: user.id, orgId: team.card.orgId, teamId, names,
    game: { id: game.id, homeTeamId: game.home_team_id, awayTeamId: game.away_team_id },
    homeSeat: homeSeat ? { name: homeSeat.name } : null,
    seat: { name: live(teamId)!.name },
  };
}

/** The home coach's Enter / Change / clear. */
export function coachScore(p: CoachPress, homeScore: number | null, awayScore: number | null, seen: string) {
  return scoreRpc('league_game_coach_score', {
    p_org: p.orgId, p_game: p.game.id, p_team: p.game.homeTeamId, p_user: p.userId, p_name: p.homeSeat!.name,
    p_home: homeScore, p_away: awayScore, p_seen: seen,
  });
}

/** The away coach's Report this score. */
export function coachReport(p: CoachPress, note: string | null, seen: string) {
  return scoreRpc('league_game_score_report', {
    p_org: p.orgId, p_game: p.game.id, p_team: p.game.awayTeamId, p_user: p.userId, p_name: p.seat.name, p_note: note, p_seen: seen,
  });
}

/** A refusal from the function as the response the window shows (COPY §9). */
export function refusalResponse(r: ScoreRefusal, names: CoachPress['names']): Response {
  const { status, error, code } = refusalOf(r, names);
  return NextResponse.json({ error, code }, { status });
}
