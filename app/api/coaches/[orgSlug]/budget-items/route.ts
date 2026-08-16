import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getCoachingAssignmentsForUser } from '@/lib/db';
import type { BudgetCategoryWithItems, BudgetItem } from '@/lib/types';
import { withObservability } from '@/lib/observability';
import { canViewMoney, canWriteMoney, denyUnless } from '@/lib/coach-capabilities';
import {
  budgetItemTier, itemVisibleToTeam, listVisibleBudgetItems,
  type BudgetItemTier, type OwnedBudgetItem,
} from '@/lib/coach-budget-items';

/** Ours first, then the club's, then this team's own — so a coach meets the standard vocabulary
 *  before the local additions, and the additions read as additions. */
const TIER_ORDER: Record<BudgetItemTier, number> = { platform: 0, club: 1, team: 2 };

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
    createdAt:       row.created_at as string,
  };
}

async function resolveCoachContext(orgSlug: string) {
  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return { error: unauthorized() };
  if (ctx.org.slug !== orgSlug) return { error: forbidden() };

  const assignments = await getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id);
  if (!assignments.length) return { error: forbidden() };

  return { ctx, assignments };
}

// GET /api/coaches/[orgSlug]/budget-items?teamId=…
// Returns platform defaults + this org's categories/items visible to coaches.
// Only 'team' and 'both' scoped categories are returned (org-only categories
// are admin tools, not relevant to the team budget planner).
//
// ⚠ `teamId` DECIDES WHAT THE TEAM TIER CONTRIBUTES (mig 240). With it, the caller gets platform +
// club + that team's own items. WITHOUT it the team tier is dropped entirely rather than opened up:
// a list that leaked one team's vocabulary to another is the exact thing the tiers exist to prevent,
// and an omitted parameter must fail closed.
//
// ⚠ "MISC" ITEMS ARE NOT OFFERED (owner ruling 2026-08-15). The item names the budget row now, and a
// report row called "Misc" answers nothing. They stay in the database so lines written before this
// still resolve their name; they are simply never choosable again.
export const GET = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string }> },) => {
  const { orgSlug } = await params;
  const resolved = await resolveCoachContext(orgSlug);
  if ('error' in resolved) return resolved.error!;
  const { ctx, assignments } = resolved;
  const denied = denyUnless(assignments.some(a => canViewMoney(a.capabilities)), 'You do not have access to team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  // Only a team this coach is actually assigned to can widen the list.
  const askedTeamId = new URL(req.url).searchParams.get('teamId');
  const teamId = askedTeamId && assignments.some(a => a.teamId === askedTeamId) ? askedTeamId : null;

  const { data, error } = await supabaseAdmin
    .from('budget_categories')
    .select('*, budget_items(*)')
    .or(`org_id.is.null,org_id.eq.${ctx.org.id}`)
    .in('scope', ['team', 'both'])
    .order('sort_order');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const categories: BudgetCategoryWithItems[] = (data ?? []).map(row => ({
    id:        row.id as string,
    orgId:     row.org_id as string | null,
    name:      row.name as string,
    scope:     row.scope as 'org' | 'team' | 'both',
    sortOrder: row.sort_order as number,
    isDefault: row.is_default as boolean,
    createdAt: row.created_at as string,
    items:     ((row.budget_items ?? []) as Record<string, unknown>[])
      .filter(item => !item.is_misc)
      .filter(item => teamId
        ? itemVisibleToTeam(item as OwnedBudgetItem, ctx.org.id, teamId)
        // No team named: platform + club only. A team's own item is never in this answer.
        : !item.team_id)
      .map(mapItem)
      .sort((a, b) => {
        // The club's and the team's own words sit under ours, so the standard vocabulary is what a
        // coach meets first and the local additions read as additions.
        // ⚠ Through `budgetItemTier`, never a local re-derivation: that function is the ONE place
        // the three tiers are decided, and an inline copy here is the fourth surface computing the
        // same fact — the drift the module was written to prevent.
        const rank = (i: BudgetItem) =>
          TIER_ORDER[budgetItemTier({ org_id: i.orgId, team_id: i.teamId })];
        if (rank(a) !== rank(b)) return rank(a) - rank(b);
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
        return a.name.localeCompare(b.name);
      }),
  }));

  return NextResponse.json({ categories });
}, { route: '/api/coaches/[orgSlug]/budget-items' });

// POST /api/coaches/[orgSlug]/budget-items
// Lets a coach add a custom item to any accessible category — or, with
// `newCategoryName`, create a whole new top-level category (owner decision
// 2026-07-09: coaches can create categories just like items).
//
// ⚠ AN ITEM NOW BELONGS TO THE TEAM THAT CREATED IT (mig 240), not to the whole org. It appears in
// that team's picker and no other's; a club admin can see it and PUBLISH it to every team. This
// reverses the behaviour every comment and help sentence used to promise ("saved to your org's
// library and selectable for all coaches") — the item is the NAME of a budget row now, and one
// team's specifics filling every other team's list was the cost the owner refused (2026-08-15).
//
// ⚠ CATEGORIES ARE STILL ORG-WIDE. A category is a heading, not a name: there are a dozen of them,
// clubs want them shared, and the report's top level would fragment if each team invented its own.
export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string }> },) => {
  const { orgSlug } = await params;
  const resolved = await resolveCoachContext(orgSlug);
  if ('error' in resolved) return resolved.error!;
  const { ctx, assignments } = resolved;
  const denied = denyUnless(assignments.some(a => canWriteMoney(a.capabilities)), 'You do not have access to team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  const body = await req.json();

  // ── Create a new category ────────────────────────────────────────────────
  const newCategoryName: string = typeof body.newCategoryName === 'string' ? body.newCategoryName.trim() : '';
  if (newCategoryName) {
    if (newCategoryName.length > 80) {
      return NextResponse.json({ error: 'Category name must be 80 characters or fewer' }, { status: 400 });
    }
    // No DB unique constraint exists on category names — enforce case-insensitive
    // uniqueness here so "Uniforms" can't be created a dozen times.
    const { data: existing } = await supabaseAdmin
      .from('budget_categories')
      .select('id, name')
      .or(`org_id.is.null,org_id.eq.${ctx.org.id}`)
      .ilike('name', newCategoryName);
    if ((existing ?? []).some(c => (c.name as string).toLowerCase() === newCategoryName.toLowerCase())) {
      return NextResponse.json({ error: 'A category with this name already exists' }, { status: 409 });
    }
    const { data: cat, error: catError } = await supabaseAdmin
      .from('budget_categories')
      .insert({ org_id: ctx.org.id, name: newCategoryName, scope: 'team', is_default: false })
      .select('*, budget_items(*)')
      .single();

    if (catError) {
      if (catError.code === '23505') {
        return NextResponse.json({ error: 'A category with this name already exists' }, { status: 409 });
      }
      return NextResponse.json({ error: catError.message }, { status: 500 });
    }

    const category: BudgetCategoryWithItems = {
      id:        cat.id as string,
      orgId:     cat.org_id as string | null,
      name:      cat.name as string,
      scope:     cat.scope as 'org' | 'team' | 'both',
      sortOrder: cat.sort_order as number,
      isDefault: cat.is_default as boolean,
      createdAt: cat.created_at as string,
      items:     [],
    };
    return NextResponse.json({ category }, { status: 201 });
  }

  // ── Create a new item in an existing category ────────────────────────────
  const catId: string = typeof body.categoryId === 'string' ? body.categoryId.trim() : '';
  const name: string  = typeof body.name === 'string' ? body.name.trim() : '';
  const teamId: string = typeof body.teamId === 'string' ? body.teamId.trim() : '';
  const suggestedAmount: number | null =
    typeof body.suggestedAmount === 'number' && body.suggestedAmount > 0
      ? body.suggestedAmount
      : null;

  if (!catId) {
    return NextResponse.json({ error: 'categoryId is required' }, { status: 400 });
  }
  if (!name || name.length > 80) {
    return NextResponse.json({ error: 'name is required and must be 80 characters or fewer' }, { status: 400 });
  }
  // ⚠ REQUIRED, AND CHECKED AGAINST THIS COACH'S OWN ASSIGNMENTS. An item has to belong to a team
  // now, and accepting an unowned one would quietly recreate the org-wide behaviour this replaced —
  // silently, on a path that already works.
  if (!teamId || !assignments.some(a => a.teamId === teamId)) {
    return NextResponse.json({ error: 'teamId is required and must be a team you coach' }, { status: 400 });
  }

  // Verify category is accessible (platform default or this org's, team/both scope)
  const { data: cat, error: catErr } = await supabaseAdmin
    .from('budget_categories')
    .select('id, scope')
    .eq('id', catId)
    .or(`org_id.is.null,org_id.eq.${ctx.org.id}`)
    .in('scope', ['team', 'both'])
    .single();

  if (catErr || !cat) {
    return NextResponse.json({ error: 'Category not found' }, { status: 404 });
  }

  /* ⚠ AN IDENTICAL NAME ALREADY VISIBLE TO THIS TEAM IS RETURNED, NOT REFUSED. The uniqueness index
     is per (category, org, team) — so a coach CAN create "Provincials entry" while the club already
     publishes one, and the picker would then show the same words twice with the reports splitting
     between them. That is the exact fragmentation the tiers exist to prevent, and a 409 would just
     leave the coach stuck beside an item they cannot see the point of. Handing back the existing one
     is the honest answer: they wanted that item, and now they have it. */
  const visible = await listVisibleBudgetItems(ctx.org.id, teamId);
  const already = visible.find(i =>
    i.category_id === catId && String(i.name).trim().toLowerCase() === name.toLowerCase());
  if (already) return NextResponse.json({ item: mapItem(already) }, { status: 200 });

  const { data, error } = await supabaseAdmin
    .from('budget_items')
    .insert({
      category_id:      catId,
      org_id:           ctx.org.id,
      team_id:          teamId,
      name,
      suggested_amount: suggestedAmount,
      is_default:       false,
      is_misc:          false,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      /* ⚠ SOMEBODY CREATED IT BETWEEN OUR CHECK AND OUR INSERT — a second tab, or an import running
         at the same moment. The pre-check above hands back an existing item precisely so a coach is
         never stuck beside a name they cannot use; a 409 here would break that promise for whoever
         loses the race, which is the one case the coach can do nothing about. Hand back the winner. */
      const winner = (await listVisibleBudgetItems(ctx.org.id, teamId)).find(i =>
        i.category_id === catId && String(i.name).trim().toLowerCase() === name.toLowerCase());
      if (winner) return NextResponse.json({ item: mapItem(winner) }, { status: 200 });
      return NextResponse.json({ error: 'An item with this name already exists in this category' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ item: mapItem(data) }, { status: 201 });
}, { route: '/api/coaches/[orgSlug]/budget-items' });
