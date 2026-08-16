import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import { getCoachingAssignmentsForUser, getRepTeam } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability, captureAndJson } from '@/lib/observability';
import { canWriteMoney, denyUnless } from '@/lib/coach-capabilities';

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

/**
 * PATCH /api/coaches/[orgSlug]/teams/[teamId]/payment-requests/[id]
 *
 * Correct a request the club has NOT yet looked at (owner ruling 2026-08-15). Until this existed
 * the only recovery from a typo was to withdraw the request and type the whole thing again —
 * while the office may already have been reading it.
 *
 * ⚠ PENDING ONLY, AND THE SERVER IS WHERE THAT IS DECIDED. An approved request has already moved
 * money between the team's and the org's books, and a declined one carries a written reason that
 * answers what it said at the time; letting either be edited would rewrite the thing the club
 * acted on. The panel hides the fields too, but a hidden field is presentation — this check is
 * the rule.
 *
 * ⚠ STATUS, DENIAL REASON AND THE REVIEW STAMPS ARE NOT WRITEABLE HERE. Approving is the admin
 * route's job; a coach editing their own request must never be able to reach those columns, so
 * they are omitted from the update rather than filtered out of the body.
 */
export const PATCH = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; id: string }> },) => {
  const { orgSlug, teamId, id } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { team, assignment } = resolved;
  const denied = denyUnless(canWriteMoney(assignment.capabilities), 'You do not have access to team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  const body = await req.json();
  const { requestType, amount, description, paymentMethod = null, notes = null } = body;

  // Same three rules the POST enforces — a correction may not produce a request the create door
  // would have refused.
  if (!['payment_to_org', 'charge_to_org'].includes(requestType)) {
    return NextResponse.json({ error: 'requestType must be payment_to_org or charge_to_org' }, { status: 400 });
  }
  if (typeof amount !== 'number' || amount <= 0 || amount > 999999.99) {
    return NextResponse.json({ error: 'amount must be a positive number no greater than 999999.99' }, { status: 400 });
  }
  if (!description?.trim() || description.trim().length > 500) {
    return NextResponse.json({ error: 'description is required and must be 500 characters or fewer' }, { status: 400 });
  }

  const { data: existing, error: fetchErr } = await supabaseAdmin
    .from('rep_team_payment_requests')
    .select('id, team_id, status')
    .eq('id', id)
    .eq('org_id', team.orgId)
    .single();

  if (fetchErr || !existing) {
    return NextResponse.json({ error: 'Request not found' }, { status: 404 });
  }
  if (existing.team_id !== team.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (existing.status !== 'pending') {
    return NextResponse.json({ error: 'This request has already been reviewed, so it can no longer be changed.' }, { status: 409 });
  }

  /* ⚠⚠ THE WRITE RE-ASSERTS EVERY CONDITION THE READ ABOVE CHECKED — pending, org and team — and
     that is not belt-and-braces, it is the correctness of the rule.

     The admin's approve does: read the request → confirm pending → **create the accounting transfer**
     → mark it approved. That middle step moves real money and takes a database round trip, so there
     is a wide, reliably reproducible window in which this coach's read still says "pending" while an
     approval is already in flight. Filtering the UPDATE on `id` alone let an edit land on a row that
     had since been approved: the request would read $500 while the transfer actually posted $100,
     and the money record would disagree with the money. A coach watching their own list can see an
     approval starting and aim for that window deliberately.

     Zero rows updated now means "somebody got there first" — reported as the same 409 the pre-check
     gives, because from the coach's side it is the same situation. */
  const { data, error } = await supabaseAdmin
    .from('rep_team_payment_requests')
    .update({
      request_type:   requestType,
      amount,
      description:    description.trim(),
      payment_method: paymentMethod?.trim() || null,
      notes:          notes?.trim() || null,
      updated_at:     new Date().toISOString(),
    })
    .eq('id', id)
    .eq('org_id', team.orgId)
    .eq('team_id', team.id)
    .eq('status', 'pending')
    .select()
    .maybeSingle();

  if (error) return captureAndJson(error, { error: error.message }, 500);
  if (!data) {
    return NextResponse.json(
      { error: 'This request has already been reviewed, so it can no longer be changed.' },
      { status: 409 },
    );
  }

  return NextResponse.json({
    request: {
      id:            data.id,
      requestType:   data.request_type,
      amount:        Number(data.amount),
      description:   data.description,
      paymentMethod: data.payment_method ?? null,
      notes:         data.notes ?? null,
      status:        data.status,
      denialReason:  data.denial_reason ?? null,
      budgetLineId:  data.budget_line_id ?? null,
      createdBy:     data.created_by,
      createdAt:     data.created_at,
      updatedAt:     data.updated_at,
    },
  });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/payment-requests/[id]' });

// DELETE /api/coaches/[orgSlug]/teams/[teamId]/payment-requests/[id]
// Coaches can only cancel their own pending requests.
export const DELETE = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; id: string }> },) => {
  const { orgSlug, teamId, id } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { team, assignment } = resolved;
  const denied = denyUnless(canWriteMoney(assignment.capabilities), 'You do not have access to team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  const { data: existing, error: fetchErr } = await supabaseAdmin
    .from('rep_team_payment_requests')
    .select('id, team_id, status')
    .eq('id', id)
    .eq('org_id', team.orgId)
    .single();

  if (fetchErr || !existing) {
    return NextResponse.json({ error: 'Request not found' }, { status: 404 });
  }
  if (existing.team_id !== team.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (existing.status !== 'pending') {
    return NextResponse.json({ error: 'Only pending requests can be cancelled' }, { status: 409 });
  }

  /* ⚠⚠ SAME RE-ASSERTION AS THE PATCH ABOVE, AND HERE THE RACE IS WORSE. Pre-existing (this
     handler predates the 2026-08-16 review that found it), but the identical window: the admin's
     approve creates the accounting transfer BEFORE it marks the request approved, so a withdraw
     aimed at that gap deleted the request while the transfer stood — money moved between the team's
     and the org's books with no record left explaining why. A withdraw that finds nothing to delete
     now says so instead of reporting success. */
  const { data: removed, error } = await supabaseAdmin
    .from('rep_team_payment_requests')
    .delete()
    .eq('id', id)
    .eq('org_id', team.orgId)
    .eq('team_id', team.id)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle();

  if (error) return captureAndJson(error, { error: error.message }, 500);
  if (!removed) {
    return NextResponse.json({ error: 'Only pending requests can be cancelled' }, { status: 409 });
  }

  return NextResponse.json({ ok: true });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/payment-requests/[id]' });
