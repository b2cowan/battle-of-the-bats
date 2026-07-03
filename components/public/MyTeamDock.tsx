'use client';
/**
 * components/public/MyTeamDock.tsx
 * Game-day "now playing" dock for the followed team. A slim bar parked above the
 * mobile bottom nav on every tournament page during the event, showing the live
 * score (with rolling digits) or a live countdown to the next game; tap to expand
 * for the opponent, venue, and a jump to the schedule.
 *
 * Mounted globally in the tournament layout but self-gating: it only fetches and
 * renders when the tournament is in progress AND a team is followed (localStorage),
 * so non-followers and off-days incur zero work. Mobile-only (≤900px) — desktop
 * surfaces the same info in the schedule rail.
 */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Star, ChevronUp } from 'lucide-react';
import type { Game, PublicTeam, Venue } from '@/lib/types';
import { formatTime } from '@/lib/utils';
import { resolveGameVenueLabel } from '@/lib/venue-label';
import { useFollowedTeam } from '@/lib/follow';
import { isGameLive, gameStartMs, DEFAULT_GAME_DURATION_MINUTES } from '@/lib/game-status';
import { tournamentToday } from '@/lib/timezone';
import { fetchPublicTournamentData } from '@/lib/public-tournament-client';
import { usePublicTournamentLive } from '@/lib/hooks/usePublicTournamentLive';
import RollingNumber from '@/components/public/RollingNumber';
import ShareScoreButton from '@/components/public/ShareScoreButton';
import LocationLink from '@/components/LocationLink';
import FollowAlertsToggle from '@/components/public/FollowAlertsToggle';
import { teamAvatarHue, teamInitials } from '@/lib/team-color';
import styles from './MyTeamDock.module.css';

interface Props {
  orgSlug: string;
  tournamentSlug: string;
  tournamentId: string;
  /** Computed server-side from the tournament window; gates all work. */
  inProgress: boolean;
  /** Whether the plan includes fan push score alerts (Tournament Plus+). */
  fanAlertsEnabled?: boolean;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return 'Now';
  const totalMin = Math.floor(ms / 60_000);
  const days = Math.floor(totalMin / 1440);
  const hours = Math.floor((totalMin % 1440) / 60);
  const mins = totalMin % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${Math.max(mins, 1)}m`;
}

export default function MyTeamDock({ orgSlug, tournamentSlug, tournamentId, inProgress, fanAlertsEnabled = false }: Props) {
  const { followedTeamId, unfollow } = useFollowedTeam(orgSlug, tournamentSlug);
  const [teams, setTeams] = useState<PublicTeam[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [tournamentName, setTournamentName] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const active = inProgress && !!followedTeamId;

  // Initial data load — only when active (followed + game day).
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    void fetchPublicTournamentData(orgSlug, tournamentSlug, 'schedule').then(data => {
      if (cancelled || !data) return;
      setTeams(data.teams ?? []);
      setGames(data.games ?? []);
      setVenues(data.venues ?? []);
      setTournamentName(data.tournament?.name ?? '');
      setLoaded(true);
    });
    return () => { cancelled = true; };
  }, [active, orgSlug, tournamentSlug]);

  usePublicTournamentLive({
    orgSlug,
    tournamentSlug,
    section: 'schedule',
    enabled: active,
    onData: data => {
      setTeams(data.teams ?? []);
      setGames(data.games ?? []);
      if (data.venues) setVenues(data.venues);
    },
  });

  // Countdown ticker (also re-evaluates live/next selection every 30s).
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, [active]);

  const team = followedTeamId ? teams.find(t => t.id === followedTeamId) ?? null : null;
  const today = tournamentToday();
  const now = new Date(nowMs);

  const teamGames = useMemo(
    () => team
      ? games
          .filter(g => g.status !== 'cancelled' && (g.homeTeamId === team.id || g.awayTeamId === team.id))
          .sort((a, b) => (a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? '')))
      : [],
    [team, games],
  );

  // One shared definition of "live" (J6-013): the game is inside its time-window — not the
  // old "submitted score = live" heuristic that never turned off. nextGame is time-aware so
  // a past-due unscored game stops pinning as NEXT all day (J6-039).
  const liveGame = teamGames.find(
    g => isGameLive(g, g.durationMinutes ?? DEFAULT_GAME_DURATION_MINUTES, now),
  ) ?? null;
  const nextGame = !liveGame
    ? teamGames.find(g => {
        if (g.status !== 'scheduled') return false;
        const startMs = gameStartMs(g);
        return startMs == null ? g.date >= today : startMs > nowMs;
      }) ?? null
    : null;
  const game = liveGame ?? nextGame;

  if (!active || !loaded || !team || !game) return null;

  const opponentId = game.homeTeamId === team.id ? game.awayTeamId : game.homeTeamId;
  const opponentName = teams.find(t => t.id === opponentId)?.name
    ?? (game.homeTeamId === team.id ? game.awayPlaceholder : game.homePlaceholder)
    ?? 'TBD';

  // A game can be live before its first run is entered → show 0–0 rather than blank.
  const myScore = liveGame ? ((liveGame.homeTeamId === team.id ? liveGame.homeScore : liveGame.awayScore) ?? 0) : null;
  const oppScore = liveGame ? ((liveGame.homeTeamId === team.id ? liveGame.awayScore : liveGame.homeScore) ?? 0) : null;

  // Most recent scored game (live or final) → a shareable result card.
  const latestResult = teamGames
    .filter(g => (g.status === 'completed' || g.status === 'submitted') && g.homeScore != null && g.awayScore != null)
    .slice()
    .sort((a, b) => (b.date.localeCompare(a.date) || (b.time ?? '').localeCompare(a.time ?? '')))[0] ?? null;
  const shareGame = liveGame ?? latestResult;
  const shareIsLive = !!liveGame;
  const shareAwayName = shareGame ? (teams.find(t => t.id === shareGame.awayTeamId)?.name ?? shareGame.awayPlaceholder ?? 'TBD') : '';
  const shareHomeName = shareGame ? (teams.find(t => t.id === shareGame.homeTeamId)?.name ?? shareGame.homePlaceholder ?? 'TBD') : '';

  // Tournament-timezone start instant so the countdown is correct regardless of the
  // viewer's device zone (and so it never goes stale at the UTC day boundary).
  const nextStartMs = nextGame ? gameStartMs(nextGame) : null;
  const countdownMs = nextStartMs != null ? nextStartMs - nowMs : null;
  const scheduleHref = `/${orgSlug}/${tournamentSlug}/schedule`;
  // Resolve the venue LIVE (a venue/facility rename propagates immediately) instead
  // of the denormalized game.location snapshot the dock used to show.
  const venueLabel = resolveGameVenueLabel(game, venues);
  const venue = game.venueId ? venues.find(v => v.id === game.venueId) ?? null : null;
  const shareVenueLabel = shareGame ? resolveGameVenueLabel(shareGame, venues) : '';

  return (
    <div className={styles.dockWrap} data-expanded={expanded ? 'true' : 'false'}>
      {expanded && (
        <div className={styles.expandPanel}>
          <div className={styles.expandRow}>
            <span className={styles.expandLabel}>Opponent</span>
            <strong>{opponentName}</strong>
          </div>
          {venueLabel && (
            <div className={styles.expandRow}>
              <span className={styles.expandLabel}>Venue</span>
              <LocationLink location={venueLabel} venue={venue} size="sm" />
            </div>
          )}
          {nextGame && (
            <div className={styles.expandRow}>
              <span className={styles.expandLabel}>Start</span>
              <span>
                {new Date(nextGame.date + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}
                {nextGame.time ? ` · ${formatTime(nextGame.time)}` : ''}
              </span>
            </div>
          )}
          {shareGame && (
            <ShareScoreButton
              wrapClassName={styles.expandShare}
              menuPlacement="up"
              menuAlign="left"
              gameHref={`/${orgSlug}/${tournamentSlug}/schedule/${shareGame.id}`}
              tournamentName={tournamentName}
              awayName={shareAwayName}
              homeName={shareHomeName}
              awayScore={shareGame.awayScore ?? 0}
              homeScore={shareGame.homeScore ?? 0}
              statusLabel={shareIsLive ? 'LIVE' : 'FINAL'}
              live={shareIsLive}
              dateLabel={new Date(shareGame.date + 'T12:00:00').toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
              venueLabel={shareVenueLabel || null}
              gameType={shareGame.isPlayoff ? (shareGame.bracketCode || 'Playoff') : null}
            />
          )}
          {fanAlertsEnabled && (
            <div className={styles.expandAlerts}>
              <FollowAlertsToggle
                orgSlug={orgSlug}
                tournamentSlug={tournamentSlug}
                tournamentId={tournamentId}
                team={{ id: team.id, name: team.name }}
              />
            </div>
          )}
          <Link href={scheduleHref} className={styles.expandLink} onClick={() => setExpanded(false)}>
            View full schedule
          </Link>
          <button
            type="button"
            className={styles.expandUnfollow}
            onClick={() => { unfollow(); setExpanded(false); }}
          >
            Unfollow {team.name}
          </button>
        </div>
      )}

      <button
        type="button"
        className={styles.dockBar}
        onClick={() => setExpanded(v => !v)}
        aria-expanded={expanded}
        aria-label={`${team.name} game-day status — tap to ${expanded ? 'collapse' : 'expand'}`}
      >
        <span className={styles.dockAvatar} style={{ background: `hsl(${teamAvatarHue(team.name)}, 58%, 40%)` }}>
          {teamInitials(team.name)}
        </span>
        <span className={styles.dockMain}>
          <span className={styles.dockName}>
            <Star size={10} fill="currentColor" className={styles.dockStar} />
            {team.name}
          </span>
          <span className={styles.dockSub}>{liveGame ? `vs ${opponentName}` : `Next · vs ${opponentName}`}</span>
        </span>
        <span className={styles.dockRight}>
          {liveGame ? (
            <>
              <span className={styles.dockLive}><span className={styles.dockLiveDot} />LIVE</span>
              <span className={styles.dockScore}>
                <RollingNumber value={myScore} />
                <span className={styles.dockDash}>-</span>
                <RollingNumber value={oppScore} />
              </span>
            </>
          ) : (
            <span className={styles.dockNext}>
              <span className={styles.dockNextLabel}>{countdownMs != null && countdownMs > 0 ? 'IN' : 'NEXT'}</span>
              <span className={styles.dockNextVal}>
                {countdownMs != null ? formatCountdown(countdownMs) : (nextGame?.time ? formatTime(nextGame.time) : 'TBD')}
              </span>
            </span>
          )}
          <ChevronUp size={16} className={styles.dockChevron} aria-hidden="true" />
        </span>
      </button>
    </div>
  );
}
