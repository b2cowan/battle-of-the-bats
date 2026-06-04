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
import { Star, ChevronUp, MapPin } from 'lucide-react';
import type { Game, Team } from '@/lib/types';
import { formatTime } from '@/lib/utils';
import { useFollowedTeam } from '@/lib/follow';
import { fetchPublicTournamentData } from '@/lib/public-tournament-client';
import { usePublicTournamentLive } from '@/lib/hooks/usePublicTournamentLive';
import RollingNumber from '@/components/public/RollingNumber';
import ShareScoreButton from '@/components/public/ShareScoreButton';
import { teamAvatarHue, teamInitials } from '@/lib/team-color';
import styles from './MyTeamDock.module.css';

interface Props {
  orgSlug: string;
  tournamentSlug: string;
  /** Computed server-side from the tournament window; gates all work. */
  inProgress: boolean;
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

export default function MyTeamDock({ orgSlug, tournamentSlug, inProgress }: Props) {
  const { followedTeamId } = useFollowedTeam(orgSlug, tournamentSlug);
  const [teams, setTeams] = useState<Team[]>([]);
  const [games, setGames] = useState<Game[]>([]);
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
    },
  });

  // Countdown ticker (also re-evaluates live/next selection every 30s).
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, [active]);

  const team = followedTeamId ? teams.find(t => t.id === followedTeamId) ?? null : null;
  const today = new Date().toISOString().split('T')[0];

  const teamGames = useMemo(
    () => team
      ? games
          .filter(g => g.status !== 'cancelled' && (g.homeTeamId === team.id || g.awayTeamId === team.id))
          .sort((a, b) => (a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? '')))
      : [],
    [team, games],
  );

  const liveGame = teamGames.find(
    g => g.date === today && g.status === 'submitted' && g.homeScore != null && g.awayScore != null,
  ) ?? null;
  const nextGame = !liveGame
    ? teamGames.find(g => g.status === 'scheduled' && g.date >= today) ?? null
    : null;
  const game = liveGame ?? nextGame;

  if (!active || !loaded || !team || !game) return null;

  const opponentId = game.homeTeamId === team.id ? game.awayTeamId : game.homeTeamId;
  const opponentName = teams.find(t => t.id === opponentId)?.name
    ?? (game.homeTeamId === team.id ? game.awayPlaceholder : game.homePlaceholder)
    ?? 'TBD';

  const myScore = liveGame ? (liveGame.homeTeamId === team.id ? liveGame.homeScore : liveGame.awayScore) : null;
  const oppScore = liveGame ? (liveGame.homeTeamId === team.id ? liveGame.awayScore : liveGame.homeScore) : null;

  // Most recent scored game (live or final) → a shareable result card.
  const latestResult = teamGames
    .filter(g => (g.status === 'completed' || g.status === 'submitted') && g.homeScore != null && g.awayScore != null)
    .slice()
    .sort((a, b) => (b.date.localeCompare(a.date) || (b.time ?? '').localeCompare(a.time ?? '')))[0] ?? null;
  const shareGame = liveGame ?? latestResult;
  const shareIsLive = !!liveGame;
  const shareAwayName = shareGame ? (teams.find(t => t.id === shareGame.awayTeamId)?.name ?? shareGame.awayPlaceholder ?? 'TBD') : '';
  const shareHomeName = shareGame ? (teams.find(t => t.id === shareGame.homeTeamId)?.name ?? shareGame.homePlaceholder ?? 'TBD') : '';

  // `time` can be "HH:MM" or "HH:MM:SS" — normalise so the date is valid (else NaN).
  const countdownMs = nextGame?.time
    ? new Date(`${nextGame.date}T${nextGame.time.slice(0, 5)}:00`).getTime() - nowMs
    : null;
  const scheduleHref = `/${orgSlug}/${tournamentSlug}/schedule`;

  return (
    <div className={styles.dockWrap} data-expanded={expanded ? 'true' : 'false'}>
      {expanded && (
        <div className={styles.expandPanel}>
          <div className={styles.expandRow}>
            <span className={styles.expandLabel}>Opponent</span>
            <strong>{opponentName}</strong>
          </div>
          {game.location && (
            <div className={styles.expandRow}>
              <span className={styles.expandLabel}><MapPin size={12} /> Venue</span>
              <span>{game.location}</span>
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
              awayScore={shareGame.awayScore as number}
              homeScore={shareGame.homeScore as number}
              statusLabel={shareIsLive ? 'LIVE' : 'FINAL'}
              live={shareIsLive}
              dateLabel={new Date(shareGame.date + 'T12:00:00').toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
              venueLabel={shareGame.location ?? null}
              gameType={shareGame.isPlayoff ? (shareGame.bracketCode || 'Playoff') : null}
            />
          )}
          <Link href={scheduleHref} className={styles.expandLink} onClick={() => setExpanded(false)}>
            View full schedule
          </Link>
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
