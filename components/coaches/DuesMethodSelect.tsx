'use client';
/**
 * The dues-method dropdown — ONE renderer for the product's one method list (owner ruling
 * 2026-08-22, mig 260: E-Transfer · Cash · Cheque · Card · Other).
 *
 * The label map was centralized into `DUES_PAYMENT_METHOD_LABEL` the day `card` joined; this
 * finishes the job one level up — the `<select>` itself was still copy-pasted in the payout
 * sheet, the dues panel and the recording conversation, so a rendering change (ordering, a
 * disabled state) needed three edits (/simplify, 2026-08-23). Free-text surfaces (costs,
 * payments) deliberately do NOT use this: their control is the suggestions combobox.
 */
import { DUES_PAYMENT_METHODS, DUES_PAYMENT_METHOD_LABEL, type DuesPaymentMethod } from '@/lib/types';

export default function DuesMethodSelect({
  value,
  onChange,
  className,
}: {
  value: DuesPaymentMethod;
  onChange: (next: DuesPaymentMethod) => void;
  /** The host form's own select class — this component owns the options, not the skin. */
  className?: string;
}) {
  return (
    <select
      className={className}
      value={value}
      onChange={e => onChange(e.target.value as DuesPaymentMethod)}
    >
      {DUES_PAYMENT_METHODS.map(m => (
        <option key={m} value={m}>{DUES_PAYMENT_METHOD_LABEL[m]}</option>
      ))}
    </select>
  );
}
