'use client';
/**
 * components/consumer/StartMenu.tsx — the top bar's "Get started" menu (Desktop Public UX Phase 1, WI-2;
 * renamed from "Run a tournament" by The first look, Ask 13, owner 2026-10-19: the marketing bar already says
 * Get started, and the old label stood over the team sign-up too). Running a tournament leads; a quieter
 * "More ways to start" group names the other doors (coach / join / league), each by the same words /start uses. Desktop-only by placement —
 * it lives in the top bar's utility cluster, which the shell hides ≤900px (mobile keeps the
 * bottom tabs and reaches /start through content CTAs).
 *
 * Gating: props default to the SAFE routes (coach → the /start chooser, league hidden) so a
 * mount that can't resolve plan gating server-side never promotes a gated door; dynamic mounts
 * pass `getStartMenuConfig()` for the direct hrefs — the ONE coach rule (lib/start-menu.ts).
 */
import { useRef, useState } from 'react';
import Link from 'next/link';
import { usePublicPathname } from '@/lib/use-public-pathname';
import { ChevronDown } from 'lucide-react';
import { useDismissable } from '@/lib/overlay-hooks';
import styles from './ConsumerShell.module.css';

export default function StartMenu({
  coachHref = '/start',
  showLeague = false,
}: {
  coachHref?: string;
  showLeague?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  useDismissable(open, wrapRef, () => setOpen(false));
  const close = () => setOpen(false);

  // Close on ANY route change, not just item clicks — this component lives in persistent
  // layout chrome, so browser Back/Forward (no pointerdown, no click) would otherwise
  // leave a stale open popover over the new page. Render-time adjustment (the repo's
  // established lastPath pattern) rather than a setState-in-effect.
  const pathname = usePublicPathname();
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  return (
    <div className={styles.startWrap} ref={wrapRef}>
      <button
        type="button"
        className={`${styles.utilLink} ${styles.startBtn}`}
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        Get started
        <ChevronDown size={13} className={`${styles.startCaret} ${open ? styles.startCaretOpen : ''}`} aria-hidden />
      </button>
      {open && (
        <div className={styles.startMenu} role="menu" aria-label="Get started">
          <Link href="/start/tournament" role="menuitem" className={styles.startItem} onClick={close}>
            <span className={styles.startItemTitle}>Run a tournament</span>
            <span className={styles.startItemSub}>Teams, schedule, brackets, and a public site — free to start.</span>
          </Link>
          <div className={styles.startGroup} aria-hidden>More ways to start</div>
          <Link href={coachHref} role="menuitem" className={styles.startItem} onClick={close}>
            <span className={styles.startItemTitle}>Coach a team</span>
            <span className={styles.startItemSub}>A free team home for your season — no organization needed.</span>
          </Link>
          <Link href="/auth/signup?account=1" role="menuitem" className={styles.startItem} onClick={close}>
            <span className={styles.startItemTitle}>Join a team</span>
            <span className={styles.startItemSub}>Invited? Create an account to accept your invitation.</span>
          </Link>
          {showLeague && (
            <Link href="/start/league" role="menuitem" className={styles.startItem} onClick={close}>
              <span className={styles.startItemTitle}>Start a league season</span>
              <span className={styles.startItemSub}>Registration, draft, scheduling, standings, and parent comms.</span>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
