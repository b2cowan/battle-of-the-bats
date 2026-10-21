import Link from 'next/link';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Calendar, ChevronRight, Star, Users } from 'lucide-react';
import {
  getTournamentsByOrg,
  getLeagueSeasons, getDivisions, getOpenTryoutsByOrg,
  getTeams,
} from '@/lib/db';
import type { OpenTryout } from '@/lib/db';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { isFollowableOrg } from '@/lib/directory';
import { requirePublicClubPage } from '@/lib/public-club-page';
import { clubTeamsAddress } from '@/lib/public-club-access';
import { clubHomeTournaments, clubTeamBands, orderOpenNow, tournamentHomeStatus } from '@/lib/club-site-home';
import { readClubTeams } from '@/lib/club-public-teams';
import { readClubTryouts } from '@/lib/club-tryouts';
import { homeTryoutsRowSub, isListedTryout, openNowTryouts, sharedSeasonYear, tryoutDaysLine, tryoutSeasonMeta, tryoutsPageTitle } from '@/lib/tryout-season';
import { formatEventDateRange, formatStoredDate, tournamentToday } from '@/lib/timezone';
import { getRegistrationState } from '@/lib/registration-state';
import { clubPageMetadata, getClubSiteContent } from '@/lib/club-page-meta';
import FollowOrgButton from '@/components/public/FollowOrgButton';
import ClubSiteHome from '@/components/public/ClubSiteHome';
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
  return clubPageMetadata(orgSlug, () => null);
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
function OpenTryoutsSection({ orgSlug, tryouts }: { orgSlug: string; tryouts: OpenTryout[] }) {
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
              href={`/${orgSlug}/teams/${t.teamSlug}/tryouts`}
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
  // The one rule (Club Tier Stage 4a, lib/public-club-access.ts); a tournament-only org keeps its basic home below.
  const org = await requirePublicClubPage(orgSlug, 'home');

  // F1/F3: the hero Follow button shows only when the org passes the SAME eligibility gate a
  // follow write validates against — so the button never offers a follow the API would reject.
  const showFollow = isFollowableOrg(org);

  const allTournaments   = org ? await getTournamentsByOrg(org.id) : [];
  const activeTournaments = allTournaments.filter(t => t.status === 'active');
  const hasTournamentModule = org ? hasModuleEntitlement(org, 'module_tournaments') : false;
  const hasDraftTournament = allTournaments.some(t => t.status === 'draft');

  // ── Public Site module branch: the club's home (Club Tier Stage 4b-2a, End state 1) ──────────────
  // This reads and shapes; ClubSiteHome draws, in the ruled order, with every empty program absent.
  if (org && hasModuleEntitlement(org, 'module_public_site')) {
    const withTeams = clubTeamsAddress(org) === 'teams-page';
    const today = tournamentToday();
    const [siteContent, leagueSeasons, clubTeams, clubTryouts] = await Promise.all([
      getClubSiteContent(org.id),
      hasModuleEntitlement(org, 'module_house_league') ? getLeagueSeasons(org.id) : Promise.resolve([]),
      // The club's listed teams and its open tryouts — the same read the Teams page makes.
      withTeams ? readClubTeams(org.id) : Promise.resolve({ bands: [], count: 0 }),
      // Every listed team's tryout and its days, for Open now's tryouts (Stage 4b-2b) — the Tryouts page's own read.
      // A failed tryout read costs the home its tryouts row, never the page.
      withTeams ? readClubTryouts(org.id, today).catch(() => ({ teams: [], groups: [] })) : Promise.resolve({ teams: [], groups: [] }),
    ]);
    const thisYear = today.slice(0, 4);
    const day = (value: string) => formatStoredDate(value, { withYear: !value.startsWith(thisYear) });

    // House league: a draft season is not public; the section's door is the league page.
    const publicLeagueSeasons = leagueSeasons.filter(s => s.status !== 'draft');
    const runningSeason = publicLeagueSeasons.find(s => ['registration_open', 'registration_closed', 'active'].includes(s.status));
    const league = publicLeagueSeasons.length === 0 ? null : {
      href: `/${orgSlug}/league`,
      title: runningSeason?.name ?? 'House league',
      // Words through /marketing 2026-10-20: "open" is said once, by Open now, so this line says what the door gives.
      sub: !runningSeason ? 'Past seasons and results'
        : runningSeason.status === 'active' ? 'Schedule and standings'
        : runningSeason.seasonStartDate ? `Schedule and standings from ${day(runningSeason.seasonStartDate)}`
        : 'Schedule and standings when the season starts',
    };

    // Open now's tryouts (Stage 4b-2b, Ask 14 round 2): more than one team open or not open yet → ONE row, the door to the
    // Tryouts page; exactly one team open → its own row with its days line; otherwise none (the one rule decides).
    const tryoutPick = openNowTryouts(clubTryouts.teams);
    const tryoutRows = tryoutPick.kind === 'team' ? [{
      key: `tryout-${tryoutPick.team.season.id}`,
      href: `/${orgSlug}/teams/${tryoutPick.team.slug}/tryouts`,
      title: `${tryoutPick.team.name} tryouts`,
      sub: tryoutDaysLine(tryoutPick.team.standing.upcoming) ?? tryoutSeasonMeta(tryoutPick.team.season),
      deadline: null,
    }] : tryoutPick.kind === 'season' ? [{
      key: 'tryouts',
      href: `/${orgSlug}/tryouts`,
      // The year the Tryouts page's title names — from the same listed teams, so the row and the page it opens agree.
      title: tryoutsPageTitle(sharedSeasonYear(clubTryouts.teams.filter(t => isListedTryout(t.standing, today)).map(t => ({ seasonYear: t.season.year })))),
      sub: homeTryoutsRowSub(tryoutPick.teams.length, clubTeamBands(tryoutPick.teams, clubTryouts.groups).map(b => ({
        name: b.name,
        days: b.teams.flatMap(t => t.standing.heldDays),
      }))),
      deadline: null,
    }] : [];

    // Open now: every open house-league registration, then the tryouts (above), nearest deadline first.
    const openNow = orderOpenNow([
      ...publicLeagueSeasons.filter(s => s.status === 'registration_open').map(s => {
        // The admin's form stores the close time as typed, with a Z on the end (house-league page), so its date part is
        // the day the club typed. A day already behind today is not said: "Sign up by" a past date is not a deadline.
        const closes = s.registrationCloseAt?.slice(0, 10) ?? null;
        const deadline = closes && closes >= today ? closes : null;
        return {
          key: `league-${s.id}`,
          href: `/${orgSlug}/league/${s.slug}`,
          title: s.name,
          sub: [
            deadline ? `Sign up by ${day(deadline)}` : null,
            // The fee as the season's own page writes it.
            s.registrationFee != null ? `$${s.registrationFee.toFixed(2)}` : null,
          ].filter(Boolean).join(' · ') || null,
          deadline,
        };
      }),
      ...tryoutRows,
    ]);

    // Tournaments, with a status true to their dates (S4-03), chosen and ordered by `clubHomeTournaments` (running and
    // coming first; one that just finished after). The club's own "show upcoming tournaments" switch still hides the
    // section. Registration is asked only of an event that has not started and whose register page is not hidden.
    const shownTournaments = siteContent?.showUpcomingTournaments === false ? [] : clubHomeTournaments(allTournaments, today);
    const tournaments = await Promise.all(shownTournaments.map(async t => {
      const asksRegistration = t.status === 'active' && !!t.startDate && today < t.startDate && !t.publicHiddenPages?.includes('register');
      const registrationOpen = asksRegistration
        ? await Promise.all([getDivisions(t.id, { admin: true }), getTeams(t.id, { admin: true })])
            .then(([divisions, teams]) => getRegistrationState(t, divisions, teams.filter(x => x.status !== 'rejected')).state === 'open')
        : false;
      const status = tournamentHomeStatus(t, today, registrationOpen);
      return {
        id: t.id,
        href: `/${orgSlug}/${t.slug}`,
        name: t.name,
        dates: t.startDate ? formatEventDateRange(t.startDate, t.endDate, !t.startDate.startsWith(thisYear)) : null,
        status,
      };
    }));

    return (
      <ClubSiteHome
        orgSlug={orgSlug}
        orgName={org.name}
        bannerUrl={org.heroBannerUrl ?? null}
        openNow={openNow}
        teamBands={clubTeams.bands}
        league={league}
        tournaments={tournaments}
        about={siteContent?.description?.trim() || null}
        showFollow={showFollow}
      />
    );
  }

  // ── Default branch (module not enabled) ───────────────────────────────────
  // Single active tournament → go straight to its home page
  if (activeTournaments.length === 1) {
    redirect(`/${orgSlug}/${activeTournaments[0].slug}`);
  }

  // Fetch module-conditional data for the rendered cases (0 or 2+ tournaments)
  const [defaultLeagueSeasons, defaultOpenTryouts] = org ? await Promise.all([
    hasModuleEntitlement(org, 'module_house_league') ? getLeagueSeasons(org.id) : Promise.resolve([]),
    hasModuleEntitlement(org, 'module_rep_teams')    ? getOpenTryoutsByOrg(org.id) : Promise.resolve([]),
  ]) : [[], []];

  const defaultPublicSeasons  = defaultLeagueSeasons.filter(s => s.status !== 'draft');
  const defaultActiveSeason   = defaultPublicSeasons.find(s => ['registration_open', 'registration_closed', 'active'].includes(s.status));
  const defaultShowLeague     = defaultPublicSeasons.length > 0;
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

        {defaultShowLeague && (
          <section className="section">
            <div className="container">
              <div className={`section-header ${club.sectionHeader}`}>
                <h2 className={club.sectionTitle}>House league</h2>
              </div>
              <Link href={`/${orgSlug}/league`} className={`card ${styles.archivesCta} ${club.archivesCta}`}>
                <div>
                  <div className={`${styles.archivesCtaTitle} ${club.archivesCtaTitle}`}>
                    {defaultActiveSeason ? defaultActiveSeason.name : 'House league'}
                  </div>
                  <div className={`${styles.archivesCtaSub} ${club.archivesCtaSub}`}>
                    {defaultActiveSeason
                      ? defaultActiveSeason.status === 'registration_open'
                        ? 'Registration is open — sign up now'
                        : defaultActiveSeason.status === 'active'
                          ? 'Season in progress — view standings and schedule'
                          : 'Registration closed — season starting soon'
                      : 'View seasons and results'}
                  </div>
                </div>
                <ChevronRight size={18} className={`${styles.archivesCtaChevron} ${club.archivesCtaChevron}`} />
              </Link>
            </div>
          </section>
        )}

        {defaultShowTryouts && <OpenTryoutsSection orgSlug={orgSlug} tryouts={defaultOpenTryouts} />}
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
              <Link key={t.id} href={`/${orgSlug}/${t.slug}`} className={`card ${styles.tournamentCard} ${club.tournamentCard}`}>
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

      {defaultShowLeague && (
        <section className="section">
          <div className="container">
            <div className={`section-header ${club.sectionHeader}`}>
              <h2 className={club.sectionTitle}>House league</h2>
            </div>
            <Link href={`/${orgSlug}/league`} className={`card ${styles.archivesCta} ${club.archivesCta}`}>
              <div>
                <div className={`${styles.archivesCtaTitle} ${club.archivesCtaTitle}`}>
                  {defaultActiveSeason ? defaultActiveSeason.name : 'House league'}
                </div>
                <div className={`${styles.archivesCtaSub} ${club.archivesCtaSub}`}>
                  {defaultActiveSeason
                    ? defaultActiveSeason.status === 'registration_open'
                      ? 'Registration is open — sign up now'
                      : defaultActiveSeason.status === 'active'
                        ? 'Season in progress — view standings and schedule'
                        : 'Registration closed — season starting soon'
                    : 'View seasons and results'}
                </div>
              </div>
              <ChevronRight size={18} className={`${styles.archivesCtaChevron} ${club.archivesCtaChevron}`} />
            </Link>
          </div>
        </section>
      )}

      {defaultShowTryouts && <OpenTryoutsSection orgSlug={orgSlug} tryouts={defaultOpenTryouts} />}
    </div>
  );
}
