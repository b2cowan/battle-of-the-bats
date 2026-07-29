'use client';
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { CoachingAssignment, ClosedCoachingAssignment } from './db';

interface CoachesContextType {
  assignments: CoachingAssignment[];
  /** Teams whose ONLY season(s) are closed — read-only Season's End access (Batch 3, P0 #1).
   *  One entry per team (its newest closed season). Never mixed into `assignments`. */
  closedAssignments: ClosedCoachingAssignment[];
  loading: boolean;
  refresh: () => Promise<void>;
}

const CoachesContext = createContext<CoachesContextType>({
  assignments: [],
  closedAssignments: [],
  loading: true,
  refresh: async () => {},
});

/**
 * ONE rule for "is this team in its closed-season (read-only) state for this coach":
 * the team has no active assignment but does have a closed one. Shared by the sidebar,
 * bottom nav, Overview redirect, Season's End and the results archive — the four-way
 * hand-copies of this predicate were exactly how a missed call site could quietly
 * reintroduce the season-end lockout.
 */
export function resolveClosedAssignment(
  assignments: CoachingAssignment[],
  closedAssignments: ClosedCoachingAssignment[],
  teamId: string | null | undefined,
): ClosedCoachingAssignment | null {
  if (!teamId) return null;
  if (assignments.some(a => a.teamId === teamId)) return null;
  return closedAssignments.find(a => a.teamId === teamId) ?? null;
}

export function CoachesProvider({
  children,
  orgSlug,
  initialAssignments,
  initialClosedAssignments,
}: {
  children: ReactNode;
  orgSlug: string;
  /** SSR seed from the coaches layout (mirrors OrgProvider's initialOrg) — the layout has
   *  already run both lookups for its access gate; without the seed the provider re-fetches
   *  the identical data on every mount. Provide BOTH or NEITHER. */
  initialAssignments?: CoachingAssignment[];
  initialClosedAssignments?: ClosedCoachingAssignment[];
}) {
  const seeded = initialAssignments !== undefined && initialClosedAssignments !== undefined;
  const [assignments, setAssignments] = useState<CoachingAssignment[]>(initialAssignments ?? []);
  const [closedAssignments, setClosedAssignments] = useState<ClosedCoachingAssignment[]>(initialClosedAssignments ?? []);
  const [loading, setLoading] = useState(!seeded);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/assignments`);
      if (res.ok) {
        const data = await res.json();
        setAssignments(data.assignments ?? []);
        setClosedAssignments(data.closedAssignments ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [orgSlug]);

  useEffect(() => {
    if (seeded) return; // trust the SSR seed; refresh() still re-fetches on demand
    load();
  }, [seeded, load]);

  return (
    <CoachesContext.Provider value={{ assignments, closedAssignments, loading, refresh: load }}>
      {children}
    </CoachesContext.Provider>
  );
}

export function useCoaches() {
  return useContext(CoachesContext);
}
