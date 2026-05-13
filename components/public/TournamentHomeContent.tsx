import Link from 'next/link';
import { Calendar, Trophy, ChevronRight, Megaphone, Star, Eye } from 'lucide-react';
import { getAnnouncements, getGames, getTeams, getAgeGroups, getDiamonds } from '@/lib/db';
import type { Organization, Tournament } from '@/lib/types';
import { formatTime } from '@/lib/utils';
import LocationLink from '@/components/LocationLink';
import styles from '@/app/[orgSlug]/Home.module.css';

type RegistrationState = 'open' | 'waitlist' | 'closed' | 'not-open' | 'completed';

function getRegistrationState(tournament: Tournament, ageGroups: Awaited<ReturnType<typeof getAgeGroups>>, teams: Awaited<ReturnType<typeof getTeams>>): {
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
  if (ageGroups.length === 0) {
    return {
      state: 'not-open',
      label: 'Registration opens soon',
      detail: 'Divisions have not been published yet.',
    };
  }

  const openGroups = ageGroups.filter(group => !group.isClosed);
  if (openGroups.length === 0) {
    return {
      state: 'closed',
      label: 'Registration closed',
      detail: 'All divisions are currently closed. Contact the organizer for availability.',
    };
  }

  const hasDirectOpenSpot = openGroups.some(group => {
    const registered = teams.filter(team => team.ageGroupId === group.id).length;
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

  const allAnnouncements = await getAnnouncements(tournament.id);
  const announcements = allAnnouncements.slice(0, 3);

  const allGames = await getGames(tournament.id);
  const now = new Date().toISOString().split('T')[0];
  const upcomingGames = allGames
    .filter(g => g.status === 'scheduled' && g.date >= now)
    .slice(0, 4);

  const teams     = await getTeams(tournament.id);
  const ageGroups = await getAgeGroups(tournament.id);
  const diamonds  = await getDiamonds(tournament.id);

  const registration = getRegistrationState(tournament, ageGroups, teams);
  const canRegister = registration.state === 'open' || registration.state === 'waitlist';
  const publicBase = `/${orgSlug}/${tournamentSlug}`;
  const adminTournamentBase = `/${orgSlug}/admin/tournaments`;
  const useAdminLinks = isPreview && tournament.status === 'draft';
  const scheduleHref = useAdminLinks ? `${adminTournamentBase}/schedule` : `${publicBase}/schedule`;
  const newsHref = useAdminLinks ? `${adminTournamentBase}/announcements` : `${publicBase}/news`;
  const rulesHref = useAdminLinks ? `${adminTournamentBase}/rules` : `${publicBase}/rules`;
  const primaryHref = useAdminLinks
    ? `/${orgSlug}/admin/org/tournaments`
    : canRegister
    ? `/${orgSlug}/${tournamentSlug}/register`
    : `/${orgSlug}/${tournamentSlug}/${registration.state === 'completed' ? 'standings' : 'schedule'}`;
  const primaryLabel = useAdminLinks
    ? 'Continue Setup'
    : canRegister
    ? (registration.state === 'waitlist' ? 'Join Waitlist' : 'Register Team')
    : (registration.state === 'completed' ? 'View Results' : 'View Schedule');

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

  const sortedAgeGroups = [...ageGroups].sort((a, b) => a.order - b.order);
  const ageRange = sortedAgeGroups.length > 0
    ? `${sortedAgeGroups[0].name} - ${sortedAgeGroups[sortedAgeGroups.length - 1].name}`
    : 'Divisions TBA';

  const getTeamName     = (id: string) => teams.find(t => t.id === id)?.name ?? 'TBD';
  const getAgeGroupName = (id: string) => ageGroups.find(g => g.id === id)?.name ?? '';
  const getDiamond      = (id?: string) => id ? (diamonds.find(d => d.id === id) ?? null) : null;

  function formatDate(dateStr: string) {
    if (!dateStr) return 'TBD';
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-CA', {
      weekday: 'short', month: 'short', day: 'numeric',
    });
  }

  const heroBanner = org.heroBannerUrl ?? null;

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
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
              Draft preview. This page is visible to admins only until the tournament is activated.
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
            Hosted by <strong>{org.name}</strong>. View schedules, results, teams,
            and tournament rules in one place.
          </p>

          <div className={styles.registrationStatus}>
            <strong>{registration.label}</strong>
            <span>{registration.detail}</span>
          </div>

          <div className={styles.heroCta}>
            <Link href={primaryHref} className="btn btn-primary btn-lg" id="hero-primary-btn">
              {primaryLabel}
            </Link>
            <Link href={scheduleHref} className="btn btn-outline btn-lg" id="hero-schedule-btn">
              <Calendar size={18} /> View Schedule
            </Link>
            <Link href={newsHref} className="btn btn-outline btn-lg" id="hero-news-btn">
              <Megaphone size={18} /> Announcements
            </Link>
          </div>

          <div className={styles.stats}>
            <div className={styles.stat}>
              <span className={styles.statNum}>{ageGroups.length || 'TBA'}</span>
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

      <section className={`section ${styles.announcementsSection}`}>
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

      <section className="section">
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
                      {game.isPlayoff && game.bracketCode ? game.bracketCode : getAgeGroupName(game.ageGroupId)}
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

      <section className={styles.ctaSection}>
        <div className={styles.ctaBg} />
        <div className="container">
          <div className={styles.ctaContent}>
            <Trophy size={40} className={styles.ctaIcon} />
            <h2 className="display-md">{canRegister ? 'Ready to Register?' : 'Follow the Tournament'}</h2>
            <p>{canRegister ? 'Submit your team registration and watch for organizer updates.' : 'Check the schedule, standings, and rules for tournament updates.'}</p>
            <div className={styles.ctaButtons}>
              <Link href={primaryHref} className="btn btn-primary btn-lg" id="cta-primary-btn">
                {primaryLabel}
              </Link>
              <Link href={rulesHref} className="btn btn-ghost btn-lg" id="cta-rules-btn">
                Tournament Rules
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
