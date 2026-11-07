import 'server-only';
import type Stripe from 'stripe';
import { stripe } from './stripe';
import { supabaseAdmin } from './supabase-admin';
import { stripeDashboardBase, stripeKeyIsLive } from './stripe-mode';
import { captureError } from './observability/capture';
import { ADMIN_EMAIL, SITE_URL, escapeHtml, sendEmail } from './email';
import { FEE_INVOICE_META } from './online-payment-words';
import { fetchAllIn, inParallel } from './supabase-paging';
import { orgDayKey } from './timezone';
import { buyerOfStripeCustomer, readSaleEvidence } from './billing-location-server';
import {
  BACKFILL_FLOOR_ISO,
  amountsOf,
  buildChargeTaxRecord,
  buildCreditNoteTaxRecord,
  cadValuation,
  chargeRecordState,
  chargeTaxKind,
  idOf,
  invoiceIssuedAt,
  noteIssuedAt,
  rateFromValet,
  valetSeries,
  type ChargeTaxKind,
  type CreditNoteLike,
  type EvidenceCaptured,
  type FxRate,
  type InvoiceLike,
  type RecordContext,
} from './charge-tax-record';

/**
 * THE WRITER of a charge's tax record and a credit note's (GST/HST Stage 3 Part 1; migration 451; pure rules in
 * lib/charge-tax-record.ts). Server-only.
 *
 *   · Every invoice event re-reads the invoice from Stripe (the event's copy names each tax rate by id only, and events arrive in
 *     any order: Part 0 probe), so a replay or a late event writes the same answer.
 *   · The FIRST write copies the buyer's evidence as it stands then; every later write moves only the payment state (the
 *     database refuses anything else). A record whose evidence could not be read stays `evidence_missing`, never filled in later.
 *   · ⚖ A failed write never stops the billing webhook's own work (a club's plan must not wait on our bookkeeping): it is reported
 *     (`recordTaxOrReport`) and the daily job's catch-up (`catchUpChargeTaxRecords`) writes it.
 */

const CHARGES = 'platform_charge_tax_records';
const NOTES = 'platform_credit_note_tax_records';
const INVOICE_EXPAND = ['total_taxes.tax_rate_details.tax_rate', 'payments'];
const NOTE_EXPAND = ['total_taxes.tax_rate_details.tax_rate'];
/** Every Stripe read here has its own time limit (the client's default is 80 seconds): a slow read must not hold the webhook's
 *  answer, a refund's answer or the daily job. A read that runs out throws, and the record is reported and caught up later. */
const STRIPE_OPTS = { timeout: 10_000 };

export type RecordOutcome = 'recorded' | 'updated' | 'skipped';

/**
 * THE ONE RULE for the organization a Stripe subscription (or customer) belongs to, shared by the tax record and the billing
 * webhook's charge alerts (its `ownerOf`), so a charge's alert and its tax record always name the same club: the ONE organization
 * billing the subscription, else the coach's portal billing it, else the ONE organization holding the customer. Null when none,
 * or more than one, matches: a shared id names no club rather than whichever row came first (organizations.stripe_subscription_id
 * is not unique). Throws on a failed read.
 */
export async function orgOfSubscription(subscriptionId: string | null, customerId: string | null):
  Promise<{ orgId: string; teamWorkspaceId: string | null } | null> {
  if (subscriptionId) {
    const { data, error } = await supabaseAdmin.from('organizations').select('id').eq('stripe_subscription_id', subscriptionId).limit(2);
    if (error) throw new Error(`Couldn't find the subscription's club: ${error.message}`);
    if ((data ?? []).length === 1) return { orgId: (data![0] as { id: string }).id, teamWorkspaceId: null };
    const { data: ws, error: wsError } = await supabaseAdmin.from('team_workspaces').select('id, workspace_org_id, billing_owner_org_id')
      .eq('stripe_subscription_id', subscriptionId).limit(2);
    if (wsError) throw new Error(`Couldn't find the subscription's portal: ${wsError.message}`);
    const portals = (ws ?? []) as Array<{ id: string; workspace_org_id: string | null; billing_owner_org_id: string | null }>;
    const portalOrg = portals.length === 1 ? portals[0].billing_owner_org_id ?? portals[0].workspace_org_id : null;
    if (portalOrg) return { orgId: portalOrg, teamWorkspaceId: portals[0].id };
  }
  if (!customerId) return null;
  const { data, error } = await supabaseAdmin.from('organizations').select('id').eq('stripe_customer_id', customerId).limit(2);
  if (error) throw new Error(`Couldn't find the customer's club: ${error.message}`);
  return (data ?? []).length === 1 ? { orgId: (data![0] as { id: string }).id, teamWorkspaceId: null } : null;
}

const orgOfInvoice = async (customerId: string, subscriptionId: string | null): Promise<string | null> =>
  (await orgOfSubscription(subscriptionId, customerId))?.orgId ?? null;

/**
 * The Bank of Canada daily rate (CAD per unit) for a day, or the business day before it (Stage 4 Ask 4; Memo 3-6). Null when it cannot
 * be read: the record is then written without its CAD figures and a later write (the next event, the daily catch-up) values it.
 * Only a non-CAD sale asks, and US sales are closed, so in production today this never runs.
 */
export async function bankOfCanadaRate(currency: string, day: string): Promise<FxRate | null> {
  const series = valetSeries(currency);
  const from = new Date(`${day}T12:00:00Z`);
  from.setUTCDate(from.getUTCDate() - 10);
  const url = `https://www.bankofcanada.ca/valet/observations/${series}/json?start_date=${from.toISOString().slice(0, 10)}&end_date=${day}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    if (!res.ok) return null;
    const body = await res.json() as { observations?: Array<{ d: string } & Record<string, unknown>> };
    return rateFromValet(body.observations ?? [], series, day);
  } catch (error) {
    void captureError(error, { route: 'charge-tax-record:fx' });
    return null;
  }
}

const fxFor = async (currency: string, issuedIso: string | null): Promise<FxRate | null> =>
  currency.toLowerCase() === 'cad' || !issuedIso ? null : bankOfCanadaRate(currency, orgDayKey(issuedIso));

/**
 * What a paid invoice's payment says: Stripe's own CAD figure for a non-CAD sale (its settlement, a cross-check only) and what
 * has been refunded on it so far (so a record first written after a refund starts with it, not 0). Best effort: a failed read
 * leaves both unknown (null / 0), never the record unwritten; the daily job's refund sweep catches the refund up.
 */
async function paymentFacts(inv: Stripe.Invoice, paymentIntentId: string | null, wantCad: boolean): Promise<{ stripeCad: number | null; refunded: number }> {
  const none = { stripeCad: null, refunded: 0 };
  if (inv.status !== 'paid' || !paymentIntentId) return none;
  try {
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId,
      { expand: [wantCad ? 'latest_charge.balance_transaction' : 'latest_charge'] }, STRIPE_OPTS);
    const charge = pi.latest_charge && typeof pi.latest_charge !== 'string' ? pi.latest_charge : null;
    const bt = charge?.balance_transaction && typeof charge.balance_transaction !== 'string' ? charge.balance_transaction : null;
    return { stripeCad: wantCad && bt && bt.currency === 'cad' ? bt.amount : null, refunded: charge?.amount_refunded ?? 0 };
  } catch (error) {
    void captureError(error, { route: 'charge-tax-record:payment' });
    return none;
  }
}

const notCad = (currency: string) => currency.toLowerCase() !== 'cad';

/** The statuses a record may move FROM to reach this one (Stripe's own order: open → paid / void / uncollectible; uncollectible →
 *  paid / void). A read that went stale while another event wrote a later state never moves the record back. */
const MOVES_FROM: Record<string, string[]> = {
  open: ['open'],
  uncollectible: ['open', 'uncollectible'],
  paid: ['open', 'uncollectible', 'paid'],
  void: ['open', 'uncollectible', 'void'],
};

/** A first write a day or more after the invoice was issued (a Stripe retry, a later event after the first one failed) did not
 *  read the evidence AT the sale, so it is not labelled `event`. */
const LATE_FIRST_WRITE_MS = 86_400_000;

async function contextOf(inv: Stripe.Invoice, captured: EvidenceCaptured): Promise<RecordContext | null> {
  const customerId = idOf(inv.customer);
  if (!customerId) return null;
  const subscriptionId = idOf(inv.parent?.subscription_details?.subscription ?? null);
  const buyer = await buyerOfStripeCustomer(customerId);
  // Independent once the buyer is known: its evidence, the organization a person's or unknown buyer's invoice belongs to, the rate.
  const [evidence, orgId, fx] = await Promise.all([
    buyer ? readSaleEvidence(buyer) : null,
    buyer?.kind === 'org' ? buyer.orgId : orgOfInvoice(customerId, subscriptionId),
    fxFor(inv.currency, invoiceIssuedAt(inv as unknown as InvoiceLike)),
  ]);
  const recordBuyer: RecordContext['buyer'] = buyer?.kind === 'org' ? { kind: 'club', orgId: buyer.orgId }
    : buyer?.kind === 'user' ? { kind: 'person', userId: buyer.userId, orgId }
      : { kind: 'unknown', orgId };
  const issued = invoiceIssuedAt(inv as unknown as InvoiceLike);
  const late = captured === 'event' && !!issued && Date.now() - Date.parse(issued) > LATE_FIRST_WRITE_MS;
  return {
    kind: chargeTaxKind({ feeInvoice: !!inv.metadata?.[FEE_INVOICE_META], buyerKind: recordBuyer.kind, subscriptionId }),
    buyer: recordBuyer,
    evidence,
    readAt: new Date().toISOString(),
    captured: late ? 'catch_up' : captured,
    fx,
  };
}

/**
 * One invoice's record: written in full the first time (evidence copied now), its payment state only after. `skipped` = a draft
 * (not issued: nothing owed yet) or no customer. Throws on a failed Stripe or database read or write.
 */
export async function recordInvoiceTax(invoiceId: string, captured: EvidenceCaptured = 'event'): Promise<RecordOutcome> {
  type Existing = {
    id: string; fx_rate: number | null; stripe_cad_total_cents: number | null; stripe_payment_intent_id: string | null;
    paid_at: string | null; voided_at: string | null; uncollectible_at: string | null;
  };
  const [inv, { data: existing, error: readError }] = await Promise.all([
    stripe.invoices.retrieve(invoiceId, { expand: INVOICE_EXPAND }, STRIPE_OPTS),
    supabaseAdmin.from(CHARGES).select('id, fx_rate, stripe_cad_total_cents, stripe_payment_intent_id, paid_at, voided_at, uncollectible_at')
      .eq('stripe_invoice_id', invoiceId).maybeSingle<Existing>(),
  ]);
  if (readError) throw readError;
  const state = chargeRecordState(inv as unknown as InvoiceLike);
  if (!state) return 'skipped';

  if (!existing) {
    const ctx = await contextOf(inv, captured);
    const row = ctx && buildChargeTaxRecord(inv as unknown as InvoiceLike, ctx);
    if (!row) return 'skipped';
    const facts = await paymentFacts(inv, row.stripe_payment_intent_id, notCad(inv.currency));
    // Two events at once both find no row: the database keeps the first, and the second only moves the state below.
    const { data: inserted, error } = await supabaseAdmin.from(CHARGES)
      .upsert({ ...row, stripe_cad_total_cents: facts.stripeCad, refunded_cents: facts.refunded }, { onConflict: 'stripe_invoice_id', ignoreDuplicates: true })
      .select('id');
    if (error) throw error;
    if ((inserted ?? []).length > 0) return 'recorded';
  }
  // A payment, or a date, once recorded is never dropped by a later read that lists none (a write-off's date is its tax period).
  const { stripe_payment_intent_id: paymentIntent, ...rest } = state;
  const patch: Record<string, unknown> = {
    ...rest,
    paid_at: rest.paid_at ?? existing?.paid_at ?? null,
    voided_at: rest.voided_at ?? existing?.voided_at ?? null,
    uncollectible_at: rest.uncollectible_at ?? existing?.uncollectible_at ?? null,
    ...(paymentIntent ? { stripe_payment_intent_id: paymentIntent } : {}),
    updated_at: new Date().toISOString(),
  };
  // A non-CAD sale whose rate could not be read is valued now (once); Stripe's own CAD figure, once paid (once).
  if (existing && existing.fx_rate === null && notCad(inv.currency)) {
    const issued = invoiceIssuedAt(inv as unknown as InvoiceLike);
    const fx = await fxFor(inv.currency, issued);
    if (fx && issued) Object.assign(patch, cadValuation(inv.currency, amountsOf(inv), issued, fx));
  }
  if (existing && existing.stripe_cad_total_cents === null && notCad(inv.currency)) {
    const { stripeCad } = await paymentFacts(inv, paymentIntent ?? existing.stripe_payment_intent_id, true);
    if (stripeCad !== null) patch.stripe_cad_total_cents = stripeCad;
  }
  // Only forward in Stripe's own order: two events read at once can finish out of order (the paid one first).
  const { error } = await supabaseAdmin.from(CHARGES).update(patch).eq('stripe_invoice_id', inv.id).in('status', MOVES_FROM[state.status]);
  if (error) throw error;
  return 'updated';
}

/** Who a credit note belongs to: copied from its invoice's own record (written first when it has none yet, because a note's owner
 *  is kept as first written), else matched from the customer. */
async function ownerOfNote(invoiceId: string, customerId: string | null, captured: EvidenceCaptured):
  Promise<{ kind: ChargeTaxKind | null; orgId: string | null; userId: string | null }> {
  const read = () => supabaseAdmin.from(CHARGES).select('kind, org_id, user_id').eq('stripe_invoice_id', invoiceId)
    .maybeSingle<{ kind: ChargeTaxKind; org_id: string | null; user_id: string | null }>();
  let { data, error } = await read();
  if (error) throw error;
  if (!data) {
    // The invoice's own failure is its own (the daily job's catch-up writes it); the note goes on with the customer match.
    const wrote = await recordInvoiceTax(invoiceId, captured).catch(e => {
      console.error('[charge-tax-record] the note\'s invoice', invoiceId, e);
      return 'skipped' as const;
    });
    if (wrote !== 'skipped') ({ data, error } = await read());
    if (error) throw error;
  }
  if (data) return { kind: data.kind, orgId: data.org_id, userId: data.user_id };
  const buyer = customerId ? await buyerOfStripeCustomer(customerId) : null;
  if (buyer?.kind === 'org') return { kind: null, orgId: buyer.orgId, userId: null };
  return { kind: null, orgId: customerId ? await orgOfInvoice(customerId, null) : null, userId: buyer?.kind === 'user' ? buyer.userId : null };
}

/** One credit note's record (Ask 3), keyed by the note: the webhook and the two places that make notes may all call it. */
export async function recordCreditNoteTax(noteId: string, captured: EvidenceCaptured = 'event'): Promise<RecordOutcome> {
  const [note, { data: existing, error: readError }] = await Promise.all([
    stripe.creditNotes.retrieve(noteId, { expand: NOTE_EXPAND }, STRIPE_OPTS),
    supabaseAdmin.from(NOTES).select('id, fx_rate, status').eq('stripe_credit_note_id', noteId)
      .maybeSingle<{ id: string; fx_rate: number | null; status: 'issued' | 'void' }>(),
  ]);
  if (readError) throw readError;
  const invoiceId = idOf(note.invoice);
  if (!invoiceId) return 'skipped';
  // A new note, or one whose rate could not be read the first time, asks for its rate (a CAD note needs none).
  const issued = noteIssuedAt(note);
  const fx = existing && existing.fx_rate !== null ? null : await fxFor(note.currency, issued);
  const row = buildCreditNoteTaxRecord(note as unknown as CreditNoteLike,
    existing ? { kind: null, orgId: null, userId: null } : await ownerOfNote(invoiceId, idOf(note.customer), captured), { captured, fx });
  if (!row) return 'skipped';
  if (!existing) {
    const { data: inserted, error } = await supabaseAdmin.from(NOTES)
      .upsert(row, { onConflict: 'stripe_credit_note_id', ignoreDuplicates: true }).select('id');
    if (error) throw error;
    if ((inserted ?? []).length > 0) return 'recorded';
  }
  const valuedNow = existing?.fx_rate === null && fx ? cadValuation(note.currency, amountsOf(note), issued, fx) : {};
  // A void is kept with its first date, and never undone by a read that went stale while the void was written.
  const voidKept = existing?.status === 'void';
  let update = supabaseAdmin.from(NOTES)
    .update({ ...(voidKept ? {} : { status: row.status, voided_at: row.voided_at }), ...valuedNow, updated_at: new Date().toISOString() })
    .eq('stripe_credit_note_id', note.id);
  if (row.status === 'issued') update = update.eq('status', 'issued');
  const { error } = await update;
  if (error) throw error;
  return 'updated';
}

/**
 * What has been refunded on an invoice's payment so far (charge.refunded; Stripe's figure is cumulative, so it only ever rises
 * here and an out-of-order event cannot lower it). No record yet = nothing to update (the catch-up writes the record).
 */
export async function recordInvoiceRefunded(invoiceId: string, refundedCents: number): Promise<void> {
  const { error } = await supabaseAdmin.from(CHARGES)
    .update({ refunded_cents: refundedCents, updated_at: new Date().toISOString() })
    .eq('stripe_invoice_id', invoiceId).lt('refunded_cents', refundedCents);
  if (error) throw error;
}

/**
 * Runs one write and REPORTS a failure instead of throwing it: the error to observability and one email to the owner's inbox per
 * document (the daily catch-up writes it later). Used where the caller's own work must go on (the webhook, a refund).
 */
export async function recordTaxOrReport(doc: { kind: 'invoice' | 'credit_note'; id: string }, run: () => Promise<unknown>): Promise<void> {
  try {
    await run();
  } catch (error) {
    void captureError(error, { route: 'charge-tax-record' });
    // A database error may be a plain object with a message, not an Error.
    const message = error instanceof Error ? error.message
      : typeof (error as { message?: unknown } | null)?.message === 'string' ? (error as { message: string }).message : String(error);
    const what = doc.kind === 'invoice' ? 'an invoice' : 'a credit note';
    const link = `${stripeDashboardBase()}/${doc.kind === 'invoice' ? 'invoices' : 'credit_notes'}/${encodeURIComponent(doc.id)}`;
    await sendEmail(ADMIN_EMAIL, `The tax record for ${what} could not be written`,
      `<p>The tax record for ${what} could not be written. The billing work itself went on; the daily online-payments job tries the record again.</p>`
        + `<ul><li>Stripe: ${escapeHtml(doc.id)}</li><li>What went wrong: ${escapeHtml(message)}</li></ul>`
        + `<p><a href="${link}">Open it in Stripe</a> &middot; <a href="${SITE_URL}/platform-admin">Platform admin</a></p>`,
      { kind: 'tax_record_alert', idempotencyKey: `tax-record-alert:${doc.id}`, timeoutMs: 8_000 },
    ).catch(mailError => console.error('[charge-tax-record] the alert could not be sent:', mailError));
  }
}

const CATCH_UP_DAYS = 35;
const CATCH_UP_LIMIT = 2000;
const BACKFILL_PER_RUN = 120;
/** Records written at once by the daily job (each is a few Stripe and database reads). */
const WRITE_CONCURRENCY = 5;
/** The daily job has five minutes for every step and must still write its own record: these steps stop STARTING documents this
 *  long after the job began, and the next run carries on. */
const JOB_BUDGET_MS = 240_000;

/** A run that left records unwritten says so on the job's record (the step is not ok, with its counts); the next run retries. */
function failIfAny<T extends { failed: number }>(what: string, counts: T): T {
  if (counts.failed > 0) throw new Error(`${what}: ${counts.failed} could not be written, the next run tries again (${JSON.stringify(counts)})`);
  return counts;
}

/**
 * The daily job's catch-up (a missed or failed event, or an endpoint not yet sent the events), over the last 35 days:
 *   · every invoice and credit note Stripe made with no record gets one (up to BACKFILL_PER_RUN of each a run);
 *   · every record whose state can still move (open, or written off: a write-off can still be paid or voided) is re-read when
 *     Stripe's list shows it moved or it is older than the list, and any record still waiting for its CAD rate is valued;
 *   · a note Stripe lists as void that our record still shows issued is re-read;
 *   · a refund on a recorded payment that its record does not show yet (a failed or missed charge.refunded) is caught up.
 * One document's failure never stops the rest; the counts go on the job's own record, and any failure makes the step not ok.
 */
export async function catchUpChargeTaxRecords(now: Date): Promise<{ invoices: number; notes: number; refreshed: number; failed: number }> {
  const since = Math.floor(now.getTime() / 1000) - CATCH_UP_DAYS * 86_400;
  const stopAt = now.getTime() + JOB_BUDGET_MS;

  const listedInvoices = await collect(stripe.invoices.list({ created: { gte: since }, limit: 100 }, STRIPE_OPTS),
    inv => (inv.id && inv.status !== 'draft' ? { id: inv.id, status: inv.status } : null), CATCH_UP_LIMIT);
  const invoices = await recordMissing('invoice', listedInvoices.map(i => i.id), 'catch_up', BACKFILL_PER_RUN, stopAt);
  const listedNotes = await collect(stripe.creditNotes.list({ created: { gte: since }, limit: 100 }, STRIPE_OPTS),
    note => ({ id: note.id, status: note.status }), CATCH_UP_LIMIT);
  const notes = await recordMissing('credit_note', listedNotes.map(n => n.id), 'catch_up', BACKFILL_PER_RUN, stopAt);

  const { data: movable, error } = await supabaseAdmin.from(CHARGES).select('stripe_invoice_id, status, fx_rate')
    .eq('livemode', stripeKeyIsLive()).or('status.in.(open,uncollectible),fx_rate.is.null')
    .order('issued_at', { ascending: false }).limit(200);
  if (error) throw error;
  const listedStatus = new Map(listedInvoices.map(i => [i.id, i.status]));
  const stale = ((movable ?? []) as Array<{ stripe_invoice_id: string; status: string; fx_rate: number | null }>)
    .filter(r => r.fx_rate === null || listedStatus.get(r.stripe_invoice_id) !== r.status)
    .map(r => r.stripe_invoice_id);

  const voidIds = listedNotes.filter(n => n.status === 'void').map(n => n.id);
  const unvoided = voidIds.length === 0 ? [] : await fetchAllIn<{ stripe_credit_note_id: string }>(voidIds, (chunk, from, to) =>
    supabaseAdmin.from(NOTES).select('stripe_credit_note_id').in('stripe_credit_note_id', chunk).eq('status', 'issued').range(from, to));

  // Stripe's refunded figure is the charge's running total, so the largest one listed per payment is the latest.
  const refunds = await collect(stripe.refunds.list({ created: { gte: since }, limit: 100, expand: ['data.charge'] }, STRIPE_OPTS), r => {
    const charge = r.charge && typeof r.charge !== 'string' ? r.charge : null;
    const paymentIntent = idOf(charge?.payment_intent ?? null);
    return charge && paymentIntent ? { paymentIntent, cents: charge.amount_refunded } : null;
  }, CATCH_UP_LIMIT);
  const refundedBy = new Map<string, number>();
  for (const r of refunds) refundedBy.set(r.paymentIntent, Math.max(refundedBy.get(r.paymentIntent) ?? 0, r.cents));
  const recorded = refundedBy.size === 0 ? [] : await fetchAllIn<{ stripe_invoice_id: string; stripe_payment_intent_id: string; refunded_cents: number }>(
    [...refundedBy.keys()], (chunk, from, to) => supabaseAdmin.from(CHARGES).select('stripe_invoice_id, stripe_payment_intent_id, refunded_cents')
      .in('stripe_payment_intent_id', chunk).range(from, to));
  const behind = recorded.filter(r => (refundedBy.get(r.stripe_payment_intent_id) ?? 0) > r.refunded_cents);

  let refreshed = 0;
  let failed = invoices.failed + notes.failed;
  const attempt = async (what: string, id: string, write: () => Promise<unknown>) => {
    if (Date.now() > stopAt) return;
    try { await write(); refreshed++; } catch (e) { failed++; console.error(`[charge-tax-record] catch-up ${what}`, id, e); }
  };
  await inParallel(stale, WRITE_CONCURRENCY, id => attempt('refresh', id, () => recordInvoiceTax(id, 'catch_up')));
  await inParallel(unvoided, WRITE_CONCURRENCY, r => attempt('note', r.stripe_credit_note_id, () => recordCreditNoteTax(r.stripe_credit_note_id, 'catch_up')));
  await inParallel(behind, WRITE_CONCURRENCY, r => attempt('refund', r.stripe_invoice_id,
    () => recordInvoiceRefunded(r.stripe_invoice_id, refundedBy.get(r.stripe_payment_intent_id)!)));
  return failIfAny('The tax-record catch-up', { invoices: invoices.written, notes: notes.written, refreshed, failed });
}

/**
 * THE BACKFILL (owner 2026-11-06, Stage 4 Ask 11 = A): every invoice and credit note Stripe made from BACKFILL_FLOOR_ISO up to the
 * first record the webhook wrote at the time (or up to now, before there is one), through the same builder, marked `backfill` (its
 * evidence is read now, never claimed as at the sale). Run by the daily job after the catch-up. Its window ends where the writer
 * began, so it is fixed and small once Stage 3 is live; re-running it finds nothing to add. One document's failure never stops the rest.
 */
export async function backfillChargeTaxRecords(now: Date): Promise<{ invoices: number; notes: number; failed: number; until: string }> {
  const floor = Math.floor(new Date(BACKFILL_FLOOR_ISO).getTime() / 1000);
  const stopAt = now.getTime() + JOB_BUDGET_MS;
  const { data: first, error } = await supabaseAdmin.from(CHARGES).select('created_at')
    .eq('livemode', stripeKeyIsLive()).eq('evidence_captured', 'event').order('created_at', { ascending: true }).limit(1);
  if (error) throw error;
  const untilIso = (first?.[0] as { created_at?: string } | undefined)?.created_at ?? now.toISOString();
  const until = Math.ceil(new Date(untilIso).getTime() / 1000);
  if (until <= floor || Date.now() > stopAt) return { invoices: 0, notes: 0, failed: 0, until: untilIso };

  const window = { created: { gte: floor, lt: until }, limit: 100 };
  const invoiceIds = await collect(stripe.invoices.list(window, STRIPE_OPTS), inv => (inv.id && inv.status !== 'draft' ? inv.id : null));
  // At most BACKFILL_PER_RUN writes a run, invoices first; the next run carries on from what is still missing.
  const invoices = await recordMissing('invoice', invoiceIds, 'backfill', BACKFILL_PER_RUN, stopAt);
  const noteIds = await collect(stripe.creditNotes.list(window, STRIPE_OPTS), note => note.id);
  const notes = await recordMissing('credit_note', noteIds, 'backfill', Math.max(0, BACKFILL_PER_RUN - invoices.tried), stopAt);
  return failIfAny('The tax-record backfill', { invoices: invoices.written, notes: notes.written, failed: invoices.failed + notes.failed, until: untilIso });
}

/** The listed documents, each picked down to what the caller keeps (null = left out), stopping at `max` kept. */
async function collect<T, R>(pages: AsyncIterable<T>, pick: (doc: T) => R | null, max = Infinity): Promise<R[]> {
  const out: R[] = [];
  for await (const doc of pages) {
    const kept = pick(doc);
    if (kept !== null) out.push(kept);
    if (out.length >= max) break;
  }
  return out;
}

/** Writes a record for each of these Stripe ids that has none yet, at most `limit` of them, a few at a time, starting none after
 *  `stopAt`. A failure is counted and logged, never thrown. `tried` = how many were missing (within the limit). */
async function recordMissing(doc: 'invoice' | 'credit_note', ids: string[], captured: EvidenceCaptured, limit: number, stopAt: number):
  Promise<{ written: number; tried: number; failed: number }> {
  const [table, column, record] = doc === 'invoice'
    ? [CHARGES, 'stripe_invoice_id', recordInvoiceTax] as const
    : [NOTES, 'stripe_credit_note_id', recordCreditNoteTax] as const;
  const missing = (await notRecorded(table, column, ids)).slice(0, limit);
  let written = 0;
  let failed = 0;
  await inParallel(missing, WRITE_CONCURRENCY, async id => {
    if (Date.now() > stopAt) return;
    try { if (await record(id, captured) === 'recorded') written++; } catch (e) { failed++; console.error(`[charge-tax-record] ${captured} ${doc}`, id, e); }
  });
  return { written, tried: missing.length, failed };
}

/** Which of these Stripe ids have no row yet. */
async function notRecorded(table: string, column: string, ids: string[]): Promise<string[]> {
  const have = await fetchAllIn<Record<string, string>>(ids, (chunk, from, to) =>
    supabaseAdmin.from(table).select(column).in(column, chunk).range(from, to));
  const recorded = new Set(have.map(r => r[column]));
  return ids.filter(id => !recorded.has(id));
}
