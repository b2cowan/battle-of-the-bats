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
import { phaseOf, fmtRange, daysUntil } from '@/lib/tournament-phase-display';
import type { Game, PublicTeam } from '@/lib/types';
import styles from './TournamentNavStatus.module.css';

function teamLabel(id: string | null | undefined, placeholder: string | null | undefined, teams: PublicTeam[]): string {
  const name = teams.find(t => t.id === id)?.name ?? placeholder ?? 'TBD';
  return name.replace(/\s*\([^)]*\)\s*/g, '').trim() || name;
}

export default function TournamentNavStatus() {
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) || '';
  const tournamentSlug = (params?.tournamentSlug as string) || '';
  const { tournamentStartDate, tournamentEndDate, tournamentStatus, tournamentFinished } = useOrgNav();

  const today = tournamentToday();
  const phase = phaseOf(tournamentStartDate, tournamentEndDate, tournamentStatus, today, tournamentFinished);
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
