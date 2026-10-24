'use client';

import { useCallback, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { businessCents, hasValidConversionEvidence, matchesReviewFilter, summarizeExpenses, type ExpenseRevision, type ReviewFilter } from '@/lib/bookkeeping-expenses';
import { previewBookkeepingSourceCsv, type BookkeepingSourcePreview } from '@/lib/bookkeeping-source-import';
import { downloadCSVBlob } from '@/lib/export';
import styles from './bookkeeping.module.css';

const SOURCES: Record<string, string> = {
  business_bank: 'Business bank', business_card: 'Business card', personal: 'Paid personally', other: 'Other',
};
const money = (cents: number) => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(cents / 100);
const amount = (cents: number) => (cents / 100).toFixed(2);
const sourceMoney = (cents: number, currency: string) => {
  const sign = cents < 0 ? '−' : '';
  try {
    if (!/^[A-Z]{3}$/.test(currency)) throw new RangeError('Invalid currency code');
    return sign + new Intl.NumberFormat('en-CA', { style: 'currency', currency }).format(Math.abs(cents) / 100);
  } catch {
    return `${sign}${currency || 'Unknown currency'} ${(Math.abs(cents) / 100).toFixed(2)}`;
  }
};

export default function BookkeepingClient({ initialExpenses, initialRevisions }: { initialExpenses: ExpenseRevision[]; initialRevisions: ExpenseRevision[] }) {
  const [expenses, setExpenses] = useState<ExpenseRevision[]>(initialExpenses);
  const [revisions, setRevisions] = useState<ExpenseRevision[]>(initialRevisions);
  const [editing, setEditing] = useState<ExpenseRevision | null>(null);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [voidMode, setVoidMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [exporting, setExporting] = useState<'csv' | 'package' | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [category, setCategory] = useState('');
  const [query, setQuery] = useState('');
  const [review, setReview] = useState<ReviewFilter>('all');
  const [sourcePreview, setSourcePreview] = useState<BookkeepingSourcePreview | null>(null);
  const [sourceFileName, setSourceFileName] = useState('');
  const [sourcePreviewError, setSourcePreviewError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/platform-admin/bookkeeping/expenses', { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Unable to load expenses');
      setExpenses(body.expenses);
      setRevisions(body.revisions);
      setError('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load expenses'); }
    finally { setLoading(false); }
  }, []);

  const categories = useMemo(() => [...new Set(expenses.map(row => row.category))].sort(), [expenses]);
  const visible = useMemo(() => expenses.filter(row =>
    (!from || row.expense_date >= from) && (!to || row.expense_date <= to) &&
    (!category || row.category === category) &&
    (!query || `${row.supplier} ${row.business_purpose} ${row.category}`.toLowerCase().includes(query.toLowerCase())) &&
    matchesReviewFilter(row, review)
  ), [expenses, from, to, category, query, review]);
  const summary = useMemo(() => summarizeExpenses(visible), [visible]);

  async function previewSourceCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    setSourcePreview(null);
    setSourceFileName('');
    setSourcePreviewError('');
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv') || file.size > 10 * 1024 * 1024) {
      setSourcePreviewError('Choose a CSV file smaller than 10 MB.');
      return;
    }
    try {
      setSourceFileName(file.name);
      setSourcePreview(previewBookkeepingSourceCsv(await file.text()));
    } catch {
      setSourcePreviewError('This file could not be previewed. Check that it is a readable CSV.');
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError(''); setNotice('');
    const form = new FormData(event.currentTarget);
    const receipt = form.get('receipt');
    if (!(receipt instanceof File) || receipt.size === 0) form.delete('receipt');
    if (editing) {
      form.set('expenseId', editing.expense_id);
      form.set('expectedRevision', String(editing.revision));
    }
    try {
      const response = await fetch('/api/platform-admin/bookkeeping/expenses', { method: 'POST', body: form });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Unable to save expense');
      setNotice(voidMode ? 'Expense voided; its history is retained.' : editing ? 'Correction saved with history.' : 'Expense saved.');
      setEditing(null); setVoidMode(false);
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to save expense'); }
    finally { setSaving(false); }
  }

  async function deleteExpense(row: ExpenseRevision) {
    const confirmed = window.confirm(`Delete “${row.supplier}” (${money(row.cad_cents)}) permanently? Its saved revisions and receipt files will be removed.`);
    if (!confirmed) return;
    setDeletingId(row.expense_id); setError(''); setNotice('');
    try {
      const params = new URLSearchParams({ expenseId: row.expense_id, expectedRevision: String(row.revision) });
      const response = await fetch(`/api/platform-admin/bookkeeping/expenses?${params}`, { method: 'DELETE' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Unable to delete expense');
      setNotice(body.receiptCleanupIncomplete
        ? 'Expense deleted, but one or more receipt files could not be removed.'
        : 'Expense deleted.');
      if (editing?.expense_id === row.expense_id) { setEditing(null); setVoidMode(false); }
      if (historyId === row.expense_id) setHistoryId(null);
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to delete expense'); }
    finally { setDeletingId(null); }
  }

  async function exportExpenses(kind: 'csv' | 'package') {
    setExporting(kind); setError('');
    try {
      const params = new URLSearchParams({ ...(from ? { from } : {}), ...(to ? { to } : {}), ...(category ? { category } : {}), ...(query ? { q: query } : {}), ...(review !== 'all' ? { review } : {}) });
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
        link.download = 'fieldlogichq-expense-package.zip';
        document.body.append(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to export expenses'); }
    finally { setExporting(null); }
  }
  return <div className={styles.page}>
    <header className={styles.header}>
      <div><p className={styles.eyebrow}>Private finance</p><h1>Bookkeeping</h1>
        <p>Record expenses and original receipts. Purchase tax stays pending until its treatment is reviewed.</p></div>
      <div className={styles.exportActions}>
        <button type="button" className={styles.export} onClick={() => exportExpenses('csv')} disabled={!!exporting}>{exporting === 'csv' ? 'Preparing CSV…' : 'Export expense detail CSV'}</button>
        <button type="button" className={styles.export} onClick={() => exportExpenses('package')} disabled={!!exporting}>{exporting === 'package' ? 'Preparing package…' : 'Download receipt package'}</button>
      </div>
    </header>

    {error && <p role="alert" className={styles.error}>{error}</p>}
    {notice && <p role="status" className={styles.notice}>{notice}</p>}
    <section className={`${styles.panel} ${styles.importPanel}`} aria-labelledby="source-import-title">
      <div className={styles.importHeading}>
        <div><p className={styles.eyebrow}>B3 · fixture import preview</p><h2 id="source-import-title">Review source CSV</h2>
          <p className={styles.hint}>Choose a CSV to check its movement identities and totals. The file stays in this browser and is not uploaded.</p></div>
        <span className={styles.previewBadge}>Preview only · no records posted</span>
      </div>
      <div className={styles.importControls}>
        <label className={styles.fileLabel}>Stripe movement CSV<input type="file" accept=".csv,text/csv" onChange={event => void previewSourceCsv(event)} /></label>
        <a href="/bookkeeping-b3-import-fixtures.csv" download>Download synthetic preview file</a>
      </div>
      {sourcePreviewError && <p role="alert" className={styles.error}>{sourcePreviewError}</p>}
      {sourcePreview && <>
        <p className={styles.hint}>File: <strong>{sourceFileName}</strong>. This proposed contract has not been accepted by Revenue; no import action is available.</p>
        {!!sourcePreview.file_issues.length && <div className={styles.importIssues} role="alert"><strong>File needs attention</strong><ul>{sourcePreview.file_issues.map((issue, index) => <li key={index}>{issue}</li>)}</ul></div>}
        <div className={styles.importTableWrap}><table className={styles.scopeTable}>
          <caption>Source accounts in this file</caption>
          <thead><tr><th>Provider</th><th>Environment</th><th>Platform account</th><th>Connected account</th></tr></thead>
          <tbody>{sourcePreview.source_scopes.map((scope, index) => <tr key={`${scope.platform_account_id}-${scope.connected_account_id}-${index}`}>
            <td>{scope.provider || '—'}</td><td>{scope.environment || '—'}</td><td>{scope.platform_account_id || '—'}</td><td>{scope.connected_account_id || 'Platform balance'}</td>
          </tr>)}</tbody>
        </table></div>
        <div className={styles.importMetrics}>
          <div><span>Rows found</span><strong>{sourcePreview.counts.rows}</strong></div>
          <div><span>Ready to review</span><strong>{sourcePreview.counts.ready}</strong></div>
          <div><span>Needs attention</span><strong>{sourcePreview.counts.blocked}</strong></div>
          <div><span>Repeated identity</span><strong>{sourcePreview.counts.duplicates}</strong></div>
        </div>
        <p className={styles.hint}>Repeated identities are checked within this file only. Previous imports cannot be checked until import history is added.</p>
        {Object.entries(sourcePreview.totals_by_currency).length > 0 && <div className={styles.importTotals}>
          {Object.entries(sourcePreview.totals_by_currency).map(([currency, totals]) => <p key={currency}><strong>{currency} net movement for ready rows:</strong> {sourceMoney(totals.net_cents, currency)} <span>({totals.rows} rows; flagged rows excluded)</span></p>)}
        </div>}
        <div className={styles.importTableWrap}><table className={styles.importTable}>
          <thead><tr><th>Movement</th><th>Date</th><th>Type</th><th>Currency</th><th>Net</th><th>Review</th></tr></thead>
          <tbody>{sourcePreview.rows.map(row => <tr key={`${row.line}-${row.identity_key ?? 'invalid'}`}>
            <td>{row.movement?.movement_id || 'Unknown'}</td><td>{row.movement?.occurred_at_utc || '—'}</td>
            <td>{row.movement?.movement_type || '—'}</td><td>{row.movement?.currency || '—'}</td>
            <td>{row.movement ? sourceMoney(row.movement.net_cents, row.movement.currency) : '—'}</td>
            <td><strong className={row.status === 'ready' ? styles.importReady : row.status === 'duplicate' ? styles.importDuplicate : styles.importBlocked}>{row.status === 'ready' ? 'Ready' : row.status === 'duplicate' ? 'Repeated identity' : 'Needs attention'}</strong>{row.issues.length > 0 && <ul>{row.issues.map((issue, index) => <li key={index}>{issue}</li>)}</ul>}</td>
          </tr>)}</tbody>
        </table></div>
        {!sourcePreview.rows.length && !sourcePreview.file_issues.length && <p className={styles.empty}>This CSV has a header but no movement rows.</p>}
        <p className={styles.importCallout}><strong>Source handoff pending:</strong> Revenue must confirm source identifiers, seller and tax attribution, fee/refund links, payout mapping, and export columns before real movements can be imported.</p>
      </>}
    </section>
    <div className={styles.columns}>
      <section className={styles.panel} aria-labelledby="expense-form-title">
        <h2 id="expense-form-title">{editing ? `Correct ${editing.supplier}` : 'Add an expense'}</h2>
        <p className={styles.hint}>Amounts include purchase tax. Keep the original invoice amount when converting USD to CAD.</p>
        <form key={editing ? `${editing.expense_id}-${editing.revision}` : 'new'} onSubmit={save} className={styles.form}>
          <label>Date paid or incurred<input name="expenseDate" type="date" required defaultValue={editing?.expense_date ?? ''} /></label>
          <label>Supplier<input name="supplier" required maxLength={160} defaultValue={editing?.supplier ?? ''} /></label>
          <label>Category<input name="category" list="bookkeeping-categories" required maxLength={80} defaultValue={editing?.category ?? ''} placeholder="Software, travel, equipment…" /></label>
          <datalist id="bookkeeping-categories">{categories.map(value => <option key={value} value={value} />)}</datalist>
          <label>Business purpose<textarea name="businessPurpose" required maxLength={500} rows={2} defaultValue={editing?.business_purpose ?? ''} /></label>
          <div className={styles.pair}>
            <label>Invoice currency<select name="originalCurrency" defaultValue={editing?.original_currency ?? 'CAD'}><option>CAD</option><option>USD</option></select></label>
            <label>Invoice total<input name="originalAmount" inputMode="decimal" pattern="[0-9]+(\.[0-9]{1,2})?" required defaultValue={editing ? amount(editing.original_cents) : ''} /></label>
          </div>
          <div className={styles.pair}>
            <label>CAD total<input name="cadAmount" inputMode="decimal" pattern="[0-9]+(\.[0-9]{1,2})?" required defaultValue={editing ? amount(editing.cad_cents) : ''} /></label>
            <label>Purchase tax in CAD<input name="taxCadAmount" inputMode="decimal" pattern="[0-9]+(\.[0-9]{1,2})?" required defaultValue={editing ? amount(editing.tax_cad_cents) : '0.00'} /></label>
          </div>
          <div className={styles.pair}>
            <label>Tax treatment<select name="taxStatus" defaultValue={editing?.tax_status ?? 'pending'}><option value="pending">Pending review</option><option value="none">No tax recorded</option><option value="reviewed">Reviewed</option></select></label>
            <label>Business use %<input name="businessUsePercent" type="number" min="1" max="100" required defaultValue={editing?.business_use_percent ?? 100} /></label>
          </div>
          <label>Paid from<select name="paymentSource" defaultValue={editing?.payment_source ?? 'personal'}>{Object.entries(SOURCES).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></label>
          <label>USD conversion source and date, if applicable<textarea name="conversionNote" maxLength={500} rows={2} placeholder="For example: Bank of Canada rate 2026-10-22" defaultValue={editing?.conversion_note ?? ''} /></label>
          <label>Notes<textarea name="notes" maxLength={2000} rows={2} defaultValue={editing?.notes ?? ''} /></label>
          <label>Original receipt · PDF, JPEG or PNG · up to 10 MB<input name="receipt" type="file" accept="application/pdf,image/jpeg,image/png" /></label>
          {editing?.receipt_path && <p className={styles.hint}>Current receipt stays attached unless you choose a replacement. Earlier files remain in history.</p>}
          {editing && <label>Reason for correction<input name="changeReason" required maxLength={500} placeholder="What changed and why?" /></label>}
          {voidMode && <label>Reason to void<input name="voidReason" required maxLength={500} placeholder="Why should this expense leave the report?" /></label>}
          <div className={styles.actions}>
            <button type="submit" disabled={saving}>{saving ? 'Saving…' : voidMode ? 'Confirm void' : editing ? 'Save correction' : 'Save expense'}</button>
            {editing && <button type="button" className={styles.secondary} onClick={() => { setEditing(null); setVoidMode(false); }}>Cancel</button>}
            {editing && !voidMode && <button type="button" className={styles.secondary} onClick={() => setVoidMode(true)}>Void expense</button>}
            {voidMode && <button type="button" className={styles.secondary} onClick={() => setVoidMode(false)}>Keep expense</button>}
          </div>
        </form>
      </section>

      <div className={styles.register}>
        <section className={styles.panel} aria-labelledby="report-title">
          <h2 id="report-title">Expense report</h2>
          <div className={styles.filters}>
            <label>From<input type="date" value={from} onChange={event => setFrom(event.target.value)} /></label>
            <label>To<input type="date" value={to} onChange={event => setTo(event.target.value)} /></label>
            <label>Category<select value={category} onChange={event => setCategory(event.target.value)}><option value="">All categories</option>{categories.map(value => <option key={value}>{value}</option>)}</select></label>
            <label>Find<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Supplier or purpose" /></label>
          <label>Review view<select value={review} onChange={event => setReview(event.target.value as ReviewFilter)}><option value="all">All expenses</option><option value="missing_receipt">Missing receipt</option><option value="missing_conversion">USD conversion evidence needed</option><option value="personal">Paid personally</option><option value="foreign">USD invoices</option></select></label>
          </div>
          <div className={styles.metrics}>
            <div><span>Recorded business spend</span><strong>{money(summary.recordedSpendCents)}</strong></div>
            <div><span>Expenses</span><strong>{summary.count}</strong></div>
            <div><span>Purchase tax pending review</span><strong>{money(summary.pendingTaxCents)}</strong></div>
          </div>
          <p className={styles.hint}>Spend includes purchase tax and the recorded business-use share. It is not a tax-credit or profit calculation.</p>
          <p className={styles.hint}>CSV and receipt package use the same period, category, search and review filters shown here. They include the revision history for matching expenses.</p>
          {!!summary.byCategory.length && <div className={styles.categories}>{summary.byCategory.map(([name, cents]) => <div key={name}><span>{name}</span><strong>{money(cents)}</strong></div>)}</div>}
          <div className={styles.reportGrid}>
            <div><h3>Purchase tax recorded</h3>{summary.taxByStatus.map(([status, cents]) => <p key={status}><span>{status === 'none' ? 'None recorded' : status === 'pending' ? 'Pending review' : 'Reviewed'}</span><strong>{money(cents)}</strong></p>)}</div>
            <div><h3>Recorded spend by payment source</h3>{summary.byPaymentSource.length ? summary.byPaymentSource.map(([source, cents]) => <p key={source}><span>{SOURCES[source]}</span><strong>{money(cents)}</strong></p>) : <p>No active expenses.</p>}</div>
          </div>
          <p className={styles.hint}>Paid personally: {money(summary.personallyPaidCents)} across active expenses. A later reimbursement or owner movement is a separate record and must not be entered as another expense here.</p>
          <section className={styles.reviewList} aria-labelledby="evidence-review-title">
            <h3 id="evidence-review-title">Evidence review</h3>
            <p className={styles.hint}>{summary.missingReceiptCount} active expense(s) have no receipt. {summary.missingConversionCount} USD expense(s) need a conversion source and valid date. Voided expenses are excluded.</p>
            {visible.filter(row => !row.void_reason && (!row.receipt_path || (row.original_currency === 'USD' && !hasValidConversionEvidence(row.conversion_note)))).map(row => <p key={row.expense_id}><strong>{row.supplier}</strong> · {row.expense_date} · {[
              !row.receipt_path ? 'Receipt missing' : '',
              row.original_currency === 'USD' && !hasValidConversionEvidence(row.conversion_note) ? 'USD conversion source/date missing or invalid' : '',
            ].filter(Boolean).join(' · ')}</p>)}
          </section>
          <section className={styles.reviewList} aria-labelledby="usd-review-title">
            <h3 id="usd-review-title">USD invoices</h3>
            {visible.filter(row => !row.void_reason && row.original_currency === 'USD').length ? visible.filter(row => !row.void_reason && row.original_currency === 'USD').map(row => <p key={row.expense_id}><strong>{row.supplier}</strong> · USD {amount(row.original_cents)} → CAD {amount(row.cad_cents)} · {row.conversion_note || 'Conversion source/date needed'}</p>) : <p>No active USD invoices in this view.</p>}
          </section>
        </section>
        <section className={styles.panel} aria-labelledby="register-title">
          <h2 id="register-title">Expense register</h2>
          {loading ? <p>Loading expenses…</p> : !visible.length ? <p className={styles.empty}>No expenses match this view.</p> :
            <div className={styles.rows}>{visible.map(row => <article key={row.expense_id} className={styles.row}>
              <div className={styles.rowHead}><div><strong>{row.supplier}</strong><span>{row.expense_date} · {row.category}</span></div><strong>{row.void_reason ? 'Voided' : money(businessCents(row))}</strong></div>
              <p>{row.business_purpose}</p>
              <div className={styles.rowMeta}><span>{SOURCES[row.payment_source]}</span><span>Tax: {row.tax_status === 'pending' ? 'pending review' : row.tax_status === 'none' ? 'none recorded' : 'reviewed'}</span><span>Rev. {row.revision}</span>{!row.receipt_path && <span>Receipt missing</span>}</div>
              <div className={styles.rowActions}>
                {row.receipt_path && <a href={`/api/platform-admin/bookkeeping/receipt/${row.expense_id}/${row.revision}`}>Download receipt</a>}
                {!row.void_reason && <button type="button" onClick={() => { setEditing(row); setVoidMode(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Correct</button>}
                <button type="button" onClick={() => void deleteExpense(row)} disabled={deletingId === row.expense_id}>{deletingId === row.expense_id ? 'Deleting…' : 'Delete'}</button>
                <button type="button" onClick={() => setHistoryId(historyId === row.expense_id ? null : row.expense_id)}>{historyId === row.expense_id ? 'Hide history' : 'History'}</button>
              </div>
              {historyId === row.expense_id && <ol className={styles.history}>{revisions.filter(item => item.expense_id === row.expense_id).sort((a, b) => b.revision - a.revision).map(item =>
                <li key={item.revision}>Rev. {item.revision} · {new Date(item.created_at).toLocaleString('en-CA')} · {money(item.cad_cents)} {item.change_reason ? `· ${item.change_reason}` : '· First entry'} {item.void_reason ? `· Voided: ${item.void_reason}` : ''} {item.receipt_path && <a href={`/api/platform-admin/bookkeeping/receipt/${item.expense_id}/${item.revision}`}>Receipt</a>}</li>
              )}</ol>}
            </article>)}</div>}
        </section>
      </div>
    </div>
  </div>;
}
