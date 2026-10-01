import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { canMoveClubMoney, canOpenRepMoney } from '@/lib/member-access';
import { getRepCostAllocationDetail, updateRepCostAllocationDescription } from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { teamIdsInScope } from '@/lib/club-team-route';

// The club ↔ team money loop: Rep Teams OR Accounting, on an org that runs rep teams (D8 + Ask 1 —
// a treasurer reaches it from Accounting). The write handlers below keep their own role checks.
function gate(ctx: Awaited<ReturnType<typeof getAuthContextWithRole>>) {
  if (!ctx) return unauthorized();
  if (!canOpenRepMoney(ctx, ctx.org)) return forbidden();
  return null;
}

/* ⚰ GET RETIRED (Club Tier Stage 3a session 2): an allocation is read in Accounting
   (`GET /api/admin/accounting/allocations/[allocationId]`). PATCH (its description) stays. */

export const PATCH = withObservability(async (req: Request,
  { params }: { params: Promise<{ allocationId: string }> },) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = gate(ctx);
  if (err) return err;

  // ⚖ One rule for every club money write (Club Tier Stage 3a, Ask 1).
  if (!canMoveClubMoney(ctx!, ctx!.org)) return forbidden();

  const { allocationId } = await params;
  const body = await req.json();
  const { description } = body;

  if (!description?.trim()) {
    return NextResponse.json({ error: 'description is required' }, { status: 400 });
  }

  // ⚠ The member's team-group limit — EVERY team the allocation splits to must be theirs (Club Tier Stage 2, B11). Unreachable TODAY — only an owner,
  // admin or treasurer may act here, and those roles never carry a group limit — so this is the
  // guard for the day a limited role is given the power, not a fix for a live hole.
  const inScope = await teamIdsInScope(ctx!);
  if (inScope) {
    const detail = await getRepCostAllocationDetail(allocationId, ctx!.org.id);
    if (!detail) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (detail.splits.some(s => !inScope.has(s.teamId))) return forbidden();
  }

  const allocation = await updateRepCostAllocationDescription(
    allocationId,
    ctx!.org.id,
    description.trim(),
  );

  return NextResponse.json({ allocation });
}, { route: '/api/admin/rep-teams/allocations/[allocationId]' });
