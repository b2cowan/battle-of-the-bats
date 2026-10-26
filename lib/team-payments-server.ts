import 'server-only';
import { NextResponse } from 'next/server';
import { closedYearFromError, isClosedYearError } from './club-fiscal-year-server';
import { moveRefused } from './club-money-route';
import { supabaseAdmin } from './supabase-admin';
import type { EntryAdjustment, PaymentLabel, PaymentMethod, TeamOnlinePayment, TeamPayment, TeamRefund } from './team-payments';
import { resolvePersonNamer } from './db';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * A TEAM'S PAYMENTS — THE ONE WRITE (mig 345; TEAM_PAYMENTS_LIST_PLAN.md, ruled 2026-10-21).
 *
 * Every door that records, changes or removes tournament entry-fee money (the Teams record, Mark paid, the bulk actions,
 * check-in, a spreadsheet import, one transfer for several teams) lands in one of these functions, which call one database
 * function each. That function writes the payment row, the ledger line (on a plan with Accounting, dated the day the money
 * arrived), and the team's cached paid figures in ONE transaction. Nothing else writes `teams.total_paid` / `deposit_paid`:
 * `tests/unit/team-payments-guard.test.ts` fails the build if app code does.
 *
 * Callers do their own authorization (the route's job); these trust their arguments' ids.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

/** What the database says after a payment moves. `becamePaid` / `becameUnpaid` drive the emails and bells. */
export interface PaymentOutcome {
  paymentId: string | null;
  /** The team's sum received, after the write. */
  total: number;
  status: 'paid' | 'pending';
  feeTotal: number | null;
  becamePaid: boolean;
  becameUnpaid: boolean;
  /** pay-the-rest only: false when nothing was due. */
  recorded: boolean;
  /** pay-the-rest only: the team has no fee schedule, so only its status can be marked. */
  noFee: boolean;
}

/** A payment sentence the database raises on purpose (shown to the organizer as written). */
const KNOWN_REFUSALS = [
  'Enter an amount above $0.',
  'Choose the date the payment arrived.',
  'A payment can’t be dated in the future.',
  'Our team has no entry fee',
  'That payment is no longer recorded.',
  'Team not found',
  'Invalid payment method',
  'Choose at least two different teams and an amount for each',
  'Every payment amount must be positive',
  'A selected team is not in this tournament',
  'This tournament does not record fees in Accounting',
  // Club Tier Stage 12a: the database's backstop on an online row (mig 358's trigger).
  'An online payment is changed by refunding it to the card.',
  'An online payment is recorded by the payment itself.',
];

function outcomeOf(data: unknown): PaymentOutcome {
  const d = (data ?? {}) as Record<string, unknown>;
  return {
    paymentId: typeof d.paymentId === 'string' ? d.paymentId : null,
    total: Number(d.total ?? 0),
    status: d.status === 'paid' ? 'paid' : 'pending',
    feeTotal: d.feeTotal == null ? null : Number(d.feeTotal),
    becamePaid: d.becamePaid === true,
    becameUnpaid: d.becameUnpaid === true,
    recorded: d.recorded === true || (d.recorded === undefined && typeof d.paymentId === 'string'),
    noFee: d.noFee === true,
  };
}

/** A database error → the response a route sends: the fiscal year's words, a known sentence, or a plain failure. */
export async function paymentErrorResponse(error: { message?: string } | null | undefined, orgId: string, days: Array<string | null> = []): Promise<Response> {
  if (error && isClosedYearError(error)) return moveRefused(await closedYearFromError(orgId, days));
  const message = error?.message ?? '';
  if (KNOWN_REFUSALS.some(k => message.includes(k))) {
    return NextResponse.json({ error: KNOWN_REFUSALS.find(k => message.includes(k)) }, { status: 409 });
  }
  return NextResponse.json({ error: 'Couldn’t save the payment. Try again.' }, { status: 500 });
}

export async function recordTeamPayment(a: {
  teamId: string; amount: number; paidOn: string; label?: PaymentLabel | null; method?: PaymentMethod | null; actorId: string | null;
}): Promise<{ outcome: PaymentOutcome } | { error: { message: string } }> {
  const { data, error } = await supabaseAdmin.rpc('tournament_team_payment_record', {
    p_team: a.teamId, p_amount: Math.round(a.amount * 100) / 100, p_paid_on: a.paidOn,
    p_label: a.label ?? 'Payment', p_method: a.method ?? null, p_actor: a.actorId,
  });
  if (error) return { error };
  return { outcome: outcomeOf(data) };
}

/** Mark paid (scope 'all', the rest of the fee) or Deposit paid (scope 'deposit'): what is still due, dated today, one step. */
export async function payTeamDue(a: {
  teamId: string; actorId: string | null; scope: 'all' | 'deposit'; label?: PaymentLabel | null;
}): Promise<{ outcome: PaymentOutcome } | { error: { message: string } }> {
  const { data, error } = await supabaseAdmin.rpc('tournament_team_payment_pay_due', {
    p_team: a.teamId, p_actor: a.actorId, p_scope: a.scope, p_label: a.label ?? null,
  });
  if (error) return { error };
  return { outcome: outcomeOf(data) };
}

export async function changeTeamPayment(a: {
  paymentId: string; amount: number; paidOn: string; method?: PaymentMethod | null; actorId: string | null;
}): Promise<{ outcome: PaymentOutcome } | { error: { message: string } }> {
  const { data, error } = await supabaseAdmin.rpc('tournament_team_payment_change', {
    p_payment: a.paymentId, p_amount: Math.round(a.amount * 100) / 100, p_paid_on: a.paidOn, p_method: a.method ?? null, p_actor: a.actorId,
  });
  if (error) return { error };
  return { outcome: outcomeOf(data) };
}

export async function removeTeamPayment(a: {
  paymentId: string; actorId: string | null;
}): Promise<{ outcome: PaymentOutcome } | { error: { message: string } }> {
  const { data, error } = await supabaseAdmin.rpc('tournament_team_payment_remove', { p_payment: a.paymentId, p_actor: a.actorId });
  if (error) return { error };
  return { outcome: outcomeOf(data) };
}

interface PaymentRow {
  id: string; team_id: string; amount: number | string; paid_on: string | null; label: PaymentLabel; method: PaymentMethod | null;
  entry_id: string | null;
}

const toPayment = (r: PaymentRow): TeamPayment => ({
  id: r.id, amount: Number(r.amount), paidOn: r.paid_on, label: r.label, method: r.method, inLedger: r.entry_id != null,
});

/** A team's posted payments, oldest first. Throws on a read failure (a route turns it into a 500). */
export async function listTeamPayments(teamId: string): Promise<TeamPayment[]> {
  const { data, error } = await supabaseAdmin
    .from('tournament_team_payments')
    .select('id, team_id, amount, paid_on, label, method, entry_id')
    .eq('team_id', teamId).eq('status', 'posted')
    .order('paid_on', { ascending: true, nullsFirst: true }).order('ordinal', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as PaymentRow[]).map(toPayment);
}

/** Every posted payment of a tournament, by team (the export's last-payment date). Read by the event, in pages of 1,000, so a
 *  large event neither builds a huge team-id filter nor loses rows to the API's row cap. */
export async function listPaymentsByTournament(tournamentId: string): Promise<Map<string, TeamPayment[]>> {
  const out = new Map<string, TeamPayment[]>();
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabaseAdmin
      .from('tournament_team_payments')
      .select('id, team_id, amount, paid_on, label, method, entry_id')
      .eq('tournament_id', tournamentId).eq('status', 'posted')
      .order('ordinal', { ascending: true }).range(from, from + PAGE - 1);
    if (error) throw error;
    for (const r of (data ?? []) as PaymentRow[]) {
      const list = out.get(r.team_id) ?? [];
      list.push(toPayment(r));
      out.set(r.team_id, list);
    }
    if (!data || data.length < PAGE) break;
  }
  return out;
}

/** Does this tournament's fee money post to a book (a club plan or the accounting add-on, and not a "free" event)? */
export async function paymentsPostToBook(tournamentId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc('tournament_fee_book_on', { p_tournament: tournamentId });
  if (error) throw error;
  return data === true;
}

/**
 * A team's payments as its RECORD shows them (Club Tier Stage 12a): the posted ones, plus online payments refunded in full
 * (they stay on the record to read "Refunded to card", never counted in what was paid), each online row with its receipt,
 * card and latest refund. `listTeamPayments` stays the posted-only reading every other caller sums.
 */
export async function listTeamPaymentsForRecord(teamId: string): Promise<TeamPayment[]> {
  const { data, error } = await supabaseAdmin
    .from('tournament_team_payments')
    .select('id, team_id, amount, paid_on, label, method, entry_id, status, online_payment_id, refunded_amount')
    .eq('team_id', teamId)
    .or('status.eq.posted,and(status.in.(refunded,reversed),online_payment_id.not.is.null)')
    .order('paid_on', { ascending: true, nullsFirst: true }).order('ordinal', { ascending: true });
  if (error) throw error;
  const rows = (data ?? []) as (PaymentRow & { status: 'posted' | 'refunded' | 'reversed'; online_payment_id: string | null; refunded_amount: number | null })[];
  const onlineIds = rows.map(r => r.online_payment_id).filter((id): id is string => !!id);
  const online = new Map<string, TeamOnlinePayment>();
  if (onlineIds.length) {
    const [{ data: ops, error: opError }, { data: refunds, error: refundError }] = await Promise.all([
      supabaseAdmin.from('online_payments')
        .select('id, receipt_no, card_brand, card_last4, base_amount, fee_amount, total_amount, fee_payer, payer_email, paid_at, livemode, scope, rail, bank_last4, clearing_at, reversed_at, return_reason')
        .in('id', onlineIds),
      supabaseAdmin.from('online_payment_refunds')
        .select('id, online_payment_id, status, succeeded_at, created_at, amount, fee_refunded, origin, part_refund, partial_reason, failed_at, failure_reason, stripe_refund_id, created_by, resolved_by, booked_at, family_emailed_at, family_email_failed_at')
        .in('online_payment_id', onlineIds)
        .order('created_at', { ascending: false }),
    ]);
    if (opError) throw opError;
    if (refundError) throw refundError;
    // 12c: each refund as the record reads it; one refused before Stripe took it changed nothing and is on no screen.
    const orgOf = await supabaseAdmin.from('teams').select('tournaments(org_id)').eq('id', teamId).maybeSingle();
    const orgId = ((orgOf.data as { tournaments?: { org_id?: string } | null } | null)?.tournaments?.org_id) ?? null;
    const nameOf = orgId
      ? await resolvePersonNamer(orgId, (refunds ?? []).flatMap(r => [r.created_by as string | null, r.resolved_by as string | null]))
      : () => null;
    const byPayment = new Map<string, TeamRefund[]>();
    const usedCents = new Map<string, number>();
    for (const r of (refunds ?? []) as Array<Record<string, unknown>>) {
      const pid = r.online_payment_id as string;
      const live = r.status === 'pending' || r.status === 'succeeded' || !!r.booked_at;
      if (live) usedCents.set(pid, (usedCents.get(pid) ?? 0) + Math.round((Number(r.amount) - Number(r.fee_refunded)) * 100));
      if (!live && !(r.status === 'failed' && r.stripe_refund_id)) continue;
      const sentAnotherWay = r.status === 'succeeded' && !!r.failure_reason;
      byPayment.set(pid, [...(byPayment.get(pid) ?? []), {
        id: r.id as string, amountCents: Math.round(Number(r.amount) * 100), feeBackCents: Math.round(Number(r.fee_refunded) * 100),
        state: sentAnotherWay ? 'anotherWay' : r.status === 'failed' ? 'failed' : r.status === 'pending' ? 'pending' : 'refunded',
        part: !!r.part_refund, stripe: r.origin === 'stripe_dashboard', reason: (r.partial_reason as string | null) ?? null,
        createdAt: r.created_at as string, succeededAt: (r.succeeded_at as string | null) ?? null, failedAt: (r.failed_at as string | null) ?? null,
        reference: (r.stripe_refund_id as string | null) ?? null, by: nameOf(r.created_by as string | null), resolvedBy: nameOf(r.resolved_by as string | null),
        emailedAt: (r.family_emailed_at as string | null) ?? null, emailFailedAt: (r.family_email_failed_at as string | null) ?? null,
      }]);
    }
    const latest = new Map<string, { status: string; succeeded_at: string | null }>();
    for (const r of refunds ?? []) if (!latest.has(r.online_payment_id as string)) latest.set(r.online_payment_id as string, r as never);
    const cents = (v: unknown) => Math.round(Number(v) * 100);
    for (const p of ops ?? []) {
      const r = latest.get(p.id as string);
      online.set(p.id as string, {
        id: p.id as string,
        receiptNo: (p.receipt_no as number | null) ?? null,
        brand: (p.card_brand as string | null) ?? null,
        last4: (p.card_last4 as string | null) ?? null,
        baseCents: cents(p.base_amount),
        feeCents: cents(p.fee_amount),
        totalCents: cents(p.total_amount),
        feePaidByPayer: p.fee_payer === 'family',
        payerEmail: (p.payer_email as string | null) ?? null,
        paidAt: (p.paid_at as string | null) ?? null,
        test: !p.livemode,
        refund: !r ? 'none' : r.status === 'succeeded' ? 'succeeded' : r.status === 'pending' ? 'pending' : r.status === 'failed' ? 'failed' : 'none',
        refundedOn: r?.succeeded_at ?? null,
        scope: (p.scope as 'deposit' | 'balance' | 'full') ?? 'full',
        rail: p.rail === 'bank_debit' ? 'bank_debit' : 'card',
        bankLast4: (p.bank_last4 as string | null) ?? null,
        startedAt: (p.clearing_at as string | null) ?? null,
        reversedAt: (p.reversed_at as string | null) ?? null,
        returnReason: (p.return_reason as string | null) ?? null,
        leftCents: cents(p.base_amount) - (usedCents.get(p.id as string) ?? 0),
        refunds: byPayment.get(p.id as string) ?? [],
      });
    }
  }
  return rows.map(r => ({
    ...toPayment(r),
    status: r.status,
    online: r.online_payment_id ? online.get(r.online_payment_id) ?? null : null,
    refundedAmount: Number(r.refunded_amount ?? 0),
  }));
}

/** 12c words §1.3: a team's entry lowered by part refunds — each lowering, oldest first. */
export async function listEntryAdjustments(teamId: string): Promise<EntryAdjustment[]> {
  const { data, error } = await supabaseAdmin.from('tournament_team_entry_adjustments')
    .select('amount, reason, origin, created_at').eq('team_id', teamId).order('created_at', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as Array<{ amount: number; reason: string | null; origin: string; created_at: string }>).map(a => ({
    amountCents: Math.round(Number(a.amount) * 100), reason: a.reason, stripe: a.origin === 'stripe_dashboard', at: a.created_at,
  }));
}
