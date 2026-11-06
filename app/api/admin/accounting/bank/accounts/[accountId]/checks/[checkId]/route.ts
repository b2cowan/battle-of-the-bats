import { withObservability } from '@/lib/observability';
import { resolveClubMoney } from '@/lib/club-money-route';
import { badBankIds, bankAnswer, deleteCheck } from '@/lib/bank-club-steps';

type Params = { params: Promise<{ accountId: string; checkId: string }> };

/**
 * DELETE — "Delete this check" (ask 5): any saved check, after one question on the screen. Its figures go from the list;
 * who deleted it and when are kept (a soft delete). The starting statement can't be deleted while a later check stands on
 * it (`start_has_checks`).
 */
export const DELETE = withObservability(async (req: Request, { params }: Params) => {
  const r = await resolveClubMoney(req, { scope: 'books', write: true });
  if ('error' in r) return r.error;
  const { accountId, checkId } = await params;
  const bad = badBankIds({ accountId, checkId });
  if (bad) return bad;
  return bankAnswer(r.ctx, accountId, await deleteCheck(r.ctx, accountId, checkId));
}, { route: '/api/admin/accounting/bank/accounts/[accountId]/checks/[checkId]' });
