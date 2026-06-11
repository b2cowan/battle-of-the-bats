import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getCoachingAssignmentsForUser,
  getRepTeam,
  getActiveRepProgramYear,
  getRepPlayerDuesInstallments,
  markRepPlayerDuesInstallmentPaid,
  getOrCreateRepTeamLedger,
  createEntry,
} from '@/lib/db';
import { withObservability } from '@/lib/observability';

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

export const PATCH = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; scheduleId: string; installId: string }> },) => {
  const { orgSlug, teamId, scheduleId, installId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, team } = resolved;

  // Verify the installment belongs to this schedule
  const installments = await getRepPlayerDuesInstallments(scheduleId);
  const installment = installments.find(i => i.id === installId);
  if (!installment) {
    return NextResponse.json({ error: 'Installment not found' }, { status: 404 });
  }
  if (installment.paidAt) {
    return NextResponse.json({ error: 'Installment already marked paid' }, { status: 409 });
  }

  // Create income entry in team ledger
  const ledger = await getOrCreateRepTeamLedger(team.orgId, team.id, team.name);
  const entry = await createEntry(
    ledger.id,
    {
      entryDate: new Date().toISOString().slice(0, 10),
      description: `Player dues installment #${installment.installmentNumber}`,
      amount: installment.amount,
      entryType: 'income',
      status: 'posted',
      category: 'Player Dues',
    },
    ctx!.user.id,
  );

  const updated = await markRepPlayerDuesInstallmentPaid(installId, entry.id);
  return NextResponse.json({ installment: updated });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/dues/[scheduleId]/installments/[installId]' });
