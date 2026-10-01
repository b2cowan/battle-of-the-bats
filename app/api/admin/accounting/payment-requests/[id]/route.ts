import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { resolveClubMoney, moveRefused } from '@/lib/club-money-route';
import { teamIdsInScope } from '@/lib/club-team-route';
import { clubRequests } from '@/lib/club-money-reads';
import { clubApproveRequest, clubDeclineRequest, clubReverseRequest } from '@/lib/club-money-moves';
import { canMoveClubMoney } from '@/lib/member-access';
import { tournamentToday } from '@/lib/timezone';

type Params = { params: Promise<{ id: string }> };

/** GET — one request, as the list reads it, plus whether this member may decide it. */
export const GET = withObservability(async (req: Request, { params }: Params) => {
  const r = await resolveClubMoney(req, { scope: 'loop', write: false });
  if ('error' in r) return r.error;
  const { ctx } = r;
  const { id } = await params;
  const rows = await clubRequests(ctx.org.id, await teamIdsInScope(ctx), { requestId: id }, tournamentToday());
  if (rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ request: rows[0], canMove: canMoveClubMoney(ctx, ctx.org) });
}, { route: '/api/admin/accounting/payment-requests/[id]' });

/**
 * PATCH — decide a request (Ask 1, Ask 3):
 *   { action: 'approve', paidOn?, method?, reference? } — the transfer and the decision in ONE step,
 *                                                         refused unless still waiting.
 *   { action: 'decline', reason }                       — no ledger line; the coach reads the reason.
 *   { action: 'reverse', reason }                       — an approval taken back: both lines voided.
 * A request that changed under the caller is a 409 `money_state_changed` with its state now.
 */
export const PATCH = withObservability(async (req: Request, { params }: Params) => {
  const r = await resolveClubMoney(req, { scope: 'loop', write: true });
  if ('error' in r) return r.error;
  const { ctx } = r;
  const { id } = await params;
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;

  const moved = body.action === 'approve'
    ? await clubApproveRequest(ctx, { requestId: id, on: body.paidOn, method: body.method, reference: body.reference })
    : body.action === 'decline'
      ? await clubDeclineRequest(ctx, { requestId: id, reason: body.reason })
      : body.action === 'reverse'
        ? await clubReverseRequest(ctx, { requestId: id, reason: body.reason })
        : null;
  if (!moved) return NextResponse.json({ error: 'action must be approve, decline or reverse', code: 'bad_action' }, { status: 400 });
  if (!moved.ok) return moveRefused(moved);
  return NextResponse.json({ request: moved.request });
}, { route: '/api/admin/accounting/payment-requests/[id]' });
