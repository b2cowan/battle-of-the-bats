'use client';
/**
 * components/public/DesktopMyTeamRailCard.tsx
 * Persistent desktop "my team" card for the tournament side rail (J6-042): keeps the
 * followed team's live score / next game / alerts in view on EVERY page, not just
 * home + schedule. Self-gating — fetches only when a team is followed; the rail is
 * already desktop-only (CSS), so this rides that gate. Uses the shared live engine.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Star } from 'lucide-react';
import type { Game, PublicTeam } from '@/lib/types';
import { useFollowedTeam } from '@/lib/follow';
import { isGameLive, gameStartMs, isGameUpcoming, DEFAULT_GAME_DURATION_MINUTES } from '@/lib/game-status';
import { tournamentToday } from '@/lib/timezone';
import { fetchPublicTournamentData } from '@/lib/public-tournament-client';
import { formatTime } from '@/lib/utils';
import FollowAlertsToggle from '@/components/public/FollowAlertsToggle';
import styles from './DesktopMyTeamRailCard.module.css';

export default function DesktopMyTeamRailCard() {
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) || '';
  const tournamentSlug = (params?.tournamentSlug as string) || '';
  const { followedTeamId } = useFollowedTeam(orgSlug, tournamentSlug);

  const [teams, setTeams] = useState<PublicTeam[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [tournamentId, setTournamentId] = useState('');
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [tournamentCompleted, setTournamentCompleted] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!followedTeamId || !orgSlug || !tournamentSlug) return;
    let cancelled = false;
    void fetchPublicTournamentData(orgSlug, tournamentSlug, 'schedule').then(data => {
      if (cancelled || !data) return;
      setTeams(data.teams ?? []);
      setGames(data.games ?? []);
      setTournamentId(data.tournament?.id ?? '');
      setAlertsEnabled(!!data.fanAlertsEnabled);
      setTournamentCompleted(data.tournament?.status === 'completed');
      setLoaded(true);
    });
    return () => { cancelled = true; };
  }, [followedTeamId, orgSlug, tournamentSlug]);

  if (!followedTeamId || !loaded) return null;
  const team = teams.find(t => t.id === followedTeamId) ?? null;
  if (!team) return null;

  const teamGames = games
    .filter(g => g.status !== 'cancelled' && (g.homeTeamId === team.id || g.awayTeamId === team.id))
    .sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? ''));
  const today = tournamentToday();
  const liveGame = teamGames.find(g => isGameLive(g, g.durationMinutes ?? DEFAULT_GAME_DURATION_MINUTES)) ?? null;
  const nextGame = !liveGame
    ? teamGames.find(g => g.status === 'scheduled' && (gameStartMs(g) == null ? g.date >= today : isGameUpcoming(g))) ?? null
    : null;

  const opponentName = (g: Game) => {
    const oppId = g.homeTeamId === team.id ? g.awayTeamId : g.homeTeamId;
    return teams.find(t => t.id === oppId)?.name ?? (g.homeTeamId === team.id ? g.awayPlaceholder : g.homePlaceholder) ?? 'TBD';
  };
  const liveScore = liveGame
    ? `${(liveGame.awayTeamId === team.id ? liveGame.awayScore : liveGame.homeScore) ?? 0}-${(liveGame.awayTeamId === team.id ? liveGame.homeScore : liveGame.awayScore) ?? 0}`
    : null;
  const scheduleHref = `/${orgSlug}/${tournamentSlug}/schedule`;

  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <Star size={13} className={styles.star} fill="currentColor" aria-hidden />
        <span className={styles.name}>{team.name}</span>
      </div>
      {liveGame ? (
        <div className={styles.row}>
          <span className={styles.liveBadge}><span className={styles.liveDot} />LIVE</span>
          <span className={styles.score}>{liveScore}</span>
          <span className={styles.opp}>vs {opponentName(liveGame)}</span>
        </div>
      ) : nextGame ? (
        <div className={styles.row}>
          <span className={styles.nextLabel}>NEXT</span>
          <span className={styles.nextVal}>
            {new Date(`${nextGame.date}T12:00:00`).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}
            {nextGame.time ? ` · ${formatTime(nextGame.time)}` : ''}
          </span>
          <span className={styles.opp}>vs {opponentName(nextGame)}</span>
        </div>
      ) : (
        <div className={styles.row}><span className={styles.nextVal}>No upcoming games</span></div>
      )}
      {alertsEnabled && tournamentId && !tournamentCompleted && (
        <FollowAlertsToggle orgSlug={orgSlug} tournamentSlug={tournamentSlug} tournamentId={tournamentId} team={{ id: team.id, name: team.name }} />
      )}
      <Link href={scheduleHref} className={styles.link}>View schedule</Link>
    </div>
  );
}
