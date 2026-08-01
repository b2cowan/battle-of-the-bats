'use client';
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { CoachingAssignment, ClosedCoachingAssignment } from './db';
import type { CoachSeasonOption } from './types';
import { resolveCoachSeasonPage as resolveCoachSeasonPageImpl } from './coach-season-view';

/** The two account-scoped coach onboarding preferences (Quiet Mode Phase C2). */
export interface CoachOnboardingPrefsState {
  /** Coach finished or skipped the portal tour ⇒ never offer it again. */
  tourDismissed: boolean;
  /** Coach turned off season-setup guidance. */
  hintsOff: boolean;
}

interface CoachesContextType {
  assignments: CoachingAssignment[];
  /** Teams whose ONLY season(s) are closed — read-only Season's End access (Batch 3, P0 #1).
   *  One entry per team (its newest closed season). Never mixed into `assignments`. */
  closedAssignments: ClosedCoachingAssignment[];
  /** EVERY season this coach holds an assignment on, across their teams (Chunk F) — the season
   *  switcher's list. Distinct from `closedAssignments`, which answers "which of my TEAMS has
   *  finished" and is deduped to one row per team. */
  seasons: CoachSeasonOption[];
  loading: boolean;
  refresh: () => Promise<void>;
  /**
   * Account-scoped onboarding preferences, SSR-seeded by the coaches layout. They live here rather
   * than in the team Overview because they are facts about the COACH, not the team: fetching them
   * per page would repeat an identical request on every team switch for data that cannot differ.
   */
  onboardingPrefs: CoachOnboardingPrefsState;
  /** Optimistically apply + persist a preference change. */
  setOnboardingPrefs: (patch: Partial<CoachOnboardingPrefsState>) => void;
}

const DEFAULT_PREFS: CoachOnboardingPrefsState = { tourDismissed: false, hintsOff: false };

const CoachesContext = createContext<CoachesContextType>({
  assignments: [],
  closedAssignments: [],
  seasons: [],
  loading: true,
  refresh: async () => {},
  onboardingPrefs: DEFAULT_PREFS,
  setOnboardingPrefs: () => {},
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
  initialSeasons,
  initialOnboardingPrefs,
}: {
  children: ReactNode;
  orgSlug: string;
  /** SSR seed from the coaches layout (mirrors OrgProvider's initialOrg) — the layout has
   *  already run both lookups for its access gate; without the seed the provider re-fetches
   *  the identical data on every mount. Provide BOTH or NEITHER. */
  initialAssignments?: CoachingAssignment[];
  initialClosedAssignments?: ClosedCoachingAssignment[];
  /** SSR seed for the season switcher (Chunk F) — derived in the layout from the same two
   *  lookups, so it costs no extra query. */
  initialSeasons?: CoachSeasonOption[];
  /** SSR seed for the account-scoped onboarding preferences — read in the layout's existing
   *  parallel lookup, so no client round-trip and no flash of the wrong state. Absent = the
   *  show-guidance defaults, which is the correct fail-open direction. */
  initialOnboardingPrefs?: CoachOnboardingPrefsState;
}) {
  const seeded = initialAssignments !== undefined && initialClosedAssignments !== undefined;
  const [assignments, setAssignments] = useState<CoachingAssignment[]>(initialAssignments ?? []);
  const [closedAssignments, setClosedAssignments] = useState<ClosedCoachingAssignment[]>(initialClosedAssignments ?? []);
  const [seasons, setSeasons] = useState<CoachSeasonOption[]>(initialSeasons ?? []);
  const [loading, setLoading] = useState(!seeded);
  const [onboardingPrefs, setPrefsState] = useState<CoachOnboardingPrefsState>(initialOnboardingPrefs ?? DEFAULT_PREFS);

  /** Optimistic: the UI has already moved. A failed write only means the choice doesn't follow the
   *  coach to their next device — not worth an error banner over a UI preference. */
  const setOnboardingPrefs = useCallback((patch: Partial<CoachOnboardingPrefsState>) => {
    setPrefsState(prev => ({ ...prev, ...patch }));
    void fetch('/api/coaches/onboarding-preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }).catch(() => { /* preference-only; local state already reflects the choice */ });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/assignments`);
      if (res.ok) {
        const data = await res.json();
        setAssignments(data.assignments ?? []);
        setClosedAssignments(data.closedAssignments ?? []);
        setSeasons(data.seasons ?? []);
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
    <CoachesContext.Provider value={{ assignments, closedAssignments, seasons, loading, refresh: load, onboardingPrefs, setOnboardingPrefs }}>
      {children}
    </CoachesContext.Provider>
  );
}

export function useCoaches() {
  return useContext(CoachesContext);
}

/**
 * Which season is on screen, and is it a record (Chunk F). The logic itself lives in
 * `lib/coach-season-view.ts` — pure, so it can be unit-tested without React — and is re-exported
 * here because every consumer reaches it through this context anyway.
 *
 * `yearParam` is passed IN by the caller's own `useSearchParams()` rather than read here, so a
 * page that isn't inside a Suspense boundary doesn't get forced into one by this hook.
 */
export {
  resolveSeasonView,
  resolveCoachSeasonPage,
  type SeasonView,
  type CoachSeasonPage,
} from './coach-season-view';

/** The everyday page-side entry point: `const page = useCoachSeasonPage(orgSlug, teamId, year)`. */
export function useCoachSeasonPage(orgSlug: string, teamId: string, yearParam: string | null) {
  const { assignments, closedAssignments, seasons } = useCoaches();
  return resolveCoachSeasonPageImpl({ assignments, closedAssignments, seasons }, orgSlug, teamId, yearParam);
}
