'use client';

/**
 * Admin nav worklist counts (B5).
 *
 * Fetches the lightweight "needs-you" counts for the current tournament and
 * shares them shell-wide so the sidebar + bottom-nav can badge their items
 * (Teams = pending registrations, Results = games to finalize). Refreshes on
 * tournament switch, on a timer, and on window focus. Counts are non-critical —
 * failures are swallowed so the nav never breaks.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { useOrg } from '@/lib/org-context';
import { useTournament } from '@/lib/tournament-context';

/** Counts keyed by tournament nav-item key (e.g. 'registrations', 'results'). */
export type WorklistCounts = Record<string, number>;

const WorklistContext = createContext<WorklistCounts>({});

const REFRESH_MS = 90_000;

export function AdminWorklistProvider({ children }: { children: ReactNode }) {
  const { currentOrg } = useOrg();
  const { currentTournament } = useTournament();
  const [counts, setCounts] = useState<WorklistCounts>({});

  const tournamentId = currentTournament?.id;
  const orgSlug = currentOrg?.slug;

  const fetchCounts = useCallback(async () => {
    if (!tournamentId || !orgSlug) {
      setCounts({});
      return;
    }
    try {
      const res = await fetch(
        `/api/admin/tournament-worklist?tournamentId=${encodeURIComponent(tournamentId)}&orgSlug=${encodeURIComponent(orgSlug)}`,
      );
      if (!res.ok) return;
      const data = await res.json();
      setCounts({
        registrations: Number(data.registrations) || 0,
        results: Number(data.results) || 0,
      });
    } catch {
      /* nav counts are non-critical — ignore */
    }
  }, [tournamentId, orgSlug]);

  useEffect(() => {
    fetchCounts();
    const interval = window.setInterval(fetchCounts, REFRESH_MS);
    const onFocus = () => fetchCounts();
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [fetchCounts]);

  return <WorklistContext.Provider value={counts}>{children}</WorklistContext.Provider>;
}

export function useAdminWorklist(): WorklistCounts {
  return useContext(WorklistContext);
}
