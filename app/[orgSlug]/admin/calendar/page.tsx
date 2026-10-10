'use client';
/**
 * CALENDAR — the whole club's week, read-only (Club Tier Stage 6b, Asks 6–7; D5; D3 — hub K4MPu4ni53Ct7yrDcmWJd9 v64,
 * Mockups → Stage 6 → specimen 5; design log 2026-10-09 (1)–(3)). "Who is on Lions Park Diamond 2 on Tuesday?" took
 * eight team pages and two other programs; this page answers it, and marks the clashes 6a's one rule finds.
 *
 *   the door    — "Calendar" in the rail directly under Overview (the calendar-with-clock glyph), the first row of the
 *                 phone's More sheet; shown to whoever can open at least one program's schedule.
 *   the toolbar — the COACH SCHEDULE's: List · Week · Month (the portal's order, opening on Week), the quiet Venue ·
 *                 Program · Team pills (they tint and name their choice only when they narrow; each choice's count at its
 *                 row's end; not remembered between visits), Export pinned right. No Today, no Search.
 *   the date row— the week's arrows on their own row, "Times in Eastern time." said once, and the week's clash count as
 *                 the amber pill — a click is Clashes only, a second click shows everything.
 *   the views   — `ClubCalendarViews.tsx`. A booking opens a read window with both sides of its clash.
 *   the phone   — the coach schedule's: the View drawer in the title row, the stacked week — offering WEEK and MONTH only
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
import { AlertTriangle, CalendarDays, CalendarRange, ChevronLeft, ChevronRight, List } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { usePageTitle } from '@/lib/usePageTitle';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import { tournamentToday } from '@/lib/timezone';
import { moneyFetch, refusalText } from '@/lib/money-fetch';
import { buildFilename, downloadCSVBlob, downloadICSFromInstants, downloadXLSX, generateCSV } from '@/lib/export';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import ExportMenu from '@/components/admin/ExportMenu';
import { CoachListToolbar, kit } from '@/components/coaches/kit';
import { CoachToolbarMenu, CoachToolbarMenuItem } from '@/components/coaches/CoachToolbarMenu';
import MultiSelectDropdown from '@/components/coaches/MultiSelectDropdown';
import FilterGroup from '@/components/coaches/FilterGroup';
import ck from '@/components/admin/kit/club/ClubKit.module.css';
import { EmptyCard, LoadFailed, repKit, useDeferredLoad, useLatestRead } from '@/components/admin/kit/club/RepKit';
import { BookingWindow, ListView, MonthView, WeekView } from '@/components/admin/kit/club/ClubCalendarViews';
import cal from '@/components/admin/kit/club/ClubCalendar.module.css';
import {
  CALENDAR_WORDS as W, EXPORT_COLUMNS, PROGRAM_WORD, clashPairCount, exportRows, filterOptions, icsEntries, matchesFilters,
  ELSEWHERE, rangeFor, rangeWords, rangeWordsShort, stepCursor,
  type CalendarBooking, type CalendarFilters, type CalendarProgram, type CalendarRead, type CalendarView,
} from '@/lib/club-calendar-view';

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
  const [cursor, setCursor] = useState(() => tournamentToday());
  // Filters are not remembered between visits (the 2026-10-01 toolbar ruling): plain state, fresh on every open.
  const [venues, setVenues] = useState<Set<string>>(() => new Set());
  const [programs, setPrograms] = useState<Set<string>>(() => new Set());
  const [teams, setTeams] = useState<Set<string>>(() => new Set());
  const [clashesOnly, setClashesOnly] = useState(false);
  const [read, setRead] = useState<CalendarRead | null>(null);
  const [failed, setFailed] = useState<{ refused: boolean; text: string } | null>(null);
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
      setFailed(r?.status === 403 ? { refused: true, text: refusalText(r.data, W.noPrograms) } : { refused: false, text: W.loadFailed });
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

  const ViewGlyph = VIEW_GLYPH[shownView];
  const header = (
    <AdminPageHeader
      title={W.title}
      inlineActions
      actions={
        // THE VIEW MENU on a phone (the coach schedule's, stage 2 · C1): the current view's glyph opening Week and Month
        // in a drawer titled View — no List (see the header). Hidden above 640, where the toolbar's switch leads instead.
        <span className={cal.viewPhone}>
          <CoachToolbarMenu label={`Change view · ${VIEW_WORD[shownView]}`} icon={<ViewGlyph size={20} aria-hidden />} variant="glyph" drawerOnPhone drawerTitle="View">
            {PHONE_VIEWS.map(v => {
              const Glyph = VIEW_GLYPH[v];
              return <CoachToolbarMenuItem key={v} icon={<Glyph size={16} aria-hidden />} label={VIEW_WORD[v]} checked={shownView === v} onSelect={() => pickView(v)} />;
            })}
          </CoachToolbarMenu>
        </span>
      }
    />
  );

  if (failed?.refused) {
    return <div className={ck.pageWide}>{header}<EmptyCard title="Nothing to show">{failed.text}</EmptyCard></div>;
  }

  return (
    <div className={ck.pageWide}>
      {header}

      <CoachListToolbar actions={exportMenu}>
        {/* The switch hides on a phone through its wrapper: the kit's `.toolbar .toolbarView` outranks a class on the switch itself. */}
        <span className={cal.viewDesk}>
          <div className={`${repKit.views} ${kit.toolbarView}`} role="group" aria-label="Show the calendar as">
            {VIEWS.map(v => (
              <button key={v} type="button" className={`${repKit.view}${view === v ? ` ${repKit.viewOn}` : ''}`} aria-pressed={view === v} onClick={() => pickView(v)}>
                {VIEW_WORD[v]}
              </button>
            ))}
          </div>
        </span>
        <FilterGroup>
          <MultiSelectDropdown restQuiet label="Venue" options={options.venues} selected={venues} onChange={setVenues} allLabel="Every venue" />
          {(readerPrograms.length > 1 || programs.size > 0) && (
            <MultiSelectDropdown restQuiet label="Program" options={options.programs} selected={programs} onChange={setPrograms} allLabel="Every program" />
          )}
          {(readerPrograms.includes('rep') || teams.size > 0) && (
            <MultiSelectDropdown restQuiet label="Team" options={options.teams} selected={teams} onChange={setTeams} allLabel="Every team" />
          )}
        </FilterGroup>
      </CoachListToolbar>

      <div className={cal.dateRow}>
        <span className={cal.nav}>
          <button type="button" className={cal.navBtn} onClick={() => step(-1)}
            aria-label={view === 'month' ? 'Previous month' : 'Previous week'}>
            <ChevronLeft size={16} aria-hidden />
          </button>
          <span className={cal.navLabel}>
            <span className={cal.navLong}>{rangeWords(view, cursor)}</span>
            <span className={cal.navShort}>{rangeWordsShort(view, cursor)}</span>
          </span>
          <button type="button" className={cal.navBtn} onClick={() => step(1)}
            aria-label={view === 'month' ? 'Next month' : 'Next week'}>
            <ChevronRight size={16} aria-hidden />
          </button>
        </span>
        <span className={cal.spacer} />
        <span className={cal.timesText}>{W.timesNote}</span>
        {/* The week's clash count — the amber pill (design log 2026-10-09 (2)) — and Clashes only, the same control. */}
        {(clashCount > 0 || clashesOnly) && (
          <button type="button" className={cal.amberPill} aria-pressed={clashesOnly} onClick={() => setClashesOnly(on => !on)}
            aria-label={`${W.clashes(clashCount)}${clashesOnly ? ', showing clashes only' : ', show clashes only'}`}>
            <AlertTriangle size={13} aria-hidden />{W.clashes(clashCount)}
          </button>
        )}
      </div>

      {failed ? (
        <LoadFailed title={failed.text} onRetry={() => void load()} />
      ) : !current ? (
        <p className={ck.loading}>Loading…</p>
      ) : shownView === 'week' ? (
        <WeekView cursor={cursor} bookings={shown} onOpen={setOpen} />
      ) : shownView === 'month' ? (
        <MonthView cursor={cursor} bookings={shown} onDay={d => { jumpTo.current = d; setCursor(d); setView(phone ? 'week' : 'list'); }} />
      ) : shown.length === 0 ? (
        <p className={ck.hint}>{all.length === 0 ? W.nothingThisWeek : W.nothingMatches}</p>
      ) : (
        <ListView bookings={shown} onOpen={setOpen} />
      )}

      {open && <BookingWindow b={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
