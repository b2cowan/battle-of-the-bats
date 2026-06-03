import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Calendar, Clock, ExternalLink, Info, MapPin, Trophy } from 'lucide-react';
import { getPublicTournamentPageData } from '@/lib/public-tournament-data';
import type { Division, Game, Team, Venue } from '@/lib/types';
import { formatTime } from '@/lib/utils';
import PublicTournamentState from '@/components/public/PublicTournamentState';
import GameDetailLiveRefresher from '@/components/public/GameDetailLiveRefresher';
import ShareScoreButton from '@/components/public/ShareScoreButton';
import styles from '@/app/[orgSlug]/schedule/schedule.module.css';

const NIL_UUID = '00000000-0000-0000-0000-000000000000';

type GameDetailParams = Promise<{
  orgSlug: string;
  tournamentSlug: string;
  gameId: string;
}>;

type VenueDisplay = {
  venueLabel: string;
  facilityLabel: string | null;
  address: string | null;
  mapsUrl: string | null;
  mapsTitle: string | null;
};

function getMapsUrl(address: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

function formatFullDate(date?: string) {
  if (!date) return 'Date TBD';
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-CA', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getTeamDisplay(game: Game, isHome: boolean, teams: Team[], divisions: Division[]) {
  const id = isHome ? game.homeTeamId : game.awayTeamId;
  const placeholder = isHome ? game.homePlaceholder : game.awayPlaceholder;
  const visibility = divisions.find(group => group.id === game.divisionId)?.scheduleVisibility ?? 'unpublished';

  if (visibility !== 'published_generic' && id && id !== NIL_UUID) {
    return teams.find(team => team.id === id)?.name ?? placeholder ?? 'TBD';
  }

  return placeholder ?? 'TBD';
}

function getWinner(game: Game): 'home' | 'away' | 'tie' | null {
  if (game.homeScore == null || game.awayScore == null) return null;
  if (game.homeScore > game.awayScore) return 'home';
  if (game.awayScore > game.homeScore) return 'away';
  return 'tie';
}

function getStatusBadge(game: Game, requireFinalization: boolean) {
  if (game.status === 'cancelled') return <span className="badge badge-danger">Cancelled</span>;
  if (game.status === 'completed') return <span className="badge badge-success">Final</span>;
  if (game.status === 'submitted') {
    return requireFinalization
      ? <span className="badge badge-warning">Pending</span>
      : <span className="badge badge-success">Final</span>;
  }
  return <span className="badge">Scheduled</span>;
}

function getStatusText(game: Game, requireFinalization: boolean) {
  if (game.status === 'cancelled') return 'Cancelled';
  if (game.status === 'completed') return 'Final';
  if (game.status === 'submitted') return requireFinalization ? 'Pending score review' : 'Final';
  return 'Scheduled';
}

function getVenueDisplay(game: Game, venues: Venue[]): VenueDisplay | null {
  const venue = game.venueId ? venues.find(item => item.id === game.venueId) ?? null : null;
  const facility = venue?.facilities?.find(item => item.id === game.venueFacilityId) ?? null;
  const rawLocation = game.location?.trim() ?? '';
  let venueLabel = venue?.name || rawLocation;
  let facilityLabel = facility?.name ?? '';

  if (!facilityLabel && rawLocation && venue?.name && rawLocation.toLowerCase().startsWith(venue.name.toLowerCase())) {
    facilityLabel = rawLocation
      .slice(venue.name.length)
      .replace(/^\s*(?:-|\u2013|\u2014|,)\s*/, '')
      .trim();
  }

  if (!venue && rawLocation) {
    const [rawVenue, ...facilityParts] = rawLocation.split(/\s+(?:-|\u2013|\u2014)\s+/);
    if (rawVenue && facilityParts.length > 0) {
      venueLabel = rawVenue;
      facilityLabel = facilityParts.join(' - ');
    }
  }

  if (!venueLabel && game.scheduleFacilityLaneLabel) {
    venueLabel = 'Location TBD';
    facilityLabel = game.scheduleFacilityLaneLabel;
  }

  if (!venueLabel) return null;

  const mapsTarget = venue?.address || rawLocation || (venueLabel !== 'Location TBD' ? venueLabel : '');

  let mapsTitle: string | null = null;
  if (mapsTarget) {
    mapsTitle = venue?.address
      ? `Open ${venueLabel} in Google Maps`
      : `Search "${mapsTarget}" in Google Maps`;
  }

  return {
    venueLabel,
    facilityLabel: facilityLabel || null,
    address: venue?.address ?? null,
    mapsUrl: mapsTarget ? getMapsUrl(mapsTarget) : null,
    mapsTitle,
  };
}

export async function generateMetadata({ params }: { params: GameDetailParams }): Promise<Metadata> {
  try {
    const { orgSlug, tournamentSlug, gameId } = await params;
    const data = await getPublicTournamentPageData(orgSlug, tournamentSlug, 'schedule');
    const game = data?.games.find(item => item.id === gameId);
    if (!data?.tournament || !game) return {};

    const away = getTeamDisplay(game, false, data.teams, data.divisions);
    const home = getTeamDisplay(game, true, data.teams, data.divisions);
    const hasScore = (game.status === 'completed' || game.status === 'submitted') &&
      game.homeScore != null && game.awayScore != null;
    const requireFinalization = data.organization.requireScoreFinalization ?? true;
    const statusText = getStatusText(game, requireFinalization);
    const title = hasScore
      ? `${away} ${game.awayScore} – ${game.homeScore} ${home} · ${statusText}`
      : `${away} vs ${home}`;
    const description = [data.tournament.name, game.date ? formatFullDate(game.date) : null, game.location || null]
      .filter(Boolean)
      .join(' · ');

    return {
      title,
      description,
      openGraph: { title, description },
      twitter: { card: 'summary_large_image', title, description },
    };
  } catch {
    return {};
  }
}

export default async function PublicGameDetailsPage({
  params,
}: {
  params: GameDetailParams;
}) {
  const { orgSlug, tournamentSlug, gameId } = await params;
  const data = await getPublicTournamentPageData(orgSlug, tournamentSlug, 'schedule');
  if (!data) notFound();

  const homeHref = `/${orgSlug}/${tournamentSlug}`;
  const scheduleHref = `${homeHref}/schedule`;

  if (!data.pageEnabled || !data.tournament) {
    return (
      <div className="page-content">
        <div className="section">
          <div className="container">
            <PublicTournamentState
              icon={<Calendar size={40} />}
              eyebrow="Schedule"
              title="Schedule unavailable"
              description="The organizer has hidden the schedule for this tournament."
              actions={[{ href: homeHref, label: 'Tournament Home', variant: 'ghost' as const }]}
            />
          </div>
        </div>
      </div>
    );
  }

  const game = data.games.find(item => item.id === gameId);
  if (!game) notFound();

  const division = data.divisions.find(item => item.id === game.divisionId) ?? null;
  const requireFinalization = data.organization.requireScoreFinalization ?? true;
  const hasScore = (game.status === 'completed' || game.status === 'submitted') &&
    game.homeScore != null && game.awayScore != null;
  const winner = getWinner(game);
  const awayName = getTeamDisplay(game, false, data.teams, data.divisions);
  const homeName = getTeamDisplay(game, true, data.teams, data.divisions);
  const awayOutcome = !hasScore ? null : winner === 'tie' ? 'T' : winner === 'away' ? 'W' : 'L';
  const homeOutcome = !hasScore ? null : winner === 'tie' ? 'T' : winner === 'home' ? 'W' : 'L';
  let gameType = 'Pool Play';
  if (game.isPlayoff) {
    gameType = game.bracketCode ? `Playoff - ${game.bracketCode}` : 'Playoff';
  }
  const venue = getVenueDisplay(game, data.venues);

  // Live refresh on game day — re-render this server page when the score changes.
  const liveSignature = `${game.homeScore ?? ''}:${game.awayScore ?? ''}:${game.status}`;
  const t = data.tournament;
  const today = new Date().toISOString().split('T')[0];
  const liveEnabled = Boolean(
    t.status === 'active' && t.startDate && t.endDate && today >= t.startDate && today <= t.endDate,
  );

  const isLiveGame = game.status === 'submitted' && game.date === today;
  const shareStatusLabel = game.status === 'completed'
    ? 'FINAL'
    : isLiveGame ? 'LIVE' : requireFinalization ? 'PENDING' : 'FINAL';

  return (
    <div className="page-content">
      <GameDetailLiveRefresher
        orgSlug={orgSlug}
        tournamentSlug={tournamentSlug}
        gameId={gameId}
        initialSignature={liveSignature}
        enabled={liveEnabled}
      />
      <div className="public-page-header">
        <div className="container">
          <span className="eyebrow"><Calendar size={12} /> Schedule</span>
          <h1>Game Details</h1>
          <p className="text-muted">{data.tournament.name}</p>
        </div>
      </div>

      <div className="section">
        <div className="container">
          <div className={styles.gameDetailShell}>
            <Link href={scheduleHref} className={`btn btn-ghost btn-sm ${styles.detailBack}`}>
              <ArrowLeft size={15} /> Schedule
            </Link>

            <article className={styles.gameDetailCard}>
              <div className={styles.detailTop}>
                <div className={styles.detailMeta}>
                  <span><Calendar size={14} /> {formatFullDate(game.date)}</span>
                  <span><Clock size={14} /> {game.time ? formatTime(game.time) : 'Time TBD'}</span>
                </div>
                <div className={styles.detailRail}>
                  <span className="badge badge-primary">{gameType}</span>
                  {getStatusBadge(game, requireFinalization)}
                  {hasScore && (
                    <ShareScoreButton
                      className="btn btn-outline btn-sm"
                      gameHref={`/${orgSlug}/${tournamentSlug}/schedule/${gameId}`}
                      tournamentName={data.tournament.name}
                      awayName={awayName}
                      homeName={homeName}
                      awayScore={game.awayScore as number}
                      homeScore={game.homeScore as number}
                      statusLabel={shareStatusLabel}
                      live={isLiveGame}
                      dateLabel={formatFullDate(game.date)}
                      venueLabel={venue?.venueLabel ?? null}
                      gameType={gameType}
                    />
                  )}
                </div>
              </div>

              <div className={styles.detailMatchup}>
                <div className={`${styles.detailTeam} ${styles.detailAway}`}>
                  <span className={styles.detailTeamSide}>Away</span>
                  <strong className={styles.detailTeamName}>{awayName}</strong>
                  {hasScore ? (
                    <span className={styles.detailScoreLine}>
                      {awayOutcome && <span data-outcome={awayOutcome}>{awayOutcome}</span>}
                      <strong>{game.awayScore}</strong>
                    </span>
                  ) : (
                    <span className={styles.detailScorePending}>Score TBD</span>
                  )}
                </div>

                <span className={styles.detailVs}>VS</span>

                <div className={`${styles.detailTeam} ${styles.detailHome}`}>
                  <span className={styles.detailTeamSide}>Home</span>
                  <strong className={styles.detailTeamName}>{homeName}</strong>
                  {hasScore ? (
                    <span className={styles.detailScoreLine}>
                      <strong>{game.homeScore}</strong>
                      {homeOutcome && <span data-outcome={homeOutcome}>{homeOutcome}</span>}
                    </span>
                  ) : (
                    <span className={styles.detailScorePending}>Score TBD</span>
                  )}
                </div>
              </div>

              <div className={styles.detailPanelGrid}>
                <section className={styles.detailPanel}>
                  <h2><MapPin size={15} /> Location</h2>
                  {venue ? (
                    <div className={styles.detailVenueBlock}>
                      <strong>{venue.venueLabel}</strong>
                      {venue.facilityLabel && <span>{venue.facilityLabel}</span>}
                      {venue.address && <p>{venue.address}</p>}
                      {venue.mapsUrl && (
                        <a
                          href={venue.mapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={venue.mapsTitle ?? undefined}
                          className={styles.detailMapLink}
                        >
                          <ExternalLink size={14} /> Google Maps
                        </a>
                      )}
                    </div>
                  ) : (
                    <p className={styles.detailMuted}>Location TBD</p>
                  )}
                </section>

                <section className={styles.detailPanel}>
                  <h2><Info size={15} /> Game</h2>
                  <dl className={styles.detailFacts}>
                    <div>
                      <dt>Division</dt>
                      <dd>{division?.name ?? 'Division TBD'}</dd>
                    </div>
                    <div>
                      <dt>Stage</dt>
                      <dd>{gameType}</dd>
                    </div>
                    <div>
                      <dt>Status</dt>
                      <dd>{getStatusText(game, requireFinalization)}</dd>
                    </div>
                  </dl>
                </section>

                {game.notes && (
                  <section className={`${styles.detailPanel} ${styles.detailNotesPanel}`}>
                    <h2><Trophy size={15} /> Notes</h2>
                    <p>{game.notes}</p>
                  </section>
                )}
              </div>
            </article>
          </div>
        </div>
      </div>
    </div>
  );
}
