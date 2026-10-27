import { NextResponse, type NextRequest } from 'next/server';
import { getAuthContextWithRole } from '@/lib/api-auth';
import { houseLeagueRefusal } from '@/lib/house-league-gate';
import { getLeagueSeasonById } from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { giveLeagueTime, readLeagueTime } from '@/lib/league-time-server';
import { LEAGUE_TIME_REFUSALS, readGiveBody } from '@/lib/league-time';

/**
 * HOUSE LEAGUE'S TIME (Club Tier Stage 11b Part 3, frame k2) — lib/league-time-server.ts holds the rules.
 * GET: the window's read — everyone who reads house league (the registrar reads it with no Give it to).
 * POST: give a set of house-league slots to a division's games or practice time, or back to Not given yet (`kind` null) —
 * the league's runners on a live season.
 */

export const GET = withObservability(async (req: NextRequest, { params }: { params: Promise<{ seasonId: string }> }) => {
  const { seasonId } = await params;
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = houseLeagueRefusal(ctx, 'read');
  if (err || !ctx) return err!;
  const season = await getLeagueSeasonById(seasonId, ctx.org.id);
  if (!season) return NextResponse.json({ error: LEAGUE_TIME_REFUSALS.notFound, code: 'not_found' }, { status: 404 });
  return NextResponse.json(await readLeagueTime(ctx.org.id, season));
}, { route: '/api/admin/house-league/seasons/[seasonId]/time' });

export const POST = withObservability(async (req: NextRequest, { params }: { params: Promise<{ seasonId: string }> }) => {
  const { seasonId } = await params;
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = houseLeagueRefusal(ctx, 'run');
  if (err || !ctx) return err!;
  const season = await getLeagueSeasonById(seasonId, ctx.org.id);
  if (!season) return NextResponse.json({ error: LEAGUE_TIME_REFUSALS.notFound, code: 'not_found' }, { status: 404 });
  const refused = houseLeagueRefusal(ctx, 'run', season);
  if (refused) return refused;
  const body = readGiveBody(await req.json().catch(() => null));
  if (!body) return NextResponse.json({ error: LEAGUE_TIME_REFUSALS.badRequest, code: 'bad_request' }, { status: 400 });
  const r = await giveLeagueTime({ orgId: ctx.org.id, season, actorId: ctx.user.id, ...body });
  if (!r.ok) return NextResponse.json({ error: r.error, code: r.code }, { status: r.status });
  return NextResponse.json(r);
}, { route: '/api/admin/house-league/seasons/[seasonId]/time' });
