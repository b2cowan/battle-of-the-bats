'use client';
/**
 * A SECTION'S ICON FIELD — a dropdown that shows the icons, not only their names (owner, 2026-10-12: "show what the
 * icon looks like"). A native `<select>` cannot draw a picture in its list, which is the whole reason this is a button
 * and a list. It is still a dropdown (one value: the 22 August rule), dressed as the kit's select.
 *
 *   the list   hangs over the window like every field's list (`useFieldMenu`, §80) — opening it never resizes the
 *              window, and its footer never cuts it off.
 *   keys       as a select's: ↓ ↑ Enter or Space open it at the chosen icon; ↓ ↑ Home End move; Enter or Space picks;
 *              Escape closes the list and returns to the field — never the window (`useDismissable` claims the key,
 *              `data-escape-owner` covers the window's listener running first); Tab or Shift+Tab closes it and moves on
 *              from the field, as from a closed select.
 * ⚠ It never closes on blur. Safari focuses no button on a click, so a press on the field blurred the list to <body>,
 *   closed it, and the click then opened it again — the field could not shut its own list (/review, 2026-10-12). A press
 *   elsewhere is `useDismissable`'s; the keys are handled here.
 */
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import ck from '@/components/admin/kit/club/ClubKit.module.css';
import { useDismissable, useFieldMenu } from '@/lib/overlay-hooks';
import { RuleIcon } from '@/lib/rule-icons';
import { RULE_ICONS, RULES_WORDS as W } from '@/lib/tournament-settings-words';
import styles from './rules.module.css';

export default function RuleIconField({ id, value, onChange }: { id: string; value: string; onChange: (icon: string) => void }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const close = () => setOpen(false);
  // Back to the field: on Escape (the hook's own return goes to whatever held focus at opening, which in Safari is not
  // the field), on Tab (whose move then starts from the field), and on a pick.
  const closeToField = () => { setOpen(false); field.current?.focus(); };
  useDismissable(open, wrap, close, closeToField);
  useFieldMenu(open, field, list, close);
  const chosen = RULE_ICONS.find(i => i.value === value) ?? RULE_ICONS[0];

  // Opened, the list is read from the chosen icon, as a select's is.
  useEffect(() => {
    if (open) list.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.focus({ preventScroll: true });
  }, [open]);

  const pick = (icon: string) => {
    onChange(icon);
    closeToField();
  };

  const onFieldKey = (e: KeyboardEvent) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); setOpen(true); }
  };
  const onListKey = (e: KeyboardEvent) => {
    if (e.key === 'Tab') { closeToField(); return; }
    const options = Array.from(list.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? []);
    const at = options.indexOf(document.activeElement as HTMLElement);
    const to = e.key === 'ArrowDown' ? Math.min(at + 1, options.length - 1)
      : e.key === 'ArrowUp' ? Math.max(at - 1, 0)
      : e.key === 'Home' ? 0
      : e.key === 'End' ? options.length - 1
      : null;
    if (to === null) return;
    e.preventDefault();
    options[to]?.focus({ preventScroll: true });
  };

  return (
    <div className={ck.field}>
      <span className={ck.label} id={`${id}-label`}>{W.icon}</span>
      <div ref={wrap} data-escape-owner={open ? '' : undefined}>
        <button ref={field} type="button" id={id} className={`${ck.select} ${styles.iconField}`}
          aria-haspopup="listbox" aria-expanded={open} aria-labelledby={`${id}-label ${id}`}
          onClick={() => setOpen(o => !o)} onKeyDown={onFieldKey}>
          <RuleIcon name={chosen.value} size={18} className={styles.iconMark} aria-hidden />
          <span className={styles.iconName}>{chosen.label}</span>
          <ChevronDown size={15} className={styles.iconCaret} aria-hidden />
        </button>
        {open && (
          <div ref={list} className={styles.iconList} role="listbox" aria-labelledby={`${id}-label`} onKeyDown={onListKey}>
            {RULE_ICONS.map(i => (
              <button key={i.value} type="button" role="option" tabIndex={-1} aria-selected={i.value === chosen.value}
                className={styles.iconOption} onClick={() => pick(i.value)}>
                <RuleIcon name={i.value} size={18} className={styles.iconMark} aria-hidden />
                <span className={styles.iconName}>{i.label}</span>
                {i.value === chosen.value && <Check size={15} className={styles.iconTick} aria-hidden />}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
