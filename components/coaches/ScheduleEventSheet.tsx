'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, ChevronRight, ClipboardList, ExternalLink, Eye, FileText, Link2, ListOrdered, MapPin, Pencil, Trash2, Trophy, Users, Video, X } from 'lucide-react';
import { EVENT_ICONS, EVENT_COLORS } from '@/components/coaches/eventTypeMark';
import UnsavedChangesGuard from '@/components/coaches/UnsavedChangesGuard';
import { useConfirm } from '@/components/coaches/ConfirmProvider';
import { useDialogFloor } from '@/components/coaches/useDialogFloor';
import { useBackStep } from '@/components/coaches/useBackStep';
import { CoachRowList, CoachRow } from '@/components/coaches/CoachRowList';
import GiveAwardModal from '@/components/coaches/GiveAwardModal';
import OpponentScoutingPanel from '@/components/coaches/OpponentScoutingPanel';
import CoachRsvpSheet from '@/components/coaches/CoachRsvpSheet';
import CoachModalHeader from '@/components/coaches/CoachModalHeader';
import GuardedDelete from '@/components/coaches/GuardedDelete';
import { CoachToolbarMenu, CoachToolbarMenuItem } from '@/components/coaches/CoachToolbarMenu';
import ScheduleAttendanceRoom, { type AttendanceRoomRow } from '@/components/coaches/ScheduleAttendanceRoom';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';
import { formatStoredClock as fmtClock } from '@/lib/utils';
import { surfaceLabel, type SportPack } from '@/lib/sports';
import type { ScheduleDrawerDoors } from '@/lib/coach-schedule-doors';
import type { CoachCapabilities } from '@/lib/coach-capabilities';
import { canWritePracticePlans } from '@/lib/coach-capabilities';
import { summarizePracticePlan } from '@/lib/rep-practice-plan';
import { practiceHasPlan } from '@/lib/practice-state';
import { cleanNamePart, playerDisplayName, playerName } from '@/lib/coach-roster-name';
import { isMirroredEvent, type MovedGame } from '@/lib/coach-tournament-games';
import { gameHasStarted } from '@/lib/coach-game-day';
import { awardEventKind, awardOccasionLabel, awardUnlockState } from '@/lib/rep-award-occasion';
import { lineupBuilderHref } from '@/lib/lineups-address';
import { sheetOrder } from '@/lib/coach-schedule-phone';
import { normalizeOpponentName, recordChip, type OpponentBookEntry } from '@/lib/coach-opponents';
import { orgDayKey } from '@/lib/timezone';
import { SERIES_EDIT_ROWS, reachHint, type SeriesReach, type SeriesScope } from '@/lib/coach-series-scope';
import { scheduleDayLabel } from '@/lib/family-schedule-format';
import { EVENT_DELETE_TAKES, EVENT_LABELS, SCRIMMAGE_LABEL, eventWord } from '@/lib/coach-schedule-vocab';
import { GAME_EVENT_TYPES, errorMessage, fmtDate, fmtTime, isLineupEvent, resultColor, shortDate } from '@/lib/coach-schedule-view';
import {
  attendanceRowWords, lineupDoor, lineupRowWords, scoutingRowWords, sheetAddressFor,
  type LineupMismatch, type RowLinePart, type RowPlayer, type SheetView,
} from '@/lib/coach-schedule-sheet';
import type {
  RepAttendanceStatus,
  RepRosterPlayer,
  RepTeamEvent,
  RepTeamEventAttendance,
  RepTeamLineupEntry,
  RepTeamTag,
  RepTeamPlace,
  RepTeamAwardType,
  RepPlayerAward,
} from '@/lib/types';

/**
 * THE SCHEDULE'S EVENT SHEET — one event's summary and its jobs, over the calendar (the Schedule
 * deep dive, stage 1 · E1–E6, owner ruling 2026-09-25: every ask "as drawn").
 *
 * ONE SHAPE ON EVERY EVENT, AT EVERY WIDTH (E1, E6). What, when and where on top; then the event's
 * JOBS as door rows — Attendance, Lineup, Scouting, a practice's plan — each a 64px row of the
 * portal's row recipe whose second line says where the job stands; then the foot row. The owner's
 * triggering complaint was that a practice and a game were two shapes (an inline list vs three
 * tabs); they now differ only in which rows they have. The tabs, the look-only lineup peek with its
 * inning flip, the separate lineup-warning box and its 97×15px link are gone (E3, E4).
 *
 * ATTENDANCE HAS ITS OWN ROOM (E2): the row opens a VIEW inside this same dialog — full screen on a
 * phone, the dialog's body at a desk — with the whole roster on screen one. Scouting opens the same
 * way. A view is ONE Back level (§219) with its own address (§222): Back, its arrow and Escape
 * return to the event; Back again leaves the event. `?tab=attendance` opens the room, so the
 * Overview's links, Insights' "Take attendance" and the next-step card still land three taps from a
 * saved answer (E5).
 *
 * It owns what exists only while one event is open — its attendance list and the autosave behind
 * it, the lineup facts the Lineup row reads, a score being typed, the delete question, the award
 * dialog, the RSVP sheet — and opens fresh for each event (the page keys it on the event's id). The
 * page keeps the season: the events, the book, the awards, the capabilities and the fetches.
 */

/** A roster player as a door row names them — "#12 Logan". */
function rowPlayer(p: RepRosterPlayer): RowPlayer {
  return { firstName: cleanNamePart(p.playerFirstName) || playerName(p), number: p.playerNumber ?? null };
}

/** A row's second line, each part in its tone (Out in the danger ink, Late in the warning ink). */
function RowLine({ parts }: { parts: RowLinePart[] }) {
  return (
    <>
      {parts.map((p, i) => (
        <span key={i}>
          {i > 0 && ' · '}
          <span className={styles.sheetDoorTone} data-tone={p.tone ?? undefined}>{p.text}</span>
        </span>
      ))}
    </>
  );
}

/** The played-game scoreline + W/L/T badge. One fragment, shared by the editable (self-entered)
 *  and read-only (organizer-owned) score lines so they can never drift apart visually. */
function scoreline(event: RepTeamEvent) {
  return (
    <>
      <span className={styles.eventScoreValue}>{event.teamScore} – {event.opponentScore}</span>
      {event.result && (
        <span className={styles.resultBadge} style={{ color: resultColor(event.result) }}>
          {event.result.toUpperCase()}
        </span>
      )}
    </>
  );
}

// Google Maps deep link for a place/address. The lightweight `?q=` form 302-redirects straight
// to the result; the heavier `/maps/search/?api=1` web-app URL can open to a blank, perpetually
// loading tab (fresh tab with no Google session / a consent gate), so we use `?q=` here.
function mapsHref(query: string): string {
  return `https://www.google.com/maps?q=${encodeURIComponent(query)}`;
}

// Pick a recognizable icon for a resource link from its URL (video / map / doc / generic).
function resourceIcon(url: string): React.ElementType {
  const u = url.toLowerCase();
  if (/youtube\.com|youtu\.be|vimeo\.com/.test(u)) return Video;
  if (/maps\.google|google\.[a-z.]+\/maps|maps\.app\.goo\.gl|goo\.gl\/maps/.test(u)) return MapPin;
  if (/docs\.google|drive\.google|sheets\.google|\.pdf(\?|$)|notion\.so|dropbox\.com/.test(u)) return FileText;
  return Link2;
}

/** A series' three delete answers and the scope each sends. (The pencil's menu words its rows by the event —
 *  "This practice only · All practices", `SERIES_EDIT_ROWS`; aligning Delete's is an owner call, raised 2026-10-09.) */
const SERIES_DELETE = [['This only', 'one'], ['This & future', 'remaining'], ['All', 'all']] as const;

/** DELETE one event. Shared by the sheet's Delete and the page's duplicate-game "Remove my copy"
 *  flow, which surface the error in different places. Refreshing is the CALLER's job — the sheet
 *  must close the instant the delete succeeds, not sit open through a full refetch. */
export async function deleteEventRequest(orgSlug: string, teamId: string, eventId: string, scope: SeriesScope) {
  const res = await fetch(
    `/api/coaches/${orgSlug}/teams/${teamId}/events/${eventId}?scope=${scope}`,
    { method: 'DELETE' },
  );
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Delete failed');
}

export default function ScheduleEventSheet({
  orgSlug, teamId, base, event: ev, initialView, isPhone, nowMs, sportPack, capabilities, drawerDoors,
  places, teamTags, tagIds, teamAwards, awardTypes, awardPlayers, moved: selectedMoved, mirroredGameHref,
  bookEntry, gameDayLive, familiesSeeSchedule, seriesReach,
  onClose, onEdit, onAddGame, onEventChanged, onDeleted, refresh, onBookChanged, onAwardsChanged,
}: {
  orgSlug: string;
  teamId: string;
  /** The team root, `/{org}/coaches/teams/{id}`. */
  base: string;
  event: RepTeamEvent;
  /** The view the sheet opens with — the deep link's `?tab=` (`sheetViewFromTab`) — or none. */
  initialView: SheetView | null;
  /** ≤640 — the page's own reading, settled before any sheet opens. */
  isPhone: boolean;
  /** The page's minute clock. */
  nowMs: number;
  sportPack: SportPack;
  capabilities: CoachCapabilities | undefined;
  /** Which doors this coach may see on this event — the page's one answer (`scheduleDrawerDoors`). */
  drawerDoors: ScheduleDrawerDoors;
  places: RepTeamPlace[];
  teamTags: RepTeamTag[];
  /** The tags this event carries. */
  tagIds: string[];
  teamAwards: RepPlayerAward[];
  awardTypes: RepTeamAwardType[];
  awardPlayers: { id: string; name: string; number: string | null }[];
  /** Batch 4: the organizer moved this game since this device last showed it. */
  moved: MovedGame | null;
  /** The public game page for a mirrored game, when the tournament is publicly visible. */
  mirroredGameHref: string | null;
  /** The Scouting Book's entry for this game's opponent, when the book has one. */
  bookEntry: OpponentBookEntry | null;
  /** The game-day window holds right now — Game day runs live, not as a recap. */
  gameDayLive: boolean;
  /** Families can see this team's schedule — a cancel or restore tells them, so it asks once first. */
  familiesSeeSchedule: boolean;
  /** A repeating event's dates, per answer (null on a one-off): the pencil asks which before the form opens. */
  seriesReach: SeriesReach | null;
  onClose: () => void;
  /** The head's pencil — opens the edit form for the dates chosen (a series: the days its menu row named), and the form
   *  returns to this event when it closes. */
  onEdit: (event: RepTeamEvent, scope?: SeriesScope, dates?: readonly string[]) => void;
  /** A tournament's "+ Add game". */
  onAddGame: (event: RepTeamEvent) => void;
  /** A save changed the event (a score, cancel / restore) — the fresh record. */
  onEventChanged: (event: RepTeamEvent) => void;
  onDeleted: () => void;
  /** The page's refetch of the season. */
  refresh: () => Promise<unknown>;
  /** The book's record vs this opponent changed (a score was saved). */
  onBookChanged: () => void;
  onAwardsChanged: () => void;
}) {
  const confirm = useConfirm();
  /** The view open inside the sheet — the attendance room, the scouting panel — or none. */
  const [view, setView] = useState<SheetView | null>(initialView);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  /** Cancel / Restore's one question, docked in the foot in place of its controls (it tells families). */
  const [cancelAsk, setCancelAsk] = useState(false);
  /** A failed cancel, restore or delete — said in the foot, where it was pressed. */
  const [footError, setFootError] = useState('');
  /** Ask only for what this coach's grants open (the same answer the rows read). */
  const wantsRead = drawerDoors.lineupTab || drawerDoors.attendanceTab;
  const [attendanceRows, setAttendanceRows] = useState<AttendanceRoomRow[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(wantsRead);
  const [attendanceSaving, setAttendanceSaving] = useState(false);
  const [attendanceDirty, setAttendanceDirty] = useState(false);
  const [attendanceError, setAttendanceError] = useState('');
  // Attendance metric-filter ('all' or a status) — the room's chips.
  const [attendanceFilter, setAttendanceFilter] = useState<RepAttendanceStatus | 'all'>('all');
  // Which player's RSVP SHEET is open (one at a time; stage 2 · C3 — it used to be an inline
  // editor under the row). null = closed.
  const [rsvpEditId, setRsvpEditId] = useState<string | null>(null);
  // The attendance row that opened it — focus goes home to it (a tap on iOS never focused it).
  const rsvpOpenerRef = useRef<HTMLElement | null>(null);
  // Whether a lineup is SAVED (any position set), and which players it holds — what the Lineup row
  // reads, and what flags attendance ↔ lineup drift. The look-only peek that rendered the order
  // retired with the tabs (E3): the builder's first screen IS the order, one inning at a time.
  const [hasLineup, setHasLineup] = useState(false);
  const [lineupEntryIds, setLineupEntryIds] = useState<Set<string>>(new Set());
  const [scoreForm, setScoreForm] = useState<{ teamScore: string; opponentScore: string } | null>(null);
  const [giveAwardOpen, setGiveAwardOpen] = useState(false);
  // Editing an already-given award (Awards One Tag Idiom Part A) reuses the give form — null
  // when the modal is giving a NEW award instead.
  const [editingAward, setEditingAward] = useState<RepPlayerAward | null>(null);
  const [awardBusyId, setAwardBusyId] = useState<string | null>(null);
  const [awardActionError, setAwardActionError] = useState('');

  const isGameEvent = GAME_EVENT_TYPES.includes(ev.eventType);
  // Scouting Book glance (owner-approved 2026-08-04): games with a real opponent name only —
  // a TBD bracket slot gets no Scouting row, never a dead end. Read gates on `schedule`, which is
  // everyone who can open this page — helpers included, by ruling.
  const scoutingKey = drawerDoors.scoutingTab && ev.opponent
    ? normalizeOpponentName(ev.opponent)
    : '';
  /**
   * ⚠ EVERY VIEW RIDES A GRANT (staff access review, 2026-09-10 — the rule the tabs kept). A view
   * the address names but this coach's grants do not open is simply not open: the sheet shows, and
   * the row that would open it is absent too. The RAW `view` stays as asked, so a grant that loads
   * a moment late opens the room it named.
   */
  const openView: SheetView | null =
    view === 'attendance' && drawerDoors.attendanceTab ? 'attendance'
      : view === 'scouting' && scoutingKey ? 'scouting'
        : null;
  const closeView = () => setView(null);

  // The slide-over is declared a modal dialog (role + aria-modal, stage 0 · A4) — so it stands on
  // the same floor as RoomShell and QuestionShell (/review 2026-09-20): Escape closes through the
  // same door as the X (a pending attendance edit is flushed first), Tab stays inside, focus lands
  // on the panel and returns to the opener. Declaring modal without this told a screen reader the
  // page behind was inert while keyboard focus could still wander into it.
  const slideOverRef = useRef<HTMLDivElement | null>(null);
  /**
   * THE OPEN GAME IS A PLACE (owner, 2026-09-22 — "browser back skips the game"). The sheet's
   * floor names its ADDRESS: `?event=…`, the address the page reopens a game from (its deep link).
   * Every door out of the sheet leads to another PAGE — the builder, Game day, the practice plan —
   * and Back out of one of them lands on the game, not the bare schedule. `useBackStep` writes it
   * silently and takes it away again when the sheet is CLOSED, so a live address always means a
   * sheet is open.
   * ⚠ ESCAPE GOES UP ONE LEVEL TOO (E2): with a view open it closes the view; the RSVP sheet on top
   * of the room has a floor of its own and answers first.
   */
  const sheetAddress = sheetAddressFor(base, ev.id, null);
  useDialogFloor(true, slideOverRef, {
    onClose: () => { if (openView) closeView(); else void requestCloseSlideOver(); },
    address: sheetAddress,
    // A view swapping in or out unmounts the control that had focus; re-seat it on the panel.
    focusKey: openView ?? 'sheet',
  });
  /**
   * THE VIEW IS ONE LEVEL MORE (§219, E2), and a PLACE of its own (§222): `?event=…&tab=attendance`
   * — the address the Overview's links already open. Back pops it to the event; Back again leaves
   * the event. ⚠ DECLARED AFTER THE FLOOR, IN THE SAME COMPONENT, ON PURPOSE: a deep link opens the
   * sheet and the room in one commit, and effects run in declaration order — the sheet's entry is
   * pushed first and the room's stands on top of it. Moved to a child, the room's would run first
   * and Back would close the whole event instead of the room.
   */
  /*
   * ⚠⚠ AND ON ARRIVAL THE VIEW'S STEP WAITS ONE COMMIT (found driving the Overview's "1 out" link,
   * 2026-09-25). A link that opens the sheet AND the room mounts both steps in one commit, and React's
   * strict mode (on in dev by default) mounts every effect twice: the sheet's first step and the
   * room's first step are pushed, both are torn down, and the sheet's second step takes over the
   * ROOM's dead entry — inheriting the room's home (the event's own address) instead of the page's.
   * The sheet's first entry was left behind as a dead one, so Back from the event closed it but
   * stayed on `?event=…`, and a third Back was needed to reach the schedule. Arming the view's step
   * after the sheet's has settled keeps one step per commit, the shape every tapped-open view has
   * always had: the room is on screen from the first paint; only its history entry follows a
   * commit later.
   */
  const [viewStepArmed, setViewStepArmed] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- a deliberate one-commit deferral (above)
  useEffect(() => { setViewStepArmed(true); }, []);
  useBackStep(!!openView && viewStepArmed, closeView, openView ? sheetAddressFor(base, ev.id, openView) : null);
  // A view opens at its top, and the event reads from its top again when the view closes.
  useLayoutEffect(() => {
    if (slideOverRef.current) slideOverRef.current.scrollTop = 0;
  }, [openView]);

  const attendanceSig = () => JSON.stringify(attendanceRows.map(r => [r.player.id, r.status, r.note]));
  const attendanceSigRef = useRef('');
  useEffect(() => { attendanceSigRef.current = attendanceSig(); }, [attendanceRows]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save attendance ~0.7s after the last change (a status tap is meant to stick).
  useEffect(() => {
    if (!attendanceDirty || attendanceSaving || attendanceLoading || attendanceRows.length === 0) return;
    const t = setTimeout(() => { void handleAttendanceSave(); }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attendanceDirty, attendanceSaving, attendanceRows]);

  useEffect(() => {
    let cancelled = false;
    const eventId = ev.id;
    // Ask only for what this coach's grants open (the same answer the rows read). A refused read
    // used to be swallowed here and rendered as "add players to the roster first" — a false
    // statement about the team, made to a helper who was never going to see the list.
    const wantLineup = drawerDoors.lineupTab;
    const wantAttendance = drawerDoors.attendanceTab;

    async function fetchAttendance() {
      if (!wantLineup && !wantAttendance) {
        setAttendanceRows([]);
        setHasLineup(false);
        setLineupEntryIds(new Set());
        setAttendanceError('');
        setAttendanceDirty(false);
        setAttendanceLoading(false);
        return;
      }
      setAttendanceLoading(true);
      setAttendanceError('');
      setAttendanceDirty(false);
      try {
        const lineupCapable = wantLineup;
        const res = await fetch(
          lineupCapable
            ? `/api/coaches/${orgSlug}/teams/${teamId}/events/${eventId}/lineup`
            : `/api/coaches/${orgSlug}/teams/${teamId}/events/${eventId}/attendance`,
        );
        if (!res.ok) {
          const d = await res.json().catch(() => ({ error: res.statusText }));
          throw new Error(d.error ?? 'Failed to load event details');
        }
        const data: {
          players?: RepRosterPlayer[];
          callUps?: RepRosterPlayer[];
          attendance?: RepTeamEventAttendance[];
          entries?: RepTeamLineupEntry[];
        } = await res.json();
        if (cancelled) return;

        /**
         * ⚠⚠ **THIS GAME'S CALL-UPS BELONG IN THE PLAYER LIST (mig 309).** A call-up borrowed for
         * this game is on its attendance and may hold a spot in its lineup; leaving them out of the
         * list made the peek (retired with the tabs, E3) read a batting order that was not the saved
         * one, and it would make the Lineup row's check read a call-up in the lineup as nobody at
         * all. The builder carries the identical rule. Found by `/review`.
         */
        const players = [...(data.players ?? []), ...(data.callUps ?? [])];
        const attendanceByPlayer = new Map((data.attendance ?? []).map(row => [row.playerId, row]));
        setAttendanceRows(players.map(player => {
          const existing = attendanceByPlayer.get(player.id);
          return {
            player,
            status: existing?.status ?? 'unknown',
            note: existing?.note ?? '',
          };
        }));
        if (lineupCapable) {
          const entries = data.entries ?? [];
          setHasLineup(entries.some(e => Object.values(e.inningPositions ?? {}).some(Boolean)));
          setLineupEntryIds(new Set(entries.map(e => e.playerId)));
        } else {
          setHasLineup(false);
          setLineupEntryIds(new Set());
        }
      } catch (e: unknown) {
        if (!cancelled) setAttendanceError(errorMessage(e, 'Failed to load attendance'));
      } finally {
        if (!cancelled) setAttendanceLoading(false);
      }
    }

    fetchAttendance();
    return () => { cancelled = true; };
  }, [orgSlug, ev, teamId, drawerDoors.lineupTab, drawerDoors.attendanceTab]);

  // Removing an already-given award (Awards One Tag Idiom Part A) — the same undo-a-mis-click
  // confirm the season report page already offers, now reachable from the game it was given on.
  async function handleRemoveAward(award: RepPlayerAward) {
    const ok = await confirm({
      title: 'Remove this award?',
      message: `Undo ${award.awardType?.name ?? 'this award'} for ${award.playerName}? This can’t be undone.`,
      confirmText: 'Remove',
      cancelText: 'Cancel',
      tone: 'danger',
    });
    if (!ok) return;
    setAwardActionError('');
    setAwardBusyId(award.id);
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/awards/${award.id}`, { method: 'DELETE' });
      if (res.ok) {
        onAwardsChanged();
      } else {
        const d = await res.json().catch(() => ({ error: res.statusText }));
        setAwardActionError(d.error ?? 'Could not remove this award');
      }
    } catch {
      setAwardActionError('Could not remove this award — check your connection and try again.');
    } finally {
      setAwardBusyId(null);
    }
  }

  // Auto-save means closing should FLUSH any pending edits, not prompt to discard. Only if a
  // flush genuinely fails do we ask before closing (so the coach doesn't lose work silently).
  async function requestCloseSlideOver() {
    let ok = true;
    if (attendanceDirty) ok = (await handleAttendanceSave()) && ok;
    if (!ok && !(await confirm({
      title: 'Changes not saved',
      message: 'We couldn’t save your latest changes. Close anyway and discard them?',
      confirmText: 'Discard',
      cancelText: 'Keep editing',
      tone: 'danger',
    }))) return;
    onClose();
  }

  async function handleScoreSave() {
    if (!scoreForm) return;
    setSaving(true);
    try {
      const ts = Number(scoreForm.teamScore);
      const os = Number(scoreForm.opponentScore);
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/events/${ev.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamScore: ts,
          opponentScore: os,
          // Result is always derived from the score — no manual override. A stored W/L/T that
          // contradicts the numbers would silently corrupt the Season Record.
          result: ts > os ? 'win' : ts < os ? 'loss' : 'tie',
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Save failed');
      const { event: updated } = await res.json();
      onEventChanged(updated);
      setScoreForm(null);
      await refresh();
      // The book's record vs this opponent just changed; refresh the roll-up so the
      // capture door + chips reflect tonight's result. Non-blocking convenience.
      onBookChanged();
    } catch (e: unknown) {
      setSaveError(errorMessage(e, 'Save failed'));
    } finally {
      setSaving(false);
    }
  }

  // ── Cancel / restore ─────────────────────────────────────────────────────────
  // A cancelled event stays on the schedule (dimmed + badged) rather than being deleted —
  // parity with the free Basic portal, and the honest way to handle a called-off practice/game.

  async function handleToggleCancel() {
    const nextStatus = ev.status === 'cancelled' ? 'scheduled' : 'cancelled';
    setSaving(true);
    setFootError('');
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/events/${ev.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Update failed');
      const { event: updated } = await res.json();
      setCancelAsk(false);
      onEventChanged(updated);
      await refresh();
    } catch (e: unknown) {
      setFootError(errorMessage(e, 'Update failed'));
    } finally {
      setSaving(false);
    }
  }

  // ── Delete ──────────────────────────────────────────────────────────────────

  async function handleDelete(eventId: string, scope: SeriesScope) {
    setSaving(true);
    setFootError('');
    try {
      // Closing happens only on success — a failure must leave the slide-over up, since that is
      // where `footError` renders — and immediately, with the refresh trailing behind it.
      await deleteEventRequest(orgSlug, teamId, eventId, scope);
      onDeleted();
      await refresh();
    } catch (e: unknown) {
      setFootError(errorMessage(e, 'Delete failed'));
    } finally {
      setSaving(false);
    }
  }

  function setPlayerAttendance(playerId: string, patch: Partial<Pick<AttendanceRoomRow, 'status' | 'note'>>) {
    setAttendanceRows(rows => rows.map(row => (
      row.player.id === playerId ? { ...row, ...patch } : row
    )));
    setAttendanceDirty(true);
  }

  function setAllAttendance(status: RepAttendanceStatus) {
    setAttendanceRows(rows => rows.map(row => ({ ...row, status })));
    setAttendanceDirty(true);
    setAttendanceFilter('all'); // a status filter would empty out after a bulk set — show the result
  }

  async function handleAttendanceSave(): Promise<boolean> {
    const sigAtSave = attendanceSig();
    setAttendanceSaving(true);
    setAttendanceError('');
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/events/${ev.id}/attendance`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entries: attendanceRows.map(row => ({
            playerId: row.player.id,
            status: row.status,
            note: row.note,
          })),
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(d.error ?? 'Attendance save failed');
      }
      if (attendanceSigRef.current === sigAtSave) setAttendanceDirty(false);
      return true;
    } catch (e: unknown) {
      setAttendanceError(errorMessage(e, 'Attendance save failed'));
      return false;
    } finally {
      setAttendanceSaving(false);
    }
  }

  // Batch 4: a MIRRORED tournament game. The organizer owns its time, opponent, venue, score,
  // result and whether it happened; the coach owns arrival time, uniform, field, notes, links,
  // tags — and attendance + the lineup, which is the entire point. The API enforces the same
  // split, so hiding these controls is honesty, not the guard.
  const mirroredGame = isMirroredEvent(ev);
  // The page-level create + the panel's Edit / Cancel / Delete — ONE rule, read from the
  // doors object rather than computed a second time beside it (`/review`, 2026-09-10).
  const canAddEvents = drawerDoors.editEvent;

  // Compact one-line summary for the slide-over header (replaces the tall label/value list).
  // Tournaments (multi-day containers) show a date range and no clock time; "@" = away.
  const isTournamentContainer = ev.eventType === 'external_tournament';
  const matchupSep = ev.homeAway === 'away' ? '@' : 'vs';
  const eventMeta = [
    ev.startsAt
      ? (isTournamentContainer && ev.endsAt
          ? `${fmtDate(ev.startsAt)} – ${fmtDate(ev.endsAt)}`
          : fmtDate(ev.startsAt))
      : null,
    (!isTournamentContainer && ev.startsAt)
      ? `${fmtTime(ev.startsAt)}${ev.endsAt ? ` – ${fmtTime(ev.endsAt)}` : ''}`
      : null,
    ev.arrivalTime ? `Arrive ${fmtClock(ev.arrivalTime)}` : null,
    ev.opponent ? `${matchupSep} ${ev.opponent}${ev.homeAway === 'neutral' ? ' (neutral)' : ''}` : null,
    ev.isRecurring ? 'Repeats weekly' : null,
  ].filter(Boolean) as string[];
  // Location is rendered separately as a tappable Google Maps link (reusing the shared helper),
  // with the optional field/diamond # appended to the label (the maps query stays the location).
  const locationLabel = [ev.location, surfaceLabel(sportPack.id, ev.fieldNumber)].filter(Boolean).join(' · ');

  // Attendance ↔ lineup disagreement for the open game — the Lineup row's warning (E4). Only when a
  // lineup exists.
  const lineupMismatch: LineupMismatch | null = (() => {
    if (!isLineupEvent(ev) || lineupEntryIds.size === 0) return null;
    const coming = attendanceRows
      .filter(r => (r.status === 'attending' || r.status === 'late') && !lineupEntryIds.has(r.player.id))
      .map(r => rowPlayer(r.player));
    const out = attendanceRows
      .filter(r => r.status === 'absent' && lineupEntryIds.has(r.player.id))
      .map(r => rowPlayer(r.player));
    return coming.length > 0 || out.length > 0 ? { coming, out } : null;
  })();

  /**
   * ══════════════════════════════════════════════════════════════════════════════════════════
   * THE EVENT SHEET — its blocks, named once, in ONE OF TWO ORDERS, BY THE CLOCK, AT EVERY WIDTH
   * (stage 1 · E1 + E6, 2026-09-25; the clock is C3's, 2026-09-21 — "tabs before first pitch /
   * score from first pitch" became "rows before / score from", the same clock).
   *
   *   · ROWS FIRST — a game before first pitch, and every other kind of event: title · when · where
   *     · notes · (a started non-game's awards, above its rows — the 2026-09-25 placement) · the
   *     door rows · the quiet "+ Add final score" (a game — a coach who types a score early still
   *     finds it) · tags · description · resources · the foot row.
   *   · SCORE FIRST — a game from first pitch, and whenever a score exists: title · when · where ·
   *     notes · the score (the door, or the scoreline with Edit score and the book row) · tags ·
   *     awards · the door rows · description · resources · the foot row.
   * The desktop dialog draws the same blocks in the same order; its action row sits under the rows
   * (it sat above the tabs), and its awards follow the clock too — no "Enter a final score to unlock
   * awards" on a game two days away (E6, F08). `isPhone` now decides only a block's FORM (the
   * where-row, the pinned foot row), never the order.
   * The order is JSX order, never CSS `order`: the tab sequence must match the reading order.
   * ══════════════════════════════════════════════════════════════════════════════════════════
   */
  const hasScore = ev.teamScore != null && ev.opponentScore != null;
  const started = gameHasStarted(ev, nowMs);
  const scoreLeads = isGameEvent && sheetOrder({ started, hasScore }) === 'score-first';
  const mapsQuery = ev.locationAddress || ev.location || locationLabel;
  const openMap = (e: React.MouseEvent) => {
    // Open the map explicitly rather than relying on the anchor default —
    // inside the modal the plain new-tab navigation was landing on about:blank.
    e.preventDefault();
    e.stopPropagation();
    window.open(mapsHref(mapsQuery), '_blank', 'noopener,noreferrer');
  };
  const mapTitle = ev.locationAddress ? `Open ${ev.locationAddress} in Google Maps` : `Search ${locationLabel} in Google Maps`;
  const mappable = !!locationLabel && !!(ev.locationAddress || ev.location);

  // The word for this event in every sentence the window says ("Edit which practices?", "Delete this practice").
  const word = eventWord(ev);
  // ⚠ ON A PHONE THE PENCIL'S MENU IS A SHEET THAT STANDS ITS OWN BACK STEP over this window's (/review 2026-10-09).
  // Opening the form in the commit that closes both would hand the form only the sheet's history entry and strand the
  // window's beneath it, still naming the game (`?event=…`): one Back that seems to do nothing, and a reload there
  // reopens the game. So a pick on a phone lets the sheet give its entry back first (its step pops), then opens the
  // form exactly as the one-off pencil does — one step handing its entry to the form. A desk's popover stands no step.
  const editFromMenu = (scope: SeriesScope, dates: readonly string[]) => {
    if (!isPhone) { onEdit(ev, scope, dates); return; }
    let fired = false;
    const open = () => {
      if (fired) return;
      fired = true;
      window.removeEventListener('popstate', open);
      window.clearTimeout(fallback);
      window.setTimeout(() => onEdit(ev, scope, dates), 0);
    };
    window.addEventListener('popstate', open);
    const fallback = window.setTimeout(open, 600);
  };
  const header = (
    <div className={styles.modalHeader}>
      <button className={styles.modalBackBtn} aria-label="Back" onClick={requestCloseSlideOver}><ArrowLeft size={20} /></button>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        {(() => { const Icon = EVENT_ICONS[ev.eventType]; return <Icon size={16} style={{ color: EVENT_COLORS[ev.eventType] }} />; })()}
        <span className={styles.eventTypePill} style={{ background: `color-mix(in srgb, ${EVENT_COLORS[ev.eventType]} 13.333%, transparent)`, color: EVENT_COLORS[ev.eventType] }}>
          {EVENT_LABELS[ev.eventType]}
        </span>
        {/* The drawer says what the row says — the kind's pill, and the word beside it. */}
        {ev.isScrimmage && <span className={styles.scrimmageChip}>{SCRIMMAGE_LABEL}</span>}
        {ev.status === 'cancelled' && (
          <span className={styles.eventTypePill} style={{ background: 'color-mix(in srgb, var(--warning) 13.333%, transparent)', color: 'var(--warning)' }}>Cancelled</span>
        )}
      </div>
      {/* THE HEAD'S PENCIL (owner, 2026-10-09 — the award's and the payee's, the 10-01 record standard's place), at
          every width; it replaced the foot's "Edit details". It opens the edit FORM rather than flipping the sheet in
          place: an event's when / where tells families, so its Save is held — the ruled exception to "edit autosaves".
          A REPEATING event's pencil asks which dates FIRST (owner ruling 2026-10-09, all four asks as recommended), so
          the form opens knowing them and checks every one for clashes before Save — asked after Save, it had checked
          only the date it was opened on. The portal's menu, opened by the one-off's own pencil: a panel under it at a
          desk, a sheet over this window on a phone. Three rows always, as Delete offers; the line under each says which
          dates it reaches, and those dates are what the form opens with. */}
      {canAddEvents && (
        <span className={styles.sheetHeadEnd}>
          {seriesReach ? (
            <CoachToolbarMenu label={`Edit this ${word}`} icon={<Pencil size={18} aria-hidden />} variant="glyph"
              plainTrigger triggerClassName={styles.ppIconBtn} disabled={saving} panelMinWidth={300}
              drawerOnPhone title={`Edit which ${word}s?`} overWindow>
              {SERIES_EDIT_ROWS.map(row => (
                <CoachToolbarMenuItem key={row.scope} label={row.label(word)} hint={reachHint(seriesReach[row.scope], word)}
                  onSelect={() => editFromMenu(row.scope, seriesReach[row.scope])} />
              ))}
            </CoachToolbarMenu>
          ) : (
            <button type="button" className={styles.ppIconBtn} aria-label={`Edit this ${eventWord(ev)}`} title="Edit"
              disabled={saving} onClick={() => onEdit(ev)}>
              <Pencil size={18} aria-hidden />
            </button>
          )}
        </span>
      )}
      <button className={styles.modalCloseBtn} aria-label="Close" onClick={requestCloseSlideOver}>
        <X size={18} />
      </button>
    </div>
  );
  const titleBlock = <h2 className={styles.slideOverTitle}>{ev.name}</h2>;
  const whenLine = eventMeta.length > 0 ? (
    <p className={styles.slideOverMeta}>{eventMeta.join('  ·  ')}</p>
  ) : null;

  /* Batch 4 — where this game came from. Its time, opponent, venue and score are the
      organizer's; attendance and the lineup below are entirely the coach's. */
  const sourceBlock = mirroredGame ? (
    <div className={`${styles.infoBanner} ${styles.sourceNote}`}>
      <Trophy size={13} aria-hidden style={{ flexShrink: 0 }} />
      <span>
        From <strong>{ev.name}</strong> · organizer’s schedule
        {mirroredGameHref && (
          <>
            {' '}
            <a href={mirroredGameHref} target="_blank" rel="noopener noreferrer" className={styles.sourceNoteLink}>
              View on the tournament page <ExternalLink size={11} aria-hidden />
            </a>
          </>
        )}
      </span>
    </div>
  ) : null;

  /* The organizer moved it since this device last showed it. Nothing was lost — the
      point is that the coach knows. Attendance is only worth re-checking when the DAY
      changed; a clock nudge doesn't invalidate anyone's reply. */
  const movedBlock = selectedMoved ? (
    <div className={`${styles.infoBanner} ${styles.movedNote}`} role="status">
      <strong>Moved from {fmtDate(selectedMoved.previous)} · {fmtTime(selectedMoved.previous)}.</strong>{' '}
      Your lineup and attendance moved with it — nothing to rebuild.
      {selectedMoved.dayChanged && (
        <span className={styles.movedNoteWarn}> Attendance was taken for the old time — worth re-checking.</span>
      )}
    </div>
  ) : null;

  // Location is rendered as a tappable Google Maps link (reusing the shared helper), with the
  // optional field/diamond # appended to the label (the maps query stays the location).
  // On a phone THE WHOLE LINE IS THE ROW (C3): pin · venue · the uniform · a chevron, 44px, the
  // tap opens the map; a field number with no place name or address stays a plain line, as it
  // does on the desktop, where the link keeps its inline shape beside the uniform.
  const whereBlock = (locationLabel || ev.uniform) ? (
    isPhone && mappable ? (
      <a
        href={mapsHref(mapsQuery)}
        target="_blank"
        rel="noopener noreferrer"
        className={styles.slideOverWhereRow}
        title={mapTitle}
        onClick={openMap}
      >
        <MapPin size={15} aria-hidden />
        <span className={styles.slideOverWhereText}>
          {locationLabel}
          {ev.uniform && <span className={styles.slideOverWhereKit}> · Uniform: {ev.uniform}</span>}
        </span>
        <ChevronRight size={16} aria-hidden className={styles.slideOverWhereChevron} />
      </a>
    ) : (
      <p className={styles.slideOverMeta}>
        {locationLabel && (
          mappable ? (
            <a
              href={mapsHref(mapsQuery)}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.slideOverMapLink}
              title={mapTitle}
              onClick={openMap}
            >
              <MapPin size={13} aria-hidden />{locationLabel}
            </a>
          ) : (
            /* only a field/diamond # with no place name or address — nothing useful to map */
            <span>{locationLabel}</span>
          )
        )}
        {locationLabel && ev.uniform ? '  ·  ' : ''}
        {ev.uniform && <span>Uniform: {ev.uniform}</span>}
      </p>
    )
  ) : null;
  /* The place's note (mig 307) — "park behind the arena" — read off the book by the link. */
  const placeNote = ev.placeId && places.find(p => p.id === ev.placeId)?.note ? (
    <p className={styles.slideOverMeta}>{places.find(p => p.id === ev.placeId)?.note}</p>
  ) : null;

  /* Final score — the headline fact of a played game lives in the header, not behind a
     door. W/L/T is always derived from the two numbers (no manual override).
     On a MIRRORED game the score is the organizer's: shown, never editable (the API
     refuses it, and the next sync would overwrite a local edit anyway).
     The score is a schedule WRITE (the PATCH behind Save gates on schedule editing), so
     the form and its "+ Add final score" door ride the same grant. A coach without it
     still reads the score — the read-only line. ONE block, positioned by the order. */
  const scoreBlock = !isGameEvent ? null : mirroredGame ? (
    <div className={styles.eventScoreLine}>
      {ev.teamScore != null ? (
        <div className={styles.eventScore}>{scoreline(ev)}</div>
      ) : (
        <p className={styles.formHint}>The final score arrives from the tournament once it’s posted.</p>
      )}
    </div>
  ) : drawerDoors.scoreForm ? (
    <div className={styles.eventScoreLine}>
      {scoreForm ? (
        <div className={styles.scoreForm}>
          <div className={styles.scoreFormRow}>
            <label className={styles.scoreFieldLabel}>
              <span>Your team</span>
              <input className={styles.input} style={{ width: '4.5rem' }} type="number" min={0} inputMode="numeric" autoFocus value={scoreForm.teamScore} onChange={e => setScoreForm(s => s && ({ ...s, teamScore: e.target.value }))} />
            </label>
            <span className={styles.scoreFormSep}>–</span>
            <label className={styles.scoreFieldLabel}>
              <span>Opponent</span>
              <input className={styles.input} style={{ width: '4.5rem' }} type="number" min={0} inputMode="numeric" value={scoreForm.opponentScore} onChange={e => setScoreForm(s => s && ({ ...s, opponentScore: e.target.value }))} />
            </label>
            {(() => {
              const t = scoreForm.teamScore.trim(), o = scoreForm.opponentScore.trim();
              if (t === '' || o === '') return null;
              const r = Number(t) > Number(o) ? 'win' : Number(t) < Number(o) ? 'loss' : 'tie';
              return (
                <span className={styles.resultBadge} style={{ alignSelf: 'flex-end', paddingBottom: '0.5rem', color: resultColor(r) }}>
                  {r.toUpperCase()}
                </span>
              );
            })()}
          </div>
          <div className={styles.scoreFormActions}>
            <button className={styles.btnPrimary} disabled={saving || scoreForm.teamScore.trim() === '' || scoreForm.opponentScore.trim() === ''} onClick={handleScoreSave}>Save</button>
            <button className={styles.btnGhost} onClick={() => setScoreForm(null)}>Cancel</button>
          </div>
          {saveError && <p className={styles.errorText}>{saveError}</p>}
        </div>
      ) : ev.teamScore != null ? (
        <div className={styles.eventScore}>
          {scoreline(ev)}
          <button className={styles.eventScoreEdit} onClick={() => setScoreForm({ teamScore: String(ev.teamScore ?? ''), opponentScore: String(ev.opponentScore ?? '') })}>
            Edit score
          </button>
          {/* The Scouting Book's capture door — a quiet link at the one moment every
              coach reliably visits after every game (score entry), never a modal
              (owner ruling). It opens the book's panel, the same view the Scouting row opens. */}
          {scoutingKey && (
            <button type="button" className={styles.scoutToastDoor} onClick={() => setView('scouting')}>
              Add to the book on {ev.opponent} ›
            </button>
          )}
        </div>
      ) : (
        <button className={styles.eventScoreAdd} onClick={() => setScoreForm({ teamScore: '', opponentScore: '' })}>
          + Add final score
        </button>
      )}
    </div>
  ) : ev.teamScore != null ? (
    <div className={styles.eventScoreLine}>
      <div className={styles.eventScore}>
        {scoreline(ev)}
        {/* The Scouting Book's capture door stays open to every schedule-holder — the
            bench observes, by ruling — even when the score itself is read-only. */}
        {scoutingKey && (
          <button type="button" className={styles.scoutToastDoor} onClick={() => setView('scouting')}>
            Add to the book on {ev.opponent} ›
          </button>
        )}
      </div>
    </div>
  ) : null;

  /* Applied tags — read-only here; the picker/manager live in the edit form (the head's pencil). */
  const tagsBlock = tagIds.length > 0 ? (
    <div className={styles.lineupChips}>
      {tagIds.map(tagId => {
        const tag = teamTags.find(t => t.id === tagId);
        return tag ? <span key={tagId} className={styles.lineupChip}>{tag.name}</span> : null;
      })}
    </div>
  ) : null;

  /* Awards given — the "same visit" give-award moment (Coach Tags & Player Awards
     Phase 2). A GAME: once the score leads — from first pitch, at EVERY width (E6: the desktop
     no longer draws the locked box on a game days away; a started game still reads "Enter a final
     score to unlock awards" until it has one).
     ANY OTHER EVENT — a practice, a team event, a whole tournament (awards at any event, owner
     2026-09-25): the section exists only once the event can carry an award (started, not
     cancelled — `awardUnlockState`, the same rule the POST route refuses by). Before that there
     is no section at all, not a locked box: an upcoming practice's window is exactly what it was. */
  const awardUnlock = awardUnlockState(ev, nowMs);
  const awardKind = awardEventKind(ev.eventType);
  const awardsBlock = drawerDoors.awards && (isGameEvent ? scoreLeads : awardUnlock === 'open') ? (
    <div className={styles.formSection} style={{ marginTop: '0.75rem' }}>
      <h4 className={styles.formSectionTitle}>Awards given</h4>
      {awardUnlock === 'cancelled' ? (
        <p className={styles.formHint}>This game was cancelled.</p>
      ) : awardUnlock === 'needs-score' ? (
        <p className={styles.formHint}>Enter a final score to unlock awards for this game.</p>
      ) : (
        <>
          {teamAwards.filter(a => a.eventId === ev.id).length === 0 ? (
            <p className={styles.formHint}>No awards given for this {awardKind} yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', marginBottom: '0.6rem' }}>
              {teamAwards.filter(a => a.eventId === ev.id).map(a => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--white-90)' }}>
                    {a.awardType?.emoji ? `${a.awardType.emoji} ` : ''}{a.awardType?.name ?? 'Award'} — {a.playerName}
                  </span>
                  <span className={styles.tagManagerActions}>
                    <button
                      type="button"
                      title="Edit"
                      aria-label={`Edit ${a.awardType?.name ?? 'award'} for ${a.playerName}`}
                      disabled={!!awardBusyId}
                      onClick={() => { setEditingAward(a); setGiveAwardOpen(true); }}
                    >
                      <Pencil size={14} aria-hidden />
                    </button>
                    <button
                      type="button"
                      title="Remove"
                      aria-label={`Remove ${a.awardType?.name ?? 'award'} for ${a.playerName}`}
                      disabled={awardBusyId === a.id}
                      onClick={() => handleRemoveAward(a)}
                    >
                      <Trash2 size={14} aria-hidden />
                    </button>
                  </span>
                </div>
              ))}
            </div>
          )}
          {awardActionError && <p className={styles.errorText}>{awardActionError}</p>}
          {/* A rosterless team gets a reason, not a blank player picker (Chunk E WI-7). */}
          {awardPlayers.length === 0 ? (
            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--white-55)' }}>🏆 Add players to your roster first — then you can give awards.</p>
          ) : (
            <button className={styles.btnSecondary} onClick={() => { setEditingAward(null); setGiveAwardOpen(true); }}>🏆 Give an award</button>
          )}
        </>
      )}
    </div>
  ) : null;

  const descriptionBlock = ev.description ? (
    <p className={styles.slideOverNotes}>{ev.description}</p>
  ) : null;

  const resourcesBlock = ev.resources && ev.resources.length > 0 ? (
    <div className={styles.resourceList}>
      {ev.resources.map((r, i) => {
        const RIcon = resourceIcon(r.url);
        return (
          <button
            key={i}
            type="button"
            className={styles.resourceLink}
            title={r.url}
            onClick={() => window.open(r.url, '_blank', 'noopener,noreferrer')}
          >
            <RIcon size={14} aria-hidden />
            <span className={styles.resourceLinkLabel}>{r.label}</span>
            <ExternalLink size={12} aria-hidden style={{ opacity: 0.5, flexShrink: 0 }} />
          </button>
        );
      })}
    </div>
  ) : null;

  /* ── THE DOOR ROWS (E1) ── one row per job this coach can do on this event, in the order they
     are done: the practice's plan, then Attendance, then the Lineup, then the book on the
     opponent. Each is the portal's row recipe at 64px — icon · label · a SECOND LINE THAT SAYS
     WHERE THE JOB STANDS · chevron — and the whole row is the tap. A door a person cannot use is
     not drawn (`scheduleDrawerDoors`, unchanged): no row, never a disabled one.
     Kinds (plan §4.8): a game (and a tournament game, an organizer's game) — Attendance · Lineup ·
     Scouting (no Scouting row for a TBD opponent); a tournament — Attendance; a practice — the plan
     · Attendance; a team event — Attendance. */

  /* The practice's plan (Practice Plans 1a): a SUMMARY plus a door, never the editor — the plan is
     written on its own drill-in where the focus rail and the rotation grid have room. The row
     replaces the "PRACTICE PLAN" kicker, its summary line and "Open the plan →": the same summary,
     the same destination (E1).
     ⚠ NO "Run practice →" HERE (owner, 2026-09-18): the shortcut lives on the next-practice card
     alone; every other practice is two taps — the plan, then Run practice in the plan's toolbar.
     ⚠ The door follows the grant the plan page itself writes on — Schedule: View + edit
     (`canWritePracticePlans`, staff-access pass 2) — never "head coach" (practices re-evaluation
     stage 6, R8, 2026-09-18). A viewer with no plan to read gets the plan page's own sentence on a
     row that opens nothing, so the sheet says WHY and not just "no".
     "Has a plan" is the hub's ONE definition — at least one block (stage 0; stage 6). */
  const planFace = { mark: <ClipboardList size={20} aria-hidden />, title: 'Practice plan' };
  const planCaption = practiceHasPlan(ev)
    ? `${summarizePracticePlan(ev.practicePlan!)}${ev.practicePlan!.goal ? ` — ${ev.practicePlan!.goal}` : ''}`
    : capabilities && canWritePracticePlans(capabilities)
      ? 'No plan yet — set out the blocks, stations and groups'
      : null;
  const planRow = ev.eventType !== 'practice' ? null : planCaption ? (
    <CoachRow as="link" href={`${base}/practice/${ev.id}`} {...planFace} caption={planCaption} door="chevron" />
  ) : (
    <CoachRow as="static" {...planFace} caption="No plan yet. Writing the plan comes with Schedule: View + edit — ask your head coach." />
  );

  /* Attendance (E1 · E2): the head carries the counts, the second line NAMES who is out, late or
     silent (`attendanceRowWords`, pinned) — read without opening anything. The row opens the room. */
  const attendanceWords = attendanceRowWords(attendanceRows.map(r => ({ player: rowPlayer(r.player), status: r.status })));
  const attendanceRow = drawerDoors.attendanceTab ? (
    <CoachRow
      as="button"
      onClick={() => setView('attendance')}
      mark={<Users size={20} aria-hidden />}
      title={attendanceLoading ? 'Attendance' : attendanceWords.head}
      caption={attendanceLoading
        ? 'Loading attendance…'
        : attendanceError && attendanceRows.length === 0
          ? attendanceError
          : <RowLine parts={attendanceWords.parts} />}
      door="chevron"
    />
  ) : null;

  /* The Lineup (E3 · E4): says whether one is saved, or where it disagrees with attendance — in the
     warning tone — and goes where the job is BY THE CLOCK at every width (`lineupDoor`, pinned):
     the builder before first pitch, Game day from it (F07: the desk said "Edit in Lineups →" at
     every hour). The builder is handed the way back to THIS game (stage 3 · D3, §222). */
  const liveDoor = lineupDoor({ started, hasLineup, mismatch: !!lineupMismatch, liveWindow: gameDayLive });
  const lineupWords = lineupRowWords({ hasLineup, mismatch: lineupMismatch, door: liveDoor });
  // A read that failed is not "No lineup yet" — the row says what the Attendance row says (/review).
  const lineupUnread = !!attendanceError && attendanceRows.length === 0;
  const editHref = lineupBuilderHref(base, ev.id, { returnTo: `${base}/schedule?event=${ev.id}&tab=lineup` });
  const lineupRow = drawerDoors.lineupTab && isLineupEvent(ev) ? (
    <CoachRow
      as="link"
      href={liveDoor === 'game-day' ? `${base}/game/${ev.id}` : editHref}
      mark={<ListOrdered size={20} aria-hidden />}
      title={attendanceLoading || lineupUnread ? 'Lineup' : lineupWords.head}
      caption={attendanceLoading
        ? 'Loading the lineup…'
        : lineupUnread
          ? attendanceError
          : <span className={styles.sheetDoorTone} data-tone={lineupWords.warn ? 'warn' : undefined}>{lineupWords.line}</span>}
      door="chevron"
    />
  ) : null;

  /* Scouting (E3): your record against them and your notes, from the book — or that you have not
     met them yet. Opens the book's panel as a view, like the room. */
  const scoutingRow = scoutingKey ? (
    <CoachRow
      as="button"
      onClick={() => setView('scouting')}
      mark={<Eye size={20} aria-hidden />}
      title="Scouting"
      caption={scoutingRowWords(ev.opponent!, bookEntry, recordChip)}
      door="chevron"
    />
  ) : null;

  const doorRows = planRow || attendanceRow || lineupRow || scoutingRow ? (
    <CoachRowList label="On this event" className={styles.sheetDoorRows}>
      {planRow}{attendanceRow}{lineupRow}{scoutingRow}
    </CoachRowList>
  ) : null;

  /* THE FOOT — the record's once-in-a-record doors, the same at every width (owner, 2026-10-09: "portal standard in
     format and location"). UNDER THE ROWS (E6); PINNED on a phone (2026-09-21) on the form sheets' `.modalFooter`
     recipe, as two equal cells. Edit is the head's pencil, not a door here.
       · Delete — the portal's delete door (`GuardedDelete`) at the foot's START, asking in place and naming what goes;
         a series offers the edit form's three answers. It tells families nothing, so where they see the schedule the
         question says so and points at Cancel — the lost rained-out game is the delete worth stopping.
       · Cancel / Restore — the secondary button at the foot's END. It tells families at once, so where they see the
         schedule it asks once first ("a change that tells families asks"); elsewhere it stays one press.
     A question takes the whole foot in place of the controls it suspends (§134). */
  const toggle = ev.status === 'cancelled' ? {
    door: `Restore this ${word}`, title: `Restore this ${word}?`,
    body: <>It comes off Cancelled, and families who follow the team are told it&rsquo;s back on.</>,
    keep: 'Keep it cancelled', go: `Restore ${word}`, goClass: styles.btnSecondary,
  } : {
    door: `Cancel this ${word}`, title: `Cancel this ${word}?`,
    body: <>It stays on the schedule, marked Cancelled, and families who follow the team are told it&rsquo;s off.</>,
    keep: 'Keep it', go: `Cancel ${word}`, goClass: styles.btnDanger,
  };
  const addGameButton = ev.eventType === 'external_tournament' ? (
    <button className={`${styles.btnSecondary}${isPhone ? ` ${styles.slideOverFootWide}` : ''}`} disabled={saving} onClick={() => onAddGame(ev)}>
      + Add game
    </button>
  ) : null;
  const actionsBlock = canAddEvents ? (
    <div className={`${styles.slideOverActions}${isPhone ? ` ${styles.slideOverFoot} ${styles.modalFooter}` : ''}`}>
      {cancelAsk ? (
        /* Not a delete: the question's shape without the danger tint (`.sheetAskCalm`). */
        <div className={`${styles.dangerConfirm} ${styles.sheetAskCalm}`} role="alertdialog" aria-label={toggle.title}>
          <p className={styles.dangerConfirmTitle}>{toggle.title}</p>
          <div className={styles.dangerConfirmBody}>{toggle.body}</div>
          <div className={styles.dangerConfirmActions}>
            <button type="button" className={styles.btnGhost} disabled={saving} onClick={() => { setCancelAsk(false); setFootError(''); }}>{toggle.keep}</button>
            <button type="button" className={toggle.goClass} disabled={saving} onClick={() => { void handleToggleCancel(); }}>{toggle.go}</button>
          </div>
        </div>
      ) : mirroredGame ? (
        /* A mirrored game isn't the coach's to cancel or delete — and it wouldn't stick: the next sync would
           restore it from the organizer's schedule, minus the attendance and lineup a delete would have
           cascaded away. Its edit (the coach's own fields) is the head's pencil. */
        <span className={styles.formHint}>Only {ev.name} can cancel or remove this game.</span>
      ) : (
        <>
          <GuardedDelete
            label={`Delete this ${word}`}
            refusal={null}
            confirmTitle={`Delete this ${word}?`}
            confirmBody={<>
              {EVENT_DELETE_TAKES[ev.eventType]}
              {ev.isRecurring && <> It&rsquo;s part of a series: delete this date only, this date and the later ones, or all of them.</>}
              {/* "Cancel it instead" only where Cancel answers it: Cancel acts on one date, a series' delete on many. */}
              {familiesSeeSchedule && (ev.isRecurring
                ? <> Families aren&rsquo;t told.</>
                : <> Families aren&rsquo;t told: to call it off, cancel it instead.</>)}
            </>}
            deleting={saving}
            {...(ev.isRecurring
              ? { choices: SERIES_DELETE.map(([label, scope]) => ({ label, onPick: () => { void handleDelete(ev.id, scope); } })) }
              : { onDelete: () => { void handleDelete(ev.id, 'one'); } })}
          />
          <div className={styles.slideOverActionsRight}>
            {!isPhone && addGameButton}
            <button className={styles.btnSecondary} disabled={saving}
              onClick={() => { setFootError(''); if (familiesSeeSchedule) setCancelAsk(true); else void handleToggleCancel(); }}>
              {toggle.door}
            </button>
          </div>
          {isPhone && addGameButton}
        </>
      )}
      {/* A failed cancel, restore or delete says so HERE — its own line, never the score form's. */}
      {footError && <p className={styles.errorText} role="alert">{footError}</p>}
    </div>
  ) : null;

  // THE TWO ORDERS — JSX order, never CSS `order` (see the block above), the same at every width.
  // A started non-game's awards sit above its rows — where a started game's sit (owner, 2026-09-25:
  // "why is give awards in a different place in practices vs. games?" — one place on every event).
  const summary = <>{titleBlock}{whenLine}{whereBlock}{placeNote}{sourceBlock}{movedBlock}</>;
  const body = scoreLeads ? (
    <>
      {summary}
      {scoreBlock}{tagsBlock}{awardsBlock}
      {doorRows}
      {descriptionBlock}{resourcesBlock}{actionsBlock}
    </>
  ) : (
    <>
      {summary}
      {awardsBlock}
      {doorRows}
      {scoreBlock}{tagsBlock}
      {descriptionBlock}{resourcesBlock}{actionsBlock}
    </>
  );

  /* A VIEW'S HEAD (E2, E6) is the portal's one modal head: "←" back to the event, the view's name,
     and the day it belongs to. At a desk the arrow names the event ("← UAT probe game") and the
     dialog keeps its ×; on a phone the arrow is bare — the exit, as on every full-screen sheet — so
     the event's name rides the subtitle there ("Attendance / UAT probe game · Fri, Sep 25"). */
  const viewHead = (title: string) => (
    <CoachModalHeader
      title={title}
      titleTag="h2"
      backLabel={ev.name}
      subtitle={<><span className={styles.modalBackEcho}>{ev.name} · </span>{ev.startsAt ? scheduleDayLabel(ev.startsAt) : ''}</>}
      onBack={closeView}
      onClose={() => { void requestCloseSlideOver(); }}
      closeIconSize={18}
      closeAriaLabel="Close"
    />
  );

  const panelContent = openView === 'attendance' ? (
    <>
      {viewHead('Attendance')}
      <ScheduleAttendanceRoom
        attendanceRows={attendanceRows}
        attendanceLoading={attendanceLoading}
        attendanceError={attendanceError}
        attendanceSaving={attendanceSaving}
        attendanceDirty={attendanceDirty}
        attendanceFilter={attendanceFilter}
        setAttendanceFilter={setAttendanceFilter}
        setAllAttendance={setAllAttendance}
        setRsvpEditId={(playerId, from) => { rsvpOpenerRef.current = from; setRsvpEditId(playerId); }}
        handleAttendanceSave={handleAttendanceSave}
      />
    </>
  ) : openView === 'scouting' ? (
    <>
      {viewHead('Scouting')}
      <OpponentScoutingPanel
        orgSlug={orgSlug}
        teamId={teamId}
        eventId={ev.id}
        opponentName={ev.opponent!}
        mirrored={isMirroredEvent(ev)}
      />
    </>
  ) : (
    <>
      {header}
      {body}
    </>
  );

  return (
    <>
      <div className={styles.modalOverlay} onPointerDown={e => { if (e.target === e.currentTarget) (requestCloseSlideOver)?.(); }}>
        {/* A modal sheet, declared as one (role + aria-modal) the way the newer RoomShell and
            QuestionShell sheets are: the page behind it is inert by declaration, and the layout
            sweep narrows to the sheet instead of reporting the rows it covers as hidden. */}
        <div
          ref={slideOverRef}
          tabIndex={-1}
          className={styles.slideOver}
          role="dialog"
          aria-modal="true"
          aria-label={openView ? `${openView === 'attendance' ? 'Attendance' : 'Scouting'} · ${ev.name}` : ev.name}
          data-sheet-order={scoreLeads ? 'score-first' : 'rows-first'}
          data-sheet-view={openView ?? undefined}
          onClick={e => e.stopPropagation()}
        >
          {panelContent}
        </div>
      </div>

      {/* THE RSVP SHEET (stage 2 · C3) — one player's attendance from the foot of the screen, over
          the room. A SIBLING of the event sheet's overlay, never a child of its panel: its dialog
          floor stacks over the event sheet's, and a floor answers an Escape from inside ITS panel —
          nested, one key would close both. Tapping a choice writes it through the list's own path
          and closes; a typed note rides the same autosave (the transient pill). */}
      {rsvpEditId && (() => {
        const row = attendanceRows.find(r => r.player.id === rsvpEditId);
        if (!row) return null;
        return (
          <CoachRsvpSheet
            playerName={playerDisplayName(row.player)}
            eventLine={[ev.startsAt ? fmtDate(ev.startsAt) : '', ev.name].filter(Boolean).join(' · ')}
            status={row.status}
            note={row.note}
            onPick={status => { setPlayerAttendance(row.player.id, { status }); setRsvpEditId(null); }}
            onNote={note => setPlayerAttendance(row.player.id, { note })}
            onClose={() => setRsvpEditId(null)}
            opener={rsvpOpenerRef}
          />
        );
      })()}

      {/* Warn before leaving with an unsaved attendance edit. */}
      <UnsavedChangesGuard active={attendanceDirty} />

      {giveAwardOpen && (
        <GiveAwardModal
          orgSlug={orgSlug}
          teamId={teamId}
          players={awardPlayers}
          awardTypes={awardTypes}
          eventContext={{
            id: ev.id,
            eventType: ev.eventType,
            // The event's own label ("vs Oakville A's", "Practice") on its org-zone day — the UTC slice
            // read a day late for anything starting at 8 p.m. Eastern or later.
            label: `${awardOccasionLabel(ev, null)} — ${shortDate(orgDayKey(ev.startsAt))}`,
            day: orgDayKey(ev.startsAt),
          }}
          existingAwards={teamAwards}
          editing={editingAward}
          onClose={() => { setGiveAwardOpen(false); setEditingAward(null); }}
          onChanged={onAwardsChanged}
        />
      )}
    </>
  );
}
