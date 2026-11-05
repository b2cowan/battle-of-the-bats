import Stripe from 'stripe';

/** The Stripe API version the app speaks. Scripts that talk to Stripe as the app does import it from here. */
export const STRIPE_API_VERSION = '2026-04-22.dahlia';

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is not set');
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: STRIPE_API_VERSION,
    });
  }
  return _stripe;
}

// Backwards-compat alias — resolved lazily on first access
export const stripe: Stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return (getStripe() as any)[prop];
  },
});
