import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getCoachingAssignmentsForUser } from '@/lib/db';
import type { BudgetItem } from '@/lib/types';
import { withObservability } from '@/lib/observability';
import { canWriteMoney, denyUnless } from '@/lib/coach-capabilities';

/**
 * A TEAM'S OWN WORDS, CORRECTABLE (Money form P2, owner ruling 2026-08-16).
 *
 * Migration 246 made an item's direction part of what it IS — the picker filters by it, so a word
 * on the wrong side is a word a coach cannot reach from the form they need it on. That turned "you
 * can change it afterwards" from a nicety into the thing that makes the filter safe to ship, and
 * there was nowhere in the product to do it: a coach's item could not be renamed or re-pointed from
 * anywhere, and the club-admin editor refuses team-owned rows outright ("only that team can rename
 * it") against a team surface that did not exist.
 *
 * ⚠⚠ THIS TEAM'S OWN ITEMS ONLY, AND THAT IS NOT A CONVENIENCE GATE. A platform word is ours; a
 * club-published word names budget rows on every other team in the org, so a coach renaming one
 * would rewrite plans they do not own and the coaches who wrote them would have no idea why. The
 * one-way tier rule (lib/coach-budget-items.ts) says a published item can never be taken back —
 * this is the same rule, applied to editing rather than ownership.
 *
 * ⚠ RENAMING IS RETROACTIVE, BY DESIGN. The item NAMES the row (mig 240), so every budget line and
 * every recorded cost already pointing at it reads the new word immediately. That is what a coach
 * fixing a typo wants; the screen says so before they save.
 *
 * ⚠ MOVING A WORD ACROSS MOVES NO MONEY. Budget vs. Actual takes a row's direction from what was
 * actually filed against it, never from this column — so an income entry filed against a word that
 * later becomes an expense keeps its own direction on the report. The one visible consequence is
 * the picker, which is why the form keeps showing a record's OWN item even when it now points the
 * other way: a saved row must never lose its item because a word moved.
 */
function mapItem(row: Record<string, unknown>): BudgetItem {
  return {
    id:              row.id as string,
    categoryId:      row.category_id as string,
    orgId:           row.org_id as string | null,
    teamId:          (row.team_id as string | null) ?? null,
    name:            row.name as string,
    suggestedAmount: row.suggested_amount as number | null,
    sortOrder:       row.sort_order as number,
    isDefault:       row.is_default as boolean,
    isMisc:          row.is_misc as boolean,
    direction:       (row.direction as 'in' | 'out' | null) ?? null,
    createdAt:       row.created_at as string,
  };
}

// PATCH /api/coaches/[orgSlug]/budget-items/[itemId]
//   { teamId, name?, direction? }
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
  if (!teamId || !assignments.some(a => a.teamId === teamId)) {
    return NextResponse.json({ error: 'teamId is required and must be a team you coach' }, { status: 400 });
  }
  const denied = denyUnless(
    assignments.some(a => a.teamId === teamId && canWriteMoney(a.capabilities)),
    'You do not have access to team finances. Ask the head coach to grant it.',
  );
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

  if ('direction' in body) {
    if (body.direction !== 'in' && body.direction !== 'out') {
      return NextResponse.json({ error: 'direction must be "in" or "out"' }, { status: 400 });
    }
    updates.direction = body.direction;
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
    /* The uniqueness index is per (category, org, team), so this fires when the new name already
       belongs to one of this team's own words in the same category — including one on the other
       side, which is the collision the create path names too. Say which, rather than "duplicate". */
    if (error.code === '23505') {
      return NextResponse.json({
        error: `Your team already has a word called “${updates.name}” in this category.`,
      }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ item: mapItem(data) });
}, { route: '/api/coaches/[orgSlug]/budget-items/[itemId]' });
