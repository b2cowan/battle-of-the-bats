import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { moveRefused, resolveClubMoney } from '@/lib/club-money-route';
import { deleteClubLine, editClubLine } from '@/lib/club-budget-writes';

type Ctx = { params: Promise<{ lineId: string }> };

/**
 * PATCH /api/admin/accounting/budget-plan/lines/[lineId] — edit a line (Club Tier Stage 3b; C11, Asks
 * 4a, 4d). Body, any of: `{ description, notes, sortOrder, itemId, totalAmount, periods, expectUpdatedAt }`.
 *
 *   · WHO: 3a's one money rule (`canMoveClubMoney`).
 *   · ONE STEP, `club_budget_line_save` (mig 317): every part saves together or none does.
 *     A CHANGED total below what is allocated → 409 `below_allocated` with `allocated` (the save pill
 *     quotes it); periods that don't add up to the total (±$0.02) → 400 `periods_dont_add_up` with
 *     `periodsTotal` and `lineTotal` (a total change on a dated line sends its periods with it); a full
 *     replace. `expectUpdatedAt` (optional): the line changed since → 409 `line_changed`.
 *   · THE WORD (only ever a word — its category comes with it): a word already on the year's plan →
 *     409 `word_on_plan` with `existingLineId`; a money-in word on a line teams are billed from → 409
 *     `allocated_line_is_a_cost`.
 *   → 200 `{ line }`.
 */
export const PATCH = withObservability(async (req: Request, { params }: Ctx) => {
  const gate = await resolveClubMoney(req, { scope: 'books', write: true });
  if ('error' in gate) return gate.error;
  const { lineId } = await params;
  const body = await req.json().catch(() => ({}));
  const saved = await editClubLine(gate.ctx.org.id, lineId, body && typeof body === 'object' ? body : {});
  if (!saved.ok) return moveRefused(saved);
  return NextResponse.json({ line: saved.line });
}, { route: '/api/admin/accounting/budget-plan/lines/[lineId]' });

/**
 * DELETE /api/admin/accounting/budget-plan/lines/[lineId] — remove a line (3a's one money rule), in one
 * step under the line's lock (`club_budget_line_delete`). A line with an allocation drawn from it can't
 * be removed → 409 `has_allocations`.
 */
export const DELETE = withObservability(async (req: Request, { params }: Ctx) => {
  const gate = await resolveClubMoney(req, { scope: 'books', write: true });
  if ('error' in gate) return gate.error;
  const { lineId } = await params;
  const removed = await deleteClubLine(gate.ctx.org.id, lineId);
  if (!removed.ok) return moveRefused(removed);
  return NextResponse.json({ ok: true });
}, { route: '/api/admin/accounting/budget-plan/lines/[lineId]' });
