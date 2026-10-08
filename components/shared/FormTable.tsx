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
 *     other fields as one line under it, a row opening in place the same way;
 *   · rows may sit under GROUP HEADINGS (Ask 11, owner 2026-10-08 — New allocation's teams under their rep-team
 *     groups): a heading row before its group's first row, its own box ticking the whole group (checked, mixed or
 *     empty), its name and count, and cells of its own (a group's figure, its total); on a phone a band in the frame.
 *     The caller sorts the rows by group; a row's `group` names its heading;
 *   · a row may carry a quiet NOTE BESIDE ITS NAME (New allocation: the team's season) — a fact every row has, read
 *     without a column of its own; on a phone it belongs in `phoneLine`.
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
  /** The heading (`FormTableGroup.key`) the row sits under. */
  group?: string;
  /** A quiet fact beside the name at a desk ("2027 Season"). */
  nameNote?: ReactNode;
}

/** A group heading: one box for the whole group, its name and count, and cells of its own. */
export interface FormTableGroup {
  key: string;
  /** The group's name ("Senior"). */
  label: string;
  /** Beside the name: how many rows the group holds ("3 teams"). */
  count: string;
  /** How many of its rows are ticked: every one, some or none — the box is checked, mixed or empty. */
  state: 'all' | 'some' | 'none';
  /** Ticks or unticks every row in the group that can be ticked. */
  onTick?: (next: boolean) => void;
  /** The box's accessible name ("Bill every team in Senior"). */
  tickLabel: string;
  /** The heading's cells, by column key (a group's figure, its total). */
  cells?: Record<string, ReactNode>;
  /** On a phone: the band's figure at its end. */
  phoneFigure?: ReactNode;
}

export default function FormTable({ ariaLabel, leadLabel, expandLabel = 'Open', columns, rows, groups, closing }: {
  ariaLabel: string;
  /** Headings the rows sit under (each row's `group`), in the order the rows come. */
  groups?: readonly FormTableGroup[];
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

  const groupOf = new Map((groups ?? []).map(g => [g.key, g]));
  /** Each group's heading goes before the first row that names it. */
  const headsBefore = (() => {
    const out = new Map<string, FormTableGroup>();
    let last: string | undefined;
    for (const r of rows) {
      if (r.group && r.group !== last && groupOf.has(r.group)) out.set(r.key, groupOf.get(r.group)!);
      last = r.group;
    }
    return out;
  })();

  const tick = (r: FormTableRow, id: string, withNote = false) => (
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
      {withNote && r.nameNote != null && <span className={styles.nameNote}>{r.nameNote}</span>}
    </label>
  );
  // A heading's box: checked when every row is in, MIXED when some are; pressing a mixed box ticks the whole group.
  const groupTick = (g: FormTableGroup) => (
    <label className={`${styles.tickLabel}${g.onTick ? '' : ` ${styles.tickOff}`}`} htmlFor={`ftg-${g.key}`}>
      <input
        id={`ftg-${g.key}`}
        type="checkbox"
        className={styles.tick}
        ref={el => { if (el) el.indeterminate = g.state === 'some'; }}
        checked={g.state === 'all'}
        disabled={!g.onTick}
        aria-label={g.tickLabel}
        onChange={() => g.onTick?.(g.state !== 'all')}
      />
      <span className={styles.groupName}>{g.label}</span>
      <span className={styles.groupCount}>· {g.count}</span>
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
        {rows.map(r => {
          const g = headsBefore.get(r.key);
          return [
            g ? (
              <div key={`g-${g.key}`} className={styles.groupBand}>
                {groupTick(g)}
                {g.phoneFigure != null && <span className={styles.figure}>{g.phoneFigure}</span>}
              </div>
            ) : null,
            <div key={r.key} className={`${styles.record}${r.onTick ? '' : ` ${styles.off}`}${r.expand?.open ? ` ${styles.recordOpen}` : ''}`}>
              <div className={styles.recordHead}>
                {tick(r, `ft-${r.key}`)}
                {r.onTick && r.phoneFigure != null && <span className={styles.figure}>{r.phoneFigure}</span>}
                {toggle(r)}
              </div>
              <div className={styles.recordLine}>{r.onTick ? r.phoneLine : r.reason}</div>
              {r.expand?.open && <div className={styles.recordForm}>{r.expand.content}</div>}
            </div>,
          ];
        })}
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
          {rows.map(r => {
            const g = headsBefore.get(r.key);
            return [
              g ? (
                <tr key={`g-${g.key}`} className={styles.groupRow}>
                  <th scope="rowgroup">{groupTick(g)}</th>
                  {columns.map(c => <td key={c.key} className={c.numeric ? styles.num : undefined}>{g.cells?.[c.key]}</td>)}
                  {anyExpand && <td />}
                </tr>
              ) : null,
              <tr key={r.key} className={`${r.onTick ? '' : styles.off}${r.expand?.open ? ` ${styles.rowOpen}` : ''}${r.group && groupOf.has(r.group) ? ` ${styles.inGroup}` : ''}`}>
                <th scope="row">{tick(r, `ft-${r.key}`, true)}</th>
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
            ];
          })}
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
