import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getCoachingAssignmentsForUser,
  getRepTeam,
  getActiveRepProgramYear,
  getRepAllocationSplit,
  getRepAllocationInstallment,
  markRepAllocationInstallmentPaid,
  getOrCreateRepTeamLedger,
  getOrCreateOrgLedger,
} from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';

async function resolveCoachContext(orgSlug: string, teamId: string) {
  const ctx = await getAuthContext();
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

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; splitId: string; installId: string }> },
) {
  const { orgSlug, teamId, splitId, installId } = await params;

  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error;
  const { ctx, team } = resolved;

  // Verify the split belongs to this team + org
  const split = await getRepAllocationSplit(splitId);
  if (!split || split.teamId !== teamId || split.orgId !== ctx.org.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const installment = await getRepAllocationInstallment(installId);
  if (!installment || installment.splitId !== splitId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (installment.paidAt) {
    return NextResponse.json({ error: 'Installment already marked paid' }, { status: 409 });
  }

  const [teamLedger, orgLedger] = await Promise.all([
    getOrCreateRepTeamLedger(ctx.org.id, team.id, team.name),
    getOrCreateOrgLedger(ctx.org.id, ctx.org.name),
  ]);

  if (!orgLedger) {
    return NextResponse.json({ error: 'Org ledger not found' }, { status: 500 });
  }

  const { error: transferError } = await supabaseAdmin.rpc('create_accounting_transfer', {
    p_from_ledger_id: teamLedger.id,
    p_to_ledger_id: orgLedger.id,
    p_amount: installment.amount,
    p_description: `Rep allocation payment — installment #${installment.installmentNumber}`,
    p_entry_date: new Date().toISOString().slice(0, 10),
    p_category: 'rep_allocation',
    p_created_by: ctx.user.id,
  });

  if (transferError) {
    return NextResponse.json({ error: 'Failed to create accounting transfer' }, { status: 500 });
  }

  const updated = await markRepAllocationInstallmentPaid(installId, ctx.user.id, null);
  return NextResponse.json({ installment: updated });
}
