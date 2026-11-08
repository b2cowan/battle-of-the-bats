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
 * the place from the ADDRESS first (`clubPlaceAt`, which the frame asks too) and shows the frame's own placeholder, and
 * it takes a hand-off only for the place the address is in (`key`), so a frame on its way out can never name the next
 * screen.
 *
 * Two contexts, so the frames — which only hand off — never re-render when the bar's copy changes.
 */
import { createContext, useContext, useLayoutEffect, useState, type ReactNode } from 'react';
import type { HubTab } from '@/components/shared/HubTabBar';
import type { ClubPlaceAt } from '@/lib/admin-kit-nav';

/** What the address says (`ClubPlaceAt`: key, title, way up, facts, tabs, lit tab, label) plus the live parts only a frame has. */
export type AdminBarPlace = Omit<ClubPlaceAt, 'tabs'> & {
  /** The place's status chip, last on the small line (a season's "Registration open"). */
  chip?: ReactNode;
  /** Beside the name: the control that switches it (a season's chevron). */
  switcher?: ReactNode;
  tabs: readonly HubTab<string>[];
};

const HandedPlace = createContext<AdminBarPlace | null>(null);
const HandPlace = createContext<((place: AdminBarPlace | null) => void) | null>(null);

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

/** A place frame's hand-off: on every render (the frame's live parts change with its data), withdrawn on unmount. */
export function useHandBarPlace(place: AdminBarPlace) {
  const hand = useContext(HandPlace);
  useLayoutEffect(() => { hand?.(place); });
  useLayoutEffect(() => () => hand?.(null), [hand]);
}
