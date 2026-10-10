'use client';
/**
 * THE ADMIN'S ONE FILTER — a button that is quiet at rest and olive with its count once it narrows ("Filter, 2 on"),
 * opening ONE menu of groups whose rows are ticks (several each). Teams' shape (the Teams toolbar ruling, owner
 * 2026-10-01) as a shared part, first worn by the schedule (Tournament admin redesign Stage 3, S1: Division · Stage ·
 * Status · the sport's field). Its look is the shared toolbar sheet's (`AdminToolbar.module.css`).
 *
 *   · At a desk the menu hangs under the button; the ticks are checkboxes, so it stays open while they change.
 *   · On a phone (≤640) the same rows open on the portal's sheet frame in its MENU layer (on top of the bar, the bar
 *     live — a stray tap loses nothing), the Tools menu's own form (E1), so the schedule's two menus are one shape.
 *   · A group the caller passes with no options is absent (one division: no Division group).
 *   · Reset appears only while something is on.
 */
import { Fragment, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Check, ChevronDown, SlidersHorizontal, X } from 'lucide-react';
import { useDismissable } from '@/lib/overlay-hooks';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import SheetFrame from '@/components/coaches/SheetFrame';
import tb from './AdminToolbar.module.css';

export type FilterOption = { key: string; label: string; count?: number };
export type FilterGroupDef = {
  key: string;
  label: string;
  options: readonly FilterOption[];
  selected: readonly string[];
  onToggle: (key: string) => void;
};

const ITEM = '[role^="menuitem"]';

export default function FilterMenu({
  groups, label, onLabel, resetLabel, onReset, align = 'start', triggerClassName = '',
}: {
  groups: readonly FilterGroupDef[];
  /** The button's word ("Filter") — also the sheet's label. */
  label: string;
  /** "2 on" — said after the word in the accessible name. */
  onLabel: (n: number) => string;
  resetLabel: string;
  onReset: () => void;
  /** `end`: the menu's right edge under the button's (a Filter near the toolbar's right end). */
  align?: 'start' | 'end';
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const isPhone = useIsPhone(true);
  const shown = groups.filter(g => g.options.length > 0);
  const on = shown.filter(g => g.selected.length > 0).length;

  // The popover answers its own outside tap and Escape; the sheet's frame answers the sheet's (and its Back step).
  useDismissable(open && !isPhone, rootRef, () => setOpen(false), () => { setOpen(false); triggerRef.current?.focus(); });

  // Opened, focus lands on the first row, so the arrows start there (Teams' Filter's pattern).
  useEffect(() => {
    if (open) panelRef.current?.querySelector<HTMLButtonElement>(ITEM)?.focus({ preventScroll: true });
  }, [open, isPhone]);
  const onPanelKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return;
    const items = Array.from(panelRef.current?.querySelectorAll<HTMLButtonElement>(ITEM) ?? []);
    if (items.length === 0) return;
    e.preventDefault();
    const at = items.indexOf(document.activeElement as HTMLButtonElement);
    const next = e.key === 'Home' ? 0
      : e.key === 'End' ? items.length - 1
        : (at + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
    items[next].focus();
  };

  const rows = (
    <>
      {shown.map(g => (
        <Fragment key={g.key}>
          <div className={tb.regFilterHeader}><span>{g.label}</span></div>
          <div className={tb.regFilterList}>
            {g.options.map(o => {
              const checked = g.selected.includes(o.key);
              return (
                <button
                  key={o.key}
                  type="button"
                  className={tb.regFilterOption}
                  data-on={checked || undefined}
                  onClick={() => g.onToggle(o.key)}
                  role="menuitemcheckbox"
                  aria-checked={checked}
                  tabIndex={-1}
                >
                  <span className={tb.regFilterCheck}>{checked ? <Check size={12} aria-hidden /> : null}</span>
                  <span className={tb.regFilterName}>{o.label}</span>
                  {o.count !== undefined && <span className={tb.regFilterCount}>{o.count}</span>}
                </button>
              );
            })}
          </div>
        </Fragment>
      ))}
      {on > 0 && (
        <button type="button" role="menuitem" tabIndex={-1} className={tb.filterReset} onClick={() => { onReset(); setOpen(false); triggerRef.current?.focus(); }}>
          <X size={12} aria-hidden /> {resetLabel}
        </button>
      )}
    </>
  );

  return (
    <div className={tb.regFilterRoot} ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className={`${tb.regFilterButton}${triggerClassName ? ` ${triggerClassName}` : ''}`}
        data-active={on > 0 || undefined}
        onClick={() => setOpen(v => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={on > 0 ? `${label}, ${onLabel(on)}` : label}
      >
        <SlidersHorizontal size={14} aria-hidden />
        <span>{label}</span>
        {on > 0 && <span className={tb.filterOn} aria-hidden>{on}</span>}
        <ChevronDown size={14} aria-hidden />
      </button>
      {open && (isPhone ? (
        <SheetFrame ref={panelRef} label={label} onClose={() => setOpen(false)} opener={triggerRef} role="menu" onKeyDown={onPanelKey}>
          <div className={`${tb.filterPanel} ${tb.filterSheet}`}>{rows}</div>
        </SheetFrame>
      ) : (
        <div
          ref={panelRef}
          className={`${tb.regFilterPanel} ${tb.filterPanel}`}
          style={align === 'end' ? { left: 'auto', right: 0 } : undefined}
          role="menu"
          aria-label={label}
          onKeyDown={onPanelKey}
        >
          {rows}
        </div>
      ))}
    </div>
  );
}
