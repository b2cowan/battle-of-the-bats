import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import { getCoachingAssignmentsForUser, getRepTeam, getActiveRepProgramYear } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { canViewMoney, canWriteMoney, denyUnless } from '@/lib/coach-capabilities';

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
    return { error: NextResponse.json({ error: 'No active program year' }, { status: 404 }) };
  }

  return { ctx, team, assignment, programYear };
}

// GET /api/coaches/[orgSlug]/teams/[teamId]/players/[playerId]/dues-credits
export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; playerId: string }> },) => {
  const { orgSlug, teamId, playerId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { assignment, programYear } = resolved;
  const denied = denyUnless(canViewMoney(assignment.capabilities), 'You do not have access to team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  const { data, error } = await supabaseAdmin
    .from('rep_dues_credits')
    .select('*')
    .eq('program_year_id', programYear.id)
    .eq('player_id', playerId)
    .order('credit_date', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const credits = (data ?? []).map((r: Record<string, unknown>) => ({
    id:            r.id,
    programYearId: r.program_year_id,
    playerId:      r.player_id,
    amount:        r.amount,
    description:   r.description,
    creditDate:    r.credit_date,
    creditType:    r.credit_type,
    notes:         r.notes ?? null,
    createdAt:     r.created_at,
  }));

  return NextResponse.json({ credits });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/players/[playerId]/dues-credits' });

// POST /api/coaches/[orgSlug]/teams/[teamId]/players/[playerId]/dues-credits
export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; playerId: string }> },) => {
  const { orgSlug, teamId, playerId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, assignment, programYear } = resolved;
  const denied = denyUnless(canWriteMoney(assignment.capabilities), 'You do not have access to team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  const body = await req.json();
  const { amount, description, creditType = 'contribution', creditDate, notes = null } = body;

  if (typeof amount !== 'number' || amount <= 0) {
    return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 });
  }
  if (!description?.trim()) {
    return NextResponse.json({ error: 'description is required' }, { status: 400 });
  }
  if (!creditDate) {
    return NextResponse.json({ error: 'creditDate is required' }, { status: 400 });
  }
  const validTypes = ['contribution', 'fundraiser', 'overpayment', 'other'];
  if (!validTypes.includes(creditType)) {
    return NextResponse.json({ error: 'Invalid creditType' }, { status: 400 });
  }

  // Verify player belongs to this program year
  const { data: playerRow } = await supabaseAdmin
    .from('rep_roster_players')
    .select('id')
    .eq('id', playerId)
    .eq('program_year_id', programYear.id)
    .single();

  if (!playerRow) {
    return NextResponse.json({ error: 'Player not found in this program year' }, { status: 404 });
  }

  const { data, error } = await supabaseAdmin
    .from('rep_dues_credits')
    .insert({
      program_year_id: programYear.id,
      player_id:       playerId,
      amount:          Math.round(amount * 100) / 100,
      description:     description.trim(),
      credit_type:     creditType,
      credit_date:     creditDate,
      notes:           notes?.trim() || null,
      created_by:      ctx.user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    credit: {
      id:            data.id,
      programYearId: data.program_year_id,
      playerId:      data.player_id,
      amount:        data.amount,
      description:   data.description,
      creditDate:    data.credit_date,
      creditType:    data.credit_type,
      notes:         data.notes ?? null,
      createdAt:     data.created_at,
    },
  }, { status: 201 });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/players/[playerId]/dues-credits' });
