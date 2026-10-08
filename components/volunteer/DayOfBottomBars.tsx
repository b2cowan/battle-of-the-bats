'use client';

/**
 * The day-of volunteer shells' bottom furniture — the filter sub-bar and the tab bar.
 *
 * Both shells mount the same two components so the twins cannot drift, and both bars are
 * phone-only: above 640px the filter bar is a plain block sitting where it always sat, and the
 * tab bar is not rendered at all (the header keeps the doors there — see DayOfShell.module.css).
 *
 * Owner decision 2026-08-07 (Option C, from mockup artifact 2bf781e7-…): a volunteer gets the
 * status buckets under their thumb AND their duties as tabs. The known price is the fixed bottom
 * chrome (120px since the kit's 46px buckets — Stage 6 re-measured it); it was chosen with that cost
 * stated.
 */

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ClipboardList, Download, LogOut, UserCheck, UserRound } from 'lucide-react';
import { signOut } from '@/lib/auth';
import SheetFrame from '@/components/coaches/SheetFrame';
import kit from '@/components/admin/kit/AdminKitFrame.module.css';
import styles from './DayOfShell.module.css';

/**
 * One pinned row of status buckets.
 *
 * Rendered in its NATURAL position in the page's flow — the media query lifts it. Rendering it
 * last and un-fixing it above 640px would drop the buckets to the bottom of a tablet's page.
 */
export function DayOfFilterBar({ label, children, inline = false }: {
  label: string;
  children: React.ReactNode;
  /**
   * The organizer's Check-in wears the gate's bar at the top of its board, never pinned (Tournament
   * admin redesign G7, 2026-09-29): the admin already has its own bottom nav. At a desk it sits on one
   * line at the admin's 38px, "Not arrived 16". The gate's bar is unchanged.
   */
  inline?: boolean;
}) {
  return (
    <div className={`${styles.filterBar}${inline ? ` ${styles.filterBarInline}` : ''}`} role="group" aria-label={label}>
      {children}
    </div>
  );
}

/**
 * One bucket. `count` leads on a phone (where this bar is the only place the numbers live, the
 * counter tiles having been retired) and folds into the label above 640px, where the bar is a
 * filter row rather than a summary.
 *
 * `waiting` (Stage 6, A28 — the 1 October ruling): the count is something waiting on someone, so it
 * wears the rail's amber pill while it is above zero (the scorekeeper's Review — scores the organizer
 * has not finalized). The pill IS the count, never a second number beside it; at zero it is plain.
 */
export function DayOfFilterButton({
  label, count, active, onClick, waiting = false,
}: {
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
  waiting?: boolean;
}) {
  const pill = waiting && count != null && count > 0 ? ` ${kit.count} ${styles.barWaiting}` : '';
  return (
    <button type="button" className={styles.barBtn} aria-pressed={active} onClick={onClick}>
      {count != null && <span className={`${styles.barCount}${pill}`}>{count}</span>}
      <span>
        {label}
        {count != null && <span className={`${styles.barBtnInline}${pill}`}>{count}</span>}
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
 * fallback is the filter bar alone for those volunteers, with Sign out back in the header. (Stage 6
 * drew it unchanged, V4: nothing measured argued against it. Since A26 a one-job volunteer is real.)
 *
 * The Account sheet is the Sheet Frame's MENU (Stage 6 V4, A30): it acts and closes, so it sits ON TOP
 * of the tab bar and leaves the bar live — a second tap on Account, or Score or Gate, closes it (today's
 * dim covered the very tabs it was opened from). Its small-capitals label is its head; no ×. The frame
 * answers Escape and the phone's Back and hands focus back to the tab — this component answers neither.
 */
export default function DayOfTabBar({
  orgSlug, current, canScore, canGate, displayName, email, duties, orgName,
}: DayOfTabBarProps) {
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();

  const close = () => setOpen(false);

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
        <SheetFrame label="Account" role="dialog" aria-label="Account" onClose={close} opener={triggerRef}>
          <div className={styles.account}>
            {/* Identity first. At a gate the phone is often borrowed or shared, and "who am I
                signed in as, and what am I allowed to do?" is the question that matters most. */}
            <div className={styles.who}>
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
              className={styles.menuRow}
              onClick={() => {
                close();
                window.dispatchEvent(new CustomEvent('flhq:show-install'));
              }}
            >
              <Download size={19} aria-hidden />
              Install this app
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
              className={styles.menuRow}
              onClick={handleSignOut}
              disabled={signingOut}
            >
              <LogOut size={19} aria-hidden />
              {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </SheetFrame>
      )}
    </>
  );
}
