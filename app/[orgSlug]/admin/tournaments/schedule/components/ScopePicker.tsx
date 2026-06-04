'use client';

/**
 * ScopePicker — division multi-select for the schedule (replaces the single
 * Division dropdown). Pick "All", any subset of divisions, or — in `singleSelect`
 * mode (bracket view) — exactly one. `value === null` means all. Pools are not
 * selectable here; they're conveyed via color on the timeline cards.
 */

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Check, Minus } from 'lucide-react';
import styles from './ScopePicker.module.css';

export type ScopeDivision = { id: string; name: string };

export default function ScopePicker({
  divisions,
  value,
  onChange,
  singleSelect = false,
}: {
  divisions: ScopeDivision[];
  value: Set<string> | null; // division ids; null = all
  onChange: (next: Set<string> | null) => void;
  /** Bracket view is per-division → radio-style: pick exactly one, no "all". */
  singleSelect?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false); }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const ids = divisions.map(d => d.id);
  const effective = value ?? new Set(ids);
  const isAll = value === null || (ids.length > 0 && ids.every(id => effective.has(id)));

  function emit(next: Set<string>) {
    if (ids.length > 0 && ids.every(id => next.has(id))) onChange(null);
    else onChange(next);
  }
  function toggleDivision(id: string) {
    if (singleSelect) { onChange(new Set([id])); setOpen(false); return; }
    const next = new Set(effective);
    if (next.has(id)) next.delete(id); else next.add(id);
    emit(next);
  }
  function toggleAll() { onChange(isAll ? new Set() : null); }

  const selected = divisions.filter(d => effective.has(d.id));
  // In single-select (bracket) mode the label is always the chosen division — never
  // "All divisions", even when that division is the only one in scope.
  const label = singleSelect
    ? (selected[0]?.name ?? 'Select division')
    : isAll ? 'All divisions'
    : selected.length === 0 ? 'None selected'
    : selected.length === 1 ? selected[0].name
    : `${selected.length} divisions`;

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button type="button" className={styles.trigger} onClick={() => setOpen(o => !o)} aria-expanded={open} aria-label="Divisions">
        <span className={styles.triggerLabel}>{label}</span>
        <ChevronDown size={14} className={styles.caret} aria-hidden />
      </button>

      {open && (
        <div className={styles.popover} role="dialog" aria-label="Choose divisions">
          {!singleSelect && (
            <button type="button" className={styles.row} data-level="all" onClick={toggleAll}>
              <span className={styles.box} data-state={isAll ? 'on' : selected.length > 0 ? 'some' : 'off'}>
                {isAll ? <Check size={11} /> : selected.length > 0 ? <Minus size={11} /> : null}
              </span>
              <span className={styles.rowLabel}>All divisions</span>
            </button>
          )}
          {divisions.map(d => {
            const on = effective.has(d.id);
            return (
              <button key={d.id} type="button" className={styles.row} data-level="div" onClick={() => toggleDivision(d.id)}>
                <span className={styles.box} data-state={on ? 'on' : 'off'}>{on ? <Check size={11} /> : null}</span>
                <span className={styles.rowLabel}>{d.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
