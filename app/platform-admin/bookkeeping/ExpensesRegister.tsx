'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import DateInput from '@/components/shared/DateInput';
import { attentionReasons, businessCents, currentExpenses, hasConfirmedDates, needsSupplierTaxNumber, summarizeExpenses, type ExpenseRevision } from '@/lib/bookkeeping-expenses';
import { matchesExpenseFilters, type ExpenseFilters } from '@/lib/bookkeeping-filters';
import { formatCad, taxPaidRowLabel } from '@/lib/bookkeeping-gst';
import { EXPENSE_PERIODS, expensePeriodRange, expenseRegisterSelection } from '@/lib/bookkeeping-register';
import { bookkeepingAddress } from '@/lib/bookkeeping-navigation';
import { consoleDay } from '@/lib/console-dates';
import { tournamentToday } from '@/lib/timezone';
import { rovingMenuKey, useAnchoredMenu, useDismissable } from '@/lib/overlay-hooks';
import kit from '../console.module.css';
import styles from './bookkeeping.module.css';

const SOURCES: Record<string, string> = { business_bank: 'Business bank', business_card: 'Business card', personal: 'Paid personally', other: 'Other' };
const money = formatCad;

function ExpenseExportMenu({ disabled, onExport }: { disabled: boolean; onExport: (kind: 'csv' | 'package') => void }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const focusPending = useRef(false);
  const first = useRef(0);
  const id = useId();
  const placement = useAnchoredMenu(open, trigger, panel, { minWidth: 224, narrowMinWidth: 200 });
  useDismissable(open, wrap, () => setOpen(false), () => { setOpen(false); trigger.current?.focus({ preventScroll: true }); });
  useEffect(() => {
    if (!open || !placement || !focusPending.current) return;
    focusPending.current = false;
    panel.current?.querySelectorAll<HTMLButtonElement>('button')[first.current]?.focus({ preventScroll: true });
  }, [open, placement]);
  function show(at: number) { first.current = at; focusPending.current = true; setOpen(true); }
  return <div ref={wrap}>
    <button ref={trigger} type="button" className={styles.quietButton} disabled={disabled} aria-label="Export" aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined}
      onClick={() => open ? setOpen(false) : show(0)} onKeyDown={event => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); show(event.key === 'ArrowUp' ? 1 : 0); }
      }}>Export ▾</button>
    {open && <div id={id} ref={panel} role="menu" aria-label="Export expenses" className={styles.expenseExportMenu}
      style={{ ...placement, visibility: placement ? 'visible' : 'hidden' }} onKeyDown={event => {
        rovingMenuKey(event, Array.from(panel.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []));
        if (event.key === 'Tab') { setOpen(false); trigger.current?.focus({ preventScroll: true }); }
      }}>
      {([['csv', 'Export CSV'], ['package', 'Accountant package']] as const).map(([kind, label]) =>
        <button key={kind} type="button" role="menuitem" tabIndex={-1} onClick={() => { setOpen(false); trigger.current?.focus({ preventScroll: true }); onExport(kind); }}>{label}</button>)}
    </div>}
  </div>;
}

export default function ExpensesRegister({ expenses, registrationDate, loading, exporting, onOpenExpense, onAddNumber, onExport }: {
  expenses: ExpenseRevision[]; registrationDate: string | null; loading: boolean; exporting: boolean;
  onOpenExpense: (row: ExpenseRevision, list?: ExpenseRevision[]) => void;
  /** A Needs attention row waiting on the supplier's GST/HST number opens its correction form at that field (drawings tab 3). */
  onAddNumber: (row: ExpenseRevision, list: ExpenseRevision[]) => void;
  onExport: (kind: 'csv' | 'package', filters: ExpenseFilters) => void;
}) {
  const searchParams = useSearchParams();
  const params = useMemo(() => new URLSearchParams(searchParams.toString()), [searchParams]);
  const today = tournamentToday();
  const { period, filters } = expenseRegisterSelection(params, today);
  const visible = filters ? currentExpenses(expenses).filter(row => matchesExpenseFilters(row, filters, registrationDate)) : [];
  const categories = [...new Set(expenses.map(row => row.category))].sort();
  const attentionCount = filters ? currentExpenses(expenses).filter(row =>
    matchesExpenseFilters(row, { ...filters, status: 'active', review: 'all' }, registrationDate) && attentionReasons(row, registrationDate).length > 0).length : 0;
  const legacyCount = visible.filter(row => !row.void_reason && !hasConfirmedDates(row)).length;
  const total = summarizeExpenses(visible.filter(hasConfirmedDates)).recordedSpendCents;
  const attention = filters?.review === 'attention';
  const currentCategory = params.get('category') ?? '';
  const open = (row: ExpenseRevision) => attention && needsSupplierTaxNumber(row, registrationDate) ? onAddNumber(row, visible) : onOpenExpense(row, visible);

  function update(changes: Record<string, string | null>) {
    // The local list already has its data. Native history integrates with useSearchParams in Next 16,
    // preserving a typeable search without fetching the DSQL-backed page on every character.
    const next = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(changes)) {
      if (!value) next.delete(key); else next.set(key, value);
    }
    window.history.replaceState(null, '', bookkeepingAddress(next, { view: 'expenses' }));
  }
  function clearFilters() {
    update({ period: 'month', from: null, to: null, category: null, paymentSource: null, status: 'active', q: null, review: null, attention: null, supplier: null, taxType: null, dateStatus: null });
  }

  return <section className={styles.expenseRegister} aria-labelledby="register-title">
    <h2 id="register-title" className="sr-only">Expenses</h2>
    <div className={`${kit.toolbar} ${styles.expenseToolbar}`}>
      <select aria-label="Period" className={`${kit.select} ${styles.periodPill}`} value={period}
        onChange={event => update({ period: event.target.value, ...(event.target.value === 'custom' ? {} : { from: null, to: null }) })}>
        {EXPENSE_PERIODS.map(value => <option key={value} value={value}>{expensePeriodRange(value, today).label}</option>)}
      </select>
      <span className={kit.count} aria-live="polite">{visible.length} {filters?.status === 'voided' ? 'voided ' : ''}{visible.length === 1 ? 'expense' : 'expenses'}
        {filters?.status !== 'voided' && <> · {money(total)}{filters?.status === 'all' ? ' active spend' : ''}</>}</span>
      <select aria-label="Category" className={`${kit.select} ${styles.filterPill}`} value={currentCategory} onChange={event => update({ category: event.target.value })}>
        <option value="">Category</option>{currentCategory && !categories.includes(currentCategory) && <option>{currentCategory}</option>}
        {categories.map(value => <option key={value}>{value}</option>)}
      </select>
      <select aria-label="Paid from" className={`${kit.select} ${styles.filterPill}`} value={filters?.paymentSource ?? ''} onChange={event => update({ paymentSource: event.target.value })}>
        <option value="">Paid from</option>{Object.entries(SOURCES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      <select aria-label="Status" className={`${kit.select} ${styles.filterPill}`} value={filters?.status ?? 'active'} onChange={event => update({ status: event.target.value })}>
        <option value="active">Active</option><option value="voided">Voided</option><option value="all">All</option>
      </select>
      <button type="button" className={styles.attentionPill} aria-pressed={attention}
        onClick={() => update({ attention: attention ? null : '1', review: null, ...(attention ? {} : { status: 'active' }) })}>
        Needs attention <span className={styles.attentionCount}>{attentionCount}</span>
      </button>
      <div className={`${kit.toolbarEnd} ${styles.expenseToolbarEnd}`}>
        <input aria-label="Search expenses" className={kit.search} type="search" maxLength={160} placeholder="Search expenses…" value={params.get('q') ?? ''} onChange={event => update({ q: event.target.value })} />
        <ExpenseExportMenu disabled={exporting || !filters || !visible.length} onExport={kind => { if (filters) onExport(kind, filters); }} />
      </div>
    </div>
    {period === 'custom' && <div className={styles.registerDates}>
      <label>From · incurred date<DateInput value={filters?.from ?? ''} onChange={value => update({ from: value })} /></label>
      <label>To · incurred date<DateInput value={filters?.to ?? ''} onChange={value => update({ to: value })} /></label>
    </div>}
    {(!filters || filters.supplier || filters.taxType || (filters.dateStatus === 'confirmed') || (filters.review !== 'all' && filters.review !== 'attention')) && <div className={styles.registerNote}>
      {!filters ? <span role="alert">These filters are invalid. Choose valid dates and filters, or reset them.</span> : <span>Additional filters: {filters.supplier && `Supplier ${filters.supplier} · `}{filters.taxType && `${taxPaidRowLabel(filters.taxType)} · `}{filters.dateStatus === 'confirmed' && 'Confirmed dates · '}{filters.review !== 'all' && filters.review !== 'attention' ? filters.review.replaceAll('_', ' ') : ''}</span>}
      <button type="button" className={styles.textButton} onClick={clearFilters}>Reset filters</button>
    </div>}
    {legacyCount > 0 && <p className={styles.registerNote}>{legacyCount} {legacyCount === 1 ? 'expense has' : 'expenses have'} dates to review and {legacyCount === 1 ? 'is' : 'are'} excluded from the period spending total.</p>}
    {attention && <h3 className="sr-only">Needs attention</h3>}
    <div className={`table-cards ${styles.expenseTableWrap}`}>
      <table className={styles.expensesTable} aria-busy={loading}>
        <thead><tr><th>Date</th><th>Supplier</th><th>What for</th><th>Category</th><th>Paid from</th><th>Receipt</th><th className={kit.num}>Amount</th><th aria-label="Open expense" /></tr></thead>
        <tbody>{!visible.length && <tr><td colSpan={8} className={kit.empty}>{loading ? 'Loading expenses…' : 'No expenses match this view.'}</td></tr>}
          {visible.map(row => <tr key={row.expense_id} className={`${kit.clickableRow} ${row.void_reason ? styles.voidedExpense : ''}`} onClick={() => open(row)}>
            <td data-label="Date" className={styles.registerDate}>{row.incurred_date ? consoleDay(row.incurred_date) : 'Dates to review'}</td>
            <td className={`table-cards-title ${styles.supplierCell}`}>
              <Link className={styles.expenseName} href={bookkeepingAddress(params, { view: 'expenses', record: row.expense_id, form: attention && needsSupplierTaxNumber(row, registrationDate) ? 'correct' : null })}
                onClick={event => { event.stopPropagation(); if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && event.button === 0) { event.preventDefault(); open(row); } }} title={row.supplier}>{row.supplier}</Link>
              {row.void_reason && <span className={`${kit.chip} ${kit.chipQuiet}`}>Voided</span>}
            </td>
            <td data-label="What for" className={styles.registerPurpose}>
              <div className={styles.purposeLine}><span className={styles.purposeText} title={row.business_purpose}>{row.business_purpose}</span>{row.original_currency === 'USD' && <span>· USD {(row.original_cents / 100).toFixed(2)}</span>}</div>
              {attention && <span className={styles.reasonChips}>{attentionReasons(row, registrationDate).map(reason => <span key={reason} className={`${kit.chip} ${kit.chipWarn}`}>{reason}</span>)}</span>}
            </td>
            <td data-label="Category" className={styles.registerCategory} title={row.category}>{row.category}</td>
            <td data-label="Paid from" className={styles.registerSource}>{SOURCES[row.payment_source]}</td>
            <td data-label="Receipt">{row.receipt_path ? <span role="img" aria-label="Receipt attached">✓</span> : <span className={`${kit.chip} ${kit.chipWarn}`}>Missing</span>}</td>
            <td data-label="Amount" className={kit.num}><span className={row.void_reason ? styles.voidedAmount : undefined}>{money(businessCents(row))}</span></td>
            <td className={kit.rowDoor} aria-hidden>›</td>
          </tr>)}
        </tbody>
      </table>
    </div>
    <p className={styles.registerNote}>Accountant package follows these filters. Use Reports for a full-period package.</p>
  </section>;
}
