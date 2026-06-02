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
  node scripts/audit-stripe-billing.mjs --env .env.local --environment sandbox --allow-test

Checks:
  - Supabase stripe_prices live/sandbox rows
  - Stripe price active status, amount, CAD currency, recurring interval, lookup key
  - Stripe product active status and product-name sanity
  - Production webhook URL, event list, status, and API version
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

const keyEnvironment = stripeSecretKey.startsWith('sk_live_')
  ? 'live'
  : stripeSecretKey.startsWith('sk_test_')
    ? 'sandbox'
    : null;
const environment = requestedEnvironment ?? keyEnvironment ?? 'live';

const APP_URL = 'https://fieldlogichq.ca';
const WEBHOOK_URL = `${APP_URL}/api/billing/webhook`;
const STRIPE_API_VERSION = '2026-04-22.dahlia';

const EXPECTED_WEBHOOK_EVENTS = [
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.payment_succeeded',
  'invoice.payment_failed',
  'customer.subscription.trial_will_end',
];

const EXPECTED_PRICE_SLOTS = [
  slot('team', 'monthly', 2900, 'flhq_team_monthly_live', [
    'FieldLogicHQ - Coaches Portal Premium',
    'Coaches Portal Premium',
    'FieldLogicHQ - Team',
  ]),
  slot('team', 'annual', 29000, 'flhq_team_annual_live', [
    'FieldLogicHQ - Coaches Portal Premium',
    'Coaches Portal Premium',
    'FieldLogicHQ - Team',
  ]),
  slot('tournament_plus', 'monthly', 3900, 'flhq_tournament_plus_monthly_live', [
    'FieldLogicHQ - Tournament Plus',
    'Tournament Plus',
  ]),
  slot('tournament_plus', 'annual', 39000, 'flhq_tournament_plus_annual_live', [
    'FieldLogicHQ - Tournament Plus',
    'Tournament Plus',
  ]),
  slot('league', 'monthly', 8900, 'flhq_league_monthly_live', [
    'FieldLogicHQ - League',
    'League',
  ]),
  slot('league', 'annual', 89000, 'flhq_league_annual_live', [
    'FieldLogicHQ - League',
    'League',
  ]),
  slot('club', 'monthly', 17900, 'flhq_club_monthly_live', [
    'FieldLogicHQ - Club',
    'Club',
  ]),
  slot('club', 'annual', 179000, 'flhq_club_annual_live', [
    'FieldLogicHQ - Club',
    'Club',
  ]),
  slot('org_team_addon', 'monthly', 2900, 'flhq_org_team_addon_monthly_live', [
    'FieldLogicHQ - Coaches Portal Org Add-on',
    'FieldLogicHQ - Org Team Add-on',
    'Coaches Portal Org Add-on',
    'Org Team Add-on',
    'Org-billed Coaches Portal Premium',
    'Team Add-on (Org-billed)',
  ]),
  slot('org_team_addon', 'annual', 29000, 'flhq_org_team_addon_annual_live', [
    'FieldLogicHQ - Coaches Portal Org Add-on',
    'FieldLogicHQ - Org Team Add-on',
    'Coaches Portal Org Add-on',
    'Org Team Add-on',
    'Org-billed Coaches Portal Premium',
    'Team Add-on (Org-billed)',
  ]),
  slot('rep_team', 'monthly', 1900, 'flhq_rep_team_monthly_live', [
    'FieldLogicHQ - Additional Rep Team',
    'Additional Rep Team',
    'Additional Rep Team (Club - $19)',
  ]),
  slot('rep_team', 'annual', 19000, 'flhq_rep_team_annual_live', [
    'FieldLogicHQ - Additional Rep Team',
    'Additional Rep Team',
    'Additional Rep Team (Club - $19)',
  ]),
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

function check(status, area, key, detail, extra = {}) {
  return { status, area, key, detail, ...extra };
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

  if (environment === 'live' && !stripeSecretKey.startsWith('sk_live_')) {
    throw new Error('Refusing live audit because STRIPE_SECRET_KEY is not an sk_live_ key. Pass --environment sandbox --allow-test for sandbox.');
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

  return checks;
}

async function auditWebhook(stripe) {
  const checks = [];
  const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
  const matches = endpoints.data.filter(endpoint => endpoint.url === WEBHOOK_URL);

  if (matches.length === 0) {
    return [check('FAIL', 'webhook', 'endpoint', `No Stripe webhook endpoint found for ${WEBHOOK_URL}.`)];
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

  return checks;
}

async function auditPortal(stripe) {
  const checks = [];
  const configs = await stripe.billingPortal.configurations.list({ limit: 100 });
  const activeConfigs = configs.data.filter(config => config.active);

  if (activeConfigs.length === 0) {
    return [check('FAIL', 'portal', 'configuration', 'No active Stripe customer portal configuration found.')];
  }

  const config = activeConfigs.find(item => item.is_default) ?? activeConfigs[0];
  checks.push(check('PASS', 'portal', 'configuration', `${config.id} is active${config.is_default ? ' and default' : ''}.`));

  const features = config.features ?? {};
  if (features.payment_method_update?.enabled) {
    checks.push(check('PASS', 'portal', 'payment_method_update', 'Customers can update payment methods.'));
  } else {
    checks.push(check('FAIL', 'portal', 'payment_method_update', 'Payment method updates are disabled.'));
  }

  if (features.invoice_history?.enabled) {
    checks.push(check('PASS', 'portal', 'invoice_history', 'Invoice history is enabled.'));
  } else {
    checks.push(check('FAIL', 'portal', 'invoice_history', 'Invoice history is disabled.'));
  }

  if (features.customer_update?.enabled) {
    const allowed = features.customer_update.allowed_updates ?? [];
    const recommended = ['address', 'tax_id'];
    const missing = recommended.filter(item => !allowed.includes(item));
    if (missing.length === 0) {
      checks.push(check('PASS', 'portal', 'customer_update', `Customer updates enabled for ${allowed.join(', ')}.`));
    } else {
      checks.push(check('WARN', 'portal', 'customer_update', `Customer updates enabled, but missing recommended allowed update(s): ${missing.join(', ')}.`));
    }
  } else {
    checks.push(check('WARN', 'portal', 'customer_update', 'Customer billing-detail updates are disabled.'));
  }

  if (features.subscription_update?.enabled) {
    checks.push(check('WARN', 'portal', 'subscription_update', 'Subscription changes are enabled in Stripe portal; app-owned downgrade/change flows may be bypassed.'));
  } else {
    checks.push(check('PASS', 'portal', 'subscription_update', 'Subscription changes are disabled in Stripe portal.'));
  }

  if (features.subscription_cancel?.enabled) {
    checks.push(check('WARN', 'portal', 'subscription_cancel', 'Cancellation is enabled in Stripe portal; app-owned cancellation/retention flow may be bypassed.'));
  } else {
    checks.push(check('PASS', 'portal', 'subscription_cancel', 'Cancellation is disabled in Stripe portal.'));
  }

  if (features.subscription_pause?.enabled) {
    checks.push(check('WARN', 'portal', 'subscription_pause', 'Subscription pause is enabled; app flows do not currently model pause state.'));
  } else {
    checks.push(check('PASS', 'portal', 'subscription_pause', 'Subscription pause is disabled.'));
  }

  return checks;
}

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
