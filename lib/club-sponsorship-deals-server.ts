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

// ── Reading deals ──────────────────────────────────────────────────────────────────────────────────

type DealRow = {
  id: string; sponsor_id: string; package_id: string; package_name: string; package_items: PackageItem[]; logo_on_site: boolean;
  place_kind: SponsorPlaceKind; target_id: string | null; target_name: string | null; ends_on: string | null; amount: number | string;
  charge_tax: boolean; state: DealState; link_version: number; offered_on: string; offered_at: string; offered_by_name: string;
  offered_to: string | null; emailed_at: string | null; opened_at: string | null; link_unsent_at: string | null; form_at: string | null; business_name: string | null;
  invoice_year: number | null; invoice_seq: number | null; invoiced_on: string | null; due_on: string | null; tax_kind: 'GST' | 'HST' | null;
  tax_rate: number | string | null; tax_amount: number | string | null; total: number | string | null; withdrawn_at: string | null;
  withdrawn_by_name: string | null; withdrawn_reason: string | null;
  club_sponsors: { name: string } | { name: string }[] | null;
};
const DEAL_COLUMNS = [
  'id', 'sponsor_id', 'package_id', 'package_name', 'package_items', 'logo_on_site', 'place_kind', 'target_id', 'target_name', 'ends_on',
  'amount', 'charge_tax', 'state', 'link_version', 'offered_on', 'offered_at', 'offered_by_name', 'offered_to', 'emailed_at', 'opened_at', 'link_unsent_at',
  'form_at', 'business_name', 'invoice_year', 'invoice_seq', 'invoiced_on', 'due_on', 'tax_kind', 'tax_rate', 'tax_amount', 'total',
  'withdrawn_at', 'withdrawn_by_name', 'withdrawn_reason', 'club_sponsors(name)',
].join(', ');

const num = (v: number | string | null): number => (v == null ? 0 : Number(v));

function dealOf(r: DealRow, done: ClubDeal['done']): ClubDeal & { linkVersion: number } {
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
      }
      : null,
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

/** Every deal of the club, oldest offer first. */
export async function readDeals(orgId: string): Promise<(ClubDeal & { linkVersion: number })[]> {
  const { data, error } = await supabaseAdmin.from('club_sponsor_deals').select(DEAL_COLUMNS).eq('org_id', orgId).order('offered_at');
  if (error) throw error;
  const rows = (data ?? []) as unknown as DealRow[];
  const done = await doneFor(rows.map(r => r.id));
  return rows.map(r => dealOf(r, done.get(r.id) ?? {}));
}

export async function readDeal(orgId: string, id: string): Promise<(ClubDeal & { linkVersion: number }) | null> {
  const { data, error } = await supabaseAdmin.from('club_sponsor_deals').select(DEAL_COLUMNS).eq('org_id', orgId).eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const done = await doneFor([id]);
  return dealOf(data as unknown as DealRow, done.get(id) ?? {});
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

/** Keep a freshly re-encoded logo on the deal; the one it replaces is deleted. A deal already showing publishes it at once. */
export async function storeDealLogo(orgId: string, dealId: string, png: Buffer): Promise<void> {
  const path = dealLogoPath(orgId, dealId);
  const up = await supabaseAdmin.storage.from(CLUB_FORM_BUCKET).upload(path, png, { contentType: 'image/png', upsert: false });
  if (up.error) throw up.error;
  const { data: before } = await supabaseAdmin.from('club_sponsor_deals').select('logo_path').eq('org_id', orgId).eq('id', dealId).maybeSingle();
  const { error } = await supabaseAdmin.from('club_sponsor_deals').update({ logo_path: path, logo_sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('org_id', orgId).eq('id', dealId).in('state', ['offered', 'form_received', 'invoiced']);
  if (error) {
    await supabaseAdmin.storage.from(CLUB_FORM_BUCKET).remove([path]).catch(() => undefined);
    throw error;
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
