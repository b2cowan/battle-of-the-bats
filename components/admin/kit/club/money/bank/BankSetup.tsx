'use client';
/**
 * C1 · "I'VE NEVER DONE THIS HERE. WHERE DO I START?" (Bank reconciliation R2c; drawing C1, Ask 3). On a first visit
 * the tab's whole body is this one card — no empty list, no tour. Name the account, the starting date, the bank balance
 * on it, and what was still outstanding then: picked from the books' own lines in the 30 days before the starting date
 * (Ask 3 A), or typed ("Add one the books don't have" — it lives only in the check, never in a book). The same card sets
 * up a second account (C10's "Add and set it up").
 *
 * ⚖ The FIRST account holds every club book (rule 1: a book in no account belongs to it), so its books are listed, not
 * chosen — unticking one would put it nowhere. A book leaves it by being added to a second account (C10).
 * Saving: name the account (or rename it), then its starting point — one PUT with the WHOLE list, refused once a
 * statement starts from it. The treasurer then goes straight to "Check a statement".
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, X } from 'lucide-react';
import ck from '../../ClubKit.module.css';
import { ClubRowList, repKit, useDeferredLoad, useLatestRead } from '../../RepKit';
import { DayField, FormError, TextField, day, moneyFetch } from '../MoneyKit';
import SearchField from '@/components/shared/SearchField';
import LoadingState from '@/components/shared/LoadingState';
import { addCalendarDays, tournamentToday } from '@/lib/timezone';
import { BANK_WORDS as W } from '@/lib/bank-tab-words';
import type { BankDirection } from '@/lib/bank-check';
import { bankUrl, bankWrite, cents, dayYear, parseCents, type AccountView, type Overview } from './BankShared';
import { MoneyField } from './BankWindows';
import { PhoneRow, subLine } from './BankPhone';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import s from './Bank.module.css';

type PickLine = { key: string; date: string; description: string | null; bookName: string | null; direction: BankDirection; amountCents: number };
type Typed = { id: number; date: string; direction: BankDirection; amountCents: number; description: string };

export default function BankSetup({ orgSlug, account, books, onSaved }: {
  orgSlug: string;
  /** The account being set up; null on a first visit (it is named here). */
  account: { id: string; name: string; isFirst: boolean; books: readonly { id: string; name: string }[] } | null;
  /** Every club book (the overview's), for a first account's list. */
  books: Overview['books'];
  onSaved: (view: AccountView) => void;
}) {
  const [accountId, setAccountId] = useState(account?.id ?? null);
  const [savedName, setSavedName] = useState(account?.name ?? '');
  const [name, setName] = useState(account?.name ?? '');
  const [startDate, setStartDate] = useState('');
  const [balance, setBalance] = useState('');
  const [picked, setPicked] = useState<Map<string, PickLine>>(() => new Map());
  const [typed, setTyped] = useState<Typed[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const today = tournamentToday();
  const listedBooks = account && !account.isFirst ? account.books : books.filter(b => !b.accountId || b.accountId === accountId);

  /** A starting date moved drops any pick dated after it (the server would refuse it, Ask 3) or older than the 30 days the
   *  list now shows (a pick the card can no longer show cannot be un-ticked, and would still be sent). */
  function changeStart(next: string) {
    setStartDate(next);
    if (!next) return;
    const from = addCalendarDays(next, -30);
    setPicked(p => {
      const kept = [...p.values()].filter(l => l.date <= next && l.date >= from);
      return kept.length === p.size ? p : new Map(kept.map(l => [l.key, l]));
    });
  }

  async function save() {
    if (busy) return;
    const c = parseCents(balance, { positive: false });
    if (!name.trim() || !startDate || c === null) { setError(W.setupMissing); return; }
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
    const r = await bankWrite(bankUrl(orgSlug, `/accounts/${id}/setup`), 'PUT', {
      openingDate: startDate, openingBalanceCents: c, picked: [...picked.keys()],
      typed: typed.map(t => ({ date: t.date, direction: t.direction, amountCents: t.amountCents, description: t.description })),
    }, W.setupFailed);
    setBusy(false);
    if (r.ok) onSaved(r.view); else setError(r.error);
  }

  return (
    <section className={s.card} aria-labelledby="bank-setup-title">
      <h2 id="bank-setup-title" className={s.cardTitle}>{W.setupTitle}</h2>
      <p className={s.cardLead}>{account && !account.isFirst ? W.setupLeadNext(account.name) : W.setupLead}</p>
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
        <div>
          <DayField id="bank-setup-start" label={W.startDate} value={startDate} onChange={changeStart} max={today} />
          <p className={`${ck.hint} ${s.fieldAfter}`}>{W.startDateHint}</p>
        </div>
        <MoneyField id="bank-setup-balance" label={W.startBalance} value={balance} onChange={setBalance} hint={W.startBalanceHint} />
      </div>
      <Outstanding orgSlug={orgSlug} accountId={accountId} startDate={startDate} picked={picked} setPicked={setPicked}
        typed={typed} setTyped={setTyped} />
      <div className={s.cardFoot}>
        <button type="button" className="btn btn-lime" onClick={() => void save()} disabled={busy}>{busy ? W.saving : W.saveAndCheck}</button>
      </div>
    </section>
  );
}

/** "Still outstanding on {date}" — the books' lines in the 30 days before the starting date (Ask 3 A), plus typed ones. */
function Outstanding({ orgSlug, accountId, startDate, picked, setPicked, typed, setTyped }: {
  orgSlug: string;
  accountId: string | null;
  startDate: string;
  picked: Map<string, PickLine>;
  setPicked: (f: (p: Map<string, PickLine>) => Map<string, PickLine>) => void;
  typed: Typed[];
  setTyped: (f: (t: Typed[]) => Typed[]) => void;
}) {
  const isPhone = useIsPhone();
  const [query, setQuery] = useState('');
  const [q, setQ] = useState('');
  /** What was read, and for which question (a different date, search or account is still loading). */
  const want = `${accountId ?? ''}|${startDate}|${q}`;
  const [got, setGot] = useState<{ want: string; lines: PickLine[]; more: boolean } | null>(null);
  const [failedFor, setFailedFor] = useState<string | null>(null);
  const lines = got?.want === want ? got.lines : null;
  const more = got?.want === want && got.more;
  const failed = failedFor === want;
  const [adding, setAdding] = useState(false);
  const from = startDate ? addCalendarDays(startDate, -30) : '';

  useEffect(() => { const t = window.setTimeout(() => setQ(query.trim()), 300); return () => window.clearTimeout(t); }, [query]);

  const beginRead = useLatestRead();
  const load = useCallback(async (offset: number) => {
    if (!startDate) return;
    const current = beginRead();
    try {
      const r = await moneyFetch<{ lines?: PickLine[]; more?: boolean }>(bankUrl(orgSlug, '/lines-before', {
        date: startDate, account: accountId, q, offset: String(offset),
      }));
      if (!current()) return;
      if (!r.ok) { setFailedFor(want); return; }
      setFailedFor(null);
      const page = (r.data.lines ?? []).filter(l => l.date >= from);
      // Newest first: once a page reaches past the 30 days, nothing further back belongs here.
      const further = !!r.data.more && page.length === (r.data.lines ?? []).length;
      setGot(prev => ({ want, lines: offset === 0 || prev?.want !== want ? page : [...prev.lines, ...page], more: further }));
    } catch {
      if (current()) setFailedFor(want);
    }
  }, [orgSlug, accountId, startDate, q, from, want, beginRead]);
  const loadFirst = useCallback(() => load(0), [load]);
  useDeferredLoad(!!startDate, loadFirst);

  const toggle = (l: PickLine) => setPicked(p => {
    const n = new Map(p);
    if (n.has(l.key)) n.delete(l.key); else n.set(l.key, l);
    return n;
  });
  const shown = useMemo(() => lines ?? [], [lines]);
  const label = startDate ? W.outstandingOn(dayYear(startDate)) : W.outstandingNoDate;

  return (
    <div className={s.fieldGroup}>
      <span className={`${ck.label} ${s.groupLabel}`}>{label}</span>
      {!startDate ? (
        <p className={ck.hint}>{W.outstandingPickDate}</p>
      ) : (
        <>
          <div className={s.pickFind}>
            <SearchField value={query} onChange={setQuery} label={W.outstandingFind} />
          </div>
          {failed ? (
            <p className={`${ck.notice} ${ck.noticeBad}`} role="alert">
              {W.loadFailed}{' '}
              <button type="button" className={s.link} onClick={() => { setFailedFor(null); void load(0); }}>{W.tryAgain}</button>
            </p>
          ) : lines === null ? (
            <LoadingState label={W.loadingLines} inline />
          ) : isPhone ? (
            // R2d · drawing C1 · phone: one column of rows, the whole row the tick.
            <ClubRowList label={label}>
              {shown.length === 0 && typed.length === 0 && <li className={s.pEmpty}>{q ? W.noMatch : W.outstandingNone}</li>}
              {shown.map(l => (
                <PhoneRow key={l.key} ticked={picked.has(l.key)} tickable label={W.tickAria(l.description || W.noLine, cents(l.amountCents))}
                  onTick={() => toggle(l)} what={l.description || W.noLine} sub={subLine(day(l.date), l.bookName)}
                  amount={W.signed(l.direction, cents(l.amountCents))} moneyIn={l.direction === 'in'} />
              ))}
              {typed.map(t => (
                <PhoneRow key={`typed-${t.id}`} ticked tickable={false} what={t.description}
                  sub={subLine(day(t.date), W.typedBook)} amount={W.signed(t.direction, cents(t.amountCents))} moneyIn={t.direction === 'in'}
                  lead={
                    <button type="button" className={s.removeTyped} aria-label={W.typedRemove(t.description)}
                      onClick={() => setTyped(list => list.filter(x => x.id !== t.id))}>
                      <X size={15} aria-hidden />
                    </button>
                  } />
              ))}
            </ClubRowList>
          ) : (
            <div className={repKit.tableFrame}>
              <table className={repKit.table}>
                <thead>
                  <tr>
                    <th scope="col" className={s.tick}><span className="sr-only">{W.col.ticked}</span></th>
                    <th scope="col">{W.col.date}</th>
                    <th scope="col">{W.col.what}</th>
                    <th scope="col">{W.col.book}</th>
                    <th scope="col" className={repKit.num}>{W.col.out}</th>
                    <th scope="col" className={repKit.num}>{W.col.in}</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.length === 0 && typed.length === 0 && (
                    <tr><td colSpan={6} className={s.empty}>{q ? W.noMatch : W.outstandingNone}</td></tr>
                  )}
                  {shown.map(l => (
                    <tr key={l.key} className={`${s.rowTicks}${picked.has(l.key) ? ` ${s.rowTicked}` : ''}`} onClick={() => toggle(l)}>
                      <td className={s.tick}>
                        <input type="checkbox" checked={picked.has(l.key)} onChange={() => toggle(l)} onClick={e => e.stopPropagation()}
                          aria-label={W.tickAria(l.description || W.noLine, cents(l.amountCents))} />
                      </td>
                      <td className={s.dateCell}>{day(l.date)}</td>
                      <td className={s.whatName}>{l.description || W.noLine}</td>
                      <td>{l.bookName ?? ''}</td>
                      <td className={repKit.num}>{l.direction === 'out' ? cents(l.amountCents) : ''}</td>
                      <td className={`${repKit.num} ${s.moneyIn}`}>{l.direction === 'in' ? cents(l.amountCents) : ''}</td>
                    </tr>
                  ))}
                  {typed.map(t => (
                    <tr key={`typed-${t.id}`} className={s.rowTicked}>
                      <td className={s.tick}>
                        <button type="button" className={s.removeTyped} aria-label={W.typedRemove(t.description)}
                          onClick={() => setTyped(list => list.filter(x => x.id !== t.id))}>
                          <X size={15} aria-hidden />
                        </button>
                      </td>
                      <td className={s.dateCell}>{day(t.date)}</td>
                      <td className={s.whatName}>{t.description}</td>
                      <td className={s.whatDim} title={W.typedLead}>{W.typedBook}</td>
                      <td className={repKit.num}>{t.direction === 'out' ? cents(t.amountCents) : ''}</td>
                      <td className={`${repKit.num} ${s.moneyIn}`}>{t.direction === 'in' ? cents(t.amountCents) : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {more && (
            <button type="button" className={s.link} onClick={() => void load(lines?.length ?? 0)}>{W.outstandingMore}</button>
          )}
          <p className={`${ck.hint} ${s.listHint}`}>
            {W.outstandingHint(dayYear(startDate))}{' '}
            {!adding && <button type="button" className={s.link} onClick={() => setAdding(true)}>{W.addTyped}</button>}
          </p>
          {adding && (
            <TypedLine max={startDate} onCancel={() => setAdding(false)}
              onAdd={t => { setTyped(list => [...list, { ...t, id: Date.now() }]); setAdding(false); }} />
          )}
        </>
      )}
    </div>
  );
}

/** "Add one the books don't have": a line that lives only in the check (Ask 3). */
function TypedLine({ max, onAdd, onCancel }: { max: string; onAdd: (t: Omit<Typed, 'id'>) => void; onCancel: () => void }) {
  const [date, setDate] = useState('');
  const [direction, setDirection] = useState<BankDirection>('out');
  const [amount, setAmount] = useState('');
  const [what, setWhat] = useState('');
  const [error, setError] = useState('');
  function add() {
    const c = parseCents(amount, { positive: true });
    if (!date || date > max || c === null || !what.trim()) { setError(W.typedMissing); return; }
    onAdd({ date, direction, amountCents: c, description: what.trim() });
  }
  return (
    <div className={s.typedForm} role="group" aria-label={W.typedTitle}>
      <DayField id="bank-typed-date" label={W.date} value={date} onChange={setDate} max={max} />
      <label className={ck.field} htmlFor="bank-typed-direction">
        <span className={ck.label}>{W.typedDirection}</span>
        <select id="bank-typed-direction" className={ck.select} value={direction} onChange={e => setDirection(e.target.value as BankDirection)}>
          <option value="out">{W.typedOut}</option>
          <option value="in">{W.typedIn}</option>
        </select>
      </label>
      <MoneyField id="bank-typed-amount" label={W.amount} value={amount} onChange={setAmount} />
      <TextField id="bank-typed-what" label={W.typedWhat} required value={what} onChange={setWhat} maxLength={100}
        placeholder={W.typedWhatPlaceholder} />
      <div className={s.actions}>
        <button type="button" className="btn btn-outline btn-sm" onClick={onCancel}>{W.cancel}</button>
        <button type="button" className="btn btn-outline btn-sm" onClick={add}>{W.typedAdd}</button>
      </div>
      {error && <p className={`${repKit.formError} ${s.typedError}`} role="alert">{error}</p>}
    </div>
  );
}


