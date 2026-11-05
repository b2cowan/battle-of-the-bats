import { withObservability } from '@/lib/observability';
import { resolveClubMoney } from '@/lib/club-money-route';
import { badBankIds, bankAnswer, setUpAccount } from '@/lib/bank-club-steps';

type Params = { params: Promise<{ accountId: string }> };

/**
 * PUT { openingDate, openingBalanceCents, picked: ['entry:{id}'…], typed: [{ date, direction, amountCents, description }…] }
 * — the account's starting point (C1, B3, Ask 3): the day, the bank balance on it, and what was still outstanding then
 * (picked from the books, whose figures are read here, or typed). The WHOLE list each time. Refused once a statement
 * starts from it (`statements_exist`, rule 2): Undo the checks first.
 */
export const PUT = withObservability(async (req: Request, { params }: Params) => {
  const r = await resolveClubMoney(req, { scope: 'books', write: true });
  if ('error' in r) return r.error;
  const { accountId } = await params;
  const bad = badBankIds({ accountId });
  if (bad) return bad;
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  return bankAnswer(r.ctx, accountId, null, await setUpAccount(r.ctx, accountId, body));
}, { route: '/api/admin/accounting/bank/accounts/[accountId]/setup' });
