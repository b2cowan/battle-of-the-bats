import { getAuthContext, requireCapability, unauthorized } from '@/lib/api-auth';
import { isBillingMockEnabled, isStripeConfigured } from '@/lib/billing-mock';
import { createCardSetupSession } from '@/lib/billing-setup';
import { withObservability } from '@/lib/observability';

/**
 * Founding Season "Add payment method" — saves a card on file WITHOUT starting a
 * subscription or a trial (Stripe Checkout mode='setup'; charges nothing).
 *
 * This replaces the earlier wiring that reused the subscription checkout: because a
 * founding-season org is already on tournament_plus, that path fell through to a
 * real subscription session with a 14-day trial — i.e. a November click would have
 * billed in November, contradicting the "no card required until Jan 1" banner.
 * Session mechanics live in lib/billing-setup.ts (shared with the portal route's
 * no-billing-account fallback); the January 2027 conversion is the manual runbook in
 * FOUNDING_SEASON_COACHES_FREE_PLAN.md Phase 4.
 */
export const POST = withObservability(async (req: Request) => {
  // Scope to the org whose billing page invoked this — never the caller's home org
  // (a multi-org member on Org B's page must not create Org A's billing account).
  const body = await req.json().catch(() => ({})) as { orgSlug?: unknown };
  const orgSlug = typeof body.orgSlug === 'string' ? body.orgSlug : undefined;
  const auth = await getAuthContext(orgSlug ? { orgSlug } : {});
  if (!auth) return unauthorized();
  // Billing is owner-only — enforce server-side (the UI also hides these controls).
  const denied = await requireCapability(auth, 'billing');
  if (denied) return denied;

  // ── Dev mock: no Stripe — bounce straight back with the saved flag ─────────
  if (isBillingMockEnabled() || (!isStripeConfigured() && process.env.NODE_ENV !== 'production')) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
    return new Response(
      JSON.stringify({ url: `${appUrl}/${auth.org.slug}/admin/org/billing?card_saved=1` }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (!isStripeConfigured()) {
    return new Response(JSON.stringify({ error: 'Billing is not configured.' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = await createCardSetupSession(auth.org, auth.user.email);
  return new Response(JSON.stringify({ url }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}, { route: '/api/billing/setup-payment-method' });
