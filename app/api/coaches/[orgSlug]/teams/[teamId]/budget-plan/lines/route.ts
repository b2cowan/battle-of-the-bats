import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import { getCoachingAssignmentsForUser, getRepTeam, getActiveRepProgramYear } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';

async function resolveCoachContext(orgSlug: string, teamId: string) {
  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
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

// POST /api/coaches/[orgSlug]/teams/[teamId]/budget-plan/lines
// Adds a new estimated cost line to the team's budget plan.
export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, team, programYear } = resolved;

  const body = await req.json();

  const description: string = typeof body.description === 'string' ? body.description.trim() : '';
  const totalAmount: number = Number(body.totalAmount);
  const categoryId: string | null = body.categoryId || null;
  const itemId:     string | null = body.itemId     || null;
  const notes:      string | null = body.notes?.trim() || null;

  if (!description || description.length > 200) {
    return NextResponse.json({ error: 'description is required (max 200 chars)' }, { status: 400 });
  }
  if (isNaN(totalAmount) || totalAmount <= 0) {
    return NextResponse.json({ error: 'totalAmount must be a positive number' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('rep_budget_lines')
    .insert({
      org_id:          ctx!.org.id,
      team_id:         team.id,
      program_year_id: programYear.id,
      category_id:     categoryId,
      item_id:         itemId,
      description,
      total_amount:    totalAmount,
      notes,
    })
    .select('*, rep_budget_periods(*), budget_categories(name), budget_items(name)')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ line: data }, { status: 201 });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/budget-plan/lines' });
