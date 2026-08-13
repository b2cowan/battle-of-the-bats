'use client';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

/**
 * "Something changed in Money — re-read yourself."
 *
 * The Money hub's `Import ▾` lives in the PAGE HEADER, above the tabs, and can bring in budget
 * lines while the coach is looking at Fundraisers. The tab panels deliberately stay mounted once
 * visited (`display:none` while inactive) so a half-filled form survives a tab switch — which
 * means the Budget panel can be sitting in memory holding a plan that is now out of date, and
 * switching to it would show the pre-import budget with no hint that anything happened.
 *
 * ⚠ THE FIX IS A SIGNAL, NOT A REMOUNT. Remounting the panels would throw away exactly the
 * in-progress form the mounted-panel design exists to protect. A panel that is on screen re-reads
 * itself; a panel that was never opened simply fetches fresh when it first opens.
 *
 * Outside the hub (the standalone `/accounting/{tab}` routes) there is no provider and the
 * revision is a constant 0, so a panel's load effect behaves exactly as it always did.
 */
const MoneyRefreshContext = createContext<{ revision: number; bump: () => void }>({
  revision: 0,
  bump: () => {},
});

export function MoneyRefreshProvider({ children }: { children: ReactNode }) {
  const [revision, setRevision] = useState(0);
  const bump = useCallback(() => setRevision(r => r + 1), []);
  const value = useMemo(() => ({ revision, bump }), [revision, bump]);
  return <MoneyRefreshContext.Provider value={value}>{children}</MoneyRefreshContext.Provider>;
}

/** Add to a panel's load-effect deps: a bump re-runs the fetch without touching component state. */
export function useMoneyRevision(): number {
  return useContext(MoneyRefreshContext).revision;
}

/** Called by the hub's Import menu once rows have actually landed. */
export function useBumpMoneyRevision(): () => void {
  return useContext(MoneyRefreshContext).bump;
}
