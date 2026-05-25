import Link from 'next/link';
import { Calendar, Trophy, ChevronRight, Megaphone, Star, Eye } from 'lucide-react';
import { getAnnouncements, getGames, getTeams, getDivisions, getDiamonds } from '@/lib/db';
import type { Organization, Tournament } from '@/lib/types';
import { formatTime } from '@/lib/utils';
import { isPublicPageEnabled } from '@/lib/public-pages';
import { canUseAdvancedTournamentBranding } from '@/lib/tournament-branding';
import LocationLink from '@/components/LocationLink';
import styles from '@/app/[orgSlug]/Home.module.css';

type RegistrationState = 'open' | 'waitlist' | 'closed' | 'not-open' | 'completed';

function getRegistrationState(tournament: Tournament, divisions: Awaited<ReturnType<typeof getDivisions>>, teams: Awaited<ReturnType<typeof getTeams>>): {
  state: RegistrationState;
  label: string;
  detail: string;
} {
  if (tournament.status === 'completed') {
    return {
      state: 'completed',
      label: 'Tournament completed',
      detail: 'Registration is closed. View the schedule and results for this tournament.',
    };
  }
  if (tournament.status !== 'active') {
    return {
      state: 'not-open',
      label: 'Registration not open',
      detail: 'This tournament is still being prepared by the organizer.',
    };
  }
  if (divisions.length === 0) {
    return {
      state: 'not-open',
      label: 'Registration opens soon',
      detail: 'Divisions have not been published yet.',
    };
  }

  const openGroups = divisions.filter(group => !group.isClosed);
  if (openGroups.length === 0) {
    return {
      state: 'closed',
      label: 'Registration closed',
      detail: 'All divisions are currently closed. Contact the organizer for availability.',
    };
  }

  const hasDirectOpenSpot = openGroups.some(group => {
    const registered = teams.filter(team => team.divisionId === group.id).length;
    return !group.capacity || registered < group.capacity;
  });

  if (hasDirectOpenSpot) {
    return {
      state: 'open',
      label: 'Registration is open',
      detail: 'Teams can register for available divisions now.',
    };
  }

  return {
    state: 'waitlist',
    label: 'Join the waitlist',
    detail: 'Divisions are full, but teams can submit for waitlist consideration.',
  };
}

export default async function TournamentHomeContent({
  orgSlug,
  tournamentSlug,
  org,
  tournament,
  isPreview = false,
}: {
  orgSlug: string;
  tournamentSlug: string;
  org: Organization;
  tournament: Tournament;
  isPreview?: boolean;
}) {
  const currentYear = tournament.year;
  const readOptions = isPreview ? { admin: true } : undefined;

  const allAnnouncements = await getAnnouncements(tournament.id, readOptions);
  const announcements = allAnnouncements.slice(0, 3);

  const allGames = await getGames(tournament.id, readOptions);
  const now = new Date().toISOString().split('T')[0];
  const upcomingGames = allGames
    .filter(g => g.status === 'scheduled' && g.date >= now)
    .slice(0, 4);

  const teams     = await getTeams(tournament.id, readOptions);
  const divisions = await getDivisions(tournament.id, readOptions);
  const diamonds  = await getDiamonds(tournament.id, readOptions);

  const registration = getRegistrationState(tournament, divisions, teams);
  const canRegister = registration.state === 'open' || registration.state === 'waitlist';
  const publicBase = `/${orgSlug}/${tournamentSlug}`;
  const adminTournamentBase = `/${orgSlug}/admin/tournaments`;
  const previewBase = `${adminTournamentBase}/preview/${tournamentSlug}`;
  const usePreviewLinks = isPreview;
  const useAdminLinks = isPreview && tournament.status === 'draft';
  const showNewsPage = isPublicPageEnabled(tournament, 'news');
  const showSchedulePage = isPublicPageEnabled(tournament, 'schedule');
  const showStandingsPage = isPublicPageEnabled(tournament, 'standings');
  const showRulesPage = isPublicPageEnabled(tournament, 'rules');
  const showRegistrationPage = isPublicPageEnabled(tournament, 'register');
  const previewLabel = tournament.status === 'draft'
    ? 'Admin preview. This draft tournament is not publicly visible until it is activated.'
    : 'Admin preview. You are viewing this tournament page from inside the admin workspace.';
  const scheduleHref = usePreviewLinks ? `${previewBase}/schedule` : `${publicBase}/schedule`;
  const newsHref = usePreviewLinks ? `${previewBase}/news` : `${publicBase}/news`;
  const rulesHref = usePreviewLinks ? `${previewBase}/rules` : `${publicBase}/rules`;
  const primaryBase = usePreviewLinks ? previewBase : publicBase;
  const primaryCta = (() => {
    if (canRegister && showRegistrationPage) {
      return {
        href: `${primaryBase}/register`,
        label: registration.state === 'waitlist' ? 'Join Waitlist' : 'Register Team',
      };
    }
    if (registration.state === 'completed' && showStandingsPage) {
      return { href: `${primaryBase}/standings`, label: 'View Results' };
    }
    if (showSchedulePage) return { href: `${primaryBase}/schedule`, label: 'View Schedule' };
    if (showStandingsPage) return { href: `${primaryBase}/standings`, label: 'View Standings' };
    if (showNewsPage) return { href: `${primaryBase}/news`, label: 'View News' };
    return null;
  })();
  const showPrimaryCta = !useAdminLinks && !!primaryCta;

  const startDate = tournament.startDate;
  const endDate   = tournament.endDate;

  const dateDisplay = (startDate && endDate)
    ? (() => {
        const s = new Date(startDate + 'T12:00:00');
        const e = new Date(endDate   + 'T12:00:00');
        const sMonthDay = s.toLocaleDateString('en-CA', { month: 'long', day: 'numeric' });
        const eMonthDay = e.toLocaleDateString('en-CA', { month: 'long', day: 'numeric' });
        const eYear = e.getFullYear();
        if (s.getFullYear() === e.getFullYear()) {
          return `${sMonthDay} - ${eMonthDay}, ${eYear}`;
        }
        return `${sMonthDay}, ${s.getFullYear()} - ${eMonthDay}, ${eYear}`;
      })()
    : 'Dates To Be Determined';

  let countdownText = '';
  if (startDate && endDate) {
    const today = new Date().toISOString().split('T')[0];
    if (today < startDate) {
      const msPerDay = 24 * 60 * 60 * 1000;
      const diffDays = Math.ceil(
        (new Date(startDate + 'T00:00:00').getTime() - new Date(today + 'T00:00:00').getTime()) / msPerDay
      );
      countdownText = `${diffDays} days to go`;
    } else if (today >= startDate && today <= endDate) {
      countdownText = 'Tournament in progress';
    } else {
      countdownText = 'Tournament complete';
    }
  }

  const sortedDivisions = [...divisions].sort((a, b) => a.order - b.order);
  const ageRange = sortedDivisions.length > 0
    ? `${sortedDivisions[0].name} - ${sortedDivisions[sortedDivisions.length - 1].name}`
    : 'Divisions TBA';

  const getTeamName     = (id: string) => teams.find(t => t.id === id)?.name ?? 'TBD';
  const getDivisionName = (id: string) => divisions.find(g => g.id === id)?.name ?? '';
  const getDiamond      = (id?: string) => id ? (diamonds.find(d => d.id === id) ?? null) : null;

  function formatDate(dateStr: string) {
    if (!dateStr) return 'TBD';
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-CA', {
      weekday: 'short', month: 'short', day: 'numeric',
    });
  }

  const heroBanner = canUseAdvancedTournamentBranding(org)
    ? tournament.heroBannerUrl ?? org.heroBannerUrl ?? null
    : null;

  return (
    <div className={styles.page}>
      <section className={styles.hero} id="preview-home">
        {heroBanner ? (
          <>
            <div className={styles.heroBanner} style={{ backgroundImage: `url(${heroBanner})` }} />
            <div className={styles.heroBannerOverlay} />
          </>
        ) : (
          <div className={styles.heroBg}>
            <div className={styles.heroOrb1} />
            <div className={styles.heroOrb2} />
            <div className={styles.heroGrid} />
          </div>
        )}

        <div className={`container ${styles.heroContent}`}>
          {isPreview && (
            <div className={styles.previewBanner}>
              <Eye size={14} />
              {previewLabel}
            </div>
          )}
          <div className={styles.heroBadge}>
            <div className={styles.badgeText}>
              <span className={styles.dateLine}>
                <Star size={12} fill="currentColor" />
                {currentYear} Tournament - {dateDisplay}
              </span>
              {countdownText && (
                <span className={styles.countdown}>
                  <span className={styles.badgeSeparator}> - </span>
                  {countdownText}
                </span>
              )}
            </div>
          </div>

          <h1 className={`display-xl ${styles.heroTitle}`}>
            {tournament.name}
          </h1>
          <p className={styles.heroSub}>
            Hosted by <strong>{org.name}</strong>. View tournament details and updates in one place.
          </p>

          <div className={styles.registrationStatus}>
            <strong>{registration.label}</strong>
            <span>{registration.detail}</span>
          </div>

          <div className={styles.heroCta}>
            {showPrimaryCta && (
              <Link href={primaryCta!.href} className="btn btn-primary btn-lg" id="hero-primary-btn">
                {primaryCta!.label}
              </Link>
            )}
            {showSchedulePage && (
              <Link href={scheduleHref} className="btn btn-outline btn-lg" id="hero-schedule-btn">
                <Calendar size={18} /> View Schedule
              </Link>
            )}
            {showNewsPage && (
              <Link href={newsHref} className="btn btn-outline btn-lg" id="hero-news-btn">
                <Megaphone size={18} /> Announcements
              </Link>
            )}
          </div>

          <div className={styles.stats}>
            <div className={styles.stat}>
              <span className={styles.statNum}>{divisions.length || 'TBA'}</span>
              <span className={styles.statLabel}>Divisions</span>
            </div>
            <div className={styles.statDivider} />
            <div className={styles.stat}>
              <span className={styles.statNum}>{teams.length || 'TBA'}</span>
              <span className={styles.statLabel}>Teams</span>
            </div>
            <div className={styles.statDivider} />
            <div className={styles.stat}>
              <span className={`${styles.statNum} ${styles.ageRangeText}`}>{ageRange}</span>
              <span className={styles.statLabel}>Divisions</span>
            </div>
          </div>
        </div>

        <div className={styles.heroScroll}>
          <div className={styles.scrollLine} />
        </div>
      </section>

      {showNewsPage && (
      <section className={`section ${styles.announcementsSection}`} id="announcements">
        <div className="container">
          <div className="section-header">
            <span className="eyebrow"><Megaphone size={12} /> Latest News</span>
            <h2 className="display-md">Announcements</h2>
          </div>

          {announcements.length === 0 ? (
            <div className="empty-state">
              <Megaphone size={40} />
              <p>No announcements yet.</p>
            </div>
          ) : (
            <div className={styles.annGrid}>
              {announcements.map((ann, i) => (
                <div key={ann.id} className={`card ${styles.annCard} ${i === 0 ? styles.annFeatured : ''}`}>
                  <div className={styles.annHeader}>
                    {ann.pinned && (
                      <span className="badge badge-primary"><Star size={10} fill="currentColor" />&nbsp;Pinned</span>
                    )}
                    <span className={styles.annDate}>
                      {new Date(ann.date).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                  <h3 className={styles.annTitle}>{ann.title}</h3>
                  <p className={styles.annBody}>
                    {ann.body ? (
                      <>{ann.body.slice(0, 200)}{ann.body.length > 200 ? '...' : ''}</>
                    ) : (
                      'No content provided.'
                    )}
                  </p>
                </div>
              ))}
            </div>
          )}

          <div className="text-center mt-3">
            <Link href={newsHref} className="btn btn-outline" id="home-all-news-btn">
              All Announcements <ChevronRight size={16} />
            </Link>
          </div>
        </div>
      </section>
      )}

      {showSchedulePage && (
      <section className="section" id="schedule">
        <div className="container">
          <div className="section-header">
            <span className="eyebrow"><Calendar size={12} /> Upcoming Games</span>
            <h2 className="display-md">Next On The Schedule</h2>
            <p>Here are the next scheduled games for this tournament.</p>
          </div>

          {upcomingGames.length === 0 ? (
            <div className="empty-state">
              <Calendar size={40} />
              <p>No upcoming games scheduled yet. Check back soon!</p>
            </div>
          ) : (
            <div className={styles.gamesGrid}>
              {upcomingGames.map(game => (
                <div key={game.id} className={`card ${styles.gameCard}`}>
                  <div className={styles.gameHeader}>
                    <span className="badge badge-primary">
                      {game.isPlayoff && game.bracketCode ? game.bracketCode : getDivisionName(game.divisionId)}
                    </span>
                    <span className={styles.gameDate}>{formatDate(game.date)} - {formatTime(game.time)}</span>
                  </div>
                  <div className={styles.matchup}>
                    <span className={styles.teamName}>{getTeamName(game.homeTeamId)}</span>
                    <span className={styles.vs}>VS</span>
                    <span className={styles.teamName}>{getTeamName(game.awayTeamId)}</span>
                  </div>
                  <div className={styles.gameLocation}>
                    <LocationLink location={game.location} diamond={getDiamond(game.diamondId)} size="sm" />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="text-center mt-3">
            <Link href={scheduleHref} className="btn btn-outline" id="home-all-schedule-btn">
              Full Schedule <ChevronRight size={16} />
            </Link>
          </div>
        </div>
      </section>
      )}

      <section className={styles.ctaSection}>
        <div className={styles.ctaBg} />
        <div className="container">
          <div className={styles.ctaContent}>
            <Trophy size={40} className={styles.ctaIcon} />
            <h2 className="display-md">{canRegister ? 'Ready to Register?' : 'Follow the Tournament'}</h2>
            <p>{canRegister && showRegistrationPage ? 'Submit your team registration and watch for organizer updates.' : 'Follow tournament updates from the available public pages.'}</p>
            <div className={styles.ctaButtons}>
              {showPrimaryCta && (
                <Link href={primaryCta!.href} className="btn btn-primary btn-lg" id="cta-primary-btn">
                  {primaryCta!.label}
                </Link>
              )}
              {showRulesPage && (
                <Link href={rulesHref} className="btn btn-ghost btn-lg" id="cta-rules-btn">
                  Tournament Rules
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
