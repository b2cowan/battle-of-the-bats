import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import {
  getRepAllocationInstallment,
  getRepAllocationSplit,
  markRepAllocationInstallmentPaid,
  getOrCreateRepTeamLedger,
  getOrCreateOrgLedger,
  getRepTeam,
} from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';

function gate(ctx: Awaited<ReturnType<typeof getAuthContextWithRole>>) {
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_rep_teams')) return forbidden();
  if (!hasModuleEntitlement(ctx.org, 'module_rep_teams')) return forbidden();
  return null;
}

export const PATCH = withObservability(async (_req: Request,
  { params }: { params: Promise<{ allocationId: string; splitId: string; installId: string }> },) => {
  const ctx = await getAuthContextWithRole();
  const err = gate(ctx);
  if (err) return err;

  const { allocationId, splitId, installId } = await params;

  const split = await getRepAllocationSplit(splitId);
  if (!split || split.allocationId !== allocationId || split.orgId !== ctx!.org.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (ctx!.role !== 'owner' && ctx!.role !== 'treasurer') return forbidden();

  const installment = await getRepAllocationInstallment(installId);
  if (!installment || installment.splitId !== splitId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (installment.paidAt) {
    return NextResponse.json({ error: 'Installment is already marked as paid' }, { status: 409 });
  }

  // Ensure ledgers exist for both sides of the transfer
  const team = await getRepTeam(split.teamId);
  if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 });

  const [teamLedger, orgLedger] = await Promise.all([
    getOrCreateRepTeamLedger(ctx!.org.id, team.id, team.name),
    getOrCreateOrgLedger(ctx!.org.id, ctx!.org.name),
  ]);

  if (!orgLedger) {
    return NextResponse.json({ error: 'Org ledger not found' }, { status: 500 });
  }

  // Create paired transfer entries: team pays → org receives
  const { error: transferError } = await supabaseAdmin.rpc('create_accounting_transfer', {
    p_from_ledger_id: teamLedger.id,
    p_to_ledger_id: orgLedger.id,
    p_amount: installment.amount,
    p_description: `Rep allocation payment — installment #${installment.installmentNumber}`,
    p_entry_date: new Date().toISOString().slice(0, 10),
    p_category: 'rep_allocation',
    p_created_by: ctx!.user.id,
  });

  if (transferError) {
    return NextResponse.json({ error: 'Failed to create accounting transfer' }, { status: 500 });
  }

  const updated = await markRepAllocationInstallmentPaid(installId, ctx!.user.id, null);

  return NextResponse.json({ installment: updated });
}, { route: '/api/admin/rep-teams/allocations/[allocationId]/splits/[splitId]/installments/[installId]' });
