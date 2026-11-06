'use client';
/**
 * THE CHECK'S FIGURE: the joined band and the sums under it (Bank balance check BC2a; drawing BANK_BALANCE_CHECK_DRAWINGS.html
 * tabs 2 and 6, plan §4 and §6). Pure drawing: every number arrives already figured — the band's from the engine's
 * `figureCheck` (lib/bank-check.ts, the ONE home of the arithmetic), the books and Stripe's on its way from the server's read
 * of the day. This file formats and lays out; it never adds, subtracts or compares money (rule 6).
 * ⚖ The band is the SHIPPED money band, three tiles joined (house rule), "Matches" good-green, "Off by" amber, NEVER red;
 *   a direction is said in words, never a minus sign.
 * ⚖ The sums are always open: Your books (with the book names), Online payments on their way (· n · Show), the total.
 * ⚖ Online-payment lines are SHOWN, not tickable: they are counted in the figure, in one line (ask 8).
 */
import { useState } from 'react';
import Link from 'next/link';
import MoneySummaryBand, { type MoneyTile } from '@/components/coaches/MoneySummaryBand';
import { day } from '../MoneyKit';
import type { CheckFigure } from '@/lib/bank-check';
import { BANK_WORDS as W } from '@/lib/bank-tab-words';
import { cents, dayYear, type Figure } from './BankShared';
import s from './Bank.module.css';

/** The three tiles. `figure` is null until there is a day's books; `typed` false until a balance is typed. */
export function BankBand({ date, figure, typed }: { date: string; figure: CheckFigure | null; typed: boolean }) {
  const when = dayYear(date);
  const settled = figure !== null && typed;
  const diff: MoneyTile = {
    key: 'difference', label: W.bandDifference,
    figure: !settled ? '—' : figure.result === 'matches' ? W.matches : W.offBy(cents(figure.offByCents)),
    tone: !settled ? 'plain' : figure.result === 'matches' ? 'good' : 'warn',
    caption: !settled ? W.bandNoBalance
      : figure.direction === null ? W.bandMatches(when)
        : figure.direction === 'bank_more' ? W.bandBankMore(cents(figure.offByCents)) : W.bandBankLess(cents(figure.offByCents)),
  };
  return (
    <div className={s.bandWrap} aria-live="polite">
      <MoneySummaryBand ariaLabel={W.checkTitle} tiles={[
        { key: 'bank', label: W.bandBank, figure: settled ? cents(figure.bankCents) : '—', caption: W.bandBankCaption(when) },
        { key: 'should', label: W.bandShould, figure: figure ? cents(figure.shouldBeCents) : '—', caption: W.bandShouldCaption(when) },
        diff,
      ]} />
    </div>
  );
}

/** The sums that make "Should be in the bank": always open, one line each. */
export function BankSums({ date, bookNames, booksCents, shouldBeCents, onItsWay, payoutsHref, onRetry }: {
  date: string;
  bookNames: readonly string[];
  booksCents: number;
  shouldBeCents: number;
  onItsWay: Figure['onItsWay'];
  payoutsHref: string;
  /** Asks the server to read Stripe again ("Try again" beside a not-counted line). */
  onRetry: () => void;
}) {
  const [open, setOpen] = useState(false);
  const counted = onItsWay.state === 'counted' && onItsWay.lines.length > 0 ? onItsWay : null;
  return (
    <div className={s.sums} role="group" aria-label={W.sumsTitle}>
      <div className={s.sumRow}>
        <span>{W.sumBooks(dayYear(date))}<span className={s.sumQuiet}> · {bookNames.join(', ')}</span></span>
        <span className={s.sumAmt}>{cents(booksCents)}</span>
      </div>

      {counted && (
        <>
          <div className={s.sumRow}>
            <span>
              {W.sumOnItsWay(counted.lines.length)}
              {counted.paysOutOn && <span className={s.sumQuiet}> · {W.sumPaysOut(dayYear(counted.paysOutOn))}</span>}
              {' '}
              <button type="button" className={s.link} aria-expanded={open} onClick={() => setOpen(o => !o)}>{open ? W.hide : W.show}</button>
            </span>
            <span className={s.sumAmt}>{counted.cents < 0 ? `+ ${cents(Math.abs(counted.cents))}` : `− ${cents(counted.cents)}`}</span>
          </div>
          {open && (
            <div className={s.childBox}>
              <ul className={s.childRows}>
                {counted.lines.map(l => (
                  <li key={l.key} className={s.childRow}>
                    <span>{[day(l.date), l.label, l.rail === 'bank' ? W.railBank : W.railCard, l.bookName].filter(Boolean).join(' · ')}</span>
                    <span className={s.sumAmt}>{l.direction === 'out' ? W.childOut(cents(l.amountCents)) : cents(l.amountCents)}</span>
                  </li>
                ))}
              </ul>
              <p className={s.childFoot}>
                {counted.paysOutOn ? W.childFootPays(dayYear(counted.paysOutOn)) : W.childFootNotYet}
                {' · '}<Link href={payoutsHref} className={s.inlineLink}>{W.payoutsTab}</Link>
              </p>
            </div>
          )}
        </>
      )}

      {onItsWay.state === 'not_counted' && (
        <>
          <div className={s.sumRow}>
            <span>{W.sumOnItsWayNone}</span>
            <span className={`${s.sumAmt} ${s.sumQuiet}`}>{W.notCounted}</span>
          </div>
          <p className={s.sumNotice} role="status">
            {onItsWay.reason === 'stripe_down' ? W.notCountedDown : W.notCountedUnlisted}
            {' '}<button type="button" className={s.link} onClick={onRetry}>{W.tryAgain}</button>
          </p>
        </>
      )}

      <div className={`${s.sumRow} ${s.sumTotal}`}>
        <span>{W.sumShould}</span>
        <span className={s.sumAmt}>{cents(shouldBeCents)}</span>
      </div>
    </div>
  );
}
