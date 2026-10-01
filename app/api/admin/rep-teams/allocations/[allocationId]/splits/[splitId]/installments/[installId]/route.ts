import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { resolveClubMoney, moveRefused } from '@/lib/club-money-route';
import { clubReceiveInstallment } from '@/lib/club-money-moves';
import { getRepAllocationInstallment } from '@/lib/db';

type Params = { params: Promise<{ allocationId: string; splitId: string; installId: string }> };

/**
 * The OLD allocation page's "Mark Paid" (Rep Teams › Cost allocation). ⚠ ON SESSION 2'S RETIRE LIST:
 * the Accounting › Allocations page records through
 * `/api/admin/accounting/allocations/[allocationId]/installments/[installId]`.
 *
 * Until it goes, it runs through the SAME one-step move (Club Tier Stage 3a, C07): the stamp and both
 * ledger lines in one database step, refused if somebody got there first — the old order (lines
 * first, stamp second) could leave an orphaned pair. The old button knows nothing of a coach's
 * "sent", so it records against whatever state the installment is in now: unpaid → recorded today,
 * sent → confirmed. Who: whoever holds the club's accounting (Ask 1; it was owner/treasurer).
 */
export const PATCH = withObservability(async (req: Request, { params }: Params) => {
  const r = await resolveClubMoney(req, { scope: 'loop', write: true });
  if ('error' in r) return r.error;
  const { allocationId, splitId, installId } = await params;

  const current = await getRepAllocationInstallment(installId);
  const moved = await clubReceiveInstallment(r.ctx, {
    installmentId: installId, allocationId, splitId,
    expect: current?.sentAt ? 'sent' : 'unpaid', on: null, method: null, reference: null,
  });
  if (!moved.ok) return moveRefused(moved);
  return NextResponse.json({ installment: moved.installment });
}, { route: '/api/admin/rep-teams/allocations/[allocationId]/splits/[splitId]/installments/[installId]' });
