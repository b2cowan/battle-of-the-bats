'use client';
/**
 * THE DIVISION PICKER — Teams' (owner, 2026-10-01), and Results' since the coin toss gave Results a count (Tournament
 * admin redesign Stage 3, S7). Our own list rather than the browser's, because a
 * built-in list holds plain text only and the owner asked for a division's waiting teams as a MARK, not
 * words: "· 1 to review" read as part of the name and was cut off on a phone.
 *
 *   · Every division with teams to review wears the rail's amber waiting count (the "2" beside Teams) —
 *     one mark for "waiting" across the frame, so the class is the rail's own, not a copy.
 *   · The closed box shows the division's NAME only; its own count is said by the "To review" band
 *     under it. When ANOTHER division has work, the box carries an amber dot, so the list is worth
 *     opening. Opening it is the explanation: the division with the pill.
 *   · The open list is this page's filter-menu look (Status, Payment), so the toolbar has one menu.
 *
 * ⚠ The schedule still uses the browser's list for its divisions: it shows no per-division count. If it gains one,
 * it takes this control rather than growing a second shape. A screen whose count is another thing passes its own
 * `words` (Results: a coin toss to record); "All divisions" is a choice like any other (id '').
 */
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { useDismissable } from '@/lib/overlay-hooks';
import { TEAMS_WORDS } from '@/lib/registration-words';
import kit from '@/components/admin/kit/AdminKitFrame.module.css';
import tb from '@/components/admin/tournament/AdminToolbar.module.css';

export type DivisionChoice = { id: string; name: string; waiting: number };

/** What a division's count is, in words for assistive tech (Teams' default: teams to review). */
export type DivisionPickerWords = { waiting: (n: number) => string; waitingElsewhere: string };
const TEAMS_PICKER_WORDS: DivisionPickerWords = { waiting: TEAMS_WORDS.toReviewCount, waitingElsewhere: TEAMS_WORDS.waitingElsewhere };

const ITEM = '[role="menuitemradio"]';

export default function DivisionPicker({
  divisions,
  value,
  onChange,
  words = TEAMS_PICKER_WORDS,
  className,
}: {
  divisions: readonly DivisionChoice[];
  value: string;
  onChange: (id: string) => void;
  words?: DivisionPickerWords;
  /** The field's own width class where the host's toolbar sizes it (Results' view sheet fills its row). */
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  // A click away just closes; Escape hands focus back to the box (the keyboard is still driving).
  useDismissable(open, rootRef, () => setOpen(false), () => { setOpen(false); triggerRef.current?.focus(); });

  const chosen = divisions.find(d => d.id === value);
  const shownName = chosen?.name ?? TEAMS_WORDS.noDivisions;
  const waitingElsewhere = divisions.some(d => d.id !== value && d.waiting > 0);

  // Opened, focus lands on the division on screen, so the arrows start from where you are.
  useEffect(() => {
    if (!open) return;
    const list = listRef.current;
    (list?.querySelector<HTMLButtonElement>(`${ITEM}[aria-checked="true"]`) ?? list?.querySelector<HTMLButtonElement>(ITEM))?.focus();
  }, [open]);

  function onListKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return;
    const items = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>(ITEM) ?? []);
    if (items.length === 0) return;
    e.preventDefault();
    const at = items.indexOf(document.activeElement as HTMLButtonElement);
    const next = e.key === 'Home' ? 0
      : e.key === 'End' ? items.length - 1
        : (at + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
    items[next].focus();
  }

  function pick(id: string) {
    setOpen(false);
    triggerRef.current?.focus();
    if (id !== value) onChange(id);
  }

  return (
    <div className={className ? `${tb.divisionField} ${className}` : tb.divisionField} ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className={`${tb.divisionSelect} ${tb.divisionTrigger}`}
        onClick={() => setOpen(v => !v)}
        disabled={divisions.length === 0}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${TEAMS_WORDS.division}: ${shownName}${waitingElsewhere ? `. ${words.waitingElsewhere}` : ''}`}
      >
        <span className={tb.divisionTriggerName}>{shownName}</span>
        {waitingElsewhere && <span className={tb.divisionWaitingDot} aria-hidden />}
        <ChevronDown size={16} className={tb.divisionChevron} aria-hidden />
      </button>
      {open && (
        <div
          ref={listRef}
          className={`${tb.regFilterPanel} ${tb.divisionPanel}`}
          role="menu"
          aria-label={TEAMS_WORDS.division}
          onKeyDown={onListKey}
        >
          {divisions.map(d => {
            const on = d.id === value;
            return (
              <button
                key={d.id}
                type="button"
                role="menuitemradio"
                aria-checked={on}
                aria-label={d.waiting > 0 ? `${d.name}, ${words.waiting(d.waiting)}` : d.name}
                className={tb.regFilterOption}
                data-on={on || undefined}
                onClick={() => pick(d.id)}
              >
                <span className={tb.regFilterCheck}>{on ? <Check size={12} aria-hidden /> : null}</span>
                <span className={tb.regFilterName}>{d.name}</span>
                {d.waiting > 0 && <span className={kit.count} aria-hidden>{d.waiting}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
