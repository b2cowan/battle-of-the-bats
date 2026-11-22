'use client';
/**
 * "CHECK YOUR BANK BALANCE" — the coach's check, on the Ledger's Balance check view above the saved checks (Bank balance
 * check BC7a; ask 10, drawing BANK_BALANCE_CHECK_DRAWINGS.html tab 2, the coach phone frame; laid out as the club's desk
 * form; words and the cash link from Bank check novice UX S1, drawings D1/D2). The coach types a day's DATE and BALANCE,
 * and the optional CASH NOT DEPOSITED YET behind "Holding cash you haven't deposited?" (ask 1, option C: saved with this
 * check only, so the field starts empty and closed after a save; A8 moved it behind the link). Every settled cash-moving
 * line of this season on or before the date counts by itself.
 * ⚖ RULE 6: the screen sends INTENT (the date, the balance, the cash, the marked lines' keys); Your books, Find and every
 *   saved figure are the server's (`GET …/bank?date=`, read as the date stops changing). Typing the balance or the cash
 *   re-figures at once with the engine's `figureCheck` (lib/bank-check.ts), no round trip, no arithmetic here.
 * ⚖ RULING 3: Save works whether the check matches or is off.
 * ⚖ A DAY THE SERVER WON'T TAKE (before the season started, after today) says its own sentence in place of the band (O5).
 * ⚖ "Still waiting on {line}?" (ask 2) asks once per item of the latest earlier check — across the rollover, last season's
 *   final check's ("Still waiting across the rollover"): Yes marks it, No drops it for this check. A new date clears both.
 * ⚖ "RECORD THE MISSING AMOUNT" opens the Ledger's own Record money window (`onAddLine`), filled with the gap, the
 *   statement's day and the direction (the bank holding more → money in); the Ledger's routes write it, never bank code
 *   (ask 1). Its save bumps the money revision, and the day is read again (the balance and cash stay). S3 (A5): the
 *   fee and interest doors open the same window with `door` set (the word, the description and the banking-app line);
 *   A7: "The same $X as your last check" when the gap is the newest earlier saved check's, signed (`sameGapAs`).
 * Only a money-write coach is given this component (K7: `canWrite`, the server's).
 * ⚖ START, WORK, SAVE FOR LATER (S7, plan BANK_CHECK_NOVICE_UX_PLAN.md §0 A18 rulings 1–9; drawing
 *   BANK_CHECK_NOVICE_UX_S7_DRAWINGS.html tabs 1–7, the coach frames; the club card's rules, in the coach's words and kit,
 *   through the same hook lib/hooks/useBankCheckWork.ts):
 *   · BEFORE START: the date, the balance and the cash link, one filled button "Start checking this statement"; nothing is
 *     kept and the band, the sums and Find wait for it (ruling 6).
 *   · WORKING: the strip "Checking {date} · Cash not deposited yet $X · Change" (the cash only when typed: it is part of the
 *     statement, ruling 3) over the shipped band, sums and Find; the foot: the notes, Start over, Save for later, Save this
 *     check. Kept as you go on our servers for this coach and this team's account (ruling 4); never a line's figures: a mark
 *     comes back only as a line the day's figure offers (ruling 7). A failed keep says so in place of the resting sentence.
 *   · CHANGE (ruling 5): the fields in place, the cash among them; a new balance or cash keeps every mark; a new date says
 *     first that it clears them. "Check this statement again" while other work is saved opens here.
 *   · FOUND AGAIN: straight into the work, "Picked up where you left off"; the last 7 days name the end date in warn ink. A
 *     colleague's work is one quiet line (ruling 1). A day the season no longer takes (work from before a rollover can't
 *     outlive it: the roll takes it) shows the day's refusal.
 *   · START OVER (ruling 9): in the foot; asks in one line only when lines are marked.
 *   · "STARTED OFF BY $X": the difference when this date's balance was last typed; marks, lines and the cash never move it.
 *   · "+ RECORD", once started: Money's own Record money conversation (`onRecord`), blank but for the check's date.
 *   · THE FIGURE STAYS FRESH: coming back to the browser tab reads the day again, only while the Ledger is on screen.
 *   A working-season instrument: no year, no look-back.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { Plus } from 'lucide-react';
import DateInput from '@/components/shared/DateInput';
import MoneySummaryBand from '@/components/coaches/MoneySummaryBand';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import { useMoneyRevision } from '@/lib/coach-money-refresh';
import { tournamentToday } from '@/lib/timezone';
import { figureCheck, typedCents, waitingOnCheck, type WaitingItem } from '@/lib/bank-check';
import { anchorStarted, keepOffered, offeredItems, startedOffCents, type StartedAnchor } from '@/lib/bank-check-draft';
import { inLastWeek, seedOfWork, workText, type CheckWork, type ColleagueWork } from '@/lib/bank-check-work';
import { useBankCheckWork, type BankCheckWork } from '@/lib/hooks/useBankCheckWork';
import { BANK_REFUSAL } from '@/lib/bank-check-words';
import { BANK_WORDS as W } from '@/lib/bank-tab-words';
import { bankBandTiles, cents, dayShort, dayYear, fieldAmount, moved, nameOf } from '@/lib/bank-screen';
import { sameGapAs, type GapDoor } from '@/lib/bank-gap-doors';
import { coachBankUrl, saveTeamCheck, readTeamBank, type TeamBank, type TeamFigure } from './coachBank';
import CoachBankFind from './CoachBankFind';
import b from './CoachBank.module.css';

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const DEBOUNCE_MS = 350;
const DATE_ID = 'coach-bank-date';
const BALANCE_ID = 'coach-bank-balance';
const CASH_ID = 'coach-bank-cash';

/** The line "Record the missing amount" opens the Ledger's Record money window with: the gap, the statement's day, the way it goes. */
export type MissingLine = { direction: 'in' | 'out'; amount: string; date: string;
  /** S3: opened from "Record a bank fee" / "Record interest" (absent: "Record the missing amount"). */
  door?: GapDoor };

type Props = {
  orgSlug: string;
  teamId: string;
  view: TeamBank;
  /** The Ledger is on screen (the hub keeps it mounted hidden). */
  active?: boolean;
  /** "Check this statement again": the saved check's date; the form starts on it, scrolled to, the cursor in the balance.
   *  With other work saved, it opens Change on that day instead (ruling 5). */
  againDate?: string;
  /** "Record the missing amount": the Record money window, filled with the gap (money write). */
  onAddLine?: (line: MissingLine) => void;
  /** "+ Record": the Record money window, blank but for the check's date (money write). */
  onRecord?: (date: string) => void;
  /** The bank read again after a save, and what to tell the coach. */
  onSaved: (view: TeamBank, text: string) => void;
  /** The page's notice, nothing else changed (Save for later, ruling 9). */
  onNotice: (text: string) => void;
  /** The coach started typing: the last save's notice goes. */
  onTouched: () => void;
};

/** The work's read, then the card, seeded from it: again (re-keyed) after another device's keep (`seed`). */
export default function CoachBankCheck(props: Props) {
  const work = useBankCheckWork(coachBankUrl(props.orgSlug, props.teamId, '/work'), W.workKeepFailed);
  if (work.read === 'loading') {
    return (
      <section className={b.card} aria-labelledby="coach-bank-check-title" aria-busy="true">
        <CardHead /><CardIntro view={props.view} />
        <p className={b.status} role="status">{W.workLoading}</p>
      </section>
    );
  }
  return <CheckCard key={`seed-${work.seed}`} {...props} work={work} />;
}

/** The heading row (the club's drawing tabs 2 and 5, in the coach kit): "+ Record" at its right, outline, the word on a
 *  phone too (ask 6 = A); Save stays the one filled button. Always drawn, so the row never jumps; off until it can open. */
function CardHead({ onRecord }: { onRecord?: () => void }) {
  return (
    <div className={b.cardHead}>
      <h2 id="coach-bank-check-title" className={b.cardTitle}>{W.checkTitle}</h2>
      <button type="button" className={`${styles.btnSecondary} ${b.recordBtn}`} disabled={!onRecord} onClick={onRecord}>
        <Plus size={15} aria-hidden />{W.record}
      </button>
    </div>
  );
}

/** What the card is for (S1, A4), always; which account it is for (A11), until the team's first check. */
function CardIntro({ view }: { view: TeamBank }) {
  return (
    <div className={b.intro}>
      <p className={b.purpose}>{W.coachCheckPurpose}</p>
      {view.checks.length === 0 && <p className={styles.formHint}>{W.coachTeamOnly}</p>}
    </div>
  );
}

type Edit = { date: string; balance: string; cash: string; cashAsked: boolean };

/** The cash as typed, read: an amount above $0.00 or nothing ("0" is none, as the server takes it); `bad` when unreadable. */
function cashOf(cash: string): { cents: number | null; bad: boolean } {
  const t = cash.trim() ? typedCents(cash, { positive: false }) : null;
  const bad = cash.trim() !== '' && (t === null || t < 0);
  return { cents: !bad && t ? t : null, bad };
}

function CheckCard({ orgSlug, teamId, view, active = true, againDate, onAddLine, onRecord, onSaved, onNotice, onTouched, work }: Props & { work: BankCheckWork }) {
  const today = tournamentToday();
  const isPhone = useIsPhone();
  const revision = useMoneyRevision();
  const [seed] = useState(() => seedOfWork(work.mine, againDate ?? today, againDate));
  const [working, setWorking] = useState(seed.working);
  const [date, setDate] = useState(seed.date);
  const [asOf, setAsOf] = useState(seed.date); // the day the figure is read for: `date`, once it stops changing
  const [balance, setBalance] = useState(seed.balance);
  const [cash, setCash] = useState(seed.cash);
  const [started, setStarted] = useState<StartedAnchor | null>(seed.started);
  // "Picked up where you left off": the day the saved work last changed (null when the card opened before Start).
  const [restoredOn, setRestoredOn] = useState<string | null>(seed.changedOn);
  // The saved marks' keys, until the day's figure says which it still offers (the band waits for them).
  const [pending, setPending] = useState<string[] | null>(seed.marks.length ? seed.marks : null);
  const [droppedMarks, setDroppedMarks] = useState(0);
  const [edit, setEdit] = useState<Edit | null>(seed.swapTo ? { date: seed.swapTo, balance: '', cash: seed.cash, cashAsked: !!seed.cash } : null);
  const [askOver, setAskOver] = useState(false);
  const [figure, setFigure] = useState<TeamFigure | null>(null);
  // The figure the marks were last checked against (each new read checks them again).
  const [checkedFor, setCheckedFor] = useState<TeamFigure | null>(null);
  const [readError, setReadError] = useState<{ date: string; text: string } | null>(null);
  const [again, setAgain] = useState(0); // "Try again" on a failed read; coming back to the browser tab
  const [busy, setBusy] = useState<null | 'start' | 'save' | 'later' | 'over'>(null);
  const [error, setError] = useState('');
  // The cash field waits behind "Holding cash you haven't deposited?" (S1, A8): open once asked for, or with cash in it.
  // Typing counts as asked: clearing the field never folds it away mid-edit (/review).
  const [cashAsked, setCashAsked] = useState(() => !!seed.cash);
  const cashOpen = cashAsked || cash !== '';
  // Find: the lines marked Not in the bank yet (in the order marked), and the Still-waiting items answered No.
  const [marked, setMarked] = useState<ReadonlyMap<string, WaitingItem>>(new Map());
  // A No is kept with the work (owner 2026-11-22): the card doesn't ask again, on any device; a new date clears them.
  const [dropped, setDropped] = useState<ReadonlySet<string>>(() => new Set(seed.answeredNo));
  // A saved or deleted check changes what the day's figure says (Still waiting?, "Saving replaces"): read it again after one.
  const checksKey = view.checks.map(c => c.id).join(',');

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
    // The Ledger stays mounted hidden under the Money hub: read only while the view is on screen (/review).
    if (!active || !ISO_DAY.test(asOf)) return;
    let current = true;
    void readTeamBank(orgSlug, teamId, asOf, W.figureFailed).then(r => {
      if (!current) return;
      if (r.ok && r.view.figure) { setFigure(r.view.figure); setReadError(null); }
      // The failure is that day's: another day's read never shows it (/review).
      else { setFigure(null); setReadError({ date: asOf, text: r.ok ? W.figureFailed : r.error }); }
    });
    return () => { current = false; };
  }, [active, orgSlug, teamId, asOf, checksKey, again, revision]);

  // Coming back to the browser tab reads the day again (WD2; a line booked in another tab). Focus and visibility often
  // fire together: one read, after the date read's own pause. Only while the Ledger is on screen. No polling.
  useEffect(() => {
    if (!active) return;
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
  }, [active]);

  // The marks, as the books read NOW (WD2, ruling 7), on each new figure for this day: each one the day still offers (this
  // season's lines, last season's under its name, the Still-waiting items), with its amount as the books have it; one it
  // doesn't is dropped and said, never kept. Adjusted while rendering, so the band never draws with marks the figure
  // hasn't checked. A refused day keeps saved marks waiting (a new date clears them, as a new day does).
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
  const typed = typedCents(balance, { positive: false });
  // Ask 1: optional; an amount above $0.00 or nothing (the server refuses anything else with `bad_amount`'s sentence).
  const { cents: cashCents, bad: cashBad } = cashOf(cash);
  const items = [...marked.values()];
  // The band is the ENGINE's: with no balance typed yet only "Should be in the bank" is read from it. A team has no
  // online payments on their way (coach-side Stripe is out of the first release, B12).
  const band = fresh && fresh.booksCents !== null
    ? figureCheck({ bankCents: typed ?? 0, booksCents: fresh.booksCents, onItsWayCents: null, waiting: items, cashCents })
    : null;
  const shared = band ? bankBandTiles({ date, figure: band, typed: typed !== null, isPhone, coach: true }) : null;
  // The coach's phone (drawn): "Your books, less $X cash" on the middle tile when the cash is all that is taken off; the
  // shared (club's, settled) short caption otherwise. Overridden here only, never in the shared tiles (BC7b).
  const cashOnly = cashCents !== null && items.length === 0;
  const tiles = shared && cashOnly
    ? { ...shared, tiles: shared.tiles.map(t => (t.key === 'should' ? { ...t, captionShort: W.coachShouldCashPhone(cents(cashCents)) } : t)) }
    : shared;
  const liveDifference = band && typed !== null ? band.differenceCents : null;

  // "Started off by" (ask 2 = A): anchored when this date's balance is typed; the work (marks, lines, the cash) never moves it.
  const anchor = anchorStarted(started, { date, balance }, liveDifference);
  if (anchor !== started) setStarted(anchor);
  const startedOff = startedOffCents(anchor, liveDifference);

  // Kept as you go, from Start (ruling 4); before Start nothing is kept (ruling 6). Saved marks still waiting on the figure
  // are kept as they came.
  const markCount = pending?.length ?? marked.size;
  const current: CheckWork = { date, balance, ...(cash.trim() ? { cash } : {}), marked: pending ?? [...marked.keys()], ...(dropped.size ? { answeredNo: [...dropped] } : {}), started: anchor };
  const currentText = workText(current);
  const { keep } = work;
  useEffect(() => { if (working) keep(currentText); }, [working, currentText, keep]);
  // The last 7 days of the 30 (ruling 2): the end date, said again.
  const endsSoonOn = working && work.endsOn && inLastWeek(work.endsOn, today) ? work.endsOn : null;

  const touch = () => { setError(''); work.clearChanged(); onTouched(); };
  const mark = (w: WaitingItem) => { setMarked(m => new Map(m).set(w.key, w)); touch(); };
  const unmark = (key: string) => { setMarked(m => { const n = new Map(m); n.delete(key); return n; }); touch(); };
  /** A new day is a new check: its marks and answers go (the lines and the earlier check's items are that day's). */
  const newDay = (v: string) => { setDate(v); setMarked(new Map()); setDropped(new Set()); setPending(null); setDroppedMarks(0); };
  const asking = (fresh?.stillWaiting ?? []).filter(w => !marked.has(w.key) && !dropped.has(w.key));

  /** Back to before Start: today, empty (Start over, and a saved check). WITHOUT `touch()`: after a save it would clear
   *  the notice just given (/review). */
  function reset() {
    setWorking(false); setBalance(''); setCash(''); setCashAsked(false); newDay(today); setAsOf(today); setStarted(null);
    setRestoredOn(null); setEdit(null); setAskOver(false); setError('');
  }

  /** Start checking this statement (ruling 6): the first keep. */
  async function start() {
    if (busy || !ISO_DAY.test(date)) return;
    if (typed === null) { setError(W.balanceMissing); return; }
    if (cashBad) { setError(BANK_REFUSAL.bad_amount); return; }
    setBusy('start'); touch();
    const r = await work.keepNow(current);
    setBusy(null);
    if (r.ok) { setWorking(true); setAsOf(date); } else if (r.error !== null) setError(r.error);
  }

  /** Change → Use these (ruling 5): a new date clears the marks (said first); a new balance or cash keeps them. */
  function useThese() {
    if (!edit || !ISO_DAY.test(edit.date)) return;
    if (typedCents(edit.balance, { positive: false }) === null) { setError(W.balanceMissing); return; }
    if (cashOf(edit.cash).bad) { setError(BANK_REFUSAL.bad_amount); return; }
    if (edit.date !== date) { newDay(edit.date); setAsOf(edit.date); }
    setBalance(edit.balance); setCash(edit.cash); setCashAsked(edit.cashAsked || edit.cash !== ''); setEdit(null); touch();
  }
  function openChange() {
    setEdit({ date, balance, cash, cashAsked: cashOpen }); setAskOver(false); touch();
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

  /** Save for later (ruling 4): what is on the card, kept now; the notice names the end date. */
  async function saveForLater() {
    if (busy) return;
    setBusy('later'); setError('');
    const r = await work.keepNow(current);
    setBusy(null);
    if (r.ok && r.endsOn) onNotice(W.savedForLater(dayYear(r.endsOn)));
    // Another device kept newer work (`error: null`): the hook reads again and the card says so; nothing to add here.
    else if (!r.ok && r.error !== null) setError(W.saveForLaterFailed);
  }

  async function save() {
    if (busy || !fresh) return;
    if (typed === null) { setError(W.balanceMissing); return; }
    if (cashBad) { setError(BANK_REFUSAL.bad_amount); return; }
    setBusy('save'); setError('');
    // Anything still waiting to be kept lands first, so it never lands after the check took the work (S7).
    await work.flush();
    const r = await saveTeamCheck(orgSlug, teamId, {
      date, bankCents: typed, ...(cashCents ? { cashCents } : {}), waiting: [...marked.keys()],
    });
    setBusy(null);
    if (!r.ok) {
      setError(r.error);
      // The books moved under the check (`changed`): read the day again, so the coach sees what would save.
      if (r.code === 'changed') setAgain(n => n + 1);
      return;
    }
    const saved = r.view.checks.find(c => c.date === date);
    onSaved(r.view, saved
      ? saved.figure.result === 'matches' ? W.coachSavedMatches(dayYear(date)) : W.savedOff(dayYear(date), cents(saved.figure.offByCents))
      : W.saved);
    // Saved: the check is the record now, and the server took the work with it (S7).
    work.forget();
    reset();
  }

  // "+ Record" (ask 3 = A): the Record money conversation, blank but for the check's date; once started, the day read, and
  // not while Change is open.
  const canRecord = !!onRecord && working && !edit && !!fresh && fresh.booksCents !== null && !busy;
  const errorLine = error ? <p className={`${styles.errorText} ${b.note}`} role="alert">{error}</p> : null;

  const head = <CardHead onRecord={canRecord ? () => onRecord?.(date) : undefined} />;
  const intro = <CardIntro view={view} />;

  const colleagues = work.colleagues.map((c, i) => <ColleagueLine key={i} c={c} />);
  const newer = work.changed && (
    <p className={b.statusLine} role="status">{work.changed === 'there' ? W.workNewerHere : W.workNewerGone}</p>
  );
  /** The date, the balance and (behind its link) the cash: before Start, and in Change. */
  const fieldsOf = (f: { date: string; balance: string; cash: string; cashOpen: boolean },
    set: { date: (v: string) => void; balance: (v: string) => void; cash: (v: string) => void }, tail?: ReactNode) => {
    const bad = cashOf(f.cash).bad;
    return (
      <div className={`${b.fields}${f.cashOpen ? ` ${b.fieldsCash}` : ''}`}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor={DATE_ID}>{W.checkDate} *</label>
          <DateInput id={DATE_ID} className={styles.input} value={f.date} max={today} required onChange={set.date} />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor={BALANCE_ID}>{isPhone ? W.checkBalancePhone : W.checkBalance} *</label>
          <input id={BALANCE_ID} className={styles.input} inputMode="decimal" autoComplete="off" placeholder="0.00" maxLength={16}
            value={f.balance} onChange={e => set.balance(e.target.value)} aria-required="true" />
        </div>
        {f.cashOpen && (
          <div className={styles.field}>
            <label className={styles.label} htmlFor={CASH_ID}>{W.coachCash}</label>
            <input id={CASH_ID} className={styles.input} inputMode="decimal" autoComplete="off" placeholder="0.00" maxLength={16}
              value={f.cash} onChange={e => set.cash(e.target.value)} aria-invalid={bad || undefined}
              aria-describedby={bad ? 'coach-bank-cash-bad' : undefined} />
            {/* Said under the field as it is typed, not only at Save: the band leaves an unreadable figure out (/review). */}
            {bad && <p id="coach-bank-cash-bad" className={styles.errorText}>{BANK_REFUSAL.bad_amount}</p>}
          </div>
        )}
        {tail}
      </div>
    );
  };
  const cashLink = (open: () => void) => (
    <button type="button" className={b.link} onClick={() => { open(); window.setTimeout(() => document.getElementById(CASH_ID)?.focus(), 0); }}>
      {W.coachCashOpen}
    </button>
  );

  // ── before Start (tab 1) ──
  if (!working) {
    const startButton = (
      <div className={b.save}>
        <button type="button" className={styles.btnPrimary} onClick={() => void start()} disabled={!!busy || !ISO_DAY.test(date)}>
          {busy === 'start' ? W.saving : W.startChecking}
        </button>
      </div>
    );
    // The shipped note line: "{date} is checked already" (row 21), the season's days, which balance to type, and the cash
    // link at its end while the field is closed (A8: the cash is fixed with the statement, ruling 3).
    const notes = [fresh?.replaces ? W.replacesNote(dayYear(date)) : null, W.coachSince(dayYear(view.season.start)), W.balanceHint]
      .filter((t): t is string => !!t);
    return (
      <section className={b.card} aria-labelledby="coach-bank-check-title">
        {head}{intro}
        {colleagues}
        {newer}
        {work.read === 'failed' && (
          <p className={b.statusLine} role="alert">{W.workLoadFailed}{' '}
            <button type="button" className={b.link} onClick={work.retryRead}>{W.tryAgain}</button>
          </p>
        )}
        {fieldsOf({ date, balance, cash, cashOpen }, {
          date: v => { newDay(v); touch(); },
          balance: v => { setBalance(v); touch(); },
          cash: v => { setCash(v); setCashAsked(true); touch(); },
        }, !isPhone ? startButton : null)}
        {!isPhone && errorLine}
        <p className={`${styles.formHint} ${b.note}`}>
          {notes.join(' ')}
          {!cashOpen && <>{' '}{cashLink(() => setCashAsked(true))}</>}
        </p>
        {/* A day the season doesn't take shows its own sentence now, not after Start; the band itself waits for Start. */}
        <Status figure={figure} date={date} readError={readError} fresh={!!fresh} quiet onRetry={() => setAgain(n => n + 1)} />
        {isPhone && errorLine}
        {isPhone && startButton}
      </section>
    );
  }

  // ── working (tabs 2–7) ──
  const off = !!band && band.result === 'off' && typed !== null;
  const notes = [fresh?.replaces ? W.replacesNote(dayYear(date)) : null, off ? W.coachSaveOffNote : null].filter((t): t is string => !!t);
  const laterButton = (
    <button key="later" type="button" className={styles.btnSecondary} onClick={() => void saveForLater()} disabled={!!busy}>
      {busy === 'later' ? W.saving : W.saveForLater}
    </button>
  );
  const checkButton = (
    <button key="check" type="button" className={styles.btnPrimary} onClick={() => void save()} disabled={!!busy || !fresh}>
      {busy === 'save' ? W.saving : W.saveCheck}
    </button>
  );
  const editCashOpen = !!edit && (edit.cashAsked || edit.cash !== '');

  return (
    <section className={b.card} aria-labelledby="coach-bank-check-title">
      {head}{intro}
      {colleagues}
      {(restoredOn || endsSoonOn) && (
        <p className={`${styles.formHint} ${b.restoreLine}`} role="status">
          {restoredOn && <span>{restoredOn < today ? W.draftPickedUpOn(dayYear(restoredOn)) : W.draftPickedUp}</span>}
          {endsSoonOn && <span className={b.endsSoon}>{W.workEndsSoon(dayYear(endsSoonOn))}</span>}
        </p>
      )}
      {newer}
      {droppedMarks > 0 && <p className={`${b.callout} ${b.droppedNote}`} role="status">{W.draftDropped(droppedMarks)}</p>}

      {edit ? (
        // Change (tab 3): the shipped fields, the cash among them (ruling 3), in place; Use these the one filled button.
        <div className={`${b.strip} ${b.stripEdit}`} role="group" aria-label={W.stripChange}>
          {fieldsOf({ date: edit.date, balance: edit.balance, cash: edit.cash, cashOpen: editCashOpen }, {
            date: v => { setEdit(e => e && { ...e, date: v }); setError(''); },
            balance: v => { setEdit(e => e && { ...e, balance: v }); setError(''); },
            cash: v => { setEdit(e => e && { ...e, cash: v, cashAsked: true }); setError(''); },
          }, (
            <div className={b.stripActs}>
              <button type="button" className={styles.btnPrimary} onClick={useThese} disabled={!ISO_DAY.test(edit.date)}>{W.changeUse}</button>
              <button type="button" className={b.link} onClick={() => { setEdit(null); setError(''); }}>{W.changeKeep(dayShort(date))}</button>
              {!editCashOpen && cashLink(() => setEdit(e => e && { ...e, cashAsked: true }))}
            </div>
          ))}
          {edit.date !== date && markCount > 0 && <p className={b.warnLine} role="status">{W.changeClears(markCount, true)}</p>}
          {errorLine}
        </div>
      ) : (
        // The strip (tab 2): the date, and the cash when typed; the balance is the band's first figure under it (ruling 9).
        <div className={b.strip}>
          <span className={b.stripLabel}>{W.stripChecking}</span>
          <span className={b.stripValue}>
            <b>{dayYear(date)}</b>
            {cashCents !== null && <><span className={b.stripDot} aria-hidden>·</span><span>{W.stripCash} <b>{cents(cashCents)}</b></span></>}
          </span>
          <button type="button" className={`${b.link} ${b.stripChange}`} onClick={openChange} disabled={!!busy}>{W.stripChange}</button>
        </div>
      )}

      {/* While Change is open the work and the foot wait, greyed and inert (tab 3). */}
      <div className={edit ? b.waiting : undefined} inert={!!edit}>
        <Status figure={figure} date={date} readError={readError} fresh={!!fresh} onRetry={() => setAgain(n => n + 1)} />
        {fresh && fresh.booksCents !== null && band && tiles && (
          <>
            <div className={b.band} aria-live="polite">
              <MoneySummaryBand ariaLabel={tiles.ariaLabel} tiles={tiles.tiles} />
            </div>
            {startedOff !== null && <p className={`${styles.formHint} ${b.startedOff}`}>{W.startedOffBy(cents(startedOff))}</p>}
            {/* The sums that make "Should be in the bank", always open (drawn): Your books · each line not in the bank yet
                (with Undo) · Still waiting? · Cash not deposited yet · the total. Signs are the engine's. */}
            <div className={b.sums} role="group" aria-label={W.sumsTitle}>
              {/* "Your Ledger on {date}", tied quietly to the Overview's Cash on hand at a desk (S1, row 8; D1). */}
              <SumRow amount={cents(fresh.booksCents)} label={<>
                {W.coachSumBooks(dayYear(date))}
                {!isPhone && <span className={b.sumQuiet}> · {W.coachSumBooksSub}</span>}
              </>} />
              {items.map(w => (
                <SumRow key={w.key} amount={moved(waitingOnCheck(w))} label={<>
                  {W.savedWaiting(nameOf(w))}{' '}
                  <button type="button" className={b.link} aria-label={W.undoLine(nameOf(w))} onClick={() => unmark(w.key)}>{W.undo}</button>
                </>} />
              ))}
              {asking.map(w => (
                <SumRow key={w.key} quiet amount={cents(w.amountCents)} label={<>
                  {W.stillWaiting(nameOf(w))}{' '}
                  <span className={b.askActs}>
                    <button type="button" className={b.link} aria-label={W.stillYes(nameOf(w))} onClick={() => mark(w)}>{W.yes}</button>
                    <button type="button" className={b.link} aria-label={W.stillNo(nameOf(w))}
                      onClick={() => { setDropped(d => new Set(d).add(w.key)); touch(); }}>{W.no}</button>
                  </span>
                </>} />
              ))}
              {band.cashCents > 0 && <SumRow label={W.coachCash} amount={moved(-band.cashCents)} />}
              <div className={`${b.sumRow} ${b.sumTotal}`}>
                <span>{W.sumShould}</span>
                <span className={b.sumAmt}>{cents(band.shouldBeCents)}</span>
              </div>
            </div>
            <CoachBankFind key={date} figure={fresh} band={band} typed={typed !== null} marked={marked} onMark={mark} onUndo={unmark}
              repeatOf={typed !== null ? sameGapAs(view.checks, date, band.differenceCents) : null}
              onAddLine={onAddLine ? door => onAddLine({
                // The gap, the statement's day, and the way it must go to close it: the bank holding more is money in.
                direction: band.direction === 'bank_more' ? 'in' : 'out', amount: fieldAmount(band.offByCents), date,
                ...(door ? { door } : {}),
              }) : undefined} />
          </>
        )}
        {/* The card ends here (tab 2): the notes and Start over at the left, the two saves at the right; on a phone the
            saves stack, Save this check first, the notes under them. */}
        {!edit && errorLine}
        <div className={b.foot}>
          <div className={b.footNotes}>
            <p className={styles.formHint}>
              {notes.length > 0 && `${notes.join(' ')} `}
              {work.keepFailed
                ? <>{W.workKeepFailed}{' '}<button type="button" className={b.link} onClick={() => void work.flush()}>{W.tryAgain}</button></>
                : W.workKept}
            </p>
            {askOver ? (
              <span className={b.overAsk} role="group" aria-label={W.startOver}>
                <span>{W.startOverAsk(markCount, cashCents !== null)}</span>
                <button type="button" className={b.link} onClick={() => void startOver()} disabled={!!busy}>{W.startOver}</button>
                <button type="button" className={b.link} onClick={() => setAskOver(false)}>{W.keepWorking}</button>
              </span>
            ) : (
              <button type="button" className={b.link} onClick={askStartOver} disabled={!!busy}>{W.startOver}</button>
            )}
          </div>
          <div className={b.footBtns}>{isPhone ? [checkButton, laterButton] : [laterButton, checkButton]}</div>
        </div>
      </div>
    </section>
  );
}

/** A colleague's work on this team's account (ruling 1, tab 6): who, which date, the day it last changed. Never the work. */
function ColleagueLine({ c }: { c: ColleagueWork }) {
  return <p className={b.colleague}><b>{W.colleagueWho(c.name)}</b>{W.colleagueWork(dayYear(c.date), dayShort(c.changedOn))}</p>;
}

/** One line of the sums: what, and its amount (quiet: an unanswered question, not yet counted). */
function SumRow({ label, amount, quiet = false }: { label: ReactNode; amount: string; quiet?: boolean }) {
  return (
    <div className={b.sumRow}>
      <span className={quiet ? b.sumQuiet : undefined}>{label}</span>
      <span className={`${b.sumAmt}${quiet ? ` ${b.sumQuiet}` : ''}`}>{amount}</span>
    </div>
  );
}

/** What stands in for the band while there isn't one: reading, the day's refusal (O5), or a failed read. `quiet` (before
 *  Start): only a refusal or a failed read. */
function Status({ figure, date, readError, fresh, quiet = false, onRetry }: {
  figure: TeamFigure | null; date: string; readError: { date: string; text: string } | null; fresh: boolean; quiet?: boolean; onRetry: () => void;
}) {
  if (fresh || !ISO_DAY.test(date)) return null;
  if (readError && readError.date === date) {
    return (
      <p className={b.status} role="alert">{readError.text}{' '}
        <button type="button" className={b.link} onClick={onRetry}>{W.tryAgain}</button>
      </p>
    );
  }
  if (figure && figure.date === date && figure.refused) return <p className={b.status} role="status">{BANK_REFUSAL[figure.refused]}</p>;
  if (quiet) return null;
  return <p className={b.status} role="status">{W.figuring}</p>;
}
