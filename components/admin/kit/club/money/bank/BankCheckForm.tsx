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
 * ⚖ THE TWO DOORS OUT OF THE CHECK (BC3b): "Add the missing entry" (named "Add the missing line" until WD1) opens the LEDGER'S OWN add window (`AddEntryWindow`), filled
 *   with the gap, the statement's date and the direction (the bank showing more → money in; less → money out), on the
 *   account's own club book; the line is written by the Ledger's route, never by bank code (ask 1). "Waiting at the start"
 *   corrects the starting statement (`PATCH …/setup`). After either, the day's figure is read again (the typed balance stays).
 * Only a writer is given this component (B7): `BankTab` mounts it behind `canMove`.
 * "Check this statement again" (BC2b) re-keys it with `againDate`: the server already replaces a live check of the same
 * date, and the form already says so ("Saving replaces that check").
 * ⚖ WORK IT DOWN TO ZERO (WD1, plan BANK_CHECK_WORKING_DRAFT_PLAN.md, owner asks 1A–6A 2026-11-07; drawings tabs 1–5):
 *   · THE CARD REMEMBERS (`lib/bank-check-draft`): the date, the typed balance, the marked lines' keys and the "Started off
 *     by" anchor, in THIS BROWSER, per club + account + person. Restored at once with "Picked up where you left off" and
 *     Start over (no confirm). FIGURES ARE NEVER RESTORED: the band waits for the day's figure, and a mark comes back only
 *     as a line that figure offers, with its amount; one it doesn't is dropped with the amber callout. Every read of the
 *     figure re-checks the marks the same way (a line deleted in another tab). Save (success) and Start over clear it.
 *   · "STARTED OFF BY $X": the difference when this date's balance was last typed; hidden while it equals the live one.
 *   · "+ ADD ENTRY", always there with a date: the Ledger's own window, blank (Money follows the gap, the check's date, no
 *     amount). The gap door ("Add the missing entry") keeps the gap. Nothing here writes a book line.
 *   · THE FIGURE STAYS FRESH: coming back to the browser tab (focus / visible) reads the day again. No polling.
 */
import { useEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { checkingStartsOn, figureCheck, waitingOnCheck, type BankLine, type WaitingItem } from '@/lib/bank-check';
import {
  anchorStarted, browserDraftStore, canKeepDrafts, clearDraft, draftKey, isWorthKeeping, keepOffered, offeredItems, readDraft, startedOffCents,
  sweepIdleDrafts, writeDraft, type DraftContent, type StartedAnchor,
} from '@/lib/bank-check-draft';
import type { LedgerKind } from '@/lib/club-ledger';
import { AddEntryWindow, useBudgetWords } from '../LedgerWindows';
import { BANK_REFUSAL } from '@/lib/bank-check-words';
import { BANK_WORDS as W } from '@/lib/bank-tab-words';
import { doorFill, doorFootLine, sameGapAs, type PlatformWordRef } from '@/lib/bank-gap-doors';
import { tournamentToday } from '@/lib/timezone';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import { useDeskPicker } from '@/lib/hooks/useDeskPicker';
import { Callout, useLatestRead } from '../../RepKit';
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
const DATE_ID = 'bank-check-date';
const AFTER_START_ID = 'bank-check-after-start';

export default function BankCheckForm({ orgSlug, view, personId, onSaved, onChanged, onStale, againDate, afterStart }: {
  orgSlug: string;
  view: AccountView;
  /** The signed-in person: the draft is theirs (null until it is known, and then no draft is read or kept). */
  personId: string | null;
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
  /**
   * Just started (A17, owner 2026-11-08; drawing BANK_CHECK_S1B_DRAWINGS.html tab 2): the day checking starts. The start
   * was the first statement's opening balance, so the form opens on that same statement: no draft, the date empty, and
   * the line that says what to type. The tab drops it at the first save.
   */
  afterStart?: string;
}) {
  const today = tournamentToday();
  // On a phone the date and the balance sit side by side (drawn; owner 2026-11-06, BC4b): the balance takes the short word.
  const isPhone = useIsPhone();
  // Our calendar (a desk) or the device's own picker: only the desk field can take the cursor usefully (/design S1b).
  const desk = useDeskPicker();
  const accountId = view.account.id;
  // The working draft (WD1): this browser's, this person's, this account's. "Check this statement again" starts that day
  // fresh instead (its first keystroke replaces the draft). The card mounts after the account is read, never on the server.
  const draftAt = personId ? draftKey({ club: orgSlug, account: accountId, person: personId }) : null;
  const [restored] = useState(() => (draftAt && !againDate && !afterStart ? readDraft(browserDraftStore(), draftAt, Date.now()) : null));
  // Owner ask B (S1b): after a start the end date is empty, never a guessed month-end (statements don't all run by month).
  const opening = afterStart ? '' : againDate ?? restored?.date ?? today;
  const [date, setDate] = useState(opening);
  const [asOf, setAsOf] = useState(opening); // the date the figure is read for: `date`, after it stops changing
  const [balance, setBalance] = useState(restored?.balance ?? '');
  const [started, setStarted] = useState<StartedAnchor | null>(restored?.started ?? null);
  // "Picked up where you left off": the day the restored draft was last worked on (null when nothing was restored).
  const [restoredOn, setRestoredOn] = useState<string | null>(restored?.savedOn ?? null);
  // The restored marks' keys, until the day's figure says which it still offers (the band waits for them).
  const [pending, setPending] = useState<string[] | null>(restored?.marked.length ? restored.marked : null);
  const [droppedMarks, setDroppedMarks] = useState(0);
  // This browser will keep a draft ("Kept in this browser only…" says so only then: never over blocked storage).
  const [canKeep] = useState(() => !!draftAt && canKeepDrafts(browserDraftStore()));
  const [figure, setFigure] = useState<Figure | null>(null);
  // The figure the marks were last checked against (each new read checks them again).
  const [checkedFor, setCheckedFor] = useState<Figure | null>(null);
  const [readError, setReadError] = useState('');
  const [again, setAgain] = useState(0); // "Try again" on a figure Stripe couldn't give
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // Find (BC3a): the lines marked Not in the bank yet (in the order marked), and the Still-waiting items answered No.
  const [marked, setMarked] = useState<ReadonlyMap<string, WaitingItem>>(new Map());
  const [dropped, setDropped] = useState<ReadonlySet<string>>(new Set());
  // "Add the missing entry": the Ledger's add window, filled with what the screen said when it opened (the gap, the day, the
  // direction), so a figure read again meanwhile never moves or closes it; the budget words read when it opens.
  // "+ Add entry" opens it blank (no amount: a statement line is rarely the gap, drawing tab 3).
  // S3: "Add a bank fee" / "Add interest" add the description, the platform word and the banking-app line (`doorFill`).
  const [adding, setAdding] = useState<{ entryType?: 'income' | 'expense'; date: string; amount?: string; description?: string;
    word?: PlatformWordRef; footLine?: string } | null>(null);
  const beginRead = useLatestRead();
  // A saved or deleted check, or a corrected start, changes what the day's figure says: re-read after one.
  const checksKey = `${view.checks.map(c => c.id).join(',')}|${view.start?.id ?? ''}:${view.start?.booksCents ?? ''}`;
  const q = `orgSlug=${encodeURIComponent(orgSlug)}`;
  const words = useBudgetWords(q, adding !== null);

  // The form opened on purpose: bring it into view with the cursor where the next thing is typed, once per opening (a
  // resize across the desk line never moves it again). Handed a date ("Check this date again") → the balance. Just started
  // → the end date, at a desk only: a phone's own picker can't be opened for them and an iPhone ignores the focus, so the
  // line above says it there (/design S1b).
  const arrivedFor = useRef<string | null>(null);
  useEffect(() => {
    const why = againDate ?? afterStart ?? null;
    if (!why || arrivedFor.current === why) return;
    arrivedFor.current = why;
    const at = againDate ? BALANCE_ID : desk ? DATE_ID : null;
    if (!at) return;
    const field = document.getElementById(at);
    field?.scrollIntoView({ block: 'center' });
    field?.focus({ preventScroll: true });
  }, [againDate, afterStart, desk]);

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

  // Coming back to the browser tab reads the day again (WD1; a line booked in another tab). Focus and visibility often
  // fire together: one read, after the date read's own pause. No polling.
  useEffect(() => {
    let t: number | undefined;
    const soon = () => {
      if (document.visibilityState !== 'visible') return;
      window.clearTimeout(t);
      t = window.setTimeout(() => setAgain(n => n + 1), DEBOUNCE_MS);
    };
    window.addEventListener('focus', soon);
    document.addEventListener('visibilitychange', soon);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('focus', soon);
      document.removeEventListener('visibilitychange', soon);
    };
  }, []);

  // A draft idle 14 days goes, this account's or any other's (ask 4 = A).
  useEffect(() => { sweepIdleDrafts(browserDraftStore(), Date.now()); }, []);

  // The marks, as the books read NOW (WD1), on each new figure for this day: each one the day still offers, with its
  // amount as the books have it; one it doesn't is dropped and said, never kept (a restored draft's, or a line deleted in
  // another tab). Adjusted while rendering, so the band never draws with marks the figure hasn't checked. A refused day
  // keeps restored marks waiting (another date clears them, as a new day does).
  if (figure && figure !== checkedFor && figure.date === date && !figure.refused) {
    setCheckedFor(figure);
    const keys = pending ?? [...marked.keys()];
    if (keys.length > 0) {
      const { kept, dropped: gone } = keepOffered(keys, offeredItems(figure));
      setMarked(new Map(kept.map(w => [w.key, w])));
      if (gone > 0) setDroppedMarks(gone);
    }
    if (pending) setPending(null);
  }
  // While restored marks wait for the day's figure, there is no figure to draw (figures are never restored).
  const fresh = figure !== null && figure.date === date && !figure.refused && pending === null ? figure : null;
  const typed = parseCents(balance, { positive: false });
  const items = [...marked.values()];
  // The band is the ENGINE's: with no balance typed yet only "Should be in the bank" is read from it.
  const band = fresh && fresh.booksCents !== null
    ? figureCheck({ bankCents: typed ?? 0, booksCents: fresh.booksCents, onItsWayCents: fresh.onItsWay.cents, waiting: items, cashCents: null })
    : null;
  const replaces = !!fresh?.replaces;
  const liveDifference = band && typed !== null ? band.differenceCents : null;

  // "Started off by" (ask 2 = A): anchored when this date's balance is typed; the work (marks, lines) never moves it.
  const anchor = anchorStarted(started, { date, balance }, liveDifference);
  if (anchor !== started) setStarted(anchor);
  const startedOff = startedOffCents(anchor, liveDifference);

  // Keep the work in this browser whenever it changes (never merely for opening the card): written when worth keeping,
  // removed when the card is emptied. Restored marks still waiting on the figure are kept as they came.
  // A date cleared from the calendar is not a day a draft can come back to (it would be refused whole, balance and all):
  // it is kept as today until another is picked.
  // ⚠ Just started (S1b /review): the date is empty ON PURPOSE (owner ask B), so nothing is kept until a day is picked (kept
  // as today, a balance typed first would come back as a guessed date), and a draft from before the start goes.
  const dateless = !!afterStart && !ISO_DAY.test(date);
  const draft: DraftContent = { date: ISO_DAY.test(date) ? date : today, balance, marked: pending ?? [...marked.keys()], started: anchor };
  const worthKeeping = !dateless && isWorthKeeping(draft);
  const draftText = JSON.stringify(draft);
  const lastKept = useRef(draftText);
  useEffect(() => {
    if (!draftAt || dateless || draftText === lastKept.current) return;
    lastKept.current = draftText;
    writeDraft(browserDraftStore(), draftAt, JSON.parse(draftText) as DraftContent, today);
  }, [draftAt, draftText, today, dateless]);
  useEffect(() => {
    if (afterStart && draftAt) clearDraft(browserDraftStore(), draftAt);
  }, [afterStart, draftAt]);
  const hasDraft = canKeep && worthKeeping;
  // Emptied: what was picked up is gone, so the next thing typed is new work, not "where you left off".
  if (restoredOn && !worthKeeping) setRestoredOn(null);

  const mark = (w: WaitingItem) => { setMarked(m => new Map(m).set(w.key, w)); setError(''); };
  const unmark = (key: string) => { setMarked(m => { const n = new Map(m); n.delete(key); return n; }); setError(''); };
  /** A new day is a new check: its marks and answers go (the lines and the earlier check's items are that day's). */
  const pickDate = (v: string) => {
    setDate(v); setError(''); setMarked(new Map()); setDropped(new Set()); setPending(null); setDroppedMarks(0);
  };
  /** Start over (no confirm, the owner's call in the drawings): only a typed balance and marks are lost. */
  function startOver() {
    if (draftAt) clearDraft(browserDraftStore(), draftAt);
    setBalance(''); pickDate(today); setAsOf(today); setStarted(null); setRestoredOn(null); setError('');
  }
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

  // The book "Add entry" and "Add the missing entry" write to: the account's own club book (R0 ask 1; the Ledger's rule:
  // the club's, not an event's), else its first.
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
    // Saved: the check is the record now, so the draft goes (WD1).
    startOver();
  }

  // "+ Add entry" (ask 3 = A): the Ledger's window, blank, the check's date; Money follows the gap when there is one.
  const canAdd = !!fresh && fresh.booksCents !== null && !!ownBook && !busy;
  const addEntry = () => setAdding({
    date,
    ...(band && typed !== null && band.direction ? { entryType: band.direction === 'bank_more' ? 'income' as const : 'expense' as const } : {}),
  });

  // Save and what saving it means: inline after the fields at a desk, the card's last thing on a phone (drawn).
  const saveButton = (
    <div className={s.checkSave}>
      <button type="button" className="btn btn-lime" onClick={() => void save()} disabled={busy || !fresh}>
        {busy ? W.saving : W.saveCheck}
      </button>
    </div>
  );
  // ONE note line (Bank check novice UX S1, row 10): which balance to type until one is typed; then that an off check
  // saves and leaves the books alone, and the draft's resting sentence (S7 rewrites that one; it stays as WD1 wrote it).
  // "{date} is checked already" (row 21) either way. Where it sits is unchanged (after the fields at a desk, under Save on
  // a phone).
  const notes = [
    replaces ? W.replacesNote(dayYear(date)) : null,
    // Owner ask C (S1b): not while the after-start line shows (a statement's ending balance, not a banking app's).
    typed === null && !afterStart ? W.balanceHint : null,
    band && band.result === 'off' && typed !== null ? W.saveOffNote : null,
    // The resting sentence while a draft exists (drawing tab 2, note 3): it is what says leaving is safe.
    hasDraft ? W.draftKept : null,
  ].filter((t): t is string => !!t);
  const saveNotes = notes.length > 0 ? <p className={ck.hint}>{notes.join(' ')}</p> : null;

  return (
    <section className={s.checkCard} aria-labelledby="bank-check-title">
      {/* The heading row's action (drawing tabs 2 and 5): outline, the word on a phone too (ask 6 = A); Save stays the one
          green button. Disabled until there is a date and its figure is read (always drawn, so the row never jumps). */}
      <div className={s.checkHead}>
        <h2 id="bank-check-title" className={s.checkTitle}>{W.checkTitle}</h2>
        <button type="button" className={`btn btn-outline ${s.addEntry}`} onClick={addEntry} disabled={!canAdd}>
          <Plus size={15} aria-hidden />{W.addEntry}
        </button>
      </div>
      {/* What the card is for (S1, A4), always. */}
      <p className={s.checkPurpose}>{W.checkPurpose}</p>
      {restoredOn && hasDraft && (
        <p className={`${ck.hint} ${s.restoreLine}`} role="status">
          <span>{restoredOn < today ? W.draftPickedUpOn(dayYear(restoredOn)) : W.draftPickedUp}</span>
          <button type="button" className={s.link} onClick={startOver}>{W.startOver}</button>
        </p>
      )}
      {/* Just started (A17): the restore line's place (a start never restores a draft), the card's status-line weight. */}
      {afterStart && <p id={AFTER_START_ID} className={`${s.statusNote} ${s.afterStart}`} role="status">{W.afterStart(dayYear(afterStart))}</p>}
      {droppedMarks > 0 && <div className={s.droppedNote}><Callout tone="warn" role="status" flush>{W.draftDropped(droppedMarks)}</Callout></div>}
      {/* What went wrong sits by Save: at the card's top at a desk (Save is inline there), above Save on a phone (/review). */}
      {!isPhone && <FormError inPlace>{error}</FormError>}
      <div className={s.checkRow}>
        <DayField id={DATE_ID} label={W.checkDate} value={date} onChange={pickDate} max={today}
          describedBy={afterStart ? AFTER_START_ID : undefined} />
        <BankMoneyField id={BALANCE_ID} label={isPhone ? W.checkBalancePhone : W.checkBalance} value={balance} onChange={v => { setBalance(v); setError(''); }} />
        {!isPhone && saveButton}
      </div>
      {!isPhone && saveNotes}

      <StatusLine figure={figure} date={date} readError={readError} fresh={!!fresh} onRetry={() => setAgain(n => n + 1)} />

      {fresh && fresh.booksCents !== null && band && (
        <>
          <BankBand date={date} figure={band} typed={typed !== null} startedOn={view.start ? checkingStartsOn(view.start.date) : undefined} />
          {startedOff !== null && <p className={`${ck.hint} ${s.hintLine}`}>{W.startedOffBy(cents(startedOff))}</p>}
          <BankSums date={date} bookNames={view.account.books.map(b => b.name)} booksCents={fresh.booksCents}
            shouldBeCents={band.shouldBeCents} onItsWay={fresh.onItsWay} payoutsHref={`/${orgSlug}/admin/accounting/payouts`}
            onRetry={() => setAgain(n => n + 1)} waiting={waitingRows} asking={askingRows} />
          <BankFind key={date} figure={fresh} band={band} typed={typed !== null} marked={marked} busy={busy} onMark={mark} onUndo={unmark}
            repeatOf={typed !== null ? sameGapAs(view.checks, date, band.differenceCents) : null}
            onAtStart={l => void atStart(l)} onAddLine={door => setAdding({
              // The gap, the statement's day, and the way it must go to close it: the bank holding more is money in.
              entryType: band.direction === 'bank_more' ? 'income' : 'expense', date, amount: fieldAmount(band.offByCents),
              ...(door ? { ...doorFill('club', door), footLine: doorFootLine(door) } : {}),
            })} />
        </>
      )}
      {/* On a phone Save is the card's last thing, its notes under it (drawing tabs 1 and 3, /design BC4b): type, read,
          fix in Find, then save, with no scroll back up past the band. */}
      {isPhone && <FormError inPlace>{error}</FormError>}
      {isPhone && saveButton}
      {isPhone && saveNotes}
      {/* After Add: the page notice, the day read again; the typed balance, the date and the marks stay. */}
      {adding && ownBook && (
        <AddEntryWindow book={{ id: ownBook.id, name: ownBook.name, kind: ownBook.kind as LedgerKind, entityId: ownBook.entityId }}
          // The club's fiscal years, as the Ledger hands them: a date in a closed year is said under the field (/review).
          q={q} orgSlug={orgSlug} words={words} fiscal={view.fiscal} canMove prefill={adding} statusHint={W.addEntryStatusHint}
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
  // A day the server won't take a check for (before checking started, after today): its own sentence.
  if (figure && figure.date === date && figure.refused) return <p className={s.statusNote} role="status">{BANK_REFUSAL[figure.refused]}</p>;
  return <p className={`${ck.hint} ${s.hintLine}`} role="status">{W.figuring}</p>;
}
