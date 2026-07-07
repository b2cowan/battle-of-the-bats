'use client';
import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { Receipt, Plus, X, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useCoaches } from '@/lib/coaches-context';
import PayeeCombobox from '@/components/accounting/PayeeCombobox';
import type { PayeeSelection } from '@/components/accounting/PayeeCombobox';
import styles from '../../../../coaches.module.css';
import type { RepTeamExpense } from '@/lib/types';

function fmt(n: number) {
  return `$${n.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(s: string | null) {
  if (!s) return '—';
  const d = new Date(s.length === 10 ? s + 'T00:00:00' : s);
  return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
}

function isOverdue(dueDate: string | null, paidAt: string | null) {
  if (paidAt || !dueDate) return false;
  return dueDate < new Date().toISOString().slice(0, 10);
}

type ExpenseTab = 'expenses' | 'payables';

const BLANK_EXPENSE = {
  description: '',
  category: '',
  amount: '',
  notes: '',
  paymentMethod: '',
};

const BLANK_PAYABLE = {
  description: '',
  category: '',
  amount: '',
  depositAmount: '',
  depositDueDate: '',
  balanceAmount: '',
  balanceDueDate: '',
  notes: '',
  paymentMethod: '',
};

export default function CoachesExpensesPage({
  params: paramsPromise,
}: {
  params: Promise<{ orgSlug: string; teamId: string }>;
}) {
  const params = use(paramsPromise);
  const { orgSlug, teamId } = params;
  const { assignments, loading: ctxLoading } = useCoaches();

  const [expenses, setExpenses] = useState<RepTeamExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<ExpenseTab>('expenses');

  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showAddPayable, setShowAddPayable] = useState(false);
  const [expenseForm, setExpenseForm] = useState(BLANK_EXPENSE);
  const [payableForm, setPayableForm] = useState(BLANK_PAYABLE);
  const [expensePayee, setExpensePayee] = useState<PayeeSelection | null>(null);
  const [payablePayee, setPayablePayee] = useState<PayeeSelection | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [marking, setMarking] = useState<Record<string, boolean>>({});

  const assignment = assignments.find(a => a.teamId === teamId);
  const base = `/${orgSlug}/coaches/teams/${teamId}`;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/expenses`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to load');
      const data = await res.json();
      setExpenses(data.expenses ?? []);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load expenses.');
    } finally {
      setLoading(false);
    }
  }, [orgSlug, teamId]);

  useEffect(() => { load(); }, [load]);

  async function addExpense() {
    setSaveError('');
    setSaving(true);
    try {
      const amount = parseFloat(expenseForm.amount);
      if (!expenseForm.description.trim()) throw new Error('Description is required');
      if (isNaN(amount) || amount <= 0) throw new Error('Enter a valid amount');
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expenseType:   'expense',
          description:   expenseForm.description.trim(),
          category:      expenseForm.category.trim() || null,
          amount,
          notes:         expenseForm.notes.trim() || null,
          paymentMethod: expenseForm.paymentMethod.trim() || null,
          payeeId:       expensePayee?.payeeId ?? null,
          payeePayer:    expensePayee?.displayName ?? null,
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Save failed');
      setShowAddExpense(false);
      setExpenseForm(BLANK_EXPENSE);
      setExpensePayee(null);
      await load();
    } catch (e: any) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function addPayable() {
    setSaveError('');
    setSaving(true);
    try {
      const amount = parseFloat(payableForm.amount);
      if (!payableForm.description.trim()) throw new Error('Description is required');
      if (isNaN(amount) || amount <= 0) throw new Error('Enter a valid total amount');
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expenseType:    'tournament_payable',
          description:    payableForm.description.trim(),
          category:       payableForm.category.trim() || null,
          amount,
          depositAmount:  payableForm.depositAmount ? parseFloat(payableForm.depositAmount) : null,
          depositDueDate: payableForm.depositDueDate || null,
          balanceAmount:  payableForm.balanceAmount ? parseFloat(payableForm.balanceAmount) : null,
          balanceDueDate: payableForm.balanceDueDate || null,
          notes:          payableForm.notes.trim() || null,
          paymentMethod:  payableForm.paymentMethod.trim() || null,
          payeeId:        payablePayee?.payeeId ?? null,
          payeePayer:     payablePayee?.displayName ?? null,
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Save failed');
      setShowAddPayable(false);
      setPayableForm(BLANK_PAYABLE);
      setPayablePayee(null);
      await load();
    } catch (e: any) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function doAction(expenseId: string, action: string) {
    setMarking(prev => ({ ...prev, [expenseId + action]: true }));
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/expenses/${expenseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed');
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setMarking(prev => ({ ...prev, [expenseId + action]: false }));
    }
  }

  if (ctxLoading) return <p className={styles.muted}>Loading…</p>;
  if (!assignment) {
    return (
      <div className={styles.notAssigned}>
        <h2>Team not found</h2>
        <p>You are not assigned to this team.</p>
      </div>
    );
  }

  const independentExpenses = expenses.filter(e => e.expenseType === 'expense');
  const tournamentPayables = expenses.filter(e => e.expenseType === 'tournament_payable');

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <div className={styles.headerIcon}><Receipt size={22} /></div>
          <div>
            <nav className={styles.breadcrumb}>
              <Link href={`/${orgSlug}/coaches`}>Portal</Link>
              <span>/</span>
              <Link href={base}>{assignment.teamName}</Link>
              <span>/</span>
              <Link href={`${base}/accounting`}>Money</Link>
              <span>/</span>
              <span>Expenses</span>
            </nav>
            <h1 className={styles.pageTitle}>Expenses &amp; Tournament Payables</h1>
            <p className={styles.pageSub}>{assignment.programYearName}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className={styles.btnSecondary} onClick={() => { setShowAddExpense(true); setExpenseForm(BLANK_EXPENSE); setExpensePayee(null); setSaveError(''); }}>
            <Plus size={14} /> Add Expense
          </button>
          <button className={styles.btnSecondary} onClick={() => { setShowAddPayable(true); setPayableForm(BLANK_PAYABLE); setPayablePayee(null); setSaveError(''); }}>
            <Plus size={14} /> Add Payable
          </button>
        </div>
      </div>

      {/* Tab toggle */}
      <div className={styles.viewToggle} style={{ marginBottom: '1.5rem' }}>
        <button className={`${styles.viewToggleBtn} ${tab === 'expenses' ? styles.viewToggleBtnActive : ''}`} onClick={() => setTab('expenses')}>
          Expenses ({independentExpenses.length})
        </button>
        <button className={`${styles.viewToggleBtn} ${tab === 'payables' ? styles.viewToggleBtnActive : ''}`} onClick={() => setTab('payables')}>
          Tournament Payables ({tournamentPayables.length})
        </button>
      </div>

      {loading ? (
        <p className={styles.muted}>Loading…</p>
      ) : error ? (
        <p className={styles.errorText}>{error}</p>
      ) : tab === 'expenses' ? (
        independentExpenses.length === 0 ? (
          <div className={styles.emptyState}>No expenses logged yet. Use "Add Expense" to get started.</div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>Description</th>
                  <th className={styles.th}>Category</th>
                  <th className={styles.th}>Amount</th>
                  <th className={styles.th}>Status</th>
                  <th className={styles.th}></th>
                </tr>
              </thead>
              <tbody>
                {independentExpenses.map(e => (
                  <tr key={e.id} className={styles.tr}>
                    <td className={styles.td}>{e.description}</td>
                    <td className={styles.td} style={{ color: 'rgba(255,255,255,0.5)' }}>{e.category ?? '—'}</td>
                    <td className={styles.td} style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(e.amount)}</td>
                    <td className={styles.td}>
                      {e.expensePaidAt ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', color: '#4ade80' }}>
                          <CheckCircle2 size={12} /> Paid {fmtDate(e.expensePaidAt)}
                        </span>
                      ) : (
                        <span className={`${styles.badge} ${styles.badgeDraft}`} style={{ fontSize: '0.75rem' }}>Unpaid</span>
                      )}
                    </td>
                    <td className={styles.td}>
                      {!e.expensePaidAt && (
                        <button
                          className={styles.btnSecondary}
                          style={{ fontSize: '0.75rem', padding: '0.2rem 0.55rem' }}
                          disabled={!!marking[e.id + 'markExpensePaid']}
                          onClick={() => doAction(e.id, 'markExpensePaid')}
                        >
                          {marking[e.id + 'markExpensePaid'] ? '…' : 'Mark Paid'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        tournamentPayables.length === 0 ? (
          <div className={styles.emptyState}>No tournament payables logged yet. Use "Add Payable" to get started.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {tournamentPayables.map(e => {
              const depositOverdue = isOverdue(e.depositDueDate, e.depositPaidAt);
              const balanceOverdue = isOverdue(e.balanceDueDate, e.balancePaidAt);
              return (
                <div key={e.id} className={styles.detailSection}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                    <div>
                      <p style={{ fontWeight: 600, color: 'rgba(255,255,255,0.9)', margin: 0 }}>{e.description}</p>
                      {e.category && <p className={styles.muted} style={{ margin: 0, fontSize: '0.78rem' }}>{e.category}</p>}
                    </div>
                    <span style={{ fontWeight: 700, fontSize: '1rem', color: 'rgba(255,255,255,0.85)', flexShrink: 0 }}>{fmt(e.amount)}</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    {/* Deposit */}
                    <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 6, padding: '0.65rem 0.85rem' }}>
                      <p style={{ margin: '0 0 0.25rem', fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Deposit</p>
                      {e.depositAmount != null ? (
                        <>
                          <p style={{ margin: 0, fontWeight: 600 }}>{fmt(e.depositAmount)}</p>
                          <p style={{ margin: '0.15rem 0 0', fontSize: '0.78rem', color: depositOverdue ? '#f87171' : 'rgba(255,255,255,0.5)' }}>
                            Due {fmtDate(e.depositDueDate)}
                            {depositOverdue && <AlertTriangle size={11} style={{ marginLeft: 3, verticalAlign: 'middle' }} />}
                          </p>
                          {e.depositPaidAt ? (
                            <span style={{ fontSize: '0.75rem', color: '#4ade80', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.35rem' }}>
                              <CheckCircle2 size={11} /> Paid
                            </span>
                          ) : (
                            <button
                              className={styles.btnSecondary}
                              style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem', marginTop: '0.4rem' }}
                              disabled={!!marking[e.id + 'markDepositPaid']}
                              onClick={() => doAction(e.id, 'markDepositPaid')}
                            >
                              {marking[e.id + 'markDepositPaid'] ? '…' : 'Mark Paid'}
                            </button>
                          )}
                        </>
                      ) : <p className={styles.muted} style={{ margin: 0, fontSize: '0.8rem' }}>—</p>}
                    </div>

                    {/* Balance */}
                    <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 6, padding: '0.65rem 0.85rem' }}>
                      <p style={{ margin: '0 0 0.25rem', fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Balance</p>
                      {e.balanceAmount != null ? (
                        <>
                          <p style={{ margin: 0, fontWeight: 600 }}>{fmt(e.balanceAmount)}</p>
                          <p style={{ margin: '0.15rem 0 0', fontSize: '0.78rem', color: balanceOverdue ? '#f87171' : 'rgba(255,255,255,0.5)' }}>
                            Due {fmtDate(e.balanceDueDate)}
                            {balanceOverdue && <AlertTriangle size={11} style={{ marginLeft: 3, verticalAlign: 'middle' }} />}
                          </p>
                          {e.balancePaidAt ? (
                            <span style={{ fontSize: '0.75rem', color: '#4ade80', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.35rem' }}>
                              <CheckCircle2 size={11} /> Paid
                            </span>
                          ) : (
                            <button
                              className={styles.btnSecondary}
                              style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem', marginTop: '0.4rem' }}
                              disabled={!!marking[e.id + 'markBalancePaid']}
                              onClick={() => doAction(e.id, 'markBalancePaid')}
                            >
                              {marking[e.id + 'markBalancePaid'] ? '…' : 'Mark Paid'}
                            </button>
                          )}
                        </>
                      ) : <p className={styles.muted} style={{ margin: 0, fontSize: '0.8rem' }}>—</p>}
                    </div>
                  </div>

                  {e.notes && <p className={styles.muted} style={{ margin: '0.75rem 0 0', fontSize: '0.78rem' }}>{e.notes}</p>}
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Add Expense modal */}
      {showAddExpense && (
        <div className={styles.modalOverlay} onClick={() => setShowAddExpense(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Add Expense</h3>
              <button className={styles.modalCloseBtn} onClick={() => setShowAddExpense(false)}><X size={16} /></button>
            </div>
            <div className={styles.formGrid}>
              <div className={`${styles.field} ${styles.formGridFull}`}>
                <label className={styles.label}>Description *</label>
                <input className={styles.input} value={expenseForm.description} onChange={e => setExpenseForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. Diamond rental" />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Category</label>
                <input className={styles.input} value={expenseForm.category} onChange={e => setExpenseForm(f => ({ ...f, category: e.target.value }))} placeholder="e.g. Ice time" />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Amount *</label>
                <input className={styles.input} type="number" min={0} step="0.01" value={expenseForm.amount} onChange={e => setExpenseForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Payment Method</label>
                <input className={styles.input} value={expenseForm.paymentMethod} onChange={e => setExpenseForm(f => ({ ...f, paymentMethod: e.target.value }))} placeholder="e.g. E-transfer, Cash" />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Payee</label>
                <PayeeCombobox
                  payeesApiUrl={`/api/coaches/${orgSlug}/teams/${teamId}/payees`}
                  value={expensePayee}
                  onChange={setExpensePayee}
                  saveScope="team"
                />
              </div>
              <div className={`${styles.field} ${styles.formGridFull}`}>
                <label className={styles.label}>Notes</label>
                <textarea className={styles.textarea} rows={2} value={expenseForm.notes} onChange={e => setExpenseForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            {saveError && <p className={styles.errorText} style={{ marginTop: '0.75rem' }}>{saveError}</p>}
            <div className={styles.modalFooter}>
              <button className={styles.btnGhost} onClick={() => setShowAddExpense(false)}>Cancel</button>
              <button className={styles.btnPrimary} disabled={saving} onClick={addExpense}>{saving ? 'Saving…' : 'Add Expense'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Payable modal */}
      {showAddPayable && (
        <div className={styles.modalOverlay} onClick={() => setShowAddPayable(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Add Tournament Payable</h3>
              <button className={styles.modalCloseBtn} onClick={() => setShowAddPayable(false)}><X size={16} /></button>
            </div>
            <div className={styles.formGrid}>
              <div className={`${styles.field} ${styles.formGridFull}`}>
                <label className={styles.label}>Description *</label>
                <input className={styles.input} value={payableForm.description} onChange={e => setPayableForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. Spring Tournament 2025" />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Category</label>
                <input className={styles.input} value={payableForm.category} onChange={e => setPayableForm(f => ({ ...f, category: e.target.value }))} placeholder="Tournament Fees" />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Total Amount *</label>
                <input className={styles.input} type="number" min={0} step="0.01" value={payableForm.amount} onChange={e => setPayableForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Deposit Amount</label>
                <input className={styles.input} type="number" min={0} step="0.01" value={payableForm.depositAmount} onChange={e => setPayableForm(f => ({ ...f, depositAmount: e.target.value }))} placeholder="0.00" />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Deposit Due Date</label>
                <input className={styles.input} type="date" value={payableForm.depositDueDate} onChange={e => setPayableForm(f => ({ ...f, depositDueDate: e.target.value }))} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Balance Amount</label>
                <input className={styles.input} type="number" min={0} step="0.01" value={payableForm.balanceAmount} onChange={e => setPayableForm(f => ({ ...f, balanceAmount: e.target.value }))} placeholder="0.00" />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Balance Due Date</label>
                <input className={styles.input} type="date" value={payableForm.balanceDueDate} onChange={e => setPayableForm(f => ({ ...f, balanceDueDate: e.target.value }))} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Payment Method</label>
                <input className={styles.input} value={payableForm.paymentMethod} onChange={e => setPayableForm(f => ({ ...f, paymentMethod: e.target.value }))} placeholder="e.g. E-transfer, Cash" />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Payee</label>
                <PayeeCombobox
                  payeesApiUrl={`/api/coaches/${orgSlug}/teams/${teamId}/payees`}
                  value={payablePayee}
                  onChange={setPayablePayee}
                  saveScope="team"
                />
              </div>
              <div className={`${styles.field} ${styles.formGridFull}`}>
                <label className={styles.label}>Notes</label>
                <textarea className={styles.textarea} rows={2} value={payableForm.notes} onChange={e => setPayableForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            {saveError && <p className={styles.errorText} style={{ marginTop: '0.75rem' }}>{saveError}</p>}
            <div className={styles.modalFooter}>
              <button className={styles.btnGhost} onClick={() => setShowAddPayable(false)}>Cancel</button>
              <button className={styles.btnPrimary} disabled={saving} onClick={addPayable}>{saving ? 'Saving…' : 'Add Payable'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
