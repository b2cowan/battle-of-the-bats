'use client';
/**
 * WHAT THE DATE AND TIME FIELDS SHARE (plan docs/projects/active/THEMED_DATE_PICKER_PLAN.md). `DateInput` and
 * `TimeInput` are the same field with a different panel: a typeable box that shows the stored value in house words,
 * an icon that opens the panel, a hidden input that posts the stored value, and — on touch — the device's own control.
 * This file is that shared part; each field adds its panel and its keys.
 */
import {
  useEffect, useLayoutEffect, useRef, useState,
  type CSSProperties, type FocusEvent, type InputHTMLAttributes, type KeyboardEvent, type ReactNode, type RefObject,
} from 'react';
import { claimEscape } from '@/components/coaches/escapeOwnership';
import styles from './DateInput.module.css';

/** The props every date and time field takes — the native control's, with `onChange` handed the VALUE. */
export type FieldProps = {
  /** The stored value in the native control's own form. Absent = uncontrolled (`defaultValue`). */
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  id?: string;
  /** Posts the stored value with a form (a hidden input on a desk; the native field on touch). */
  name?: string;
  /** The host's input class — the box keeps its screen's look. */
  className?: string;
  /** Sizes the field (a flex basis in a row, a width). */
  style?: CSSProperties;
  /** The field sizes to its box instead of filling its line (a toolbar, a sentence). */
  inline?: boolean;
  min?: string;
  max?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  title?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean | 'true' | 'false';
  /** A required mark for assistive tech where the form checks the field itself (no browser bubble). */
  'aria-required'?: boolean | 'true' | 'false';
  /** Focus has left the whole field (its box and its panel), after what was typed has been committed. */
  onBlur?: () => void;
  /** Focus has entered the box. */
  onFocus?: () => void;
};

/** The device's own control, for touch and windows at 768px or narrower. */
export function NativeField({
  type, onChange, onBlur, onFocus, step, ...rest
}: FieldProps & { type: 'date' | 'time' | 'datetime-local'; step?: number | string; rangeStart?: string }) {
  // Ours, not the element's: a desk field's sizing and its calendar's range shading.
  delete rest.inline;
  delete (rest as { rangeStart?: string }).rangeStart;
  return (
    <input
      type={type}
      {...rest}
      step={step}
      onChange={e => onChange?.(e.target.value)}
      onBlur={onBlur && (() => onBlur())}
      onFocus={onFocus && (() => onFocus())}
    />
  );
}

/**
 * The host's onBlur runs AFTER the value committed on leaving has reached it. Leaving the box commits what was typed
 * (the host's setState) in the same event; calling the host's onBlur there ran its OLD closure, so a save-on-leave host
 * read its old state and a typed date followed by Tab never saved (the season block, found in the sweep). So the leave
 * is counted, and the latest onBlur runs in the effect after the re-render that carries the value.
 */
export function useLeaveAfterCommit(onBlur: (() => void) | undefined): () => void {
  const latest = useRef(onBlur);
  useLayoutEffect(() => { latest.current = onBlur; });
  const [leaves, setLeaves] = useState(0);
  useEffect(() => { if (leaves) latest.current?.(); }, [leaves]);
  return () => setLeaves(n => n + 1);
}

/**
 * The typed box's state: the stored value (the host's, or the field's own when uncontrolled), what has been typed
 * and not yet committed, and the browser's form check on the box. An unreadable entry stays on screen and marks the
 * box invalid; it is never thrown away.
 */
export function useTypedField({ value, defaultValue, onChange, onBlur, parse, problem }: {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  /** What was typed, read as a stored value (given the current one); null = unreadable. */
  parse: (text: string, stored: string) => string | null;
  /** The form check's words: for an unreadable entry (`null`), or for a stored value outside its bounds ('' = fine). */
  problem: (stored: string | null) => string;
}) {
  const [own, setOwn] = useState(defaultValue ?? '');
  const stored = value !== undefined ? value : own;
  /** What the person has typed and not yet committed; null = the box shows the stored value. */
  const [draft, setDraft] = useState<string | null>(null);
  const boxRef = useRef<HTMLInputElement>(null);
  // The host changed the value under a draft (a reset, a loaded record, an end that follows its start): the box shows
  // the new value, unless the draft already reads as it (an ISO date stored as it was typed).
  const [seen, setSeen] = useState(stored);
  if (stored !== seen) {
    setSeen(stored);
    if (draft !== null && parse(draft, stored) !== stored) setDraft(null);
  }
  const typed = draft !== null && draft.trim() ? parse(draft, stored) : null;
  const unreadable = draft !== null && draft.trim() !== '' && !typed;
  const left = useLeaveAfterCommit(onBlur);

  const message = unreadable ? problem(null) : stored ? problem(stored) : '';
  useEffect(() => { boxRef.current?.setCustomValidity(message); }, [message]);

  const emit = (next: string) => {
    if (value === undefined) setOwn(next);
    if (next !== stored) onChange?.(next);
  };
  /** Commit what was typed: a readable value is stored, an emptied box clears, an unreadable one stays to be fixed. */
  const commit = () => {
    if (draft === null) return;
    if (!draft.trim()) { emit(''); setDraft(null); return; }
    if (typed) { emit(typed); setDraft(null); }
  };
  /** Store a value picked from the panel. */
  const pick = (next: string) => { emit(next); setDraft(null); };

  return { stored, draft, setDraft, typed, unreadable, boxRef, emit, commit, pick, left };
}

/** The desk field's frame: the box, its icon, the hidden input that posts the stored value, and the open panel. */
export function FieldShell({
  props, box, stored, open, onClose, onLeave, icon, iconLabel, onIcon, children,
}: {
  props: FieldProps;
  /** The box's own attributes: its words, its role and keys. */
  box: InputHTMLAttributes<HTMLInputElement> & { ref: RefObject<HTMLInputElement | null>; unreadable: boolean };
  stored: string;
  open: boolean;
  /** Esc while open: close and keep focus in the box. */
  onClose: () => void;
  /** Focus has left the box and the panel. */
  onLeave: () => void;
  icon: ReactNode;
  iconLabel: string;
  onIcon: () => void;
  children: ReactNode;
}) {
  const wrapRef = useRef<HTMLSpanElement>(null);
  const { ref, unreadable, 'aria-controls': controls, ...boxRest } = box;
  return (
    <span
      ref={wrapRef}
      className={styles.wrap}
      style={props.style}
      data-inline={props.inline ? '' : undefined}
      data-escape-owner={open ? '' : undefined}
      onKeyDown={(e: KeyboardEvent<HTMLSpanElement>) => {
        if (e.key === 'Escape' && open && !e.nativeEvent.isComposing) {
          // Esc closes the panel, never the window it sits in (escapeOwnership).
          claimEscape(e);
          e.preventDefault();
          onClose();
        }
      }}
      onBlur={(e: FocusEvent<HTMLSpanElement>) => {
        if (!wrapRef.current?.contains(e.relatedTarget as Node | null)) onLeave();
      }}
    >
      <input
        ref={ref}
        type="text"
        id={props.id}
        className={`${props.className ?? ''} ${styles.text}`}
        autoComplete="off"
        spellCheck={false}
        required={props.required}
        disabled={props.disabled}
        title={props.title}
        aria-label={props['aria-label']}
        aria-labelledby={props['aria-labelledby']}
        aria-describedby={props['aria-describedby']}
        aria-invalid={unreadable || props['aria-invalid'] === true || props['aria-invalid'] === 'true' ? true : undefined}
        aria-required={props['aria-required']}
        role="combobox"
        aria-expanded={open}
        aria-controls={controls}
        onFocus={props.onFocus && (() => props.onFocus!())}
        {...boxRest}
      />
      <button
        type="button"
        className={styles.icon}
        tabIndex={-1}
        aria-label={iconLabel}
        disabled={props.disabled}
        // Focus stays in the box, so typing and leaving the field behave the same whichever way it opened.
        onMouseDown={e => { e.preventDefault(); ref.current?.focus({ preventScroll: true }); }}
        onClick={onIcon}
      >
        {icon}
      </button>
      {/* Disabled with the field, as a disabled native control posts nothing. */}
      <input type="hidden" name={props.name} value={stored} disabled={props.disabled} />
      {open && children}
    </span>
  );
}
