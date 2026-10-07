import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { resolveClubMoney } from '@/lib/club-money-route';
import { describeFiscalYear, resolveFiscalYear } from '@/lib/club-fiscal-year-server';
import { teamIdsInScope } from '@/lib/club-team-route';
import { canMoveClubMoney } from '@/lib/member-access';
import { tournamentToday } from '@/lib/timezone';
import { clubPlanYears, readClubPlan } from '@/lib/club-budget-read';

/**
 * GET /api/admin/accounting/budget-plan?year=2026-09-01 — the club's fiscal-year plan (Club Tier Stage 3b,
 * specimen 1; C10, C11, Asks 2, 4b, 5).
 *
 * `plan` (lib/club-budget-report.ts `ClubPlan`): Revenue (From the teams — read from the allocations,
 * never stored — then the club's own money-in lines by category) and Expenses (each cost line with
 * Planned · Allocated · Collected · Not allocated and its allocations, many per line); the plan closes
 * on the year's opening balance (worked out from the books) · net · closing balance; `periodView` is
 * the By period view (the coach's own period builder fed the plan, months and quarters). Every figure
 * is the definitions module's (`club-money-one-definition-guard`). A team outside the reader's groups is
 * counted on an allocation, never named (B11; `otherTeams`).
 *
 * ⚖ Stage 3c — THE FISCAL YEAR. `?year=` is the year's KEY, its first day (an old bare number still lands:
 * the year with that name). `year` = `FiscalYearRead` (key, name, first and last day, months, short, its close
 * and who closed it, `locked`, `current`, `canWrite`). `years` = the Year pill (`FiscalYearOption[]`: every
 * year with a line, every closed year, this year and next — each with its name, `locked`, `current` and
 * `lines`, the count the empty year's "Start from" reads). `canMove`: the reader may write THIS year's plan —
 * 3a's one money rule (Ask 4d) AND the year is open (Ask 1: a closed year reads in place, every write absent).
 * `plan.openingCarried`: the opening is the year before's locked closing (Ask 4).
 *
 * ⚰ The old Budget and Allocate pages' top-level fields (`availableYears`, `summary`, `categories`,
 * `uncategorized`) retired with those pages (session 2).
 */
export const GET = withObservability(async (req: Request) => {
  const gate = await resolveClubMoney(req, { scope: 'books', write: false });
  if ('error' in gate) return gate.error;
  const { ctx } = gate;

  const today = tournamentToday();
  const { setting, year } = await resolveFiscalYear(req, ctx.org.id, today);
  const canMove = canMoveClubMoney(ctx, ctx.org);
  const [plan, years, read] = await Promise.all([
    readClubPlan(ctx.org.id, year, setting, today, teamIdsInScope(ctx)),
    clubPlanYears(ctx.org.id, setting, today),
    describeFiscalYear(ctx.org.id, year, setting, today, canMove),
  ]);

  return NextResponse.json({ year: read, years, today, canMove: read.canWrite, plan });
}, { route: '/api/admin/accounting/budget-plan' });
