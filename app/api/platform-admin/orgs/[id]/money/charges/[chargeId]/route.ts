import { NextResponse } from 'next/server';
import { hasPlatformPower, requirePlatformPower } from '@/lib/platform-auth';
import { withObservability } from '@/lib/observability';
import { getStripe } from '@/lib/stripe';
import { consoleClock } from '@/lib/console-dates';
import { inFlightWords, readClubCharge, readClubInvoice, recoverRefunds } from '@/lib/console-money-stripe';
import { listIssuedCreditNotes } from '@/lib/console-money-credit';
import { stripeKeyIsLive } from '@/lib/online-payments-switch';
import { toChargeCreditNote, type ChargeCreditNote } from '@/lib/console-money';
import { clubRefunds, clubStripeFacts, priceMap, refundStore } from '@/lib/console-money-store';
import { readSaleRecord, saleInvoiceForIntent } from '@/lib/console-money-sales-store';

/**
 * One charge, for the charge window (Support console Stage 3; drawing C). Ownership is checked on EVERY read, not only on
 * refund (T6): a charge number from Find or typed into the address shows nothing unless it belongs to exactly this
 * club's Stripe customer, in this site's mode. Opening the charge is also recovery's moment: an unfinished refund old
 * enough to have finished is decided by listing the charge's refunds in Stripe — never by sending another (G 6).
 * GST/HST Part 6b: a charge that paid an invoice also lists that invoice's credit notes, each with Stripe's PDF link (read
 * here each time, never stored: the link's lifetime is Stripe's). A failed list reads as null, "not read", never "none".
 * The PDF link goes only to a role that can REFUND (owner Q2 2026-11-06, Part 7): the document carries the club's billing name,
 * address and tax details, and a role that only reads Stripe (support) sees each note's number, total and date, no link.
 * GST/HST Stage 3 Part 2: the window is a SALE's. The number may be the sale's invoice (`in_…`, the list's rows) or a charge
 * (`ch_…`, Find's `?charge=`, which opens the sale that charge paid). Our kept record is read beside Stripe, owned by the same
 * customer and mode; when Stripe cannot be read, a sale still opens from it (Ask 2 = A) and only the payment waits.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const noStore = { 'Cache-Control': 'no-store' };

export const GET = withObservability(async (_req: Request, { params }: { params: Promise<{ id: string; chargeId: string }> }) => {
  const auth = await requirePlatformPower('find_stripe');
  if (auth.response) return auth.response;
  const { id, chargeId: number } = await params;
  const pdfAllowed = hasPlatformPower(auth.role, 'refund');
  const nothing = NextResponse.json({ error: 'Nothing matches that charge on this club.' }, { status: 404, headers: noStore });
  const stripeDown = NextResponse.json({ error: 'Stripe could not be read. Try again in a moment.' }, { status: 503, headers: noStore });
  const recordDown = NextResponse.json({ error: 'Our tax record could not be read. Try again in a moment.' }, { status: 503, headers: noStore });

  const [club, prices] = await Promise.all([clubStripeFacts(id), priceMap()]);
  const bySale = /^in_[A-Za-z0-9]+$/.test(number);
  if (!club?.customerId || club.customerShared || !(bySale || /^(ch|py)_[A-Za-z0-9]+$/.test(number))) return nothing;
  const customerId = club.customerId;

  const stripe = getStripe();
  const live = stripeKeyIsLive();
  const notesOf = (invoiceId: string) => listIssuedCreditNotes(stripe, invoiceId)
    .then((notes): ChargeCreditNote[] | null => notes.map(n => toChargeCreditNote(n, { withPdf: pdfAllowed })), () => null);

  // Every answer has the same shape; each exit names only what differs from "nothing to show".
  const answer = (o: Record<string, unknown>) => NextResponse.json({
    stripe: 'read', sale: null, notes: [], invoice: null, charge: null, ourRefunds: [], inFlight: null, creditNotes: null, recordFailed: false, ...o,
  }, { headers: noStore });

  let chargeId = number;
  // Our tax record: a record that is not there (null) is not the same as one that could not be read (recordFailed).
  let kept: Exclude<Awaited<ReturnType<typeof readSaleRecord>>, 'failed'> = null;
  let recordFailed = false;
  if (bySale) {
    const [recordRead, found] = await Promise.all([
      readSaleRecord(number, customerId, live),
      readClubInvoice(stripe, number, club, live, prices).then(f => ({ ok: true as const, f }), () => ({ ok: false as const, f: null })),
    ]);
    recordFailed = recordRead === 'failed';
    const record = recordRead === 'failed' ? null : recordRead;
    if (!found.ok) {
      if (!record) return stripeDown;
      return answer({ stripe: 'unreachable', sale: record.sale, notes: record.notes });
    }
    if (!found.f && !record) return recordFailed ? recordDown : nothing;
    if (!found.f?.chargeId) {
      // A sale with no charge (owed and not tried, $0, paid outside Stripe or from credit, void, written off): no payment to show.
      return answer({
        sale: record?.sale ?? null, notes: record?.notes ?? [], invoice: found.f?.invoice ?? null,
        creditNotes: found.f ? await notesOf(number) : null, recordFailed,
      });
    }
    chargeId = found.f.chargeId;
    kept = record;
  }

  let charge;
  let paymentIntentId: string | null = null;
  try {
    const got = await readClubCharge(stripe, chargeId, club, live, prices);
    charge = got?.charge ?? null;
    paymentIntentId = got?.paymentIntentId ?? null;
  } catch {
    return stripeDown;
  }
  if (!charge) return nothing;
  if (!bySale) {
    // The sale this charge paid: by its invoice, else by its payment, which our record keeps.
    const saleId = charge.invoice?.id ?? (paymentIntentId ? await saleInvoiceForIntent(paymentIntentId, customerId, live).catch((): 'failed' => 'failed') : null);
    const recordRead = saleId && saleId !== 'failed' ? await readSaleRecord(saleId, customerId, live) : null;
    recordFailed = saleId === 'failed' || recordRead === 'failed';
    kept = recordRead === 'failed' ? null : recordRead;
  }

  let inFlight: string | null = null;
  try {
    const stillOpen = await recoverRefunds(stripe, refundStore, { orgId: id, chargeId, now: new Date() });
    if (stillOpen[0]) inFlight = inFlightWords(stillOpen[0], consoleClock);
  } catch {
    // Recovery could not ask Stripe: the charge stays held, and the window says so rather than offering a refund.
    inFlight = 'A refund of this charge is waiting for Stripe’s answer, and Stripe could not be asked just now. Open the charge again in a moment.';
  }
  // The charge's remainder is Stripe's own (read above), whatever our record said; our refunds name who made them. The two reads
  // do not depend on each other.
  const invoiceId = charge.invoice?.id ?? kept?.sale.stripe_invoice_id;
  const [refunds, creditNotes] = await Promise.all([
    clubRefunds(id, chargeId),
    invoiceId ? notesOf(invoiceId) : Promise.resolve<ChargeCreditNote[] | null>([]),
  ]);

  return answer({ sale: kept?.sale ?? null, notes: kept?.notes ?? [], invoice: charge.invoice, charge, ourRefunds: refunds, inFlight, creditNotes, recordFailed });
}, { route: '/api/platform-admin/orgs/[id]/money/charges/[chargeId]' });
