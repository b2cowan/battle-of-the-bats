import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';

function gate(ctx: Awaited<ReturnType<typeof getAuthContextWithRole>>) {
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_accounting')) return forbidden();
  if (!hasModuleEntitlement(ctx.org, 'module_accounting')) return forbidden();
  return null;
}

// PATCH /api/admin/accounting/budget-categories/[catId]
// Renames one of the club's SHARED categories (owner/treasurer only).
//
// ⚠⚠ THE FIRST RENAME THIS TABLE HAS EVER HAD, and it only became safe to offer with migration 277.
// Until then every category was one flat org-wide pool with no record of who created it, so there
// was no answer to "whose word is this?" — a rename here could relabel a heading a coach wrote and
// six other teams plan under, silently, on screens nobody would think to check. Ownership makes the
// question answerable, and this route answers it the narrow way: the club renames the club's.
//
// ⚠ OWNER OR TREASURER, MATCHING EVERY OTHER WRITE ON THIS ROUTE FAMILY (owner ruling 2026-09-04).
// The generic `admin` role deliberately does NOT get this: the club's shared vocabulary already has
// exactly one write boundary, and widening it here would make this one control answer to a different
// rule than the create beside it.
//
// ⚠ DELETE IS DELIBERATELY ABSENT, on both tiers (COACH_BUDGET_TAB_REVAMP_PLAN §6.2, carried into
// COACH_BUDGET_CATEGORY_OWNERSHIP_PLAN §2). Removing a heading cascades its items, and every record
// filed against those items would lose its classification at once, across every team. Rename reaches
// every one of those records and loses none of them, which is exactly why it is the offered remedy.
export const PATCH = withObservability(async (req: Request,
  { params }: { params: Promise<{ catId: string }> },) => {
  const { catId } = await params;
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = gate(ctx);
  if (err) return err;

  if (ctx!.role !== 'owner' && ctx!.role !== 'treasurer') return forbidden();

  const { data: existing, error: fetchErr } = await supabaseAdmin
    .from('budget_categories')
    .select('id, org_id, team_id, name')
    .eq('id', catId)
    .single();

  if (fetchErr || !existing) {
    return NextResponse.json({ error: 'Category not found' }, { status: 404 });
  }
  if (existing.org_id !== ctx!.org.id) {
    return NextResponse.json({ error: 'Standard categories cannot be renamed' }, { status: 403 });
  }
  /* ⚠⚠ A TEAM'S OWN HEADING IS NOT THE CLUB'S TO REWORD (mig 277) — the same rule, and the same
     sentence, the item PATCH one level down has carried since mig 240. The club can SEE every team's
     categories on its own reports, which is the whole point of keeping them visible; seeing is not
     owning. Renaming one from here would change a heading on a plan the club does not own, and the
     coach who wrote it would have no idea why. Unlike items there is no publish door out of this:
     a team's heading stays the team's, because the club can simply share a heading of its own. */
  if (existing.team_id) {
    return NextResponse.json(
      { error: 'That category belongs to a team. Only that team can rename it.' },
      { status: 403 },
    );
  }

  const body = await req.json();
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name || name.length > 80) {
    return NextResponse.json({ error: 'name must be 1–80 characters' }, { status: 400 });
  }

  /* No DB unique index backs category names (there never has been one — see mig 277's note), so the
     case-insensitive check lives here, exactly as it does on the coach's create path. Scoped to what
     the CLUB can see: standard categories and the club's own, never a team's private heading, which
     the club has no way to open and would be baffled to collide with. */
  const { data: siblings } = await supabaseAdmin
    .from('budget_categories')
    .select('id, name, team_id')
    .or(`org_id.is.null,org_id.eq.${ctx!.org.id}`)
    .ilike('name', name);
  const clash = (siblings ?? []).some(c =>
    c.id !== catId && !c.team_id && String(c.name).trim().toLowerCase() === name.toLowerCase());
  if (clash) {
    return NextResponse.json({ error: 'A category with this name already exists' }, { status: 409 });
  }

  const { data, error } = await supabaseAdmin
    .from('budget_categories')
    .update({ name })
    .eq('id', catId)
    .select('id, org_id, team_id, name, scope, sort_order, is_default, created_at')
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A category with this name already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ category: data });
}, { route: '/api/admin/accounting/budget-categories/[catId]' });
