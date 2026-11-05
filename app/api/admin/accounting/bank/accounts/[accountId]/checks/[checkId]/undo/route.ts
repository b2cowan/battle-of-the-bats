import { withObservability } from '@/lib/observability';
import { resolveClubMoney } from '@/lib/club-money-route';
import { badBankIds, bankAnswer, undoCheck } from '@/lib/bank-club-steps';

type Params = { params: Promise<{ accountId: string; checkId: string }> };

/**
 * POST { reason } — undo the check of the LATEST checked statement (B4, Ask 9), with a reason kept with the name and the
 * time. It reopens with its ticks; the one before it becomes the latest, so a treasurer steps back one at a time.
 */
export const POST = withObservability(async (req: Request, { params }: Params) => {
  const r = await resolveClubMoney(req, { scope: 'books', write: true });
  if ('error' in r) return r.error;
  const { accountId, checkId } = await params;
  const bad = badBankIds({ accountId, checkId });
  if (bad) return bad;
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  return bankAnswer(r.ctx, accountId, checkId, await undoCheck(r.ctx, accountId, checkId, body));
}, { route: '/api/admin/accounting/bank/accounts/[accountId]/checks/[checkId]/undo' });
