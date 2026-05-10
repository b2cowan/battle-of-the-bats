import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Calendar, Trophy, ChevronRight, Megaphone, Star, Globe, Mail, ExternalLink, Archive } from 'lucide-react';
import {
  getAnnouncements, getGames, getTeams, getAgeGroups, getDiamonds,
  getOrganizationBySlug, getTournamentsByOrg,
  getOrgPublicSiteContent, getArchivesByOrg,
  getLeagueSeasons,
} from '@/lib/db';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { formatTime } from '@/lib/utils';
import LocationLink from '@/components/LocationLink';
import styles from './Home.module.css';

export const dynamic = 'force-dynamic';

export default async function HomePage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const org = await getOrganizationBySlug(orgSlug);

  const allTournaments   = org ? await getTournamentsByOrg(org.id) : [];
  const activeTournaments = allTournaments.filter(t => t.status === 'active');

  // ── Public Site module branch ──────────────────────────────────────────────
  if (org && hasModuleEntitlement(org, 'module_public_site')) {
    const [siteContent, archives, leagueSeasons] = await Promise.all([
      getOrgPublicSiteContent(org.id),
      getArchivesByOrg(org.id),
      hasModuleEntitlement(org, 'module_house_league') ? getLeagueSeasons(org.id) : Promise.resolve([]),
    ]);

    const publicLeagueSeasons = leagueSeasons.filter(s => s.status !== 'draft');
    const activeLeagueSeason  = publicLeagueSeasons.find(s => ['registration_open', 'registration_closed', 'active'].includes(s.status));
    const showLeague          = publicLeagueSeasons.length > 0;

    const heroBanner  = org.heroBannerUrl ?? null;
    const showArchives = siteContent?.showArchivesLink !== false && archives.length > 0;

    // Per-tournament age range helper
    async function tournamentAgeRange(tId: string) {
      const groups = await getAgeGroups(tId);
      const sorted = [...groups].sort((a, b) => a.order - b.order);
      if (sorted.length === 0) return null;
      return sorted.length === 1 ? sorted[0].name : `${sorted[0].name} – ${sorted[sorted.length - 1].name}`;
    }

    const tournamentDetails = await Promise.all(
      activeTournaments.map(async t => ({
        tournament: t,
        ageRange: await tournamentAgeRange(t.id),
      }))
    );

    function formatDateRange(start?: string, end?: string) {
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

    const socialLinks = [
      siteContent?.socialInstagram && { href: siteContent.socialInstagram, label: 'Instagram' },
      siteContent?.socialFacebook  && { href: siteContent.socialFacebook,  label: 'Facebook'  },
      siteContent?.socialX         && { href: siteContent.socialX,         label: 'X'         },
      siteContent?.socialWebsite   && { href: siteContent.socialWebsite,   label: 'Website'   },
    ].filter(Boolean) as { href: string; label: string }[];

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
            {org.logoUrl && (
              <img src={org.logoUrl} alt={org.name} className={styles.orgLogo} />
            )}
            <h1 className={`display-xl ${styles.heroTitle}`} style={{ textTransform: 'uppercase' }}>
              {org.name}
            </h1>
            {siteContent?.tagline && (
              <p className={styles.heroBadge} style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.75rem' }}>
                {siteContent.tagline}
              </p>
            )}
            {siteContent?.description && (
              <p className={styles.heroSub}>{siteContent.description}</p>
            )}

            {/* Social + contact row */}
            {(socialLinks.length > 0 || siteContent?.contactEmail) && (
              <div className={styles.socialRow}>
                {socialLinks.map(({ href, label }) => (
                  <a key={label} href={href} target="_blank" rel="noopener noreferrer" className={styles.socialLink}>
                    <ExternalLink size={13} />
                    {label}
                  </a>
                ))}
                {siteContent?.contactEmail && (
                  <a href={`mailto:${siteContent.contactEmail}`} className={styles.socialLink}>
                    <Mail size={13} />
                    {siteContent.contactEmail}
                  </a>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Active tournaments */}
        {siteContent?.showUpcomingTournaments !== false && (
          <section id="tournaments" className="section">
            <div className="container">
              <div className="section-header">
                <span className="eyebrow"><Calendar size={12} /> Tournaments</span>
                <h2 className="display-md">Upcoming Events</h2>
              </div>

              {tournamentDetails.length === 0 ? (
                <div className="empty-state">
                  <Calendar size={40} />
                  <p>No active tournaments right now — check back soon!</p>
                </div>
              ) : (
                <div className={styles.tournamentCards}>
                  {tournamentDetails.map(({ tournament: t, ageRange }) => (
                    <Link key={t.id} href={`/${orgSlug}/${t.slug}`} className={`card ${styles.tournamentCard}`}>
                      <div className={styles.tournamentCardHeader}>
                        <span className="badge badge-primary">
                          <Star size={10} fill="currentColor" /> Live
                        </span>
                        {formatDateRange(t.startDate, t.endDate) && (
                          <span className={styles.tournamentCardDate}>
                            {formatDateRange(t.startDate, t.endDate)}
                          </span>
                        )}
                      </div>
                      <h3 className={styles.tournamentCardName}>{t.name}</h3>
                      {ageRange && <p className={styles.tournamentCardMeta}>{ageRange}</p>}
                      <span className={styles.tournamentCardCta}>
                        View Schedule <ChevronRight size={14} />
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* House League CTA */}
        {showLeague && (
          <section className="section">
            <div className="container">
              <div className="section-header">
                <span className="eyebrow">House League</span>
                <h2 className="display-md">League Play</h2>
              </div>
              <Link href={`/${orgSlug}/league`} className={`card ${styles.archivesCta}`}>
                <div>
                  <div className={styles.archivesCtaTitle}>
                    {activeLeagueSeason ? activeLeagueSeason.name : 'House League'}
                  </div>
                  <div className={styles.archivesCtaSub}>
                    {activeLeagueSeason
                      ? activeLeagueSeason.status === 'registration_open'
                        ? 'Registration is open — sign up now'
                        : activeLeagueSeason.status === 'active'
                          ? 'Season in progress — view standings and schedule'
                          : 'Registration closed — season starting soon'
                      : 'View past seasons and results'}
                  </div>
                </div>
                <ChevronRight size={18} className={styles.archivesCtaChevron} />
              </Link>
            </div>
          </section>
        )}

        {/* Archives CTA */}
        {showArchives && (
          <section className="section">
            <div className="container">
              <Link href={`/${orgSlug}/archives`} className={`card ${styles.archivesCta}`}>
                <Archive size={24} className={styles.archivesCtaIcon} />
                <div>
                  <div className={styles.archivesCtaTitle}>Past Tournaments</div>
                  <div className={styles.archivesCtaSub}>Browse sealed records and past champions</div>
                </div>
                <ChevronRight size={18} className={styles.archivesCtaChevron} />
              </Link>
            </div>
          </section>
        )}
      </div>
    );
  }

  // ── Default branch (module not enabled) ───────────────────────────────────
  // Single active tournament → go straight to its home page
  if (activeTournaments.length === 1) {
    redirect(`/${orgSlug}/${activeTournaments[0].slug}`);
  }

  const activeTournament = activeTournaments[0] ?? null;
  const currentYear = activeTournament?.year ?? new Date().getFullYear();

  const allAnnouncements = await getAnnouncements(activeTournament?.id);
  const announcements = allAnnouncements.slice(0, 3);

  const allGames = await getGames(activeTournament?.id);
  const now = new Date().toISOString().split('T')[0];
  const upcomingGames = allGames
    .filter(g => g.status === 'scheduled' && g.date >= now)
    .slice(0, 4);

  const teams = await getTeams(activeTournament?.id);
  const ageGroups = await getAgeGroups(activeTournament?.id);
  const diamonds = await getDiamonds(activeTournament?.id);

  const startDate = activeTournament?.startDate;
  const endDate = activeTournament?.endDate;

  function formatLongDate(d: string) {
    return new Date(d + 'T12:00:00').toLocaleDateString('en-CA', {
      month: 'long', day: 'numeric', year: 'numeric',
    });
  }

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
      const diffDays = Math.ceil((new Date(startDate + 'T00:00:00').getTime() - new Date(today + 'T00:00:00').getTime()) / msPerDay);
      countdownText = `${diffDays} days to go`;
    } else if (today >= startDate && today <= endDate) {
      countdownText = 'Tournament in Progress! 🔥';
    } else {
      countdownText = 'See you next year!';
    }
  }

  const isRegistrationOpen = ageGroups.some(g => !g.isClosed);
  const sortedAgeGroups = [...ageGroups].sort((a, b) => a.order - b.order);
  const ageRange = sortedAgeGroups.length > 0
    ? `${sortedAgeGroups[0].name} – ${sortedAgeGroups[sortedAgeGroups.length - 1].name}`
    : 'U11 – U19';

  const getTeamName     = (id: string) => teams.find(t => t.id === id)?.name ?? 'TBD';
  const getAgeGroupName = (id: string) => ageGroups.find(g => g.id === id)?.name ?? '';
  const getDiamond      = (id?: string) => id ? diamonds.find(d => d.id === id) ?? null : null;

  function formatDate(dateStr: string) {
    if (!dateStr) return 'TBD';
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-CA', {
      weekday: 'short', month: 'short', day: 'numeric',
    });
  }

  const heroBanner = org?.heroBannerUrl ?? null;

  if (!activeTournament) {
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
            <div className={styles.heroBadge}>
              <Star size={12} fill="currentColor" />
              Next Season Coming Soon
            </div>
            <h1 className={`display-xl ${styles.heroTitle}`}>
              BATTLE<br />
              <span className={styles.heroAccent}>OF THE</span><br />
              BATS
            </h1>
            <p className={styles.heroSub}>
              The diamonds are resting, but the bats are warming up. We are currently preparing for the next spectacular season of elite youth softball in Milton.
            </p>
            <div className={styles.heroCta}>
              <Link href={`/${orgSlug}/news`} className="btn btn-primary btn-lg" id="hero-news-btn">
                <Megaphone size={18} /> Latest News
              </Link>
              <Link href={`/${orgSlug}/rules`} className="btn btn-outline btn-lg" id="hero-rules-btn">
                Tournament Rules
              </Link>
            </div>
          </div>
        </section>

        <section className="section container">
          <div className="empty-state" style={{ minHeight: '40vh' }}>
            <Calendar size={60} style={{ color: 'var(--primary-light)', marginBottom: '1.5rem', opacity: 0.5 }} />
            <h2 className="display-sm">Nothing Scheduled... Yet</h2>
            <p style={{ maxWidth: '500px', margin: '0 auto', color: 'var(--white-60)' }}>
              We&apos;re putting the finishing touches on the upcoming schedule. Check back soon to see divisions, teams, and the full lineup for the next Battle of the Bats!
            </p>
            <div style={{ marginTop: '2rem' }}>
              <Link href={`/${orgSlug}/register`} className="btn btn-outline">Registration Info</Link>
            </div>
          </div>
        </section>
      </div>
    );
  }

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
            The premier youth softball tournament hosted by the <strong>Milton Bats</strong>. {ageRange} age divisions. Elite competition, lifelong memories.
          </p>
          <div className={styles.heroCta}>
            <Link href={activeTournament ? `/${orgSlug}/${activeTournament.slug}/schedule` : `/${orgSlug}/schedule`} className="btn btn-primary btn-lg" id="hero-schedule-btn">
              <Calendar size={18} /> View Schedule
            </Link>
            <Link href={activeTournament ? `/${orgSlug}/${activeTournament.slug}/news` : `/${orgSlug}/news`} className="btn btn-outline btn-lg" id="hero-news-btn">
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
                    {ann.pinned && <span className="badge badge-primary"><Star size={10} fill="currentColor" />&nbsp;Pinned</span>}
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
            <Link href={activeTournament ? `/${orgSlug}/${activeTournament.slug}/news` : `/${orgSlug}/news`} className="btn btn-outline" id="home-all-news-btn">
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
            <Link href={activeTournament ? `/${orgSlug}/${activeTournament.slug}/schedule` : `/${orgSlug}/schedule`} className="btn btn-outline" id="home-all-schedule-btn">
              Full Schedule <ChevronRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className={styles.ctaSection}>
        <div className={styles.ctaBg} />
        <div className="container">
          <div className={styles.ctaContent}>
            <Trophy size={40} className={styles.ctaIcon} />
            <h2 className="display-md">Ready to Compete?</h2>
            <p>Check out the full schedule, browse teams, and review the tournament rules before game day.</p>
            <div className={styles.ctaButtons}>
              <Link href={activeTournament ? `/${orgSlug}/${activeTournament.slug}/rules` : `/${orgSlug}/rules`} className="btn btn-primary btn-lg" id="cta-rules-btn">Tournament Rules</Link>
              <Link href={activeTournament ? `/${orgSlug}/${activeTournament.slug}/standings` : `/${orgSlug}/standings`} className="btn btn-ghost btn-lg" id="cta-results-btn">View Results</Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
