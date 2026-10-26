import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { loadLeaguePayFacts, type LeaguePayFacts } from './league-pay-facts';
import { leaguePayToken, leaguePayUrl } from './league-pay-link';
import type { LeagueMailPay } from './email';
import { LEAGUE_PAY_WORDS as LW } from './league-pay-words';
import { toCents } from './online-payment-fee';

/**
 * A house-league sign-up's pay block, as one plain object (Club Tier Stage 12b; drawn b1, k1). Built on the server from
 * the sign-up the family proved they hold (the pay link, or the email and reference), so the page never holds more than
 * that sign-up. `null` = the club is not taking card payments: the page keeps today's words, word for word, and draws no
 * button (A6).
 */
/** 12c: 'clearing' — every child still owing is on a bank debit on its way: no Pay buttons, the spots held (ask 6). */
export type LeaguePayKind = 'owing' | 'paid' | 'ended' | 'nothing' | 'refused' | 'clearing';

export interface LeaguePayLine { childName: string; divisionName: string; owingCents: number; feeCents: number; part: boolean }

export interface LeaguePayReceipt {
  id: string;
  receiptNo: number | null;
  lines: { label: string; cents: number }[];
  feeCents: number;
  totalCents: number;
  feePaidByPayer: boolean;
  brand: string | null;
  last4: string | null;
  paidAt: string | null;
  refunded: boolean;
  test: boolean;
  /** 12c: a bank debit's receipt reads the account and the two dates. */
  bank: boolean;
  bankLast4: string | null;
  startedAt: string | null;
  /** 12c Part 6: the bank took this debit back after it cleared. */
  reversedAt: string | null;
}

/** 12c: a bank debit as the family's block says it (clearing, or returned before it cleared). */
export interface LeaguePayDebit {
  id: string;
  state: 'clearing' | 'returned' | 'reversed';
  totalCents: number;
  baseCents: number;
  receiptNo: number | null;
  reversedAt: string | null;
  last4: string | null;
  startedAt: string | null;
  returnedAt: string | null;
  reason: string | null;
  childFirsts: string[];
}

export interface LeaguePayView {
  kind: LeaguePayKind;
  /** The pay link's token: the pay route's key (the family proved the sign-up to reach this view). */
  token: string;
  message: string | null;
  clubName: string;
  seasonName: string;
  testMode: boolean;
  payerEmail: string | null;
  feePaidByPayer: boolean;
  refundPolicy: string | null;
  howToPay: string | null;
  lines: LeaguePayLine[];
  baseCents: number;
  feeCents: number;
  totalCents: number;
  /** 12c: the same total by bank debit, while the club takes it; null otherwise. */
  bankFeeCents: number | null;
  bankTotalCents: number | null;
  /** 12c: the children on a clearing debit ("{child} · {division} · {fee} clearing"), the debits clearing, the one returned. */
  clearingLines: { childName: string; divisionName: string; cents: number }[];
  clearing: LeaguePayDebit[];
  returned: LeaguePayDebit | null;
  reversed: LeaguePayDebit | null;
  clubContact: string | null;
  receipts: LeaguePayReceipt[];
}

/** The sign-up's card payments (paid, part-refunded or refunded), newest first, one line per child. */
async function receiptsFor(regIds: string[]): Promise<LeaguePayReceipt[]> {
  if (!regIds.length) return [];
  const { data: items } = await supabaseAdmin.from('online_payment_items').select('online_payment_id').in('registration_id', regIds);
  const ids = [...new Set(((items ?? []) as Array<{ online_payment_id: string }>).map(i => i.online_payment_id))];
  if (!ids.length) return [];
  const [{ data: pays }, { data: lines }] = await Promise.all([
    supabaseAdmin.from('online_payments')
      .select('id, receipt_no, base_amount, fee_amount, total_amount, fee_payer, card_brand, card_last4, paid_at, status, livemode, rail, bank_last4, clearing_at, reversed_at')
      .in('id', ids).in('status', ['paid', 'partly_refunded', 'refunded', 'reversed']).order('paid_at', { ascending: false }),
    supabaseAdmin.from('online_payment_items').select('online_payment_id, description, amount').in('online_payment_id', ids).order('created_at'),
  ]);
  const byPay = new Map<string, { label: string; cents: number }[]>();
  for (const l of (lines ?? []) as Array<{ online_payment_id: string; description: string; amount: number }>) {
    const list = byPay.get(l.online_payment_id) ?? [];
    list.push({ label: l.description, cents: toCents(l.amount) });
    byPay.set(l.online_payment_id, list);
  }
  return ((pays ?? []) as Array<Record<string, unknown>>).map(p => ({
    id: p.id as string,
    receiptNo: (p.receipt_no as number | null) ?? null,
    lines: byPay.get(p.id as string) ?? [],
    feeCents: toCents(p.fee_amount as number),
    totalCents: toCents(p.total_amount as number),
    feePaidByPayer: p.fee_payer === 'family',
    brand: (p.card_brand as string | null) ?? null,
    last4: (p.card_last4 as string | null) ?? null,
    paidAt: (p.paid_at as string | null) ?? null,
    refunded: p.status === 'refunded',
    test: !p.livemode,
    bank: p.rail === 'bank_debit',
    bankLast4: (p.bank_last4 as string | null) ?? null,
    startedAt: (p.clearing_at as string | null) ?? null,
    reversedAt: p.status === 'reversed' ? ((p.reversed_at as string | null) ?? null) : null,
  }));
}

function kindOf(f: LeaguePayFacts): LeaguePayKind | null {
  switch (f.refusal) {
    case null: return 'owing';
    case 'switch_off':
    case 'not_taking_payments': return null;
    case 'unrecorded_payment': return 'refused';
    case 'ended': return 'ended';
    case 'already_paid': return 'paid';
    case 'not_accepted':
    case 'nothing_owed': return 'nothing';
    case 'clearing': return 'clearing';
  }
}

export function viewFromFacts(f: LeaguePayFacts, token: string, receipts: LeaguePayReceipt[], contactEmail: string | null): LeaguePayView | null {
  const kind = kindOf(f);
  if (!kind) return null;
  return {
    kind,
    token,
    message: kind === 'refused' ? LW.error.unrecorded(f.org.name, contactEmail) : null,
    clubName: f.org.name,
    seasonName: f.season.name,
    testMode: f.account ? !f.account.livemode : false,
    payerEmail: f.guardianEmail,
    feePaidByPayer: f.account?.feePayer === 'family',
    refundPolicy: f.account?.refundPolicy?.trim() || null,
    howToPay: f.season.howToPay?.trim() || null,
    lines: kind === 'owing'
      ? f.children.filter(c => c.owingCents > 0).map(c => ({
        childName: `${c.firstName} ${c.lastName}`, divisionName: c.divisionName, owingCents: c.owingCents,
        feeCents: toCents(c.fee ?? 0), part: c.receivedCents > 0,
      }))
      : [],
    baseCents: kind === 'owing' ? f.owingCents : 0,
    feeCents: kind === 'owing' && f.fee ? f.fee.feeCents : 0,
    totalCents: kind === 'owing' && f.fee ? f.fee.totalCents : 0,
    bankFeeCents: kind === 'owing' && f.bankFee ? f.bankFee.feeCents : null,
    bankTotalCents: kind === 'owing' && f.bankFee ? f.bankFee.totalCents : null,
    clearingLines: f.children.filter(c => c.clearingCents > 0)
      .map(c => ({ childName: `${c.firstName} ${c.lastName}`, divisionName: c.divisionName, cents: c.clearingCents })),
    clearing: f.clearing,
    returned: kind === 'owing' ? f.returned : null,
    reversed: kind === 'owing' ? f.reversed : null,
    clubContact: contactEmail,
    receipts,
  };
}

/**
 * Pay now in a family email (12b copy §3: the sign-up, approval and waitlist-promotion emails): the sign-up's pay link and
 * whether the family pays the processing fee — only while the club takes card payments and something is owed, so an
 * email never carries a button that leads nowhere. Null keeps today's email, word for word (A6).
 */
export async function leagueMailPay(registrationId: string): Promise<LeagueMailPay | null> {
  const f = await loadLeaguePayFacts(registrationId).catch(() => null);
  if (!f || f.refusal !== null) return null;
  const payUrl = leaguePayUrl(process.env.NEXT_PUBLIC_APP_URL ?? '', { orgSlug: f.org.slug, seasonSlug: f.season.slug, registrationId });
  return payUrl ? { payUrl, familyPaysFee: f.account?.feePayer === 'family' } : null;
}

/** The pay block for the sign-up a registration belongs to; null when the club is not taking card payments (or no
 *  link can be signed in this environment — then no button is drawn, never a dead one). */
export async function buildLeaguePayView(registrationId: string, contactEmail: string | null): Promise<LeaguePayView | null> {
  const token = leaguePayToken(registrationId);
  if (!token) return null;
  // 12c: a bank debit still clearing past Stripe's window is asked of Stripe first (loaded late: the landing reads this file).
  await (await import('./bank-debit-overdue')).settleOverdueDebits({ registrationId });
  const f = await loadLeaguePayFacts(registrationId);
  if (!f) return null;
  const receipts = await receiptsFor(f.children.map(c => c.registrationId));
  return viewFromFacts(f, token, receipts, contactEmail);
}
