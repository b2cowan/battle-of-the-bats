import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { resolveLiveCoachTeamContext } from '@/lib/coach-route-context';
import { denyUnless, canViewMoney } from '@/lib/coach-capabilities';
import { moveRefused } from '@/lib/club-money-route';
import { bankRefusedAs } from '@/lib/bank-club-steps';
import { askedDay, teamBankCaller, teamBankView } from '@/lib/bank-coach-steps';

type Params = { params: Promise<{ orgSlug: string; teamId: string }> };

/**
 * GET ?date=YYYY-MM-DD — the team's bank on its LIVE season (Bank balance check BC6b; plan §9 BC6): the account (none
 * until the first save), the season's start, its saved checks newest first, the checked-through mark, and with `date` (a
 * statement DAY, never a year) the figure for that day. Money read sees it all; only money write saves (`canWrite`).
 * No live season: the coded season-not-live answer, nothing past the gate (a closed season is one page, B9).
 *
 * ⚖ A YEAR PARAMETER IS A DECISION (CLAUDE.md) — and this route takes none. `HISTORY_ENDPOINTS` is unchanged. The one read
 * back, recorded as the decision it is (plan §9 BC6, owner Q1 2026-11-06):
 *   1. **Instrument, on the working season.** The bank check is an instrument; every check it reads or saves is the working
 *      season's. Only Q1's look-back reads back: LAST season's money LINES (the season the opening cash was carried from,
 *      found from the working season's own row, never named by the request), after its last matched check, plus its final
 *      check's open items for the crossing "Still waiting?" — never a closed season's checks as checks.
 *   2. **The whole subtree is this view** (BC7's Ledger Bank view). Nothing it reaches takes a season; a look-back line is
 *      a line to mark Not in the bank yet on a working-season check, and opens nothing of last season.
 *   3. **The coach can tell which season they read:** the look-back lines come under their own divider, "From the
 *      {2025 Season}" (`figure.lastSeason.name`), below this season's.
 */
export const GET = withObservability(async (req: Request, { params }: Params) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveLiveCoachTeamContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error;
  const denied = denyUnless(canViewMoney(resolved.assignment.capabilities), 'You do not have access to team finances. Ask the head coach to grant it.');
  if (denied) return denied;
  const date = askedDay(req);
  if (date === false) return moveRefused(bankRefusedAs('bad_date'));
  return NextResponse.json(await teamBankView(teamBankCaller(resolved), date));
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/bank' });
