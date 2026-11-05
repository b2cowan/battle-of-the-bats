'use client';
/**
 * THE BANK TAB ON A PHONE (Bank reconciliation R2d — 390; drawings C1–C5 and C10 at phone width, Ask 5 A). The desk's
 * tables become ONE column of rows (the drawn "phone tick rows"): the tick at the left (a 44px target), the line's words
 * with its date and book under them, the amount at the right with its direction as a sign. The WHOLE row is the tick
 * (one-hand ticking); a row's own action ("Didn't go through the bank") sits under its words, 44px, since a phone has
 * no pointer to show it on. A list whose STRUCTURE differs from the grid it replaces, so the screens choose it with
 * `useIsPhone` (the hook's own rule), not the stylesheet.
 * ⚖ A row that cannot be ticked (a reader, a checked statement, B7) has no checkbox and no click — absent, not disabled.
 */
import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { BANK_WORDS as W } from '@/lib/bank-tab-words';
import s from './Bank.module.css';

export function PhoneRow({ ticked, tickable, busy, label, what, sub, amount, moneyIn, lead, end, children, below, onTick }: {
  ticked: boolean;
  /** The row ticks (the member can move money and the statement is open). */
  tickable: boolean;
  busy?: boolean;
  /** The checkbox's name ("Tick Bake sale, $184.50"); a row that can't be ticked has none. */
  label?: string;
  what: ReactNode;
  sub?: ReactNode;
  /** Already signed (`W.signed`). */
  amount: string;
  moneyIn?: boolean;
  /** In place of the tick: a typed line's remove button. */
  lead?: ReactNode;
  /** After the amount: a payout's opener. */
  end?: ReactNode;
  /** Under the words: the row's own action. */
  children?: ReactNode;
  /** Under the whole row, its full width (an opened payout's lines and gap). A tap in it is not a tick. */
  below?: ReactNode;
  onTick?: (ticked: boolean) => void;
}) {
  const live = tickable && !busy && !!onTick;
  return (
    <li className={`${s.pRow}${tickable ? ` ${s.pTicks}` : ''}${ticked ? ` ${s.pTicked}` : ''}`}
      onClick={live ? () => onTick(!ticked) : undefined}>
      <span className={s.pTick}>
        {lead ?? (tickable ? (
          <input type="checkbox" checked={ticked} disabled={busy} aria-label={label}
            onClick={e => e.stopPropagation()} onChange={() => onTick?.(!ticked)} />
        ) : ticked ? <Check size={16} aria-label={W.tickedMark} className={s.tickedMark} /> : null)}
      </span>
      <span className={s.pText}>
        <span className={s.pWhat}>{what}</span>
        {sub && <span className={s.pSub}>{sub}</span>}
        {children}
      </span>
      <span className={`${s.pAmount}${moneyIn ? ` ${s.moneyIn}` : ''}`}>{amount}</span>
      {end}
      {below && <span className={s.pBelow} onClick={e => e.stopPropagation()}>{below}</span>}
    </li>
  );
}

/** "Oct 18 · General" — the parts present, joined. */
export const subLine = (...parts: (string | null | undefined | false)[]): string => parts.filter(Boolean).join(' · ');
