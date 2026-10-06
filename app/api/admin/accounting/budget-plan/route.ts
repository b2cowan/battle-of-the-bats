import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { readYearParam, resolveClubMoney } from '@/lib/club-money-route';
import { teamIdsInScope } from '@/lib/club-team-route';
import { canMoveClubMoney } from '@/lib/member-access';
import { tournamentToday } from '@/lib/timezone';
import { clubPlanYears, readClubPlan } from '@/lib/club-budget-read';
import { legacyPlanFields } from '@/lib/club-budget-legacy';

/**
 * GET /api/admin/accounting/budget-plan?year=2026 — the club's year plan (Club Tier Stage 3b,
 * specimen 1; C10, C11, Asks 2, 4b, 5).
 *
 * `plan` (lib/club-budget-report.ts `ClubPlan`): Revenue (From the teams — read from the allocations,
 * never stored — then the club's own money-in lines by category) and Expenses (each cost line with
 * Planned · Allocated · Collected · Not allocated and its allocations, many per line); the plan closes
 * on the year's opening balance (worked out from the books) · net · closing balance; `periodGrid` is
 * the By period view (the coach's month grid fed the plan). Every figure is the definitions module's
 * (`club-money-one-definition-guard`). A team outside the reader's groups is counted on an allocation,
 * never named (B11; `otherTeams`). `years`: every year with a line, this year, and always next year.
 * `canMove`: the reader may write the Budget (3a's one money rule, Ask 4d).
 *
 * ⚰ The top-level `availableYears`, `summary`, `categories`, `uncategorized` are the OLD Budget and
 * Allocate pages' fields, mapped from `plan` — they retire with those pages (session 2).
 */
export const GET = withObservability(async (req: Request) => {
  const gate = await resolveClubMoney(req, { scope: 'books', write: false });
  if ('error' in gate) return gate.error;
  const { ctx } = gate;

  const today = tournamentToday();
  const year = readYearParam(req, today);
  const [plan, years] = await Promise.all([readClubPlan(ctx.org.id, year, today, teamIdsInScope(ctx)), clubPlanYears(ctx.org.id, today)]);

  return NextResponse.json({
    year,
    years,
    canMove: canMoveClubMoney(ctx, ctx.org),
    plan,
    ...legacyPlanFields(plan, years),
  });
}, { route: '/api/admin/accounting/budget-plan' });
