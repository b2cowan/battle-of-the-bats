import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { moveRefused, resolveClubMoney } from '@/lib/club-money-route';
import { readClubPeriods, saveClubLine } from '@/lib/club-budget-writes';
import { supabaseAdmin } from '@/lib/supabase-admin';

type Ctx = { params: Promise<{ lineId: string }> };

/**
 * POST /api/admin/accounting/budget-plan/lines/[lineId]/periods — replace a line's dates, in ONE step
 * (Club Tier Stage 3b, C11: they were set once at creation and never checked again). Body:
 * `{ periods: [{ label, date | periodDate, amount }] }`; `[]` (or no list) makes the line a lump sum.
 *
 * Editable at any time; every save is checked (`club_budget_line_save`, mig 317): each amount above
 * zero, and the set adding up to the line's total within $0.02 — else 400 `periods_dont_add_up` with
 * `periodsTotal` and `lineTotal`. WHO: 3a's one money rule (`canMoveClubMoney`). → 200 `{ periods }`.
 */
export const POST = withObservability(async (req: Request, { params }: Ctx) => {
  const gate = await resolveClubMoney(req, { scope: 'books', write: true });
  if ('error' in gate) return gate.error;
  const { lineId } = await params;
  const body = await req.json().catch(() => ({}));

  const periods = readClubPeriods(body?.periods ?? []);
  if (!periods.ok) return moveRefused(periods);
  const saved = await saveClubLine(gate.ctx.org.id, lineId, { periods: periods.value });
  if (!saved.ok) return moveRefused(saved);

  const { data, error } = await supabaseAdmin.from('org_budget_periods')
    .select('id, period_label, period_date, amount, sort_order').eq('budget_line_id', lineId).order('sort_order');
  if (error) throw error;
  return NextResponse.json({
    periods: (data ?? []).map(p => ({ id: p.id, label: p.period_label, periodDate: p.period_date, amount: Number(p.amount), sortOrder: p.sort_order })),
  });
}, { route: '/api/admin/accounting/budget-plan/lines/[lineId]/periods' });
