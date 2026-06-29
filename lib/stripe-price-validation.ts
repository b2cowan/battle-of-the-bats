import { getStripe } from './stripe';
import { supabaseAdmin } from './supabase-admin';
import { PLAN_CONFIG } from './plan-config';
import type { OrgPlan } from './types';

/**
 * Validates a Stripe price ID against the catalog slot it is being attached to, so an operator
 * can't silently wire a wrong/mismatched price (caught during platform-admin QA 3.2, 2026-06-29).
 *
 * We already retrieve the price at config time — this reads everything useful on it and compares
 * it to what the slot expects. Two severities:
 *   - HARD BLOCK ('fail') — never valid: missing, inactive, one-time, wrong interval/currency/env.
 *   - WARN ('warn') — usually a mistake but occasionally intentional: amount mismatch, reuse,
 *     wrong Stripe product. The UI requires an explicit confirm to proceed past a warn.
 *
 * KNOWN NUANCE: the Stripe lookup only runs where the matching key lives. A Production-slot price
 * can't be validated from a sandbox-key environment (e.g. local dev) — it validates in production
 * at approval time. In that case `validated` is false and nothing hard-blocks.
 */

export type PriceCheckStatus = 'pass' | 'warn' | 'fail' | 'skipped';

export interface PriceCheck {
  key: string;
  label: string;
  status: PriceCheckStatus;
  expected?: string;
  actual?: string;
  detail?: string;
}

export interface StripePriceFacts {
  amountCents: number | null;
  currency: string | null;
  interval: string | null;
  recurring: boolean;
  active: boolean;
  environment: 'live' | 'sandbox';
  product: string | null;
}

export interface PriceValidationResult {
  /** true when we actually reached Stripe; false when the slot's environment can't be checked here. */
  validated: boolean;
  /** why the Stripe lookup didn't run (environment mismatch / no key) — surface in the UI. */
  skippedReason?: string;
  /** any 'fail' check → block Approve & Apply. */
  hardBlock: boolean;
  /** any 'warn' check → require an explicit confirm before applying. */
  warn: boolean;
  checks: PriceCheck[];
  stripe?: StripePriceFacts;
  /** the catalog amount we expected, for the side-by-side panel. */
  expectedAmountCents: number | null;
}

export interface PriceSlotContext {
  /** stripe_prices.id — excluded from the reuse check. */
  slotId: string;
  planId: string;
  /** 'monthly' | 'annual' */
  billingCycle: string;
  /** 'live' | 'sandbox' */
  environment: string;
}

function serverStripeEnvironment(): 'live' | 'sandbox' | null {
  const key = process.env.STRIPE_SECRET_KEY ?? '';
  return key.startsWith('sk_live_') ? 'live' : key ? 'sandbox' : null;
}

/** Catalog price for a plan+cycle in cents, from the canonical PLAN_CONFIG (matched to PLAN_PRICING_FACTS). */
export function expectedAmountCents(planId: string, billingCycle: string): number | null {
  const cfg = PLAN_CONFIG[planId as OrgPlan];
  if (!cfg) return null;
  const dollars = billingCycle === 'annual' ? cfg.annualPrice : cfg.monthlyPrice;
  return Math.round(dollars * 100);
}

function fmtAmount(cents: number | null, currency: string | null): string {
  if (cents == null) return '—';
  return `$${(cents / 100).toFixed(2)}${currency ? ` ${currency.toUpperCase()}` : ''}`;
}

function summarize(checks: PriceCheck[]): { hardBlock: boolean; warn: boolean } {
  return {
    hardBlock: checks.some(c => c.status === 'fail'),
    warn: checks.some(c => c.status === 'warn'),
  };
}

export async function validateStripePriceForSlot(
  priceId: string,
  slot: PriceSlotContext,
): Promise<PriceValidationResult> {
  const checks: PriceCheck[] = [];
  const expected = expectedAmountCents(slot.planId, slot.billingCycle);

  // Reuse check — DB only, always runs (cheap, environment-independent).
  const { data: reuseRows } = await supabaseAdmin
    .from('stripe_prices')
    .select('id, plan_id, billing_cycle, environment')
    .eq('price_id', priceId)
    .neq('id', slot.slotId);
  if (reuseRows && reuseRows.length > 0) {
    const where = reuseRows
      .map(r => `${r.plan_id} / ${r.billing_cycle} / ${r.environment}`)
      .join(', ');
    checks.push({ key: 'reuse', label: 'Not used by another slot', status: 'warn', detail: `Already assigned to: ${where}` });
  } else {
    checks.push({ key: 'reuse', label: 'Not used by another slot', status: 'pass' });
  }

  const serverEnv = serverStripeEnvironment();
  if (!serverEnv || serverEnv !== slot.environment) {
    return {
      validated: false,
      skippedReason: !serverEnv
        ? 'No Stripe key is configured in this environment, so the price could not be checked against Stripe.'
        : `This environment uses the ${serverEnv} Stripe key; a ${slot.environment} slot can only be checked against Stripe in that environment (e.g. production at approval time).`,
      ...summarize(checks),
      checks,
      expectedAmountCents: expected,
    };
  }

  // Retrieve the price (with its product expanded for the product cross-check).
  let price: import('stripe').Stripe.Price;
  try {
    price = await getStripe().prices.retrieve(priceId);
  } catch {
    checks.push({ key: 'exists', label: 'Price exists in Stripe', status: 'fail', detail: 'No price with this ID was found in Stripe.' });
    return { validated: true, ...summarize(checks), checks, expectedAmountCents: expected };
  }
  checks.push({ key: 'exists', label: 'Price exists in Stripe', status: 'pass' });

  const productId = typeof price.product === 'string' ? price.product : price.product?.id ?? null;
  const priceEnv: 'live' | 'sandbox' = price.livemode ? 'live' : 'sandbox';
  const interval = price.recurring?.interval ?? null;

  // active — HARD BLOCK
  checks.push(price.active
    ? { key: 'active', label: 'Price is active', status: 'pass' }
    : { key: 'active', label: 'Price is active', status: 'fail', detail: 'The Stripe price is archived/inactive and would fail at checkout.' });

  // recurring + interval — HARD BLOCK
  if (!price.recurring) {
    checks.push({ key: 'recurring', label: 'Recurring price', status: 'fail', detail: 'This is a one-time price; a subscription needs a recurring price.' });
  } else {
    checks.push({ key: 'recurring', label: 'Recurring price', status: 'pass' });
    const expectedInterval = slot.billingCycle === 'annual' ? 'year' : 'month';
    checks.push(interval === expectedInterval
      ? { key: 'interval', label: 'Billing frequency matches slot', status: 'pass', expected: expectedInterval, actual: interval ?? undefined }
      : { key: 'interval', label: 'Billing frequency matches slot', status: 'fail', expected: expectedInterval, actual: interval ?? 'none', detail: `Slot is ${slot.billingCycle}; the Stripe price bills per ${interval ?? 'unknown'}.` });
  }

  // currency — HARD BLOCK
  checks.push(price.currency === 'cad'
    ? { key: 'currency', label: 'Currency is CAD', status: 'pass', actual: price.currency }
    : { key: 'currency', label: 'Currency is CAD', status: 'fail', expected: 'cad', actual: price.currency ?? 'none' });

  // environment / livemode — HARD BLOCK
  checks.push(priceEnv === slot.environment
    ? { key: 'environment', label: 'Environment matches slot', status: 'pass', actual: priceEnv }
    : { key: 'environment', label: 'Environment matches slot', status: 'fail', expected: slot.environment, actual: priceEnv, detail: `Slot is ${slot.environment}; this is a ${priceEnv} price.` });

  // amount — WARN
  const amount = price.unit_amount ?? null;
  if (expected != null && amount != null && amount !== expected) {
    checks.push({ key: 'amount', label: 'Amount matches catalog', status: 'warn', expected: fmtAmount(expected, price.currency), actual: fmtAmount(amount, price.currency), detail: 'The Stripe amount differs from the catalog price for this plan.' });
  } else {
    checks.push({ key: 'amount', label: 'Amount matches catalog', status: 'pass', expected: expected != null ? fmtAmount(expected, price.currency) : undefined, actual: amount != null ? fmtAmount(amount, price.currency) : undefined });
  }

  // product cross-check — WARN. Compare against one already-configured peer price for the same
  // plan+environment (a plan's monthly and annual prices should share one Stripe product).
  const { data: peerRows } = await supabaseAdmin
    .from('stripe_prices')
    .select('price_id')
    .eq('plan_id', slot.planId)
    .eq('environment', slot.environment)
    .neq('id', slot.slotId)
    .not('price_id', 'is', null)
    .limit(1);
  const peerPriceId = peerRows?.[0]?.price_id as string | undefined;
  if (peerPriceId && productId) {
    try {
      const peer = await getStripe().prices.retrieve(peerPriceId);
      const peerProduct = typeof peer.product === 'string' ? peer.product : peer.product?.id ?? null;
      if (peerProduct && peerProduct !== productId) {
        checks.push({ key: 'product', label: 'Same Stripe product as this plan', status: 'warn', detail: `This plan's other configured price uses a different Stripe product (${peerProduct}).` });
      } else {
        checks.push({ key: 'product', label: 'Same Stripe product as this plan', status: 'pass' });
      }
    } catch {
      checks.push({ key: 'product', label: 'Same Stripe product as this plan', status: 'skipped', detail: 'Could not read the peer price to compare products.' });
    }
  } else {
    checks.push({ key: 'product', label: 'Same Stripe product as this plan', status: 'skipped', detail: 'No other configured price for this plan to compare against.' });
  }

  return {
    validated: true,
    ...summarize(checks),
    checks,
    expectedAmountCents: expected,
    stripe: {
      amountCents: amount,
      currency: price.currency ?? null,
      interval,
      recurring: Boolean(price.recurring),
      active: price.active,
      environment: priceEnv,
      product: productId,
    },
  };
}

/** The failing (hard-block) checks, as a single operator-facing message. */
export function hardBlockMessage(result: PriceValidationResult): string | null {
  const fails = result.checks.filter(c => c.status === 'fail');
  if (fails.length === 0) return null;
  return fails.map(c => `${c.label}: ${c.detail ?? 'failed'}`).join(' ');
}
