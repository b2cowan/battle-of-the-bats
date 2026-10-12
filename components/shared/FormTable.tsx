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
 *   · the rows OPEN NOTHING — no row-end chevron, no row click, no name link (one exception, below: the Divisions
 *     step's phone row opens that row's own form, never a place);
 *   · a row may EXPAND IN PLACE: a down chevron, a real `<button aria-expanded>` in the last cell, opening the row's
 *     own form inside the table (New allocation: a team's own installments);
 *   · the CLOSING row states the sum of the ticked rows and the difference from what they must add up to — never a
 *     separate warning;
 *   · a row's arrow, and the form it opens, show only while the row is TICKED — a row out of the create has no form
 *     of its own to give (the column stays drawn while any row carries an `expand`, so a first tick moves nothing);
 *   · on a phone it is ONE FRAME OF SHORT RECORDS: the tick and the name with the figure at the row's end, the row's
 *     other fields as one line under it, a row opening in place the same way — EXCEPT the New tournament window's
 *     Divisions step, whose rows open their own window full screen (the table standard §3.10.8): THE FORM TABLE'S ONE
 *     FULL-SCREEN ROW (owner, 2026-10-11, walk §290 Ask 6). `phoneRowWindows` says so for a table; on a phone every row
 *     (heading or record) then shares one 48px box column, a ticked row is two targets that touch and never overlap
 *     (its box alone unticks it; one button — the name, `phoneLine` under it and the house row chevron — opens it,
 *     `phoneOpen`), and an unticked row stays one label that ticks wherever it is tapped. At a desk it changes nothing;
 *   · a row that has just LANDED or MOVED (a division added under its heading) washes olive-soft for a moment (`wash`);
 *   · rows may sit under GROUP HEADINGS (Ask 11, owner 2026-10-08 — New allocation's teams under their rep-team
 *     groups): a heading row before its group's first row, its own box ticking the whole group (checked, mixed or
 *     empty), its name and count, and cells of its own (a group's figure, its total); on a phone a band in the frame.
 *     The caller sorts the rows by group; a row's `group` names its heading;
 *   · a row may carry a quiet NOTE BESIDE ITS NAME (New allocation: the team's season) — a fact every row has, read
 *     without a column of its own; on a phone it belongs in `phoneLine`;
 *   · A FORM TABLE WHOSE ROWS ARE ALL IN CARRIES NO TICK (`allIn` — owner, the Divisions step's round 3, 2026-10-12; the
 *     table standard §3.6). Where a create form lists only records the person has added, the lead cell holds the name
 *     alone, every row shows its cells and its arrow, and the closing row sums every row. A row leaves from its own form
 *     (the record's rare door at its end), never by an untick or a mark on the row. The two options combine: with
 *     `phoneRowWindows` a phone row is ONE door to its window (the name, its line and the chevron); without it, an
 *     `allIn` phone row is a short record whose form opens in place. Its rows are `FormTableInRow` (no tick fields), so
 *     a ticking table's rows keep `ticked` and `tickLabel` required.
 *
 * ⚠ TOKENS ONLY: both shells (the coaches portal and the admin) define every value its stylesheet reads.
 */
import { type ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import styles from './FormTable.module.css';

export interface FormTableColumn {
  key: string;
  label: ReactNode;
  /** A figure column: right-aligned, tabular. */
  numeric?: boolean;
  width?: number | string;
}

/** What every row carries, ticked or not. */
interface FormTableRowBase {
  key: string;
  /** The record's name — the lead cell, beside its checkbox (alone in an `allIn` table). */
  name: string;
  /** Why the row can't be in — across the cells it would have filled. */
  reason?: ReactNode;
  /** Each column's cell (by `key`). */
  cells: Record<string, ReactNode>;
  /** On a phone: the line under the name (season · due) and the figure at the row's end. */
  phoneLine?: ReactNode;
  phoneFigure?: ReactNode;
  /** The row's own form, opened in place (its arrow shows while the row is ticked). */
  expand?: { open: boolean; onToggle: () => void; label: string; content: ReactNode };
  /** On a phone, in a `phoneRowWindows` table: the ticked (or `allIn`) row's door to its own window. `label` is the door's
   *  accessible name — the row's summary and that it opens ("Open U11: 8 teams, up to age 11"). */
  phoneOpen?: { label: string; onOpen: () => void };
  /** The row has just landed or moved (a division added under its heading): a count that changes each time — the row
   *  washes olive-soft once per change, a fade the table owns (no timer anywhere). Leave it set; a new count replays it. */
  wash?: number;
  /** The heading (`FormTableGroup.key`) the row sits under. */
  group?: string;
  /** A quiet fact beside the name at a desk ("2027 Season"). */
  nameNote?: ReactNode;
}

/** A row of a ticking table: in or out, by its own box. */
export interface FormTableRow extends FormTableRowBase {
  ticked: boolean;
  /** Ticks or unticks the row. Absent: the row can't be in (it is dim, unticked, and says why). */
  onTick?: (next: boolean) => void;
  /** The checkbox's accessible name ("Bill 9U A"). */
  tickLabel: string;
}

/** A row of an `allIn` table: every row is in, so it carries no tick. */
export type FormTableInRow = FormTableRowBase;

/** The rows as the table reads them, either kind. */
type Row = FormTableRowBase & Partial<Pick<FormTableRow, 'ticked' | 'onTick' | 'tickLabel'>>;

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

export default function FormTable({ ariaLabel, leadLabel, expandLabel = 'Open', columns, rows: tableRows, groups, closing, phoneRowWindows = false, allIn = false }: {
  ariaLabel: string;
  /** On a phone, a ticked row opens its OWN WINDOW (`phoneOpen`) instead of opening in place — the form table's one
   *  full-screen row, the New tournament window's Divisions step only (see the header; §3.6). */
  phoneRowWindows?: boolean;
  /** Headings the rows sit under (each row's `group`), in the order the rows come. */
  groups?: readonly FormTableGroup[];
  /** The expand column's heading, read by a screen reader only ("Own payments"). */
  expandLabel?: string;
  /** The lead column's heading ("Team"). */
  leadLabel: ReactNode;
  columns: readonly FormTableColumn[];
  /** The closing row: its label (the count) and its cells — the sum, and the difference said in words — by column
   *  key. On a phone the band at the frame's head says the count and the sum (`phone`), and `note` the difference. */
  closing: {
    label: ReactNode; cells: Record<string, ReactNode>; note?: ReactNode; noteBad?: boolean; phone?: ReactNode;
    /** At a desk the note takes a quiet row of its own under the closing row, across the table — for a table whose columns
     *  have no room for the difference in words (the club scheduler's "64 slots left open…", Club Tier 11a specimen 4).
     *  Without it the note is the phone's only; a desk says the difference in one of `cells`. */
    noteRow?: boolean;
  };
} & (
  /** A ticking table's rows — each in or out by its own box. */
  | { allIn?: false; rows: readonly FormTableRow[] }
  /** Every row is in: no tick, the name alone in the lead cell, every row's cells and arrow — a create form that lists
   *  only what the person added (the New tournament window's Divisions; see the header; §3.6). */
  | { allIn: true; rows: readonly FormTableInRow[] }
)) {
  const rows: readonly Row[] = tableRows;
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

  // The two boxes, once: a row's (in or out) and a heading's (checked, MIXED when some rows are in; pressing a mixed
  // box ticks the whole group). Every arrangement below wraps these, never a copy of them.
  const tickInput = (r: Row, id: string) => (
    <input id={id} type="checkbox" className={styles.tick} checked={r.ticked === true} disabled={!r.onTick}
      aria-label={r.tickLabel} onChange={e => r.onTick?.(e.target.checked)} />
  );
  const groupInput = (g: FormTableGroup) => (
    <input id={`ftg-${g.key}`} type="checkbox" className={styles.tick}
      ref={el => { if (el) el.indeterminate = g.state === 'some'; }}
      checked={g.state === 'all'} disabled={!g.onTick} aria-label={g.tickLabel}
      onChange={() => g.onTick?.(g.state !== 'all')} />
  );
  // The lead cell: the box and the name, one label — or, in an `allIn` table, the name alone (and its note).
  const tick = (r: Row, id: string, withNote = false) => {
    const name = (
      <>
        <span className={styles.name}>{r.name}</span>
        {withNote && r.nameNote != null && <span className={styles.nameNote}>{r.nameNote}</span>}
      </>
    );
    return allIn ? <span className={styles.leadName}>{name}</span> : (
      <label className={`${styles.tickLabel}${r.onTick ? '' : ` ${styles.tickOff}`}`} htmlFor={id}>
        {tickInput(r, id)}
        {name}
      </label>
    );
  };
  const groupTick = (g: FormTableGroup) => (
    <label className={`${styles.tickLabel}${g.onTick ? '' : ` ${styles.tickOff}`}`} htmlFor={`ftg-${g.key}`}>
      {groupInput(g)}
      <span className={styles.groupName}>{g.label}</span>
      <span className={styles.groupCount}>· {g.count}</span>
    </label>
  );
  /** In the create: ticked — or every row of an `allIn` table. */
  const isIn = (r: Row) => allIn || r.ticked === true;
  /** Can be in (its cells, not a reason; never dim): every row of an `allIn` table, or one with a tick to press. */
  const live = (r: Row) => allIn || Boolean(r.onTick);
  // A row's own form belongs to a row that is in: an unticked row shows no arrow and no form (see the header).
  const toggle = (r: Row) => isIn(r) && r.expand && (
    <button type="button" className={styles.expand} aria-expanded={r.expand.open} aria-label={r.expand.label} onClick={r.expand.onToggle}>
      <ChevronDown size={16} aria-hidden className={r.expand.open ? styles.expandOpen : undefined} />
    </button>
  );
  const formOpen = (r: Row) => isIn(r) && r.expand?.open;
  // Two names for one fade, so each new count swaps the class and the fade plays again.
  const wash = (r: Row) => (r.wash ? ` ${r.wash % 2 ? styles.washOdd : styles.washEven}` : '');

  if (isPhone) {
    // A phone row, as a short record: the tick and the name, the figure at its end, its line under it, its form
    // opening in place.
    const record = (r: Row) => (
      <div key={r.key} className={`${styles.record}${live(r) ? '' : ` ${styles.off}`}${formOpen(r) ? ` ${styles.recordOpen}` : ''}${wash(r)}`}>
        <div className={styles.recordHead}>
          {tick(r, `ft-${r.key}`)}
          {live(r) && r.phoneFigure != null && <span className={styles.figure}>{r.phoneFigure}</span>}
          {toggle(r)}
        </div>
        <div className={styles.recordLine}>{live(r) ? r.phoneLine : r.reason}</div>
        {formOpen(r) && <div className={styles.recordForm}>{r.expand!.content}</div>}
      </div>
    );
    const groupBand = (g: FormTableGroup) => (
      <div key={`g-${g.key}`} className={styles.groupBand}>
        {groupTick(g)}
        {g.phoneFigure != null && <span className={styles.figure}>{g.phoneFigure}</span>}
      </div>
    );
    // THE FORM TABLE'S ONE FULL-SCREEN ROW (`phoneRowWindows`, see the header): every box in one 48px column; a
    // ticked row's box unticks it and the rest of the row is the door to its window; an unticked row (and a heading)
    // is one label that ticks wherever it is tapped. In an `allIn` table there is no box: the row is the one door.
    const boxRecord = (r: Row) => {
      const id = `ft-${r.key}`;
      const door = r.phoneOpen && (
        <button type="button" className={`${styles.door}${allIn ? ` ${styles.doorAlone}` : ''}`} aria-label={r.phoneOpen.label} onClick={r.phoneOpen.onOpen}>
          <span className={styles.name}>{r.name}</span>
          {r.phoneLine != null && <span className={styles.doorLine}>{r.phoneLine}</span>}
          <ChevronRight size={16} aria-hidden className={styles.doorChevron} />
        </button>
      );
      if (allIn) return <div key={r.key} className={`${styles.boxRow}${wash(r)}`}>{door}</div>;
      return (
        <div key={r.key} className={`${styles.boxRow}${r.onTick ? '' : ` ${styles.off}`}${wash(r)}`}>
          {r.ticked && door ? (
            <>
              <label className={styles.boxCell} htmlFor={id}>{tickInput(r, id)}</label>
              {door}
            </>
          ) : (
            <label className={`${styles.boxLead} ${styles.boxRecord}${r.onTick ? '' : ` ${styles.tickOff}`}`} htmlFor={id}>
              <span className={styles.boxCell}>{tickInput(r, id)}</span>
              <span className={styles.boxName}>
                <span className={styles.name}>{r.name}</span>
                {!r.onTick && r.reason != null && <span className={styles.doorLine}>{r.reason}</span>}
              </span>
            </label>
          )}
        </div>
      );
    };
    const boxGroup = (g: FormTableGroup) => (
      <div key={`g-${g.key}`} className={`${styles.boxRow} ${styles.boxGroup}`}>
        <label className={`${styles.boxLead}${g.onTick ? '' : ` ${styles.tickOff}`}`} htmlFor={`ftg-${g.key}`}>
          <span className={styles.boxCell}>{groupInput(g)}</span>
          <span className={styles.groupName}>{g.label}</span>
          <span className={styles.groupCount}>&nbsp;· {g.count}</span>
        </label>
      </div>
    );
    return (
      <div className={`${styles.frame}${allIn ? ` ${styles.allIn}` : ''}`} role="group" aria-label={ariaLabel}>
        <div className={styles.band}>{closing.phone ?? closing.label}</div>
        {/* ONE keyed list (flatMap, never an array per row): a row that MOVES (a division re-placed under its heading)
            keeps its element, so focus inside it survives — an array per row keyed each slot by its index. */}
        {rows.flatMap(r => {
          const g = headsBefore.get(r.key);
          return [
            g ? (phoneRowWindows ? boxGroup(g) : groupBand(g)) : null,
            phoneRowWindows ? boxRecord(r) : record(r),
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
    <div className={`${styles.frame}${allIn ? ` ${styles.allIn}` : ''}`}>
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
          {rows.flatMap(r => {
            const g = headsBefore.get(r.key);
            return [
              g ? (
                <tr key={`g-${g.key}`} className={styles.groupRow}>
                  <th scope="rowgroup">{groupTick(g)}</th>
                  {columns.map(c => <td key={c.key} className={c.numeric ? styles.num : undefined}>{g.cells?.[c.key]}</td>)}
                  {anyExpand && <td />}
                </tr>
              ) : null,
              <tr key={r.key} className={`${live(r) ? '' : styles.off}${formOpen(r) ? ` ${styles.rowOpen}` : ''}${r.group && groupOf.has(r.group) ? ` ${styles.inGroup}` : ''}${wash(r)}`}>
                <th scope="row">{tick(r, `ft-${r.key}`, true)}</th>
                {live(r)
                  ? columns.map(c => <td key={c.key} className={c.numeric ? styles.num : undefined}>{r.cells[c.key]}</td>)
                  : <td colSpan={columns.length} className={styles.reason}>{r.reason}</td>}
                {anyExpand && <td className={styles.expandCell}>{live(r) && toggle(r)}</td>}
              </tr>,
              formOpen(r) ? (
                <tr key={`${r.key}-form`} className={styles.rowOpen}>
                  <td colSpan={span + 1} className={styles.formCell}>{r.expand!.content}</td>
                </tr>
              ) : null,
            ];
          })}
          <tr className={styles.closing}>
            <th scope="row">{closing.label}</th>
            {columns.map(c => <td key={c.key} className={c.numeric ? styles.num : undefined}>{closing.cells[c.key]}</td>)}
            {anyExpand && <td />}
          </tr>
          {closing.noteRow && closing.note != null && (
            <tr className={styles.closingNote}>
              <td colSpan={span + 1} className={closing.noteBad ? styles.bad : undefined}>{closing.note}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
