'use client';
/**
 * THE FORM TABLE — a table whose rows are a create form's fields (owner, Club Tier Stage 3c Ask 6, 2026-10-07; the
 * table standard §3.6, "A form table"). First used by the club's New allocation (its teams); **shared with the
 * tournament redesign**, which draws entry forms. One component, never a class copied per form.
 *
 * The one place a cell holds a control, and ONLY inside a create form:
 *   · each row is one record the create will make; its lead cell carries a real checkbox (the row is in or out) and
 *     the record's name, and its other cells are that record's fields — an input only where the form's own choice
 *     asks for one (the caller decides; a plain figure otherwise);
 *   · a row that can't be in is listed, unticked and dim, its reason across the cells it would have filled;
 *   · the rows OPEN NOTHING — no row-end chevron, no row click, no name link;
 *   · a row may EXPAND IN PLACE: a down chevron, a real `<button aria-expanded>` in the last cell, opening the row's
 *     own form inside the table (New allocation: a team's own installments);
 *   · the CLOSING row states the sum of the ticked rows and the difference from what they must add up to — never a
 *     separate warning;
 *   · on a phone it is ONE FRAME OF SHORT RECORDS: the tick and the name with the figure at the row's end, the row's
 *     other fields as one line under it, a row opening in place the same way.
 *
 * ⚠ TOKENS ONLY: both shells (the coaches portal and the admin) define every value its stylesheet reads.
 */
import { type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import styles from './FormTable.module.css';

export interface FormTableColumn {
  key: string;
  label: ReactNode;
  /** A figure column: right-aligned, tabular. */
  numeric?: boolean;
  width?: number | string;
}

export interface FormTableRow {
  key: string;
  /** The record's name — the lead cell, beside its checkbox. */
  name: string;
  ticked: boolean;
  /** Ticks or unticks the row. Absent: the row can't be in (it is dim, unticked, and says why). */
  onTick?: (next: boolean) => void;
  /** The checkbox's accessible name ("Bill 9U A"). */
  tickLabel: string;
  /** Why the row can't be in — across the cells it would have filled. */
  reason?: ReactNode;
  /** Each column's cell (by `key`). */
  cells: Record<string, ReactNode>;
  /** On a phone: the line under the name (season · due) and the figure at the row's end. */
  phoneLine?: ReactNode;
  phoneFigure?: ReactNode;
  /** The row's own form, opened in place. */
  expand?: { open: boolean; onToggle: () => void; label: string; content: ReactNode };
}

export default function FormTable({ ariaLabel, leadLabel, expandLabel = 'Open', columns, rows, closing }: {
  ariaLabel: string;
  /** The expand column's heading, read by a screen reader only ("Own payments"). */
  expandLabel?: string;
  /** The lead column's heading ("Team"). */
  leadLabel: ReactNode;
  columns: readonly FormTableColumn[];
  rows: readonly FormTableRow[];
  /** The closing row: its label (the count) and its cells — the sum, and the difference said in words — by column
   *  key. On a phone the band at the frame's head says the count and the sum (`phone`), and `note` the difference. */
  closing: { label: ReactNode; cells: Record<string, ReactNode>; note?: ReactNode; noteBad?: boolean; phone?: ReactNode };
}) {
  const isPhone = useIsPhone();
  const anyExpand = rows.some(r => r.expand);

  const tick = (r: FormTableRow, id: string) => (
    <label className={`${styles.tickLabel}${r.onTick ? '' : ` ${styles.tickOff}`}`} htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        className={styles.tick}
        checked={r.ticked}
        disabled={!r.onTick}
        aria-label={r.tickLabel}
        onChange={e => r.onTick?.(e.target.checked)}
      />
      <span className={styles.name}>{r.name}</span>
    </label>
  );
  const toggle = (r: FormTableRow) => r.expand && (
    <button type="button" className={styles.expand} aria-expanded={r.expand.open} aria-label={r.expand.label} onClick={r.expand.onToggle}>
      <ChevronDown size={16} aria-hidden className={r.expand.open ? styles.expandOpen : undefined} />
    </button>
  );

  if (isPhone) {
    return (
      <div className={styles.frame} role="group" aria-label={ariaLabel}>
        <div className={styles.band}>{closing.phone ?? closing.label}</div>
        {rows.map(r => (
          <div key={r.key} className={`${styles.record}${r.onTick ? '' : ` ${styles.off}`}${r.expand?.open ? ` ${styles.recordOpen}` : ''}`}>
            <div className={styles.recordHead}>
              {tick(r, `ft-${r.key}`)}
              {r.onTick && r.phoneFigure != null && <span className={styles.figure}>{r.phoneFigure}</span>}
              {toggle(r)}
            </div>
            <div className={styles.recordLine}>{r.onTick ? r.phoneLine : r.reason}</div>
            {r.expand?.open && <div className={styles.recordForm}>{r.expand.content}</div>}
          </div>
        ))}
        {closing.note != null && (
          <div className={`${styles.recordNote}${closing.noteBad ? ` ${styles.bad}` : ''}`}>{closing.note}</div>
        )}
      </div>
    );
  }

  const span = columns.length + (anyExpand ? 1 : 0);
  return (
    <div className={styles.frame}>
      <table className={styles.table} aria-label={ariaLabel}>
        <colgroup>
          <col />
          {columns.map(c => <col key={c.key} style={c.width != null ? { width: c.width } : undefined} />)}
          {anyExpand && <col style={{ width: 56 }} />}
        </colgroup>
        <thead>
          <tr>
            <th scope="col">{leadLabel}</th>
            {columns.map(c => <th key={c.key} scope="col" className={c.numeric ? styles.num : undefined}>{c.label}</th>)}
            {anyExpand && <th scope="col"><span className={styles.srOnly}>{expandLabel}</span></th>}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => [
            <tr key={r.key} className={`${r.onTick ? '' : styles.off}${r.expand?.open ? ` ${styles.rowOpen}` : ''}`}>
              <th scope="row">{tick(r, `ft-${r.key}`)}</th>
              {r.onTick
                ? columns.map(c => <td key={c.key} className={c.numeric ? styles.num : undefined}>{r.cells[c.key]}</td>)
                : <td colSpan={columns.length} className={styles.reason}>{r.reason}</td>}
              {anyExpand && <td className={styles.expandCell}>{r.onTick && toggle(r)}</td>}
            </tr>,
            r.expand?.open ? (
              <tr key={`${r.key}-form`} className={styles.rowOpen}>
                <td colSpan={span + 1} className={styles.formCell}>{r.expand.content}</td>
              </tr>
            ) : null,
          ])}
          <tr className={styles.closing}>
            <th scope="row">{closing.label}</th>
            {columns.map(c => <td key={c.key} className={c.numeric ? styles.num : undefined}>{closing.cells[c.key]}</td>)}
            {anyExpand && <td />}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
