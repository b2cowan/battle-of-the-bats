'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, ChevronRight, CircleHelp, CircleSlash, ExternalLink, FileText, Link2, MapPin, Pencil, StickyNote, Trash2, Trophy, Video, X } from 'lucide-react';
import { EVENT_ICONS, EVENT_COLORS } from '@/components/coaches/eventTypeMark';
import SaveStatusPill from '@/components/coaches/SaveStatusPill';
import UnsavedChangesGuard from '@/components/coaches/UnsavedChangesGuard';
import { useConfirm } from '@/components/coaches/ConfirmProvider';
import { useDialogFloor } from '@/components/coaches/useDialogFloor';
import CoachLoading from '@/components/coaches/CoachLoading';
import { CoachRowList, CoachRow } from '@/components/coaches/CoachRowList';
import GiveAwardModal from '@/components/coaches/GiveAwardModal';
import OpponentScoutingPanel from '@/components/coaches/OpponentScoutingPanel';
import CoachRsvpSheet from '@/components/coaches/CoachRsvpSheet';
import { ATTENDANCE_OPTIONS } from '@/components/coaches/attendanceOptions';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';
import { formatStoredClock as fmtClock } from '@/lib/utils';
import { surfaceLabel, type SportPack } from '@/lib/sports';
import type { ScheduleDrawerDoors } from '@/lib/coach-schedule-doors';
import type { CoachCapabilities } from '@/lib/coach-capabilities';
import { canWritePracticePlans } from '@/lib/coach-capabilities';
import { summarizePracticePlan } from '@/lib/rep-practice-plan';
import { practiceHasPlan } from '@/lib/practice-state';
import { playerDisplayName } from '@/lib/coach-roster-name';
import { isMirroredEvent, type MovedGame } from '@/lib/coach-tournament-games';
import { gameDayPeriodKey, gameHasStarted } from '@/lib/coach-game-day';
import { awardEventKind, awardOccasionLabel, awardUnlockState } from '@/lib/rep-award-occasion';
import { lineupBuilderHref } from '@/lib/lineups-address';
import { sheetOrder } from '@/lib/coach-schedule-phone';
import { normalizeOpponentName } from '@/lib/coach-opponents';
import { orgDayKey } from '@/lib/timezone';
import { EVENT_LABELS, SCRIMMAGE_LABEL } from '@/lib/coach-schedule-vocab';
import { GAME_EVENT_TYPES, errorMessage, fmtDate, fmtTime, isLineupEvent, resultColor, shortDate } from '@/lib/coach-schedule-view';
import type {
  RepAttendanceStatus,
  RepLineupMode,
  RepRosterPlayer,
  RepTeamEvent,
  RepTeamEventAttendance,
  RepTeamLineup,
  RepTeamLineupEntry,
  RepProgramYear,
  RepTeamTag,
  RepTeamPlace,
  RepTeamAwardType,
  RepPlayerAward,
} from '@/lib/types';

/**
 * THE SCHEDULE'S EVENT SHEET — one event's summary and its jobs, over the calendar. Moved out of
 * the schedule page by the Schedule deep dive's split (stage 1 · S6, owner ruling 2026-09-25 —
 * "split first, a pure move"). It owns what exists only while one event is open — its attendance
 * list and the autosave behind it, the lineup it reads, a score being typed, the delete question,
 * the award dialog, the RSVP sheet — and it opens fresh for each event (the page keys it on the
 * event's id), which is the reset `openEvent` used to perform by hand, field by field.
 * The page keeps the season: the events, the book, the awards, the capabilities and the fetches.
 */

/** The three tabs the sheet can open on. */
export type SlideTab = 'attendance' | 'lineup' | 'scouting';
/** Where on the sheet it opens — the deep link's tab, or the place Edit details left from. */
export interface SheetPlace { tab: SlideTab; filter: RepAttendanceStatus | 'all' }
export const SHEET_OPEN_PLACE: SheetPlace = { tab: 'attendance', filter: 'all' };

// Attendance statuses, ordered present → not-present → unset. Drives BOTH the per-player icon
// control and the metric/filter chips (label used by the chips; control is icon-only).
// Value + word + icon + order now live in ONE shared module (components/coaches/attendanceOptions)
// because the Game-Day console's Who's here sheet renders the identical rows — two hand-kept
// copies of four rows is how one screen's control quietly stops matching the other's.

// Quick status → {label, icon} lookup for the per-player status badge.
const ATTENDANCE_BY_VALUE = Object.fromEntries(
  ATTENDANCE_OPTIONS.map(o => [o.value, o]),
) as Record<RepAttendanceStatus, (typeof ATTENDANCE_OPTIONS)[number]>;

interface AttendancePlayerRow {
  player: RepRosterPlayer;
  status: RepAttendanceStatus;
  note: string;
}

interface LineupPlayerRow {
  player: RepRosterPlayer;
  battingOrder: string;
  starter: boolean;
  inningPositions: Record<string, string>;
  notes: string;
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

function sortLineupRows(rows: LineupPlayerRow[]) {
  return [...rows].sort((a, b) => {
    const aOrder = Number(a.battingOrder) || 999;
    const bOrder = Number(b.battingOrder) || 999;
    if (aOrder !== bOrder) return aOrder - bOrder;
    if (a.starter !== b.starter) return a.starter ? -1 : 1;
    return playerDisplayName(a.player).localeCompare(playerDisplayName(b.player));
  });
}

// Batting order = the row's position in the (drag-ordered) list — no manual numbers,
// so a coach can't type the same slot twice. everyone_bats: all bat 1..N; nine_player:
// starters bat 1..9 in order, bench get no slot.
function renumberBattingOrder(rows: LineupPlayerRow[], mode: RepLineupMode): LineupPlayerRow[] {
  let n = 0;
  return rows.map(r => {
    if (mode === 'everyone_bats') return { ...r, starter: true, battingOrder: String(++n) };
    if (r.starter && n < 9) return { ...r, battingOrder: String(++n) };
    return { ...r, battingOrder: '' };
  });
}

function buildLineupRows(
  players: RepRosterPlayer[],
  entries: RepTeamLineupEntry[],
  mode: RepLineupMode,
) {
  const entriesByPlayer = new Map(entries.map(entry => [entry.playerId, entry]));
  return players.map((player, index) => {
    const existing = entriesByPlayer.get(player.id);
    return {
      player,
      battingOrder: existing?.battingOrder ? String(existing.battingOrder) : mode === 'everyone_bats' ? String(index + 1) : index < 9 ? String(index + 1) : '',
      starter: existing?.starter ?? (mode === 'everyone_bats' ? true : index < 9),
      inningPositions: existing?.inningPositions ?? {},
      notes: existing?.notes ?? '',
    };
  });
}

/** DELETE one event. Shared by the sheet's Delete and the page's duplicate-game "Remove my copy"
 *  flow, which surface the error in different places. Refreshing is the CALLER's job — the sheet
 *  must close the instant the delete succeeds, not sit open through a full refetch. */
export async function deleteEventRequest(orgSlug: string, teamId: string, eventId: string, scope: 'one' | 'remaining' | 'all') {
  const res = await fetch(
    `/api/coaches/${orgSlug}/teams/${teamId}/events/${eventId}?scope=${scope}`,
    { method: 'DELETE' },
  );
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Delete failed');
}

export default function ScheduleEventSheet({
  orgSlug, teamId, base, event: ev, place, isPhone, nowMs, sportPack, capabilities, drawerDoors,
  places, teamTags, tagIds, teamAwards, awardTypes, awardPlayers, moved: selectedMoved, mirroredGameHref,
  onClose, onEdit, onAddGame, onEventChanged, onDeleted, refresh, onBookChanged, onAwardsChanged,
}: {
  orgSlug: string;
  teamId: string;
  /** The team root, `/{org}/coaches/teams/{id}`. */
  base: string;
  event: RepTeamEvent;
  place: SheetPlace;
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
  onClose: () => void;
  /** Edit details — with where on the sheet the coach left from, so the form can return there. */
  onEdit: (event: RepTeamEvent, place: SheetPlace) => void;
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
  const [slideTab, setSlideTab] = useState<SlideTab>(place.tab);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ eventId: string; isRecurring: boolean } | null>(null);
  /** Ask only for what this coach's grants open (the same answer the panel's tabs read). */
  const wantsRead = drawerDoors.lineupTab || drawerDoors.attendanceTab;
  const [attendanceRows, setAttendanceRows] = useState<AttendancePlayerRow[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(wantsRead);
  const [attendanceSaving, setAttendanceSaving] = useState(false);
  const [attendanceDirty, setAttendanceDirty] = useState(false);
  const [attendanceError, setAttendanceError] = useState('');
  // Attendance metric-filter ('all' or a status) + which rows have their note input expanded.
  const [attendanceFilter, setAttendanceFilter] = useState<RepAttendanceStatus | 'all'>(place.filter);
  // Which player's RSVP SHEET is open (one at a time; stage 2 · C3 — it used to be an inline
  // editor under the row). null = closed.
  const [rsvpEditId, setRsvpEditId] = useState<string | null>(null);
  // The schedule shows a READ-ONLY lineup peek (the editable builder lives on the Lineups page).
  // These hold the loaded lineup just for that preview.
  const [lineupMode, setLineupMode] = useState<RepLineupMode>('everyone_bats');
  const [lineupRows, setLineupRows] = useState<LineupPlayerRow[]>([]);
  const [lineupInningCount, setLineupInningCount] = useState(sportPack.defaultPeriodCount);
  // THE PEEK'S LOOK-ONLY INNING FLIP (phone re-evaluation stage 3 · D3, the owner's fourth read,
  // 2026-09-21): which inning the batting order's position column reads. Set when the sheet opens
  // — 1, or on a game in play the inning the console last showed on this device (its own per-game
  // memory, READ here, never written). Every width: a read has no phone-only reason.
  // Nothing here edits — the doors stay the way to change anything.
  const [peekInning, setPeekInning] = useState(() => initialPeekInning(ev));
  // Player ids that are actually in the SAVED lineup — used to flag attendance ↔ lineup drift.
  const [lineupEntryIds, setLineupEntryIds] = useState<Set<string>>(new Set());
  const [lineupLoading, setLineupLoading] = useState(drawerDoors.lineupTab);
  const [scoreForm, setScoreForm] = useState<{ teamScore: string; opponentScore: string } | null>(null);
  const [giveAwardOpen, setGiveAwardOpen] = useState(false);
  // Editing an already-given award (Awards One Tag Idiom Part A) reuses the give form — null
  // when the modal is giving a NEW award instead.
  const [editingAward, setEditingAward] = useState<RepPlayerAward | null>(null);
  const [awardBusyId, setAwardBusyId] = useState<string | null>(null);
  const [awardActionError, setAwardActionError] = useState('');

  // The console keeps the inning it last showed per game in sessionStorage; a game in play opens
  // the peek there so the coach reads the inning they are in. Read only — the sheet never writes it.
  function initialPeekInning(event: RepTeamEvent): number {
    if (!gameHasStarted(event, nowMs)) return 1;
    try {
      const saved = Number(sessionStorage.getItem(gameDayPeriodKey(event.id)) ?? '');
      return Number.isInteger(saved) && saved >= 1 ? saved : 1;
    } catch { return 1; }
  }

  // The slide-over is declared a modal dialog (role + aria-modal, stage 0 · A4) — so it stands on
  // the same floor as RoomShell and QuestionShell (/review 2026-09-20): Escape closes through the
  // same door as the X (a pending attendance edit is flushed first), Tab stays inside, focus lands
  // on the panel and returns to the opener. Declaring modal without this told a screen reader the
  // page behind was inert while keyboard focus could still wander into it.
  const slideOverRef = useRef<HTMLDivElement | null>(null);
  /**
   * THE OPEN GAME IS A PLACE (owner, 2026-09-22 — "browser back skips the game"). The sheet's
   * floor names its ADDRESS: the same `?event=…&tab=…` the page reopens a game from (its deep
   * link), and already hands the lineup builder as its way back. Every door out of the sheet leads
   * to another PAGE — the builder, Game day, Run practice, a player — and the level the sheet stood
   * on carried no place, so Back out of one of them stepped over it onto the bare schedule and the
   * coach lost the game they came from. With the address on it, Back lands on the game, on the tab
   * they were reading, and a reload keeps it open. `useBackStep` writes it silently and takes it
   * away again when the sheet is CLOSED, so a live address always means a sheet is open.
   * ⚠ The RAW `slideTab`, not the resolved `activeSlideTab` — the fallback for a coach whose
   * grants open no such tab belongs to the read, and it runs again on the way back in.
   */
  const sheetAddress = `${base}/schedule?event=${ev.id}&tab=${slideTab}`;
  useDialogFloor(true, slideOverRef, { onClose: () => { void requestCloseSlideOver(); }, address: sheetAddress });

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
    // Ask only for what this coach's grants open (the same answer the panel's tabs read). A
    // refused read used to be swallowed here and rendered as "add players to the roster first" —
    // a false statement about the team, made to a helper who was never going to see the tab.
    const wantLineup = drawerDoors.lineupTab;
    const wantAttendance = drawerDoors.attendanceTab;

    async function fetchAttendance() {
      if (!wantLineup && !wantAttendance) {
        setAttendanceRows([]);
        setLineupRows([]);
        setLineupEntryIds(new Set());
        setAttendanceError('');
        setAttendanceDirty(false);
        setAttendanceLoading(false);
        setLineupLoading(false);
        return;
      }
      setAttendanceLoading(true);
      setLineupLoading(wantLineup);
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
          lineup?: RepTeamLineup | null;
          entries?: RepTeamLineupEntry[];
          programYear?: RepProgramYear | null;
        } = await res.json();
        if (cancelled) return;

        /**
         * ⚠⚠ **THIS GAME'S CALL-UPS BELONG IN THE PEEK'S PLAYER LIST (mig 309), and leaving them out
         * showed a batting order that was not the saved one.** `buildLineupRows` drops any entry it
         * cannot resolve to a player, and the local `renumberBattingOrder` then closes the gap — so
         * a call-up batting 4th simply vanished and batters 5–9 each moved up a slot. A coach
         * checking the order from the schedule read a different lineup from the printed card and the
         * bench console. Read-only, so nothing was corrupted; it was just quietly wrong.
         * The builder carries the identical warning; this is the surface that had not been updated
         * with it. Found by `/review`.
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
          const mode = data.lineup?.lineupMode ?? 'everyone_bats';
          // Players marked Out (absent) are left out of the lineup; they appear under "Not playing".
          const absentIds = new Set((data.attendance ?? []).filter(a => a.status === 'absent').map(a => a.playerId));
          const playingPlayers = players.filter(p => !absentIds.has(p.id));
          setLineupMode(mode);
          setLineupInningCount(data.lineup?.inningCount ?? sportPack.defaultPeriodCount);
          setLineupRows(renumberBattingOrder(sortLineupRows(buildLineupRows(playingPlayers, data.entries ?? [], mode)), mode));
          setLineupEntryIds(new Set((data.entries ?? []).map(e => e.playerId)));
        } else {
          setLineupRows([]);
          setLineupEntryIds(new Set());
        }
      } catch (e: unknown) {
        if (!cancelled) setAttendanceError(errorMessage(e, 'Failed to load attendance'));
      } finally {
        if (!cancelled) setAttendanceLoading(false);
        if (!cancelled) setLineupLoading(false);
      }
    }

    fetchAttendance();
    return () => { cancelled = true; };
  }, [orgSlug, ev, teamId, sportPack.defaultPeriodCount, drawerDoors.lineupTab, drawerDoors.attendanceTab]);

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
    setSaveError('');
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/events/${ev.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Update failed');
      const { event: updated } = await res.json();
      onEventChanged(updated);
      await refresh();
    } catch (e: unknown) {
      setSaveError(errorMessage(e, 'Update failed'));
    } finally {
      setSaving(false);
    }
  }

  // ── Delete ──────────────────────────────────────────────────────────────────

  async function handleDelete(eventId: string, scope: 'one' | 'remaining' | 'all') {
    setSaving(true);
    try {
      // Closing happens only on success — a failure must leave the slide-over up, since that is
      // where `saveError` renders — and immediately, with the refresh trailing behind it.
      await deleteEventRequest(orgSlug, teamId, eventId, scope);
      setDeleteConfirm(null);
      onDeleted();
      await refresh();
    } catch (e: unknown) {
      setSaveError(errorMessage(e, 'Delete failed'));
    } finally {
      setSaving(false);
    }
  }

  function setPlayerAttendance(playerId: string, patch: Partial<Pick<AttendancePlayerRow, 'status' | 'note'>>) {
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

  // Tabs for the event slide-over (keeps it short instead of one long stack)
  const isGameEvent = GAME_EVENT_TYPES.includes(ev.eventType);
  // Batch 4: a MIRRORED tournament game. The organizer owns its time, opponent, venue, score,
  // result and whether it happened; the coach owns arrival time, uniform, field, notes, links,
  // tags — and attendance + the lineup, which is the entire point. The API enforces the same
  // split, so hiding these controls is honesty, not the guard.
  const mirroredGame = isMirroredEvent(ev);
  // The page-level create + the panel's Edit / Cancel / Delete — ONE rule, read from the
  // doors object rather than computed a second time beside it (`/review`, 2026-09-10).
  const canAddEvents = drawerDoors.editEvent;

  /**
   * ⚠ EVERY TAB RIDES A GRANT (staff access review, 2026-09-10). Attendance used to be seeded
   * unconditionally and Lineup pushed on any game, so a schedule-only helper met both tabs, a
   * refused read behind each, and three "Build lineup" doors onto a page that says lineups aren't
   * turned on. The doors object is the single answer for the tab, the fetch and the markup.
   */
  const slideTabs: { key: SlideTab; label: string }[] = [];
  if (drawerDoors.attendanceTab) slideTabs.push({ key: 'attendance', label: 'Attendance' });
  if (drawerDoors.lineupTab) slideTabs.push({ key: 'lineup', label: 'Lineup' });
  // Scouting Book glance (owner-approved 2026-08-04): games with a real opponent name only —
  // a TBD bracket slot gets no tab, never a dead end. Read gates on `schedule`, which is
  // everyone who can open this page — helpers included, by ruling. Archive absence rides
  // `scoutingAvailable`, the same flag that gates the roll-up fetch.
  const scoutingKey = drawerDoors.scoutingTab && ev.opponent
    ? normalizeOpponentName(ev.opponent)
    : '';
  if (scoutingKey) slideTabs.push({ key: 'scouting', label: 'Scouting' });
  // The first tab this coach actually holds — or none, for a coach whose grants open no tab on
  // this event (a helper on a game with no named opponent sees the details and nothing under them).
  const activeSlideTab: SlideTab | null =
    slideTabs.some(t => t.key === slideTab) ? slideTab : (slideTabs[0]?.key ?? null);

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

  // Attendance ↔ lineup mismatch for the open game (top-section warning). Only when a lineup exists.
  const lineupMismatch = (() => {
    if (!isLineupEvent(ev) || lineupEntryIds.size === 0) return null;
    const coming = attendanceRows
      .filter(r => (r.status === 'attending' || r.status === 'late') && !lineupEntryIds.has(r.player.id))
      .map(r => playerDisplayName(r.player));
    const out = attendanceRows
      .filter(r => r.status === 'absent' && lineupEntryIds.has(r.player.id))
      .map(r => playerDisplayName(r.player));
    return coming.length > 0 || out.length > 0 ? { coming, out } : null;
  })();

  /**
   * ══════════════════════════════════════════════════════════════════════════════════════════
   * THE EVENT SHEET — its blocks, named once, rendered in ONE OF TWO ORDERS (phone re-evaluation
   * stage 2 · C3, owner ruling 2026-09-21).
   *
   * The desktop (≥641) keeps exactly the order it has had: header · title · when · the source and
   * moved notes · where · the score · tags · awards · description · resources · the practice plan ·
   * the actions · the lineup warning · the tabs and the tab's content.
   *
   * A phone renders the same blocks in the order they are USED, and "the day" is decided by the
   * clock the product already keeps (`gameHasStarted` — the same start the game-day console and
   * the lineup's Ready state turn on):
   *   · BEFORE FIRST PITCH (an upcoming game, or today's until it starts): header · title · when ·
   *     the where-ROW · notes · the tabs and the tab's content · then "+ Add final score" as a quiet
   *     door (a coach who types a score early still finds it) · tags · description · resources ·
   *     the foot row. The locked awards box ("Enter a final score to unlock awards") does not render
   *     here — a sentence explaining an absence, on a game morning (the 2026-09-04 anti-clutter rule).
   *   · FROM FIRST PITCH ON, and whenever a score already exists: the score leads — the door, or
   *     the scoreline with Edit score and the book row — then tags · awards · the tabs and content ·
   *     description · resources · the foot row.
   *   · A PRACTICE keeps its plan block first (the practices re-evaluation's own block, unchanged),
   *     then attendance (one tab, so no tab row), then the notes and the foot row.
   * The order is JSX order, never CSS `order`: the tab sequence must match the reading order.
   * `isPhone` is a real width because the sheet only opens after mount (`useIsPhone`).
   *
   * Survives the reorder, by construction: the deep-link tab (`?tab=lineup|scouting` → the sheet's
   * opening `place`, the fallback to the first held tab), `useDialogFloor` on the panel (Escape
   * through `requestCloseSlideOver`, the Tab trap, focus return), `data-field-floor` on the
   * attendance section (A4), `scheduleDrawerDoors` deciding every door exactly as before.
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
      <button className={styles.modalCloseBtn} onClick={requestCloseSlideOver}>
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
     tab. W/L/T is always derived from the two numbers (no manual override).
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
              (owner ruling). The tab itself is the capture sheet. */}
          {scoutingKey && activeSlideTab !== 'scouting' && (
            <button type="button" className={styles.scoutToastDoor} onClick={() => setSlideTab('scouting')}>
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
        {scoutingKey && activeSlideTab !== 'scouting' && (
          <button type="button" className={styles.scoutToastDoor} onClick={() => setSlideTab('scouting')}>
            Add to the book on {ev.opponent} ›
          </button>
        )}
      </div>
    </div>
  ) : null;

  /* Applied tags — read-only here; the picker/manager live in "Edit details". */
  const tagsBlock = tagIds.length > 0 ? (
    <div className={styles.lineupChips}>
      {tagIds.map(tagId => {
        const tag = teamTags.find(t => t.id === tagId);
        return tag ? <span key={tagId} className={styles.lineupChip}>{tag.name}</span> : null;
      })}
    </div>
  ) : null;

  /* Awards given — the "same visit" give-award moment (Coach Tags & Player Awards
     Phase 2). A GAME: gated on a final score, same as the tags/score UI above it; on a phone it
     does not render before the game has started (C3): once the score leads, exactly as before.
     ANY OTHER EVENT — a practice, a team event, a whole tournament (awards at any event, owner
     2026-09-25): the section exists only once the event can carry an award (started, not
     cancelled — `awardUnlockState`, the same rule the POST route refuses by). Before that there
     is no section at all, not a locked box: an upcoming practice's window is exactly what it was.
     Placement differs by kind — see the two orders below. */
  const awardUnlock = awardUnlockState(ev, nowMs);
  const awardKind = awardEventKind(ev.eventType);
  const awardsBlock = drawerDoors.awards && (isGameEvent ? (!isPhone || scoreLeads) : awardUnlock === 'open') ? (
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

  /* ── Practice plan (Practice Plans 1a) ──
     A SUMMARY plus a door, never the editor: the plan is written on its own drill-in
     where the focus rail and the rotation grid have room. Read rides `schedule` (this
     whole slide-over already does); writing is head-coach-only and the builder says so.
     The links section above is left completely alone — some coaches will keep their
     own document forever, and that is a legitimate outcome (D2).

     ⚠ The archive suppression here is DELETED (2026-08-18), and what it protected still
     holds: the practice-plan routes resolve the team's ACTIVE program year, so from a
     closed season "Open the plan →" errored and "Plan this practice →" invited a write
     into a finished season. This screen is no longer rendered for a closed season at
     all, so there is nothing left to hide — and READING a past plan has its own home,
     the practices shelf on the closed-season page, which reaches a year-aware read
     route rather than this one.

     ⚠ NO "Run practice →" HERE (owner, 2026-09-18). This panel is one practice's
     surface, like a row on the Practice plans hub, and the field door left every
     per-practice surface at once: the shortcut lives on the next-practice card alone
     (the hub's and the Overview's), and every other practice is two taps — Open the
     plan, then Run practice, first in the plan's toolbar on any day. Before that it was
     offered on any plan ROW (a goal-only plan got "There's no plan to run yet"), then
     window-gated (stage 5, P3), then on any planned practice (P10) — three answers in
     a week, all to a question the plan page already answers. */
  const practiceBlock = ev.eventType === 'practice' ? (
    <div className={styles.formSection} style={{ marginTop: '0.75rem' }}>
      <h4 className={styles.formSectionTitle}>Practice plan</h4>
      {/* "Has a plan" is the hub's ONE definition — at least one block (stage 0; stage 6
          applied it here): a goal typed and abandoned is a real, blockless row, and it
          read "0 blocks — …" with an Open door on this panel while the hub's row said
          "No plan written". */}
      {practiceHasPlan(ev) ? (
        <>
          <p className={styles.formHint}>
            {summarizePracticePlan(ev.practicePlan!)}
            {ev.practicePlan!.goal ? ` — ${ev.practicePlan!.goal}` : ''}
          </p>
          <div className={`${styles.ppToolbar} ${styles.ppToolbarFlush}`}>
            <Link href={`${base}/practice/${ev.id}`} className={styles.btnSecondary}>
              Open the plan →
            </Link>
          </div>
        </>
      ) : (
        /* The door follows the grant the plan page itself writes on — Schedule: View +
           edit (`canWritePracticePlans`, staff-access pass 2) — never "head coach"
           (practices re-evaluation stage 6, owner ruling R8, 2026-09-18): an assistant
           with View + edit read "No plan yet." here and "Plan this practice" on the hub.
           A viewer gets the plan page's own sentence, so the panel says WHY and not just
           "no". */
        capabilities && canWritePracticePlans(capabilities) ? (
          <>
            <p className={styles.formHint}>
              No plan yet — set out the blocks, stations and groups for this practice.
            </p>
            <Link href={`${base}/practice/${ev.id}`} className={styles.btnSecondary}>
              Plan this practice →
            </Link>
          </>
        ) : (
          <p className={styles.formHint}>
            No plan yet. Writing the plan comes with Schedule: View + edit — ask your head coach.
          </p>
        )
      )}
    </div>
  ) : null;

  /* Actions — Edit (+ tournament Add game) lead; Cancel/Delete grouped to the right so
     the destructive pair is separated from the everyday action. Above the tabs on the
     desktop; on a phone THE FOOT ROW (C3) — three equal 44px cells under a hairline, Delete in
     the danger ink, "+ Add game" on its own full row beneath; the delete confirmation renders
     in its place, and a mirrored game shows its sentence there. PINNED to the foot of the sheet
     (owner, 2026-09-21 — it sat at the END of the sheet and was hard to find under a long
     list): it joins the form sheets' `.modalFooter` recipe rather than growing a second
     sticky rule, so the sheet drops its bottom padding and clears the home indicator the way
     every Save bar already does. Phone only — the class rides the same `isPhone` branch.
     ⚠ Absent entirely in an archive (Chunk F): the server already refuses these for a
     past season, but a record that draws Edit / Cancel / Delete and then errors is
     worse than one that simply doesn't offer them. */
  const addGameButton = ev.eventType === 'external_tournament' ? (
    <button className={`${styles.btnSecondary}${isPhone ? ` ${styles.slideOverFootWide}` : ''}`} disabled={saving} onClick={() => onAddGame(ev)}>
      + Add game
    </button>
  ) : null;
  const actionsBlock = canAddEvents ? (
    <div className={`${styles.slideOverActions}${isPhone ? ` ${styles.slideOverFoot} ${styles.modalFooter}` : ''}`}>
      {!deleteConfirm ? (
        <>
          <button className={styles.btnSecondary} disabled={saving} onClick={() => onEdit(ev, { tab: slideTab, filter: attendanceFilter })}>
            Edit details
          </button>
          {!isPhone && addGameButton}
          {/* A mirrored game isn't the coach's to cancel or delete — and it wouldn't
              stick: the next sync would restore it from the organizer's schedule, minus
              the attendance and lineup a delete would have cascaded away. */}
          {mirroredGame ? (
            <span className={styles.slideOverActionsRight}>
              <span className={styles.formHint}>Only {ev.name} can cancel or remove this game.</span>
            </span>
          ) : (
            <div className={styles.slideOverActionsRight}>
              <button className={styles.btnGhost} disabled={saving} onClick={handleToggleCancel}>
                {ev.status === 'cancelled' ? 'Restore event' : 'Cancel event'}
              </button>
              <button className={styles.btnDanger} onClick={() => setDeleteConfirm({ eventId: ev.id, isRecurring: ev.isRecurring })}>
                Delete
              </button>
            </div>
          )}
          {isPhone && addGameButton}
        </>
      ) : (
        <div className={styles.deleteConfirm}>
          <p className={styles.deleteConfirmMsg}>
            {deleteConfirm.isRecurring ? 'Delete this recurring practice:' : `Delete "${ev.name}"?`}
          </p>
          <div className={styles.deleteConfirmBtns}>
            {deleteConfirm.isRecurring ? (
              <>
                <button className={styles.btnDanger} disabled={saving} onClick={() => handleDelete(deleteConfirm.eventId, 'one')}>This only</button>
                <button className={styles.btnDanger} disabled={saving} onClick={() => handleDelete(deleteConfirm.eventId, 'remaining')}>This &amp; future</button>
                <button className={styles.btnDanger} disabled={saving} onClick={() => handleDelete(deleteConfirm.eventId, 'all')}>All</button>
              </>
            ) : (
              <button className={styles.btnDanger} disabled={saving} onClick={() => handleDelete(deleteConfirm.eventId, 'one')}>Confirm delete</button>
            )}
            <button className={styles.btnGhost} onClick={() => setDeleteConfirm(null)}>Cancel</button>
          </div>
          {saveError && <p className={styles.errorText}>{saveError}</p>}
        </div>
      )}
    </div>
  ) : null;

  const peekWarnBlock = lineupMismatch && drawerDoors.lineupTab ? (
    <div className={styles.lineupPeekWarn} role="status">
      {lineupMismatch.coming.length > 0 && (
        <p>⚠ Marked in but not in the lineup: {lineupMismatch.coming.join(', ')}.</p>
      )}
      {lineupMismatch.out.length > 0 && (
        <p>⚠ In the lineup but marked Out: {lineupMismatch.out.join(', ')}.</p>
      )}
      <span>
        Fix the attendance below, or{' '}
        <Link href={`${base}/lineups/${ev.id}`} style={{ textDecoration: 'underline', color: 'var(--white-80)' }}>edit the lineup →</Link>
      </span>
    </div>
  ) : null;

  const tabsBlock = slideTabs.length > 1 ? (
    <div className={styles.slideTabs} role="tablist">
      {slideTabs.map(t => (
        <button
          key={t.key}
          type="button"
          role="tab"
          aria-selected={activeSlideTab === t.key}
          className={`${styles.slideTab} ${activeSlideTab === t.key ? styles.slideTabActive : ''}`}
          onClick={() => setSlideTab(t.key)}
        >
          {t.label}
        </button>
      ))}
    </div>
  ) : null;

  const scoutingTab = activeSlideTab === 'scouting' && scoutingKey ? (
    <OpponentScoutingPanel
      orgSlug={orgSlug}
      teamId={teamId}
      eventId={ev.id}
      opponentName={ev.opponent!}
      mirrored={isMirroredEvent(ev)}
    />
  ) : null;

  const attendanceTab = activeSlideTab === 'attendance' ? (() => {
    const filteredRows = attendanceFilter === 'all'
      ? attendanceRows
      : attendanceRows.filter(row => row.status === attendanceFilter);
    // data-field-floor: a surface read standing up — the sweep holds its type floor (A4).
    return (
      <div className={styles.attendanceSection} data-field-floor>
        <div className={styles.attendanceHeader}>
          <h3 className={styles.attendanceTitle}>Attendance</h3>
          <div className={styles.attendanceBulkActions}>
            <button
              type="button"
              className={styles.btnGhost}
              disabled={attendanceLoading || attendanceRows.length === 0}
              onClick={() => setAllAttendance('attending')}
            >
              <CheckCircle2 size={14} /> All in
            </button>
            <button
              type="button"
              className={styles.btnGhost}
              disabled={attendanceLoading || attendanceRows.length === 0}
              onClick={() => setAllAttendance('unknown')}
            >
              <CircleHelp size={14} /> Reset
            </button>
            {/* ⚠ "Season attendance" (Batch 4's return trip to the Insights report) sat here
                beside the bulk actions, and as a quiet row under the list on a phone (C3) —
                until the owner's first look at the built phone sheet (2026-09-21): a coach
                mid-game is likelier to leave the game by accident through it than to read the
                season on purpose, and Insights is one nav tap away at every width. Gone from
                both widths; `scheduleDrawerDoors` no longer decides it. */}
          </div>
        </div>

        {/* Metric chips that double as filters — counts are always visible; tap to focus.
            On a phone: five equal 44px cells (C3). */}
        {attendanceRows.length > 0 && (
          <div className={styles.attendanceFilters} role="group" aria-label="Filter attendance by status">
            <button
              type="button"
              aria-pressed={attendanceFilter === 'all'}
              className={`${styles.attFilter} ${attendanceFilter === 'all' ? styles.attFilterActiveAll : ''}`}
              onClick={() => setAttendanceFilter('all')}
            >
              All <span className={styles.attFilterCount}>{attendanceRows.length}</span>
            </button>
            {ATTENDANCE_OPTIONS.map(option => {
              const Icon = option.icon;
              const count = attendanceRows.filter(row => row.status === option.value).length;
              const active = attendanceFilter === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  data-status={option.value}
                  aria-pressed={active}
                  aria-label={`${option.label}: ${count}`}
                  title={option.label}
                  className={`${styles.attFilter} ${active ? styles.attFilterActive : ''}`}
                  onClick={() => setAttendanceFilter(active ? 'all' : option.value)}
                >
                  <Icon size={14} /> <span className={styles.attFilterCount}>{count}</span>
                </button>
              );
            })}
          </div>
        )}

        {attendanceLoading ? (
          <CoachLoading label="Loading attendance…" inline />
        ) : attendanceError && attendanceRows.length === 0 ? (
          // A read that FAILED is said as a failure. It used to fall through to the empty
          // line below and claim the roster had no active players.
          <div className={styles.attendanceEmpty}>{attendanceError}</div>
        ) : attendanceRows.length === 0 ? (
          <div className={styles.attendanceEmpty}>Add active players to the roster before marking attendance.</div>
        ) : filteredRows.length === 0 ? (
          <div className={styles.attendanceEmpty}>No players in this group.</div>
        ) : (
          /* THE ROWS ARE THE PORTAL'S ONE ROW LIST, and THE ROW IS THE TAP (C3, the owner's second
             read: one frame with hairlines, no gaps — the schedule's own treatment). Each row is a
             `<button aria-haspopup="dialog">` that raises the RSVP sheet for that player; the
             status badge is its trail (its word at the body size — on attendance-taking the status
             IS the looked-for value, A4's field key), the note flag beside it, a chevron says it
             opens. The per-row button and the inline editor it opened are gone at every width. */
          <CoachRowList label="Attendance" inset phoneFrame className={styles.attendanceRows}>
            {filteredRows.map(row => {
              const cur = ATTENDANCE_BY_VALUE[row.status] ?? ATTENDANCE_BY_VALUE.unknown;
              const StatusIcon = cur.icon;
              const name = playerDisplayName(row.player);
              return (
                <CoachRow
                  key={row.player.id}
                  as="button"
                  aria-haspopup="dialog"
                  aria-label={`${name} · ${cur.label}${row.note ? ' · has a note' : ''} · set attendance`}
                  onClick={() => setRsvpEditId(row.player.id)}
                  title={name}
                  trail={
                    <>
                      {row.note && (
                        <span className={styles.attendanceNoteFlag} title={row.note} aria-hidden>
                          <StickyNote size={13} />
                        </span>
                      )}
                      {/* Current status — same icon + colour as the filter chips. */}
                      <span className={styles.attendanceStatusBadge} data-status={row.status} data-field-key aria-hidden>
                        <StatusIcon size={14} />
                        <span>{cur.label}</span>
                      </span>
                    </>
                  }
                  door="chevron"
                />
              );
            })}
          </CoachRowList>
        )}
        {/* The autosave word, a transient pill at the window's foot (owner 2026-09-20, revising
            that morning's home in the sheet's header): appears on an edit, says "Saved" and
            fades; only an error stays. Fixed to the viewport, so inside this scrolling panel
            it shows wherever the list is scrolled to. */}
        {attendanceRows.length > 0 && (
          <SaveStatusPill saving={attendanceSaving} dirty={attendanceDirty} error={attendanceError} onRetry={handleAttendanceSave} />
        )}
      </div>
    );
  })() : null;

  const lineupTab = activeSlideTab === 'lineup' && isLineupEvent(ev) ? (
    <div className={styles.lineupSection}>
      {(() => {
        // The builder, with the way back to THIS sheet (stage 3 · D3): stage 2's deep link lands
        // on the Lineup tab, so the builder's arrow returns the coach to the game they left.
        const editHref = lineupBuilderHref(base, ev.id, { returnTo: `${base}/schedule?event=${ev.id}&tab=lineup` });
        const hasLineup = lineupRows.some(r => Object.values(r.inningPositions).some(Boolean));
        const battingRows = sortLineupRows(lineupRows).filter(r => lineupMode === 'nine_player' ? r.starter : true);
        // THE DOOR TURNS BY THE CLOCK (stage 3 · D3, owner 2026-09-21: "can we make manual
        // adjustments during the game here, or is that duplicative?"): before the game it is the
        // builder; from game time it is the console — already the in-game adjustment surface
        // (the inning stepper, subs with a this-inning / onward scope, the bench by longest
        // sitting, the same lineup PUT). The same clock that makes the sheet score-first.
        const started = gameHasStarted(ev, nowMs);
        const peekDoor = started
          ? { href: `${base}/game/${ev.id}`, word: 'Game day' }
          : { href: editHref, word: 'Edit' };
        const inningShown = Math.min(Math.max(1, peekInning), Math.max(1, lineupInningCount));
        return (
          <>
            {/* The heading row carries the door on a phone (44px, the accent — the foot door
                sat 1,067px into the sheet under the whole order); the chip stays. The desktop
                keeps its foot door and this link is hidden above 640. */}
            <div className={styles.lineupPeekHeader}>
              <div className={styles.lineupPeekTitleRow}>
                <h3 className={styles.attendanceTitle}>Lineup</h3>
                {/* This is a quick look — "build and edit on the Lineups page" below already
                    says so — so it claims only what it can see from these rows: whether
                    anything is saved. The honest Not started/Draft/Ready/Needs review badge
                    (F02) belongs to the hub, the builder and the Overview, which actually run
                    the analysis; a plain "has content" fact is exactly right here. */}
                <span className={styles.lineupFrontChip} data-tone={hasLineup ? 'ok' : 'warn'}>
                  {hasLineup ? <><CheckCircle2 size={13} aria-hidden /> Has a lineup</> : <><CircleSlash size={13} aria-hidden /> No lineup yet</>}
                </span>
                {hasLineup && (
                  <Link href={peekDoor.href} className={styles.lineupPeekDoor} data-door={started ? 'game-day' : 'edit'}>
                    {peekDoor.word} <span aria-hidden>›</span>
                  </Link>
                )}
              </div>
              <p className={styles.attendanceSummary}>
                {hasLineup ? 'A quick look — build and edit on the Lineups page.' : 'No lineup set for this game yet.'}
              </p>
            </div>

            {lineupLoading ? (
              <CoachLoading label="Loading the lineup…" inline />
            ) : !hasLineup ? (
              <div className={styles.lineupPeekEmpty}>
                <p>Build the batting order and field positions on the full Lineups page.</p>
                <Link href={editHref} className="btn btn-lime btn-sm">Build lineup →</Link>
              </div>
            ) : (
              <>
                {/* No count / innings / format strip here (owner 2026-09-21): a quick look
                    shows the order itself, and the section's own gap is the only rhythm —
                    the peek's children carry no margins of their own. */}
                {/* THE LOOK-ONLY INNING FLIP: ‹ › either side of the kicker; the position beside
                    each name follows the inning. "—" where the cell is open. Never a setter on
                    the rows — the doors are the way to change anything. */}
                <div className={styles.lineupPeekFlip} data-lineup-peek-flip>
                  <button type="button" className={styles.gdStepper} aria-label={`Previous ${sportPack.periodLabel.toLowerCase()}`} disabled={inningShown <= 1} onClick={() => setPeekInning(inningShown - 1)}>‹</button>
                  <p className={`${styles.sectionKicker} ${styles.lineupPeekKicker}`} aria-live="polite">
                    {sportPack.orderLabel} · <b>{sportPack.periodLabel} {inningShown} of {lineupInningCount}</b>
                  </p>
                  <button type="button" className={styles.gdStepper} aria-label={`Next ${sportPack.periodLabel.toLowerCase()}`} disabled={inningShown >= lineupInningCount} onClick={() => setPeekInning(inningShown + 1)}>›</button>
                </div>
                <ol className={styles.lineupPeekOrder}>
                  {battingRows.map(r => (
                    <li key={r.player.id}>
                      <span className={styles.lineupPeekBat}>{r.battingOrder || '–'}</span>
                      <span className={styles.lineupPeekName}>{playerDisplayName(r.player)}</span>
                      <span className={styles.lineupPeekPos} data-blank={!r.inningPositions[String(inningShown)] || undefined}>{r.inningPositions[String(inningShown)] || '—'}</span>
                    </li>
                  ))}
                </ol>

                {/* The desktop's foot door; hidden at ≤640 where the heading row carries it. */}
                <div className={styles.lineupPeekFooter}>
                  <Link href={editHref} className="btn btn-lime btn-sm">Edit in Lineups →</Link>
                </div>
              </>
            )}
          </>
        );
      })()}
    </div>
  ) : null;
  const tabContent = <>{scoutingTab}{attendanceTab}{lineupTab}</>;

  // THE TWO ORDERS — JSX order, never CSS `order` (see the block above).
  // Awards: a game's follow its score and tags; any other event's close its record, after the
  // description, links and practice plan and directly above the action row (owner, 2026-09-25).
  const body = !isPhone ? (
    <>
      {titleBlock}{whenLine}{sourceBlock}{movedBlock}{whereBlock}{placeNote}
      {scoreBlock}{tagsBlock}{isGameEvent && awardsBlock}{descriptionBlock}{resourcesBlock}{practiceBlock}
      {!isGameEvent && awardsBlock}
      {actionsBlock}{peekWarnBlock}{tabsBlock}{tabContent}
    </>
  ) : scoreLeads ? (
    <>
      {titleBlock}{whenLine}{whereBlock}{placeNote}{sourceBlock}{movedBlock}
      {scoreBlock}{tagsBlock}{awardsBlock}
      {peekWarnBlock}{tabsBlock}{tabContent}
      {descriptionBlock}{resourcesBlock}{actionsBlock}
    </>
  ) : (
    <>
      {titleBlock}{whenLine}{whereBlock}{placeNote}{sourceBlock}{movedBlock}
      {practiceBlock}
      {/* Only ever a NON-game's awards on this branch (a game's wait for the score to lead), and
          only once it has started: ABOVE attendance, the place a started game's awards hold on a
          phone and every event's hold on desktop. First built below attendance; the owner, on the
          first look at the build (2026-09-25): "why is give awards in a different place in
          practices vs. games?" — one place on every event. */}
      {awardsBlock}
      {peekWarnBlock}{tabsBlock}{tabContent}
      {scoreBlock}{tagsBlock}
      {descriptionBlock}{resourcesBlock}{actionsBlock}
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
          className={`${styles.slideOver}${activeSlideTab === 'lineup' ? ` ${styles.slideOverWide}` : ''}`}
          role="dialog"
          aria-modal="true"
          aria-label={ev.name}
          data-sheet-order={isPhone ? (scoreLeads ? 'score-first' : 'tabs-first') : 'desktop'}
          onClick={e => e.stopPropagation()}
        >
          {header}
          {body}
        </div>
      </div>

      {/* THE RSVP SHEET (stage 2 · C3) — one player's attendance from the foot of the screen. A
          SIBLING of the event sheet's overlay, never a child of its panel: its dialog floor stacks
          over the event sheet's, and a floor answers an Escape from inside ITS panel — nested, one
          key would close both. Tapping a choice writes it through the list's own path and closes;
          a typed note rides the same autosave (the transient pill). */}
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
          }}
          editing={editingAward}
          onClose={() => { setGiveAwardOpen(false); setEditingAward(null); }}
          onChanged={onAwardsChanged}
        />
      )}
    </>
  );
}
