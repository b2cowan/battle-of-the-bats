/**
 * THE SPONSOR INVOICE'S SHARED RULES (Coach Sponsor Invoice, owner rulings 2026-10-20) — what the route, the window
 * and the PDF must agree on, kept in one place so none of them states its own version.
 *
 * Plan: docs/projects/active/COACH_SPONSOR_INVOICE_PLAN.md (rulings R1–R3, A1–A7).
 *
 * ⚖ ALWAYS FROM THE TEAM (R1): payable-to is the team's name and is never a setting.
 * ⚖ NO TAX (R2): nothing here, or anywhere downstream, names or computes a tax.
 * ⚖ THE AMOUNT IS NEVER TYPED: it is the sponsor's pledged amount, else what has arrived — so the invoice can never
 *   disagree with the team's books.
 */

/** How sponsors pay the team (rep_teams.sponsor_payment_details, mig 339). Every key optional. */
export interface SponsorPaymentDetails {
  chequeAddress?: string;
  etransferEmail?: string;
  questionsTo?: string;
}

const PAYMENT_KEYS = ['chequeAddress', 'etransferEmail', 'questionsTo'] as const;
/** Generous caps — an address is a few lines, a name and role one. */
const PAYMENT_MAX: Record<(typeof PAYMENT_KEYS)[number], number> = { chequeAddress: 300, etransferEmail: 200, questionsTo: 160 };

/** The stored jsonb (or a request body's object) as clean details: trimmed strings, empties dropped, unknown keys gone. */
export function normalizePaymentDetails(raw: unknown): SponsorPaymentDetails {
  const out: SponsorPaymentDetails = {};
  if (!raw || typeof raw !== 'object') return out;
  const src = raw as Record<string, unknown>;
  for (const k of PAYMENT_KEYS) {
    const v = typeof src[k] === 'string' ? (src[k] as string).trim().slice(0, PAYMENT_MAX[k]) : '';
    if (v) out[k] = v;
  }
  return out;
}

/** True when nothing tells a sponsor how to pay — the window opens the section rather than folding it. */
export function paymentDetailsEmpty(d: SponsorPaymentDetails): boolean {
  return !d.chequeAddress && !d.etransferEmail;
}

/** "2026-003": the season year and the count within it, zero-padded to three (A2). */
export function formatInvoiceNumber(seasonYear: number, seq: number): string {
  return `${seasonYear}-${String(seq).padStart(3, '0')}`;
}

/** The description a new invoice opens with. The sponsor's own notes are NOT added: they are the team's private
 *  remarks about the sponsor, and the invoice goes to the sponsor's accounting department. */
export function defaultInvoiceDescription(seasonName: string | null | undefined): string {
  return seasonName ? `Team sponsorship — ${seasonName}` : 'Team sponsorship';
}

/** What the invoice is for: the pledged amount, else what has arrived (a sponsor recorded straight as received has no
 *  pledge). A sponsor who sent MORE than they pledged is invoiced what they sent — an invoice smaller than the payments
 *  listed under it would not add up (/review). Zero means there is nothing to invoice yet. */
export function invoiceAmount(pledgedAmount: number | null, totalArrived: number): number {
  const amount = pledgedAmount != null && pledgedAmount > 0 ? Math.max(pledgedAmount, totalArrived) : totalArrived;
  return Math.round(Math.max(0, amount) * 100) / 100;
}

/** One arrival as the invoice reads it — served by the invoice route from the same read as the amount. */
export interface InvoiceArrival {
  amount: number;
  receivedDate: string | null;
  method: string | null;
}

/** A real calendar date as YYYY-MM-DD ("2026-02-31" is not one). */
export function isRealDate(v: unknown): v is string {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

export type InvoiceStanding = 'unpaid' | 'part' | 'paid';

/** Unpaid, part paid or paid in full (A1), from the amount and the arrivals. `paidOn` is the latest arrival's date
 *  once paid in full — the date the subtitle names. */
export function invoiceStanding(
  amount: number,
  arrivals: { amount: number; receivedDate: string | null }[],
): { standing: InvoiceStanding; paid: number; balance: number; paidOn: string | null } {
  const paid = Math.round(arrivals.reduce((s, a) => s + (Number(a.amount) || 0), 0) * 100) / 100;
  const balance = Math.round(Math.max(0, amount - paid) * 100) / 100;
  const standing: InvoiceStanding = paid <= 0.005 ? 'unpaid' : balance <= 0.005 ? 'paid' : 'part';
  const dates = arrivals.map(a => a.receivedDate).filter((d): d is string => !!d).sort();
  return { standing, paid, balance, paidOn: standing === 'paid' ? (dates[dates.length - 1] ?? null) : null };
}

/** The invoice as the route serves it and the window/PDF read it. */
export interface SponsorInvoice {
  id: string;
  number: string;
  billToName: string;
  billToAttention: string | null;
  billToEmail: string | null;
  billToAddress: string | null;
  description: string;
  amount: number;
  issuedOn: string;
  dueOn: string | null;
  revisedOn: string | null;
}

/** A stored row as the served shape. */
export function invoiceFromRow(r: Record<string, unknown>): SponsorInvoice {
  return {
    id: r.id as string,
    number: formatInvoiceNumber(Number(r.season_year), Number(r.seq)),
    billToName: r.bill_to_name as string,
    billToAttention: (r.bill_to_attention as string | null) ?? null,
    billToEmail: (r.bill_to_email as string | null) ?? null,
    billToAddress: (r.bill_to_address as string | null) ?? null,
    description: r.description as string,
    amount: Number(r.amount),
    issuedOn: r.issued_on as string,
    dueOn: (r.due_on as string | null) ?? null,
    revisedOn: (r.revised_on as string | null) ?? null,
  };
}

/** A multi-line address on one line, for the paper's identity band and the folded window line. */
export function oneLineAddress(address: string | null | undefined): string {
  return (address ?? '').split(/\r?\n/).map(s => s.trim()).filter(Boolean).join(', ');
}
