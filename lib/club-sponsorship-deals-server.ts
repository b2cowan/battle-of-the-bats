import 'server-only';
/**
 * THE CLUB'S SPONSORSHIP DEALS — READS AND WRITES (Board Ready Stage 6, Part 2; mig 526). Service role only, as every club
 * money table: the admin routes have asked `requireSponsorships` before they reach here; the business's page reaches a deal
 * only through its link's one door (lib/sponsor-deal-view.ts). The answers a business gave are read only through
 * `readDealAnswers` in lib/club-form-staff.ts (the Stage 4 guard).
 *
 *   · Every offer EMAIL leaves a row in club_sponsor_offers with the address, the reason, its date and who sent it (a name
 *     kept as it was) — CASL's burden of proof is the sender's (/legal §1). "Make the link only" sends nothing and records
 *     no reason (owner call (c)).
 *   · A stop (unsubscribe, "Do not offer again") is insert-only and per club + address; a family opt-out is read live.
 *   · A deal's place shows only when `dealPlaceUp` says so (paid, or the logo line ticked); the logo the business sent is
 *     private until then, and copied to the public logo bucket when the place goes up (Part 2: "a public link only once the
 *     place shows").
 */
import { randomUUID } from 'crypto';
import { supabaseAdmin } from './supabase-admin';
import { ORG_LOGO_BUCKET } from './org-image-limits';
import { newSponsorLogoFileName, sponsorLogoObjectPath } from './sponsor-logo';
import { CLUB_FORM_BUCKET } from './club-form-server';
import { getFamilySuppressionList } from './family-email';
import { fetchAll } from './supabase-paging';
import { removeLogoFile } from './club-sponsorships-server';
import {
  dealPlaceUp, invoiceNumber, LOGO_ITEM,
  type ClubDeal, type DealState, type OfferReason,
} from './club-sponsorship-deals';
import type { PackageItem, SponsorPlaceKind } from './club-sponsorships';
import { creditNoteNumber, DEAL_METHOD_LABEL, invoiceStanding, type DealPayment, type DealRefund } from './club-sponsor-invoice';
import type { DuesPaymentMethod } from './types';

// ── Reading deals ──────────────────────────────────────────────────────────────────────────────────

type DealRow = {
  id: string; sponsor_id: string; package_id: string; package_name: string; package_items: PackageItem[]; logo_on_site: boolean;
  place_kind: SponsorPlaceKind; target_id: string | null; target_name: string | null; ends_on: string | null; amount: number | string;
  charge_tax: boolean; state: DealState; link_version: number; offered_on: string; offered_at: string; offered_by_name: string;
  offered_to: string | null; emailed_at: string | null; opened_at: string | null; link_unsent_at: string | null; form_at: string | null; business_name: string | null;
  invoice_year: number | null; invoice_seq: number | null; invoiced_on: string | null; due_on: string | null; tax_kind: 'GST' | 'HST' | null;
  tax_rate: number | string | null; tax_amount: number | string | null; total: number | string | null; withdrawn_at: string | null;
  revised_on: string | null; invoice_emailed_at: string | null; paid_on: string | null;
  card_fee: number | string | null; card_fee_tax: number | string | null;
  withdrawn_by_name: string | null; withdrawn_reason: string | null;
  club_sponsors: { name: string } | { name: string }[] | null;
};
const DEAL_COLUMNS = [
  'id', 'sponsor_id', 'package_id', 'package_name', 'package_items', 'logo_on_site', 'place_kind', 'target_id', 'target_name', 'ends_on',
  'amount', 'charge_tax', 'state', 'link_version', 'offered_on', 'offered_at', 'offered_by_name', 'offered_to', 'emailed_at', 'opened_at', 'link_unsent_at',
  'form_at', 'business_name', 'invoice_year', 'invoice_seq', 'invoiced_on', 'due_on', 'tax_kind', 'tax_rate', 'tax_amount', 'total',
  'withdrawn_at', 'withdrawn_by_name', 'withdrawn_reason', 'revised_on', 'invoice_emailed_at', 'paid_on', 'card_fee', 'card_fee_tax', 'club_sponsors(name)',
].join(', ');

const num = (v: number | string | null): number => (v == null ? 0 : Number(v));

function dealOf(r: DealRow, done: ClubDeal['done'], payments: readonly DealPayment[]): ClubDeal & { linkVersion: number } {
  const { paid, live } = invoiceStanding(num(r.total), payments);
  const last = live[live.length - 1];
  const sponsor = Array.isArray(r.club_sponsors) ? r.club_sponsors[0] : r.club_sponsors;
  return {
    id: r.id, sponsorId: r.sponsor_id, businessName: r.business_name ?? sponsor?.name ?? '', packageId: r.package_id,
    packageName: r.package_name, items: Array.isArray(r.package_items) ? r.package_items : [], logoOnSite: r.logo_on_site,
    placeKind: r.place_kind, targetId: r.target_id, targetName: r.target_name, endsOn: r.ends_on, amount: num(r.amount),
    chargeTax: r.charge_tax, state: r.state, offeredOn: r.offered_on, offeredAt: r.offered_at, offeredByName: r.offered_by_name,
    offeredTo: r.offered_to, emailedAt: r.emailed_at, openedAt: r.opened_at, linkUnsentAt: r.link_unsent_at, formAt: r.form_at,
    invoice: r.invoice_seq != null && r.invoice_year != null
      ? {
        number: invoiceNumber(r.invoice_year, r.invoice_seq), issuedOn: r.invoiced_on ?? '', dueOn: r.due_on ?? '',
        taxKind: r.tax_kind, taxRate: r.tax_rate == null ? null : Number(r.tax_rate), tax: num(r.tax_amount), total: num(r.total),
        ...(r.card_fee != null ? { cardFee: num(r.card_fee), cardFeeTax: num(r.card_fee_tax) } : {}),
      }
      : null,
    revisedOn: r.revised_on, invoiceEmailedAt: r.invoice_emailed_at, paidOn: r.paid_on,
    paidHow: last ? DEAL_METHOD_LABEL[last.method].toLowerCase() : null,
    paidAmount: paid,
    withdrawn: r.withdrawn_at ? { at: r.withdrawn_at, byName: r.withdrawn_by_name ?? '', reason: r.withdrawn_reason ?? '' } : null,
    done, linkVersion: r.link_version,
  };
}

async function doneFor(dealIds: string[]): Promise<Map<string, ClubDeal['done']>> {
  const out = new Map<string, ClubDeal['done']>();
  if (!dealIds.length) return out;
  for (let i = 0; i < dealIds.length; i += 200) {
    const { data, error } = await supabaseAdmin.from('club_sponsor_deal_items').select('deal_id, item_id, done_at, done_by_name').in('deal_id', dealIds.slice(i, i + 200));
    if (error) throw error;
    for (const r of (data ?? []) as { deal_id: string; item_id: string; done_at: string; done_by_name: string }[]) {
      const m = out.get(r.deal_id) ?? {};
      m[r.item_id] = { at: r.done_at, byName: r.done_by_name };
      out.set(r.deal_id, m);
    }
  }
  return out;
}

// ── Payments (Part 3a, mig 528) ─────────────────────────────────────────────────────────────────────

type PaymentRow = {
  id: string; deal_id: string; amount: number | string; tax_part: number | string; received_on: string; method: DuesPaymentMethod;
  reference: string | null; note: string | null; recorded_by_name: string; recorded_at: string; voided_at: string | null; voided_by_name: string | null; void_reason: string | null;
  // Part 3b (mig 530): a card payment.
  online_payment_id: string | null; card_brand: string | null; card_last4: string | null; fee_paid_by: 'club' | 'sponsor' | null;
  fee_amount: number | string | null; fee_charged: number | string; fee_tax: number | string;
  online_payments: { paid_at: string | null; stripe_payment_intent_id: string | null } | { paid_at: string | null; stripe_payment_intent_id: string | null }[] | null;
};
const PAYMENT_COLUMNS = 'id, deal_id, amount, tax_part, received_on, method, reference, note, recorded_by_name, recorded_at, voided_at, voided_by_name, void_reason, '
  + 'online_payment_id, card_brand, card_last4, fee_paid_by, fee_amount, fee_charged, fee_tax, online_payments(paid_at, stripe_payment_intent_id)';
const paymentOf = (r: PaymentRow): DealPayment => {
  const op = Array.isArray(r.online_payments) ? r.online_payments[0] : r.online_payments;
  return {
    id: r.id, amount: num(r.amount), taxPart: num(r.tax_part), receivedOn: r.received_on, method: r.method, reference: r.reference, note: r.note,
    recordedByName: r.recorded_by_name, recordedAt: r.recorded_at,
    voided: r.voided_at ? { at: r.voided_at, byName: r.voided_by_name ?? '', reason: r.void_reason ?? '' } : null,
    card: r.online_payment_id ? {
      brand: r.card_brand, last4: r.card_last4, paidAt: op?.paid_at ?? null, reference: op?.stripe_payment_intent_id ?? null,
      feePaidBy: r.fee_paid_by ?? 'club', fee: num(r.fee_amount), feeCharged: num(r.fee_charged), feeTax: num(r.fee_tax),
    } : null,
  };
};

// ── Refunds to the card (Part 3b, mig 530) ──────────────────────────────────────────────────────────

type RefundRow = {
  id: string; deal_id: string; payment_id: string; amount: number | string; tax_part: number | string; whole: boolean; ends_deal: boolean;
  reason: string; status: DealRefund['status']; failure_reason: string | null; refunded_on: string | null; succeeded_at: string | null;
  failed_at: string | null; created_at: string; created_by_name: string; stripe_refund_id: string | null; emailed_at: string | null; credit_seq: number | null; income_entry_id: string | null;
};
const REFUND_COLUMNS = 'id, deal_id, payment_id, amount, tax_part, whole, ends_deal, reason, status, failure_reason, refunded_on, succeeded_at, failed_at, created_at, created_by_name, stripe_refund_id, emailed_at, credit_seq, income_entry_id';
const refundOf = (r: RefundRow, invoiceNo: string | null): DealRefund => ({
  id: r.id, paymentId: r.payment_id, amount: num(r.amount), taxPart: num(r.tax_part), whole: r.whole, endsDeal: r.ends_deal, reason: r.reason,
  status: r.status, failureReason: r.failure_reason, refundedOn: r.refunded_on, succeededAt: r.succeeded_at, failedAt: r.failed_at,
  createdAt: r.created_at, createdByName: r.created_by_name, stripeRefundId: r.stripe_refund_id, emailedAt: r.emailed_at, booked: r.income_entry_id != null,
  creditNumber: r.credit_seq != null && invoiceNo ? creditNoteNumber(invoiceNo, r.credit_seq) : null,
});

/** Every refund on these deals, oldest first (a failed one stays on record: "Refund didn't reach the card"). */
async function refundsFor(orgId: string, dealIds: string[], numbers: Map<string, string | null>): Promise<Map<string, DealRefund[]>> {
  const out = new Map<string, DealRefund[]>();
  for (let i = 0; i < dealIds.length; i += 200) {
    const { data, error } = await supabaseAdmin.from('club_sponsor_deal_refunds').select(REFUND_COLUMNS)
      .eq('org_id', orgId).in('deal_id', dealIds.slice(i, i + 200)).order('created_at');
    if (error) throw error;
    for (const r of (data ?? []) as RefundRow[]) out.set(r.deal_id, [...(out.get(r.deal_id) ?? []), refundOf(r, numbers.get(r.deal_id) ?? null)]);
  }
  return out;
}

async function paymentsFor(orgId: string, dealIds: string[]): Promise<Map<string, DealPayment[]>> {
  const out = new Map<string, DealPayment[]>();
  for (let i = 0; i < dealIds.length; i += 200) {
    const { data, error } = await supabaseAdmin.from('club_sponsor_deal_payments').select(PAYMENT_COLUMNS)
      .eq('org_id', orgId).in('deal_id', dealIds.slice(i, i + 200)).order('received_on').order('recorded_at');
    if (error) throw error;
    for (const r of (data ?? []) as unknown as PaymentRow[]) out.set(r.deal_id, [...(out.get(r.deal_id) ?? []), paymentOf(r)]);
  }
  return out;
}

/** A deal's payments, voided ones included (they stay on record), in the order they arrived. */
export async function readDealPayments(orgId: string, dealId: string): Promise<DealPayment[]> {
  return (await paymentsFor(orgId, [dealId])).get(dealId) ?? [];
}

/** Every deal of the club, oldest offer first. */
export async function readDeals(orgId: string): Promise<(ClubDeal & { linkVersion: number })[]> {
  const { data, error } = await supabaseAdmin.from('club_sponsor_deals').select(DEAL_COLUMNS).eq('org_id', orgId).order('offered_at');
  if (error) throw error;
  const rows = (data ?? []) as unknown as DealRow[];
  const ids = rows.map(r => r.id);
  const [done, paid] = await Promise.all([doneFor(ids), paymentsFor(orgId, ids)]);
  return rows.map(r => dealOf(r, done.get(r.id) ?? {}, paid.get(r.id) ?? []));
}

/** One deal, with its payments (voided ones included) and its refunds — read once here, never again by a caller. */
export async function readDeal(orgId: string, id: string): Promise<(ClubDeal & { linkVersion: number; payments: DealPayment[]; refunds: DealRefund[] }) | null> {
  const { data, error } = await supabaseAdmin.from('club_sponsor_deals').select(DEAL_COLUMNS).eq('org_id', orgId).eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as unknown as DealRow;
  const number = row.invoice_seq != null && row.invoice_year != null ? invoiceNumber(row.invoice_year, row.invoice_seq) : null;
  const [done, paid, back] = await Promise.all([doneFor([id]), paymentsFor(orgId, [id]), refundsFor(orgId, [id], new Map([[id, number]]))]);
  const payments = paid.get(id) ?? [];
  return { ...dealOf(row, done.get(id) ?? {}, payments), payments, refunds: back.get(id) ?? [] };
}

/** The business's own card on the deal's page (round 1 tab 5): what its link sent, as sent. */
export interface DealBusiness {
  name: string; contactName: string | null; email: string | null; phone: string | null; website: string | null;
  address: { street: string; city: string; province: string; postal: string } | null;
  /** The logo shown: the sponsor record's public one, or a short-lived signed link to the one sent and not yet showing. */
  logoUrl: string | null;
  logoWaiting: boolean;
}

export async function readDealBusiness(orgId: string, id: string): Promise<DealBusiness | null> {
  const { data, error } = await supabaseAdmin.from('club_sponsor_deals')
    .select('business_name, contact_name, contact_email, phone, website, invoice_street, invoice_city, invoice_province, invoice_postal, logo_path, club_sponsors(name, logo_url, contact_name, contact_email, phone, link)')
    .eq('org_id', orgId).eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const r = data as unknown as {
    business_name: string | null; contact_name: string | null; contact_email: string | null; phone: string | null; website: string | null;
    invoice_street: string | null; invoice_city: string | null; invoice_province: string | null; invoice_postal: string | null; logo_path: string | null;
    club_sponsors: { name: string; logo_url: string | null; contact_name: string | null; contact_email: string | null; phone: string | null; link: string | null } | null;
  };
  const s = Array.isArray(r.club_sponsors) ? r.club_sponsors[0] : r.club_sponsors;
  let logoUrl = s?.logo_url ?? null;
  if (r.logo_path) {
    const signed = await supabaseAdmin.storage.from(CLUB_FORM_BUCKET).createSignedUrl(r.logo_path, 3600);
    logoUrl = signed.data?.signedUrl ?? logoUrl;
  }
  return {
    name: r.business_name ?? s?.name ?? '', contactName: r.contact_name ?? s?.contact_name ?? null, email: r.contact_email ?? s?.contact_email ?? null,
    phone: r.phone ?? s?.phone ?? null, website: r.website ?? s?.link ?? null,
    address: r.invoice_street && r.invoice_city && r.invoice_province && r.invoice_postal
      ? { street: r.invoice_street, city: r.invoice_city, province: r.invoice_province, postal: r.invoice_postal } : null,
    logoUrl, logoWaiting: !!r.logo_path,
  };
}

/** The offer emails a deal sent (its history and the reason it was offered for). */
export async function readDealOffers(orgId: string, dealId: string): Promise<{ email: string; reason: OfferReason; reasonOn: string; kind: 'offer' | 'again'; sentAt: string; sentByName: string }[]> {
  const { data, error } = await supabaseAdmin.from('club_sponsor_offers').select('email, reason, reason_on, kind, sent_at, sent_by_name')
    .eq('org_id', orgId).eq('deal_id', dealId).order('sent_at');
  if (error) throw error;
  return ((data ?? []) as { email: string; reason: OfferReason; reason_on: string; kind: 'offer' | 'again'; sent_at: string; sent_by_name: string }[])
    .map(r => ({ email: r.email, reason: r.reason, reasonOn: r.reason_on, kind: r.kind, sentAt: r.sent_at, sentByName: r.sent_by_name }));
}

// ── Who may be emailed an offer ────────────────────────────────────────────────────────────────────

/** The club's stops (address → source and day) and its family opt-outs (every address of an opted-out person). */
export async function readOfferBars(orgId: string): Promise<{ stops: Map<string, { source: 'unsubscribe' | 'club'; on: string }>; family: Set<string> }> {
  // ⚠ EVERY row, in a fixed order (/legal 2026-11-23): a select stops at 1,000 rows without an error, and a stop that is missed
  // here is an address emailed after it said no. `email` is unique within the club, so the paged order is stable.
  const [rows, family] = await Promise.all([
    fetchAll<{ email: string; source: 'unsubscribe' | 'club'; stopped_at: string }>((from, to) =>
      supabaseAdmin.from('club_sponsor_offer_stops').select('email, source, stopped_at').eq('org_id', orgId).order('email').range(from, to)),
    getFamilySuppressionList(orgId),
  ]);
  const stops = new Map<string, { source: 'unsubscribe' | 'club'; on: string }>();
  for (const r of rows) stops.set(r.email, { source: r.source, on: r.stopped_at });
  return { stops, family };
}

/** "Do not offer again" (ask 13): for good, per club and address; a second press finds it written. */
export async function addOfferStop(orgId: string, email: string, by: { userId: string; name: string }): Promise<void> {
  const { error } = await supabaseAdmin.from('club_sponsor_offer_stops')
    .upsert({ org_id: orgId, email: email.trim().toLowerCase(), source: 'club', stopped_by: by.userId, stopped_by_name: by.name }, { onConflict: 'org_id,email', ignoreDuplicates: true });
  if (error) throw error;
}

// ── Offering ───────────────────────────────────────────────────────────────────────────────────────

export interface NewDeal {
  sponsorId: string;
  pkg: { id: string; name: string; items: PackageItem[]; logoOnSite: boolean; placeKind: SponsorPlaceKind };
  targetId: string | null;
  targetName: string | null;
  endsOn: string | null;
  amount: number;
  chargeTax: boolean;
  offeredOn: string;
  offeredTo: string | null;
}

export async function createDeal(orgId: string, by: { userId: string; name: string }, d: NewDeal): Promise<string> {
  const { data, error } = await supabaseAdmin.from('club_sponsor_deals').insert({
    org_id: orgId, sponsor_id: d.sponsorId, package_id: d.pkg.id, package_name: d.pkg.name, package_items: d.pkg.items,
    logo_on_site: d.pkg.logoOnSite, place_kind: d.pkg.placeKind, target_id: d.targetId, target_name: d.targetName, ends_on: d.endsOn,
    amount: d.amount, charge_tax: d.chargeTax, offered_on: d.offeredOn, offered_by: by.userId, offered_by_name: by.name, offered_to: d.offeredTo,
  }).select('id').single();
  if (error) throw error;
  return (data as { id: string }).id;
}

/** A new business from the Offer window: a name and an email (ask: "They fill in the rest"). */
export async function createBareSponsor(orgId: string, userId: string, name: string, email: string | null): Promise<string> {
  const { data: last } = await supabaseAdmin.from('club_sponsors').select('position').eq('org_id', orgId).order('position', { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await supabaseAdmin.from('club_sponsors').insert({
    org_id: orgId, name, contact_email: email, position: ((last as { position: number } | null)?.position ?? 0) + 1, created_by: userId,
  }).select('id').single();
  if (error) throw error;
  return (data as { id: string }).id;
}

/** A business picked from the list that had no email on file keeps the one typed (the offer's address). */
export async function rememberSponsorEmail(orgId: string, sponsorId: string, email: string): Promise<void> {
  const { error } = await supabaseAdmin.from('club_sponsors').update({ contact_email: email, updated_at: new Date().toISOString() })
    .eq('org_id', orgId).eq('id', sponsorId).is('contact_email', null);
  if (error) throw error;
}

/** The CASL record of an offer email that went out (insert-only). */
export async function recordOfferEmail(orgId: string, dealId: string, o: {
  email: string; businessName: string; reason: OfferReason; reasonOn: string; kind: 'offer' | 'again'; by: { userId: string; name: string };
}): Promise<void> {
  const [{ error }, upd] = await Promise.all([
    supabaseAdmin.from('club_sponsor_offers').insert({
      org_id: orgId, deal_id: dealId, business_name: o.businessName, email: o.email.trim().toLowerCase(), reason: o.reason, reason_on: o.reasonOn,
      kind: o.kind, sent_by: o.by.userId, sent_by_name: o.by.name,
    }),
    supabaseAdmin.from('club_sponsor_deals').update({ emailed_at: new Date().toISOString(), offered_to: o.email.trim().toLowerCase(), updated_at: new Date().toISOString() })
      .eq('org_id', orgId).eq('id', dealId),
  ]);
  if (error) throw error;
  if (upd.error) throw upd.error;
}

/** A deal whose email never went out is removed whole (nothing was offered). */
export async function deleteUnsentDeal(orgId: string, dealId: string): Promise<void> {
  await supabaseAdmin.from('club_sponsor_deals').delete().eq('org_id', orgId).eq('id', dealId).is('emailed_at', null).eq('state', 'offered');
}

/** "Send the link again" / "Make a new link": the old link stops working (its version is no longer the deal's). */
export async function replaceDealLink(orgId: string, dealId: string): Promise<number | null> {
  const deal = await readDeal(orgId, dealId);
  if (!deal) throw new Error('replaceDealLink: no deal');
  const next = deal.linkVersion + 1;
  const { data, error } = await supabaseAdmin.from('club_sponsor_deals').update({ link_version: next, updated_at: new Date().toISOString() })
    .eq('org_id', orgId).eq('id', dealId).eq('link_version', deal.linkVersion).select('id');
  if (error) throw error;
  // null: someone else replaced it first — the caller says so rather than send a link that is already dead.
  return data?.length ? next : null;
}

/** A new link went out with nothing emailed (Make a new link, a reason that has run out): the history says so. */
export async function markLinkUnsent(orgId: string, dealId: string): Promise<void> {
  const { error } = await supabaseAdmin.from('club_sponsor_deals').update({ link_unsent_at: new Date().toISOString() }).eq('org_id', orgId).eq('id', dealId);
  if (error) throw error;
}

/** The business opened its link: the first time is kept ("opened Feb 27"). */
export async function markDealOpened(dealId: string): Promise<void> {
  await supabaseAdmin.from('club_sponsor_deals').update({ opened_at: new Date().toISOString() }).eq('id', dealId).is('opened_at', null);
}

// ── Changing a deal ────────────────────────────────────────────────────────────────────────────────

/** Where it shows and its last day — on the deal, at any state but withdrawn (ask 1: "A deal's place changes on the deal"). */
export async function changeDealPlace(orgId: string, dealId: string, p: { targetId: string | null; targetName: string | null; endsOn: string | null }): Promise<void> {
  const { error } = await supabaseAdmin.from('club_sponsor_deals')
    .update({ target_id: p.targetId, target_name: p.targetName, ends_on: p.endsOn, updated_at: new Date().toISOString() })
    .eq('org_id', orgId).eq('id', dealId).neq('state', 'withdrawn');
  if (error) throw error;
  await syncDealPlace(orgId, dealId);
}

/** The amount and the tax switch — only while the offer is open (an issued invoice's figures wait for Part 3's revision). */
export async function changeDealTerms(orgId: string, dealId: string, t: { amount: number; chargeTax: boolean }): Promise<boolean> {
  const { data, error } = await supabaseAdmin.from('club_sponsor_deals')
    .update({ amount: t.amount, charge_tax: t.chargeTax, updated_at: new Date().toISOString() })
    .eq('org_id', orgId).eq('id', dealId).in('state', ['offered', 'form_received']).select('id');
  if (error) throw error;
  return (data ?? []).length === 1;
}

// ── Money on an issued invoice (Part 3a, mig 528: one transaction each, the database's own guard behind them) ──

/** Why the database refused a payment step: not owing (SP002), a payment it can't take (SP003), money stands (SP004), a closed year. */
export type MoneyRefusal = 'not_owing' | 'refused' | 'has_payment' | 'year_closed';
/** A refusal the database meant is answered; anything else it said is a failure and throws. */
function refusalOrThrow(e: { code?: string; message?: string }): { ok: false; why: MoneyRefusal } {
  if (e.code === 'SP002') return { ok: false, why: 'not_owing' };
  if (e.code === 'SP003') return { ok: false, why: 'refused' };
  if (e.code === 'SP004') return { ok: false, why: 'has_payment' };
  if (e.message?.startsWith('year_closed')) return { ok: false, why: 'year_closed' };
  throw e;
}

/**
 * The place (and its logo) follows a money step that has ALREADY COMMITTED in the database — so a failure here is logged,
 * never thrown: the payment stands, the coach is told it was recorded, and the receipt still goes.
 */
async function syncPlaceAfterMoney(orgId: string, dealId: string): Promise<void> {
  try { await syncDealPlace(orgId, dealId); }
  catch (e) { console.error('[sponsorships] the money step committed, but the place did not sync:', dealId, (e as { code?: string })?.code ?? (e as Error)?.message ?? 'no code'); }
}

/** Record a cheque, e-transfer, cash or other payment: its two General-ledger lines, and Paid when nothing is left owing. */
export async function recordDealPayment(orgId: string, dealId: string, by: { userId: string; name: string }, p: {
  amount: number; receivedOn: string; method: DuesPaymentMethod; reference: string | null; note: string | null;
}): Promise<{ ok: true; state: DealState } | { ok: false; why: MoneyRefusal }> {
  const { data, error } = await supabaseAdmin.rpc('club_sponsor_deal_pay', {
    p_org: orgId, p_deal: dealId, p_amount: p.amount, p_on: p.receivedOn, p_method: p.method, p_reference: p.reference,
    p_note: p.note, p_actor: by.userId, p_actor_name: by.name,
  });
  if (error) return refusalOrThrow(error);
  const state = (data as { state: DealState }).state;
  if (state === 'paid') await syncPlaceAfterMoney(orgId, dealId);
  return { ok: true, state };
}

/** Void one payment, with the reason: its lines are marked void, and a paid deal is owing again. */
export async function voidDealPayment(orgId: string, paymentId: string, by: { userId: string; name: string }, reason: string): Promise<{ ok: true; dealId: string } | { ok: false; why: MoneyRefusal }> {
  const { data, error } = await supabaseAdmin.rpc('club_sponsor_deal_payment_void', {
    p_org: orgId, p_payment: paymentId, p_reason: reason, p_actor: by.userId, p_actor_name: by.name,
  });
  if (error) return refusalOrThrow(error);
  const dealId = (data as { deal_id: string }).deal_id;
  await syncPlaceAfterMoney(orgId, dealId);
  return { ok: true, dealId };
}

/** The revised invoice: the amount and tax change, the number kept, the day stamped — only while no payment stands. */
export async function reviseDealInvoice(orgId: string, dealId: string, r: {
  amount: number; chargeTax: boolean; taxKind: 'GST' | 'HST' | null; taxRate: number | null; tax: number | null; total: number; on: string;
}): Promise<{ ok: true } | { ok: false; why: MoneyRefusal }> {
  const { error } = await supabaseAdmin.rpc('club_sponsor_deal_revise', {
    p_org: orgId, p_deal: dealId, p_amount: r.amount, p_charge_tax: r.chargeTax, p_tax_kind: r.taxKind, p_tax_rate: r.taxRate,
    p_tax_amount: r.tax, p_total: r.total, p_on: r.on,
  });
  if (error) return refusalOrThrow(error);
  return { ok: true };
}

/** The invoice province a deal's link sent (the revised invoice's rate follows it, as the first one did). */
export async function readDealProvince(orgId: string, dealId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin.from('club_sponsor_deals').select('invoice_province').eq('org_id', orgId).eq('id', dealId).maybeSingle();
  if (error) throw error;
  return (data as { invoice_province: string | null } | null)?.invoice_province ?? null;
}

/** Withdraw (until paid, ask 4), with the reason and who; the place comes down and is freed. */
export async function withdrawDeal(orgId: string, dealId: string, by: { userId: string; name: string }, reason: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin.from('club_sponsor_deals').update({
    state: 'withdrawn', withdrawn_at: new Date().toISOString(), withdrawn_by: by.userId, withdrawn_by_name: by.name, withdrawn_reason: reason,
    updated_at: new Date().toISOString(),
  }).eq('org_id', orgId).eq('id', dealId).in('state', ['offered', 'form_received', 'invoiced']).select('id');
  if (error) throw error;
  if ((data ?? []).length !== 1) return false;
  await syncDealPlace(orgId, dealId);
  return true;
}

/** Tick or untick one checklist line (the logo line puts the logo up early, ask 5). */
export async function setDealItem(orgId: string, dealId: string, itemId: string, on: boolean, by: { userId: string; name: string }): Promise<void> {
  if (on) {
    const { error } = await supabaseAdmin.from('club_sponsor_deal_items')
      .upsert({ deal_id: dealId, item_id: itemId, org_id: orgId, done_by: by.userId, done_by_name: by.name }, { onConflict: 'deal_id,item_id', ignoreDuplicates: true });
    if (error) throw error;
  } else {
    const { error } = await supabaseAdmin.from('club_sponsor_deal_items').delete().eq('org_id', orgId).eq('deal_id', dealId).eq('item_id', itemId);
    if (error) throw error;
  }
  if (itemId === LOGO_ITEM) await syncDealPlace(orgId, dealId);
}

// ── The deal's place on the public site ───────────────────────────────────────────────────────────

/**
 * Make the deal's place match the deal: there when `dealPlaceUp`, gone otherwise, with the deal's kind, target and last day.
 * When it goes up and the business sent a logo, that logo is copied to the public bucket and becomes the sponsor's.
 */
export async function syncDealPlace(orgId: string, dealId: string): Promise<void> {
  const deal = await readDeal(orgId, dealId);
  if (!deal) return;
  const { data: existing, error } = await supabaseAdmin.from('club_sponsor_places').select('id').eq('org_id', orgId).eq('deal_id', dealId).maybeSingle();
  if (error) throw error;
  const up = dealPlaceUp(deal) && (deal.placeKind === 'club' || !!deal.targetId);
  if (!up) {
    if (existing) {
      const del = await supabaseAdmin.from('club_sponsor_places').delete().eq('org_id', orgId).eq('deal_id', dealId);
      if (del.error) throw del.error;
    }
    return;
  }
  const row = { kind: deal.placeKind, target_id: deal.targetId, ends_on: deal.endsOn, updated_at: new Date().toISOString() };
  const w = existing
    ? await supabaseAdmin.from('club_sponsor_places').update(row).eq('org_id', orgId).eq('deal_id', dealId)
    : await supabaseAdmin.from('club_sponsor_places').insert({ ...row, org_id: orgId, sponsor_id: deal.sponsorId, source: 'deal', deal_id: dealId });
  if (w.error) throw w.error;
  await publishDealLogo(orgId, dealId, deal.sponsorId);
}

/** The logo the business sent goes public only now (its place shows): copied to org-logos, the sponsor's logo replaced. */
async function publishDealLogo(orgId: string, dealId: string, sponsorId: string): Promise<void> {
  const { data, error } = await supabaseAdmin.from('club_sponsor_deals').select('logo_path').eq('org_id', orgId).eq('id', dealId).maybeSingle();
  if (error) throw error;
  const path = (data as { logo_path: string | null } | null)?.logo_path;
  if (!path) return;
  const file = await supabaseAdmin.storage.from(CLUB_FORM_BUCKET).download(path);
  if (file.error || !file.data) throw file.error ?? new Error('publishDealLogo: no file');
  const objectPath = sponsorLogoObjectPath(orgId, newSponsorLogoFileName());
  const up = await supabaseAdmin.storage.from(ORG_LOGO_BUCKET).upload(objectPath, Buffer.from(await file.data.arrayBuffer()), { contentType: 'image/png', upsert: false });
  if (up.error) throw up.error;
  const url = supabaseAdmin.storage.from(ORG_LOGO_BUCKET).getPublicUrl(objectPath).data.publicUrl;
  const { data: before } = await supabaseAdmin.from('club_sponsors').select('logo_url').eq('org_id', orgId).eq('id', sponsorId).maybeSingle();
  const set = await supabaseAdmin.from('club_sponsors').update({ logo_url: url, updated_at: new Date().toISOString() }).eq('org_id', orgId).eq('id', sponsorId);
  if (set.error) throw set.error;
  const clear = await supabaseAdmin.from('club_sponsor_deals').update({ logo_path: null }).eq('org_id', orgId).eq('id', dealId).eq('logo_path', path);
  if (clear.error) throw clear.error;
  await supabaseAdmin.storage.from(CLUB_FORM_BUCKET).remove([path]).catch(() => undefined);
  await removeLogoFile(orgId, (before as { logo_url: string | null } | null)?.logo_url ?? null);
}

// ── The logo sent on the link (private until the place shows) ──────────────────────────────────────

export const dealLogoPath = (orgId: string, dealId: string): string => `${orgId}/sponsorships/deals/${dealId}/logo/${randomUUID()}.png`;

/** Keep a freshly re-encoded logo on the deal; the one it replaces is deleted. A deal already showing (paid, or its logo line
 *  ticked) publishes it at once. Any state but withdrawn; a PAID deal only while it has never had one (owner call 7 at walk
 *  §562; `linkTakesLogo`) — held here in the write, so two uploads racing can't both publish. */
export async function storeDealLogo(orgId: string, dealId: string, png: Buffer): Promise<void> {
  const path = dealLogoPath(orgId, dealId);
  const up = await supabaseAdmin.storage.from(CLUB_FORM_BUCKET).upload(path, png, { contentType: 'image/png', upsert: false });
  if (up.error) throw up.error;
  const { data: before } = await supabaseAdmin.from('club_sponsor_deals').select('logo_path').eq('org_id', orgId).eq('id', dealId).maybeSingle();
  const { data: wrote, error } = await supabaseAdmin.from('club_sponsor_deals').update({ logo_path: path, logo_sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('org_id', orgId).eq('id', dealId).neq('state', 'withdrawn').or('state.neq.paid,logo_sent_at.is.null').select('id');
  // Nothing written (withdrawn, or a paid deal that already has its logo, between the door and here): the new file goes,
  // and the logo it would have replaced stays.
  if (error || !wrote?.length) {
    await supabaseAdmin.storage.from(CLUB_FORM_BUCKET).remove([path]).catch(() => undefined);
    throw error ?? new Error('club_sponsor_deal_logo_not_written');
  }
  const old = (before as { logo_path: string | null } | null)?.logo_path;
  if (old && old !== path) await supabaseAdmin.storage.from(CLUB_FORM_BUCKET).remove([old]).catch(() => undefined);
  await syncDealPlace(orgId, dealId);
}

/** Each business's contact facts the Offer window reads (its picker's grey line, its address, its province for the tax). */
export async function readSponsorContacts(orgId: string): Promise<{ id: string; name: string; contactName: string | null; email: string | null; province: string | null }[]> {
  const { data, error } = await supabaseAdmin.from('club_sponsors').select('id, name, contact_name, contact_email, invoice_province')
    .eq('org_id', orgId).order('name');
  if (error) throw error;
  return ((data ?? []) as { id: string; name: string; contact_name: string | null; contact_email: string | null; invoice_province: string | null }[])
    .map(r => ({ id: r.id, name: r.name, contactName: r.contact_name, email: r.contact_email, province: r.invoice_province }));
}

/** Does any deal hold this business? (Its offers and invoices stay on record, so it can't be removed.) */
export async function sponsorHasAnyDeal(orgId: string, sponsorId: string): Promise<boolean> {
  const { count, error } = await supabaseAdmin.from('club_sponsor_deals').select('id', { count: 'exact', head: true }).eq('org_id', orgId).eq('sponsor_id', sponsorId);
  if (error) throw error;
  return (count ?? 0) > 0;
}
