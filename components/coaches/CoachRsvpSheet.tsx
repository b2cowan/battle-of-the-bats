'use client';
import { useId, useRef, type RefObject } from 'react';
import { Check } from 'lucide-react';
import { ATTENDANCE_OPTIONS } from '@/components/coaches/attendanceOptions';
import SheetFrame from '@/components/coaches/SheetFrame';
import { useDialogFloor } from '@/components/coaches/useDialogFloor';
import { useIsPhoneNav } from '@/lib/hooks/useIsPhoneNav';
import type { RepAttendanceStatus } from '@/lib/types';
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
 * ⚖ ON THE PORTAL'S SHEET FRAME, OVER ITS WINDOW (Sheet Frame step 4, 2026-10-06). Wherever the bar
 * shows (≤900) the sheet is the frame's FORM layer over the event window (`form overWindow`): at the
 * screen's foot, above the window (D3 keeps it stacked there), modal and the keyboard kept inside. A
 * form, not a menu, because what lies under it is a MODAL window, not a live bar — a sheet that let the
 * keyboard out would walk it behind both. Its record head keeps its Close (the frame's `grabCloses`);
 * the choices' 14px inset is the content's own (`.body`). Above 900 — no bar, no frame — the same
 * content is a small centred dialog, because the row is the tap at every width now that the inline
 * editor is gone; that dialog stands on its own floor.
 *
 * ⚠ A DIALOG OVER A DIALOG, AND THE FLOOR KNOWS. Its floor (the frame's, or the dialog's own) is
 * STACKED over the event sheet's. That works only because it is rendered as a SIBLING of the event
 * sheet's overlay, never inside its panel: a floor answers an Escape whose target is inside ITS
 * panel, so a sheet nested in the event sheet's DOM would close both on one key. The last floor in
 * answers a bare-document key.
 *
 * ⚠ It registers no overlay — the event sheet beneath already holds the lock (over a window, the frame
 * registers none either). ⚠ The `data-rsvp-sheet` marker stays on the outermost box: the layout sweep
 * finds the dialog INSIDE it. ⚠ Rendered in-tree, never through a portal (the warm skin is a wrapper
 * above the providers).
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
  /** The attendance row that opened it — focus goes home to it (a tap on iOS never focused it). */
  opener: RefObject<HTMLElement | null>;
}) {
  const isPhoneNav = useIsPhoneNav();
  const panelRef = useRef<HTMLDivElement>(null);
  const nameId = useId();
  const subId = useId();
  // The centred dialog's own floor; at ≤900 the frame's form layer is the floor.
  useDialogFloor(!isPhoneNav, panelRef, { onClose, opener });

  const body = (
    <>
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
    </>
  );

  if (isPhoneNav) {
    return (
      <div data-rsvp-sheet style={{ display: 'contents' }}>
        <SheetFrame form overWindow grabCloses onClose={onClose} opener={opener} role="dialog" aria-labelledby={nameId} aria-describedby={subId}>
          <div className={own.body}>{body}</div>
        </SheetFrame>
      </div>
    );
  }
  return (
    <div className={own.floor} data-rsvp-sheet>
      <div className={own.scrim} aria-hidden onClick={onClose} />
      <div ref={panelRef} tabIndex={-1} className={own.panel} role="dialog" aria-modal="true" aria-labelledby={nameId} aria-describedby={subId}>
        {body}
      </div>
    </div>
  );
}
