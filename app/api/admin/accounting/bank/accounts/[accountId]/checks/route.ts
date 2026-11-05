import { withObservability } from '@/lib/observability';
import { resolveClubMoney } from '@/lib/club-money-route';
import { badBankIds, bankAnswer, startCheck } from '@/lib/bank-club-steps';

type Params = { params: Promise<{ accountId: string }> };

/**
 * POST { statementEndDate, statementEndingBalanceCents } — "Check a statement" (B3): it starts where the last one ended.
 * Refused while one is open (`one_is_open`), or ending on or before the last one (`ends_too_early`), or before the account
 * is set up (`not_set_up`). Answers with the account's view, showing the new statement (201).
 */
export const POST = withObservability(async (req: Request, { params }: Params) => {
  const r = await resolveClubMoney(req, { scope: 'books', write: true });
  if ('error' in r) return r.error;
  const { accountId } = await params;
  const bad = badBankIds({ accountId });
  if (bad) return bad;
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const out = await startCheck(r.ctx, accountId, body);
  return bankAnswer(r.ctx, accountId, out.ok ? out.id : null, out, 201);
}, { route: '/api/admin/accounting/bank/accounts/[accountId]/checks' });
