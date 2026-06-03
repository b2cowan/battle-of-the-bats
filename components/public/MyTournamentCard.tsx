'use client';
/**
 * components/public/MyTournamentCard.tsx
 * Personalized "My Tournament" card for the followed team. Shows live status or a
 * live countdown to the next game, current record, standings position, a one-tap
 * calendar export, and quick links. Used on the tournament home page; reads the
 * followed team from localStorage (no account).
 */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Star, Clock, Calendar, Trophy, CalendarPlus } from 'lucide-react';
import type { Game, Team, Division, Venue } from '@/lib/types';
import { formatTime } from '@/lib/utils';
import { useFollowedTeam } from '@/lib/follow';
import { downloadTeamScheduleICS } from '@/lib/team-calendar';
import LocationLink from '@/components/LocationLink';
import FollowAlertsToggle from '@/components/public/FollowAlertsToggle';
import homeStyles from '@/app/[orgSlug]/Home.module.css';

export interface MyCardStandingRow {
  teamId: string;
  teamName: string;
  poolId?: string;
  w: number;
  l: number;
  t: number;
  pts: number;
}

interface Props {
  orgSlug: string;
  tournamentSlug: string;
  tournamentId: string;
  tournamentName: string;
  teams: Team[];
  games: Game[];
  divisions: Division[];
  venues: Venue[];
  standingsByDivision: Record<string, MyCardStandingRow[]>;
  scheduleHref: string;
  /** Whether the plan includes fan push score alerts (Tournament Plus+). */
  fanAlertsEnabled?: boolean;
}

function cleanTeamName(name: string) {
  return name.replace(/\s*\(.*?\)\s*/g, '').trim();
}

function ordinal(n: number): string {
  if (n === 1) return '1st';
  if (n === 2) return '2nd';
  if (n === 3) return '3rd';
  return `${n}th`;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return 'Starting now';
  const totalMin = Math.floor(ms / 60_000);
  const days = Math.floor(totalMin / 1440);
  const hours = Math.floor((totalMin % 1440) / 60);
  const mins = totalMin % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${Math.max(mins, 1)}m`;
}

export default function MyTournamentCard({
  orgSlug,
  tournamentSlug,
  tournamentId,
  tournamentName,
  teams,
  games,
  divisions,
  venues,
  standingsByDivision,
  scheduleHref,
  fanAlertsEnabled = false,
}: Props) {
  const { followedTeamId } = useFollowedTeam(orgSlug, tournamentSlug);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const team = followedTeamId ? teams.find(t => t.id === followedTeamId) ?? null : null;

  const today = new Date().toISOString().split('T')[0];

  const teamGames = useMemo(() => {
    if (!team) return [];
    return games
      .filter(g => g.homeTeamId === team.id || g.awayTeamId === team.id)
      .sort((a, b) => (a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? '')));
  }, [team, games]);

  if (!team) return null;

  const liveGame = teamGames.find(
    g => g.date === today && g.status === 'submitted' && g.homeScore != null && g.awayScore != null,
  ) ?? null;
  const nextGame = !liveGame
    ? teamGames.find(g => g.status === 'scheduled' && g.date >= today) ?? null
    : null;
  const latestResult = [...teamGames]
    .filter(g => (g.status === 'completed' || g.status === 'submitted') && g.homeScore != null && g.awayScore != null)
    .sort((a, b) => (b.date.localeCompare(a.date) || (b.time ?? '').localeCompare(a.time ?? '')))[0] ?? null;

  const highlightGame = liveGame ?? nextGame ?? latestResult ?? teamGames[0] ?? null;
  const opponent = highlightGame
    ? (highlightGame.homeTeamId === team.id
        ? teams.find(t => t.id === highlightGame.awayTeamId)?.name ?? highlightGame.awayPlaceholder ?? 'TBD'
        : teams.find(t => t.id === highlightGame.homeTeamId)?.name ?? highlightGame.homePlaceholder ?? 'TBD')
    : null;
  const venue = highlightGame?.venueId ? venues.find(v => v.id === highlightGame.venueId) ?? null : null;

  // Record (pool play, completed/submitted)
  let w = 0, l = 0, tt = 0;
  for (const g of teamGames) {
    if (g.isPlayoff) continue;
    if (g.status !== 'completed' && g.status !== 'submitted') continue;
    if (g.homeScore == null || g.awayScore == null) continue;
    const isHome = g.homeTeamId === team.id;
    const tf = isHome ? g.homeScore : g.awayScore;
    const ta = isHome ? g.awayScore : g.homeScore;
    if (tf > ta) w++; else if (tf < ta) l++; else tt++;
  }

  // Standings position within division (or pool, if the team is in one)
  const divisionRows = (team.divisionId ? standingsByDivision[team.divisionId] : undefined) ?? [];
  const rowsCarryPool = divisionRows.some(r => r.poolId != null);
  const poolRows = team.poolId && rowsCarryPool
    ? divisionRows.filter(r => r.poolId === team.poolId)
    : divisionRows;
  const rankIdx = poolRows.findIndex(r => r.teamId === team.id);
  const rank = rankIdx >= 0 ? rankIdx + 1 : null;

  // Live countdown to the next scheduled game (only when a start time exists)
  const countdownMs = nextGame?.time
    ? new Date(`${nextGame.date}T${nextGame.time}:00`).getTime() - nowMs
    : null;

  const liveScore = liveGame
    ? (liveGame.awayTeamId === team.id
        ? `${liveGame.awayScore}-${liveGame.homeScore}`
        : `${liveGame.homeScore}-${liveGame.awayScore}`)
    : null;

  function handleAddToCalendar() {
    if (!team) return;
    void downloadTeamScheduleICS({
      team,
      games,
      teams,
      divisions,
      tournamentName,
      orgSlug,
      tournamentSlug,
    });
  }

  return (
    <div className={`card ${homeStyles.myTeamCard}`}>
      <div className={homeStyles.dayCardHeader}>
        <div className={homeStyles.dayCardIcon}><Star size={16} fill="currentColor" /></div>
        <div>
          <span className={homeStyles.dayCardKicker}>My Team</span>
          <h3>{cleanTeamName(team.name)}</h3>
        </div>
        {(w + l + tt > 0 || rank) && (
          <div className={homeStyles.myTeamRecord}>
            <strong>{w}-{l}-{tt}</strong>
            {rank && <span>{ordinal(rank)}{team.poolId ? ' in pool' : ''}</span>}
          </div>
        )}
      </div>

      {liveGame ? (
        <div className={`${homeStyles.myTeamGame} ${homeStyles.myTeamLive}`}>
          <div className={homeStyles.myTeamLiveTop}>
            <span className={homeStyles.myTeamLiveBadge}><span className={homeStyles.myTeamLiveDot} /> LIVE</span>
            <span className={homeStyles.myTeamLiveScore}>{liveScore}</span>
          </div>
          <strong>vs {opponent}</strong>
          <LocationLink location={liveGame.location} venue={venue} size="sm" />
        </div>
      ) : nextGame ? (
        <div className={homeStyles.myTeamGame}>
          <div className={homeStyles.myTeamGameTop}>
            <Clock size={14} />
            <span>
              {new Date(nextGame.date + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}
              {nextGame.time ? ` at ${formatTime(nextGame.time)}` : ''}
            </span>
            {countdownMs != null && (
              <span className={homeStyles.myTeamCountdown}>{formatCountdown(countdownMs)}</span>
            )}
          </div>
          <strong>Next game vs {opponent}</strong>
          <LocationLink location={nextGame.location} venue={venue} size="sm" />
        </div>
      ) : latestResult ? (
        <div className={homeStyles.myTeamGame}>
          <div className={homeStyles.myTeamGameTop}>
            <Trophy size={14} />
            <span>Latest result vs {opponent}</span>
          </div>
          <span className={homeStyles.scorePill}>
            {latestResult.homeTeamId === team.id
              ? `${latestResult.homeScore} - ${latestResult.awayScore}`
              : `${latestResult.awayScore} - ${latestResult.homeScore}`}
          </span>
        </div>
      ) : (
        <p className={homeStyles.dayCardSub}>No games are scheduled for this team yet.</p>
      )}

      <div className={homeStyles.dayCardActions}>
        {fanAlertsEnabled && (
          <FollowAlertsToggle
            orgSlug={orgSlug}
            tournamentSlug={tournamentSlug}
            tournamentId={tournamentId}
            team={{ id: team.id, name: team.name }}
          />
        )}
        <button type="button" className="btn btn-ghost btn-sm" onClick={handleAddToCalendar}>
          <CalendarPlus size={14} /> Add to Calendar
        </button>
        <Link href={scheduleHref} className="btn btn-ghost btn-sm">
          <Calendar size={14} /> Schedule
        </Link>
        <Link href={`/${orgSlug}/${tournamentSlug}/teams/${team.id}`} className="btn btn-ghost btn-sm">
          <Trophy size={14} /> Profile
        </Link>
      </div>
    </div>
  );
}
