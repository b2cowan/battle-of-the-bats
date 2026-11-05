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
import PublicPage from '@/components/public/PublicPage';
import PublicSectionHead from '@/components/public/PublicSectionHead';
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
  // The club page column (club round C2 + C5): on the logo edge, 960 at most, 24 between sections.
  return (
    <PublicPage frame="club">
      {/* C3: the lit House league tab names the page, so no visible title (the band names the club); each section heads
          its own list with its count (R4). */}
      <h1 className={kit.srOnly}>House league</h1>

      {running.length > 0 && (
        <section className={kit.section} aria-labelledby="league-running">
          <PublicSectionHead id="league-running" title="Running now" count={running.length} />
          <LeagueSeasonRows seasons={running} today={today} label="Running now" />
        </section>
      )}

      {past.length > 0 && (
        <section className={kit.section} aria-labelledby="league-past">
          <PublicSectionHead id="league-past" title="Past seasons" count={past.length} />
          <LeagueSeasonRows seasons={past} today={today} label="Past seasons" />
        </section>
      )}
    </PublicPage>
  );
}
