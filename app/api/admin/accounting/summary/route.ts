import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { readYearParam, resolveClubMoney } from '@/lib/club-money-route';
import { teamIdsInScope } from '@/lib/club-team-route';
import { tournamentToday } from '@/lib/timezone';
import { clubPlanYears, readBoardSummary } from '@/lib/club-budget-read';

/**
 * GET /api/admin/accounting/summary?year=2026 — the board summary, which IS the Overview tab (Club Tier
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
 */
export const GET = withObservability(async (req: Request) => {
  const gate = await resolveClubMoney(req, { scope: 'books', write: false });
  if ('error' in gate) return gate.error;
  const { ctx } = gate;

  const today = tournamentToday();
  const year = readYearParam(req, today);
  const [summary, { years, yearLines }] = await Promise.all([
    readBoardSummary(ctx.org.id, year, teamIdsInScope(ctx), today),
    clubPlanYears(ctx.org.id, today),
  ]);
  return NextResponse.json({ year, years, yearLines, summary });
}, { route: '/api/admin/accounting/summary' });
