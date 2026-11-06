import { withObservability } from '@/lib/observability';
import { resolveClubMoney } from '@/lib/club-money-route';
import { badBankIds, bankAnswer, saveCheck } from '@/lib/bank-club-steps';

type Params = { params: Promise<{ accountId: string }> };

/**
 * POST { date, bankCents, cashCents?, waiting?: ['entry:{id}'…] } — save a check (ruling 3: it saves whether it matches
 * or reads "Off by $X"; no $0.00 gate). The server figures Your books on D and Stripe on its way itself and reads each Not
 * in the bank yet line's figures from the books (rule 6). A live check of the same date is replaced ("Check this statement
 * again"; the old one's who and when are kept). Refused after the club's today (`ends_in_future`), on or before the
 * starting statement (`before_start`), with no start (`no_start`). Answers with the account's view (201).
 */
export const POST = withObservability(async (req: Request, { params }: Params) => {
  const r = await resolveClubMoney(req, { scope: 'books', write: true });
  if ('error' in r) return r.error;
  const { accountId } = await params;
  const bad = badBankIds({ accountId });
  if (bad) return bad;
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  return bankAnswer(r.ctx, accountId, await saveCheck(r.ctx, accountId, 'check', body), 201);
}, { route: '/api/admin/accounting/bank/accounts/[accountId]/checks' });
