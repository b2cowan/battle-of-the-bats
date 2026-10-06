import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { readYearParam, resolveClubMoney } from '@/lib/club-money-route';
import { teamIdsInScope } from '@/lib/club-team-route';
import { tournamentToday } from '@/lib/timezone';
import { clubPlanYears, readClubYear } from '@/lib/club-budget-read';
import { legacyReportFields } from '@/lib/club-budget-legacy';

/**
 * GET /api/admin/accounting/budget-vs-actual?year=2026 — the club's Budget vs. Actual (Club Tier Stage
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
 * ⚰ The top-level `availableYears`, `summary`, `categories`, `uncategorized`, `orgActuals`, `teamHealth`
 * are the OLD page's fields, mapped from `plan` and `report` — they retire with that page (session 2).
 */
export const GET = withObservability(async (req: Request) => {
  const gate = await resolveClubMoney(req, { scope: 'books', write: false });
  if ('error' in gate) return gate.error;
  const { ctx } = gate;

  const today = tournamentToday();
  const year = readYearParam(req, today);
  // The report and the plan it reads against, from ONE load of the year's rows.
  const [{ plan, report }, years] = await Promise.all([readClubYear(ctx.org.id, year, today, teamIdsInScope(ctx)), clubPlanYears(ctx.org.id, today)]);

  return NextResponse.json({
    year,
    years,
    report,
    ...legacyReportFields(plan, report, years),
  });
}, { route: '/api/admin/accounting/budget-vs-actual' });
