'use client';

import { usePathname } from 'next/navigation';
import CoachTopStrip from './CoachTopStrip';
import CoachesSidebar from './CoachesSidebar';
import CoachesBottomNav from './CoachesBottomNav';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';

/**
 * The coaches shell, with ONE focused-surface decision in it.
 *
 * ── WHY THIS EXISTS ───────────────────────────────────────────────────────────
 * The help guide is a READING surface, not a work screen: it opens in its own tab
 * from the "?" drawer, and the portal's sidebar / top strip / bottom nav are pure
 * furniture there — three ways to leave a document nobody navigated into. The
 * admin side has drawn this line since Stage C (`AdminChrome`'s `isFocused`,
 * covering help + onboarding + tournament preview); the coaches portal simply
 * never got the same treatment, so its guide wore the full app chrome. This is
 * that parity, deliberately using the same shape and the same vocabulary.
 *
 * ⚠ The "new tab" above is a real invariant, not an assumption: both entry points
 * carry target="_blank" (HelpDrawer's "Open the full guide" and CoachesSidebar's
 * Help item). If either ever navigates in place, this surface becomes reachable
 * with no way out and needs one — that is the condition to re-check, not the tab.
 *
 * ── AND THE THEME ─────────────────────────────────────────────────────────────
 * Focused help also pins the DARK palette (`data-help-surface`, see globals.css)
 * regardless of the account's warm/dark preference. That is not a new opinion: the
 * "?" drawer is portalled to <body>, so it has always escaped the warm marker and
 * always rendered dark — including inside a warm portal. Help therefore already
 * had one fixed look in the panel and a theme-following look in the guide, which
 * is the mismatch this removes. Owner ruling 2026-08-14: help is one dark reading
 * surface everywhere.
 */
export default function CoachesChrome({
  orgSlug,
  children,
}: {
  orgSlug: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? '';
  const isHelp = pathname.includes('/coaches/help');

  if (isHelp) {
    // No chrome at all — not even a "back to your portal" bar. BOTH doors into the
    // guide force a new tab (the drawer's "Open the full guide" and the sidebar's
    // Help entry both carry target="_blank"), so the portal is still sitting in the
    // tab the reader came from and a way back is furniture for a journey nobody took.
    // Owner ruling 2026-08-14, after seeing the bar in place.
    return (
      <div className={styles.coachesShellFocused} data-help-surface>
        <main className={styles.coachesMainFocused}>{children}</main>
      </div>
    );
  }

  return (
    <>
      <div className={styles.coachesShell}>
        {/* Stage H.1 (Nav Unification, D2 ratified 2026-07-31): the operator frame strip —
            desktop-only fixed top bar (wordmark → Home, account · Workspaces) in the portal's
            own warm/dark skin. NO chat door and no bell: chat is a section of the work for an
            operator, and the coach sidebar keeps the bell. Mounted INSIDE the shell so it reads
            the shell's --coach-topstrip-h (custom properties don't reach siblings);
            position:fixed keeps it out of the flex flow. */}
        <CoachTopStrip />
        <CoachesSidebar orgSlug={orgSlug} />
        {/* The pinned team MASTHEAD (D2 Option A) is mounted by the TEAM layout, not here —
            that is the first place `teamId` exists server-side. It still renders as the first
            child of this <main>: that layout returns a fragment, which the masthead's sticky
            pin + padding-cancelling negative margins depend on. */}
        <main className={styles.coachesMain}>{children}</main>
      </div>
      <CoachesBottomNav />
    </>
  );
}
