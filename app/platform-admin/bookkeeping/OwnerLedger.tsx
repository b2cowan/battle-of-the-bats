'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { businessCents, type ExpenseRevision, type FieldRefusal } from '@/lib/bookkeeping-expenses';
import { ownerLedgerRows, type OwnerMovementKind, type OwnerMovementRevision } from '@/lib/bookkeeping-owner-movements';
import styles from './bookkeeping.module.css';
import DateInput from '@/components/shared/DateInput';

const labels: Record<OwnerMovementKind, string> = {
  owner_contribution: 'Money put into the business',
  owner_draw: 'Money taken out for personal use',
  expense_reimbursement: 'Pay myself back for an expense',
};
const money = (cents: number) => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(cents / 100);
const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export default function OwnerLedger({ expenses, initialMovements, initialRevisions, schemaReady, onOpenExpense }: {
  expenses: ExpenseRevision[];
  initialMovements: OwnerMovementRevision[];
  initialRevisions: OwnerMovementRevision[];
  schemaReady: boolean;
  onOpenExpense: (expense: ExpenseRevision) => void;
}) {
  const [movements, setMovements] = useState(initialMovements);
  const [revisions, setRevisions] = useState(initialRevisions);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<OwnerMovementRevision | null>(null);
  const [formId, setFormId] = useState(() => crypto.randomUUID());
  const [formVersion, setFormVersion] = useState(0);
  const [kind, setKind] = useState<OwnerMovementKind>('owner_contribution');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showForm, setShowForm] = useState(false);
  // A refusal shows beside the button that was pressed: the transfer form's Save, or the record's Void.
  const [formError, setFormError] = useState<FieldRefusal | null>(null);
  const [voidError, setVoidError] = useState('');
  const selected = movements.find(row => row.movement_id === selectedId) ?? null;
  useEffect(() => {
    if (formError?.field) document.getElementById(`bk-move-${formError.field}`)?.focus();
  }, [formError]);
  const fieldFor = (name: string) => formError?.field === name
    ? { id: `bk-move-${name}`, 'aria-invalid': true as const, 'aria-describedby': 'bk-move-error' }
    : { id: `bk-move-${name}` };
  const personalExpenses = expenses.filter(row => !row.void_reason && row.payment_source === 'personal');
  const rows = useMemo(() => ownerLedgerRows(expenses, movements), [expenses, movements]);

  useEffect(() => {
    if (!schemaReady) return;
    let active = true;
    fetch('/api/platform-admin/bookkeeping/owner-movements', { cache: 'no-store' })
      .then(async response => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? 'Unable to load owner movements');
        if (active) { setMovements(body.movements); setRevisions(body.revisions); }
      }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Unable to load owner movements'); });
    return () => { active = false; };
  }, [schemaReady]);

  function openForm(row: OwnerMovementRevision | null = null) {
    setEditing(row);
    setKind(row?.movement_kind ?? 'owner_contribution');
    setFormId(row?.movement_id ?? crypto.randomUUID());
    setFormVersion(value => value + 1);
    setShowForm(true);
    setError(''); setFormError(null); setVoidError('');
  }

  async function reload() {
    const response = await fetch('/api/platform-admin/bookkeeping/owner-movements', { cache: 'no-store' });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? 'Unable to reload owner movements');
    setMovements(body.movements);
    setRevisions(body.revisions);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const form = new FormData(event.currentTarget);
    const payload = {
      movementId: formId,
      expectedRevision: editing?.revision,
      movementDate: form.get('movementDate'),
      movementKind: kind,
      amount: form.get('amount'),
      linkedExpenseId: kind === 'expense_reimbursement' ? form.get('linkedExpenseId') : null,
      sourceReference: form.get('sourceReference'),
      note: form.get('note'),
      changeReason: editing ? form.get('changeReason') : undefined,
    };
    setSaving(true); setError(''); setNotice(''); setFormError(null);
    try {
      const response = await fetch('/api/platform-admin/bookkeeping/owner-movements', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) { setFormError(typeof body.error === 'string' ? body : { error: 'Unable to save the transfer.' }); return; }
      await reload();
      setSelectedId(formId); setShowForm(false); setEditing(null);
      setNotice(body.repeated ? 'This transfer was already saved.' : editing ? 'Correction saved with its history.' : 'Owner transfer saved.');
    } catch { setFormError({ error: 'Unable to save the transfer.' }); }
    finally { setSaving(false); }
  }

  async function voidMovement(row: OwnerMovementRevision, reason: string) {
    if (!reason.trim() || saving) return;
    setSaving(true); setError(''); setNotice(''); setVoidError('');
    try {
      const response = await fetch('/api/platform-admin/bookkeeping/owner-movements', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ movementId: row.movement_id, expectedRevision: row.revision,
          movementDate: row.movement_date, movementKind: row.movement_kind, amount: (row.amount_cents / 100).toFixed(2),
          linkedExpenseId: row.linked_expense_id, sourceReference: row.source_reference, note: row.note,
          changeReason: reason, voidReason: reason }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) { setVoidError(typeof body.error === 'string' ? body.error : 'Unable to void the transfer.'); return; }
      await reload();
      setNotice('Owner transfer voided; its history is retained.');
    } catch { setVoidError('Unable to void the transfer.'); }
    finally { setSaving(false); }
  }

  return <section className={styles.panel} aria-labelledby="owner-ledger-title">
    <div className={styles.viewHeading}><div><p className={styles.eyebrow}>Business and owner activity</p><h2 id="owner-ledger-title">Ledger</h2>
      <p>See recorded expenses and money moved between you and the business, newest first.</p></div>
      {schemaReady && <button type="button" className={styles.primaryAction} onClick={() => openForm()}>+ Add owner transfer</button>}</div>
    <p className={styles.dateWarning}>Recorded activity only. Income imports, bank matching and a reconciled cash balance are still being prepared. A personal expense appears once as an expense; paying yourself back is a separate transfer.</p>
    {!schemaReady && <p role="status" className={styles.notice}>Owner transfer entry is paused while its storage is prepared.</p>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {notice && <p role="status" className={styles.notice}>{notice}</p>}

    {showForm && schemaReady && <form key={formVersion} className={styles.form} onSubmit={event => void save(event)} onChange={event => {
      // Editing the refused field retires its refusal; the next Save checks again.
      if (formError?.field && (event.target as HTMLElement).id === `bk-move-${formError.field}`) setFormError(null);
    }}>
      <h3>{editing ? 'Correct owner transfer' : 'Add owner transfer'}</h3>
      <p className={styles.hint}>Record a transfer that actually happened. If you paid for a purchase personally, record the purchase under Expenses first.</p>
      <label>What happened?<select value={kind} {...fieldFor('movementKind')} onChange={event => setKind(event.target.value as OwnerMovementKind)}>
        {Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
      {kind === 'expense_reimbursement' && <label>Which personal expense did you repay?<select name="linkedExpenseId" defaultValue={editing?.linked_expense_id ?? ''} required {...fieldFor('linkedExpenseId')}>
        <option value="">Choose an expense</option>{personalExpenses.map(row => <option key={row.expense_id} value={row.expense_id}>{row.supplier} · {row.incurred_date ?? row.expense_date} · {money(businessCents(row))}</option>)}
      </select></label>}
      <label>Transfer date<DateInput name="movementDate" defaultValue={editing?.movement_date ?? today()} required {...fieldFor('movementDate')} /></label>
      <label>Amount in CAD<input name="amount" inputMode="decimal" defaultValue={editing ? (editing.amount_cents / 100).toFixed(2) : ''} required {...fieldFor('amount')} /></label>
      <label>Bank reference or transfer ID <span className={styles.hint}>(optional)</span><input name="sourceReference" maxLength={160} defaultValue={editing?.source_reference ?? ''} {...fieldFor('sourceReference')} /></label>
      <label>Note <span className={styles.hint}>(optional)</span><textarea name="note" maxLength={1000} defaultValue={editing?.note ?? ''} {...fieldFor('note')} /></label>
      {editing && <label>Why are you correcting this transfer?<textarea name="changeReason" maxLength={500} required {...fieldFor('changeReason')} /></label>}
      {formError && <p id="bk-move-error" role="alert" className={`${styles.error} ${styles.formError}`}>{formError.error}</p>}
      <div className={styles.recordActions}><button type="submit" className={styles.primaryAction} disabled={saving}>{saving ? 'Saving…' : editing ? 'Save correction' : 'Save transfer'}</button>
        <button type="button" className={styles.textButton} disabled={saving} onClick={() => setShowForm(false)}>Cancel</button></div>
    </form>}

    {selected && <div className={styles.recordCard}><h3>{labels[selected.movement_kind]}</h3>
      <p>{selected.movement_date} · {money(selected.amount_cents)}{selected.void_reason ? ` · Voided: ${selected.void_reason}` : ''}</p>
      {selected.source_reference && <p>Bank reference: {selected.source_reference}</p>}
      {selected.note && <p>{selected.note}</p>}
      {selected.linked_expense_id && <p>Linked expense: <button type="button" className={styles.textButton} onClick={() => {
        const expense = expenses.find(row => row.expense_id === selected.linked_expense_id);
        if (expense) onOpenExpense(expense);
      }}>{expenses.find(row => row.expense_id === selected.linked_expense_id)?.supplier ?? 'Expense unavailable'}</button></p>}
      {!selected.void_reason && <div className={styles.recordActions}>
        <button type="button" className={styles.textButton} onClick={() => openForm(selected)}>Correct transfer</button>
        <form onSubmit={event => { event.preventDefault(); const reason = new FormData(event.currentTarget).get('reason'); void voidMovement(selected, String(reason ?? '')); }} className={styles.form}>
          <label>Reason for voiding<input name="reason" maxLength={500} required /></label><button type="submit" className={styles.dangerButton} disabled={saving}>Void transfer</button>
          {voidError && <p role="alert" className={`${styles.error} ${styles.formError}`}>{voidError}</p>}
        </form>
      </div>}
      <h4>Changes</h4><ol className={styles.history}>{revisions.filter(row => row.movement_id === selected.movement_id).sort((a, b) => b.revision - a.revision).map(row =>
        <li key={row.revision}>Rev. {row.revision} · {new Date(row.created_at).toLocaleString('en-CA')} · {money(row.amount_cents)}{row.change_reason ? ` · ${row.change_reason}` : ' · First entry'}{row.void_reason ? ' · Voided' : ''}</li>)}</ol>
    </div>}

    {!rows.length ? <p className={styles.empty}>No recorded activity yet.</p> : <div className={styles.rows}>{rows.map(row =>
      <button key={row.key} type="button" className={styles.listDoor} onClick={() => {
        if (row.expense_id && row.type === 'expense') { const expense = expenses.find(item => item.expense_id === row.expense_id); if (expense) onOpenExpense(expense); }
        else { setSelectedId(row.movement_id); setVoidError(''); }
      }}><span><strong>{row.title}</strong><small>{row.date ?? 'Date needs review'} · {row.type === 'expense' ? 'Expense' : labels[row.type]} · {row.cash_direction === 'personal' ? 'Paid personally' : row.cash_direction === 'in' ? 'Money in' : row.cash_direction === 'out' ? 'Money out' : 'Payment needs review'}{row.needs_review ? ' · Needs review' : ''}</small></span><b>{money(row.amount_cents)} ›</b></button>)}</div>}
  </section>;
}
