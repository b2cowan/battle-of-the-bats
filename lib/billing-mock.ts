import 'server-only';

import {
  getBillingMockOverride,
  setBillingMockOverride,
  type RuntimeBooleanOverride,
} from './dev-runtime-flags';

export type BillingMockConfig = {
  envEnabled: boolean;
  override: RuntimeBooleanOverride;
  effectiveEnabled: boolean;
  source: 'env' | 'runtime_override' | 'production';
  nodeEnv: string;
  stripeConfigured: boolean;
};

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

export function isBillingMockEnvEnabled(): boolean {
  return process.env.ENABLE_BILLING_MOCK_PORTAL === 'true';
}

export function isBillingMockEnabled(): boolean {
  if (isProduction()) return false;

  const override = getBillingMockOverride();
  if (override !== null) return override;

  return isBillingMockEnvEnabled();
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function setBillingMockRuntimeOverride(value: RuntimeBooleanOverride): void {
  setBillingMockOverride(value);
}

export function getBillingMockConfig(): BillingMockConfig {
  const override = getBillingMockOverride();
  const envEnabled = isBillingMockEnvEnabled();
  const effectiveEnabled = isBillingMockEnabled();

  return {
    envEnabled,
    override,
    effectiveEnabled,
    source: isProduction() ? 'production' : override === null ? 'env' : 'runtime_override',
    nodeEnv: process.env.NODE_ENV ?? 'development',
    stripeConfigured: isStripeConfigured(),
  };
}
