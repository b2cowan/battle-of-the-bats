import { NextResponse } from 'next/server';
import { loadFiscalSetting } from '@/lib/club-fiscal-year-server';
import { lockedIn } from '@/lib/club-fiscal-year';
import { withObservability } from '@/lib/observability';
import { resolveClubMoney } from '@/lib/club-money-route';
import { canMoveClubMoney } from '@/lib/member-access';
import { teamIdsInScope } from '@/lib/club-team-route';
import { clubRequests } from '@/lib/club-money-reads';
import { tournamentToday } from '@/lib/timezone';
import { sumMoney } from '@/lib/club-money-figures';

/**
 * GET /api/admin/accounting/payment-requests?orgSlug=&teamId= — Accounting › Payment requests
 * (specimen 4, C15). Waiting first (oldest first, with how long each has waited and whether it is
 * holding up the team's end-of-season payout), then the decided ones (newest decision first).
 *
 * Each carries what the club needs to answer it: the coach's own words, Filed as (New money / Money
 * back — the coach's answer; a pre-271 request says it was filed before we asked), the budget item in
 * the team's plan, who asked and when, how they'd like to be paid, and the decision with its reason,
 * who and when. Words: To club / From club; Approved / Declined / Reversed — the coach's own.
 *
 * ⚖ Stage 3c (Ask 8d): an approval whose lines sit in a CLOSED fiscal year carries `lockedIn` — the year's name and
 * Reopen's (the latest closed year, for a money mover) — so Reverse is absent and one locked sentence stands in its
 * place. The server refuses a Reverse there anyway (409 `year_closed`).
 */
export const GET = withObservability(async (req: Request) => {
  const r = await resolveClubMoney(req, { scope: 'loop', write: false });
  if ('error' in r) return r.error;
  const { ctx } = r;
  const teamId = new URL(req.url).searchParams.get('teamId') ?? undefined;
  const today = tournamentToday();
  const settingP = loadFiscalSetting(ctx.org.id);
  const [rawRows, setting] = await Promise.all([
    teamIdsInScope(ctx).then(scope => clubRequests(ctx.org.id, scope, { teamId }, today)),
    settingP,
  ]);
  const canMove = canMoveClubMoney(ctx, ctx.org);
  const rows = rawRows.map(x => ({ ...x, lockedIn: x.status === 'approved' ? lockedIn(x.paidOn, setting, canMove) : null }));

  const waiting = rows.filter(x => x.status === 'pending');
  const decided = rows.filter(x => x.status !== 'pending')
    .sort((a, b) => (b.reversedAt ?? b.reviewedAt ?? b.createdAt).localeCompare(a.reversedAt ?? a.reviewedAt ?? a.createdAt));
  const total = sumMoney(waiting);

  return NextResponse.json({
    asOf: today,
    // Whether this member may answer them (Ask 1's one rule) — the screen offers Approve only then.
    canMove,
    waiting: { count: waiting.length, total, holdingPayout: waiting.filter(x => x.holdingPayout).length, requests: waiting },
    decided: { count: decided.length, requests: decided },
  });
}, { route: '/api/admin/accounting/payment-requests' });
