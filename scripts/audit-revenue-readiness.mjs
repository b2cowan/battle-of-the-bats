/**
 * Manually invoked, read-only Stripe configuration inventory for the revenue project.
 * Only retrieve/list APIs; never changes settings, charges a card, or queries customers.
 * Reports exclude secrets, tax IDs, banking details and customer-level records.
 *
 * node scripts/audit-revenue-readiness.mjs --env .env.production.local --mode live --date YYYY-MM-DD --out <local.json>
 * node scripts/audit-revenue-readiness.mjs --env .env.local --mode sandbox --date YYYY-MM-DD --out <local.json>
 * No hook, scheduler, package script, database connection or production mutation.
 */
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import Stripe from 'stripe';

const args = process.argv.slice(2);
const arg = key => { const i = args.indexOf(key); return i >= 0 ? args[i + 1] : null; };
const mode = arg('--mode');
const envFile = arg('--env');
const observedOn = arg('--date');
const output = arg('--out');
if (!['live', 'sandbox'].includes(mode) || !envFile || !output || !/^\d{4}-\d{2}-\d{2}$/.test(observedOn ?? '')) {
  throw new Error('Specify --env, --mode live|sandbox, --date YYYY-MM-DD, and --out.');
}
// Parse just this file; do not silently use another environment's inherited credentials.
const env = dotenv.parse(fs.readFileSync(envFile));
const secret = env.STRIPE_SECRET_KEY ?? '';
const actualMode = secret.startsWith('sk_live_') ? 'live' : secret.startsWith('sk_test_') ? 'sandbox' : null;
if (mode !== actualMode) throw new Error('The selected file/key does not match the explicit mode.');
const outPath = path.resolve(output);
const permitted = path.resolve('docs/projects/active/revenue-accounting-evidence');
if (!outPath.startsWith(permitted + path.sep)) throw new Error('Write reports only within the project evidence directory.');
const stripe = new Stripe(secret, { apiVersion: '2026-04-22.dahlia', maxNetworkRetries: 0, timeout: 20000 });
const report = {
  observedOn, environment: mode, source: 'Stripe retrieve/list APIs', apiVersion: '2026-04-22.dahlia',
  limitations: ['Configuration snapshot, not a tax opinion or production-environment variable audit.',
    'No customers, payment history, tax IDs, bank details or customer-level subscription records requested.',
    'A setting being configured does not prove app flows use it or registrations are legally sufficient.'],
  sections: {}, errors: [],
};
async function inspect(name, read) {
  try { report.sections[name] = await read(); }
  catch (error) { report.errors.push({ section: name, type: error.type ?? error.name ?? 'Error', code: error.code ?? null, httpStatus: error.statusCode ?? null }); }
}
await inspect('account', async () => {
  const a = await stripe.accounts.retrieve();
  return { country: a.country ?? null, businessType: a.business_type ?? null,
    defaultCurrency: a.default_currency ?? null, chargesEnabled: a.charges_enabled,
    payoutsEnabled: a.payouts_enabled, detailsSubmitted: a.details_submitted,
    feePayer: a.controller?.fees?.payer ?? null, paymentLossResponsibility: a.controller?.losses?.payments ?? null };
});
await inspect('prices', async () => {
  const list = await stripe.prices.list({ active: true, limit: 100, expand: ['data.product', 'data.currency_options'] });
  return { complete: !list.has_more, count: list.data.length, items: list.data.map(p => ({
    priceId: p.id, currency: p.currency, unitAmount: p.unit_amount, taxBehavior: p.tax_behavior,
    recurringInterval: p.recurring?.interval ?? null, intervalCount: p.recurring?.interval_count ?? null,
    productId: typeof p.product === 'string' ? p.product : p.product.id,
    productName: typeof p.product === 'object' && !p.product.deleted ? p.product.name : null,
    productTaxCode: typeof p.product === 'object' && !p.product.deleted
      ? (typeof p.product.tax_code === 'string' ? p.product.tax_code : p.product.tax_code?.id ?? null) : null,
    currencyOptions: Object.fromEntries(Object.entries(p.currency_options ?? {}).map(([currency, option]) => [currency,
      { unitAmount: option.unit_amount, taxBehavior: option.tax_behavior }])),
  })) };
});
await inspect('taxSettings', async () => {
  const s = await stripe.tax.settings.retrieve();
  return { status: s.status, defaultTaxCode: s.defaults?.tax_code ?? null,
    defaultTaxBehavior: s.defaults?.tax_behavior ?? null, originCountry: s.head_office?.address?.country ?? null,
    missingFields: s.status_details?.pending?.missing_fields ?? [] };
});
await inspect('taxRegistrations', async () => {
  const list = await stripe.tax.registrations.list({ limit: 100 });
  return { complete: !list.has_more, count: list.data.length, items: list.data.map(r => ({
    country: r.country, status: r.status, activeFrom: r.active_from, expiresAt: r.expires_at,
    usState: r.country_options?.us?.state ?? null,
  })) };
});
await inspect('webhooks', async () => {
  const list = await stripe.webhookEndpoints.list({ limit: 100 });
  return { complete: !list.has_more, items: list.data.map(e => {
    const url = new URL(e.url);
    return { destination: url.origin + url.pathname, status: e.status, apiVersion: e.api_version,
      enabledEvents: e.enabled_events };
  }) };
});
await inspect('portal', async () => {
  const list = await stripe.billingPortal.configurations.list({ limit: 100 });
  return { complete: !list.has_more, items: list.data.map(c => ({
    active: c.active, isDefault: c.is_default,
    subscriptionUpdateEnabled: c.features?.subscription_update?.enabled ?? false,
    subscriptionCancelEnabled: c.features?.subscription_cancel?.enabled ?? false,
    invoiceHistoryEnabled: c.features?.invoice_history?.enabled ?? false,
    customerUpdateEnabled: c.features?.customer_update?.enabled ?? false,
    customerAllowedUpdates: c.features?.customer_update?.allowed_updates ?? [],
  })) };
});
fs.mkdirSync(permitted, { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ observedOn, environment: mode, completedSections: Object.keys(report.sections),
  errorSections: report.errors.map(e => e.section), report: path.relative(process.cwd(), outPath) }));
if (report.errors.length) process.exitCode = 2;
