import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { resolveClubMoney, moveRefused } from '@/lib/club-money-route';
import { mergeClubPayee } from '@/lib/club-payees';

type Params = { params: Promise<{ payeeId: string }> };

/**
 * POST { intoPayeeId } — merge this payee into another (C01): every line that names it moves to the
 * one kept, and it is removed, in one step. Reports how many lines moved (`moved`); the Payees list's
 * `uses` is the same count, so the question can name it before it asks.
 */
export const POST = withObservability(async (req: Request, { params }: Params) => {
  const r = await resolveClubMoney(req, { scope: 'books', write: true });
  if ('error' in r) return r.error;
  const { payeeId } = await params;
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const out = await mergeClubPayee(r.ctx.org.id, payeeId, body.intoPayeeId);
  if (!out.ok) return moveRefused(out);
  return NextResponse.json({ moved: out.moved, into: out.into });
}, { route: '/api/admin/accounting/payees/[payeeId]/merge' });
