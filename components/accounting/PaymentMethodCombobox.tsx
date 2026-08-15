'use client';
import { useState, useRef, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';
import type { PaymentMethodOption } from '@/lib/payment-methods';
import { useDismissable } from '@/lib/overlay-hooks';
// ⚠ Shares PayeeCombobox's stylesheet on purpose — the two fields sit side by side in the same
// Details group, so a second near-identical copy would be drift a coach sees in one glance. See
// the "Shared with PaymentMethodCombobox" block in that file for which classes are ours.
import styles from './PayeeCombobox.module.css';

/**
 * "How did you pay?" — free text that suggests what the club already uses.
 *
 * The field it replaces was a plain <input>, which is how one club ended up with "E-transfer",
 * "etransfer" and "e transfer" as three separate strings feeding the same reports (owner review
 * 2026-08-15, Q5).
 *
 * ⚠ THE INPUT IS BOUND STRAIGHT TO THE VALUE — what you see is always what will save. That is a
 * deliberate difference from PayeeCombobox beside it, which holds typed text in its own state until
 * you pick a listed option: that model let a typed name be silently dropped on submit while the
 * field still looked filled in (caught by /review, since fixed there with a reopen-on-type rule).
 * A method has no id and nothing to reconcile, so there is no reason to repeat the two-state shape.
 *
 * The consequence is that the "new spelling" row below is a NOTE, not a button. Rendering a
 * pressable "Use this" would invent a commit step that does nothing, and train coaches to look for
 * one on a field that doesn't need it.
 */
export default function PaymentMethodCombobox({
  methodsApiUrl,
  value,
  onChange,
  placeholder = 'e.g. E-transfer, Cash',
  disabled,
}: {
  methodsApiUrl: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [methods, setMethods] = useState<PaymentMethodOption[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useDismissable(open, containerRef, () => setOpen(false));

  // Fetched once, on first open — the club's method list is small and changes only when someone
  // saves a record, so re-reading it per keystroke would buy nothing. Best-effort: a failure
  // leaves a plain text field that still saves, which is exactly the behaviour being replaced.
  //
  // ⚠ Driven by the OPEN EVENT, not by an effect watching `open`. Fetch-on-open is a response to
  // something the coach did, not React synchronising with an external system, and an effect that
  // setStates on its own dependency is the cascading-render shape the lint rule exists to catch.
  // The "already fetched" latch is a REF, not state: nothing renders from it, and a state updater
  // has to stay pure — putting the fetch inside one would fire it twice under StrictMode.
  const loadedRef = useRef(false);
  const openList = useCallback(() => {
    setOpen(true);
    if (loadedRef.current) return;
    loadedRef.current = true;
    void (async () => {
      try {
        const res = await fetch(methodsApiUrl);
        if (!res.ok) return;
        const data = await res.json();
        setMethods(Array.isArray(data.methods) ? data.methods : []);
      } catch {
        /* keep the field usable as free text */
      }
    })();
  }, [methodsApiUrl]);

  const typed = value.trim();
  const needle = typed.toLowerCase();
  const matches = needle ? methods.filter(m => m.name.toLowerCase().includes(needle)) : methods;
  const used = matches.filter(m => m.count > 0);
  const suggested = matches.filter(m => m.count === 0);
  // Has the club (or our seed list) seen this exact spelling before? Case-insensitive, matching
  // how the list itself is grouped.
  const isKnown = methods.some(m => m.name.toLowerCase() === needle);

  function pick(name: string) {
    onChange(name);
    setOpen(false);
  }

  function renderOption(m: PaymentMethodOption) {
    return (
      <button
        key={m.name}
        type="button"
        className={`${styles.option} ${styles.optionWithCount}`}
        // onMouseDown, not onClick: the input's blur would otherwise close the dropdown before the
        // click landed. Same reason as PayeeCombobox.
        onMouseDown={() => pick(m.name)}
      >
        <span>{m.name}</span>
        {m.count > 0 && <span className={styles.optionCount}>{m.count}</span>}
      </button>
    );
  }

  return (
    <div className={styles.root} ref={containerRef}>
      <div className={styles.inputWrap}>
        <input
          className={styles.input}
          type="text"
          value={value}
          // Typing reopens the list as well as editing the value, so a coach who dismissed it with
          // Escape and kept typing still gets the suggestions back.
          onChange={e => { onChange(e.target.value.slice(0, 100)); if (!open) openList(); }}
          onFocus={openList}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          maxLength={100}
        />
        <ChevronDown size={14} className={styles.chevron} />
      </div>

      {open && (used.length > 0 || suggested.length > 0 || (typed && !isKnown)) && (
        <div className={styles.dropdown}>
          {used.length > 0 && (
            <div className={styles.section}>
              <p className={styles.sectionLabel}>Used in your club</p>
              {used.map(renderOption)}
            </div>
          )}

          {suggested.length > 0 && (
            <div className={styles.section}>
              <p className={styles.sectionLabel}>Common methods</p>
              {suggested.map(renderOption)}
            </div>
          )}

          {typed && !isKnown && (
            <div className={styles.section}>
              <p className={styles.optionNote}>
                <strong>&ldquo;{typed}&rdquo;</strong> is new to your club — saving this will add it
                to the list.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
