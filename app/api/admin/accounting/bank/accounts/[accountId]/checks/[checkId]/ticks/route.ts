import { withObservability } from '@/lib/observability';
import { resolveClubMoney } from '@/lib/club-money-route';
import { badBankIds, bankAnswer, tickRow } from '@/lib/bank-club-steps';

type Params = { params: Promise<{ accountId: string; checkId: string }> };

/**
 * POST { key, ticked } — tick (or untick, `ticked: false`) one row of an open statement. Intent only: the server reads
 * the account, checks the row is outstanding on this statement, and answers with the band it computed (rule 6). A
 * payout's tick writes its members' ticks with it, and unticking it removes them all (rule 3). Saved as it is made.
 */
export const POST = withObservability(async (req: Request, { params }: Params) => {
  const r = await resolveClubMoney(req, { scope: 'books', write: true });
  if ('error' in r) return r.error;
  const { accountId, checkId } = await params;
  const bad = badBankIds({ accountId, checkId });
  if (bad) return bad;
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  return bankAnswer(r.ctx, accountId, checkId, await tickRow(r.ctx, accountId, checkId, body));
}, { route: '/api/admin/accounting/bank/accounts/[accountId]/checks/[checkId]/ticks' });
