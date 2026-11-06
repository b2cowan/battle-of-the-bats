import { businessCents, CONVERSION_SOURCES, hasConfirmedDates, isConversionSource, type ExpenseRevision } from '@/lib/bookkeeping-expenses';
import {
  CREDIT_LABEL, CREDIT_NOT_WORKED_OUT, defaultPurchaseKind, expenseCredit, hasGstHstLine, HELD_RECORD_NOTE, NUMBER_NEEDED_FROM_CENTS,
  NUMBER_NOT_NEEDED, NUMBER_NOT_RECORDED, PURCHASE_KINDS, purchaseTaxCell, resolveTaxState, SUPPLIER_REGISTRATIONS, TYPE_NOT_SET_RECORD_NOTE,
} from '@/lib/bookkeeping-gst';
import kit from '../console.module.css';
import { consoleDate, consoleWhen } from '@/lib/console-dates';
import styles from './bookkeeping.module.css';

const SOURCES = { business_bank: 'Business bank', business_card: 'Business card', personal: 'Paid personally', other: 'Other' };
const money = (cents: number) => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(cents / 100);
/**
 * The record's GST/HST cells (GST/HST Stage 4a; drawings tab 3 and owner Asks 13–14, 2026-11-06). The credit is the same
 * worked-out-on-read figure the expenses API returns in `credits`: one function, one registration date, never stored.
 */
function GstCells({ expense, registrationDate }: { expense: ExpenseRevision; registrationDate: string | null }) {
  const { lines } = resolveTaxState(expense, expense.tax_lines ?? []);
  const credit = expense.void_reason ? null : expenseCredit(expense, registrationDate);
  const gstHst = hasGstHstLine(lines);
  const number = expense.supplier_tax_number?.trim();
  return <>
    {gstHst && <div><dt>Supplier’s GST/HST number</dt><dd>{number ? number
      : credit?.state === 'held' ? <span className={`${kit.chip} ${kit.chipWarn}`}>Missing</span>
      : expense.cad_cents < NUMBER_NEEDED_FROM_CENTS ? NUMBER_NOT_NEEDED : NUMBER_NOT_RECORDED}</dd></div>}
    {gstHst && <div><dt>Supplier’s registration</dt><dd>{SUPPLIER_REGISTRATIONS[expense.supplier_registration ?? 'not_checked']}</dd></div>}
    {credit && credit.state !== 'no_tax' && <div><dt>{CREDIT_LABEL}</dt><dd>{credit.state === 'type_not_set'
      ? <>{CREDIT_NOT_WORKED_OUT}<small className={styles.recordNote}>{TYPE_NOT_SET_RECORD_NOTE}</small></>
      : <>{credit.figure}{(credit.state === 'held' ? HELD_RECORD_NOTE : credit.sentence) && <small className={styles.recordNote}>{credit.state === 'held' ? HELD_RECORD_NOTE : credit.sentence}</small>}</>}</dd></div>}
  </>;
}

export default function ExpenseRecordBody({ expense, revisions, registrationDate }: { expense: ExpenseRevision; revisions: ExpenseRevision[]; registrationDate: string | null }) {
  const history = revisions.filter(row => row.expense_id === expense.expense_id).sort((a, b) => b.revision - a.revision);
  const source = isConversionSource(expense.conversion_source) ? CONVERSION_SOURCES[expense.conversion_source] : null;
  const tax = resolveTaxState(expense, expense.tax_lines ?? []);
  const taxCell = purchaseTaxCell(tax.answer, tax.lines, expense.tax_status);
  // As drawn (tab 3): the kind shows wherever a credit can be worked out, including a "Type not set" amount.
  const kind = hasGstHstLine(tax.lines) || tax.lines.some(line => line.type === 'unset') ? PURCHASE_KINDS[expense.purchase_kind ?? defaultPurchaseKind(expense.category)].toLowerCase() : null;
  return <>
    {expense.void_reason && <p className={styles.dateWarning}>Voided: {expense.void_reason}. This record is excluded from active spend.</p>}
    {!hasConfirmedDates(expense) && <p className={styles.dateWarning}>Recorded date {consoleDate(expense.expense_date)} · meaning unconfirmed. Check the source document before confirming incurred and payment dates.</p>}
    <div className={styles.recordCard}><dl>
      <div><dt>Amount</dt><dd>{money(businessCents(expense))}</dd></div>
      <div><dt>Paid from</dt><dd>{SOURCES[expense.payment_source]}</dd></div>
      <div><dt>Expense date</dt><dd>{expense.incurred_date ? consoleDate(expense.incurred_date) : 'Dates to review'}</dd></div>
      <div><dt>Payment date</dt><dd>{expense.paid_date ? expense.paid_date === expense.incurred_date ? 'Same day' : consoleDate(expense.paid_date) : 'Dates to review'}</dd></div>
      <div><dt>Purchase tax</dt><dd>{taxCell.lines.map((line, index) => <span key={index} className={styles.recordLine}>{line}</span>)}
        {taxCell.note && <small className={styles.recordNote}>{taxCell.note}</small>}</dd></div>
      <div><dt>Business use</dt><dd>{expense.business_use_percent}%{kind && ` · ${kind}`}</dd></div>
      <GstCells expense={expense} registrationDate={registrationDate} />
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
