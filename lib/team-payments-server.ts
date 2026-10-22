import 'server-only';
import { NextResponse } from 'next/server';
import { closedYearFromError, isClosedYearError } from './club-fiscal-year-server';
import { moveRefused } from './club-money-route';
import { supabaseAdmin } from './supabase-admin';
import type { PaymentLabel, PaymentMethod, TeamPayment } from './team-payments';

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
