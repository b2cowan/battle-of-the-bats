/**
 * THE ONE EMAIL to the person we met about a preview (Club Website Track P, Session P4; owner ruling T13, 2026-11-25;
 * drawing Tx3So1rUqL6shn7CzM93Zr, tab 8; /legal's Track P review, finding 3 and recommendation 5, word for word).
 *
 * A commercial electronic message (CASL s. 1(2)): it invites them to make the club theirs, which leads to a paid plan. So
 * its foot carries who sends it (FieldLogicHQ), our MAILING ADDRESS and a contact (support@), why they get it (they gave
 * us the address when we met), and an unsubscribe that follows the ADDRESS (it outlives the preview, s. 11(2)). It never
 * carries the claim code (T7): the code is on the card from the meeting. No forward button, no "send to a colleague", no
 * tracking (/legal: forwarding stays the person's own act).
 *
 * ⚖ IT CANNOT BE BUILT WITHOUT A MAILING ADDRESS. `previewLinkEmail` refuses (returns null) while the address is blank —
 * FIELDLOGICHQ_SELLER_MAILING_ADDRESS is '' by the owner's 2026-11-17 ruling — so no code path can send a footless email.
 * Pure: no database, no sender. The send is lib/preview-link-email-server.ts.
 */
import { WARM_EMAIL_STYLE, escText, warmEmailDocument } from './email-envelope-warm';
import { FIELDLOGICHQ_CONTACT_EMAIL } from './fieldlogichq-contact';

type PreviewLinkEmailInput = {
  club: string;
  /** The preview's full web address (https://…/{slug}) and how it reads ("fieldlogichq.ca/{slug}"). */
  url: string;
  addressText: string;
  /** "Tue, Dec 8": the meeting day the address was given. */
  meetingDay: string;
  /** "Thu, Jan 7, 2027": the removal day. */
  removalDay: string;
  mailingAddress: string;
  unsubscribeUrl: string;
};

export const PREVIEW_EMAIL_WORDS = {
  fromName: 'FieldLogicHQ',
  subject: (club: string) => `${club}: the site from our meeting`,
  thanks: (club: string, meetingDay: string) =>
    `Thank you for meeting with us on ${meetingDay}. Here is the preview we made for ${club}, to share with your board:`,
  sample: (removalDay: string) =>
    `Everything on it is a sample except the club’s name, logo and colours, which we took from your own site. It stays up until ${removalDay}. If you would rather it came down sooner, reply to this email and we will remove it.`,
  claim: 'To make it your club, use the claim code on the card from the meeting.',
  sentBy: (mailingAddress: string) => `FieldLogicHQ, ${mailingAddress}, ${FIELDLOGICHQ_CONTACT_EMAIL}.`,
  because: (club: string, meetingDay: string) =>
    `You’re receiving this one email because you gave us this address when we met about ${club} on ${meetingDay}.`,
  unsubscribe: 'Unsubscribe',
} as const;

const W = PREVIEW_EMAIL_WORDS;

/** The email's content inside our own envelope; every value escaped. */
function previewLinkEmailHtml(e: PreviewLinkEmailInput): string {
  const p = (text: string) => `<p style="${WARM_EMAIL_STYLE.paragraph}">${escText(text)}</p>`;
  const fine = (html: string, top = true) => `<p style="${WARM_EMAIL_STYLE.finePrint}${top ? 'margin-top:6px;' : ''}">${html}</p>`;
  return [
    p(W.thanks(e.club, e.meetingDay)),
    `<p style="${WARM_EMAIL_STYLE.paragraph}"><a href="${escText(e.url)}" style="${WARM_EMAIL_STYLE.textLink}">${escText(e.addressText)}</a></p>`,
    p(W.sample(e.removalDay)),
    p(W.claim),
    `<div style="${WARM_EMAIL_STYLE.footRule}">`,
    fine(escText(W.sentBy(e.mailingAddress)), false),
    fine(`${escText(W.because(e.club, e.meetingDay))} <a href="${escText(e.unsubscribeUrl)}" style="${WARM_EMAIL_STYLE.finePrintLink}">${escText(W.unsubscribe)}</a>`),
    '</div>',
  ].join('\n');
}

/** The whole email, or null when it must not exist: no mailing address, or no unsubscribe link. */
export function previewLinkEmail(e: Omit<PreviewLinkEmailInput, 'mailingAddress' | 'unsubscribeUrl'> & {
  mailingAddress: string | null | undefined;
  unsubscribeUrl: string | null | undefined;
}): { subject: string; html: string } | null {
  const mailingAddress = e.mailingAddress?.trim();
  const unsubscribeUrl = e.unsubscribeUrl?.trim();
  if (!mailingAddress || !unsubscribeUrl) return null;
  return {
    subject: W.subject(e.club),
    html: warmEmailDocument(previewLinkEmailHtml({ ...e, mailingAddress, unsubscribeUrl })),
  };
}
