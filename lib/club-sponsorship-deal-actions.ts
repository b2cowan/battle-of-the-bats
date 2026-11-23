import 'server-only';
/**
 * WHAT THE DEAL ROUTES SHARE (Board Ready Stage 6, Part 2): who is acting (a name kept as it was — /legal round 2: every
 * offer keeps who sent it), the offer email built from the DEAL as offered (so a first send and "Send the link again" say the
 * package, the price and the tax the same way), and the Offer window's refusal words. The routes have already asked
 * `requireSponsorships`.
 */
import { memberDisplayName } from './member-names';
import { gstHstRateOn } from './gst-hst-rates';
import { canonicalAppOrigin } from './app-origin';
import { sendOfferEmail } from './sponsor-offer-email';
import { clubPublicContact } from './club-email-context';
import { recordOfferEmail } from './club-sponsorship-deals-server';
import { payLinkSecret, sponsorDealUrl } from './sponsor-deal-link';
import { checklistOf, type ClubDeal, type OfferReason } from './club-sponsorship-deals';
import { DEAL_WORDS } from './club-sponsorship-deal-words';
import { SPONSORSHIPS_WORDS } from './club-sponsorships-words';
import type { AuthContextWithRole } from './api-auth';
import type { PlaceTargets, SponsorPlaceKind, SponsorshipSettings } from './club-sponsorships';

const O = DEAL_WORDS.offer;

/** The Offer window's field errors, in `parseOfferInput`'s shape. */
export const OFFER_ERRORS = {
  business: O.errBusiness, newName: O.errNewName, email: O.errEmail, pkg: O.errPkg, target: O.errTarget, amount: O.errAmount,
  lastDay: O.errLastDay, note: O.errNote, ...reasonErrors(),
};

/** A reason's errors (`parseReasonInput`): the Offer window and Email the offer say them the same way. */
export function reasonErrors() {
  return { reason: O.errReason, when: O.errWhen, whenFuture: O.errWhenFuture, whenOld: O.whenOld };
}

/** The address an offer names for questions (and replies go to): the contact for sponsors, else the club's public one. */
export async function offerContactOf(orgId: string, settings: SponsorshipSettings): Promise<string | null> {
  return settings.contactEmail ?? (await clubPublicContact(orgId));
}

/**
 * The CASL record of an email that already went (/legal finding 2): the burden of proof is the sender's, so a failed
 * write is tried once more and then logged with the deal, never left to fail the request after the email is out.
 */
export async function recordOfferSafely(...args: Parameters<typeof recordOfferEmail>): Promise<void> {
  try { await recordOfferEmail(...args); return; } catch { /* once more below */ }
  try { await recordOfferEmail(...args); } catch (e) {
    console.error('[sponsorships] the offer record was not written after the email went:', args[1], (e as { code?: string })?.code ?? 'no code');
  }
}

/** The person acting, by the name the club knows them by (kept on the record as it was). */
export async function actorOf(ctx: AuthContextWithRole): Promise<{ userId: string; name: string }> {
  const name = (await memberDisplayName(ctx.org.id, ctx.user.id)) ?? ctx.user.email ?? 'A club member';
  return { userId: ctx.user.id, name: name.slice(0, 120) };
}

/** The origin every emailed link carries (the unsubscribe links' own). */
export const appOrigin = canonicalAppOrigin;

/** The place a deal picked, checked against this club's own live divisions, teams and tournaments of the package's kind. */
export function findTarget(targets: PlaceTargets, kind: SponsorPlaceKind, id: string | null): { id: string | null; name: string | null } | null {
  if (kind === 'club') return id ? null : { id: null, name: null };
  if (!id) return null;
  const list = kind === 'division' ? targets.divisions : kind === 'team' ? targets.teams : targets.tournaments;
  const hit = list.find(x => x.id === id && x.live);
  return hit ? { id: hit.id, name: hit.name } : null;
}

/** The deal's link at its current version, or null when this environment has no link secret. */
export const dealLinkUrl = (orgSlug: string, dealId: string, version: number): string | null =>
  sponsorDealUrl(appOrigin(), { orgSlug, dealId, version }, payLinkSecret());

/** "U9 division", "U11 Lions", "Spring Classic 2027", or null for the club — how the deal's place reads on the club side. */
export function dealPlaceLabel(d: Pick<ClubDeal, 'placeKind' | 'targetName'>): string | null {
  if (d.placeKind === 'club') return null;
  if (!d.targetName) return null;
  return d.placeKind === 'division' ? `${d.targetName} division` : d.targetName;
}

/**
 * Send (or send again) one deal's offer. The tax word in the price line is the business's province's, when the club is
 * registered and the deal charges it; a province not yet known says "plus GST/HST" (the business's page and its invoice say
 * the rate once its address is in), so the price is never shown without the tax it will carry.
 */
export async function emailDealOffer(input: {
  orgId: string; orgSlug: string; deal: ClubDeal & { linkVersion: number }; to: string; reason: OfferReason; note: string | null;
  settings: SponsorshipSettings; contactEmail: string; province: string | null; today: string;
}): Promise<void> {
  const { deal, settings } = input;
  const url = dealLinkUrl(input.orgSlug, deal.id, deal.linkVersion);
  if (!url) throw new Error('no link secret');
  const rate = settings.registered && deal.chargeTax ? gstHstRateOn(input.province, input.today) : null;
  const items = checklistOf(deal).map(l => (l.logo ? SPONSORSHIPS_WORDS.pkg.logoRead[deal.placeKind] : l.text ?? '')).filter(Boolean);
  await sendOfferEmail({
    orgId: input.orgId, to: input.to, mailingAddress: settings.mailingAddress ?? '', note: input.note,
    packageName: deal.packageName, placeName: deal.placeKind === 'club' ? null : deal.targetName, amount: deal.amount,
    taxKind: rate?.kind ?? (settings.registered && deal.chargeTax ? 'GST/HST' : null), endsOn: deal.endsOn, items, url, reason: input.reason,
    contactName: settings.contactEmail ? settings.contactName : null, contactEmail: input.contactEmail,
  });
}
