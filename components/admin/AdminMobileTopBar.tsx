'use client';

/**
 * Mobile admin top app-bar (≤900px).
 *
 * Persistent slim bar that gives the notification bell a real home (the sidebar bell is hidden on
 * mobile) and surfaces the current tournament + live status. In the tournament context the title is
 * a "home" link to the dashboard (a small house glyph signals it's tappable); switching tournaments
 * lives in the bottom-nav "More" sheet. On non-tournament admin routes it falls back to the org name.
 * Desktop (>900px) keeps the sidebar; this is display:none there.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home } from 'lucide-react';
import NotificationBell from '@/components/notifications/NotificationBell';
import { useOrg } from '@/lib/org-context';
import { useTournament } from '@/lib/tournament-context';
import { resolvePhase, isWithinEventDates, PHASE_LABEL } from '@/lib/tournament-phase';
import styles from './AdminMobileTopBar.module.css';

export default function AdminMobileTopBar() {
  const pathname = usePathname();
  const { currentOrg } = useOrg();
  const { currentTournament } = useTournament();

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
        {showTournament ? (
          <Link
            href={`/${currentOrg?.slug ?? ''}/admin/tournaments/dashboard`}
            className={styles.homeLink}
            aria-label={`${currentTournament?.name ?? 'Tournament'} — open dashboard`}
          >
            <Home size={14} className={styles.homeIcon} aria-hidden />
            <span className={styles.name}>{currentTournament?.name}</span>
          </Link>
        ) : (
          <span className={styles.name}>{currentOrg?.name ?? 'Admin'}</span>
        )}
        {phaseLabel && (
          <span className={styles.statusPill} data-phase={phase ?? undefined}>
            {phase === 'gameday' && <span className={styles.liveDot} aria-hidden />}
            {phaseLabel}
          </span>
        )}
      </div>
      {currentOrg?.id && (
        <div className={`${styles.bellSlot} flex items-center gap-1`}>
          <NotificationBell orgId={currentOrg.id} />
        </div>
      )}
    </header>
  );
}
