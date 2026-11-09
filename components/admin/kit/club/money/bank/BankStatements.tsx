'use client';
/**
 * "CHECKED STATEMENTS" — the account's saved checks (Bank balance check BC1, doors BC2b; drawing BANK_BALANCE_CHECK_DRAWINGS.html
 * tab 5, plan §6). Newest first, ending with the starting statement (greyed, "Starting point"). Each row is a saved check's
 * OWN figures: The bank said · Should have been · Result ("Matches", "Off by $X" amber, never red) and "Books now say $X"
 * when the books have changed since (ask 6, derived on the server). Who checked it and when.
 * ⚖ EVERY ROW OPENS its check (`onOpen`): the row is the door, the date is the keyboard's (a button named for the check it
 *   opens), the chevron the row's promise — the kit's table door (`rowOpens`, `nameButton`, `go`). So a chip in a row opens
 *   too: every highlight is clickable. The starting statement opens as well (owner 2026-11-06, BC2b ask 2), so a mistyped
 *   start can be deleted.
 * ⚖ A start saved while Stripe didn't answer (`onItsWayCents` NULL, BC2a's "Start anyway") says so in its row, so a later
 *   "Off by" has its reason on screen.
 * ⚖ The top line (tab 2, ask 4): "Checked through {date}", with the amber "Off by $X" chip beside it when the latest is off.
 * ⚖ The check form sits above the list (BC2a, passed in as `form`).
 * ON A PHONE: the list is the kit's white row cards, each a button that opens the check.
 */
import type { ReactNode } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import { ClubRow, ClubRowList, RepChip, repKit } from '../../RepKit';
import ck from '../../ClubKit.module.css';
import { BANK_WORDS as W } from '@/lib/bank-tab-words';
import { cents, dayYear, type AccountView, type SavedCheckView } from './BankShared';
import { checkingStartsOn } from '@/lib/bank-check';
import s from './Bank.module.css';

export default function BankStatements({ view, accountLine, tools, helpHref, form, onOpen }: {
  view: AccountView;
  /** The bank guide (bank check S2, row 20): "How the bank check works", a quiet link at the line's end, for every role. */
  helpHref?: string;
  /** The check form, above the saved checks (ask 10): a writer's only. */
  form?: ReactNode;
  /** The account's own control in its line (the Account pill, at a second account); its name in bold otherwise. */
  accountLine: ReactNode;
  /** The account's quiet doors (Add an account, Name and books), at the end of the line. */
  tools?: ReactNode;
  /** Opens a saved check (or the starting statement) in its window. */
  onOpen: (checkId: string) => void;
}) {
  const isPhone = useIsPhone();
  const start = view.start;
  const through = view.checkedThrough;
  const startQuiet = start && start.onItsWayCents === null ? W.startNotCounted : null;
  const startResult = <>{W.startingPoint}{startQuiet && <span className={s.startQuiet}> · {startQuiet}</span>}</>;

  return (
    <>
      <div className={s.top}>
        <div className={s.statusLine}>
          {accountLine ?? <b>{view.account.name}</b>}
          {through ? (
            <span className={s.through}>
              <span>{W.checkedThroughLead} <b>{dayYear(through.date)}</b></span>
              {/* Every highlight opens: the chip is a door to the latest check (the newest row). */}
              {through.result === 'off' && view.checks[0] && (
                <button type="button" className={s.chipDoor} aria-label={W.openOffCheck(cents(through.offByCents), dayYear(through.date))} onClick={() => onOpen(view.checks[0].id)}>
                  <RepChip tone="warn">{W.offBy(cents(through.offByCents))}</RepChip>
                </button>
              )}
            </span>
          ) : <span>{W.notCheckedLead}</span>}
          {tools}
          {helpHref && <Link href={helpHref} className={s.link}>{W.helpLink}</Link>}
        </div>
      </div>

      {form}

      <h2 className={s.listTitle}>{W.listTitle}</h2>
      {isPhone ? (
        <ClubRowList label={W.listTitle}>
          {view.checks.map(c => (
            <ClubRow key={c.id} as="button" chevron onClick={() => onOpen(c.id)}
              title={W.cardTitle(dayYear(c.date), cents(c.bankCents))}
              caption={<>
                <span className={s.cardLine}><Result c={c} /></span>
                <span className={s.cardLine}>{W.checkedCell(c.checkedBy, dayYear(c.checkedAt))}</span>
              </>} />
          ))}
          {start && (
            <ClubRow key={start.id} as="button" chevron muted onClick={() => onOpen(start.id)}
              title={W.cardTitle(dayYear(checkingStartsOn(start.date)), cents(start.bankCents))}
              caption={<>
                <span className={s.cardLine}>{startResult}</span>
                <span className={s.cardLine}>{W.checkedCell(start.checkedBy, dayYear(start.checkedAt))}</span>
              </>} />
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
                <th scope="col" className={repKit.go} aria-label={W.listCol.open} />
              </tr>
            </thead>
            <tbody>
              {view.checks.map(c => (
                <tr key={c.id} className={repKit.rowOpens} onClick={() => opened(onOpen, c.id)}>
                  <td className={s.nowrap}><DateDoor c={c} onOpen={onOpen} /></td>
                  <td className={repKit.num}>{cents(c.bankCents)}</td>
                  <td className={repKit.num}>{cents(c.figure.shouldBeCents)}</td>
                  <td><Result c={c} /></td>
                  <td>{W.checkedCell(c.checkedBy, dayYear(c.checkedAt))}</td>
                  <td className={repKit.go}><span className={repKit.goLink} aria-hidden><ChevronRight size={16} /></span></td>
                </tr>
              ))}
              {start && (
                <tr className={`${repKit.rowOpens} ${s.balanceRow}`} onClick={() => opened(onOpen, start.id)}>
                  <td className={s.nowrap}><DateDoor c={start} isStart onOpen={onOpen} /></td>
                  <td className={repKit.num}>{cents(start.bankCents)}</td>
                  <td className={repKit.num}>—</td>
                  <td>{startResult}</td>
                  <td>{W.checkedCell(start.checkedBy, dayYear(start.checkedAt))}</td>
                  <td className={repKit.go}><span className={repKit.goLink} aria-hidden><ChevronRight size={16} /></span></td>
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

/** A row opens from anywhere, except while its text is being selected (the kit's rule). */
function opened(onOpen: (id: string) => void, id: string) {
  if (window.getSelection()?.toString()) return;
  onOpen(id);
}

/** The row's keyboard door: its date, a button named for the check (or the starting statement) it opens. */
function DateDoor({ c, isStart, onOpen }: { c: SavedCheckView; isStart?: boolean; onOpen: (id: string) => void }) {
  // The start shows the day checking starts (owner 2026-11-08), never the stored day before it.
  const shown = dayYear(isStart ? checkingStartsOn(c.date) : c.date);
  return (
    <button type="button" className={`${repKit.nameButton} ${repKit.nameLink}`} aria-label={(isStart ? W.openStart : W.openCheck)(shown)}
      onClick={e => { e.stopPropagation(); onOpen(c.id); }}>
      {shown}
    </button>
  );
}

/** "Matches" · "Matches · 1 line not in the bank yet" · amber "Off by $X" · amber "Books now say $X" (tab 5). */
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
