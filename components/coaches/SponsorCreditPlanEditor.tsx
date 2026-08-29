'use client';
/**
 * The credit-family rows (owner ruling Q16, 2026-08-28) — ONE editor for the three doors that
 * take a sponsor's credit plan: the create modal, the sponsor settings sheet, and the recording
 * conversation's sponsor branch.
 *
 * Extracted 2026-08-29 for two reasons at once: the row shipped three times (the drift the
 * shared-component-beats-shared-class rule exists to stop), and its first layout crammed three
 * controls into a strip built for one — the owner met it squished on the §120 walk's first
 * screen. The geometry lives in the module CSS beside this file; the rules live here:
 *
 *  · one empty row is the INVITATION (never zero rows, never an add button on an empty list);
 *  · "+ Add another family" appears only once the last row has a family — the single-family
 *    case looks exactly as it always did;
 *  · a family can be credited once: picked families leave the other rows' dropdowns;
 *  · the cap message (shares past the sponsorship) renders here, under the rows it judges.
 *
 * The CALLER owns the state (each door's discard guard measures it its own way) and whatever
 * extra warnings it computes (the settings sheet's payout-floor names, for example) render
 * after this component, not inside it.
 */
import styles from '../../app/[orgSlug]/coaches/coaches.module.css';
import own from './SponsorCreditPlanEditor.module.css';
import type { CreditUnit } from '@/lib/coach-fundraising';

export interface SponsorCreditPlanRow {
  playerId: string;
  value: string;
  unit: CreditUnit;
}

export default function SponsorCreditPlanEditor({
  rows,
  onChange,
  families,
  defaultShare = '0',
  problem = null,
}: {
  rows: SponsorCreditPlanRow[];
  onChange: (next: SponsorCreditPlanRow[]) => void;
  /** Every creditable family, normalized by the caller — id + display name. */
  families: { id: string; name: string }[];
  /** Pre-fill for a fresh row's share (the team default percent, where the door has one). */
  defaultShare?: string;
  /** The cap sentence (creditPlanProblem) — rendered under the rows it judges, or null. */
  problem?: string | null;
}) {
  // One empty row is the invitation — a caller may hand us an empty array on first render.
  const drawn: SponsorCreditPlanRow[] = rows.length
    ? rows
    : [{ playerId: '', value: defaultShare, unit: 'percent' as CreditUnit }];

  const patch = (i: number, part: Partial<SponsorCreditPlanRow>) =>
    onChange(drawn.map((r, j) => (j === i ? { ...r, ...part } : r)));

  return (
    <>
      {drawn.map((row, i) => (
        <div key={i} className={own.row}>
          <select
            className={`${styles.select} ${own.family}`}
            value={row.playerId}
            aria-label={`Credited family ${i + 1}`}
            onChange={e => patch(i, { playerId: e.target.value })}
          >
            <option value="">{i === 0 ? 'Nobody in particular' : 'Pick a family…'}</option>
            {families
              .filter(f => f.id === row.playerId || !drawn.some(r => r.playerId === f.id))
              .map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
          <div className={own.share}>
            {/* ⚠ The number and its $/% pills are ATTACHED (the unitField idiom): the pills
                deliberately have no left border of their own — the input's edge is it — so they
                must never stand free of it (they shipped borderless for a morning that way,
                owner-caught on the §120 walk). */}
            <div className={styles.unitField}>
              <input
                className={`${styles.input} ${own.shareValue}`}
                type="number"
                min={0}
                step="0.01"
                value={row.value}
                aria-label={`Family ${i + 1} share`}
                onChange={e => patch(i, { value: e.target.value })}
                placeholder="0"
              />
              <div className={styles.unitPick} role="group" aria-label="Share unit">
                {(['amount', 'percent'] as CreditUnit[]).map(u => (
                  <button
                    key={u}
                    type="button"
                    aria-pressed={row.unit === u}
                    className={`${styles.unitBtn} ${row.unit === u ? styles.unitBtnOn : ''}`}
                    onClick={() => patch(i, { unit: u })}
                  >
                    {u === 'amount' ? '$' : '%'}
                  </button>
                ))}
              </div>
            </div>
            {drawn.length > 1 && (
              <button
                type="button"
                className={styles.btnGhost}
                onClick={() => onChange(drawn.filter((_, j) => j !== i))}
                aria-label={`Remove family ${i + 1}`}
              >
                ✕
              </button>
            )}
          </div>
        </div>
      ))}
      {drawn[drawn.length - 1]?.playerId && (
        <button
          type="button"
          className={`${styles.linkBtn} ${own.addBtn}`}
          onClick={() => onChange([...drawn, { playerId: '', value: defaultShare, unit: 'percent' as CreditUnit }])}
        >
          + Add another family
        </button>
      )}
      {problem && (
        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--danger)' }}>{problem}</p>
      )}
    </>
  );
}
