import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { resolveClubMoney } from '@/lib/club-money-route';
import { describeFiscalYear, resolveFiscalYear } from '@/lib/club-fiscal-year-server';
import { canMoveClubMoney } from '@/lib/member-access';
import { overviewYearReads } from '@/lib/club-fiscal-reads';
import { teamIdsInScope } from '@/lib/club-team-route';
import { tournamentToday } from '@/lib/timezone';
import { clubPlanYears, readBoardSummary } from '@/lib/club-budget-read';

/**
 * GET /api/admin/accounting/summary?year=2026-09-01 — the board summary for a FISCAL YEAR, which IS the Overview tab (Club Tier
 * Stage 3b, specimen 3; Ask 1, C04, C15, Ask 4e).
 *
 * `summary` (lib/club-budget-report.ts `BoardSummary`):
 *   · `position` — where the club stands TODAY, none of it depending on the year: Cash on hand (every
 *     book the club owns, never a team's; `pending` is its caption), Owed by the teams (Outstanding, with
 *     the overdue and the sent), Waiting on you (count + total, both directions; `holdingPayout` = how
 *     many hold up a team's payout — 3a's `closeOutBlockers`, shared).
 *   · `againstBudget` — READ from Budget vs. Actual's report, never computed twice: Revenue and Expenses
 *     (planned, planned to date, actual), From the teams split (allocations · on request), paid to teams
 *     on request, Off-plan, Net, the ONE Headroom.
 *   · `teams` — per team in the reader's groups (B11): Allocated · Collected · Outstanding for the year
 *     (the year rule), overdue / sent, requests waiting (and whether one holds up a payout), and
 *     `cash` — the coach's own Cash on hand, HELD BY THE TEAM, never added into a club figure.
 *   · `teamsCash` — the teams' cash total, in its own band (never the club's money).
 *   · `books` — each book the club owns, its kind and Balance; they add up to Cash on hand.
 * Retires the Overview's four figures and their read (C04: they added every book together, the teams'
 * included).
 *
 * ⚖ Stage 3c (Asks 1, 2, 4; `lib/club-fiscal-reads.ts`):
 *   · `year` — the fiscal year read (`FiscalYearRead`); `years` — the Year pill.
 *   · `endedOpen` — the OLDEST fiscal year that has ended and isn't closed (its key, name, last day), for
 *     someone who can move the club's money (the close's door); null otherwise.
 *   · `stillOpen` — "From 2025–26, still open": the closed years' installments still owed and requests still
 *     waiting, until each is settled (each row its team, what, state, amount, and the door it opens).
 *   · `yearEnd` — on a CLOSED year, the year-end report's figures (the Overview's Export prints it), read only
 *     from locked figures; null on an open year (the Export is 3b's board report, unchanged).
 */
export const GET = withObservability(async (req: Request) => {
  const gate = await resolveClubMoney(req, { scope: 'books', write: false });
  if ('error' in gate) return gate.error;
  const { ctx } = gate;

  const today = tournamentToday();
  const { setting, year } = await resolveFiscalYear(req, ctx.org.id, today);
  const canMove = canMoveClubMoney(ctx, ctx.org);
  const scope = teamIdsInScope(ctx);
  const [summary, years, read, extra] = await Promise.all([
    readBoardSummary(ctx.org.id, year, setting, scope, today),
    clubPlanYears(ctx.org.id, setting, today),
    describeFiscalYear(ctx.org.id, year, setting, today, canMove),
    overviewYearReads(ctx.org.id, { year, setting, today, canMove, scope }),
  ]);
  return NextResponse.json({ year: read, years, summary, ...extra });
}, { route: '/api/admin/accounting/summary' });
