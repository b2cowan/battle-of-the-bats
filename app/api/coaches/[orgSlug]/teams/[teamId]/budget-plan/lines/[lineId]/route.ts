import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import { getCoachingAssignmentsForUser, getRepTeam, getActiveRepProgramYear } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { denyUnless, canWriteMoney } from '@/lib/coach-capabilities';
import { BUDGET_LINE_KINDS, isFundingKind, type BudgetLineKind } from '@/lib/coach-budget-totals';
import { resolveBudgetItem } from '@/lib/coach-budget-items';

async function resolveCoachContext(orgSlug: string, teamId: string) {
  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return { error: unauthorized() };
  if (ctx.org.slug !== orgSlug) return { error: forbidden() };

  const team = await getRepTeam(teamId);
  if (!team || team.orgId !== ctx.org.id) {
    return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  }

  const assignments = await getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id);
  const assignment = assignments.find(a => a.teamId === teamId);
  if (!assignment) return { error: forbidden() };

  const programYear = await getActiveRepProgramYear(teamId);
  if (!programYear) {
    return { error: NextResponse.json({ error: 'No active program year for this team' }, { status: 404 }) };
  }

  return { ctx, team, assignment, programYear };
}

// PATCH /api/coaches/[orgSlug]/teams/[teamId]/budget-plan/lines/[lineId]
// Updates description, totalAmount, or notes on a budget line.
export const PATCH = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; lineId: string }> },) => {
  const { orgSlug, teamId, lineId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, team, assignment, programYear } = resolved;
  const denied = denyUnless(canWriteMoney(assignment.capabilities), 'You do not have permission to change team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  // Verify line belongs to this program year. `line_kind` rides along because the item guard below
  // has to know what this line WILL be after the patch, not only what the request mentions.
  const { data: existing, error: fetchErr } = await supabaseAdmin
    .from('rep_budget_lines')
    .select('id, line_kind')
    .eq('id', lineId)
    .eq('program_year_id', programYear.id)
    .single();

  if (fetchErr || !existing) {
    return NextResponse.json({ error: 'Budget line not found' }, { status: 404 });
  }

  const body = await req.json();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (typeof body.description === 'string') {
    const d = body.description.trim();
    if (!d || d.length > 200) {
      return NextResponse.json({ error: 'description must be 1–200 characters' }, { status: 400 });
    }
    updates.description = d;
  }

  if (body.totalAmount !== undefined) {
    const amt = Number(body.totalAmount);
    if (isNaN(amt) || amt <= 0) {
      return NextResponse.json({ error: 'totalAmount must be a positive number' }, { status: 400 });
    }
    updates.total_amount = amt;
  }

  if ('notes' in body) {
    updates.notes = body.notes?.trim() || null;
  }

  if ('lineKind' in body) {
    if (!BUDGET_LINE_KINDS.includes(body.lineKind as BudgetLineKind)) {
      return NextResponse.json({ error: 'lineKind must be one of: cost, funding, sponsorship' }, { status: 400 });
    }
    // Switching kind is deliberately allowed and needs no other change: the amount is positive
    // either way and any period split still reconciles to it. A coach who filed sponsorship as a
    // cost fixes it in the same form they made it in.
    updates.line_kind = body.lineKind;
  }

  /* ⚠ THE ITEM RENAMES THE ROW, so this is no longer a link edit — it is a rename (mig 240). It
     must belong to the taxonomy THIS TEAM can see (platform, club-published, or its own), and the
     category is derived from it rather than accepted alongside it: an item lives in exactly one
     category, so trusting both would let a caller file a line under a category its item does not
     belong to and the report's two levels would disagree about one row.
     ⚠ `categoryId` FROM THE REQUEST IS IGNORED for the same reason. The POST was hardened during
     the Chunk G review and its PATCH sibling was not — that gap is closed here for good, because
     there is now nothing to accept. */
  if ('itemId' in body) {
    const itemId = body.itemId || null;
    const resolved = await resolveBudgetItem(itemId, ctx!.org.id, teamId, team.sport);
    if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: 400 });
    /* ⚠ A COST LINE MAY NOT BE STRIPPED BACK TO NOTHING. The create path refuses to make a cost
       line without an item; letting a PATCH clear one produces a state no form can create — a
       nameless cost line sitting under "Not itemized" — reachable from a stale tab or a replayed
       request, which is this route's stated threat model. The kind about to be stored is what
       matters: a request that flips the line to money-in in the same breath legitimately clears it. */
    const kindAfter = ('lineKind' in body ? body.lineKind : existing.line_kind) as string | null;
    if (!resolved.item && !isFundingKind(kindAfter)) {
      return NextResponse.json(
        { error: 'A cost line needs a category and item — they are what name it on your plan and your report.' },
        { status: 400 },
      );
    }
    updates.item_id     = resolved.item?.id ?? null;
    updates.category_id = resolved.item?.categoryId ?? null;
    // The NOT NULL text column follows the item, so anything reading it raw shows something true.
    if (resolved.item && typeof body.description !== 'string') updates.description = resolved.item.name;
  }

  const { data, error } = await supabaseAdmin
    .from('rep_budget_lines')
    .update(updates)
    .eq('id', lineId)
    .select('*, rep_budget_periods(*), budget_categories(name), budget_items(name)')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ line: data });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/budget-plan/lines/[lineId]' });

// DELETE /api/coaches/[orgSlug]/teams/[teamId]/budget-plan/lines/[lineId]
// Removes a budget line and its periods (cascade). Blocked if budget-generated
// installments already exist for this program year.
export const DELETE = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; lineId: string }> },) => {
  const { orgSlug, teamId, lineId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { assignment, programYear } = resolved;
  const denied2 = denyUnless(canWriteMoney(assignment.capabilities), 'You do not have permission to change team finances. Ask the head coach to grant it.');
  if (denied2) return denied2;

  const { data: existing, error: fetchErr } = await supabaseAdmin
    .from('rep_budget_lines')
    .select('id')
    .eq('id', lineId)
    .eq('program_year_id', programYear.id)
    .single();

  if (fetchErr || !existing) {
    return NextResponse.json({ error: 'Budget line not found' }, { status: 404 });
  }

  // Block deletion if budget-generated installments exist — the plan has been committed
  const schedules = await supabaseAdmin
    .from('rep_player_dues_schedules')
    .select('id')
    .eq('program_year_id', programYear.id)
    .eq('budget_line_id', lineId);

  const scheduleIds = (schedules.data ?? []).map((s: { id: string }) => s.id);

  if (scheduleIds.length > 0) {
    const { count } = await supabaseAdmin
      .from('rep_player_dues_installments')
      .select('id', { count: 'exact', head: true })
      .in('schedule_id', scheduleIds)
      .eq('source', 'budget_generated');

    if ((count ?? 0) > 0) {
      return NextResponse.json(
        { error: 'Cannot delete a budget line that has generated player installments. Void the installments first.' },
        { status: 409 },
      );
    }
  }

  const { error } = await supabaseAdmin.from('rep_budget_lines').delete().eq('id', lineId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return new NextResponse(null, { status: 204 });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/budget-plan/lines/[lineId]' });
