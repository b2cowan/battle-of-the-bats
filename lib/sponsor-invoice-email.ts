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
import { clubCanEmailInvoice, invoiceStanding, refundLeft, refundMadeOn, refundParts } from './club-sponsor-invoice';
import { daysBetweenDateStrings, tournamentToday } from './timezone';
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

/** What both refund emails read: the deal, the business, the club's settings and face, and who and how it can be sent. */
async function refundEmailInputs(orgId: string, dealId: string) {
  const [deal, business, settings, org] = await Promise.all([readDeal(orgId, dealId), readDealBusiness(orgId, dealId), readSettings(orgId), readClubEmailOrg(orgId)]);
  const contactEmail = await offerContactOf(orgId, settings);
  const mailingAddress = settings.mailingAddress?.trim() ?? '';
  return {
    deal, business, settings, org, contactEmail, mailingAddress,
    to: business?.email?.trim().toLowerCase() ?? null,
    url: deal ? dealLinkUrl(org.slug, deal.id, deal.linkVersion) : null,
    canSend: !!contactEmail && clubCanEmailInvoice(mailingAddress, contactEmail),
  };
}

/** The paragraph helper and the button, questions and footer both refund emails end with. */
const refundEmailP = (text: string, style: string = WARM_EMAIL_STYLE.paragraph) => `<p style="${style}">${escText(text)}</p>`;
function refundEmailTail(i: { org: { name: string }; settings: { contactEmail: string | null; contactName: string | null }; contactEmail: string; mailingAddress: string; url: string | null }): string[] {
  return [
    i.url ? warmEmailButton(escText(C.emailButton), escText(i.url)) : '',
    refundEmailP(DEAL_WORDS.email.questions(i.settings.contactEmail ? i.settings.contactName : null, i.contactEmail), WARM_EMAIL_STYLE.small),
    `<div style="${WARM_EMAIL_STYLE.footRule}">`,
    `<p style="${WARM_EMAIL_STYLE.finePrint}">${escText(DEAL_WORDS.email.sentBy(i.org.name, i.mailingAddress))}</p>`,
    '</div>',
  ];
}

/**
 * THE REFUND EMAIL (Part 3b; the card-refund drawing's ask 6, RULED 2026-11-23: "the shipped refund email"): "Refund from
 * {club}", the shipped refund block (Refunded · To · On, the fee line, how long it takes), the club's
 * reason, and — on a taxed invoice — the credit note's number, which downloads from the business's page. Sent once a refund
 * reaches the card (Stripe accepted it), claimed on the refund so the press and Stripe's event never send two. Never fails
 * the refund; answers the address it went to, or null.
 */
export async function emailDealRefund(orgId: string, refundId: string): Promise<string | null> {
  let release: (() => Promise<void>) | null = null;
  try {
    // A refund made in Stripe is emailed only once the club FINISHED it (its reason given, its credit note issued: Part A, ask 1).
    const { data: claimed } = await supabaseAdmin.from('club_sponsor_deal_refunds').update({ emailed_at: new Date().toISOString() })
      .eq('id', refundId).eq('org_id', orgId).is('emailed_at', null).eq('status', 'succeeded')
      .or('origin.eq.app,finished_at.not.is.null').select('deal_id').maybeSingle();
    const dealId = (claimed as { deal_id: string } | null)?.deal_id;
    if (!dealId) return null;
    release = async () => { await supabaseAdmin.from('club_sponsor_deal_refunds').update({ emailed_at: null }).eq('id', refundId); };
    const inputs = await refundEmailInputs(orgId, dealId);
    const { deal, business, org, to, contactEmail } = inputs;
    const refund = deal?.refunds.find(r => r.id === refundId);
    const payment = refund ? deal?.payments.find(x => x.id === refund.paymentId) : null;
    if (!deal?.invoice || !refund || !payment?.card || !to || !contactEmail || !inputs.canSend) {
      console.warn('[sponsorships] the refund email was not sent — no address, no contact for sponsors, or no mailing address:', refundId);
      await release();
      return null;
    }
    const facts = await clubEmailFacts(org);
    const p = refundEmailP;
    const owing = deal.state === 'invoiced' ? invoiceStanding(deal.invoice.total, deal.payments).owing : 0;
    const html = warmEmailDocument([
      `<div style="display:none;max-height:0;overflow:hidden;">${escText(REFUND_BLOCK_WORDS.preheader(money(refund.amount), false))}</div>`,
      p(E.greeting(business?.contactName || business?.name || deal.businessName)),
      p(refund.endsDeal ? C.emailLeadWhole(org.name, deal.invoice.number)
        // A refund made in Stripe can give back a payment's whole sponsorship on a deal that stays: never "part of" it.
        : refund.origin === 'stripe' && refundParts(refund).sponsorship >= refundLeft(payment, []).refundable
          ? C.emailLeadAll(org.name, deal.invoice.number)
          : C.emailLead(org.name, deal.invoice.number)),
      p(ONLINE_EMAIL_WORDS.refundReason(org.name, refund.reason ?? '')), // a refund made in Stripe is emailed only once finished, with its reason
      refundBlockHtml({
        refundCents: Math.round(refund.amount * 100), bank: false, cardBrand: payment.card.brand, cardLast4: payment.card.last4, bankLast4: null,
        // The day the money left: Stripe's own moment for a refund made there (it may be recorded and finished weeks later).
        refundedAt: refund.stripeCreatedAt ?? refund.succeededAt ?? refund.createdAt, receiptNo: null, paidOn: payment.receivedOn,
        // A refund made in Stripe can give the fee back too (Part A, ask 3): the block then says so, and drops "the fee isn't part of this refund".
        feeBackCents: Math.round(refund.feePart * 100),
        feeKeptCents: refund.feePart === 0 && payment.card.feePaidBy === 'sponsor' ? Math.round((payment.card.feeCharged + payment.card.feeTax) * 100) : 0,
        feeOfCents: Math.round((payment.card.feeCharged + payment.card.feeTax) * 100),
        // Finished more than two weeks after the money left (10 business days): it is no longer on its way.
        alreadyArrived: refund.origin === 'stripe' && daysBetweenDateStrings(refundMadeOn(refund), tournamentToday()) > 14,
      }),
      refund.creditNumber ? p(C.emailCreditNote(refund.creditNumber)) : '',
      // The refund left the invoice owing (the club's choice, or what else stands no longer covers it): said, with how to check.
      owing > 0 ? p(C.emailStillOwing(org.name, deal.invoice.number, money(owing))) : '',
      ...refundEmailTail({ ...inputs, org, contactEmail }),
    ].join('\n'), facts);
    const result = await sendEmail(to, ONLINE_EMAIL_WORDS.refundSubject(org.name), html, {
      kind: 'club_sponsorship_refund', fromName: familySenderName(org.name), replyTo: contactEmail, orgId,
    });
    if (result.status !== 'sent') { await release(); return null; }
    return to;
  } catch (e) {
    console.error('[sponsorships] the refund email did not go:', refundId, (e as Error)?.message ?? 'no code');
    // A send that threw after the claim must not leave "emailed" on a refund the business never heard of.
    await release?.().catch(() => undefined);
    return null;
  }
}

/**
 * THE CORRECTION (owner 2026-11-24, walk §564 call (h)'s companion): a refund the business was TOLD about (its email went) that
 * then did not reach the card. Its credit note is kept and marked cancelled, never reused, and the business is told so once,
 * from the failed state (mig 533's own stamp), so a send that failed is tried again. Nothing goes for a refund that was never
 * emailed (they never heard of it). Never throws.
 */
export async function emailDealRefundCancelled(orgId: string, dealId: string, refundId: string): Promise<void> {
  let release: (() => Promise<void>) | null = null;
  try {
    // Claimed first, released if the send does not go (as the refund email's is): the caller runs this from the failed state on
    // every replay, so a send that failed is tried again and a sent one is never doubled. Only a refund the business was told
    // about (`emailed_at`) that then failed.
    const { data: claimed } = await supabaseAdmin.from('club_sponsor_deal_refunds').update({ cancel_emailed_at: new Date().toISOString() })
      .eq('id', refundId).eq('org_id', orgId).eq('status', 'failed').not('emailed_at', 'is', null).is('cancel_emailed_at', null).select('id').maybeSingle();
    if (!claimed) return;
    release = async () => { await supabaseAdmin.from('club_sponsor_deal_refunds').update({ cancel_emailed_at: null }).eq('id', refundId); };
    const inputs = await refundEmailInputs(orgId, dealId);
    const { deal, business, org, to, contactEmail } = inputs;
    const refund = deal?.refunds.find(r => r.id === refundId);
    if (!deal?.invoice || !refund || !to || !contactEmail || !inputs.canSend) { await release(); return; }
    const facts = await clubEmailFacts(org);
    const html = warmEmailDocument([
      refundEmailP(E.greeting(business?.contactName || business?.name || deal.businessName)),
      refundEmailP(C.emailCancelled(org.name, money(refund.amount), refund.creditNumber)), // a refund on an untaxed invoice has no note to cancel
      ...refundEmailTail({ ...inputs, org, contactEmail }),
    ].join('\n'), facts);
    const result = await sendEmail(to, C.emailCancelledSubject(org.name), html, {
      kind: 'club_sponsorship_refund', fromName: familySenderName(org.name), replyTo: contactEmail, orgId,
    });
    if (result.status !== 'sent') await release();
  } catch (e) {
    console.error('[sponsorships] the refund correction did not go:', refundId, (e as Error)?.message ?? 'no code');
    await release?.().catch(() => undefined);
  }
}

const C = DEAL_WORDS.card;
