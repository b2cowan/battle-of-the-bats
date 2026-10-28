import { NextResponse } from 'next/server';
import { getAuthContextWithRole } from '@/lib/api-auth';
import { houseLeagueRefusal } from '@/lib/house-league-gate';
import { getLeagueSeasonById } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { GAMES_PER_TEAM_MAX, HOME_AWAY_TOLERANCES, LEAGUE_HEALTH_WORDS as H } from '@/lib/league-schedule-health';

/**
 * ADJUST THE RULES (House League 9d-2b Part 6, frame d3; mig 412). Schedule health's three rules, saved together:
 *   PUT { twiceInADayAllowed, homeAwayTolerance, gamesPerTeam: { [divisionId]: number | null } } —
 *   `league_season_rules_save` writes the season's two and each named division's games per team in one transaction
 *   (null = the number most of its teams were given). A division the body leaves out keeps what it has; one that is not
 *   the season's refuses the whole save. Refused on a finished season (Q16), by the gate and again by the function.
 * Whoever runs the season saves; the score is the page's own (worked out from the read it holds), so the answer is only
 * "saved" or a refusal.
 */
export const PUT = withObservability(async (req: Request,
  { params }: { params: Promise<{ seasonId: string }> },) => {
  const ctx = await getAuthContextWithRole({ orgSlug: new URL(req.url).searchParams.get('orgSlug') ?? undefined, requireOrgSlug: true });
  const err = houseLeagueRefusal(ctx, 'run');
  if (err) return err;
  const { seasonId } = await params;
  const season = await getLeagueSeasonById(seasonId, ctx!.org.id);
  if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });
  const refused = houseLeagueRefusal(ctx, 'run', season);
  if (refused) return refused;

  const body = await req.json().catch(() => null);
  const tolerance = body?.homeAwayTolerance;
  const games = body?.gamesPerTeam ?? {};
  const bad = () => NextResponse.json({ code: 'invalid', error: H.rulesFailed }, { status: 400 });
  if (typeof body?.twiceInADayAllowed !== 'boolean') return bad();
  if (!(HOME_AWAY_TOLERANCES as readonly number[]).includes(tolerance)) return bad();
  if (typeof games !== 'object' || Array.isArray(games)) return bad();
  const rows: { division: string; games: number | null }[] = [];
  for (const [division, n] of Object.entries(games)) {
    if (n !== null && (typeof n !== 'number' || !Number.isInteger(n) || n < 1 || n > GAMES_PER_TEAM_MAX)) return bad();
    rows.push({ division, games: n as number | null });
  }

  const { data, error } = await supabaseAdmin.rpc('league_season_rules_save', {
    p_org: ctx!.org.id, p_season: season.id, p_twice: body.twiceInADayAllowed, p_tolerance: tolerance, p_games: rows,
  });
  if (error) {
    // A division id that is not a uuid fails the function's cast: the same refusal as a division of another season.
    if (error.code === '22P02') return NextResponse.json({ code: 'division', error: 'Division not found' }, { status: 404 });
    throw error;
  }
  if (data === 'finished') return NextResponse.json({ code: 'finished', error: H.rulesFinished }, { status: 409 });
  if (data === 'division') return NextResponse.json({ code: 'division', error: 'Division not found' }, { status: 404 });
  if (data === 'invalid') return bad();
  return NextResponse.json({ ok: true });
}, { route: '/api/admin/house-league/seasons/[seasonId]/schedule/rules' });
