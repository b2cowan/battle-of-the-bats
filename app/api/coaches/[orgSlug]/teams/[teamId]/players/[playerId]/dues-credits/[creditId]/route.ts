import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getCoachingAssignmentsForUser,
  getRepTeam,
  getActiveRepProgramYear,
  getRepDuesCreditsForPlayer,
  getRepDuesPayoutsForPlayer,
} from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { canWriteMoney, denyUnless } from '@/lib/coach-capabilities';
import { amountsTotal, payoutCeiling } from '@/lib/dues-credits';

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

/**
 * ⚠ THE ONE RULE BOTH DOORS OBEY: whatever credits remain must still cover what has already been
 * handed to the family. Otherwise they hold cash the books no longer say they were owed — and at
 * season's end that missing credit silently inflates everyone else's share of the pool (mig 234,
 * /review 2026-08-14).
 *
 * ⚠ EDITING A CREDIT DOWN CARRIES THE DELETE'S HAZARD EXACTLY, which is why this is a function and
 * not two copies: the epsilon, the refusal code and the sentence can no longer diverge on a future
 * change to one door and not the other. `projected` is the credit set as it WOULD be after the
 * change — filtered for a delete, amount-substituted for an edit.
 *
 * @returns the 409 to return, or null when the change is safe.
 */
function payoutCeilingRefusal(
  /** ⚠ Carries `creditType` because the ceiling EXCLUDES forgiveness — a forgiven balance was
   *  never the family's money to be handed back. Narrowing this to `{ amount }` would have let a
   *  forgiveness count toward what the team may pay out. */
  projected: readonly { amount: number; creditType: string }[],
  payouts: readonly { amount: number }[],
  action: string,
): NextResponse | null {
  const paidOut = amountsTotal(payouts);
  if (paidOut <= payoutCeiling(projected, []) + 0.005) return null;
  return NextResponse.json(
    {
      error: `$${paidOut.toFixed(2)} has already been paid out to this family — ${action} would leave the books owing them less than they have received. Remove the payout first.`,
      code: 'CREDIT_HAS_PAYOUT',
    },
    { status: 409 },
  );
}

// PATCH /api/coaches/[orgSlug]/teams/[teamId]/players/[playerId]/dues-credits/[creditId]
//
// Correct a credit the coach wrote by hand: amount, what it's for, its date.
//
// ⚠ ONLY COACH-AUTHORED CREDITS. A credit carrying `fundraiser_entry_id`, `payment_id` or
// `expense_id` was CREATED BY another record and its amount is that record's to state — a
// fundraiser rebate is the entry's raised × rate, an overpayment is the payment's excess, a
// reimbursement is the out-of-pocket expense. Letting this door type over any of them would leave
// two disagreeing numbers with no way to tell which is true, and the next reconcile would silently
// overwrite whichever the coach had just fixed. Those are edited where they are BORN; the ledger
// drawer links to them instead.
//
// ⚠ LOWERING A CREDIT CARRIES THE DELETE'S HAZARD, EXACTLY. Money already paid out against a
// credit must stay covered by what remains — otherwise the family holds cash the books no longer
// say they were owed, and at season's end the missing credit silently inflates everyone else's
// share of the pool. Same rule, same refusal, same 409 code.
export const PATCH = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; playerId: string; creditId: string }> },) => {
  const { orgSlug, teamId, playerId, creditId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { assignment, programYear } = resolved;
  const denied = denyUnless(canWriteMoney(assignment.capabilities), 'You do not have access to team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  const [credits, payouts] = await Promise.all([
    getRepDuesCreditsForPlayer(programYear.id, playerId),
    getRepDuesPayoutsForPlayer(programYear.id, playerId),
  ]);
  const credit = credits.find(c => c.id === creditId);
  if (!credit) return NextResponse.json({ error: 'Credit not found' }, { status: 404 });

  if (credit.fundraiserEntryId || credit.paymentId || credit.expenseId) {
    return NextResponse.json(
      {
        error: 'This credit comes from another record — edit it there so the two can never disagree.',
        code: 'CREDIT_HAS_SOURCE',
      },
      { status: 409 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const { amount, description, creditDate, notes = null } = body;

  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'Enter an amount greater than zero.' }, { status: 400 });
  }
  if (amount > 999999.99) {
    return NextResponse.json({ error: 'That amount is too large.' }, { status: 400 });
  }
  if (typeof description !== 'string' || !description.trim()) {
    return NextResponse.json({ error: 'Say what this credit is for.' }, { status: 400 });
  }
  if (typeof creditDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(creditDate)) {
    return NextResponse.json({ error: 'Enter a date for this credit.' }, { status: 400 });
  }

  // Whatever credits remain — this one at its NEW amount — must still cover what has gone out.
  const refusal = payoutCeilingRefusal(
    credits.map(c => (c.id === creditId ? { ...c, amount } : c)),
    payouts,
    'lowering this credit',
  );
  if (refusal) return refusal;

  const { error } = await supabaseAdmin
    .from('rep_dues_credits')
    .update({
      amount,
      description: description.trim(),
      credit_date: creditDate,
      notes: typeof notes === 'string' && notes.trim() ? notes.trim() : null,
    })
    .eq('id', creditId)
    .eq('player_id', playerId)
    .eq('program_year_id', programYear.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  /**
   * ⚠ RE-CHECK AGAINST THE TRUE POST-WRITE STATE, and undo ourselves if we lost
   * (/review 2026-08-14, High — this went out without one).
   *
   * The ceiling above was read BEFORE the update. A payout recorded in the gap passed its own
   * guard against the credit's OLD, larger amount, so between them the two writes can leave a
   * family holding more cash than the books say they are owed — with neither request ever having
   * seen both tables in their final state. `recordRepDuesPayout` already answers exactly this
   * with a post-write re-check that self-undoes the loser; a credit lowered concurrently is the
   * same hazard from the other side, so it gets the same treatment.
   *
   * The undo restores the ORIGINAL amount only — the description/date the coach also typed are
   * not worth preserving through a refusal they are about to be shown.
   */
  const [freshCredits, freshPayouts] = await Promise.all([
    getRepDuesCreditsForPlayer(programYear.id, playerId),
    getRepDuesPayoutsForPlayer(programYear.id, playerId),
  ]);
  const stillSafe = payoutCeilingRefusal(freshCredits, freshPayouts, 'lowering this credit');
  if (stillSafe) {
    await supabaseAdmin
      .from('rep_dues_credits')
      .update({ amount: credit.amount })
      .eq('id', creditId)
      .eq('player_id', playerId)
      .eq('program_year_id', programYear.id);
    return stillSafe;
  }

  return NextResponse.json({ ok: true });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/players/[playerId]/dues-credits/[creditId]' });

// DELETE /api/coaches/[orgSlug]/teams/[teamId]/players/[playerId]/dues-credits/[creditId]
export const DELETE = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; playerId: string; creditId: string }> },) => {
  const { orgSlug, teamId, playerId, creditId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { assignment, programYear } = resolved;
  const denied = denyUnless(canWriteMoney(assignment.capabilities), 'You do not have access to team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  // ⚠ A CREDIT THAT HAS ALREADY BEEN PAID OUT CANNOT SIMPLY VANISH (mig 234). Removing it would
  // leave the family holding cash the books no longer say they were owed — and, at season's end,
  // that missing credit silently inflated everyone else's share of the pool (/review 2026-08-14).
  // Remove the payout first; that is the undo, and it voids the ledger line honestly.
  const [credits, payouts] = await Promise.all([
    getRepDuesCreditsForPlayer(programYear.id, playerId),
    getRepDuesPayoutsForPlayer(programYear.id, playerId),
  ]);
  // The rule, stated once: whatever credits remain must still cover what has gone out.
  const refusal = payoutCeilingRefusal(credits.filter(c => c.id !== creditId), payouts, 'removing this credit');
  if (refusal) return refusal;

  const { error } = await supabaseAdmin
    .from('rep_dues_credits')
    .delete()
    .eq('id', creditId)
    .eq('player_id', playerId)
    .eq('program_year_id', programYear.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return new Response(null, { status: 204 });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/players/[playerId]/dues-credits/[creditId]' });
