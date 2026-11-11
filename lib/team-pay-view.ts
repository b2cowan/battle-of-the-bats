import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { loadTeamPayFacts, type TeamPayFacts } from './team-pay-facts';
import { refusalMessage } from './team-pay-refusal';

export { refusalMessage };
import { payLinkSecret, readTeamPayToken, signTeamPayToken, teamPayPath } from './team-pay-link';
import { PAY_WORDS as W } from './online-payment-words';
import { toCents } from './online-payment-fee';
import { tournamentTracksPayments } from './tournament-payments-tracked';
import type { PayScope } from './team-pay-options';
import { clubPublicContact } from './club-email-context';
import { maskEmail } from './utils';

/**
 * The team's pay page, as one plain object (Club Tier Stage 12a, drawn 12c §1–§3 and the Checkout tab). Built on the
 * server from the signed link, so the page never holds anything the link does not give it: what is owed, Pay, and this
 * team's receipts — never the team's record.
 */
/** 12c: 'clearing' — a bank debit is on its way: no Pay buttons, the place is held (ask 6). */
export type PayPageKind = 'owing' | 'already' | 'nothing' | 'not_taking' | 'refused' | 'invalid' | 'clearing';

export interface PayPageReceipt {
  id: string;
  receiptNo: number | null;
  scope: PayScope;
  baseCents: number;
  feeCents: number;
  totalCents: number;
  feePaidByPayer: boolean;
  brand: string | null;
  last4: string | null;
  paidAt: string | null;
  refunded: boolean;
  refundedAt: string | null;
  test: boolean;
  /** 12c: a bank debit's receipt reads the account and the two dates. */
  bank: boolean;
  bankLast4: string | null;
  startedAt: string | null;
  /** 12c Part 6: the bank took this debit back after it cleared; the receipt no longer counts. */
  reversedAt: string | null;
}

export interface PayPageView {
  kind: PayPageKind;
  message: string | null;
  clubName: string;
  teamName: string;
  divisionName: string | null;
  testMode: boolean;
  /** The coach's address MASKED ("s•••@example.com"): a forwarded link never hands the full address to the browser
   *  (Signed-in family accounts Stage 2, Part 6; the league page's rule). The pay route uses the address on file. */
  payerEmail: string | null;
  feePaidByPayer: boolean;
  refundPolicy: string | null;
  howToPay: string | null;
  choices: {
    scope: PayScope; baseCents: number; feeCents: number; totalCents: number; dueDate: string | null;
    /** 12c: the same part by bank debit, while the club takes it; null otherwise. */
    bankFeeCents: number | null; bankTotalCents: number | null;
  }[];
  preselected: PayScope | null;
  savingCents: number | null;
  savingBankCents: number | null;
  /** 12c: a bank debit on its way, or one that came back before it cleared. */
  debit: {
    state: 'clearing' | 'returned' | 'reversed'; totalCents: number; baseCents: number; last4: string | null; startedAt: string | null;
    returnedAt: string | null; reason: string | null; receiptNo: number | null; reversedAt: string | null;
  } | null;
  /** 12c: while a deposit clears, the balance still to come and when it is due (words §2.5). */
  clearingBalance: { cents: number; dueDate: string | null } | null;
  clubContact: string | null;
  totalPaidCents: number;
  /** The fee schedule as today's panel shows it, for the not-taking state (A6: today's words, verbatim). */
  schedule: { totalCents: number | null; totalDue: string | null; depositCents: number | null; depositDue: string | null };
  receipts: PayPageReceipt[];
  /** Invalid only: a real link opened under another tournament's address. That organizer cannot send its team a new link,
   *  so the focused page names no one to ask (Public tournament pages Stage 7, Ask A2). */
  misaddressed?: boolean;
}

const blank = (message: string): PayPageView => ({
  kind: 'invalid', message, clubName: '', teamName: '', divisionName: null, testMode: false, payerEmail: null,
  feePaidByPayer: false, refundPolicy: null, howToPay: null, choices: [], preselected: null, savingCents: null, savingBankCents: null,
  debit: null, clearingBalance: null, clubContact: null, totalPaidCents: 0,
  schedule: { totalCents: null, totalDue: null, depositCents: null, depositDue: null }, receipts: [],
});

/**
 * THE ONE DOOR A TEAM'S PAY LINK GOES THROUGH (mig 467): the page, the pay route and the post-checkout poll all ask this —
 * never `readTeamPayToken` on its own, so no door can open a link the others refuse. The team a link names, or null when
 * the signature fails or the link's version is not the team's current one (the club sent a new link, which stopped this one).
 * `afterCheckout` (the post-checkout poll only) skips the version rule: a team that paid through a link replaced a minute
 * later must still see its payment confirmed, and the poll only answers for a Checkout session that already belongs to it.
 */
export async function teamFromPayToken(token: string, opts: { afterCheckout?: boolean } = {}): Promise<string | null> {
  const secret = payLinkSecret();
  const read = secret ? readTeamPayToken(token, secret) : null;
  if (!read) return null;
  if (opts.afterCheckout) return read.teamId;
  const { data, error } = await supabaseAdmin.from('teams').select('link_version').eq('id', read.teamId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return read.version === Number(data.link_version ?? 0) ? read.teamId : null;
}

/**
 * A team that PAID through a link the club replaced a moment later comes back from Stripe on the OLD address
 * (`/pay/{old token}?paid={session}`), which the page would refuse as a replaced link: the team would see "This link no longer
 * works" for a payment that went through. This answers the current address for that visit, or null for every other case.
 *
 * It answers only when ALL of these hold: the token's signature is good, its version is no longer the team's, the address it was
 * opened under is this team's own, AND `paidSession` is a Checkout session recorded against THIS team. A Checkout session id is
 * unguessable and only the payer's own browser holds it, so a forwarded old link (no session) is refused exactly as before and
 * the replacement still does what it is for.
 */
export async function currentAddressForPaidReturn(
  token: string, paidSession: string | null | undefined, at: { orgSlug: string; tournamentSlug: string },
): Promise<string | null> {
  const secret = payLinkSecret();
  const read = secret && paidSession ? readTeamPayToken(token, secret) : null;
  if (!secret || !read || !paidSession) return null;
  const { data: team } = await supabaseAdmin.from('teams').select('link_version').eq('id', read.teamId).maybeSingle();
  if (!team) return null;
  const current = Number(team.link_version ?? 0);
  if (read.version === current) return null; // not replaced: the page opens it as it always did
  const { data: op } = await supabaseAdmin.from('online_payments').select('id')
    .eq('stripe_checkout_session_id', paidSession).eq('team_id', read.teamId).maybeSingle();
  if (!op) return null;
  const f = await loadTeamPayFacts(read.teamId);
  if (!f || f.org.slug !== at.orgSlug || f.tournament.slug !== at.tournamentSlug) return null;
  return teamPayPath(f.org.slug, f.tournament.slug, signTeamPayToken(read.teamId, secret, current));
}

async function receiptsFor(teamId: string): Promise<PayPageReceipt[]> {
  const { data } = await supabaseAdmin
    .from('online_payments')
    .select('id, receipt_no, scope, base_amount, fee_amount, total_amount, fee_payer, card_brand, card_last4, paid_at, status, livemode, updated_at, rail, bank_last4, clearing_at, reversed_at')
    .eq('team_id', teamId)
    .in('status', ['paid', 'partly_refunded', 'refunded', 'reversed'])
    .order('paid_at', { ascending: false });
  return (data ?? []).map(r => ({
    id: r.id as string,
    receiptNo: (r.receipt_no as number | null) ?? null,
    scope: r.scope as PayScope,
    baseCents: toCents(r.base_amount as number),
    feeCents: toCents(r.fee_amount as number),
    totalCents: toCents(r.total_amount as number),
    feePaidByPayer: r.fee_payer === 'family',
    brand: (r.card_brand as string | null) ?? null,
    last4: (r.card_last4 as string | null) ?? null,
    paidAt: (r.paid_at as string | null) ?? null,
    refunded: r.status === 'refunded',
    refundedAt: r.status === 'refunded' ? (r.updated_at as string) : null,
    test: !r.livemode,
    bank: r.rail === 'bank_debit',
    bankLast4: (r.bank_last4 as string | null) ?? null,
    startedAt: (r.clearing_at as string | null) ?? null,
    reversedAt: r.status === 'reversed' ? ((r.reversed_at as string | null) ?? null) : null,
  }));
}

/** `at` is the address the page was opened under: a link shown under another club's or tournament's address is refused. */
/** 12c: the entry left once the clearing debit lands (none when it pays the whole); its due date from the schedule. */
function balanceAfter(f: TeamPayFacts): { cents: number; dueDate: string | null } | null {
  const left = Math.round(Number(f.fee.totalFeeAmount ?? 0) * 100) - Math.round(f.totalPaid * 100) - (f.debit?.baseCents ?? 0);
  return left > 0 ? { cents: left, dueDate: f.fee.totalFeeDueDate ?? null } : null;
}

export async function buildTeamPayView(token: string, at?: { orgSlug: string; tournamentSlug: string }): Promise<PayPageView> {
  const teamId = await teamFromPayToken(token);
  if (!teamId) return blank(W.error.linkInvalid);
  // 12c: a bank debit still clearing past Stripe's window is asked of Stripe first (loaded late: the landing reads this file).
  await (await import('./bank-debit-overdue')).settleOverdueDebits({ teamId });
  const f = await loadTeamPayFacts(teamId);
  if (!f) return blank(W.error.linkInvalid);
  if (at && (at.orgSlug !== f.org.slug || at.tournamentSlug !== f.tournament.slug)) return { ...blank(W.error.linkInvalid), misaddressed: true };
  const settings = (f.tournament.settings ?? {}) as { payment_instructions?: string };
  const tracked = tournamentTracksPayments(f.tournament.settings);
  // An event that does not track payments shows no fee, amount, due date or how-to-pay text — whatever was typed before.
  const howToPay = tracked ? (settings.payment_instructions ?? '').trim() || null : null;
  const receipts = await receiptsFor(teamId);
  const kind: PayPageKind =
    f.refusal === 'clearing' ? 'clearing'
    : f.refusal === null ? 'owing'
      : f.refusal === 'switch_off' || f.refusal === 'not_taking_payments' || f.refusal === 'not_tracked' ? 'not_taking'
        : (f.refusal === 'nothing_owed' || f.refusal === 'our_team') ? (f.totalPaid > 0 ? 'already' : 'nothing')
          : 'refused';
  return {
    kind,
    message: kind === 'refused' ? refusalMessage(f) : null,
    clubName: f.org.name,
    teamName: f.teamName,
    divisionName: f.divisionName,
    testMode: f.account ? !f.account.livemode : false,
    payerEmail: f.teamEmail ? maskEmail(f.teamEmail) : null,
    feePaidByPayer: f.account?.feePayer === 'family',
    refundPolicy: f.account?.refundPolicy?.trim() || null,
    howToPay,
    choices: kind === 'owing' && f.options
      ? f.options.choices.map(c => ({
        scope: c.scope, baseCents: c.fee.baseCents, feeCents: c.fee.feeCents, totalCents: c.fee.totalCents, dueDate: c.dueDate,
        bankFeeCents: c.bankFee?.feeCents ?? null, bankTotalCents: c.bankFee?.totalCents ?? null,
      }))
      : [],
    preselected: kind === 'owing' ? f.options?.preselected ?? null : null,
    savingCents: kind === 'owing' ? f.options?.savingCents ?? null : null,
    savingBankCents: kind === 'owing' ? f.options?.savingBankCents ?? null : null,
    debit: f.debit ? {
      state: f.debit.state, totalCents: f.debit.totalCents, baseCents: f.debit.baseCents, last4: f.debit.last4, startedAt: f.debit.startedAt,
      returnedAt: f.debit.returnedAt, reason: f.debit.reason, receiptNo: f.debit.receiptNo, reversedAt: f.debit.reversedAt,
    } : null,
    clearingBalance: kind === 'clearing' && f.debit ? balanceAfter(f) : null,
    clubContact: await clubPublicContact(f.org.id).catch(() => null),
    totalPaidCents: toCents(f.totalPaid),
    schedule: tracked ? {
      totalCents: f.fee.totalFeeAmount ? toCents(f.fee.totalFeeAmount) : null,
      totalDue: f.fee.totalFeeDueDate,
      depositCents: f.fee.depositAmount ? toCents(f.fee.depositAmount) : null,
      depositDue: f.fee.depositDueDate,
    } : { totalCents: null, totalDue: null, depositCents: null, depositDue: null },
    receipts,
  };
}
