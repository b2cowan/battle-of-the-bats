'use client';

/**
 * Scorekeeper header flip ("The Flip" P3). The shell header lives in the server layout, but the
 * day's tournament list arrives with the page's own score fetch — so a tiny client context bridges
 * the two: the page publishes the publicly-visible tournaments on its board; the header pill
 * consumes them. Feeding the pill from the page's fetch (not a second query) means the pill and
 * the game list can never disagree about which events are in view.
 *
 * Resolution (owner call 2026-07-24): one event → direct to its public Schedule; two or more →
 * the shared chooser popover, one row per tournament; none loaded (yet) → the org's public site,
 * so the pill is never absent in the shell. The pill only reveals public doors — a volunteer's
 * scoring scope re-auths on the destination as always.
 */

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import FlipPill from '@/components/shared/FlipPill';
import { resolveScorekeeperFlip, type ScorekeeperFlipTournament } from '@/lib/flip-twins';

interface ScorekeeperFlipState {
  /** null = the page hasn't published yet (first fetch in flight) — the pill stays unmounted. */
  tournaments: ScorekeeperFlipTournament[] | null;
  setTournaments: (tournaments: ScorekeeperFlipTournament[]) => void;
}

const ScorekeeperFlipContext = createContext<ScorekeeperFlipState | null>(null);

// Stable no-op so a provider-less consumer keeps a constant identity (safe in effect deps).
const noop = () => {};

export function ScorekeeperFlipProvider({ children }: { children: ReactNode }) {
  const [tournaments, setTournaments] = useState<ScorekeeperFlipTournament[] | null>(null);
  const value = useMemo(() => ({ tournaments, setTournaments }), [tournaments]);
  return <ScorekeeperFlipContext.Provider value={value}>{children}</ScorekeeperFlipContext.Provider>;
}

/** Page side: publish the day's publicly-visible tournaments (no-op outside the provider).
 *  NB the published set is scope-filtered, NOT date-filtered (the score API's tournament list
 *  doesn't vary with the selected day) — if that ever changes, clear the list on load-start too,
 *  or a date switch would briefly show the previous day's chooser. */
export function useScorekeeperFlip(): ScorekeeperFlipState['setTournaments'] {
  return useContext(ScorekeeperFlipContext)?.setTournaments ?? noop;
}

/**
 * Header side: the scorekeeper pill. Mounts only once the page's first fetch has published, so it
 * appears already-correct (direct link vs chooser) instead of flashing the org fallback and then
 * morphing — the same resolve-then-mount rule the public pill follows. Error paths publish [] →
 * the org-site fallback still renders, so the door never stays missing on a working shell.
 */
export function ScorekeeperFlipPill({ orgSlug }: { orgSlug: string }) {
  const tournaments = useContext(ScorekeeperFlipContext)?.tournaments;
  if (!tournaments) return null;
  return <FlipPill resolution={resolveScorekeeperFlip({ orgSlug, tournaments })} />;
}
