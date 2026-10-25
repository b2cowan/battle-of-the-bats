import { forwardToOwnAddress } from '@/lib/club-forward';
import { notFound, permanentRedirect } from 'next/navigation';
import { getClubBySlug } from '@/lib/club-page-meta';
import { orgLinks } from '@/lib/org-links';

/**
 * THE OLD PAST TOURNAMENTS ADDRESS (Club Tier Stage 4f, Ask 6, ruled 2026-10-25). The Past tournaments page retired into
 * the club's Tournaments page; its address, which shared links and the old tab carry, forwards permanently to that page's
 * past part. Each archived tournament keeps its own address (`/archives/{id}`). The Tournaments page asks the one rule,
 * so a closed or hidden one is still the club's "not found" one step on.
 *
 * The forward is spelled from the CLUB'S slug, never the address typed: a slug is decoded before it reaches a page, and a
 * typed `%5C…` would otherwise come back out as a `/\…` Location a browser reads as another site (review 2026-10-25).
 */
export default async function ArchivesPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  // The club's own web address first, as every club page does (Stage 4e).
  await forwardToOwnAddress(orgSlug, '/tournaments#past');
  // The layout's own read of the club, cached for the request.
  const club = await getClubBySlug(orgSlug);
  if (!club) notFound();
  const href = await orgLinks(club.slug);
  permanentRedirect(href('/tournaments#past'));
}
