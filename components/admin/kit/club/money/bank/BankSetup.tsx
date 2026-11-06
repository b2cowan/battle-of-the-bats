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
 * Saving: name the account (or rename it), read Stripe's on-its-way for the start's day, then its starting statement (one PUT).
 * ⚖ STRIPE DIDN'T ANSWER = WARN, NEVER BLOCK (owner 2026-11-06, BC1 review M1): the start's books are worked from the money on its
 *   way, so a start saved without it makes every later check read off by those payments. The card says so with Try again and
 *   Start anyway; the saved start keeps "not counted" (the server records NULL, not 0).
 */
import { useState } from 'react';
import { AlertTriangle, Check } from 'lucide-react';
import ck from '../../ClubKit.module.css';
import { Callout } from '../../RepKit';
import { DayField, FormError, TextField } from '../MoneyKit';
import BankMoneyField from './BankMoneyField';
import { tournamentToday } from '@/lib/timezone';
import { BANK_WORDS as W } from '@/lib/bank-tab-words';
import { bankUrl, bankWrite, isStaleView, parseCents, readFigure, type AccountView, type Overview } from './BankShared';
import s from './Bank.module.css';

export default function BankSetup({ orgSlug, account, books, onSaved, onStale }: {
  orgSlug: string;
  /** The account being started; null on a first visit (it is named here). */
  account: { id: string; name: string; isFirst: boolean; books: readonly { id: string; name: string }[] } | null;
  /** Every club book (the overview's), for a first account's list. */
  books: Overview['books'];
  onSaved: (view: AccountView) => void;
  /** The server said the view is stale (someone started it first, the account is gone): the tab re-reads, then says the sentence. */
  onStale: (text: string) => void;
}) {
  const [accountId, setAccountId] = useState(account?.id ?? null);
  const [savedName, setSavedName] = useState(account?.name ?? '');
  const [name, setName] = useState(account?.name ?? '');
  const [date, setDate] = useState('');
  const [balance, setBalance] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  /** Why Stripe's on-its-way couldn't be counted on the start's day: warn, never block (owner 2026-11-06). */
  const [notCounted, setNotCounted] = useState<'stripe_down' | 'unlisted' | null>(null);
  const today = tournamentToday();
  const listedBooks = account && !account.isFirst ? account.books : books.filter(b => !b.accountId || b.accountId === accountId);

  /** `anyway`: the treasurer has read the Stripe notice and starts without it. */
  async function save(anyway = false) {
    if (busy) return;
    const c = parseCents(balance, { positive: false });
    if (!name.trim() || !date || c === null) { setError(W.setupMissing); return; }
    setBusy(true); setError('');
    const fail = (r: { code: string | null; error: string }) => {
      setBusy(false);
      if (isStaleView(r.code)) onStale(r.error); else setError(r.error);
    };
    let id = accountId;
    if (!id) {
      const r = await bankWrite(bankUrl(orgSlug), 'POST', { name: name.trim() }, W.setupFailed);
      if (!r.ok) return fail(r);
      id = r.view.account.id;
      setAccountId(id); setSavedName(r.view.account.name);
    } else if (name.trim() !== savedName) {
      const r = await bankWrite(bankUrl(orgSlug, `/accounts/${id}`), 'PATCH', { name: name.trim() }, W.setupFailed);
      if (!r.ok) return fail(r);
      setSavedName(r.view.account.name);
    }
    if (!anyway) {
      // Is Stripe's money on its way countable on this day? The start's books are worked from it, so a start saved without
      // it makes every later check read off by those payments for good — say so first (the server reads it again to save).
      const f = await readFigure(orgSlug, id, date, 'start');
      if (!f.ok) return fail(f);
      if (f.figure.onItsWay.state === 'not_counted') { setBusy(false); setNotCounted(f.figure.onItsWay.reason); return; }
    }
    const r = await bankWrite(bankUrl(orgSlug, `/accounts/${id}/setup`), 'PUT', { date, bankCents: c }, W.setupFailed);
    if (r.ok) { setNotCounted(null); onSaved(r.view); return; } // the card goes with the account's own view: it stays busy till then
    fail(r);
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
        <DayField id="bank-setup-date" label={W.statementDate} value={date} onChange={v => { setDate(v); setNotCounted(null); }} max={today} />
        <BankMoneyField id="bank-setup-balance" label={W.statementBalance} value={balance} onChange={setBalance} />
      </div>
      {notCounted && (
        <Callout tone="warn" role="status" icon={<AlertTriangle size={16} aria-hidden />}>
          <b>{notCounted === 'stripe_down' ? W.startNoticeDown : W.startNoticeUnlisted}</b>
          <span className={s.noticeSub}>{W.startNoticeWhy}</span>
        </Callout>
      )}
      <div className={s.cardFoot}>
        {notCounted ? (
          <>
            <button type="button" className="btn btn-outline" onClick={() => void save(true)} disabled={busy}>{W.startAnyway}</button>
            <button type="button" className="btn btn-lime" onClick={() => void save()} disabled={busy}>{busy ? W.saving : W.tryAgain}</button>
          </>
        ) : (
          <button type="button" className="btn btn-lime" onClick={() => void save()} disabled={busy}>{busy ? W.saving : W.startHere}</button>
        )}
      </div>
    </section>
  );
}
