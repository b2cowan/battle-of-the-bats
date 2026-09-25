'use client';
import { use, useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from 'react';
import { Calendar, CalendarDays, CalendarPlus, CalendarRange, ChevronLeft, ChevronRight, List, Plus, Upload, X } from 'lucide-react';
import { EVENT_ICONS, EVENT_COLORS } from '@/components/coaches/eventTypeMark';
import { useRouter } from 'next/navigation';
import { useCoaches, useCoachSeasonPage } from '@/lib/coaches-context';
import CoachPageHeader from '@/components/coaches/CoachPageHeader';
import { useOrg } from '@/lib/org-context';
import { useOverlayOpen } from '@/lib/coaches-overlay';
import { useHelpDrawer } from '@/components/help/help-drawer-context';
import { useConfirm } from '@/components/coaches/ConfirmProvider';
import { getSportPack, DEFAULT_SPORT } from '@/lib/sports';
import { scheduleDrawerDoors } from '@/lib/coach-schedule-doors';
import {
  downloadXLSX, generateCSV, downloadCSVBlob, downloadICSFromInstants,
  buildFilename, serializeRows, serializeHeaders,
  coachScheduleCalendarEntries, coachScheduleSheetRows,
  type ExportColumnDef,
} from '@/lib/export';
import CoachExportButton from '@/components/coaches/CoachExportButton';
import { CoachToolbarMenu, CoachToolbarMenuItem } from '@/components/coaches/CoachToolbarMenu';
import { useMinuteClock } from '@/lib/use-minute-clock';
import type { ClubPickerSpelling } from '@/lib/coach-opponent-picker';
import type { CoachScheduleTournamentGame } from '@/lib/basic-coach-teams';
import {
  COACH_GAME_EVENT_TYPES, isMirroredEvent,
  diffSeenTimes, readSeenTimes, writeSeenTimes, acknowledgeSeen,
  findDuplicateSelfEntries, readDismissedDuplicates, dismissDuplicate,
  type MovedGame, type DuplicateGamePair,
} from '@/lib/coach-tournament-games';
import { CoachRowListFoot } from '@/components/coaches/CoachRowList';
import styles from '../../../coaches.module.css';
import { CoachListToolbar } from '@/components/coaches/kit';
import { gameDayConsolePath, gameDayWindow, isGameDayEvent, toGameDayEventShape, windowHolds } from '@/lib/coach-game-day';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import { pickTodayRow } from '@/lib/coach-schedule-phone';
import { normalizeOpponentName, recordChip, type OpponentBookEntry } from '@/lib/coach-opponents';
import { tournamentToday, utcToZonedInputs } from '@/lib/timezone';
import { EVENT_LABELS } from '@/lib/coach-schedule-vocab';
import ScheduleImportSheet from '@/components/coaches/ScheduleImportSheet';
import { GAME_EVENT_TYPES, dayStr, errorMessage, fmtDate, isLineupEvent, sortDayEvents, weekKey } from '@/lib/coach-schedule-view';
import {
  ScheduleEventChip, ScheduleListView, ScheduleMonthView, ScheduleWeekView,
  type ScheduleRowDecor, type ScheduleViewData,
} from '@/components/coaches/ScheduleCalendarViews';
import ScheduleEventSheet, { deleteEventRequest } from '@/components/coaches/ScheduleEventSheet';
import { sheetViewFromTab, type SheetView } from '@/lib/coach-schedule-sheet';
import ScheduleEventForm, {
  addHoursLocal, DEFAULT_EVENT_HOUR, seedAddForm, seedEditForm,
  type EventForm, type ScheduleFormInit,
} from '@/components/coaches/ScheduleEventForm';
import type {
  RepTeamEvent,
  RepTeamEventAttendance,
  RepTryoutSession,
  RepEventType,
  RepTeamTag,
  RepTeamPlace,
  RepTeamAwardType,
  RepPlayerAward,
} from '@/lib/types';

/**
 * THE COACH'S SCHEDULE — the season's data, the list chrome, and the doors into the three pieces
 * that draw it: the calendar views (`ScheduleCalendarViews`), one event's sheet
 * (`ScheduleEventSheet`) and the add/edit form (`ScheduleEventForm`). Those three were this file
 * until the Schedule deep dive's split (stage 1 · S6, owner ruling 2026-09-25 — "split first, a
 * pure move": at 4,211 lines and 60 state variables, any change to the sheet rewrote it inside the
 * largest route in the portal). This page keeps the events, the book, the awards, the
 * capabilities and every fetch, and hands each piece what it draws.
 */

// ── Export definition ─────────────────────────────────────────────────────────

const SCHEDULE_EXPORT_COLS: ExportColumnDef[] = [
  { label: 'Date',       key: 'date',      format: 'date' },
  { label: 'Time',       key: 'time',      format: 'text' },
  { label: 'Arrival',    key: 'arrival',   format: 'text' },
  { label: 'Event Type', key: 'eventType', format: 'text' },
  { label: 'Name',       key: 'name',      format: 'text' },
  { label: 'Opponent',   key: 'opponent',  format: 'text' },
  { label: 'Location',   key: 'location',  format: 'text' },
  { label: 'Address',    key: 'address',   format: 'text' },
  { label: 'Field',      key: 'field',     format: 'text' },
  { label: 'Uniform',    key: 'uniform',   format: 'text' },
  { label: 'Home/Away',  key: 'homeAway',  format: 'text' },
];

// ── Constants ──────────────────────────────────────────────────────────────────

// ⚠ `EVENT_COLORS` and `EVENT_ICONS` MOVED OUT on 2026-08-18, to
// `components/coaches/eventTypeMark.tsx`. The closed-season page needed the same marks for its
// Results shelf, and a second copy would have drifted on exactly the axis a coach reads fastest.

// Add-event menu order. Tournament games nest visually under Tournament so a coach sees the
// relationship (a game slot belongs to a tournament) right where they create one. Scrimmage is
// not an item: it is a box on the Game form (mig 306, owner ruling 2026-09-20).
const ADD_MENU: { type: RepEventType; nested?: boolean }[] = [
  { type: 'external_tournament' },
  { type: 'tournament_game', nested: true },
  { type: 'league_game' },
  { type: 'practice' },
  { type: 'team_event' },
];

// The event-type vocabulary (labels, name prefixes, which types take an opponent, which can
// recur, home/away) moved to `lib/coach-schedule-vocab` in Chunk C — the export writes it, the
// importer reads it back, and the recurrence writer names each game from its own opponent, so all
// three have to agree on one copy (H2 rule 4).

type ViewMode = 'list' | 'week' | 'month';

/**
 * THE VIEW MENU'S ROWS (phone re-evaluation stage 2 · C1, owner ruling 2026-09-21). At ≤640 the
 * List · Week · Month toggle is one icon-only button beside the create, wearing the CURRENT view's
 * glyph — list lines, week columns, month grid — one symbol saying where you are and that it
 * switches (the row's own left icon is already a calendar, so a fixed calendar glyph would say
 * "calendar" twice and nothing about the view). The desktop keeps the kit toolbar's toggle.
 */
const VIEW_MODES: ViewMode[] = ['list', 'week', 'month'];
const VIEW_WORD: Record<ViewMode, string> = { list: 'List', week: 'Week', month: 'Month' };
const VIEW_GLYPH: Record<ViewMode, React.ElementType> = { list: List, week: CalendarRange, month: CalendarDays };

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CoachesSchedulePage({
  params,
}: {
  params: Promise<{ orgSlug: string; teamId: string }>;
}) {
  const { orgSlug, teamId } = use(params);
  const { assignments, loading: ctxLoading } = useCoaches();
  const { currentOrg } = useOrg();
  // Sport vocabulary (period word, position legend, field positions the auto-fill assigns)
  // routes through this team's Sport Pack. Falls back to the default sport until the coaching
  // assignment loads (both offered sports today are diamond, so the fallback is harmless).
  const sportPack = getSportPack(assignments.find(a => a.teamId === teamId)?.teamSport ?? DEFAULT_SPORT);

  const [events, setEvents] = useState<RepTeamEvent[]>([]);
  // Deep-link: /schedule?event=<id>[&tab=attendance|scouting|lineup] opens that event's sheet (and
  // the view the tab names — see the effect below). One-shot per mount.
  const deepLinkHandledRef = useRef(false);
  const addDeepLinkHandledRef = useRef(false);
  const [tryoutSessions, setTryoutSessions] = useState<RepTryoutSession[]>([]);
  // WI-2B: the rep team's real tournament games. Batch 4 mirrors every DATED one into a real event
  // (so attendance/lineups work), so what this list still uniquely carries is the undated bracket
  // slots — plus the public game links. Anything already held as a mirrored event is filtered out
  // below so nothing renders twice.
  const [tournamentGames, setTournamentGames] = useState<CoachScheduleTournamentGame[]>([]);
  // Batch 4: mirrored games the organizer has moved since THIS DEVICE last showed them, and the
  // coach's own hand-entered games that look like a duplicate of a mirrored one.
  const [movedGames, setMovedGames] = useState<MovedGame[]>([]);
  /** Moved games the coach has opened during THIS view — their chip retires immediately rather
   *  than lingering until the next refetch. */
  const [acknowledgedMoves, setAcknowledgedMoves] = useState<Set<string>>(new Set());
  const [dismissedDupes, setDismissedDupes] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [view, setView] = useState<ViewMode>('list');
  const [cursorDate, setCursorDate] = useState(() => tournamentToday());
  /** Month on a phone (stage 2 · C2): the tapped day, whose rows sit under the grid; today at open.
   *  `navigate()` moves it with the month so the rows beneath never name a day the grid does not show. */
  const [selectedDay, setSelectedDay] = useState(() => tournamentToday());
  /** ≤640 — the event sheet renders its blocks in the phone's order (stage 2 · C3); the desktop
   *  keeps today's order. A JS decision because the ORDER is DOM order (the tab sequence must match
   *  the reading order — never CSS `order`), and the sheet only opens after mount. */
  const isPhone = useIsPhone();
  /** THE PHONE'S SCROLLER (stage 2 · C1): the calendar body between the title row and the bar.
   *  Above 640 the same element is a plain block with no travel. */
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  /** The spacer under the list that lets the last month reach the top of the scroller. */
  const tailRef = useRef<HTMLDivElement | null>(null);

  const [selectedEvent, setSelectedEvent] = useState<RepTeamEvent | null>(null);
  /** The view the sheet opens with — the deep link's `?tab=` (the room, the book) — or none. */
  const [sheetView, setSheetView] = useState<SheetView | null>(null);
  // Mobile month view: a tapped day with >1 event opens this bottom-sheet day list (a single
  // event opens its detail directly). Desktop keeps the in-cell text chips, so this stays null.
  const [daySheet, setDaySheet] = useState<{ dateKey: string; events: RepTeamEvent[] } | null>(null);
  /** The open add / edit form, seeded — null when none is open (it mounts fresh on every open). */
  const [formInit, setFormInit] = useState<ScheduleFormInit | null>(null);
  const [addTypeMenuOpen, setAddTypeMenuOpen] = useState(false);
  /** Chunk C (P1 #7) — the schedule importer. */
  const [importOpen, setImportOpen] = useState(false);
  const [importToast, setImportToast] = useState('');
  /** The duplicate notice's "Remove my copy" in flight. */
  const [saving, setSaving] = useState(false);
  // Game event ids whose saved lineup disagrees with attendance (server-computed) — badges the list.
  const [mismatchIds, setMismatchIds] = useState<Set<string>>(new Set());
  // Coach Tags (Phase 1, game tags only): the team's tag library + which tags each event already
  // carries, both returned alongside the events fetch (no per-event round trip).
  const [teamTags, setTeamTags] = useState<RepTeamTag[]>([]);
  // The place book and the team's arrival habit (mig 307) ride the events read.
  const [places, setPlaces] = useState<RepTeamPlace[]>([]);
  const [arrivalDefaults, setArrivalDefaults] = useState<{ game: number | null; practice: number | null }>({ game: null, practice: null });
  const [tagsByEventId, setTagsByEventId] = useState<Record<string, string[]>>({});
  // Player Awards (Phase 2): the team's award-type library, every award given this season
  // (filtered client-side per event for the slide-over), a minimal PII-free player list for the
  // give-award picker, and per-event counts for the schedule list's trophy badge.
  const [awardTypes, setAwardTypes] = useState<RepTeamAwardType[]>([]);
  const [teamAwards, setTeamAwards] = useState<RepPlayerAward[]>([]);
  const [awardPlayers, setAwardPlayers] = useState<{ id: string; name: string; number: string | null }[]>([]);
  const confirm = useConfirm();
  const { openHelp } = useHelpDrawer();

  const base = `/${orgSlug}/coaches/teams/${teamId}`;

  // Which SEASON is on screen — the team's LIVE one, always. `page.capabilities` are that
  // season's. ⚠ `page.canWrite()` is GONE (2026-08-18): it folded read-only into every write
  // flag, and a closed season no longer renders this screen at all.
  const page = useCoachSeasonPage(orgSlug, teamId);

  // Opponent Scouting Book roll-up (one fetch, no N+1): powers the record chip on upcoming
  // game rows and the sheet's Scouting row. Non-fatal — a failed load just means no
  // chips this visit. The map is keyed by the book's normalized names AND every merged-away
  // alias (P2): an aliased spelling's events fold into the owner server-side, but the event
  // string a row renders from still normalizes to the alias — without the alias keys, the
  // chip would vanish from exactly the rows a merge was meant to unify.
  // ⚠ The archive suppression is DELETED (2026-08-18) — the book is a live-season INSTRUMENT
  // (owner ruling 2026-08-04, untouched), and this screen is no longer rendered for a season that
  // has ended, so there is no frozen season left to hide it from. The flag stays because it still
  // gates BOTH the roll-up fetch and the tab computation together, which is what stops a tab
  // opening onto a panel whose data never loads.
  const scoutingAvailable = true;
  const [bookByKey, setBookByKey] = useState<Map<string, OpponentBookEntry>>(new Map());
  // The same fetch, kept as the LIST too (Opponent Picker, 2026-09-21): the Opponent field reads the
  // book the row chips read — one endpoint, no second copy of the book on this page. `clubSpellings`
  // is the club group (D5), [] whenever the club layer is closed (decided server-side).
  const [bookEntries, setBookEntries] = useState<OpponentBookEntry[]>([]);
  const [clubSpellings, setClubSpellings] = useState<ClubPickerSpelling[]>([]);
  const loadBook = useCallback(async () => {
    // CLEAR, not just skip: a coach can flip live → archived season on this same mount
    // (?year= re-render, no remount), and a populated map would keep painting record
    // chips onto the frozen calendar.
    if (!scoutingAvailable) { setBookByKey(new Map()); setBookEntries([]); setClubSpellings([]); return; }
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/opponents`);
      if (!res.ok) return;
      const data = await res.json();
      const map = new Map<string, OpponentBookEntry>();
      const list = (data.opponents ?? []) as OpponentBookEntry[];
      for (const e of list) {
        map.set(e.key, e);
        for (const alias of e.aliasKeys ?? []) map.set(alias, e);
      }
      setBookByKey(map);
      setBookEntries(list);
      setClubSpellings(Array.isArray(data.clubSpellings) ? (data.clubSpellings as ClubPickerSpelling[]) : []);
    } catch { /* chips are a convenience, never a blocker */ }
  }, [orgSlug, teamId, scoutingAvailable]);
  useEffect(() => { loadBook(); }, [loadBook]);
  /** Record chip text for a game row: prior meetings only, upcoming games only (the trail
   *  slot is the score's once one exists). Empty map in an archive ⇒ always null there. */
  const bookRecordFor = useCallback((e: RepTeamEvent): string | null => {
    if (!COACH_GAME_EVENT_TYPES.includes(e.eventType) || !e.opponent) return null;
    if (e.teamScore != null || e.status === 'cancelled') return null;
    const entry = bookByKey.get(normalizeOpponentName(e.opponent));
    if (!entry || entry.meetings.length === 0) return null;
    const r = entry.record;
    if (r.wins + r.losses + r.ties === 0) return null;
    return recordChip(r);
  }, [bookByKey]);
  /**
   * Game-Day Mode entry (P1): a game row grows a `Game day` action inside its live window —
   * ABSENT outside the window (never disabled), absent on cancelled rows (the predicate checks
   * type + status), and absent in an archived season: the console is a live-season INSTRUMENT
   * (same ruling as the scouting book above), so a frozen calendar never offers a bench to run.
   *
   * The clock is read once a MINUTE (render stays pure — the hook snapshots it in state), so a
   * tab left open through an afternoon shows the door when the window opens rather than on the
   * next reload; the server guard, not this affordance, enforces it. It used to be a once-per-mount
   * snapshot — the gap the Overview's fix recorded for this page (2026-08-12) — and it joined the
   * minute clock when the practice-plan door below came onto the same clock (practices
   * re-evaluation stage 5, P3, 2026-09-17): one clock for both windows on this screen.
   * Memoized in two steps — the WINDOWS once per season load (the Intl timezone math when an
   * arrival time is set, one per game, never re-paid on a tick or an unrelated re-render), then
   * the doors once a minute as forty integer comparisons against the clock.
   */
  const nowMs = useMinuteClock();
  const gameDayWindowById = useMemo(() => {
    const map = new Map<string, { opensAtMs: number; closesAtMs: number }>();
    for (const e of events) {
      const shape = toGameDayEventShape(e);
      if (!isGameDayEvent(shape)) continue;
      const window = gameDayWindow(shape);
      if (window) map.set(e.id, window);
    }
    return map;
  }, [events]);
  const gameDayHrefById = useMemo(() => {
    const map = new Map<string, string>();
    for (const [id, w] of gameDayWindowById) {
      if (windowHolds(w, nowMs)) map.set(id, gameDayConsolePath(orgSlug, teamId, id));
    }
    return map;
  }, [gameDayWindowById, orgSlug, teamId, nowMs]);
  const assignment = assignments.find(a => a.teamId === teamId);
  // An assistant who reaches this page read-only must not be handed an "Add Event" button. Fails
  // CLOSED while the assignment resolves — the empty state only renders past the !assignment guard.
  /**
   * Which doors the event panel may show THIS coach on the selected event — the door rows
   * (Attendance, Lineup, Scouting), the score form, the award button, editing — computed once from
   * the grants and read by both the fetch and the panel's markup (the sheet is handed this object),
   * so a row and the read behind it can never disagree. Fails closed while capabilities load. See
   * `lib/coach-schedule-doors.ts`.
   */
  const drawerDoors = scheduleDrawerDoors(page.capabilities, {
    isGame: !!selectedEvent && GAME_EVENT_TYPES.includes(selectedEvent.eventType),
    isLineupEvent: isLineupEvent(selectedEvent),
    hasOpponent: !!selectedEvent?.opponent,
    scoutingAvailable,
  });
  // The page-level create + the panel's Edit / Cancel / Delete — ONE rule, read from the
  // doors object rather than computed a second time beside it (`/review`, 2026-09-10).
  const canAddEvents = drawerDoors.editEvent;
  // `label` is required here — this object also goes straight to openHelp() from the empty state,
  // where there is no HelpButton label to fall back to.
  const scheduleHelpRequest = {
    module: 'coaches' as const,
    sectionIds: ['recipe-premium-schedule', 'recipe-game-day-details'],
    label: 'Schedule',
    fullGuideHref: `/${orgSlug}/coaches/help#recipe-premium-schedule`,
  };

  // ⚠ THE PINNED MASTHEAD IS SERVER-RENDERED BY THE TEAM LAYOUT, AND A LAYOUT DOES NOT RE-RENDER
  // ON CLIENT NAVIGATION. That is what makes it free on every page after the first — and it is
  // also why changing the schedule here would otherwise leave the bar announcing "Game day —
  // Lions, 6:30" for a game the coach just cancelled, for the rest of their session. Every reload
  // after the initial mount means something changed, so it asks the router to re-render the
  // server layout too (client state is preserved — this is a data refresh, not a remount).
  // /review 2026-08-02.
  const router = useRouter();
  const firstLoadRef = useRef(true);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError('');
    if (firstLoadRef.current) firstLoadRef.current = false;
    else router.refresh();
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/events`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const nextEvents: RepTeamEvent[] = data.events ?? [];
      setEvents(nextEvents);
      // Batch 4: compare the mirrored games against what this device last showed the coach. A
      // reschedule keeps their lineup and attendance (those attach to the game, not its time
      // slot) — this is purely so they KNOW. First sight is recorded silently; a flagged move
      // stays up until the coach opens the game.
      const { moved, nextSeen } = diffSeenTimes(nextEvents, readSeenTimes(teamId));
      setMovedGames(moved);
      setAcknowledgedMoves(new Set());
      writeSeenTimes(teamId, nextSeen);
      setDismissedDupes(readDismissedDuplicates(teamId));
      setMismatchIds(new Set<string>(data.lineupMismatchEventIds ?? []));
      setTeamTags(data.tags ?? []);
      setTagsByEventId(data.tagsByEventId ?? {});
      setPlaces(Array.isArray(data.places) ? data.places : []);
      if (data.arrivalDefaults) setArrivalDefaults({ game: data.arrivalDefaults.game ?? null, practice: data.arrivalDefaults.practice ?? null });
      // Tryout sessions are projected onto the calendar as read-only markers. Non-fatal: if this
      // fails the schedule still works, tryout dates just won't show.
      // Tryout markers + real tournament games are both optional read-only overlays keyed only on
      // org/team — fetch them concurrently (one round-trip, not two) and apply each independently.
      const [tryoutRes, gamesRes] = await Promise.allSettled([
        fetch(`/api/coaches/${orgSlug}/teams/${teamId}/tryout-sessions`),
        fetch(`/api/coaches/${orgSlug}/teams/${teamId}/tournament-games`),
      ]);
      if (tryoutRes.status === 'fulfilled' && tryoutRes.value.ok) {
        try { setTryoutSessions((await tryoutRes.value.json()).sessions ?? []); } catch { /* optional */ }
      }
      if (gamesRes.status === 'fulfilled' && gamesRes.value.ok) {
        try { setTournamentGames((await gamesRes.value.json()).games ?? []); } catch { /* optional */ }
      }
      return nextEvents;
    } catch (e: unknown) {
      setError(errorMessage(e, 'Failed to load events'));
    } finally {
      setLoading(false);
    }
  }, [orgSlug, teamId, router]);

  // Player Awards data — separate from fetchEvents (own endpoints), but loaded alongside it so
  // the give-award picker and the slide-over's "Awards given" section are ready without a
  // second round trip when a coach opens a game.
  const fetchAwardData = useCallback(async () => {
    try {
      const [typesRes, awardsRes] = await Promise.all([
        fetch(`/api/coaches/${orgSlug}/teams/${teamId}/award-types`),
        fetch(`/api/coaches/${orgSlug}/teams/${teamId}/awards`),
      ]);
      if (typesRes.ok) setAwardTypes((await typesRes.json()).tags ?? []);
      if (awardsRes.ok) {
        const awardsData = await awardsRes.json();
        setTeamAwards(awardsData.awards ?? []);
        setAwardPlayers(awardsData.players ?? []);
      }
    } catch { /* non-fatal — the schedule still works without award data */ }
  }, [orgSlug, teamId]);

  useEffect(() => {
    void Promise.resolve().then(fetchEvents);
    void Promise.resolve().then(fetchAwardData);
  }, [fetchEvents, fetchAwardData]);

  // ── Batch 4 derived collections ─────────────────────────────────────────────
  // Every DATED tournament game is now a real event on this calendar, so the read-only chip must
  // only render what could NOT be mirrored — an unresolved bracket slot with no start time.
  // Filtering on the mirrored ids (rather than "has a date") also keeps a game visible as a chip
  // in the window between the organizer scheduling it and the next sync landing.
  // Memoised, and declared HERE with the other hooks (above this component's early returns —
  // hooks must run in the same order every render).
  const unmirroredGames = useMemo(() => {
    const mirroredSourceIds = new Set(
      events.map(e => e.sourceTournamentGameId).filter(Boolean) as string[],
    );
    return tournamentGames.filter(g => !mirroredSourceIds.has(g.id));
  }, [events, tournamentGames]);
  const movedEventIds = useMemo(
    () => new Set(movedGames.map(m => m.eventId).filter(id => !acknowledgedMoves.has(id))),
    [movedGames, acknowledgedMoves],
  );
  // The coach's own hand-entered copies of games that now arrive automatically — derived from
  // `events` rather than mirrored into state, so the two can never fall out of step. "Keep both"
  // is remembered, and a pair drops out the moment either side stops existing.
  const duplicatePairs = useMemo(() => findDuplicateSelfEntries(events), [events]);
  // The schedule chip's 🏆 badge — derived from `teamAwards` (already refetched by
  // `fetchAwardData` after every give/edit/remove) rather than the events fetch's own snapshot,
  // which only refreshes on a full reload. Two sources of the same count could disagree the
  // moment either fetch lands first; deriving from one keeps the badge honest right away.
  const awardCountByEventId = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of teamAwards) {
      if (!a.eventId) continue;
      counts[a.eventId] = (counts[a.eventId] ?? 0) + 1;
    }
    return counts;
  }, [teamAwards]);
  const liveDuplicates = useMemo(
    () => duplicatePairs.filter(p => !dismissedDupes.has(p.key)),
    [duplicatePairs, dismissedDupes],
  );

  // Open a deep-linked event once events have loaded (client-only param read — no Suspense needed).
  // Runs once; the coach can freely close or switch events afterwards.
  useEffect(() => {
    if (deepLinkHandledRef.current) return;
    if (loading || events.length === 0) return;
    deepLinkHandledRef.current = true;
    try {
      const sp = new URLSearchParams(window.location.search);
      const eventId = sp.get('event');
      if (!eventId) return;
      const ev = events.find(e => e.id === eventId);
      if (!ev) return;
      // THE ADDRESS GRAMMAR (stage 1 · E5): `?tab=attendance` opens the event WITH THE ROOM OPEN on
      // top — the Overview's four links, Insights' "Take attendance" and the next-step card stay
      // three taps from a saved answer; `?tab=scouting` opens the book's panel; `?tab=lineup` (the
      // builder's way home, §222) and no tab open the sheet itself, the Lineup row on screen one.
      // A view this coach's grants do not open is simply not opened — the sheet shows.
      openEvent(ev, sheetViewFromTab(sp.get('tab')));
      // ⚠ THE ADDRESS BELONGS TO THE SHEET, NOT TO THE PAGE UNDER IT. A commit from now the
      // sheet's floor puts `?event=…` on an entry of its OWN (`sheetAddress`), and gives it back
      // when the coach closes the game. This entry — the one the link, the builder's arrow or a
      // reload landed on — hands the query over now, so closing the game leaves a plain schedule
      // behind instead of an address naming a game that is no longer open (which a reload would
      // then re-open). Silent by construction: the state carries Next's internals, so its patched
      // `replaceState` passes it straight to the browser. Any OTHER param on the address is
      // untouched — `?add=practice` is read by its own effect, which runs after this one.
      // ⚠ THE ORDER IS NOT A COINCIDENCE AND DOES NOT DEPEND ON WHERE THE HOOKS SIT. Opening the
      // sheet is a state change, so its floor cannot push its entry until the NEXT commit — this
      // hand-off has always happened a full commit earlier, which is what lets the step read a
      // plain schedule as the view it must revert to when the coach closes the game.
      sp.delete('event');
      sp.delete('tab');
      const rest = sp.toString();
      window.history.replaceState(window.history.state, '', `${window.location.pathname}${rest ? `?${rest}` : ''}`);
    } catch { /* ignore malformed params */ }
  }, [loading, events]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * THE LIST OPENS ON TODAY (phone re-evaluation stage 2 · C1, owner ruling 2026-09-21 — "open on
   * today's date, not open then scroll; slide up for the past, down for the future"). Before first
   * paint, once per open of the list: the first row whose club-local DAY is on or after today sits
   * directly under its pinned month band, and the coach slides up into the past and down into the
   * future — no scroll to watch. A game that started earlier today is still today's (the DAY
   * decides, never the instant — `pickTodayRow`); a day with nothing lands on the next event; a
   * season with everything behind it opens on its last month, and the spacer under the list is
   * what lets that month reach the top (the empty paper under it is honest — the season ends there).
   * Runs on every LOAD of the list — the first, a return from Week or Month, and the refetch after
   * a save (`fetchEvents` unmounts the list behind "Loading events…", so its scroll position is
   * gone either way; landing on today again beats landing on April).
   * ⚠ Phone only by construction, not by a width check: above 640 the scroller is a plain block
   * (no `overflow`), so the assignment is a no-op there and the desktop keeps April at open —
   * the owner's "phone first" ruling on C1's width question.
   */
  useLayoutEffect(() => {
    if (loading || view !== 'list') return;
    const scroller = scrollerRef.current;
    if (!scroller || getComputedStyle(scroller).overflowY !== 'auto') return;
    const rows = Array.from(scroller.querySelectorAll<HTMLElement>('[data-day]'));
    const at = pickTodayRow(rows.map(r => r.dataset.day ?? ''), tournamentToday());
    if (at < 0) return;
    const row = rows[at];
    const bandH = scroller.querySelector<HTMLElement>('[data-row-band]')?.offsetHeight ?? 0;
    // The row's top inside the scroller — summed up the offset chain, since the row's own
    // offsetParent is the frame, not the scroller.
    let top = 0;
    for (let n: HTMLElement | null = row; n && n !== scroller; n = n.offsetParent as HTMLElement | null) top += n.offsetTop;
    if (tailRef.current) tailRef.current.style.height = `${Math.max(0, scroller.clientHeight - bandH - row.offsetHeight)}px`;
    scroller.scrollTop = Math.max(0, top - bandH);
  }, [loading, view, teamId]);

  // `?add=practice` (practices re-evaluation stage 0, D6): the Practice plans empty state's button
  // opens the Add Practice FORM directly rather than landing the coach on the list two clicks short
  // of it. Its own effect, not a branch of the one above: that one waits for a non-empty events
  // list, and a fresh team — the one case this link exists for — has none. Only for a coach who
  // may add events; anyone else lands on the list as before. Runs once.
  useEffect(() => {
    if (addDeepLinkHandledRef.current) return;
    if (loading || !canAddEvents) return;
    addDeepLinkHandledRef.current = true;
    try {
      const sp = new URLSearchParams(window.location.search);
      if (sp.get('add') === 'practice') openAddForm('practice');
    } catch { /* ignore malformed params */ }
  }, [loading, canAddEvents]); // eslint-disable-line react-hooks/exhaustive-deps

  // Nav-hide + body-scroll-lock while a full-screen modal (detail or the day-list sheet) is open —
  // folded onto the shared CoachesOverlayProvider (Coach Portal Batch 1, Phase 1.2-1.6 sweep) so
  // this page's lock travels with the same lifecycle as every other sheet-owning surface instead
  // of a bespoke local effect. ⚠ NOT the add/edit form: it stands in QuestionShell, which registers
  // its own overlay — counting it here as well double-incremented the shared counter on the
  // expenses panel once, and the nav stayed hidden after the form closed.
  const anyModalOpen = !!selectedEvent || !!daySheet;
  useOverlayOpen(anyModalOpen);

  // ── Add / edit event ────────────────────────────────────────────────────────

  function openAddForm(type: RepEventType, overrides?: Partial<EventForm>) {
    setAddTypeMenuOpen(false);
    setFormInit({ form: seedAddForm(type, { cursorDate, arrivalDefaults, overrides }), editing: null });
  }

  function openEditForm(event: RepTeamEvent) {
    // The form stands where the sheet stood (a modal over a slide-over would be two overlays), so
    // it remembers the game it was opened from and returns there — Back, Cancel, Escape or Save
    // (owner, 2026-09-21: "back … brings me back to the schedule, not back to the game where I
    // came from"). The "+ Add" doors never close a sheet, so they have nothing to return to.
    // Edit details sits in the sheet's foot row, never inside a view (stage 1 · E2), so the coach
    // returns to the sheet itself.
    returnToEventId.current = event.id;
    setSelectedEvent(null);
    setFormInit({
      form: seedEditForm(event, tagsByEventId[event.id] ?? []),
      // Batch 4: editing a mirrored tournament game opens the form in restricted mode — the
      // organizer's facts render as context, only the coach's own fields are editable.
      editing: { eventId: event.id, mirrored: isMirroredEvent(event), recurring: event.isRecurring },
    });
  }

  /** The game the open edit form returns to when it closes — see `openEditForm`. */
  const returnToEventId = useRef<string | null>(null);
  /** Back on the game the form was opened from, if it is still on the calendar. */
  function returnToEvent(list: RepTeamEvent[]) {
    const id = returnToEventId.current;
    returnToEventId.current = null;
    const ev = id ? list.find(e => e.id === id) : null;
    if (ev) openEvent(ev);
  }

  function closeForm(list: RepTeamEvent[]) {
    setFormInit(null);
    returnToEvent(list);
  }

  function openEvent(event: RepTeamEvent, view: SheetView | null = null) {
    setSheetView(view);
    setDaySheet(null);
    setSelectedEvent(event);
    // Opening a moved game IS the acknowledgement — the coach has now seen the new time, so this
    // device stops flagging it. The row's "Moved" chip has to clear in the same breath: writing
    // only to storage would leave it on the calendar until some unrelated action refetched.
    // The sheet reads its moved note from a snapshot taken here, so the detail line still shows this time.
    if (isMirroredEvent(event) && movedGames.some(m => m.eventId === event.id)) {
      acknowledgeSeen(teamId, event.id, event.startsAt);
      setAcknowledgedMoves(prev => new Set(prev).add(event.id));
    }
  }

  // "+N more" in a month cell (and any future day tap): a single event opens its detail
  // straight away; several open a day list (bottom-sheet) so the coach can pick one.
  function openDay(dateKey: string, dayEvents: RepTeamEvent[]) {
    if (dayEvents.length === 0) return;
    if (dayEvents.length === 1) { openEvent(dayEvents[0]); return; }
    setDaySheet({ dateKey, events: dayEvents });
  }

  /**
   * Batch 4 — remove the coach's own hand-entered copy of a game that now arrives from the
   * tournament automatically. Their copy may carry real attendance and a real lineup, so the
   * confirm counts them out loud before anything is deleted; nothing here touches the mirrored
   * game (which isn't theirs to delete anyway).
   */
  async function handleRemoveDuplicate(pair: DuplicateGamePair) {
    const own = events.find(e => e.id === pair.ownId);
    // `saving` is set BEFORE the count fetch below, not after the confirm: the counts take a round
    // trip, and an un-disabled button in that window lets a second click open a second confirm —
    // which hijacks the shared dialog's single resolver slot and leaves the first click hung.
    if (!own || saving) return;
    setSaving(true);
    // Count what goes with it, so the confirm can be specific rather than vaguely ominous.
    let attendanceCount = 0;
    let hasLineup = false;
    try {
      const [attRes, lineupRes] = await Promise.allSettled([
        fetch(`/api/coaches/${orgSlug}/teams/${teamId}/events/${pair.ownId}/attendance`),
        fetch(`/api/coaches/${orgSlug}/teams/${teamId}/events/${pair.ownId}/lineup`),
      ]);
      if (attRes.status === 'fulfilled' && attRes.value.ok) {
        const d = await attRes.value.json();
        attendanceCount = ((d.attendance ?? []) as RepTeamEventAttendance[])
          .filter(a => a.status !== 'unknown').length;
      }
      if (lineupRes.status === 'fulfilled' && lineupRes.value.ok) {
        const d = await lineupRes.value.json();
        hasLineup = Boolean(d.lineup);
      }
    } catch { /* the confirm just stays general — never block the action on a count */ }

    const carried = [
      attendanceCount > 0 ? `its attendance (${attendanceCount} player${attendanceCount === 1 ? '' : 's'})` : null,
      hasLineup ? 'its saved lineup' : null,
    ].filter(Boolean);
    const tail = 'The tournament’s version stays, and you can take attendance and build the lineup on that one instead.';
    const message = carried.length > 0
      ? `${carried.join(' and ')} ${carried.length > 1 ? 'go' : 'goes'} with it. ${tail}`
      : tail;

    try {
      if (!(await confirm({
        title: `Remove your copy of “${own.name}”?`,
        message,
        confirmText: 'Remove it',
        cancelText: 'Cancel',
        tone: 'danger',
      }))) return;
      await deleteEventRequest(orgSlug, teamId, pair.ownId, 'one');
      await fetchEvents();
    } catch (e: unknown) {
      // Surfaced on the page (beside the duplicate notice), not in the slide-over.
      setError(errorMessage(e, 'Could not remove the event'));
    } finally {
      setSaving(false);
    }
  }

  // ── Export ──────────────────────────────────────────────────────────────────

  // The rows and the calendar entries are written in `lib/export/schedule-calendar`, from the
  // instant in the org's zone — see its header for the day-late defect this replaced (D-1).
  function handleExportXLSX() {
    const rows = coachScheduleSheetRows(events);
    const headers = serializeHeaders(SCHEDULE_EXPORT_COLS);
    const data    = serializeRows(rows, SCHEDULE_EXPORT_COLS);
    const filename = buildFilename(
      { org: currentOrg?.slug, dataset: 'schedule', scope: assignment?.teamName },
      'xlsx',
    );
    downloadXLSX(filename, headers, data, 'Schedule');
  }

  function handleExportCSV() {
    const rows = coachScheduleSheetRows(events);
    const headers = serializeHeaders(SCHEDULE_EXPORT_COLS);
    const data    = serializeRows(rows, SCHEDULE_EXPORT_COLS);
    const filename = buildFilename(
      { org: currentOrg?.slug, dataset: 'schedule', scope: assignment?.teamName },
      'csv',
    );
    downloadCSVBlob(filename, generateCSV(headers, data));
  }

  async function handleExportICS() {
    const filename = buildFilename(
      { org: currentOrg?.slug, dataset: 'schedule', scope: assignment?.teamName },
      'ics',
    );
    await downloadICSFromInstants(
      filename,
      coachScheduleCalendarEntries(events, sportPack.id),
      `${assignment?.teamName ?? 'Team'} schedule`,
    );
  }

  // ── Rendering ───────────────────────────────────────────────────────────────

  if (ctxLoading) return <div className={styles.loadingState}>Loading schedule…</div>;
  if (!page.hasAccess) {
    return (
      <div className={styles.notAssigned}>
        <h2>Team not found</h2>
        <p>You are not assigned to this team.</p>
      </div>
    );
  }

  // Navigator helpers for month/week
  function navigate(dir: -1 | 1) {
    const d = new Date(cursorDate + 'T00:00:00');
    if (view === 'month') {
      d.setMonth(d.getMonth() + dir);
    } else {
      d.setDate(d.getDate() + dir * 7);
    }
    const next = d.toISOString().slice(0, 10);
    setCursorDate(next);
    // Month on a phone (C2): the day whose rows sit under the grid must be ON the grid — today
    // when the month is this one, else its first day.
    if (view === 'month') {
      const today = tournamentToday();
      setSelectedDay(today.slice(0, 7) === next.slice(0, 7) ? today : `${next.slice(0, 7)}-01`);
    }
  }

  const curMonth = cursorDate.slice(0, 7);
  const curWeek  = weekKey(cursorDate + 'T00:00:00');

  /** What every event row carries, and what all three views draw from. */
  const rowDecor: ScheduleRowDecor = {
    mismatchIds, awardCountByEventId, movedEventIds, bookRecordFor, gameDayHrefById, openEvent,
  };
  const viewData: ScheduleViewData = {
    events, tryoutSessions, unmirroredGames, sport: sportPack.id, tryoutsHref: `${base}/tryouts`, decor: rowDecor,
  };

  // Page-header ruling 2026-08-11: header actions, extracted so the CoachPageHeader call stays
  // scannable (same shape as the Money panels' headerActions consts).
  /**
   * ⚠ THE HEADER HOLDS THE CREATE AND THE IMPORT (house rules 1 and 4, owner ruling 2026-08-23).
   *
   * Export USED to sit between them and has moved down to the view row. The reasoning is worth
   * keeping because the obvious test gives the wrong answer here: this export takes the whole
   * season in EVERY view, so "its contents vary with what's on screen" — the test that sent
   * Money's exports down to their tabs — says header. House rule 2 is a PLACEMENT rule instead:
   * exports live with their data whether or not their contents vary, so a coach never has to
   * remember which kind of export a screen has.
   */
  const ViewGlyph = VIEW_GLYPH[view];
  const scheduleHeaderActions = (
    <>
      {/* THE VIEW MENU (phone re-evaluation stage 2 · C1, owner ruling 2026-09-21): at ≤640 the
          List · Week · Month toggle is this one glyph beside the create — the CURRENT view's glyph,
          no word, no chevron — opening three radio rows. Rendered at every width and shown by the
          stylesheet at ≤640 only; the kit toolbar's toggle beneath is the ≥641 form (the server
          renders both, CSS decides). Not a create: house rule 4 is about the one create, which
          keeps its corner. Roster's List / Depth chart toggle stays a toggle — two options do not
          earn a menu. */}
      <span className={styles.viewMenuPhone}>
        <CoachToolbarMenu label={`Change view · ${VIEW_WORD[view]}`} icon={<ViewGlyph size={20} aria-hidden />} variant="glyph">
          {VIEW_MODES.map(v => {
            const Glyph = VIEW_GLYPH[v];
            return <CoachToolbarMenuItem key={v} icon={<Glyph size={16} aria-hidden />} label={VIEW_WORD[v]} checked={view === v} onSelect={() => setView(v)} />;
          })}
        </CoachToolbarMenu>
      </span>
      {/* Add event — coach-portal primaries take the shared header geometry (2026-08-23), not
          hand-written sizing. Gated on the same grant as the empty state's CTA: without it the
          events POST 403s, so this was a button that could only ever fail — and once the empty
          state started saying "adding events needs schedule access", leaving it here contradicted
          that outright. */}
      {/* ⚠⚠ **THE LAST HAND-ROLLED COPY OF THIS PATTERN, FOLDED IN (Phase 4b, 2026-08-26).** This
          was the portal's one create-with-a-choice that did not use `CoachToolbarMenu`, and the
          gap was not cosmetic: the hand-rolled panel answered NO key at all and closed only when
          a choice was picked — click the button, click elsewhere, and the menu stayed open over
          the page. It now inherits the whole pattern (arrows, Home/End, Tab, Escape, click-away,
          and the focus hand-back) for free, which is the entire argument for having one component
          rather than four near-copies. */}
      {canAddEvents && (
        <CoachToolbarMenu
          label="Add Event"
          icon={<Plus size={15} aria-hidden />}
          variant="primary"
          /* House rule 3: the words go on a phone and the label survives as the accessible name. */
          collapseOnPhone
          /* And the chevron goes with them (stage 2 · C1, owner 2026-09-21): the lime square is the
             add door on every list in the portal; the six-type menu is unchanged behind it. */
          bareOnPhone
          /* Controlled, because the empty state's own "Add Event" opens THIS menu — see the prop's
             note. Every other caller in the portal leaves the menu to own its state. */
          open={addTypeMenuOpen}
          onOpenChange={setAddTypeMenuOpen}
        >
          {ADD_MENU.map(({ type, nested }) => {
            const Icon = EVENT_ICONS[type];
            return (
              <CoachToolbarMenuItem
                key={type}
                nested={nested}
                /* The per-type colour is set on the icon itself, so it beats the shared slot's
                   olive without either one having to know about the other. */
                icon={<Icon size={15} style={{ color: EVENT_COLORS[type] }} />}
                label={EVENT_LABELS[type]}
                onSelect={() => openAddForm(type)}
              />
            );
          })}
        </CoachToolbarMenu>
      )}
      {/* House rule 1 — picking a file is desktop work, so this hides below 640px while the
          create keeps the corner. Gated on the same grant as Add Event; a read-only assistant
          sees neither. The path is not lost on a phone: the empty state keeps its own import
          door at every width, which is the condition the rule depends on. */}
      {canAddEvents && (
        <span className={styles.headerActionWideOnly}>
          <button
            className={styles.btnSecondary}
            onClick={() => { setImportToast(''); setImportOpen(true); }}
          >
            <Upload size={14} aria-hidden /> Import
          </button>
        </span>
      )}
    </>
  );

  /**
   * House rule 2 — the export sits above what it exports, pinned right in the view row, at every
   * width.
   *
   * ⚠ ON A PHONE THE MARK IS A CALENDAR, NOT A DOWNLOAD ARROW. The two spreadsheets drop out and
   * the only survivor writes the season into the phone's own calendar rather than dropping a file
   * in a downloads folder — a download arrow would promise the wrong thing for the single most
   * useful control on this screen at 390px. The rule is unchanged (a toolbar control is icon-only
   * on a phone); the icon follows the ACTION.
   */
  /* One document in three file types, so no document picker — just the list (owner ruling
     2026-08-24: a dropdown with one option is worse than no dropdown). And no hints: a row
     is its name and its extension. "Calendar .ics" is the one that does something other than
     drop a file in Downloads, and the trigger already says so on a phone by swapping the
     download arrow for a calendar mark. ONE list for both forms of the control (the toolbar's
     button above 640, the quiet row under the list at ≤640). */
  const scheduleExportChoices = [
    { id: 'xlsx', name: 'Excel', ext: '.xlsx', run: handleExportXLSX },
    { id: 'csv', name: 'CSV', ext: '.csv', run: handleExportCSV },
    { id: 'ics', name: 'Calendar', ext: '.ics', phone: 'keep' as const, run: handleExportICS },
  ];
  const scheduleExport = (
    <CoachExportButton
      label="Schedule"
      disabled={events.length === 0}
      phoneIcon={<CalendarPlus size={14} />}
      choices={scheduleExportChoices}
    />
  );

  return (
    <div className={`${styles.page} ${styles.pageWide} ${styles.schedulePage}`}>
      {/* Header (page-header ruling 2026-08-11): "Schedule" — the name the nav already uses;
          "Team Calendar" said "team" (the masthead's job) and disagreed with its own menu item.
          Actions right, "?" in its fixed corner; the view switcher rides the views below. */}
      <CoachPageHeader
        icon={Calendar}
        title="Schedule"
        actions={scheduleHeaderActions}
        /* House rule 4: the one create keeps the title line's corner beside the "?" on a phone —
           and since stage 2 · C1 the view menu sits there with it, for every coach: a read-only
           assistant has no create and no import, but still switches views, so the row never
           drops (the create gates itself on `canAddEvents`; `actionsPhoneHidden` would take the
           view menu with it). */
        actionsPhoneInTitleRow
        helpLabel="Schedule"
        help={scheduleHelpRequest}
      />

      {/* List | Week | Month — a view switcher is not an action: it rides the body it switches
          (ruling 2026-08-11), exactly where Roster's List/Depth-chart toggle already lives. */}
      {/* The kit's list toolbar (components/coaches/kit, 2026-09-16): the view toggle leads, the
          export is pinned right — the row every list in the portal draws. ≥641 only since stage 2
          · C1: on a phone the switch is the glyph in the title row and the export is the quiet row
          under the list — the 59px this row cost on every open. */}
      <CoachListToolbar actions={scheduleExport} className={styles.scheduleToolbarWide}>
        <div className={styles.viewToggle}>
          {(['list', 'week', 'month'] as ViewMode[]).map(v => (
            <button
              key={v}
              className={`${styles.viewToggleBtn} ${view === v ? styles.viewToggleBtnActive : ''}`}
              onClick={() => setView(v)}
            >
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </CoachListToolbar>

      {/* Batch 4 — the hand-entered duplicates. Coaches worked around the missing tools by typing
          their tournament games in themselves; now the real ones arrive automatically, those teams
          have two rows for one game and BOTH count toward the record. We name the collision and
          offer a one-tap fix — never a silent merge, because their copy may hold real attendance
          and a real lineup. "Keep both" is a genuine answer and is remembered. */}
      {!loading && liveDuplicates.length > 0 && (
        <div className={styles.dupeNotice} role="status">
          {liveDuplicates.slice(0, 1).map(pair => {
            const mirror = events.find(e => e.id === pair.mirrorId);
            const own = events.find(e => e.id === pair.ownId);
            if (!mirror || !own) return null;
            return (
              <div key={pair.key} className={styles.dupeNoticeBody}>
                <p className={styles.dupeNoticeHead}>
                  This game now comes from {mirror.name} automatically
                </p>
                <p className={styles.dupeNoticeText}>
                  You also added &ldquo;{own.name}&rdquo; yourself on {fmtDate(own.startsAt)}. Keeping both counts it twice in your record.
                  {liveDuplicates.length > 1 && ` (${liveDuplicates.length - 1} more like this.)`}
                </p>
                <div className={styles.dupeNoticeActions}>
                  <button type="button" className={styles.btnPrimary} disabled={saving} onClick={() => void handleRemoveDuplicate(pair)}>Remove my copy</button>
                  <button
                    type="button"
                    className={styles.btnGhost}
                    onClick={() => { dismissDuplicate(teamId, pair.key); setDismissedDupes(readDismissedDuplicates(teamId)); }}
                  >
                    Keep both
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* What an import just did — above the calendar it changed, not adrift at the page foot. */}
      {importToast && (
        <p className={styles.importResult} role="status">{importToast}</p>
      )}

      {loading && <div className={styles.loadingState}>Loading events…</div>}
      {!loading && error && <p className={styles.errorText}>{error}</p>}

      {/* THE CALENDAR BODY — on a phone, THE SCROLLER (stage 2 · C1, owner ruling 2026-09-21): the
          list, Week and Month live in this box between the title row and the bar, and it is what
          scrolls; the document does not (the chat room's construction — `data-schedule-scroller`
          is what the global page-scroll lock keys on at ≤640). The month band pins at its top; it
          opens positioned on today; "+" and the view menu never move. Above 640 it is a plain
          block and the page scrolls as a document, exactly as before. */}
      <div ref={scrollerRef} className={styles.scheduleScroller} data-schedule-scroller>
      {/* Navigator for week/month */}
      {view !== 'list' && (
        <div className={styles.calNav}>
          <button className={styles.calNavBtn} onClick={() => navigate(-1)}><ChevronLeft size={16} /></button>
          <span className={styles.calNavLabel}>
            {view === 'month'
              ? new Date(curMonth + '-01T00:00:00').toLocaleDateString('en-CA', { month: 'long', year: 'numeric' })
              : (() => {
                const start = new Date(curWeek + 'T00:00:00');
                const end = new Date(curWeek + 'T00:00:00');
                end.setDate(end.getDate() + 6);
                return `${start.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}`;
              })()
            }
          </span>
          <button className={styles.calNavBtn} onClick={() => navigate(1)}><ChevronRight size={16} /></button>
        </div>
      )}

      {!loading && !error && (
        view === 'list'  ? <ScheduleListView data={viewData} canAddEvents={canAddEvents} onAddEvent={() => setAddTypeMenuOpen(true)} onHelp={() => openHelp(scheduleHelpRequest)} />
        : view === 'week'  ? <ScheduleWeekView data={viewData} curWeek={curWeek} />
        : <ScheduleMonthView data={viewData} curMonth={curMonth} selectedDay={selectedDay} onSelectDay={setSelectedDay} onOpenDay={openDay} />
      )}
      {/* The export as a quiet row under the list (C1; ≤640 only by the stylesheet): the same
          control, the same chooser — the toolbar above keeps the desktop's button. */}
      {!loading && !error && view === 'list' && events.length > 0 && (
        <div className={styles.scheduleExportRow}>
          <CoachRowListFoot>
            <CoachExportButton variant="row" label="Schedule" choices={scheduleExportChoices} />
          </CoachRowListFoot>
        </div>
      )}
      {/* The spacer that lets the last month reach the top of the scroller (sized by the
          open-on-today effect from the scroller's own height; 60vh until it has run). */}
      {view === 'list' && <div ref={tailRef} className={styles.scheduleTail} aria-hidden />}
      </div>

      {/* ── Day list (mobile month-cell tap) ──────────────────────────────── */}
      {daySheet && (
        <div className={`${styles.modalOverlay} ${styles.daySheetOverlay}`} onPointerDown={e => { if (e.target === e.currentTarget) (() => setDaySheet(null))?.(); }}>
          <div className={styles.daySheet} onClick={e => e.stopPropagation()}>
            <div className={styles.daySheetHeader}>
              <h2 className={styles.daySheetTitle}>
                {new Date(`${daySheet.dateKey}T00:00:00`).toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' })}
              </h2>
              <button className={styles.modalCloseBtn} aria-label="Close" onClick={() => setDaySheet(null)}>
                <X size={18} />
              </button>
            </div>
            <div className={styles.calEventList}>
              {sortDayEvents(daySheet.events).map(e => (
                <ScheduleEventChip key={e.id} event={e} decor={rowDecor} dayKey={daySheet.dateKey} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Detail slide-over ─────────────────────────────────────────────── */}
      {/* One sheet per event: keyed on the event, so opening another starts clean — its view, the
          room's filter, a half-typed score, the award dialog. The RSVP sheet is the sheet's own sibling. */}
      {selectedEvent && (
        <ScheduleEventSheet
          key={selectedEvent.id}
          orgSlug={orgSlug}
          teamId={teamId}
          base={base}
          event={selectedEvent}
          initialView={sheetView}
          isPhone={isPhone}
          nowMs={nowMs}
          sportPack={sportPack}
          capabilities={page.capabilities}
          drawerDoors={drawerDoors}
          places={places}
          teamTags={teamTags}
          tagIds={tagsByEventId[selectedEvent.id] ?? []}
          teamAwards={teamAwards}
          awardTypes={awardTypes}
          awardPlayers={awardPlayers}
          moved={movedGames.find(m => m.eventId === selectedEvent.id) ?? null}
          mirroredGameHref={selectedEvent.sourceTournamentGameId
            ? tournamentGames.find(g => g.id === selectedEvent.sourceTournamentGameId)?.href ?? null
            : null}
          bookEntry={selectedEvent.opponent ? bookByKey.get(normalizeOpponentName(selectedEvent.opponent)) ?? null : null}
          gameDayLive={gameDayHrefById.has(selectedEvent.id)}
          onClose={() => setSelectedEvent(null)}
          onEdit={openEditForm}
          onAddGame={ev => {
            setSelectedEvent(null);
            // Seed the game on the tournament's start day so it lands inside the span.
            const start = `${ev.startsAt ? dayStr(ev.startsAt) : cursorDate}T${DEFAULT_EVENT_HOUR}`;
            openAddForm('tournament_game', {
              parentEventId: ev.id,
              name: `${ev.name} – Game`,
              startsAt: start,
              endsAt: addHoursLocal(start, 2),
            });
          }}
          onEventChanged={setSelectedEvent}
          onDeleted={() => setSelectedEvent(null)}
          refresh={fetchEvents}
          onBookChanged={() => { void loadBook(); }}
          onAwardsChanged={() => { void fetchAwardData(); }}
        />
      )}

      {/* ── Schedule import (Chunk C, P1 #7) ───────────────────────────────── */}
      {importOpen && (
        <ScheduleImportSheet
          orgSlug={orgSlug}
          teamId={teamId}
          // Resolved to the ORG'S calendar day + clock here, because that is the day the coach's
          // spreadsheet means. A raw UTC slice would put every evening game on the wrong date and
          // so match the wrong row (C0).
          existing={events.map(e => {
            const zoned = utcToZonedInputs(e.startsAt);
            return {
              id: e.id,
              eventType: e.eventType,
              day: zoned.date,
              time: zoned.time,
              opponent: e.opponent ?? null,
              name: e.name,
              location: e.location ?? null,
              isMirrored: isMirroredEvent(e),
            };
          })}
          onClose={() => setImportOpen(false)}
          onImported={({ created, updated }) => {
            setImportOpen(false);
            setImportToast(
              [created ? `${created} added` : '', updated ? `${updated} updated` : '']
                .filter(Boolean).join(' · ') || 'Schedule updated',
            );
            void fetchEvents();
          }}
        />
      )}

      {/* ── Add / edit event modal ─────────────────────────────────────────── */}
      {formInit && (
        <ScheduleEventForm
          orgSlug={orgSlug}
          teamId={teamId}
          sport={sportPack.id}
          init={formInit}
          events={events}
          places={places}
          teamTags={teamTags}
          onTagCreated={tag => setTeamTags(t => [...t, tag])}
          bookEntries={bookEntries}
          clubSpellings={clubSpellings}
          loadBook={loadBook}
          refresh={fetchEvents}
          onCancel={() => closeForm(events)}
          onCreated={async () => { setFormInit(null); await fetchEvents(); }}
          onUpdated={refreshed => closeForm(refreshed)}
        />
      )}
    </div>
  );
}
