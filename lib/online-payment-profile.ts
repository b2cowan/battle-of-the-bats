import 'server-only';
import { clubHosts } from './club-host';
import { hasModuleEntitlement } from './module-entitlements';
import { isPublicClubSiteOpen } from './public-club-access';
import { PAYOUTS_WORDS } from './online-payment-words';
import { reachableSiteUrl } from './reachable-site-url';
import type { Organization } from './types';

/**
 * What Stripe's sign-up is handed already answered for a new club account (walk 2026-10-25, owner yes): the club's public
 * website when it has one Stripe can open, else a short description of what the club sells — Stripe asks for one or the
 * other, and a treasurer stalls on both. Stripe skips a question it was given and asks the owner to confirm it, so either
 * stays the club's to change. The industry is NOT filled in (owner, same day): Stripe's code list was not checked, and with
 * Stripe's own form the industry may be asked again or changed after review anyway.
 */
export type StripeProfile = { businessUrl: string | null; productDescription: string };

/**
 * The club's public site address, or null when it has none to show: the site switched off, the club cancelled, or a plan
 * without the public site. The club's own web address only while it is CONNECTED — a "needs attention" one may already be
 * broken, and Stripe would flag it (/review 2026-10-25) — else ours with the club's name.
 */
export async function clubSiteUrl(org: Organization, ourOrigin: string): Promise<string | null> {
  if (!isPublicClubSiteOpen(org) || !hasModuleEntitlement(org, 'module_public_site')) return null;
  const host = await clubHosts.forSlug(org.slug).catch(() => 'unavailable' as const);
  if (host && host !== 'unavailable' && host.status === 'connected') return reachableSiteUrl(`https://${host.host}`);
  return reachableSiteUrl(`${ourOrigin.replace(/\/$/, '')}/${org.slug}`);
}

export async function stripeProfileFor(org: Organization, ourOrigin: string): Promise<StripeProfile> {
  // Both, always: Stripe is SENT the description only when there is no website, but it is kept to hand for a website
  // Stripe refuses (/review 2026-10-25 — the fallback once had nothing to send).
  return { businessUrl: await clubSiteUrl(org, ourOrigin), productDescription: PAYOUTS_WORDS.stripeProductDescription(org.name) };
}
