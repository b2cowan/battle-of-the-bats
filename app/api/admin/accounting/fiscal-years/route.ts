import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { resolveClubMoney } from '@/lib/club-money-route';
import { canMoveClubMoney } from '@/lib/member-access';
import { tournamentToday } from '@/lib/timezone';
import { fiscalYearWindow } from '@/lib/club-fiscal-year-moves';

/**
 * GET /api/admin/accounting/fiscal-years?orgSlug= — the club's FISCAL YEAR window (Club Tier Stage 3c, Ask 5;
 * Budget › Tools › Fiscal year). Anyone who opens Accounting reads it; `canEdit` says whether this reader may change
 * the first month or a name (3a's one money rule, `canMoveClubMoney`).
 * → 200 `{ firstMonth, firstMonthCanChange, canEdit, current, next, closed[], years[] }` — each year
 * `{ key, name, firstDay, lastDay, months, short, closed: { at, byName, closingBalance } | null, canRename }`;
 * `firstMonthCanChange` is false once any year has been closed; `years` is the Year pill's list.
 */
export const GET = withObservability(async (req: Request) => {
  const gate = await resolveClubMoney(req, { scope: 'books', write: false });
  if ('error' in gate) return gate.error;
  const { ctx } = gate;
  return NextResponse.json(await fiscalYearWindow(ctx.org.id, tournamentToday(), canMoveClubMoney(ctx, ctx.org)));
}, { route: '/api/admin/accounting/fiscal-years' });
