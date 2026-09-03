import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getCoachingAssignmentsForUser,
  getRepTeam,
  getActiveRepProgramYear,
  getRepAllocationSplit,
  getRepAllocationInstallment,
  markRepAllocationInstallmentPaid,
  unmarkRepAllocationInstallmentPaid,
  getOrCreateRepTeamLedger,
  getOrCreateOrgLedger,
} from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { canWriteMoney, denyUnless } from '@/lib/coach-capabilities';
import { tournamentToday } from '@/lib/timezone';

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
    return { error: NextResponse.json({ error: 'No active program year for this team' }, { status: 404 }) };
  }

  return { ctx, team, assignment, programYear };
}

export const PATCH = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; splitId: string; installId: string }> },) => {
  const { orgSlug, teamId, splitId, installId } = await params;

  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, team, assignment } = resolved;
  const denied = denyUnless(canWriteMoney(assignment.capabilities), 'You do not have access to team finances. Ask the head coach to grant it.');
  if (denied) return denied;

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

  /* ⚠ THE TRANSFER'S OWN ENTRY ID IS KEPT (mig 275). The RPC returned void until then, so every
     caller threw both halves away and `accounting_entry_id` sat unwritten — which is precisely why
     a club payment could not be taken back. Store it on the installment below; the club-side half
     hangs off it by `linked_entry_id`. */
  const { data: transferEntryId, error: transferError } = await supabaseAdmin.rpc('create_accounting_transfer', {
    p_from_ledger_id: teamLedger.id,
    p_to_ledger_id: orgLedger.id,
    p_amount: installment.amount,
    p_description: `Rep allocation payment — installment #${installment.installmentNumber}`,
    p_entry_date: tournamentToday(),
    p_category: 'rep_allocation',
    p_created_by: ctx.user.id,
  });

  if (transferError) {
    return NextResponse.json({ error: 'Failed to create accounting transfer' }, { status: 500 });
  }

  /* ⚠⚠ ZERO ROWS MEANS SOMEBODY GOT THERE FIRST — see the writer's own note. The pre-check above
     ran BEFORE the transfer, and the transfer is a round trip, so a second request can pass that
     check while this one is mid-flight. Reporting success here is what let one instalment move the
     money twice. */
  const updated = await markRepAllocationInstallmentPaid(installId, ctx.user.id, (transferEntryId as string | null) ?? null);
  if (!updated) {
    return NextResponse.json({ error: 'That installment has already been marked paid.' }, { status: 409 });
  }
  return NextResponse.json({ installment: updated });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/allocations/[splitId]/installments/[installId]' });

/**
 * TAKE A CLUB PAYMENT BACK (owner, §134 walk 2026-09-03; mig 275).
 *
 * ⚖ WHY THIS EXISTS AT ALL. "Record as paid" is one tap with no question asked, and until now it
 * was the ONLY money a coach records that could not be undone — a dues payment, a payout and a
 * credit all have a remove. The least-guarded write in the portal was also the only irreversible
 * one, and it moves real money between two ledgers. Tapping the wrong row was unrecoverable
 * without the club office.
 *
 * ⚖ NO CONFIRM, AND THAT IS THE DESIGN. The act it reverses costs one tap; guarding the reversal
 * harder than the act is backwards, and it is the coach's second thought that most needs to be
 * cheap. It is also itself reversible — recording it paid again is one tap — so this is not the
 * one-way door a delete is.
 *
 * ⚠⚠ IT REFUSES WHEN IT CANNOT SEE THE MONEY IT WOULD BE REVERSING. A payment recorded before
 * mig 275, whose ledger entries the backfill could not identify beyond doubt, has no link — and
 * clearing the stamp anyway would tell the coach the bill is unpaid while the transfer still
 * stands on both ledgers. That is a worse state than the one being fixed, so the honest answer is
 * a refusal that names the way out, not a silent half-undo.
 */
export const DELETE = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; splitId: string; installId: string }> },) => {
  const { orgSlug, teamId, splitId, installId } = await params;

  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, assignment } = resolved;
  const denied = denyUnless(canWriteMoney(assignment.capabilities), 'You do not have access to team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  /* ⚠ THE SAME CHECK-THEN-ACT DISCIPLINE AS THE MARK — org and team re-asserted on the way in, so
     an id from another club's URL cannot reach this team's books. */
  const split = await getRepAllocationSplit(splitId);
  if (!split || split.teamId !== teamId || split.orgId !== ctx.org.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const installment = await getRepAllocationInstallment(installId);
  if (!installment || installment.splitId !== splitId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (!installment.paidAt) {
    return NextResponse.json({ error: 'That installment is not marked paid.' }, { status: 409 });
  }
  if (!installment.accountingEntryId) {
    return NextResponse.json({
      error: 'This payment was recorded before payments could be taken back, so the club’s books '
        + 'and yours can’t be corrected together from here. Ask your club office to reverse it.',
    }, { status: 409 });
  }

  const updated = await unmarkRepAllocationInstallmentPaid(installment);
  /* Zero rows means somebody got there first — the mark's own rule, and reporting success here
     would show one coach an unpaid row while the other reads it as paid. */
  if (!updated) {
    return NextResponse.json({ error: 'That payment has already been taken back.' }, { status: 409 });
  }
  return NextResponse.json({ installment: updated });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/allocations/[splitId]/installments/[installId]' });
