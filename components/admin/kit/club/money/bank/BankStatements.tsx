'use client';
/**
 * C4 · "WHAT HAVE I CHECKED?" and C5 · "SOMEONE CHANGED A LINE I'D CHECKED" (Bank reconciliation R2c). The account's
 * statements, newest first, ending with its starting point; "checked through" above them (B9). A row opens its check
 * (read-only once checked). Undo is on the LATEST checked statement only (B4, Ask 9); after an undo the reopened
 * statement says who undid it and why, and the one before it gains the Undo. A checked statement whose line changed
 * since wears the amber chip on its row and on the account line — the only colour change (C5) — and opens to the line
 * as checked and as now; "Look again" opens it.
 * ⚖ Every write control is ABSENT for a reader (B7). The Report link is R3 (C9), not drawn here yet.
 */
import { Fragment, type ReactNode } from 'react';
import { RepChip, repKit } from '../../RepKit';
import ck from '../../ClubKit.module.css';
import { day } from '../MoneyKit';
import { BANK_WORDS as W } from '@/lib/bank-tab-words';
import { cents, dayYear, rowWhat, stamp, type AccountView, type Summary } from './BankShared';
import s from './Bank.module.css';

export default function BankStatements({ view, canMove, accountLine, tools, onOpen, onStart, onUndo }: {
  view: AccountView;
  canMove: boolean;
  /** The account's own controls beside its line (the Account pill, or the name and "Add an account"). */
  accountLine: ReactNode;
  /** The account's quiet doors (Add an account, Name and books), at the end of the line. */
  tools?: ReactNode;
  onOpen: (checkId: string) => void;
  onStart: () => void;
  onUndo: (summary: Summary) => void;
}) {
  const latestChecked = view.checks.find(c => c.status === 'checked') ?? null;
  const through = view.checkedThrough;
  const setup = view.account.setup;
  const opening = view.openingItems;
  const openingIn = opening.filter(o => o.direction === 'in').reduce((t, o) => t + o.amountCents, 0);
  const openingOut = opening.filter(o => o.direction === 'out').reduce((t, o) => t + o.amountCents, 0);
  const anyOpen = view.checks.some(c => c.status === 'open');
  const changedRow = view.shown && view.shown.status === 'checked' && view.shown.changedSince.length > 0 ? view.shown : null;

  return (
    <>
      <div className={s.top}>
        <div className={s.statusLine}>
          {accountLine}
          {through ? (
            <>
              <RepChip tone={through.changedSince ? 'warn' : 'good'}>{through.changedSince ? W.changedChip : W.checkedChip}</RepChip>
              <span>
                <b>{view.account.name}</b>{through.changedSince ? W.wasCheckedThroughMid : W.checkedThroughMid}<b>{dayYear(through.date)}</b>
                {through.changedSince
                  ? W.changedSinceLine(latestChecked?.changedSinceCount ?? 0)
                  : latestChecked?.checked ? W.checkedBy(latestChecked.checked.byName, dayYear(latestChecked.checked.at)) : ''}
              </span>
            </>
          ) : (
            <span>{W.notCheckedYet(view.account.name)}</span>
          )}
          {tools}
        </div>
        {canMove && view.next?.canStart && (
          <div className={s.topRight}>
            <button type="button" className="btn btn-lime" onClick={onStart}>{W.checkAStatement}</button>
          </div>
        )}
      </div>

      <div className={repKit.tableFrame}>
        <table className={repKit.table}>
          <thead>
            <tr>
              <th scope="col">{W.listCol.ends}</th>
              <th scope="col" className={repKit.num}>{W.listCol.balance}</th>
              <th scope="col" className={repKit.num}>{W.listCol.ticked}</th>
              <th scope="col">{W.listCol.outstanding}</th>
              <th scope="col">{W.listCol.checked}</th>
              <th scope="col" className={s.actionCell}><span className="sr-only">{W.listActions}</span></th>
            </tr>
          </thead>
          <tbody>
            {view.checks.map(c => {
              const isOpen = c.status === 'open';
              const changed = !isOpen && c.changedSinceCount > 0;
              const showUndo = canMove && c.can.undo;
              const out = c.outstandingCount
                ? W.outstandingCell(c.outstandingCount, bothSides(c.outstandingInCents, c.outstandingOutCents)) : null;
              return (
                <Fragment key={c.id}>
                  <tr className={s.rowOpens} onClick={() => onOpen(c.id)}>
                    <td className={s.endCell}>
                      <button type="button" className={s.opener} aria-label={W.open(dayYear(c.statementEndDate))}
                        onClick={e => { e.stopPropagation(); onOpen(c.id); }}>
                        {dayYear(c.statementEndDate)}
                      </button>
                      {isOpen && <> <RepChip tone="info">{W.checkingChip}</RepChip></>}
                      {changed && <> <RepChip tone="warn">{W.changedChip}</RepChip></>}
                    </td>
                    <td className={repKit.num}>{cents(c.statementEndingBalanceCents)}</td>
                    <td className={repKit.num}>{c.tickedCount}</td>
                    <td className={s.nowrap}>{out ?? <span className={repKit.dim}>{W.none}</span>}</td>
                    <td>
                      {isOpen
                        ? c.undone && <span className={s.undoneCell}>{W.undoneCell(c.undone.byName, stamp(c.undone.at), c.undone.reason)}</span>
                        : c.checked && W.checkedCell(c.checked.byName, stamp(c.checked.at))}
                    </td>
                    <td className={s.actionCell} onClick={e => e.stopPropagation()}>
                      <span className={s.actions}>
                        {isOpen && <button type="button" className="btn btn-outline btn-sm" onClick={() => onOpen(c.id)}>{W.continueCheck}</button>}
                        {changed && <button type="button" className="btn btn-outline btn-sm" onClick={() => onOpen(c.id)}>{W.lookAgain}</button>}
                        {showUndo && <button type="button" className="btn btn-outline btn-sm" onClick={() => onUndo(c)}>{W.undo}</button>}
                      </span>
                    </td>
                  </tr>
                  {changed && changedRow?.checkId === c.id && changedRow.changedSince.map(ch => (
                    <tr key={ch.key} className={s.changeRow}>
                      <td colSpan={6}>
                        <span className={s.changeLine}>
                          <span><b>{rowWhat(ch.was)}</b> · {day(ch.was.date)}{changedRow.books[ch.key] ? ` · ${changedRow.books[ch.key]}` : ''}</span>
                          <span>{W.changedWhen(cents(ch.was.amountCents))}</span>
                          <span className={s.changeNow}>{ch.now ? W.changedNow(cents(ch.now.amountCents)) : W.changedGone}</span>
                          {ch.changedAt && <span className={s.changeWho}>{W.changedBy(ch.changedBy, stamp(ch.changedAt))}</span>}
                        </span>
                      </td>
                    </tr>
                  ))}
                </Fragment>
              );
            })}
            {setup && (
              <tr className={s.balanceRow}>
                <td className={s.nowrap}>{W.started(dayYear(setup.openingDate))}</td>
                <td className={repKit.num}>{cents(setup.openingBalanceCents)}</td>
                <td className={repKit.num}>—</td>
                <td className={s.nowrap}>{opening.length
                  ? W.outstandingCell(opening.length, bothSides(openingIn, openingOut))
                  : <span className={repKit.dim}>{W.none}</span>}</td>
                <td />
                <td />
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {view.checks.length > 0 && <p className={`${ck.hint} ${s.listHint}`}>{anyOpen ? W.listHintOpen : W.listHint}</p>}
    </>
  );
}

/** "$450.00" when the money went one way; "$120.00 in, $120.00 out" when both (the drawn coach list's form). */
function bothSides(inC: number, outC: number): string {
  if (inC && outC) return `${W.inSide(cents(inC))}, ${W.outSide(cents(outC))}`;
  return cents(inC || outC);
}
