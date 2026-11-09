'use client';
/**
 * WHERE YOU ARE, ONCE — the one place model the admin's two headers draw (Admin header bar round 4, owner 2026-11-08; plan
 * `docs/projects/active/ADMIN_HEADER_BAR_PLAN.md`, "one place, two renderings").
 *
 * The phone bar (`AdminEventHeader`, 900px and below) and the desktop strip (`AdminTopStrip`'s place, above 900px) both
 * read this hook, so they can never name two different places. Which one shows is CSS at the sidebar's breakpoint, never a
 * width read in script: a script switch would paint the wrong one on the server's first paint and swap (the flash Phase 2
 * removed). The copy that is not shown is `display: none`, so the page keeps ONE `<h1>` in the accessibility tree.
 *
 * The place is known from the ADDRESS first (`useClubPlaceAt`, which every frame asks too) and then from the frame's
 * hand-off for THIS place (`key`), so neither header ever paints the club's name and swaps (`AdminBarPlace.tsx`).
 */
import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useOrg } from '@/lib/org-context';
import { useTournament } from '@/lib/tournament-context';
import { resolveEventPhase, PHASE_LABEL } from '@/lib/tournament-phase';
import { formatEventDateRange } from '@/lib/timezone';
import { isTournamentOnlyWorkspace } from '@/lib/module-entitlements';
import { isTournamentOrgScreen } from '@/lib/admin-kit-nav';
import { kit as coachKit } from '@/components/coaches/kit';
import { useClubPlaceAt, useHandedBarPlace, type AdminBarPlace } from './AdminBarPlace';
import styles from './kit/AdminKitEventHeader.module.css';

export type AdminPlaceView = {
  /** The name: the place's, the tournament's, or the organization's. */
  title: string;
  /** The tournament's name is the door to its dashboard. */
  titleHref: string | null;
  /** The name is the page's `<h1>` (the club's Overview, every club place and Phase 3's named screens); elsewhere the paper
   *  keeps its own (`TabPageHeader` asks the same question, `useNamedInBar`). */
  isPageTitle: boolean;
  onOverview: boolean;
  /** The club place on screen, hand-off included, or null. */
  place: AdminBarPlace | null;
  /** The place's tab row, when it has one (a row of one tab is no row, `HubTabBar`'s own rule). */
  tabbed: AdminBarPlace | null;
  /** A tournament's dates. */
  dates: string | null;
  /** A tournament's status chip, drawn once here for both headers. */
  phaseChip: ReactNode;
};

export function useAdminPlace(suspended: boolean): AdminPlaceView {
  const pathname = usePathname();
  const { currentOrg } = useOrg();
  const { currentTournament } = useTournament();
  const addressPlace = useClubPlaceAt();
  const handed = useHandedBarPlace();

  // ⚖ A10 + round 5 Q6: the org-wide tournament screens (the list, Settings & access, Members, Plan & billing, Payouts, PDF
  // settings) name the ORGANIZATION, never the event the tournament context auto-picked; the sidebar's picker keeps the
  // event on screen. Event pages, Event settings and the event's Notifications included, name the event.
  const onTournament =
    !suspended &&
    pathname.includes('/admin/tournaments') &&
    !pathname.includes('/admin/tournaments/preview') &&
    !(currentOrg && isTournamentOrgScreen(pathname.replace(/\/+$/, ''), `/${currentOrg.slug}/admin`)) &&
    !!currentTournament?.slug;

  // The club's Overview (A3): its paper heading is gone, so the name is the page's one `<h1>`. A tournament-only workspace
  // has no Overview (`AdminHub` sends it to its tournaments), and a cancelled account's one page draws its own heading.
  const onOverview =
    !suspended &&
    !!currentOrg &&
    !isTournamentOnlyWorkspace(currentOrg) &&
    pathname.replace(/\/+$/, '') === `/${currentOrg.slug}/admin`;

  // A club place (Phase 2): known from the address first, then the frame's hand-off for THIS place. The lit tab is always
  // the address's, so a hand-off a beat behind a tab change never lights the old tab.
  const routePlace = !suspended && !onTournament ? addressPlace : null;
  const place: AdminBarPlace | null = routePlace
    ? (handed?.key === routePlace.key ? { ...handed, activeId: routePlace.activeId } : routePlace)
    : null;

  let title: string;
  let dates: string | null = null;
  let titleHref: string | null = null;
  let phaseChip: ReactNode = null;

  if (onTournament && currentTournament) {
    title = currentTournament.name;
    // ONE chip from ONE rule — the board's (G1): the dates, OR the first game having started, until the event is marked
    // complete. Past the last day it stays game day even with no game ever started — the organizer marking it complete is
    // the only thing that ends it (the coach site reads the same status).
    const phase = resolveEventPhase({
      status: currentTournament.status,
      startDate: currentTournament.startDate,
      endDate: currentTournament.endDate,
      firstGameStarted: Boolean(currentTournament.firstGameStarted),
    });
    const phaseLabel = PHASE_LABEL[phase as keyof typeof PHASE_LABEL] ?? null;
    // The phase chip keeps its shipped look: red for a live event, olive while open, quiet otherwise.
    const tone = phase === 'gameday' ? coachKit.chipDanger : phase === 'open' ? coachKit.chipGood : styles.chipNeutral;
    phaseChip = phaseLabel ? (
      <span className={`${coachKit.chip} ${styles.chip} ${tone}`} data-phase={phase ?? undefined}>
        {phase === 'gameday' && <span className={styles.dot} aria-hidden />}
        {phaseLabel}
      </span>
    ) : null;
    dates = formatEventDateRange(currentTournament.startDate, currentTournament.endDate, true);
    titleHref = `/${currentOrg?.slug ?? ''}/admin/tournaments/dashboard`;
  } else if (place) {
    title = place.title;
  } else {
    // Org-level screens: the org IS the identity, so it's the title, with no small line.
    title = currentOrg?.name ?? 'Admin';
  }

  return {
    title,
    titleHref,
    isPageTitle: onOverview || !!place,
    onOverview,
    place,
    tabbed: place && place.tabs.length > 1 ? place : null,
    dates,
    phaseChip,
  };
}
