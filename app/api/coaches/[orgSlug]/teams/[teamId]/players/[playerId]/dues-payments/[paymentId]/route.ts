import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import { getCoachingAssignmentsForUser, getRepTeam, getActiveRepProgramYear, getRepDuesPayment, removeRepDuesPayment, recordRepDuesPayment } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { canWriteMoney, denyUnless } from '@/lib/coach-capabilities';
import { DUES_PAYMENT_METHODS, type DuesPaymentMethod } from '@/lib/types';

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

// PATCH /api/coaches/[orgSlug]/teams/[teamId]/players/[playerId]/dues-payments/[paymentId]
//
// Correct a receipt: amount, the day it arrived, how it arrived, the note.
//
// ⚠ THIS IS NOT AN UPDATE. A posted ledger entry is NEVER rewritten in this product — corrections
// void and re-post, so the books keep the trail of what was believed and when. So an "edit" here
// is exactly `remove` followed by `record`: the old entry is voided, its auto-overpayment credit
// cascades away with it, coverage re-projects, and a fresh payment is written with a fresh entry.
// What the coach experiences is an edit; what the books record is a correction. Before this, the
// only way to fix a typo was Delete then re-type every field.
//
// ⚠ ORDER IS LOAD-BEARING, AND IT IS REMOVE-THEN-RECORD. There is no transaction here, so one of
// the two failure modes has to be chosen deliberately:
//   • record-then-remove fails → a DUPLICATE payment; the books overstate money received, and
//     nothing on screen says which of the two is real.
//   • remove-then-record fails → the payment is MISSING; the books understate, the row visibly
//     disappears, and the coach still has every value in the form to re-enter.
// Understating cash is the safer error and the visible one, so the removal goes first and the
// failure message says plainly that the old receipt is gone.
export const PATCH = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; playerId: string; paymentId: string }> },) => {
  const { orgSlug, teamId, playerId, paymentId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, team, assignment, programYear } = resolved;
  const denied = denyUnless(canWriteMoney(assignment.capabilities), 'You do not have permission to change team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  // Two independent reads: the receipt being corrected, and the player whose name the new ledger
  // line will carry (which also proves they are still in this season). Parallel — neither needs
  // the other's answer.
  const [existing, { data: playerRow }] = await Promise.all([
    getRepDuesPayment(paymentId),
    supabaseAdmin
      .from('rep_roster_players')
      .select('id, player_first_name, player_last_name')
      .eq('id', playerId)
      .eq('program_year_id', programYear.id)
      .single(),
  ]);
  if (!existing || existing.playerId !== playerId || existing.programYearId !== programYear.id) {
    return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
  }
  if (!playerRow) {
    return NextResponse.json({ error: 'Player not found in this program year' }, { status: 404 });
  }
  const playerName = [playerRow.player_first_name, playerRow.player_last_name].filter(Boolean).join(' ') || 'player';

  // ⚠ THE SAME GATES AS THE POST, DELIBERATELY RESTATED RATHER THAN RELAXED. A correction writes
  // the same row through the same function; anything this door lets past, that row carries.
  const body = await req.json().catch(() => ({}));
  const { amount, receivedDate, method, note = null } = body;

  // `Number.isFinite`, not `typeof === 'number'`: NaN is a number and `NaN <= 0` is false, so a
  // NaN amount would walk into the books and turn every sum built from it into NaN.
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'Enter an amount greater than zero.' }, { status: 400 });
  }
  if (amount > 999999.99) {
    return NextResponse.json({ error: 'That amount is too large.' }, { status: 400 });
  }
  if (typeof receivedDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(receivedDate)) {
    return NextResponse.json({ error: 'Enter the date the money arrived.' }, { status: 400 });
  }
  if (!DUES_PAYMENT_METHODS.includes(method as DuesPaymentMethod)) {
    return NextResponse.json({ error: 'Choose how the money arrived.' }, { status: 400 });
  }

  /**
   * ⚠ THE REMOVAL IS THE CLAIM, and only its winner may write a replacement (/review 2026-08-14,
   * High). Removing an already-removed payment is a deliberate no-op — right for the delete door,
   * fatal here: without this check the LOSER of two racing corrections removed nothing and then
   * recorded anyway, leaving two payments and two ledger entries where the coach meant one, with
   * collected dues overstated by whichever amount lost.
   */
  const removedByUs = await removeRepDuesPayment(existing, { id: team.id, orgId: team.orgId, name: team.name });
  if (!removedByUs) {
    return NextResponse.json(
      {
        error: 'Someone else changed or removed that payment first. Reopen the player to see the current record.',
        code: 'PAYMENT_GONE',
      },
      { status: 409 },
    );
  }

  try {
    const result = await recordRepDuesPayment({
      team: { id: team.id, orgId: team.orgId, name: team.name },
      programYearId: programYear.id,
      playerId,
      playerName,
      amount,
      receivedDate,
      method,
      note: typeof note === 'string' && note.trim() ? note.trim() : null,
      createdBy: ctx!.user.id,
    });
    return NextResponse.json({ ok: true, payment: result.payment, overpaymentCredit: result.overpaymentCredit });
  } catch (e) {
    /**
     * ⚠ NEVER TELL THE COACH TO "RE-ENTER IT" (/review 2026-08-14, Medium — this copy did).
     *
     * `recordRepDuesPayment` is not atomic either: it writes the ledger entry and COMMITS the
     * payment row, and only then reconciles credits and re-projects coverage. A throw from either
     * of those last two steps means the replacement **already exists** — so an instruction to
     * re-enter produces a SECOND payment for one real transaction, which is the very duplicate
     * this handler's remove-then-record ordering was chosen to avoid, walking back in through the
     * door it left open.
     *
     * We cannot tell the two cases apart from here, so the message must be true of both: say what
     * is certain (the original is gone), and send the coach to LOOK rather than to retype.
     */
    const reason = e instanceof Error && e.message === 'NO_SCHEDULE'
      ? 'This player has no dues schedule for the active season.'
      : 'The correction could not be completed.';
    return NextResponse.json(
      {
        error: `${reason} The original payment was removed, and the replacement may or may not have been written — check the Payments list below before recording anything, so this money is not counted twice.`,
        code: 'CORRECTION_INCOMPLETE',
      },
      { status: 409 },
    );
  }
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/players/[playerId]/dues-payments/[paymentId]' });

// DELETE /api/coaches/[orgSlug]/teams/[teamId]/players/[playerId]/dues-payments/[paymentId]
// The correction path (there is no edit — a receipt is replaced, not rewritten): voids the
// payment's ledger entry, deletes the row (its auto-overpayment credit goes with it via DB
// CASCADE), and re-projects installment coverage. Works on migrated mark-paid rows too — this
// is the undo the old flow never had.
export const DELETE = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; playerId: string; paymentId: string }> },) => {
  const { orgSlug, teamId, playerId, paymentId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { team, assignment, programYear } = resolved;
  const denied = denyUnless(canWriteMoney(assignment.capabilities), 'You do not have permission to change team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  const payment = await getRepDuesPayment(paymentId);
  if (!payment || payment.playerId !== playerId || payment.programYearId !== programYear.id) {
    return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
  }

  await removeRepDuesPayment(payment, { id: team.id, orgId: team.orgId, name: team.name });
  return NextResponse.json({ ok: true });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/players/[playerId]/dues-payments/[paymentId]' });
