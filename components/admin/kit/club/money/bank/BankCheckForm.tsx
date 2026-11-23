'use client';
/**
 * "CHECK YOUR BANK BALANCE" — the check, on the Bank tab itself above the saved checks (Bank balance check BC2a; ask 10, drawing
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
 * ⚖ THE TWO DOORS OUT OF THE CHECK (BC3b): "Add the missing entry" opens the LEDGER'S OWN add window (`AddEntryWindow`), filled
 *   with the gap, the statement's date and the direction (the bank showing more → money in; less → money out), on the
 *   account's own club book; the line is written by the Ledger's route, never by bank code (ask 1). "Waiting at the start"
 *   corrects the starting statement (`PATCH …/setup`). After either, the day's figure is read again (the typed balance stays).
 * Only a writer is given this component (B7): `BankTab` mounts it behind `canMove`.
 * ⚖ START, WORK, SAVE FOR LATER (S7, plan BANK_CHECK_NOVICE_UX_PLAN.md §0 A18 rulings 1–9; drawing
 *   BANK_CHECK_NOVICE_UX_S7_DRAWINGS.html tabs 1–7; the hook lib/hooks/useBankCheckWork.ts):
 *   · BEFORE START (tab 1): the date and the balance, and one lime button, "Start checking this statement". Nothing is kept
 *     and the band, the sums and Find wait for it (ruling 6: a first-time match takes Start, then Save this check).
 *   · WORKING (tab 2): the strip "Checking {date} · Change" over the shipped band, sums and Find; the foot ends the card with
 *     the notes, Start over, Save for later and Save this check. KEPT AS YOU GO on our servers (ruling 4), for this person
 *     and this account: the date, the balance, the marked lines' KEYS and the "Started off by" anchor. Never a line's
 *     figures: a mark comes back only as a line the day's figure offers, with its amount; one it doesn't is dropped with the
 *     amber callout (ruling 7). A failed keep says so in place of the resting sentence.
 *   · CHANGE (tab 3, ruling 5): the strip opens into the fields in place; a new balance keeps every mark; a new date says
 *     first that it clears them, then does. "Check this statement again" while other work is saved opens here, never a
 *     silent swap. The work and the foot wait, greyed and inert, until Use these.
 *   · FOUND AGAIN (tab 4): the card opens straight into the work, with "Picked up where you left off"; in the last 7 days of
 *     the 30 that line names the end date in warn ink (tab 7). A colleague's work is one quiet line (tab 6, ruling 1).
 *   · START OVER (ruling 9): in the foot; one line inside the card asks first only when lines are marked.
 *   · Just started (S1b, `afterStart`): the card opens before Start on the empty end date; work saved before the start stays
 *     until Start replaces it (never discarded unasked).
 *   · "STARTED OFF BY $X": the difference when this date's balance was last typed; hidden while it equals the live one.
 *   · "+ ADD ENTRY", once started: the Ledger's own window, blank (Money follows the gap, the check's date, no amount).
 *   · THE FIGURE STAYS FRESH: coming back to the browser tab reads the day again. No polling.
 */
import { useEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { checkingStartsOn, figureCheck, waitingOnCheck, type BankLine, type WaitingItem } from '@/lib/bank-check';
import { anchorStarted, keepOffered, offeredItems, startedOffCents, type StartedAnchor } from '@/lib/bank-check-draft';
import { inLastWeek, seedOfWork, workText, type CheckWork, type ColleagueWork, type WorkElsewhere } from '@/lib/bank-check-work';
import { useBankCheckWork, type BankCheckWork } from '@/lib/hooks/useBankCheckWork';
import type { LedgerKind } from '@/lib/club-ledger';
import { AddEntryWindow, useBudgetWords } from '../LedgerWindows';
import { BANK_REFUSAL } from '@/lib/bank-check-words';
import { BANK_WORDS as W } from '@/lib/bank-tab-words';
import { doorFill, doorFootLine, sameGapAs, type PlatformWordRef } from '@/lib/bank-gap-doors';
import { dayShort } from '@/lib/bank-screen';
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

type Props = {
  orgSlug: string;
  view: AccountView;
  /** The account read again after a save, and what to tell the treasurer about it. */
  onSaved: (view: AccountView, text: string) => void;
  /** Something outside this check changed (a line added to the books, the start corrected): the account in hand (or, when
   *  null, read it again) and what to say. The form keeps what is typed. */
  onChanged: (view: AccountView | null, text: string) => void;
  /** The server said the view is stale: the tab re-reads, then says the sentence. */
  onStale: (text: string) => void;
  /** The page notice, nothing else changed (Save for later, ruling 9). */
  onNotice: (text: string) => void;
  /** The club's other accounts holding this person's work: the Account pill's sub-line at 2+ (tab 4). */
  onElsewhere?: (elsewhere: WorkElsewhere[]) => void;
  /**
   * "Check this statement again" (BC2b): the saved check's date, handed in from its window. The tab re-keys the form
   * with it, so the form starts on that day with the balance empty, scrolled to and the cursor in the balance. With other
   * work saved, it opens Change on that day instead (ruling 5).
   */
  againDate?: string;
  /**
   * Just started (A17, owner 2026-11-08; drawing BANK_CHECK_S1B_DRAWINGS.html tab 2): the day checking starts. The start
   * was the first statement's opening balance, so the form opens on that same statement: the date empty, and the line
   * that says what to type. The tab drops it at the first save.
   */
  afterStart?: string;
};

/** The work's read, then the card, seeded from it: again (re-keyed) after another device's keep (`seed`). */
export default function BankCheckForm(props: Props) {
  const work = useBankCheckWork(bankUrl(props.orgSlug, `/accounts/${props.view.account.id}/work`), W.workKeepFailed);
  const { onElsewhere } = props;
  useEffect(() => { onElsewhere?.(work.elsewhere); }, [onElsewhere, work.elsewhere]);
  if (work.read === 'loading') {
    return (
      <section className={s.checkCard} aria-labelledby="bank-check-title" aria-busy="true">
        <CardHead /><p className={s.checkPurpose}>{W.checkPurpose}</p>
        <p className={`${ck.hint} ${s.hintLine}`} role="status">{W.workLoading}</p>
      </section>
    );
  }
  return <CheckCard key={`seed-${work.seed}`} {...props} work={work} />;
}

/** The heading row (drawing tabs 2 and 5): its title, and "+ Add entry" (outline, the word on a phone too, ask 6 = A); Save
 *  stays the one green button. Off until there is work and its day's figure (always drawn, so the row never jumps). */
function CardHead({ onAdd }: { onAdd?: () => void }) {
  return (
    <div className={s.checkHead}>
      <h2 id="bank-check-title" className={s.checkTitle}>{W.checkTitle}</h2>
      <button type="button" className={`btn btn-outline ${s.addEntry}`} onClick={onAdd} disabled={!onAdd}>
        <Plus size={15} aria-hidden />{W.addEntry}
      </button>
    </div>
  );
}

function CheckCard({ orgSlug, view, onSaved, onChanged, onStale, onNotice, againDate, afterStart, work }: Props & { work: BankCheckWork }) {
  const today = tournamentToday();
  // On a phone the date and the balance sit side by side (drawn; owner 2026-11-06, BC4b): the balance takes the short word.
  const isPhone = useIsPhone();
  // Our calendar (a desk) or the device's own picker: only the desk field can take the cursor usefully (/design S1b).
  const desk = useDeskPicker();
  const accountId = view.account.id;
  // Just started (S1b): before Start on the empty end date; work saved before the start stays until Start replaces it.
  const [seed] = useState(() => seedOfWork(afterStart ? null : work.mine, afterStart ? '' : againDate ?? today, againDate));
  const [working, setWorking] = useState(seed.working);
  const [date, setDate] = useState(seed.date);
  const [asOf, setAsOf] = useState(seed.date); // the date the figure is read for: `date`, after it stops changing
  const [balance, setBalance] = useState(seed.balance);
  const [started, setStarted] = useState<StartedAnchor | null>(seed.started);
  // "Picked up where you left off": the day the saved work was last changed (null when the card opened before Start).
  const [restoredOn, setRestoredOn] = useState<string | null>(seed.changedOn);
  // The saved marks' keys, until the day's figure says which it still offers (the band waits for them).
  const [pending, setPending] = useState<string[] | null>(seed.marks.length ? seed.marks : null);
  const [droppedMarks, setDroppedMarks] = useState(0);
  // Change (ruling 5): the strip's fields, open; nothing figures or is kept from them until Use these.
  const [edit, setEdit] = useState<{ date: string; balance: string } | null>(seed.swapTo ? { date: seed.swapTo, balance: '' } : null);
  const [askOver, setAskOver] = useState(false); // Start over's one-line question (ruling 9)
  const [figure, setFigure] = useState<Figure | null>(null);
  // The figure the marks were last checked against (each new read checks them again).
  const [checkedFor, setCheckedFor] = useState<Figure | null>(null);
  const [readError, setReadError] = useState('');
  const [again, setAgain] = useState(0); // "Try again" on a figure Stripe couldn't give
  const [busy, setBusy] = useState<null | 'start' | 'save' | 'later' | 'over' | 'door'>(null);
  const [error, setError] = useState('');
  // Find (BC3a): the lines marked Not in the bank yet (in the order marked), and the Still-waiting items answered No.
  const [marked, setMarked] = useState<ReadonlyMap<string, WaitingItem>>(new Map());
  // A No is kept with the work (owner 2026-11-22): the card doesn't ask again, on any device; a new date clears them.
  const [dropped, setDropped] = useState<ReadonlySet<string>>(() => new Set(seed.answeredNo));
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
  // resize across the desk line never moves it again). Handed a date ("Check this date again") → the balance (Change's,
  // when other work is saved). Just started → the end date, at a desk only: a phone's own picker can't be opened for them
  // and an iPhone ignores the focus, so the line above says it there (/design S1b).
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

  // The marks, as the books read NOW (WD1, ruling 7), on each new figure for this day: each one the day still offers, with
  // its amount as the books have it (an edited line keeps its mark at its new amount); one it doesn't is dropped and said,
  // never kept. Adjusted while rendering, so the band never draws with marks the figure hasn't checked. A refused day keeps
  // saved marks waiting (a new date clears them, as a new day does).
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
  // While saved marks wait for the day's figure, there is no figure to draw (figures are never kept).
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

  // Kept as you go, from Start (ruling 4): the hook sends it after a short pause when it differs from what is kept. Saved
  // marks still waiting on the figure are kept as they came. Before Start nothing is kept (ruling 6).
  const markCount = pending?.length ?? marked.size;
  const current: CheckWork = { date, balance, marked: pending ?? [...marked.keys()], ...(dropped.size ? { answeredNo: [...dropped] } : {}), started: anchor };
  const currentText = workText(current);
  const { keep } = work;
  useEffect(() => { if (working) keep(currentText); }, [working, currentText, keep]);
  // The last 7 days of the 30 (ruling 2): the end date, said again.
  const endsSoonOn = working && work.endsOn && inLastWeek(work.endsOn, today) ? work.endsOn : null;

  const touch = () => { setError(''); work.clearChanged(); };
  const mark = (w: WaitingItem) => { setMarked(m => new Map(m).set(w.key, w)); touch(); };
  const unmark = (key: string) => { setMarked(m => { const n = new Map(m); n.delete(key); return n; }); touch(); };
  /** A new day is a new check: its marks and answers go (the lines and the earlier check's items are that day's). */
  const newDay = (v: string) => {
    setDate(v); setMarked(new Map()); setDropped(new Set()); setPending(null); setDroppedMarks(0);
  };
  /** Back to before Start: today, empty (Start over, and a saved check). */
  function reset() {
    setWorking(false); setBalance(''); newDay(today); setAsOf(today); setStarted(null); setRestoredOn(null);
    setEdit(null); setAskOver(false); setError('');
  }
  const waitingRows = items.map(w => ({ key: w.key, what: nameOf(w), amount: moved(waitingOnCheck(w)), onUndo: () => unmark(w.key) }));
  const askingRows = (fresh?.stillWaiting ?? []).filter(w => !marked.has(w.key) && !dropped.has(w.key)).map(w => ({
    key: w.key, what: nameOf(w), amount: cents(w.amountCents),
    onYes: () => mark(w), onNo: () => { setDropped(d => new Set(d).add(w.key)); touch(); },
  }));

  /** Start checking this statement (ruling 6): the first keep. */
  async function start() {
    if (busy || !ISO_DAY.test(date)) return;
    if (typed === null) { setError(W.balanceMissing); return; }
    setBusy('start'); touch();
    const r = await work.keepNow(current);
    setBusy(null);
    if (r.ok) { setWorking(true); setAsOf(date); } else if (r.error !== null) setError(r.error);
  }

  /** Change → Use these (ruling 5): a new date clears the marks (said first, in the amber line); a new balance keeps them. */
  function useThese() {
    if (!edit || !ISO_DAY.test(edit.date)) return;
    if (parseCents(edit.balance, { positive: false }) === null) { setError(W.balanceMissing); return; }
    if (edit.date !== date) { newDay(edit.date); setAsOf(edit.date); }
    setBalance(edit.balance); setEdit(null); touch();
  }
  function openChange() {
    setEdit({ date, balance }); setAskOver(false); touch();
    if (desk) window.setTimeout(() => document.getElementById(DATE_ID)?.focus(), 0);
  }

  /** Start over (ruling 9): asks in one line only when lines are marked; at once otherwise. */
  async function startOver() {
    if (busy) return;
    setBusy('over'); setError('');
    const r = await work.startOver();
    setBusy(null);
    if (!r.ok) { setAskOver(false); setError(W.startOverFailed); return; }
    reset();
  }
  const askStartOver = () => { if (markCount > 0) setAskOver(true); else void startOver(); };

  /** Save for later (ruling 4): what is on the card, kept now; the notice names the end date (the 30 days start again). */
  async function saveForLater() {
    if (busy) return;
    setBusy('later'); setError('');
    const r = await work.keepNow(current);
    setBusy(null);
    if (r.ok && r.endsOn) onNotice(W.savedForLater(dayYear(r.endsOn)));
    // Another device kept newer work (`error: null`): the hook reads again and the card says so; nothing to add here.
    else if (!r.ok && r.error !== null) setError(W.saveForLaterFailed);
  }

  /** "Waiting at the start" (Q2): the line goes on the starting statement; the account and the day are read again. */
  async function atStart(line: BankLine) {
    if (busy) return;
    setBusy('door'); setError('');
    const r = await patchStart(orgSlug, accountId, { add: line.key });
    setBusy(null);
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
    setBusy('save'); setError('');
    // Anything still waiting to be kept lands first, so it never lands after the check took the work (S7).
    await work.flush();
    // `anyway`: the figure on screen is the one without online payments, so saving it is the treasurer's choice. A figure
    // shown counted that Stripe can't count at the save is refused (`not_counted_*`): read again, so they see what saves.
    const anyway = fresh.onItsWay.state === 'not_counted';
    // The marked lines go up as KEYS only: their figures are the server's read of the books (rule 6).
    const r = await bankWrite(bankUrl(orgSlug, `/accounts/${accountId}/checks`), 'POST',
      { date, bankCents: typed, anyway, waiting: [...marked.keys()] }, W.saveFailed);
    setBusy(null);
    if (!r.ok) {
      if (notCountedOf(r.code)) { setError(r.error); setAgain(n => n + 1); }
      else if (isStaleView(r.code)) onStale(r.error); else setError(r.error);
      return;
    }
    const saved = r.view.checks.find(c => c.date === date);
    onSaved(r.view, saved
      ? saved.figure.result === 'matches' ? W.savedMatches(dayYear(date)) : W.savedOff(dayYear(date), cents(saved.figure.offByCents))
      : W.saved);
    // Saved: the check is the record now, and the server took the work with it (S7).
    work.forget();
    reset();
  }

  // "+ Add entry" (ask 3 = A): the Ledger's window, blank, the check's date; Money follows the gap when there is one. Once
  // started, and not while Change is open (tab 3: it waits with the rest).
  const canAdd = working && !edit && !!fresh && fresh.booksCents !== null && !!ownBook && !busy;
  const addEntry = () => setAdding({
    date,
    ...(band && typed !== null && band.direction ? { entryType: band.direction === 'bank_more' ? 'income' as const : 'expense' as const } : {}),
  });

  const head = <CardHead onAdd={canAdd ? addEntry : undefined} />;
  // What the card is for (S1, A4), always.
  const purpose = <p className={s.checkPurpose}>{W.checkPurpose}</p>;

  const colleagues = work.colleagues.map((c, i) => <ColleagueLine key={i} c={c} />);
  const newer = work.changed && (
    <p className={`${s.statusNote} ${s.afterStart}`} role="status">{work.changed === 'there' ? W.workNewerHere : W.workNewerGone}</p>
  );

  // ── before Start (tab 1) ──
  if (!working) {
    const startButton = (
      <div className={s.checkSave}>
        <button type="button" className="btn btn-lime" onClick={() => void start()} disabled={!!busy || !ISO_DAY.test(date)}>
          {busy === 'start' ? W.saving : W.startChecking}
        </button>
      </div>
    );
    // The shipped note line: "{date} is checked already" (row 21) and which balance to type (not while the after-start
    // line shows: a statement's ending balance, not a banking app's, owner ask C).
    const notes = [replaces ? W.replacesNote(dayYear(date)) : null, !afterStart ? W.balanceHint : null].filter((t): t is string => !!t);
    return (
      <section className={s.checkCard} aria-labelledby="bank-check-title">
        {head}{purpose}
        {colleagues}
        {newer}
        {work.read === 'failed' && (
          <p className={`${s.statusNote} ${s.afterStart}`} role="alert">{W.workLoadFailed}{' '}
            <button type="button" className={s.link} onClick={work.retryRead}>{W.tryAgain}</button>
          </p>
        )}
        {/* Just started (A17): the restore line's place, the card's status-line weight. */}
        {afterStart && <p id={AFTER_START_ID} className={`${s.statusNote} ${s.afterStart}`} role="status">{W.afterStart(dayYear(afterStart))}</p>}
        {!isPhone && <FormError inPlace>{error}</FormError>}
        <div className={s.checkRow}>
          <DayField id={DATE_ID} label={W.checkDate} value={date} onChange={v => { newDay(v); touch(); }} max={today}
            describedBy={afterStart ? AFTER_START_ID : undefined} />
          <BankMoneyField id={BALANCE_ID} label={isPhone ? W.checkBalancePhone : W.checkBalance} value={balance} onChange={v => { setBalance(v); touch(); }} />
          {!isPhone && startButton}
        </div>
        {notes.length > 0 && <p className={ck.hint}>{notes.join(' ')}</p>}
        {/* A day the server won't take shows its own sentence now, not after Start; the band itself waits for Start. */}
        <StatusLine figure={figure} date={date} readError={readError} fresh={!!fresh} quiet onRetry={() => setAgain(n => n + 1)} />
        {isPhone && <FormError inPlace>{error}</FormError>}
        {isPhone && startButton}
      </section>
    );
  }

  // ── working (tabs 2–7) ──
  const off = !!band && band.result === 'off' && typed !== null;
  const notes = [replaces ? W.replacesNote(dayYear(date)) : null, off ? W.saveOffNote : null].filter((t): t is string => !!t);
  const laterButton = (
    <button key="later" type="button" className="btn btn-outline" onClick={() => void saveForLater()} disabled={!!busy}>
      {busy === 'later' ? W.saving : W.saveForLater}
    </button>
  );
  const checkButton = (
    <button key="check" type="button" className="btn btn-lime" onClick={() => void save()} disabled={!!busy || !fresh}>
      {busy === 'save' ? W.saving : W.saveCheck}
    </button>
  );
  const dateChanges = !!edit && edit.date !== date;

  return (
    <section className={s.checkCard} aria-labelledby="bank-check-title">
      {head}{purpose}
      {colleagues}
      {(restoredOn || endsSoonOn) && (
        <p className={`${ck.hint} ${s.restoreLine}`} role="status">
          {restoredOn && <span>{restoredOn < today ? W.draftPickedUpOn(dayYear(restoredOn)) : W.draftPickedUp}</span>}
          {endsSoonOn && <span className={s.endsSoon}>{W.workEndsSoon(dayYear(endsSoonOn))}</span>}
        </p>
      )}
      {newer}
      {droppedMarks > 0 && <div className={s.droppedNote}><Callout tone="warn" role="status" flush>{W.draftDropped(droppedMarks)}</Callout></div>}

      {edit ? (
        // Change (tab 3): the shipped fields, in place; Use these the one lime button while it is open.
        <div className={`${s.strip} ${s.stripEdit}`} role="group" aria-label={W.stripChange}>
          <div className={s.checkRow}>
            <DayField id={DATE_ID} label={W.checkDate} value={edit.date} max={today} onChange={v => { setEdit(e => e && { ...e, date: v }); setError(''); }} />
            <BankMoneyField id={BALANCE_ID} label={isPhone ? W.checkBalancePhone : W.checkBalance} value={edit.balance}
              onChange={v => { setEdit(e => e && { ...e, balance: v }); setError(''); }} />
            <div className={s.stripActs}>
              <button type="button" className="btn btn-lime" onClick={useThese} disabled={!ISO_DAY.test(edit.date)}>{W.changeUse}</button>
              <button type="button" className={s.link} onClick={() => { setEdit(null); setError(''); }}>{W.changeKeep(dayShort(date))}</button>
            </div>
          </div>
          {dateChanges && markCount > 0 && <p className={s.warnLine} role="status">{W.changeClears(markCount, false)}</p>}
          <FormError inPlace>{error}</FormError>
        </div>
      ) : (
        // The strip (tab 2): the date only; the balance is the band's first figure right under it (ruling 9).
        <div className={s.strip}>
          <span className={s.stripLabel}>{W.stripChecking}</span>
          <span className={s.stripValue}><b>{dayYear(date)}</b></span>
          <button type="button" className={`${s.link} ${s.stripChange}`} onClick={openChange} disabled={!!busy}>{W.stripChange}</button>
        </div>
      )}

      {/* While Change is open the work and the foot wait, greyed and inert (tab 3). */}
      <div className={edit ? s.waiting : undefined} inert={!!edit}>
        <StatusLine figure={figure} date={date} readError={readError} fresh={!!fresh} onRetry={() => setAgain(n => n + 1)} />
        {fresh && fresh.booksCents !== null && band && (
          <>
            <BankBand date={date} figure={band} typed={typed !== null} startedOn={view.start ? checkingStartsOn(view.start.date) : undefined} />
            {startedOff !== null && <p className={`${ck.hint} ${s.hintLine}`}>{W.startedOffBy(cents(startedOff))}</p>}
            <BankSums date={date} bookNames={view.account.books.map(b => b.name)} booksCents={fresh.booksCents}
              shouldBeCents={band.shouldBeCents} onItsWay={fresh.onItsWay} payoutsHref={`/${orgSlug}/admin/accounting/payouts`}
              onRetry={() => setAgain(n => n + 1)} waiting={waitingRows} asking={askingRows} />
            <BankFind key={date} figure={fresh} band={band} typed={typed !== null} marked={marked} busy={!!busy} onMark={mark} onUndo={unmark}
              payoutsHref={`/${orgSlug}/admin/accounting/payouts`}
              repeatOf={typed !== null ? sameGapAs(view.checks, date, band.differenceCents) : null}
              onAtStart={l => void atStart(l)} onAddLine={door => setAdding({
                // The gap, the statement's day, and the way it must go to close it: the bank holding more is money in.
                entryType: band.direction === 'bank_more' ? 'income' : 'expense', date, amount: fieldAmount(band.offByCents),
                ...(door ? { ...doorFill('club', door), footLine: doorFootLine(door) } : {}),
              })} />
          </>
        )}
        {/* The card ends here (tab 2): the notes and Start over at the left, the two saves at the right; on a phone the
            saves stack, Save this check first, the notes under them. */}
        {!edit && <FormError inPlace>{error}</FormError>}
        <div className={s.foot}>
          <div className={s.footNotes}>
            <p className={ck.hint}>
              {notes.length > 0 && `${notes.join(' ')} `}
              {work.keepFailed
                ? <>{W.workKeepFailed}{' '}<button type="button" className={s.link} onClick={() => void work.flush()}>{W.tryAgain}</button></>
                : work.sandboxNote ?? W.workKept}
            </p>
            {askOver ? (
              <span className={s.overAsk} role="group" aria-label={W.startOver}>
                <span>{W.startOverAsk(markCount, false)}</span>
                <button type="button" className={s.link} onClick={() => void startOver()} disabled={!!busy}>{W.startOver}</button>
                <button type="button" className={s.link} onClick={() => setAskOver(false)}>{W.keepWorking}</button>
              </span>
            ) : (
              <button type="button" className={s.link} onClick={askStartOver} disabled={!!busy}>{W.startOver}</button>
            )}
          </div>
          <div className={s.footBtns}>{isPhone ? [checkButton, laterButton] : [laterButton, checkButton]}</div>
        </div>
      </div>
      {/* After Add: the page notice, the day read again; the date, the balance and the marks stay. */}
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

/** A colleague's work on this account (ruling 1, tab 6): who, which date, the day it last changed. Never the work. */
function ColleagueLine({ c }: { c: ColleagueWork }) {
  return <p className={s.colleague}><b>{W.colleagueWho(c.name)}</b>{W.colleagueWork(dayYear(c.date), dayShort(c.changedOn))}</p>;
}

/** What stands in for the band while there isn't one: reading, a refusal the server gave for this day, or a failed read.
 *  `quiet` (before Start): only a refusal or a failed read; "Figuring this day…" waits for the band itself. */
function StatusLine({ figure, date, readError, fresh, quiet = false, onRetry }: {
  figure: Figure | null; date: string; readError: string; fresh: boolean; quiet?: boolean; onRetry: () => void;
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
  if (quiet) return null;
  return <p className={`${ck.hint} ${s.hintLine}`} role="status">{W.figuring}</p>;
}
