import { withObservability } from '@/lib/observability';
import { resolveClubMoney } from '@/lib/club-money-route';
import { badBankIds, bankAnswer, saveCheck } from '@/lib/bank-club-steps';

type Params = { params: Promise<{ accountId: string }> };

/**
 * PUT { date, bankCents, waiting?: ['entry:{id}'…] } — the account's starting statement (ask 7): a statement the treasurer
 * already has, its date and ending balance; no outstanding picker. `waiting` is Q2's "Waiting at the start" (a line
 * written before the start and cashed after it; its figures are read here from the books). Re-saving on the start's own
 * date replaces it, even with later checks standing (a Q2 item moves every later check's "Books now say"); another date
 * is `start_exists`. Not after today (`ends_in_future`).
 */
export const PUT = withObservability(async (req: Request, { params }: Params) => {
  const r = await resolveClubMoney(req, { scope: 'books', write: true });
  if ('error' in r) return r.error;
  const { accountId } = await params;
  const bad = badBankIds({ accountId });
  if (bad) return bad;
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  return bankAnswer(r.ctx, accountId, await saveCheck(r.ctx, accountId, 'start', body));
}, { route: '/api/admin/accounting/bank/accounts/[accountId]/setup' });
