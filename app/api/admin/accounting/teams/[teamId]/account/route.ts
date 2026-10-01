import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { resolveClubMoney } from '@/lib/club-money-route';
import { clubTeamFor } from '@/lib/club-team-route';
import { teamAccountRead } from '@/lib/club-money-reads';
import { tournamentToday } from '@/lib/timezone';

type Params = { params: Promise<{ teamId: string }> };

/**
 * GET /api/admin/accounting/teams/[teamId]/account?orgSlug= — a team's account with the club
 * (Ask 5a, specimen 1's team page). Read-only by construction: billed · collected · paid to the team
 * · outstanding as a running figure, grouped by the team's own seasons, from the club's records
 * (allocations, installments, requests). It never reads the team's ledger — the copy the club used
 * to open is no longer shown, and the club never writes it.
 */
export const GET = withObservability(async (req: Request, { params }: Params) => {
  const r = await resolveClubMoney(req, { scope: 'loop', write: false });
  if ('error' in r) return r.error;
  const { ctx } = r;
  const { teamId } = await params;
  const t = await clubTeamFor(ctx, teamId);
  if ('error' in t) return t.error;
  const today = tournamentToday();
  const read = await teamAccountRead(ctx.org.id, teamId, today);
  return NextResponse.json({ asOf: today, team: { id: t.team.id, name: t.team.name }, ...read });
}, { route: '/api/admin/accounting/teams/[teamId]/account' });
