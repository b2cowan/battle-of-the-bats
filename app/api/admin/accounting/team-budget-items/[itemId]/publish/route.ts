import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';

/**
 * Publish ONE team's budget item to every team in the club (mig 240).
 *
 * The one sanctioned way a word crosses between teams, and it is always a person's decision. Owner
 * ruling 2026-08-15: *"we shouldn't populate 1 team's list with another team. Perhaps we can have an
 * org create ones that they want to send to all teams but not from team to team."*
 *
 * ⚠ IT ABSORBS THE DUPLICATES, and that is the point rather than a nicety. Publishing "Provincials
 * entry" while two other teams have each invented their own would leave three items with identical
 * names in one category — the picker showing the same words three times and Budget vs. Actual
 * splitting one item's spending across three rows. That is precisely the fragmentation the tiers
 * exist to prevent, arriving through the door meant to fix it. So every same-named item in the same
 * category is repointed at the published one and removed.
 *
 * ⚠ REPOINT BEFORE DELETE, ALWAYS. `rep_budget_lines.item_id` is ON DELETE SET NULL, so deleting a
 * duplicate first would silently strip the item off a coach's budget line and leave the row nameless
 * under "Not itemized" — losing the very classification this whole change exists to establish.
 *
 * ⚠ THERE IS NO UNPUBLISH. An item a team is already planning against cannot be taken back from it;
 * the reverse operation has no safe meaning.
 */
function gate(ctx: Awaited<ReturnType<typeof getAuthContextWithRole>>) {
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_accounting')) return forbidden();
  if (!hasModuleEntitlement(ctx.org, 'module_accounting')) return forbidden();
  return null;
}

export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ itemId: string }> },) => {
  const { itemId } = await params;
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = gate(ctx);
  if (err) return err;
  // Publishing changes what every coach in the club sees, so it sits with the roles that own the
  // org's money, exactly like editing a club item.
  if (ctx!.role !== 'owner' && ctx!.role !== 'treasurer') return forbidden();

  const { data: item } = await supabaseAdmin
    .from('budget_items')
    .select('id, name, category_id, org_id, team_id')
    .eq('id', itemId)
    .maybeSingle();

  if (!item || item.org_id !== ctx!.org.id) {
    return NextResponse.json({ error: 'Item not found' }, { status: 404 });
  }
  if (!item.team_id) {
    return NextResponse.json({ error: 'That item is already published to every team.' }, { status: 409 });
  }

  // Every other team's item with the same name in the same category — the rows about to be absorbed.
  const { data: twins } = await supabaseAdmin
    .from('budget_items')
    .select('id, name, team_id')
    .eq('org_id', ctx!.org.id)
    .eq('category_id', item.category_id)
    .not('team_id', 'is', null)
    .neq('id', item.id);

  const duplicates = ((twins ?? []) as Array<{ id: string; name: string }>)
    .filter(t => t.name.trim().toLowerCase() === (item.name as string).trim().toLowerCase());

  // 1. Promote. Clearing team_id is what makes it visible to every team in the club.
  const { error: promoteError } = await supabaseAdmin
    .from('budget_items').update({ team_id: null }).eq('id', item.id);
  if (promoteError) return NextResponse.json({ error: promoteError.message }, { status: 500 });

  // 2. Repoint every duplicate's budget lines AND expenses at the survivor, then remove them.
  let linesMoved = 0;
  let costsMoved = 0;
  if (duplicates.length > 0) {
    const dupIds = duplicates.map(d => d.id);
    // Two different tables, neither result feeding the other — no reason to wait for one to
    // finish before starting the other.
    const [lineMove, costMove] = await Promise.all([
      supabaseAdmin.from('rep_budget_lines')
        .update({ item_id: item.id }).in('item_id', dupIds).select('id'),
      supabaseAdmin.from('rep_team_expenses')
        .update({ budget_item_id: item.id }).in('budget_item_id', dupIds).select('id'),
    ]);

    /* ⚠⚠ THE DELETE IS THE DESTRUCTIVE HALF, AND IT ONLY RUNS IF THE REPOINT WORKED. Both link
       columns are ON DELETE SET NULL, so removing a duplicate whose rows were NOT successfully
       moved silently strips the item off another team's budget lines and recorded costs — they
       reappear under "Not itemized" and nothing tells anyone. Reporting success while that happens
       is worse than refusing: the surviving item is already published (harmless on its own, and a
       coach can still pick it), so we stop here and say what did and did not happen rather than
       finishing a job we know went wrong halfway. */
    if (lineMove.error || costMove.error) {
      return NextResponse.json({
        error: `“${item.name}” is now available to every team, but the other teams’ copies could not be merged into it, so nothing was removed. Their budget lines and costs are untouched. Try publishing again.`,
      }, { status: 500 });
    }

    linesMoved = lineMove.data?.length ?? 0;
    costsMoved = costMove.data?.length ?? 0;

    const { error: deleteError } = await supabaseAdmin
      .from('budget_items').delete().in('id', dupIds);
    if (deleteError) {
      // The repoint succeeded, so nothing is stranded — the duplicates are simply still there,
      // now pointing at nothing. Say so rather than reporting a clean publish.
      return NextResponse.json({
        error: `“${item.name}” is published and every line was moved onto it, but the other teams’ duplicate entries could not be removed. They are now unused; try publishing again to clear them.`,
      }, { status: 500 });
    }
  }

  return NextResponse.json({
    ok: true,
    published: { id: item.id, name: item.name },
    /** What the confirmation tells the admin: this was not just a visibility flip. */
    absorbed: duplicates.length,
    linesMoved,
    costsMoved,
  });
}, { route: '/api/admin/accounting/team-budget-items/[itemId]/publish' });
