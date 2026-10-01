import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { resolveClubMoney, moveRefused } from '@/lib/club-money-route';
import { clubApproveRequest, clubDeclineRequest } from '@/lib/club-money-moves';

/**
 * The OLD payment requests page's Approve / Deny (Rep Teams › Payment requests).
 * ⚠ ON SESSION 2'S RETIRE LIST: Accounting › Payment requests decides through
 * `/api/admin/accounting/payment-requests/[id]` (approve · decline · reverse).
 *
 * Until it goes, both run through the SAME moves (Club Tier Stage 3a, C07): an approval is the
 * transfer and the decision in one database step, guarded on the request still waiting (a double
 * approval used to post two transfers), dated by the club's day (it was UTC), with its ledger link
 * kept so it can be reversed. Who: whoever holds the club's accounting (Ask 1).
 *
 * Body: { action: 'approve' | 'deny', denialReason?: string }
 */
export const PATCH = withObservability(async (req: Request,
  { params }: { params: Promise<{ id: string }> },) => {
  const r = await resolveClubMoney(req, { scope: 'loop', write: true });
  if ('error' in r) return r.error;
  const { id } = await params;
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;

  if (body.action === 'deny') {
    const moved = await clubDeclineRequest(r.ctx, { requestId: id, reason: body.denialReason });
    if (!moved.ok) return moveRefused(moved);
    return NextResponse.json({ ok: true, status: 'denied' });
  }
  if (body.action === 'approve') {
    const moved = await clubApproveRequest(r.ctx, { requestId: id, on: null, method: null, reference: null });
    if (!moved.ok) return moveRefused(moved);
    return NextResponse.json({ ok: true, status: 'approved' });
  }
  return NextResponse.json({ error: 'action must be approve or deny' }, { status: 400 });
}, { route: '/api/admin/rep-teams/payment-requests/[id]' });
