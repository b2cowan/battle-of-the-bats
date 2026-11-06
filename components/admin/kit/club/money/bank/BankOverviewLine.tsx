'use client';
/**
 * THE ACCOUNTING OVERVIEW'S BANK LINE (Bank balance check BC5a; ask 4, R0 tab 7 "C7 · The Overview line", balance-check
 * drawings tab 5's side frame; owner 2026-11-06 "Overview accounts" and "Overview past year").
 *
 * Right of "Where the club stands" — the heading row, no new row of its own (drawn). One line per live account, in the
 * Bank tab's order, each its own door to the Bank tab on that account:
 *   · "Bank: {account} checked through {date} ›"            — its latest check
 *   · the amber "Off by $X" chip beside it, when that check is off — a door to the check itself, opened on the Bank tab
 *   · "Bank: {account} · not checked yet ›"                 — no check yet (named, or started only)
 *   · "Bank: not checked yet ›"                             — no account yet, for a writer (the Bank tab's first-check card)
 * A reader at a club with no account sees no line: the Bank tab would only tell them to ask the treasurer.
 * ⚖ Never a figure (the drawing): the band below holds the money, and a second balance would read as a competing number.
 * ⚖ TODAY on every year the Year pill shows, as the band beside it is (the server's read names no year).
 * Every figure and date is the server's (`bankMarks`); this formats.
 */
import type { ReactNode } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { RepChip } from '../../RepKit';
import { BANK_WORDS as W } from '@/lib/bank-tab-words';
import type { bankMarks } from '@/lib/bank-club-steps';
import { bankTabHref, cents, dayYear } from './BankShared';
import s from './Bank.module.css';

export type BankMarks = NonNullable<Awaited<ReturnType<typeof bankMarks>>>;

export default function BankOverviewLine({ marks, accountingBase, children }: {
  marks: BankMarks | null;
  accountingBase: string;
  /** The heading the lines sit right of ("Where the club stands · today"). */
  children: ReactNode;
}) {
  const lines = !marks ? [] : marks.accounts.length === 0
    ? (marks.canMove ? [(
        <span key="none" className={s.overviewMark}>
          <Link href={bankTabHref(accountingBase)} className={s.overviewDoor}>
            {W.overviewLead} {W.overviewNoAccount}<ChevronRight size={14} aria-hidden />
          </Link>
        </span>
      )] : [])
    : marks.accounts.map(a => {
        const t = a.checkedThrough;
        return (
          <span key={a.id} className={s.overviewMark}>
            <Link href={bankTabHref(accountingBase, a.id)} className={s.overviewDoor}>
              {W.overviewLead} <b>{a.name}</b>{' '}
              {t ? <>{W.overviewThrough} <b>{dayYear(t.date)}</b></> : W.overviewNotChecked}
              <ChevronRight size={14} aria-hidden />
            </Link>
            {/* Every highlight opens: the chip is a door to the latest check, opened on the Bank tab. */}
            {t?.result === 'off' && (
              <Link href={bankTabHref(accountingBase, a.id, t.id)} className={s.chipDoor}
                aria-label={W.openOffCheck(cents(t.offByCents), dayYear(t.date))}>
                <RepChip tone="warn">{W.offBy(cents(t.offByCents))}</RepChip>
              </Link>
            )}
          </span>
        );
      });

  return (
    <div className={s.overviewHead}>
      {children}
      {lines.length > 0 && <div className={s.overviewMarks}>{lines}</div>}
    </div>
  );
}
