import 'server-only';
/**
 * THE ONE WAY AN OFFER EMAIL GOES OUT (Board Ready Stage 6, Part 4a; drawing fact F6, /legal 2026-11-25 must-fixes 2–4). Before
 * Part 4a the Offer window, Email the offer and Send the link again each checked the stops, the address and the contact on
 * their own. Now each single send asks `offerSendCheck` (every bar, read at the press); the batch asks `offerClubCheck` and
 * takes each row's address bar from the rows it reads at that press (`againRows`). Every send goes only through `sendOffer` (the
 * email, then its CASL record — one message, one address, one record) or `offerNewDeal` (make the deal, send, and remove the
 * deal whole if the email didn't go). A guard test holds that nothing else calls `sendOfferEmail` or `emailDealOffer`.
 */
import { gstHstRateOn } from './gst-hst-rates';
import { sendOfferEmail } from './sponsor-offer-email';
import { payLinkSecret } from './sponsor-deal-link';
import { createDeal, deleteUnsentDeal, readDeal, readOfferBars, readStandingPaidOn, sponsorHasPayment, type DealOfferRead, type NewDeal } from './club-sponsorship-deals-server';
import { dealLinkUrl, offerContactOf, recordOfferSafely } from './club-sponsorship-deal-actions';
import { checklistOf, emailBarFor, linkTakesForm, reasonHolds, type ClubDeal, type OfferReason } from './club-sponsorship-deals';
import { DEAL_WORDS } from './club-sponsorship-deal-words';
import { SPONSORSHIPS_WORDS } from './club-sponsorships-words';
import type { SponsorshipSettings } from './club-sponsorships';

const O = DEAL_WORDS.offer;

export interface OfferBlock { error: string; status: number; code: string }

/**
 * Every bar ONE offer email waits on, read at the press: the club's own three (`offerClubCheck`: its mailing address, a
 * contact for questions, the link secret), then the business's address and a stop or family opt-out on it. The batch asks the
 * club's three once and reads each row's address and bars with the rows, at the press (`againRows`).
 */
export async function offerSendCheck(input: {
  orgId: string; settings: SponsorshipSettings; to: string | null; sponsorId?: string | null;
}): Promise<{ ok: true; to: string; contactEmail: string } | { ok: false; block: OfferBlock }> {
  const club = await offerClubCheck(input.orgId, input.settings);
  if (!club.ok) return club;
  const { contactEmail } = club;
  if (!input.to) return { ok: false, block: { error: O.errEmail, status: 400, code: 'no_email' } };
  const bars = await readOfferBars(input.orgId, input.sponsorId ? { sponsorId: input.sponsorId, email: input.to } : undefined);
  const bar = emailBarFor(input.to, bars.stops, bars.family);
  if (bar) return { ok: false, block: { error: bar.kind === 'do_not_offer' ? O.errBarredStop : O.errBarred, status: 409, code: bar.kind } };
  return { ok: true, to: input.to, contactEmail };
}

/**
 * WHAT "SEND THE LINK AGAIN" WILL DO, read once for the page and the press (Board Ready Stage 6 fixes, B-2; owner
 * 2026-11-25), so the button and its confirm never promise an email the press won't send. A new link is always made; it is
 * emailed only when the deal was offered by email, still takes the business's details (an invoiced or paid deal is emailed
 * nothing), its reason still holds today, and every send rule passes. Only a send that fails can't be known beforehand.
 */
export type AgainPlan =
  | { emails: true; first: DealOfferRead; to: string; contactEmail: string }
  /** `link_only`: never emailed. `not_due`: invoiced or paid. `ran_out`: the reason. `not_emailed`: a send rule (`error`: its words). */
  | { emails: false; outcome: 'link_only' | 'not_due' | 'ran_out' | 'not_emailed'; error?: string };

export async function againPlan(input: {
  orgId: string; settings: SponsorshipSettings; deal: ClubDeal; offers: DealOfferRead[]; businessEmail: string | null; today: string;
}): Promise<AgainPlan> {
  const { deal, offers, today } = input;
  const first = offers.find(o => o.kind === 'offer') ?? offers[0] ?? null;
  if (!first) return { emails: false, outcome: 'link_only' };
  // The deal's state first: an invoiced or paid deal is emailed nothing, however old its reason is.
  if (!linkTakesForm(deal)) return { emails: false, outcome: 'not_due' };
  if (!reasonHolds(first.reason, first.reasonOn, today)) return { emails: false, outcome: 'ran_out' };
  const check = await offerSendCheck({ orgId: input.orgId, settings: input.settings, to: deal.offeredTo ?? input.businessEmail, sponsorId: deal.sponsorId });
  if (!check.ok) return { emails: false, outcome: 'not_emailed' };
  // A first reason of "They paid us" is read against the payments as they stand today (owner 2026-11-25).
  const refusal = first.reason === 'paid_recently' ? await paidReasonRefusal(input.orgId, deal.sponsorId, first.reasonOn, today) : null;
  if (refusal) return { emails: false, outcome: 'not_emailed', error: refusal };
  return { emails: true, first, to: check.to, contactEmail: check.contactEmail };
}

/**
 * "They paid us in the last 2 years" for a business the club already has (/legal 2026-11-25; owner the same day), on every
 * single send: with a payment that stands, no later day than its latest; with payments on record and none standing (refunded,
 * disputed), not this reason; with no payment on record at all, the typed day as before. The refusal, or null.
 */
export async function paidReasonRefusal(orgId: string, sponsorId: string, reasonOn: string, today: string): Promise<string | null> {
  const on = (await readStandingPaidOn(orgId, today)).get(sponsorId) ?? null;
  if (on) return reasonOn > on ? DEAL_WORDS.again.errPaidLater(on) : null;
  return (await sponsorHasPayment(orgId, sponsorId)) ? O.errNoStanding : null;
}

/** The club's half of the bars (its mailing address, a contact, the link secret): nothing at all can be sent without them. */
export async function offerClubCheck(orgId: string, settings: SponsorshipSettings): Promise<{ ok: true; contactEmail: string } | { ok: false; block: OfferBlock }> {
  if (!settings.mailingAddress) return { ok: false, block: { error: O.needsAddress, status: 409, code: 'no_mailing_address' } };
  const contactEmail = await offerContactOf(orgId, settings);
  if (!contactEmail) return { ok: false, block: { error: O.needsContact, status: 409, code: 'no_contact' } };
  if (!payLinkSecret()) return { ok: false, block: { error: O.noSecret, status: 503, code: 'no_secret' } };
  return { ok: true, contactEmail };
}

/**
 * Send (or send again) one deal's offer, then write its CASL record. The tax word in the price line is the business's
 * province's, when the club is registered and the deal charges it; a province not yet known says "plus GST/HST". Throws when
 * the email surely didn't go (nothing is recorded); otherwise the record is written, retried once (`recordOfferSafely`),
 * and the answer says whether the mail service confirmed it.
 */
export async function sendOffer(input: {
  orgId: string; orgSlug: string; deal: ClubDeal & { linkVersion: number }; to: string; reason: OfferReason; reasonOn: string;
  note: string | null; settings: SponsorshipSettings; contactEmail: string; province: string | null; today: string;
  kind: 'offer' | 'again'; by: { userId: string; name: string };
}): Promise<'sent' | 'unconfirmed'> {
  const { deal, settings } = input;
  const url = dealLinkUrl(input.orgSlug, deal.id, deal.linkVersion);
  if (!url) throw new Error('no link secret');
  const rate = settings.registered && deal.chargeTax ? gstHstRateOn(input.province, input.today) : null;
  const items = checklistOf(deal).map(l => (l.logo ? SPONSORSHIPS_WORDS.pkg.logoRead[deal.placeKind] : l.text ?? '')).filter(Boolean);
  const delivery = await sendOfferEmail({
    orgId: input.orgId, to: input.to, mailingAddress: settings.mailingAddress ?? '', note: input.note,
    packageName: deal.packageName, placeName: deal.placeKind === 'club' ? null : deal.targetName, amount: deal.amount,
    taxKind: rate?.kind ?? (settings.registered && deal.chargeTax ? 'GST/HST' : null), endsOn: deal.endsOn, items, url, reason: input.reason,
    contactName: settings.contactEmail ? settings.contactName : null, contactEmail: input.contactEmail,
  });
  await recordOfferSafely(input.orgId, deal.id, {
    email: input.to, businessName: deal.businessName, reason: input.reason, reasonOn: input.reasonOn, kind: input.kind, by: input.by,
  });
  return delivery;
}

/** Make a deal and email it; an email that surely didn't go removes the deal whole (nothing was offered — ruling 10A). */
export async function offerNewDeal(input: {
  orgId: string; orgSlug: string; by: { userId: string; name: string }; deal: NewDeal; to: string; reason: OfferReason; reasonOn: string;
  note: string | null; settings: SponsorshipSettings; contactEmail: string; province: string | null; today: string;
}): Promise<{ ok: true; dealId: string; unconfirmed: boolean } | { ok: false; block: OfferBlock; cause: unknown }> {
  const dealId = await createDeal(input.orgId, input.by, input.deal);
  try {
    const deal = await readDeal(input.orgId, dealId);
    if (!deal) throw new Error('the new deal could not be read back');
    const delivery = await sendOffer({
      orgId: input.orgId, orgSlug: input.orgSlug, deal, to: input.to, reason: input.reason, reasonOn: input.reasonOn, note: input.note,
      settings: input.settings, contactEmail: input.contactEmail, province: input.province, today: input.today, kind: 'offer',
      by: input.by,
    });
    return { ok: true, dealId, unconfirmed: delivery === 'unconfirmed' };
  } catch (e) {
    await deleteUnsentDeal(input.orgId, dealId).catch(err => console.error('[sponsorships] an unsent deal was not removed:', dealId, (err as { code?: string })?.code ?? 'no code'));
    return { ok: false, block: { error: O.errEmailFailed, status: 502, code: 'email_failed' }, cause: e };
  }
}
