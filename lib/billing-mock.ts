import 'server-only';

export function isBillingMockEnabled(): boolean {
  return process.env.ENABLE_BILLING_MOCK_PORTAL === 'true' && process.env.NODE_ENV !== 'production';
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}
