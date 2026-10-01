import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { resolveClubMoney, moveRefused } from '@/lib/club-money-route';
import { clubVoidTransfer } from '@/lib/club-money-moves';

type Params = { params: Promise<{ entryId: string }> };

/**
 * POST /api/admin/accounting/transfers/[entryId]/void?orgSlug= { reason } — void a transfer between
 * the club's OWN books: both halves, in one step, with the reason printed under both (C13, Ask 3).
 * `entryId` may be either half. Refused (400, coded) for a transfer touching a team's book
 * (`team_book`) or a line written by an allocation, a request or a fee (`from_a_source`); 409
 * `already_void`.
 */
export const POST = withObservability(async (req: Request, { params }: Params) => {
  const r = await resolveClubMoney(req, { scope: 'books', write: true });
  if ('error' in r) return r.error;
  const { ctx } = r;
  const { entryId } = await params;
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const moved = await clubVoidTransfer(ctx, { entryId, reason: body.reason });
  if (!moved.ok) return moveRefused(moved);
  return NextResponse.json({ voided: moved.voided });
}, { route: '/api/admin/accounting/transfers/[entryId]/void' });
