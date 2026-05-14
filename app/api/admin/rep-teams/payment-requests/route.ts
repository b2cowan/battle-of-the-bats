import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { supabaseAdmin } from '@/lib/supabase-admin';

function gate(ctx: Awaited<ReturnType<typeof getAuthContextWithRole>>) {
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_rep_teams')) return forbidden();
  if (!hasModuleEntitlement(ctx.org, 'module_rep_teams')) return forbidden();
  return null;
}

// GET /api/admin/rep-teams/payment-requests?status=pending&teamId=...
export async function GET(req: Request) {
  const ctx = await getAuthContextWithRole();
  const err = gate(ctx);
  if (err) return err;

  const url = new URL(req.url);
  const status = url.searchParams.get('status') ?? 'pending';
  const teamId = url.searchParams.get('teamId') ?? null;

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

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

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
}
