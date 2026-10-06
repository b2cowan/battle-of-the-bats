import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { moveRefused, resolveClubMoney } from '@/lib/club-money-route';
import { createClubAllocation } from '@/lib/club-budget-writes';

type Ctx = { params: Promise<{ lineId: string }> };

/**
 * ⚰ RETIRES IN CLUB TIER STAGE 3b SESSION 2, WITH THE OLD ALLOCATE PAGE (its only caller).
 *
 * POST /api/admin/accounting/budget-plan/lines/[lineId]/allocate-to-teams — kept only so the old page
 * does not dead-end between the sessions. It is now a thin door into the SAME one-step create as New
 * allocation (`createClubAllocation` → `club_allocation_create`, mig 317): many allocations per line
 * (the "already allocated" refusal is gone, C11), refused above what is left on the line (409
 * `over_line` with `left`), its total is its teams' shares, and the line link is written in the same
 * step. WHO: 3a's one money rule, and a team outside the member's groups is refused.
 * Body: `{ description, splits: [...] }` → 201 `{ allocation: { id, sourceBudgetLineId, totalAmount } }`.
 */
export const POST = withObservability(async (req: Request, { params }: Ctx) => {
  const gate = await resolveClubMoney(req, { scope: 'books', write: true });
  if ('error' in gate) return gate.error;
  const { lineId } = await params;
  const body = await req.json().catch(() => ({}));
  const made = await createClubAllocation(gate.ctx, {
    description: body.description, splits: body.splits, sourceBudgetLineId: lineId, sourceEntryId: null,
  });
  if ('error' in made) return made.error;
  if (!made.ok) return moveRefused(made);
  return NextResponse.json(
    { allocation: { id: made.allocationId, sourceBudgetLineId: lineId, totalAmount: made.total } },
    { status: 201 },
  );
}, { route: '/api/admin/accounting/budget-plan/lines/[lineId]/allocate-to-teams' });
