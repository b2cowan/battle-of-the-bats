'use client';
import { useMemo } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  DATE_RANGE_PRESETS, resolveDateRangePreset,
  type DateRangePresetId, type DateRangeSelection,
} from '@/lib/coach-date-range';
import { formatEventDateRange } from '@/lib/timezone';
import useDetailsOutsideClick from './useDetailsOutsideClick';
import styles from '../../app/[orgSlug]/coaches/coaches.module.css';

/**
 * The Transactions strip's FOURTH pill (owner-approved mockup, 2026-08-19) — the date range,
 * wearing the exact shape its three siblings already wear (`MultiSelectDropdown`: a `<details>`
 * pill opening a small panel; the outside-click close is `useDetailsOutsideClick`, shared). It
 * replaced the two bare `<input type="date">` pickers that sat beside the pills and answered
 * nothing until you had parsed two full dates.
 *
 * The panel holds BOTH halves of the control on purpose:
 *   - the presets, each showing the real dates it resolves to (the list teaches itself), and
 *   - the custom from/to fields, always visible at the bottom, PRE-FILLED with the active window.
 *
 * ⚠ CUSTOM IS NOT A MODE. Editing either date field IS choosing custom — there is no "Custom
 * range…" entry to click first, so "Last 30 days, but back to April" is one edit of a pre-filled
 * field, never a from-scratch two-calendar job. Picking a preset applies instantly and closes the
 * panel; the pill then names the window in words ("Last month"), or in dates when it's custom.
 *
 * Single-select buttons rather than `MultiSelectDropdown`'s checkboxes — two windows at once is
 * not a thing — which is why this is a sibling component instead of a new mode on that one.
 */
export default function DateRangeDropdown({
  selection,
  from,
  to,
  todayKey,
  seasonBounds,
  onChange,
}: {
  selection: DateRangeSelection;
  /** The EFFECTIVE window (the panel resolves presets itself) — shown in the custom fields and,
   *  when `selection` is 'custom', on the pill face. */
  from: string;
  to: string;
  /** The org's calendar day (`tournamentToday()`) — never a raw UTC date. */
  todayKey: string;
  /** What 'Whole season' means for THIS book — `computeSeasonBounds`'s output. */
  seasonBounds: { from: string; to: string };
  /** A preset pick carries only its id (the panel re-derives the window); only a custom edit
   *  carries dates — so a receiver can't accidentally pin a preset's resolved dates. */
  onChange: (next: { selection: DateRangePresetId } | { selection: 'custom'; from: string; to: string }) => void;
}) {
  const ref = useDetailsOutsideClick();

  /* Resolved once per actual input change, not per host render — this pill sits on a panel that
     re-renders per keystroke of unrelated forms (its own memo comments say so), and unlike its
     sibling pills' static labels, these seven rows are computed. */
  const options = useMemo(() => DATE_RANGE_PRESETS.map(p => {
    const r = resolveDateRangePreset(p.id, todayKey, seasonBounds);
    return {
      ...p,
      dates: p.id === 'season' ? 'everything' : formatEventDateRange(r.from, r.to, false),
    };
  }), [todayKey, seasonBounds]);

  function pick(id: DateRangePresetId) {
    onChange({ selection: id });
    if (ref.current) ref.current.open = false;
  }

  const summary = selection === 'custom'
    ? formatEventDateRange(from, to, false)
    : DATE_RANGE_PRESETS.find(p => p.id === selection)?.label ?? formatEventDateRange(from, to, false);

  return (
    <details ref={ref} className={styles.multiSelect}>
      <summary className={styles.multiSelectSummary}>
        <span className={styles.multiSelectLabel}>Date</span>
        <span className={styles.multiSelectValue}>{summary}</span>
        <ChevronDown size={14} aria-hidden />
      </summary>
      <div className={`${styles.multiSelectPanel} ${styles.dateRangePanel}`} role="group" aria-label="Date range">
        {options.map(p => (
          <button
            key={p.id}
            type="button"
            className={styles.dateRangeOption}
            aria-pressed={selection === p.id}
            onClick={() => pick(p.id)}
          >
            <span>{p.label}</span>
            <span className={styles.dateRangeOptionDates}>{p.dates}</span>
          </button>
        ))}
        <div className={styles.multiSelectDivider} />
        <div className={styles.dateRangeCustom} data-active={selection === 'custom' || undefined}>
          <div className={styles.dateRangeCustomLabel}>Custom range</div>
          {/* ⚠ `min`/`max` only STYLE the native widget — they block neither a typed nor even a
              picked inverted pair (/review). Editing one end past the other drags the other end
              along, so "to before from" is unrepresentable and the book can never silently empty
              itself behind a stray starting-balance line. */}
          <div className={styles.dateRangeCustomRow}>
            <input
              type="date"
              className={styles.dateRangeInput}
              value={from}
              max={to}
              onChange={ev => {
                const v = ev.target.value;
                if (v) onChange({ selection: 'custom', from: v, to: v > to ? v : to });
              }}
              aria-label="From date"
            />
            <span className={styles.dateRangeCustomSep} aria-hidden>–</span>
            <input
              type="date"
              className={styles.dateRangeInput}
              value={to}
              min={from}
              onChange={ev => {
                const v = ev.target.value;
                if (v) onChange({ selection: 'custom', from: v < from ? v : from, to: v });
              }}
              aria-label="To date"
            />
          </div>
          <div className={styles.dateRangeHint}>Edit either date and the pill switches to your range.</div>
        </div>
      </div>
    </details>
  );
}
