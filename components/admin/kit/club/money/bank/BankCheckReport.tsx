'use client';
/**
 * THE PRINTED BANK CHECK (Bank balance check BC5b; ask 9, R0 tab 9 re-worded by plan §6; owner "Report door / books
 * changed / order / extras" 2026-11-06). One US Letter page from a SAVED check, in the shipped `PrintedPage` frame (a copy
 * on <body>, hidden on screen; in print only it reaches the paper). Mounted by the opened check's window
 * (`BankCheckWindow`), whose "Print this check" calls `window.print()`.
 *
 *   {club} · Bank check                                   the eyebrow
 *   {account} · statement ending {date}                   the title
 *   Books in this account: General · House league …       the check's OWN saved books, by name
 *   Bank balance on the statement ............ $X         BANK FIRST, as the association's monthly form runs
 *   Not in the bank yet: Date | What | Amount              each item moving the bank its own line's way
 *   Online payments on their way ............. + $Y        or "not counted"
 *   What your books should say ............... $T         the rule-off
 *   Your books on {date} ..................... $B         Starting point {date} {balance} + book movement since {M}
 *   Result ................................... Matches | Off by $X, and the direction in words
 *   Checked by {name} ({role}), {date} at {time}           the clock only through `formatTime`
 *   Books now say $X. {why}                                 when it applies, as the window says it
 *   Prepared by · Date        Reviewed by · Date            the two signature lines (R0 ask 14)
 *   Printed {date} from FieldLogicHQ · {club} · Accounting → Bank
 *
 * ⚖ NO ARITHMETIC HERE: the lines, their signs and the total are the engine's (`reportTerms`), the starting point is
 *   `startingPoint`, the result is the saved figure's. This only names and lays them out.
 * ⚖ Doesn't carry an account number, a full line listing or Budget vs. Actual figures (R0 tab 9), nor a Book column
 *   (owner "Report extras": a saved item doesn't keep its book).
 */
import PrintedPage from '@/components/admin/tournament/PrintedPage';
import { useOrg } from '@/lib/org-context';
import { formatTime } from '@/lib/utils';
import { tournamentToday, utcToZonedInputs } from '@/lib/timezone';
import { BANK_WORDS as W } from '@/lib/bank-tab-words';
import { checkingStartsOn, reportTerms, startingPoint, type SavedTerm } from '@/lib/bank-check';
import { cents, dayYear, moved, type AccountView, type SavedCheckView } from './BankShared';
import r from './BankReport.module.css';

export default function BankCheckReport({ view, check }: { view: AccountView; check: SavedCheckView }) {
  const club = useOrg().currentOrg?.name ?? '';
  const when = dayYear(check.date);
  const { terms, totalCents } = reportTerms(check);
  const items = terms.filter((t): t is Extract<SavedTerm, { kind: 'waiting' }> => t.kind === 'waiting');
  const start = startingPoint(check, view.start, check.startCorrected);
  const at = utcToZonedInputs(check.checkedAt);
  const f = check.figure;
  const off = cents(f.offByCents);

  return (
    <PrintedPage
      name="bank-check"
      eyebrow={W.reportEyebrow(club)}
      title={W.reportTitle(view.account.name, when)}
      dates={check.bookNames.length > 0 ? W.reportBooks(check.bookNames) : null}
      foot={<span>{W.reportFoot(dayYear(tournamentToday()), club)}</span>}
    >
      <table className={r.sums}>
        <tbody>
          {terms.map(t => {
            switch (t.kind) {
              case 'base': return <SumRow key={t.key} label={W.reportBank} amount={cents(t.cents)} />;
              case 'onItsWay': return t.cents === null
                ? <SumRow key={t.key} label={W.reportOnItsWay} amount={W.notCounted} note={W.savedNotCountedNote} />
                : <SumRow key={t.key} label={W.reportOnItsWay} amount={moved(t.cents)} />;
              case 'cash': return <SumRow key={t.key} label={W.savedCash} amount={moved(t.cents)} />;
              // The engine lists the items straight after the bank: one table, where the first of them stands.
              case 'waiting': return t === items[0] ? <ItemsRow key="waiting" items={items} /> : null;
            }
          })}
          <SumRow label={W.reportShould} amount={cents(totalCents)} total />
          <SumRow label={W.reportBooksOn(when)} amount={cents(check.booksCents)}
            note={start ? W.reportStartingPoint(dayYear(checkingStartsOn(start.date)), cents(start.cents), moved(start.sinceCents)) : undefined} />
          <SumRow label={W.reportResult} amount={f.result === 'matches' ? W.matches : W.offBy(off)} result
            note={f.direction === 'bank_more' ? W.bandBankMore(off) : f.direction === 'bank_less' ? W.bandBankLess(off) : undefined} />
        </tbody>
      </table>
      <p className={r.line}>{W.reportCheckedBy(check.checkedBy, check.checkedByRole, dayYear(at.date), formatTime(at.time))}</p>
      {check.booksNowSayCents !== null && (
        <p className={r.line}><b>{W.booksNowSay(cents(check.booksNowSayCents))}.</b>{' '}
          {check.startCorrected ? W.booksNowSayStartWhy : W.booksNowSayWhy(when)}</p>
      )}
      <div className={r.signs}>
        {[W.reportPrepared, W.reportReviewed].map(who => (
          <div key={who} className={r.sign}>
            <span className={r.signLine}>{who}</span>
            <span className={r.signLine}>{W.reportDate}</span>
          </div>
        ))}
      </div>
    </PrintedPage>
  );
}

/** "Not in the bank yet": Date | What | Amount, each signed the way it moves the bank (the engine's). */
function ItemsRow({ items }: { items: readonly Extract<SavedTerm, { kind: 'waiting' }>[] }) {
  return (
    <tr>
      <td colSpan={2} className={r.itemsCell}>
        <p className={r.itemsHead}>{W.reportWaitingHead}</p>
        <table className={r.items}>
          <thead>
            <tr>
              <th scope="col">{W.reportWaitingCol.date}</th>
              <th scope="col">{W.reportWaitingCol.what}</th>
              <th scope="col" className={r.num}>{W.reportWaitingCol.amount}</th>
            </tr>
          </thead>
          <tbody>
            {items.map(i => (
              <tr key={i.key}>
                <td className={r.date}>{dayYear(i.item.date)}</td>
                <td>{i.item.label ?? ''}</td>
                <td className={r.num}>{moved(i.cents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </td>
    </tr>
  );
}

function SumRow({ label, amount, note, total = false, result = false }: {
  label: string; amount: string; note?: string; total?: boolean; result?: boolean;
}) {
  return (
    <tr className={total ? r.total : result ? r.result : undefined}>
      <th scope="row">{label}{note && <span className={r.note}>{note}</span>}</th>
      <td className={r.num}>{amount}</td>
    </tr>
  );
}
