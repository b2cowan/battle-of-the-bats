import { withObservability } from '@/lib/observability';
import { resolveClubMoney } from '@/lib/club-money-route';
import { badBankIds, bankAnswer, refigureCheck } from '@/lib/bank-club-steps';

type Params = { params: Promise<{ accountId: string; checkId: string }> };

/**
 * PATCH { statementEndDate, statementEndingBalanceCents } — correct an OPEN statement's figures ("Undo, then re-enter",
 * rule 2), while every later statement is open too. A checked statement's figures never change
 * (`checked_figures_fixed`); one a later checked statement starts from neither (`later_checked`).
 */
export const PATCH = withObservability(async (req: Request, { params }: Params) => {
  const r = await resolveClubMoney(req, { scope: 'books', write: true });
  if ('error' in r) return r.error;
  const { accountId, checkId } = await params;
  const bad = badBankIds({ accountId, checkId });
  if (bad) return bad;
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  return bankAnswer(r.ctx, accountId, checkId, await refigureCheck(r.ctx, accountId, checkId, body));
}, { route: '/api/admin/accounting/bank/accounts/[accountId]/checks/[checkId]' });
