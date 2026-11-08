import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { stripeKeyIsLive } from './online-payments-switch';
import { readAllPages, type NeedsLookRecord } from './console-money-needs-look';
import { judgeSales, registrationDateOrNull } from './console-money-sales-store';
import { customerSharing, type CustomerWorkspace } from './console-money-stripe';

/**
 * TODAY'S "SALES TAX" ROW AND THE CLUBS FILTER (GST/HST Stage 3 Part 3b; drawing tab 5 "Across clubs", owner Ask 5).
 * Platform-wide: how many sales need a look and have not been marked, and which clubs show them.
 *
 * ⚖ THE SAME NUMBER AS THE CLUB'S STRIP, BY CONSTRUCTION. The count runs `judgeSales` (lib/console-money-sales-store.ts), the one
 * rule a club's read uses (the eight checks, the registration date, the credit notes, the marks), and it counts only the sales a
 * club's Money tab would SHOW: a sale whose Stripe customer belongs to exactly one organization, not shared with another club
 * (the Money route refuses a shared customer, so a sale there could not be looked at anywhere). With the registration date
 * unread, checks 1-3 are off and 4-8 run — exactly the strip's rule — so the two can never differ.
 * ⚖ A coach who pays for several portals has ONE set of sales: a sale counts once (distinct invoice), whichever portal shows it.
 * ⚖ Read only. Nothing here sums, exports or reports tax.
 *
 * Cost: every kept record of this mode is read once, page by page, narrow columns only (the rules need nothing else), and the
 * answer is remembered for 30 seconds — Today, the menu's counts and the Clubs list share one read.
 */

export type SalesTaxWaiting = { sales: number; orgIds: string[] };

/** The columns the checks read, plus the two keys the count needs. Nothing about the buyer is read. */
const WAIT_COLUMNS = [
  'stripe_invoice_id', 'stripe_customer_id', 'issued_at', 'status', 'currency', 'gst_hst_position', 'gst_hst_position_why', 'tax_lines',
  'review_reason', 'review_note', 'evidence_missing', 'evidence_country', 'evidence_region', 'refunded_cents',
].join(', ');

type WaitRecord = NeedsLookRecord & { stripe_customer_id: string };

/**
 * Which organization shows each Stripe customer's sales: a customer that exactly one organization holds and no other club shares.
 * Also read by the GST/HST return's route (Stage 4b Session B) to say "on no club's list" for a shared customer's sale, so the
 * worksheet and this count can never disagree on which sales a club shows.
 */
export async function visibleCustomers(): Promise<Map<string, string>> {
  const [orgs, workspaces] = await Promise.all([
    readAllPages<{ id: string; stripe_customer_id: string }>((from, to) =>
      supabaseAdmin.from('organizations').select('id, stripe_customer_id').not('stripe_customer_id', 'is', null)
        .order('id').range(from, to) as unknown as PromiseLike<{ data: { id: string; stripe_customer_id: string }[] | null; error: unknown }>),
    readAllPages<CustomerWorkspace & { stripe_customer_id: string }>((from, to) =>
      supabaseAdmin.from('team_workspaces').select('billing_owner_org_id, billing_owner_user_id, workspace_org_id, stripe_customer_id')
        .not('stripe_customer_id', 'is', null).order('workspace_org_id').range(from, to) as unknown as PromiseLike<{ data: (CustomerWorkspace & { stripe_customer_id: string })[] | null; error: unknown }>),
  ]);
  const holders = new Map<string, string[]>();
  for (const o of orgs) if (!o.stripe_customer_id.startsWith('mock_')) holders.set(o.stripe_customer_id, [...(holders.get(o.stripe_customer_id) ?? []), o.id]);
  const portals = new Map<string, CustomerWorkspace[]>();
  for (const w of workspaces) {
    const mine = portals.get(w.stripe_customer_id);
    if (mine) mine.push(w); else portals.set(w.stripe_customer_id, [w]);
  }
  const out = new Map<string, string>();
  // `customerSharing` owns the rule (exactly one organization holds it, no other club's portal on it), as on a club's own read.
  for (const [customerId, ids] of holders) if (!customerSharing(ids[0], ids.length, portals.get(customerId) ?? []).shared) out.set(customerId, ids[0]);
  return out;
}

async function count(): Promise<SalesTaxWaiting> {
  const live = stripeKeyIsLive();
  const [registration, shown] = await Promise.all([registrationDateOrNull(), visibleCustomers()]);
  // A sale issued before the registration day is never on the list (the rules say so too): not even read. The day is a plain date,
  // read as midnight UTC, which is hours EARLIER than the Toronto day it names, so it can only keep a sale the rules then drop.
  const paged = await readAllPages<WaitRecord>((from, to) => {
    let q = supabaseAdmin.from('platform_charge_tax_records').select(WAIT_COLUMNS).eq('livemode', live).neq('status', 'void');
    if (registration) q = q.gte('issued_at', registration);
    return q.order('stripe_invoice_id').range(from, to) as unknown as PromiseLike<{ data: WaitRecord[] | null; error: unknown }>;
  });
  // One row per invoice (a sale written while the pages are read can shift onto two pages), and only a sale a club would show.
  const records = [...new Map(paged.filter(r => shown.has(r.stripe_customer_id)).map(r => [r.stripe_invoice_id, r])).values()];
  const judged = await judgeSales(records, registration);
  return { sales: judged.standing.length, orgIds: [...new Set(judged.standing.map(r => shown.get(r.stripe_customer_id)!))] };
}

const FRESH_MS = 30_000;
let memo: { at: number; value: Promise<SalesTaxWaiting | null> } | null = null;

/** Today's count and the clubs that show those sales; `null` = it could not be read (Today says "Not read", never 0). */
export function readSalesTaxWaiting(): Promise<SalesTaxWaiting | null> {
  const now = Date.now();
  if (memo && now - memo.at < FRESH_MS) return memo.value;
  const value = count().catch((err: unknown) => {
    console.warn('[platform-admin] sales-tax count failed:', (err as { code?: string }).code ?? 'error');
    return null;
  });
  const mine = { at: now, value };
  memo = mine;
  // A failed read is not remembered: the next ask reads again.
  void value.then(v => { if (v === null && memo === mine) memo = null; });
  return value;
}

/** A mark or a put-back changes the count: the next ask on this server reads again (Today's own 30 s snapshot still applies, by design). */
export function forgetSalesTaxWaiting(): void {
  memo = null;
}
