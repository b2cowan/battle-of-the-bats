import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import {
  mapBudgetItem as mapItem, parseBudgetItemDirection, BUDGET_ITEM_DIRECTION_REQUIRED,
  budgetItemSourceForCategory, categoryOfferedToClub, type OwnedBudgetCategory,
} from '@/lib/coach-budget-items';

function gate(ctx: Awaited<ReturnType<typeof getAuthContextWithRole>>) {
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_accounting')) return forbidden();
  if (!hasModuleEntitlement(ctx.org, 'module_accounting')) return forbidden();
  return null;
}

/* ⚠ THE MAPPER MOVED TO `lib/coach-budget-items.ts` (/simplify, 2026-08-16) — it was the third
   byte-for-byte copy. The one that sat here carried the line "mig 243 — null on anything an admin
   creates: only the platform library is tagged", which mig 246 made false: this route now REQUIRES
   a direction and the column is NOT NULL. `team_id` is still always null on this door, which is the
   only thing the local copy actually said that the shared one does not — and it is a fact about the
   INSERT below, not about mapping, so it lives there now. */

// POST /api/admin/accounting/budget-categories/[catId]/items
// Creates a custom item in any category (owner, treasurer, or coach).
// Custom items are scoped to this org regardless of whether the parent
// category is a platform default or an org custom.
export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ catId: string }> },) => {
  const { catId } = await params;
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = gate(ctx);
  if (err) return err;

  const allowedRoles = ['owner', 'treasurer', 'coach'];
  if (!allowedRoles.includes(ctx!.role)) return forbidden();

  /* Verify the category exists and is accessible (platform default or this org's).
     ⚠⚠ AND THAT IT IS NOT ONE TEAM'S OWN (mig 277). This is the club creating a word every team will
     be offered, so the heading it hangs under has to be one every team can reach. Filing it under a
     team's private heading would put a club-shared item somewhere only one team can see — and would
     hand the club's word to that team's cascade, since deleting a team drops its categories and
     everything filed under them. Same predicate as the club's own budget-line write path. */
  const { data: cat, error: catErr } = await supabaseAdmin
    .from('budget_categories')
    // ⚠ `income_source` (mig 285) — the shelf decides who fills its money-in words in, and this row
    // is already being fetched for the tier check.
    .select('id, org_id, team_id, income_source')
    .eq('id', catId)
    .or(`org_id.is.null,org_id.eq.${ctx!.org.id}`)
    .single();

  if (catErr || !cat || !categoryOfferedToClub(cat as OwnedBudgetCategory, ctx!.org.id)) {
    return NextResponse.json({ error: 'Category not found' }, { status: 404 });
  }

  const body = await req.json();
  const name: string = typeof body.name === 'string' ? body.name.trim() : '';
  const suggestedAmount: number | null =
    typeof body.suggestedAmount === 'number' && body.suggestedAmount > 0
      ? body.suggestedAmount
      : null;

  /* ⚠ WHICH WAY THE WORD POINTS IS REQUIRED (mig 246, owner ruling 2026-08-16). The coach picker
     FILTERS by it, so a club word created without one would appear in no team's list at all — the
     club would publish vocabulary nobody could select. The Org Budget screen is a spending plan, so
     its own picker answers 'out' without asking; the parameter exists so a future revenue surface
     does not inherit that assumption silently. */
  const direction = parseBudgetItemDirection(body.direction);

  if (!name || name.length > 80) {
    return NextResponse.json({ error: 'name is required and must be 80 characters or fewer' }, { status: 400 });
  }
  if (!direction) {
    return NextResponse.json({ error: BUDGET_ITEM_DIRECTION_REQUIRED }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('budget_items')
    .insert({
      category_id:      catId,
      org_id:           ctx!.org.id,
      // ⚠ NO `team_id`: an item an ADMIN creates is club-published by definition (mig 240), so it
      // is visible to every team from birth rather than owned by one.
      name,
      suggested_amount: suggestedAmount,
      is_default:       false,
      is_misc:          false,
      direction,
      /* ⚠⚠ THE SHELF DECIDES, NOT THE BODY (mig 285, owner ruling 2026-09-08) — the same rule and
         the same function the coach's door uses, because a club word and a coach word filed on one
         shelf must behave identically. A club publishing "Jersey sponsor" onto the Sponsorship shelf
         gets a word its teams' sponsors report, and the club's own Org Budget is a spending plan, so
         its `direction='out'` words are unaffected. */
      actual_source:    budgetItemSourceForCategory(direction, cat as { income_source?: string | null }),
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'An item with this name already exists in this category' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ item: mapItem(data) }, { status: 201 });
}, { route: '/api/admin/accounting/budget-categories/[catId]/items' });
