import { NextResponse, type NextRequest } from 'next/server';
import { getAuthContextWithRole } from '@/lib/api-auth';
import { houseLeagueRefusal } from '@/lib/house-league-gate';
import { getLeagueSeasonById } from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { tournamentToday } from '@/lib/timezone';
import { readLeagueClubSchedule } from '@/lib/league-club-schedule-server';
import { LEAGUE_TIME_REFUSALS } from '@/lib/league-time';

/**
 * THE LEAGUE ADMIN IN THE CLUB'S SCHEDULE (Club Tier Stage 11b Part 3, drawings tab 5) — lib/league-club-schedule-server.ts
 * holds the rules. GET `?week=YYYY-MM-DD` (any day of the week; today's when absent): one week of a final club schedule
 * house league holds time in, as an allow-list projection — everyone who reads house league. Read only: a one-date Use
 * saves through House league's time's own route.
 */

export const GET = withObservability(async (req: NextRequest, { params }: { params: Promise<{ seasonId: string; scheduleId: string }> }) => {
  const { seasonId, scheduleId } = await params;
  const search = new URL(req.url).searchParams;
  const ctx = await getAuthContextWithRole({ orgSlug: search.get('orgSlug') ?? undefined, requireOrgSlug: true });
  const err = houseLeagueRefusal(ctx, 'read');
  if (err || !ctx) return err!;
  const season = await getLeagueSeasonById(seasonId, ctx.org.id);
  if (!season) return NextResponse.json({ error: LEAGUE_TIME_REFUSALS.notFound, code: 'not_found' }, { status: 404 });
  const week = search.get('week') ?? '';
  const read = await readLeagueClubSchedule({
    orgId: ctx.org.id, org: ctx.org, member: ctx, season, scheduleId,
    cursor: /^\d{4}-\d{2}-\d{2}$/.test(week) ? week : tournamentToday(),
  });
  if (!read) return NextResponse.json({ error: LEAGUE_TIME_REFUSALS.scheduleNotFound, code: 'not_found' }, { status: 404 });
  return NextResponse.json(read);
}, { route: '/api/admin/house-league/seasons/[seasonId]/club-schedule/[scheduleId]' });
