'use client';
/**
 * THE HAND-OFF FROM A CLUB PLACE TO THE ADMIN'S PINNED BAR (Admin header bar Phase 2, option 4, owner 2026-11-07; plan
 * `docs/projects/active/ADMIN_HEADER_BAR_PLAN.md`).
 *
 * The bar (`AdminEventHeader`) is mounted ONCE by the shell, above every page; a place's frame (`PlaceFrame` with
 * `place`) is mounted by that place's layout, below it. The frame hands the bar its parts — the name, the way up, the
 * small line's words, the status chip, the switcher beside the name, the tab row — through this context, and the bar
 * draws them. One sticky element per screen, one height to publish (`--admin-header-h`).
 *
 * ⚠ NO FLASH OF THE WRONG NAME. The hand-off lands in a layout effect, so on a client navigation the bar is redrawn
 * before the browser paints; but the server's first paint has not heard from the frame at all. The bar therefore knows
 * the place from the ADDRESS first (`useClubPlaceAt`, which every frame asks too) and shows the frame's own placeholder,
 * and it takes a hand-off only for the place the address is in (`key`), so a frame on its way out can never name the
 * next screen.
 *
 * Two contexts, so the frames — which only hand off — never re-render when the bar's copy changes.
 */
import { createContext, useContext, useLayoutEffect, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { usePathname } from 'next/navigation';
import type { HubTab } from '@/components/shared/HubTabBar';
import { useOrg } from '@/lib/org-context';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { clubPlaceAt, type ClubPlaceAt, type PlaceTab } from '@/lib/admin-kit-nav';
import { useHouseLeagueAccess } from '@/components/admin/kit/useHouseLeagueSeasons';
import { useOrgTabs } from '@/components/admin/kit/useAdminKitNav';

/** What the address says (`ClubPlaceAt`: key, title, way up, facts, tabs, lit tab, label) plus the live parts only a frame has.
 *  Both of the admin's headers draw it (`useAdminPlace`): the phone bar and, above 900px, the top strip. */
export type AdminBarPlace = Omit<ClubPlaceAt, 'tabs'> & {
  /** The place's status chip, last on the small line (a season's "Registration open"). */
  chip?: ReactNode;
  /** Beside the name: the control that switches it (a season's chevron). */
  switcher?: ReactNode;
  tabs: readonly HubTab<string>[];
};

/**
 * THE ONE QUESTION, ASKED THE SAME WAY BY THE BAR AND EVERY FRAME: which place is this address in, which tab, and may this
 * person open it? Every gate is built here, once (`ClubPlaceAccess`), so a frame and the bar can never read two answers.
 */
export function useClubPlaceAt(): ClubPlaceAt | null {
  const pathname = usePathname();
  const { currentOrg, canOpen, clubHasPayouts, limitedToTeamGroups } = useOrg();
  const seasonAccess = useHouseLeagueAccess(null);
  const { tabs: orgTabs, isTeamWorkspace } = useOrgTabs();
  if (!currentOrg) return null;
  return clubPlaceAt(pathname, `/${currentOrg.slug}/admin`, {
    canUse: canOpen,
    seasonAccess,
    // A one-team workspace keeps its staff page as it was (13i Ask 9): Organization is no place there.
    orgTabs: isTeamWorkspace ? null : orgTabs,
    runsRepTeams: hasModuleEntitlement(currentOrg, 'module_rep_teams'),
    hasPayouts: clubHasPayouts,
    // The Families layout's own gate (`canOpenFamilies`): the module AND never a member limited to some team groups.
    opensFamilies: canOpen('module_families') && !limitedToTeamGroups,
  });
}

/** A place's tabs with a mark (a waiting count) on the ones that carry one; a tab with no mark is passed through. */
export function markTabs(tabs: readonly PlaceTab[], markFor: (id: string) => ReactNode): HubTab<string>[] {
  return tabs.map(t => {
    const mark = markFor(t.id);
    return mark ? { ...t, mark } : t;
  });
}

const HandedPlace = createContext<AdminBarPlace | null>(null);
const HandPlace = createContext<Dispatch<SetStateAction<AdminBarPlace | null>> | null>(null);

export function AdminBarPlaceProvider({ children }: { children: ReactNode }) {
  const [place, setPlace] = useState<AdminBarPlace | null>(null);
  return (
    <HandPlace.Provider value={setPlace}>
      <HandedPlace.Provider value={place}>{children}</HandedPlace.Provider>
    </HandPlace.Provider>
  );
}

/** The bar's read: what the place on screen handed it, if anything. */
export function useHandedBarPlace(): AdminBarPlace | null {
  return useContext(HandedPlace);
}

/** A place frame's hand-off: on every render (the frame's live parts change with its data), withdrawn on unmount — and
 *  only if the bar still holds THIS frame's place, so a frame leaving in a later commit can never wipe its successor's. */
export function useHandBarPlace(place: AdminBarPlace) {
  const hand = useContext(HandPlace);
  const mine = useRef(place.key);
  useLayoutEffect(() => { mine.current = place.key; hand?.(place); });
  useLayoutEffect(() => () => hand?.(held => (held?.key === mine.current ? null : held)), [hand]);
}
