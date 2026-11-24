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
import { clubCanEmailInvoice, invoiceStanding } from './club-sponsor-invoice';
import { DEAL_WORDS } from './club-sponsorship-deal-words';
import { refundBlockHtml } from './online-refund-block';
import { ONLINE_EMAIL_WORDS, REFUND_BLOCK_WORDS, money } from './online-payment-words';

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
    if (!deal?.invoice || !to) {
      console.warn('[sponsorships] the invoice email was not sent — the deal has no invoice, or the business has no address:', dealId, moment);
      return false;
    }
    const contactEmail = await offerContactOf(orgId, settings);
    const url = dealLinkUrl(orgSlug, deal.id, deal.linkVersion);
    const mailingAddress = settings.mailingAddress?.trim() ?? '';
    // The same question the business's page asks before it promises an email (owner call 4, walk §562). (`!contactEmail`
    // again only so the type knows.)
    if (!clubCanEmailInvoice(mailingAddress, contactEmail) || !contactEmail || !url) {
      console.warn('[sponsorships] the invoice email was not sent — the club has no mailing address or no sponsorship contact email, or the deal has no link:', dealId, moment);
      return false;
    }
    const standing = moment === 'paid' ? invoiceStanding(deal.invoice.total, deal.payments) : null;
    if (moment === 'paid' && !standing?.paidInFull) return false;
    const facts = await clubEmailFacts(org);
    const html = warmEmailDocument(invoiceEmailHtml({
      moment, club: org.name, business: business?.contactName || business?.name || deal.businessName, number: deal.invoice.number,
      total: deal.invoice.total, dueOn: deal.invoice.dueOn, paidOn: standing?.paidOn ?? null, etransferTo: settings.etransferTo,
      chequesPayableTo: settings.chequesPayableTo ?? org.name, mailingAddress, url,
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

/**
 * THE REFUND EMAIL (Part 3b; the card-refund drawing's ask 6, RULED 2026-11-23: "the shipped refund email"): "Refund from
 * {club}", the shipped refund block (Refunded · To · On · Refund reference, the fee line, how long it takes), the club's
 * reason, and — on a taxed invoice — the credit note's number, which downloads from the business's page. Sent once a refund
 * reaches the card (Stripe accepted it), claimed on the refund so the press and Stripe's event never send two. Never fails
 * the refund; answers the address it went to, or null.
 */
export async function emailDealRefund(orgId: string, refundId: string): Promise<string | null> {
  try {
    const { data: claimed } = await supabaseAdmin.from('club_sponsor_deal_refunds').update({ emailed_at: new Date().toISOString() })
      .eq('id', refundId).eq('org_id', orgId).is('emailed_at', null).eq('status', 'succeeded').select('deal_id').maybeSingle();
    const dealId = (claimed as { deal_id: string } | null)?.deal_id;
    if (!dealId) return null;
    const release = async () => { await supabaseAdmin.from('club_sponsor_deal_refunds').update({ emailed_at: null }).eq('id', refundId); };
    const [deal, business, settings, org] = await Promise.all([readDeal(orgId, dealId), readDealBusiness(orgId, dealId), readSettings(orgId), readClubEmailOrg(orgId)]);
    const refund = deal?.refunds.find(r => r.id === refundId);
    const payment = refund ? deal?.payments.find(x => x.id === refund.paymentId) : null;
    const to = business?.email?.trim().toLowerCase();
    const contactEmail = await offerContactOf(orgId, settings);
    const mailingAddress = settings.mailingAddress?.trim() ?? '';
    const url = deal ? dealLinkUrl(org.slug, deal.id, deal.linkVersion) : null;
    if (!deal?.invoice || !refund || !payment?.card || !to || !contactEmail || !clubCanEmailInvoice(mailingAddress, contactEmail)) {
      console.warn('[sponsorships] the refund email was not sent — no address, no contact for sponsors, or no mailing address:', refundId);
      await release();
      return null;
    }
    const facts = await clubEmailFacts(org);
    const p = (text: string, style: string = WARM_EMAIL_STYLE.paragraph) => `<p style="${style}">${escText(text)}</p>`;
    const html = warmEmailDocument([
      `<div style="display:none;max-height:0;overflow:hidden;">${escText(REFUND_BLOCK_WORDS.preheader(money(refund.amount), false))}</div>`,
      p(E.greeting(business?.contactName || business?.name || deal.businessName)),
      p(refund.endsDeal ? C.emailLeadWhole(org.name, deal.invoice.number) : C.emailLead(org.name, deal.invoice.number)),
      p(ONLINE_EMAIL_WORDS.refundReason(org.name, refund.reason)),
      refundBlockHtml({
        refundCents: Math.round(refund.amount * 100), bank: false, cardBrand: payment.card.brand, cardLast4: payment.card.last4, bankLast4: null,
        refundedAt: refund.succeededAt ?? refund.createdAt, reference: refund.stripeRefundId, receiptNo: null, paidOn: payment.receivedOn,
        feeBackCents: 0,
        feeKeptCents: payment.card.feePaidBy === 'sponsor' ? Math.round((payment.card.feeCharged + payment.card.feeTax) * 100) : 0,
      }),
      refund.creditNumber ? p(C.emailCreditNote(refund.creditNumber)) : '',
      url ? warmEmailButton(escText(C.emailButton), escText(url)) : '',
      p(DEAL_WORDS.email.questions(settings.contactEmail ? settings.contactName : null, contactEmail), WARM_EMAIL_STYLE.small),
      `<div style="${WARM_EMAIL_STYLE.footRule}">`,
      `<p style="${WARM_EMAIL_STYLE.finePrint}">${escText(DEAL_WORDS.email.sentBy(org.name, mailingAddress))}</p>`,
      '</div>',
    ].join('\n'), facts);
    const result = await sendEmail(to, ONLINE_EMAIL_WORDS.refundSubject(org.name), html, {
      kind: 'club_sponsorship_refund', fromName: familySenderName(org.name), replyTo: contactEmail, orgId,
    });
    if (result.status !== 'sent') { await release(); return null; }
    return to;
  } catch (e) {
    console.error('[sponsorships] the refund email did not go:', refundId, (e as Error)?.message ?? 'no code');
    return null;
  }
}

const C = DEAL_WORDS.card;
