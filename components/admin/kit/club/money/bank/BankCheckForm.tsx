'use client';
/**
 * "CHECK A STATEMENT" — the check, on the Bank tab itself above the saved checks (Bank balance check BC2a; ask 10, drawing
 * BANK_BALANCE_CHECK_DRAWINGS.html tab 2, plan §6). A treasurer types a statement's DATE and BALANCE; every book line on or
 * before the date counts by itself. The band and the sums read from the server's figure for that day (`GET …?date=`,
 * debounced as the date changes; typing the balance re-figures at once with the engine's `figureCheck`, no round trip).
 * ⚖ RULING 3: Save works whether the check matches or is off. There is no $0.00 gate anywhere.
 * ⚖ RULE 6: the screen sends INTENT (the date, the typed balance); Your books, Stripe on its way and every figure are the
 *   server's, and the saved check's own band comes back with the account read again.
 * ⚖ FIND (BC3a, `BankFind`): a line marked "Not in the bank yet" joins the sums with Undo and the band re-figures through
 *   `figureCheck` with the marked items (no arithmetic here); Save sends their KEYS only (`waiting`), the server reads each
 *   line's figures itself (rule 6). "Still waiting on {line}?" (ask 2) asks once per item of the latest earlier check, and
 *   per Waiting-at-the-start line of the start as the chain rules (BC4a, the server's `stillWaitingOn`): Yes marks it, No
 *   drops it for this check. A new date clears both.
 * ⚖ THE TWO DOORS OUT OF THE CHECK (BC3b): "Add the missing line" opens the LEDGER'S OWN add window (`AddEntryWindow`), filled
 *   with the gap, the statement's date and the direction (the bank showing more → money in; less → money out), on the
 *   account's own club book; the line is written by the Ledger's route, never by bank code (ask 1). "Waiting at the start"
 *   corrects the starting statement (`PATCH …/setup`). After either, the day's figure is read again (the typed balance stays).
 * Only a writer is given this component (B7): `BankTab` mounts it behind `canMove`.
 * "Check this statement again" (BC2b) re-keys it with `againDate`: the server already replaces a live check of the same
 * date, and the form already says so ("Saving replaces that check").
 */
import { useEffect, useState } from 'react';
import { figureCheck, waitingOnCheck, type BankLine, type WaitingItem } from '@/lib/bank-check';
import type { LedgerKind } from '@/lib/club-ledger';
import { AddEntryWindow, useBudgetWords } from '../LedgerWindows';
import { BANK_REFUSAL } from '@/lib/bank-check-words';
import { BANK_WORDS as W } from '@/lib/bank-tab-words';
import { tournamentToday } from '@/lib/timezone';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import { useLatestRead } from '../../RepKit';
import { DayField, FormError } from '../MoneyKit';
import BankMoneyField from './BankMoneyField';
import { BankBand, BankSums } from './BankFigure';
import BankFind from './BankFind';
import {
  bankUrl, bankWrite, cents, dayYear, fieldAmount, isStaleView, moved, nameOf, notCountedOf, parseCents, patchStart, readFigure, type AccountView,
  type Figure,
} from './BankShared';
import ck from '../../ClubKit.module.css';
import s from './Bank.module.css';

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const DEBOUNCE_MS = 350;
const BALANCE_ID = 'bank-check-balance';

export default function BankCheckForm({ orgSlug, view, onSaved, onChanged, onStale, againDate }: {
  orgSlug: string;
  view: AccountView;
  /** The account read again after a save, and what to tell the treasurer about it. */
  onSaved: (view: AccountView, text: string) => void;
  /** Something outside this check changed (a line added to the books, the start corrected): the account in hand (or, when
   *  null, read it again) and what to say. The form keeps what is typed. */
  onChanged: (view: AccountView | null, text: string) => void;
  /** The server said the view is stale: the tab re-reads, then says the sentence. */
  onStale: (text: string) => void;
  /**
   * "Check this statement again" (BC2b): the saved check's date, handed in from its window. The tab re-keys the form
   * with it, so the form starts on that day with the balance empty, scrolled to and the cursor in the balance.
   */
  againDate?: string;
}) {
  const today = tournamentToday();
  // On a phone the date and the balance sit side by side (drawn; owner 2026-11-06, BC4b): the balance takes the short word.
  const isPhone = useIsPhone();
  const accountId = view.account.id;
  const [date, setDate] = useState(againDate ?? today);
  const [asOf, setAsOf] = useState(againDate ?? today); // the date the figure is read for: `date`, after it stops changing
  const [balance, setBalance] = useState('');
  const [figure, setFigure] = useState<Figure | null>(null);
  const [readError, setReadError] = useState('');
  const [again, setAgain] = useState(0); // "Try again" on a figure Stripe couldn't give
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // Find (BC3a): the lines marked Not in the bank yet (in the order marked), and the Still-waiting items answered No.
  const [marked, setMarked] = useState<ReadonlyMap<string, WaitingItem>>(new Map());
  const [dropped, setDropped] = useState<ReadonlySet<string>>(new Set());
  // "Add the missing line": the Ledger's add window, filled with what the screen said when it opened (the gap, the day, the
  // direction), so a figure read again meanwhile never moves or closes it; the budget words read when it opens.
  const [adding, setAdding] = useState<{ entryType: 'income' | 'expense'; date: string; amount: string } | null>(null);
  const beginRead = useLatestRead();
  // A saved or deleted check, or a corrected start, changes what the day's figure says: re-read after one.
  const checksKey = `${view.checks.map(c => c.id).join(',')}|${view.start?.id ?? ''}:${view.start?.booksCents ?? ''}`;
  const q = `orgSlug=${encodeURIComponent(orgSlug)}`;
  const words = useBudgetWords(q, adding !== null);

  // Handed a date ("Check this statement again"): bring the form into view with the cursor in the balance.
  useEffect(() => {
    if (!againDate) return;
    const field = document.getElementById(BALANCE_ID);
    field?.scrollIntoView({ block: 'center' });
    field?.focus({ preventScroll: true });
  }, [againDate]);

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
  const items = [...marked.values()];
  // The band is the ENGINE's: with no balance typed yet only "Should be in the bank" is read from it.
  const band = fresh && fresh.booksCents !== null
    ? figureCheck({ bankCents: typed ?? 0, booksCents: fresh.booksCents, onItsWayCents: fresh.onItsWay.cents, waiting: items, cashCents: null })
    : null;
  const replaces = !!fresh?.replaces;

  const mark = (w: WaitingItem) => { setMarked(m => new Map(m).set(w.key, w)); setError(''); };
  const unmark = (key: string) => { setMarked(m => { const n = new Map(m); n.delete(key); return n; }); setError(''); };
  /** A new day is a new check: its marks and answers go (the lines and the earlier check's items are that day's). */
  const pickDate = (v: string) => { setDate(v); setError(''); setMarked(new Map()); setDropped(new Set()); };
  const waitingRows = items.map(w => ({ key: w.key, what: nameOf(w), amount: moved(waitingOnCheck(w)), onUndo: () => unmark(w.key) }));
  const askingRows = (fresh?.stillWaiting ?? []).filter(w => !marked.has(w.key) && !dropped.has(w.key)).map(w => ({
    key: w.key, what: nameOf(w), amount: cents(w.amountCents),
    onYes: () => mark(w), onNo: () => setDropped(d => new Set(d).add(w.key)),
  }));

  /** "Waiting at the start" (Q2): the line goes on the starting statement; the account and the day are read again. */
  async function atStart(line: BankLine) {
    if (busy) return;
    setBusy(true); setError('');
    const r = await patchStart(orgSlug, accountId, { add: line.key });
    setBusy(false);
    if (!r.ok) { if (isStaleView(r.code)) onStale(r.error); else setError(r.error); return; }
    // The figure on screen counted the line as one of the books' own: it goes until the day is read again (/review).
    setFigure(null);
    // Putting it on the start says it has cleared by this statement: this check doesn't ask "Still waiting?" about it
    // (owner 2026-11-06, BC4a). Another day asks again, as the chain rules (`stillWaitingOn`).
    setDropped(d => new Set(d).add(line.key));
    onChanged(r.view, W.atStartDone(nameOf(line)));
  }

  // The book "Add the missing line" writes to: the account's own club book (R0 ask 1; the Ledger's rule: the club's, not an
  // event's), else its first.
  const ownBook = view.account.books.find(b => b.kind === 'org' && !b.entityId) ?? view.account.books[0] ?? null;

  async function save() {
    if (busy || !fresh) return;
    if (typed === null) { setError(W.balanceMissing); return; }
    setBusy(true); setError('');
    // `anyway`: the figure on screen is the one without online payments, so saving it is the treasurer's choice. A figure
    // shown counted that Stripe can't count at the save is refused (`not_counted_*`): read again, so they see what saves.
    const anyway = fresh.onItsWay.state === 'not_counted';
    // The marked lines go up as KEYS only: their figures are the server's read of the books (rule 6).
    const r = await bankWrite(bankUrl(orgSlug, `/accounts/${accountId}/checks`), 'POST',
      { date, bankCents: typed, anyway, waiting: [...marked.keys()] }, W.saveFailed);
    setBusy(false);
    if (!r.ok) {
      if (notCountedOf(r.code)) { setError(r.error); setAgain(n => n + 1); }
      else if (isStaleView(r.code)) onStale(r.error); else setError(r.error);
      return;
    }
    const saved = r.view.checks.find(c => c.date === date);
    onSaved(r.view, saved
      ? saved.figure.result === 'matches' ? W.savedMatches(dayYear(date)) : W.savedOff(dayYear(date), cents(saved.figure.offByCents))
      : W.saved);
    setBalance(''); pickDate(today); setAsOf(today);
  }

  // Save and what saving it means: inline after the fields at a desk, the card's last thing on a phone (drawn).
  const saveButton = (
    <div className={s.checkSave}>
      <button type="button" className="btn btn-lime" onClick={() => void save()} disabled={busy || !fresh}>
        {busy ? W.saving : W.saveCheck}
      </button>
    </div>
  );
  const saveNotes = (
    <>
      {band && band.result === 'off' && typed !== null && <p className={ck.hint}>{W.saveOffNote(cents(band.offByCents))}</p>}
      {replaces && <p className={ck.hint}>{W.replacesNote}</p>}
    </>
  );

  return (
    <section className={s.checkCard} aria-labelledby="bank-check-title">
      <h2 id="bank-check-title" className={s.checkTitle}>{W.checkTitle}</h2>
      {/* What went wrong sits by Save: at the card's top at a desk (Save is inline there), above Save on a phone (/review). */}
      {!isPhone && <FormError inPlace>{error}</FormError>}
      <div className={s.checkRow}>
        <DayField id="bank-check-date" label={W.statementDate} value={date} onChange={pickDate} max={today} />
        <BankMoneyField id={BALANCE_ID} label={isPhone ? W.checkBalancePhone : W.checkBalance} value={balance} onChange={v => { setBalance(v); setError(''); }} />
        {!isPhone && saveButton}
      </div>
      {!isPhone && saveNotes}

      <StatusLine figure={figure} date={date} readError={readError} fresh={!!fresh} onRetry={() => setAgain(n => n + 1)} />

      {fresh && fresh.booksCents !== null && band && (
        <>
          <BankBand date={date} figure={band} typed={typed !== null} />
          <BankSums date={date} bookNames={view.account.books.map(b => b.name)} booksCents={fresh.booksCents}
            shouldBeCents={band.shouldBeCents} onItsWay={fresh.onItsWay} payoutsHref={`/${orgSlug}/admin/accounting/payouts`}
            onRetry={() => setAgain(n => n + 1)} waiting={waitingRows} asking={askingRows} />
          <BankFind key={date} figure={fresh} band={band} typed={typed !== null} marked={marked} busy={busy} onMark={mark} onUndo={unmark}
            onAtStart={l => void atStart(l)} onAddLine={() => setAdding({
              // The gap, the statement's day, and the way it must go to close it: the bank holding more is money in.
              entryType: band.direction === 'bank_more' ? 'income' : 'expense', date, amount: fieldAmount(band.offByCents),
            })} />
        </>
      )}
      {/* On a phone Save is the card's last thing, its notes under it (drawing tabs 1 and 3, /design BC4b): type, read,
          fix in Find, then save, with no scroll back up past the band. */}
      {isPhone && <FormError inPlace>{error}</FormError>}
      {isPhone && saveButton}
      {isPhone && saveNotes}
      {adding && ownBook && (
        <AddEntryWindow book={{ id: ownBook.id, name: ownBook.name, kind: ownBook.kind as LedgerKind, entityId: ownBook.entityId }}
          // The club's fiscal years, as the Ledger hands them: a date in a closed year is said under the field (/review).
          q={q} orgSlug={orgSlug} words={words} fiscal={view.fiscal} canMove prefill={adding}
          onClose={() => setAdding(null)}
          onAdded={text => { setAdding(null); setAgain(n => n + 1); onChanged(null, text); }} />
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
