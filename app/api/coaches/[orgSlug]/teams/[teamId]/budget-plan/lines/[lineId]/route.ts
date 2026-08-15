import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import { getCoachingAssignmentsForUser, getRepTeam, getActiveRepProgramYear } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { denyUnless, canWriteMoney } from '@/lib/coach-capabilities';
import { BUDGET_LINE_KINDS, type BudgetLineKind } from '@/lib/coach-budget-totals';

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
  const { ctx, assignment, programYear } = resolved;
  const denied = denyUnless(canWriteMoney(assignment.capabilities), 'You do not have permission to change team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  // Verify line belongs to this program year
  const { data: existing, error: fetchErr } = await supabaseAdmin
    .from('rep_budget_lines')
    .select('id')
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

  // The FK payload must belong to this org's taxonomy (platform defaults are org_id NULL) — the
  // same ownership check the lines POST performs. Without it a crafted PATCH could relink a line
  // to, and echo back the name of, ANOTHER org's custom category or item. The POST was hardened
  // during the Chunk G review; its PATCH sibling was not, and still had the gap (chunk H).
  if ('categoryId' in body) {
    const categoryId = body.categoryId || null;
    if (categoryId) {
      const { data: cat } = await supabaseAdmin
        .from('budget_categories').select('id')
        .eq('id', categoryId).or(`org_id.is.null,org_id.eq.${ctx!.org.id}`)
        .maybeSingle();
      if (!cat) return NextResponse.json({ error: 'Category not found' }, { status: 400 });
    }
    updates.category_id = categoryId;
  }
  if ('itemId' in body) {
    const itemId = body.itemId || null;
    if (itemId) {
      const { data: item } = await supabaseAdmin
        .from('budget_items').select('id')
        .eq('id', itemId).or(`org_id.is.null,org_id.eq.${ctx!.org.id}`)
        .maybeSingle();
      if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 400 });
    }
    updates.item_id = itemId;
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
