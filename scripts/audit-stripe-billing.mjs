/**
 * Read-only Stripe/Supabase billing audit.
 *
 * Usage:
 *   node scripts/audit-stripe-billing.mjs --env .env.production.local
 *   node scripts/audit-stripe-billing.mjs --env .env.local --environment sandbox --allow-test
 *
 * Required env:
 *   STRIPE_SECRET_KEY
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import dotenv from 'dotenv';
import Stripe from 'stripe';
import { stripeKeyIsLive, stripeKeyIsTest } from '../lib/stripe-mode.ts';
import { auditPortal, check } from './lib/stripe-portal-audit.mjs';
import { STRIPE_API_VERSION } from '../lib/stripe.ts';
import { PLAN_CONFIG } from '../lib/plan-config.ts';

const args = process.argv.slice(2);

function argValue(name, fallback = null) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
}

function hasArg(name) {
  return args.includes(name);
}

if (hasArg('--help') || hasArg('-h')) {
  console.log(`
Stripe billing audit

Usage:
  node scripts/audit-stripe-billing.mjs --env .env.production.local
  node scripts/audit-stripe-billing.mjs --env .env.local --environment sandbox --allow-test --webhook-url https://<dev site>/api/billing/webhook

Checks (against the target in BUSINESS_DECISIONS.md, 2026-11-06 "Stripe set-up order"):
  - Supabase stripe_prices live/sandbox rows
  - Stripe price active status, amount, CAD currency, recurring interval, lookup key (five paid plans, monthly + yearly)
  - Retired plans (team add-on, rep team) are gone (archived is accepted where Stripe refuses a delete)
  - Active prices that no slot uses (leftovers to archive)
  - Stripe product active status and product-name sanity
  - Billing webhook URL, event list, status, and API version; every other endpoint listed for comparison
  - Customer portal core feature configuration
  - Stripe account charges/payouts/branding basics
`);
  process.exit(0);
}

const envPath = argValue('--env', '.env.local');
const requestedEnvironment = argValue('--environment', null);
const allowTest = hasArg('--allow-test');
const jsonOutput = hasArg('--json');

dotenv.config({ path: envPath });

const stripeSecretKey = process.env.STRIPE_SECRET_KEY ?? '';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

const keyEnvironment = stripeKeyIsLive(stripeSecretKey)
  ? 'live'
  : stripeKeyIsTest(stripeSecretKey)
    ? 'sandbox'
    : null;
const environment = requestedEnvironment ?? keyEnvironment ?? 'live';

// Canonical host (owner ruling 2026-08-08): the live webhook endpoint lives on www — the apex now
// 307s there, and webhook deliveries do not follow redirects, so an apex match would false-FAIL.
const APP_URL = 'https://www.fieldlogichq.ca';
// The test sandbox's webhook points at the dev site, not www: pass --webhook-url for a sandbox audit.
const WEBHOOK_URL = argValue('--webhook-url', `${APP_URL}/api/billing/webhook`);

const EXPECTED_WEBHOOK_EVENTS = [
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.payment_succeeded',
  'invoice.payment_failed',
  'customer.subscription.trial_will_end',
  // Plans & pricing Stage 0, Part 4: disputes and refunds on our subscription charges (owner adds them in the dashboard).
  'charge.dispute.created',
  'charge.dispute.updated',
  'charge.dispute.closed',
  'charge.refunded',
  // Card on file: the webhook's payment_method.attached / .detached arms (a card changed in the billing portal arrives with no checkout
  // session). Found missing from the list on 2026-11-06 when the test sandbox's endpoint was compared with the code.
  'payment_method.attached',
  'payment_method.detached',
  // A club's own Stripe-fees invoice (Club Tier Stage 12d-1): the webhook routes EVERY invoice.* event carrying the fee-invoice marker to
  // that invoice's record (route.ts, the FEE_INVOICE_META branch), and docs/agents/ops/stripe-setup-guide.md Step 5 lists these four.
  'invoice.paid',
  'invoice.voided',
  'invoice.marked_uncollectible',
  'invoice.finalized',
];

// THE TARGET (docs/agents/strategy/BUSINESS_DECISIONS.md, 2026-11-06 "Stripe set-up order"; PROPOSED until the owner confirms it,
// reconciled to docs/agents/strategy/PLAN_PRICING_FACTS.md and lib/plan-config.ts). Five paid plans, a monthly and a yearly price each.
// Product names are read from the plan labels in lib/plan-config.ts (owner 2026-11-06: one name across the portals, marketing and
// Stripe). A "FieldLogicHQ - " prefix is accepted on any of them.
// Not covered until their own work lands: tax settings and product tax codes (GST/HST Stage 2), any USD price (none is decided).
// The expected product name is the plan's label in lib/plan-config.ts (the one name the app, the pricing page and the help read), so the
// audit cannot drift from them: rename a plan there and the audit expects the new name in Stripe.
function names(planId) {
  const label = PLAN_CONFIG[planId].label;
  return [label, `FieldLogicHQ - ${label}`];
}

const EXPECTED_PRICE_SLOTS = [
  slot('team', 'monthly', 2900, 'flhq_team_monthly_live', names('team')),
  slot('team', 'annual', 29000, 'flhq_team_annual_live', names('team')),
  slot('tournament_plus', 'monthly', 3900, 'flhq_tournament_plus_monthly_live', names('tournament_plus')),
  slot('tournament_plus', 'annual', 39000, 'flhq_tournament_plus_annual_live', names('tournament_plus')),
  slot('league', 'monthly', 8900, 'flhq_league_monthly_live', names('league')),
  slot('league', 'annual', 89000, 'flhq_league_annual_live', names('league')),
  // Club repriced $179 -> $219 / $1,790 -> $2,190 on 2026-06-22 (Club Repackaging); live prices wired 2026-06-24.
  slot('club', 'monthly', 21900, 'flhq_club_monthly_live', names('club')),
  slot('club', 'annual', 219000, 'flhq_club_annual_live', names('club')),
  // The upper Club band, public name "Club · Association" (internal key club_large; slots seeded by migration 146).
  slot('club_large', 'monthly', 37900, 'flhq_club_large_monthly_live', names('club_large')),
  slot('club_large', 'annual', 379000, 'flhq_club_large_annual_live', names('club_large')),
];

// RETIRED plans: the per-team meter and the org-billed team add-on ended with Club Repackaging (2026-06-22). Owner 2026-11-06: nobody
// is or ever was on them in production, so the clean target is that they are GONE (deleted in Stripe, slot rows removed). Where Stripe
// refuses a delete (a price that has been used), ARCHIVED is accepted. A slot row that still points at an ACTIVE price is a cleanup item.
const RETIRED_PRICE_SLOTS = [
  ['org_team_addon', 'monthly'],
  ['org_team_addon', 'annual'],
  ['rep_team', 'monthly'],
  ['rep_team', 'annual'],
];

function slot(planId, billingCycle, unitAmount, liveLookupKey, productNames) {
  return {
    planId,
    billingCycle,
    unitAmount,
    currency: 'cad',
    interval: billingCycle === 'annual' ? 'year' : 'month',
    lookupKey: environment === 'live'
      ? liveLookupKey
      : liveLookupKey.replace(/_live$/, '_sandbox'),
    productNames,
  };
}

function sameSet(actual, expected) {
  return expected.every(item => actual.includes(item));
}

function normalizeName(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/\s+/g, ' ');
}

function productNameMatches(actual, expectedNames) {
  const actualName = normalizeName(actual);
  return expectedNames.some(expected => actualName === normalizeName(expected));
}

function assertEnv() {
  const missing = [];
  if (!stripeSecretKey) missing.push('STRIPE_SECRET_KEY');
  if (!supabaseUrl) missing.push('NEXT_PUBLIC_SUPABASE_URL');
  if (!supabaseServiceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (missing.length > 0) {
    throw new Error(`Missing ${missing.join(', ')} in ${envPath}`);
  }

  if (environment === 'live' && !stripeKeyIsLive(stripeSecretKey)) {
    throw new Error('Refusing live audit because STRIPE_SECRET_KEY is not a live key. Pass --environment sandbox --allow-test for sandbox.');
  }

  if (environment === 'sandbox' && !allowTest) {
    throw new Error('Sandbox audit requires --allow-test so you do not accidentally audit the wrong Stripe mode.');
  }
}

async function fetchStripePriceRows() {
  const base = supabaseUrl.replace(/\/$/, '');
  const params = new URLSearchParams({
    select: 'id,plan_id,billing_cycle,environment,price_id,product_name,updated_at',
    environment: `eq.${environment}`,
    order: 'plan_id.asc,billing_cycle.asc',
  });
  const response = await fetch(`${base}/rest/v1/stripe_prices?${params}`, {
    headers: {
      apikey: supabaseServiceRoleKey,
      Authorization: `Bearer ${supabaseServiceRoleKey}`,
    },
  });

  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!response.ok) {
    throw new Error(`Supabase stripe_prices query failed with HTTP ${response.status}: ${typeof body === 'string' ? body : JSON.stringify(body)}`);
  }

  return Array.isArray(body) ? body : [];
}

async function retrieveProduct(stripe, productIdOrObject) {
  if (!productIdOrObject) return null;
  if (typeof productIdOrObject === 'object') return productIdOrObject;
  return stripe.products.retrieve(productIdOrObject);
}

async function auditPrices(stripe, dbRows) {
  const checks = [];
  const rowsBySlot = new Map(dbRows.map(row => [`${row.plan_id}:${row.billing_cycle}`, row]));
  const seenPriceIds = new Map();

  for (const row of dbRows) {
    if (!row.price_id) continue;
    const existing = seenPriceIds.get(row.price_id);
    if (existing) {
      checks.push(check(
        'FAIL',
        'prices',
        'duplicate_price_id',
        `${row.price_id} is used by both ${existing} and ${row.plan_id}/${row.billing_cycle}.`,
      ));
    } else {
      seenPriceIds.set(row.price_id, `${row.plan_id}/${row.billing_cycle}`);
    }
  }

  for (const expected of EXPECTED_PRICE_SLOTS) {
    const slotKey = `${expected.planId}:${expected.billingCycle}`;
    const row = rowsBySlot.get(slotKey);
    const label = `${expected.planId}/${expected.billingCycle}`;

    if (!row) {
      checks.push(check('FAIL', 'prices', label, `Missing stripe_prices row for ${label}/${environment}.`));
      continue;
    }

    if (!row.price_id) {
      checks.push(check('FAIL', 'prices', label, `Missing price_id in Supabase for ${label}/${environment}.`));
      continue;
    }

    try {
      const price = await stripe.prices.retrieve(row.price_id, { expand: ['product'] });
      const product = await retrieveProduct(stripe, price.product);
      const actualProductName = product?.name ?? null;

      if (!price.active) {
        checks.push(check('FAIL', 'prices', label, `${row.price_id} exists but is inactive in Stripe.`));
      }

      if (price.livemode !== (environment === 'live')) {
        checks.push(check('FAIL', 'prices', label, `${row.price_id} livemode=${price.livemode}; expected ${environment}.`));
      }

      if (price.unit_amount !== expected.unitAmount) {
        checks.push(check('FAIL', 'prices', label, `${row.price_id} amount is ${price.unit_amount}; expected ${expected.unitAmount}.`));
      }

      if (price.currency !== expected.currency) {
        checks.push(check('FAIL', 'prices', label, `${row.price_id} currency is ${price.currency}; expected ${expected.currency}.`));
      }

      if (price.type !== 'recurring') {
        checks.push(check('FAIL', 'prices', label, `${row.price_id} type is ${price.type}; expected recurring.`));
      }

      if (price.recurring?.interval !== expected.interval || price.recurring?.interval_count !== 1) {
        checks.push(check(
          'FAIL',
          'prices',
          label,
          `${row.price_id} interval is ${price.recurring?.interval_count ?? 'n/a'} ${price.recurring?.interval ?? 'n/a'}; expected 1 ${expected.interval}.`,
        ));
      }

      if (price.lookup_key !== expected.lookupKey) {
        checks.push(check('WARN', 'prices', label, `${row.price_id} lookup_key is ${price.lookup_key ?? 'blank'}; expected ${expected.lookupKey}.`));
      }

      if (product && !product.active) {
        checks.push(check('FAIL', 'products', label, `${product.id} is inactive.`));
      }

      if (actualProductName && !productNameMatches(actualProductName, expected.productNames)) {
        checks.push(check('WARN', 'products', label, `${product.id} is named "${actualProductName}"; expected one of: ${expected.productNames.join(' | ')}.`));
      }

      if (row.product_name && actualProductName && !productNameMatches(row.product_name, expected.productNames)) {
        checks.push(check('WARN', 'database', label, `Supabase product_name is "${row.product_name}"; consider aligning it with the customer-facing product name.`));
      }

      const hardFailuresForSlot = checks.some(item =>
        item.status === 'FAIL' &&
        (item.area === 'prices' || item.area === 'products') &&
        item.key === label
      );
      if (!hardFailuresForSlot) {
        checks.push(check(
          'PASS',
          'prices',
          label,
          `${row.price_id} is active and matches ${expected.unitAmount} ${expected.currency.toUpperCase()} / ${expected.interval}.`,
          { price_id: row.price_id },
        ));
      }
    } catch (error) {
      checks.push(check('FAIL', 'prices', label, `${row.price_id} could not be retrieved from Stripe: ${error.message}`));
    }
  }

  // Retired plans (the per-team meter, the org-billed add-on): the target is gone (deleted); archived is accepted where Stripe refuses a delete.
  for (const [planId, billingCycle] of RETIRED_PRICE_SLOTS) {
    const label = `${planId}/${billingCycle}`;
    const row = rowsBySlot.get(`${planId}:${billingCycle}`);
    if (!row || !row.price_id) {
      checks.push(check('PASS', 'prices', label, 'Retired plan: no price on this slot, nothing to archive.'));
      continue;
    }
    try {
      const price = await stripe.prices.retrieve(row.price_id);
      checks.push(price.active
        ? check('WARN', 'prices', label, `${row.price_id} is a retired plan's price and is still ACTIVE in Stripe; the target is deleted (or archived where Stripe refuses a delete).`)
        : check('PASS', 'prices', label, `${row.price_id} is a retired plan's price and is archived (delete it if Stripe allows).`));
    } catch (error) {
      checks.push(error?.code === 'resource_missing'
        ? check('WARN', 'prices', label, `${row.price_id} is gone from Stripe but the slot row still points at it; remove the slot row.`)
        : check('FAIL', 'prices', label, `${row.price_id} could not be retrieved from Stripe: ${error.message}`));
    }
  }

  // A slot row for a plan the target does not list at all.
  const known = new Set([
    ...EXPECTED_PRICE_SLOTS.map(item => item.planId),
    ...RETIRED_PRICE_SLOTS.map(([planId]) => planId),
  ]);
  for (const row of dbRows) {
    if (!known.has(row.plan_id)) {
      checks.push(check('WARN', 'prices', `${row.plan_id}/${row.billing_cycle}`, `A stripe_prices row exists for "${row.plan_id}", which the target does not list.`));
    }
  }

  return checks;
}

// "No old plans or prices": every ACTIVE price in this Stripe account that no slot row points at. The price book's own slots are
// audited above; anything else active is a leftover to archive (or a plan the target is missing).
async function auditStrayPrices(stripe, dbRows) {
  const checks = [];
  const slotted = new Set(dbRows.map(row => row.price_id).filter(Boolean));
  let stray = 0;
  for await (const price of stripe.prices.list({ active: true, limit: 100, expand: ['data.product'] })) {
    if (slotted.has(price.id)) continue;
    stray += 1;
    const productName = typeof price.product === 'object' && price.product
      ? (price.product.name ?? `${price.product.id} (deleted product)`)
      : String(price.product);
    const amount = price.unit_amount == null ? 'n/a' : (price.unit_amount / 100).toFixed(2);
    const interval = price.recurring ? `${price.recurring.interval_count} ${price.recurring.interval}` : 'one-time';
    checks.push(check(
      'WARN',
      'prices',
      price.id,
      `Active price not used by any slot: "${productName}", ${amount} ${String(price.currency).toUpperCase()} / ${interval}, lookup key ${price.lookup_key ?? 'none'}. Archive it, or add its plan to the target.`,
    ));
  }
  if (stray === 0) {
    checks.push(check('PASS', 'prices', 'stray_active_prices', 'Every active price in this Stripe account is used by a slot.'));
  }
  return checks;
}

async function auditWebhook(stripe) {
  const checks = [];
  const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
  const matches = endpoints.data.filter(endpoint => endpoint.url === WEBHOOK_URL);

  // Every other endpoint is listed so it can be compared with the written list (the two Connect endpoints for family payments
  // are expected; anything stale is not). Informational: this script does not know which others are right.
  for (const other of endpoints.data.filter(endpoint => endpoint.url !== WEBHOOK_URL)) {
    checks.push(check(
      'PASS',
      'webhook',
      `other_endpoint:${other.id}`,
      `Other endpoint (compare with the written list): ${other.url}, ${other.status}, ${(other.enabled_events ?? []).length} event(s), api ${other.api_version ?? 'account default'}.`,
    ));
  }

  if (matches.length === 0) {
    return [...checks, check('FAIL', 'webhook', 'endpoint', `No Stripe webhook endpoint found for ${WEBHOOK_URL}.`)];
  }

  if (matches.length > 1) {
    checks.push(check('WARN', 'webhook', 'endpoint_duplicates', `${matches.length} webhook endpoints point to ${WEBHOOK_URL}; only one active production endpoint is expected.`));
  }

  const endpoint = matches.find(item => item.status === 'enabled') ?? matches[0];
  if (endpoint.status !== 'enabled') {
    checks.push(check('FAIL', 'webhook', 'endpoint_status', `${endpoint.id} status is ${endpoint.status}; expected enabled.`));
  } else {
    checks.push(check('PASS', 'webhook', 'endpoint_status', `${endpoint.id} is enabled.`));
  }

  if (endpoint.api_version !== STRIPE_API_VERSION) {
    checks.push(check('WARN', 'webhook', 'api_version', `${endpoint.id} API version is ${endpoint.api_version ?? 'account default'}; app code uses ${STRIPE_API_VERSION}.`));
  } else {
    checks.push(check('PASS', 'webhook', 'api_version', `${endpoint.id} uses ${STRIPE_API_VERSION}.`));
  }

  const enabledEvents = endpoint.enabled_events ?? [];
  if (enabledEvents.includes('*') || sameSet(enabledEvents, EXPECTED_WEBHOOK_EVENTS)) {
    checks.push(check('PASS', 'webhook', 'events', `${endpoint.id} listens to all required billing events.`));
  } else {
    const missing = EXPECTED_WEBHOOK_EVENTS.filter(event => !enabledEvents.includes(event));
    checks.push(check('FAIL', 'webhook', 'events', `${endpoint.id} is missing required event(s): ${missing.join(', ')}.`));
  }
  // Events the endpoint is sent that the billing webhook has no arm for: noise to switch off (it answers 200 and does nothing).
  const extra = enabledEvents.filter(event => event !== '*' && !EXPECTED_WEBHOOK_EVENTS.includes(event));
  if (extra.length > 0) {
    checks.push(check('WARN', 'webhook', 'extra_events', `${endpoint.id} is also sent event(s) that are not on the expected list: ${extra.join(', ')}. Usually harmless (the app ignores an event it has no arm for); switch them off, or add them to the list if the app now acts on them.`));
  }

  return checks;
}

// The portal checks (Plans & pricing S8, Plans end at renewal G13) live in scripts/lib/stripe-portal-audit.mjs, shared with
// the test-clock rehearsal (scripts/rehearse-plan-ending.mjs), so the two read one copy.

async function auditAccount(stripe) {
  const checks = [];
  const account = await stripe.accounts.retrieve();

  if (account.charges_enabled) {
    checks.push(check('PASS', 'account', 'charges_enabled', 'Live charges are enabled.'));
  } else {
    checks.push(check('FAIL', 'account', 'charges_enabled', 'Live charges are not enabled.'));
  }

  if (account.payouts_enabled) {
    checks.push(check('PASS', 'account', 'payouts_enabled', 'Payouts are enabled.'));
  } else {
    checks.push(check('WARN', 'account', 'payouts_enabled', 'Payouts are not enabled yet.'));
  }

  if (account.details_submitted) {
    checks.push(check('PASS', 'account', 'details_submitted', 'Account details have been submitted.'));
  } else {
    checks.push(check('WARN', 'account', 'details_submitted', 'Account details are not fully submitted.'));
  }

  const branding = account.settings?.branding ?? {};
  checks.push(branding.logo
    ? check('PASS', 'account', 'branding_logo', 'Stripe account logo is set.')
    : check('WARN', 'account', 'branding_logo', 'Stripe account logo is not set.'));
  checks.push(branding.icon
    ? check('PASS', 'account', 'branding_icon', 'Stripe account icon is set.')
    : check('WARN', 'account', 'branding_icon', 'Stripe account icon is not set.'));
  checks.push(branding.primary_color
    ? check('PASS', 'account', 'branding_color', `Primary color is ${branding.primary_color}.`)
    : check('WARN', 'account', 'branding_color', 'Primary color is not set.'));

  return checks;
}

function printResults(checks, dbRows) {
  const counts = checks.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] ?? 0) + 1;
    return acc;
  }, {});

  if (jsonOutput) {
    console.log(JSON.stringify({ environment, counts, dbRows, checks }, null, 2));
    return;
  }

  console.log(`Stripe billing audit: ${environment}`);
  console.log(`Env file: ${envPath}`);
  console.log(`Supabase stripe_prices rows: ${dbRows.length}`);
  console.log(`Result: ${counts.FAIL ?? 0} fail, ${counts.WARN ?? 0} warn, ${counts.PASS ?? 0} pass`);
  console.log('');

  for (const status of ['FAIL', 'WARN', 'PASS']) {
    const grouped = checks.filter(item => item.status === status);
    const label = status === 'FAIL'
      ? 'Failures'
      : status === 'WARN'
        ? 'Warnings'
        : 'Passes';

    console.log(`${label} (${grouped.length})`);
    if (grouped.length === 0) {
      console.log(`No ${label.toLowerCase()}.`);
      console.log('');
      continue;
    }

    console.table(grouped.map(item => ({
      area: item.area,
      key: item.key,
      detail: item.detail,
    })));
  }
}

async function main() {
  assertEnv();

  const stripe = new Stripe(stripeSecretKey, {
    apiVersion: STRIPE_API_VERSION,
  });

  const dbRows = await fetchStripePriceRows();
  const checks = [
    check('PASS', 'environment', 'stripe_key', `STRIPE_SECRET_KEY points at ${keyEnvironment}.`),
    check('PASS', 'environment', 'supabase', `Loaded stripe_prices from ${supabaseUrl}.`),
    ...(await auditPrices(stripe, dbRows)),
    ...(await auditStrayPrices(stripe, dbRows)),
    ...(await auditWebhook(stripe)),
    ...(await auditPortal(stripe)),
    ...(await auditAccount(stripe)),
  ];

  printResults(checks, dbRows);

  if (checks.some(item => item.status === 'FAIL')) {
    process.exit(1);
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
