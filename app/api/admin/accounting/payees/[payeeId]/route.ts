import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { resolveClubMoney, moveRefused } from '@/lib/club-money-route';
import { deleteClubPayee, renameClubPayee } from '@/lib/club-payees';

type Params = { params: Promise<{ payeeId: string }> };

/** PATCH { name } — rename one of the club's payees (C01). 409 `payee_exists` when the name is taken. */
export const PATCH = withObservability(async (req: Request, { params }: Params) => {
  const r = await resolveClubMoney(req, { scope: 'books', write: true });
  if ('error' in r) return r.error;
  const { payeeId } = await params;
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const out = await renameClubPayee(r.ctx.org.id, payeeId, body.name);
  if (!out.ok) return moveRefused(out);
  return NextResponse.json({ payee: out.payee });
}, { route: '/api/admin/accounting/payees/[payeeId]' });

/** DELETE — only a payee no line names (409 `payee_in_use`, with `uses`; merge it instead). */
export const DELETE = withObservability(async (req: Request, { params }: Params) => {
  const r = await resolveClubMoney(req, { scope: 'books', write: true });
  if ('error' in r) return r.error;
  const { payeeId } = await params;
  const out = await deleteClubPayee(r.ctx.org.id, payeeId);
  if (!out.ok) return moveRefused(out);
  return NextResponse.json({ deleted: true });
}, { route: '/api/admin/accounting/payees/[payeeId]' });
