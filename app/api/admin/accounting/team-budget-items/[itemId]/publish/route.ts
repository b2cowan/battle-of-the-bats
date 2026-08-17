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
 * ⚠⚠ IT PROMOTES, AND IT DELETES NOTHING (owner ruling 2026-08-17 — **clubs never absorb teams**).
 *
 * It used to absorb every same-named word on every other team: re-point their budget lines and
 * costs at the survivor, then delete their rows. The reasoning was sound and the implementation was
 * careful, and it still lost real money records three ways:
 *
 *   1. It re-pointed two of the FOUR tables that point at a word. `rep_team_money_in` arrived with
 *      migration 243, after this code, so every income and refund filed against an absorbed word
 *      had its item silently blanked — the exact "reappears under Not itemized and nothing tells
 *      anyone" failure the old comment here warned about, through the gap in its own list.
 *   2. It matched on `lower(name)` alone. Since migration 246 a word also has a SIDE, so "Grant" as
 *      income for one team and "Grant" as an expense for another were treated as one word — merged,
 *      with the survivor's side winning.
 *   3. The admin pressed it seeing "used by N lines", a count that only ever counted budget lines.
 *
 * The ruling removes the REASON for the deletion rather than repairing it: a coach can now tell a
 * club word from their own (the tier tag in the picker), so two rows with one name stopped being a
 * defect. **A merge that never runs cannot orphan a record.** Where a team does want to fall in
 * line, they fold their own words into a shared one themselves — see the team-side merge, where the
 * person pressing the button is the one whose records move.
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

  /* Promote, and stop. Clearing `team_id` is what makes the word visible to every team in the club;
     nothing else in the organization is read, changed or removed.

     ⚠ THE TEAM THAT INVENTED IT KEEPS ITS RECORDS UNTOUCHED, because they were never pointing at a
     copy — they point at this row, which has simply changed tier. No re-pointing is needed here and
     none should be added: the only re-pointing this product does is the one a coach asks for. */
  const { error: promoteError } = await supabaseAdmin
    .from('budget_items').update({ team_id: null }).eq('id', item.id);
  if (promoteError) return NextResponse.json({ error: promoteError.message }, { status: 500 });

  /* How many other teams happen to have a word by this name — REPORTED, NEVER ACTED ON. The admin
     asked to share a word; telling them who else already has one lets them go and ask those coaches
     to fold theirs in, which is the only way words merge now. Matching stays deliberately loose
     (name and category, ignoring the side) precisely because it no longer decides anything: this is
     a hint for a human, not a rule for a delete. */
  const { data: twins } = await supabaseAdmin
    .from('budget_items')
    .select('id, name, team_id')
    .eq('org_id', ctx!.org.id)
    .eq('category_id', item.category_id)
    .not('team_id', 'is', null)
    .neq('id', item.id);

  const alsoHaveIt = ((twins ?? []) as Array<{ id: string; name: string }>)
    .filter(t => t.name.trim().toLowerCase() === (item.name as string).trim().toLowerCase())
    .length;

  return NextResponse.json({
    ok: true,
    published: { id: item.id, name: item.name },
    /** Teams with a word of the same name, for the admin's information. Nothing was done to them. */
    alsoHaveIt,
  });
}, { route: '/api/admin/accounting/team-budget-items/[itemId]/publish' });
