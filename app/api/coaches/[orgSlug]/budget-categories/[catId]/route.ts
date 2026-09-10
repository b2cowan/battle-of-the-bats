import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getCoachingAssignmentsForUser } from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { denyUnlessTeamMoneyWrite } from '@/lib/coach-capabilities';
import { listVisibleBudgetCategories, countBudgetCategoryUsage } from '@/lib/coach-budget-items';
import { describeBudgetItemUsage } from '@/lib/coach-budget-item-usage';

/**
 * A TEAM'S OWN HEADINGS — rename (migration 277; owner rulings Q3 + Q5, 2026-09-04).
 *
 * The sibling of `budget-items/[itemId]` one level up the taxonomy, and deliberately its mirror: the
 * same authorisation shape, the same refusal sentence, the same retroactive-by-design rename. What
 * made this route possible is that a category now belongs to somebody. While every heading was one
 * flat org-wide pool, "rename my category" meant relabelling six other teams' plans with no way to
 * tell — which is why the product shipped for three weeks with no category rename anywhere at all.
 *
 * ⚠ THIS TEAM'S OWN CATEGORIES ONLY. A standard heading is ours; a club-shared one names budget rows
 * on every team in the org, so a coach renaming it would rewrite plans they do not own. Those are
 * read-only here and the club's Org Budget screen is where an Owner or Treasurer renames them.
 *
 * ⚠ ANY COACH WITH TEAM MONEY-WRITE, NOT HEAD COACH ONLY (owner ruling Q3, 2026-09-04) — the same
 * people who can already rename that team's own items. A second, stricter rule for the level above
 * would be a permission a coach has to hold in their head for no reason a coach could name.
 *
 * ⚠ DELETE IS ABSENT, matching the club side and the original ruling: removing a heading cascades
 * its items, which would blank the classification on every record filed against them at once.
 */
// PATCH /api/coaches/[orgSlug]/budget-categories/[catId]
//   { teamId, name }
export const PATCH = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; catId: string }> },) => {
  const { orgSlug, catId } = await params;

  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();
  if (ctx.org.slug !== orgSlug) return forbidden();

  const assignments = await getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id);
  if (!assignments.length) return forbidden();

  const body = await req.json().catch(() => ({}));
  const teamId: string = typeof body.teamId === 'string' ? body.teamId.trim() : '';
  /* ⚠ THE TEAM IS NAMED AND CHECKED, never inferred from the row — the same reasoning the item
     rename beside this one spells out: taking the category's own team as the authorisation would let
     any coach in the org edit any team's heading, because the row would be authorising itself. */
  const denied = denyUnlessTeamMoneyWrite(assignments, teamId);
  if (denied) return denied;

  const { data: category } = await supabaseAdmin
    .from('budget_categories')
    .select('id, org_id, team_id, name')
    .eq('id', catId)
    .maybeSingle();

  // One answer for "no such category", "another club's" and "another team's" — separating them would
  // confirm the existence of another team's rows to anyone who guessed an id.
  if (!category || category.org_id !== ctx.org.id || category.team_id !== teamId) {
    return NextResponse.json({
      error: 'You can only rename categories your own team created. Standard categories and the ones '
        + 'your club shares belong to everybody, so they are read-only here.',
    }, { status: 403 });
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name || name.length > 80) {
    return NextResponse.json({ error: 'A name is required, and must be 80 characters or fewer' }, { status: 400 });
  }

  /* Case-insensitive uniqueness lives in the app — this table has never carried a unique index (see
     migration 277). Scoped to what this team can SEE, for the same reason the create path is: a name
     collision the coach cannot open is a refusal they cannot act on. */
  const visible = await listVisibleBudgetCategories(ctx.org.id, teamId);
  const clash = visible.some(c =>
    c.id !== catId && String(c.name).trim().toLowerCase() === name.toLowerCase());
  if (clash) {
    return NextResponse.json({ error: 'A category with this name already exists' }, { status: 409 });
  }

  const { data, error } = await supabaseAdmin
    .from('budget_categories')
    .update({ name })
    .eq('id', catId)
    /* ⚠ RE-ASSERTED ON THE WRITE, not just checked on the read above — the house check-then-act rule
       for coach money: the row was fetched a few lines ago and these two columns are what make it
       this team's to change. */
    .eq('org_id', ctx.org.id)
    .eq('team_id', teamId)
    .select('id, org_id, team_id, name, scope, sort_order, is_default, created_at')
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A category with this name already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ category: data });
}, { route: '/api/coaches/[orgSlug]/budget-categories/[catId]' });

/**
 * REMOVE ONE OF THIS TEAM'S OWN HEADINGS — only while nothing sits under it (owner ruling Q3,
 * 2026-09-09; plan `COACH_BUDGET_CATEGORIES_AND_ITEMS_DOOR_PLAN.md`).
 *
 * ⚠ THIS REVERSES THE "DELETE IS ABSENT" NOTE ABOVE, deliberately and narrowly. That note's reason
 * was that removing a heading cascades its items and blanks the filing on everything under them.
 * An EMPTY heading has nothing under it, so the same rule items live by ("only while nothing is
 * filed against it") applies one level up, and the coach gets the same remedy: rename it, or empty
 * it first. Standard and club headings stay undeletable here — a coach cannot rename them either.
 *
 * ⚠⚠ "NOTHING UNDER IT" IS ASKED OF EVERY TABLE THAT CAN NAME A CATEGORY, NOT JUST THE ITEMS.
 * Seven tables carry a `…category_id` onto this row, all `ON DELETE SET NULL` (dev snapshot,
 * 2026-09-09): a pre-mig-240 budget line filed under the heading with no item, a cost, a money-in
 * record, a club line, a request, a split or a drive. A delete would not fail on any of them — it
 * would silently blank that record's filing, which is the exact harm the old refusal existed to
 * prevent. `BUDGET_ITEM_REFERENCES` already lists each with its category column; it is walked by
 * `countBudgetCategoryUsage` — the item counter's twin, one loop, one sentence — so the list and the
 * refusal's grammar have one home (`tests/unit/budget-item-references-guard.test.ts` fails the build
 * if a new reference is added without joining it).
 *
 * ⚠ THE TEAM IS NAMED AND CHECKED (query string, like the item delete beside it), never inferred
 * from the row; the delete re-asserts `org_id` + `team_id` on the write — check-then-act.
 */
// DELETE /api/coaches/[orgSlug]/budget-categories/[catId]?teamId=…
export const DELETE = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; catId: string }> },) => {
  const { orgSlug, catId } = await params;

  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();
  if (ctx.org.slug !== orgSlug) return forbidden();

  const assignments = await getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id);
  if (!assignments.length) return forbidden();

  const teamId = (new URL(req.url).searchParams.get('teamId') ?? '').trim();
  const denied = denyUnlessTeamMoneyWrite(assignments, teamId);
  if (denied) return denied;

  const { data: category } = await supabaseAdmin
    .from('budget_categories')
    .select('id, org_id, team_id, name')
    .eq('id', catId)
    .maybeSingle();

  if (!category || category.org_id !== ctx.org.id || category.team_id !== teamId) {
    return NextResponse.json({
      error: 'You can only remove categories your own team created. Standard categories and the ones '
        + 'your club shares belong to everybody, so they are read-only here.',
    }, { status: 403 });
  }

  const { count: itemCount } = await supabaseAdmin
    .from('budget_items')
    .select('id', { count: 'exact', head: true })
    .eq('category_id', catId);
  if ((itemCount ?? 0) > 0) {
    return NextResponse.json({
      error: `“${category.name}” can’t be removed while it holds ${itemCount} item${itemCount === 1 ? '' : 's'}. `
        + 'Remove or fold its items first, or rename the category instead.',
    }, { status: 409 });
  }

  const filed = await countBudgetCategoryUsage(catId);
  if (filed.total > 0) {
    return NextResponse.json({
      error: `“${category.name}” can’t be removed — ${describeBudgetItemUsage(filed)} ${filed.total === 1 ? 'is' : 'are'} still filed under it. `
        + 'Rename it instead, or move those records first.',
    }, { status: 409 });
  }

  const { error } = await supabaseAdmin
    .from('budget_categories')
    .delete()
    .eq('id', catId)
    .eq('org_id', ctx.org.id)
    .eq('team_id', teamId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}, { route: '/api/coaches/[orgSlug]/budget-categories/[catId]' });
