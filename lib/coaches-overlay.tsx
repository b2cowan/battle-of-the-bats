'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

/**
 * Shared "is any modal/sheet open" signal for the premium Coaches Portal (Coach Portal Batch 1,
 * Phase 1, D3/D1 2026-07-28) — one hook carries BOTH behaviors that share the same lifecycle:
 *   • nav-hide: CoachesBottomNav reads useAnyOverlayOpen() and goes visibility:hidden while a
 *     sheet/modal is above it, so a mis-tap can never land on a nav tab underneath a full-height
 *     sheet.
 *   • body-scroll-lock: this provider locks document.body.style.overflow while the shared
 *     COUNTER is above zero, so only the topmost overlay scrolls, not the page behind it.
 * A counter (not a boolean) because overlays can stack (e.g. a confirm dialog opened from inside
 * a sheet) — each open modal registers one unit via useOverlayOpen(true) and unregisters on
 * close/unmount; the bar only reappears / scroll only unlocks once the LAST one closes.
 *
 * schedule/page.tsx's own pre-existing anyModalOpen body-lock effect (~lines 712-720) has been
 * folded into this hook (Phase 1.2-1.6 sweep) rather than kept as a bespoke local lock — one
 * fewer place body-scroll behavior can drift. This effect only ever asserts 'hidden' while
 * count > 0 and clears to '' at zero, so it composes safely with any other overlay registering
 * through the same provider.
 *
 * Split into two contexts (/simplify efficiency pass, 2026-07-28) so registration-only consumers
 * (useOverlayOpen, ~19 call sites) don't re-render on every count change: a stable ACTIONS
 * context (increment/decrement, memoized — the callbacks themselves are already stable refs)
 * feeds the registration hook, and a separate volatile COUNT context feeds only the read hook
 * (useAnyOverlayOpen, currently just CoachesBottomNav). Exported API names/signatures are
 * unchanged.
 */

interface CoachesOverlayActions {
  increment: () => void;
  decrement: () => void;
}

const CoachesOverlayActionsContext = createContext<CoachesOverlayActions | null>(null);
const CoachesOverlayCountContext = createContext<number | null>(null);

export function CoachesOverlayProvider({ children }: { children: ReactNode }) {
  const [count, setCount] = useState(0);
  const increment = useCallback(() => setCount(c => c + 1), []);
  const decrement = useCallback(() => setCount(c => Math.max(0, c - 1)), []);
  const actions = useMemo(() => ({ increment, decrement }), [increment, decrement]);

  useEffect(() => {
    if (count > 0) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    // Restore on unmount: the sidebar's "Back to admin"/Logout links stay clickable under an
    // open sheet, so this provider can unmount mid-open via a client-side navigation out of the
    // portal — without this cleanup the lock would outlive the portal and freeze scrolling
    // app-wide until a hard reload (/review finding, 2026-07-28).
    return () => {
      document.body.style.overflow = '';
    };
  }, [count]);

  return (
    <CoachesOverlayActionsContext.Provider value={actions}>
      <CoachesOverlayCountContext.Provider value={count}>
        {children}
      </CoachesOverlayCountContext.Provider>
    </CoachesOverlayActionsContext.Provider>
  );
}

/**
 * Call from any modal/sheet-owning page or component with its own `open` boolean. While `open`
 * is true it registers one unit in the shared overlay counter; it unregisters automatically on
 * close (open → false) or unmount, whichever comes first — so a component that unmounts WHILE
 * open (e.g. its parent stops rendering it) still cleans up correctly.
 *
 * FAILS FAST if no CoachesOverlayProvider is present — see useOverlayOpenIfAvailable below for
 * the narrowly-scoped tolerant variant used by components that also render outside the portal.
 */
export function useOverlayOpen(open: boolean): void {
  const ctx = useContext(CoachesOverlayActionsContext);
  if (!ctx) {
    throw new Error('useOverlayOpen must be used within a CoachesOverlayProvider (app/[orgSlug]/coaches/layout.tsx)');
  }
  const { increment, decrement } = ctx;
  useEffect(() => {
    if (!open) return;
    increment();
    return () => decrement();
  }, [open, increment, decrement]);
}

/**
 * Tolerant variant of useOverlayOpen (no-op, does not throw) for the rare shared modal component
 * that renders both inside the coaches portal (where registration matters) AND from other trees
 * like app/[orgSlug]/admin/rep-teams/shared-library (no CoachesOverlayProvider there, and
 * nav-hiding is meaningless outside the coaches portal) — a hard throw there would crash an
 * unrelated admin page. Reads context directly rather than via useOverlayOpen for this reason.
 */
export function useOverlayOpenIfAvailable(open: boolean): void {
  const ctx = useContext(CoachesOverlayActionsContext);
  const increment = ctx?.increment;
  const decrement = ctx?.decrement;
  useEffect(() => {
    if (!open || !increment || !decrement) return;
    increment();
    return () => decrement();
  }, [open, increment, decrement]);
}

/** Read-only: true while ANY registered overlay is open anywhere in the portal. Drives
 *  CoachesBottomNav's visibility:hidden while a sheet/modal covers its z-layer. */
export function useAnyOverlayOpen(): boolean {
  const count = useContext(CoachesOverlayCountContext);
  if (count === null) {
    throw new Error('useAnyOverlayOpen must be used within a CoachesOverlayProvider (app/[orgSlug]/coaches/layout.tsx)');
  }
  return count > 0;
}
