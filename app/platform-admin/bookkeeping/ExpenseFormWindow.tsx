'use client';

import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import KitDialog, { DialogCancel, DialogReason } from '@/components/shared/KitDialog';
import type { ComponentProps } from 'react';
import Link from 'next/link';
import DateInput from '@/components/shared/DateInput';
import { consoleDate } from '@/lib/console-dates';
import {
  businessCents, CONVERSION_SOURCES, expenseConversionRate, FUTURE_DATE_NOTE, hasConfirmedDates,
  isConversionSource, lastConversionSource, MAX_RECEIPT_BYTES, MAX_SUPPLIER_TAX_NUMBER, MAX_TAX_LINES, parseCents, RECEIPT_MESSAGE,
  type ExpenseRevision, type FieldRefusal,
} from '@/lib/bookkeeping-expenses';
import {
  CANT_GET_NUMBER, CHOOSABLE_TAX_TYPES, CREDIT_LABEL, defaultPurchaseKind, hasGstHstLine, NUMBER_HINT_BLANK, NUMBER_HINT_SAME_AS_LAST,
  NUMBER_NEEDED_FROM_CENTS, NUMBER_NOT_NEEDED, PURCHASE_KINDS, REGISTRATION_HINT, resolveTaxState, SUPPLIER_REGISTRATIONS, supplierPrefill,
  sumTaxLines, TAX_ANSWERS, TAX_STATUS_LABELS, TAX_TYPES, taxFromTotal, taxSummary, UNSET_TYPE_PROMPT, workOutCredit, formatCad as money,
  type PurchaseKind, type SupplierRegistration, type TaxAnswer, type TaxLine, type TaxType,
} from '@/lib/bookkeeping-gst';
import { tournamentToday } from '@/lib/timezone';
import { bookkeepingAddress } from '@/lib/bookkeeping-navigation';
import { expenseVoidForm } from '@/lib/bookkeeping-void';
import { duplicateExpenses } from '@/lib/bookkeeping-duplicates';
import BookkeepingQuestion from './BookkeepingQuestion';
import ExpenseRecordBody from './ExpenseRecordBody';
import kit from '../console.module.css';
import styles from './bookkeeping.module.css';

const SOURCES = { business_bank: 'Business bank', business_card: 'Business card', personal: 'Paid personally', other: 'Other' };
const dollars = (cents: number) => (cents / 100).toFixed(2);
const ADVANCED_FIELDS = ['taxAnswer', 'taxType', 'taxLines', 'taxStatus', 'businessUsePercent', 'supplierTaxNumber', 'notes'];
/** One tax line as typed. A pre-4a amount opens as one line of type `unset`, shown as “Choose a type”. */
type LineDraft = { key: number; type: TaxType; amount: string };
let lineKeys = 0;
const draftLine = (type: TaxType, amount = ''): LineDraft => ({ key: ++lineKeys, type, amount });

export default function ExpenseFormWindow({ expense, expenses, categories, asVoid = false, startEditing = false, copyFrom, revisions = [], steps, onCopy, address, homeAddress, disabled, registrationDate, focusNumber = false, onClose, onSaved }: {
  expense: ExpenseRevision | null; expenses: ExpenseRevision[]; categories: string[]; asVoid?: boolean;
  startEditing?: boolean; copyFrom?: ExpenseRevision | null; revisions?: ExpenseRevision[];
  /** The current GST/HST registration date: the live credit sentence reads it. Null before migration 006. */
  registrationDate: string | null;
  /** Open with More details open and the supplier's number focused (a register row waiting on the number). */
  focusNumber?: boolean;
  steps?: ComponentProps<typeof KitDialog>['steps']; onCopy?: (row: ExpenseRevision) => void;
  address: string; homeAddress: string; disabled: boolean; onClose: () => void;
  onSaved: (saved: ExpenseRevision) => void;
}) {
  const base = expense ?? copyFrom;
  const [editing, setEditing] = useState(!expense || (startEditing && !expense.void_reason));
  const [question, setQuestion] = useState<'correct' | 'void' | null>(null);
  const pending = useRef<FormData | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const baseline = useRef('');
  const [dirty, setDirty] = useState(Boolean(copyFrom && !expense));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<FieldRefusal | null>(null);
  const [supplier, setSupplier] = useState(base?.supplier ?? '');
  const [currency, setCurrency] = useState(base?.original_currency ?? 'CAD');
  const [incurredDate, setIncurredDate] = useState(expense?.incurred_date ?? (expense ? '' : tournamentToday()));
  const [paidDate, setPaidDate] = useState(expense?.paid_date ?? (expense ? '' : tournamentToday()));
  const [differentDate, setDifferentDate] = useState(Boolean(expense?.paid_date && expense.incurred_date !== expense.paid_date));
  const [originalAmount, setOriginalAmount] = useState(base ? dollars(base.original_cents) : '');
  const [cadAmount, setCadAmount] = useState(base ? dollars(base.cad_cents) : '');
  const [paymentSource, setPaymentSource] = useState<string>(base?.payment_source ?? '');
  const [conversionSource, setConversionSource] = useState<string>(base?.conversion_source ?? '');
  const [conversionNote, setConversionNote] = useState(isConversionSource(base?.conversion_source) && base?.conversion_note === CONVERSION_SOURCES[base.conversion_source] ? '' : base?.conversion_note ?? '');
  const [purpose, setPurpose] = useState(base?.business_purpose ?? '');
  const [category, setCategory] = useState(base?.category ?? '');
  const [customCategory, setCustomCategory] = useState(false);
  const [more, setMore] = useState(focusNumber);
  // GST/HST Stage 4a: the tax section. A saved expense opens in its mapped state (resolveTaxState), so an older one
  // shows its single amount as one line of type “Type not set”.
  const [savedTax] = useState(() => base ? resolveTaxState(base, base.tax_lines ?? []) : null);
  const [taxAnswer, setTaxAnswer] = useState<TaxAnswer>(savedTax?.answer ?? 'unknown');
  const [drafts, setDrafts] = useState<LineDraft[]>(() => savedTax?.lines.length
    ? savedTax.lines.map(line => draftLine(line.type, dollars(line.cents))) : [draftLine('hst13')]);
  const [taxStatus, setTaxStatus] = useState<'pending' | 'reviewed'>(base?.tax_status === 'reviewed' ? 'reviewed' : 'pending');
  // Kind starts from the category and follows it until one is picked (ruling 8).
  const [kindChoice, setKindChoice] = useState<PurchaseKind | ''>(base?.purchase_kind ?? '');
  // Null = not stated on this expense yet, so the latest active expense with the same supplier name fills it in (ruling 6).
  const [numberText, setNumberText] = useState<string | null>(base?.supplier_tax_number ?? (base?.supplier_registration ? '' : null));
  const [registration, setRegistration] = useState<SupplierRegistration | '' | null>(base?.supplier_registration ?? null);
  const [numberUnobtainable, setNumberUnobtainable] = useState(Boolean(base?.number_unobtainable));
  const [businessUse, setBusinessUse] = useState(String(base?.business_use_percent ?? 100));
  const [notes, setNotes] = useState(base?.notes ?? '');
  const [receipt, setReceipt] = useState<File | null>(null);
  const purposeRef = useRef<HTMLTextAreaElement>(null);
  const rate = expenseConversionRate(parseCents(originalAmount) ?? 0, parseCents(cadAmount) ?? 0);
  const duplicates = duplicateExpenses(expenses, supplier, parseCents(currency === 'CAD' ? originalAmount : cadAmount), incurredDate, expense?.expense_id);
  const windowParams = new URLSearchParams(address.split('?')[1] ?? '');
  const windowAddress = bookkeepingAddress(windowParams, { record: expense?.expense_id ?? null, form: expense ? editing ? 'correct' : null : 'add' });
  const shown = taxAnswer === 'shown';
  const lines: TaxLine[] = shown ? drafts.map(line => ({ type: line.type, cents: parseCents(line.amount) ?? 0 })) : [];
  const gstHst = hasGstHstLine(lines);
  const totalCents = parseCents(currency === 'CAD' ? originalAmount : cadAmount);
  const kind = kindChoice || defaultPurchaseKind(category);
  const prefill = supplierPrefill(expenses.filter(row => row.expense_id !== expense?.expense_id), supplier);
  const number = (numberText ?? prefill?.number ?? '').trim();
  const supplierRegistration = registration ?? prefill?.registration ?? '';
  const prefilled = Boolean(prefill && (numberText === null || registration === null));
  // Worked out live from the same rules the server reads on every load; never typed, never posted, never stored.
  const credit = shown && registrationDate && incurredDate ? workOutCredit({
    lines, kind, businessUsePercent: Number(businessUse) || 0, receiptTotalCents: totalCents ?? 0, incurredDate,
    registration: supplierRegistration || 'not_checked', hasNumber: Boolean(number), numberUnobtainable, registrationDate, supplier: supplier.trim(),
  }) : null;
  const waiting = credit?.state === 'held' || credit?.state === 'not_claimed';
  const singleRate = drafts.length === 1 ? TAX_TYPES[drafts[0].type].rate : null;
  // Business use is visible for every answer; it sits beside whichever field the answer leaves room for.
  const businessUseField = () => <label>Business use %<input className={kit.field} type="number" min="1" max="100" required value={businessUse} {...fieldFor('businessUsePercent')} onChange={event => setBusinessUse(event.target.value)} /></label>;
  function changeLine(key: number, change: Partial<LineDraft>) { setDrafts(current => current.map(line => line.key === key ? { ...line, ...change } : line)); }

  useLayoutEffect(() => {
    if (window.location.pathname + window.location.search === address) {
      window.history.replaceState(window.history.state, '', homeAddress);
    }
  // A direct link is normalized only on mount. Each mode's KitDialog then owns its own step.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!asVoid || !expense || expense.void_reason) return;
    // Arm a directly addressed question after the record's own Back step is standing.
    const timer = window.setTimeout(() => setQuestion('void'), 0);
    return () => window.clearTimeout(timer);
  }, [asVoid, expense]);
  useLayoutEffect(() => { if (editing && formRef.current) baseline.current = fingerprint(buildForm()); }, [editing]); // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const field = purposeRef.current;
    if (field) { field.style.height = 'auto'; field.style.height = `${field.scrollHeight}px`; }
  }, [purpose]);
  useEffect(() => { if (error?.field) document.getElementById(`bk-${error.field}`)?.focus(); }, [error]);
  useEffect(() => {
    if (!focusNumber || !editing) return;
    // After the window has placed its own first focus: a register row waiting on the number lands on that field.
    const timer = window.setTimeout(() => document.getElementById('bk-supplierTaxNumber')?.focus(), 0);
    return () => window.clearTimeout(timer);
  // Once, when the window opens from the register.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const fieldFor = (name: string) => ({ id: `bk-${name}`, ...(error?.field === name
    ? { 'aria-invalid': true as const, 'aria-describedby': 'bk-form-error' } : {}) });
  function refuse(given: FieldRefusal) {
    // The single tax amount is the sum of the lines, so its refusals belong to the first line's amount.
    const refusal = given.field === 'taxCadAmount' ? { ...given, field: 'taxLines' } : given;
    if (refusal.field && ADVANCED_FIELDS.includes(refusal.field)) setMore(true);
    setError(refusal);
  }
  function buildForm() {
    const form = new FormData(formRef.current!);
    form.set('incurredDate', incurredDate);
    form.set('paidDate', differentDate ? paidDate : incurredDate);
    form.set('originalCurrency', currency);
    form.set('originalAmount', originalAmount);
    form.set('cadAmount', currency === 'CAD' ? originalAmount : cadAmount);
    form.set('conversionSource', currency === 'USD' ? conversionSource : '');
    if (currency === 'USD') form.set('conversionNote', conversionNote);
    form.set('category', category);
    form.set('paymentSource', paymentSource);
    // GST/HST Stage 4a fields, as the expenses API reads them. The server derives "amount known" from the answer and
    // works the credit out itself, so neither is sent. Fields hidden for this answer are sent blank ("not stated").
    form.set('taxAnswer', taxAnswer);
    form.set('taxLines', JSON.stringify(lines));
    form.set('taxCadAmount', dollars(sumTaxLines(lines)));
    form.set('taxStatus', shown ? taxStatus : taxAnswer === 'none' ? 'none' : 'pending');
    form.set('purchaseKind', gstHst ? kind : '');
    form.set('supplierTaxNumber', gstHst ? number : '');
    form.set('supplierRegistration', gstHst ? supplierRegistration || 'not_checked' : '');
    form.set('numberUnobtainable', String(gstHst && numberUnobtainable && !number));
    form.set('businessUsePercent', businessUse);
    form.set('notes', notes);
    if (receipt) {
      form.set('receipt', receipt);
    } else form.delete('receipt');
    if (expense) { form.set('expenseId', expense.expense_id); form.set('expectedRevision', String(expense.revision)); }
    return form;
  }
  function fingerprint(form: FormData) { return JSON.stringify([...form].map(([key, value]) => [key, value instanceof File ? [value.name, value.size, value.lastModified] : value])); }
  async function persist(form: FormData): Promise<string | null> {
    setSaving(true);
    try {
      const response = await fetch('/api/platform-admin/bookkeeping/expenses', { method: 'POST', body: form });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.expense) {
        const refusal = typeof body.error === 'string' ? body as FieldRefusal : { error: 'Unable to save expense.' };
        if (refusal.field && refusal.field !== 'changeReason' && refusal.field !== 'voidReason') { setQuestion(null); refuse(refusal); return null; }
        return refusal.error;
      }
      setDirty(false); setEditing(false); setReceipt(null); onSaved(body.expense); return null;
    } catch { return 'Unable to save expense.'; }
    finally { setSaving(false); }
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (saving) return;
    setError(null);
    if (receipt && receipt.size > MAX_RECEIPT_BYTES) { refuse({ field: 'receipt', error: RECEIPT_MESSAGE }); return; }
    // Only a correction may keep an older “Type not set” amount; a copy of one is a new expense and needs its type.
    if (!expense && shown && drafts.some(line => line.type === 'unset')) { refuse({ field: 'taxType', error: 'Choose the tax type.' }); return; }
    const form = buildForm();
    if (expense) {
      if (fingerprint(form) === baseline.current) { setDirty(false); setEditing(false); return; }
      pending.current = form; setQuestion('correct');
    } else { const refusal = await persist(form); if (refusal) refuse({ error: refusal }); }
  }

  return <><KitDialog key={windowAddress} kind="form" size="medium" title={expense ? expense.supplier : 'Add an expense'} record={Boolean(expense)}
    eyebrow={expense ? <>Expense · {consoleDate(expense.incurred_date ?? expense.expense_date)}</> : 'Expenses · new'}
    identity={expense ? <>{expense.category} · {expense.business_purpose}</> : undefined}
    edit={expense && !expense.void_reason ? { editing, label: editing ? 'Save correction' : 'Correct expense', disabled: saving || disabled,
      onToggle: () => {
        if (editing) {
          if (fingerprint(buildForm()) === baseline.current) { setDirty(false); setEditing(false); }
          else formRef.current?.requestSubmit();
        } else { setEditing(true); setError(null); }
      } } : undefined}
    address={windowAddress} dirty={dirty && editing} busy={saving} onClose={onClose}
    steps={expense && steps ? { ...steps, ...(editing ? { prev: null, next: null } : {}) } : undefined}
    footerStart={editing ? expense ? 'A correction is saved with its reason.' : 'A missing receipt shows in Needs attention.' : undefined}
    footer={editing ? <><DialogCancel className={styles.quietButton} />{!expense && <button type="submit" form="bk-expense-form" className={styles.primaryAction} disabled={saving || disabled}>
      {saving ? 'Saving…' : 'Save expense'}</button>}</> : undefined}>
    {expense && !editing ? <><ExpenseRecordBody expense={expense} revisions={revisions} registrationDate={registrationDate} />{!expense.void_reason && <div className={styles.recordActions}>
      <button type="button" className={styles.quietButton} onClick={() => onCopy?.(expense)}>Copy as new</button>
      <button type="button" className={styles.quietButton} onClick={() => setQuestion('void')}>Void this expense…</button>
    </div>}</> : <>
    {expense && !hasConfirmedDates(expense) && <p className={styles.dateWarning}>This older entry has a recorded date of {consoleDate(expense.expense_date)}, but its meaning is unconfirmed. Use its receipt or other evidence to confirm both dates when correcting it.</p>}
    <form ref={formRef} id="bk-expense-form" className={`${styles.form} ${styles.expenseForm}`} onSubmit={save}
      onChange={() => { setDirty(true); setError(null); }}>
      <div className={styles.pair}>
        <label>Supplier *<input className={kit.field} name="supplier" required maxLength={160} value={supplier} onChange={event => setSupplier(event.target.value)} {...fieldFor('supplier')} /></label>
        <div className={styles.fieldStack}><label>Category *<select className={kit.select} required value={customCategory ? '__custom__' : category} {...fieldFor(customCategory ? 'categoryChoice' : 'category')}
          onChange={event => { setCustomCategory(event.target.value === '__custom__'); setCategory(event.target.value === '__custom__' ? '' : event.target.value); }}>
          <option value="">Choose a category</option>{categories.map(value => <option key={value}>{value}</option>)}<option value="__custom__">+ Add a category</option>
        </select></label>{customCategory && <label>New category<input className={kit.field} required maxLength={80} value={category} {...fieldFor('category')} onChange={event => setCategory(event.target.value)} /></label>}</div>
      </div>
      <label>What was it for? *<textarea ref={purposeRef} className={`${kit.textarea} ${styles.purposeField}`} name="businessPurpose" rows={1} required maxLength={500} value={purpose} {...fieldFor('businessPurpose')} onChange={event => setPurpose(event.target.value)} /></label>
      <div className={styles.pair}>
        <label>Expense date *<DateInput name="incurredDate" required value={incurredDate} {...fieldFor('incurredDate')}
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
        <label>Where the CAD figure came from *<select className={kit.select} name="conversionSource" required value={conversionSource} {...fieldFor('conversionSource')} onChange={event => setConversionSource(event.target.value)}>
          <option value="">Choose a source</option>{Object.entries(CONVERSION_SOURCES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Note (optional)<input className={kit.field} name="conversionNote" maxLength={500} value={conversionNote} onChange={event => setConversionNote(event.target.value)} {...fieldFor('conversionNote')} /></label>
      </>}
      <label className={styles.inlineCheck}><input type="checkbox" checked={differentDate} onChange={event => { setDifferentDate(event.target.checked); if (!event.target.checked) setPaidDate(incurredDate); }} />Paid on a different date</label>
      {differentDate && <label>Payment date *<DateInput name="paidDate" required value={paidDate} {...fieldFor('paidDate')} onChange={value => { setDirty(true); setPaidDate(value); }} /></label>}
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
      {duplicates[0] && <p className={styles.dateWarning} role="status">{duplicates[0].supplier} · {money(duplicates[0].cad_cents)} is already recorded for <strong>{consoleDate(duplicates[0].incurred_date)}</strong>. Same purchase twice?{' '}
        <Link href={bookkeepingAddress(new URLSearchParams(), { view: 'expenses', record: duplicates[0].expense_id })} target="_blank" rel="noopener noreferrer" aria-label="Open existing expense in a new tab">Open it ›</Link></p>}
      <button type="button" className={styles.moreButton} aria-expanded={more} onClick={() => setMore(!more)}>
        <strong>{more ? '▾' : '▸'} More details</strong><span>{taxSummary(taxAnswer, lines, credit)} · {businessUse}% business · {notes.trim() ? 'notes added' : 'no notes'}</span>
      </button>
      {more && <div className={styles.advanced}>
        <div className={styles.pair}>
          <label>Tax on this receipt<select className={kit.select} value={taxAnswer} {...fieldFor('taxAnswer')} onChange={event => setTaxAnswer(event.target.value as TaxAnswer)}>
            {Object.entries(TAX_ANSWERS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          {shown ? <label>Tax review status<select className={kit.select} value={taxStatus} {...fieldFor('taxStatus')} onChange={event => setTaxStatus(event.target.value as 'pending' | 'reviewed')}>
            <option value="pending">{TAX_STATUS_LABELS.pending}</option><option value="reviewed">{TAX_STATUS_LABELS.reviewed}</option></select></label> : businessUseField()}
        </div>
        {shown && <div className={styles.taxLines}>
          {drafts.map((line, index) => <div key={line.key} className={styles.taxLine}>
            <label>Tax type<select className={`${kit.select} ${line.type === 'unset' ? styles.unsetType : ''}`} value={line.type}
              {...(line.type === 'unset' && drafts.findIndex(item => item.type === 'unset') === index ? fieldFor('taxType') : {})}
              onChange={event => changeLine(line.key, { type: event.target.value as TaxType })}>
              {line.type === 'unset' && <option value="unset">{UNSET_TYPE_PROMPT}</option>}
              {CHOOSABLE_TAX_TYPES.map(type => <option key={type} value={type}>{TAX_TYPES[type].label}</option>)}</select></label>
            <label>Amount · CAD<input className={kit.field} inputMode="decimal" required value={line.amount}
              {...(index === 0 ? fieldFor('taxLines') : { id: `bk-taxLine-${line.key}` })} onChange={event => changeLine(line.key, { amount: event.target.value })} /></label>
            {drafts.length > 1 && <button type="button" className={styles.removeTax} aria-label={`Remove ${TAX_TYPES[line.type].label} line`}
              onClick={() => { setDrafts(current => current.filter(item => item.key !== line.key)); setDirty(true); }}>×</button>}
          </div>)}
          <div className={styles.taxDoors}>
            {singleRate && <button type="button" className={styles.textButton} disabled={!totalCents}
              onClick={() => { changeLine(drafts[0].key, { amount: dollars(taxFromTotal(totalCents!, singleRate)) }); setDirty(true); }}>Work out from the total</button>}
            {drafts.length < MAX_TAX_LINES && <button type="button" className={styles.textButton}
              onClick={() => { setDrafts(current => [...current, draftLine('pst')]); setDirty(true); }}>+ Add another tax</button>}
          </div>
        </div>}
        {shown && (gstHst ? <div className={styles.pair}>
          <label>Kind of purchase<select className={kit.select} value={kind} {...fieldFor('purchaseKind')} onChange={event => setKindChoice(event.target.value as PurchaseKind)}>
            {Object.entries(PURCHASE_KINDS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          {businessUseField()}
        </div> : businessUseField())}
        {credit && credit.state !== 'no_tax' && <p className={`${kit.callout} ${credit.tone === 'amber' ? kit.calloutWarn : styles.creditNeutral}`} aria-live="polite">
          {credit.creditCents ? <span>{CREDIT_LABEL}: <strong>{credit.figure}</strong></span> : <strong>{credit.figure}</strong>}
          {credit.sentence && <span className={styles.creditSentence}>{credit.sentence}</span>}
        </p>}
        {gstHst && <div className={styles.pair}>
          <div className={styles.fieldStack}><label>Supplier’s GST/HST number<input className={kit.field} maxLength={MAX_SUPPLIER_TAX_NUMBER} autoComplete="off" value={numberText ?? prefill?.number ?? ''}
            {...fieldFor('supplierTaxNumber')} onChange={event => { setNumberText(event.target.value); if (event.target.value.trim()) setNumberUnobtainable(false); if (registration === null) setRegistration(prefill?.registration ?? ''); }} /></label>
            {credit?.state === 'held' ? <p className={`${styles.hint} ${styles.warnHint}`}>{NUMBER_HINT_BLANK}</p>
              : prefilled ? <p className={styles.hint}>{NUMBER_HINT_SAME_AS_LAST(supplier.trim())}</p>
              : !number && (totalCents ?? 0) < NUMBER_NEEDED_FROM_CENTS ? <p className={styles.hint}>{NUMBER_NOT_NEEDED}</p> : null}</div>
          <div className={styles.fieldStack}><label>Supplier’s registration<select className={kit.select} value={supplierRegistration || 'not_checked'} {...fieldFor('supplierRegistration')}
            onChange={event => { setRegistration(event.target.value as SupplierRegistration); if (numberText === null) setNumberText(prefill?.number ?? ''); }}>
            {Object.entries(SUPPLIER_REGISTRATIONS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <p className={styles.hint}>{REGISTRATION_HINT}</p></div>
        </div>}
        {gstHst && waiting && <label className={styles.inlineCheck}><input type="checkbox" checked={numberUnobtainable} onChange={event => setNumberUnobtainable(event.target.checked)} />{CANT_GET_NUMBER}</label>}
        <label>Notes<textarea className={kit.textarea} maxLength={2000} rows={2} value={notes} {...fieldFor('notes')} onChange={event => setNotes(event.target.value)} /></label>
      </div>}
      {error && <DialogReason><span id="bk-form-error" role="alert">{error.error}</span></DialogReason>}
    </form></>}
  </KitDialog>
  {question && expense && <BookkeepingQuestion title={question === 'void' ? 'Void this expense?' : 'Why are you correcting this expense?'}
    lead={question === 'void' ? <><strong>{expense.supplier} · {money(businessCents(expense))} · {consoleDate(expense.incurred_date ?? expense.expense_date)}</strong> leaves your totals. It stays in the history with its receipt, exactly as entered.</> : undefined}
    keep={question === 'void' ? 'Keep it' : 'Keep editing'} confirm={question === 'void' ? 'Void expense' : 'Save correction'} onClose={() => setQuestion(null)}
    submit={reason => { const form = question === 'void' ? expenseVoidForm(expense, reason) : pending.current!; form.set('changeReason', reason); return persist(form); }} />}
  </>;
}
