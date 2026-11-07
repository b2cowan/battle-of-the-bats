'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ComponentProps, type FormEvent } from 'react';
import KitDialog, { DialogCancel, DialogReason } from '@/components/shared/KitDialog';
import DateInput from '@/components/shared/DateInput';
import { businessCents, type ExpenseRevision, type FieldRefusal } from '@/lib/bookkeeping-expenses';
import { type OwnerMovementKind, type OwnerMovementRevision } from '@/lib/bookkeeping-owner-movements';
import { ownerVoidValues } from '@/lib/bookkeeping-void';
import { bookkeepingAddress } from '@/lib/bookkeeping-navigation';
import { consoleDate, consoleWhen } from '@/lib/console-dates';
import { tournamentToday } from '@/lib/timezone';
import BookkeepingQuestion from './BookkeepingQuestion';
import kit from '../console.module.css';
import styles from './bookkeeping.module.css';

export const TRANSFER_LABELS: Record<OwnerMovementKind, string> = { owner_contribution: 'Money put into the business', owner_draw: 'Money taken out for personal use', expense_reimbursement: 'Pay myself back for an expense' };
const money = (cents: number) => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(cents / 100);
export default function OwnerTransferWindow({ movement, revisions, expenses, steps, startEditing, startVoid, address, homeAddress, onClose, onSaved, onOpenExpense }: {
  movement: OwnerMovementRevision | null; revisions: OwnerMovementRevision[]; expenses: ExpenseRevision[];
  startEditing?: boolean; startVoid?: boolean; address: string; homeAddress: string; onClose: () => void;
  steps?: ComponentProps<typeof KitDialog>['steps'];
  onSaved: (row: OwnerMovementRevision) => void; onOpenExpense: (row: ExpenseRevision) => void;
}) {
  const [id] = useState(() => movement?.movement_id ?? crypto.randomUUID());
  const [editing, setEditing] = useState(!movement || Boolean(startEditing && !movement.void_reason));
  const [dirty, setDirty] = useState(false);
  const [kind, setKind] = useState<OwnerMovementKind>(movement?.movement_kind ?? 'owner_contribution');
  const [date, setDate] = useState(movement?.movement_date ?? tournamentToday());
  const [error, setError] = useState<FieldRefusal | null>(null);
  const [busy, setBusy] = useState(false);
  const [question, setQuestion] = useState<'correct' | 'void' | null>(null);
  const form = useRef<HTMLFormElement>(null);
  const baseline = useRef('');
  const pending = useRef<Record<string, unknown> | null>(null);
  const params = new URLSearchParams(address.split('?')[1] ?? '');
  const windowAddress = bookkeepingAddress(params, { view: 'ledger', movement: movement?.movement_id ?? null, transfer: movement ? editing ? 'correct' : null : 'add', record: null, form: null });
  useLayoutEffect(() => {
    if (window.location.pathname + window.location.search === address) window.history.replaceState(window.history.state, '', homeAddress);
    // The window, rather than the router, owns its subsequent history steps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useLayoutEffect(() => { if (editing && form.current) baseline.current = JSON.stringify(payload()); }, [editing]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!startVoid || !movement || movement.void_reason) return;
    const timer = window.setTimeout(() => setQuestion('void'), 0);
    return () => window.clearTimeout(timer);
  }, [startVoid, movement]);
  useEffect(() => { if (error?.field) document.getElementById(`bk-move-${error.field}`)?.focus(); }, [error]);
  const fieldFor = (name: string) => ({ id: `bk-move-${name}`, ...(error?.field === name ? { 'aria-invalid': true as const, 'aria-describedby': 'bk-transfer-error' } : {}) });
  function payload(): Record<string, unknown> {
    const data = new FormData(form.current!);
    return { movementId: id, ...(movement ? { expectedRevision: movement.revision } : {}), movementDate: date, movementKind: kind,
      amount: data.get('amount'), linkedExpenseId: kind === 'expense_reimbursement' ? data.get('linkedExpenseId') : null,
      sourceReference: data.get('sourceReference'), note: data.get('note') };
  }
  async function persist(values: Record<string, unknown>): Promise<string | null> {
    setBusy(true); setError(null);
    try {
      const response = await fetch('/api/platform-admin/bookkeeping/owner-movements', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.movement) {
        if (body.field && body.field !== 'changeReason' && body.field !== 'voidReason') { setQuestion(null); setError(body); return null; }
        return body.error ?? 'Unable to save the transfer.';
      }
      setDirty(false); setEditing(false); onSaved(body.movement); return null;
    } catch { return 'Unable to save the transfer.'; }
    finally { setBusy(false); }
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return; setError(null);
    const values = payload();
    if (movement) {
      if (JSON.stringify(values) === baseline.current) { setDirty(false); setEditing(false); return; }
      pending.current = values; setQuestion('correct');
    } else { const refusal = await persist(values); if (refusal) setError({ error: refusal }); }
  }
  const personal = expenses.filter(row => !row.void_reason && row.payment_source === 'personal');
  const linked = expenses.find(row => row.expense_id === movement?.linked_expense_id);
  const history = revisions.filter(row => row.movement_id === movement?.movement_id).sort((a, b) => b.revision - a.revision);
  return <><KitDialog key={windowAddress} kind="form" size="medium" record={Boolean(movement)} title={movement ? TRANSFER_LABELS[movement.movement_kind] : 'Add owner transfer'}
    eyebrow={movement ? <>Owner transfer · {consoleDate(movement.movement_date)}</> : 'Owner transfer · new'} address={windowAddress} dirty={editing && dirty} busy={busy} onClose={onClose}
    steps={movement && steps ? { ...steps, ...(editing ? { prev: null, next: null } : {}) } : undefined}
    edit={movement && !movement.void_reason ? { editing, label: editing ? 'Save correction' : 'Correct transfer', disabled: busy,
      onToggle: () => editing ? form.current?.requestSubmit() : setEditing(true) } : undefined}
    footerStart={editing ? movement ? 'A correction is saved with its reason.' : 'Record a transfer that actually happened.' : undefined}
    footer={editing ? <><DialogCancel className={styles.quietButton} />{!movement && <button type="submit" form="bk-transfer-form" className={styles.primaryAction} disabled={busy}>{busy ? 'Saving…' : 'Save transfer'}</button>}</> : undefined}>
    {editing ? <form ref={form} id="bk-transfer-form" className={styles.form} onSubmit={save} onChange={() => { setDirty(true); setError(null); }}>
      <label>What happened?<select {...fieldFor('movementKind')} className={kit.select} value={kind} onChange={event => setKind(event.target.value as OwnerMovementKind)}>{Object.entries(TRANSFER_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      {kind === 'expense_reimbursement' && <label>Which personal expense did you repay?<select {...fieldFor('linkedExpenseId')} className={kit.select} name="linkedExpenseId" defaultValue={movement?.linked_expense_id ?? ''} required><option value="">Choose an expense</option>{personal.map(row => <option key={row.expense_id} value={row.expense_id}>{row.supplier} · {consoleDate(row.incurred_date ?? row.expense_date)} · {money(businessCents(row))}</option>)}</select></label>}
      <div className={styles.pair}><label>Transfer date<DateInput className={kit.field} {...fieldFor('movementDate')} name="movementDate" required value={date} onChange={value => { setDirty(true); setDate(value); }} /></label>
        <label>Amount in CAD<input {...fieldFor('amount')} className={kit.field} name="amount" inputMode="decimal" required defaultValue={movement ? (movement.amount_cents / 100).toFixed(2) : ''} /></label></div>
      <label>Bank reference or transfer ID (optional)<input {...fieldFor('sourceReference')} className={kit.field} name="sourceReference" maxLength={160} defaultValue={movement?.source_reference ?? ''} /></label>
      <label>Note (optional)<textarea {...fieldFor('note')} className={kit.textarea} name="note" maxLength={1000} defaultValue={movement?.note ?? ''} /></label>
      <DialogReason>{error && <span id="bk-transfer-error">{error.error}</span>}</DialogReason>
    </form> : movement && <>
      {movement.void_reason && <p className={styles.dateWarning}>Voided: {movement.void_reason}. This record is excluded from active transfers.</p>}
      <div className={styles.recordCard}><dl><div><dt>Amount</dt><dd>{money(movement.amount_cents)}</dd></div><div><dt>Transfer date</dt><dd>{consoleDate(movement.movement_date)}</dd></div><div><dt>Bank reference</dt><dd>{movement.source_reference ?? 'None recorded'}</dd></div></dl></div>
      {movement.note && <p>{movement.note}</p>}
      {linked && <p>Linked expense: <button type="button" className={styles.textButton} onClick={() => { onClose(); onOpenExpense(linked); }}>{linked.supplier}</button></p>}
      <section className={styles.historySection}><h3>Changes · {history.length}</h3><ol className={styles.history}>{history.map(row => <li key={row.revision}>Rev. {row.revision} · {consoleWhen(row.created_at)} · {money(row.amount_cents)} · {row.change_reason ?? 'First entry'}{row.void_reason ? ` · Voided: ${row.void_reason}` : ''}</li>)}</ol></section>
      {!movement.void_reason && <div className={styles.recordActions}><button type="button" className={styles.quietButton} onClick={() => setQuestion('void')}>Void this transfer…</button></div>}
    </>}
  </KitDialog>
  {question && movement && <BookkeepingQuestion title={question === 'void' ? 'Void this transfer?' : 'Why are you correcting this transfer?'}
    lead={question === 'void' ? <><strong>{TRANSFER_LABELS[movement.movement_kind]} · {money(movement.amount_cents)} · {consoleDate(movement.movement_date)}</strong> leaves your active transfers. It stays in the history, exactly as entered.</> : undefined}
    keep={question === 'void' ? 'Keep it' : 'Keep editing'} confirm={question === 'void' ? 'Void transfer' : 'Save correction'} onClose={() => setQuestion(null)}
    submit={reason => persist({ ...(question === 'void' ? { ...ownerVoidValues(movement), voidReason: reason } : pending.current), changeReason: reason })} />}
  </>;
}
