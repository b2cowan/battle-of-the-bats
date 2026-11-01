import { forwardToOwnAddress } from '@/lib/club-forward';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { resolvePublicLeagueContext } from '@/lib/public-league';
import { clubPageMetadata, getClubSeason } from '@/lib/club-page-meta';
import { orgLinks } from '@/lib/org-links';
import { SIGNUP_LINK_WORDS as SW } from '@/lib/league-pay-words';
import EmailMyLinkForm from './EmailMyLinkForm';
import column from '../../league-column.module.css';
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

  // R6: the shared 1200px page column; this form's 560px measure left-aligns inside it.
  const innerStyle = { '--league-measure': '560px' } as React.CSSProperties;

  // The light ground, bar and footer come from the club's frame (Club Tier Stage 4b-1).
  return (
    <div>
      <div className={`container ${column.column}`} style={innerStyle}>
        <Link href={href(`/league/${seasonSlug}`)} className={kit.back}>
          ← Back to {season.name}
        </Link>

        <div style={{ marginBottom: '2rem' }}>
          <div className={kit.sub} style={{ marginBottom: '0.4rem' }}>{org.name}</div>
          <h1 className={kit.title}>{SW.title}</h1>
          <p className={kit.sub}>{season.name}</p>
        </div>

        <EmailMyLinkForm orgSlug={orgSlug} seasonSlug={seasonSlug} seasonName={season.name} clubName={org.name} variant="page" />
      </div>
    </div>
  );
}
