'use client';
import { createContext, useContext, useEffect } from 'react';

/**
 * ⚖ WHERE A TAB BAR DOCKS, WHEN A SHELL HAS A BAND FOR IT (Coaches Portal navigation Phase 4b, R1, owner 2026-11-11).
 * The coaches shell draws an empty 45px band under its strip on a room that has tabs and offers it here; `HubTabBar`
 * with `band` PORTALS its row into it on a computer — the page keeps owning its tabs, their state and their links, and
 * nothing is copied through state (the strip's `recordSlot` is the same pattern). A shell that offers nothing (the
 * club's, the free portal) leaves the context null and the bar renders in place, exactly as it always did.
 */
export interface HubBandSlot {
  /** The band's element — null until the shell has mounted it. */
  el: HTMLElement | null;
  /** The bar reports whether it has nothing to show (a row of one tab is not navigation): the shell then gives the band back. */
  reportEmpty: (empty: boolean) => void;
  /**
   * ⚖ THE PHONE'S BAND (owner, 2026-11-12: "these should always be flush, just like the desktop"). A phone's band is a second slot,
   * drawn by the team bar's own component directly UNDER the bar (the computer's `el` is the shell's, above the page, and is
   * display:none at 900 and below). Both are empty until a bar docks; the bar picks by width.
   */
  phoneEl: HTMLElement | null;
  /** The team bar's phone slot registers itself here. */
  setPhoneEl: (el: HTMLElement | null) => void;
}

export const HubBandContext = createContext<HubBandSlot | null>(null);

export function useHubBandSlot(): HubBandSlot | null {
  return useContext(HubBandContext);
}

/** A band bar with nothing to show gives the reserved band back; leaving puts the reservation back for the next bar. */
export function useBandEmptyReport(slot: HubBandSlot | null, active: boolean, empty: boolean): void {
  const report = slot?.reportEmpty;
  useEffect(() => {
    if (!active || !report) return;
    report(empty);
    return () => report(false);
  }, [active, report, empty]);
}
