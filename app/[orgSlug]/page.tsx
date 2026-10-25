import { forwardToOwnAddress } from '@/lib/club-forward';
import Link from 'next/link';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Calendar, ChevronRight, Star, Users } from 'lucide-react';
import { getTournamentsByOrg, getLeagueSeasons, getOpenTryoutsByOrg } from '@/lib/db';
import type { OpenTryout } from '@/lib/db';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { isFollowableOrg } from '@/lib/directory';
import { requirePublicClubPage } from '@/lib/public-club-page';
import { clubPageMetadata } from '@/lib/club-page-meta';
import { orgLinks } from '@/lib/org-links';
import { loadClubHome } from '@/lib/club-home-data';
import FollowOrgButton from '@/components/public/FollowOrgButton';
import ClubSiteHome from '@/components/public/ClubSiteHome';
import LeagueSeasonRows from '@/components/public/LeagueSeasonRows';
import { liveLeagueSeasons } from '@/lib/house-league-season';
import { tournamentToday } from '@/lib/timezone';
import styles from './Home.module.css';
import club from './ClubHome.module.css';
import kit from '@/components/public/ClubKit.module.css';

export const dynamic = 'force-dynamic';

/**
 * The club's home is titled with the club's name alone — the layout's default would pass it through the platform's
 * title template ("{club} | FieldLogicHQ"); an absolute title fixes that (Club Tier Stage 4b-1).
 */
export async function generateMetadata({ params }: { params: Promise<{ orgSlug: string }> }): Promise<Metadata> {
  const { orgSlug } = await params;
  // Its preview card is the club's (Stage 4b-2b, End state 8) — `clubPageMetadata`'s default.
  return clubPageMetadata(orgSlug, () => null, { path: '' });
}

/**
 * The hero's picture, when the club uploaded one. The shared hero also drew blurred orbs and a grid behind the
 * title; on the club's light frame those are decoration, not structure, and are not drawn (Club Tier Stage 4b-1).
 */
function HeroBanner({ url }: { url: string | null }) {
  if (!url) return null;
  return (
    <>
      <div className={styles.heroBanner} style={{ backgroundImage: `url(${url})` }} />
      <div className={`${styles.heroBannerOverlay} ${club.heroBannerOverlay}`} />
    </>
  );
}

/**
 * "Tryouts are open" — one card per open tryout, each landing ON that tryout.
 *
 * ⚠ It used to be one card linking to `/{org}/teams`, which is a redirect to a tournament's team
 * list or back to this page (a loop) — a family could see the invitation and never reach the form
 * (Club Tier Readiness F01, J4-042). The data always carried the team slug and program year; there
 * is still no club-wide tryouts index, so several open tryouts are several cards, not one card
 * pointing nowhere. The same card rendered in three branches of this page; this is the one copy.
 */
function OpenTryoutsSection({ href, tryouts }: { href: (path?: string) => string; tryouts: OpenTryout[] }) {
  return (
    <section className="section">
      <div className="container">
        <div className={`section-header ${club.sectionHeader}`}>
          <span className={`eyebrow ${club.eyebrow}`}><Users size={12} /> Rep teams</span>
          <h2 className={club.sectionTitle}>Try out</h2>
        </div>
        <div className={styles.tryoutCards}>
          {tryouts.map(t => (
            <Link
              key={t.programYearId}
              href={href(`/teams/${t.teamSlug}/tryouts`)}
              className={`card ${styles.archivesCta} ${club.archivesCta}`}
            >
              <div>
                <div className={`${styles.archivesCtaTitle} ${club.archivesCtaTitle}`}>Tryouts are open</div>
                <div className={`${styles.archivesCtaSub} ${club.archivesCtaSub}`}>
                  {t.teamName} — {t.programYearName} is accepting applications
                </div>
              </div>
              <ChevronRight size={18} className={`${styles.archivesCtaChevron} ${club.archivesCtaChevron}`} />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export default async function HomePage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  await forwardToOwnAddress(orgSlug, '');
  // The one rule (Club Tier Stage 4a, lib/public-club-access.ts); a tournament-only org keeps its basic home below.
  const org = await requirePublicClubPage(orgSlug, 'home');
  const href = await orgLinks(orgSlug);

  // ── Public Site module branch: the club's home (Club Tier Stage 4b-2a, End state 1) ──────────────
  // Read and shaped by the one loader the editor's preview shares (lib/club-home-data.ts); ClubSiteHome draws, in the
  // ruled order, with every empty program absent.
  if (org && hasModuleEntitlement(org, 'module_public_site')) {
    return <ClubSiteHome {...await loadClubHome(org, orgSlug, { ownHost: href('/') === '/' })} />;
  }

  // F1/F3: the hero Follow button shows only when the org passes the SAME eligibility gate a
  // follow write validates against — so the button never offers a follow the API would reject.
  const showFollow = isFollowableOrg(org);

  const allTournaments   = org ? await getTournamentsByOrg(org.id) : [];
  const activeTournaments = allTournaments.filter(t => t.status === 'active');
  const hasTournamentModule = org ? hasModuleEntitlement(org, 'module_tournaments') : false;
  const hasDraftTournament = allTournaments.some(t => t.status === 'draft');

  // ── Default branch (module not enabled) ───────────────────────────────────
  // Single active tournament → go straight to its home page
  if (activeTournaments.length === 1) {
    redirect(href(`/${activeTournaments[0].slug}`));
  }

  // Fetch module-conditional data for the rendered cases (0 or 2+ tournaments)
  const [defaultLeagueSeasons, defaultOpenTryouts] = org ? await Promise.all([
    hasModuleEntitlement(org, 'module_house_league') ? getLeagueSeasons(org.id) : Promise.resolve([]),
    hasModuleEntitlement(org, 'module_rep_teams')    ? getOpenTryoutsByOrg(org.id) : Promise.resolve([]),
  ]) : [[], []];

  const defaultPublicSeasons  = defaultLeagueSeasons.filter(s => s.status !== 'draft');
  const defaultShowLeague     = defaultPublicSeasons.length > 0;
  // EVERY live season is a row (Club Tier Stage 9a, Q14) — the same rows as the league page and the site home. Before it
  // this home named only the newest (F04), in its own words ("Season in progress — …").
  const defaultLiveSeasons    = liveLeagueSeasons(defaultPublicSeasons).map(s => ({
    id: s.id, name: s.name, status: s.status, seasonStartDate: s.seasonStartDate, seasonEndDate: s.seasonEndDate,
    href: href(`/league/${s.slug}`),
  }));
  const leagueSection = defaultShowLeague && (
    <section className="section">
      <div className="container">
        <div className={`section-header ${club.sectionHeader}`}>
          <h2 className={club.sectionTitle}>House league</h2>
        </div>
        {defaultLiveSeasons.length > 0 ? (
          <LeagueSeasonRows seasons={defaultLiveSeasons} today={tournamentToday()} label="House league seasons" />
        ) : (
          <Link href={href('/league')} className={`card ${styles.archivesCta} ${club.archivesCta}`}>
            <div>
              <div className={`${styles.archivesCtaTitle} ${club.archivesCtaTitle}`}>House league</div>
              <div className={`${styles.archivesCtaSub} ${club.archivesCtaSub}`}>View seasons and results</div>
            </div>
            <ChevronRight size={18} className={`${styles.archivesCtaChevron} ${club.archivesCtaChevron}`} />
          </Link>
        )}
      </div>
    </section>
  );
  const defaultShowTryouts    = defaultOpenTryouts.length > 0;

  const heroBanner = org?.heroBannerUrl ?? null;

  function formatDateRange(start?: string | null, end?: string | null) {
    if (!start) return null;
    const s = new Date(start + 'T12:00:00');
    const e = end ? new Date(end + 'T12:00:00') : null;
    const opts: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric' };
    if (!e) return s.toLocaleDateString('en-CA', opts);
    if (s.getFullYear() === e.getFullYear()) {
      return `${s.toLocaleDateString('en-CA', opts)} – ${e.toLocaleDateString('en-CA', opts)}, ${e.getFullYear()}`;
    }
    return `${s.toLocaleDateString('en-CA', { ...opts, year: 'numeric' })} – ${e.toLocaleDateString('en-CA', { ...opts, year: 'numeric' })}`;
  }

  // No active tournaments — FieldLogicHQ-branded placeholder
  if (activeTournaments.length === 0) {
    const showTournamentDraftGuidance = hasTournamentModule && hasDraftTournament;

    return (
      <div className={`${styles.page} ${club.home}`}>
        <section className={`${styles.hero} ${club.hero}`}>
          <HeroBanner url={heroBanner} />
          <div className={`container ${styles.heroContent} ${club.heroContent}`}>
            <h1 className={`${styles.heroTitle} ${club.title}`}>
              {org?.name ?? orgSlug}
            </h1>
            <p className={`${styles.heroSub} ${club.sub}`}>
              {showTournamentDraftGuidance
                ? 'A tournament is being set up. Registration opens when it is ready.'
                : 'No tournaments are running right now.'}
            </p>
            {showFollow && <FollowOrgButton orgSlug={orgSlug} orgName={org.name} />}
          </div>
        </section>

        {leagueSection}

        {defaultShowTryouts && <OpenTryoutsSection href={href} tryouts={defaultOpenTryouts} />}
      </div>
    );
  }

  // 2+ active tournaments — tournament selector
  return (
    <div className={`${styles.page} ${club.home}`}>
      <section className={`${styles.hero} ${club.hero}`}>
        <HeroBanner url={heroBanner} />
        <div className={`container ${styles.heroContent} ${club.heroContent}`}>
          {org?.logoUrl && (
            <img src={org.logoUrl} alt={org.name} className={`${styles.orgLogo} ${club.logo}`} />
          )}
          <h1 className={`${styles.heroTitle} ${club.title}`}>
            {org?.name ?? orgSlug}
          </h1>
          <p className={`${styles.heroSub} ${club.sub}`}>Select a tournament below to get started.</p>
          {showFollow && <FollowOrgButton orgSlug={orgSlug} orgName={org.name} />}
        </div>
      </section>

      <section id="tournaments" className="section">
        <div className="container">
          <div className={`section-header ${club.sectionHeader}`}>
            <span className={`eyebrow ${club.eyebrow}`}><Calendar size={12} /> Tournaments</span>
            <h2 className={club.sectionTitle}>Active tournaments</h2>
          </div>
          <div className={`${styles.tournamentCards} ${club.tournamentCards}`}>
            {activeTournaments.map(t => (
              <Link key={t.id} href={href(`/${t.slug}`)} className={`card ${styles.tournamentCard} ${club.tournamentCard}`}>
                <div className={`${styles.tournamentCardHeader} ${club.tournamentCardHeader}`}>
                  <span className={`${kit.chip} ${kit.chipOk}`}>
                    <Star size={10} fill="currentColor" /> Live
                  </span>
                  {formatDateRange(t.startDate, t.endDate) && (
                    <span className={`${styles.tournamentCardDate} ${club.tournamentCardDate}`}>
                      {formatDateRange(t.startDate, t.endDate)}
                    </span>
                  )}
                </div>
                <h3 className={`${styles.tournamentCardName} ${club.tournamentCardName}`}>{t.name}</h3>
                <span className={`${styles.tournamentCardCta} ${club.tournamentCardCta}`}>
                  View schedule <ChevronRight size={14} />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {leagueSection}

      {defaultShowTryouts && <OpenTryoutsSection href={href} tryouts={defaultOpenTryouts} />}
    </div>
  );
}
