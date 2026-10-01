import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { resolveClubMoney } from '@/lib/club-money-route';
import { teamIdsInScope } from '@/lib/club-team-route';
import { allocationDetail, loadClubLoop } from '@/lib/club-money-reads';
import { canMoveClubMoney } from '@/lib/member-access';
import { tournamentToday } from '@/lib/timezone';
import { supabaseAdmin } from '@/lib/supabase-admin';

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
  // The toolbar line names the budget line it came from ("budget line Diamond permits", specimen 3).
  let budgetLineName: string | null = null;
  if (detail.allocation.sourceBudgetLineId) {
    const { data } = await supabaseAdmin.from('org_budget_lines').select('description')
      .eq('id', detail.allocation.sourceBudgetLineId).eq('org_id', ctx.org.id).maybeSingle();
    budgetLineName = (data as { description?: string | null } | null)?.description ?? null;
  }
  return NextResponse.json({ asOf: today, canMove: canMoveClubMoney(ctx, ctx.org), budgetLineName, ...detail });
}, { route: '/api/admin/accounting/allocations/[allocationId]' });
