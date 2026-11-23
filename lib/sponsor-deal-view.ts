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
 *   · offered / form received → the form; invoiced / paid → the thank-you view (the receipt is Part 3).
 */
import { supabaseAdmin } from './supabase-admin';
import { getOrganizationBySlug } from './db';
import { publicClubRefusal } from './public-club-access';
import { getOrgPrivacyPolicyHref } from './privacy-policy';
import { clubPublicContact } from './club-email-context';
import { CLUB_FORM_BUCKET, signupFormView, sponsorshipFormId } from './club-form-server';
import { dealLinkFormState, type DealLinkAnswer } from './club-form-deal';
import { readPackage, readSettings } from './club-sponsorships-server';
import { markDealOpened, readDeal } from './club-sponsorship-deals-server';
import { linkTakesForm, type DealInvoice } from './club-sponsorship-deals';
import { tournamentToday } from './timezone';
import { payLinkSecret, readSponsorDealToken } from './sponsor-deal-link';
import { SPONSOR_LINK_WORDS as L } from './sponsor-link-words';
import type { SignupFormView } from './club-form-signup';
import type { SponsorPlaceKind } from './club-sponsorships';
import type { Organization } from './types';

// ── The one door ───────────────────────────────────────────────────────────────────────────────────

export type LinkDoor =
  | { kind: 'open'; orgId: string; dealId: string }
  /** Signed by us, but replaced since ("Send the link again"): the page says so (owner call (f), 2026-11-22). */
  | { kind: 'replaced'; orgId: string }
  | null;

/** The deal a token opens, at its current version — or what is left of it. Never read a deal token anywhere else. */
export async function dealFromLinkToken(token: string): Promise<LinkDoor> {
  const secret = payLinkSecret();
  if (!secret || typeof token !== 'string') return null;
  const read = readSponsorDealToken(token, secret);
  if (!read) return null;
  const { data, error } = await supabaseAdmin.from('club_sponsor_deals').select('org_id, link_version').eq('id', read.dealId).maybeSingle();
  if (error) throw error;
  const row = data as { org_id: string; link_version: number } | null;
  if (!row) return null;
  return row.link_version === read.version ? { kind: 'open', orgId: row.org_id, dealId: read.dealId } : { kind: 'replaced', orgId: row.org_id };
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
  | { state: 'closed'; club: SponsorClubFace; replaced?: true }
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
    invoice: (DealInvoice & { email: string | null }) | null;
    howToPay: { etransferTo: string | null; chequesPayableTo: string | null; mailingAddress: string | null };
    paid: boolean;
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
  if (door.kind === 'replaced') return { state: 'closed', club, replaced: true };

  const deal = await readDeal(org.id, door.dealId);
  if (!deal || deal.state === 'withdrawn') return { state: 'closed', club };
  const open = linkTakesForm(deal);
  if (open && !(await targetExists(deal.placeKind, deal.targetId))) return { state: 'closed', club };

  const [pkg, formId, biz] = await Promise.all([
    readPackage(org.id, deal.packageId),
    sponsorshipFormId(org.id),
    supabaseAdmin.from('club_sponsor_deals')
      .select('business_name, contact_name, contact_email, phone, website, invoice_street, invoice_city, invoice_province, invoice_postal, logo_path, offered_to, club_sponsors(name, logo_url, contact_name, contact_email, phone, link, invoice_street, invoice_city, invoice_province, invoice_postal)')
      .eq('org_id', org.id).eq('id', deal.id).single(),
  ]);
  if (biz.error) throw biz.error;
  type S = { name: string; logo_url: string | null; contact_name: string | null; contact_email: string | null; phone: string | null; link: string | null; invoice_street: string | null; invoice_city: string | null; invoice_province: string | null; invoice_postal: string | null };
  const b = biz.data as unknown as {
    business_name: string | null; contact_name: string | null; contact_email: string | null; phone: string | null; website: string | null;
    invoice_street: string | null; invoice_city: string | null; invoice_province: string | null; invoice_postal: string | null;
    logo_path: string | null; offered_to: string | null; club_sponsors: S | S[] | null;
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
  const bullets = [
    ...(deal.logoOnSite ? [L.logoBullet(deal.placeKind, placeName)] : []),
    ...deal.items.map(i => i.text),
  ];
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
    invoice: deal.invoice ? { ...deal.invoice, email: b.contact_email } : null,
    howToPay: { etransferTo: settings.etransferTo, chequesPayableTo: settings.chequesPayableTo ?? org.name, mailingAddress: settings.mailingAddress },
    paid: deal.state === 'paid',
  };
}
