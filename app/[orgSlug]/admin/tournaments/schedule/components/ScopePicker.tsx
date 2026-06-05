'use client';

/**
 * ScopePicker — single-select division dropdown for the schedule. Pick "All
 * divisions" or exactly one division (one click). In `singleSelect` mode (the
 * bracket view, which is per-division) the "All" option is hidden. Pools are not
 * selectable here; on the timeline they're conveyed via color on the cards and
 * non-selected divisions appear as faded ghost blocks.
 *
 * Contract is kept as `Set<string> | null` (null = all) so the page's existing
 * `filterGroup` / scope logic is unchanged; the set only ever holds one id.
 */

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';
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
  /** Bracket view is per-division → hide "All"; one division must be chosen. */
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

  const isAll = value === null;
  const selectedId = value && value.size >= 1 ? [...value][0] : null;
  const selectedName = selectedId ? (divisions.find(d => d.id === selectedId)?.name ?? null) : null;

  function pickDivision(id: string) { onChange(new Set([id])); setOpen(false); }
  function pickAll() { onChange(null); setOpen(false); }

  const label = singleSelect
    ? (selectedName ?? divisions[0]?.name ?? 'Select division')
    : isAll ? 'All divisions'
    : (selectedName ?? 'All divisions');

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button type="button" className={styles.trigger} onClick={() => setOpen(o => !o)} aria-expanded={open} aria-label="Division">
        <span className={styles.triggerLabel}>{label}</span>
        <ChevronDown size={14} className={styles.caret} aria-hidden />
      </button>

      {open && (
        <div className={styles.popover} role="menu" aria-label="Choose division">
          {!singleSelect && (
            <button type="button" className={styles.row} data-level="all" onClick={pickAll}>
              <span className={styles.box} data-state={isAll ? 'on' : 'off'}>{isAll ? <Check size={11} /> : null}</span>
              <span className={styles.rowLabel}>All divisions</span>
            </button>
          )}
          {divisions.map(d => {
            const on = selectedId === d.id && (singleSelect || !isAll);
            return (
              <button key={d.id} type="button" className={styles.row} data-level="div" onClick={() => pickDivision(d.id)}>
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
