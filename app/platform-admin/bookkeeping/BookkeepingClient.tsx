'use client';

import { useCallback, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import { BOOKKEEPING_VIEWS, bookkeepingAddress, bookkeepingPlace, reportViewControl, type ReportView } from '@/lib/bookkeeping-navigation';
import { consoleDate, consoleDay } from '@/lib/console-dates';
import kit from '../console.module.css';
import { attentionReasons, businessCents, currentExpenses, hasConfirmedDates, summarizeExpenses, type ExpenseRevision, type ReviewFilter } from '@/lib/bookkeeping-expenses';
import { formatCad, REGISTRATION_QUESTION } from '@/lib/bookkeeping-gst';
import GstRegistrationQuestion from './GstRegistrationQuestion';
import { reportPeriodRange } from '@/lib/bookkeeping-export';
import SingleSelectDropdown from '@/components/coaches/SingleSelectDropdown';
import ReportsSpending, { type ReportDrilldown, type ReportPeriod } from './ReportsSpending';
import ReportsGstReturn from './ReportsGstReturn';
import ReportsSales from './ReportsSales';
import type { OwnerMovementRevision } from '@/lib/bookkeeping-owner-movements';
import { downloadCSVBlob } from '@/lib/export';
import OwnerLedger from './OwnerLedger';
import ExpenseFormWindow from './ExpenseFormWindow';
import ExpensesRegister from './ExpensesRegister';
import { expenseFilterParams, matchesExpenseFilters, type ExpenseFilters } from '@/lib/bookkeeping-filters';
import { expensePeriodRange, expenseRegisterSelection } from '@/lib/bookkeeping-register';
import { tournamentToday } from '@/lib/timezone';
import styles from './bookkeeping.module.css';

const SOURCES: Record<string, string> = {
  business_bank: 'Business bank', business_card: 'Business card', personal: 'Paid personally', other: 'Other',
};
const STARTER_CATEGORIES = [
  'Software & online services', 'Advertising & marketing', 'Equipment & supplies',
  'Professional services', 'Travel & meals', 'Bank charges', 'Other',
];
type BookkeepingView = typeof BOOKKEEPING_VIEWS[number] | 'attention';
const NO_FILTERS: ExpenseFilters = { from: null, to: null, category: '', query: '', review: 'all' };
const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const money = formatCad;
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
  const [reportDrilldown, setReportDrilldown] = useState<ReportDrilldown>({});
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
  const drilled = Object.values(reportDrilldown).some(Boolean);
  const reportRows = useMemo(() => datedVisible.filter(row => !row.void_reason &&
    matchesExpenseFilters(row, { ...NO_FILTERS, ...reportDrilldown }, registrationDate)), [datedVisible, reportDrilldown, registrationDate]);
  const selectedExpense = expenses.find(row => row.expense_id === selectedExpenseId) ?? null;
  const addressedExpenseMissing = Boolean(place.record && !expenses.some(row => row.expense_id === place.record));
  const attention = useMemo(() => expenses.filter(row => !row.void_reason &&
    attentionReasons(row, registrationDate).length > 0), [expenses, registrationDate]);
  const reportPeriodLabel = reportPeriod === 'all' ? 'All confirmed dates'
    : reportPeriod === 'custom' ? `${from ? consoleDate(from) : 'Any start'} to ${to ? consoleDate(to) : 'Any end'}`
    : reportPeriodRange(reportPeriod, today()).label;

  function chooseReportPeriod(value: ReportPeriod) {
    setReportPeriod(value);
    setReportDrilldown({});
    if (value === 'all') { setFrom(''); setTo(''); }
    else if (value !== 'custom') { const range = reportPeriodRange(value, today()); setFrom(range.from); setTo(range.to); }
  }

  /* Reports' views (owner 2026-11-07, BOOKKEEPING_REPORTS_VIEW_CONTROL_BUILD_PROMPT.md): one entry per view — its key,
     whether it is available, and its screen. The labels and the default live with the address contract
     (`REPORT_VIEWS` in lib/bookkeeping-navigation.ts). The period (from/to) and the export are the page's, so every view
     reads the same ones. The View pill appears only once two entries are available. A new view that has its own line
     list or drill-down passes its list to openRecord and its filters to exportExpenses; Spending's narrow them only
     while Spending is open (`spendingOpen`). */
  /* The dated views (the return, Sales) need dates: while the shared period is "All confirmed dates" they read this year to date
     (nothing is changed until the owner picks a period there, which then moves the shared one). */
  const yearToDate = reportPeriod === 'all' ? reportPeriodRange('year', today()) : null;
  const datedPeriod = {
    reportPeriod: yearToDate ? 'year' as const : reportPeriod, onChooseReportPeriod: chooseReportPeriod, onCustomPeriod: () => setReportPeriod('custom'),
    from: yearToDate?.from ?? from, to: yearToDate?.to ?? to, onFrom: setFrom, onTo: setTo, invalidPeriod,
  };
  const reportViews: { key: ReportView; available: boolean; render: () => ReactNode }[] = [
    { key: 'spending', available: true, render: () => <ReportsSpending
      reportPeriod={reportPeriod} reportPeriodLabel={reportPeriodLabel} onChooseReportPeriod={chooseReportPeriod} onCustomPeriod={() => setReportPeriod('custom')}
      from={from} to={to} onFrom={setFrom} onTo={setTo} invalidPeriod={invalidPeriod}
      category={category} categories={categories} onCategory={setCategory} query={query} onQuery={setQuery} review={review} onReview={setReview}
      visible={visible} legacyVisible={legacyVisible} summary={summary} reportRows={reportRows}
      drilldown={reportDrilldown} drilled={drilled} onDrilldown={setReportDrilldown}
      exporting={exporting} onExport={kind => exportExpenses(kind)} onOpenExpense={row => openRecord(row)}
      attentionCount={attention.length} onOpenAttention={() => setView('attention')}
      registrationDate={registrationDate} gstSchemaReady={gstSchemaReady} onChangeRegistration={() => setChangingRegistration(true)} /> },
    // GST/HST Stage 4b Session B: the return's lines for the page's period. Its windows hand their own row list to openRecord.
    { key: 'gst_return', available: true, render: () => <ReportsGstReturn {...datedPeriod} expenses={expenses}
      onOpenExpense={(row, list) => openRecord(row, list)}
      onAddNumber={(row, list) => { setRecordIds(list.map(item => item.expense_id)); openForm(row, false, null, true); }} /> },
    // Plans & pricing Stage 2 Part 4d: sales by month from the return's own rows, for the page's period. Its Accountant package
    // is the page's, for the same dates.
    { key: 'sales', available: true, render: () => <ReportsSales {...datedPeriod} exporting={exporting === 'package'}
      onPackage={(packageFrom, packageTo) => exportExpenses('package', { ...NO_FILTERS, from: packageFrom, to: packageTo })} /> },
  ];
  const reportControl = reportViewControl(place.report, reportViews);
  /** Spending's drill-down and line list narrow the export and the record window only while Spending is the view on screen. */
  const spendingOpen = view === 'reports' && reportControl.current === 'spending';
  const registerFilter = expenseRegisterSelection(params, tournamentToday()).filters;
  const defaultRecordRows = view === 'expenses' && registerFilter ? currentExpenses(expenses).filter(row => matchesExpenseFilters(row, registerFilter, registrationDate))
    : spendingOpen ? reportRows : currentExpenses(expenses).filter(row => !row.void_reason);
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
      const screen: ExpenseFilters = { from: from || null, to: to || null, category, query, review };
      const params = expenseFilterParams(filters ?? (spendingOpen && drilled
        ? { ...screen, ...Object.fromEntries(Object.entries(reportDrilldown).filter(([, value]) => value)), dateStatus: 'confirmed', status: 'active' } : screen));
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
    {view === 'reports' && <>
      {reportControl.options && <div className={styles.reportViewBar}>
        <SingleSelectDropdown lead label="View" options={reportControl.options} value={reportControl.current}
          onChange={next => { if (next !== reportControl.current) router.push(bookkeepingAddress(params, { report: next as ReportView,
            record: null, form: null, movement: null, transfer: null }), { scroll: false }); }} />
      </div>}
      {reportViews.find(entry => entry.key === reportControl.current && entry.available)?.render()}
    </>}
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
