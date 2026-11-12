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
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useCoaches, resolveLiveSeason, resolveClosedSeason } from '@/lib/coaches-context';
import { coachDeskTitleAt, coachNavGroupsFor, type CoachDeskTitle } from '@/lib/coach-team-nav';
import { mastheadSeasonLabel } from '@/lib/coach-season-label';
import { coachTeamIdIn } from '@/lib/coach-nav-visibility';

type DeskTitle = {
  /** The team in the address — the strip splits on a team's pages only (never a wall, never the free portal). */
  teamId: string | null;
  title: CoachDeskTitle;
  /**
   * ⚖ ONE LEVEL DOWN, THE STRIP NAMES THE RECORD TOO (owner 2026-11-11, reversing the "record keeps its title in the page"
   * half of C4 — the club's record pages already did this: "← Families │ Avery Test"). The strip draws an empty slot after
   * its arrow; the page's own header PORTALS its title and chips into it. A portal, not a hand-off of values: the title and
   * chips stay the page's own elements (their state, their closures, a live-typed name), nothing is copied through state,
   * and there is no loop to guard. Null on a computer's first paint and on every page that is not one level down — the
   * header then keeps its own title, so nothing is ever unnamed.
   */
  recordSlot: HTMLElement | null;
};

const Ctx = createContext<DeskTitle>({ teamId: null, title: null, recordSlot: null });
/** The strip's ref callback for the slot — a state setter, so it is stable and never re-runs the strip's own effects. */
const SlotRef = createContext<(el: HTMLElement | null) => void>(() => {});

export function CoachDeskTitleProvider({ orgSlug, children }: { orgSlug: string; children: ReactNode }) {
  const pathname = usePathname() ?? '';
  const params = useSearchParams();
  const { assignments, closedAssignments } = useCoaches();
  const teamId = coachTeamIdIn(pathname);
  // Only the three words the way back reads (`coachDrillBack`): a tab or an event in the address re-renders nothing here.
  const ret = params?.get('return') ?? null;
  const from = params?.get('from') ?? null;
  const year = params?.get('year') ?? null;
  const [recordSlot, setRecordSlot] = useState<HTMLElement | null>(null);
  const value = useMemo<DeskTitle>(() => {
    if (!teamId) return { teamId: null, title: null, recordSlot: null };
    const live = resolveLiveSeason(assignments, teamId);
    const closed = resolveClosedSeason(assignments, closedAssignments, teamId);
    const finished = !live && !!closed;
    const rows = coachNavGroupsFor((live ?? closed)?.capabilities, finished).flatMap(g => g.items);
    const seasonName = finished ? mastheadSeasonLabel(closed?.programYearName, closed?.teamName, closed?.programYearYear ?? null) : null;
    const words: Record<string, string | null> = { return: ret, from, year };
    const title = coachDeskTitleAt(pathname, { get: k => words[k] ?? null }, `/${orgSlug}/coaches/teams/${teamId}`, rows, seasonName);
    return { teamId, title, recordSlot };
  }, [teamId, assignments, closedAssignments, pathname, ret, from, year, orgSlug, recordSlot]);
  return (
    <SlotRef.Provider value={setRecordSlot}>
      <Ctx.Provider value={value}>{children}</Ctx.Provider>
    </SlotRef.Provider>
  );
}

export function useCoachDeskTitle(): DeskTitle {
  return useContext(Ctx);
}

/** The strip's end of the record slot: `<div ref={useCoachRecordSlotRef()} />`. */
export function useCoachRecordSlotRef(): (el: HTMLElement | null) => void {
  return useContext(SlotRef);
}
