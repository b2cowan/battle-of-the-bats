import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { resolveClubMoney } from '@/lib/club-money-route';
import { teamIdsInScope } from '@/lib/club-team-route';
import { allocationDetail, loadClubLoop } from '@/lib/club-money-reads';
import { canMoveClubMoney } from '@/lib/member-access';
import { tournamentToday } from '@/lib/timezone';

type Params = { params: Promise<{ allocationId: string }> };

/**
 * GET /api/admin/accounting/allocations/[allocationId]?orgSlug= — an allocation (specimen 3): its
 * four figures, and one bill per team (the teams that need the club first), each with its
 * installments' states and, once received or sent, the day, how, the reference and who.
 * `canMove` says whether this member may record, confirm or undo (Ask 1).
 */
export const GET = withObservability(async (req: Request, { params }: Params) => {
  const r = await resolveClubMoney(req, { scope: 'loop', write: false });
  if ('error' in r) return r.error;
  const { ctx } = r;
  const { allocationId } = await params;
  const today = tournamentToday();
  const loop = await loadClubLoop(ctx.org.id, await teamIdsInScope(ctx), { allocationId });
  const detail = await allocationDetail(ctx.org.id, loop, allocationId, today);
  if (!detail) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ asOf: today, canMove: canMoveClubMoney(ctx, ctx.org), ...detail });
}, { route: '/api/admin/accounting/allocations/[allocationId]' });
