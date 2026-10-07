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
 * POST /api/admin/rep-teams/allocations — New allocation (Club Tier Stage 3c, Ask 6; Stage 3b C11).
 * Body: `{ description, amount, split: { method }, schedule, teams: [...], sourceBudgetLineId? }` (Ask 6 —
 * lib/club-bill-split.ts), or Stage 3a's `{ description, splits: [...], totalAmount? }` until session 2 retires
 * its page.
 *
 *   · The allocation, its splits, its installments and its link to the line are ONE step
 *     (`club_allocation_create`). From a line: refused above what is left on it → 409 `over_line` with
 *     `left` / `allocated` / `planned`; a money-in line → 400 `not_a_cost_line`; not the club's → 404
 *     `line_not_found`. With no line it is an off-plan bill (it counts in the year its first payment falls due).
 *   · Only a RUNNING season is billed → 409 `season_closed` naming the team (S3C-09); a bill that would count
 *     in a closed fiscal year → 409 `year_closed`.
 *   · ⚰ The pasted ledger-entry id (`sourceEntryId`) is refused when sent → 400 `source_entry_retired` (C17).
 *   · WHO: 3a's one money rule; a team outside the member's groups → 403.
 *   → 201 `{ allocation: { id, totalAmount, sourceBudgetLineId } }`.
 */
export const POST = withObservability(async (req: Request) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = gate(ctx);
  if (err) return err;

  // ⚖ One rule for every club money write (Club Tier Stage 3a, Ask 1).
  if (!canMoveClubMoney(ctx!, ctx!.org)) return forbidden();

  const body = await req.json().catch(() => ({}));
  // Ask 6's body (`teams`, `split`, `schedule`, `amount`) or Stage 3a's (`splits`) — the step reads either; a
  // pasted ledger-entry id is refused (C17).
  const made = await createClubAllocation(ctx!, {
    ...body,
    sourceEntryId: body.sourceEntryId ?? null,
    sourceBudgetLineId: body.sourceBudgetLineId ?? null,
  });
  if ('error' in made) return made.error;
  if (!made.ok) return moveRefused(made);

  return NextResponse.json({
    allocation: { id: made.allocationId, totalAmount: made.total, sourceBudgetLineId: body.sourceBudgetLineId ?? null },
  }, { status: 201 });
}, { route: '/api/admin/rep-teams/allocations' });
