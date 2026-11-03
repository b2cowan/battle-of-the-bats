import { NextRequest, NextResponse } from 'next/server';
import { publicSiteEditor } from '@/lib/public-site-access';
import { getTournamentsByOrg } from '@/lib/db';
import { sanitizeTournamentLookPolicy, tournamentsWithOwnColours } from '@/lib/tournament-look';
import { tournamentToday } from '@/lib/timezone';
import { withObservability } from '@/lib/observability';

/**
 * /api/admin/org/tournament-look — WHAT THE QUESTION BEFORE *ALWAYS* NAMES (Public tournament pages Stage 1a; the
 * drawing's ask 2, ruled 2026-11-02).
 *
 * GET → the club's saved rule and its tournaments with colours of their own: the ones not finished (on now first, then by
 * start date) and how many finished ones there are. The rule itself is saved through `/api/admin/org-settings`
 * (`tournamentLookPolicy`, one of the club's look fields — Ask 13), not here.
 *
 * The public-site editor's gate: the capability on a plan that carries the site module, for everyone — an owner on a plan
 * without the site has no tournaments rule to set.
 */
export const GET = withObservability(async (req: NextRequest) => {
  const r = await publicSiteEditor(req, { write: false });
  if (r.error) return r.error;
  const { org } = r.ctx;

  const tournaments = await getTournamentsByOrg(org.id, { admin: true, strict: true });
  return NextResponse.json({
    policy: sanitizeTournamentLookPolicy(org.tournamentLookPolicy),
    ...tournamentsWithOwnColours(tournaments, tournamentToday()),
  });
}, { route: '/api/admin/org/tournament-look' });
