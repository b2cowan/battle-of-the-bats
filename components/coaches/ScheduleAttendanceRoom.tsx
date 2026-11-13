'use client';
import Link from 'next/link';
import { CheckCircle2, CircleHelp, StickyNote } from 'lucide-react';
import SaveStatusPill from '@/components/coaches/SaveStatusPill';
import LoadingState from '@/components/shared/LoadingState';
import { CoachRowList, CoachRow } from '@/components/coaches/CoachRowList';
import { ATTENDANCE_OPTIONS, attendanceOption } from '@/components/coaches/attendanceOptions';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';
import { playerDisplayName } from '@/lib/coach-roster-name';
import { countedAttendanceStatus } from '@/lib/coach-schedule-vocab';
import type { RepAttendanceStatus, RepRosterPlayer } from '@/lib/types';
import { useIsPhoneNav } from '@/lib/hooks/useIsPhoneNav';
import { FAMILY_AVAILABILITY_COACH_WORDS as FW, FAMILY_REMIND_COACH_WORDS } from '@/lib/family-availability-words';
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
  /** When a coach last set or confirmed this mark (mig 479); null when never marked. */
  markedAt: string | null;
  /** The status the server holds for this player (loaded or last saved): a save sends the status only when it differs from this
   *  (One attendance record: only the rows the coach changed, never the whole roster). */
  savedStatus?: RepAttendanceStatus;
  /** The coach's note as the server holds it: sent only when it differs. */
  savedNote?: string;
  /** The coach tapped this player's current mark since the last save (it keeps the mark and clears the family warning). */
  confirmed?: boolean;
}

/**
 * What families said, beside the coach's book (Signed-in family accounts Stage 4b, Part 5; drawing tab 2). Present only while
 * families can answer this event and this coach can mark attendance; the room is exactly as before without it.
 */
export interface RoomFamilyView {
  rows: Map<string, RoomFamilyRow>;
  summary: RoomFamilySummary;
  /** First names of `summary.changed`, in the same order (the card's "⚠ 1 changed since you marked: Maya"). */
  changedNames: string[];
  /** "Use N family answers": copies into players the coach hasn't marked, then the toast with Undo. */
  onUse: () => void;
  toast: { text: string; onUndo: (() => void) | null } | null;
  /** The Roster, where parents are invited from each player's Guardians card. */
  inviteHref: string;
  /** "⚠ 1 changed since you marked: Maya · Show" filters the list to those players. The SHEET holds it (the room holds no state). */
  onlyChanged: boolean;
  toggleChanged: () => void;
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
  // "⚠ 1 changed since you marked: Maya · Show" filters the list to those players (tab 2).
  const changed = family && family.onlyChanged && family.summary.changed.length > 0 ? new Set(family.summary.changed) : null;
  const statusRows = attendanceFilter === 'all'
    ? attendanceRows
    : attendanceRows.filter(row => countedAttendanceStatus(row.status) === attendanceFilter); // a Maybe sits under Not marked (ruling 2)
  const filteredRows = changed ? statusRows.filter(row => changed.has(row.player.id)) : statusRows;
  // data-field-floor: a surface read standing up — the sweep holds its type floor (A4).
  return (
    <div className={styles.attendanceRoom} data-field-floor>
      {family && attendanceRows.length > 0 && (
        <FamiliesCard
          family={family}
          changedNames={family.changedNames}
        />
      )}
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
        {/* At a desk the family's answer gets its own column (tab 2): Player · Family said · Your mark. */}
        {family && desk && (
          <div className={styles.attFamilyHead} aria-hidden>
            <span>{FW.desk.player}</span><span>{FW.desk.family}</span><span>{FW.desk.mark}</span>
          </div>
        )}
        <CoachRowList label="Attendance" inset className={styles.attendanceRows}>
          {filteredRows.map(row => {
            // A family's Maybe renders as Maybe (One attendance record), never as a missing option.
            const cur = attendanceOption(row.status);
            const StatusIcon = cur.icon;
            const name = playerDisplayName(row.player);
            const said = family ? familySaid(family, row.player.id, desk) : null;
            return (
              <CoachRow
                key={row.player.id}
                as="button"
                aria-haspopup="dialog"
                aria-label={`${name} · ${cur.label}${row.note ? ' · has a note' : ''}${said ? ` · ${said.text}` : ''} · set attendance`}
                onClick={e => setRsvpEditId(row.player.id, e.currentTarget)}
                title={name}
                // The grey line under the name is what the family said (phone); amber only when it changed after your mark.
                caption={said && !desk
                  ? <span className={styles.attFamilyLine} data-drift={said.drift || undefined}>{said.text}</span>
                  : undefined}
                trail={
                  <>
                    {family && desk && (
                      <span className={styles.attFamilyCell} data-drift={said?.drift || undefined}>{said?.text ?? ''}</span>
                    )}
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

/** The words under one player (phone) or in the "Family said" column (desk); null = no line (no parent in the app). */
function familySaid(family: RoomFamilyView, playerId: string, desk: boolean): { text: string; drift: boolean } | null {
  const f = family.rows.get(playerId);
  if (!f) return null; // a call-up
  if (!f.line) return f.connected ? { text: FW.notYet, drift: false } : null;
  const drift = family.summary.changed.includes(playerId);
  if (drift) return { text: desk ? FW.driftCell(f.line) : FW.drift(f.line), drift: true };
  return { text: desk ? FW.cell(f.line) : FW.line(f.line), drift: false };
}

/** The Families card at the top of the room (tab 2): the counts, who changed, Use N family answers, and its toast. */
function FamiliesCard({ family, changedNames }: { family: RoomFamilyView; changedNames: string[] }) {
  const { summary, onlyChanged, toggleChanged } = family;
  // The card says who changed on its own line, so its counts are answered / haven’t / no parent.
  const parts = FW.familyParts({ answered: summary.answered, haveNot: summary.haveNot, noParent: summary.noParent });
  const nobody = summary.answered === 0 && summary.haveNot === 0;
  const fewInApp = summary.noParent > summary.answered + summary.haveNot;
  // Tab 4, frame 3: open, and every family the coach hasn't marked has answered: Remind goes and the card says so.
  const nobodyLeft = family.remind.open && !nobody && summary.remind.length === 0;
  const lineParts = nobodyLeft
    ? [FAMILY_REMIND_COACH_WORDS.nobodyLeft, ...FW.familyParts({ answered: 0, haveNot: 0, noParent: summary.noParent })]
    : parts;
  return (
    <section className={styles.attFamilies} aria-label={FW.card.title}>
      <p className={styles.attFamiliesLine}>
        <strong>{FW.card.title}</strong>
        {!nobody && lineParts.length > 0 && <> · {lineParts.join(' · ')}</>}
      </p>
      {nobody && <p className={styles.attFamiliesLine}>{FW.card.nobody}</p>}
      {changedNames.length > 0 && (
        <p className={styles.attFamiliesWarn}>
          {FW.card.changed(changedNames)} ·{' '}
          <button type="button" className={styles.attFamiliesLinkBtn} onClick={toggleChanged} aria-pressed={onlyChanged}>
            {onlyChanged ? FW.card.showAll : FW.card.show}
          </button>
        </p>
      )}
      {(nobody || fewInApp) && <Link href={family.inviteHref} className={styles.attFamiliesLinkBtn}>{FW.card.invite}</Link>}
      {summary.usable.length > 0 && (
        <div className={styles.attendanceBulkActions}>
          <button type="button" className={styles.btnGhost} onClick={family.onUse}>{FW.card.use(summary.usable.length)}</button>
        </div>
      )}
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
      {family.toast && (
        <p className={styles.attFamiliesToast} role="status">
          {family.toast.text}
          {family.toast.onUndo && (
            <> · <button type="button" className={styles.attFamiliesLinkBtn} onClick={family.toast.onUndo}>{FW.card.undo}</button></>
          )}
        </p>
      )}
    </section>
  );
}
