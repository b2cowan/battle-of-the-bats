'use client';
/**
 * CALENDAR — the whole club's week, read-only (Club Tier Stage 6b, Asks 6–7; D5; D3 — hub K4MPu4ni53Ct7yrDcmWJd9 v64,
 * Mockups → Stage 6 → specimen 5; design log 2026-10-09 (1)–(3)). "Who is on Lions Park Diamond 2 on Tuesday?" took
 * eight team pages and two other programs; this page answers it, and marks the clashes 6a's one rule finds.
 *
 *   the door    — "Calendar" in the rail directly under Overview (the calendar-with-clock glyph), the first row of the
 *                 phone's More sheet; shown to whoever can open at least one program's schedule.
 *   the toolbar — ⚖ ONE LINE (Club Tier Stage 6c, Ask 4 — standard §11 C4): the view switch (List · Week · Month, the
 *                 portal's order, opening on Week — wearing the portal's OLIVE since 6c Ask 13: the olive face chooses
 *                 what is read), then wider than 900 px the dates (they follow the view, which sets their unit), the quiet
 *                 Venue · Program · Team pills (they tint and name their choice only when they narrow; each choice's
 *                 count at its row's end; not remembered between visits), the week's clash count as the amber pill (it
 *                 is Clashes only — a click narrows, a second click shows everything), and at the line's end Export.
 *                 No Today, no Search. ⚖ No zone sentence (owner 2026-10-19, as the schedule's page 2026-10-12): the
 *                 readers are the club's own admins and the times are already the club's; the exports keep it.
 *   the date row— at 900 px and narrower the dates take their own row; on a phone the pill joins them.
 *   the views   — `ClubCalendarViews.tsx`. A booking opens a read window with both sides of its clash.
 *   the phone   — the coach schedule's: the View drawer first in the toolbar (A7), the stacked week — offering WEEK and MONTH only
 *                 (owner 2026-10-09, §288 W4): List and Week both read one week, and a phone draws both as the same
 *                 stack of day cards, so List would repeat Week. (The coach's List is the whole season, which is why its
 *                 phone keeps three.) A page left on List shows Week at phone width; Month's day opens the Week there,
 *                 scrolled to that day. On a computer all three stay: columns and a table are different reads. The Filter button sits in the
 *                 toolbar row, as on the club's Ledger (FilterGroup's phone form), and Export stays pinned right in that
 *                 row as its icon (owner 2026-10-09, §288 W4): the coach schedule sends Export under the list only because
 *                 its phone has no toolbar row, and this one keeps the row for Filter — so Export sits where it does on a
 *                 computer and on the Ledger's phone, not at the end of a long week.
 *   Export      — one button, Excel first, then CSV, then Calendar (.ics); one line on top says what the file holds (the
 *                 range and the filters). It writes what the page shows. No PDF week and no subscribable link in the first
 *                 cut (Ask 10 hands the feeds to the schedule deep dive's stage 4).
 *
 * ⚠ NOTHING HERE WRITES (D3): no Add, no drag, no pencil. The coach keeps the schedule.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CalendarDays, CalendarRange, ChevronRight, List } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { usePageTitle } from '@/lib/usePageTitle';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import { formatShortWeekdayDate, isCalendarDate, tournamentToday } from '@/lib/timezone';
import { CLUB_BAND_WORDS } from '@/lib/club-band-view';
import { useSearchParams } from 'next/navigation';
import { moneyFetch, refusalText } from '@/lib/money-fetch';
import { buildFilename, downloadCSVBlob, downloadICSFromInstants, downloadXLSX, generateCSV } from '@/lib/export';
import { TabPageHeader } from '@/components/admin/kit/club/PlaceFrame';
import ExportMenu from '@/components/admin/ExportMenu';
import { CoachListToolbar } from '@/components/coaches/kit';
import { CoachToolbarMenu, CoachToolbarMenuItem } from '@/components/coaches/CoachToolbarMenu';
import MultiSelectDropdown from '@/components/coaches/MultiSelectDropdown';
import FilterGroup from '@/components/coaches/FilterGroup';
import ck from '@/components/admin/kit/club/ClubKit.module.css';
import { EmptyCard, LoadFailed, useDeferredLoad, useLatestRead } from '@/components/admin/kit/club/RepKit';
import { BookingWindow, ListView, MonthView, OutsideMarksContext, WeekView, type OutsideMarks } from '@/components/admin/kit/club/ClubCalendarViews';
import { CalendarViewSwitch, ScheduleDateNav } from '@/components/coaches/ScheduleCalendarViews';
import cal from '@/components/admin/kit/club/ClubCalendar.module.css';
import coach from '@/app/[orgSlug]/coaches/coaches.module.css';
import {
  CALENDAR_WORDS as W, EXPORT_COLUMNS, PROGRAM_WORD, clashPairCount, exportRows, filterOptions, filtersQuery, icsEntries, matchesFilters,
  ELSEWHERE, rangeFor, rangeWords, stepCursor,
  type CalendarBooking, type CalendarFilters, type CalendarProgram, type CalendarRead, type CalendarView,
} from '@/lib/club-calendar-view';
import LoadingState from '@/components/shared/LoadingState';
import { NotYours } from '@/components/admin/kit/club/NotYours';

const VIEWS: CalendarView[] = ['list', 'week', 'month'];
/** The phone's View drawer — no List: on a phone it is the same stack as Week (see the header). */
const PHONE_VIEWS: CalendarView[] = ['week', 'month'];
const VIEW_WORD: Record<CalendarView, string> = { list: 'List', week: 'Week', month: 'Month' };
const VIEW_GLYPH: Record<CalendarView, React.ElementType> = { list: List, week: CalendarRange, month: CalendarDays };

export default function ClubCalendarPage() {
  const { currentOrg, loading: orgLoading } = useOrg();
  usePageTitle(W.title);
  const slug = currentOrg?.slug ?? '';
  const q = `orgSlug=${encodeURIComponent(slug)}`;

  const [view, setView] = useState<CalendarView>('week');
  // What is DRAWN: a phone has no List (it would repeat Week), so List shows Week there. `view` stays as chosen, so a
  // window widened back to a computer returns to the List it left.
  const phone = useIsPhone();
  const shownView: CalendarView = phone && view === 'list' ? 'week' : view;
  // `?day=YYYY-MM-DD` opens the week holding that day (Club Tier 13c: a permit's notice, "See Sat, Dec 5 on the Calendar").
  const askedDay = useSearchParams().get('day');
  const [cursor, setCursor] = useState(() => (askedDay && isCalendarDate(askedDay) ? askedDay : tournamentToday()));
  // Filters are not remembered between visits (the 2026-10-01 toolbar ruling): plain state, fresh on every open.
  const [venues, setVenues] = useState<Set<string>>(() => new Set());
  const [programs, setPrograms] = useState<Set<string>>(() => new Set());
  const [teams, setTeams] = useState<Set<string>>(() => new Set());
  const [clashesOnly, setClashesOnly] = useState(false);
  const [read, setRead] = useState<CalendarRead | null>(null);
  const [failed, setFailed] = useState<{ refused: boolean; text: string; notYours?: boolean } | null>(null);
  const [open, setOpen] = useState<CalendarBooking | null>(null);
  const [seenTeams, setSeenTeams] = useState<Map<string, string>>(() => new Map());
  /** Month's day, opened in its List (its Week on a phone) — scrolled to once that week is drawn. */
  const jumpTo = useRef<string | null>(null);

  const range = useMemo(() => rangeFor(view, cursor), [view, cursor]);
  // Moving yourself drops a pending scroll from Month's day (it would otherwise fire on a later, unrelated List).
  const pickView = (v: CalendarView) => { jumpTo.current = null; setView(v); };
  const step = (dir: -1 | 1) => { jumpTo.current = null; setCursor(c => stepCursor(view, c, dir)); };
  const beginRead = useLatestRead();
  const load = useCallback(async () => {
    if (!slug) return;
    const current = beginRead();
    setFailed(null); // a new range's read: an old failure no longer describes the page
    // org-slug-ok: `q` is built from the org context's slug above
    const r = await moneyFetch<CalendarRead>(`/api/admin/club-calendar?${q}&from=${range.from}&to=${range.to}`).catch(() => null);
    if (!current()) return;
    if (!r?.ok) {
      setFailed(r?.status === 403
        ? { refused: true, text: refusalText(r.data, W.noPrograms), notYours: (r.data as { code?: string } | null)?.code === 'no_programs' }
        : { refused: false, text: W.loadFailed });
      return;
    }
    setFailed(null);
    setRead(r.data);
    // The names behind a chosen filter, kept across weeks: a week without that team still lists the team the filter holds.
    setSeenTeams(prev => {
      const next = new Map(prev);
      for (const b of r.data.bookings) if (b.teamId) next.set(b.teamId, b.ownerName);
      return next;
    });
  }, [slug, q, range.from, range.to, beginRead]);
  useDeferredLoad(!orgLoading && !!slug, load);

  // The read for the range on screen — a previous week's never stands in for this one while it loads.
  const current = read && read.from === range.from && read.to === range.to ? read : null;
  const all = useMemo(() => current?.bookings ?? [], [current]);
  const filters: CalendarFilters = { venues, programs: programs as Set<CalendarProgram>, teams, clashesOnly };
  const shown = all.filter(b => matchesFilters(b, filters));
  // The pill counts what the OTHER filters show, so turning Clashes only on never changes its own number.
  const clashCount = clashPairCount(all.filter(b => matchesFilters(b, { ...filters, clashesOnly: false })));
  const options = useMemo(() => {
    const names = new Map((current?.venues ?? read?.venues ?? []).map(v => [v.id, v.name]));
    const o = filterOptions(all, names);
    // A choice that is ON stays in its list even in a week without it (count 0), so it can always be taken off — the
    // Ledger's rule ("a narrowing that is ON always shows its pill").
    const keep = <T extends { id: string }>(list: T[], picked: ReadonlySet<string>, make: (id: string) => T) =>
      [...list, ...[...picked].filter(id => !list.some(x => x.id === id)).map(make)];
    return {
      venues: keep(o.venues, venues, id => ({ id, label: id === ELSEWHERE ? W.elsewhere : names.get(id) ?? 'A venue', count: 0 })),
      programs: keep(o.programs, programs, id => ({ id: id as CalendarProgram, label: PROGRAM_WORD[id as CalendarProgram], count: 0 })),
      teams: keep(o.teams, teams, id => ({ id, label: seenTeams.get(id) ?? 'A team', count: 0 })),
    };
  }, [all, current, read, venues, programs, teams, seenTeams]);
  const readerPrograms = current?.programs ?? read?.programs ?? [];

  // What the permits' dates off took in this range (13c Session B, B2): the day's chip and each booking's mark — the
  // route's answer, in the permit's one rule; nothing when it is absent.
  const outside = useMemo<OutsideMarks | null>(() => (current?.outside
    ? { keys: new Set(current.outside.keys), days: current.outside.days }
    : null), [current]);

  // An empty week names the next thing (13c Session B, B4 — F-XR-6): the Overview band's own reader, asked only while the
  // week (or the List) shows nothing; with filters on, the next MATCHING event. Never before today.
  const emptyWeek = !!current && shownView !== 'month' && shown.length === 0;
  const nextKey = emptyWeek ? `${range.from}${filtersQuery(filters)}` : null;
  type Next = { day: string; who: string } | null;
  const [asked, setAsked] = useState<{ key: string; next: Next } | null>(null);
  useEffect(() => {
    if (!nextKey) return;
    let stale = false;
    // org-slug-ok: `q` is built from the org context's slug above
    moneyFetch<{ next: Next }>(`/api/admin/club-calendar?${q}&next=${nextKey}`)
      .then(r => { if (!stale && r.ok) setAsked({ key: nextKey, next: r.data.next }); })
      .catch(() => {}); // a failed "Next:" says nothing more than the week does
    return () => { stale = true; };
  }, [nextKey, q]);
  const answered = asked?.key === nextKey ? asked : null;
  const next = answered?.next ?? null;
  const goToNext = () => { if (next) { jumpTo.current = next.day; setCursor(next.day); } };
  const nextWords = answered ? (next
    ? <>{W.nextLabel} <b>{formatShortWeekdayDate(next.day)} · {next.who}</b></>
    : CLUB_BAND_WORDS.week.nothingSoon) : null;
  const emptyLine = (
    <p className={cal.nextLine}>
      {all.length === 0 ? W.nothingThisWeek : W.nothingMatches}
      {nextWords && <span>{nextWords}</span>}
      {next && <button type="button" className={cal.nextGo} onClick={goToNext}>{W.goToWeek} ›</button>}
    </p>
  );

  useEffect(() => {
    const day = jumpTo.current;
    if (!day || shownView === 'month' || !current) return;
    jumpTo.current = null;
    const el = [document.getElementById(`cal-band-${day}`), document.getElementById(`cal-day-${day}`)]
      .find(x => x && x.offsetParent !== null);
    el?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [shownView, current]);

  // ── Export: what the page shows ──
  const filterWords = [
    ...options.venues.filter(o => venues.has(o.id)).map(o => o.label),
    ...[...programs].map(p => PROGRAM_WORD[p as CalendarProgram]),
    ...options.teams.filter(o => teams.has(o.id)).map(o => o.label),
    ...(clashesOnly ? ['Clashes only'] : []),
  ];
  const holds = { title: W.exportHolds(rangeWords(view, cursor), filterWords, shown.length) };
  const file = (ext: string) => buildFilename({ org: slug, dataset: 'calendar', scope: range.from }, ext);
  const sheet = () => {
    const rows = exportRows(shown);
    return { headers: EXPORT_COLUMNS.map(c => c.label), rows: rows.map(r => EXPORT_COLUMNS.map(c => r[c.key])) };
  };
  const exportMenu = (
    <ExportMenu
      formats={['xlsx', 'csv', 'ics']}
      disabled={shown.length === 0}
      holds={holds}
      onExportXLSX={async () => { const s = sheet(); await downloadXLSX(file('xlsx'), s.headers, s.rows, 'Calendar'); }}
      onExportCSV={() => { const s = sheet(); downloadCSVBlob(file('csv'), generateCSV(s.headers, s.rows)); }}
      onExportICS={() => downloadICSFromInstants(file('ics'), icsEntries(shown), `${currentOrg?.name ?? 'Club'} calendar`)}
    />
  );

  /** Whether the page shows more than one program — a booking then says its program in words (C5). */
  const multiProgram = readerPrograms.length > 1;
  // Every calendar's date row (§289): the List here is a week, so it steps and reads as one.
  const dateNav = <ScheduleDateNav view={view === 'month' ? 'month' : 'week'} cursor={cursor} onStep={step} />;
  /** The week's clash count — the amber pill (design log 2026-10-09 (2)) — and Clashes only, the same control. It sits with
   *  the filters it belongs to on the line (6c); on a phone it joins the dates. */
  const clashPill = (clashCount > 0 || clashesOnly) ? (
    <button type="button" className={cal.amberPill} aria-pressed={clashesOnly} onClick={() => setClashesOnly(on => !on)}
      aria-label={`${W.clashes(clashCount)}${clashesOnly ? ', showing clashes only' : ', show clashes only'}`}>
      <AlertTriangle size={13} aria-hidden />{W.clashes(clashCount)}
    </button>
  ) : null;

  const ViewGlyph = VIEW_GLYPH[shownView];
  // ⚖ Admin header Phase 3 (round 5): the header names the Calendar, so the paper title goes (`TabPageHeader`); it stays
  // only where the header keeps the club's name (a refusal).
  const header = <TabPageHeader title={W.title} />;
  // THE VIEW MENU on a phone (the coach schedule's, stage 2 · C1): the current view's glyph opening Week and Month in a
  // drawer titled View — no List (see the header). ⚖ A7 (owner 2026-11-07): it is the toolbar's FIRST slot, where the
  // desktop's List · Week · Month switch sits, keeping its ghost-glyph look. Hidden above 640, where that switch leads.
  const viewMenu = (
    <span className={cal.viewPhone}>
      <CoachToolbarMenu label={`Change view · ${VIEW_WORD[shownView]}`} icon={<ViewGlyph size={20} aria-hidden />} variant="glyph" drawerOnPhone drawerTitle="View">
        {PHONE_VIEWS.map(v => {
          const Glyph = VIEW_GLYPH[v];
          return <CoachToolbarMenuItem key={v} icon={<Glyph size={16} aria-hidden />} label={VIEW_WORD[v]} checked={shownView === v} onSelect={() => pickView(v)} />;
        })}
      </CoachToolbarMenu>
    </span>
  );

  // ⚖ Ask 6 = A (Club Tier Stage 13a, F-NAV-12): a person who opens none of the calendar's programs gets the ONE "not yours"
  // screen.
  if (failed?.notYours) return <NotYours page="calendar" />;
  if (failed?.refused) {
    return <div className={ck.pageWide}>{header}<EmptyCard title="Nothing to show">{failed.text}</EmptyCard></div>;
  }

  return (
    <div className={ck.pageWide}>
      {header}

      {/* ⚖ Toolbar Rules, Rule 2 (Stage 3, 2026-10-19 — the hub's Calendar · After): which week on the left — the
          switch and the dates; the
          narrowings right of the gap — Venue · Program · Team and the clash pill — then Export. */}
      <CoachListToolbar
        actions={exportMenu}
        filters={(
          <>
            <FilterGroup>
              <MultiSelectDropdown restQuiet label="Venue" options={options.venues} selected={venues} onChange={setVenues} allLabel="Every venue" />
              {(readerPrograms.length > 1 || programs.size > 0) && (
                <MultiSelectDropdown restQuiet label="Program" options={options.programs} selected={programs} onChange={setPrograms} allLabel="Every program" />
              )}
              {(readerPrograms.includes('rep') || teams.size > 0) && (
                <MultiSelectDropdown restQuiet label="Team" options={options.teams} selected={teams} onChange={setTeams} allLabel="Every team" />
              )}
            </FilterGroup>
            {clashPill && <span className={cal.pillOnLine}>{clashPill}</span>}
          </>
        )}
      >
        {/* The phone's View menu first (A7), then the switch, which hides on a phone through its wrapper: the kit's
            `.toolbar .toolbarView` outranks a class on the switch itself. Each shows at its own width only. */}
        {viewMenu}
        <span className={cal.viewDesk}>
          <CalendarViewSwitch views={VIEWS} value={view} onChange={pickView} label="Show the calendar as" />
        </span>
        <div className={coach.calNavOnLine}>{dateNav}</div>
      </CoachListToolbar>

      {/* The dates on their own row at 900 px and narrower; on a phone the pill joins them too (the 6b phone). */}
      <div className={cal.dateRow}>
        {dateNav}
        <span className={cal.spacer} />
        {clashPill && <span className={cal.pillPhone}>{clashPill}</span>}
      </div>

      <OutsideMarksContext.Provider value={outside}>
      {failed ? (
        <LoadFailed title={failed.text} onRetry={() => void load()} />
      ) : !current ? (
        <LoadingState label="Loading the club’s calendar…" />
      ) : shownView === 'week' ? (
        <>
          {emptyWeek && emptyLine}
          <WeekView cursor={cursor} bookings={shown} onOpen={setOpen} multiProgram={multiProgram} />
          {/* The phone's one row under the quiet lines (WeekView itself is shared with the season page, so it stays there). */}
          {emptyWeek && answered && (next ? (
            <button type="button" className={cal.nextRow} onClick={goToNext}>
              <span>{nextWords}</span><ChevronRight size={16} aria-hidden />
            </button>
          ) : <p className={cal.nextRow}>{nextWords}</p>)}
        </>
      ) : shownView === 'month' ? (
        <MonthView cursor={cursor} bookings={shown} onDay={d => { jumpTo.current = d; setCursor(d); setView(phone ? 'week' : 'list'); }} />
      ) : emptyWeek ? (
        emptyLine
      ) : (
        <ListView bookings={shown} onOpen={setOpen} multiProgram={multiProgram} />
      )}
      </OutsideMarksContext.Provider>

      {open && <BookingWindow b={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
