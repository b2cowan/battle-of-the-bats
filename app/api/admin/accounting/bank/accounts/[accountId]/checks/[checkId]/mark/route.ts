import { withObservability } from '@/lib/observability';
import { resolveClubMoney } from '@/lib/club-money-route';
import { badBankIds, bankAnswer, markCheck } from '@/lib/bank-club-steps';

type Params = { params: Promise<{ accountId: string; checkId: string }> };

/**
 * POST { again? } — "Mark this statement checked" (B5), or with `again: true` "Mark checked again" after it changed
 * since (Ask 11). The server recomputes the Difference itself and refuses anything but $0.00 (`not_zero`, 422); the
 * statement keeps exactly the ticks the engine says (rule 4), its outstanding list (B10), who and when. One step
 * (mig 439): if a tick moved while this was decided, it is refused `changed` and the screen reads again.
 */
export const POST = withObservability(async (req: Request, { params }: Params) => {
  const r = await resolveClubMoney(req, { scope: 'books', write: true });
  if ('error' in r) return r.error;
  const { accountId, checkId } = await params;
  const bad = badBankIds({ accountId, checkId });
  if (bad) return bad;
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  return bankAnswer(r.ctx, accountId, checkId, await markCheck(r.ctx, accountId, checkId, body));
}, { route: '/api/admin/accounting/bank/accounts/[accountId]/checks/[checkId]/mark' });
