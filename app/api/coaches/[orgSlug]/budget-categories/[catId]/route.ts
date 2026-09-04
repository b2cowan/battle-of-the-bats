import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getCoachingAssignmentsForUser } from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { denyUnlessTeamMoneyWrite } from '@/lib/coach-capabilities';
import { listVisibleBudgetCategories } from '@/lib/coach-budget-items';

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
