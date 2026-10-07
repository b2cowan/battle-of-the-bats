import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { resolveClubMoney } from '@/lib/club-money-route';
import { resolveFiscalYear } from '@/lib/club-fiscal-year-server';
import { teamIdsInScope } from '@/lib/club-team-route';
import { tournamentToday } from '@/lib/timezone';
import { sharedPayeeReport } from '@/lib/club-payee-report';

type Params = { params: Promise<{ payeeId: string }> };

/**
 * GET /api/admin/accounting/payees/[payeeId]/report?year=2026-09-01 — what the club's teams RECORDED paying a
 * SHARED club payee in the year (Club Tier Stage 3b, specimen 5; S3B-06, Ask 3). The definition is
 * lib/club-payee-report.ts's (the plan's, word for word): both stamps on or after the share, rows whose
 * payment date falls in the FISCAL year, the teams active in it (a season numbered for either calendar year the
 * fiscal year touches — S3C-03), "Nothing recorded (n)". Stage 3c: `report.year` is the fiscal year read, and
 * `report.years` lists the fiscal years that hold records for this payee (the window shows a Year control only
 * when there is more than one).
 * → 200 `{ report: { payee, year, teams: [{ teamId, teamName, count, total, firstDay, lastDay, payments:
 * [{ id, paidDate, amount, outOfPocket }] }], nothingRecorded: [{ teamId, teamName }], count, total } }`;
 * 404 `not_shared` for a payee that isn't one of the club's shared payees (or isn't the club's at all).
 * Teams outside the reader's groups are left out (B11). Nothing on the Payees list changes.
 */
export const GET = withObservability(async (req: Request, { params }: Params) => {
  const gate = await resolveClubMoney(req, { scope: 'books', write: false });
  if ('error' in gate) return gate.error;
  const { ctx } = gate;
  const { payeeId } = await params;
  const { setting, year } = await resolveFiscalYear(req, ctx.org.id, tournamentToday());
  const report = await sharedPayeeReport(ctx.org.id, payeeId, year, setting, teamIdsInScope(ctx));
  if (!report) return NextResponse.json({ error: 'That payee isn’t shared with your teams.', code: 'not_shared' }, { status: 404 });
  return NextResponse.json({ report });
}, { route: '/api/admin/accounting/payees/[payeeId]/report' });
