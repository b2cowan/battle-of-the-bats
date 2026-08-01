import { NextResponse } from 'next/server';
import { getLatestClosedRepProgramYear } from '@/lib/db';
import { resolveCoachSeasonReadContext, seasonParam } from '@/lib/coach-season-read';
import { assembleSeasonWrapped } from '@/lib/rep-season-wrapped';
import { withObservability } from '@/lib/observability';

/**
 * Season Wrapped (Coach Portal Batch 3, wow #7). GET-only, and only for CLOSED seasons —
 * a live season's story isn't finished, and the Overview/Insights already narrate it.
 * Uses the season-READ resolver (accepts closed assignments) so the coach whose season was
 * just completed — the exact person the old access model locked out — can load it. No
 * money data in the payload: the card is built to be shared beyond the team.
 */
export const GET = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  // Chunk F: the year goes THROUGH the rail, not around it. Resolving it separately (as this
  // route used to) meant the access check ran against the team rather than the requested season —
  // a coach who joined in 2026 could open 2023's Wrapped. The rail 403s unless they were on that
  // season's staff, and hands back the season it actually admitted.
  const resolved = await resolveCoachSeasonReadContext(orgSlug, teamId, {
    yearId: seasonParam(req) ?? (await getLatestClosedRepProgramYear(teamId))?.id ?? null,
  });
  if ('error' in resolved) return resolved.error;
  const { team, programYear } = resolved;

  if (programYear.status !== 'completed' && programYear.status !== 'archived') {
    return NextResponse.json({ error: 'Season Wrapped is only available once a season is closed.' }, { status: 409 });
  }

  const wrapped = await assembleSeasonWrapped(team, programYear, {
    fallbackColor: resolved.ctx.org.themePrimary ?? null,
  });
  return NextResponse.json({ wrapped });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/wrapped' });
