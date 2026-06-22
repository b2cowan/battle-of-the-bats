'use client';

/**
 * Context-aware action strip (B6) — mobile only, docked above the bottom nav.
 *
 * Surfaces the single most useful phase-aware action, one tap from anywhere:
 *   finalize games > review pending teams > (draft) finish setup > (done) summary.
 * The action is count-driven (reuses the B5 worklist) so it self-adjusts by phase.
 *
 * Dismissible: the "×" hides it and frees the space. It re-shows only "when
 * something changes" — a different action, or the same action's count goes up —
 * persisted per tournament in localStorage. Reserves content space via the
 * `--admin-strip-h` CSS var so nothing hides behind it.
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ClipboardList, Users, Trophy, FileText, ArrowRight, X } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { useTournament } from '@/lib/tournament-context';
import { useAdminWorklist } from '@/lib/admin-worklist';
import { resolvePhase, isWithinEventDates } from '@/lib/tournament-phase';
import styles from './AdminContextStrip.module.css';

const STRIP_HEIGHT = 44; // px — keep in sync with .strip height in the CSS

type StripAction = { key: string; label: string; href: string; icon: React.ReactNode; count: number };
type DismissState = { key: string; count: number };

export default function AdminContextStrip() {
  const pathname = usePathname();
  const { currentOrg } = useOrg();
  const { currentTournament } = useTournament();
  const worklist = useAdminWorklist();
  const [dismissed, setDismissed] = useState<DismissState | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const tournamentId = currentTournament?.id;
  const base = currentOrg?.slug ? `/${currentOrg.slug}/admin/tournaments` : null;
  const onTournamentRoute = pathname.includes('/admin/tournaments');
  // Don't nudge toward the Results page when you're already on it — the bottom-nav
  // tab badge already carries the count, so the strip would just duplicate it.
  const onResultsPage = pathname.includes('/admin/tournaments/results');
  // The chat is a full-screen messaging surface; a dashboard nudge above the composer
  // just steals vertical space from the conversation, so suppress the strip there.
  const onChatPage = pathname.includes('/admin/tournaments/chat');

  // Load this tournament's dismiss state after mount (avoids SSR mismatch).
  useEffect(() => {
    setHydrated(true);
    if (!tournamentId) { setDismissed(null); return; }
    try {
      const raw = localStorage.getItem(`fl_admin_strip_dismiss:${tournamentId}`);
      setDismissed(raw ? (JSON.parse(raw) as DismissState) : null);
    } catch {
      setDismissed(null);
    }
  }, [tournamentId]);

  const action: StripAction | null = useMemo(() => {
    if (!onTournamentRoute || onChatPage || !base || !currentTournament) return null;
    const regs = worklist.registrations ?? 0;
    const results = worklist.results ?? 0;
    if (results > 0 && !onResultsPage) {
      return { key: 'finalize', label: `${results} game${results === 1 ? '' : 's'} to finalize`, href: `${base}/results`, icon: <Trophy size={15} />, count: results };
    }
    if (regs > 0) {
      return { key: 'review', label: `${regs} team${regs === 1 ? '' : 's'} to review`, href: `${base}/registrations`, icon: <Users size={15} />, count: regs };
    }
    const phase = resolvePhase({
      status: currentTournament.status,
      isGameDay: isWithinEventDates(currentTournament.startDate, currentTournament.endDate),
    });
    if (phase === 'draft') {
      return { key: 'setup', label: 'Finish tournament setup', href: `${base}/dashboard`, icon: <ClipboardList size={15} />, count: 0 };
    }
    if (phase === 'completed' || phase === 'archived') {
      return { key: 'summary', label: 'Review event summary', href: `${base}/summary`, icon: <FileText size={15} />, count: 0 };
    }
    return null; // open / game day with nothing pending → nothing to surface
  }, [onTournamentRoute, onChatPage, onResultsPage, base, currentTournament, worklist]);

  // Visible unless dismissed for the same action whose count hasn't increased.
  const visible = !!action && hydrated && !(
    dismissed != null && dismissed.key === action.key && action.count <= dismissed.count
  );

  // Reserve content space while visible so nothing hides behind the strip.
  useEffect(() => {
    document.documentElement.style.setProperty('--admin-strip-h', visible ? `${STRIP_HEIGHT}px` : '0px');
    return () => { document.documentElement.style.setProperty('--admin-strip-h', '0px'); };
  }, [visible]);

  if (!visible || !action) return null;

  const dismiss = () => {
    const next: DismissState = { key: action.key, count: action.count };
    setDismissed(next);
    if (tournamentId) {
      try { localStorage.setItem(`fl_admin_strip_dismiss:${tournamentId}`, JSON.stringify(next)); } catch { /* ignore */ }
    }
  };

  return (
    <div className={styles.strip}>
      <Link href={action.href} className={styles.action}>
        <span className={styles.icon}>{action.icon}</span>
        <span className={styles.label}>{action.label}</span>
        <ArrowRight size={14} className={styles.arrow} aria-hidden />
      </Link>
      <button type="button" className={styles.dismiss} onClick={dismiss} aria-label="Dismiss">
        <X size={15} aria-hidden />
      </button>
    </div>
  );
}
