import { NextResponse } from 'next/server';
import { getAuthContextWithRole } from '@/lib/api-auth';
import { houseLeagueRefusal } from '@/lib/house-league-gate';
import { getLeagueSeasonById } from '@/lib/db';
import { divisionInSeason } from '@/lib/league-season-scope';
import { memberDisplayName } from '@/lib/member-names';
import { CHANGES_TO_SEND_WORDS as W, SCHEDULE_PUBLISH_WORDS } from '@/lib/league-schedule-words';
import { childrenOnTeams, heldGamesOf, isShownHeld } from '@/lib/league-game-changes-server';
import { changesSample, sendChangesAndTell } from '@/lib/league-schedule-mail';
import { familiesFor, teamsHearing } from '@/lib/league-game-changes';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { orgClock } from '@/lib/club-board-view';
import { withObservability } from '@/lib/observability';

// The families' emails go inside the request, a hundred to a provider request (the season emails' rule).
export const maxDuration = 120;

/**
 * CHANGES TO SEND (House League 9d-2b Part 3; rulings 9d2·16, 9d2b; frame f2; mig 409). A division's held changes, and
 * the one press that sends them.
 *   GET  ?divisionId&gameId — one game's two teams' families (f5's question).
 *   GET  ?divisionId&preview=1 — f2's "See their email": the family with children on two of the changed teams (else the
 *        fullest one), as the send would email them (Part 4).
 *   GET  ?divisionId — every game with a change waiting: what families will hear (the net effect, `heldGamesOf`), whether
 *        it was played since (listed, never emailed), how many families each reaches, the total the send reaches (one
 *        email per family, `familiesFor` — the SQL's grouping), and one family with children on two of the teams, for
 *        f2's "one email with both changes". `changeIds` is every held row the window saw, the games that tell families
 *        nothing (moved and moved back) included: the send claims them all, so they leave with it.
 *   POST { divisionId, changeIds } — `sendHeldChanges`: claimed once, refused `changed` when a change landed or was
 *        undone while the window was open, `already` (who and when) on a second press. Then the families' emails go
 *        from the rows it wrote, and the changed teams' coaches get a copy (`sendChangesAndTell`, Part 4): the answer
 *        says how many it reached.
 */
/** "Kims", "Joneses": a family's name for "The {Kims} have …". */
const familyName = (last: string) => (/(s|x|z|ch|sh)$/i.test(last) ? `${last}es` : `${last}s`);

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
  const g = { ctx: ctx!, seasonId };
  const divisionId = new URL(req.url).searchParams.get('divisionId');
  if (!(await divisionInSeason(g.seasonId, divisionId))) return NextResponse.json({ error: 'Division not found' }, { status: 404 });

  // f5's question: how many families one game's two teams reach ("The Red Sox and Mariners families (21)").
  const gameId = new URL(req.url).searchParams.get('gameId');
  if (gameId) {
    const { data: game } = await supabaseAdmin.from('league_games').select('home_team_id, away_team_id')
      .eq('id', gameId).eq('season_id', g.seasonId).eq('division_id', divisionId!).single();
    if (!game) return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    const teams = new Set([game.home_team_id as string, game.away_team_id as string]);
    return NextResponse.json({ families: familiesFor(await childrenOnTeams(g.seasonId, [...teams]), teams).size });
  }

  const held = await heldGamesOf(g.seasonId, divisionId!);
  if (new URL(req.url).searchParams.get('preview') === '1') {
    return NextResponse.json({ sample: await changesSample(g.ctx.org, season, divisionId!, held) });
  }
  const shown = held.filter(isShownHeld);
  const news = shown.filter(h => h.news);
  const children = await childrenOnTeams(g.seasonId, [...teamsHearing(shown)]);
  const reach = (teams: ReadonlySet<string>) => familiesFor(children, teams);

  const hearing = teamsHearing(news);
  const households = reach(hearing);
  // One family with children on two of the changed games' teams (f2's note), the first by name.
  let household: { family: string; parts: { child: string; teamId: string }[] } | null = null;
  for (const kids of [...households.values()].sort((a, b) => a[0].childName.localeCompare(b[0].childName))) {
    const teams = new Set(kids.map(k => k.teamId));
    const last = kids[0].lastName;
    if (teams.size > 1 && last) {
      household = { family: familyName(last), parts: kids.map(k => ({ child: k.childName, teamId: k.teamId })) };
      break;
    }
  }

  return NextResponse.json({
    games: shown.map(h => ({
      gameId: h.gameId, news: h.news, played: h.played, homeTeamId: h.homeTeamId, awayTeamId: h.awayTeamId,
      families: reach(new Set([h.homeTeamId, h.awayTeamId])).size,
    })),
    changeIds: held.flatMap(h => h.changeIds),
    families: households.size,
    teams: hearing.size,
    household,
  });
}, { route: '/api/admin/house-league/seasons/[seasonId]/schedule/changes' });

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
  const g = { ctx: ctx!, seasonId };
  const body = await req.json().catch(() => ({}));
  const divisionId = body?.divisionId;
  if (!(await divisionInSeason(g.seasonId, divisionId))) return NextResponse.json({ error: 'Division not found' }, { status: 404 });
  const changeIds = Array.isArray(body?.changeIds) ? body.changeIds.filter((x: unknown): x is string => typeof x === 'string') : [];

  const r = await sendChangesAndTell({ org: g.ctx.org, season, divisionId, actorId: g.ctx.user.id, changeIds });
  switch (r.refusal) {
    case 'nothing': return NextResponse.json({ error: W.empty, code: 'nothing' }, { status: 409 });
    case 'finished': return NextResponse.json({ error: SCHEDULE_PUBLISH_WORDS.finished, finished: true }, { status: 423 });
    case 'changed': {
      const { data: div } = await supabaseAdmin.from('league_divisions').select('name').eq('id', divisionId).single();
      return NextResponse.json({ error: SCHEDULE_PUBLISH_WORDS.changed((div?.name as string | undefined) ?? ''), code: 'changed' }, { status: 409 });
    }
    case 'already': {
      const by = r.by ? await memberDisplayName(g.ctx.org.id, r.by) : null;
      const at = r.at ? orgClock(r.at) : null;
      return NextResponse.json({ error: W.already(by, at), code: 'already' }, { status: 409 });
    }
  }
  return NextResponse.json({ ok: true, families: r.families, reached: r.reached, failed: r.failed, silent: r.silent === true, news: r.news, sentAt: r.sentAt });
}, { route: '/api/admin/house-league/seasons/[seasonId]/schedule/changes' });
