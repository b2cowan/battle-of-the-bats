import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { resolveClubMoney } from '@/lib/club-money-route';
import { describeFiscalYear, resolveFiscalYear } from '@/lib/club-fiscal-year-server';
import { teamIdsInScope } from '@/lib/club-team-route';
import { tournamentToday } from '@/lib/timezone';
import { clubPlanYears, readClubYear } from '@/lib/club-budget-read';
import { againstLastYear } from '@/lib/club-fiscal-reads';
import { canMoveClubMoney } from '@/lib/member-access';

/**
 * GET /api/admin/accounting/budget-vs-actual?year=2026-09-01 — the club's Budget vs. Actual for a FISCAL YEAR (Club Tier Stage
 * 3b, specimen 2; C05, C09, J4-024, J4-025, S3B-05, Asks 2 and 5).
 *
 * `report` (lib/club-budget-report.ts `ClubReport`):
 *   · `statement` — the coach's shape: Revenue → categories → lines → Total revenue; Expenses → the same;
 *     the year's net. Budgeted · Actual · Variance per row (good-news-positive); `inPlan: false` is an
 *     off-plan row (the amber dash), and "Not filed" is one row. Every item row carries `periods` (the
 *     plan's dates — Compare › To date is the coach's `budgetedOn`) and `costs` (the ledger lines its
 *     Actual adds up). `lineSources` names the allocation or request behind a loop line; `lineBooks` the
 *     book a line sits on.
 *   · `band` — Collected · Spent · Off-plan · Cash on hand, each by the one definition.
 *   · `headroom`, `toDate` — the summary's (it reads them from here, never computes them again).
 *   · `pending` — lines waiting to post on the Club books (Cash on hand's caption).
 *   · `months` — the coach's `MonthGridPayload` fed the club's figures, plus `otherBooks` and `balances`.
 * Every figure is the club's; a team outside the reader's groups is never NAMED in a Scheduled detail
 * or on an allocation (B11, as 3a's reads). No row cap anywhere (C05: the newest fifty expense lines). Team health has LEFT this read (S3B-05):
 * how each team is paying is the summary's.
 *
 * `plan` — the year's plan (the same `ClubPlan` the Budget reads, from the same load): a Budgeted figure opens
 * its line's own window right here (hub specimen 2, "a Budgeted figure opens the line's own window").
 * `year`: the fiscal year read (`FiscalYearRead`, Stage 3c). `years`: the Year pill (the same on the Budget
 * and the Overview). `canMove`: the line's window offers its edit to someone who can change the plan (3a's one
 * money rule) — and never on a CLOSED year (Ask 1). On a closed year the band's Cash on hand is the year's
 * closing (`report.band.atClose`), and the Statement's rows can't move (the lock).
 * `againstLastYear` (Ask 8c, Compare › Against last year): this year's Actual beside the year before's, when
 * the year before has books — `lib/club-fiscal-reads.ts` `againstLastYear`.
 *
 * ⚰ The OLD page's top-level fields (`availableYears`, `summary`, `categories`, `uncategorized`, `orgActuals`,
 * `teamHealth`) retired with it (session 2) — team health lives on the summary now (S3B-05).
 */
export const GET = withObservability(async (req: Request) => {
  const gate = await resolveClubMoney(req, { scope: 'books', write: false });
  if ('error' in gate) return gate.error;
  const { ctx } = gate;

  const today = tournamentToday();
  const { setting, year } = await resolveFiscalYear(req, ctx.org.id, today);
  const canMove = canMoveClubMoney(ctx, ctx.org);
  // The report and the plan it reads against, from ONE load of the year's rows.
  const scope = teamIdsInScope(ctx);
  const [{ plan, report, rows }, years, read] = await Promise.all([
    readClubYear(ctx.org.id, year, setting, today, scope),
    clubPlanYears(ctx.org.id, setting, today),
    describeFiscalYear(ctx.org.id, year, setting, today, canMove),
  ]);
  const compare = await againstLastYear({ year, setting, today, report, rows });

  return NextResponse.json({ year: read, years, canMove: read.canWrite, report, plan, againstLastYear: compare });
}, { route: '/api/admin/accounting/budget-vs-actual' });
