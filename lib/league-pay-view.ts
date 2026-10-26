import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { loadLeaguePayFacts, type LeaguePayFacts } from './league-pay-facts';
import { leaguePayToken } from './league-pay-link';
import { LEAGUE_PAY_WORDS as LW } from './league-pay-words';
import { toCents } from './online-payment-fee';

/**
 * A house-league sign-up's pay block, as one plain object (Club Tier Stage 12b; drawn b1, k1). Built on the server from
 * the sign-up the family proved they hold (the pay link, or the email and reference), so the page never holds more than
 * that sign-up. `null` = the club is not taking card payments: the page keeps today's words, word for word, and draws no
 * button (A6).
 */
export type LeaguePayKind = 'owing' | 'paid' | 'ended' | 'nothing' | 'refused';

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
      .select('id, receipt_no, base_amount, fee_amount, total_amount, fee_payer, card_brand, card_last4, paid_at, status, livemode')
      .in('id', ids).in('status', ['paid', 'partly_refunded', 'refunded']).order('paid_at', { ascending: false }),
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
    receipts,
  };
}

/** The pay block for the sign-up a registration belongs to; null when the club is not taking card payments (or no
 *  link can be signed in this environment — then no button is drawn, never a dead one). */
export async function buildLeaguePayView(registrationId: string, contactEmail: string | null): Promise<LeaguePayView | null> {
  const token = leaguePayToken(registrationId);
  if (!token) return null;
  const f = await loadLeaguePayFacts(registrationId);
  if (!f) return null;
  const receipts = await receiptsFor(f.children.map(c => c.registrationId));
  return viewFromFacts(f, token, receipts, contactEmail);
}
