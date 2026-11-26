import type { Metadata } from 'next';
import { clubPageMetadata } from '@/lib/club-page-meta';
import { forwardToOwnAddress } from '@/lib/club-forward';
import { resolvePublicClub } from '@/lib/public-club-page';
import { buildSponsorPageView } from '@/lib/sponsor-deal-view';
import { SPONSOR_LINK_WORDS as L } from '@/lib/sponsor-link-words';
import PublicPage from '@/components/public/PublicPage';
import SponsorDealContent from '@/components/public/SponsorDealContent';

export const dynamic = 'force-dynamic';

// "Sponsorship · {club}" (the one helper every club page names itself through, End state 8). A bearer link to one deal
// (/legal review §2): never indexed, never followed, and no canonical address (the token is the page).
export async function generateMetadata({ params }: { params: Promise<{ orgSlug: string }> }): Promise<Metadata> {
  const { orgSlug } = await params;
  return { ...(await clubPageMetadata(orgSlug, () => L.pageTitle)), robots: { index: false, follow: false } };
}

/**
 * /{org}/sponsorship/{token} — A BUSINESS'S SPONSORSHIP PAGE (Board Ready Stage 6 Part 2; round 1 tab 4, round 2 tab 1's
 * pay block, card-off until Part 3: owner call (b)). No account: the link opens ONE deal through the one door
 * (lib/sponsor-deal-view.ts), on the club's frame. The club must still carry Sponsorships (`resolvePublicClub(…,
 * 'sponsorship')`, the one question every public club page asks); the site's own switch never stops it. A business is not a
 * family, so the 2026-10-31 family-links rule doesn't apply — but the page shows nothing of any other deal or business.
 */
export default async function SponsorshipPage({ params, searchParams }: {
  params: Promise<{ orgSlug: string; token: string }>;
  /** Stripe's return: the page waits for the record, or says the payer left (read in the browser by SponsorDealContent). */
  searchParams: Promise<{ paid?: string; left?: string }>;
}) {
  const [{ orgSlug, token }, { paid, left }] = await Promise.all([params, searchParams]);
  await forwardToOwnAddress(orgSlug, `/sponsorship/${token}`, { paid, left });
  const club = await resolvePublicClub(orgSlug, 'sponsorship');
  const view = club ? await buildSponsorPageView(orgSlug, token, { markOpened: true }) : { state: 'notFound' as const };
  return (
    <PublicPage frame="club" width="form">
      <SponsorDealContent initial={view} />
    </PublicPage>
  );
}
