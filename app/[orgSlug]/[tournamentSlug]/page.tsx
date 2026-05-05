import Link from 'next/link';
import { Calendar, Trophy, ChevronRight, Megaphone, Star } from 'lucide-react';
import { getAnnouncements, getGames, getTeams, getAgeGroups, getDiamonds, getOrganizationBySlug, getTournamentBySlug } from '@/lib/db';
import { formatTime } from '@/lib/utils';
import LocationLink from '@/components/LocationLink';
import styles from '../Home.module.css';

export const dynamic = 'force-dynamic';

export default async function TournamentHomePage({
  params,
}: {
  params: Promise<{ orgSlug: string; tournamentSlug: string }>;
}) {
  const { orgSlug, tournamentSlug } = await params;
  const org = await getOrganizationBySlug(orgSlug);
  if (!org) return null; // layout handles 404

  const tournament = await getTournamentBySlug(org.id, tournamentSlug);
  if (!tournament) return null; // layout handles 404

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
          return `${sMonthDay} – ${eMonthDay}, ${eYear}`;
        }
        return `${sMonthDay}, ${s.getFullYear()} – ${eMonthDay}, ${eYear}`;
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
      countdownText = 'Tournament in Progress! 🔥';
    } else {
      countdownText = 'See you next year!';
    }
  }

  const sortedAgeGroups = [...ageGroups].sort((a, b) => a.order - b.order);
  const ageRange = sortedAgeGroups.length > 0
    ? `${sortedAgeGroups[0].name} – ${sortedAgeGroups[sortedAgeGroups.length - 1].name}`
    : 'U11 – U19';

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
      {/* Hero */}
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
          <div className={styles.heroBadge}>
            <div className={styles.badgeText}>
              <span className={styles.dateLine}>
                <Star size={12} fill="currentColor" />
                {currentYear} Tournament • {dateDisplay}
              </span>
              {countdownText && (
                <span className={styles.countdown}>
                  <span className={styles.badgeSeparator}> • </span>
                  ⏳ {countdownText}
                </span>
              )}
            </div>
          </div>

          <h1 className={`display-xl ${styles.heroTitle}`}>
            BATTLE<br />
            <span className={styles.heroAccent}>OF THE</span><br />
            BATS
          </h1>
          <p className={styles.heroSub}>
            The premier youth softball tournament hosted by the <strong>{org.name}</strong>.{' '}
            {ageRange} age divisions. Elite competition, lifelong memories.
          </p>

          <div className={styles.heroCta}>
            <Link href={`/${orgSlug}/${tournamentSlug}/schedule`} className="btn btn-primary btn-lg" id="hero-schedule-btn">
              <Calendar size={18} /> View Schedule
            </Link>
            <Link href={`/${orgSlug}/${tournamentSlug}/news`} className="btn btn-outline btn-lg" id="hero-news-btn">
              <Megaphone size={18} /> Announcements
            </Link>
          </div>

          {/* Stats */}
          <div className={styles.stats}>
            <div className={styles.stat}>
              <span className={styles.statNum}>{ageGroups.length || 5}</span>
              <span className={styles.statLabel}>Age Groups</span>
            </div>
            <div className={styles.statDivider} />
            <div className={styles.stat}>
              <span className={styles.statNum}>{teams.length || '30+'}</span>
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

      {/* Announcements */}
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
                      <>{ann.body.slice(0, 200)}{ann.body.length > 200 ? '…' : ''}</>
                    ) : (
                      'No content provided.'
                    )}
                  </p>
                </div>
              ))}
            </div>
          )}

          <div className="text-center mt-3">
            <Link href={`/${orgSlug}/${tournamentSlug}/news`} className="btn btn-outline" id="home-all-news-btn">
              All Announcements <ChevronRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* Upcoming Games */}
      <section className="section">
        <div className="container">
          <div className="section-header">
            <span className="eyebrow"><Calendar size={12} /> Upcoming Games</span>
            <h2 className="display-md">Next On The Diamond</h2>
            <p>Don&apos;t miss a single pitch. Here are the upcoming scheduled games.</p>
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
                    <span className={styles.gameDate}>{formatDate(game.date)} • {formatTime(game.time)}</span>
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
            <Link href={`/${orgSlug}/${tournamentSlug}/schedule`} className="btn btn-outline" id="home-all-schedule-btn">
              Full Schedule <ChevronRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className={styles.ctaSection}>
        <div className={styles.ctaBg} />
        <div className="container">
          <div className={styles.ctaContent}>
            <Trophy size={40} className={styles.ctaIcon} />
            <h2 className="display-md">Ready to Compete?</h2>
            <p>Check out the full schedule, browse teams, and review the tournament rules before game day.</p>
            <div className={styles.ctaButtons}>
              <Link href={`/${orgSlug}/${tournamentSlug}/rules`} className="btn btn-primary btn-lg" id="cta-rules-btn">
                Tournament Rules
              </Link>
              <Link href={`/${orgSlug}/${tournamentSlug}/standings`} className="btn btn-ghost btn-lg" id="cta-results-btn">
                View Results
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
