'use client';
/**
 * "CHECK A STATEMENT" — the check, on the Bank tab itself above the saved checks (Bank balance check BC2a; ask 10, drawing
 * BANK_BALANCE_CHECK_DRAWINGS.html tab 2, plan §6). A treasurer types a statement's DATE and BALANCE; every book line on or
 * before the date counts by itself. The band and the sums read from the server's figure for that day (`GET …?date=`,
 * debounced as the date changes; typing the balance re-figures at once with the engine's `figureCheck`, no round trip).
 * ⚖ RULING 3: Save works whether the check matches or is off. There is no $0.00 gate anywhere.
 * ⚖ RULE 6: the screen sends INTENT (the date, the typed balance); Your books, Stripe on its way and every figure are the
 *   server's, and the saved check's own band comes back with the account read again.
 * ⚖ BC3 owns Find (the hints, the suspects, "Not in the bank yet", "Still waiting?", "Add the missing line"): none of it is
 *   here, so a check that is off can be saved and cannot yet be worked down from this screen.
 * Only a writer is given this component (B7): `BankTab` mounts it behind `canMove`.
 */
import { useEffect, useState } from 'react';
import { figureCheck } from '@/lib/bank-check';
import { BANK_REFUSAL } from '@/lib/bank-check-words';
import { BANK_WORDS as W } from '@/lib/bank-tab-words';
import { tournamentToday } from '@/lib/timezone';
import { useLatestRead } from '../../RepKit';
import { DayField, FormError } from '../MoneyKit';
import BankMoneyField from './BankMoneyField';
import { BankBand, BankSums } from './BankFigure';
import {
  bankUrl, bankWrite, cents, dayYear, isStaleView, parseCents, readFigure, type AccountView, type Figure,
} from './BankShared';
import ck from '../../ClubKit.module.css';
import s from './Bank.module.css';

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const DEBOUNCE_MS = 350;

export default function BankCheckForm({ orgSlug, view, onSaved, onStale }: {
  orgSlug: string;
  view: AccountView;
  /** The account read again after a save, and what to tell the treasurer about it. */
  onSaved: (view: AccountView, text: string) => void;
  /** The server said the view is stale: the tab re-reads, then says the sentence. */
  onStale: (text: string) => void;
}) {
  const today = tournamentToday();
  const accountId = view.account.id;
  const [date, setDate] = useState(today);
  const [asOf, setAsOf] = useState(today); // the date the figure is read for: `date`, after it stops changing
  const [balance, setBalance] = useState('');
  const [figure, setFigure] = useState<Figure | null>(null);
  const [readError, setReadError] = useState('');
  const [again, setAgain] = useState(0); // "Try again" on a figure Stripe couldn't give
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const beginRead = useLatestRead();
  // A saved or deleted check changes what the day's figure says (the suspects, Still waiting?): re-read after one.
  const checksKey = view.checks.map(c => c.id).join(',');

  useEffect(() => {
    const t = window.setTimeout(() => setAsOf(date), DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [date]);

  useEffect(() => {
    if (!ISO_DAY.test(asOf)) return;
    const current = beginRead();
    void readFigure(orgSlug, accountId, asOf, 'check').then(r => {
      if (!current()) return;
      if (r.ok) { setFigure(r.figure); setReadError(''); }
      else { setFigure(null); setReadError(r.error); }
    });
  }, [orgSlug, accountId, asOf, checksKey, again, beginRead]);

  const fresh = figure !== null && figure.date === date && !figure.refused ? figure : null;
  const typed = parseCents(balance, { positive: false });
  // The band is the ENGINE's: with no balance typed yet only "Should be in the bank" is read from it.
  const band = fresh && fresh.booksCents !== null
    ? figureCheck({ bankCents: typed ?? 0, booksCents: fresh.booksCents, onItsWayCents: fresh.onItsWay.cents, waiting: [], cashCents: null })
    : null;
  const lines = fresh && fresh.suspects.total > 0
    ? (fresh.suspects.sinceMatch ? W.linesSinceMatch : W.linesSinceStart)(dayYear(fresh.suspects.since), fresh.suspects.total)
    : null;
  const replaces = !!fresh?.replaces;

  async function save() {
    if (busy || !fresh) return;
    if (typed === null) { setError(W.balanceMissing); return; }
    setBusy(true); setError('');
    const r = await bankWrite(bankUrl(orgSlug, `/accounts/${accountId}/checks`), 'POST', { date, bankCents: typed }, W.saveFailed);
    setBusy(false);
    if (!r.ok) {
      if (isStaleView(r.code)) onStale(r.error); else setError(r.error);
      return;
    }
    const saved = r.view.checks.find(c => c.date === date);
    onSaved(r.view, saved
      ? saved.figure.result === 'matches' ? W.savedMatches(dayYear(date)) : W.savedOff(dayYear(date), cents(saved.figure.offByCents))
      : W.saved);
    setBalance(''); setDate(today); setAsOf(today);
  }

  return (
    <section className={s.checkCard} aria-labelledby="bank-check-title">
      <h2 id="bank-check-title" className={s.checkTitle}>{W.checkTitle}</h2>
      <FormError inPlace>{error}</FormError>
      <div className={s.checkRow}>
        <DayField id="bank-check-date" label={W.statementDate} value={date} onChange={v => { setDate(v); setError(''); }} max={today} />
        <BankMoneyField id="bank-check-balance" label={W.checkBalance} value={balance} onChange={v => { setBalance(v); setError(''); }} />
        <div className={s.checkSave}>
          <button type="button" className="btn btn-lime" onClick={() => void save()} disabled={busy || !fresh}>
            {busy ? W.saving : W.saveCheck}
          </button>
        </div>
      </div>
      {band && band.result === 'off' && typed !== null && <p className={ck.hint}>{W.saveOffNote(cents(band.offByCents))}</p>}
      {replaces && <p className={ck.hint}>{W.replacesNote}</p>}

      <StatusLine figure={figure} date={date} readError={readError} fresh={!!fresh} onRetry={() => setAgain(n => n + 1)} />

      {fresh && fresh.booksCents !== null && band && (
        <>
          <BankBand date={date} figure={band} typed={typed !== null} />
          <BankSums date={date} bookNames={view.account.books.map(b => b.name)} booksCents={fresh.booksCents}
            shouldBeCents={band.shouldBeCents} onItsWay={fresh.onItsWay} payoutsHref={`/${orgSlug}/admin/accounting/payouts`}
            onRetry={() => setAgain(n => n + 1)} />
          {lines && <p className={`${ck.hint} ${s.hintLine}`}>{lines}</p>}
        </>
      )}
    </section>
  );
}

/** What stands in for the band while there isn't one: reading, a refusal the server gave for this day, or a failed read. */
function StatusLine({ figure, date, readError, fresh, onRetry }: {
  figure: Figure | null; date: string; readError: string; fresh: boolean; onRetry: () => void;
}) {
  if (fresh || !ISO_DAY.test(date)) return null;
  if (readError) {
    return (
      <p className={s.statusNote} role="alert">{readError}{' '}
        <button type="button" className={s.link} onClick={onRetry}>{W.tryAgain}</button>
      </p>
    );
  }
  // A day the server won't take a check for (before the start, on the start's day, after today): its own sentence.
  if (figure && figure.date === date && figure.refused) return <p className={s.statusNote} role="status">{BANK_REFUSAL[figure.refused]}</p>;
  return <p className={`${ck.hint} ${s.hintLine}`} role="status">{W.figuring}</p>;
}
