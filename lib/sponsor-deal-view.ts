import 'server-only';
/**
 * THE BUSINESS'S SPONSORSHIP PAGE — THE ONE DOOR AND WHAT THE PAGE MAY SHOW (Board Ready Stage 6 Part 2; round 1 tab 4;
 * /legal review §2). A business opens its deal's link without an account. `dealFromLinkToken` is the ONLY place a deal
 * token is read (lib/sponsor-deal-link.ts says so; a guard test holds it): the signature, then the deal's CURRENT
 * `link_version`, so "Send the link again" stops the old link. `buildSponsorPageView` reads ONE deal of ONE club and
 * hands the page only what the business may see — its package, its own details and answers, how to pay, its invoice —
 * never another deal, another business, or anything about the club's other sponsors.
 *
 *   · a link we did not sign, or for another club's address → notFound (no club, no deal named);
 *   · a replaced link, a withdrawn offer, or a place whose division/team/tournament has been removed → closed, which says
 *     only "This offer was withdrawn. Contact {club}." with the club's contact (round 1 tab 4) — no business details;
 *   · an earlier year's open offer whose place has gone back → closed, "This offer has ended." (owner 2026-11-25);
 *   · offered / form received → the form; invoiced / paid → the thank-you view: the invoice, how to pay, its PDF, and once
 *     money arrives the payments received — paid in full, the receipt (Part 3a; the paid invoice IS the receipt, ask 10).
 */
import { supabaseAdmin } from './supabase-admin';
import { getOrganizationBySlug } from './db';
import { publicClubRefusal } from './public-club-access';
import { getOrgPrivacyPolicyHref } from './privacy-policy';
import { clubPublicContact } from './club-email-context';
import { CLUB_FORM_BUCKET, signupFormView, sponsorshipFormId } from './club-form-server';
import { dealLinkFormState, type DealLinkAnswer } from './club-form-deal';
import { readPackage, readSettings } from './club-sponsorships-server';
import { markDealOpened, newerLinkEmailed, readDeal } from './club-sponsorship-deals-server';
import { dealBullets, linkTakesForm, linkTakesLogo, type DealInvoice } from './club-sponsorship-deals';
import { clubCanEmailInvoice, invoiceStanding, refundCounts, refundNoteCancelled, refundedAway } from './club-sponsor-invoice';
import { sponsorCardFacts, unrecordedCardPayment } from './sponsor-card-server';
import { cardLabel } from './online-payment-words';
import { tournamentToday } from './timezone';
import { payLinkSecret, readSponsorDealToken } from './sponsor-deal-link';
import { offerLapsedNow } from './club-sponsorship-offer-lapsed';
import type { SignupFormView } from './club-form-signup';
import type { SponsorPlaceKind } from './club-sponsorships';
import type { Organization } from './types';

// ── The one door ───────────────────────────────────────────────────────────────────────────────────

export type LinkDoor =
  | { kind: 'open'; orgId: string; dealId: string }
  /** Signed by us, but replaced since ("Send the link again"): the page says so (owner call (f), 2026-11-22). */
  | { kind: 'replaced'; orgId: string; dealId: string; linkUnsentAt: string | null }
  | null;

/** The deal a token opens, at its current version — or what is left of it. Never read a deal token anywhere else. */
export async function dealFromLinkToken(token: string): Promise<LinkDoor> {
  const secret = payLinkSecret();
  if (!secret || typeof token !== 'string') return null;
  const read = readSponsorDealToken(token, secret);
  if (!read) return null;
  const { data, error } = await supabaseAdmin.from('club_sponsor_deals').select('org_id, link_version, link_unsent_at').eq('id', read.dealId).maybeSingle();
  if (error) throw error;
  const row = data as { org_id: string; link_version: number; link_unsent_at: string | null } | null;
  if (!row) return null;
  return row.link_version === read.version ? { kind: 'open', orgId: row.org_id, dealId: read.dealId } : { kind: 'replaced', orgId: row.org_id, dealId: read.dealId, linkUnsentAt: row.link_unsent_at };
}

/** The club a door's deal belongs to, when its plan still carries Sponsorships (`publicClubRefusal`, page 'sponsorship'). */
export async function clubForDoor(orgId: string): Promise<Organization | null> {
  const { data, error } = await supabaseAdmin.from('organizations').select('slug').eq('id', orgId).maybeSingle();
  if (error) throw error;
  const slug = (data as { slug: string } | null)?.slug;
  const org = slug ? await getOrganizationBySlug(slug) : null;
  return org && !publicClubRefusal(org, 'sponsorship') ? org : null;
}

// ── What the page shows ────────────────────────────────────────────────────────────────────────────

export interface SponsorClubFace {
  name: string;
  /** The contact for sponsors (Invoice details), else the club's public contact. */
  contactEmail: string | null;
  privacyUrl: string | null;
}

export interface SponsorDealFace {
  packageName: string;
  placeKind: SponsorPlaceKind;
  placeName: string | null;
  /** "Offered to {name}". */
  offeredTo: string;
  amount: number;
  /** The tax switch as it applies: the club is registered AND the deal's switch is on. */
  taxed: boolean;
  endsOn: string | null;
  bullets: string[];
  hasDocument: boolean;
  documentSize: number | null;
}

export interface SponsorBusinessPrefill {
  name: string; contactName: string; email: string; phone: string; website: string;
  street: string; city: string; province: string; postal: string;
}

export type SponsorPageView =
  | { state: 'notFound' }
  /** `newerEmail`: a replaced link whose newer one was emailed. */
  | { state: 'closed'; club: SponsorClubFace; replaced?: true; newerEmail?: boolean; ended?: true }
  | {
    state: 'form' | 'done';
    token: string;
    today: string;
    club: SponsorClubFace;
    deal: SponsorDealFace;
    business: SponsorBusinessPrefill;
    /** The logo as it is: the sponsor's public one, or a one-hour link to the one sent and not showing yet. */
    logoUrl: string | null;
    /** The form (null when the club asks nothing more than the fixed fields). */
    form: SignupFormView | null;
    saved: { answers: DealLinkAnswer[]; tickedVersions: string[] };
    /** Sent before (a business back on its link sees its details and Change, Stage 4 ruling 20). */
    sentBefore: boolean;
    /** `emailed`: its email went (the page says "also sent to" only then). */
    invoice: (DealInvoice & { email: string | null; emailed: boolean }) | null;
    howToPay: { etransferTo: string | null; chequesPayableTo: string | null; mailingAddress: string | null };
    /** The club can email the invoice (its mailing address and a contact for sponsors): when not, the page never promises an
     *  email (owner call 4 at walk §562) — the invoice appears on the page. */
    clubCanEmail: boolean;
    /** The page offers the logo box (`linkTakesLogo`): on the receipt page only to a business that never sent one. */
    takesLogo: boolean;
    paid: boolean;
    /** The deal was refunded in full and ended (`refundedAway`): the page keeps its receipt, refund and credit note, but says the
     *  sponsorship ended instead of "Thank you" and "Paid, thank you" (/ux 390, decision 3, owner 2026-11-24). */
    refundedAway: boolean;
    /** A card payment was taken for this deal and could not be recorded on it: the page says so and takes no second payment. */
    received: boolean;
    /** What is still owing on the invoice (Part 3a); less than the total means a payment has arrived. */
    owing: number;
    paidOn: string | null;
    /** Part 3b: the card button is there only while the club takes card (absent, not broken). `sponsorPays`: the Payouts card's
     *  "Processing fee on sponsorships" says the sponsor pays it — only ever before an invoice (owner call (3)). */
    card: { sponsorPays: boolean; refundPolicy: string | null } | null;
    /** The card a paid invoice was paid with, and when ("Visa •••• 4242 · Mar 3, 2027, 2:14 p.m."). */
    paidCard: { label: string; at: string } | null;
    /** Its refunds to the card (a failed one gave nothing back and isn't listed), each with its credit note when it has one. */
    refunds: { id: string; amount: number; on: string | null; pending: boolean; creditNumber: string | null }[];
    /** A credit note the business was sent for a refund that then did not reach the card: kept, and shown as cancelled (its number is never reused). */
    cancelledNotes: { id: string; creditNumber: string }[];
  };

const clubFace = async (org: Organization, contact: string | null): Promise<SponsorClubFace> => ({
  name: org.name,
  contactEmail: contact ?? (await clubPublicContact(org.id)),
  privacyUrl: getOrgPrivacyPolicyHref(org),
});

/** Does the deal's division, team or tournament still exist? (A place that has gone is the drawn "withdrawn" line.) */
export async function targetExists(kind: SponsorPlaceKind, targetId: string | null): Promise<boolean> {
  if (kind === 'club') return true;
  if (!targetId) return false;
  const table = kind === 'division' ? 'league_divisions' : kind === 'team' ? 'league_teams' : 'tournaments';
  const { count, error } = await supabaseAdmin.from(table).select('id', { count: 'exact', head: true }).eq('id', targetId);
  if (error) throw error;
  return (count ?? 0) > 0;
}

export async function buildSponsorPageView(orgSlug: string, token: string, opts: { markOpened?: boolean } = {}): Promise<SponsorPageView> {
  const door = await dealFromLinkToken(token);
  if (!door) return { state: 'notFound' };
  const org = await getOrganizationBySlug(orgSlug);
  if (!org || org.id !== door.orgId || publicClubRefusal(org, 'sponsorship')) return { state: 'notFound' };
  const settings = await readSettings(org.id);
  const club = await clubFace(org, settings.contactEmail);
  if (door.kind === 'replaced') {
    // A failed read says the line that is true either way.
    const newerEmail = await newerLinkEmailed(org.id, door.dealId, door.linkUnsentAt).catch(() => false);
    return { state: 'closed', club, replaced: true, newerEmail };
  }

  const deal = await readDeal(org.id, door.dealId);
  // A deal refunded away (Part 3b) still shows its invoice and refund to the business that paid it, with no way to pay.
  if (!deal || (deal.state === 'withdrawn' && !refundedAway(deal))) return { state: 'closed', club };
  const open = linkTakesForm(deal);
  if (open && !(await targetExists(deal.placeKind, deal.targetId))) return { state: 'closed', club };
  // Money already taken by card and not yet recorded keeps the page open: it says the payment was received, whatever the year.
  if (await offerLapsedNow(org.id, deal) && !(await unrecordedCardPayment(org.id, deal.id).catch(() => null))) return { state: 'closed', club, ended: true };

  const [pkg, formId, biz] = await Promise.all([
    readPackage(org.id, deal.packageId),
    sponsorshipFormId(org.id),
    supabaseAdmin.from('club_sponsor_deals')
      .select('business_name, contact_name, contact_email, phone, website, invoice_street, invoice_city, invoice_province, invoice_postal, logo_path, logo_sent_at, offered_to, club_sponsors(name, logo_url, contact_name, contact_email, phone, link, invoice_street, invoice_city, invoice_province, invoice_postal)')
      .eq('org_id', org.id).eq('id', deal.id).single(),
  ]);
  if (biz.error) throw biz.error;
  type S = { name: string; logo_url: string | null; contact_name: string | null; contact_email: string | null; phone: string | null; link: string | null; invoice_street: string | null; invoice_city: string | null; invoice_province: string | null; invoice_postal: string | null };
  const b = biz.data as unknown as {
    business_name: string | null; contact_name: string | null; contact_email: string | null; phone: string | null; website: string | null;
    invoice_street: string | null; invoice_city: string | null; invoice_province: string | null; invoice_postal: string | null;
    logo_path: string | null; logo_sent_at: string | null; offered_to: string | null; club_sponsors: S | S[] | null;
  };
  const s = (Array.isArray(b.club_sponsors) ? b.club_sponsors[0] : b.club_sponsors) ?? null;
  const pick = (a: string | null | undefined, c: string | null | undefined) => (a ?? c ?? '') || '';
  const business: SponsorBusinessPrefill = {
    name: pick(b.business_name, s?.name), contactName: pick(b.contact_name, s?.contact_name),
    email: pick(b.contact_email, s?.contact_email ?? b.offered_to), phone: pick(b.phone, s?.phone), website: pick(b.website, s?.link),
    street: pick(b.invoice_street, s?.invoice_street), city: pick(b.invoice_city, s?.invoice_city),
    province: pick(b.invoice_province, s?.invoice_province), postal: pick(b.invoice_postal, s?.invoice_postal),
  };
  let logoUrl = s?.logo_url ?? null;
  if (b.logo_path) logoUrl = (await supabaseAdmin.storage.from(CLUB_FORM_BUCKET).createSignedUrl(b.logo_path, 3600)).data?.signedUrl ?? logoUrl;

  const [form, saved] = await Promise.all([
    open && formId ? signupFormView(formId) : Promise.resolve(null),
    open && formId ? dealLinkFormState(formId, deal.id) : Promise.resolve({ answers: [], tickedVersions: [] }),
  ]);
  if (open && opts.markOpened && !deal.openedAt) await markDealOpened(deal.id).catch(() => undefined);

  const placeName = deal.placeKind === 'club' ? null : deal.targetName;
  const bullets = dealBullets(deal);
  const standing = deal.invoice ? invoiceStanding(deal.invoice.total, deal.payments) : null;
  const ended = deal.state === 'withdrawn';
  // The card button: the club takes card now, and the deal can still take money (an open offer, or an invoice still owing).
  const facts = !ended && (open || (deal.state === 'invoiced' && (standing?.owing ?? 0) > 0)) ? await sponsorCardFacts(org.id).catch(() => null) : null;
  const received = !ended && deal.state !== 'paid' && !!(await unrecordedCardPayment(org.id, deal.id).catch(() => null));
  // The card named on the receipt: one still holding money; on a deal a refund ended, the one it refunded.
  const lastCard = [...deal.payments].reverse().find(x => !x.voided && (ended || !x.returned) && x.card)?.card ?? null;
  return {
    state: open ? 'form' : 'done',
    token,
    today: tournamentToday(),
    club,
    deal: {
      packageName: deal.packageName, placeKind: deal.placeKind, placeName, offeredTo: business.name || deal.businessName,
      amount: deal.amount, taxed: settings.registered && deal.chargeTax, endsOn: deal.endsOn, bullets,
      hasDocument: !!pkg?.documentPath, documentSize: pkg?.document?.size ?? null,
    },
    business,
    logoUrl,
    form: form && (form.questions.length || form.documents.length) ? form : null,
    saved,
    sentBefore: !!deal.formAt,
    invoice: deal.invoice ? { ...deal.invoice, email: b.contact_email, emailed: !!deal.invoiceEmailedAt } : null,
    howToPay: { etransferTo: settings.etransferTo, chequesPayableTo: settings.chequesPayableTo ?? org.name, mailingAddress: settings.mailingAddress },
    // club.contactEmail is the sender's reply-to (settings' contact, else the club's public one: offerContactOf).
    clubCanEmail: clubCanEmailInvoice(settings.mailingAddress, club.contactEmail),
    takesLogo: linkTakesLogo(deal, !!b.logo_sent_at, tournamentToday()),
    received,
    paid: deal.state === 'paid' || (ended && refundedAway(deal)),
    refundedAway: ended && refundedAway(deal),
    owing: ended ? 0 : standing?.owing ?? 0,
    paidOn: deal.paidOn ?? standing?.paidOn ?? null,
    card: facts && !received ? { sponsorPays: open && facts.feePayer === 'sponsor', refundPolicy: facts.refundPolicy } : null,
    paidCard: lastCard ? { label: cardLabel(lastCard.brand, lastCard.last4), at: lastCard.paidAt ?? '' } : null,
    refunds: deal.refunds.filter(refundCounts).map(r => ({ id: r.id, amount: r.amount, on: r.refundedOn, pending: r.status === 'pending', creditNumber: r.status === 'succeeded' ? r.creditNumber : null })),
    cancelledNotes: deal.refunds.filter(r => refundNoteCancelled(r) && !!r.creditNumber).map(r => ({ id: r.id, creditNumber: r.creditNumber! })),
  };
}
