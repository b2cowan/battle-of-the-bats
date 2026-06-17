'use client';
/**
 * components/public/TournamentNavStatus.tsx
 * The desktop top bar's left-side context: a status pill + dates that adapts to
 * the tournament phase, and — on game day — a live score ticker. Rendered inside
 * the tournament nav (so it layers above the nav's frosted scroll background) and
 * gated to desktop by the nav's `.navStatusSlot` wrapper. Reads dates/status from
 * OrgNav context; only polls live data while the event is in its window.
 */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { CalendarClock, CircleCheck } from 'lucide-react';
import { useOrgNav } from '@/components/OrgNavContext';
import { usePublicTournamentLive } from '@/lib/hooks/usePublicTournamentLive';
import { fetchPublicTournamentData } from '@/lib/public-tournament-client';
import { tournamentToday } from '@/lib/timezone';
import type { Game, PublicTeam } from '@/lib/types';
import styles from './TournamentNavStatus.module.css';

type Phase = 'pre' | 'live' | 'done' | 'none';

function phaseOf(start: string | null, end: string | null, status: string | null, today: string): Phase {
  if (status === 'completed') return 'done';
  if (status === 'cancelled') return 'none';
  if (!start || !end) return 'none';
  if (today < start) return 'pre';
  if (today > end) return 'done';
  return 'live';
}

function fmtRange(start: string | null, end: string | null): string {
  if (!start) return '';
  const s = new Date(`${start}T12:00:00`);
  if (!end || end === start) return s.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
  const e = new Date(`${end}T12:00:00`);
  const sameMonth = s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth();
  if (sameMonth) return `${s.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}–${e.getDate()}, ${e.getFullYear()}`;
  return `${s.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })} – ${e.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

function daysUntil(start: string | null, today: string): number {
  if (!start) return 0;
  const ms = new Date(`${start}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime();
  return Math.max(0, Math.round(ms / 86_400_000));
}

function teamLabel(id: string | null | undefined, placeholder: string | null | undefined, teams: PublicTeam[]): string {
  const name = teams.find(t => t.id === id)?.name ?? placeholder ?? 'TBD';
  return name.replace(/\s*\([^)]*\)\s*/g, '').trim() || name;
}

export default function TournamentNavStatus() {
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) || '';
  const tournamentSlug = (params?.tournamentSlug as string) || '';
  const { tournamentStartDate, tournamentEndDate, tournamentStatus } = useOrgNav();

  const today = tournamentToday();
  const phase = phaseOf(tournamentStartDate, tournamentEndDate, tournamentStatus, today);
  const isGameDay = phase === 'live' && !!orgSlug && !!tournamentSlug;

  const [teams, setTeams] = useState<PublicTeam[]>([]);
  const [games, setGames] = useState<Game[]>([]);

  useEffect(() => {
    if (!isGameDay) return;
    let cancelled = false;
    void fetchPublicTournamentData(orgSlug, tournamentSlug, 'schedule').then(data => {
      if (cancelled || !data) return;
      setTeams(data.teams ?? []);
      setGames(data.games ?? []);
    });
    return () => { cancelled = true; };
  }, [isGameDay, orgSlug, tournamentSlug]);

  usePublicTournamentLive({
    orgSlug,
    tournamentSlug,
    section: 'schedule',
    enabled: isGameDay,
    onData: data => {
      setTeams(data.teams ?? []);
      setGames(data.games ?? []);
    },
  });

  const liveGames = useMemo(
    () => games.filter(g => g.date === today && g.status === 'submitted' && g.homeScore != null && g.awayScore != null),
    [games, today],
  );

  if (phase === 'none' || !orgSlug || !tournamentSlug) return null;

  const dateRange = fmtRange(tournamentStartDate, tournamentEndDate);
  const scheduleHref = `/${orgSlug}/${tournamentSlug}/schedule`;

  if (phase === 'pre') {
    const days = daysUntil(tournamentStartDate, today);
    return (
      <div className={styles.status}>
        <span className={styles.pillUpcoming}><CalendarClock size={13} /> Upcoming</span>
        <span className={styles.text}>
          {dateRange}{days > 0 ? ` · First pitch in ${days} day${days === 1 ? '' : 's'}` : ''}
        </span>
      </div>
    );
  }

  if (phase === 'done') {
    return (
      <div className={styles.status}>
        <span className={styles.pillDone}><CircleCheck size={13} /> Completed</span>
        <span className={styles.text}>{dateRange}</span>
      </div>
    );
  }

  // Game day.
  if (liveGames.length > 0) {
    const g = liveGames[0];
    const away = teamLabel(g.awayTeamId, g.awayPlaceholder, teams);
    const home = teamLabel(g.homeTeamId, g.homePlaceholder, teams);
    return (
      <Link href={scheduleHref} className={styles.statusLink} aria-label="View live games">
        <span className={styles.pillLive}><span className={styles.liveDot} /> LIVE</span>
        <span className={styles.ticker}>
          {liveGames.length > 1 && <span className={styles.tickerCount}>{liveGames.length} live · </span>}
          {away} <b>{g.awayScore}</b><span className={styles.dash}>–</span><b>{g.homeScore}</b> {home}
        </span>
      </Link>
    );
  }

  return (
    <Link href={scheduleHref} className={styles.statusLink} aria-label="View schedule">
      <span className={styles.pillLive}><span className={styles.liveDot} /> In progress</span>
      <span className={styles.text}>{dateRange}</span>
    </Link>
  );
}
