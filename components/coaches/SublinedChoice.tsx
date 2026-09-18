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
 *
 * ⚠ `variant="toolbar"` (added for the Skills & Goals report toolbar, 2026-09-16) is the one other
 * shape this DOES absorb: a compact filter field that must sit in a row beside plain `<select>`s and
 * look like one of them, rather than the bold olive "answer this" field the money conversation uses.
 * `group` on an option draws the SAME grey caps-label the money picker's groups use (`.convWhatGroup`)
 * — read it as "no header" by default (an ungrouped run of options, e.g. every live metric) and only
 * a NEW group value opens a fresh header (so "Retired" appears once, above its run, never repeated
 * per-option the way a native `<option>` had to say "(retired)" on every single row).
 */
import { Fragment, useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';
import { claimEscape } from './escapeOwnership';

export interface SublinedOption<T extends string> {
  value: T;
  name: string;
  /** The muted second line in the open list ("latest result", "test with a range"). Empty string renders no second line (e.g. "Current focus"). */
  sub: string;
  /** Draws a `.convWhatGroup` header above this option when it differs from the option before it. Omit for an ungrouped run. */
  group?: string;
  /**
   * A short coloured word on the option's right — the money chooser's live hint ("1 overdue ·
   * $97.09") in the same `.convWhatOptLive` slot, olive by default. `tone` turns it into a warning
   * (amber), a danger (red) or a quiet aside (tertiary). Added for the inning inspector's picker
   * (D9, 2026-09-18): "Best 3" · "Never" · "At cap" · "Doesn't pitch".
   */
  trail?: { text: string; tone?: 'good' | 'warn' | 'bad' | 'quiet' };
}

export default function SublinedChoice<T extends string>({
  label,
  options,
  value,
  onChange,
  placeholder = 'Choose…',
  disabled = false,
  id,
  variant = 'field',
  showClosedSub = false,
  triggerClassName,
  listWidth = 400,
}: {
  /**
   * ⚠⚠ THE ACCESSIBLE NAME ONLY — THIS RENDERS NO VISIBLE TEXT. Every caller draws its own
   * `<label className={styles.label} htmlFor={id}>` above, inside its own `.field` block. The prop
   * name reads like it paints one, and on 2026-09-04 a third caller passed it and stopped, shipping
   * a field with no heading — invisible to typecheck, lint and every gate, and only caught by
   * opening the screen. If a fourth caller arrives, consider moving the label in here instead.
   */
  label: string;
  options: ReadonlyArray<SublinedOption<T>>;
  /** null = nothing chosen yet, which the field says out loud rather than defaulting to answer one. */
  value: T | null;
  onChange: (value: T) => void;
  placeholder?: string;
  disabled?: boolean;
  id: string;
  /**
   * 'field' (default) is the bold olive "answer this" money-conversation look. 'toolbar' matches a
   * plain `.select` sitting in a row of report filters. 'menu' (D9, 2026-09-18) is an ACTION
   * picker rather than a value field: the caller keeps `value` null so the trigger always reads
   * its `placeholder` ("Change"), the list is sized for its own content (`listWidth`, capped to the
   * viewport) and anchored to the trigger's RIGHT edge — a trigger that sits at the end of a row
   * would otherwise open a list as narrow as its own word — and it opens UPWARD when the room
   * below is short, so a trigger low on the screen is not handed a two-row slit. The trigger's
   * look comes from the caller (`triggerClassName`), because a menu's trigger is the row's own
   * door word, not a field.
   */
  variant?: 'field' | 'toolbar' | 'menu';
  /** Toolbar filters name their qualifier in the closed state too ("Changeup speed · latest result"), muted, so the field says what it's showing without opening the list. */
  showClosedSub?: boolean;
  /** Replaces the variant's trigger classes outright — required in practice for `variant="menu"`. */
  triggerClassName?: string;
  /** `variant="menu"` only: the list's width in px before the viewport caps it. */
  listWidth?: number;
}) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<{ top?: number; bottom?: number; left: number; width: number; maxHeight?: number } | null>(null);
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
     on every scroll frame, and the coach's next tap re-opens it in the right place.
     ⚠ THE LIST ITSELF SCROLLS (`.convWhatList` is `overflow-y: auto` once its options overrun
     `max-height`), and a capture-phase `scroll` listener on `window` sees that scroll too — it is
     an ancestor in the capturing chain regardless of the event's own (non-)bubbling. Closing on
     every scroll made the list close on the coach's own scroll wheel. `wrapRef` contains the list
     (it renders inside the same wrapper as the button, `position: fixed` only changes where it
     paints), so a target inside it is the list scrolling, not the page — the same guard the money
     conversation's hand-rolled copy of this control already carries. */
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e.target instanceof Node && wrapRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [open]);

  const chosen = options.find(o => o.value === value) ?? null;

  return (
    <div
      ref={wrapRef}
      className={styles.convWhatWrap}
      data-escape-owner={open ? '' : undefined}
      onKeyDown={e => { if (e.key === 'Escape' && open) { claimEscape(e); setOpen(false); } }}
    >
      {/* ⚠ THIS SUBTREE OWNS ESCAPE WHILE ITS LIST IS OPEN — the `data-escape-owner` contract
          `useDialogFloor` reads (§134 walk, 2026-09-03). Both callers sit inside a Question that
          stacks over a room, and without this an Escape aimed at the open list tore down the whole
          conversation instead. The handler is on the WRAPPER, not the button, so a key raised from
          a highlighted option in the list is caught too. */}
      <button
        type="button"
        id={id}
        className={triggerClassName ?? (variant === 'toolbar'
          ? `${styles.select} ${styles.devToolbarControl} ${styles.convChoiceToolbarField}`
          : `${styles.convWhatField} ${chosen ? '' : styles.convWhatFieldEmpty}`)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        disabled={disabled}
        onClick={() => {
          if (!open) {
            const r = wrapRef.current?.getBoundingClientRect();
            if (!r) setRect(null);
            else if (variant !== 'menu') setRect({ top: r.bottom + 4, left: r.left, width: r.width });
            else {
              // A menu is sized for its rows, hung from the trigger's right edge, and flips above
              // it when the room below would hand the coach a slit to scroll through.
              const gutter = 8;
              const width = Math.min(listWidth, window.innerWidth - gutter * 2);
              const left = Math.max(gutter, Math.min(r.right - width, window.innerWidth - width - gutter));
              const below = window.innerHeight - r.bottom - 4 - gutter;
              const above = r.top - 4 - gutter;
              if (below >= 240 || below >= above) setRect({ top: r.bottom + 4, left, width, maxHeight: Math.max(160, below) });
              else setRect({ bottom: window.innerHeight - r.top + 4, left, width, maxHeight: Math.max(160, above) });
            }
          }
          setOpen(o => !o);
        }}
      >
        <span>
          {chosen ? chosen.name : placeholder}
          {chosen && showClosedSub && chosen.sub && <span className={styles.convChoiceClosedSub}> · {chosen.sub}</span>}
        </span>
        <ChevronDown size={15} className={variant === 'field' ? styles.convWhatCaret : styles.convChoiceToolbarCaret} aria-hidden />
      </button>
      {open && rect && (
        <div
          className={styles.convWhatList}
          style={{ top: rect.top, bottom: rect.bottom, left: rect.left, width: rect.width, maxHeight: rect.maxHeight }}
          role="listbox"
          aria-label={label}
        >
          {(() => {
            let lastGroup: string | undefined;
            return options.map(o => {
              const header = o.group && o.group !== lastGroup ? o.group : null;
              lastGroup = o.group ?? lastGroup;
              return (
                <Fragment key={o.value}>
                  {header && <div className={styles.convWhatGroup}>{header}</div>}
                  <button
                    type="button"
                    role="option"
                    aria-selected={value === o.value}
                    className={styles.convWhatOpt}
                    onClick={() => { onChange(o.value); setOpen(false); }}
                  >
                    <span>
                      <span className={styles.convWhatOptName}>{o.name}</span>
                      {o.sub && <span className={styles.convWhatOptSub}>{o.sub}</span>}
                    </span>
                    {o.trail && <span className={styles.convWhatOptLive} data-tone={o.trail.tone}>{o.trail.text}</span>}
                  </button>
                </Fragment>
              );
            });
          })()}
        </div>
      )}
    </div>
  );
}
