'use client';
/**
 * A ONE-VALUE FIELD WITH SUB-LINED ANSWERS — the shape the recording conversation's
 * "What happened?" established, in a component two Club-tab surfaces can share.
 *
 * ⚖ Why a dropdown and not a row of radio cards (owner, 2026-08-22): a one-value field is a
 * dropdown. Radio-rows-with-sub-lines are exempt only where the choice cannot be changed afterwards
 * — the Fundraiser/Sponsor precedent. The question this was built for ("New money, or money back?")
 * stays correctable forever, because re-filing moves no money, so it takes the dropdown shape.
 *
 * ⚠ THE SUB-LINE IS NOT DECORATION. The two answers it was built for are the same transaction told
 * two ways; the name alone cannot separate them, and the consequence ("nets into the cost it
 * repaid") is the thing a coach is actually choosing between. A native `<select>` cannot carry it,
 * which is the whole reason this is a button and a list.
 *
 * ⚠⚠ THE LIST IS VIEWPORT-**FIXED**, ANCHORED TO THE FIELD'S MEASURED RECT, and that is inherited
 * knowledge rather than a preference: both callers live inside a scrolling modal, an absolutely
 * positioned list is clipped by it, and an in-flow list was tried and rejected on sight (§80 walk,
 * 2026-08-23) because opening a field must not resize the modal. ⚠ No ancestor of the modal may
 * gain a `transform`/`filter`, or `fixed` re-anchors to it and this clips again.
 *
 * ⚠ NO FULL-VIEWPORT BACKDROP to catch the outside press. One was tried and it swallowed the first
 * click on Cancel/Save; the close is a capture-phase listener, so the same press lands where it was
 * aimed.
 *
 * ⚠⚠ IT DOES NOT ABSORB "What happened?" (`accounting/expenses/panel.tsx`), and that is a decision
 * rather than an oversight. That control is eight answers in three groups with live dollar hints, a
 * hand-off row that walks the coach out of the form, and a locked-band state — it is a mode switch
 * wearing a field's clothes. Folding a two-answer question into it would grow this component five
 * props to serve one caller. The two share their CSS (`convWhat*`, below), which is what keeps them
 * looking like one control; if the conversation chooser is ever simplified, this is where it lands.
 */
import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';

export interface SublinedOption<T extends string> {
  value: T;
  name: string;
  sub: string;
}

export default function SublinedChoice<T extends string>({
  label,
  options,
  value,
  onChange,
  placeholder = 'Choose…',
  disabled = false,
  id,
}: {
  label: string;
  options: ReadonlyArray<SublinedOption<T>>;
  /** null = nothing chosen yet, which the field says out loud rather than defaulting to answer one. */
  value: T | null;
  onChange: (value: T) => void;
  placeholder?: string;
  disabled?: boolean;
  id: string;
}) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  /* Outside press closes the list, in the CAPTURE phase, so the press it closes on still reaches
     whatever it was aimed at. */
  useEffect(() => {
    if (!open) return;
    const onPress = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPress, true);
    return () => document.removeEventListener('pointerdown', onPress, true);
  }, [open]);

  /* ⚠ A LIST ANCHORED TO A RECT MEASURED WHEN IT OPENED MUST CLOSE WHEN THE PAGE MOVES UNDER IT,
     or it hangs in space beside the field it belongs to. Cheaper and more honest than re-measuring
     on every scroll frame, and the coach's next tap re-opens it in the right place. */
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [open]);

  const chosen = options.find(o => o.value === value) ?? null;

  return (
    <div ref={wrapRef} className={styles.convWhatWrap}>
      <button
        type="button"
        id={id}
        className={`${styles.convWhatField} ${chosen ? '' : styles.convWhatFieldEmpty}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        disabled={disabled}
        onClick={() => {
          if (!open) {
            const r = wrapRef.current?.getBoundingClientRect();
            setRect(r ? { top: r.bottom + 4, left: r.left, width: r.width } : null);
          }
          setOpen(o => !o);
        }}
      >
        <span>{chosen ? chosen.name : placeholder}</span>
        <ChevronDown size={15} className={styles.convWhatCaret} aria-hidden />
      </button>
      {open && rect && (
        <div
          className={styles.convWhatList}
          style={{ top: rect.top, left: rect.left, width: rect.width }}
          role="listbox"
          aria-label={label}
        >
          {options.map(o => (
            <button
              key={o.value}
              type="button"
              role="option"
              aria-selected={value === o.value}
              className={styles.convWhatOpt}
              onClick={() => { onChange(o.value); setOpen(false); }}
            >
              <span>
                <span className={styles.convWhatOptName}>{o.name}</span>
                <span className={styles.convWhatOptSub}>{o.sub}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
