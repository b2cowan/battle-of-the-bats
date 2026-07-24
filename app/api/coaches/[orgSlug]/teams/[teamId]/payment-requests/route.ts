import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import { getCoachingAssignmentsForUser, getRepTeam } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability, captureAndJson } from '@/lib/observability';
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

  return { ctx, team, assignment };
}

// GET /api/coaches/[orgSlug]/teams/[teamId]/payment-requests
export const GET = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { assignment } = resolved;
  const denied = denyUnless(canViewMoney(assignment.capabilities), 'You do not have access to team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  const url = new URL(req.url);
  const status = url.searchParams.get('status') ?? undefined;

  let query = supabaseAdmin
    .from('rep_team_payment_requests')
    .select('*')
    .eq('team_id', teamId)
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return captureAndJson(error, { error: error.message }, 500);

  const requests = (data ?? []).map(r => ({
    id:                 r.id,
    requestType:        r.request_type,
    amount:             Number(r.amount),
    description:        r.description,
    paymentMethod:      r.payment_method ?? null,
    notes:              r.notes ?? null,
    status:             r.status,
    denialReason:       r.denial_reason ?? null,
    budgetLineId:       r.budget_line_id ?? null,
    accountingEntryId:  r.accounting_entry_id ?? null,
    createdBy:          r.created_by,
    reviewedBy:         r.reviewed_by ?? null,
    reviewedAt:         r.reviewed_at ?? null,
    createdAt:          r.created_at,
    updatedAt:          r.updated_at,
  }));

  return NextResponse.json({ requests });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/payment-requests' });

// POST /api/coaches/[orgSlug]/teams/[teamId]/payment-requests
export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, team, assignment } = resolved;
  const denied = denyUnless(canWriteMoney(assignment.capabilities), 'You do not have access to team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  const body = await req.json();
  const {
    requestType,
    amount,
    description,
    paymentMethod = null,
    notes = null,
    budgetLineId = null,
  } = body;

  if (!['payment_to_org', 'charge_to_org'].includes(requestType)) {
    return NextResponse.json({ error: 'requestType must be payment_to_org or charge_to_org' }, { status: 400 });
  }
  if (typeof amount !== 'number' || amount <= 0 || amount > 999999.99) {
    return NextResponse.json({ error: 'amount must be a positive number no greater than 999999.99' }, { status: 400 });
  }
  if (!description?.trim() || description.trim().length > 500) {
    return NextResponse.json({ error: 'description is required and must be 500 characters or fewer' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('rep_team_payment_requests')
    .insert({
      org_id:         team.orgId,
      team_id:        team.id,
      request_type:   requestType,
      amount,
      description:    description.trim(),
      payment_method: paymentMethod?.trim() || null,
      notes:          notes?.trim() || null,
      budget_line_id: budgetLineId || null,
      created_by:     ctx.user.id,
    })
    .select()
    .single();

  if (error) return captureAndJson(error, { error: error.message }, 500);

  return NextResponse.json({
    request: {
      id:           data.id,
      requestType:  data.request_type,
      amount:       Number(data.amount),
      description:  data.description,
      paymentMethod: data.payment_method ?? null,
      notes:        data.notes ?? null,
      status:       data.status,
      denialReason: null,
      budgetLineId: data.budget_line_id ?? null,
      createdBy:    data.created_by,
      createdAt:    data.created_at,
      updatedAt:    data.updated_at,
    },
  }, { status: 201 });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/payment-requests' });
