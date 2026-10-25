import { forwardToOwnAddress } from '@/lib/club-forward';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getLeagueSeasons } from '@/lib/db';
import { resolvePublicLeagueContext } from '@/lib/public-league';
import { clubPageMetadata } from '@/lib/club-page-meta';
import { orgLinks } from '@/lib/org-links';
import { liveLeagueSeasons, orderSeasons } from '@/lib/house-league-season';
import { tournamentToday } from '@/lib/timezone';
import LeagueSeasonRows from '@/components/public/LeagueSeasonRows';
import { withEarlyBird } from '@/lib/league-early-bird';
import column from './league-column.module.css';
import kit from '@/components/public/ClubKit.module.css';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ orgSlug: string }> }): Promise<Metadata> {
  const { orgSlug } = await params;
  return clubPageMetadata(orgSlug, () => 'House league', { path: '/league' });
}

/**
 * The club's house-league page (Club Tier Stage 9a, Part 5; Q14, frame E). EVERY live season leads, under Running now,
 * each labelled by what is happening; the finished ones sit under Past seasons. Before 9a the page featured only the
 * newest live season (by when it was made), so a club with 2026 playing and 2027 taking sign-ups hid one of them (F04).
 */
export default async function LeagueIndexPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  await forwardToOwnAddress(orgSlug, '/league');
  const orgHref = await orgLinks(orgSlug);

  const org = await resolvePublicLeagueContext(orgSlug);
  if (!org) notFound();

  const allSeasons = await getLeagueSeasons(org.id);
  const visibleSeasons = allSeasons.filter(s => s.status !== 'draft');
  // A club that runs no house league here has no league page: the club's "not found" says so, inside its site (F09,
  // Club Tier Stage 4a). This page used to say "No seasons have been published yet. Check back soon."
  if (visibleSeasons.length === 0) notFound();

  const today = tournamentToday();
  const withHref = <T extends { slug: string }>(list: T[]) => list.map(s => ({ ...s, href: orgHref(`/league/${s.slug}`) }));
  const running = withHref(await withEarlyBird(liveLeagueSeasons(visibleSeasons), today));
  const past = withHref(orderSeasons(visibleSeasons.filter(s => s.status === 'completed' || s.status === 'archived')));

  // The light ground and the club's bar and footer come from the club's frame (Club Tier Stage 4b-1); the page only
  // lays out its column. The credit line moved to the frame's footer.
  return (
    <div>
      {/* R6: the shared 1200px page column, with this page's 760px reading measure left-aligned
          inside it — so headings sit under the section tab row rather than 244px inboard of it. */}
      <div className={`container ${column.column}`}>
        <div className={column.header}>
          <h1 className={kit.title}>House league</h1>
          <p className={kit.sub}>{org.name}</p>
        </div>

        {running.length > 0 && (
          <div style={{ marginBottom: '2.5rem' }}>
            <div className={kit.band}>Running now</div>
            <LeagueSeasonRows seasons={running} today={today} label="Running now" />
          </div>
        )}

        {past.length > 0 && (
          <div>
            <div className={kit.band}>Past seasons</div>
            <LeagueSeasonRows seasons={past} today={today} label="Past seasons" />
          </div>
        )}
      </div>
    </div>
  );
}
