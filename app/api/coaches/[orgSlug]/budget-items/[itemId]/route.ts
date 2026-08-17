import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getCoachingAssignmentsForUser } from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { denyUnlessTeamMoneyWrite } from '@/lib/coach-capabilities';
import {
  mapBudgetItem, countBudgetItemUsage, describeBudgetItemUsage,
} from '@/lib/coach-budget-items';

/**
 * A TEAM'S OWN WORDS — rename, or remove (Money form P2; scope narrowed by owner ruling 2026-08-17).
 *
 * Migration 246 made an item's direction part of what it IS — the picker filters by it — so "you
 * can change it afterwards" stopped being a nicety and became the thing that makes the filter safe
 * to ship. Nowhere in the product could do it: a coach's item could not be renamed from anywhere,
 * and the club-admin editor refuses team-owned rows outright ("only that team can rename it")
 * against a team surface that did not exist.
 *
 * ⚠⚠ TWO ACTIONS, AND DELIBERATELY NOT A THIRD. This route shipped on 2026-08-16 able to move a
 * word between income and expenses, and that ability was retracted the next day: a category can
 * belong to one side of the books, so a moved word can land under a heading that makes no sense for
 * it. See the refusal in PATCH, and the usage guard in DELETE.
 *
 * ⚠⚠ THIS TEAM'S OWN ITEMS ONLY, AND THAT IS NOT A CONVENIENCE GATE. A platform word is ours; a
 * club-published word names budget rows on every other team in the org, so a coach renaming one
 * would rewrite plans they do not own and the coaches who wrote them would have no idea why. The
 * one-way tier rule (lib/coach-budget-items.ts) says a published item can never be taken back —
 * this is the same rule, applied to editing rather than ownership.
 *
 * ⚠ RENAMING IS RETROACTIVE, BY DESIGN, and that is why it is the remedy every refusal here offers.
 * The item NAMES the row (mig 240), so every budget line, cost and money-in record already pointing
 * at it reads the new word immediately — it reaches everything and loses nothing.
 */
// PATCH /api/coaches/[orgSlug]/budget-items/[itemId]
//   { teamId, name? }
export const PATCH = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; itemId: string }> },) => {
  const { orgSlug, itemId } = await params;

  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();
  if (ctx.org.slug !== orgSlug) return forbidden();

  const assignments = await getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id);
  if (!assignments.length) return forbidden();

  const body = await req.json().catch(() => ({}));
  const teamId: string = typeof body.teamId === 'string' ? body.teamId.trim() : '';
  /* ⚠ THE TEAM IS NAMED AND CHECKED, exactly as the create path requires it. The item carries its
     own owning team, but taking that as the authorisation would let any coach in the org edit any
     team's word — the row would authorise itself. The caller states which team it is acting as, we
     verify they coach it, and only then does the item's own ownership have to agree. */
  const denied = denyUnlessTeamMoneyWrite(assignments, teamId);
  if (denied) return denied;

  const { data: item } = await supabaseAdmin
    .from('budget_items')
    .select('id, org_id, team_id, category_id, name, direction')
    .eq('id', itemId)
    .maybeSingle();

  // One answer for "no such item", "another club's" and "another team's" — separating them would
  // confirm the existence of another team's rows to anyone who guessed an id.
  if (!item || item.org_id !== ctx.org.id || item.team_id !== teamId) {
    return NextResponse.json({
      error: 'You can only change words your own team created. Standard words and the ones your club '
        + 'shares belong to everybody, so they are read-only here.',
    }, { status: 403 });
  }

  const updates: Record<string, unknown> = {};

  if (typeof body.name === 'string') {
    const name = body.name.trim();
    if (!name || name.length > 80) {
      return NextResponse.json({ error: 'A name is required, and must be 80 characters or fewer' }, { status: 400 });
    }
    updates.name = name;
  }

  /* ⚠⚠ A WORD NEVER CHANGES SIDES (owner ruling 2026-08-17) — and this route SHIPPED the ability to
     do it, on 2026-08-16, one day earlier. It is retracted rather than kept quiet.
     The reason is the categories: a category can belong to one side of the books, so a word moved
     across can land under a heading that makes no sense for it — "Diamond permits" sitting in
     Sponsorship. The case is rare enough that removing the word and adding it properly is the honest
     answer, and a word with history behind it cannot be removed anyway, which makes the wrong-side
     word a five-second problem rather than a data one.
     ⚠ A `direction` in the body is now REFUSED rather than ignored. Silently dropping it would let a
     stale client believe it had moved a word, and the coach would find out from the picker. */
  if ('direction' in body) {
    return NextResponse.json({
      error: 'A word stays on the side it was created on. Categories can belong to income or to '
        + 'expenses, so moving one across can leave it filed under a heading that makes no sense. '
        + 'Remove it and add it on the other side instead.',
    }, { status: 400 });
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nothing to change' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('budget_items')
    .update(updates)
    .eq('id', itemId)
    .select()
    .single();

  if (error) {
    /* Since migration 248 the index is (category, org, team, SIDE, name), so this fires only when
       the new name already belongs to one of this team's own words in the same category ON THE SAME
       SIDE. The other side is a different word now and no longer collides. */
    if (error.code === '23505') {
      return NextResponse.json({
        error: `Your team already has a word called “${updates.name}” in this category.`,
      }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ item: mapBudgetItem(data) });
}, { route: '/api/coaches/[orgSlug]/budget-items/[itemId]' });

/**
 * Remove a word this team invented (owner ruling 2026-08-17).
 *
 * ⚠⚠ REFUSED WHILE ANYTHING IS FILED AGAINST IT, and that guard is the whole feature. All four
 * links into a budget word are `ON DELETE SET NULL`, so an unguarded delete does not fail — it
 * blanks the item on every budget line, cost and money-in record pointing at it, which then read as
 * "Not itemized" with nothing said to anyone. Counting through `countBudgetItemUsage` rather than
 * naming tables here is deliberate: that list is the single place the four are enumerated, and a
 * guard that counts three of them is the original publish bug wearing a newer comment.
 *
 * ⚠ RENAMING IS THE OFFERED WAY OUT, and the refusal says so — it reaches every record and loses
 * none of them, which is exactly what someone fixing a typo actually wants.
 *
 * ⚠ THE TEAM'S OWN WORDS ONLY. A standard word is ours and a club-published one names budget rows
 * on every other team in the org; the same one-way tier rule the PATCH above enforces.
 */
// DELETE /api/coaches/[orgSlug]/budget-items/[itemId]?teamId=…
export const DELETE = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; itemId: string }> },) => {
  const { orgSlug, itemId } = await params;

  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();
  if (ctx.org.slug !== orgSlug) return forbidden();

  const assignments = await getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id);
  if (!assignments.length) return forbidden();

  /* ⚠ THE TEAM RIDES IN THE QUERY, and is checked the same way the PATCH checks its body — the item
     must not authorise itself, or any coach in the org could remove any team's word. */
  const teamId = new URL(req.url).searchParams.get('teamId')?.trim() ?? '';
  const denied = denyUnlessTeamMoneyWrite(assignments, teamId);
  if (denied) return denied;

  const { data: item } = await supabaseAdmin
    .from('budget_items')
    .select('id, org_id, team_id, name')
    .eq('id', itemId)
    .maybeSingle();

  if (!item || item.org_id !== ctx.org.id || item.team_id !== teamId) {
    return NextResponse.json({
      error: 'You can only remove words your own team created. Standard words and the ones your club '
        + 'shares belong to everybody.',
    }, { status: 403 });
  }

  const usage = await countBudgetItemUsage([itemId]);
  if (usage.total > 0) {
    return NextResponse.json({
      error: `“${item.name}” is in use — ${describeBudgetItemUsage(usage)} are filed against it. `
        + `Removing it would leave every one of them unclassified. Rename it instead, which reaches `
        + `them all and loses nothing.`,
    }, { status: 409 });
  }

  const { error } = await supabaseAdmin.from('budget_items').delete().eq('id', itemId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return new NextResponse(null, { status: 204 });
}, { route: '/api/coaches/[orgSlug]/budget-items/[itemId]' });
