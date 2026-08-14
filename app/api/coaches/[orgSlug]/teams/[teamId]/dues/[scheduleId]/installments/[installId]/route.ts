import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getCoachingAssignmentsForUser,
  getRepTeam,
  getActiveRepProgramYear,
  getRepPlayerDuesInstallments,
  getRepDuesPaymentsForPlayer,
  getRepDuesCreditsForPlayer,
  getRepDuesPayoutsForPlayer,
  recordRepDuesPayment,
} from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { denyUnless, canWriteMoney } from '@/lib/coach-capabilities';
import { tournamentToday } from '@/lib/timezone';
import { deriveDuesPosition, amountsTotal } from '@/lib/dues-credits';

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
    return { error: NextResponse.json({ error: 'No active program year for this team' }, { status: 404 }) };
  }

  return { ctx, team, assignment, programYear };
}

// PATCH — "Mark Paid", now a one-tap shortcut over the payment record (mig 232): it records a
// payment for whatever is still UNCOVERED on this installment, dated today. The old handler
// stamped the row and posted the full installment amount even when money had already part-covered
// it; this one can never double-charge, and the payment lands in the same receipt book the
// Record-payment sheet writes.
//
// ⚠ Allocation stays oldest-first even here: if an EARLIER installment is still part-covered,
// the recorded dollars finish that one before starting this one. The coverage the coach sees
// after reload is the truth; a "mark #3 paid while #1 is short" click books the money against
// the oldest debt, which is what a treasurer would do with the cash.
export const PATCH = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; scheduleId: string; installId: string }> },) => {
  const { orgSlug, teamId, scheduleId, installId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, team, assignment, programYear } = resolved;
  const denied = denyUnless(canWriteMoney(assignment.capabilities), 'You do not have permission to change team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  // ⚠ scheduleId is caller-supplied and installment lookups are global — prove the schedule
  // belongs to THIS team's active year before reading anything off it. (Before this check the
  // route was saved only by a downstream NO_SCHEDULE coincidence — review 2026-08-13.)
  const { data: schedRow } = await supabaseAdmin
    .from('rep_player_dues_schedules')
    .select('program_year_id')
    .eq('id', scheduleId)
    .maybeSingle();
  if (!schedRow || schedRow.program_year_id !== programYear.id) {
    return NextResponse.json({ error: 'Installment not found' }, { status: 404 });
  }

  // Verify the installment belongs to this schedule
  const installments = await getRepPlayerDuesInstallments(scheduleId);
  const installment = installments.find(i => i.id === installId);
  if (!installment) {
    return NextResponse.json({ error: 'Installment not found' }, { status: 404 });
  }

  // CLAIM the installment atomically FIRST (paid_at IS NULL → stamp) so two concurrent Mark
  // Paid clicks can't both record — the loser 409s like the old stamp-based flow. ⚠ ONE
  // claimStamp serves the claim write AND the failure revert below: they were two separate
  // new Date() calls once, which meant the revert's paid_at match could never hit the row it
  // was reverting (found reading this hunk in the 2026-08-14 review).
  const claimStamp = new Date().toISOString();
  const { data: claimed } = await supabaseAdmin
    .from('rep_player_dues_installments')
    .update({ paid_at: claimStamp })
    .eq('id', installId)
    .is('paid_at', null)
    .select('id');
  if (!claimed || claimed.length === 0) {
    return NextResponse.json({ error: 'Installment already covered by recorded payments' }, { status: 409 });
  }

  // Fetch the money AFTER the claim, so the figure recorded is as fresh as it can be: the
  // one-tap shortcut records what the family is actually ASKED FOR — the NET remainder after
  // credits land on this installment (owner model 2026-08-14). Deriving before the claim left
  // a window where a concurrent Record-payment made the pre-claim figure stale and this click
  // double-recorded it (/review 2026-08-14).
  const [payments, credits, payouts] = await Promise.all([
    getRepDuesPaymentsForPlayer(programYear.id, installment.playerId),
    getRepDuesCreditsForPlayer(programYear.id, installment.playerId),
    getRepDuesPayoutsForPlayer(programYear.id, installment.playerId),
  ]);
  const { toSendById } = deriveDuesPosition({
    installments,
    payments,
    credits,
    paidOut: amountsTotal(payouts),
    mode: programYear.creditApplication,
  });
  const toSend = toSendById.get(installId) ?? installment.amount;
  if (toSend <= 0.005) {
    // Nothing left to ask the family for — release the claim and say so.
    await supabaseAdmin
      .from('rep_player_dues_installments')
      .update({ paid_at: null })
      .eq('id', installId)
      .eq('paid_at', claimStamp);
    return NextResponse.json({ error: 'Installment already covered by recorded payments or credits' }, { status: 409 });
  }

  const { data: playerRow } = await supabaseAdmin
    .from('rep_roster_players')
    .select('id, player_first_name, player_last_name')
    .eq('id', installment.playerId)
    .single();
  const playerName = [playerRow?.player_first_name, playerRow?.player_last_name].filter(Boolean).join(' ') || 'player';

  // The preloaded rows carry the claim, which sends the new dollars to THE CLICKED installment
  // (stamped-first allocation) — what the button promises. ⚠ On a partly-credit-covered
  // installment the recorded cash is deliberately LESS than the face value, so the projection
  // will see stamped-but-not-cash-covered and clear the stamp again — that is ROUTINE under the
  // credit model, not a failure: the row then reads "Covered by fundraising" (credits settle the
  // rest), and Paid stays a cash word.
  const claimedInstallments = installments.map(i =>
    i.id === installId ? { ...i, paidAt: claimStamp } : i);

  try {
    const result = await recordRepDuesPayment({
      team: { id: team.id, orgId: team.orgId, name: team.name },
      programYearId: programYear.id,
      playerId: installment.playerId,
      playerName,
      amount: toSend,
      receivedDate: tournamentToday(),
      method: 'other',
      note: `Marked paid (installment #${installment.installmentNumber})`,
      createdBy: ctx!.user.id,
      // This route fetched both moments ago — the write path re-reading them was three redundant
      // round-trips on every Mark Paid click.
      preloadedInstallments: claimedInstallments,
      preloadedPayments: payments,
    });
    return NextResponse.json({ ok: true, payment: result.payment });
  } catch (e) {
    // The claim must not outlive a failed recording — a stamp with no money behind it hides the
    // installment from every reminder while showing it paid. Best-effort revert, then rethrow.
    await supabaseAdmin
      .from('rep_player_dues_installments')
      .update({ paid_at: null })
      .eq('id', installId)
      .eq('paid_at', claimStamp);
    if (e instanceof Error && e.message === 'NO_SCHEDULE') {
      return NextResponse.json(
        { error: 'This player has no dues schedule for the active season.' },
        { status: 400 },
      );
    }
    throw e;
  }
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/dues/[scheduleId]/installments/[installId]' });
