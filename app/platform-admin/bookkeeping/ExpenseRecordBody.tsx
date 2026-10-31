import { businessCents, CONVERSION_SOURCES, hasConfirmedDates, hasKnownTaxAmount, isConversionSource, type ExpenseRevision } from '@/lib/bookkeeping-expenses';
import { consoleDate, consoleWhen } from '@/lib/console-dates';
import styles from './bookkeeping.module.css';

const SOURCES = { business_bank: 'Business bank', business_card: 'Business card', personal: 'Paid personally', other: 'Other' };
const money = (cents: number) => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(cents / 100);
export default function ExpenseRecordBody({ expense, revisions }: { expense: ExpenseRevision; revisions: ExpenseRevision[] }) {
  const history = revisions.filter(row => row.expense_id === expense.expense_id).sort((a, b) => b.revision - a.revision);
  const source = isConversionSource(expense.conversion_source) ? CONVERSION_SOURCES[expense.conversion_source] : null;
  return <>
    {expense.void_reason && <p className={styles.dateWarning}>Voided: {expense.void_reason}. This record is excluded from active spend.</p>}
    {!hasConfirmedDates(expense) && <p className={styles.dateWarning}>Recorded date {consoleDate(expense.expense_date)} · meaning unconfirmed. Check the source document before confirming incurred and payment dates.</p>}
    <div className={styles.recordCard}><dl>
      <div><dt>Amount</dt><dd>{money(businessCents(expense))}</dd></div>
      <div><dt>Paid from</dt><dd>{SOURCES[expense.payment_source]}</dd></div>
      <div><dt>Expense date</dt><dd>{expense.incurred_date ? consoleDate(expense.incurred_date) : 'Dates to review'}</dd></div>
      <div><dt>Payment date</dt><dd>{expense.paid_date ? expense.paid_date === expense.incurred_date ? 'Same day' : consoleDate(expense.paid_date) : 'Dates to review'}</dd></div>
      <div><dt>Purchase tax</dt><dd>{hasKnownTaxAmount(expense) ? <>{money(expense.tax_cad_cents)} · {expense.tax_status === 'pending' ? 'Pending review' : expense.tax_status === 'none' ? 'No tax recorded' : 'Reviewed'}</> : 'Unknown'}</dd></div>
      <div><dt>Business use</dt><dd>{expense.business_use_percent}%</dd></div>
    </dl></div>
    <div className={styles.receiptRecord}>
      {expense.receipt_path ? <a href={`/api/platform-admin/bookkeeping/receipt/${expense.expense_id}/${expense.revision}`} target="_blank" rel="noopener noreferrer">
        {expense.receipt_name ?? 'Receipt'} · Attached{expense.receipt_attached_at ? ` ${consoleWhen(expense.receipt_attached_at)}` : ''} · opens in a new tab
      </a> : <p>No receipt attached yet.</p>}
      {expense.original_currency === 'USD' && <p>USD {(expense.original_cents / 100).toFixed(2)} → CAD {(expense.cad_cents / 100).toFixed(2)} · {source ?? 'USD source not picked'}{expense.conversion_rate != null ? ` · Rate ${expense.conversion_rate >= 0.00005 ? expense.conversion_rate.toFixed(4) : expense.conversion_rate.toPrecision(4)}` : ''}{expense.conversion_note && expense.conversion_note !== source ? ` · ${expense.conversion_note}` : ''}</p>}
      {expense.notes && <p>{expense.notes}</p>}
    </div>
    <section className={styles.historySection} aria-labelledby="history-title"><h3 id="history-title">Changes · {history.length}</h3><ol className={styles.history}>
      {history.map(row => <li key={row.revision}>Rev. {row.revision} · {consoleWhen(row.created_at)} · {money(row.cad_cents)} · {row.change_reason ?? 'First entry'}{row.void_reason ? ` · Voided: ${row.void_reason}` : ''}{row.receipt_path && <> · <a href={`/api/platform-admin/bookkeeping/receipt/${row.expense_id}/${row.revision}`} target="_blank" rel="noopener noreferrer">Receipt</a></>}</li>)}
    </ol></section>
  </>;
}
