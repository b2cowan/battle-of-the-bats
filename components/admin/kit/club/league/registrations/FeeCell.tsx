'use client';
/**
 * THE FEE CELL (Club Tier Stage 9b-2, Part 3; copy §1.3). One primary line and one quiet sub-line, read from the one money
 * function (`feeCell` → `feeState`): green once received, amber ONLY when the owing clock is at or past the club's
 * threshold, plain otherwise. A corrected price adds a third line whose hover and tap text is the whole record.
 */
import { useState } from 'react';
import type { FeeCellParts } from '@/lib/house-league-registrations';
import css from './Registrations.module.css';

export default function FeeCell({ parts }: { parts: FeeCellParts }) {
  const [tipOpen, setTipOpen] = useState(false);
  if (!parts.primary && !parts.corrected) return <span className={css.feeNone}>—</span>;
  const pill = parts.tone === 'good' ? `${css.feePill} ${css.feeGood}` : parts.tone === 'warn' ? `${css.feePill} ${css.feeWarn}` : null;
  return (
    <span className={css.fee}>
      {parts.primary && <span className={pill ?? css.feePlain}>{parts.primary}</span>}
      {parts.sub && <span className={css.feeSub}>{parts.sub}</span>}
      {parts.corrected && (
        <button
          type="button"
          className={css.feeCorrected}
          title={parts.corrected.tip}
          aria-expanded={tipOpen}
          onClick={e => { e.stopPropagation(); setTipOpen(o => !o); }}
        >
          {parts.corrected.text}
        </button>
      )}
      {parts.corrected && tipOpen && <span className={css.feeTip}>{parts.corrected.tip}</span>}
    </span>
  );
}
