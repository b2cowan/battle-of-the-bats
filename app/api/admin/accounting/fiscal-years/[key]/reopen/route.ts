import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { moveRefused, resolveClubMoney } from '@/lib/club-money-route';
import { reopenFiscalYear } from '@/lib/club-fiscal-year-moves';

type Params = { params: Promise<{ key: string }> };

/**
 * POST /api/admin/accounting/fiscal-years/[key]/reopen?orgSlug= — REOPEN a closed fiscal year (Club Tier Stage 3c,
 * Ask 3), in ONE step. The LATEST closed year only; body `{ reason }` (required, kept with the year — who, when,
 * why, and the close it undid). Its books and plan unlock until it is closed again; the next year's opening follows
 * the books again. WHO: whoever holds the club's accounting (3a's one money rule).
 * → 200 `{ year: { key, name } }`; 400 `reason_required` · `bad_reason`; 409 `not_closed` · `not_latest` (+ `year`,
 * the one that can be reopened); 404 `not_found`.
 */
export const POST = withObservability(async (req: Request, { params }: Params) => {
  const gate = await resolveClubMoney(req, { scope: 'books', write: true });
  if ('error' in gate) return gate.error;
  const { key } = await params;
  const body = await req.json().catch(() => ({}));
  const done = await reopenFiscalYear(gate.ctx.org.id, gate.ctx.user.id, key, body?.reason);
  if (!done.ok) return moveRefused(done);
  return NextResponse.json({ year: done.year });
}, { route: '/api/admin/accounting/fiscal-years/[key]/reopen' });
