import 'server-only';
/**
 * THE INVOICE AND RECEIPT EMAILS (Board Ready Stage 6 Part 3a; owner call (2) 2026-11-23: a link, no attachment). Three
 * moments, one sender: the invoice when it is issued, a revised invoice when its amount or tax changes, and "Paid in full"
 * when the last payment arrives (the paid invoice is the receipt, ask 10). Each states the number, the amount and (unpaid)
 * the due day and how to pay, and its button opens the business's own page, where the PDF downloads.
 *
 * ⚖ NOT an offer (/legal review: "an invoice or receipt for a live deal still goes (not a CEM)"): the sponsorship stop list
 * and a family opt-out don't hold it, and it carries no unsubscribe. It still says who sent it — "Sent by {club},
 * {address}." — and replies go to the club's contact for sponsors. Never Communications, never lib/email-sender.ts.
 *
 * It never fails the step that called it: the money or the invoice is already recorded, and the business's page shows it
 * either way. A send that went is stamped on the deal (the history's "invoice emailed"); one that didn't is logged.
 */
import { sendEmail } from './email';
import { familySenderName } from './email-club-identity';
import { clubEmailFacts, readClubEmailOrg } from './club-email-context';
import { WARM_EMAIL_STYLE, escText, warmEmailButton, warmEmailDocument } from './email-envelope-warm';
import { supabaseAdmin } from './supabase-admin';
import { readSettings } from './club-sponsorships-server';
import { readDeal, readDealBusiness } from './club-sponsorship-deals-server';
import { dealLinkUrl, offerContactOf } from './club-sponsorship-deal-actions';
import { invoiceStanding } from './club-sponsor-invoice';
import { DEAL_WORDS } from './club-sponsorship-deal-words';

const E = DEAL_WORDS.invoiceEmail;

export type InvoiceMoment = 'issued' | 'revised' | 'paid';

/** The email's content, inside the club's envelope. Plain words from the words module; every value escaped. */
export function invoiceEmailHtml(e: {
  moment: InvoiceMoment; club: string; business: string; number: string; total: number; dueOn: string; paidOn: string | null;
  etransferTo: string | null; chequesPayableTo: string; mailingAddress: string; url: string; contactName: string | null; contactEmail: string;
}): string {
  const p = (text: string, style: string = WARM_EMAIL_STYLE.paragraph) => `<p style="${style}">${escText(text)}</p>`;
  const paid = e.moment === 'paid';
  const how = paid ? [] : [
    e.etransferTo ? DEAL_WORDS.page.byEtransfer(e.etransferTo) : null,
    DEAL_WORDS.page.byCheque(e.chequesPayableTo, e.mailingAddress),
    DEAL_WORDS.page.quote(e.number),
  ].filter((s): s is string => !!s);
  return [
    p(E.greeting(e.business)),
    p(paid ? E.paidLine(e.club, e.total, e.number, e.paidOn ?? '') : e.moment === 'revised' ? E.revisedLine(e.number, e.total, e.dueOn) : E.issuedLine(e.club, e.number, e.total, e.dueOn)),
    how.length ? `<p style="${WARM_EMAIL_STYLE.paragraph}"><strong>${escText(DEAL_WORDS.page.howToPay)}</strong><br>${how.map(escText).join('<br>')}</p>` : '',
    warmEmailButton(escText(paid ? E.buttonReceipt : E.buttonInvoice), escText(e.url)),
    p(DEAL_WORDS.email.questions(e.contactName, e.contactEmail), WARM_EMAIL_STYLE.small),
    `<div style="${WARM_EMAIL_STYLE.footRule}">`,
    `<p style="${WARM_EMAIL_STYLE.finePrint}">${escText(DEAL_WORDS.email.sentBy(e.club, e.mailingAddress))}</p>`,
    '</div>',
  ].join('\n');
}

/**
 * Email the deal's invoice (issued or revised) or its receipt (paid in full) to the address its link sent. Never throws;
 * answers whether it went.
 */
export async function emailDealInvoice(orgId: string, orgSlug: string, dealId: string, moment: InvoiceMoment): Promise<boolean> {
  try {
    const [deal, business, settings, org] = await Promise.all([readDeal(orgId, dealId), readDealBusiness(orgId, dealId), readSettings(orgId), readClubEmailOrg(orgId)]);
    const to = business?.email?.trim().toLowerCase();
    if (!deal?.invoice || !to || !settings.mailingAddress?.trim()) {
      console.warn('[sponsorships] the invoice email was not sent — the deal has no invoice, or the business has no address, or the club has no mailing address:', dealId, moment);
      return false;
    }
    const contactEmail = await offerContactOf(orgId, settings);
    const url = dealLinkUrl(orgSlug, deal.id, deal.linkVersion);
    if (!contactEmail || !url) {
      console.warn('[sponsorships] the invoice email was not sent — the club has no sponsorship contact email, or the deal has no link:', dealId, moment);
      return false;
    }
    const standing = moment === 'paid' ? invoiceStanding(deal.invoice.total, deal.payments) : null;
    if (moment === 'paid' && !standing?.paidInFull) return false;
    const facts = await clubEmailFacts(org);
    const html = warmEmailDocument(invoiceEmailHtml({
      moment, club: org.name, business: business?.contactName || business?.name || deal.businessName, number: deal.invoice.number,
      total: deal.invoice.total, dueOn: deal.invoice.dueOn, paidOn: standing?.paidOn ?? null, etransferTo: settings.etransferTo,
      chequesPayableTo: settings.chequesPayableTo ?? org.name, mailingAddress: settings.mailingAddress.trim(), url,
      contactName: settings.contactEmail ? settings.contactName : null, contactEmail,
    }), facts);
    const subject = moment === 'paid' ? E.subjectPaid(deal.invoice.number, org.name) : moment === 'revised' ? E.subjectRevised(deal.invoice.number, org.name) : E.subject(deal.invoice.number, org.name);
    const result = await sendEmail(to, subject, html, {
      kind: moment === 'paid' ? 'club_sponsorship_receipt' : 'club_sponsorship_invoice',
      fromName: familySenderName(org.name),
      replyTo: contactEmail,
      orgId,
    });
    if (result.status !== 'sent') return false;
    const stamp = moment === 'paid' ? { receipt_emailed_at: new Date().toISOString() } : { invoice_emailed_at: new Date().toISOString() };
    const { error } = await supabaseAdmin.from('club_sponsor_deals').update(stamp).eq('org_id', orgId).eq('id', dealId);
    if (error) console.error('[sponsorships] the invoice email went, but its stamp was not written:', dealId, error.code ?? 'no code');
    return true;
  } catch (e) {
    console.error('[sponsorships] the invoice email did not go:', dealId, moment, (e as { code?: string })?.code ?? (e as Error)?.message ?? 'no code');
    return false;
  }
}
