import { withObservability } from '@/lib/observability';
import { resolveClubMoney } from '@/lib/club-money-route';
import { badBankIds, bankAnswer, bankBody, correctStart, saveCheck } from '@/lib/bank-club-steps';

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
  const body = await bankBody(req);
  return bankAnswer(r.ctx, accountId, await saveCheck(r.ctx, accountId, 'start', body));
}, { route: '/api/admin/accounting/bank/accounts/[accountId]/setup' });

/**
 * PATCH { add: 'entry:{id}' } | { remove: 'entry:{id}' } — correct the starting statement in place (Q2-A, BC3b): "Waiting at
 * the start" puts a line written on or before the start and cleared after it on the start (its figures read here from the
 * books, rule 6), or takes one off. The start's books move by that line; saved later checks keep their figures and read
 * "Books now say" (ruling "Q2 + ask 6"). Answers the account read again.
 */
export const PATCH = withObservability(async (req: Request, { params }: Params) => {
  const r = await resolveClubMoney(req, { scope: 'books', write: true });
  if ('error' in r) return r.error;
  const { accountId } = await params;
  const bad = badBankIds({ accountId });
  if (bad) return bad;
  const body = await bankBody(req);
  return bankAnswer(r.ctx, accountId, await correctStart(r.ctx, accountId, body));
}, { route: '/api/admin/accounting/bank/accounts/[accountId]/setup' });
