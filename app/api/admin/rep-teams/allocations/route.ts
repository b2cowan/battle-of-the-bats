import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { canMoveClubMoney, canOpenRepMoney } from '@/lib/member-access';
import { withObservability } from '@/lib/observability';
import { moveRefused } from '@/lib/club-money-route';
import { createClubAllocation } from '@/lib/club-budget-writes';

// The club ↔ team money loop: Rep Teams OR Accounting, on an org that runs rep teams (D8 + Ask 1 —
// a treasurer reaches it from Accounting).
function gate(ctx: Awaited<ReturnType<typeof getAuthContextWithRole>>) {
  if (!ctx) return unauthorized();
  if (!canOpenRepMoney(ctx, ctx.org)) return forbidden();
  return null;
}

/* ⚰ GET RETIRED (Club Tier Stage 3a session 2): the list lives in Accounting › Allocations
   (`GET /api/admin/accounting/allocations`). POST stays — New allocation creates through it. */

/**
 * POST /api/admin/rep-teams/allocations — New allocation (Club Tier Stage 3a's page; Stage 3b C11).
 * Body: `{ description, splits: [...], sourceBudgetLineId?, sourceEntryId?, totalAmount? }`.
 *
 *   · From a budget line (`sourceBudgetLineId`): the allocation, its splits, its installments and its
 *     link to the line are ONE step (`club_allocation_create`, mig 317). Any number per line; refused
 *     above what is left on the line → 409 `over_line` with `left` / `allocated` / `planned`; a
 *     money-in line → 400 `not_a_cost_line`; not the club's → 404 `line_not_found`.
 *   · A general allocation (`sourceEntryId`, or neither): the same one step. Its source is a live entry
 *     on one of the club's own books (3a, C17) → else 400 `bad_source_entry`. Never both → 400 `one_source`.
 *   · The allocation's total is its TEAMS' SHARES, never the line's and never a stated total
 *     (`totalAmount`, if sent, only caps the shares → 400 `shares_over_total`).
 *   · WHO: 3a's one money rule; a team outside the member's groups → 403.
 *   → 201 `{ allocation: { id, totalAmount, sourceBudgetLineId, sourceEntryId } }`.
 */
export const POST = withObservability(async (req: Request) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = gate(ctx);
  if (err) return err;

  // ⚖ One rule for every club money write (Club Tier Stage 3a, Ask 1).
  if (!canMoveClubMoney(ctx!, ctx!.org)) return forbidden();

  const body = await req.json().catch(() => ({}));
  const made = await createClubAllocation(ctx!, {
    description: body.description,
    totalAmount: body.totalAmount,
    sourceEntryId: body.sourceEntryId ?? null,
    sourceBudgetLineId: body.sourceBudgetLineId ?? null,
    splits: body.splits,
  });
  if ('error' in made) return made.error;
  if (!made.ok) return moveRefused(made);

  return NextResponse.json({
    allocation: {
      id: made.allocationId, totalAmount: made.total,
      sourceBudgetLineId: body.sourceBudgetLineId ?? null, sourceEntryId: body.sourceEntryId ?? null,
    },
  }, { status: 201 });
}, { route: '/api/admin/rep-teams/allocations' });
