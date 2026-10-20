import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { resolvePublicLeagueContext } from '@/lib/public-league';
import { clubPageMetadata, getClubSeason, getClubSiteContent } from '@/lib/club-page-meta';
import StatusLookupForm from './StatusLookupForm';
import column from '../../league-column.module.css';
import kit from '@/components/public/ClubKit.module.css';

export const dynamic = 'force-dynamic';

// The tab names the page, not the season: a family's lookup page, like the bar's own "Sign in".
export async function generateMetadata({ params }: { params: Promise<{ orgSlug: string; seasonSlug: string }> }): Promise<Metadata> {
  const { orgSlug } = await params;
  return clubPageMetadata(orgSlug, () => 'Registration status');
}

export default async function RegistrationStatusPage({
  params,
}: {
  params: Promise<{ orgSlug: string; seasonSlug: string }>;
}) {
  const { orgSlug, seasonSlug } = await params;

  const org = await resolvePublicLeagueContext(orgSlug);
  if (!org) notFound();

  // Where a family's questions go: the club's public-site contact. Never `org.contactEmail` — that maps a column that
  // does not exist, so the link never showed (F09, Club Tier Stage 4a).
  const [season, siteContent] = await Promise.all([
    getClubSeason(org.id, seasonSlug),
    getClubSiteContent(org.id),
  ]);
  if (!season) notFound();

  // R6: the shared 1200px page column; this lookup form's 560px measure left-aligns inside it.
  const innerStyle = { '--league-measure': '560px' } as React.CSSProperties;

  // The light ground, bar and footer come from the club's frame (Club Tier Stage 4b-1).
  return (
    <div>
      <div className={`container ${column.column}`} style={innerStyle}>
        <Link href={`/${orgSlug}/league/${seasonSlug}`} className={kit.back}>
          ← Back to {season.name}
        </Link>

        <div style={{ marginBottom: '2rem' }}>
          <div className={kit.sub} style={{ marginBottom: '0.4rem' }}>{org.name}</div>
          <h1 className={kit.title}>Registration status</h1>
          <p className={kit.sub}>{season.name}</p>
        </div>

        <StatusLookupForm
          orgSlug={orgSlug}
          seasonSlug={seasonSlug}
          contactEmail={siteContent?.contactEmail ?? null}
        />
      </div>
    </div>
  );
}
