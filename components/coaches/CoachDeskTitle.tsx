'use client';
/**
 * ⚖ THE STRIP NAMES THE PAGE, DECIDED ONCE (navigation Phase 4, E6, C4, C8; the tournament's `DeskTitleProvider`). On a
 * team's pages, on a computer, the strip carries the page's name — the sidebar's lit row, in the sidebar's words — or, one
 * level down, the way back; the page header reads the same answer to drop its paper title (or, one level down, its own
 * arrow). One rule (`coachDeskTitleAt`, lib/coach-team-nav.ts) over the rows the sidebar draws (`coachNavGroupsFor`), so the
 * strip and the lit row cannot disagree.
 *
 * Every input is known on the server (the address, its search, the coach's team list), so the server's first paint is
 * the last. Which header shows is CSS at 900/901 — the strip above 900, the phone's team bar at 900 and below (navigation
 * Phase 5, E8: the bar names the page from this same answer, and the paper title hides at every width).
 */
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useCoaches, resolveLiveSeason, resolveClosedSeason } from '@/lib/coaches-context';
import { coachDeskTitleAt, coachNavGroupsFor, type CoachDeskTitle } from '@/lib/coach-team-nav';
import { mastheadSeasonLabel } from '@/lib/coach-season-label';
import { coachTeamIdIn } from '@/lib/coach-nav-visibility';
import { coachOffTeamPageName } from '@/lib/coach-off-team-pages';

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
  /**
   * ⚖ THE PHONE'S BAR NAMES THE RECORD TOO (owner, 2026-11-12: "the arrow is the only thing representing back and the bar always
   * names the place you are in"). The team bar's first line, one level down, is an empty slot the page's header PORTALS its title
   * into (`CoachBarName`) — the strip's `recordSlot`, for the phone. A second slot, not the strip's: both bars are in the DOM at
   * every width (CSS hides one), and one element cannot be two portal targets. Null until the bar mounts it.
   */
  barSlot: HTMLElement | null;
  /**
   * ⚖ THE PORTAL'S OFF-TEAM PAGES NAME THEMSELVES IN THE STRIP TOO (owner 2026-11-23; `lib/coach-off-team-pages.ts`): the page's name
   * on Notifications, Plan & billing and Join a club, null everywhere else. Deliberately NOT a `title` — a `name` title hides the
   * page's paper title at every width, and a phone has no bar on these pages, so this one is a computer's only (the header
   * reads it and hides its title above 900 alone). Null outside the provider's frame, so a wall keeps the page's own title.
   */
  offTeam: string | null;
};

const Ctx = createContext<DeskTitle>({ teamId: null, title: null, recordSlot: null, barSlot: null, offTeam: null });
/** The strip's ref callback for the slot — a state setter, so it is stable and never re-runs the strip's own effects. */
const SlotRef = createContext<(el: HTMLElement | null) => void>(() => {});
/** The team bar's ref callback for its own slot (the phone's), the same way. */
const BarSlotRef = createContext<(el: HTMLElement | null) => void>(() => {});

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
  const [barSlot, setBarSlot] = useState<HTMLElement | null>(null);
  const value = useMemo<DeskTitle>(() => {
    if (!teamId) return { teamId: null, title: null, recordSlot: null, barSlot: null, offTeam: coachOffTeamPageName(pathname) };
    const live = resolveLiveSeason(assignments, teamId);
    const closed = resolveClosedSeason(assignments, closedAssignments, teamId);
    // A team the coach is not on (or not yet loaded) names nothing: the page keeps its own title, and the bar — which draws
    // nothing without the team — never leaves a phone page with no heading at all (/review 2026-11-12).
    if (!live && !closed) return { teamId, title: null, recordSlot, barSlot, offTeam: null };
    const finished = !live && !!closed;
    const rows = coachNavGroupsFor((live ?? closed)?.capabilities, finished).flatMap(g => g.items);
    const seasonName = finished ? mastheadSeasonLabel(closed?.programYearName, closed?.teamName, closed?.programYearYear ?? null) : null;
    const words: Record<string, string | null> = { return: ret, from, year };
    const title = coachDeskTitleAt(pathname, { get: k => words[k] ?? null }, `/${orgSlug}/coaches/teams/${teamId}`, rows, seasonName);
    return { teamId, title, recordSlot, barSlot, offTeam: null };
  }, [teamId, assignments, closedAssignments, pathname, ret, from, year, orgSlug, recordSlot, barSlot]);
  return (
    <SlotRef.Provider value={setRecordSlot}>
      <BarSlotRef.Provider value={setBarSlot}>
        <Ctx.Provider value={value}>{children}</Ctx.Provider>
      </BarSlotRef.Provider>
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

/** The team bar's end of the phone's record slot: `<div ref={useCoachBarSlotRef()} />`. */
export function useCoachBarSlotRef(): (el: HTMLElement | null) => void {
  return useContext(BarSlotRef);
}
