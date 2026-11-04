import { getAuthContext, getAuthenticatedUser, requireCapability, unauthorized } from '@/lib/api-auth';
import { withObservability } from '@/lib/observability';
import { isDemoOrganizerEmail } from '@/lib/demo-org';
import { sandboxRejectionResponse } from '@/lib/demo-guard';
import {
  billingAddressFromBody,
  billingBuyerOf,
  readBillingLocation,
  saveBillingLocation,
  saveRefusalResponse,
  usSalesOpen,
  type BillingBuyer,
} from '@/lib/billing-location-server';

/**
 * The buyer's billing address (GST/HST Stage 1 Part 2).
 *
 *   GET ?orgSlug=   → { location | null, buyer: 'club' | 'person', name, usSalesOpen }
 *                     A club's own row (owner / `billing`, the same power checkout asks for); for a Coaches Portal, the
 *                     signed-in owner's own home address (a coach buys as a person, owner ruling 6).
 *   GET ?scope=person → the signed-in person's own row (the coach sign-up page, before any portal exists).
 *   PUT { orgSlug? | scope: 'person', address fields, usDeclared } → { location } · 400 { errors, usClosed } · 500
 */

type Resolved = { ok: true; buyer: BillingBuyer; name: string | null; email: string | null } | { ok: false; response: Response };

async function resolveBuyer(orgSlug: string | null, scope: string | null): Promise<Resolved> {
  if (scope === 'person' || !orgSlug) {
    const user = await getAuthenticatedUser();
    if (!user) return { ok: false, response: unauthorized() };
    return { ok: true, buyer: { kind: 'user', userId: user.id }, name: null, email: user.email ?? null };
  }
  const auth = await getAuthContext({ orgSlug, requireOrgSlug: true, allowSuspendedOrg: true });
  if (!auth) return { ok: false, response: unauthorized() };
  const denied = await requireCapability(auth, 'billing');
  if (denied) return { ok: false, response: denied };
  const buyer = billingBuyerOf(auth.org, auth.user);
  return { ok: true, buyer, name: buyer.kind === 'org' ? auth.org.name : null, email: auth.user.email ?? null };
}

export const GET = withObservability(async (req: Request) => {
  const params = new URL(req.url).searchParams;
  const resolved = await resolveBuyer(params.get('orgSlug'), params.get('scope'));
  if (!resolved.ok) return resolved.response;
  const location = await readBillingLocation(resolved.buyer);
  return Response.json({
    location,
    buyer: resolved.buyer.kind === 'org' ? 'club' : 'person',
    name: resolved.name,
    usSalesOpen: usSalesOpen(),
  });
}, { route: '/api/billing/location' });

export const PUT = withObservability(async (req: Request) => {
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const resolved = await resolveBuyer(
    typeof body.orgSlug === 'string' ? body.orgSlug : null,
    typeof body.scope === 'string' ? body.scope : null,
  );
  if (!resolved.ok) return resolved.response;
  // The sandboxes run the real product and the demo organizer holds the billing power: a visitor must not save an address
  // onto the public demo club. This route names its org only in the body, so the proxy cannot see it (pinned in
  // tests/unit/demo-sandbox-write-guard.test.ts, ACTOR_IDENTIFIED_WRITES).
  if (isDemoOrganizerEmail(resolved.email)) return sandboxRejectionResponse();
  const result = await saveBillingLocation(resolved.buyer, billingAddressFromBody(body) ?? {});
  if (!result.ok) return saveRefusalResponse(result);
  return Response.json({ location: result.location });
}, { route: '/api/billing/location' });
