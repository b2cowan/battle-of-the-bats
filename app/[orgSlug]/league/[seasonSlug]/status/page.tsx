import { forwardToOwnAddress } from '@/lib/club-forward';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { resolvePublicLeagueContext } from '@/lib/public-league';
import { clubPageMetadata, getClubSeason } from '@/lib/club-page-meta';
import { orgLinks } from '@/lib/org-links';
import { SIGNUP_LINK_WORDS as SW } from '@/lib/league-pay-words';
import EmailMyLinkForm from './EmailMyLinkForm';
import PublicPage from '@/components/public/PublicPage';
import kit from '@/components/public/ClubKit.module.css';

export const dynamic = 'force-dynamic';

// The tab names the page, not the season: the family's own page, like the bar's own "Sign in".
export async function generateMetadata({ params }: { params: Promise<{ orgSlug: string; seasonSlug: string }> }): Promise<Metadata> {
  const { orgSlug, seasonSlug } = await params;
  return clubPageMetadata(orgSlug, () => SW.title, { path: `/league/${seasonSlug}/status` });
}

/**
 * "EMAIL ME MY LINK" (Signed-in family accounts Stage 1 Part 4, drawing tab 2). This address used to be the
 * email-and-reference lookup, which opened the page on the spot for anyone holding one forwarded email. Now the family
 * types their email and the link goes to that inbox only; the screen says the same either way.
 */
export default async function EmailMyLinkPage({
  params,
}: {
  params: Promise<{ orgSlug: string; seasonSlug: string }>;
}) {
  const { orgSlug, seasonSlug } = await params;
  await forwardToOwnAddress(orgSlug, `/league/${seasonSlug}/status`);
  const href = await orgLinks(orgSlug);

  const org = await resolvePublicLeagueContext(orgSlug);
  if (!org) notFound();
  const season = await getClubSeason(org.id, seasonSlug);
  if (!season) notFound();

  // The light ground, bar and footer come from the club's frame (Club Tier Stage 4b-1). A club form in the club page column
  // (club round C2): 640 on the logo edge. The back link opens the title block.
  return (
    <PublicPage frame="club" width="form">
      <div>
        <Link href={href(`/league/${seasonSlug}`)} className={kit.back}>
          ← Back to {season.name}
        </Link>
        {/* C3: the band names the club, so no club-name line; the title is 24 (C4), the season under it. */}
        <h1 className={kit.pageName}>{SW.title}</h1>
        <p className={kit.sub} style={{ marginTop: '0.35rem' }}>{season.name}</p>
      </div>

      <EmailMyLinkForm orgSlug={orgSlug} seasonSlug={seasonSlug} seasonName={season.name} clubName={org.name} variant="page" />
    </PublicPage>
  );
}
