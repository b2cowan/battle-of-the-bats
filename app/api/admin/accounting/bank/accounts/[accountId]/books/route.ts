import { withObservability } from '@/lib/observability';
import { resolveClubMoney } from '@/lib/club-money-route';
import { badBankIds, bankAnswer, moveBook } from '@/lib/bank-club-steps';

type Params = { params: Promise<{ accountId: string }> };

/**
 * POST { ledgerId } — this club book's money is in this account now (C10, Ask 13). Its lines not yet ticked move with it
 * (and what was decided about them: an item picked as outstanding at the start, "didn't go through the bank"); lines
 * already ticked stay on the old account's checks. A team's book, another club's or a team account: coded refusals.
 */
export const POST = withObservability(async (req: Request, { params }: Params) => {
  const r = await resolveClubMoney(req, { scope: 'books', write: true });
  if ('error' in r) return r.error;
  const { accountId } = await params;
  const bad = badBankIds({ accountId });
  if (bad) return bad;
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  return bankAnswer(r.ctx, accountId, null, await moveBook(r.ctx, accountId, body));
}, { route: '/api/admin/accounting/bank/accounts/[accountId]/books' });
