'use client';
/**
 * THE TEAM'S PRINTED BANK CHECK (Bank balance check BC8b; K8, R0 tab 9, the club's BC5b report rulings carried: plan §0
 * "Report door / books changed / order / extras", and the team's own "Team report sign lines / role / start line", owner
 * 2026-11-07). One US Letter page from a SAVED check, in the shipped `PrintedPage` frame (a copy on <body>, hidden on
 * screen; in print only it reaches the paper). Mounted by the opened check's window (`CoachBankWindow`), whose "Print this
 * check" calls `window.print()`.
 *
 *   {team} · Bank check                                   the eyebrow
 *   Team bank account · statement ending {date}           the title (a team has one account, its books ARE the Ledger:
 *                                                         no "Books in this account")
 *   Bank balance on the statement ............ $X         BANK FIRST, as the association's monthly form runs
 *   Not in the bank yet: Date | What | Amount              each item moving the bank its own line's way
 *   Cash not deposited yet ................... + $C        when there is any
 *   What your books should say ............... $T         the rule-off
 *   Your books on {date} ..................... $B         no starting-point line (owner: a team has no starting statement)
 *   Result ................................... Matches | Off by $X, and the direction in words
 *   Checked by {name} ({role}), {date} at {time}           the role is the team's staff word today; the clock `formatTime`
 *   Books now say $X. {why}                                 when it applies, as the window says it
 *   Prepared by · Date        Reviewed by · Date            the two signature lines (owner: kept for the team)
 *   Printed {date} from FieldLogicHQ · {team} · Money → Ledger → Bank
 *
 * ⚖ NO ARITHMETIC HERE: the lines, their signs and the total are the engine's (`reportTerms`), the result is the saved
 *   figure's. This only names and lays them out.
 * ⚖ Drops what the club's has and a team hasn't: the books list, the starting point, "Online payments on their way" (B12:
 *   no coach-side Stripe, so a team's check counts none). Never an account number, a line listing or Budget vs. Actual.
 * ⚖ The paper frame is the shipped one (look-free: paper inks fixed, the portal's own type); the sheet's inside is drawn
 *   here, the club's report never imported (plan §0 "Coach sharing").
 */
import PrintedPage from '@/components/admin/tournament/PrintedPage';
import { formatTime } from '@/lib/utils';
import { tournamentToday, utcToZonedInputs } from '@/lib/timezone';
import { BANK_WORDS as W } from '@/lib/bank-tab-words';
import { reportTerms, type SavedTerm } from '@/lib/bank-check';
import { cents, dayYear, moved, nameOf } from '@/lib/bank-screen';
import type { TeamCheck } from './coachBank';
import r from './CoachBankReport.module.css';

type Waiting = Extract<SavedTerm, { kind: 'waiting' }>;

export default function CoachBankReport({ teamName, accountName, check }: {
  teamName: string;
  accountName: string;
  check: TeamCheck;
}) {
  const when = dayYear(check.date);
  const { terms, totalCents } = reportTerms(check);
  const items = terms.filter((t): t is Waiting => t.kind === 'waiting');
  const at = utcToZonedInputs(check.checkedAt);
  const f = check.figure;
  const off = cents(f.offByCents);

  return (
    <PrintedPage
      name="team-bank-check"
      // A team name not at hand (/review BC8b) drops its part, never a bare " · ".
      eyebrow={teamName ? W.reportEyebrow(teamName) : W.coachReportEyebrowBare}
      title={W.reportTitle(accountName, when)}
      foot={<span>{W.coachReportFoot(dayYear(tournamentToday()), teamName)}</span>}
    >
      <table className={r.sums}>
        <tbody>
          {terms.map(t => {
            switch (t.kind) {
              case 'base': return <SumRow key={t.key} label={W.reportBank} amount={cents(t.cents)} />;
              case 'cash': return <SumRow key={t.key} label={W.savedCash} amount={moved(t.cents)} />;
              // The engine lists the items straight after the bank: one table, where the first of them stands.
              case 'waiting': return t === items[0] ? <ItemsRow key="waiting" items={items} /> : null;
              // A team counts no online payments on their way (B12).
              default: return null;
            }
          })}
          <SumRow label={W.reportShould} amount={cents(totalCents)} total />
          <SumRow label={W.reportBooksOn(when)} amount={cents(check.booksCents)} />
          <SumRow label={W.reportResult} amount={f.result === 'matches' ? W.matches : W.offBy(off)} result
            note={f.direction === 'bank_more' ? W.bandBankMore(off) : f.direction === 'bank_less' ? W.bandBankLess(off) : undefined} />
        </tbody>
      </table>
      <p className={r.line}>{W.reportCheckedBy(check.checkedBy, check.checkedByRole, dayYear(at.date), formatTime(at.time))}</p>
      {check.booksNowSayCents !== null && (
        <p className={r.line}><b>{W.booksNowSay(cents(check.booksNowSayCents))}.</b> {W.booksNowSayWhy(when)}</p>
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
function ItemsRow({ items }: { items: readonly Waiting[] }) {
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
                <td>{nameOf(i.item)}</td>
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
