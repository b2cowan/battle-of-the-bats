import { withObservability } from '@/lib/observability';
import { resolveClubMoney } from '@/lib/club-money-route';
import { badBankIds, bankAnswer, bankBody, moveBook } from '@/lib/bank-club-steps';

type Params = { params: Promise<{ accountId: string }> };

/**
 * POST { ledgerId } — this club book's money is in this account now (R0 tab 8). Saved checks keep the books they counted,
 * so a move changes nothing earlier (Q3); the next check of each account counts the book where it is now. A team's book,
 * another club's or a team account: coded refusals.
 */
export const POST = withObservability(async (req: Request, { params }: Params) => {
  const r = await resolveClubMoney(req, { scope: 'books', write: true });
  if ('error' in r) return r.error;
  const { accountId } = await params;
  const bad = badBankIds({ accountId });
  if (bad) return bad;
  const body = await bankBody(req);
  return bankAnswer(r.ctx, accountId, await moveBook(r.ctx, accountId, body));
}, { route: '/api/admin/accounting/bank/accounts/[accountId]/books' });
