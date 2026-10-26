'use client';
/**
 * THE FEE CELL (Club Tier Stage 9b-2, Part 3; copy §1.3). One primary line and one quiet sub-line, read from the one money
 * function (`feeCell` → `feeState`): green once received, amber ONLY when the owing clock is at or past the club's
 * threshold, plain otherwise. A corrected price adds a third line whose hover and tap text is the whole record.
 *
 * 12c (refund visibility, words §1): a refund to the card is on the second line; one the card's bank sent back is an amber
 * pill in the primary line's place, and — for the desk, given `onAlert` — the door to "Record the refund sent another
 * way" (display-only where the reader has no door). The third line also carries a card refund that never entered the book.
 */
import { useState } from 'react';
import type { FeeCellParts } from '@/lib/house-league-registrations';
import css from './Registrations.module.css';

export default function FeeCell({ parts, onAlert }: { parts: FeeCellParts; onAlert?: (refundId: string) => void }) {
  const [tipOpen, setTipOpen] = useState(false);
  const [chipOpen, setChipOpen] = useState(false);
  if (!parts.primary && !parts.alert && !parts.chip && !parts.third) return <span className={css.feeNone}>—</span>;
  const pill = parts.tone === 'good' ? `${css.feePill} ${css.feeGood}` : parts.tone === 'warn' ? `${css.feePill} ${css.feeWarn}` : null;
  const { alert, chip, third } = parts;
  const thirdDoor = third?.refundId && onAlert ? third.refundId : null;
  return (
    <span className={css.fee}>
      {alert && (onAlert
        ? (
          <button type="button" className={`${css.feePill} ${css.feeWarn} ${css.feeAlert}`} title={alert.aria} aria-label={alert.aria}
            onClick={e => { e.stopPropagation(); onAlert(alert.refundId); }}>
            {alert.text}
          </button>
        )
        : <span className={`${css.feePill} ${css.feeWarn}`}>{alert.text}</span>)}
      {/* 12c Part 6: a bank debit on its way — the info chip, its detail on tap (words §3.1). */}
      {chip && (
        <button type="button" className={`${css.feePill} ${css.feeInfo} ${css.feeAlert}`} title={chip.tip} aria-expanded={chipOpen}
          onClick={e => { e.stopPropagation(); setChipOpen(o => !o); }}>
          {chip.text}
        </button>
      )}
      {!alert && !chip && parts.primary && <span className={pill ?? css.feePlain}>{parts.primary}</span>}
      {parts.sub && <span className={css.feeSub}>{parts.sub}</span>}
      {chip && chipOpen && <span className={css.feeTip}>{chip.tip}</span>}
      {third && (
        <button
          type="button"
          className={`${css.feeCorrected}${third.tone === 'warn' ? ` ${css.feeCorrectedWarn}` : ''}`}
          title={third.tip}
          aria-expanded={thirdDoor ? undefined : tipOpen}
          onClick={e => { e.stopPropagation(); if (thirdDoor) onAlert!(thirdDoor); else setTipOpen(o => !o); }}
        >
          {third.text}
        </button>
      )}
      {third && !thirdDoor && tipOpen && <span className={css.feeTip}>{third.tip}</span>}
    </span>
  );
}
