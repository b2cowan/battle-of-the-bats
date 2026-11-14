import { NextResponse, type NextRequest } from 'next/server';
import { getAuthContextWithRole } from '@/lib/api-auth';
import { houseLeagueRefusal } from '@/lib/house-league-gate';
import { getLeagueSeasonById } from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { askForTime } from '@/lib/league-time-handoff-server';

/**
 * ASK FOR TIME (Club Tier Stage 13d, Session A, A3 — lib/league-time-handoff-server.ts holds the rules).
 * POST: a league admin asks the club for house league time for this season — the one gate's `askForTime` (a live or
 * getting-ready season, a plan with the club's schedule, and never an owner or an admin: they GIVE time, Ask 14 A).
 * 409 `given` when the season has time; 409 `asked_recently` inside 7 days (with the standing `askedAt`).
 */
export const POST = withObservability(async (req: NextRequest, { params }: { params: Promise<{ seasonId: string }> }) => {
  const { seasonId } = await params;
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = houseLeagueRefusal(ctx, 'run');
  if (err || !ctx) return err!;
  const season = await getLeagueSeasonById(seasonId, ctx.org.id);
  if (!season) return NextResponse.json({ error: 'Season not found', code: 'not_found' }, { status: 404 });
  const refused = houseLeagueRefusal(ctx, 'askForTime', season);
  if (refused) return refused;
  const r = await askForTime({ orgId: ctx.org.id, orgSlug: ctx.org.slug, actorId: ctx.user.id, season });
  if (!r.ok) return NextResponse.json({ error: r.code === 'given' ? 'The club has given this season time already.' : 'This season asked less than a week ago.', code: r.code, askedAt: r.askedAt ?? null }, { status: r.status });
  return NextResponse.json({ askedAt: r.askedAt });
}, { route: '/api/admin/house-league/seasons/[seasonId]/time-ask' });
