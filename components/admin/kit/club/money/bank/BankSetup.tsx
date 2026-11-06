'use client';
/**
 * "START CHECKING {ACCOUNT}" — a club account's first check is a starting statement (Bank balance check BC1; ask 7,
 * drawing BANK_BALANCE_CHECK_DRAWINGS.html tab 6). On a first visit the tab's whole body is this one card: name the
 * account, the books whose money is in it, and a bank statement the treasurer already has — its date and ending balance.
 * No outstanding picker (ask 7): a line written before the start and cashed after it is found later, in Find, and marked
 * "Waiting at the start" (Q2, BC3). The same card starts a second account.
 *
 * ⚖ The FIRST account holds every club book (rule 1: a book in no account belongs to it), so its books are listed, not
 * chosen — unticking one would put it nowhere. A book leaves it by being added to a second account.
 * Saving: name the account (or rename it), then its starting statement (one PUT).
 */
import { useState } from 'react';
import { Check } from 'lucide-react';
import ck from '../../ClubKit.module.css';
import { repKit } from '../../RepKit';
import { DayField, FormError, TextField } from '../MoneyKit';
import { tournamentToday } from '@/lib/timezone';
import { BANK_WORDS as W } from '@/lib/bank-tab-words';
import { bankUrl, bankWrite, parseCents, type AccountView, type Overview } from './BankShared';
import s from './Bank.module.css';

export default function BankSetup({ orgSlug, account, books, onSaved }: {
  orgSlug: string;
  /** The account being started; null on a first visit (it is named here). */
  account: { id: string; name: string; isFirst: boolean; books: readonly { id: string; name: string }[] } | null;
  /** Every club book (the overview's), for a first account's list. */
  books: Overview['books'];
  onSaved: (view: AccountView) => void;
}) {
  const [accountId, setAccountId] = useState(account?.id ?? null);
  const [savedName, setSavedName] = useState(account?.name ?? '');
  const [name, setName] = useState(account?.name ?? '');
  const [date, setDate] = useState('');
  const [balance, setBalance] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const today = tournamentToday();
  const listedBooks = account && !account.isFirst ? account.books : books.filter(b => !b.accountId || b.accountId === accountId);

  async function save() {
    if (busy) return;
    const c = parseCents(balance, { positive: false });
    if (!name.trim() || !date || c === null) { setError(W.setupMissing); return; }
    setBusy(true); setError('');
    let id = accountId;
    if (!id) {
      const r = await bankWrite(bankUrl(orgSlug), 'POST', { name: name.trim() }, W.setupFailed);
      if (!r.ok) { setBusy(false); setError(r.error); return; }
      id = r.view.account.id;
      setAccountId(id); setSavedName(r.view.account.name);
    } else if (name.trim() !== savedName) {
      const r = await bankWrite(bankUrl(orgSlug, `/accounts/${id}`), 'PATCH', { name: name.trim() }, W.setupFailed);
      if (!r.ok) { setBusy(false); setError(r.error); return; }
      setSavedName(r.view.account.name);
    }
    const r = await bankWrite(bankUrl(orgSlug, `/accounts/${id}/setup`), 'PUT', { date, bankCents: c }, W.setupFailed);
    setBusy(false);
    if (r.ok) onSaved(r.view); else setError(r.error);
  }

  return (
    <section className={s.card} aria-labelledby="bank-setup-title">
      <h2 id="bank-setup-title" className={s.cardTitle}>{account ? W.setupTitleFor(account.name) : W.setupTitle}</h2>
      <p className={s.cardLead}>{W.setupLead}</p>
      <FormError inPlace>{error}</FormError>
      <div className={s.narrow}>
        <TextField id="bank-setup-name" label={W.accountName} required value={name} onChange={setName} maxLength={80}
          placeholder={W.accountNamePlaceholder} hint={W.accountNameHint} />
      </div>
      <div className={s.fieldGroup}>
        <span className={`${ck.label} ${s.groupLabel}`}>{W.booksLabel}</span>
        <ul className={s.bookList}>
          {listedBooks.map(b => (
            <li key={b.id} className={s.bookRow}>
              <Check size={16} aria-hidden className={s.tickedMark} />
              <span className={s.bookName}>{b.name}</span>
            </li>
          ))}
        </ul>
        {(!account || account.isFirst) && <p className={ck.hint}>{W.booksHintFirst}</p>}
      </div>
      <div className={s.pair}>
        <DayField id="bank-setup-date" label={W.statementDate} value={date} onChange={setDate} max={today} />
        <MoneyField id="bank-setup-balance" label={W.statementBalance} value={balance} onChange={setBalance} />
      </div>
      <div className={s.cardFoot}>
        <button type="button" className="btn btn-lime" onClick={() => void save()} disabled={busy}>{busy ? W.saving : W.startHere}</button>
      </div>
    </section>
  );
}

/** The statement balance: "$" typed or not, cents to the server (a balance may be negative: an overdraft). */
function MoneyField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className={ck.field} htmlFor={id}>
      <span className={ck.label}>{label}<span className={repKit.req} aria-hidden>*</span></span>
      <input id={id} className={ck.input} inputMode="decimal" value={value} placeholder="$0.00" maxLength={16}
        onChange={e => onChange(e.target.value)} />
    </label>
  );
}
