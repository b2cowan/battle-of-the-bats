'use client';
import { useId, useRef } from 'react';
import { Check } from 'lucide-react';
import { ATTENDANCE_OPTIONS } from '@/components/coaches/attendanceOptions';
import { useDialogFloor } from '@/components/coaches/useDialogFloor';
import type { RepAttendanceStatus } from '@/lib/types';
import sheet from './CoachesBottomNav.module.css';
import shared from '@/app/[orgSlug]/coaches/coaches.module.css';
import own from './CoachRsvpSheet.module.css';

/**
 * THE RSVP SHEET — one player's attendance, answered from the foot of the screen (phone
 * re-evaluation stage 2 · C3, owner ruling 2026-09-21 — "a bottom sheet with the four choices, the
 * GameChanger pattern"). The Schedule's attendance list used to carry a 27px "Edit RSVP" button on
 * every row that opened an inline editor UNDER the row; now the row itself is the tap
 * (`<button aria-haspopup="dialog">`) and it raises this: the player's name, the event, the four
 * choices as full-width 52px rows with the current one ticked, and the note. **Tapping a choice
 * saves it and closes the sheet** — one tap per player after the row; a typed note saves through
 * the list's own autosave (the transient pill) and stays until the sheet is dismissed.
 *
 * It is the third member of the phone's ONE sheet system: the More sheet's and the team sheet's
 * own container — `.sheetScrim` / `.dropdown` / `.sheetGrab` from `CoachesBottomNav.module.css`,
 * inside a `.sheetAnchor` that carries the surface tokens for both skins — so the three sheets
 * share one skin, one grab line, one radius. What differs is written in `CoachRsvpSheet.module.css`:
 * the anchor's foot is the SCREEN'S foot, not the bar's (the event sheet covers the bar at ≤640),
 * its z-index clears the event sheet's overlay (400), and above the nav breakpoint — where the nav
 * module draws nothing — the same panel is a small centered dialog, because the row is the tap at
 * every width now that the inline editor is gone.
 *
 * ⚠ A DIALOG OVER A DIALOG, AND THE FLOOR KNOWS. It stands on its own `useDialogFloor` (Escape,
 * the Tab trap, focus back to the row on close) STACKED over the event sheet's. That works only
 * because it is rendered as a SIBLING of the event sheet's overlay, never inside its panel: a
 * floor answers an Escape whose target is inside ITS panel, so a sheet nested in the event sheet's
 * DOM would close both on one key. The last floor in answers a bare-document key.
 *
 * ⚠ Not registered with `useOverlayOpen` — the event sheet beneath already holds the lock.
 * ⚠ Rendered in-tree, never through a portal (the warm skin is a wrapper above the providers).
 */
export default function CoachRsvpSheet({
  playerName,
  eventLine,
  status,
  note,
  onPick,
  onNote,
  onClose,
}: {
  playerName: string;
  /** "Fri, Sep 18 · UAT probe practice" — the day and the event, so the sheet says what it is for. */
  eventLine: string;
  status: RepAttendanceStatus;
  note: string;
  /** A choice was tapped: the caller writes it AND closes the sheet. */
  onPick: (status: RepAttendanceStatus) => void;
  onNote: (note: string) => void;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const nameId = useId();
  const subId = useId();
  useDialogFloor(true, panelRef, { onClose });

  return (
    <div className={`${sheet.sheetAnchor} ${own.floor}`} data-rsvp-sheet>
      <div className={`${sheet.sheetScrim} ${own.scrim}`} aria-hidden onClick={onClose} />
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`${sheet.dropdown} ${own.panel}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={nameId}
        aria-describedby={subId}
      >
        {/* The grab line is a real control at the floor — a tap on it closes, like the scrim. */}
        <button type="button" className={own.grabBtn} aria-label="Close" onClick={onClose}>
          <span className={sheet.sheetGrab} aria-hidden />
        </button>
        <div id={nameId} className={own.name}>{playerName}</div>
        <div id={subId} className={own.sub}>{eventLine}</div>
        <div className={own.choices} role="group" aria-label={`Attendance for ${playerName}`}>
          {ATTENDANCE_OPTIONS.map(option => {
            const Icon = option.icon;
            const on = status === option.value;
            return (
              <button
                key={option.value}
                type="button"
                data-status={option.value}
                aria-pressed={on}
                className={`${own.choice}${on ? ` ${own.choiceOn}` : ''}`}
                onClick={() => onPick(option.value)}
              >
                <Icon size={18} aria-hidden />
                <span>{option.label}</span>
                {on && <Check size={16} className={own.tick} aria-hidden />}
              </button>
            );
          })}
        </div>
        <input
          className={`${shared.attendanceNoteInput} ${own.note}`}
          value={note}
          onChange={e => onNote(e.target.value)}
          placeholder="Note (e.g. leaving early)"
          aria-label={`Attendance note for ${playerName}`}
          maxLength={500}
        />
      </div>
    </div>
  );
}
