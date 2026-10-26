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
 *   · On a phone the button is the sliders alone, a 44px square beside Search and Tools — no word, no chevron — and
 *     olive with its count while something is on (owner, 2026-10-12, Stage 3 walk: Tools' own rule, its word at a
 *     desk and its glyph on a phone). The stylesheet decides, so nothing flashes on hydration.
 *   · `FilterLine`, under the toolbar, names what is on at every width (same ruling, A2).
 */
import { Fragment, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Check, ChevronDown, SlidersHorizontal, X } from 'lucide-react';
import { useDismissable, useViewportFit } from '@/lib/overlay-hooks';
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
  /** A few quiet words at the header's right end — where the group's other choices went ("Pick a division"). Never a row. */
  note?: string;
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
  // At a desk the menu's height is the room actually left under it, so the last group scrolls inside the menu rather
  // than below the window (a fixed guess at the toolbar's height ran it off the bottom, §294).
  useViewportFit(open && !isPhone, panelRef);

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
          <div className={tb.regFilterHeader}><span>{g.label}</span>{g.note && <span className={tb.regFilterNote}>{g.note}</span>}</div>
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
        <span className={tb.filterWord}>{label}</span>
        {on > 0 && <span className={tb.filterOn} aria-hidden>{on}</span>}
        <ChevronDown size={14} className={tb.filterChevron} aria-hidden />
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

/** What each group has ticked, by its rows' words and in the menu's order — what `FilterLine` names. */
export function pickedLabels(groups: readonly FilterGroupDef[]): string[][] {
  return groups.map(g => g.options.filter(o => g.selected.includes(o.key)).map(o => o.label));
}

/**
 * THE FILTER LINE — under the toolbar, only while something is on: what is on, named (owner, 2026-10-12, Stage 3 walk:
 * the phone's button lost its word, so the screen says which filters a count stands for). One group's picks are joined
 * by commas, the groups by a dot: "U11 Girls, U13 Boys · Maple Field 2". Plain text, never a door — the Filter button
 * above it is the way in, and Reset stays in its menu (no "Clear" under a toolbar, 2026-10-01). Every pick is named and
 * the line wraps: a pill caps at three because its width is fixed (Filter Counts D2), a line does not need to. The
 * owner dropped the visible word "Filter:"; a screen reader still hears it, since the text alone says nothing about
 * what it is.
 */
export function FilterLine({ picks, label }: {
  /** Each group's ticked words; an empty group says nothing. */
  picks: readonly (readonly string[])[];
  /** The button's word ("Filter"), heard before the line. */
  label: string;
}) {
  const text = picks.filter(p => p.length > 0).map(p => p.join(', ')).join(' · ');
  if (!text) return null;
  return <p className={tb.filterLine}><span className="sr-only">{label}: </span>{text}</p>;
}
