/**
 * THE CLUB'S SPONSORSHIP INVOICE — WHAT IT SAYS (Board Ready Stage 6 Part 3a; round 1 tabs 6 and 7, round 2 tab 2; asks 9
 * and 10; owner calls 2026-11-23). Pure and client-safe: the PDF (lib/club-sponsor-invoice-pdf.ts), the deal's money band,
 * the business's page and the tests read these same answers, so a figure is worked out once.
 *
 *   · The coach recipe (round 2 ask 2): every charge is a row of the one table — the sponsorship with its deliverables
 *     listed under it, then "HST 13%" when the deal carries tax — and Invoiced · Paid · Balance due carry the total.
 *   · No tax words at all on an untaxed invoice (round 1's "NO TAX WORDS": no field, line or "No GST/HST charged").
 *   · The paid invoice IS the receipt (ask 10): the same page, "Paid in full {date}" leading its subtitle, the payments
 *     received listed, no stamp. Never "donation", "gift" or "tax receipt".
 *   · A withdrawn invoice (owner call 3 at walk §562, 2026-11-23: "print Withdrawn on it"): the same page, "Withdrawn {date}"
 *     leading its subtitle as "Paid in full" does — the house has no stamps — with no How to pay and nothing owing.
 *   · The club's GST/HST number at the top only when the invoice carries tax; FieldLogicHQ's never (/accounting).
 */
import { formatStoredDate } from './timezone';
import { money } from './online-payment-words';
import { formatGstNumber } from './club-sponsorships';
import { oneLineAddress } from './coach-sponsor-invoice';
import type { DealInvoice } from './club-sponsorship-deals';
import { DUES_PAYMENT_METHOD_LABEL, type DuesPaymentMethod } from './types';

/** A deal's recorded payment (mig 528). A voided one stays on record and counts for nothing. */
export interface DealPayment {
  id: string;
  amount: number;
  /** The part of it that is the GST/HST (its share, worked out by the database when it was recorded). */
  taxPart: number;
  receivedOn: string;
  method: DuesPaymentMethod;
  reference: string | null;
  note: string | null;
  recordedByName: string;
  voided: { at: string; byName: string; reason: string } | null;
}

/** "How it was paid" on a deal: the product's one method list (DUES_PAYMENT_METHODS), "E-transfer" as ruled (round 2 ask 6). */
export const DEAL_METHOD_LABEL: Record<DuesPaymentMethod, string> = { ...DUES_PAYMENT_METHOD_LABEL, etransfer: 'E-transfer' };

/** "Cheque 004417" — how it arrived, with its number when there is one. */
export const paymentHow = (p: Pick<DealPayment, 'method' | 'reference'>): string =>
  [DEAL_METHOD_LABEL[p.method] ?? p.method, p.reference?.trim() || null].filter(Boolean).join(' ');

const cents = (n: number) => Math.round(n * 100);

/** What has arrived against an invoice: paid, still owing, and the day it was paid in full (the last arrival's). */
export function invoiceStanding(total: number, payments: readonly DealPayment[]): {
  paid: number; owing: number; paidInFull: boolean; paidOn: string | null; live: DealPayment[];
} {
  const live = payments.filter(p => !p.voided).sort((a, b) => a.receivedOn.localeCompare(b.receivedOn));
  const paidC = live.reduce((s, p) => s + cents(p.amount), 0);
  const owingC = Math.max(0, cents(total) - paidC);
  const paidInFull = live.length > 0 && owingC === 0;
  return { paid: paidC / 100, owing: owingC / 100, paidInFull, paidOn: paidInFull ? live[live.length - 1].receivedOn : null, live };
}

/** "Mar 3 to Aug 31, 2027" — the year once when both days share it. */
export function periodLabel(from: string, to: string): string {
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  return `${formatStoredDate(from, { withYear: !sameYear })} to ${formatStoredDate(to, { withYear: true })}`;
}

export interface ClubInvoiceInput {
  club: { name: string; mailingAddress: string | null; gstHstNumber: string | null; contactName: string | null; contactEmail: string | null };
  howToPay: { etransferTo: string | null; chequesPayableTo: string | null };
  /** `withdrawnAt`: the deal was withdrawn after its invoice was issued (owner call 3 at walk §562: the club's paper still
   *  downloads, saying "Withdrawn" so nobody pays it by mistake). */
  deal: { packageName: string; placeName: string | null; bullets: string[]; endsOn: string | null; revisedOn: string | null; withdrawnAt?: string | null };
  invoice: DealInvoice;
  billTo: { name: string; contactName: string | null; address: string | null; email: string | null };
  payments: readonly DealPayment[];
}

/** The page's content (the PDF's settings — colour, crest, footer — are added by the server). */
export function clubInvoiceLayout(i: ClubInvoiceInput) {
  const inv = i.invoice;
  const standing = invoiceStanding(inv.total, i.payments);
  const taxed = !!inv.taxKind && inv.tax > 0;
  const what = `Sponsorship: ${i.deal.packageName}${i.deal.placeName ? `, ${i.deal.placeName}` : ''}`;
  const rows: { description: string; sub?: string[]; amount: string }[] = [
    {
      description: i.deal.endsOn && i.deal.endsOn >= inv.issuedOn ? `${what} · ${periodLabel(inv.issuedOn, i.deal.endsOn)}` : what,
      sub: i.deal.bullets,
      amount: money((cents(inv.total) - cents(inv.tax)) / 100),
    },
    ...(taxed ? [{ description: `${inv.taxKind} ${inv.taxRate}%`, amount: money(inv.tax) }] : []),
  ];
  const who = [i.club.contactName, i.club.contactEmail].filter(Boolean).join(', ');
  const mailed = oneLineAddress(i.club.mailingAddress) || null;
  // A withdrawn invoice owes nothing (a deal with a live payment can't be withdrawn: mig 528's guard), so its balance reads $0.00.
  const withdrawn = !!i.deal.withdrawnAt && !standing.paidInFull;
  return {
    clubName: i.club.name,
    fromLine: mailed,
    number: inv.number,
    issuedLabel: formatStoredDate(inv.issuedOn),
    dueLabel: formatStoredDate(inv.dueOn),
    revisedLabel: i.deal.revisedOn ? formatStoredDate(i.deal.revisedOn) : null,
    paidInFull: standing.paidInFull,
    paidInFullLabel: standing.paidOn ? formatStoredDate(standing.paidOn) : null,
    partPaid: !standing.paidInFull && standing.paid > 0,
    withdrawnLabel: withdrawn ? formatStoredDate(i.deal.withdrawnAt) : null,
    invoiced: money(inv.total),
    paid: money(standing.paid),
    balance: money(withdrawn ? 0 : standing.owing),
    billTo: { name: i.billTo.name, attention: i.billTo.contactName, address: i.billTo.address, email: i.billTo.email },
    rows,
    taxNumberLine: taxed && i.club.gstHstNumber ? `GST/HST no. ${formatGstNumber(i.club.gstHstNumber)}` : null,
    payments: standing.live.map(p => [formatStoredDate(p.receivedOn), paymentHow(p), money(p.amount)]),
    // The coach builder prints "payable to {payee}"; a club that set its own cheque payee is that name.
    howToPay: { etransferEmail: i.howToPay.etransferTo, chequeAddress: mailed },
    chequesPayableTo: i.howToPay.chequesPayableTo ?? i.club.name,
    questionsTo: who || null,
  };
}

export type ClubInvoiceLayout = ReturnType<typeof clubInvoiceLayout>;

/**
 * Can the club email a deal's invoice? It needs its mailing address (the invoice's cheque address) and a contact for sponsors
 * (the email's reply-to) — the sender's own refusal (lib/sponsor-invoice-email.ts) and the business's page (owner call 4 at
 * walk §562: never promise an email that can't go) ask this one question.
 */
export const clubCanEmailInvoice = (mailingAddress: string | null | undefined, contactEmail: string | null | undefined): boolean =>
  !!mailingAddress?.trim() && !!contactEmail?.trim();

/** "invoice-2027-014-harbour-dental.pdf" — the download's name, ASCII only. */
export function invoiceFilename(number: string, business: string): string {
  const slug = business.normalize('NFKD').replace(/[^\w\s-]/g, '').trim().toLowerCase().replace(/\s+/g, '-').slice(0, 40);
  return `invoice-${number}${slug ? `-${slug}` : ''}.pdf`;
}
