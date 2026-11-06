'use client';
/**
 * THE BANK TAB'S WINDOWS (Bank balance check BC1; R0 drawing tab 8: Add an account, Name and books). Each sends INTENT
 * only and answers with the account read again (rule 6); a refusal is the server's own sentence, beside the button
 * (`FormError`).
 */
import { useState } from 'react';
import KitDialog from '../../KitDialog';
import ck from '../../ClubKit.module.css';
import { FormError, TextField } from '../MoneyKit';
import { BANK_WORDS as W } from '@/lib/bank-tab-words';
import { bankUrl, bankWrite, type AccountView, type Overview } from './BankShared';
import s from './Bank.module.css';

type Book = Overview['books'][number];

/**
 * Add an account — and "Name and books" for an account already there. The books list IS the move: a book ticked here
 * that sits in another account moves to this one. Saved checks keep the books they counted (Q3), so a move changes
 * nothing earlier. A book can't be unticked out of an account: it would belong to none — it moves by being ticked in the
 * account it should be in.
 */
export function AccountWindow({ orgSlug, books, accounts, editing, onClose, onDone, onPartial }: {
  orgSlug: string;
  books: readonly Book[];
  accounts: readonly { id: string; name: string }[];
  /** The account being renamed / given books; absent = add a new one. */
  editing?: { id: string; name: string };
  onClose: () => void;
  onDone: (view: AccountView, added: boolean) => void;
  /** An edit saved part of what was asked, then one step was refused: the account as it now stands; the window stays open on the refusal. */
  onPartial: (view: AccountView) => void;
}) {
  const [name, setName] = useState(editing?.name ?? '');
  const [moving, setMoving] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const nameOf = (id: string | null) => accounts.find(a => a.id === id)?.name ?? '';
  const here = (b: Book) => !!editing && b.accountId === editing.id;
  const toggle = (id: string) => setMoving(m => { const n = new Set(m); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const dirty = name !== (editing?.name ?? '') || moving.size > 0;

  async function go() {
    if (busy) return;
    if (!name.trim()) { setError(W.nameMissing); return; }
    setBusy(true); setError('');
    if (!editing) {
      const r = await bankWrite(bankUrl(orgSlug), 'POST', { name: name.trim(), ledgerIds: [...moving] }, W.addAccountFailed);
      setBusy(false);
      if (r.ok) onDone(r.view, true); else setError(r.error);
      return;
    }
    let last: AccountView | null = null;
    if (name.trim() !== editing.name) {
      const r = await bankWrite(bankUrl(orgSlug, `/accounts/${editing.id}`), 'PATCH', { name: name.trim() }, W.editAccountFailed);
      if (!r.ok) { setBusy(false); setError(r.error); return; }
      last = r.view;
    }
    for (const ledgerId of moving) {
      const r = await bankWrite(bankUrl(orgSlug, `/accounts/${editing.id}/books`), 'POST', { ledgerId }, W.editAccountFailed);
      if (!r.ok) { setBusy(false); setError(r.error); if (last) onPartial(last); return; }
      last = r.view;
    }
    setBusy(false);
    if (last) onDone(last, false); else onClose();
  }

  return (
    <KitDialog
      kind="form"
      eyebrow={editing ? W.eyebrow(editing.name) : W.eyebrowBank}
      title={editing ? W.editAccountTitle : W.addAccountTitle}
      onClose={onClose}
      busy={busy}
      dirty={dirty}
      footer={
        <>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>{W.cancel}</button>
          <button type="button" className="btn btn-lime" onClick={() => void go()} disabled={busy}>
            {busy ? W.saving : editing ? W.save : W.addAndStart}
          </button>
        </>
      }
    >
      <FormError>{error}</FormError>
      <div className={s.narrow}>
        <TextField id="bank-account-name" label={W.accountName} required value={name} onChange={setName} maxLength={80}
          hint={W.accountNameHint} />
      </div>
      <div className={s.fieldGroup}>
        <span className={`${ck.label} ${s.groupLabel}`}>{W.booksLabel}</span>
        <ul className={s.bookList}>
          {books.map(b => {
            const isHere = here(b);
            const moves = moving.has(b.id);
            return (
              <li key={b.id} className={s.bookRow}>
                <input type="checkbox" id={`bank-book-${b.id}`} checked={isHere || moves} disabled={isHere || busy}
                  onChange={() => toggle(b.id)} />
                <label htmlFor={`bank-book-${b.id}`} className={s.bookName}>{b.name}</label>
                {isHere ? null : moves
                  ? <span className={s.bookMoves}>{W.bookMoves(nameOf(b.accountId))}</span>
                  : <span className={s.bookWhere}>{b.accountId ? W.bookIn(nameOf(b.accountId)) : W.bookNowhere}</span>}
              </li>
            );
          })}
        </ul>
        <p className={ck.hint}>
          {W.movesKeepEarlier}
          {editing ? ` ${W.booksHere}` : ''}
        </p>
      </div>
    </KitDialog>
  );
}
