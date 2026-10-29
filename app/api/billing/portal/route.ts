import { getAuthContext, requireCapability, unauthorized } from '@/lib/api-auth';
import { isBillingMockEnabled, isStripeConfigured } from '@/lib/billing-mock';
import { createCardSetupSession } from '@/lib/billing-setup';
import { withObservability } from '@/lib/observability';
import { getBillingHref } from '@/lib/billing-urls';
import { isTeamWorkspaceOrg } from '@/lib/team-workspace-kind';

export const POST = withObservability(async (req: Request) => {
  // Scope to the org whose billing page invoked this — never the caller's home org
  // (a multi-org member on Org B's page must not open/create Org A's billing).
  const body = await req.json().catch(() => ({})) as { orgSlug?: unknown };
  const orgSlug = typeof body.orgSlug === 'string' ? body.orgSlug : undefined;
  const auth = await getAuthContext(orgSlug ? { orgSlug, allowSuspendedOrg: true } : { allowSuspendedOrg: true });
  if (!auth) return unauthorized();
  // Billing is owner-only — enforce server-side (the UI also hides these controls).
  const denied = await requireCapability(auth, 'billing');
  if (denied) return denied;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';

  // ── Dev mock: redirect to local mock portal ───────────────────────────────
  if (isBillingMockEnabled()) {
    const billingHref = getBillingHref(auth.org, { purpose: 'return' });
    return new Response(
      // A zero-team owner can render only the billing page through the wall. The coach mock
      // returns there directly; real card and invoice management is exercised in Stripe test mode.
      JSON.stringify({ url: `${appUrl}${billingHref}${isTeamWorkspaceOrg(auth.org) ? '' : '/mock-portal'}` }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // ── Production: real Stripe billing portal ────────────────────────────────
  if (!isStripeConfigured()) {
    return new Response(JSON.stringify({ error: 'Billing portal is not configured.' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!auth.org.stripeCustomerId) {
    // Not an error state: founding-season orgs upgraded via the $0 comp flip never
    // created a Stripe customer. Answer with a card-on-file setup session instead of
    // dead-ending (post-promo this was a hard 400 with no self-serve exit) — decided
    // server-side so the client treats every portal response as a redirect URL.
    const url = await createCardSetupSession(auth.org, auth.user.email);
    return new Response(JSON.stringify({ url }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { stripe } = await import('@/lib/stripe');
  const session = await stripe.billingPortal.sessions.create({
    customer: auth.org.stripeCustomerId,
    return_url: `${appUrl}${getBillingHref(auth.org, { purpose: 'return' })}`,
  });

  return new Response(JSON.stringify({ url: session.url }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}, { route: '/api/billing/portal' });
