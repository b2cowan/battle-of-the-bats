import 'server-only';
import { notFound } from 'next/navigation';
import { getOrganizationBySlug } from './db';
import { publicClubRefusal, type PublicClubPage } from './public-club-access';
import type { Organization } from './types';

/**
 * THE SERVER DOOR to the one rule (`lib/public-club-access.ts`, Club Tier Stage 4a). Every public club page and route
 * comes through here before it renders anything; a guard (club-stage4a-guard.test.ts) fails the build when one does not.
 */

/** The club, or null when this page must not render for it (no club, site off, cancelled, or not in its plan). */
export async function resolvePublicClub(orgSlug: string, page: PublicClubPage): Promise<Organization | null> {
  const org = await getOrganizationBySlug(orgSlug);
  return publicClubRefusal(org, page) ? null : org;
}

/**
 * The club, or "not found" — which renders `app/[orgSlug]/not-found.tsx`: the neutral refusal when the club's site is
 * closed, "not found" inside the club's site when it is open. ⚠ Call it before any Suspense boundary or `await` that
 * streams, so the answer is a real 404 to search engines (Next 16: a streamed 404 is a 200 with a noindex tag).
 */
export async function requirePublicClubPage(orgSlug: string, page: PublicClubPage): Promise<Organization> {
  const org = await resolvePublicClub(orgSlug, page);
  if (!org) notFound();
  return org;
}
