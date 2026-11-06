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
import { Fragment, useState, type ReactNode } from 'react';
import Link from 'next/link';
import MoneySummaryBand, { type MoneyTile } from '@/components/coaches/MoneySummaryBand';
import { day } from '../MoneyKit';
import { onItsWayOnCheck, type CheckFigure } from '@/lib/bank-check';
import { BANK_WORDS as W } from '@/lib/bank-tab-words';
import { cents, dayYear, moved, type Figure } from './BankShared';
import s from './Bank.module.css';

/**
 * The three tiles. `figure` is null until there is a day's books; `typed` false until a balance is typed. `saved`: a saved
 * check's own band, opened (tab 5): The bank said · Should have been · Result, past tense, the direction its only caption.
 */
export function BankBand({ date, figure, typed, saved = false }: {
  date: string; figure: CheckFigure | null; typed: boolean; saved?: boolean;
}) {
  const when = dayYear(date);
  const settled = figure !== null && typed;
  const direction = !settled || figure.direction === null ? null
    : figure.direction === 'bank_more' ? W.bandBankMore(cents(figure.offByCents)) : W.bandBankLess(cents(figure.offByCents));
  const diff: MoneyTile = {
    key: 'difference', label: saved ? W.savedResult : W.bandDifference,
    figure: !settled ? '—' : figure.result === 'matches' ? W.matches : W.offBy(cents(figure.offByCents)),
    tone: !settled ? 'plain' : figure.result === 'matches' ? 'good' : 'warn',
    caption: saved ? direction ?? undefined : !settled ? W.bandNoBalance : direction ?? W.bandMatches(when),
  };
  return (
    <div className={s.bandWrap} aria-live={saved ? undefined : 'polite'}>
      <MoneySummaryBand ariaLabel={saved ? W.savedTitle(when) : W.checkTitle} tiles={[
        { key: 'bank', label: saved ? W.savedBank : W.bandBank, figure: settled ? cents(figure.bankCents) : '—',
          caption: saved ? undefined : W.bandBankCaption(when) },
        { key: 'should', label: saved ? W.savedShould : W.bandShould, figure: figure ? cents(figure.shouldBeCents) : '—',
          caption: saved ? undefined : W.bandShouldCaption(when) },
        diff,
      ]} />
    </div>
  );
}

/** One line of the sums, live or saved: what, and its amount (quiet: "not counted"). */
function SumRow({ label, amount, quiet = false }: { label: ReactNode; amount: ReactNode; quiet?: boolean }) {
  return (
    <div className={s.sumRow}>
      <span>{label}</span>
      <span className={`${s.sumAmt}${quiet ? ` ${s.sumQuiet}` : ''}`}>{amount}</span>
    </div>
  );
}

/** The ruled-off total under the sums. */
function SumTotal({ label, amount }: { label: string; amount: string }) {
  return (
    <div className={`${s.sumRow} ${s.sumTotal}`}>
      <span>{label}</span>
      <span className={s.sumAmt}>{amount}</span>
    </div>
  );
}

/** One line of a saved check's sums: what, and its amount with the way it moved the total ("+ $75.00", "− $412.00"). */
export type SavedSumRow = { key: string; label: string; amount: string; quiet?: boolean; note?: string };

/**
 * A SAVED check's sums (tab 5, the opened check): the lines as they were saved, ruled off by the total. Every row arrives
 * worded and signed (`savedSumRows` in BankCheckWindow, from the engine's `savedTerms`); this only lays them out.
 */
export function BankSavedSums({ rows, totalLabel, totalAmount }: {
  rows: readonly SavedSumRow[]; totalLabel: string; totalAmount: string;
}) {
  return (
    <div className={s.sums} role="group" aria-label={W.sumsTitle}>
      {rows.map(r => (
        <Fragment key={r.key}>
          <SumRow label={r.label} amount={r.amount} quiet={r.quiet} />
          {r.note && <p className={s.sumNotice}>{r.note}</p>}
        </Fragment>
      ))}
      <SumTotal label={totalLabel} amount={totalAmount} />
    </div>
  );
}

/** A line marked Not in the bank yet on the check being typed (BC3a): its words, its signed amount (the engine's
 *  `waitingOnCheck`, formatted by `moved`), and its Undo. */
export type LiveWaitingRow = { key: string; what: string; amount: string; onUndo: () => void };
/** Ask 2: one of the previous check's items, asked once ("Still waiting on {line}?"). Yes carries it; No drops it. */
export type StillWaitingRow = { key: string; what: string; amount: string; onYes: () => void; onNo: () => void };

/** The sums that make "Should be in the bank": always open, one line each. */
export function BankSums({ date, bookNames, booksCents, shouldBeCents, onItsWay, payoutsHref, onRetry, waiting = [], asking = [] }: {
  date: string;
  bookNames: readonly string[];
  booksCents: number;
  shouldBeCents: number;
  onItsWay: Figure['onItsWay'];
  payoutsHref: string;
  /** Asks the server to read Stripe again ("Try again" beside a not-counted line). */
  onRetry: () => void;
  /** The lines marked Not in the bank yet on this check (BC3a), each with Undo. */
  waiting?: readonly LiveWaitingRow[];
  /** The previous check's items not answered yet (ask 2): asked here, never counted until Yes. */
  asking?: readonly StillWaitingRow[];
}) {
  const [open, setOpen] = useState(false);
  const counted = onItsWay.state === 'counted' && onItsWay.lines.length > 0 ? onItsWay : null;
  return (
    <div className={s.sums} role="group" aria-label={W.sumsTitle}>
      <SumRow label={<>{W.sumBooks(dayYear(date))}<span className={s.sumQuiet}> · {bookNames.join(', ')}</span></>} amount={cents(booksCents)} />

      {counted && (
        <>
          <SumRow
            label={<>
              {W.sumOnItsWay(counted.lines.length)}
              {counted.paysOutOn && <span className={s.sumQuiet}> · {W.sumPaysOut(dayYear(counted.paysOutOn))}</span>}
              {' '}
              <button type="button" className={s.link} aria-expanded={open} onClick={() => setOpen(o => !o)}>{open ? W.hide : W.show}</button>
            </>}
            amount={moved(onItsWayOnCheck(counted.cents))} />
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
          <SumRow label={W.sumOnItsWayNone} amount={W.notCounted} quiet />
          <p className={s.sumNotice} role="status">
            {onItsWay.reason === 'stripe_down' ? W.notCountedDown : W.notCountedUnlisted}
            {' '}<button type="button" className={s.link} onClick={onRetry}>{W.tryAgain}</button>
          </p>
        </>
      )}

      {waiting.map(w => (
        <SumRow key={w.key} label={<>
          {W.savedWaiting(w.what)}{' '}
          <button type="button" className={s.link} aria-label={W.undoLine(w.what)} onClick={w.onUndo}>{W.undo}</button>
        </>} amount={w.amount} />
      ))}

      {asking.map(a => (
        <SumRow key={a.key} quiet label={<>
          {W.stillWaiting(a.what)}{' '}
          <span className={s.askActs}>
            <button type="button" className={s.link} aria-label={W.stillYes(a.what)} onClick={a.onYes}>{W.yes}</button>
            <button type="button" className={s.link} aria-label={W.stillNo(a.what)} onClick={a.onNo}>{W.no}</button>
          </span>
        </>} amount={a.amount} />
      ))}

      <SumTotal label={W.sumShould} amount={cents(shouldBeCents)} />
    </div>
  );
}
