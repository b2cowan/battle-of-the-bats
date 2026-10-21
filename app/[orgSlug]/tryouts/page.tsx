import type { Metadata } from 'next';
import { Fragment } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { clubTeamsAddress } from '@/lib/public-club-access';
import { requirePublicClubPage } from '@/lib/public-club-page';
import { clubPageMetadata, getClubSiteContent } from '@/lib/club-page-meta';
import { lastClubTryoutDay, readClubTryouts } from '@/lib/club-tryouts';
import { clubTeamBands } from '@/lib/club-site-home';
import {
  bandHeading,
  isListedTryout,
  offSeasonSentence,
  sharedSeasonYear,
  tryoutsPageDescription,
  tryoutsPageSub,
  tryoutsPageTitle,
  tryoutsRowSub,
} from '@/lib/tryout-season';
import { tournamentToday } from '@/lib/timezone';
import kit from '@/components/public/ClubKit.module.css';
import styles from '@/components/public/TryoutPage.module.css';
import ClubContactCard from '@/components/public/ClubContactCard';
import ClubContactLine from '@/components/public/ClubContactLine';
import TryoutChip from '@/components/public/TryoutChip';

export const dynamic = 'force-dynamic';

/** The teams this page lists today: open, not open yet, or finished in the last four weeks (the tab's own rule). */
async function listedTryouts(orgId: string, today: string) {
  const { teams, groups } = await readClubTryouts(orgId, today);
  const listed = teams.filter(t => isListedTryout(t.standing, today));
  return { listed, groups, year: sharedSeasonYear(listed.map(t => ({ seasonYear: t.season.year }))) };
}

/** "2027 tryouts · Lakeshore Lynx", described in the club's words; out of season "Tryouts · …" with its own sentence. */
export async function generateMetadata({ params }: { params: Promise<{ orgSlug: string }> }): Promise<Metadata> {
  const { orgSlug } = await params;
  return clubPageMetadata(orgSlug, async club => {
    if (clubTeamsAddress(club) !== 'teams-page') return null;
    // The club's own card (the page is the whole club's tryouts): `clubPageMetadata`'s default.
    const { listed, year } = await listedTryouts(club.id, tournamentToday());
    return listed.length > 0
      ? { name: tryoutsPageTitle(year), description: tryoutsPageDescription(year) }
      : { name: tryoutsPageTitle(null) };
  });
}

/**
 * THE CLUB TRYOUTS PAGE (Club Tier Stage 4b-2b; Ask 14A, R-01, R-06; drawn ~L1840; the off-season state ruled 2026-10-20).
 * Every tryout the club runs this season on one page — the link a club posts every September in place of a flyer —
 * grouped the club's way, each team saying by itself whether it is open, not open yet or finished. The facts come from
 * the tryout days each coach already entered, so it all expires by itself: four weeks after a team's last day it leaves
 * the page, and when none is left the Tryouts tab leaves too. The address keeps working all year and then says when the
 * club's last tryouts were. NOT here: born-in years and the Born in picker (Stage 4c), players (never).
 */
export default async function ClubTryoutsPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  // A club whose plan does not carry rep teams has no tryouts to list: the club's "not found" (inside its site when the
  // site is open, the neutral refusal when it is not).
  // The one rule (Club Tier Stage 4a) first, then the plan's page.
  const org = await requirePublicClubPage(orgSlug, 'teams');
  if (clubTeamsAddress(org) !== 'teams-page') notFound();

  const today = tournamentToday();
  // The off-season date is a one-row read: asked beside the list, used only when the list is empty.
  const lastRead = lastClubTryoutDay(org.id, today).catch(() => null);
  const [{ listed, groups, year }, site] = await Promise.all([listedTryouts(org.id, today), getClubSiteContent(org.id)]);
  const email = site?.contactEmail?.trim() || null;

  if (listed.length === 0) {
    // Out of season (ruled 2026-10-20, Ask 1): no tab lit, no chip — the page has no team's state to name — and no
    // "See all teams" button (the tab row is the way on). The card is the finished tryout page's.
    const last = await lastRead;
    return (
      <div className={styles.page}>
        <div className={styles.head}><h1 className={kit.title}>{tryoutsPageTitle(null)}</h1></div>
        <ClubContactCard sentence={offSeasonSentence(last)} email={email} />
      </div>
    );
  }

  const bands = clubTeamBands(listed, groups);
  const sub = tryoutsPageSub(year, bands.map(b => b.name));
  const href = (slug: string) => `/${orgSlug}/teams/${slug}/tryouts`;

  return (
    <div className={`${styles.page} ${styles.wide}`}>
      <div className={styles.title}>
        <h1 className={kit.title}>{tryoutsPageTitle(year)}</h1>
        {sub && <p className={kit.sub}>{sub}</p>}
      </div>

      <div className={kit.list}>
        {bands.map((band, i) => (
          <Fragment key={i}>
            {band.name && <div className={kit.listBand}>{bandHeading(band.name, band.teams.flatMap(t => t.standing.heldDays))}</div>}
            {band.teams.map(t => (
              <Link key={t.slug} href={href(t.slug)} className={kit.row}>
                <span className={kit.rowMain}>
                  <span className={kit.rowName}>{t.name}</span>
                  <span className={kit.rowSub}>{tryoutsRowSub(t.standing, t.season, today)}</span>
                </span>
                <TryoutChip state={t.standing.state} className={styles.rowChip} />
              </Link>
            ))}
          </Fragment>
        ))}
      </div>

      <ClubContactLine email={email} />
    </div>
  );
}
