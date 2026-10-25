'use client';
/**
 * THE ONE TIME FIELD (owner ruling 2026-10-25, Ask 4: times are all or nothing, and it is all — so the product writes
 * one clock in every field). Plan docs/projects/active/THEMED_DATE_PICKER_PLAN.md; the sibling of `DateInput.tsx`,
 * sharing `TypedField.tsx`.
 *
 * - On a DESK: a typeable box that reads "8:00 a.m." (`formatTime`, the house clock), and the field menu under it — the
 *   day in steps (`step` in seconds, as the native attribute; the house 15 minutes when absent), the stored time
 *   ticked and scrolled into view. Typing works: "8:30 pm", "830", "20:30", "noon". A list, not a dialog: focus stays
 *   in the box and the arrows move the highlight (a combobox), so typing and picking never fight.
 * - On TOUCH, or at 768px and narrower: the device's own `type="time"`.
 *
 * Value contract = the native one: `HH:MM` (24-hour) or `''`. A stored `HH:MM:SS` reads fine and is only rewritten
 * as `HH:MM` when the person changes it.
 */
import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Check, Clock } from 'lucide-react';
import { useFieldMenu } from '@/lib/overlay-hooks';
import { useDeskPicker } from '@/lib/hooks/useDeskPicker';
import { formatTime } from '@/lib/utils';
import { minutesOf, normaliseTime, parseTypedTime, stepMinutesFrom, timeSteps } from '@/lib/date-field';
import { FieldShell, NativeField, useTypedField, type FieldProps } from './TypedField';
import styles from './DateInput.module.css';

/** Wide enough for "11:45 p.m." beside its tick, whatever the box's own width. */
const TIME_LIST_WIDTH = 168;
export const TIME_PLACEHOLDER = 'Choose a time';
/** Where an empty field's list opens: the start of a usual day. */
const EMPTY_OPENS_AT = '08:00';

type Row = { value: string; label: string };
/** A list's rows, built once per shape for the whole page (a schedule's day rows share one). */
const ROWS = new Map<string, Row[]>();
function rowsFor(stepMinutes: number, lo: string | null, hi: string | null): Row[] {
  const key = `${stepMinutes}|${lo ?? ''}|${hi ?? ''}`;
  let rows = ROWS.get(key);
  if (!rows) {
    rows = timeSteps(stepMinutes, lo, hi).map(value => ({ value, label: formatTime(value) }));
    ROWS.set(key, rows);
  }
  return rows;
}

export type TimeInputProps = FieldProps & {
  /** Seconds, as the native attribute: 900 = a 15-minute list. */
  step?: number | string;
};

export default function TimeInput(props: TimeInputProps) {
  const desk = useDeskPicker();
  return desk ? <DeskTimeInput {...props} /> : <NativeField type="time" {...props} />;
}

function DeskTimeInput(props: TimeInputProps) {
  const { step, disabled, placeholder = TIME_PLACEHOLDER } = props;
  const lo = normaliseTime(props.min), hi = normaliseTime(props.max);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  /** The person has moved the highlight (an arrow, the mouse, typing): only then does Enter pick it. A list opened by
   *  a click highlights the stored or nearest row, and Enter there must not silently change the time. */
  const [moved, setMoved] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const field = useTypedField({
    ...props,
    // A stored HH:MM:SS is held as HH:MM, so picking the same minute is no change.
    value: props.value === undefined ? undefined : normaliseTime(props.value) ?? props.value,
    parse: text => parseTypedTime(text),
    problem: raw => {
      const t = raw === null ? null : normaliseTime(raw);
      return raw === null ? 'Enter a time like 8:00 a.m.'
        : t && lo && t < lo ? `Choose a time at or after ${formatTime(lo)}.`
        : t && hi && t > hi ? `Choose a time at or before ${formatTime(hi)}.`
        : '';
    },
  });
  const { stored: raw, draft, boxRef } = field;
  const stored = normaliseTime(raw);
  const rows = rowsFor(stepMinutesFrom(step), lo, hi);

  useFieldMenu(open, boxRef, listRef, () => setOpen(false), { width: TIME_LIST_WIDTH, align: 'start' });

  /** The row at or after a time — where the list opens and where typing points. */
  const nearest = (hhmm: string) => {
    const at = minutesOf(hhmm);
    const i = rows.findIndex(r => minutesOf(r.value) >= at);
    return i < 0 ? rows.length - 1 : i;
  };
  const move = (by: number) => {
    setMoved(true);
    setActive(a => Math.max(0, Math.min(rows.length - 1, (a < 0 ? 0 : a + by))));
  };

  // The list's own scroll, never the page's: on opening, the picked row sits two rows from the top; after that the
  // highlighted row is kept in view.
  const wasOpen = useRef(false);
  useLayoutEffect(() => {
    const opening = open && !wasOpen.current;
    wasOpen.current = open;
    const list = listRef.current;
    const row = list?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    if (!open || !list || !row) return;
    const top = row.offsetTop, bottom = top + row.offsetHeight;
    if (opening) list.scrollTop = Math.max(0, top - 2 * row.offsetHeight);
    else if (top < list.scrollTop) list.scrollTop = top - 4;
    else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight + 4;
  }, [open, active]);

  const openList = () => {
    if (disabled || !rows.length) return;
    setActive(nearest(stored ?? (lo && lo > EMPTY_OPENS_AT ? lo : EMPTY_OPENS_AT)));
    setMoved(false);
    setOpen(true);
  };
  const pick = (hhmm: string) => { field.pick(hhmm); setOpen(false); };

  const onBoxKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (open) move(e.key === 'ArrowDown' ? 1 : -1); else openList();
    } else if ((e.key === 'PageDown' || e.key === 'PageUp') && open) {
      e.preventDefault();
      move(e.key === 'PageDown' ? 4 : -4);
    } else if (e.key === 'Enter') {
      if (draft !== null) { e.preventDefault(); field.commit(); setOpen(false); }
      else if (open && moved && rows[active]) { e.preventDefault(); pick(rows[active].value); }
    } else if (e.key === 'Tab' && open) {
      setOpen(false);
    }
  };

  const optionId = (i: number) => `${listId}-${i}`;

  return (
    <FieldShell
      props={props}
      stored={stored ?? raw}
      open={open}
      onClose={() => setOpen(false)}
      onLeave={() => { field.commit(); setOpen(false); field.left(); }}
      icon={<Clock size={15} aria-hidden />}
      iconLabel="Open the time list"
      onIcon={() => { if (open) setOpen(false); else openList(); }}
      box={{
        ref: boxRef,
        unreadable: field.unreadable,
        value: draft ?? (stored ? formatTime(stored) : raw),
        placeholder,
        'aria-autocomplete': 'none',
        'aria-controls': open ? listId : undefined,
        'aria-activedescendant': open && active >= 0 ? optionId(active) : undefined,
        onChange: e => {
          field.setDraft(e.target.value);
          const t = parseTypedTime(e.target.value);
          if (t && rows.length) { setOpen(true); setMoved(true); setActive(nearest(t)); }
        },
        onClick: () => { if (!open) openList(); },
        onKeyDown: onBoxKey,
      }}
    >
      <div ref={listRef} id={listId} className={`${styles.panel} ${styles.list}`} role="listbox" aria-label="Times"
        // A press on the list's padding keeps focus in the box, as a press on a row does.
        onMouseDown={e => e.preventDefault()}>
        {rows.map((r, i) => (
          // A button, so a window that listens for clicks in its body hears a pick as a change to its form.
          <button
            key={r.value}
            type="button"
            tabIndex={-1}
            id={optionId(i)}
            role="option"
            aria-selected={r.value === stored}
            className={styles.option}
            data-index={i}
            data-active={i === active ? '' : undefined}
            onMouseEnter={() => { setMoved(true); setActive(i); }}
            onClick={() => pick(r.value)}
          >
            <span className={styles.tick} aria-hidden>{r.value === stored && <Check size={11} strokeWidth={3} />}</span>
            {r.label}
          </button>
        ))}
      </div>
    </FieldShell>
  );
}
