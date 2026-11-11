'use client';
/**
 * ⚖ THE STRIP NAMES THE PAGE, DECIDED ONCE (navigation Phase 4, E6, C4, C8; the tournament's `DeskTitleProvider`). On a
 * team's pages, on a computer, the strip carries the page's name — the sidebar's lit row, in the sidebar's words — or, one
 * level down, the way back; the page header reads the same answer to drop its paper title (or, one level down, its own
 * arrow). One rule (`coachDeskTitleAt`, lib/coach-team-nav.ts) over the rows the sidebar draws (`coachNavGroupsFor`), so the
 * strip and the lit row cannot disagree.
 *
 * Every input is known on the server (the address, its search, the coach's team list), so the server's first paint is
 * the last. Which header shows is CSS at 900/901 — the phone keeps its team bar and its paper titles (Phase 5).
 */
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useCoaches, resolveLiveSeason, resolveClosedSeason } from '@/lib/coaches-context';
import { coachDeskTitleAt, coachNavGroupsFor, type CoachDeskTitle } from '@/lib/coach-team-nav';
import { mastheadSeasonLabel } from '@/lib/coach-season-label';
import { coachTeamIdIn } from '@/lib/coach-nav-visibility';

type DeskTitle = {
  /** The team in the address — the strip splits on a team's pages only (never a wall, never the free portal). */
  teamId: string | null;
  title: CoachDeskTitle;
};

const Ctx = createContext<DeskTitle>({ teamId: null, title: null });

export function CoachDeskTitleProvider({ orgSlug, children }: { orgSlug: string; children: ReactNode }) {
  const pathname = usePathname() ?? '';
  const params = useSearchParams();
  const { assignments, closedAssignments } = useCoaches();
  const teamId = coachTeamIdIn(pathname);
  // Only the three words the way back reads (`coachDrillBack`): a tab or an event in the address re-renders nothing here.
  const ret = params?.get('return') ?? null;
  const from = params?.get('from') ?? null;
  const year = params?.get('year') ?? null;
  const value = useMemo<DeskTitle>(() => {
    if (!teamId) return { teamId: null, title: null };
    const live = resolveLiveSeason(assignments, teamId);
    const closed = resolveClosedSeason(assignments, closedAssignments, teamId);
    const finished = !live && !!closed;
    const rows = coachNavGroupsFor((live ?? closed)?.capabilities, finished).flatMap(g => g.items);
    const seasonName = finished ? mastheadSeasonLabel(closed?.programYearName, closed?.teamName, closed?.programYearYear ?? null) : null;
    const words: Record<string, string | null> = { return: ret, from, year };
    const title = coachDeskTitleAt(pathname, { get: k => words[k] ?? null }, `/${orgSlug}/coaches/teams/${teamId}`, rows, seasonName);
    return { teamId, title };
  }, [teamId, assignments, closedAssignments, pathname, ret, from, year, orgSlug]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCoachDeskTitle(): DeskTitle {
  return useContext(Ctx);
}
