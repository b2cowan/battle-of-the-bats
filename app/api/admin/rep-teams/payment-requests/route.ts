import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability, captureAndJson } from '@/lib/observability';

function gate(ctx: Awaited<ReturnType<typeof getAuthContextWithRole>>) {
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_rep_teams')) return forbidden();
  if (!hasModuleEntitlement(ctx.org, 'module_rep_teams')) return forbidden();
  return null;
}

// GET /api/admin/rep-teams/payment-requests?status=pending&teamId=...
export const GET = withObservability(async (req: Request) => {
  const url = new URL(req.url);
  const orgSlug = url.searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = gate(ctx);
  if (err) return err;

  const status = url.searchParams.get('status') ?? 'pending';
  const teamId = url.searchParams.get('teamId') ?? null;

  // When the caller is scoped to specific groups, restrict to those teams
  let scopedTeamIds: string[] | null = null;
  if (ctx!.repGroupIds) {
    const { data: scopedTeams } = await supabaseAdmin
      .from('rep_teams')
      .select('id')
      .eq('org_id', ctx!.org.id)
      .in('group_id', ctx!.repGroupIds);
    scopedTeamIds = (scopedTeams ?? []).map((t: any) => t.id as string);
  }

  let query = supabaseAdmin
    .from('rep_team_payment_requests')
    .select(`
      *,
      rep_teams ( name )
    `)
    .eq('org_id', ctx!.org.id)
    .order('created_at', { ascending: true });

  if (status !== 'all') query = query.eq('status', status);
  if (teamId) query = query.eq('team_id', teamId);
  if (scopedTeamIds) query = query.in('team_id', scopedTeamIds);

  const { data, error } = await query;
  if (error) return captureAndJson(error, { error: error.message }, 500);

  const requests = (data ?? []).map(r => ({
    id:                r.id,
    teamId:            r.team_id,
    teamName:          (r.rep_teams as { name: string } | null)?.name ?? null,
    requestType:       r.request_type,
    amount:            Number(r.amount),
    description:       r.description,
    paymentMethod:     r.payment_method ?? null,
    notes:             r.notes ?? null,
    status:            r.status,
    denialReason:      r.denial_reason ?? null,
    budgetLineId:      r.budget_line_id ?? null,
    accountingEntryId: r.accounting_entry_id ?? null,
    createdBy:         r.created_by,
    reviewedBy:        r.reviewed_by ?? null,
    reviewedAt:        r.reviewed_at ?? null,
    createdAt:         r.created_at,
    updatedAt:         r.updated_at,
  }));

  return NextResponse.json({ requests });
}, { route: '/api/admin/rep-teams/payment-requests' });
