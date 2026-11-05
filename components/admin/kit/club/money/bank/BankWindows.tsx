'use client';
/**
 * THE BANK TAB'S WINDOWS (Bank reconciliation R2c; drawings: the "Check a statement" window, the bank-fee window and
 * its closed-year variant, Undo's reason window, Add an account). Each sends INTENT only and answers with the account
 * read again (rule 6); a refusal is the server's own sentence, beside the button (`FormError`).
 */
import { useRef, useState } from 'react';
import KitDialog from '../../KitDialog';
import ck from '../../ClubKit.module.css';
import { repKit } from '../../RepKit';
import { DayField, FormError, ReasonQuestion, TextField } from '../MoneyKit';
import { ViewSwitch } from '@/components/coaches/kit';
import { BANK_WORDS as W } from '@/lib/bank-tab-words';
import {
  bankUrl, bankWrite, cents, centsField, dayYear, parseCents, type AccountView, type Overview, type Shown, type Summary,
} from './BankShared';
import s from './Bank.module.css';

type Done = (view: AccountView) => void;

/** A money field: "$" typed or not, cents to the server. */
export function MoneyField({ id, label, value, onChange, hint }: {
  id: string; label: string; value: string; onChange: (v: string) => void; hint?: string;
}) {
  return (
    <label className={ck.field} htmlFor={id}>
      <span className={ck.label}>{label}<span className={repKit.req} aria-hidden>*</span></span>
      <input id={id} className={ck.input} inputMode="decimal" value={value} placeholder="$0.00" maxLength={16}
        onChange={e => onChange(e.target.value)} />
      {hint && <p className={ck.hint}>{hint}</p>}
    </label>
  );
}

/**
 * "Check a statement" (B3) — and, from a statement's "Edit", its end date and ending balance corrected while it is open
 * (R2b's "Undo, then re-enter" door). The starting balance is never typed: the window says where it comes from.
 */
export function StatementWindow({ orgSlug, view, editing, onClose, onDone }: {
  orgSlug: string;
  view: AccountView;
  /** The open statement being corrected; absent = start the next one. */
  editing?: Summary;
  onClose: () => void;
  onDone: Done;
}) {
  const [end, setEnd] = useState(editing?.statementEndDate ?? '');
  const [balance, setBalance] = useState(editing ? centsField(editing.statementEndingBalanceCents) : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const next = view.next;
  const startsAfter = editing ? editing.startDate : next?.startsAfter ?? '';
  const startBalance = editing ? editing.startingBalanceCents : next?.startingBalanceCents ?? 0;
  const fromOpening = editing ? view.checks.at(-1)?.id === editing.id : view.checks.length === 0;
  const dirty = end !== (editing?.statementEndDate ?? '') || balance !== (editing ? centsField(editing.statementEndingBalanceCents) : '');

  async function go() {
    if (busy) return;
    const c = parseCents(balance, { positive: false });
    if (!end || c === null) { setError(W.checkMissing); return; }
    setBusy(true); setError('');
    const body = { statementEndDate: end, statementEndingBalanceCents: c };
    const r = editing
      ? await bankWrite(bankUrl(orgSlug, `/accounts/${view.account.id}/checks/${editing.id}`), 'PATCH', body, W.editFailed)
      : await bankWrite(bankUrl(orgSlug, `/accounts/${view.account.id}/checks`), 'POST', body, W.checkFailed);
    setBusy(false);
    if (r.ok) onDone(r.view); else setError(r.error);
  }

  return (
    <KitDialog
      kind="form"
      eyebrow={W.eyebrow(view.account.name)}
      title={editing ? W.editTitle : W.checkTitle}
      onClose={onClose}
      busy={busy}
      dirty={dirty}
      footer={
        <>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>{W.cancel}</button>
          <button type="button" className="btn btn-lime" onClick={() => void go()} disabled={busy}>
            {busy ? W.starting : editing ? W.saveFigures : W.startChecking}
          </button>
        </>
      }
    >
      <FormError>{error}</FormError>
      {startsAfter && (
        <p className={s.windowLead}>
          {fromOpening
            ? W.startsAtOpening(cents(startBalance), dayYear(startsAfter))
            : W.startsAt(cents(startBalance), dayYear(startsAfter))}
        </p>
      )}
      <div className={s.pair}>
        <DayField id="bank-statement-ends" label={W.statementEnds} value={end} onChange={setEnd} />
        <MoneyField id="bank-statement-balance" label={W.endingBalance} value={balance} onChange={setBalance} />
      </div>
      <p className={ck.hint}>{W.bothPrinted}</p>
    </KitDialog>
  );
}

/**
 * Add a bank fee or interest (B5, Asks 1 and 8): ONE real line in one of the account's own books (the account's first
 * by default), ticked on this statement whatever its date. A statement ending in a closed fiscal year offers today.
 */
export function FeeWindow({ orgSlug, view, shown, onClose, onDone }: {
  orgSlug: string;
  view: AccountView;
  shown: Shown;
  onClose: () => void;
  onDone: Done;
}) {
  const d = shown.differenceCents;
  // The statement shows less than you've ticked: the bank took money the books don't have — a fee. More: interest.
  const [kind, setKind] = useState<'bank_fee' | 'interest'>(d > 0 ? 'interest' : 'bank_fee');
  const [amount, setAmount] = useState(d !== 0 ? centsField(Math.abs(d)) : '');
  const [date, setDate] = useState(shown.statementEndDate);
  const [what, setWhat] = useState('');
  const books = view.account.books;
  const [ledgerId, setLedgerId] = useState(books[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fee = shown.feeDate;
  // Ask 8: the statement's end sits in a closed fiscal year — say so, offer today, and hold the button until it moves.
  const closedDay = fee?.redated && date === shown.statementEndDate ? date : null;
  const bookName = books.find(b => b.id === ledgerId)?.name ?? '';

  async function go() {
    if (busy || closedDay) return;
    const c = parseCents(amount, { positive: true });
    if (c === null || !date) { setError(W.feeMissing); return; }
    setBusy(true); setError('');
    const r = await bankWrite(bankUrl(orgSlug, `/accounts/${view.account.id}/checks/${shown.checkId}/lines`), 'POST', {
      kind, amountCents: c, ledgerId: ledgerId || undefined, date, description: what.trim() || undefined,
    }, W.feeFailed);
    setBusy(false);
    if (r.ok) onDone(r.view); else setError(r.error);
  }

  return (
    <KitDialog
      kind="form"
      eyebrow={W.eyebrow(view.account.name)}
      title={W.feeTitle}
      onClose={onClose}
      busy={busy}
      dirty={!!what.trim()}
      footer={
        <>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>{W.cancel}</button>
          <button type="button" className="btn btn-lime" onClick={() => void go()} disabled={busy || !!closedDay}>
            {busy ? W.adding : W.addAndTick}
          </button>
        </>
      }
    >
      <FormError>{error}</FormError>
      <div className={s.kindSwitch}>
        <ViewSwitch label={W.feeKinds} value={kind} onChange={setKind}
          views={[{ id: 'bank_fee', label: W.feeKind.bank_fee }, { id: 'interest', label: W.feeKind.interest }]} />
      </div>
      <div className={s.pair}>
        <MoneyField id="bank-fee-amount" label={W.amount} value={amount} onChange={setAmount} />
        <DayField id="bank-fee-date" label={W.date} value={date} onChange={setDate} />
      </div>
      {closedDay && fee && (
        <div className={s.closedNote} role="note">
          <p>{W.feeClosed(dayYear(closedDay), dayYear(fee.date))}</p>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setDate(fee.date)}>{W.feeUseToday(dayYear(fee.date))}</button>
        </div>
      )}
      <TextField id="bank-fee-what" label={W.what} value={what} onChange={setWhat} maxLength={100}
        placeholder={kind === 'bank_fee' ? W.feeWhatBankFee : W.feeWhatInterest} />
      {books.length > 1 && (
        <label className={ck.field} htmlFor="bank-fee-book">
          <span className={ck.label}>{W.book}<span className={repKit.req} aria-hidden>*</span></span>
          <select id="bank-fee-book" className={ck.select} value={ledgerId} onChange={e => setLedgerId(e.target.value)}>
            {books.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </label>
      )}
      {!closedDay && bookName && <p className={ck.hint}>{W.feeHint(bookName)}</p>}
    </KitDialog>
  );
}

/** Undo the check of the LATEST checked statement (B4, Ask 9): a required reason, kept with the name and the time. */
export function UndoWindow({ orgSlug, view, summary, onClose, onDone, onStale }: {
  orgSlug: string;
  view: AccountView;
  summary: Summary;
  onClose: () => void;
  onDone: Done;
  /** The statement changed under the window: the refusal in words, and the tab reads the account again. */
  onStale: (text: string) => void;
}) {
  const answered = useRef<AccountView | null>(null);
  const stale = useRef('');
  return (
    <ReasonQuestion
      eyebrow={W.eyebrow(view.account.name)}
      title={W.undoTitle(dayYear(summary.statementEndDate))}
      lead={W.undoLead}
      hint={W.undoHint}
      missing={W.undoMissing}
      keepLabel={W.undoKeep}
      confirmLabel={W.undoConfirm}
      busyLabel={W.undoing}
      failText={W.undoFailed}
      submit={async reason => {
        const r = await bankWrite(bankUrl(orgSlug, `/accounts/${view.account.id}/checks/${summary.id}/undo`), 'POST', { reason }, W.undoFailed);
        if (r.ok) { answered.current = r.view; return { ok: true, text: W.undone(dayYear(summary.statementEndDate)) }; }
        if (r.code === 'changed') stale.current = r.error;
        return { ok: false, error: r.error, stale: r.code === 'changed' };
      }}
      onClose={onClose}
      onDone={() => { if (answered.current) onDone(answered.current); else if (stale.current) onStale(stale.current); else onClose(); }}
    />
  );
}

type Book = Overview['books'][number];

/**
 * Add an account (C10, Ask 13) — and "Name and books" for an account already there. The books list IS the move: a book
 * ticked here that sits in another account moves to this one (its unticked lines with it; ticked ones stay on the old
 * account's checks). A book can't be unticked out of an account: it would belong to none — it moves by being ticked in
 * the account it should be in.
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
  const fromNames = [...new Set(books.filter(b => moving.has(b.id)).map(b => nameOf(b.accountId)).filter(Boolean))];

  async function go() {
    if (busy) return;
    if (!name.trim()) { setError(W.setupMissing); return; }
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
            {busy ? W.saving : editing ? W.save : W.addAndSetUp}
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
          {fromNames.length === 1 ? W.movesHint(fromNames[0]) : W.movesHintAny}
          {editing ? ` ${W.booksHere}` : ''}
        </p>
      </div>
    </KitDialog>
  );
}
