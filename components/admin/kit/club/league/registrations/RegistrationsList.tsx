'use client';
/**
 * THE LIST (Club Tier Stage 9b-2, Part 3; copy §1.2; drawings m1 and m2). At a desk a TABLE — [tick] · Player · Division ·
 * Guardian · Fee · actions — where the money is read down a column; on a phone one framed row a child: a tick, the child
 * and a detail line that carries the money, the ⋯ as a symbol alone at 44px, and the tab's one worded action under them.
 * The whole row opens the registration's record; a long press (or the tick) selects it.
 *
 * The screen builds each row's model (`RegRowModel`) once; this draws it. Nothing here decides what a row may do.
 */
import { useEffect, useRef } from 'react';
import { RepChip, RowAction, repKit, ClubRowList } from '@/components/admin/kit/club/RepKit';
import { screenParts } from '@/components/admin/tournament/ScreenParts';
import { REGS_WORDS } from '@/lib/house-league-money-words';
import type { FeeCellParts, RowActionKey } from '@/lib/house-league-registrations';
import type { LeagueRegistration } from '@/lib/types';
import FeeCell from './FeeCell';
import RowMenu, { type MenuItem } from './RowMenu';
import css from './Registrations.module.css';

/** A refusal said beside the row, with an offer where there is one (copy §7). */
export interface RowNote { text: string; offer?: { label: string; key: 'waitlist' } }

export interface RegRowModel {
  reg: LeagueRegistration;
  name: string;
  /** The child's sub-line: "Signed up Oct 24" · "Declined Oct 24". */
  playerSub: string;
  /** The division's name, or null where the child has none yet. */
  division: string | null;
  /** The division cell's sub-line: the team's name, or "Not placed". Null when there is nothing to say. */
  divisionSub: string | null;
  guardian: string;
  email: string;
  fee: FeeCellParts;
  /** The phone's detail line (division · team · fee · sub-line). */
  phoneLine: string;
  primary: RowActionKey | null;
  primaryLabel: string | null;
  /** A press on this row is in flight. */
  busy: boolean;
  /** Everything else, for the desk's popover. */
  menu: MenuItem[];
  /** Everything, for the phone's sheet (the primary included). */
  sheet: MenuItem[];
  sheetSub: string;
  note: RowNote | null;
}

type Handlers = {
  isPhone: boolean;
  selectable: boolean;
  selected: ReadonlySet<string>;
  onToggle: (id: string) => void;
  onOpen: (id: string) => void;
  onPrimary: (row: RegRowModel) => void;
  onPick: (row: RegRowModel, key: RowActionKey) => void;
  onNote: (row: RegRowModel, key: 'waitlist') => void;
  /** 12c: the desk's door from a refund the card sent back (the Fee cell's amber pill). Absent for a reader without it. */
  onAlert?: (row: RegRowModel, refundId: string) => void;
};

export function Note({ row, onNote }: { row: RegRowModel; onNote: Handlers['onNote'] }) {
  if (!row.note) return null;
  return (
    <span className={css.rowNote} role="status">
      {row.note.text}
      {row.note.offer && (
        <>{' '}<button type="button" className={css.rowNoteOffer} onClick={e => { e.stopPropagation(); onNote(row, row.note!.offer!.key); }}>{row.note.offer.label}</button></>
      )}
    </span>
  );
}

/** A long press selects (the phone's second way in; the tick is the first). */
function useLongPress(onLong: () => void, enabled: boolean) {
  const timer = useRef<number | null>(null);
  const fired = useRef(false);
  const clear = () => { if (timer.current != null) { window.clearTimeout(timer.current); timer.current = null; } };
  useEffect(() => clear, []);
  return {
    onPointerDown: () => {
      if (!enabled) return;
      fired.current = false;
      clear();
      timer.current = window.setTimeout(() => { fired.current = true; timer.current = null; onLong(); }, 500);
    },
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
    onPointerMove: clear,
    /** True once, right after a long press fired: the click that follows must not also open the record. */
    consumed: () => { const was = fired.current; fired.current = false; return was; },
  };
}

function PhoneRow({ row, h }: { row: RegRowModel; h: Handlers }) {
  const press = useLongPress(() => h.onToggle(row.reg.id), h.selectable);
  const on = h.selected.has(row.reg.id);
  return (
    <li className={`${repKit.rowItem} ${css.pRow}`} data-row-list-row data-selected={on || undefined}>
      {h.selectable && (
        <label className={css.pTick}>
          <input type="checkbox" className={screenParts.check22} checked={on} onChange={() => h.onToggle(row.reg.id)} aria-label={REGS_WORDS.selectRow(row.name)} />
        </label>
      )}
      <button
        type="button"
        className={css.pMain}
        aria-haspopup="dialog"
        aria-label={REGS_WORDS.record.aria(row.name)}
        onPointerDown={press.onPointerDown}
        onPointerUp={press.onPointerUp}
        onPointerLeave={press.onPointerLeave}
        onPointerCancel={press.onPointerCancel}
        onPointerMove={press.onPointerMove}
        onContextMenu={e => { if (h.selectable) e.preventDefault(); }}
        onClick={() => { if (!press.consumed()) h.onOpen(row.reg.id); }}
      >
        <span className={css.pName}>
          {row.name}
          {row.reg.status === 'waitlisted' && row.reg.waitlistPosition != null && <RepChip>{REGS_WORDS.waitingPosition(row.reg.waitlistPosition)}</RepChip>}
        </span>
        <span className={css.pDetail}>{row.phoneLine}</span>
        <span className={css.pSub}>{row.playerSub}</span>
        {row.fee.third && <span className={css.pSub} title={row.fee.third.tip}>{row.fee.third.text}</span>}
      </button>
      <span className={css.pMore}>
        <RowMenu name={row.name} sub={row.sheetSub} items={row.sheet} isPhone onPick={key => h.onPick(row, key)} />
      </span>
      {(row.primary || row.note) && (
        <span className={css.pLow}>
          {row.primary && row.primaryLabel && <RowAction disabled={row.busy} onClick={() => h.onPrimary(row)}>{row.primaryLabel}</RowAction>}
          <Note row={row} onNote={h.onNote} />
        </span>
      )}
    </li>
  );
}

function Check({ allOn, someOn, onChange, label }: { allOn: boolean; someOn: boolean; onChange: () => void; label: string }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (ref.current) ref.current.indeterminate = someOn && !allOn; }, [someOn, allOn]);
  return <input ref={ref} type="checkbox" className={screenParts.check22} checked={allOn} onChange={onChange} aria-label={label} />;
}

export default function RegistrationsList({
  rows, showFee, onSelectAll, hidden, onMore, ...h
}: Handlers & {
  rows: readonly RegRowModel[];
  showFee: boolean;
  onSelectAll: () => void;
  /** How many more rows the list holds than are drawn, and the press that draws the next page. */
  hidden: number;
  onMore: () => void;
}) {
  const more = hidden > 0 ? (
    <button type="button" className={css.moreRow} onClick={onMore}>{REGS_WORDS.more(hidden)}</button>
  ) : null;
  if (h.isPhone) {
    return (
      <ClubRowList label={REGS_WORDS.title}>
        {rows.map(row => <PhoneRow key={row.reg.id} row={row} h={h} />)}
        {more && <li className={repKit.rowItem} data-row-list-row>{more}</li>}
      </ClubRowList>
    );
  }
  const allOn = rows.length > 0 && rows.every(r => h.selected.has(r.reg.id));
  const someOn = rows.some(r => h.selected.has(r.reg.id));
  return (
    <div className={repKit.tableFrame}>
      <table className={repKit.table}>
        <thead>
          <tr>
            {h.selectable && (
              <th scope="col" className={css.tickCol}>
                <Check allOn={allOn} someOn={someOn} onChange={onSelectAll} label={REGS_WORDS.selectAll} />
              </th>
            )}
            <th scope="col">{REGS_WORDS.col.player}</th>
            <th scope="col">{REGS_WORDS.col.division}</th>
            <th scope="col">{REGS_WORDS.col.guardian}</th>
            {showFee && <th scope="col">{REGS_WORDS.col.fee}</th>}
            <th scope="col"><span className={repKit.srOnly}>{REGS_WORDS.col.actions}</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.reg.id} className={repKit.rowOpens} data-selected={h.selected.has(row.reg.id) || undefined}
              onClick={() => { if (window.getSelection()?.toString()) return; h.onOpen(row.reg.id); }}>
              {h.selectable && (
                <td className={css.tickCol} onClick={e => e.stopPropagation()}>
                  <input type="checkbox" className={screenParts.check22} checked={h.selected.has(row.reg.id)}
                    onChange={() => h.onToggle(row.reg.id)} aria-label={REGS_WORDS.selectRow(row.name)} />
                </td>
              )}
              <td>
                <span className={repKit.nameCell}>
                  <button type="button" className={`${repKit.nameButton} ${repKit.nameLink}`} aria-haspopup="dialog"
                    onClick={e => { e.stopPropagation(); h.onOpen(row.reg.id); }}>{row.name}</button>
                  {row.reg.status === 'waitlisted' && row.reg.waitlistPosition != null && <RepChip>{REGS_WORDS.waitingPosition(row.reg.waitlistPosition)}</RepChip>}
                </span>
                <span className={repKit.cellSub}>{row.playerSub}</span>
                <Note row={row} onNote={h.onNote} />
              </td>
              <td>
                {row.division ?? <span className={repKit.dim}>{REGS_WORDS.noDivision}</span>}
                {row.divisionSub && <span className={repKit.cellSub}>{row.divisionSub}</span>}
              </td>
              <td>
                {row.guardian}
                {row.email
                  ? <span className={repKit.cellSub}>{row.email}</span>
                  : <span className={`${repKit.cellSub} ${css.noEmail}`}>{REGS_WORDS.noEmail}</span>}
              </td>
              {showFee && <td><FeeCell parts={row.fee} onAlert={h.onAlert ? id => h.onAlert!(row, id) : undefined} /></td>}
              <td className={css.actionsCol} onClick={e => e.stopPropagation()}>
                <span className={css.actions}>
                  {row.primary && row.primaryLabel && <RowAction disabled={row.busy} onClick={() => h.onPrimary(row)}>{row.primaryLabel}</RowAction>}
                  <RowMenu name={row.name} sub={row.sheetSub} items={row.menu} isPhone={false} onPick={key => h.onPick(row, key)} />
                </span>
              </td>
            </tr>
          ))}
          {more && <tr><td colSpan={4 + (h.selectable ? 1 : 0) + (showFee ? 1 : 0)}>{more}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
