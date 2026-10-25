'use client';
/**
 * THE ONE DATE FIELD (owner ruling 2026-10-25, all four asks as recommended — drawing
 * https://claude.ai/artifact/Rvo2a36tonsHRyEeeWf4Cp, plan docs/projects/active/THEMED_DATE_PICKER_PLAN.md, design log
 * 2026-10-25). Every date in the product is picked here; `tests/unit/native-date-input-guard.test.ts` fails on a
 * browser `type="date"` anywhere else.
 *
 * - On a DESK (`useDeskPicker`) it is a typeable box that reads "Oct 25, 2026", and our calendar hangs under it:
 *   Monday first, today's olive edge, the picked day solid olive, a paired end date's range shaded, days outside
 *   `min`/`max` faded and refused, the month title opening a month-and-year view. Arrows move a day or a week, Page
 *   Up/Down a month, Enter picks, Esc closes. Typing works (ISO at once; "Oct 25 2026" and friends on Enter or leaving).
 * - On TOUCH, or at 768px and narrower, it is the device's own `type="date"` — built for a thumb.
 *
 * The VALUE CONTRACT IS THE NATIVE ONE, on purpose: `YYYY-MM-DD` or `''`, so no caller's save path changes. What it
 * shares with `TimeInput` (the box, the form check, posting through `name`, the touch control) is `TypedField.tsx`.
 */
import { useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { Calendar as CalendarIcon, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useFieldMenu } from '@/lib/overlay-hooks';
import { tournamentToday } from '@/lib/timezone';
import { useDeskPicker } from '@/lib/hooks/useDeskPicker';
import {
  LONG_MONTHS, SHORT_MONTHS, WEEKDAYS, WEEKDAY_NAMES, addDays, addMonths, dateParts, formatFieldDate, inRange,
  isoDate, longDateLabel, mondayOfDay, monthGrid, parseTypedDate,
} from '@/lib/date-field';
import { FieldShell, NativeField, useTypedField, type FieldProps } from './TypedField';
import styles from './DateInput.module.css';

/** The calendar's own size (7 × 36px days + padding + border; six weeks always), for its placement. The height carries
 *  a little room for a larger browser font (its padding is in rem): ~356px at the default size. */
const CALENDAR_WIDTH = 278;
const CALENDAR_HEIGHT = 372;
export const DATE_PLACEHOLDER = 'Choose a date';

export type DateInputProps = FieldProps & {
  /** The paired START when this is an end date: shades the range in the calendar. Pass `min` too to refuse earlier days. */
  rangeStart?: string;
};

export default function DateInput(props: DateInputProps) {
  const desk = useDeskPicker();
  return desk ? <DeskDateInput {...props} /> : <NativeField type="date" {...props} />;
}

function DeskDateInput(props: DateInputProps) {
  const { min, max, rangeStart, required, disabled, placeholder = DATE_PLACEHOLDER } = props;
  const [open, setOpen] = useState(false);
  const [focusPanel, setFocusPanel] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const field = useTypedField({
    ...props,
    // A typed date with no year takes the field's year, else this year (today is read only when that is needed).
    parse: (text, stored) => parseTypedDate(text, dateParts(stored)?.y ?? dateParts(tournamentToday())!.y),
    problem: stored => stored === null ? 'Enter a date like Oct 25, 2026.'
      : min && stored < min ? `Choose a date on or after ${formatFieldDate(min)}.`
      : max && stored > max ? `Choose a date on or before ${formatFieldDate(max)}.`
      : '',
  });
  const { stored, draft, typed, boxRef } = field;

  useFieldMenu(open, boxRef, panelRef, () => setOpen(false), { width: CALENDAR_WIDTH, align: 'start', height: CALENDAR_HEIGHT });

  const close = (returnFocus: boolean) => {
    setOpen(false);
    setFocusPanel(false);
    if (returnFocus) boxRef.current?.focus({ preventScroll: true });
  };
  const openPanel = (withKeyboard: boolean) => {
    if (disabled) return;
    field.commit();
    setFocusPanel(withKeyboard);
    setOpen(true);
  };

  const onBoxKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || (e.key === 'ArrowUp' && open)) {
      e.preventDefault();
      if (open) setFocusPanel(true); else openPanel(true);
    } else if (e.key === 'Enter' && draft !== null) {
      // An uncommitted entry is committed, not submitted half-read with the form; the calendar it was typed over closes.
      e.preventDefault();
      field.commit();
      setOpen(false);
    } else if (e.key === 'Tab' && open) {
      setOpen(false);
    }
  };

  return (
    <FieldShell
      props={props}
      stored={stored}
      open={open}
      onClose={() => close(true)}
      onLeave={() => { field.commit(); close(false); field.left(); }}
      icon={<CalendarIcon size={15} aria-hidden />}
      iconLabel="Open the calendar"
      onIcon={() => { if (open) close(false); else openPanel(false); }}
      box={{
        ref: boxRef,
        unreadable: field.unreadable,
        value: draft ?? formatFieldDate(stored),
        placeholder,
        'aria-haspopup': 'dialog',
        'aria-controls': open ? panelId : undefined,
        onChange: e => {
          const t = e.target.value.trim();
          field.setDraft(e.target.value);
          // A whole ISO date is unambiguous and complete: store it at once (what a pasted or scripted value expects) —
          // within the years the field reads (a year under 1000 is a year still being typed).
          if (/^\d{4}-\d{2}-\d{2}$/.test(t) && parseTypedDate(t, 0) === t) field.emit(t);
        },
        onClick: () => { if (!open) openPanel(false); },
        onKeyDown: onBoxKey,
      }}
    >
      <CalendarPanel
        id={panelId}
        panelRef={panelRef}
        value={typed ?? (dateParts(stored) ? stored : '')}
        min={min}
        max={max}
        rangeStart={rangeStart}
        required={required}
        focusDay={focusPanel}
        onPick={next => { field.pick(next); close(true); }}
        onClear={() => { field.pick(''); close(true); }}
      />
    </FieldShell>
  );
}

/** The calendar itself: which month is on screen and which day has the keyboard. */
function CalendarPanel({
  id, panelRef, value, min, max, rangeStart, required, focusDay, onPick, onClear,
}: {
  id: string;
  panelRef: RefObject<HTMLDivElement | null>;
  value: string;
  min?: string;
  max?: string;
  rangeStart?: string;
  required?: boolean;
  /** Put the keyboard on the focused day (opened from the keyboard, or an arrow pressed in the box). */
  focusDay: boolean;
  onPick: (iso: string) => void;
  onClear: () => void;
}) {
  const [today] = useState(tournamentToday);
  const anchor = rangeStart && dateParts(rangeStart) ? rangeStart : '';
  // Opens on the picked day; an empty end date opens on its start; else today, kept inside the bounds.
  const [cursor, setCursor] = useState(() =>
    value || anchor || (min && today < min ? min : max && today > max ? max : today));
  const [view, setView] = useState<'days' | 'months'>('days');
  const [keyboardHere, setKeyboard] = useState(false);
  // The keyboard is on the days once an arrow reached them, here or from the box.
  const keyboard = keyboardHere || focusDay;
  const gridRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!keyboard) return;
    const target = view === 'days'
      ? gridRef.current?.querySelector<HTMLButtonElement>('button[tabindex="0"]')
      : panelRef.current?.querySelector<HTMLButtonElement>('button[data-month-cursor]');
    target?.focus({ preventScroll: true });
  }, [keyboard, cursor, view, panelRef]);

  const c = dateParts(cursor) ?? dateParts(today)!;
  const t = dateParts(today)!;
  const picked = dateParts(value);
  const days = useMemo(() => monthGrid(c.y, c.m), [c.y, c.m]);

  const onGridKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const steps: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    let next: string | null = null;
    if (steps[e.key] !== undefined) next = addDays(cursor, steps[e.key]);
    else if (e.key === 'PageUp') next = addMonths(cursor, e.shiftKey ? -12 : -1);
    else if (e.key === 'PageDown') next = addMonths(cursor, e.shiftKey ? 12 : 1);
    else if (e.key === 'Home') next = mondayOfDay(cursor);
    else if (e.key === 'End') next = addDays(mondayOfDay(cursor), 6);
    // A step past the years a date can hold stays where it is.
    if (next) { e.preventDefault(); setKeyboard(true); if (dateParts(next)) setCursor(next); }
  };
  const step = (n: number) => { const next = addMonths(cursor, n); if (dateParts(next)) setCursor(next); };

  return (
    // ⚠ A press anywhere in the calendar keeps focus where it is (the box, or the day the keyboard is on): a press on its
    // padding, its weekday row or a gap between days would otherwise move focus to the page and close it, and Safari
    // gives a pressed button no focus at all (/review). Every control here acts on click, so nothing needs the focus.
    <div ref={panelRef} id={id} className={`${styles.panel} ${styles.calendar}`} role="dialog" aria-label="Choose a date"
      onMouseDown={e => e.preventDefault()}>
      <div className={styles.head}>
        <button
          type="button"
          className={styles.title}
          onClick={() => setView(view === 'days' ? 'months' : 'days')}
          aria-label={view === 'days' ? `${LONG_MONTHS[c.m]} ${c.y}: choose the month and year` : `${c.y}: back to the days`}
        >
          {view === 'days' ? `${LONG_MONTHS[c.m]} ${c.y}` : c.y}
          <ChevronDown size={14} aria-hidden />
        </button>
        <div className={styles.nav}>
          <button type="button" className={styles.navBtn} onClick={() => step(view === 'days' ? -1 : -12)}
            aria-label={view === 'days' ? 'Previous month' : 'Previous year'}>
            <ChevronLeft size={16} aria-hidden />
          </button>
          <button type="button" className={styles.navBtn} onClick={() => step(view === 'days' ? 1 : 12)}
            aria-label={view === 'days' ? 'Next month' : 'Next year'}>
            <ChevronRight size={16} aria-hidden />
          </button>
        </div>
      </div>

      {view === 'months' ? (
        <div className={styles.months}>
          {SHORT_MONTHS.map((name, m) => (
            <button
              key={name}
              type="button"
              className={styles.month}
              aria-label={`${LONG_MONTHS[m]} ${c.y}`}
              aria-pressed={picked?.y === c.y && picked.m === m}
              data-current={t.y === c.y && t.m === m ? '' : undefined}
              data-month-cursor={m === c.m ? '' : undefined}
              onClick={() => { setCursor(isoDate(c.y, m, 1)); setView('days'); }}
            >
              {name}
            </button>
          ))}
        </div>
      ) : (
        <div ref={gridRef} className={styles.grid} role="group" aria-label={`${LONG_MONTHS[c.m]} ${c.y}`} onKeyDown={onGridKey}>
          {WEEKDAYS.map((w, i) => <abbr key={w} className={styles.weekday} title={WEEKDAY_NAMES[i]} aria-hidden>{w}</abbr>)}
          {days.map(d => {
            const ok = inRange(d, min, max);
            return (
              <button
                key={d}
                type="button"
                className={styles.day}
                tabIndex={d === cursor ? 0 : -1}
                // aria-disabled, not disabled: a day outside the bounds keeps the keyboard (a disabled button cannot
                // hold focus, so an arrow onto one dropped focus to the page and left the calendar orphaned).
                aria-disabled={ok ? undefined : true}
                aria-label={longDateLabel(d)}
                aria-pressed={d === value}
                aria-current={d === today ? 'date' : undefined}
                data-out={d.slice(5, 7) !== cursor.slice(5, 7) ? '' : undefined}
                data-today={d === today ? '' : undefined}
                data-range={anchor && value && d > anchor && d < value ? '' : undefined}
                data-anchor={anchor && d === anchor && d !== value ? '' : undefined}
                onClick={() => { if (ok) onPick(d); }}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (ok) onPick(d); } }}
              >
                {Number(d.slice(8))}
              </button>
            );
          })}
        </div>
      )}

      <div className={styles.foot}>
        <button type="button" className={styles.link} disabled={!inRange(today, min, max)}
          onClick={() => onPick(today)}>
          Today
        </button>
        {/* A required date has no Clear: absent beats disabled. */}
        {!required && (
          <button type="button" className={styles.link} data-quiet="" onClick={onClear}>
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
