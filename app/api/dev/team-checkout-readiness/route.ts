import { NextResponse } from 'next/server';
import { getBillingMockConfig, isStripeConfigured } from '@/lib/billing-mock';
import { getPlanGatingMap } from '@/lib/plan-gating-server';
import { requireDevToolPlatformAdmin } from '@/lib/platform-auth';
import { getStripe } from '@/lib/stripe';
import { getAllStripePrices, type StripePriceRow } from '@/lib/stripe-prices';

type CheckStatus = 'pass' | 'warn' | 'fail';

type ReadinessCheck = {
  key: string;
  label: string;
  status: CheckStatus;
  detail: string;
};

type StripeEnvironment = 'sandbox' | 'live' | 'not_configured';

const EXPECTED_PRICES = {
  monthly: { amount: 2900, interval: 'month', label: '$29 CAD monthly' },
  annual: { amount: 29000, interval: 'year', label: '$290 CAD yearly' },
} as const;

function getStripeEnvironment(): StripeEnvironment {
  const key = process.env.STRIPE_SECRET_KEY ?? '';
  if (!key) return 'not_configured';
  return key.startsWith('sk_live_') ? 'live' : 'sandbox';
}

function check(status: CheckStatus, key: string, label: string, detail: string): ReadinessCheck {
  return { key, label, status, detail };
}

function findTeamPrice(rows: StripePriceRow[], environment: 'sandbox' | 'live', billingCycle: 'monthly' | 'annual') {
  return rows.find(row =>
    row.plan_id === 'team' &&
    row.environment === environment &&
    row.billing_cycle === billingCycle
  );
}

async function validateStripePrice(
  row: StripePriceRow | undefined,
  billingCycle: 'monthly' | 'annual',
  environment: StripeEnvironment,
): Promise<ReadinessCheck> {
  const expected = EXPECTED_PRICES[billingCycle];
  const label = `Team ${billingCycle} price`;

  if (!row) {
    return check('fail', `team_${billingCycle}_row`, label, `Missing team/${billingCycle}/${environment} row in stripe_prices.`);
  }

  if (!row.price_id) {
    return check('fail', `team_${billingCycle}_price_id`, label, `Set the ${expected.label} Stripe price ID on the team/${billingCycle}/${environment} stripe_prices row.`);
  }

  if (environment === 'not_configured') {
    return check('warn', `team_${billingCycle}_price_unchecked`, label, `${row.price_id} is set, but STRIPE_SECRET_KEY is missing so Stripe metadata was not checked.`);
  }

  try {
    const price = await getStripe().prices.retrieve(row.price_id);
    const amountOk = price.unit_amount === expected.amount;
    const currencyOk = price.currency === 'cad';
    const intervalOk = price.recurring?.interval === expected.interval;

    if (!price.active) {
      return check('fail', `team_${billingCycle}_price_active`, label, `${row.price_id} exists but is inactive in Stripe.`);
    }

    if (!amountOk || !currencyOk || !intervalOk) {
      return check(
        'warn',
        `team_${billingCycle}_price_shape`,
        label,
        `${row.price_id} is active, but expected ${expected.label}; Stripe returned ${price.unit_amount ?? 'no amount'} ${price.currency.toUpperCase()} / ${price.recurring?.interval ?? 'no interval'}.`,
      );
    }

    return check('pass', `team_${billingCycle}_price_active`, label, `${row.price_id} is active and matches ${expected.label}.`);
  } catch (error) {
    return check(
      'fail',
      `team_${billingCycle}_price_lookup`,
      label,
      error instanceof Error ? error.message : 'Stripe price lookup failed.',
    );
  }
}

export async function GET() {
  const auth = await requireDevToolPlatformAdmin();
  if (auth.response) return auth.response;

  const stripeEnvironment = getStripeEnvironment();
  const priceEnvironment = stripeEnvironment === 'live' ? 'live' : 'sandbox';
  const billingMock = getBillingMockConfig();
  const [gatingMap, priceRows] = await Promise.all([
    getPlanGatingMap(),
    getAllStripePrices(),
  ]);

  const checks: ReadinessCheck[] = [
    billingMock.effectiveEnabled
      ? check(
          'pass',
          'billing_mock',
          'Mock billing mode',
          billingMock.source === 'runtime_override'
            ? 'Dev Tools override is enabled; dev Team checkout can provision without Stripe.'
            : 'ENABLE_BILLING_MOCK_PORTAL is enabled; dev Team checkout can provision without Stripe.',
        )
      : check('warn', 'billing_mock', 'Mock billing mode', 'Mock billing is off. Real Stripe checkout requires test price IDs and webhook forwarding.'),
    isStripeConfigured()
      ? check('pass', 'stripe_secret', 'Stripe secret key', `STRIPE_SECRET_KEY is set; app will read ${stripeEnvironment} stripe_prices rows.`)
      : check('warn', 'stripe_secret', 'Stripe secret key', 'STRIPE_SECRET_KEY is not set. Local non-production checkout will use direct provisioning unless mock mode is enabled.'),
    process.env.STRIPE_WEBHOOK_SECRET
      ? check('pass', 'stripe_webhook_secret', 'Stripe webhook secret', 'STRIPE_WEBHOOK_SECRET is set.')
      : check('fail', 'stripe_webhook_secret', 'Stripe webhook secret', 'Set STRIPE_WEBHOOK_SECRET from `stripe listen --forward-to localhost:3000/api/billing/webhook`.'),
    process.env.NEXT_PUBLIC_APP_URL
      ? check('pass', 'app_url', 'Application URL', `NEXT_PUBLIC_APP_URL=${process.env.NEXT_PUBLIC_APP_URL}`)
      : check('fail', 'app_url', 'Application URL', 'Set NEXT_PUBLIC_APP_URL=http://localhost:3000 for local Stripe checkout.'),
    gatingMap.team
      ? check('fail', 'team_gating', 'Team plan availability', 'Team is gated; self-serve checkout will return 403.')
      : check('pass', 'team_gating', 'Team plan availability', 'Team is live for self-serve checkout.'),
  ];

  checks.push(
    await validateStripePrice(findTeamPrice(priceRows, priceEnvironment, 'monthly'), 'monthly', stripeEnvironment),
    await validateStripePrice(findTeamPrice(priceRows, priceEnvironment, 'annual'), 'annual', stripeEnvironment),
  );

  const readyForMockSmoke = !gatingMap.team;
  const readyForStripeSmoke = checks.every(item => item.status !== 'fail');

  return NextResponse.json({
    ok: true,
    stripeEnvironment,
    priceEnvironment,
    billingMockEnabled: billingMock.effectiveEnabled,
    stripeConfigured: isStripeConfigured(),
    readyForMockSmoke,
    readyForStripeSmoke,
    checks,
    manualNextSteps: [
      'In Stripe test mode, create Team monthly and yearly recurring CAD prices.',
      'Enter those price IDs in Platform Admin > Plans & Pricing > Stripe Prices for Team sandbox rows.',
      'Run `stripe listen --forward-to localhost:3000/api/billing/webhook` and copy its whsec_ value into STRIPE_WEBHOOK_SECRET.',
      'Restart `npm run dev` after editing .env.local.',
      'Visit /team?billing=annual, complete checkout with a Stripe test card, and confirm redirect to /{orgSlug}/coaches?success=1.',
    ],
  });
}
