'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { type ExpenseRevision } from '@/lib/bookkeeping-expenses';
import { currentOwnerMovements, ownerLedgerRows, type OwnerMovementRevision } from '@/lib/bookkeeping-owner-movements';
import { bookkeepingAddress, bookkeepingTransferPlace } from '@/lib/bookkeeping-navigation';
import { consoleDay } from '@/lib/console-dates';
import OwnerTransferWindow, { TRANSFER_LABELS } from './OwnerTransferWindow';
import styles from './bookkeeping.module.css';

const money = (cents: number) => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(cents / 100);
export default function OwnerLedger({ expenses, initialMovements, initialRevisions, schemaReady, onOpenExpense }: {
  expenses: ExpenseRevision[]; initialMovements: OwnerMovementRevision[]; initialRevisions: OwnerMovementRevision[];
  schemaReady: boolean; onOpenExpense: (expense: ExpenseRevision) => void;
}) {
  const search = useSearchParams();
  const params = new URLSearchParams(search.toString());
  const place = bookkeepingTransferPlace(params);
  const [movements, setMovements] = useState(initialMovements);
  const [revisions, setRevisions] = useState(initialRevisions);
  const [selectedId, setSelectedId] = useState<string | null>(place.form === 'add' ? null : place.movement);
  const [showAdd, setShowAdd] = useState(place.form === 'add');
  const [windowMode, setWindowMode] = useState(place.form);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const selected = movements.find(row => row.movement_id === selectedId) ?? null;
  const recordRows = currentOwnerMovements(movements).filter(row => !row.void_reason || row.movement_id === selectedId);
  const recordIndex = recordRows.findIndex(row => row.movement_id === selectedId);
  const steps = selected ? { position: `${recordIndex + 1} of ${recordRows.length}`, noun: 'transfer',
    prev: recordIndex > 0 ? { name: TRANSFER_LABELS[recordRows[recordIndex - 1].movement_kind], onStep: () => openRecord(recordRows[recordIndex - 1].movement_id) } : null,
    next: recordIndex < recordRows.length - 1 ? { name: TRANSFER_LABELS[recordRows[recordIndex + 1].movement_kind], onStep: () => openRecord(recordRows[recordIndex + 1].movement_id) } : null } : undefined;
  function openRecord(id: string | null) { setWindowMode(null); setSelectedId(id); setShowAdd(false); }
  const rows = useMemo(() => ownerLedgerRows(expenses, movements), [expenses, movements]);
  useEffect(() => {
    if (!schemaReady) return;
    let active = true;
    fetch('/api/platform-admin/bookkeeping/owner-movements', { cache: 'no-store' }).then(async response => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Unable to load owner movements');
      if (active) { setMovements(body.movements); setRevisions(body.revisions); }
    }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Unable to load owner movements'); });
    return () => { active = false; };
  }, [schemaReady]);
  function saved(row: OwnerMovementRevision) {
    setMovements(current => [row, ...current.filter(item => item.movement_id !== row.movement_id)]);
    setRevisions(current => [...current, row]); setSelectedId(row.movement_id); setShowAdd(false); setWindowMode(null);
    setNotice(row.void_reason ? 'Owner transfer voided; its history is retained.' : row.revision > 1 ? 'Correction saved with its history.' : 'Owner transfer saved.');
  }
  return <section className={styles.panel} aria-labelledby="owner-ledger-title">
    <div className={styles.viewHeading}><div><p className={styles.eyebrow}>Business and owner activity</p><h2 id="owner-ledger-title">Ledger</h2>
      <p>See recorded expenses and money moved between you and the business, newest first.</p></div>
      {schemaReady && <button type="button" className={styles.primaryAction} onClick={() => { setWindowMode('add'); setSelectedId(null); setShowAdd(true); }}>+ Add owner transfer</button>}</div>
    <p className={styles.dateWarning}>Recorded activity only. Income imports, bank matching and a reconciled cash balance are still being prepared. A personal expense appears once as an expense; paying yourself back is a separate transfer.</p>
    {!schemaReady && <p role="status" className={styles.notice}>Owner transfer entry is paused while its storage is prepared.</p>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {notice && <p role="status" className={styles.notice}>{notice}</p>}
    {place.movement && !selected && selectedId && <p role="alert" className={styles.error}>This transfer is unavailable. Open a transfer from the Ledger.</p>}
    {(showAdd || selected) && schemaReady && <OwnerTransferWindow key={showAdd ? 'new' : selected!.movement_id}
      movement={showAdd ? null : selected} expenses={expenses} revisions={revisions}
      startEditing={windowMode === 'correct'} startVoid={windowMode === 'void'} steps={steps}
      address={bookkeepingAddress(params, { view: 'ledger', movement: showAdd ? null : selected!.movement_id, transfer: showAdd ? 'add' : windowMode === 'correct' || windowMode === 'void' ? windowMode : null, record: null, form: null })}
      homeAddress={bookkeepingAddress(params, { movement: null, transfer: null, record: null, form: null })}
      onClose={() => { setWindowMode(null); setSelectedId(null); setShowAdd(false); }} onSaved={saved} onOpenExpense={onOpenExpense} />}
    {!rows.length ? <p className={styles.empty}>No recorded activity yet.</p> : <div className={styles.rows}>{rows.map(row =>
      <button key={row.key} type="button" className={styles.listDoor} onClick={() => {
        if (row.expense_id && row.type === 'expense') { const expense = expenses.find(item => item.expense_id === row.expense_id); if (expense) onOpenExpense(expense); }
        else openRecord(row.movement_id);
      }}><span><strong>{row.title}</strong><small>{row.date ? consoleDay(row.date) : 'Date needs review'} · {row.type === 'expense' ? 'Expense' : TRANSFER_LABELS[row.type]} · {row.cash_direction === 'personal' ? 'Paid personally' : row.cash_direction === 'in' ? 'Money in' : row.cash_direction === 'out' ? 'Money out' : 'Payment needs review'}{row.needs_review ? ' · Needs review' : ''}</small></span><b>{money(row.amount_cents)} ›</b></button>)}</div>}
  </section>;
}
