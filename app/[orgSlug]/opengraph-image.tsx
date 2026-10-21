import { resolvePublicClub } from '@/lib/public-club-page';
import { getClubSiteContent } from '@/lib/club-page-meta';
import { homeCard } from '@/lib/club-share';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { clubShareCard, neutralShareCard, SHARE_CARD_SIZE, SHARE_CARD_TYPE } from '@/lib/club-share-card-image';

/**
 * The club home's preview card (Club Tier Stage 4b-2b, End state 8): the club's name over its tagline, in its colours.
 * Every page under the club that names no card of its own inherits this one (a tournament names its own). A club whose
 * site is off gets the neutral card — the one rule, asked here like on every club page.
 */
export const alt = 'The club';
export const size = SHARE_CARD_SIZE;
export const contentType = SHARE_CARD_TYPE;
// Drawn from the club's data now, never at build time (the org layout's force-dynamic does not reach a route file).
export const dynamic = 'force-dynamic';

export default async function Image({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const org = await resolvePublicClub(orgSlug, 'home').catch(() => null);
  if (!org) return neutralShareCard();
  // A club on a plan without the public site shows its name only (the org layout's rule for its description).
  const site = hasModuleEntitlement(org, 'module_public_site') ? await getClubSiteContent(org.id) : null;
  return clubShareCard(org, homeCard({ clubName: org.name, tagline: site?.tagline ?? null }));
}
