import 'server-only';
/**
 * THE SPONSORSHIP OFFER EMAIL (Board Ready Stage 6, Part 2; round 1 tab 3, ask 13, /legal review §1; round 2 ask 8).
 *
 * Its OWN sender, never Communications (whose words forbid promotion, lib/club-group-email-words.ts) and never
 * lib/email-sender.ts (FieldLogicHQ's own marketing). Sent in the club's name ("{Club} via FieldLogicHQ"), replies to the
 * club's contact for sponsors (else its public contact). The club's note opens it; the rest is written for the club and
 * can't be edited, so the package, the price and the tax are said once, the same way on the email, the link and the invoice.
 *
 * The foot (CASL s.6(2), SOR/2012-36): why they get it (the reason picked), "Sent by {club}, {mailing address}." (the club's
 * address alone, round 2 ask 8), the unsubscribe for that club's sponsorship offers only (with the one-click headers), and
 * the envelope's own "Sent through FieldLogicHQ, the software {club} uses." It REFUSES to build without a mailing address
 * or without a signed unsubscribe link: no foot, no email.
 */
import { sendEmail } from './email';
import { familySenderName } from './email-club-identity';
import { clubEmailFacts, readClubEmailOrg } from './club-email-context';
import { WARM_EMAIL_STYLE, escText, warmEmailButton, warmEmailDocument } from './email-envelope-warm';
import { buildSponsorUnsubscribeUrl, oneClickUnsubscribeHeaders } from './unsubscribe-token';
import { DEAL_WORDS } from './club-sponsorship-deal-words';
import type { OfferReason } from './club-sponsorship-deals';

const M = DEAL_WORDS.email;

export interface OfferEmail {
  club: string;
  mailingAddress: string;
  note: string | null;
  packageName: string;
  placeName: string | null;
  amount: number;
  /** 'GST/HST' while the business's province isn't known yet. */
  taxKind: 'GST' | 'HST' | 'GST/HST' | null;
  endsOn: string | null;
  /** The package's deliverables as offered (the logo line first when it is on). */
  items: string[];
  url: string;
  unsubscribeUrl: string;
  reason: OfferReason;
  contactName: string | null;
  /** The club's contact for sponsors (else its public contact): required, printed and the Reply-To. */
  contactEmail: string;
}

/** The email's content, inside the club's envelope. Plain words from the words module; every value escaped. */
export function offerEmailHtml(e: OfferEmail): string {
  const p = (text: string, style: string = WARM_EMAIL_STYLE.paragraph) => `<p style="${style}">${escText(text)}</p>`;
  const fine = (html: string, top = true) => `<p style="${WARM_EMAIL_STYLE.finePrint}${top ? 'margin-top:6px;' : ''}">${html}</p>`;
  return [
    e.note ? p(e.note) : '',
    `<p style="${WARM_EMAIL_STYLE.paragraph}"><strong>${escText(M.title(e.packageName, e.placeName))}</strong><br>${escText(M.price(e.amount, e.taxKind, e.endsOn))}</p>`,
    M.includes(e.items) ? p(M.includes(e.items)) : '',
    p(M.linkLine),
    warmEmailButton(escText(M.button), escText(e.url)),
    p(M.questions(e.contactName, e.contactEmail), WARM_EMAIL_STYLE.small),
    `<div style="${WARM_EMAIL_STYLE.footRule}">`,
    fine(escText(M.because[e.reason](e.club)), false),
    fine(escText(M.sentBy(e.club, e.mailingAddress))),
    fine(`${escText(M.unsubscribe(e.club))} <a href="${escText(e.unsubscribeUrl)}" style="${WARM_EMAIL_STYLE.finePrintLink}">${escText(M.unsubscribeLink)}</a>`),
    '</div>',
  ].join('\n');
}

export class OfferEmailRefused extends Error {}

/**
 * Send one offer. The caller has already refused a stopped or family-opted-out address and checked the mailing address;
 * this refuses again where it must (no address, no unsubscribe link), so no code path can send a footless offer.
 */
export async function sendOfferEmail(input: Omit<OfferEmail, 'club' | 'unsubscribeUrl'> & { orgId: string; to: string }): Promise<void> {
  if (!input.mailingAddress?.trim()) throw new OfferEmailRefused('no mailing address');
  if (!input.contactEmail?.trim()) throw new OfferEmailRefused('no contact email');
  const to = input.to.trim().toLowerCase();
  const unsubscribeUrl = buildSponsorUnsubscribeUrl(input.orgId, to);
  if (!unsubscribeUrl) throw new OfferEmailRefused('no unsubscribe link can be signed (UNSUBSCRIBE_SECRET)');
  const org = await readClubEmailOrg(input.orgId);
  const facts = await clubEmailFacts(org);
  const html = warmEmailDocument(offerEmailHtml({ ...input, club: org.name, mailingAddress: input.mailingAddress.trim(), unsubscribeUrl }), facts);
  const result = await sendEmail(to, M.subject(org.name, input.packageName), html, {
    kind: 'club_sponsorship_offer',
    fromName: familySenderName(org.name),
    replyTo: input.contactEmail,
    orgId: input.orgId,
    headers: oneClickUnsubscribeHeaders(unsubscribeUrl),
  });
  if (result.status !== 'sent' && result.status !== 'skipped') throw new Error(`the send answered ${result.status}`);
}
