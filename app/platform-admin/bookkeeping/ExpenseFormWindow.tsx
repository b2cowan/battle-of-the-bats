'use client';

import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import KitDialog, { DialogCancel, DialogReason } from '@/components/shared/KitDialog';
import DateInput from '@/components/shared/DateInput';
import { consoleDate } from '@/lib/console-dates';
import {
  CONVERSION_SOURCES, expenseConversionRate, FUTURE_DATE_NOTE, hasConfirmedDates, hasKnownTaxAmount,
  isConversionSource, lastConversionSource, MAX_RECEIPT_BYTES, parseCents, RECEIPT_MESSAGE,
  type ExpenseRevision, type FieldRefusal,
} from '@/lib/bookkeeping-expenses';
import { tournamentToday } from '@/lib/timezone';
import kit from '../console.module.css';
import styles from './bookkeeping.module.css';

const SOURCES = { business_bank: 'Business bank', business_card: 'Business card', personal: 'Paid personally', other: 'Other' };
const dollars = (cents: number) => (cents / 100).toFixed(2);
const ADVANCED_FIELDS = ['taxCadAmount', 'taxStatus', 'businessUsePercent', 'notes'];

export default function ExpenseFormWindow({ expense, expenses, categories, asVoid = false, address, homeAddress, disabled, onClose, onSaved }: {
  expense: ExpenseRevision | null; expenses: ExpenseRevision[]; categories: string[]; asVoid?: boolean;
  address: string; homeAddress: string; disabled: boolean; onClose: () => void;
  onSaved: (saved: ExpenseRevision) => void;
}) {
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<FieldRefusal | null>(null);
  const [currency, setCurrency] = useState(expense?.original_currency ?? 'CAD');
  const [incurredDate, setIncurredDate] = useState(expense?.incurred_date ?? (expense ? '' : tournamentToday()));
  const [paidDate, setPaidDate] = useState(expense?.paid_date ?? (expense ? '' : tournamentToday()));
  const [differentDate, setDifferentDate] = useState(Boolean(expense?.paid_date && expense.incurred_date !== expense.paid_date));
  const [originalAmount, setOriginalAmount] = useState(expense ? dollars(expense.original_cents) : '');
  const [cadAmount, setCadAmount] = useState(expense ? dollars(expense.cad_cents) : '');
  const [paymentSource, setPaymentSource] = useState<string>(expense?.payment_source ?? '');
  const [conversionSource, setConversionSource] = useState<string>(expense?.conversion_source ?? '');
  const [conversionNote, setConversionNote] = useState(isConversionSource(expense?.conversion_source) && expense?.conversion_note === CONVERSION_SOURCES[expense.conversion_source] ? '' : expense?.conversion_note ?? '');
  const [purpose, setPurpose] = useState(expense?.business_purpose ?? '');
  const [category, setCategory] = useState(expense?.category ?? '');
  const [customCategory, setCustomCategory] = useState(false);
  const [more, setMore] = useState(false);
  const [taxKnown, setTaxKnown] = useState(expense ? hasKnownTaxAmount(expense) : false);
  const [taxAmount, setTaxAmount] = useState(expense ? dollars(expense.tax_cad_cents) : '0.00');
  const [taxStatus, setTaxStatus] = useState(expense?.tax_status ?? 'pending');
  const [businessUse, setBusinessUse] = useState(String(expense?.business_use_percent ?? 100));
  const [notes, setNotes] = useState(expense?.notes ?? '');
  const [receipt, setReceipt] = useState<File | null>(null);
  const purposeRef = useRef<HTMLTextAreaElement>(null);
  const rate = expenseConversionRate(parseCents(originalAmount) ?? 0, parseCents(cadAmount) ?? 0);

  useLayoutEffect(() => {
    if (window.location.pathname + window.location.search === address) {
      window.history.replaceState(window.history.state, '', homeAddress);
    }
  }, [address, homeAddress]);
  useLayoutEffect(() => {
    const field = purposeRef.current;
    if (field) { field.style.height = 'auto'; field.style.height = `${field.scrollHeight}px`; }
  }, [purpose]);
  useEffect(() => { if (error?.field) document.getElementById(`bk-${error.field}`)?.focus(); }, [error]);
  const fieldFor = (name: string) => ({ id: `bk-${name}`, ...(error?.field === name
    ? { 'aria-invalid': true as const, 'aria-describedby': 'bk-form-error' } : {}) });
  function refuse(refusal: FieldRefusal) {
    if (refusal.field && ADVANCED_FIELDS.includes(refusal.field)) setMore(true);
    setError(refusal);
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setError(null);
    const form = new FormData(event.currentTarget);
    form.set('incurredDate', incurredDate);
    form.set('paidDate', differentDate ? paidDate : incurredDate);
    form.set('originalCurrency', currency);
    form.set('originalAmount', originalAmount);
    form.set('cadAmount', currency === 'CAD' ? originalAmount : cadAmount);
    form.set('conversionSource', currency === 'USD' ? conversionSource : '');
    if (currency === 'USD') form.set('conversionNote', conversionNote);
    form.set('category', category);
    form.set('paymentSource', paymentSource);
    form.set('taxAmountKnown', String(taxKnown));
    form.set('taxCadAmount', taxKnown ? taxAmount : '0.00');
    form.set('taxStatus', taxKnown ? taxStatus : 'pending');
    form.set('businessUsePercent', businessUse);
    form.set('notes', notes);
    if (receipt) {
      if (receipt.size > MAX_RECEIPT_BYTES) { refuse({ field: 'receipt', error: RECEIPT_MESSAGE }); return; }
      form.set('receipt', receipt);
    } else form.delete('receipt');
    if (expense) { form.set('expenseId', expense.expense_id); form.set('expectedRevision', String(expense.revision)); }
    if (asVoid) form.set('changeReason', String(form.get('voidReason') ?? ''));
    setSaving(true);
    try {
      const response = await fetch('/api/platform-admin/bookkeeping/expenses', { method: 'POST', body: form });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.expense) {
        refuse(typeof body.error === 'string' ? body as FieldRefusal : { error: 'Unable to save expense.' });
        return;
      }
      onSaved(body.expense);
    } catch { refuse({ error: 'Unable to save expense.' }); }
    finally { setSaving(false); }
  }

  return <KitDialog kind="form" size="medium" title={asVoid ? `Void ${expense?.supplier}` : expense ? `Correct ${expense.supplier}` : 'Add an expense'}
    eyebrow={expense ? 'Expenses · correction' : 'Expenses · new'} address={address} dirty={dirty} busy={saving} onClose={onClose}
    footerStart="A missing receipt shows in Needs attention."
    footer={<><DialogCancel className={styles.quietButton} /><button type="submit" form="bk-expense-form" className={styles.primaryAction} disabled={saving || disabled}>
      {saving ? 'Saving…' : asVoid ? 'Confirm void' : expense ? 'Save correction' : 'Save expense'}</button></>}>
    {expense && !hasConfirmedDates(expense) && <p className={styles.dateWarning}>This older entry has a recorded date of {consoleDate(expense.expense_date)}, but its meaning is unconfirmed. Use its receipt or other evidence to confirm both dates when correcting it.</p>}
    <form id="bk-expense-form" className={`${styles.form} ${styles.expenseForm}`} onSubmit={save}
      onChange={() => { setDirty(true); setError(null); }}>
      <div className={styles.pair}>
        <label>Supplier *<input className={kit.field} name="supplier" required maxLength={160} defaultValue={expense?.supplier ?? ''} {...fieldFor('supplier')} /></label>
        <div className={styles.fieldStack}><label>Category *<select className={kit.select} required value={customCategory ? '__custom__' : category} {...fieldFor(customCategory ? 'categoryChoice' : 'category')}
          onChange={event => { setCustomCategory(event.target.value === '__custom__'); setCategory(event.target.value === '__custom__' ? '' : event.target.value); }}>
          <option value="">Choose a category</option>{categories.map(value => <option key={value}>{value}</option>)}<option value="__custom__">+ Add a category</option>
        </select></label>{customCategory && <label>New category<input className={kit.field} required maxLength={80} value={category} {...fieldFor('category')} onChange={event => setCategory(event.target.value)} /></label>}</div>
      </div>
      <label>What was it for? *<textarea ref={purposeRef} className={`${kit.textarea} ${styles.purposeField}`} name="businessPurpose" rows={1} required maxLength={500} value={purpose} {...fieldFor('businessPurpose')} onChange={event => setPurpose(event.target.value)} /></label>
      <div className={styles.pair}>
        <label>Expense date *<DateInput name="incurredDate" required={!asVoid} value={incurredDate} {...fieldFor('incurredDate')}
          onChange={value => { setDirty(true); setIncurredDate(value); if (!differentDate) setPaidDate(value); }} /></label>
        <div className={styles.fieldStack}><label htmlFor="bk-originalAmount">{currency === 'USD' ? 'Receipt shows *' : 'Amount *'}</label>
          <div className={styles.moneyField}><select aria-label="Currency" value={currency} {...fieldFor('originalCurrency')}
            onChange={event => { setCurrency(event.target.value as 'CAD' | 'USD'); if (!conversionSource) setConversionSource(lastConversionSource(expenses, paymentSource)); }}><option>CAD</option><option>USD</option></select>
            <input className={kit.field} inputMode="decimal" required value={originalAmount} {...fieldFor('originalAmount')} onChange={event => setOriginalAmount(event.target.value)} /></div>
        </div>
      </div>
      {incurredDate > tournamentToday() && <p className={styles.hint}>{FUTURE_DATE_NOTE}</p>}
      {currency === 'USD' && <>
        <label>Your card or bank charged (CAD) *<input className={kit.field} inputMode="decimal" required value={cadAmount} {...fieldFor('cadAmount')} onChange={event => setCadAmount(event.target.value)} /></label>
        <div className={styles.fieldStack}><span className={kit.label}>Rate</span><output className={styles.rate} aria-live="polite">{rate ? `1 USD = ${rate >= 0.00005 ? rate.toFixed(4) : rate.toPrecision(4)} CAD from your two amounts` : 'Enter both amounts to see the rate.'}</output></div>
        <label>Where the CAD figure came from *<select className={kit.select} name="conversionSource" required={!asVoid} value={conversionSource} {...fieldFor('conversionSource')} onChange={event => setConversionSource(event.target.value)}>
          <option value="">Choose a source</option>{Object.entries(CONVERSION_SOURCES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Note (optional)<input className={kit.field} name="conversionNote" maxLength={500} value={conversionNote} onChange={event => setConversionNote(event.target.value)} {...fieldFor('conversionNote')} /></label>
      </>}
      <label className={styles.inlineCheck}><input type="checkbox" checked={differentDate} onChange={event => { setDifferentDate(event.target.checked); if (!event.target.checked) setPaidDate(incurredDate); }} />Paid on a different date</label>
      {differentDate && <label>Payment date *<DateInput name="paidDate" required={!asVoid} value={paidDate} {...fieldFor('paidDate')} onChange={value => { setDirty(true); setPaidDate(value); }} /></label>}
      {differentDate && paidDate > tournamentToday() && <p className={styles.hint}>{FUTURE_DATE_NOTE}</p>}
      <div className={styles.pair}>
        <label>How did you pay? *<select className={kit.select} required value={paymentSource} {...fieldFor('paymentSource')} onChange={event => { setPaymentSource(event.target.value); if (!expense || !conversionSource) setConversionSource(lastConversionSource(expenses, event.target.value)); }}>
          <option value="">Choose one</option>{Object.entries(SOURCES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <div className={styles.fieldStack}><span className={kit.label}>Receipt</span>
          <label className={styles.receiptDrop} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); setReceipt(event.dataTransfer.files[0] ?? null); setDirty(true); }}>
            <input name="receipt" type="file" accept="application/pdf,image/jpeg,image/png" {...fieldFor('receipt')} onChange={event => setReceipt(event.target.files?.[0] ?? null)} />
            <span>{receipt ? receipt.name : expense?.receipt_path ? 'Replace receipt' : <><strong>Attach</strong> · or add it later</>}</span>
          </label>
        </div>
      </div>
      <button type="button" className={styles.moreButton} aria-expanded={more} onClick={() => setMore(!more)}>
        <strong>{more ? '▾' : '▸'} More details</strong><span>{taxKnown ? `Tax $${taxAmount}` : 'Tax unknown'} · {businessUse}% business · {notes.trim() ? 'notes added' : 'no notes'}</span>
      </button>
      {more && <div className={styles.advanced}>
        <label className={styles.inlineCheck}><input type="checkbox" checked={taxKnown} onChange={event => setTaxKnown(event.target.checked)} />I know the purchase tax amount</label>
        {taxKnown && <div className={styles.pair}><label>Purchase tax amount · CAD<input className={kit.field} inputMode="decimal" required value={taxAmount} {...fieldFor('taxCadAmount')} onChange={event => setTaxAmount(event.target.value)} /></label>
          <label>Tax review status<select className={kit.select} value={taxStatus} {...fieldFor('taxStatus')} onChange={event => setTaxStatus(event.target.value as ExpenseRevision['tax_status'])}><option value="pending">Pending review</option><option value="none">No tax recorded</option><option value="reviewed">Reviewed</option></select></label></div>}
        {!taxKnown && <p className={styles.hint}>Tax amount unknown. A blank amount will not be treated as confirmed $0.</p>}
        <label>Business use %<input className={kit.field} type="number" min="1" max="100" required value={businessUse} {...fieldFor('businessUsePercent')} onChange={event => setBusinessUse(event.target.value)} /></label>
        <label>Notes<textarea className={kit.textarea} maxLength={2000} rows={2} value={notes} {...fieldFor('notes')} onChange={event => setNotes(event.target.value)} /></label>
        <p className={styles.hint}>Purchase tax is a recorded detail. This form does not claim a tax credit.</p>
      </div>}
      {expense && !asVoid && <label>Reason for correction<input className={kit.field} name="changeReason" required maxLength={500} placeholder="What changed and why?" {...fieldFor('changeReason')} /></label>}
      {asVoid && <label>Reason to void<input className={kit.field} name="voidReason" required maxLength={500} {...fieldFor('voidReason')} /></label>}
      {error && <DialogReason><span id="bk-form-error" role="alert">{error.error}</span></DialogReason>}
    </form>
  </KitDialog>;
}
