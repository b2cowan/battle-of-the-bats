import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { resolveClubMoney, moveRefused } from '@/lib/club-money-route';
import { deleteClubPayee, readPayeeName, renameClubPayee, setClubPayeeShared, shareRefusal } from '@/lib/club-payees';

type Params = { params: Promise<{ payeeId: string }> };

/**
 * PATCH { name?, sharedWithTeams? } — rename one of the club's payees (C01; 409 `payee_exists` when the name is
 * taken) and/or share it with the club's teams (Ledger Parity D7: only shared club payees reach a team's picker).
 * Sharing is the same gate as rename — whoever holds the club's Accounting; `shareRefusal` refuses an org that
 * runs no rep teams, or a standalone team's org (403 `not_allowed`). A refused request changes nothing.
 */
export const PATCH = withObservability(async (req: Request, { params }: Params) => {
  const r = await resolveClubMoney(req, { scope: 'books', write: true });
  if ('error' in r) return r.error;
  const { payeeId } = await params;
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const renaming = 'name' in body;
  const sharing = 'sharedWithTeams' in body;
  if (!renaming && !sharing) return NextResponse.json({ error: 'Nothing to change.', code: 'nothing_to_change' }, { status: 400 });

  // ⚠ Two writes, so everything that can be refused without the database is refused FIRST, and the rename (the
  // one step that can still be refused — the name taken) runs before the share. A request that fails changes
  // nothing: a share saved under a refused rename would start the D7a clock behind a 409.
  const name = renaming ? readPayeeName(body.name) : null;
  const early = (name && 'ok' in name ? name : null) ?? (sharing ? shareRefusal(r.ctx.org, body.sharedWithTeams) : null);
  if (early) return moveRefused(early);

  let payee: { id: string; name?: string; sharedWithTeams?: boolean } = { id: payeeId };
  if (renaming) {
    const out = await renameClubPayee(r.ctx.org.id, payeeId, body.name);
    if (!out.ok) return moveRefused(out);
    payee = { ...payee, ...out.payee };
  }
  if (sharing) {
    const out = await setClubPayeeShared(r.ctx.org, payeeId, body.sharedWithTeams);
    if (!out.ok) return moveRefused(out);
    payee = { ...payee, ...out.payee };
  }
  return NextResponse.json({ payee });
}, { route: '/api/admin/accounting/payees/[payeeId]' });

/** DELETE — only a payee nothing names (409 `payee_in_use`, with the club's `uses` when its own lines name it; merge it instead). */
export const DELETE = withObservability(async (req: Request, { params }: Params) => {
  const r = await resolveClubMoney(req, { scope: 'books', write: true });
  if ('error' in r) return r.error;
  const { payeeId } = await params;
  const out = await deleteClubPayee(r.ctx.org.id, payeeId);
  if (!out.ok) return moveRefused(out);
  return NextResponse.json({ deleted: true });
}, { route: '/api/admin/accounting/payees/[payeeId]' });
