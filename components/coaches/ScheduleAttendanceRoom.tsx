'use client';
import { CheckCircle2, CircleHelp, StickyNote } from 'lucide-react';
import SaveStatusPill from '@/components/coaches/SaveStatusPill';
import CoachLoading from '@/components/coaches/CoachLoading';
import { CoachRowList, CoachRow } from '@/components/coaches/CoachRowList';
import { ATTENDANCE_OPTIONS } from '@/components/coaches/attendanceOptions';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';
import { playerDisplayName } from '@/lib/coach-roster-name';
import type { RepAttendanceStatus, RepRosterPlayer } from '@/lib/types';

/**
 * THE ATTENDANCE ROOM (the Schedule deep dive, stage 1 · E2, owner ruling 2026-09-25: "as drawn —
 * the full-screen room"). The event sheet's Attendance row opens it as a VIEW inside the sheet's own
 * dialog — on a phone that dialog already covers the whole screen, bottom bar included (a working
 * surface: the drawer rule's "form" layer); at a desk the 720px dialog's body swaps to it. It is
 * one Back level: Back, the arrow and Escape return to the event.
 *
 * Everything here was MOVED from the sheet's Attendance tab, not redrawn: the five count chips that
 * double as filters (44px on a phone), All in and Reset, the player rows (the row is the tap, and
 * raises the RSVP sheet — unchanged, the second visible layer), the transient Saved pill, and
 * `data-field-floor` (a surface read standing up — the sweep holds its type floor, A4). What went is
 * the "Attendance" heading that repeated the tab above it (F04): the room's head says it once.
 * Drawn to show all twelve players on screen one at 390×844 and 360×780.
 *
 * The state — the rows, the filter, the autosave behind them — stays the SHEET's, so closing the
 * room never drops an answer in flight and the Attendance row reads the same list the room edits.
 */

export interface AttendanceRoomRow {
  player: RepRosterPlayer;
  status: RepAttendanceStatus;
  note: string;
}

// Quick status → {label, icon} lookup for the per-player status badge.
const ATTENDANCE_BY_VALUE = Object.fromEntries(
  ATTENDANCE_OPTIONS.map(o => [o.value, o]),
) as Record<RepAttendanceStatus, (typeof ATTENDANCE_OPTIONS)[number]>;

export default function ScheduleAttendanceRoom({
  attendanceRows, attendanceLoading, attendanceError, attendanceSaving, attendanceDirty,
  attendanceFilter, setAttendanceFilter, setAllAttendance, setRsvpEditId, handleAttendanceSave,
}: {
  attendanceRows: AttendanceRoomRow[];
  attendanceLoading: boolean;
  attendanceError: string;
  attendanceSaving: boolean;
  attendanceDirty: boolean;
  attendanceFilter: RepAttendanceStatus | 'all';
  setAttendanceFilter: (f: RepAttendanceStatus | 'all') => void;
  setAllAttendance: (status: RepAttendanceStatus) => void;
  /** Raise the RSVP sheet for one player — with the row, where focus goes home to. */
  setRsvpEditId: (playerId: string, from: HTMLElement) => void;
  handleAttendanceSave: () => Promise<boolean>;
}) {
  const filteredRows = attendanceFilter === 'all'
    ? attendanceRows
    : attendanceRows.filter(row => row.status === attendanceFilter);
  // data-field-floor: a surface read standing up — the sweep holds its type floor (A4).
  return (
    <div className={styles.attendanceRoom} data-field-floor>
      {/* Metric chips that double as filters — counts are always visible; tap to focus.
          On a phone: five equal 44px cells (C3). First, as drawn: the room reads its counts
          before its actions. */}
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
      </div>

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
           opens. */
        <CoachRowList label="Attendance" inset className={styles.attendanceRows}>
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
                onClick={e => setRsvpEditId(row.player.id, e.currentTarget)}
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
      {/* The autosave word, a transient pill at the window's foot (owner 2026-09-20): appears on an
          edit, says "Saved" and fades; only an error stays. Fixed to the viewport, so it shows
          wherever the list is scrolled to. */}
      {attendanceRows.length > 0 && (
        <SaveStatusPill saving={attendanceSaving} dirty={attendanceDirty} error={attendanceError} onRetry={handleAttendanceSave} />
      )}
    </div>
  );
}
