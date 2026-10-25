import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { loadTeamPayFacts } from './team-pay-facts';
import { refusalMessage } from './team-pay-refusal';

export { refusalMessage };
import { payLinkSecret, readTeamPayToken } from './team-pay-link';
import { PAY_WORDS as W } from './online-payment-words';
import { toCents } from './online-payment-fee';
import type { PayScope } from './team-pay-options';

/**
 * The team's pay page, as one plain object (Club Tier Stage 12a, drawn 12c §1–§3 and the Checkout tab). Built on the
 * server from the signed link, so the page never holds anything the link does not give it: what is owed, Pay, and this
 * team's receipts — never the team's record.
 */
export type PayPageKind = 'owing' | 'already' | 'nothing' | 'not_taking' | 'refused' | 'invalid';

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
}

export interface PayPageView {
  kind: PayPageKind;
  message: string | null;
  clubName: string;
  tournamentName: string;
  teamName: string;
  divisionName: string | null;
  testMode: boolean;
  payerEmail: string | null;
  feePaidByPayer: boolean;
  refundPolicy: string | null;
  howToPay: string | null;
  choices: { scope: PayScope; baseCents: number; feeCents: number; totalCents: number; dueDate: string | null }[];
  preselected: PayScope | null;
  savingCents: number | null;
  totalPaidCents: number;
  /** The fee schedule as today's panel shows it, for the not-taking state (A6: today's words, verbatim). */
  schedule: { totalCents: number | null; totalDue: string | null; depositCents: number | null; depositDue: string | null };
  receipts: PayPageReceipt[];
}

const blank = (message: string): PayPageView => ({
  kind: 'invalid', message, clubName: '', tournamentName: '', teamName: '', divisionName: null, testMode: false, payerEmail: null,
  feePaidByPayer: false, refundPolicy: null, howToPay: null, choices: [], preselected: null, savingCents: null, totalPaidCents: 0,
  schedule: { totalCents: null, totalDue: null, depositCents: null, depositDue: null }, receipts: [],
});

/** The team a pay link names, or null. */
export function teamFromPayToken(token: string): string | null {
  const secret = payLinkSecret();
  return secret ? readTeamPayToken(token, secret) : null;
}

async function receiptsFor(teamId: string): Promise<PayPageReceipt[]> {
  const { data } = await supabaseAdmin
    .from('online_payments')
    .select('id, receipt_no, scope, base_amount, fee_amount, total_amount, fee_payer, card_brand, card_last4, paid_at, status, livemode, updated_at')
    .eq('team_id', teamId)
    .in('status', ['paid', 'refunded'])
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
  }));
}

/** `at` is the address the page was opened under: a link shown under another club's or tournament's address is refused. */
export async function buildTeamPayView(token: string, at?: { orgSlug: string; tournamentSlug: string }): Promise<PayPageView> {
  const teamId = teamFromPayToken(token);
  if (!teamId) return blank(W.error.linkInvalid);
  const f = await loadTeamPayFacts(teamId);
  if (!f) return blank(W.error.linkInvalid);
  if (at && (at.orgSlug !== f.org.slug || at.tournamentSlug !== f.tournament.slug)) return blank(W.error.linkInvalid);
  const settings = (f.tournament.settings ?? {}) as { payment_instructions?: string };
  const howToPay = (settings.payment_instructions ?? '').trim() || null;
  const receipts = await receiptsFor(teamId);
  const kind: PayPageKind =
    f.refusal === null ? 'owing'
      : f.refusal === 'switch_off' || f.refusal === 'not_taking_payments' || f.refusal === 'not_tracked' ? 'not_taking'
        : (f.refusal === 'nothing_owed' || f.refusal === 'our_team') ? (f.totalPaid > 0 ? 'already' : 'nothing')
          : 'refused';
  return {
    kind,
    message: kind === 'refused' ? refusalMessage(f) : null,
    clubName: f.org.name,
    tournamentName: f.tournament.name,
    teamName: f.teamName,
    divisionName: f.divisionName,
    testMode: f.account ? !f.account.livemode : false,
    payerEmail: f.teamEmail,
    feePaidByPayer: f.account?.feePayer === 'family',
    refundPolicy: f.account?.refundPolicy?.trim() || null,
    howToPay,
    choices: kind === 'owing' && f.options
      ? f.options.choices.map(c => ({ scope: c.scope, baseCents: c.fee.baseCents, feeCents: c.fee.feeCents, totalCents: c.fee.totalCents, dueDate: c.dueDate }))
      : [],
    preselected: kind === 'owing' ? f.options?.preselected ?? null : null,
    savingCents: kind === 'owing' ? f.options?.savingCents ?? null : null,
    totalPaidCents: toCents(f.totalPaid),
    schedule: {
      totalCents: f.fee.totalFeeAmount ? toCents(f.fee.totalFeeAmount) : null,
      totalDue: f.fee.totalFeeDueDate,
      depositCents: f.fee.depositAmount ? toCents(f.fee.depositAmount) : null,
      depositDue: f.fee.depositDueDate,
    },
    receipts,
  };
}
