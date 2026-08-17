import { NextResponse } from 'next/server';
import { getRepAllocationSplitsForTeam } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { resolveCoachTeamRead } from '@/lib/coach-team-read';
import { resolveLiveCoachTeamContext } from '@/lib/coach-route-context';
import { resolveBudgetItem } from '@/lib/coach-budget-items';
import { withObservability, captureAndJson } from '@/lib/observability';
import { canViewMoney, canWriteMoney, denyUnless } from '@/lib/coach-capabilities';

/**
 * What the club has billed THIS team, in the season on screen.
 *
 * ⚠⚠ `resolveCoachTeamRead`, NOT the old hand-rolled active-year lookup (money redesign P4,
 * 2026-08-17). Two things changed with it, and both were owner rulings:
 *
 *  1. **Season-scoped.** The read underneath was team-LIFETIME while every other club-money reader —
 *     Cash on hand, the register, the season close-out pot — had been season-scoped by P3. Owner
 *     ruling: *"our default for all data is it is independent on each season."*
 *  2. **A FINISHED season still answers.** The old resolver 404'd the moment a season closed, which
 *     is why the tab vanished between seasons instead of rendering as a record. Allocations are a
 *     record of money that moved; nothing here recomputes. The read serves them, the write below
 *     refuses, and `isReadOnly` tells the screen which it is holding.
 */
export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachTeamRead(orgSlug, teamId);
  if ('error' in resolved) return resolved.error;
  const { capabilities, programYear, isReadOnly } = resolved;
  const denied = denyUnless(canViewMoney(capabilities), 'You do not have access to team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  /* ⚠ THE NAMES COME WITH THE ROWS. This route used to collect the filing ids and fire its own
     `budget_items` + `budget_categories` lookup — one of three hand-rolled copies of that block
     (`/simplify`, 2026-08-17). The reader joins them now, so there is one way to turn an item id
     into a word. */
  const splits = await getRepAllocationSplitsForTeam(teamId, programYear.id);

  return NextResponse.json({ splits, isReadOnly, programYearName: programYear.name });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/allocations' });

/**
 * File the club's bill under one of the TEAM's own budget words (mig 250).
 *
 * ⚠⚠ WHY THE COACH FILES THIS AND NOT THE CLUB. The parent `rep_cost_allocations` row spans every
 * team the cost was divided across, and the club does not know any one team's vocabulary — two teams
 * may legitimately file one shared diamond bill under different words. So the filing lives on the
 * SPLIT, and this is the only door that writes it.
 *
 * ⚠ ONE FILING PER SPLIT, NOT PER INSTALMENT. The instalments are a payment schedule for a single
 * thing; asking the same question four times invites four answers, and the report would then have to
 * decide which of them the allocation "is".
 *
 * ⚠ THE ITEM COMES FROM THE MONEY-OUT SIDE OF THE LIBRARY. A club bill is a cost; there is no
 * direction question to ask here (unlike a request, where the money can arrive and the filing is
 * still a cost — see the note on the requests route).
 *
 * ⚠ NOTHING ELSE ON THE SPLIT IS WRITABLE. The amount, the split method, the schedule and the notes
 * are the CLUB's, and a coach who could edit them could quietly restate what they had been billed.
 * This handler names its two columns explicitly rather than spreading a body.
 */
export const PATCH = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  // A write addresses a LIVE season — a finished one is a record.
  const resolved = await resolveLiveCoachTeamContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error;
  const { ctx, team, assignment, programYear } = resolved;
  const denied = denyUnless(canWriteMoney(assignment.capabilities), 'You do not have access to team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const splitId = typeof body?.splitId === 'string' ? body.splitId : '';
  if (!splitId) return NextResponse.json({ error: 'splitId is required' }, { status: 400 });

  const item = await resolveBudgetItem(body?.budgetItemId, ctx.org.id, teamId, team.sport);
  if (!item.ok) return NextResponse.json({ error: item.error }, { status: 400 });

  /* ⚠⚠ THE SEASON AND THE TEAM ARE RE-ASSERTED IN THE WHERE CLAUSE, not merely read beforehand.
     `splitId` arrives from the browser, and a split id belonging to another team — or to this team
     in a season that is no longer the working one — must not be writable through this door. The
     update simply matches nothing, and the 404 below says so without confirming the id exists. */
  const { data, error } = await supabaseAdmin
    .from('rep_allocation_splits')
    .update({
      budget_item_id:     item.item?.id ?? null,
      budget_category_id: item.item?.categoryId ?? null,
    })
    .eq('id', splitId)
    .eq('team_id', teamId)
    .eq('program_year_id', programYear.id)
    .select('id')
    .maybeSingle();

  if (error) return captureAndJson(error, { error: error.message }, 500);
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({
    split: {
      id: splitId,
      budgetItemId: item.item?.id ?? null,
      budgetCategoryId: item.item?.categoryId ?? null,
      budgetItemName: item.item?.name ?? null,
      budgetCategoryName: item.item?.categoryName ?? null,
    },
  });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/allocations' });
