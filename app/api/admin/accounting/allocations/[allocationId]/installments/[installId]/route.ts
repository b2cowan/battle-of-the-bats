import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { resolveClubMoney, moveRefused } from '@/lib/club-money-route';
import { clubReceiveInstallment, clubUndoInstallment } from '@/lib/club-money-moves';

type Params = { params: Promise<{ allocationId: string; installId: string }> };

/**
 * PATCH /api/admin/accounting/allocations/[allocationId]/installments/[installId]?orgSlug=
 *
 *   { action: 'receive', receivedOn?, method?, reference? }  — Record received (unpaid or overdue).
 *   { action: 'confirm', receivedOn?, method?, reference? }  — Confirm a coach's "sent" (the same
 *                                                              write, pre-filled from their note).
 *   { action: 'undo', reason }                               — Undo a recorded payment.
 *
 * Each is ONE database step (mig 315): the stamp and both ledger lines together, refused if the
 * state is no longer what the caller saw (409 `money_state_changed`, with `state` and `fixedBy`).
 * Who: whoever holds the club's accounting (`canMoveClubMoney`, Ask 1), inside their team groups.
 */
export const PATCH = withObservability(async (req: Request, { params }: Params) => {
  const r = await resolveClubMoney(req, { scope: 'loop', write: true });
  if ('error' in r) return r.error;
  const { ctx } = r;
  const { allocationId, installId } = await params;
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;

  const moved = body.action === 'receive' || body.action === 'confirm'
    ? await clubReceiveInstallment(ctx, {
        installmentId: installId, allocationId, expect: body.action === 'confirm' ? 'sent' : 'unpaid',
        on: body.receivedOn, method: body.method, reference: body.reference,
      })
    : body.action === 'undo'
      ? await clubUndoInstallment(ctx, { installmentId: installId, allocationId, reason: body.reason })
      : null;
  if (!moved) return NextResponse.json({ error: 'action must be receive, confirm or undo', code: 'bad_action' }, { status: 400 });
  if (!moved.ok) return moveRefused(moved);
  return NextResponse.json({ installment: moved.installment });
}, { route: '/api/admin/accounting/allocations/[allocationId]/installments/[installId]' });
