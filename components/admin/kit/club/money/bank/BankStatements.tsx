'use client';
/**
 * "CHECKED STATEMENTS" — the account's saved checks (Bank balance check BC1; drawing BANK_BALANCE_CHECK_DRAWINGS.html
 * tab 5, plan §6). Newest first, ending with the starting statement (greyed, "Starting point", no result). Each row is a
 * saved check's OWN figures: The bank said · Should have been · Result ("Matches", "Off by $X" amber, never red) and "Books
 * now say $X" when the books have changed since (ask 6, derived on the server). Who checked it and when.
 * ⚖ BC1 draws the list only: the check form above it, the opened window, Delete and "Check this statement again" are BC2.
 * ON A PHONE: the list is cards, the drawing's white row cards.
 */
import type { ReactNode } from 'react';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import { ClubRow, ClubRowList, RepChip, repKit } from '../../RepKit';
import ck from '../../ClubKit.module.css';
import { BANK_WORDS as W } from '@/lib/bank-tab-words';
import { cents, dayYear, throughWords, type AccountView, type SavedCheckView } from './BankShared';
import s from './Bank.module.css';

export default function BankStatements({ view, accountLine, tools }: {
  view: AccountView;
  /** The account's own controls beside its line (the Account pill, at a second account). */
  accountLine: ReactNode;
  /** The account's quiet doors (Add an account, Name and books), at the end of the line. */
  tools?: ReactNode;
}) {
  const isPhone = useIsPhone();
  const start = view.start;

  return (
    <>
      <div className={s.top}>
        <div className={s.statusLine}>
          {accountLine}
          <span><b>{view.account.name}</b> · {throughWords(view.checkedThrough)}</span>
          {tools}
        </div>
      </div>

      <h2 className={s.listTitle}>{W.listTitle}</h2>
      {isPhone ? (
        <ClubRowList label={W.listTitle}>
          {view.checks.map(c => (
            <ClubRow key={c.id} title={W.cardTitle(dayYear(c.date), cents(c.bankCents))}
              caption={<>
                <span className={s.cardLine}><Result c={c} /></span>
                {c.checkedBy && <span className={s.cardLine}>{W.checkedCell(c.checkedBy, dayYear(c.checkedAt))}</span>}
              </>} />
          ))}
          {start && (
            <li className={s.pHead}>
              <span>{W.cardTitle(dayYear(start.date), cents(start.bankCents))}</span>
              <span>{W.startingPoint}</span>
            </li>
          )}
        </ClubRowList>
      ) : (
        <div className={repKit.tableFrame}>
          <table className={repKit.table}>
            <thead>
              <tr>
                <th scope="col">{W.listCol.date}</th>
                <th scope="col" className={repKit.num}>{W.listCol.bankSaid}</th>
                <th scope="col" className={repKit.num}>{W.listCol.shouldHave}</th>
                <th scope="col">{W.listCol.result}</th>
                <th scope="col">{W.listCol.checkedBy}</th>
              </tr>
            </thead>
            <tbody>
              {view.checks.map(c => (
                <tr key={c.id}>
                  <td className={s.nowrap}>{dayYear(c.date)}</td>
                  <td className={repKit.num}>{cents(c.bankCents)}</td>
                  <td className={repKit.num}>{cents(c.figure.shouldBeCents)}</td>
                  <td><Result c={c} /></td>
                  <td>{W.checkedCell(c.checkedBy, dayYear(c.checkedAt))}</td>
                </tr>
              ))}
              {start && (
                <tr className={s.balanceRow}>
                  <td className={s.nowrap}>{dayYear(start.date)}</td>
                  <td className={repKit.num}>{cents(start.bankCents)}</td>
                  <td className={repKit.num}>—</td>
                  <td>{W.startingPoint}</td>
                  <td>{W.checkedCell(start.checkedBy, dayYear(start.checkedAt))}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {view.checks.length === 0 && <p className={`${ck.hint} ${s.listHint}`}>{W.noChecksYet}</p>}
    </>
  );
}

/** "Matches" · "Matches · 1 cheque not in the bank yet" · amber "Off by $X" · amber "Books now say $X" (tab 5). */
function Result({ c }: { c: SavedCheckView }) {
  const waiting = c.waiting.length;
  return (
    <span className={s.resultCell}>
      {c.figure.result === 'matches'
        ? <span>{waiting ? W.matchesWaiting(waiting) : W.matches}</span>
        : <RepChip tone="warn">{W.offBy(cents(c.figure.offByCents))}</RepChip>}
      {c.booksNowSayCents !== null && <RepChip tone="warn">{W.booksNowSay(cents(c.booksNowSayCents))}</RepChip>}
    </span>
  );
}
