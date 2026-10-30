'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import KitDialog from '@/components/shared/KitDialog';
import { BOOKKEEPING_VIEWS, bookkeepingAddress, bookkeepingPlace } from '@/lib/bookkeeping-navigation';
import { consoleDate, consoleWhen } from '@/lib/console-dates';
import kit from '../console.module.css';
import { businessCents, CONVERSION_NOTE_HINT, FUTURE_DATE_NOTE, hasConfirmedDates, hasKnownTaxAmount, hasValidConversionEvidence, matchesReviewFilter, MAX_RECEIPT_BYTES, RECEIPT_MESSAGE, summarizeExpenses, type ExpenseRevision, type FieldRefusal, type ReviewFilter } from '@/lib/bookkeeping-expenses';
import { reportPeriodRange, type NamedReportPeriod } from '@/lib/bookkeeping-export';
import type { OwnerMovementRevision } from '@/lib/bookkeeping-owner-movements';
import { downloadCSVBlob } from '@/lib/export';
import OwnerLedger from './OwnerLedger';
import DateInput from '@/components/shared/DateInput';
import styles from './bookkeeping.module.css';

const SOURCES: Record<string, string> = {
  business_bank: 'Business bank', business_card: 'Business card', personal: 'Paid personally', other: 'Other',
};
const STARTER_CATEGORIES = [
  'Software & online services', 'Advertising & marketing', 'Equipment & supplies',
  'Professional services', 'Travel & meals', 'Bank charges', 'Other',
];
type BookkeepingView = typeof BOOKKEEPING_VIEWS[number] | 'attention' | 'add' | 'record';
type ReportPeriod = 'all' | NamedReportPeriod | 'custom';
/** Fields inside More details: a refusal on one opens the section before focus moves there. */
const ADVANCED_FIELDS = ['taxCadAmount', 'taxStatus', 'businessUsePercent', 'notes'];
type ReportDrilldown = { kind: 'all' | 'category' | 'supplier' | 'personal'; key?: string };
const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const money = (cents: number) => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(cents / 100);
const amount = (cents: number) => (cents / 100).toFixed(2);
const attentionReasons = (row: ExpenseRevision) => [
  !hasConfirmedDates(row) ? 'Dates to review' : '',
  !row.receipt_path ? 'Receipt missing' : '',
  !hasKnownTaxAmount(row) ? 'Purchase tax amount unknown' : '',
  hasKnownTaxAmount(row) && row.tax_status === 'pending' ? 'Tax review pending' : '',
  row.original_currency === 'USD' && !hasValidConversionEvidence(row.conversion_note) ? 'USD conversion evidence needed' : '',
].filter(Boolean);

function ExpenseRecordWindow({ expense, address, homeAddress, onClose, children }: {
  expense: ExpenseRevision; address: string; homeAddress: string; onClose: () => void; children: ReactNode;
}) {
  // A pasted/reloaded record, or a return from Correct, opens over its list, never over itself.
  // Normalize before the child's Back-step effect. KitDialog then owns the record's address.
  useLayoutEffect(() => {
    if (window.location.pathname + window.location.search === address) {
      window.history.replaceState(window.history.state, '', homeAddress);
    }
  }, [address, homeAddress]);
  return <KitDialog kind="form" size="medium" record
    eyebrow={<>Expense · {consoleDate(expense.incurred_date ?? expense.expense_date)}</>}
    title={expense.supplier} identity={<>{expense.category} · {expense.business_purpose}</>}
    address={address} onClose={onClose}>{children}</KitDialog>;
}

export default function BookkeepingClient({ initialExpenses, initialRevisions, initialDateSchemaReady, initialTaxSchemaReady, initialOwnerMovements, initialOwnerRevisions, initialOwnerSchemaReady }: {
  initialExpenses: ExpenseRevision[]; initialRevisions: ExpenseRevision[]; initialDateSchemaReady: boolean; initialTaxSchemaReady: boolean;
  initialOwnerMovements: OwnerMovementRevision[]; initialOwnerRevisions: OwnerMovementRevision[]; initialOwnerSchemaReady: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useMemo(() => new URLSearchParams(searchParams.toString()), [searchParams]);
  const place = bookkeepingPlace(params);
  const view: BookkeepingView = place.form ? 'add' : place.attention ? 'attention' : place.view;
  const [expenses, setExpenses] = useState<ExpenseRevision[]>(initialExpenses);
  const [revisions, setRevisions] = useState<ExpenseRevision[]>(initialRevisions);
  const [dateSchemaReady, setDateSchemaReady] = useState(initialDateSchemaReady);
  const [taxSchemaReady, setTaxSchemaReady] = useState(initialTaxSchemaReady);
  const [selectedExpenseId, setSelectedExpenseId] = useState<string | null>(place.record);
  const [editing, setEditing] = useState<ExpenseRevision | null>(null);
  const [voidMode, setVoidMode] = useState(false);
  const [formVersion, setFormVersion] = useState(0);
  const [formDirty, setFormDirty] = useState(false);
  const [pendingLeave, setPendingLeave] = useState<BookkeepingView | null>(null);
  const [incurredDate, setIncurredDate] = useState(today);
  const [paidDate, setPaidDate] = useState(today);
  const [differentPaymentDate, setDifferentPaymentDate] = useState(false);
  const [currency, setCurrency] = useState<'CAD' | 'USD'>('CAD');
  const [customCategory, setCustomCategory] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [taxAmountKnown, setTaxAmountKnown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState<'csv' | 'package' | null>(null);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState<FieldRefusal | null>(null);
  const [notice, setNotice] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [category, setCategory] = useState('');
  const [query, setQuery] = useState('');
  const [review, setReview] = useState<ReviewFilter>('all');
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>('all');
  const [reportDrilldown, setReportDrilldown] = useState<ReportDrilldown>({ kind: 'all' });
  const [initializedForm, setInitializedForm] = useState<string | null>(null);
  const invalidPeriod = Boolean(from && to && from > to);

  function setView(next: BookkeepingView) {
    const record = next === 'record' ? selectedExpenseId : null;
    router.push(bookkeepingAddress(params, {
      view: next === 'attention' ? 'expenses' : next === 'record' || next === 'add' ? place.view : next,
      attention: next === 'attention', record, form: next === 'add' ? 'add' : null,
    }), { scroll: false });
  }

  // A refusal at Save moves focus to the field it names (after More details has opened, if the field lives there).
  useEffect(() => {
    if (formError?.field) document.getElementById(`bk-${formError.field}`)?.focus();
  }, [formError]);
  const fieldFor = (name: string) => formError?.field === name
    ? { id: `bk-${name}`, 'aria-invalid': true as const, 'aria-describedby': 'bk-form-error' }
    : { id: `bk-${name}` };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/platform-admin/bookkeeping/expenses', { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Unable to load expenses');
      setExpenses(body.expenses);
      setRevisions(body.revisions);
      setDateSchemaReady(Boolean(body.dateSchemaReady));
      setTaxSchemaReady(Boolean(body.taxSchemaReady));
      setError('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load expenses'); }
    finally { setLoading(false); }
  }, []);

  const categories = useMemo(() => [...new Set([...STARTER_CATEGORIES, ...expenses.map(row => row.category)])].sort(), [expenses]);
  const visible = useMemo(() => expenses.filter(row =>
    (!row.incurred_date || ((!from || row.incurred_date >= from) && (!to || row.incurred_date <= to))) &&
    (!category || row.category === category) &&
    (!query || `${row.supplier} ${row.business_purpose} ${row.category}`.toLowerCase().includes(query.toLowerCase())) &&
    matchesReviewFilter(row, review)
  ), [expenses, from, to, category, query, review]);
  const datedVisible = useMemo(() => visible.filter(hasConfirmedDates), [visible]);
  const legacyVisible = useMemo(() => visible.filter(row => !hasConfirmedDates(row) && !row.void_reason), [visible]);
  const summary = useMemo(() => summarizeExpenses(datedVisible), [datedVisible]);
  const reportRows = useMemo(() => datedVisible.filter(row => !row.void_reason && (
    reportDrilldown.kind === 'all' ||
    (reportDrilldown.kind === 'category' && row.category === reportDrilldown.key) ||
    (reportDrilldown.kind === 'supplier' && row.supplier === reportDrilldown.key) ||
    (reportDrilldown.kind === 'personal' && row.payment_source === 'personal')
  )), [datedVisible, reportDrilldown]);
  const selectedExpense = expenses.find(row => row.expense_id === selectedExpenseId) ?? null;
  const addressedExpenseMissing = Boolean(place.record && !expenses.some(row => row.expense_id === place.record));
  const attention = expenses.filter(row => !row.void_reason &&
    attentionReasons(row).length > 0);
  const reportPeriodLabel = reportPeriod === 'all' ? 'All confirmed dates'
    : reportPeriod === 'custom' ? `${from ? consoleDate(from) : 'Any start'} to ${to ? consoleDate(to) : 'Any end'}`
    : reportPeriodRange(reportPeriod, today()).label;
  const drilldownLabel = reportDrilldown.kind === 'category' ? reportDrilldown.key
    : reportDrilldown.kind === 'supplier' ? reportDrilldown.key
    : reportDrilldown.kind === 'personal' ? 'Paid personally' : 'All recorded expenses';

  function chooseReportPeriod(value: ReportPeriod) {
    setReportPeriod(value);
    setReportDrilldown({ kind: 'all' });
    if (value === 'all') { setFrom(''); setTo(''); }
    else if (value !== 'custom') { const range = reportPeriodRange(value, today()); setFrom(range.from); setTo(range.to); }
  }

  function openRecord(row: ExpenseRevision) { setSelectedExpenseId(row.expense_id); }
  function initializeForm(row: ExpenseRevision | null, asVoid: boolean) {
    setEditing(row); setVoidMode(asVoid); setFormDirty(false); setPendingLeave(null); setFormError(null); setFormVersion(version => version + 1);
    const incurred = row?.incurred_date ?? '';
    const paid = row?.paid_date ?? incurred;
    setIncurredDate(incurred || (row ? '' : today()));
    setPaidDate(paid || (row ? '' : today()));
    setDifferentPaymentDate(Boolean(incurred && paid && incurred !== paid));
    setCurrency(row?.original_currency ?? 'CAD');
    setCustomCategory(Boolean(row && !categories.includes(row.category)));
    setShowAdvanced(Boolean(row && (row.business_use_percent !== 100 || row.tax_cad_cents !== 0 || !hasKnownTaxAmount(row) || row.notes)));
    setTaxAmountKnown(row ? hasKnownTaxAmount(row) : false);
  }
  // Reset only when the addressed form changes, before rendering its uncontrolled fields.
  const formKey = place.form ? `${place.form}:${place.record ?? ''}` : null;
  if (formKey !== initializedForm) {
    setInitializedForm(formKey);
    const row = place.form === 'add' ? null : expenses.find(item => item.expense_id === place.record);
    if (place.form && row !== undefined) initializeForm(row, place.form === 'void');
  }
  function openForm(row: ExpenseRevision | null = null, asVoid = false) {
    if (view === 'add' && formDirty) { setPendingLeave('add'); return; }
    router.push(bookkeepingAddress(params, { record: row?.expense_id ?? null, form: row ? asVoid ? 'void' : 'correct' : 'add' }), { scroll: false });
  }
  function leaveForm(next: BookkeepingView) {
    if (saving) return;
    if (formDirty) { setPendingLeave(next); return; }
    setFormDirty(false); setPendingLeave(null); setEditing(null); setVoidMode(false); setFormError(null); setView(next);
  }
  function discardForm() {
    if (!pendingLeave || saving) return;
    setFormDirty(false); setEditing(null); setVoidMode(false); setFormError(null); setView(pendingLeave); setPendingLeave(null);
  }
  function refuse(refusal: FieldRefusal) {
    if (refusal.field && ADVANCED_FIELDS.includes(refusal.field)) setShowAdvanced(true);
    setFormError(refusal);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(''); setNotice(''); setFormError(null);
    const form = new FormData(event.currentTarget);
    form.set('incurredDate', incurredDate);
    form.set('paidDate', differentPaymentDate ? paidDate : incurredDate);
    if (currency === 'CAD') form.set('cadAmount', String(form.get('originalAmount') ?? ''));
    if (!form.has('taxCadAmount')) form.set('taxCadAmount', editing ? amount(editing.tax_cad_cents) : '0.00');
    if (!form.has('taxStatus')) form.set('taxStatus', editing?.tax_status ?? 'pending');
    form.set('taxAmountKnown', String(taxAmountKnown));
    if (!taxAmountKnown) { form.set('taxCadAmount', '0.00'); form.set('taxStatus', 'pending'); }
    if (!form.has('businessUsePercent')) form.set('businessUsePercent', String(editing?.business_use_percent ?? 100));
    if (!form.has('notes')) form.set('notes', editing?.notes ?? '');
    const receipt = form.get('receipt');
    if (!(receipt instanceof File) || receipt.size === 0) form.delete('receipt');
    // The request proxy cuts a body off at 10 MB, so an oversized receipt is refused here, before uploading.
    else if (receipt.size > MAX_RECEIPT_BYTES) { refuse({ field: 'receipt', error: RECEIPT_MESSAGE }); return; }
    if (editing) {
      form.set('expenseId', editing.expense_id);
      form.set('expectedRevision', String(editing.revision));
    }
    if (voidMode) form.set('changeReason', String(form.get('voidReason') ?? ''));
    setSaving(true);
    let saved: ExpenseRevision;
    try {
      const response = await fetch('/api/platform-admin/bookkeeping/expenses', { method: 'POST', body: form });
      const body: { error?: unknown; expense?: ExpenseRevision } = await response.json().catch(() => ({}));
      if (!response.ok || !body.expense) { refuse(typeof body.error === 'string' ? body as FieldRefusal : { error: 'Unable to save expense.' }); return; }
      saved = body.expense;
    } catch { refuse({ error: 'Unable to save expense.' }); return; }
    finally { setSaving(false); }
    setNotice(voidMode ? 'Expense voided; its history is retained.' : editing ? 'Correction saved with history.' : 'Expense saved.');
    setSelectedExpenseId(saved.expense_id);
    setEditing(null); setVoidMode(false);
    setFormDirty(false);
    router.replace(bookkeepingAddress(params, { record: saved.expense_id, form: null }), { scroll: false });
    await load();
  }

  async function exportExpenses(kind: 'csv' | 'package') {
    setExporting(kind); setError('');
    try {
      const params = new URLSearchParams({ ...(from ? { from } : {}), ...(to ? { to } : {}), ...(category ? { category } : {}), ...(query ? { q: query } : {}), ...(review !== 'all' ? { review } : {}) });
      if (view === 'reports' && reportDrilldown.kind !== 'all') {
        params.set('dateStatus', 'confirmed');
        if (reportDrilldown.kind === 'category') params.set('category', reportDrilldown.key ?? '');
        if (reportDrilldown.kind === 'supplier') params.set('supplier', reportDrilldown.key ?? '');
        if (reportDrilldown.kind === 'personal') params.set('paymentSource', 'personal');
      }
      const route = kind === 'csv' ? 'export' : 'package';
      const response = await fetch(`/api/platform-admin/bookkeeping/${route}?${params}`, { cache: 'no-store' });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? 'Unable to export expenses');
      }
      if (kind === 'csv') downloadCSVBlob('fieldlogichq-expenses.csv', await response.text());
      else {
        const url = URL.createObjectURL(await response.blob());
        const link = document.createElement('a');
        link.href = url;
        link.download = 'fieldlogichq-accountant-package.zip';
        document.body.append(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to export expenses'); }
    finally { setExporting(null); }
  }
  return <div className={styles.page}>
    <AdminPageHeader eyebrow="Private finance" title="Bookkeeping" inlineActions actions={
      <button type="button" className={`${styles.primaryAction} ${styles.phoneAdd}`} aria-label="Add expense" onClick={() => openForm()} disabled={!dateSchemaReady || !taxSchemaReady}>+</button>
    } />
    <div className={styles.tabRow}>
      <nav className={`${kit.tabs} ${styles.sectionNav}`} aria-label="Bookkeeping sections">
        {BOOKKEEPING_VIEWS.map(section => <Link key={section}
          href={bookkeepingAddress(params, { view: section, record: null, form: null, attention: false })}
          className={`${kit.tab} ${place.view === section ? kit.tabOn : ''}`}
          aria-current={place.view === section ? 'page' : undefined}
          onClick={event => { if (view === 'add' && formDirty) { event.preventDefault(); leaveForm(section); } }}>
          {section[0].toUpperCase() + section.slice(1)}
          {section === 'expenses' && attention.length > 0 && <span className={kit.tabCount}>{attention.length}</span>}
        </Link>)}
      </nav>
      <button type="button" className={`${styles.primaryAction} ${styles.desktopAdd}`} onClick={() => openForm()} disabled={!dateSchemaReady || !taxSchemaReady}>+ Add expense</button>
    </div>

    {error && <p role="alert" className={styles.error}>{error}</p>}
    {notice && <p role="status" className={styles.notice}>{notice}</p>}
    {addressedExpenseMissing && <p role="alert" className={styles.error}>This expense is unavailable. Open an expense from the list.</p>}
    {(!dateSchemaReady || !taxSchemaReady) && <p role="status" className={styles.notice}>Expense entry is paused while bookkeeping storage is updated. Existing records and exports remain available.</p>}

    {view === 'ledger' && <OwnerLedger expenses={expenses} initialMovements={initialOwnerMovements} initialRevisions={initialOwnerRevisions}
      schemaReady={initialOwnerSchemaReady} onOpenExpense={openRecord} />}

    {view === 'overview' && <section className={styles.overview} aria-labelledby="overview-title">
      <div className={styles.viewHeading}><div><p className={styles.eyebrow}>Daily workspace</p><h2 id="overview-title">How things stand</h2><p>Recorded expenses and the few things still to finish.</p></div></div>
      <div className={styles.metrics}>
        <div><span>Recorded spend · all confirmed dates</span><strong>{money(summarizeExpenses(expenses.filter(hasConfirmedDates)).recordedSpendCents)}</strong></div>
        <div><span>Needs a receipt</span><strong>{expenses.filter(row => !row.void_reason && !row.receipt_path).length}</strong></div>
        <div><span>Dates to review</span><strong>{expenses.filter(row => !row.void_reason && !hasConfirmedDates(row)).length}</strong></div>
      </div>
      <div className={styles.overviewGrid}>
        <div className={styles.panel}><div className={styles.subHeading}><h3>Needs your attention</h3>{attention.length > 5 && <button type="button" className={styles.textButton} onClick={() => setView('attention')}>See all {attention.length}</button>}</div>{attention.length ? attention.slice(0, 5).map(row =>
          <button key={row.expense_id} type="button" className={styles.listDoor} onClick={() => openRecord(row)}>
            <span><strong>{row.supplier}</strong><small>{attentionReasons(row).join(' · ')}</small></span><b>{money(businessCents(row))}</b>
          </button>) : <p className={styles.empty}>Nothing needs attention.</p>}</div>
        <div className={styles.panel}><h3>Recent expenses</h3>{expenses.slice(0, 5).map(row =>
          <button key={row.expense_id} type="button" className={styles.listDoor} onClick={() => openRecord(row)}>
            <span><strong>{row.supplier}</strong><small>{row.incurred_date ? consoleDate(row.incurred_date) : `${consoleDate(row.expense_date)} · date unconfirmed`} · {row.category}</small></span><b>{money(businessCents(row))}</b>
          </button>)}{!expenses.length && <p className={styles.empty}>Your first expense will appear here.</p>}</div>
      </div>
    </section>}
    {view === 'attention' && <section className={styles.panel} aria-labelledby="attention-title">
      <div className={styles.viewHeading}><div><p className={styles.eyebrow}>Follow up</p><h2 id="attention-title">Needs attention</h2>
        <p>Open a purchase to add evidence or confirm a detail. These items remain here until corrected.</p></div></div>
      {attention.length ? <div className={styles.rows}>{attention.map(row => <button key={row.expense_id} type="button" className={styles.listDoor} onClick={() => openRecord(row)}>
        <span><strong>{row.supplier}</strong><small>{attentionReasons(row).join(' · ')}</small></span><b>{money(businessCents(row))} ›</b>
      </button>)}</div> : <p className={styles.empty}>Nothing needs attention.</p>}
    </section>}

    {view === 'add' && !addressedExpenseMissing && <section className={`${styles.panel} ${styles.entryPanel}`} aria-labelledby="expense-form-title">
      <div className={styles.viewHeading}><div><p className={styles.eyebrow}>Expenses</p><h2 id="expense-form-title">{voidMode ? `Void ${editing?.supplier}` : editing ? `Correct ${editing.supplier}` : 'Add an expense'}</h2>
        <p>Record the purchase once. Keep its receipt with it.</p></div><button type="button" className={styles.textButton} onClick={() => leaveForm(editing ? 'record' : 'expenses')}>Back to {editing ? 'record' : 'expenses'}</button></div>
      {editing && !hasConfirmedDates(editing) && <p className={styles.dateWarning}>This older entry has a recorded date of {consoleDate(editing.expense_date)}, but its meaning is unconfirmed. Use its receipt or other evidence to confirm both dates when correcting it.</p>}
      <form key={`${editing?.expense_id ?? 'new'}-${formVersion}`} onSubmit={save} onChange={event => {
        setFormDirty(true);
        // Editing the refused field retires its refusal; the next Save checks again.
        if (formError?.field && (event.target as HTMLElement).id === `bk-${formError.field}`) setFormError(null);
      }} className={styles.form}>
        <div className={styles.dateBox}>
          <label>Expense date (incurred)<DateInput name="incurredDate" required={!voidMode} value={incurredDate} {...fieldFor('incurredDate')} onChange={value => { setFormDirty(true); setIncurredDate(value); if (!differentPaymentDate) setPaidDate(value); }} /></label>
          {incurredDate > today() && <p className={styles.hint}>{FUTURE_DATE_NOTE}</p>}
          <label className={styles.inlineCheck}><input className={kit.field} type="checkbox" checked={differentPaymentDate} onChange={event => { setDifferentPaymentDate(event.target.checked); if (!event.target.checked) setPaidDate(incurredDate); }} /> Payment date is different from expense date</label>
          {differentPaymentDate && <label>Payment date<DateInput name="paidDate" required={!voidMode} value={paidDate} {...fieldFor('paidDate')} onChange={v => { setFormDirty(true); setPaidDate(v); }} /></label>}
          {differentPaymentDate && paidDate > today() && <p className={styles.hint}>{FUTURE_DATE_NOTE}</p>}
        </div>
        <div className={styles.pair}><label>Supplier<input className={kit.field} name="supplier" required maxLength={160} defaultValue={editing?.supplier ?? ''} {...fieldFor('supplier')} /></label>
          <label>Category<select className={kit.select} name={customCategory ? undefined : 'category'} required={!customCategory} defaultValue={editing?.category ?? ''} {...fieldFor(customCategory ? 'categoryChoice' : 'category')} onChange={event => setCustomCategory(event.target.value === '__custom__')}>
            <option value="">Choose a category</option>{categories.map(value => <option key={value} value={value}>{value}</option>)}<option value="__custom__">+ Add a category</option></select></label></div>
        {customCategory && <label>New category<input className={kit.field} name="category" required maxLength={80} placeholder="Name this category" {...fieldFor('category')} /></label>}
        <label>What was it for?<textarea className={kit.textarea} name="businessPurpose" required maxLength={500} rows={2} defaultValue={editing?.business_purpose ?? ''} {...fieldFor('businessPurpose')} /></label>
        <div className={styles.pair}><label>Currency<select className={kit.select} name="originalCurrency" value={currency} {...fieldFor('originalCurrency')} onChange={event => setCurrency(event.target.value as 'CAD' | 'USD')}><option>CAD</option><option>USD</option></select></label>
          <label>{currency === 'CAD' ? 'Amount · CAD' : 'Invoice amount · USD'}<input className={kit.field} name="originalAmount" inputMode="decimal" required defaultValue={editing ? amount(editing.original_cents) : ''} {...fieldFor('originalAmount')} /></label></div>
        {currency === 'USD' && <div className={styles.pair}><label>CAD amount<input className={kit.field} name="cadAmount" inputMode="decimal" required defaultValue={editing ? amount(editing.cad_cents) : ''} {...fieldFor('cadAmount')} /></label>
          <div className={styles.fieldStack}><label>Conversion source and date<textarea className={kit.textarea} name="conversionNote" required maxLength={500} rows={2} placeholder="Card statement 2026-10-16" defaultValue={editing?.conversion_note ?? ''} {...fieldFor('conversionNote')} aria-describedby={formError?.field === 'conversionNote' ? 'bk-form-error bk-conversion-hint' : 'bk-conversion-hint'} />
</label>
            <p id="bk-conversion-hint" className={styles.hint}>{CONVERSION_NOTE_HINT}</p></div></div>}
        <label>How did you pay?<select className={kit.select} name="paymentSource" required defaultValue={editing?.payment_source ?? ''} {...fieldFor('paymentSource')}><option value="">Choose one</option>{Object.entries(SOURCES).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></label>
        <label>Receipt · PDF, JPEG or PNG · up to 10 MB<input className={kit.field} name="receipt" type="file" accept="application/pdf,image/jpeg,image/png" {...fieldFor('receipt')} /></label>
        <p className={styles.hint}>{editing?.receipt_path ? 'The current receipt stays attached unless you choose a replacement. Earlier files remain in history.' : 'You can save now and add the receipt later.'}</p>
        <button type="button" className={styles.moreButton} aria-expanded={showAdvanced} onClick={() => setShowAdvanced(!showAdvanced)}>{showAdvanced ? 'Hide more details' : 'More details'}</button>
        {showAdvanced && <div className={styles.advanced}>
          <label className={styles.inlineCheck}><input className={kit.field} type="checkbox" checked={taxAmountKnown} onChange={event => setTaxAmountKnown(event.target.checked)} /> I know the purchase tax amount</label>
          {taxAmountKnown ? <div className={styles.pair}>
            <label>Purchase tax amount · CAD<input className={kit.field} name="taxCadAmount" inputMode="decimal" required defaultValue={editing ? amount(editing.tax_cad_cents) : '0.00'} {...fieldFor('taxCadAmount')} /></label>
            <label>Tax review status<select className={kit.select} name="taxStatus" defaultValue={editing?.tax_status ?? 'pending'} {...fieldFor('taxStatus')}><option value="pending">Pending review</option><option value="none">No tax recorded</option><option value="reviewed">Reviewed</option></select></label></div>
            : <p className={styles.hint}>Tax amount unknown. A blank amount will not be treated as confirmed $0.</p>}
          <label>Business use %<input className={kit.field} name="businessUsePercent" type="number" min="1" max="100" required defaultValue={editing?.business_use_percent ?? 100} {...fieldFor('businessUsePercent')} /></label>
          <label>Notes<textarea className={kit.textarea} name="notes" maxLength={2000} rows={2} defaultValue={editing?.notes ?? ''} {...fieldFor('notes')} /></label>
          <p className={styles.hint}>Purchase tax is a recorded detail. This form does not claim a tax credit.</p></div>}
        {editing && !voidMode && <label>Reason for correction<input className={kit.field} name="changeReason" required maxLength={500} placeholder="What changed and why?" {...fieldFor('changeReason')} /></label>}
        {voidMode && <label>Reason to void<input className={kit.field} name="voidReason" required maxLength={500} placeholder="Why should this expense leave the report?" {...fieldFor('voidReason')} /></label>}
        {formError && <p id="bk-form-error" role="alert" className={`${styles.error} ${styles.formError}`}>{formError.error}</p>}
        <div className={styles.actions}><button type="submit" disabled={saving || !dateSchemaReady || !taxSchemaReady}>{saving ? 'Saving…' : voidMode ? 'Confirm void' : editing ? 'Save correction' : 'Save expense'}</button>
          <button type="button" className={styles.secondary} onClick={() => leaveForm(editing ? 'record' : 'expenses')}>Cancel</button></div>
        {pendingLeave && <div className={styles.confirmBox} role="group" aria-label="Close without saving?">
          <p><strong>Close without saving?</strong> What you typed won’t be kept.</p>
          <div className={styles.confirmActions}><button type="button" className={styles.textButton} onClick={() => setPendingLeave(null)}>Keep writing</button>
            <button type="button" className={styles.dangerButton} onClick={discardForm}>Discard changes</button></div>
        </div>}
      </form>
    </section>}

    {view === 'reports' && <section className={styles.panel} aria-labelledby="report-title">
          <div className={styles.viewHeading}><div><p className={styles.eyebrow}>Recorded expenses</p><h2 id="report-title">Expense report</h2>
            <p>{reportPeriodLabel} · Period totals use confirmed incurred dates. Older dates to review appear separately.</p></div>
            <div className={styles.exportActions}><button type="button" className={styles.export} onClick={() => exportExpenses('csv')} disabled={!!exporting || invalidPeriod}>{exporting === 'csv' ? 'Preparing CSV…' : 'Export CSV'}</button>
              <button type="button" className={styles.export} onClick={() => exportExpenses('package')} disabled={!!exporting || invalidPeriod}>{exporting === 'package' ? 'Preparing package…' : 'Accountant package'}</button></div></div>
          <div className={styles.filters}>
            <label>Period<select className={kit.select} value={reportPeriod} onChange={event => chooseReportPeriod(event.target.value as ReportPeriod)}><option value="all">All confirmed dates</option><option value="month">This month to date</option><option value="year">This year to date</option><option value="last_month">Last month</option><option value="last_quarter">Last quarter</option><option value="last_year">Last calendar year</option><option value="custom">Custom dates</option></select></label>
            <label>From · incurred date<DateInput value={from} onChange={v => { setFrom(v); setReportPeriod('custom'); }} /></label>
            <label>To · incurred date<DateInput value={to} onChange={v => { setTo(v); setReportPeriod('custom'); }} /></label>
            <label>Category<select className={kit.select} value={category} onChange={event => setCategory(event.target.value)}><option value="">All categories</option>{categories.map(value => <option key={value}>{value}</option>)}</select></label>
            <label>Find<input className={kit.field} type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Supplier or purpose" /></label>
          <label>Review view<select className={kit.select} value={review} onChange={event => setReview(event.target.value as ReviewFilter)}><option value="all">All expenses</option><option value="missing_receipt">Missing receipt</option><option value="missing_conversion">USD conversion evidence needed</option><option value="personal">Paid personally</option><option value="foreign">USD invoices</option></select></label>
          </div>
          {invalidPeriod && <p role="alert" className={styles.dateWarning}>Choose a From date on or before the To date before exporting this report.</p>}
          <div className={styles.metrics}>
            <div><span>Recorded spend · {reportPeriodLabel}</span><strong>{money(summary.recordedSpendCents)}</strong></div>
            <div><span>Expenses with confirmed dates</span><strong>{summary.count}</strong></div>
            <div><span>Dates to review</span><strong>{legacyVisible.length}</strong></div>
          </div>
          <p className={styles.hint}>Spend includes purchase tax and the recorded business-use share. It is not a tax-credit or profit calculation.</p>
          <p className={styles.hint}>Expense CSV and the accountant package use the same expense filters. The package also includes owner transfers dated in the selected period; a narrowed expense view includes only linked reimbursements. Unconfirmed older expense dates stay labelled for review.</p>
          {legacyVisible.length > 0 && <section className={styles.reviewList} aria-labelledby="legacy-dates-title"><h3 id="legacy-dates-title">Dates to review · {money(legacyVisible.reduce((total, row) => total + businessCents(row), 0))}</h3>
            <p className={styles.hint}>These expenses have a recorded date whose meaning was not established. They are excluded from the incurred-date total until confirmed.</p>
            {legacyVisible.map(row => <button type="button" className={styles.listDoor} key={row.expense_id} onClick={() => openRecord(row)}><span><strong>{row.supplier}</strong><small>Recorded date {consoleDate(row.expense_date)} · meaning unconfirmed</small></span><b>{money(businessCents(row))}</b></button>)}</section>}
          <div className={styles.reportGrid}>
            <div><h3>By category</h3>{summary.byCategory.length ? summary.byCategory.map(([name, cents]) => <button key={name} type="button" className={styles.reportDoor} onClick={() => setReportDrilldown({ kind: 'category', key: name })}><span>{name}</span><strong>{money(cents)} ›</strong></button>) : <p>No confirmed expenses in this period.</p>}</div>
            <div><h3>By supplier</h3>{summary.bySupplier.length ? summary.bySupplier.map(([name, cents]) => <button key={name} type="button" className={styles.reportDoor} onClick={() => setReportDrilldown({ kind: 'supplier', key: name })}><span>{name}</span><strong>{money(cents)} ›</strong></button>) : <p>No confirmed expenses in this period.</p>}</div>
          </div>
          <div className={styles.reportGrid}>
            <div><h3>Purchase tax recorded</h3><p><span>Amount unknown</span><strong>{summary.unknownTaxCount} expense(s)</strong></p>{summary.taxByStatus.map(([status, cents]) => <p key={status}><span>{status === 'none' ? 'Confirmed no tax' : status === 'pending' ? 'Known amount · review pending' : 'Reviewed'}</span><strong>{money(cents)}</strong></p>)}</div>
            <div><h3>Recorded spend by payment source</h3>{summary.byPaymentSource.length ? summary.byPaymentSource.map(([source, cents]) => source === 'personal' ? <button type="button" className={styles.reportDoor} key={source} onClick={() => setReportDrilldown({ kind: 'personal' })}><span>{SOURCES[source]}</span><strong>{money(cents)} ›</strong></button> : <p key={source}><span>{SOURCES[source]}</span><strong>{money(cents)}</strong></p>) : <p>No active expenses.</p>}</div>
          </div>
          <section className={styles.reviewList} aria-labelledby="report-lines-title"><div className={styles.subHeading}><h3 id="report-lines-title">{drilldownLabel} · {money(reportRows.reduce((total, row) => total + businessCents(row), 0))}</h3>
            {reportDrilldown.kind !== 'all' && <button type="button" className={styles.textButton} onClick={() => setReportDrilldown({ kind: 'all' })}>Show all entries</button>}</div>
            <p className={styles.hint}>{reportRows.length} contributing expense(s) · {reportPeriodLabel}. Open a row to see its receipt and revisions.</p>
            {reportRows.map(row => <button key={row.expense_id} type="button" className={styles.listDoor} onClick={() => openRecord(row)}><span><strong>{row.supplier}</strong><small>{consoleDate(row.incurred_date)} · {row.category} · {SOURCES[row.payment_source]}</small></span><b>{money(businessCents(row))} ›</b></button>)}
            {!reportRows.length && <p className={styles.empty}>No expenses contribute to this figure.</p>}
          </section>
          <p className={styles.hint}>Paid personally: {money(summary.personallyPaidCents)} across active expenses. A later reimbursement or owner movement is a separate record and must not be entered as another expense here.</p>
          <section className={styles.reviewList} aria-labelledby="evidence-review-title">
            <div className={styles.subHeading}><h3 id="evidence-review-title">Needs attention</h3><button type="button" className={styles.textButton} onClick={() => setView('attention')}>Open worklist · {attention.length}</button></div>
            <p className={styles.hint}>Missing receipts, unknown dates or tax amounts, pending tax review, and USD conversion evidence appear in one worklist. Each item opens its expense record.</p>
          </section>
          <section className={styles.reviewList} aria-labelledby="usd-review-title">
            <h3 id="usd-review-title">USD invoices</h3>
            {visible.filter(row => !row.void_reason && row.original_currency === 'USD').length ? visible.filter(row => !row.void_reason && row.original_currency === 'USD').map(row => <p key={row.expense_id}><strong>{row.supplier}</strong> · USD {amount(row.original_cents)} → CAD {amount(row.cad_cents)} · {row.conversion_note || 'Conversion source/date needed'}</p>) : <p>No active USD invoices in this view.</p>}
          </section>
        </section>}
    {view === 'expenses' && <section className={styles.panel} aria-labelledby="register-title">
      <div className={styles.viewHeading}><div><p className={styles.eyebrow}>Your records</p><h2 id="register-title">Expenses</h2><p>Find a purchase, receipt or correction.</p></div></div>
      <div className={styles.filters}><label>Find<input className={kit.field} type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Supplier or purpose" /></label>
        <label>From · incurred date<DateInput value={from} onChange={v => { setFrom(v); setReportPeriod('custom'); }} /></label>
        <label>To · incurred date<DateInput value={to} onChange={v => { setTo(v); setReportPeriod('custom'); }} /></label>
        <label>Category<select className={kit.select} value={category} onChange={event => setCategory(event.target.value)}><option value="">All categories</option>{categories.map(value => <option key={value}>{value}</option>)}</select></label>
        <label>Show<select className={kit.select} value={review} onChange={event => setReview(event.target.value as ReviewFilter)}><option value="all">All expenses</option><option value="missing_receipt">Missing receipt</option><option value="missing_conversion">USD conversion needed</option><option value="personal">Paid personally</option><option value="foreign">USD invoices</option></select></label></div>
      {loading ? <p>Loading expenses…</p> : !visible.length ? <p className={styles.empty}>No expenses match this view.</p> :
        <div className={styles.rows}>{visible.map(row => <button key={row.expense_id} type="button" className={styles.listDoor} onClick={() => openRecord(row)}>
          <span><strong>{row.supplier}</strong><small>{row.incurred_date ? consoleDate(row.incurred_date) : `${consoleDate(row.expense_date)} · date unconfirmed`} · {row.category} · {SOURCES[row.payment_source]}</small>
            <small>{row.receipt_path ? 'Receipt attached' : 'Receipt missing'}{row.void_reason ? ' · Voided' : ''}</small></span>
          <b>{row.void_reason ? 'Voided' : money(businessCents(row))} ›</b>
        </button>)}</div>}
    </section>}

    {view !== 'add' && selectedExpense && <ExpenseRecordWindow key={selectedExpense.expense_id} expense={selectedExpense}
      address={bookkeepingAddress(params, { record: selectedExpense.expense_id, form: null })}
      homeAddress={bookkeepingAddress(params, { record: null, form: null })}
      onClose={() => setSelectedExpenseId(null)}>
      {selectedExpense.void_reason && <p className={styles.dateWarning}>Voided: {selectedExpense.void_reason}. This record is excluded from active spend.</p>}
      {!hasConfirmedDates(selectedExpense) && <p className={styles.dateWarning}>Recorded date {consoleDate(selectedExpense.expense_date)} · meaning unconfirmed. Check the source document before confirming incurred and payment dates.</p>}
      <div className={styles.recordGrid}><div className={styles.recordCard}><h3>Expense details</h3><dl>
        <div><dt>Business amount</dt><dd>{money(businessCents(selectedExpense))}</dd></div>
        <div><dt>Expense date</dt><dd>{selectedExpense.incurred_date ? consoleDate(selectedExpense.incurred_date) : 'Needs review'}</dd></div>
        <div><dt>Payment date</dt><dd>{selectedExpense.paid_date ? consoleDate(selectedExpense.paid_date) : 'Needs review'}</dd></div>
        <div><dt>Paid from</dt><dd>{SOURCES[selectedExpense.payment_source]}</dd></div>
        <div><dt>Receipt</dt><dd>{selectedExpense.receipt_path ? 'Attached' : 'Missing'}</dd></div>
        <div><dt>Purchase tax amount</dt><dd>{hasKnownTaxAmount(selectedExpense) ? money(selectedExpense.tax_cad_cents) : 'Unknown'}</dd></div>
        <div><dt>Tax review</dt><dd>{selectedExpense.tax_status === 'pending' ? 'Pending review' : selectedExpense.tax_status === 'none' ? 'No tax recorded' : 'Reviewed'}</dd></div>
      </dl></div><div className={styles.recordCard}><h3>Original receipt</h3>
        {selectedExpense.receipt_path ? <p><a href={`/api/platform-admin/bookkeeping/receipt/${selectedExpense.expense_id}/${selectedExpense.revision}`}>{selectedExpense.receipt_name ?? 'Download receipt'}</a></p> : <p>No receipt attached yet.</p>}
        {selectedExpense.original_currency === 'USD' && <p>USD {amount(selectedExpense.original_cents)} → CAD {amount(selectedExpense.cad_cents)} · {selectedExpense.conversion_note}</p>}
        {selectedExpense.notes && <p>{selectedExpense.notes}</p>}</div></div>
      {/* Correct and Void only: a void is the only way a record leaves the totals (owner ruling R1, 2026-10-25). */}
      {!selectedExpense.void_reason && <div className={styles.recordActions}>
        <button type="button" className={styles.primaryAction} onClick={() => openForm(selectedExpense)}>Correct expense</button>
        <button type="button" className={styles.textButton} onClick={() => openForm(selectedExpense, true)}>Void expense</button></div>}
      <section className={styles.historySection} aria-labelledby="history-title"><h3 id="history-title">Changes</h3><ol className={styles.history}>{revisions.filter(item => item.expense_id === selectedExpense.expense_id).sort((a, b) => b.revision - a.revision).map(item =>
        <li key={item.revision}>Rev. {item.revision} · {consoleWhen(item.created_at)} · {money(item.cad_cents)} · {item.incurred_date ? consoleDate(item.incurred_date) : `${consoleDate(item.expense_date)} (date unconfirmed)`} {item.change_reason ? `· ${item.change_reason}` : '· First entry'} {item.void_reason ? `· Voided: ${item.void_reason}` : ''} {item.receipt_path && <a href={`/api/platform-admin/bookkeeping/receipt/${item.expense_id}/${item.revision}`}>Receipt</a>}</li>
      )}</ol></section>
    </ExpenseRecordWindow>}
  </div>;
}
