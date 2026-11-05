import { withObservability } from '@/lib/observability';
import { resolveClubMoney } from '@/lib/club-money-route';
import { badBankIds, bankAnswer, keepOut } from '@/lib/bank-club-steps';

type Params = { params: Promise<{ accountId: string; checkId: string }> };

/**
 * POST { key, keptOut } — "Didn't go through the bank" (B6, Ask 6) on a line outstanding on an open statement; it leaves
 * the tick list for good and counts in "Kept out of the bank". `keptOut: false` is "Put it back". A payout never.
 */
export const POST = withObservability(async (req: Request, { params }: Params) => {
  const r = await resolveClubMoney(req, { scope: 'books', write: true });
  if ('error' in r) return r.error;
  const { accountId, checkId } = await params;
  const bad = badBankIds({ accountId, checkId });
  if (bad) return bad;
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  return bankAnswer(r.ctx, accountId, checkId, await keepOut(r.ctx, accountId, checkId, body));
}, { route: '/api/admin/accounting/bank/accounts/[accountId]/checks/[checkId]/kept-out' });
