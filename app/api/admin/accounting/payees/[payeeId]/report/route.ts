import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { readYearParam, resolveClubMoney } from '@/lib/club-money-route';
import { teamIdsInScope } from '@/lib/club-team-route';
import { tournamentToday } from '@/lib/timezone';
import { sharedPayeeReport } from '@/lib/club-payee-report';

type Params = { params: Promise<{ payeeId: string }> };

/**
 * GET /api/admin/accounting/payees/[payeeId]/report?year=2026 — what the club's teams RECORDED paying a
 * SHARED club payee in the year (Club Tier Stage 3b, specimen 5; S3B-06, Ask 3). The definition is
 * lib/club-payee-report.ts's (the plan's, word for word): both stamps on or after the share, rows whose
 * payment date falls in the year, the active teams in the year, "Nothing recorded (n)".
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
  const report = await sharedPayeeReport(ctx.org.id, payeeId, readYearParam(req, tournamentToday()), teamIdsInScope(ctx));
  if (!report) return NextResponse.json({ error: 'That payee isn’t shared with your teams.', code: 'not_shared' }, { status: 404 });
  return NextResponse.json({ report });
}, { route: '/api/admin/accounting/payees/[payeeId]/report' });
