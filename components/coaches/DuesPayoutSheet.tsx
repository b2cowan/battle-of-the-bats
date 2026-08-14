'use client';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';
import { fmt } from '@/lib/coach-money-summary';
import type { DuesPaymentMethod } from '@/lib/types';

/**
 * Handing a family cash — the mirror of Record payment: how much, the day it LEFT, how, and a
 * note. ONE sheet, opened from two places that owe a family money for two different reasons:
 *
 *  · the player drawer, paying back a CREDIT (ceiling = what is left of their credits), and
 *  · the season settlement sheet, paying a REFUND (ceiling = what that row says they are owed,
 *    which includes their share of the surplus and so is not a credit figure at all).
 *
 * The ceiling and the sentence above the buttons are the caller's — they are genuinely different
 * questions. Everything else is identical, which is exactly why it is one component: the second
 * copy of a money form is where the two quietly stop agreeing about what a date field means.
 *
 * ⚠ The ceiling here is only the local guard that keeps the button honest. The SERVER owns the
 * real refusal: it re-derives from the database and re-checks after the write, because two
 * clicks racing each other is how a family gets handed the same money twice.
 */

export interface PayoutFormState {
  amount: string;
  paidDate: string;
  method: DuesPaymentMethod;
  note: string;
}

const METHOD_LABELS: Record<DuesPaymentMethod, string> = {
  etransfer: 'E-transfer',
  cash:      'Cash',
  cheque:    'Cheque',
  other:     'Other',
};

export default function DuesPayoutSheet({
  form, onChange, ceiling, overCeilingMessage, consequence,
  error, saving, onCancel, onSubmit, submitLabel = 'Pay out',
}: {
  form: PayoutFormState;
  onChange: (next: PayoutFormState) => void;
  /** The most this sheet may hand over. */
  ceiling: number;
  /** What to say when the coach types more than that. */
  overCeilingMessage: string;
  /** What saving will do, said BEFORE saving — built by the caller from what it knows. */
  consequence: (amount: number) => string;
  error?: string;
  saving?: boolean;
  onCancel: () => void;
  onSubmit: () => void;
  submitLabel?: string;
}) {
  const amount = parseFloat(form.amount) || 0;
  const over = amount > ceiling + 0.005;
  const set = (patch: Partial<PayoutFormState>) => onChange({ ...form, ...patch });

  return (
    <div style={{
      padding: '0.85rem', marginBottom: '1rem',
      background: 'var(--home-card, rgba(255,255,255,0.03))', borderRadius: 8,
      border: '1px solid var(--home-line, rgba(255,255,255,0.08))',
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginBottom: '0.6rem' }}>
        <div>
          <label className={styles.label}>Amount paid out <span className={styles.labelRequired}>*</span></label>
          <input
            className={styles.input}
            type="number" min={0} step="0.01"
            value={form.amount}
            onChange={e => set({ amount: e.target.value })}
          />
        </div>
        <div>
          <label className={styles.label}>Date paid <span className={styles.labelRequired}>*</span></label>
          <input
            className={styles.input}
            type="date"
            value={form.paidDate}
            onChange={e => set({ paidDate: e.target.value })}
          />
        </div>
        <div>
          <label className={styles.label}>Method</label>
          <select
            className={styles.input}
            value={form.method}
            onChange={e => set({ method: e.target.value as DuesPaymentMethod })}
          >
            {(Object.entries(METHOD_LABELS) as [DuesPaymentMethod, string][]).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={styles.label}>Note (optional)</label>
          <input
            className={styles.input}
            type="text"
            placeholder="e.g. sent to Dana"
            value={form.note}
            onChange={e => set({ note: e.target.value })}
          />
        </div>
      </div>
      {/* What it does, BEFORE saving — the consequence a coach would otherwise discover on the
          dues table afterwards. */}
      {amount > 0 && (
        <p style={{
          margin: '0 0 0.6rem', fontSize: '0.78rem',
          color: over ? 'var(--danger-light)' : 'var(--home-dim, rgba(255,255,255,0.55))',
        }}>
          {over ? overCeilingMessage : consequence(amount)}
        </p>
      )}
      {error && (
        <p className={styles.errorText} style={{ margin: '0 0 0.6rem', fontSize: '0.78rem' }}>{error}</p>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
        <button className={styles.btnGhost} onClick={onCancel} /* 44px is the portal's tap floor — quiet by TYPE SIZE, never by tap size (the
             mouse-only exception was rejected once already, in the money-rail pass). */
          style={{ fontSize: '0.78rem', minHeight: 44 }}>Cancel</button>
        <button
          className={styles.btnPrimary}
          disabled={saving || over || amount <= 0}
          onClick={onSubmit}
          /* 44px is the portal's tap floor — quiet by TYPE SIZE, never by tap size (the
             mouse-only exception was rejected once already, in the money-rail pass). */
          style={{ fontSize: '0.78rem', minHeight: 44 }}
        >
          {saving ? 'Recording…' : `${submitLabel}${amount > 0 && !over ? ` ${fmt(amount)}` : ''}`}
        </button>
      </div>
    </div>
  );
}
