'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import CoachTopStrip from './CoachTopStrip';
import CoachesSidebar from './CoachesSidebar';
import CoachesBottomNav from './CoachesBottomNav';
import { CoachDeskTitleProvider } from './CoachDeskTitle';
import { CoachPageHelpProvider, CoachStripHelpProvider } from './CoachPageHelpSlot';
import { HubBandContext } from '@/components/shared/HubBandSlot';
import { coachBandAt } from '@/lib/coach-team-nav';
import { coachTeamIdIn } from '@/lib/coach-nav-visibility';
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
 * carry target="_blank" (HelpDrawer's "Open the full guide" and the account
 * menu's Help row). If either ever navigates in place, this surface becomes reachable
 * with no way out and needs one — that is the condition to re-check, not the tab.
 *
 * ── AND THE THEME ─────────────────────────────────────────────────────────────
 * Focused help follows the account's Warm / Dark setting like every other screen
 * (Admin Design Continuity ruling R4, released 2026-09-28). It used to pin the dark
 * palette (`data-help-surface`, owner ruling 2026-08-14) to agree with the "?"
 * drawer, which portalled outside the warm marker and so always rendered dark; the
 * drawer now carries the marker on its own portal root (`HelpDrawerProvider warm`),
 * so both halves of help agree on the reader's theme instead.
 */
export default function CoachesChrome({
  orgSlug,
  children,
  billingOnlyHref,
  stripFacts = null,
}: {
  orgSlug: string;
  children: React.ReactNode;
  /** A zero-team owner may render only this workspace page, even while Next retains this layout. */
  billingOnlyHref?: string | null;
  /** The team's facts for the strip's right end (the coaches layout's `@stripFacts` slot; navigation Phase 4). */
  stripFacts?: React.ReactNode;
}) {
  const pathname = usePathname() ?? '';
  const needsWallRequest = !!billingOnlyHref && pathname !== billingOnlyHref;
  useEffect(() => {
    if (needsWallRequest) window.location.replace(`${pathname}${window.location.search}${window.location.hash}`);
  }, [needsWallRequest, pathname]);
  const isHelp = pathname.includes('/coaches/help');

  // ⚖ THE BAND under the strip (navigation Phase 4b, R1, owner 2026-11-11). A room that has tabs holds the band's 45px open by
  // ADDRESS (`coachBandAt` — so the server's paint already has it and the tabs arrive into room already made); its tab bar
  // portals itself into the slot (`HubTabBar band`, `HubBandSlot`) above 900. On a phone this slot is an empty, unstyled div and the
  // row docks into the phone's own band instead, drawn under the team bar (`bandSlotPhone`, `CoachTeamHeader`; owner 2026-11-12:
  // flush, just like the computer), pinned by the same `--coach-band-h` (navigation Phase 5, F4). A bar with nothing to show
  // (a row of one tab) gives the band back (`reportEmpty`) so a coach is never left an empty strip.
  const teamId = coachTeamIdIn(pathname);
  const bandRoom = !!teamId && coachBandAt(pathname, `/${orgSlug}/coaches/teams/${teamId}`);
  const [bandEl, setBandEl] = useState<HTMLElement | null>(null);
  const [bandEmpty, setBandEmpty] = useState(false); // the bar's own cleanup clears it when it leaves
  const bandOn = bandRoom && !bandEmpty;
  const [phoneEl, setPhoneEl] = useState<HTMLElement | null>(null); // the phone's band, drawn under the team bar (CoachTeamHeader)
  // The phone's slot is offered only while this address has a band (the slot itself is display:none otherwise) — a bar docked into
  // a hidden slot would vanish, so without a band it renders in place, exactly as the computer's does.
  const band = useMemo(() => ({ el: bandEl, reportEmpty: setBandEmpty, phoneEl: bandOn ? phoneEl : null, setPhoneEl }), [bandEl, phoneEl, bandOn]);
  // Keyboard focus and in-page jumps must never land UNDER the strip and the band: the document is the scroller, so the
  // padding is set on it, from the band's real pinned bottom (a custom property on the shell would not reach the root).
  useEffect(() => {
    if (!bandEl) return;
    const root = document.documentElement;
    const prev = root.style.scrollPaddingTop;
    const set = () => {
      const h = bandEl.offsetHeight;
      root.style.scrollPaddingTop = h ? `${Math.round((parseFloat(getComputedStyle(bandEl).top) || 0) + h + 8)}px` : prev;
    };
    // Fires once on observe and again only when the band's size changes (the 0 ↔ 45 flip at 900) — no window resize listener.
    const ro = new ResizeObserver(set);
    ro.observe(bandEl);
    return () => { ro.disconnect(); root.style.scrollPaddingTop = prev; };
  }, [bandEl]);

  // Layouts persist on client navigation. Do not mount another page beneath a zero-team billing
  // exception; ask the server for that destination, where the original walls still run first.
  if (needsWallRequest) return null;

  if (isHelp) {
    // No chrome at all — not even a "back to your portal" bar. BOTH doors into the
    // guide force a new tab (the drawer's "Open the full guide" and the account
    // menu's Help row both carry target="_blank"), so the portal is still sitting in the
    // tab the reader came from and a way back is furniture for a journey nobody took.
    // Owner ruling 2026-08-14, after seeing the bar in place.
    return (
      <div className={styles.coachesShellFocused}>
        <main className={styles.coachesMainFocused}>{children}</main>
      </div>
    );
  }

  return (
    // ⚖ The strip names the page from ONE answer the page headers read too (navigation Phase 4, `CoachDeskTitle`).
    <CoachDeskTitleProvider orgSlug={orgSlug}>
      <HubBandContext.Provider value={band}>
      <CoachStripHelpProvider>
      <div className={styles.coachesShell} data-coach-band={bandOn ? '' : undefined}>
        {/* Stage H.1 (Nav Unification, D2 ratified 2026-07-31): the operator frame strip —
            desktop-only fixed top bar (wordmark → Home, account · Workspaces) in the portal's
            own warm/dark skin. NO chat door and no bell: chat is a section of the work for an
            operator, and the coach sidebar keeps the bell. Mounted INSIDE the shell so it reads
            the shell's --coach-topstrip-h (custom properties don't reach siblings);
            position:fixed keeps it out of the flex flow. */}
        <CoachTopStrip facts={stripFacts} />
        <CoachesSidebar orgSlug={orgSlug} />
        {/* The pinned team MASTHEAD (D2 Option A) is mounted by the TEAM layout, not here —
            that is the first place `teamId` exists server-side. It still renders as the first
            child of this <main>: that layout returns a fragment, which the masthead's sticky
            pin + padding-cancelling negative margins depend on. */}
        <main className={styles.coachesMain}>
          {bandOn && <div ref={setBandEl} className={styles.bandSlot} />}
          {/* ⚖ Every paid page's "?" is the strip's on a computer (navigation Phase 6b, T6·1, owner 2026-11-13): the off-team pages
              (notifications, Plan & billing, Join a club) publish to it too, keeping their own on a phone (no bar there). The team
              layout's own host, inside this one, hands a team's pages to the team bar as well. The free portal never mounts this. */}
          <CoachPageHelpProvider host="strip">{children}</CoachPageHelpProvider>
        </main>
      </div>
      <CoachesBottomNav />
      </CoachStripHelpProvider>
      </HubBandContext.Provider>
    </CoachDeskTitleProvider>
  );
}
