import Link from 'next/link';
import { Calendar, Trophy, ChevronRight, Megaphone, Star, Eye, Clock, MapPin, CheckCircle } from 'lucide-react';
import { getAnnouncements, getGames, getTeams, getDivisions, getVenues, getStandings, resolveTournamentContactEmail } from '@/lib/db';
import type { Game, Organization, Tournament } from '@/lib/types';
import { formatTime } from '@/lib/utils';
import { isPublicPageEnabled } from '@/lib/public-pages';
import { hasPlanFeature } from '@/lib/plan-features';
import { canUseAdvancedTournamentBranding } from '@/lib/tournament-branding';
import { getRegistrationState } from '@/lib/registration-state';
import { tournamentToday } from '@/lib/timezone';
import { isGameLive, DEFAULT_GAME_DURATION_MINUTES } from '@/lib/game-status';
import { deriveChampions } from '@/lib/champions';
import { bracketRoundLabel } from '@/lib/playoff-bracket';
import SharePageButton from '@/components/public/SharePageButton';
import LocationLink from '@/components/LocationLink';
import { resolveGameVenueLabel } from '@/lib/venue-label';
import MyTournamentCard from '@/components/public/MyTournamentCard';
import { toPublicTeam } from '@/lib/public-tournament-data';
import PublicTournamentState from '@/components/public/PublicTournamentState';
import CountUp from '@/components/public/CountUp';
import Countdown from '@/components/public/Countdown';
import styles from '@/app/[orgSlug]/Home.module.css';

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
  const readOptions = { admin: true };

  const allAnnouncements = await getAnnouncements(tournament.id, readOptions);
  const announcements = allAnnouncements.slice(0, 3);

  const allGames = await getGames(tournament.id, readOptions);
  const now = tournamentToday();
  const sortedGames = [...allGames].sort((a, b) => {
    if (a.date !== b.date) return (a.date || '').localeCompare(b.date || '');
    return (a.time || '').localeCompare(b.time || '');
  });
  const upcomingGames = sortedGames
    .filter(g => g.status === 'scheduled' && g.date >= now)
    .slice(0, 4);

  const allTeams  = await getTeams(tournament.id, readOptions);
  // Sanitize before any of these rows reach a client component (MyTournamentCard) —
  // see J6-001 / toPublicTeam. allTeams stays raw for server-only registration math.
  const teams     = allTeams.filter(team => team.status === 'accepted').map(team => toPublicTeam(team, tournament.coachNamesShowOnPublic === true));
  const divisions = await getDivisions(tournament.id, readOptions);
  const venues  = await getVenues(tournament.id, { ...readOptions, includeFacilities: true });
  const activeRegistrations = allTeams.filter(team => team.status !== 'rejected');

  const registration = getRegistrationState(tournament, divisions, activeRegistrations);
  const publicBase = `/${orgSlug}/${tournamentSlug}`;
  const adminTournamentBase = `/${orgSlug}/admin/tournaments`;
  const previewBase = `${adminTournamentBase}/preview/${tournamentSlug}`;
  const usePreviewLinks = isPreview;
  const showNewsPage = isPublicPageEnabled(tournament, 'news');
  const showSchedulePage = isPublicPageEnabled(tournament, 'schedule');
  const showStandingsPage = isPublicPageEnabled(tournament, 'standings');
  const showTeamsPage = isPublicPageEnabled(tournament, 'teams');
  const showRulesPage = isPublicPageEnabled(tournament, 'rules');
  // Honor the tournament's "show contact email publicly" privacy toggle and resolve
  // the designated contact (member email) — the raw `tournament.contactEmail ?? org`
  // fallback skipped both (J1-045). Returns null when the organizer hid it.
  const contactEmail = await resolveTournamentContactEmail(tournament.id, org.contactEmail ?? null, 'public');
  const standingsEntries = showStandingsPage
    ? await Promise.all(
        divisions.map(async division => [
          division.id,
          await getStandings(division.id, division.playoffConfig, readOptions, tournament.settings),
        ] as const)
      )
    : [];
  const standingsByDivision = new Map(standingsEntries);
  const previewLabel = tournament.status === 'draft'
    ? 'Admin preview. This draft tournament is not publicly visible until it is activated.'
    : 'Admin preview. You are viewing this tournament page from inside the admin workspace.';
  const scheduleHref = usePreviewLinks ? `${previewBase}/schedule` : `${publicBase}/schedule`;
  const newsHref = usePreviewLinks ? `${previewBase}/news` : `${publicBase}/news`;
  const primaryBase = usePreviewLinks ? previewBase : publicBase;

  const startDate = tournament.startDate;
  const endDate   = tournament.endDate;

  // "Game time" = tournament is in progress (today within the event window). Once
  // live, the home page leads with games and the full-viewport marketing hero
  // collapses (binding 2026-06-01: home page is state-dependent).
  const isInProgress = Boolean(startDate && endDate && now >= startDate && now <= endDate);
  const isCompletedTournament = tournament.status === 'completed';

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
    const today = tournamentToday();
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

  // Pre-event "first pitch in…" — counts down to the earliest scheduled game on or
  // after the start date (falling back to the start date at a sensible default).
  const isPreEvent = Boolean(startDate && now < startDate);
  const firstScheduledGame = sortedGames.find(g => g.status === 'scheduled' && (!startDate || g.date >= startDate));
  // `time` may arrive as "HH:MM" or "HH:MM:SS" — normalise to HH:MM:SS so the ISO
  // string is always valid (otherwise the Countdown silently renders nothing).
  const firstPitchISO = isPreEvent
    ? (firstScheduledGame?.time
        ? `${firstScheduledGame.date}T${firstScheduledGame.time.slice(0, 5)}:00`
        : startDate ? `${startDate}T09:00:00` : null)
    : null;

  const sortedDivisions = [...divisions].sort((a, b) => a.order - b.order);

  // Champions for the completed-home banner (J6-052). allGames (raw, all statuses)
  // so playoff finals aren't filtered out; teams here is the public-safe array (id+name).
  const champions = isCompletedTournament ? deriveChampions(allGames, teams, sortedDivisions) : [];
  // Third hero stat — adaptive. When every division name parses as an age (U13,
  // 13U, "Under 13"), show a true low-to-high age range, ordered by the actual
  // number rather than the organizer's list order. When any division isn't
  // age-style (Gold, Senior, Blue — names with no inherent order), a range is
  // meaningless, so fall back to the tournament length in days, which is always
  // valid regardless of how divisions are named.
  const parseDivisionAge = (name: string): number | null => {
    const m = name.match(/\bu[\s-]?(\d{1,2})\b/i)      // U13, U-13, U 13
           || name.match(/\b(\d{1,2})\s?u\b/i)         // 13U
           || name.match(/\bunder[\s-]?(\d{1,2})\b/i); // Under 13
    return m ? parseInt(m[1], 10) : null;
  };
  const divisionAges = sortedDivisions.map(d => parseDivisionAge(d.name));
  const allAgeStyle = sortedDivisions.length > 0 && divisionAges.every(n => n !== null);

  let thirdStatLabel = 'Days';
  let thirdStatValue = 'TBA';
  if (allAgeStyle) {
    const nums = divisionAges as number[];
    const minAge = Math.min(...nums);
    const maxAge = Math.max(...nums);
    thirdStatLabel = 'Age Range';
    thirdStatValue = minAge === maxAge ? `U${minAge}` : `U${minAge} - U${maxAge}`;
  } else if (startDate && endDate) {
    const msPerDay = 24 * 60 * 60 * 1000;
    const dayCount = Math.round(
      (new Date(endDate + 'T00:00:00').getTime() - new Date(startDate + 'T00:00:00').getTime()) / msPerDay
    ) + 1;
    thirdStatValue = String(Math.max(1, dayCount));
  }

  const getTeamName     = (id: string) => teams.find(t => t.id === id)?.name ?? 'TBD';
  const getDivisionName = (id: string) => divisions.find(g => g.id === id)?.name ?? '';
  const getVenue      = (id?: string) => id ? (venues.find(d => d.id === id) ?? null) : null;

  function formatDate(dateStr: string) {
    if (!dateStr) return 'TBD';
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-CA', {
      weekday: 'short', month: 'short', day: 'numeric',
    });
  }

  // Latest-Finals row — same stacked format as the Recent-Scores cards (away over
  // home, winner trophy + green score, loser dimmed). Used by both finals lists.
  function renderFinalRow(game: Game, href: string, meta: string) {
    const aScore = game.awayScore;
    const hScore = game.homeScore;
    const winner = aScore == null || hScore == null ? null
      : hScore > aScore ? 'home' : aScore > hScore ? 'away' : 'tie';
    const awayName = game.awayTeamId ? getTeamName(game.awayTeamId) : (game.awayPlaceholder ?? 'TBD');
    const homeName = game.homeTeamId ? getTeamName(game.homeTeamId) : (game.homePlaceholder ?? 'TBD');
    return (
      <Link key={game.id} href={href} className={styles.finalRow}>
        <div className={styles.finalMatch}>
          <div className={`${styles.finalTeam} ${winner === 'away' ? styles.finalWin : winner === 'home' ? styles.finalLose : ''}`}>
            <span className={styles.finalWinIconSlot}>{winner === 'away' && <Trophy size={13} aria-label="Winner" />}</span>
            <span className={styles.finalName}>{awayName}</span>
            <span className={styles.finalScore}>{aScore}</span>
          </div>
          <div className={`${styles.finalTeam} ${winner === 'home' ? styles.finalWin : winner === 'away' ? styles.finalLose : ''}`}>
            <span className={styles.finalWinIconSlot}>{winner === 'home' && <Trophy size={13} aria-label="Winner" />}</span>
            <span className={styles.finalName}>{homeName}</span>
            <span className={styles.finalScore}>{hScore}</span>
          </div>
        </div>
        <span className={styles.finalMeta}>{meta}</span>
      </Link>
    );
  }

  const heroBanner = canUseAdvancedTournamentBranding(org)
    ? tournament.heroBannerUrl ?? org.heroBannerUrl ?? null
    : null;

  const todayGames = sortedGames
    .filter(game => game.date === now && game.status !== 'cancelled')
    .slice(0, 6);
  const latestResults = [...sortedGames]
    .filter(game => game.status === 'completed' && game.homeScore != null && game.awayScore != null)
    .sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return (b.time || '').localeCompare(a.time || '');
    })
    .slice(0, 4);
  const finalGames = [...sortedGames].filter(game =>
    game.status === 'completed' && game.homeScore != null && game.awayScore != null
  );
  const pendingScoreGames = [...sortedGames].filter(game =>
    game.status === 'submitted' && game.homeScore != null && game.awayScore != null
  );
  const remainingScheduledGames = sortedGames.filter(game => game.status === 'scheduled');
  const completedDivisionLeaders = sortedDivisions
    .map(division => {
      const divisionStandings = standingsByDivision.get(division.id) ?? [];
      const leader = divisionStandings.find(row => row.gp > 0) ?? divisionStandings[0] ?? null;
      if (!leader) return null;
      return { division, leader };
    })
    .filter(Boolean)
    .slice(0, 6) as Array<{
      division: (typeof sortedDivisions)[number];
      leader: Awaited<ReturnType<typeof getStandings>>[number];
    }>;
  const venueShortcuts = todayGames.reduce<Array<{ key: string; label: string; location: string; venue: ReturnType<typeof getVenue> }>>((acc, game) => {
    const venue = getVenue(game.venueId);
    const label = venue?.name ?? game.location;
    const key = game.venueId || game.location;
    if (!label || acc.some(item => item.key === key)) return acc;
    acc.push({ key, label, location: game.location, venue });
    return acc;
  }, []).slice(0, 4);
  const hasTournamentDayPanel = !isCompletedTournament && showSchedulePage && (isInProgress || todayGames.length > 0 || latestResults.length > 0);

  function gameStatusLabel(status: string) {
    if (status === 'completed') return 'Final';
    if (status === 'submitted') return 'Unofficial';
    return 'Scheduled';
  }

  function getGameHref(gameId: string) {
    if (usePreviewLinks) return scheduleHref;
    return `${scheduleHref}/${gameId}`;
  }

  const tournamentDayPanel = hasTournamentDayPanel ? (
    <section className={`section ${styles.dayPanelSection}`} id="today">
      <div className="container">
        <div className={styles.dayPanelHeader}>
          <div>
            <span className="eyebrow"><Clock size={12} /> Tournament Day</span>
            <h2 className="display-md">What To Check Now</h2>
          </div>
          <Link href={scheduleHref} className="btn btn-outline btn-sm">
            Full Schedule <ChevronRight size={14} />
          </Link>
        </div>

        <div className={styles.dayGrid}>
          {!isPreview && (
            <MyTournamentCard
              orgSlug={orgSlug}
              tournamentSlug={tournamentSlug}
              tournamentId={tournament.id}
              tournamentName={tournament.name}
              teams={teams}
              games={allGames}
              divisions={divisions}
              venues={venues}
              standingsByDivision={Object.fromEntries(standingsByDivision)}
              scheduleHref={scheduleHref}
              fanAlertsEnabled={hasPlanFeature(org.planId, 'fan_score_alerts')}
              isCompleted={isCompletedTournament}
            />
          )}

          <div className={`card ${styles.dayCard}`}>
            <div className={styles.dayCardHeader}>
              <div className={styles.dayCardIcon}><Calendar size={16} /></div>
              <div>
                <span className={styles.dayCardKicker}>Today</span>
                <h3>Today&apos;s Games</h3>
              </div>
            </div>
            {todayGames.length === 0 ? (
              <p className={styles.dayCardSub}>No games are scheduled for today.</p>
            ) : (
              <div className={styles.quickGameList}>
                {todayGames.map(game => {
                  const live = isGameLive(game, game.durationMinutes ?? DEFAULT_GAME_DURATION_MINUTES);
                  const hasScore = game.homeScore != null && game.awayScore != null;
                  return (
                    <Link key={game.id} href={getGameHref(game.id)} className={styles.quickGameRow}>
                      {live ? (
                        <span className={styles.myTeamLiveBadge}>
                          <span className={styles.myTeamLiveDot} />
                          {hasScore ? `${game.homeScore}–${game.awayScore}` : 'LIVE'}
                        </span>
                      ) : (
                        <span className={styles.quickGameTime}>{formatTime(game.time)}</span>
                      )}
                      <span className={styles.quickGameTeams}>
                        {game.homeTeamId ? getTeamName(game.homeTeamId) : (game.homePlaceholder ?? 'TBD')} vs {game.awayTeamId ? getTeamName(game.awayTeamId) : (game.awayPlaceholder ?? 'TBD')}
                      </span>
                      <span className={styles.quickGameMeta}>{resolveGameVenueLabel(game, venues) || getDivisionName(game.divisionId)}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          <div className={`card ${styles.dayCard}`}>
            <div className={styles.dayCardHeader}>
              <div className={styles.dayCardIcon}><Trophy size={16} /></div>
              <div>
                <span className={styles.dayCardKicker}>Results</span>
                <h3>Latest Finals</h3>
              </div>
            </div>
            {latestResults.length === 0 ? (
              <p className={styles.dayCardSub}>Final scores will appear here once games are completed.</p>
            ) : (
              <div className={styles.quickGameList}>
                {latestResults.map(game => renderFinalRow(game, scheduleHref, gameStatusLabel(game.status)))}
              </div>
            )}
          </div>

          <div className={`card ${styles.dayCard}`}>
            <div className={styles.dayCardHeader}>
              <div className={styles.dayCardIcon}><MapPin size={16} /></div>
              <div>
                <span className={styles.dayCardKicker}>Venues</span>
                <h3>Field Shortcuts</h3>
              </div>
            </div>
            {venueShortcuts.length === 0 ? (
              <p className={styles.dayCardSub}>Venue shortcuts will appear when today&apos;s games are published.</p>
            ) : (
              <div className={styles.venueShortcutList}>
                {venueShortcuts.map(item => (
                  <LocationLink key={item.key} location={item.label} venue={item.venue} size="sm" />
                ))}
              </div>
            )}
          </div>

          <div className={`card ${styles.dayCard}`}>
            <div className={styles.dayCardHeader}>
              <div className={styles.dayCardIcon}><CheckCircle size={16} /></div>
              <div>
                <span className={styles.dayCardKicker}>Status</span>
                <h3>Event Snapshot</h3>
              </div>
            </div>
            <div className={styles.statusList}>
              <div className={styles.statusItem}>
                <span>{registration.label}</span>
                <strong>Registration</strong>
              </div>
              <div className={styles.statusItem}>
                <span>{todayGames.length > 0 ? `${todayGames.length} today` : `${upcomingGames.length} upcoming`}</span>
                <strong>Schedule</strong>
              </div>
              <div className={styles.statusItem}>
                <span>{latestResults.length > 0 ? `${latestResults.length} recent` : 'No results yet'}</span>
                <strong>Results</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  ) : null;

  const singleChampion = champions.length === 1;
  const multiDivision = divisions.length > 1;

  const championBanner = isCompletedTournament && champions.length > 0 ? (
    <section className={`section ${styles.championSection}`} id="champions">
      <div className="container">
        <div className="section-header">
          <span className="eyebrow"><Trophy size={12} /> Tournament Champions</span>
          <h2 className="display-md">{singleChampion ? `${champions[0].champion} — Champion` : 'Champions'}</h2>
        </div>

        {singleChampion ? (
          <div className={`${styles.championCard} ${styles.championSingle}`}>
            {multiDivision && <span className={styles.championDivision}>{champions[0].division}</span>}
            <div className={styles.championName}>{champions[0].champion}</div>
            {champions[0].runnerUp && <div className={styles.championRunnerUp}>Runner-up: {champions[0].runnerUp}</div>}
          </div>
        ) : (
          <div className={styles.championGrid}>
            {champions.map(ch => (
              <div key={ch.division} className={styles.championCard}>
                <span className={styles.championDivision}>{ch.division}</span>
                <div className={styles.championName}>{ch.champion}</div>
                {ch.runnerUp && <div className={styles.championRunnerUp}>Runner-up: {ch.runnerUp}</div>}
              </div>
            ))}
          </div>
        )}

        <div className={styles.championShareRow}>
          <SharePageButton
            url={publicBase}
            title={tournament.name}
            text={`${champions.map(c => `${c.champion}${multiDivision ? ` (${c.division})` : ''}`).join(', ')} — Champions`}
            label="Share results"
            className="btn btn-outline btn-sm"
          />
        </div>
      </div>
    </section>
  ) : null;

  const completedRecordPanel = isCompletedTournament ? (
    <section className={`section ${styles.recordSection}`} id="final-record">
      <div className="container">
        <div className={styles.recordHeader}>
          <div>
            <span className="eyebrow"><Trophy size={12} /> Final Public Record</span>
            <h2 className="display-md">Tournament Complete</h2>
            <p>
              Final standings, posted scores, and the game log remain available for coaches,
              parents, and visitors after the event.
            </p>
          </div>
          <div className={styles.recordActions}>
            {showStandingsPage && (
              <Link href={`${primaryBase}/standings`} className="btn btn-primary btn-sm">
                Final Standings <ChevronRight size={14} />
              </Link>
            )}
            {showSchedulePage && (
              <Link href={scheduleHref} className="btn btn-outline btn-sm">
                Game Log <ChevronRight size={14} />
              </Link>
            )}
          </div>
        </div>

        <div className={styles.recordGrid}>
          <div className={`card ${styles.recordCard}`}>
            <div className={styles.dayCardHeader}>
              <div className={styles.dayCardIcon}><CheckCircle size={16} /></div>
              <div>
                <span className={styles.dayCardKicker}>Record</span>
                <h3>Event Summary</h3>
              </div>
            </div>
            <div className={styles.recordStats}>
              <div>
                <strong>{finalGames.length}</strong>
                <span>final scores</span>
              </div>
              <div>
                <strong>{pendingScoreGames.length}</strong>
                <span>unconfirmed</span>
              </div>
              <div>
                <strong>{remainingScheduledGames.length}</strong>
                <span>not played</span>
              </div>
              <div>
                <strong>{teams.length}</strong>
                <span>accepted teams</span>
              </div>
            </div>
          </div>

          {showStandingsPage && (
            <div className={`card ${styles.recordCard}`}>
              <div className={styles.dayCardHeader}>
                <div className={styles.dayCardIcon}><Trophy size={16} /></div>
                <div>
                  <span className={styles.dayCardKicker}>Standings</span>
                  <h3>Top Standings</h3>
                </div>
              </div>
              {completedDivisionLeaders.length === 0 ? (
                <p className={styles.dayCardSub}>Final standings will appear once scores have been posted.</p>
              ) : (
                <div className={styles.recordList}>
                  {completedDivisionLeaders.map(({ division, leader }) => (
                    <div key={division.id} className={styles.recordListRow}>
                      <span>{division.name}</span>
                      <strong>{leader.teamName}</strong>
                      <em>{leader.w}-{leader.l}-{leader.t} - {leader.pts} pts</em>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {showSchedulePage && (
            <div className={`card ${styles.recordCard} ${styles.recordWideCard}`}>
              <div className={styles.dayCardHeader}>
                <div className={styles.dayCardIcon}><Calendar size={16} /></div>
                <div>
                  <span className={styles.dayCardKicker}>Scores</span>
                  <h3>Latest Finals</h3>
                </div>
              </div>
              {latestResults.length === 0 ? (
                <p className={styles.dayCardSub}>No final scores have been posted yet.</p>
              ) : (
                <div className={styles.quickGameList}>
                  {latestResults.map(game => renderFinalRow(game, getGameHref(game.id), formatDate(game.date)))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  ) : null;

  // Extracted so it can lead the page when the tournament is in progress, or sit
  // after announcements otherwise.
  const scheduleBlock = showSchedulePage ? (
    <section className="section" id="schedule">
      <div className="container">
        <div className="section-header">
          <span className="eyebrow"><Calendar size={12} /> Upcoming Games</span>
          <h2 className="display-md">Next On The Schedule</h2>
          <p>Here are the next scheduled games for this tournament.</p>
        </div>

        {upcomingGames.length === 0 ? (
          <PublicTournamentState
            icon={<Calendar size={36} />}
            eyebrow="Schedule"
            title="No upcoming games yet"
            description="Games will appear here once the organizer publishes the schedule."
            contactEmail={contactEmail}
            actions={[{ href: scheduleHref, label: 'View Schedule', variant: 'ghost' as const }]}
            compact
          />
        ) : (
          <div className={styles.gamesGrid}>
            {upcomingGames.map(game => (
              <div key={game.id} className={`card ${styles.gameCard}`}>
                <div className={styles.gameHeader}>
                  <span className="badge badge-primary">
                    {game.isPlayoff && game.bracketCode ? bracketRoundLabel(game.bracketCode) : getDivisionName(game.divisionId)}
                  </span>
                  <span className={styles.gameDate}>{formatDate(game.date)} - {formatTime(game.time)}</span>
                </div>
                <div className={styles.matchup}>
                  <span className={styles.teamName}>{getTeamName(game.homeTeamId)}</span>
                  <span className={styles.vs}>VS</span>
                  <span className={styles.teamName}>{getTeamName(game.awayTeamId)}</span>
                </div>
                <div className={styles.gameLocation}>
                  <LocationLink location={resolveGameVenueLabel(game, venues)} venue={getVenue(game.venueId)} size="sm" />
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
  ) : null;

  return (
    <div className={styles.page}>
      <section className={`${styles.hero} ${isInProgress || isCompletedTournament ? styles.heroCompact : ''}`} id="preview-home">
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
                {dateDisplay}
              </span>
              {isPreEvent && firstPitchISO ? (
                <span className={styles.countdown}>
                  <span className={styles.badgeSeparator}>·</span>
                  <Countdown target={firstPitchISO} prefix="First pitch in " whenPast={countdownText} />
                </span>
              ) : countdownText ? (
                <span className={styles.countdown}>
                  <span className={styles.badgeSeparator}>·</span>
                  {countdownText}
                </span>
              ) : null}
            </div>
          </div>

          <h1 className={`display-xl ${styles.heroTitle}`}>
            {tournament.name}
          </h1>
          <p className={styles.heroSub}>
            Hosted by <strong>{org.name}</strong>.
            {isCompletedTournament
              ? ' Thanks for following along — final scores and standings are preserved below.'
              : ' View tournament details and updates in one place.'}
          </p>

          {!isInProgress && !isCompletedTournament && (
            <div className={styles.registrationStatus}>
              <strong>{registration.label}</strong>
              <span>{registration.detail}</span>
            </div>
          )}

          {/* The one conversion CTA lives on the hero (not in the persistent
              header, which stays logo + name + share). Lifecycle-gated. */}
          {!isPreview && registration.cta && (
            <div className={styles.heroCta}>
              <Link href={`${primaryBase}/register`} className="btn btn-primary btn-lg" id="hero-register-btn">
                {registration.cta === 'waitlist' ? 'Join Waitlist' : 'Register'}
              </Link>
            </div>
          )}

          {!isInProgress && !isCompletedTournament && (
            <div className={styles.stats}>
              <div className={styles.stat}>
                <span className={styles.statNum}>
                  {divisions.length ? <CountUp value={divisions.length} /> : 'TBA'}
                </span>
                <span className={styles.statLabel}>Divisions</span>
              </div>
              <div className={styles.statDivider} />
              <div className={styles.stat}>
                <span className={styles.statNum}>
                  {teams.length ? <CountUp value={teams.length} /> : 'TBA'}
                </span>
                <span className={styles.statLabel}>Teams</span>
              </div>
              <div className={styles.statDivider} />
              <div className={styles.stat}>
                <span className={allAgeStyle && thirdStatValue.includes('-') ? `${styles.statNum} ${styles.ageRangeText}` : styles.statNum}>{thirdStatValue}</span>
                <span className={styles.statLabel}>{thirdStatLabel}</span>
              </div>
            </div>
          )}
        </div>

        <div className={styles.heroScroll}>
          <div className={styles.scrollLine} />
        </div>
      </section>

      {championBanner}
      {completedRecordPanel}
      {tournamentDayPanel}
      {isInProgress && scheduleBlock}

      {showNewsPage && (
      <section className={`section ${styles.announcementsSection}`} id="announcements">
        <div className="container">
          <div className="section-header">
            <span className="eyebrow"><Megaphone size={12} /> Latest News</span>
            <h2 className="display-md">Announcements</h2>
          </div>

          {announcements.length === 0 ? (
            <PublicTournamentState
              icon={<Megaphone size={36} />}
              eyebrow="News"
              title="No announcements yet"
              description="Tournament announcements will appear here when the organizer posts them."
              actions={[{ href: newsHref, label: 'View News', variant: 'ghost' as const }]}
              compact
            />
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

          {announcements.length > 0 && (
            <div className="text-center mt-3">
              <Link href={newsHref} className="btn btn-outline" id="home-all-news-btn">
                All Announcements <ChevronRight size={16} />
              </Link>
            </div>
          )}
        </div>
      </section>
      )}

      {!isInProgress && !isCompletedTournament && scheduleBlock}

      {/* Explore sections — guarantees every public page (especially Rules, which is
          not a mobile bottom-nav tab) is reachable from the Overview in every state
          (J6-006 / J6-034). Gated per-link on page visibility. */}
      {(showSchedulePage || showStandingsPage || showTeamsPage || showRulesPage || showNewsPage) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center', margin: '2.5rem 0 0.5rem' }}>
          {showSchedulePage && <Link href={`${primaryBase}/schedule`} className="btn btn-ghost btn-sm">Schedule</Link>}
          {showStandingsPage && <Link href={`${primaryBase}/standings`} className="btn btn-ghost btn-sm">Standings</Link>}
          {showTeamsPage && <Link href={`${primaryBase}/teams`} className="btn btn-ghost btn-sm">Teams</Link>}
          {showRulesPage && <Link href={`${primaryBase}/rules`} className="btn btn-ghost btn-sm">Rules</Link>}
          {showNewsPage && <Link href={`${primaryBase}/news`} className="btn btn-ghost btn-sm">News</Link>}
        </div>
      )}
    </div>
  );
}
