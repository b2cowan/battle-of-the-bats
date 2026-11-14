'use client';
import { CheckCircle2, CircleHelp, StickyNote } from 'lucide-react';
import SaveStatusPill from '@/components/coaches/SaveStatusPill';
import LoadingState from '@/components/shared/LoadingState';
import { CoachRowList, CoachRow } from '@/components/coaches/CoachRowList';
import { ATTENDANCE_OPTIONS, attendanceOption } from '@/components/coaches/attendanceOptions';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';
import { playerDisplayName } from '@/lib/coach-roster-name';
import { countedAttendanceStatus } from '@/lib/coach-schedule-vocab';
import type { RepAttendanceSetter, RepAttendanceStatus, RepRosterPlayer } from '@/lib/types';
import { useIsPhoneNav } from '@/lib/hooks/useIsPhoneNav';
import { FAMILY_AVAILABILITY_COACH_WORDS as FW, FAMILY_REMIND_COACH_WORDS, type CoachAnswerLine } from '@/lib/family-availability-words';
import FamilyRemindPanel from '@/components/coaches/FamilyRemindPanel';
import type { RoomFamilyRow, RoomFamilySummary } from '@/lib/family-availability-rules';

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
  /** Who set the answer the server holds (One attendance record): the coach's side, a family, or nobody yet. */
  setByKind: RepAttendanceSetter | null;
  /** The status the server holds for this player (loaded or last saved): a save sends the status only when it differs from this
   *  (One attendance record: only the rows the coach changed, never the whole roster). */
  savedStatus?: RepAttendanceStatus;
  /** The coach's note as the server holds it: sent only when it differs. */
  savedNote?: string;
  /** The coach tapped this player's current answer since the last save: it is SENT anyway, because a family may have changed it
   *  since this window read it (the window doesn't re-read while open) — the tap says "this one", and latest wins. */
  confirmed?: boolean;
}

/**
 * The family side of the room (Signed-in family accounts Stage 4b, Part 5; One attendance record S2, rulings 4 and 7): the Families
 * card, and per player who set the ONE answer and when, with the family's note. Present only while families can answer this event
 * and this coach can mark attendance; the room is exactly as before without it.
 */
export interface RoomFamilyView {
  rows: Map<string, RoomFamilyRow>;
  /** Per player with an answer: who set it, when, the family's note, the one before (the server's; each save's reply refreshes it). */
  lines: Record<string, CoachAnswerLine>;
  summary: RoomFamilySummary;
  /** Remind (Part 7): only while the event is open (not started, not cancelled). The panel reads the server's own preview. */
  remind: {
    open: boolean; endpoint: string; remindedAt: string | null; nowMs: number;
    saveFirst: () => Promise<boolean>; onReminded: (at: string) => void;
  };
}

export default function ScheduleAttendanceRoom({
  attendanceRows, attendanceLoading, attendanceError, attendanceSaving, attendanceDirty,
  attendanceFilter, setAttendanceFilter, setAllAttendance, setRsvpEditId, handleAttendanceSave, family = null,
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
  family?: RoomFamilyView | null;
}) {
  const desk = !useIsPhoneNav();
  const filteredRows = attendanceFilter === 'all'
    ? attendanceRows
    : attendanceRows.filter(row => countedAttendanceStatus(row.status) === attendanceFilter); // a Maybe sits under Not marked (ruling 2)
  // data-field-floor: a surface read standing up — the sweep holds its type floor (A4).
  return (
    <div className={styles.attendanceRoom} data-field-floor>
      {family && attendanceRows.length > 0 && <FamiliesCard family={family} />}
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
            const count = attendanceRows.filter(row => countedAttendanceStatus(row.status) === option.value).length;
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
        <LoadingState label="Loading attendance…" inline />
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
        <>
        {/* At a desk who set the answer gets its own column (tab 2): Player · Set by · Answer. */}
        {family && desk && (
          <div className={styles.attFamilyHead} aria-hidden>
            <span>{FW.desk.player}</span><span>{FW.desk.setBy}</span><span>{FW.desk.answer}</span>
          </div>
        )}
        <CoachRowList label="Attendance" inset className={family && desk ? `${styles.attendanceRows} ${styles.attFamilyDesk}` : styles.attendanceRows}>
          {filteredRows.map(row => {
            // A family's Maybe renders as Maybe (One attendance record), never as a missing option.
            const cur = attendanceOption(row.status);
            const StatusIcon = cur.icon;
            const name = playerDisplayName(row.player);
            const said = family ? setByWords(family, row) : null;
            // With the family column the note is only SAID to exist (the row opens to read it), beside who set the answer.
            const hasNote = !!(row.note || (family && family.lines[row.player.id]?.familyNote));
            const noteMark = hasNote
              ? <span className={styles.attendanceNoteFlag} title="Has a note" aria-hidden><StickyNote size={13} /></span>
              : null;
            return (
              <CoachRow
                key={row.player.id}
                as="button"
                aria-haspopup="dialog"
                aria-label={`${name} · ${cur.label}${row.note ? ' · has a note' : ''}${said ? ` · ${said}` : ''} · set attendance`}
                onClick={e => setRsvpEditId(row.player.id, e.currentTarget)}
                title={name}
                // The grey line under the name is who set the answer and when, and the family's note (phone).
                caption={(said || noteMark) && !desk ? <span className={styles.attFamilyLine}>{said}{noteMark}</span> : undefined}
                trail={
                  <>
                    {family && desk && <span className={styles.attFamilyCell}><span className={styles.attFamilyText}>{said ?? ''}</span>{noteMark}</span>}
                    {row.note && !(family && desk) && (
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
        </>
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

/** Who set this player's answer and when, with the family's note (ruling 4), under the player (phone) or in the "Set by" column
 *  (desk); null = no line (Not marked, a call-up, or a pick of the coach's not saved yet — the reply's line follows the save). */
function setByWords(family: RoomFamilyView, row: AttendanceRoomRow): string | null {
  if (row.status === 'unknown' || row.status !== row.savedStatus) return null;
  const line = family.lines[row.player.id];
  return line ? FW.setLine(line) : null;
}

/** The Families card at the top of the room (tab 2): the counts, the Roster's invite, and Remind. */
function FamiliesCard({ family }: { family: RoomFamilyView }) {
  const { summary } = family;
  // A family with no parent in the app is NOT counted here and has no invite link (owner 2026-11-14): a parent who never
  // wants the app would otherwise show it to the coach on every open, all season. The Roster is where parents are invited,
  // and the Remind panel still names the players it cannot reach.
  const parts = FW.familyParts({ answered: summary.answered, haveNot: summary.haveNot });
  // Who has a parent in the app (one record: a coach's answer no longer hides a family from these counts).
  const nobody = ![...family.rows.values()].some(r => r.connected);
  // Tab 4, frame 3: open, and every family the coach hasn't marked has answered: Remind goes and the card says so.
  const nobodyLeft = family.remind.open && !nobody && summary.remind.length === 0;
  const lineParts = nobodyLeft ? [FAMILY_REMIND_COACH_WORDS.nobodyLeft] : parts;
  // Nobody is connected: one muted line, not a card with a link — there is nothing here for the coach to act on.
  if (nobody) return <p className={styles.attFamiliesLine}>{FW.card.nobody}</p>;
  // Nothing to count and nothing to send: no card.
  if (lineParts.length === 0 && !family.remind.open) return null;
  return (
    <section className={styles.attFamilies} aria-label={FW.card.title}>
      <p className={styles.attFamiliesLine}>
        <strong>{FW.card.title}</strong>
        {lineParts.length > 0 && <> · {lineParts.join(' · ')}</>}
      </p>
      {family.remind.open && (
        <FamilyRemindPanel
          endpoint={family.remind.endpoint}
          count={summary.remind.length}
          remindedAt={family.remind.remindedAt}
          nowMs={family.remind.nowMs}
          saveFirst={family.remind.saveFirst}
          onReminded={family.remind.onReminded}
        />
      )}
    </section>
  );
}
