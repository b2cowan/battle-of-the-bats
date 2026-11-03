import { NextResponse } from 'next/server';
import { getAuthContextWithRole } from '@/lib/api-auth';
import { houseLeagueRefusal } from '@/lib/house-league-gate';
import { getLeagueSeasonById } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { hasPlanFeature } from '@/lib/plan-features';
import { isCalendarDate, orgDayKey, tournamentToday } from '@/lib/timezone';
import { isUuid } from '@/lib/utils';
import { RAIN_LINE_MAX, RAIN_WORDS as W, rainLine, type RainVerb } from '@/lib/league-rainout';
import { rainoutSource } from '@/lib/league-rainout-server';
import { sendRainout } from '@/lib/league-rainout-send';

// "Email the families now" sends inside the request, one send per division, a hundred to a provider request.
export const maxDuration = 120;

/** A rainout's games at most: a whole evening of a large league, with room. */
const MAX_GAMES = 500;

/**
 * RAINOUT (House League 9e-2; rulings 9e·10 to 9e·14; mig 427).
 *   GET  — the window's own read: every game still to play from today on (draft divisions' too, for the draft line), the
 *          divisions, the day's practices, and the families as team sets (`rainoutSource`; no email leaves the server).
 *   POST { verb, day, line, games: [{ id, seen }], emailNow } — the press: every game in this season, still to play, on
 *          that day, in a published division, as the window saw it; then `league_rainout_press` writes them all or none.
 *          With `emailNow`, one send per division follows (`sendRainout`); without it the changes wait in Changes to send.
 * ⚖ 9e·15 (proposed, owner-confirmed at the UX step 2026-11-02): the existing `bulk_reschedule` plan feature on top of
 * the season gate. Every paid house-league plan has it; where it fails the button is absent, and these answer 404 —
 * never an upgrade sentence (its own names Tournament Plus).
 */
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
  if (!hasPlanFeature(ctx!.org.planId, 'bulk_reschedule')) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ source: await rainoutSource(ctx!.org.id, seasonId) });
}, { route: '/api/admin/house-league/seasons/[seasonId]/schedule/rainout' });

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
  if (!hasPlanFeature(ctx!.org.planId, 'bulk_reschedule')) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json().catch(() => null);
  const verb = body?.verb as RainVerb;
  const day = body?.day;
  const line = rainLine(body?.line);
  if ((verb !== 'postponed' && verb !== 'cancelled') || !isCalendarDate(day) || (line && line.length > RAIN_LINE_MAX)
      || !Array.isArray(body?.games) || body.games.length > MAX_GAMES) {
    return NextResponse.json({ error: 'The request was not understood' }, { status: 400 });
  }
  const posted = (body.games as unknown[]).map(g => g as { id?: unknown; seen?: unknown });
  if (!posted.length) return NextResponse.json({ error: W.tickOne, code: 'nothing' }, { status: 400 });
  if (posted.some(g => !g || !isUuid(g.id) || typeof g.seen !== 'string' || Number.isNaN(Date.parse(g.seen)))) {
    return NextResponse.json({ error: 'The request was not understood' }, { status: 400 });
  }
  const ids = [...new Set(posted.map(g => g.id as string))];
  // Today and later only (a window left open past midnight can't call off yesterday): the Day picker's own rule.
  if (day < tournamentToday()) return NextResponse.json({ error: W.errChanged, code: 'changed' }, { status: 409 });

  // Each game in THIS season (cross-tenant), still to play, on the window's day, in a published division.
  const { data: rows, error: readErr } = await supabaseAdmin.from('league_games')
    .select('id, division_id, home_team_id, away_team_id, status, scheduled_at, league_divisions!inner(schedule_published_at)')
    .eq('season_id', seasonId).eq('org_id', ctx!.org.id).in('id', ids);
  if (readErr) throw new Error(`The rainout's games didn't read: ${readErr.message}`);
  const games = (rows ?? []) as unknown as {
    id: string; division_id: string; home_team_id: string; away_team_id: string; status: string; scheduled_at: string | null;
    league_divisions: { schedule_published_at: string | null } | { schedule_published_at: string | null }[];
  }[];
  if (games.length !== ids.length) return NextResponse.json({ error: 'Game not found' }, { status: 404 });
  const published = (g: typeof games[number]) =>
    !!(Array.isArray(g.league_divisions) ? g.league_divisions[0] : g.league_divisions)?.schedule_published_at;
  if (games.some(g => !published(g))) return NextResponse.json({ error: W.errChanged, code: 'draft' }, { status: 409 });
  if (games.some(g => g.status !== 'scheduled' || !g.scheduled_at || orgDayKey(g.scheduled_at) !== day)) {
    return NextResponse.json({ error: W.errChanged, code: 'changed' }, { status: 409 });
  }

  const { data, error } = await supabaseAdmin.rpc('league_rainout_press', {
    p_org: ctx!.org.id, p_season: seasonId, p_actor: ctx!.user.id, p_day: day, p_verb: verb, p_line: line,
    p_games: posted.map(g => ({ id: g.id, seen: g.seen })),
  });
  // 40P01: the club's Send the changes held one of these games at the same moment; nothing was written either way.
  if (error?.code === '40P01') return NextResponse.json({ error: W.errChanged, code: 'changed' }, { status: 409 });
  if (error) throw new Error(`The rainout didn't save: ${error.message}`);
  const res = ((data ?? []) as { refusal: string | null; rainout: string | null }[])[0];
  switch (res?.refusal ?? null) {
    case null: break;
    case 'finished': return NextResponse.json({ error: W.errFinished(season.name), finished: true }, { status: 423 });
    case 'not_found': return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    case 'nothing': return NextResponse.json({ error: W.tickOne, code: 'nothing' }, { status: 400 });
    case 'invalid': return NextResponse.json({ error: 'The request was not understood' }, { status: 400 });
    default: return NextResponse.json({ error: W.errChanged, code: res!.refusal }, { status: 409 });
  }

  const teams = new Set(games.flatMap(g => [g.home_team_id, g.away_team_id])).size;
  const divisionIds = [...new Set(games.map(g => g.division_id))].sort();
  const result = { rainoutId: res!.rainout, verb, day, games: ids.length, teams };
  if (body.emailNow !== true) return NextResponse.json({ ...result, held: true });

  const divisions = await sendRainout({ org: ctx!.org, season, actorId: ctx!.user.id, gameIds: ids, divisionIds });
  return NextResponse.json({ ...result, held: false, divisions });
}, { route: '/api/admin/house-league/seasons/[seasonId]/schedule/rainout' });
