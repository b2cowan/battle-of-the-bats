import { withObservability } from '@/lib/observability';
import { resolveClubMoney } from '@/lib/club-money-route';
import { badBankIds, bankAnswer } from '@/lib/bank-club-steps';
import { addBankLine } from '@/lib/bank-check-fee';

type Params = { params: Promise<{ accountId: string; checkId: string }> };

/**
 * POST { kind: 'bank_fee' | 'interest', amountCents, ledgerId?, date?, description? }
 *    | { kind: 'payment_processing', payoutKey, ledgerId?, date?, description? }
 * — "Add a bank fee or interest" (B5, Ask 1) and a payout's "Add it as payment processing" (Ask 7, P4): ONE real line in
 * one of the account's own books, ticked on this statement whatever its date (Ask 8). Dated the statement's end, or
 * today when that day is in a closed fiscal year; a closed day is refused in words (`year_closed`) with today's date.
 */
export const POST = withObservability(async (req: Request, { params }: Params) => {
  const r = await resolveClubMoney(req, { scope: 'books', write: true });
  if ('error' in r) return r.error;
  const { accountId, checkId } = await params;
  const bad = badBankIds({ accountId, checkId });
  if (bad) return bad;
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  return bankAnswer(r.ctx, accountId, checkId, await addBankLine(r.ctx, accountId, checkId, body), 201);
}, { route: '/api/admin/accounting/bank/accounts/[accountId]/checks/[checkId]/lines' });
