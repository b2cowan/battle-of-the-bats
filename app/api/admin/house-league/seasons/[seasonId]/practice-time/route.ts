import { NextResponse, type NextRequest } from 'next/server';
import { getAuthContextWithRole } from '@/lib/api-auth';
import { houseLeagueRefusal } from '@/lib/house-league-gate';
import { getLeagueSeasonById } from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { handOutPractices, readPracticeTime } from '@/lib/league-practice-time-server';
import { readHandOutBody, PRACTICE_TIME_REFUSALS } from '@/lib/league-practice-time';
import { isUuid } from '@/lib/utils';
import { divisionInSeason } from '@/lib/league-season-scope';

/**
 * PRACTICE TIME (Club Tier Stage 11b Part 4, frame h1) — lib/league-practice-time-server.ts holds the rules.
 * GET `?divisionId=`: a division's practice time still to come, its teams and its saved settings — everyone who reads
 * house league (the window's door is the league's runners'; the read hides nothing a registrar can't already see).
 * POST `{ divisionId, settings, saw: { slotIds, teamIds } }`: hand the practices out — the league's runners on a live
 * season. The server plans again from its own read; the client's rows are never sent.
 */

export const GET = withObservability(async (req: NextRequest, { params }: { params: Promise<{ seasonId: string }> }) => {
  const { seasonId } = await params;
  const url = new URL(req.url);
  const orgSlug = url.searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = houseLeagueRefusal(ctx, 'read');
  if (err || !ctx) return err!;
  const season = await getLeagueSeasonById(seasonId, ctx.org.id);
  if (!season) return NextResponse.json({ error: PRACTICE_TIME_REFUSALS.notFound, code: 'not_found' }, { status: 404 });
  const divisionId = url.searchParams.get('divisionId') ?? '';
  if (!isUuid(divisionId)) return NextResponse.json({ error: PRACTICE_TIME_REFUSALS.badRequest, code: 'bad_request' }, { status: 400 });
  if (!(await divisionInSeason(season.id, divisionId.toLowerCase()))) {
    return NextResponse.json({ error: PRACTICE_TIME_REFUSALS.notFound, code: 'not_found' }, { status: 404 });
  }
  const read = await readPracticeTime(ctx.org.id, season, divisionId.toLowerCase());
  if (!read) return NextResponse.json({ error: PRACTICE_TIME_REFUSALS.notFound, code: 'not_found' }, { status: 404 });
  return NextResponse.json(read);
}, { route: '/api/admin/house-league/seasons/[seasonId]/practice-time' });

export const POST = withObservability(async (req: NextRequest, { params }: { params: Promise<{ seasonId: string }> }) => {
  const { seasonId } = await params;
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = houseLeagueRefusal(ctx, 'run');
  if (err || !ctx) return err!;
  const season = await getLeagueSeasonById(seasonId, ctx.org.id);
  if (!season) return NextResponse.json({ error: PRACTICE_TIME_REFUSALS.notFound, code: 'not_found' }, { status: 404 });
  const refused = houseLeagueRefusal(ctx, 'run', season);
  if (refused) return refused;
  const body = readHandOutBody(await req.json().catch(() => null));
  if (!body) return NextResponse.json({ error: PRACTICE_TIME_REFUSALS.badRequest, code: 'bad_request' }, { status: 400 });
  if (!(await divisionInSeason(season.id, body.divisionId))) {
    return NextResponse.json({ error: PRACTICE_TIME_REFUSALS.notFound, code: 'not_found' }, { status: 404 });
  }
  const r = await handOutPractices({ orgId: ctx.org.id, season, actorId: ctx.user.id, body });
  if (!r.ok) return NextResponse.json({ error: r.error, code: r.code }, { status: r.status });
  return NextResponse.json(r);
}, { route: '/api/admin/house-league/seasons/[seasonId]/practice-time' });
