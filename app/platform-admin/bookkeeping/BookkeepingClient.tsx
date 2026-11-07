'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import { BOOKKEEPING_VIEWS, bookkeepingAddress, bookkeepingPlace } from '@/lib/bookkeeping-navigation';
import { consoleDate, consoleDay } from '@/lib/console-dates';
import kit from '../console.module.css';
import { attentionReasons, businessCents, currentExpenses, hasConfirmedDates, summarizeExpenses, type ExpenseRevision, type ReviewFilter } from '@/lib/bookkeeping-expenses';
import { formatCad, REGISTRATION_LINE, REGISTRATION_QUESTION, TAX_PAID_NOTE, TAX_PAID_ROW_LABELS, TAX_PAID_TITLE, taxTypesPaid, type TaxType } from '@/lib/bookkeeping-gst';
import GstRegistrationQuestion from './GstRegistrationQuestion';
import { reportPeriodRange, type NamedReportPeriod } from '@/lib/bookkeeping-export';
import type { OwnerMovementRevision } from '@/lib/bookkeeping-owner-movements';
import { downloadCSVBlob } from '@/lib/export';
import OwnerLedger from './OwnerLedger';
import ExpenseFormWindow from './ExpenseFormWindow';
import ExpensesRegister from './ExpensesRegister';
import { expenseFilterParams, matchesExpenseFilters, type ExpenseFilters } from '@/lib/bookkeeping-filters';
import { expensePeriodRange, expenseRegisterSelection } from '@/lib/bookkeeping-register';
import { tournamentToday } from '@/lib/timezone';
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
type ReportDrilldown = { kind: 'all' | 'personal' } | { kind: 'category' | 'supplier'; key: string } | { kind: 'tax'; key: TaxType };
const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const money = formatCad;
const amount = (cents: number) => (cents / 100).toFixed(2);
const expenseCount = (count: number) => `${count} ${count === 1 ? 'expense' : 'expenses'}`;
function BookkeepingOverview({ expenses, params, registrationDate, onOpenExpense }: {
  expenses: ExpenseRevision[]; params: URLSearchParams; registrationDate: string | null; onOpenExpense: (row: ExpenseRevision, list?: ExpenseRevision[]) => void;
}) {
  const active = currentExpenses(expenses).filter(row => !row.void_reason);
  const attention = active.filter(row => attentionReasons(row, registrationDate).length > 0);
  const recent = active.slice(0, 5);
  const month = expensePeriodRange('month', tournamentToday());
  const spend = summarizeExpenses(active.filter(row => hasConfirmedDates(row) && row.incurred_date! >= month.from! && row.incurred_date! <= month.to!)).recordedSpendCents;
  const list = new URLSearchParams({ period: 'all', status: 'active' });
  const attentionAddress = bookkeepingAddress(list, { view: 'expenses', attention: true });
  const expensesAddress = bookkeepingAddress(list, { view: 'expenses' });
  function supplier(row: ExpenseRevision, list: ExpenseRevision[]) {
    return <Link className={styles.overviewSupplier} title={row.supplier}
      href={bookkeepingAddress(params, { view: 'overview', record: row.expense_id, form: null })}
      onClick={event => { event.stopPropagation(); if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && event.button === 0) { event.preventDefault(); onOpenExpense(row, list); } }}>{row.supplier}</Link>;
  }
  return <section className={styles.overview} aria-label="Bookkeeping overview">
    <Link className={styles.spendingTile} href={bookkeepingAddress(params, { view: 'reports', record: null, form: null, attention: false })}>
      <span>Spent in {month.label.split(' ')[0]}</span><strong>{money(spend)}</strong>
      <small>Recorded business-use spending · Reports ›</small>
    </Link>
    <div className={styles.overviewGrid}>
      <section className={styles.overviewCard} aria-labelledby="overview-attention-title">
        <div className={styles.overviewCardHead}><h2 id="overview-attention-title">Needs attention <span className={`${kit.chip} ${kit.chipWarn}`}>{attention.length}</span></h2><Link href={attentionAddress}>See all ›</Link></div>
        <div className="table-cards"><table className={`${styles.overviewTable} ${styles.attentionTable}`}>
          <thead><tr><th>Supplier</th><th>Why</th><th className={kit.num}>Amount</th><th aria-label="Open expense" /></tr></thead>
          <tbody>{attention.length ? attention.slice(0, 5).map(row => <tr key={row.expense_id} className={kit.clickableRow} onClick={() => onOpenExpense(row, attention.slice(0, 5))}>
            <td className="table-cards-title">{supplier(row, attention.slice(0, 5))}</td>
            <td data-label="Why"><div className={styles.overviewReasons}>{attentionReasons(row, registrationDate).map(reason => <span key={reason} className={`${kit.chip} ${kit.chipWarn}`}>{reason}</span>)}</div></td>
            <td data-label="Amount" className={kit.num}>{money(businessCents(row))}</td><td className={kit.rowDoor} aria-hidden>›</td>
          </tr>) : <tr><td colSpan={4} className={kit.empty}>Nothing needs attention.</td></tr>}</tbody>
        </table></div>
      </section>
      <section className={styles.overviewCard} aria-labelledby="overview-recent-title">
        <div className={styles.overviewCardHead}><h2 id="overview-recent-title">Recent</h2><Link href={expensesAddress}>Expenses ›</Link></div>
        <div className="table-cards"><table className={`${styles.overviewTable} ${styles.recentTable}`}>
          <thead><tr><th>Date</th><th>Supplier</th><th>Paid from</th><th className={kit.num}>Amount</th><th aria-label="Open expense" /></tr></thead>
          <tbody>{recent.length ? recent.map(row => <tr key={row.expense_id} className={kit.clickableRow} onClick={() => onOpenExpense(row, recent)}>
            <td data-label="Date">{row.incurred_date ? consoleDay(row.incurred_date) : 'Dates to review'}</td>
            <td className={`table-cards-title ${styles.overviewRecentSupplier}`}>{supplier(row, recent)}</td>
            <td data-label="Paid from">{SOURCES[row.payment_source]}</td>
            <td data-label="Amount" className={kit.num}>{money(businessCents(row))}</td><td className={kit.rowDoor} aria-hidden>›</td>
          </tr>) : <tr><td colSpan={5} className={kit.empty}>Your first expense will appear here.</td></tr>}</tbody>
        </table></div>
      </section>
    </div>
  </section>;
}

export default function BookkeepingClient({ initialExpenses, initialRevisions, initialDateSchemaReady, initialTaxSchemaReady, initialConversionSchemaReady, initialGstSchemaReady, initialRegistrationDate, initialOwnerMovements, initialOwnerRevisions, initialOwnerSchemaReady }: {
  initialExpenses: ExpenseRevision[]; initialRevisions: ExpenseRevision[]; initialDateSchemaReady: boolean; initialTaxSchemaReady: boolean; initialConversionSchemaReady: boolean;
  initialGstSchemaReady: boolean; initialRegistrationDate: string | null;
  initialOwnerMovements: OwnerMovementRevision[]; initialOwnerRevisions: OwnerMovementRevision[]; initialOwnerSchemaReady: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useMemo(() => new URLSearchParams(searchParams.toString()), [searchParams]);
  const place = bookkeepingPlace(params);
  const view: BookkeepingView = place.view;
  const [expenses, setExpenses] = useState<ExpenseRevision[]>(initialExpenses);
  const [revisions, setRevisions] = useState<ExpenseRevision[]>(initialRevisions);
  const [dateSchemaReady, setDateSchemaReady] = useState(initialDateSchemaReady);
  const [taxSchemaReady, setTaxSchemaReady] = useState(initialTaxSchemaReady);
  const [conversionSchemaReady, setConversionSchemaReady] = useState(initialConversionSchemaReady);
  const [gstSchemaReady, setGstSchemaReady] = useState(initialGstSchemaReady);
  // GST/HST Stage 4a: every credit, and the register's "GST/HST number missing" reason, reads this one date.
  const [registrationDate, setRegistrationDate] = useState(initialRegistrationDate);
  const storageReady = dateSchemaReady && taxSchemaReady && conversionSchemaReady && gstSchemaReady;
  const [selectedExpenseId, setSelectedExpenseId] = useState<string | null>(place.form === 'add' ? null : place.record);
  const [formOpen, setFormOpen] = useState(Boolean(place.form));
  const [editing, setEditing] = useState<ExpenseRevision | null>(() => place.form && place.form !== 'add' ? initialExpenses.find(row => row.expense_id === place.record) ?? null : null);
  const [voidMode, setVoidMode] = useState(place.form === 'void');
  const [focusNumber, setFocusNumber] = useState(false);
  const [copyFrom, setCopyFrom] = useState<ExpenseRevision | null>(null);
  const [recordIds, setRecordIds] = useState<string[] | null>(null);
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
  const [changingRegistration, setChangingRegistration] = useState(false);
  const invalidPeriod = Boolean(from && to && from > to);

  function setView(next: BookkeepingView) {
    router.push(bookkeepingAddress(params, { view: next === 'attention' ? 'expenses' : next,
      attention: next === 'attention', record: null, form: null, movement: null, transfer: null }), { scroll: false });
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
      setGstSchemaReady(Boolean(body.gstSchemaReady));
      setRegistrationDate(typeof body.registrationDate === 'string' ? body.registrationDate : null);
      setError('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load expenses'); }
    finally { setLoading(false); }
  }, []);

  const categories = useMemo(() => [...new Set([...STARTER_CATEGORIES, ...expenses.map(row => row.category)])].sort(), [expenses]);
  const visible = useMemo(() => expenses.filter(row => matchesExpenseFilters(row,
    { from: from || null, to: to || null, category, query, review }, registrationDate)), [expenses, from, to, category, query, review, registrationDate]);
  const datedVisible = useMemo(() => visible.filter(hasConfirmedDates), [visible]);
  const legacyVisible = useMemo(() => visible.filter(row => !hasConfirmedDates(row) && !row.void_reason), [visible]);
  const summary = useMemo(() => summarizeExpenses(datedVisible), [datedVisible]);
  const reportRows = useMemo(() => datedVisible.filter(row => !row.void_reason && (
    reportDrilldown.kind === 'all' ||
    (reportDrilldown.kind === 'category' && row.category === reportDrilldown.key) ||
    (reportDrilldown.kind === 'supplier' && row.supplier === reportDrilldown.key) ||
    (reportDrilldown.kind === 'personal' && row.payment_source === 'personal') ||
    (reportDrilldown.kind === 'tax' && taxTypesPaid(row).includes(reportDrilldown.key))
  )), [datedVisible, reportDrilldown]);
  const selectedExpense = expenses.find(row => row.expense_id === selectedExpenseId) ?? null;
  const addressedExpenseMissing = Boolean(place.record && !expenses.some(row => row.expense_id === place.record));
  const attention = expenses.filter(row => !row.void_reason &&
    attentionReasons(row, registrationDate).length > 0);
  const reportPeriodLabel = reportPeriod === 'all' ? 'All confirmed dates'
    : reportPeriod === 'custom' ? `${from ? consoleDate(from) : 'Any start'} to ${to ? consoleDate(to) : 'Any end'}`
    : reportPeriodRange(reportPeriod, today()).label;
  const drilldownLabel = reportDrilldown.kind === 'category' || reportDrilldown.kind === 'supplier' ? reportDrilldown.key
    : reportDrilldown.kind === 'tax' ? TAX_PAID_ROW_LABELS[reportDrilldown.key]
    : reportDrilldown.kind === 'personal' ? 'Paid personally' : 'All recorded expenses';

  function chooseReportPeriod(value: ReportPeriod) {
    setReportPeriod(value);
    setReportDrilldown({ kind: 'all' });
    if (value === 'all') { setFrom(''); setTo(''); }
    else if (value !== 'custom') { const range = reportPeriodRange(value, today()); setFrom(range.from); setTo(range.to); }
  }

  const registerFilter = expenseRegisterSelection(params, tournamentToday()).filters;
  const defaultRecordRows = view === 'expenses' && registerFilter ? currentExpenses(expenses).filter(row => matchesExpenseFilters(row, registerFilter, registrationDate))
    : view === 'reports' ? reportRows : currentExpenses(expenses).filter(row => !row.void_reason);
  const windowExpense = formOpen ? editing : selectedExpense;
  const recordRows = recordIds ? recordIds.flatMap(id => expenses.find(row => row.expense_id === id) ?? []) : [...defaultRecordRows];
  if (windowExpense && !recordRows.some(row => row.expense_id === windowExpense.expense_id)) recordRows.push(windowExpense);
  const recordIndex = recordRows.findIndex(row => row.expense_id === windowExpense?.expense_id);
  const recordSteps = windowExpense ? { position: `${recordIndex + 1} of ${recordRows.length}`, noun: 'expense',
    prev: recordIndex > 0 ? { name: recordRows[recordIndex - 1].supplier, onStep: () => stepTo(recordRows[recordIndex - 1].expense_id) } : null,
    next: recordIndex < recordRows.length - 1 ? { name: recordRows[recordIndex + 1].supplier, onStep: () => stepTo(recordRows[recordIndex + 1].expense_id) } : null } : undefined;
  function stepTo(id: string) { setFormOpen(false); setEditing(null); setVoidMode(false); setFocusNumber(false); setSelectedExpenseId(id); }
  function openRecord(row: ExpenseRevision, list?: ExpenseRevision[]) { setRecordIds((list ?? defaultRecordRows).map(item => item.expense_id)); setSelectedExpenseId(row.expense_id); }
  function openForm(row: ExpenseRevision | null = null, asVoid = false, copy: ExpenseRevision | null = null, toNumber = false) {
    setCopyFrom(copy); setFocusNumber(toNumber); if (!row) setRecordIds(null);
    setEditing(row); setVoidMode(asVoid);
    if (!row) setSelectedExpenseId(null);
    setFormOpen(true);
  }
  function expenseSaved(saved: ExpenseRevision) {
    setCopyFrom(null);
    setNotice(saved.void_reason ? 'Expense voided; its history is retained.' : saved.revision > 1 ? 'Correction saved with history.' : 'Expense saved.');
    setExpenses(current => [saved, ...current.filter(row => row.expense_id !== saved.expense_id)]);
    setRevisions(current => [...current, saved]);
    setSelectedExpenseId(saved.expense_id); setFormOpen(false); setEditing(null); setVoidMode(false); setFocusNumber(false);
    void load();
  }

  async function exportExpenses(kind: 'csv' | 'package', filters?: ExpenseFilters) {
    setExporting(kind); setError('');
    try {
      const params = expenseFilterParams(filters ?? { from: from || null, to: to || null, category, query, review });
      if (!filters && view === 'reports' && reportDrilldown.kind !== 'all') {
        params.set('dateStatus', 'confirmed');
        if (reportDrilldown.kind === 'category') params.set('category', reportDrilldown.key);
        if (reportDrilldown.kind === 'supplier') params.set('supplier', reportDrilldown.key);
        if (reportDrilldown.kind === 'personal') params.set('paymentSource', 'personal');
        if (reportDrilldown.kind === 'tax') params.set('taxType', reportDrilldown.key);
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
      <button type="button" className={`${styles.primaryAction} ${styles.phoneAdd}`} aria-label="Add expense" onClick={() => openForm()} disabled={!storageReady}>+</button>
    } />
    <div className={styles.tabRow}>
      <nav className={`${kit.tabs} ${styles.sectionNav}`} aria-label="Bookkeeping sections">
        {BOOKKEEPING_VIEWS.map(section => <Link key={section}
          href={bookkeepingAddress(params, { view: section, record: null, form: null, attention: false, movement: null, transfer: null })}
          className={`${kit.tab} ${place.view === section ? kit.tabOn : ''}`}
          aria-current={place.view === section ? 'page' : undefined}>
          {section[0].toUpperCase() + section.slice(1)}
          {section === 'expenses' && attention.length > 0 && <span className={kit.tabCount}>{attention.length}</span>}
        </Link>)}
      </nav>
      <button type="button" className={`${styles.primaryAction} ${styles.desktopAdd}`} onClick={() => openForm()} disabled={!storageReady}>+ Add expense</button>
    </div>

    {error && <p role="alert" className={styles.error}>{error}</p>}
    {notice && <p role="status" className={styles.notice}>{notice}</p>}
    {addressedExpenseMissing && <p role="alert" className={styles.error}>This expense is unavailable. Open an expense from the list.</p>}
    {!storageReady && <p role="status" className={styles.notice}>Expense entry is paused while bookkeeping storage is updated. Existing records and exports remain available.</p>}

    {view === 'ledger' && <OwnerLedger expenses={expenses} initialMovements={initialOwnerMovements} initialRevisions={initialOwnerRevisions}
      schemaReady={initialOwnerSchemaReady} onOpenExpense={openRecord} />}

    {view === 'overview' && <BookkeepingOverview expenses={expenses} params={params} registrationDate={registrationDate} onOpenExpense={openRecord} />}
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
          <label>Review view<select className={kit.select} value={review} onChange={event => setReview(event.target.value as ReviewFilter)}><option value="all">All expenses</option><option value="missing_receipt">Missing receipt</option><option value="missing_conversion">USD source not picked</option><option value="personal">Paid personally</option><option value="foreign">USD invoices</option><option value="tax_pending">Tax review pending</option></select></label>
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
          <section className={styles.taxPaid} aria-labelledby="tax-paid-title">
            <h3 id="tax-paid-title" className={kit.sectionTitle}>{TAX_PAID_TITLE}</h3>
            <div className={`${kit.band} ${styles.taxPaidBand}`}>
              <div className={kit.bandCell}><span className={kit.bandLabel}>GST/HST paid</span><strong className={kit.bandValue}>{money(summary.taxPaid.gstHstCents)}</strong><span className={kit.bandNote}>{expenseCount(summary.taxPaid.gstHstCount)}</span></div>
              <div className={kit.bandCell}><span className={kit.bandLabel}>Charged by simplified sellers</span><strong className={kit.bandValue}>{money(summary.taxPaid.simplifiedCents)}</strong><span className={kit.bandNote}>{expenseCount(summary.taxPaid.simplifiedCount)}</span></div>
              <div className={kit.bandCell}><span className={kit.bandLabel}>Tax unknown</span><strong className={kit.bandValue}>{summary.taxPaid.unknownCount}</strong><span className={kit.bandNote}>{summary.taxPaid.unknownCount === 1 ? 'expense' : 'expenses'}</span></div>
            </div>
            <div className={`table-cards ${styles.taxPaidFrame}`}><table className={styles.taxPaidTable}>
              <thead><tr><th>Tax type</th><th className={kit.num}>Expenses</th><th className={kit.num}>Tax paid</th><th aria-label="Show these expenses" /></tr></thead>
              <tbody>{summary.taxPaid.rows.length ? summary.taxPaid.rows.map(row => <tr key={row.type}
                className={`${kit.clickableRow} ${reportDrilldown.kind === 'tax' && reportDrilldown.key === row.type ? styles.taxPaidOn : ''}`}
                onClick={() => setReportDrilldown({ kind: 'tax', key: row.type })}>
                <td className="table-cards-title"><button type="button" className={styles.taxPaidDoor}
                  onClick={event => { event.stopPropagation(); setReportDrilldown({ kind: 'tax', key: row.type }); }}>{row.label}</button></td>
                <td data-label="Expenses" className={kit.num}>{row.count}</td>
                <td data-label="Tax paid" className={kit.num}>{money(row.cents)}</td>
                <td className={kit.rowDoor} aria-hidden>›</td>
              </tr>) : <tr><td colSpan={4} className={kit.empty}>No purchase tax recorded in this period.</td></tr>}</tbody>
            </table></div>
            <p className={styles.hint}>{TAX_PAID_NOTE}</p>
            {registrationDate && <p className={styles.hint}>{REGISTRATION_LINE(registrationDate)} · <button type="button" className={styles.inlineDoor}
              onClick={() => setChangingRegistration(true)} disabled={!gstSchemaReady}>{REGISTRATION_QUESTION.confirm}</button></p>}
          </section>
          <div className={`${styles.reportGrid} ${styles.reportGridWhole}`}>
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
            <p className={styles.hint}>Missing receipts, unknown dates or tax amounts, missing GST/HST numbers and unpicked USD sources appear in one worklist. Each item opens its expense record.</p>
          </section>
          <section className={styles.reviewList} aria-labelledby="usd-review-title">
            <h3 id="usd-review-title">USD invoices</h3>
            {visible.filter(row => !row.void_reason && row.original_currency === 'USD').length ? visible.filter(row => !row.void_reason && row.original_currency === 'USD').map(row => <p key={row.expense_id}><strong>{row.supplier}</strong> · USD {amount(row.original_cents)} → CAD {amount(row.cad_cents)} · {row.conversion_note || 'USD source not picked'}</p>) : <p>No active USD invoices in this view.</p>}
          </section>
        </section>}
    {view === 'expenses' && <ExpensesRegister expenses={expenses} registrationDate={registrationDate} loading={loading} exporting={Boolean(exporting)}
      onOpenExpense={openRecord} onAddNumber={(row, list) => { setRecordIds(list.map(item => item.expense_id)); openForm(row, false, null, true); }} onExport={exportExpenses} />}

    {changingRegistration && <GstRegistrationQuestion onClose={() => setChangingRegistration(false)}
      onSaved={() => { setNotice(REGISTRATION_QUESTION.saved); void load(); }} />}
    {(formOpen || selectedExpense) && !addressedExpenseMissing && <ExpenseFormWindow key={windowExpense?.expense_id ?? `new-${copyFrom?.expense_id ?? 'blank'}`}
      expense={windowExpense} expenses={expenses} categories={categories} revisions={revisions} copyFrom={copyFrom}
      startEditing={Boolean(formOpen && editing && !voidMode)} asVoid={voidMode} steps={recordSteps}
      registrationDate={registrationDate} focusNumber={Boolean(formOpen && editing && focusNumber)}
      address={bookkeepingAddress(params, { record: windowExpense?.expense_id ?? null, form: windowExpense ? formOpen ? voidMode ? 'void' : 'correct' : null : 'add', movement: null, transfer: null })}
      homeAddress={bookkeepingAddress(params, { record: null, form: null, movement: null, transfer: null })}
      disabled={!storageReady}
      onCopy={row => openForm(null, false, row)}
      onClose={() => { setFormOpen(false); setSelectedExpenseId(null); setEditing(null); setVoidMode(false); setCopyFrom(null); setFocusNumber(false); }} onSaved={expenseSaved} />}
  </div>;
}
