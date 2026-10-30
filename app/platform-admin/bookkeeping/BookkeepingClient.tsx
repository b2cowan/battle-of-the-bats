'use client';

import { useCallback, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import KitDialog from '@/components/shared/KitDialog';
import { BOOKKEEPING_VIEWS, bookkeepingAddress, bookkeepingPlace } from '@/lib/bookkeeping-navigation';
import { consoleDate, consoleWhen } from '@/lib/console-dates';
import kit from '../console.module.css';
import { businessCents, CONVERSION_SOURCES, hasConfirmedDates, hasKnownTaxAmount, isConversionSource, matchesReviewFilter, summarizeExpenses, type ExpenseRevision, type ReviewFilter } from '@/lib/bookkeeping-expenses';
import { reportPeriodRange, type NamedReportPeriod } from '@/lib/bookkeeping-export';
import type { OwnerMovementRevision } from '@/lib/bookkeeping-owner-movements';
import { downloadCSVBlob } from '@/lib/export';
import OwnerLedger from './OwnerLedger';
import ExpenseFormWindow from './ExpenseFormWindow';
import DateInput from '@/components/shared/DateInput';
import styles from './bookkeeping.module.css';

const SOURCES: Record<string, string> = {
  business_bank: 'Business bank', business_card: 'Business card', personal: 'Paid personally', other: 'Other',
};
const STARTER_CATEGORIES = [
  'Software & online services', 'Advertising & marketing', 'Equipment & supplies',
  'Professional services', 'Travel & meals', 'Bank charges', 'Other',
];
type BookkeepingView = typeof BOOKKEEPING_VIEWS[number] | 'attention';
type ReportPeriod = 'all' | NamedReportPeriod | 'custom';
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
  row.original_currency === 'USD' && !isConversionSource(row.conversion_source) ? 'USD source not picked' : '',
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

export default function BookkeepingClient({ initialExpenses, initialRevisions, initialDateSchemaReady, initialTaxSchemaReady, initialConversionSchemaReady, initialOwnerMovements, initialOwnerRevisions, initialOwnerSchemaReady }: {
  initialExpenses: ExpenseRevision[]; initialRevisions: ExpenseRevision[]; initialDateSchemaReady: boolean; initialTaxSchemaReady: boolean; initialConversionSchemaReady: boolean;
  initialOwnerMovements: OwnerMovementRevision[]; initialOwnerRevisions: OwnerMovementRevision[]; initialOwnerSchemaReady: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useMemo(() => new URLSearchParams(searchParams.toString()), [searchParams]);
  const place = bookkeepingPlace(params);
  const view: BookkeepingView = place.attention ? 'attention' : place.view;
  const [expenses, setExpenses] = useState<ExpenseRevision[]>(initialExpenses);
  const [revisions, setRevisions] = useState<ExpenseRevision[]>(initialRevisions);
  const [dateSchemaReady, setDateSchemaReady] = useState(initialDateSchemaReady);
  const [taxSchemaReady, setTaxSchemaReady] = useState(initialTaxSchemaReady);
  const [conversionSchemaReady, setConversionSchemaReady] = useState(initialConversionSchemaReady);
  const [selectedExpenseId, setSelectedExpenseId] = useState<string | null>(place.form === 'add' ? null : place.record);
  const [formOpen, setFormOpen] = useState(Boolean(place.form));
  const [editing, setEditing] = useState<ExpenseRevision | null>(() => place.form && place.form !== 'add' ? initialExpenses.find(row => row.expense_id === place.record) ?? null : null);
  const [voidMode, setVoidMode] = useState(place.form === 'void');
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<'csv' | 'package' | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [category, setCategory] = useState('');
  const [query, setQuery] = useState('');
  const [review, setReview] = useState<ReviewFilter>('all');
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>('all');
  const [reportDrilldown, setReportDrilldown] = useState<ReportDrilldown>({ kind: 'all' });
  const invalidPeriod = Boolean(from && to && from > to);

  function setView(next: BookkeepingView) {
    router.push(bookkeepingAddress(params, { view: next === 'attention' ? 'expenses' : next,
      attention: next === 'attention', record: null, form: null }), { scroll: false });
  }

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
      setConversionSchemaReady(Boolean(body.conversionSchemaReady));
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
  const selectedConversionSource = selectedExpense && isConversionSource(selectedExpense.conversion_source)
    ? CONVERSION_SOURCES[selectedExpense.conversion_source] : null;
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
  function openForm(row: ExpenseRevision | null = null, asVoid = false) {
    setEditing(row); setVoidMode(asVoid);
    if (!row) setSelectedExpenseId(null);
    setFormOpen(true);
  }
  function expenseSaved(saved: ExpenseRevision) {
    setNotice(voidMode ? 'Expense voided; its history is retained.' : editing ? 'Correction saved with history.' : 'Expense saved.');
    setExpenses(current => [saved, ...current.filter(row => row.expense_id !== saved.expense_id)]);
    setRevisions(current => [...current, saved]);
    setSelectedExpenseId(saved.expense_id); setFormOpen(false); setEditing(null); setVoidMode(false);
    void load();
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
      <button type="button" className={`${styles.primaryAction} ${styles.phoneAdd}`} aria-label="Add expense" onClick={() => openForm()} disabled={!dateSchemaReady || !taxSchemaReady || !conversionSchemaReady}>+</button>
    } />
    <div className={styles.tabRow}>
      <nav className={`${kit.tabs} ${styles.sectionNav}`} aria-label="Bookkeeping sections">
        {BOOKKEEPING_VIEWS.map(section => <Link key={section}
          href={bookkeepingAddress(params, { view: section, record: null, form: null, attention: false })}
          className={`${kit.tab} ${place.view === section ? kit.tabOn : ''}`}
          aria-current={place.view === section ? 'page' : undefined}>
          {section[0].toUpperCase() + section.slice(1)}
          {section === 'expenses' && attention.length > 0 && <span className={kit.tabCount}>{attention.length}</span>}
        </Link>)}
      </nav>
      <button type="button" className={`${styles.primaryAction} ${styles.desktopAdd}`} onClick={() => openForm()} disabled={!dateSchemaReady || !taxSchemaReady || !conversionSchemaReady}>+ Add expense</button>
    </div>

    {error && <p role="alert" className={styles.error}>{error}</p>}
    {notice && <p role="status" className={styles.notice}>{notice}</p>}
    {addressedExpenseMissing && <p role="alert" className={styles.error}>This expense is unavailable. Open an expense from the list.</p>}
    {(!dateSchemaReady || !taxSchemaReady || !conversionSchemaReady) && <p role="status" className={styles.notice}>Expense entry is paused while bookkeeping storage is updated. Existing records and exports remain available.</p>}

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
          <label>Review view<select className={kit.select} value={review} onChange={event => setReview(event.target.value as ReviewFilter)}><option value="all">All expenses</option><option value="missing_receipt">Missing receipt</option><option value="missing_conversion">USD source not picked</option><option value="personal">Paid personally</option><option value="foreign">USD invoices</option></select></label>
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
            {visible.filter(row => !row.void_reason && row.original_currency === 'USD').length ? visible.filter(row => !row.void_reason && row.original_currency === 'USD').map(row => <p key={row.expense_id}><strong>{row.supplier}</strong> · USD {amount(row.original_cents)} → CAD {amount(row.cad_cents)} · {row.conversion_note || 'USD source not picked'}</p>) : <p>No active USD invoices in this view.</p>}
          </section>
        </section>}
    {view === 'expenses' && <section className={styles.panel} aria-labelledby="register-title">
      <div className={styles.viewHeading}><div><p className={styles.eyebrow}>Your records</p><h2 id="register-title">Expenses</h2><p>Find a purchase, receipt or correction.</p></div></div>
      <div className={styles.filters}><label>Find<input className={kit.field} type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Supplier or purpose" /></label>
        <label>From · incurred date<DateInput value={from} onChange={v => { setFrom(v); setReportPeriod('custom'); }} /></label>
        <label>To · incurred date<DateInput value={to} onChange={v => { setTo(v); setReportPeriod('custom'); }} /></label>
        <label>Category<select className={kit.select} value={category} onChange={event => setCategory(event.target.value)}><option value="">All categories</option>{categories.map(value => <option key={value}>{value}</option>)}</select></label>
        <label>Show<select className={kit.select} value={review} onChange={event => setReview(event.target.value as ReviewFilter)}><option value="all">All expenses</option><option value="missing_receipt">Missing receipt</option><option value="missing_conversion">USD source not picked</option><option value="personal">Paid personally</option><option value="foreign">USD invoices</option></select></label></div>
      {loading ? <p>Loading expenses…</p> : !visible.length ? <p className={styles.empty}>No expenses match this view.</p> :
        <div className={styles.rows}>{visible.map(row => <button key={row.expense_id} type="button" className={styles.listDoor} onClick={() => openRecord(row)}>
          <span><strong>{row.supplier}</strong><small>{row.incurred_date ? consoleDate(row.incurred_date) : `${consoleDate(row.expense_date)} · date unconfirmed`} · {row.category} · {SOURCES[row.payment_source]}</small>
            <small>{row.receipt_path ? 'Receipt attached' : 'Receipt missing'}{row.void_reason ? ' · Voided' : ''}</small></span>
          <b>{row.void_reason ? 'Voided' : money(businessCents(row))} ›</b>
        </button>)}</div>}
    </section>}

    {formOpen && !addressedExpenseMissing && <ExpenseFormWindow key={`${editing?.expense_id ?? 'new'}-${voidMode}`}
      expense={editing} expenses={expenses} categories={categories} asVoid={voidMode}
      address={bookkeepingAddress(params, { record: editing?.expense_id ?? null, form: editing ? voidMode ? 'void' : 'correct' : 'add' })}
      homeAddress={bookkeepingAddress(params, { record: null, form: null })}
      disabled={!dateSchemaReady || !taxSchemaReady || !conversionSchemaReady}
      onClose={() => setFormOpen(false)} onSaved={expenseSaved} />}
    {!formOpen && selectedExpense && <ExpenseRecordWindow key={selectedExpense.expense_id} expense={selectedExpense}
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
        {selectedExpense.original_currency === 'USD' && <p>USD {amount(selectedExpense.original_cents)} → CAD {amount(selectedExpense.cad_cents)} · {selectedConversionSource ?? 'USD source not picked'}{selectedExpense.conversion_rate != null ? ` · Rate ${selectedExpense.conversion_rate >= 0.00005 ? selectedExpense.conversion_rate.toFixed(4) : selectedExpense.conversion_rate.toPrecision(4)}` : ''}{selectedExpense.conversion_note && selectedExpense.conversion_note !== selectedConversionSource ? ` · ${selectedExpense.conversion_note}` : ''}</p>}
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
