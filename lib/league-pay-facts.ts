import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { getOrganizationBySlugForServer } from './server-organizations';
import { getDivisionsForSeason, getLeagueSeasonById, resolvePersonNamer } from './db';
import { hasPlanFeature } from './plan-features';
import { onlinePaymentsOn } from './online-payments-switch';
import { factsFromRow, takesBankDebit, takesPayments, PAYOUTS_ACCOUNT_COLUMNS, type PayoutsAccountFacts, type PayoutsAccountRow } from './online-payment-account';
import { onlineFee, splitFeeAcross, toCents, type OnlineFee } from './online-payment-fee';
import { registrationOwes } from './league-price';
import { loadRegistrationMoneyLines } from './league-money-read';
import { receivedOf } from './league-money';
import { BANK_DEBIT_WORDS as B, PAY_WORDS as W } from './online-payment-words';
import { payLinkSecret } from './league-pay-link';
import { LEAGUE_PAY_WORDS as LW, childList } from './league-pay-words';
import type { LeagueSeason, Organization } from './types';
import { fetchAllIn } from './supabase-paging';
import type { CardRefund } from './league-card-refunds';

/**
 * Everything a house-league sign-up's pay block, the pay route and the payment emails need, read once (Club Tier Stage
 * 12b). `refusal` is the ONE answer to "may this family pay online now?" — the pay route re-reads it at the moment of
 * paying, never trusting the page. Pay when accepted (Stage 9 Q1): only an accepted, live child owes; a child in review
 * or on the waitlist has nothing to pay. One fee, part payments allowed up to what is owing; no deposit (A7 is a team's).
 */
export type LeaguePayRefusal =
  | 'switch_off' | 'not_taking_payments' | 'unrecorded_payment'
  | 'ended' | 'not_accepted' | 'already_paid' | 'nothing_owed'
  /** 12c: every child still owing is on a bank debit that is clearing; nothing more is offered until it clears (ask 6). */
  | 'clearing' | null;

export interface LeaguePayChild {
  registrationId: string;
  firstName: string;
  lastName: string;
  divisionName: string;
  status: string;
  /** The child's price (recorded at sign-up), or null when the season has none. */
  fee: number | null;
  receivedCents: number;
  /** What this child owes right now: an accepted, live child's price less what was received (0 while a debit for it clears). */
  owingCents: number;
  /** 12c: what the child owes while it is on a bank debit that is clearing: its spot is held and it is left out of any new payment. */
  clearingCents: number;
}

/** 12c: a bank debit of this sign-up, on its way (clearing) or come back before it cleared (returned). */
export interface LeagueDebit {
  id: string;
  state: 'clearing' | 'returned';
  totalCents: number;
  last4: string | null;
  startedAt: string | null;
  returnedAt: string | null;
  reason: string | null;
  /** The children it covers, by first name. */
  childFirsts: string[];
}

export interface LeaguePayShare {
  registrationId: string;
  description: string;
  amountCents: number;
  feeShareCents: number;
}

export interface LeaguePayFacts {
  org: Organization;
  season: LeagueSeason;
  /** The registration the link names. */
  anchorId: string;
  /** The sign-up's key (`online_payments.signup_key`): its reference, or the one registration's id. */
  signupKey: string;
  guardianEmail: string | null;
  children: LeaguePayChild[];
  account: PayoutsAccountFacts | null;
  owingCents: number;
  /** The fee on the whole owed total (one payment), or null when nothing is owed. */
  fee: OnlineFee | null;
  /** Each owing child's part of that payment. */
  shares: LeaguePayShare[];
  /** 12c: the club's account takes bank debit; the same total by bank debit (its own rate) and its split. */
  bankDebit: boolean;
  bankFee: OnlineFee | null;
  bankShares: LeaguePayShare[];
  /** 12c: the sign-up's bank debits clearing now, and the newest payment when it came back (returned) with nothing newer. */
  clearing: LeagueDebit[];
  returned: LeagueDebit | null;
  refusal: LeaguePayRefusal;
}

type RegRow = {
  id: string; org_id: string; season_id: string; status: string; player_first_name: string; player_last_name: string;
  division_id: string | null; signup_ref: string | null; guardian_email: string | null; fee_amount: number | null;
};
const REG_COLUMNS = 'id, org_id, season_id, status, player_first_name, player_last_name, division_id, signup_ref, guardian_email, fee_amount';

/** The children of the sign-up a registration belongs to (the same reference and family), oldest first. */
async function signupRows(anchor: RegRow): Promise<RegRow[]> {
  if (!anchor.signup_ref) return [anchor];
  let q = supabaseAdmin.from('league_registrations').select(REG_COLUMNS)
    .eq('season_id', anchor.season_id).eq('org_id', anchor.org_id).eq('signup_ref', anchor.signup_ref);
  // A reference is 8 random characters: the family's email keeps two families' sign-ups apart on a collision.
  q = anchor.guardian_email ? q.eq('guardian_email', anchor.guardian_email) : q.is('guardian_email', null);
  const { data, error } = await q.order('registered_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as RegRow[];
}

/** Each registration's card shares that couldn't land and aren't refunded yet (12b: the desk's refund door). */
export async function unrecordedCardShares(regIds: string[]): Promise<Record<string, { itemId: string; amount: number }[]>> {
  if (!regIds.length) return {};
  const { data: items } = await supabaseAdmin.from('online_payment_items').select('id, registration_id, amount')
    .in('registration_id', regIds).is('entry_id', null).not('land_error', 'is', null);
  const stuck = (items ?? []) as Array<{ id: string; registration_id: string; amount: number }>;
  if (!stuck.length) return {};
  const { data: refunds } = await supabaseAdmin.from('online_payment_refunds').select('online_payment_item_id, amount, fee_refunded, status, booked_at')
    .in('online_payment_item_id', stuck.map(i => i.id));
  const back = new Map<string, number>();
  for (const f of (refunds ?? []) as Array<{ online_payment_item_id: string; amount: number; fee_refunded: number; status: string; booked_at: string | null }>) {
    if (f.status !== 'pending' && f.status !== 'succeeded' && !f.booked_at) continue;
    back.set(f.online_payment_item_id, (back.get(f.online_payment_item_id) ?? 0) + toCents(f.amount) - toCents(f.fee_refunded));
  }
  const out: Record<string, { itemId: string; amount: number }[]> = {};
  for (const i of stuck) {
    const left = toCents(i.amount) - (back.get(i.id) ?? 0);
    if (left > 0) (out[i.registration_id] ??= []).push({ itemId: i.id, amount: left / 100 });
  }
  return out;
}

/** Each registration's booked card refunds that Stripe returned (12b: the desk records them as sent another way). */
export async function returnedCardRefunds(regIds: string[]): Promise<Record<string, { refundId: string; amount: number }[]>> {
  if (!regIds.length) return {};
  const { data: items } = await supabaseAdmin.from('online_payment_items').select('id, registration_id').in('registration_id', regIds);
  const byItem = new Map(((items ?? []) as Array<{ id: string; registration_id: string }>).map(i => [i.id, i.registration_id]));
  if (!byItem.size) return {};
  const { data: refunds } = await supabaseAdmin.from('online_payment_refunds').select('id, online_payment_item_id, amount')
    .in('online_payment_item_id', [...byItem.keys()]).eq('status', 'failed').not('booked_at', 'is', null);
  const out: Record<string, { refundId: string; amount: number }[]> = {};
  for (const f of (refunds ?? []) as Array<{ id: string; online_payment_item_id: string; amount: number }>) {
    const reg = byItem.get(f.online_payment_item_id);
    if (reg) (out[reg] ??= []).push({ refundId: f.id, amount: Number(f.amount) });
  }
  return out;
}

/**
 * Every card refund of these registrations' card payments (12c Part 2, plan §0g): the Fee cell, the record's "To the card"
 * block, the history and the Money page read them. Two reads for a whole season (the children's items, then their refunds
 * with the payment's card facts), and one name lookup — never one per row.
 */
export async function loadCardRefunds(orgId: string, regIds: string[]): Promise<Record<string, CardRefund[]>> {
  if (!regIds.length) return {};
  const items = await fetchAllIn<Record<string, unknown>>(regIds, (chunk, from, to) =>
    supabaseAdmin.from('online_payment_items').select('id, registration_id, amount, fee_share, entry_id, land_error')
      .eq('org_id', orgId).in('registration_id', chunk).order('id').range(from, to));
  if (!items.length) return {};
  const itemById = new Map(items.map(i => [i.id as string, i]));
  const refunds = await fetchAllIn<Record<string, unknown>>([...itemById.keys()], (chunk, from, to) =>
    supabaseAdmin.from('online_payment_refunds')
      .select('id, online_payment_item_id, amount, fee_refunded, status, origin, booked_at, refund_entry_id, reason, partial_reason, failure_reason, created_at, succeeded_at, failed_at, stripe_refund_id, created_by, resolved_by, family_answer, family_emailed_at, family_email_failed_at, online_payments!inner(rail, card_brand, card_last4, bank_last4, receipt_no, paid_at, fee_payer)')
      .in('online_payment_item_id', chunk).order('id').range(from, to));
  if (!refunds.length) return {};
  const nameOf = await resolvePersonNamer(orgId, refunds.flatMap(r => [r.created_by as string | null, r.resolved_by as string | null]));
  const out: Record<string, CardRefund[]> = {};
  for (const r of refunds) {
    const item = itemById.get(r.online_payment_item_id as string);
    if (!item?.registration_id) continue;
    const op = (Array.isArray(r.online_payments) ? r.online_payments[0] : r.online_payments) as Record<string, unknown>;
    const regId = item.registration_id as string;
    (out[regId] ??= []).push({
      id: r.id as string, regId, itemId: item.id as string,
      amount: Number(r.amount), feeBack: Number(r.fee_refunded),
      status: r.status as CardRefund['status'], origin: r.origin as CardRefund['origin'],
      booked: !!r.booked_at, entryId: (r.refund_entry_id as string | null) ?? null,
      inBook: !!item.entry_id, landError: (item.land_error as string | null) ?? null,
      reason: (r.reason as string | null) ?? null, partialReason: (r.partial_reason as string | null) ?? null,
      sentAnotherWay: r.status === 'succeeded' && !!r.failure_reason,
      createdAt: r.created_at as string, succeededAt: (r.succeeded_at as string | null) ?? null, failedAt: (r.failed_at as string | null) ?? null,
      reference: (r.stripe_refund_id as string | null) ?? null, by: nameOf(r.created_by as string | null),
      resolvedBy: nameOf(r.resolved_by as string | null),
      rail: op.rail === 'bank_debit' ? 'bank_debit' : 'card', cardBrand: (op.card_brand as string | null) ?? null,
      cardLast4: (op.card_last4 as string | null) ?? null, bankLast4: (op.bank_last4 as string | null) ?? null,
      receiptNo: op.receipt_no != null ? Number(op.receipt_no) : null, paidAt: (op.paid_at as string | null) ?? null,
      share: Number(item.amount), shareFee: Number(item.fee_share), familyPaidFee: op.fee_payer === 'family',
      emailedAt: (r.family_emailed_at as string | null) ?? null, emailFailedAt: (r.family_email_failed_at as string | null) ?? null,
      familyAnswer: (r.family_answer as CardRefund['familyAnswer']) ?? null,
    });
  }
  return out;
}

/**
 * Part refunds made in Stripe that wait for "whose was it?" (12c, mig 384), by registration: every child of that payment
 * shows "{amount} refunded in Stripe on this family's payment · not matched yet" until the desk answers.
 */
export async function loadUnassignedRefunds(orgId: string, seasonId: string): Promise<Record<string, { id: string; amount: number; children: string }>> {
  const { data: waiting } = await supabaseAdmin.from('online_refunds_unassigned')
    .select('id, amount, online_payment_id, online_payments!inner(season_id)')
    .eq('org_id', orgId).is('assigned_at', null).eq('online_payments.season_id', seasonId);
  const rows = (waiting ?? []) as Array<{ id: string; amount: number; online_payment_id: string }>;
  if (!rows.length) return {};
  const { data: items } = await supabaseAdmin.from('online_payment_items')
    .select('online_payment_id, registration_id, description').in('online_payment_id', rows.map(r => r.online_payment_id));
  const byPay = new Map<string, Array<{ registration_id: string | null; description: string }>>();
  for (const i of (items ?? []) as Array<{ online_payment_id: string; registration_id: string | null; description: string }>) {
    byPay.set(i.online_payment_id, [...(byPay.get(i.online_payment_id) ?? []), i]);
  }
  const out: Record<string, { id: string; amount: number; children: string }> = {};
  for (const r of rows) {
    const kids = byPay.get(r.online_payment_id) ?? [];
    const children = childList(kids.map(k => k.description.split(' · ')[0].split(' ')[0]));
    for (const k of kids) if (k.registration_id) out[k.registration_id] = { id: r.id, amount: Number(r.amount), children };
  }
  return out;
}

/** A child's share that couldn't land and is not refunded in full: the books say owing while the money is taken. */
async function hasUnrecorded(regIds: string[]): Promise<boolean> {
  if (!regIds.length) return false;
  const { data: items } = await supabaseAdmin.from('online_payment_items').select('id, amount')
    .in('registration_id', regIds).is('entry_id', null).not('land_error', 'is', null);
  const stuck = (items ?? []) as Array<{ id: string; amount: number }>;
  if (!stuck.length) return false;
  const { data: refunds } = await supabaseAdmin.from('online_payment_refunds').select('online_payment_item_id, amount, fee_refunded')
    .eq('status', 'succeeded').in('online_payment_item_id', stuck.map(i => i.id));
  const back = new Map<string, number>();
  for (const f of (refunds ?? []) as Array<{ online_payment_item_id: string; amount: number; fee_refunded: number }>) {
    back.set(f.online_payment_item_id, (back.get(f.online_payment_item_id) ?? 0) + toCents(f.amount) - toCents(f.fee_refunded));
  }
  return stuck.some(i => (back.get(i.id) ?? 0) < toCents(i.amount));
}

/** Does this club take card payments now (the switch, the plan, a link secret, an account taking payments)? The desk's
 *  "Email the pay link" shows only then. */
export async function clubTakesCards(org: Pick<Organization, 'id' | 'planId'>): Promise<boolean> {
  if (!onlinePaymentsOn() || !hasPlanFeature(org.planId, 'online_payments') || !payLinkSecret()) return false;
  const { data } = await supabaseAdmin.from('org_payment_accounts').select(PAYOUTS_ACCOUNT_COLUMNS).eq('org_id', org.id).maybeSingle();
  return takesPayments(factsFromRow(data as PayoutsAccountRow | null));
}

/** Why the family cannot pay online right now, in words (copy §11): the pay route's JSON and the page say the same. */
export function leagueRefusalMessage(f: Pick<LeaguePayFacts, 'refusal' | 'children' | 'org'>, contactEmail: string | null): string | null {
  const first = f.children[0];
  const name = first ? `${first.firstName} ${first.lastName}` : '';
  switch (f.refusal) {
    case null: return null;
    case 'switch_off': return W.error.switchOff;
    case 'not_taking_payments': return W.error.clubNotTaking(f.org.name);
    case 'unrecorded_payment': return LW.error.unrecorded(f.org.name, contactEmail);
    case 'ended': return LW.error.ended(name);
    case 'not_accepted': return LW.error.notAccepted(f.children.find(c => c.status === 'pending_review' || c.status === 'waitlisted')?.firstName ?? name);
    case 'already_paid': return f.children.length === 1 ? LW.error.alreadyPaid(name) : LW.error.nothingOwed;
    case 'nothing_owed': return LW.error.nothingOwed;
    case 'clearing': return B.errorClearing(childList(f.children.filter(c => c.clearingCents > 0).map(c => c.firstName)) || name, f.org.name);
  }
}

/** 12c: the sign-up's payments (not expired) with the children each covers: the clearing debits, and the newest when returned. */
async function signupDebits(regIds: string[], firstName: Map<string, string>): Promise<{ clearing: LeagueDebit[]; returned: LeagueDebit | null; clearingRegs: Set<string> }> {
  if (!regIds.length) return { clearing: [], returned: null, clearingRegs: new Set() };
  const { data } = await supabaseAdmin.from('online_payment_items')
    .select('registration_id, description, online_payments!inner(id, status, rail, total_amount, bank_last4, clearing_at, returned_at, return_reason, created_at)')
    .in('registration_id', regIds).neq('online_payments.status', 'expired');
  const byPay = new Map<string, { op: Record<string, unknown>; regs: string[]; firsts: string[] }>();
  for (const i of (data ?? []) as Array<Record<string, unknown>>) {
    const op = (Array.isArray(i.online_payments) ? i.online_payments[0] : i.online_payments) as Record<string, unknown>;
    const entry = byPay.get(op.id as string) ?? { op, regs: [], firsts: [] };
    entry.regs.push(i.registration_id as string);
    entry.firsts.push(firstName.get(i.registration_id as string) ?? String(i.description ?? '').split(' · ')[0]);
    byPay.set(op.id as string, entry);
  }
  const pays = [...byPay.values()].sort((a, b) => String(b.op.created_at).localeCompare(String(a.op.created_at)));
  const debit = (e: { op: Record<string, unknown>; firsts: string[] }): LeagueDebit => ({
    id: e.op.id as string, state: e.op.status as 'clearing' | 'returned', totalCents: toCents(Number(e.op.total_amount)),
    last4: (e.op.bank_last4 as string | null) ?? null, startedAt: (e.op.clearing_at as string | null) ?? null,
    returnedAt: (e.op.returned_at as string | null) ?? null, reason: (e.op.return_reason as string | null) ?? null, childFirsts: e.firsts,
  });
  const clearing = pays.filter(p => p.op.status === 'clearing');
  const newest = pays[0];
  return {
    clearing: clearing.map(debit),
    returned: newest && newest.op.status === 'returned' && newest.op.rail === 'bank_debit' ? debit(newest) : null,
    clearingRegs: new Set(clearing.flatMap(p => p.regs)),
  };
}

export async function loadLeaguePayFacts(registrationId: string): Promise<LeaguePayFacts | null> {
  const { data: anchorRow } = await supabaseAdmin.from('league_registrations').select(REG_COLUMNS).eq('id', registrationId).maybeSingle();
  const anchor = anchorRow as RegRow | null;
  if (!anchor) return null;
  const [{ data: orgRow }, season, rows, { data: acct }] = await Promise.all([
    supabaseAdmin.from('organizations').select('slug').eq('id', anchor.org_id).maybeSingle(),
    getLeagueSeasonById(anchor.season_id, anchor.org_id),
    signupRows(anchor),
    supabaseAdmin.from('org_payment_accounts').select(PAYOUTS_ACCOUNT_COLUMNS).eq('org_id', anchor.org_id).maybeSingle(),
  ]);
  const org = orgRow?.slug ? await getOrganizationBySlugForServer(orgRow.slug as string) : null;
  if (!org || !season) return null;
  const regIds = rows.map(r => r.id);
  const [divisions, lines, unrecorded, debits] = await Promise.all([
    getDivisionsForSeason(season.id), loadRegistrationMoneyLines(regIds), hasUnrecorded(regIds), signupDebits(regIds, new Map(rows.map(r => [r.id, r.player_first_name]))),
  ]);
  const divisionName = new Map(divisions.map(d => [d.id, d.name]));

  const children: LeaguePayChild[] = rows.map(r => {
    const fee = registrationOwes({ feeAmount: r.fee_amount != null ? Number(r.fee_amount) : null }, season);
    const receivedCents = toCents(receivedOf(lines.get(r.id) ?? []));
    const due = r.status === 'active' ? Math.max(0, toCents(fee ?? 0) - receivedCents) : 0;
    // 12c: a child on a clearing debit owes nothing new until it clears or comes back.
    const clearing = debits.clearingRegs.has(r.id);
    return {
      registrationId: r.id, firstName: r.player_first_name, lastName: r.player_last_name,
      divisionName: (r.division_id && divisionName.get(r.division_id)) || '—', status: r.status, fee, receivedCents,
      owingCents: clearing ? 0 : due, clearingCents: clearing ? due : 0,
    };
  });
  const account = factsFromRow(acct as PayoutsAccountRow | null);
  const owing = children.filter(c => c.owingCents > 0);
  const owingCents = owing.reduce((s, c) => s + c.owingCents, 0);
  const fee = owingCents > 0 && account ? onlineFee(owingCents, account.feePayer) : null;
  const split = fee ? splitFeeAcross(fee.feeCents, owing.map(c => c.owingCents)) : [];
  const sharesOf = (parts: number[]): LeaguePayShare[] => owing.map((c, i) => ({
    registrationId: c.registrationId,
    description: `${c.firstName} ${c.lastName} · ${c.divisionName}`,
    amountCents: c.owingCents,
    feeShareCents: parts[i] ?? 0,
  }));
  const shares = sharesOf(split);
  const bankDebit = takesBankDebit(account);
  const bankFee = owingCents > 0 && account && bankDebit ? onlineFee(owingCents, account.feePayer, 'bankDebit') : null;
  const bankShares = bankFee ? sharesOf(splitFeeAcross(bankFee.feeCents, owing.map(c => c.owingCents))) : [];

  const ended = (s: string) => s === 'declined' || s === 'withdrawn';
  let refusal: LeaguePayRefusal = null;
  if (!onlinePaymentsOn() || !hasPlanFeature(org.planId, 'online_payments')) refusal = 'switch_off';
  else if (!takesPayments(account)) refusal = 'not_taking_payments';
  else if (unrecorded) refusal = 'unrecorded_payment';
  else if (owingCents <= 0) {
    if (children.some(c => c.clearingCents > 0)) refusal = 'clearing';
    else if (children.every(c => ended(c.status))) refusal = 'ended';
    else if (children.some(c => c.status === 'pending_review' || c.status === 'waitlisted') && !children.some(c => c.status === 'active' && c.receivedCents > 0)) refusal = 'not_accepted';
    else if (children.some(c => c.receivedCents > 0)) refusal = 'already_paid';
    else refusal = 'nothing_owed';
  }

  return {
    org, season, anchorId: anchor.id, signupKey: anchor.signup_ref ?? anchor.id, guardianEmail: anchor.guardian_email,
    children, account, owingCents, fee, shares, bankDebit, bankFee, bankShares,
    clearing: debits.clearing, returned: debits.returned, refusal,
  };
}
