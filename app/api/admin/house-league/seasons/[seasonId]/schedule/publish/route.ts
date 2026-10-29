import { NextResponse } from 'next/server';
import { getAuthContextWithRole } from '@/lib/api-auth';
import { houseLeagueRefusal } from '@/lib/house-league-gate';
import { getLeagueSeasonById } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { divisionInSeason } from '@/lib/league-season-scope';
import { memberDisplayName } from '@/lib/member-names';
import { SCHEDULE_PUBLISH_WORDS as W } from '@/lib/league-schedule-words';
import { orgClock } from '@/lib/club-board-view';
import { withObservability } from '@/lib/observability';
import { publishSample, sendScheduleNotice } from '@/lib/league-schedule-mail';

// The families' emails go inside the request, a hundred to a provider request (the season emails' rule).
export const maxDuration = 120;

/**
 * PUBLISH SCHEDULE (House League 9d-2b Part 2; rulings 9d2·1, 9d2·8; frames e1, e2; mig 409). A fact first, an email
 * second, as Publish teams:
 *   GET  ?divisionId — what the window says before the press: the games, the teams, and how many families one email
 *        each reaches (the SQL's own grouping, `league_schedule_family_count`, so the count and the rows never differ).
 *        `&preview=1` — e2's "See the email": the family with the most children, as Publish would email them now.
 *   POST { divisionId, games } — `league_division_schedule_publish` writes, in one transaction locked on the division,
 *        the mark, the season's Automatic notice and one pending email row per family; it refuses a division whose
 *        teams aren't published (`teams_first`), a second press (`already`, with who and when), a window whose game
 *        count is stale (`changed`) and a finished season. There is no unpublish.
 * Then the family emails go from the rows (`sendScheduleNotice`, Part 4), and the answer says how many it reached; a
 * stopped send finishes from the season's Email families history ("Send to the N it missed").
 */
async function divisionFacts(seasonId: string, divisionId: string) {
  const [{ data: teams }, { count: games }] = await Promise.all([
    supabaseAdmin.from('league_teams').select('id').eq('season_id', seasonId).eq('division_id', divisionId),
    supabaseAdmin.from('league_games').select('id', { count: 'exact', head: true })
      .eq('season_id', seasonId).eq('division_id', divisionId).neq('status', 'cancelled'),
  ]);
  const teamIds = (teams ?? []).map(t => t.id as string);
  const { data: families, error } = await supabaseAdmin.rpc('league_schedule_family_count', { p_season: seasonId, p_teams: teamIds });
  if (error) throw new Error(`The family count didn't read: ${error.message}`);
  return { teams: teamIds.length, games: games ?? 0, families: (families as number | null) ?? 0 };
}

export const GET = withObservability(async (req: Request,
  { params }: { params: Promise<{ seasonId: string }> },) => {
  const ctx = await getAuthContextWithRole({ orgSlug: new URL(req.url).searchParams.get('orgSlug') ?? undefined, requireOrgSlug: true });
  const err = houseLeagueRefusal(ctx, 'run');
  if (err) return err;
  const { seasonId } = await params;
  const season = await getLeagueSeasonById(seasonId, ctx!.org.id);
  if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });
  const refused = houseLeagueRefusal(ctx, 'run', season);
  if (refused) return refused;
  const divisionId = new URL(req.url).searchParams.get('divisionId');
  if (!(await divisionInSeason(seasonId, divisionId))) return NextResponse.json({ error: 'Division not found' }, { status: 404 });
  if (new URL(req.url).searchParams.get('preview') === '1') {
    return NextResponse.json({ sample: await publishSample(ctx!.org, season, divisionId!) });
  }
  const f = await divisionFacts(seasonId, divisionId!);
  return NextResponse.json({ games: f.games, teams: f.teams, families: f.families });
}, { route: '/api/admin/house-league/seasons/[seasonId]/schedule/publish' });

export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ seasonId: string }> },) => {
  const ctx = await getAuthContextWithRole({ orgSlug: new URL(req.url).searchParams.get('orgSlug') ?? undefined, requireOrgSlug: true });
  const err = houseLeagueRefusal(ctx, 'run');
  if (err) return err;
  const { seasonId } = await params;
  const season = await getLeagueSeasonById(seasonId, ctx!.org.id);
  if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });
  const refused = houseLeagueRefusal(ctx, 'run', season);
  if (refused) return refused;

  const body = await req.json().catch(() => ({}));
  const divisionId = body?.divisionId;
  if (!(await divisionInSeason(seasonId, divisionId))) return NextResponse.json({ error: 'Division not found' }, { status: 404 });
  const { data: div } = await supabaseAdmin.from('league_divisions').select('name').eq('id', divisionId).single();
  const division = (div?.name as string | undefined) ?? '';

  const { data, error } = await supabaseAdmin.rpc('league_division_schedule_publish', {
    p_org: ctx!.org.id, p_season: seasonId, p_division: divisionId, p_actor: ctx!.user.id,
    p_games: Number.isInteger(body?.games) ? body.games : -1,
  });
  if (error) throw new Error(`Publish schedule didn't save: ${error.message}`);
  const result = (Array.isArray(data) ? data[0] : data) as {
    refusal: string | null; published_at: string | null; published_by: string | null; families: number; notice: string | null;
  };
  switch (result.refusal) {
    case 'finished': return NextResponse.json({ error: W.finished, finished: true }, { status: 423 });
    case 'already': {
      const by = result.published_by ? await memberDisplayName(ctx!.org.id, result.published_by) : null;
      const at = result.published_at ? orgClock(result.published_at) : null;
      return NextResponse.json({ error: W.already(by, division, at), code: 'already' }, { status: 409 });
    }
    case 'changed': return NextResponse.json({ error: W.changed(division), code: 'changed' }, { status: 409 });
    case 'teams_first': return NextResponse.json({ error: W.teamsFirst(division), code: 'teams_first' }, { status: 409 });
    case 'no_games': return NextResponse.json({ error: W.noGames(division), code: 'no_games' }, { status: 409 });
  }
  const sent = result.notice
    ? await sendScheduleNotice({ org: ctx!.org, season, noticeId: result.notice })
    : { families: 0, reached: 0, failed: 0 };
  return NextResponse.json({
    ok: true, publishedAt: result.published_at, families: result.families, reached: sent.reached, failed: sent.failed, notice: result.notice,
  });
}, { route: '/api/admin/house-league/seasons/[seasonId]/schedule/publish' });
