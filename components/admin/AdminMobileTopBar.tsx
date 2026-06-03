'use client';

/**
 * Mobile admin top app-bar (≤900px).
 *
 * Persistent slim bar that gives the notification bell a real home (the sidebar
 * bell is hidden on mobile) and surfaces the current tournament + live status +
 * a one-tap switcher. On non-tournament admin routes it falls back to the org
 * name (no switcher/status). Desktop (>900px) keeps the sidebar; this is
 * display:none there.
 */

import { usePathname } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import NotificationBell from '@/components/notifications/NotificationBell';
import { useOrg } from '@/lib/org-context';
import { useTournament } from '@/lib/tournament-context';
import { resolvePhase, isWithinEventDates, PHASE_LABEL } from '@/lib/tournament-phase';
import styles from './AdminMobileTopBar.module.css';

export default function AdminMobileTopBar() {
  const pathname = usePathname();
  const { currentOrg } = useOrg();
  const { tournaments, currentTournament, setCurrentTournament } = useTournament();

  const onTournamentRoute = pathname.includes('/admin/tournaments');
  const showTournament = onTournamentRoute && !!currentTournament;
  // Shell-wide: only the date signal is available here (no game data), so the
  // pill can read OPEN while the dashboard already shows LIVE if a game started.
  const gameDayByDate = isWithinEventDates(currentTournament?.startDate, currentTournament?.endDate);
  const phase = currentTournament ? resolvePhase({ status: currentTournament.status, isGameDay: gameDayByDate }) : null;
  const phaseLabel = showTournament && phase ? PHASE_LABEL[phase] : null;

  return (
    <header className={styles.bar}>
      <div className={styles.left}>
        {showTournament && tournaments.length > 1 ? (
          <div className={styles.switcher}>
            <select
              className={styles.select}
              value={currentTournament?.id ?? ''}
              onChange={event => {
                const next = tournaments.find(t => t.id === event.target.value);
                if (next) setCurrentTournament(next);
              }}
              aria-label="Switch tournament"
            >
              {tournaments.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <ChevronDown size={14} className={styles.chevron} aria-hidden />
          </div>
        ) : (
          <span className={styles.name}>
            {showTournament ? currentTournament?.name : (currentOrg?.name ?? 'Admin')}
          </span>
        )}
        {phaseLabel && (
          <span className={styles.statusPill} data-phase={phase ?? undefined}>
            {phase === 'gameday' && <span className={styles.liveDot} aria-hidden />}
            {phaseLabel}
          </span>
        )}
      </div>
      {currentOrg?.id && (
        <div className={styles.bellSlot}>
          <NotificationBell orgId={currentOrg.id} />
        </div>
      )}
    </header>
  );
}
