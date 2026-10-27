import { NextResponse } from 'next/server';
import { getAuthContextWithScope, scopeGuard, unauthorized, forbidden, requireTournamentInOrg } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { hasPlanFeature } from '@/lib/plan-features';
import { onlinePaymentsOn, ONLINE_PAYMENTS_OFF_ERROR } from '@/lib/online-payments-switch';
import { canRefundOnline } from '@/lib/online-payment-access';
import { DisputeOpenError, keepOverpayment, recordRefundAnotherWay, refundOnlinePayment, refundTeamPart, resolveLeagueRefundAnotherWay, settleDecisionAfterSave } from '@/lib/online-payment-landing';
import { clearSettled } from '@/lib/needs-attention';
import { OVER_WORDS } from '@/lib/online-payment-words';
import { sendTeamPayLink } from '@/lib/online-payment-receipt';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * A team record's online-payment doors (Club Tier Stage 12a, build prompt Parts 4–5):
 *
 *   POST { action: 'refund', onlinePaymentId, feeIncluded, reason, note }          refund to the card, in full (A12)
 *   POST { action: 'refund', onlinePaymentId, amount, partialReason, note }       12c: part of it (never the fee; lowers the entry)
 *   POST { action: 'refund_another_way', onlinePaymentId, feeIncluded, reason, note }  after a refund to the card came back
 *   POST { action: 'email_pay_link', teamId, despiteLostDispute? }                 "Email the pay link" → "Pay link sent"
 *   POST { action: 'clear_decision', onlinePaymentId, choice, feeBack, reason }    12c Part 6: a team ended while its bank debit
 *                                                                                  clears — send it back or keep it, when it clears
 *   POST { action: 'keep_over', onlinePaymentId, reason }                          12d-1: the club keeps what a team paid past
 *                                                                                  what it owed ("Keep it": a note, never a credit)
 *
 * Who: whoever runs tournaments (A13, `canRefundOnline`; the treasurer does not refund, owner 2026-10-26). Inside the event's organization and scope,
 * behind the launch switch and the plan. FieldLogicHQ's fee is never refunded (§0c); with A2's box ticked the club pays
 * the team's fee back.
 */
const json = (data: unknown, status = 200) => NextResponse.json(data, { status });
const UUID = /^[0-9a-f-]{36}$/i;

export const POST = withObservability(async (req: Request, { params }: { params: Promise<{ tournamentId: string }> }) => {
  const { tournamentId } = await params;
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithScope({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();
  if (!onlinePaymentsOn() || !hasPlanFeature(ctx.org.planId, 'online_payments')) return json({ error: ONLINE_PAYMENTS_OFF_ERROR }, 404);
  if (!canRefundOnline({ role: ctx.role, capabilities: ctx.capabilities }, ctx.org)) return forbidden();
  const denied = scopeGuard(ctx, tournamentId);
  if (denied) return denied;
  const wrongOrg = await requireTournamentInOrg(ctx, tournamentId);
  if (wrongOrg) return wrongOrg;
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;

  if (body.action === 'email_pay_link') {
    if (typeof body.teamId !== 'string' || !UUID.test(body.teamId)) return json({ error: 'That team couldn’t be found.' }, 404);
    const { data: team } = await supabaseAdmin.from('teams').select('tournament_id').eq('id', body.teamId).maybeSingle();
    if (team?.tournament_id !== tournamentId) return json({ error: 'That team couldn’t be found.' }, 404);
    // Ruling 5: after a lost card dispute, one send asks first and goes on `despiteLostDispute`.
    const sent = await sendTeamPayLink(body.teamId, { despiteLostDispute: body.despiteLostDispute === true });
    if ('error' in sent) return json({ error: sent.error, ...(sent.disputeLost === 'ask' ? { code: 'dispute_lost_ask' } : {}) }, 409);
    return json(sent);
  }

  if (body.action === 'clear_decision') {
    if (typeof body.onlinePaymentId !== 'string' || !UUID.test(body.onlinePaymentId)) return json({ error: 'That payment couldn’t be found.' }, 404);
    const { data: op } = await supabaseAdmin.from('online_payments').select('id, org_id, tournament_id, team_id, status').eq('id', body.onlinePaymentId).maybeSingle();
    if (!op || op.org_id !== ctx.org.id || op.tournament_id !== tournamentId) return json({ error: 'That payment couldn’t be found.' }, 404);
    if (op.status !== 'clearing') return json({ error: 'That bank debit isn’t clearing any more. Open the record again.' }, 409);
    const { data: team } = op.team_id ? await supabaseAdmin.from('teams').select('status').eq('id', op.team_id as string).maybeSingle() : { data: null };
    if (team?.status === 'accepted') return json({ error: 'The team is still accepted: its debit goes in the record when it clears.' }, 409);
    const choice = body.choice === 'send_back' || body.choice === 'keep' ? body.choice : null;
    const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 200) : '';
    if (!choice) return json({ error: 'Choose what happens when it clears.' }, 400);
    if (choice === 'keep' && !reason) return json({ error: 'Say why the club keeps it.' }, 400);
    if (choice === 'send_back') {
      const { data: acct } = await supabaseAdmin.from('org_payment_accounts').select('disconnected_at').eq('org_id', ctx.org.id).maybeSingle();
      if (!acct || acct.disconnected_at) return json({ error: 'Payouts are disconnected. Refund it in Stripe when it clears.' }, 409);
    }
    const { error } = await supabaseAdmin.from('online_payment_clear_decisions').insert({
      org_id: ctx.org.id, online_payment_id: op.id, online_payment_item_id: null, choice, fee_back: choice === 'send_back' && body.feeBack === true,
      reason: choice === 'keep' ? reason : null, decided_by: ctx.user.id,
    });
    if (error) return json({ error: error.code === '23505' ? 'This bank debit already has an answer.' : error.message }, 409);
    // The debit may have landed (or come back) between the check above and the save: settle the answer now.
    await settleDecisionAfterSave(op.id).catch(e => console.error('[online-payments] settling a clearing answer failed:', e instanceof Error ? e.message : String(e)));
    return json({ ok: true });
  }

  if (body.action === 'keep_over') {
    if (typeof body.onlinePaymentId !== 'string' || !UUID.test(body.onlinePaymentId)) return json({ error: 'That payment couldn’t be found.' }, 404);
    const { data: op } = await supabaseAdmin.from('online_payments').select('org_id, tournament_id').eq('id', body.onlinePaymentId).maybeSingle();
    if (!op || op.org_id !== ctx.org.id || op.tournament_id !== tournamentId) return json({ error: 'That payment couldn’t be found.' }, 404);
    const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 500) : '';
    if (!reason) return json({ error: OVER_WORDS.keepReasonError }, 400);
    const kept = await keepOverpayment({ onlinePaymentId: body.onlinePaymentId, reason, actorId: ctx.user.id });
    if (kept === 'nothing_extra') return json({ error: OVER_WORDS.keepGone }, 409);
    if (kept === 'refund_pending') return json({ error: OVER_WORDS.keepRefundPending }, 409);
    return json({ ok: true });
  }

  if (body.action === 'refund' || body.action === 'refund_another_way') {
    if (typeof body.onlinePaymentId !== 'string' || !UUID.test(body.onlinePaymentId)) return json({ error: 'That payment couldn’t be found.' }, 404);
    const { data: op } = await supabaseAdmin.from('online_payments').select('org_id, tournament_id, status').eq('id', body.onlinePaymentId).maybeSingle();
    if (!op || op.org_id !== ctx.org.id || op.tournament_id !== tournamentId) return json({ error: 'That payment couldn’t be found.' }, 404);
    if (op.status === 'refunded') return json({ error: 'This payment was already refunded.' }, 409);
    const { data: acct } = await supabaseAdmin.from('org_payment_accounts').select('disconnected_at').eq('org_id', ctx.org.id).maybeSingle();
    if (body.action === 'refund' && (!acct || acct.disconnected_at)) return json({ error: 'Payouts are disconnected: refund this payment in Stripe.' }, 409);
    if (body.action === 'refund_another_way') {
      // Only after a refund to the card came back (review 2026-10-25, M3): otherwise Stripe still holds the money.
      const { data: last } = await supabaseAdmin.from('online_payment_refunds').select('id, status, part_refund, booked_at')
        .eq('online_payment_id', body.onlinePaymentId).order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (last?.status !== 'failed') return json({ error: 'Refund it to the card first. Record the refund sent another way only when that refund came back.' }, 409);
      // 12c: a part refund that came back is already in the record and the books (it lowered the entry): marked done.
      if (last.part_refund && last.booked_at) {
        await resolveLeagueRefundAnotherWay(last.id as string, ctx.user.id);
        return json({ state: 'succeeded', refundId: last.id });
      }
      // A part refund Stripe refused before taking it changed nothing (never booked): it is not a full refund to record.
      // Falling through would open "All of it" and book the whole payment as refunded though no money moved (review 2026-10-26).
      if (last.part_refund) return json({ error: 'That part refund didn’t go through, so nothing was refunded. Try the refund again.' }, 409);
    }
    const reason = body.reason === 'organizer_ended' || body.reason === 'team_left' ? body.reason : null;
    const note = typeof body.note === 'string' ? body.note.trim().slice(0, 1000) || null : null;
    const args = { onlinePaymentId: body.onlinePaymentId, feeIncluded: body.feeIncluded === true, reason, note, actorId: ctx.user.id } as const;
    // 12c: part of it — an amount and a reason; the database caps it at what is left and never adds the fee.
    const amount = typeof body.amount === 'number' && Number.isFinite(body.amount) ? Math.round(body.amount * 100) / 100 : null;
    const partialReason = typeof body.partialReason === 'string' ? body.partialReason.trim().slice(0, 500) : '';
    if (body.action === 'refund' && amount != null && !partialReason) return json({ error: 'Say why only part is refunded.' }, 400);
    try {
      const outcome = body.action === 'refund'
        ? (amount != null ? await refundTeamPart({ onlinePaymentId: body.onlinePaymentId, amount, partialReason, note, actorId: ctx.user.id }) : await refundOnlinePayment(args))
        : await recordRefundAnotherWay(args);
      // 12d-1: a refund that took the extra back settles "paid twice" for everyone it went to (its rule reads it live).
      if (outcome.state !== 'failed') await clearSettled({ orgIds: [ctx.org.id], kinds: ['online_payment_over'] });
      return json(outcome, outcome.state === 'failed' ? 502 : 200);
    } catch (e) {
      // 12d-1 (words §1.2 `dispute.noRefund`): no refund while a dispute on the payment is open.
      if (e instanceof DisputeOpenError) return json({ error: e.message }, 409);
      const message = e instanceof Error ? e.message : '';
      if (message.includes('already being refunded')) return json({ error: 'This payment is already being refunded.' }, 409);
      if (message.includes('can no longer be refunded') || message.includes('already refunded')) return json({ error: 'This payment was already refunded.' }, 409);
      // 12c: the database's own refusals, in the window's words.
      const left = /no more than what is left: ([0-9.]+)/.exec(message);
      if (left) return json({ error: `Enter an amount above $0 and up to $${Number(left[1]).toFixed(2)}.` }, 409);
      if (message.includes('needs a reason')) return json({ error: 'Say why only part is refunded.' }, 400);
      if (message.includes('isn\u2019t in the team\u2019s record') || message.includes("isn't in the team's record")) return json({ error: 'This payment isn’t in the team’s record yet. Refund all of it instead.' }, 409);
      throw e;
    }
  }

  return json({ error: 'Unknown action' }, 400);
}, { route: '/api/admin/tournaments/[tournamentId]/registrations/online-payments' });
