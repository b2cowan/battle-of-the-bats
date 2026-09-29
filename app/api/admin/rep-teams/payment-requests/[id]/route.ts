import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden, repGroupScopeGuard } from '@/lib/api-auth';
import { canOpenRepMoney } from '@/lib/member-access';
import {
  getRepTeam,
  getOrCreateRepTeamLedger,
  getOrCreateOrgLedger,
} from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability, captureAndJson } from '@/lib/observability';

// The club ↔ team money loop: Rep Teams OR Accounting, on an org that runs rep teams (D8 + Ask 1 —
// a treasurer reaches it from Accounting). The write handlers below keep their own role checks.
function gate(ctx: Awaited<ReturnType<typeof getAuthContextWithRole>>) {
  if (!ctx) return unauthorized();
  if (!canOpenRepMoney(ctx, ctx.org)) return forbidden();
  return null;
}

// PATCH /api/admin/rep-teams/payment-requests/[id]
// Body: { action: 'approve' | 'deny', denialReason?: string }
export const PATCH = withObservability(async (req: Request,
  { params }: { params: Promise<{ id: string }> },) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = gate(ctx);
  if (err) return err;

  if (ctx!.role !== 'owner' && ctx!.role !== 'treasurer' && ctx!.role !== 'admin') {
    return forbidden();
  }

  const { id } = await params;
  const body = await req.json();
  const { action, denialReason } = body;

  if (!['approve', 'deny'].includes(action)) {
    return NextResponse.json({ error: 'action must be approve or deny' }, { status: 400 });
  }
  if (action === 'deny') {
    if (!denialReason?.trim() || denialReason.trim().length > 500) {
      return NextResponse.json({ error: 'denialReason is required and must be 500 characters or fewer' }, { status: 400 });
    }
  }

  const { data: request, error: fetchErr } = await supabaseAdmin
    .from('rep_team_payment_requests')
    .select('*')
    .eq('id', id)
    .eq('org_id', ctx!.org.id)
    .single();

  if (fetchErr || !request) {
    return NextResponse.json({ error: 'Request not found' }, { status: 404 });
  }
  if (request.status !== 'pending') {
    return NextResponse.json({ error: 'Only pending requests can be reviewed' }, { status: 409 });
  }

  // ⚠ The member's team-group limit (Club Tier Stage 2, B11). Unreachable TODAY — only an owner,
  // admin or treasurer may act here, and those roles never carry a group limit — so this is the
  // guard for the day a limited role is given the power, not a fix for a live hole.
  if (ctx!.repGroupIds) {
    const scopedTeam = await getRepTeam(request.team_id);
    const scoped = repGroupScopeGuard(ctx!, scopedTeam?.groupId ?? null);
    if (scoped) return scoped;
  }

  const now = new Date().toISOString();

  if (action === 'deny') {
    const { error } = await supabaseAdmin
      .from('rep_team_payment_requests')
      .update({
        status:        'denied',
        denial_reason: denialReason.trim(),
        reviewed_by:   ctx!.user.id,
        reviewed_at:   now,
        updated_at:    now,
      })
      .eq('id', id);

    if (error) return captureAndJson(error, { error: error.message }, 500);
    return NextResponse.json({ ok: true, status: 'denied' });
  }

  // --- Approve ---
  const team = await getRepTeam(request.team_id);
  if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 });

  const [teamLedger, orgLedger] = await Promise.all([
    getOrCreateRepTeamLedger(ctx!.org.id, team.id, team.name),
    getOrCreateOrgLedger(ctx!.org.id, ctx!.org.name),
  ]);

  if (!orgLedger) {
    return captureAndJson(
      new Error('Org ledger not found for rep-team payment approval'),
      { error: 'Org ledger not found' },
      500,
    );
  }

  // payment_to_org → team pays org (team_ledger → org_ledger)
  // charge_to_org  → org pays team (org_ledger → team_ledger)
  const fromLedgerId = request.request_type === 'payment_to_org' ? teamLedger.id : orgLedger.id;
  const toLedgerId   = request.request_type === 'payment_to_org' ? orgLedger.id  : teamLedger.id;
  const category     = request.request_type === 'payment_to_org' ? 'team_payment_to_org' : 'team_charge_to_org';

  const { error: transferError } = await supabaseAdmin.rpc('create_accounting_transfer', {
    p_from_ledger_id: fromLedgerId,
    p_to_ledger_id:   toLedgerId,
    p_amount:         Number(request.amount),
    p_entry_date:     now.slice(0, 10),
    p_description:    request.description,
    p_category:       category,
    p_created_by:     ctx!.user.id,
  });

  if (transferError) {
    return captureAndJson(transferError, { error: 'Failed to create accounting transfer' }, 500);
  }

  const { error: updateError } = await supabaseAdmin
    .from('rep_team_payment_requests')
    .update({
      status:      'approved',
      reviewed_by: ctx!.user.id,
      reviewed_at: now,
      updated_at:  now,
    })
    .eq('id', id);

  if (updateError) return captureAndJson(updateError, { error: updateError.message }, 500);

  return NextResponse.json({ ok: true, status: 'approved' });
}, { route: '/api/admin/rep-teams/payment-requests/[id]' });
