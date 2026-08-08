'use client';

/**
 * The day-of volunteer shells' bottom furniture — the filter sub-bar and the tab bar.
 *
 * Both shells mount the same two components so the twins cannot drift, and both bars are
 * phone-only: above 640px the filter bar is a plain block sitting where it always sat, and the
 * tab bar is not rendered at all (the header keeps the doors there — see DayOfShell.module.css).
 *
 * Owner decision 2026-08-07 (Option C, from mockup artifact 2bf781e7-…): a volunteer gets the
 * status buckets under their thumb AND their duties as tabs. The known price is ~110px of fixed
 * bottom chrome; it was chosen with that cost stated.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ClipboardList, Download, LogOut, UserCheck, UserRound, X } from 'lucide-react';
import { signOut } from '@/lib/auth';
import { useDismissable } from '@/lib/overlay-hooks';
import styles from './DayOfShell.module.css';

/**
 * One pinned row of status buckets.
 *
 * Rendered in its NATURAL position in the page's flow — the media query lifts it. Rendering it
 * last and un-fixing it above 640px would drop the buckets to the bottom of a desktop page.
 */
export function DayOfFilterBar({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={styles.filterBar} role="group" aria-label={label}>
      {children}
    </div>
  );
}

/**
 * One bucket. `count` leads on a phone (where this bar is the only place the numbers live, the
 * counter tiles having been retired) and folds into the label on desktop, where the bar is a
 * filter row rather than a summary.
 */
export function DayOfFilterButton({
  label, count, active, onClick,
}: {
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className={styles.barBtn} aria-pressed={active} onClick={onClick}>
      {count != null && <span className={styles.barCount}>{count}</span>}
      <span>
        {label}
        {count != null && <span className={styles.barBtnInline}> {count}</span>}
      </span>
    </button>
  );
}

export interface DayOfTabBarProps {
  orgSlug: string;
  /** Which shell is mounting this — decides the current tab. */
  current: 'score' | 'gate';
  /** Duties this volunteer actually holds. A door they cannot open is ABSENT, never disabled. */
  canScore: boolean;
  canGate: boolean;
  /** Who is signed in — the first question the Account sheet exists to answer. */
  displayName: string;
  email: string;
  /** Plain-language duty names, for the same reason. */
  duties: string[];
  orgName: string;
}

/**
 * The tab bar, plus the Account sheet behind its third tab.
 *
 * ⚠ A volunteer holding ONE duty sees two tabs (their surface + Account), not three. A permanently
 * disabled tab teaches nothing and invites a tap that does nothing; absence is the honest form.
 * This is the design's weakest case and is flagged for owner QA — if it reads as hollow, the
 * fallback is the filter bar alone for those volunteers, with Sign Out back in the header.
 */
export default function DayOfTabBar({
  orgSlug, current, canScore, canGate, displayName, email, duties, orgName,
}: DayOfTabBarProps) {
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();

  const close = useCallback(() => setOpen(false), []);
  useDismissable(open, [sheetRef, triggerRef], close, () => {
    setOpen(false);
    triggerRef.current?.focus();
  });

  // A sheet over a scrollable board must not let the board scroll behind it — on a phone that
  // reads as the sheet sliding around. Restores whatever the document had, not a hardcoded value.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [open]);

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    await signOut();
    router.replace('/auth/login');
    router.refresh();
  }

  return (
    <>
      <nav className={styles.tabBar} aria-label="Volunteer sections">
        {canScore && (
          <Link
            href={`/${orgSlug}/scorekeeper`}
            className={styles.tab}
            aria-current={current === 'score' ? 'page' : undefined}
          >
            <ClipboardList size={21} aria-hidden />
            Score
          </Link>
        )}
        {canGate && (
          <Link
            href={`/${orgSlug}/check-in`}
            className={styles.tab}
            aria-current={current === 'gate' ? 'page' : undefined}
          >
            <UserCheck size={21} aria-hidden />
            Gate
          </Link>
        )}
        <button
          type="button"
          ref={triggerRef}
          className={styles.tab}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen(o => !o)}
        >
          <UserRound size={21} aria-hidden />
          Account
        </button>
      </nav>

      {open && (
        <div className={styles.sheetBackdrop} role="presentation">
          <div className={styles.sheet} ref={sheetRef} role="dialog" aria-modal="true" aria-label="Account">
            <div className={styles.sheetHead}>
              <span className={styles.sheetTitle}>Account</span>
              <button type="button" className={styles.sheetClose} onClick={close} aria-label="Close account">
                <X size={18} aria-hidden />
              </button>
            </div>

            {/* Identity first. At a gate the phone is often borrowed or shared, and "who am I
                signed in as, and what am I allowed to do?" is the question that matters most. */}
            <div className={styles.whoCard}>
              <span className={styles.whoName}>{displayName}</span>
              {email && email !== displayName && <span className={styles.whoLine}>{email}</span>}
              <span className={styles.whoLine}>
                {duties.length > 0 ? `${duties.join(' · ')} — ${orgName}` : orgName}
              </span>
            </div>

            {/* The install prompt is already mounted by both shells and listens for this event —
                no second copy of the platform detection lives here. */}
            <button
              type="button"
              className={styles.sheetRow}
              onClick={() => {
                close();
                window.dispatchEvent(new CustomEvent('flhq:show-install'));
              }}
            >
              <Download size={16} aria-hidden />
              Install this app
              <span className={styles.chev} aria-hidden>→</span>
            </button>

            {/* ⚠ NO "open the public site" row here, deliberately (owner call 2026-08-07).
                It was added to give the gate shell a public door, then removed on the plainer
                argument: the club's public HOME is a marketing surface, and a volunteer scoring
                games or working a gate has no errand there. The door a volunteer might genuinely
                want is a specific EVENT's public schedule ("which field is U13 on?") — which is
                what the scorekeeper's ⇄ pill already resolves to, and is a different thing.
                It also dead-ended at a private club, where that page 404s by design. */}

            <button
              type="button"
              className={`${styles.sheetRow} ${styles.sheetRowOut}`}
              onClick={handleSignOut}
              disabled={signingOut}
            >
              <LogOut size={16} aria-hidden />
              {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
