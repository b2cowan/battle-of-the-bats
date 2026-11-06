import 'server-only';
/**
 * The fee invoices a club still owes, for the morning brief's `feesOwed` (Fee invoice alerts, Part 2). ONE cheap read of
 * `platform_fee_invoices`: this org's own rows (explicit `org_id` — the table is server-only), this server's Stripe mode
 * (`livemode` must equal the key's, as every other reader of the table), status `open`. No Stripe call.
 */
import { supabaseAdmin } from './supabase-admin';
import { stripeKeyIsLive } from './stripe-mode';
import { FEE_INVOICE_OWED_STATUS, feesOwedFrom, type FeeInvoiceOwedRow, type FeesOwed } from './fee-invoice-alert';

/** Throws on a failed read — the route turns that into "could not read", never a calm zero. */
export async function readFeesOwed(orgId: string, now: Date = new Date()): Promise<FeesOwed> {
  const { data, error } = await supabaseAdmin
    .from('platform_fee_invoices')
    .select('due_at, invoice_number, total, amount_due, hosted_invoice_url')
    .eq('org_id', orgId)
    .eq('livemode', stripeKeyIsLive())
    .eq('status', FEE_INVOICE_OWED_STATUS)
    .limit(1000);
  if (error) throw error;
  return feesOwedFrom((data ?? []) as FeeInvoiceOwedRow[], now);
}
