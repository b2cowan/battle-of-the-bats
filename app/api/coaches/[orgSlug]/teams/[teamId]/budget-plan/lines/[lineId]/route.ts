import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import { getCoachingAssignmentsForUser, getRepTeam, getActiveRepProgramYear } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';

async function resolveCoachContext(orgSlug: string, teamId: string) {
  const ctx = await getAuthContext();
  if (!ctx) return { error: unauthorized() };
  if (ctx.org.slug !== orgSlug) return { error: forbidden() };

  const team = await getRepTeam(teamId);
  if (!team || team.orgId !== ctx.org.id) {
    return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  }

  const assignments = await getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id);
  if (!assignments.find(a => a.teamId === teamId)) return { error: forbidden() };

  const programYear = await getActiveRepProgramYear(teamId);
  if (!programYear) {
    return { error: NextResponse.json({ error: 'No active program year for this team' }, { status: 404 }) };
  }

  return { ctx, team, programYear };
}

// PATCH /api/coaches/[orgSlug]/teams/[teamId]/budget-plan/lines/[lineId]
// Updates description, totalAmount, or notes on a budget line.
export const PATCH = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; lineId: string }> },) => {
  const { orgSlug, teamId, lineId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { programYear } = resolved;

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

  if ('categoryId' in body) updates.category_id = body.categoryId || null;
  if ('itemId'     in body) updates.item_id      = body.itemId     || null;

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
  const { programYear } = resolved;

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
