'use client';
import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { DollarSign, Pencil, X, ArrowRightLeft } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { hasCapability } from '@/lib/roles';
import FeedbackModal from '@/components/FeedbackModal';
import styles from '../../accounting.module.css';
import type { AccountingLedger, AccountingEntry, LedgerSummary, AccountingEntryType, AccountingEntryStatus } from '@/lib/types';

const CATEGORY_SUGGESTIONS = [
  'Prize pool', 'Diamond rental', 'Umpire fees', 'Trophies & medals', 'Equipment',
  'Registration fees', 'Sponsorship', 'Grant', 'Fundraising', 'Food & beverages',
  'Administrative', 'Marketing', 'Travel subsidy', 'Other',
];

type Tab = 'all' | 'posted' | 'pending';

interface EntryForm {
  entryDate: string;
  description: string;
  category: string;
  amount: string;
  entryType: 'income' | 'expense';
  status: 'posted' | 'pending';
}

interface TransferForm {
  toLedgerId: string;
  amount: string;
  entryDate: string;
  description: string;
  category: string;
}

function today(): string {
  return new Date().toLocaleDateString('en-CA');
}

function emptyEntryForm(): EntryForm {
  return { entryDate: today(), description: '', category: '', amount: '', entryType: 'income', status: 'posted' };
}

function emptyTransferForm(): TransferForm {
  return { toLedgerId: '', amount: '', entryDate: today(), description: '', category: '' };
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency', currency: 'CAD', minimumFractionDigits: 2,
  }).format(n);
}

function entryTypeLabel(t: AccountingEntryType): string {
  if (t === 'income')       return 'Income';
  if (t === 'expense')      return 'Expense';
  if (t === 'transfer_in')  return 'Transfer In';
  return 'Transfer Out';
}

function typeChipClass(t: AccountingEntryType, s: typeof styles): string {
  if (t === 'income')  return s.typeIncome;
  if (t === 'expense') return s.typeExpense;
  return s.typeTransfer;
}

function statusBadgeClass(st: AccountingEntryStatus, s: typeof styles): string {
  if (st === 'posted')  return s.statusPosted;
  if (st === 'pending') return s.statusPending;
  return s.statusVoid;
}

const LIMIT = 50;

export default function LedgerDetailPage() {
  const { currentOrg, userRole, userCapabilities, loading } = useOrg();
  const params    = useParams();
  const ledgerId  = params.ledgerId as string;
  const base      = `/${currentOrg?.slug ?? ''}/admin`;
  const isOwner   = userRole === 'owner';

  const [ledger,      setLedger]      = useState<AccountingLedger | null>(null);
  const [summary,     setSummary]     = useState<LedgerSummary | null>(null);
  const [entries,     setEntries]     = useState<AccountingEntry[]>([]);
  const [tab,         setTab]         = useState<Tab>('all');
  const [fetching,    setFetching]    = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset,      setOffset]      = useState(0);
  const [hasMore,     setHasMore]     = useState(false);

  const [entryModal,    setEntryModal]    = useState<'add' | 'edit' | null>(null);
  const [editingEntry,  setEditingEntry]  = useState<AccountingEntry | null>(null);
  const [entryForm,     setEntryForm]     = useState<EntryForm>(emptyEntryForm);
  const [submitting,    setSubmitting]    = useState(false);

  const [transferModal, setTransferModal] = useState(false);
  const [allLedgers,    setAllLedgers]    = useState<LedgerSummary[]>([]);
  const [transferForm,  setTransferForm]  = useState<TransferForm>(emptyTransferForm);
  const [transferring,  setTransferring]  = useState(false);

  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState<'success' | 'danger'>('success');
  const [feedbackMsg,  setFeedbackMsg]  = useState('');

  function showFeedback(type: 'success' | 'danger', msg: string) {
    setFeedbackType(type); setFeedbackMsg(msg); setFeedbackOpen(true);
  }

  const fetchPage = useCallback(async (statusFilter: Tab, pageOffset: number, append: boolean) => {
    if (append) setLoadingMore(true); else setFetching(true);
    try {
      const qs = new URLSearchParams({ limit: String(LIMIT), offset: String(pageOffset) });
      if (statusFilter !== 'all') qs.set('status', statusFilter);

      if (append) {
        const res  = await fetch(`/api/admin/accounting/ledgers/${ledgerId}/entries?${qs}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Failed to load');
        const rows: AccountingEntry[] = data.entries ?? [];
        setEntries(prev => [...prev, ...rows]);
        setOffset(pageOffset + rows.length);
        setHasMore(rows.length === LIMIT);
      } else {
        const res  = await fetch(`/api/admin/accounting/ledgers/${ledgerId}?${qs}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Failed to load');
        setLedger(data.ledger ?? null);
        setSummary(data.summary ?? null);
        const rows: AccountingEntry[] = data.entries ?? [];
        setEntries(rows);
        setOffset(rows.length);
        setHasMore(rows.length === LIMIT);
      }
    } catch (e: any) {
      showFeedback('danger', e.message ?? 'Failed to load ledger.');
    } finally {
      setFetching(false);
      setLoadingMore(false);
    }
  }, [ledgerId]);

  useEffect(() => {
    if (currentOrg && ledgerId) fetchPage('all', 0, false);
  }, [currentOrg, ledgerId, fetchPage]);

  function handleTabChange(t: Tab) {
    setTab(t);
    fetchPage(t, 0, false);
  }

  async function handleVoid(entry: AccountingEntry) {
    if (!window.confirm('Void this entry? It will remain in the ledger for audit purposes but be excluded from totals.')) return;
    const res = await fetch(`/api/admin/accounting/ledgers/${ledgerId}/entries/${entry.id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) { showFeedback('danger', data.error ?? 'Failed to void entry.'); return; }
    fetchPage(tab, 0, false);
  }

  function openAddEntry() {
    setEntryForm(emptyEntryForm());
    setEditingEntry(null);
    setEntryModal('add');
  }

  function openEditEntry(entry: AccountingEntry) {
    setEntryForm({
      entryDate:   entry.entryDate,
      description: entry.description,
      category:    entry.category ?? '',
      amount:      String(entry.amount),
      entryType:   entry.entryType as 'income' | 'expense',
      status:      entry.status as 'posted' | 'pending',
    });
    setEditingEntry(entry);
    setEntryModal('edit');
  }

  async function handleSubmitEntry() {
    const amount = parseFloat(entryForm.amount);
    if (!entryForm.description.trim()) { showFeedback('danger', 'Description is required.'); return; }
    if (isNaN(amount) || amount <= 0 || amount > 999999.99) { showFeedback('danger', 'Amount must be a positive number up to 999,999.99.'); return; }

    setSubmitting(true);
    const isAdd = entryModal === 'add';
    try {
      const payload = {
        entryDate:   entryForm.entryDate,
        description: entryForm.description.trim(),
        amount,
        entryType:   entryForm.entryType,
        status:      entryForm.status,
        category:    entryForm.category.trim() || null,
      };

      const url = isAdd
        ? `/api/admin/accounting/ledgers/${ledgerId}/entries`
        : `/api/admin/accounting/ledgers/${ledgerId}/entries/${editingEntry!.id}`;

      const res  = await fetch(url, { method: isAdd ? 'POST' : 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to save entry');

      setEntryModal(null);
      setEditingEntry(null);
      await fetchPage(tab, 0, false);
      showFeedback('success', isAdd ? 'Entry added.' : 'Entry updated.');
    } catch (e: any) {
      showFeedback('danger', e.message ?? 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  }

  async function openTransferModal() {
    setTransferForm(emptyTransferForm());
    setTransferModal(true);
    try {
      const res  = await fetch('/api/admin/accounting/ledgers');
      const data = await res.json();
      setAllLedgers((data.ledgers ?? []).filter((l: LedgerSummary) => l.ledger.id !== ledgerId));
    } catch { /* non-critical: user sees empty dropdown */ }
  }

  async function handleTransfer() {
    const amount = parseFloat(transferForm.amount);
    if (!transferForm.toLedgerId)             { showFeedback('danger', 'Select a destination ledger.'); return; }
    if (isNaN(amount) || amount <= 0 || amount > 999999.99) { showFeedback('danger', 'Amount must be a positive number up to 999,999.99.'); return; }
    if (!transferForm.description.trim())     { showFeedback('danger', 'Description is required.'); return; }

    setTransferring(true);
    try {
      const res = await fetch('/api/admin/accounting/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromLedgerId: ledgerId,
          toLedgerId:   transferForm.toLedgerId,
          amount,
          entryDate:    transferForm.entryDate,
          description:  transferForm.description.trim(),
          category:     transferForm.category.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Transfer failed');
      setTransferModal(false);
      await fetchPage(tab, 0, false);
      showFeedback('success', 'Transfer recorded in both ledgers.');
    } catch (e: any) {
      showFeedback('danger', e.message ?? 'Transfer failed.');
    } finally {
      setTransferring(false);
    }
  }

  function ef<K extends keyof EntryForm>(k: K, v: EntryForm[K]) {
    setEntryForm(f => ({ ...f, [k]: v }));
  }

  function tf<K extends keyof TransferForm>(k: K, v: TransferForm[K]) {
    setTransferForm(f => ({ ...f, [k]: v }));
  }

  if (loading) return <p className={styles.muted}>Loading…</p>;

  if (!userRole || !hasCapability(userRole, userCapabilities, 'module_accounting')) {
    return (
      <div className={styles.accessDenied}>
        <DollarSign size={32} />
        <h2>Access Restricted</h2>
        <p>You don&apos;t have access to the Accounting module. Contact your organization owner to enable it.</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div className={styles.headerIcon}><DollarSign size={20} /></div>
        <div>
          <h1 className={styles.pageTitle}>{ledger?.name ?? 'Ledger'}</h1>
          <p className={styles.pageSub}>
            <a href={`${base}/accounting`} style={{ color: 'inherit', textDecoration: 'none', opacity: 0.6 }}>
              Accounting
            </a>
            {' / '}
            {ledger?.name ?? '…'}
          </p>
        </div>
      </div>

      {fetching && !ledger ? (
        <p className={styles.muted}>Loading…</p>
      ) : ledger && summary ? (
        <>
          {/* Balance summary */}
          <div className={styles.ledgerHeader}>
            <div className={styles.ledgerMeta}>
              <span className={`${styles.typeBadge} ${ledger.entityType === 'org' ? styles.typeBadgeOrg : styles.typeBadgeTournament}`}>
                {ledger.entityType === 'org' ? 'Org' : 'Tournament'}
              </span>
            </div>
            <div className={styles.balanceSummary}>
              <div className={styles.balanceStat}>
                <span className={styles.balanceStatLabel}>Net Balance</span>
                <span className={`${styles.balanceStatValue} ${summary.netPosted > 0 ? styles.balancePos : summary.netPosted < 0 ? styles.balanceNeg : styles.balanceNeutral}`}>
                  {formatCurrency(summary.netPosted)}
                </span>
              </div>
              <div className={styles.balanceStat}>
                <span className={styles.balanceStatLabel}>Posted Income</span>
                <span className={`${styles.balanceStatValue} ${styles.balancePos}`}>{formatCurrency(summary.postedIncome)}</span>
              </div>
              <div className={styles.balanceStat}>
                <span className={styles.balanceStatLabel}>Posted Expenses</span>
                <span className={`${styles.balanceStatValue} ${styles.balanceNeg}`}>{formatCurrency(summary.postedExpenses)}</span>
              </div>
              {(summary.pendingIncome > 0 || summary.pendingExpenses > 0) && (
                <div className={styles.balanceStat}>
                  <span className={styles.balanceStatLabel}>Pending</span>
                  <span className={styles.balanceStatValue} style={{ color: '#fbbf24' }}>
                    {summary.pendingIncome > 0  && `+${formatCurrency(summary.pendingIncome)}`}
                    {summary.pendingIncome > 0 && summary.pendingExpenses > 0 && ' / '}
                    {summary.pendingExpenses > 0 && `−${formatCurrency(summary.pendingExpenses)}`}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Tab row */}
          <div className={styles.tabRow}>
            {(['all', 'posted', 'pending'] as Tab[]).map(t => (
              <button
                key={t}
                className={`${styles.tab} ${tab === t ? styles.tabActive : ''}`}
                onClick={() => handleTabChange(t)}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          {/* Action bar */}
          {isOwner && (
            <div className={styles.addEntryBar}>
              <div />
              <div className={styles.addEntryBtns}>
                <button type="button" className="btn btn-secondary" onClick={openAddEntry}>+ Add Entry</button>
                <button type="button" className="btn btn-ghost" onClick={openTransferModal}>
                  <ArrowRightLeft size={14} style={{ marginRight: '0.35rem' }} />
                  Add Transfer
                </button>
              </div>
            </div>
          )}

          {/* Entry table */}
          {fetching ? (
            <p className={styles.muted}>Loading entries…</p>
          ) : entries.length === 0 ? (
            <div className={styles.emptyState}>No entries {tab !== 'all' ? `with status "${tab}"` : ''}.</div>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.entryTable}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Category</th>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Status</th>
                    {isOwner && <th></th>}
                  </tr>
                </thead>
                <tbody>
                  {entries.map(entry => {
                    const isTransfer = entry.entryType === 'transfer_in' || entry.entryType === 'transfer_out';
                    const isPos      = entry.entryType === 'income' || entry.entryType === 'transfer_in';
                    return (
                      <tr key={entry.id} className={entry.status === 'void' ? styles.voidRow : ''}>
                        <td style={{ whiteSpace: 'nowrap' }}>{entry.entryDate}</td>
                        <td>
                          <span className="entryDesc">{entry.description}</span>
                          {isTransfer && <span className={styles.linkedIndicator}>↔</span>}
                        </td>
                        <td style={{ color: 'var(--white-40)', fontSize: '0.8rem' }}>{entry.category ?? '—'}</td>
                        <td>
                          <span className={`${styles.typeChip} ${typeChipClass(entry.entryType, styles)}`}>
                            {entryTypeLabel(entry.entryType)}
                          </span>
                        </td>
                        <td>
                          <span className={isPos ? styles.amountPos : styles.amountNeg}>
                            {isPos ? '+' : '−'}{formatCurrency(entry.amount)}
                          </span>
                        </td>
                        <td>
                          <span className={`${styles.statusBadge} ${statusBadgeClass(entry.status, styles)}`}>
                            {entry.status}
                          </span>
                        </td>
                        {isOwner && (
                          <td>
                            <div className={styles.actionBtns}>
                              {!isTransfer && entry.status !== 'void' && (
                                <button
                                  className={styles.actionBtn}
                                  title="Edit entry"
                                  onClick={() => openEditEntry(entry)}
                                >
                                  <Pencil size={13} />
                                </button>
                              )}
                              {entry.status !== 'void' && (
                                <button
                                  className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                                  title={isTransfer ? 'Void entry (transfer — both sides must be voided separately)' : 'Void entry'}
                                  onClick={() => handleVoid(entry)}
                                >
                                  <X size={13} />
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Load more / count */}
          <div className={styles.tableFooter}>
            <span style={{ fontSize: '0.78rem', color: 'var(--white-40)' }}>
              {entries.length} {entries.length === 1 ? 'entry' : 'entries'} shown
            </span>
            {hasMore && (
              <button className={styles.loadMoreBtn} onClick={() => fetchPage(tab, offset, true)} disabled={loadingMore}>
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            )}
          </div>
        </>
      ) : (
        <p className={styles.muted}>Ledger not found.</p>
      )}

      {/* Add / Edit entry modal */}
      {entryModal && (
        <div className={styles.modalOverlay} onClick={() => setEntryModal(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>{entryModal === 'add' ? 'Add Entry' : 'Edit Entry'}</h3>
              <button className={styles.modalCloseBtn} onClick={() => setEntryModal(null)}><X size={16} /></button>
            </div>

            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="ae-date">Date</label>
                <input id="ae-date" type="date" className={styles.input} value={entryForm.entryDate} onChange={e => ef('entryDate', e.target.value)} />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="ae-amount">Amount ($)</label>
                <input id="ae-amount" type="number" min="0.01" max="999999.99" step="0.01" className={styles.input} value={entryForm.amount} onChange={e => ef('amount', e.target.value)} placeholder="0.00" />
              </div>
              <div className={`${styles.field} ${styles.formGridFull}`}>
                <label className={styles.label} htmlFor="ae-desc">Description</label>
                <input id="ae-desc" type="text" className={styles.input} value={entryForm.description} onChange={e => ef('description', e.target.value.slice(0, 500))} placeholder="e.g. Diamond rental — Lions Park" maxLength={500} />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="ae-type">Type</label>
                <select id="ae-type" className={styles.select} value={entryForm.entryType} onChange={e => ef('entryType', e.target.value as 'income' | 'expense')}>
                  <option value="income">Income</option>
                  <option value="expense">Expense</option>
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="ae-status">Status</label>
                <select id="ae-status" className={styles.select} value={entryForm.status} onChange={e => ef('status', e.target.value as 'posted' | 'pending')}>
                  <option value="posted">Posted</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
              <div className={`${styles.field} ${styles.formGridFull}`}>
                <label className={styles.label} htmlFor="ae-cat">Category</label>
                <input id="ae-cat" type="text" className={styles.input} list="ae-cat-list" value={entryForm.category} onChange={e => ef('category', e.target.value.slice(0, 100))} placeholder="e.g. Umpire fees" maxLength={100} />
                <datalist id="ae-cat-list">
                  {CATEGORY_SUGGESTIONS.map(c => <option key={c} value={c} />)}
                </datalist>
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button type="button" className="btn btn-ghost" onClick={() => setEntryModal(null)}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={handleSubmitEntry} disabled={submitting}>
                {submitting ? 'Saving…' : entryModal === 'add' ? 'Add Entry' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer modal */}
      {transferModal && (
        <div className={styles.modalOverlay} onClick={() => setTransferModal(false)}>
          <div className={`${styles.modal} ${styles.modalLg}`} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Add Transfer</h3>
              <button className={styles.modalCloseBtn} onClick={() => setTransferModal(false)}><X size={16} /></button>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>From</label>
              <div style={{ padding: '0.55rem 0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', fontSize: '0.9rem', color: 'var(--white-60)' }}>
                {ledger?.name ?? 'This ledger'}
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="tr-to">To</label>
              <select id="tr-to" className={styles.select} value={transferForm.toLedgerId} onChange={e => tf('toLedgerId', e.target.value)}>
                <option value="">— Select destination ledger —</option>
                {allLedgers.map(({ ledger: l }) => (
                  <option key={l.id} value={l.id}>{l.name} ({l.entityType})</option>
                ))}
              </select>
              {allLedgers.length === 0 && (
                <p className={styles.hint}>No other ledgers available. Create another ledger from the Overview page first.</p>
              )}
            </div>

            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="tr-amount">Amount ($)</label>
                <input id="tr-amount" type="number" min="0.01" max="999999.99" step="0.01" className={styles.input} value={transferForm.amount} onChange={e => tf('amount', e.target.value)} placeholder="0.00" />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="tr-date">Date</label>
                <input id="tr-date" type="date" className={styles.input} value={transferForm.entryDate} onChange={e => tf('entryDate', e.target.value)} />
              </div>
              <div className={`${styles.field} ${styles.formGridFull}`}>
                <label className={styles.label} htmlFor="tr-desc">Description</label>
                <input id="tr-desc" type="text" className={styles.input} value={transferForm.description} onChange={e => tf('description', e.target.value.slice(0, 500))} placeholder="e.g. Budget allocation — Battle of the Bats 2026" maxLength={500} />
              </div>
              <div className={`${styles.field} ${styles.formGridFull}`}>
                <label className={styles.label} htmlFor="tr-cat">Category</label>
                <input id="tr-cat" type="text" className={styles.input} list="tr-cat-list" value={transferForm.category} onChange={e => tf('category', e.target.value.slice(0, 100))} placeholder="e.g. Administrative" maxLength={100} />
                <datalist id="tr-cat-list">
                  {CATEGORY_SUGGESTIONS.map(c => <option key={c} value={c} />)}
                </datalist>
              </div>
            </div>

            <p className={styles.hint} style={{ marginTop: '0.25rem' }}>
              A matching entry will be created in both ledgers atomically.
            </p>

            <div className={styles.modalFooter}>
              <button type="button" className="btn btn-ghost" onClick={() => setTransferModal(false)}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={handleTransfer} disabled={transferring}>
                {transferring ? 'Transferring…' : 'Record Transfer'}
              </button>
            </div>
          </div>
        </div>
      )}

      <FeedbackModal
        isOpen={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
        title={feedbackType === 'success' ? 'Done' : 'Error'}
        message={feedbackMsg}
        type={feedbackType}
      />
    </div>
  );
}
