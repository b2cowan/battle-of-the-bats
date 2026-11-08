'use client';

/**
 * Reports › Sales (Plans & pricing Stage 2 Part 4d; build prompt docs/projects/active/PLANS_PRICING_STAGE2_PART4_BUILD_PROMPT.md;
 * drawings https://claude.ai/artifact/PqUgoHqg57j1SGSo2YypjP, tab "Sales by month" and the States tab).
 *
 * ⚖ THE SCREEN LAYS OUT `buildSalesReport` (lib/sales-by-month.ts) AND DECIDES NOTHING: every month, figure, chip and the line-101
 * sentence come from it through the route; the words are its `SALES_WORDS`.
 * ⚖ Owner only (the Bookkeeping gate). Read only. Tax apart, test never mixed with live, a sale not valued in CAD is counted apart.
 * The period is the page's (shared with Spending and the return); like the return, "All confirmed dates" reads this year to date.
 */
import { useState, type ReactNode } from 'react';
import kit from '../console.module.css';
import KitDialog from '@/components/shared/KitDialog';
import { consoleDate, consoleDay } from '@/lib/console-dates';
import { csvCell } from '@/lib/bookkeeping-expenses';
import { downloadCSVBlob } from '@/lib/export';
import { saleCents } from '@/lib/console-money-sales';
import {
  invoiceBuyer, monthLabel, SALES_EVENT_LABELS, SALES_KIND_LABELS, SALES_WORDS, salesCsvRows, salesMoney, takenOff,
  type SalesEvent, type SalesFigures, type SalesMonth, type SalesReport,
} from '@/lib/sales-by-month';
import type { SalesReportRead } from '@/lib/sales-by-month-read';
import type { ReportPeriod } from './ReportsSpending';
import { DatedPeriodPicker } from './ReportsGstReturn';
import { useReportRead } from './useReportRead';
import gst from './ReportsGstReturn.module.css';
import styles from './ReportsSales.module.css';

type Row = { kind: 'month'; month: SalesMonth } | { kind: 'beforeRecord'; first: SalesMonth; last: SalesMonth };

/** Consecutive months wholly before our record are one quiet row, not a column of dashes. */
function rowsOf(months: readonly SalesMonth[]): Row[] {
  const out: Row[] = [];
  for (const month of months) {
    const prev = out.at(-1);
    if (month.beforeRecord && prev?.kind === 'beforeRecord') prev.first = month;
    else out.push(month.beforeRecord ? { kind: 'beforeRecord', first: month, last: month } : { kind: 'month', month });
  }
  return out;
}
const dash = (cents: number) => (cents ? salesMoney(cents) : '—');

/** The figure columns, in the drawing's order: a month row, the period's total and (the first five) a kind row all use them. */
const COLUMNS: { label: string; cell: (f: SalesFigures) => ReactNode }[] = [
  { label: 'Invoiced', cell: f => dash(f.invoiced) },
  { label: 'Voided', cell: f => takenOff(f.voided) },
  { label: 'Credit notes', cell: f => takenOff(f.creditNotes) },
  { label: 'Net sales', cell: f => salesMoney(f.net) },
  { label: 'GST/HST', cell: f => dash(f.gstHst) },
  { label: 'Collected', cell: f => dash(f.collected) },
  { label: 'Written off', cell: f => <>{dash(f.writtenOff)}{f.recovered > 0 && <span className={kit.sub}>{salesMoney(f.recovered)} recovered</span>}</> },
];
const KIND_COLUMNS = COLUMNS.slice(0, 5);
const Heads = ({ columns }: { columns: typeof COLUMNS }) => <>{columns.map(c => <th key={c.label} className={kit.num}>{c.label}</th>)}</>;
const Cells = ({ columns, figures }: { columns: typeof COLUMNS; figures: SalesFigures }) =>
  <>{columns.map(c => <td key={c.label} data-label={c.label} className={kit.num}>{c.cell(figures)}</td>)}</>;

/** The house callout: neutral, amber or red, with an optional Try again. */
function Callout({ tone, alert, onRetry, children }: { tone?: 'warn' | 'bad'; alert?: boolean; onRetry?: () => void; children: ReactNode }) {
  return <div role={alert ? 'alert' : 'status'} className={`${kit.callout} ${tone === 'warn' ? kit.calloutWarn : tone === 'bad' ? kit.calloutBad : ''}`}>
    <span>{children}</span>
    {onRetry && <span className={kit.calloutEnd}><button type="button" className={kit.door} onClick={onRetry}>Try again</button></span>}
  </div>;
}

export default function ReportsSales({
  reportPeriod, onChooseReportPeriod, onCustomPeriod, from, to, onFrom, onTo, invalidPeriod, exporting, onPackage,
}: {
  reportPeriod: ReportPeriod; onChooseReportPeriod: (value: ReportPeriod) => void; onCustomPeriod: () => void;
  from: string; to: string; onFrom: (value: string) => void; onTo: (value: string) => void; invalidPeriod: boolean;
  exporting: boolean; onPackage: (from: string, to: string) => void;
}) {
  const [opened, setOpened] = useState<SalesMonth | null>(null);
  const ready = Boolean(from && to && !invalidPeriod);
  const { load, retry } = useReportRead<SalesReportRead>('/api/platform-admin/bookkeeping/sales', from, to, ready, 'Unable to work out the sales');
  const body = load.state === 'ready' ? load.body : null;
  const read = body?.state === 'read' ? body : null;
  const periodLabel = from && to ? `${consoleDate(from)} to ${consoleDate(to)}` : 'Choose the dates';

  function exportCsv(r: Extract<SalesReportRead, { state: 'read' }>) {
    downloadCSVBlob(`fieldlogichq-sales-${r.report.period.from}-to-${r.report.period.to}.csv`,
      salesCsvRows(r.report, r.live).map(row => row.map(csvCell).join(',')).join('\n'));
  }

  return <section className={`${kit.card} ${gst.view}`} aria-labelledby="sales-title">
    <div className={`${kit.toolbar} ${gst.toolbar}`}>
      <DatedPeriodPicker reportPeriod={reportPeriod} onChooseReportPeriod={onChooseReportPeriod} onCustomPeriod={onCustomPeriod}
        from={from} to={to} onFrom={onFrom} onTo={onTo} />
      {body && <span className={`${kit.chip} ${kit.chipInfo}`}>{body.live ? SALES_WORDS.mode.live : SALES_WORDS.mode.test}</span>}
      <span className={kit.toolbarEnd}>
        <button type="button" className="btn btn-secondary" disabled={!read} onClick={() => read && exportCsv(read)}>Sales CSV</button>
        <button type="button" className={`btn btn-secondary ${gst.deskOnly}`} disabled={!ready || exporting} onClick={() => onPackage(from, to)}>
          {exporting ? 'Preparing package…' : 'Accountant package'}</button>
      </span>
    </div>

    <div className={gst.body}>
      <div>
        <p className={kit.eye} id="sales-title">Sales by month · {periodLabel}</p>
        <p className={kit.caption}>{SALES_WORDS.caption}</p>
      </div>
      {!ready && <p role="status" className={kit.callout}>{invalidPeriod ? 'Choose a From date on or before the To date.' : 'Choose both dates to see the sales.'}</p>}
      {load.state === 'loading' && <p role="status" className={kit.caption}>Working out the sales…</p>}
      {load.state === 'error' && <Callout tone="bad" alert onRetry={retry}><strong>The sales couldn’t be worked out.</strong> {load.error}</Callout>}
      {body?.state === 'failed' && <><Band figures={null} /><Callout tone="bad" alert onRetry={retry}>{SALES_WORDS.unread}</Callout></>}
      {read && <ReportBody report={read.report} onOpen={setOpened} />}
    </div>

    {opened && read && <MonthWindow month={opened} clubNames={read.clubNames} onClose={() => setOpened(null)} />}
  </section>;
}

function Band({ figures, period }: { figures: SalesFigures | null; period?: string }) {
  const value = (cents: number | undefined) => (cents == null ? '—' : salesMoney(cents));
  const tiles: [string, number | undefined, string][] = [
    ['Net sales, before tax', figures?.net, period ? `invoiced ${period}, less voids and credit notes` : 'invoiced, less voids and credit notes'],
    ['GST/HST on them', figures?.gstHst, 'held for CRA, not revenue'],
    ['Collected', figures?.collected, 'payments received, with tax'],
    ['Written off', figures?.writtenOff, `bad debt, before tax${figures?.recovered ? ` · ${salesMoney(figures.recovered)} recovered since` : ''}`],
  ];
  return <section className={kit.band} aria-label="Sales for the period at a glance">
    {tiles.map(([label, cents, note]) => <div key={label} className={kit.bandCell}><span className={kit.bandLabel}>{label}</span>
      <strong className={kit.bandValue}>{value(cents)}</strong><span className={kit.bandNote}>{note}</span></div>)}
  </section>;
}

function ReportBody({ report, onOpen }: { report: SalesReport; onOpen: (m: SalesMonth) => void }) {
  const r = report.reconciliation;
  const reconciled = r.state === 'reconciled' ? SALES_WORDS.reconciled(r) : null;
  const subtotals = report.unvalued.byCurrency.map(c => `${saleCents(c.cents, c.currency)} before tax`).join(', ');
  const period = `${consoleDay(report.period.from)} to ${consoleDay(report.period.to)}`;
  return <>
    <Band figures={report.totals} period={period} />
    {report.registration.state !== 'set' && <Callout tone="warn">{report.registration.state === 'unset' ? SALES_WORDS.registrationUnset : SALES_WORDS.registrationUnread}</Callout>}
    {report.partial && <Callout tone="warn">{report.recordStart ? SALES_WORDS.recordStarts(consoleDate(report.recordStart)) : SALES_WORDS.recordUnknown}</Callout>}
    {report.unvalued.count > 0 && <Callout tone="warn">{SALES_WORDS.unvalued(report.unvalued.count, subtotals)}</Callout>}
    {report.refundsWithoutNote.state === 'failed' && <Callout tone="warn">{SALES_WORDS.refundsUnread}</Callout>}
    {report.refundsWithoutNote.count > 0 && <Callout tone="warn">{SALES_WORDS.refunds(report.refundsWithoutNote.count)}</Callout>}

    <div className={`table-cards ${gst.frame}`}><table className={`${gst.table} ${styles.months}`}>
      <thead><tr><th>Month</th><Heads columns={COLUMNS} /></tr></thead>
      <tbody>
        {rowsOf(report.months).map(row => row.kind === 'beforeRecord'
          ? <tr key={row.first.month} className={styles.quiet}>
            <td className="table-cards-title">{row.first.month === row.last.month ? monthLabel(row.first.month) : `${monthLabel(row.first.month)} to ${monthLabel(row.last.month)}`}</td>
            <td colSpan={COLUMNS.length} className={styles.quietNote}>{SALES_WORDS.beforeRecord}</td></tr>
          : <MonthRow key={row.month.month} month={row.month} onOpen={() => onOpen(row.month)} />)}
        <tr className={styles.total}><td className="table-cards-title">{period}</td><Cells columns={COLUMNS} figures={report.totals} /></tr>
      </tbody>
    </table></div>

    {reconciled && <Callout><strong>{reconciled.title}</strong> {reconciled.body}</Callout>}
    {r.state === 'not_available' && <Callout>{SALES_WORDS.notAvailable}</Callout>}
    {r.state === 'does_not_reconcile' && <Callout tone="bad" alert>{SALES_WORDS.doesNotReconcile}</Callout>}
    <Callout tone="warn"><strong>{SALES_WORDS.notBusinessNumbers.title}</strong> {SALES_WORDS.notBusinessNumbers.body}</Callout>
    <p className={kit.caption}>A month opens its split by kind and its bills. {SALES_WORDS.yearly}</p>
  </>;
}

function MonthRow({ month, onOpen }: { month: SalesMonth; onOpen: () => void }) {
  const chip = month.registration === 'before' ? SALES_WORDS.beforeRegistration : month.registration === 'part_before' ? SALES_WORDS.partBeforeRegistration : null;
  return <tr className={kit.clickableRow} onClick={onOpen}>
    <td className="table-cards-title">
      <button type="button" className={gst.rowName} onClick={onOpen}>{monthLabel(month.month)}</button>
      {!month.wholeMonth && <span className={kit.sub}>{consoleDay(month.from)} to {consoleDay(month.to)}</span>}
      {(chip || month.partial) && <span className={styles.chips}>
        {chip && <span className={`${kit.chip} ${kit.chipInfo}`}>{chip}</span>}
        {month.partial && <span className={`${kit.chip} ${kit.chipWarn}`}>{SALES_WORDS.partial}</span>}
      </span>}
    </td>
    {month.events.length ? <Cells columns={COLUMNS} figures={month.figures} />
      : <td colSpan={COLUMNS.length} className={styles.quietNote}>{SALES_WORDS.nothingInvoiced}</td>}
  </tr>;
}

/** A month's window: the split by kind, then every bill behind the month's figures, in date order. */
function MonthWindow({ month, clubNames, onClose }: { month: SalesMonth; clubNames: Record<string, string> | null; onClose: () => void }) {
  const amount = (e: SalesEvent) => (e.cad == null ? `${saleCents(e.cents, e.currency)} · ${SALES_WORDS.notValued}` : salesMoney(e.cad));
  const when = (e: SalesEvent) => `${consoleDay(e.on)}${e.dateNotRecorded ? ` · ${e.type === 'refund_no_note' ? SALES_WORDS.refundDate : SALES_WORDS.voidDate}` : ''}`;
  return <KitDialog kind="form" size="wide" record onClose={onClose} eyebrow="Bookkeeping · Sales" title={monthLabel(month.month)}
    identity={`${consoleDay(month.from)} to ${consoleDay(month.to)} · each event in the month it happened`}
    footerStart="Before tax unless it says otherwise. A payment and a refund include tax. Valued in CAD at each bill’s Bank of Canada rate."
    footer={<button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>}>
    {month.byKind.length > 0 && <div className={`table-cards ${gst.frame}`}><table className={gst.table}>
      <thead><tr><th>Kind</th><Heads columns={KIND_COLUMNS} /></tr></thead>
      <tbody>{month.byKind.map(k => <tr key={k.kind}><td className="table-cards-title">{SALES_KIND_LABELS[k.kind]}</td><Cells columns={KIND_COLUMNS} figures={k.figures} /></tr>)}</tbody>
    </table></div>}
    <div className={`table-cards ${gst.frame} ${styles.bills}`}><table className={gst.table}>
      <thead><tr><th>Date</th><th>What</th><th>Bill</th><th>Buyer</th><th>Kind</th><th className={kit.num}>Amount</th><th className={kit.num}>GST/HST</th></tr></thead>
      <tbody>{month.events.length ? month.events.map((e, i) => <tr key={`${e.type}-${e.noteId ?? e.invoiceId}-${i}`}>
        <td data-label="Date">{when(e)}</td>
        <td className="table-cards-title">{SALES_EVENT_LABELS[e.type]}{e.beforeRegistration && e.type === 'invoiced' && <span className={kit.sub}>{SALES_WORDS.beforeRegistration}</span>}</td>
        <td data-label="Bill">{e.invoiceNumber ?? e.invoiceId}{e.noteId && <span className={kit.sub}>Credit note {e.noteNumber ?? e.noteId}</span>}</td>
        <td data-label="Buyer">{invoiceBuyer(e.buyerKind, e.orgId, clubNames)}</td>
        <td data-label="Kind">{SALES_KIND_LABELS[e.kind]}</td>
        <td data-label="Amount" className={kit.num}>{amount(e)}</td>
        <td data-label="GST/HST" className={kit.num}>{e.gstHstCad == null ? '—' : salesMoney(e.gstHstCad)}</td>
      </tr>) : <tr><td colSpan={7} className={kit.empty}>{SALES_WORDS.nothingInvoiced}.</td></tr>}</tbody>
    </table></div>
  </KitDialog>;
}
