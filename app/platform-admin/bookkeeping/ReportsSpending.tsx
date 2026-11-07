'use client';

/**
 * Reports › Spending — the report as it stood before Reports had views, MOVED IN UNCHANGED (owner 2026-11-07,
 * BOOKKEEPING_REPORTS_VIEW_CONTROL_BUILD_PROMPT.md). Copy, order, filters and figures are today's; tidying it is
 * ladder row 3's own work (BOOKKEEPING_OWNER_EXPERIENCE_PLAN.md §3), not this split's.
 *
 * ⚠ The state stays with the page, not here. The filters outlive a trip to another tab, the drill-down's rows are the
 * record window's Previous · Next list, and the export reads both — so this view is handed them rather than owning them.
 */
import { consoleDate } from '@/lib/console-dates';
import kit from '../console.module.css';
import { businessCents, summarizeExpenses, type ExpenseRevision, type ReviewFilter } from '@/lib/bookkeeping-expenses';
import { formatCad, REGISTRATION_LINE, REGISTRATION_QUESTION, TAX_PAID_NOTE, TAX_PAID_TITLE, taxPaidRowLabel } from '@/lib/bookkeeping-gst';
import { pluralize } from '@/lib/utils';
import type { NamedReportPeriod } from '@/lib/bookkeeping-export';
import type { ExpenseFilters } from '@/lib/bookkeeping-filters';
import DateInput from '@/components/shared/DateInput';
import styles from './bookkeeping.module.css';

const SOURCES: Record<string, string> = {
  business_bank: 'Business bank', business_card: 'Business card', personal: 'Paid personally', other: 'Other',
};
export type ReportPeriod = 'all' | NamedReportPeriod | 'custom';
/** A Reports door narrows the line list with the same filter fields the export reads, so the screen and the export are one object. */
export type ReportDrilldown = Partial<Pick<ExpenseFilters, 'category' | 'supplier' | 'paymentSource' | 'taxType'>>;
function drilldownLabel(drill: ReportDrilldown): string {
  if (drill.taxType) return taxPaidRowLabel(drill.taxType);
  return drill.category || drill.supplier || (drill.paymentSource === 'personal' ? 'Paid personally' : 'All recorded expenses');
}
const money = formatCad;
const amount = (cents: number) => (cents / 100).toFixed(2);

export default function ReportsSpending({
  reportPeriod, reportPeriodLabel, onChooseReportPeriod, onCustomPeriod, from, to, onFrom, onTo, invalidPeriod,
  category, categories, onCategory, query, onQuery, review, onReview,
  visible, legacyVisible, summary, reportRows, drilldown, drilled, onDrilldown,
  exporting, onExport, onOpenExpense, attentionCount, onOpenAttention,
  registrationDate, gstSchemaReady, onChangeRegistration,
}: {
  reportPeriod: ReportPeriod; reportPeriodLabel: string; onChooseReportPeriod: (value: ReportPeriod) => void; onCustomPeriod: () => void;
  from: string; to: string; onFrom: (value: string) => void; onTo: (value: string) => void; invalidPeriod: boolean;
  category: string; categories: string[]; onCategory: (value: string) => void;
  query: string; onQuery: (value: string) => void; review: ReviewFilter; onReview: (value: ReviewFilter) => void;
  visible: ExpenseRevision[]; legacyVisible: ExpenseRevision[]; summary: ReturnType<typeof summarizeExpenses>; reportRows: ExpenseRevision[];
  drilldown: ReportDrilldown; drilled: boolean; onDrilldown: (drill: ReportDrilldown) => void;
  exporting: 'csv' | 'package' | null; onExport: (kind: 'csv' | 'package') => void;
  onOpenExpense: (row: ExpenseRevision) => void; attentionCount: number; onOpenAttention: () => void;
  registrationDate: string | null; gstSchemaReady: boolean; onChangeRegistration: () => void;
}) {
  return <section className={styles.panel} aria-labelledby="report-title">
    <div className={styles.viewHeading}><div><p className={styles.eyebrow}>Recorded expenses</p><h2 id="report-title">Expense report</h2>
      <p>{reportPeriodLabel} · Period totals use confirmed incurred dates. Older dates to review appear separately.</p></div>
      <div className={styles.exportActions}><button type="button" className={styles.export} onClick={() => onExport('csv')} disabled={!!exporting || invalidPeriod}>{exporting === 'csv' ? 'Preparing CSV…' : 'Export CSV'}</button>
        <button type="button" className={styles.export} onClick={() => onExport('package')} disabled={!!exporting || invalidPeriod}>{exporting === 'package' ? 'Preparing package…' : 'Accountant package'}</button></div></div>
    <div className={styles.filters}>
      <label>Period<select className={kit.select} value={reportPeriod} onChange={event => onChooseReportPeriod(event.target.value as ReportPeriod)}><option value="all">All confirmed dates</option><option value="month">This month to date</option><option value="year">This year to date</option><option value="last_month">Last month</option><option value="last_quarter">Last quarter</option><option value="last_year">Last calendar year</option><option value="custom">Custom dates</option></select></label>
      <label>From · incurred date<DateInput className={kit.field} value={from} onChange={v => { onFrom(v); onCustomPeriod(); }} /></label>
      <label>To · incurred date<DateInput className={kit.field} value={to} onChange={v => { onTo(v); onCustomPeriod(); }} /></label>
      <label>Category<select className={kit.select} value={category} onChange={event => onCategory(event.target.value)}><option value="">All categories</option>{categories.map(value => <option key={value}>{value}</option>)}</select></label>
      <label>Find<input className={kit.field} type="search" value={query} onChange={event => onQuery(event.target.value)} placeholder="Supplier or purpose" /></label>
    <label>Review view<select className={kit.select} value={review} onChange={event => onReview(event.target.value as ReviewFilter)}><option value="all">All expenses</option><option value="missing_receipt">Missing receipt</option><option value="missing_conversion">USD source not picked</option><option value="personal">Paid personally</option><option value="foreign">USD invoices</option><option value="tax_pending">Tax review pending</option></select></label>
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
      {legacyVisible.map(row => <button type="button" className={styles.listDoor} key={row.expense_id} onClick={() => onOpenExpense(row)}><span><strong>{row.supplier}</strong><small>Recorded date {consoleDate(row.expense_date)} · meaning unconfirmed</small></span><b>{money(businessCents(row))}</b></button>)}</section>}
    <div className={styles.reportGrid}>
      <div><h3>By category</h3>{summary.byCategory.length ? summary.byCategory.map(([name, cents]) => <button key={name} type="button" className={styles.reportDoor} onClick={() => onDrilldown({ category: name })}><span>{name}</span><strong>{money(cents)} ›</strong></button>) : <p>No confirmed expenses in this period.</p>}</div>
      <div><h3>By supplier</h3>{summary.bySupplier.length ? summary.bySupplier.map(([name, cents]) => <button key={name} type="button" className={styles.reportDoor} onClick={() => onDrilldown({ supplier: name })}><span>{name}</span><strong>{money(cents)} ›</strong></button>) : <p>No confirmed expenses in this period.</p>}</div>
    </div>
    <section className={styles.taxPaid} aria-labelledby="tax-paid-title">
      <h3 id="tax-paid-title" className={kit.sectionTitle}>{TAX_PAID_TITLE}</h3>
      <div className={`${kit.band} ${styles.taxPaidBand}`}>
        <div className={kit.bandCell}><span className={kit.bandLabel}>GST/HST paid</span><strong className={kit.bandValue}>{money(summary.taxPaid.gstHstCents)}</strong><span className={kit.bandNote}>{pluralize(summary.taxPaid.gstHstCount, 'expense')}</span></div>
        <div className={kit.bandCell}><span className={kit.bandLabel}>Charged by simplified sellers</span><strong className={kit.bandValue}>{money(summary.taxPaid.simplifiedCents)}</strong><span className={kit.bandNote}>{pluralize(summary.taxPaid.simplifiedCount, 'expense')}</span></div>
        <div className={kit.bandCell}><span className={kit.bandLabel}>Tax unknown</span><strong className={kit.bandValue}>{summary.taxPaid.unknownCount}</strong><span className={kit.bandNote}>{summary.taxPaid.unknownCount === 1 ? 'expense' : 'expenses'}</span></div>
      </div>
      <div className={`table-cards ${styles.taxPaidFrame}`}><table className={styles.taxPaidTable}>
        <thead><tr><th>Tax type</th><th className={kit.num}>Expenses</th><th className={kit.num}>Tax paid</th><th aria-label="Show these expenses" /></tr></thead>
        <tbody>{summary.taxPaid.rows.length ? summary.taxPaid.rows.map(row => <tr key={row.type}
          className={`${kit.clickableRow} ${drilldown.taxType === row.type ? styles.taxPaidOn : ''}`}
          onClick={() => onDrilldown({ taxType: row.type })}>
          <td className="table-cards-title"><button type="button" className={styles.taxPaidDoor}
            onClick={event => { event.stopPropagation(); onDrilldown({ taxType: row.type }); }}>{row.label}</button></td>
          <td data-label="Expenses" className={kit.num}>{row.count}</td>
          <td data-label="Tax paid" className={kit.num}>{money(row.cents)}</td>
          <td className={kit.rowDoor} aria-hidden>›</td>
        </tr>) : <tr><td colSpan={4} className={kit.empty}>No purchase tax recorded in this period.</td></tr>}</tbody>
      </table></div>
      <p className={styles.hint}>{TAX_PAID_NOTE}</p>
      {registrationDate && <p className={styles.hint}>{REGISTRATION_LINE(registrationDate)} · <button type="button" className={styles.inlineDoor}
        onClick={onChangeRegistration} disabled={!gstSchemaReady}>{REGISTRATION_QUESTION.confirm}</button></p>}
    </section>
    <div className={`${styles.reportGrid} ${styles.reportGridWhole}`}>
      <div><h3>Recorded spend by payment source</h3>{summary.byPaymentSource.length ? summary.byPaymentSource.map(([source, cents]) => source === 'personal' ? <button type="button" className={styles.reportDoor} key={source} onClick={() => onDrilldown({ paymentSource: 'personal' })}><span>{SOURCES[source]}</span><strong>{money(cents)} ›</strong></button> : <p key={source}><span>{SOURCES[source]}</span><strong>{money(cents)}</strong></p>) : <p>No active expenses.</p>}</div>
    </div>
    <section className={styles.reviewList} aria-labelledby="report-lines-title"><div className={styles.subHeading}><h3 id="report-lines-title">{drilldownLabel(drilldown)} · {money(reportRows.reduce((total, row) => total + businessCents(row), 0))}</h3>
      {drilled && <button type="button" className={styles.textButton} onClick={() => onDrilldown({})}>Show all entries</button>}</div>
      <p className={styles.hint}>{reportRows.length} contributing expense(s) · {reportPeriodLabel}. Open a row to see its receipt and revisions.</p>
      {reportRows.map(row => <button key={row.expense_id} type="button" className={styles.listDoor} onClick={() => onOpenExpense(row)}><span><strong>{row.supplier}</strong><small>{consoleDate(row.incurred_date)} · {row.category} · {SOURCES[row.payment_source]}</small></span><b>{money(businessCents(row))} ›</b></button>)}
      {!reportRows.length && <p className={styles.empty}>No expenses contribute to this figure.</p>}
    </section>
    <p className={styles.hint}>Paid personally: {money(summary.personallyPaidCents)} across active expenses. A later reimbursement or owner movement is a separate record and must not be entered as another expense here.</p>
    <section className={styles.reviewList} aria-labelledby="evidence-review-title">
      <div className={styles.subHeading}><h3 id="evidence-review-title">Needs attention</h3><button type="button" className={styles.textButton} onClick={onOpenAttention}>Open worklist · {attentionCount}</button></div>
      <p className={styles.hint}>Missing receipts, unknown dates or tax amounts, missing GST/HST numbers and unpicked USD sources appear in one worklist. Each item opens its expense record.</p>
    </section>
    <section className={styles.reviewList} aria-labelledby="usd-review-title">
      <h3 id="usd-review-title">USD invoices</h3>
      {visible.filter(row => !row.void_reason && row.original_currency === 'USD').length ? visible.filter(row => !row.void_reason && row.original_currency === 'USD').map(row => <p key={row.expense_id}><strong>{row.supplier}</strong> · USD {amount(row.original_cents)} → CAD {amount(row.cad_cents)} · {row.conversion_note || 'USD source not picked'}</p>) : <p>No active USD invoices in this view.</p>}
    </section>
  </section>;
}
