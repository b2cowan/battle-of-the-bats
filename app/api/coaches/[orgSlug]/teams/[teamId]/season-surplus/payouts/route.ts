import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import { getCoachingAssignmentsForUser, getRepTeam, getActiveRepProgramYear } from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { canWriteMoney, denyUnless } from '@/lib/coach-capabilities';
import {
  recordSettlementPayouts,
  SettlementExceedsRefundError,
  SettlementUnwindFailedError,
  SettlementSeasonNotClosableError,
} from '@/lib/coach-season-settlement';
import { tournamentToday } from '@/lib/timezone';
import { fmt } from '@/lib/coach-money-summary';

/**
 * Settling the season in cash — one row, one family, or the lot.
 *
 * This is the same outbox the Pay out sheet writes to (rep_dues_payouts, mig 234), with
 * `source = 'season_settlement'` so the books can tell a season's settlement from a rebate handed
 * back in March. What differs is the CEILING: a settlement cheque covers a family's owed-back
 * money AND their share of the surplus, and a share is not a credit — see
 * `recordSettlementPayouts`, which owns both the ceiling and the post-write re-check.
 *
 * ⚠ ACTIVE YEAR ONLY. Money moves.
 */

async function resolveCoachContext(orgSlug: string, teamId: string) {
  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return { error: unauthorized() };
  if (ctx.org.slug !== orgSlug) return { error: forbidden() };

  const team = await getRepTeam(teamId);
  if (!team || team.orgId !== ctx.org.id) {
    return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  }

  const assignments = await getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id);
  const assignment = assignments.find(a => a.teamId === teamId);
  if (!assignment) return { error: forbidden() };

  const programYear = await getActiveRepProgramYear(teamId);
  if (!programYear) {
    return { error: NextResponse.json({ error: 'No active program year' }, { status: 404 }) };
  }

  return { ctx, team, assignment, programYear };
}

const METHODS = ['etransfer', 'cash', 'cheque', 'other'] as const;

// POST /api/coaches/[orgSlug]/teams/[teamId]/season-surplus/payouts
//
// Body: { playerIds?: string[], amount?: number, paidDate, method, note }
//   · `playerIds` absent  ⇒ pay EVERY row that is owed something ("Pay all")
//   · one id + `amount`   ⇒ that row, for that amount (the Pay out sheet, pre-filled)
//   · several ids         ⇒ one family, each sibling for what their own row says
export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, team, assignment, programYear } = resolved;
  const denied = denyUnless(canWriteMoney(assignment.capabilities), 'You do not have permission to change team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  const body = await req.json();
  const { playerIds = null, amount = null, paidDate = tournamentToday(), method = 'etransfer', note = null } = body;

  if (typeof paidDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(paidDate)) {
    return NextResponse.json({ error: 'Enter the day the money left.' }, { status: 400 });
  }
  if (!METHODS.includes(method)) {
    return NextResponse.json({ error: 'Invalid method' }, { status: 400 });
  }
  if (playerIds !== null && (!Array.isArray(playerIds) || playerIds.some(id => typeof id !== 'string'))) {
    return NextResponse.json({ error: 'Invalid players' }, { status: 400 });
  }
  if (amount !== null && (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0)) {
    return NextResponse.json({ error: 'Enter an amount to pay out.' }, { status: 400 });
  }
  if (amount !== null && (!Array.isArray(playerIds) || playerIds.length !== 1)) {
    return NextResponse.json({ error: 'An amount can only be given for one family at a time.' }, { status: 400 });
  }

  // ⚠ WHO IS PAID AND HOW MUCH IS THE MODULE'S CALL, from ONE snapshot. This route used to
  // expand "pay all" from a read of its own and then hand the result to a function that read the
  // sheet again to validate it — two mechanisms sharing one job, and four full derivations per
  // click. The browser's figures are never trusted either way.
  try {
    const { sheet, ...result } = await recordSettlementPayouts({
      team: { id: team.id, orgId: team.orgId, name: team.name },
      programYear,
      capabilities: assignment.capabilities,
      playerIds: playerIds as string[] | null,
      amount,
      paidDate,
      method,
      note: typeof note === 'string' ? note : null,
      createdBy: ctx.user.id,
    });
    if (result.paidCount === 0) {
      return NextResponse.json({ error: 'There is nothing to pay out.' }, { status: 409 });
    }
    return NextResponse.json({ ...sheet, ...result }, { status: 201 });
  } catch (e) {
    // ⚠ A payout that could not be unwound is money standing in the books that the sheet says the
    // team does not owe. It gets its own message, naming the amounts, because the coach has to fix
    // it by hand — a generic failure would leave them believing nothing happened.
    if (e instanceof SettlementUnwindFailedError) {
      return NextResponse.json({
        error: 'A payout went through that the sheet could not cover, and undoing it failed. '
          + `Remove ${e.stranded.join('; ')} by hand from the player's record, then try again.`,
        code: 'SETTLEMENT_UNWIND_FAILED',
        stranded: e.stranded,
      }, { status: 500 });
    }
    if (e instanceof SettlementSeasonNotClosableError) {
      return NextResponse.json({
        /* THREE ways to be un-closable, and each needs its own words: money still to arrive, money
           already handed out that the payouts can no longer cover, or a club request nobody has
           answered.
           ⚠ THE THIRD MESSAGE NAMES BOTH WAYS OUT (P4). A coach cannot make the club answer, so a
           refusal that only stated the problem would leave a team unable to close its season
           whenever a club office went quiet — with nothing on screen saying that withdrawing the
           request is a legitimate answer. */
        error: e.expectedIn > 0.005
          ? `Families still owe ${fmt(e.expectedIn)} — the season can't be closed until the dues are in.`
          : e.awaitingCash > 0.005
            ? `Paying everyone needs ${fmt(e.awaitingCash)} more than the team is holding — a family has already been paid more than their share.`
            : e.pendingClubRequests === 1
              ? 'A club request is still waiting for the club\'s answer. Closing the season now would leave it where you can\'t see it — chase the club, or withdraw it on Money → Club.'
              : `${e.pendingClubRequests} club requests are still waiting for the club's answer. Closing the season now would leave them where you can't see them — chase the club, or withdraw them on Money → Club.`,
        code: 'SETTLEMENT_SEASON_NOT_CLOSABLE',
        expectedIn: e.expectedIn,
        awaitingCash: e.awaitingCash,
        pendingClubRequests: e.pendingClubRequests,
      }, { status: 409 });
    }
    if (e instanceof SettlementExceedsRefundError) {
      return NextResponse.json({
        error: e.payableNow > 0.005
          ? `The sheet owes ${e.playerName} ${fmt(e.payableNow)} — you can't pay out more than that.`
          : `The sheet owes ${e.playerName} nothing right now, so there is nothing to pay out.`,
        code: 'SETTLEMENT_EXCEEDS_REFUND',
        payableNow: e.payableNow,
      }, { status: 409 });
    }
    throw e;
  }
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/season-surplus/payouts' });
