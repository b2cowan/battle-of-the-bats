'use client';
/**
 * "CHECK A STATEMENT" — the coach's check, on the Bank view itself above the saved checks (Bank balance check BC7a; ask 10,
 * drawing BANK_BALANCE_CHECK_DRAWINGS.html tab 2, the coach phone frame; laid out as the club's desk form). The coach types a
 * statement's DATE and BALANCE, and the optional CASH NOT DEPOSITED YET (ask 1, option C: saved with this check only, so the
 * field starts empty next time). Every settled cash-moving line of this season on or before the date counts by itself.
 * ⚖ RULE 6: the screen sends INTENT (the date, the balance, the cash, the marked lines' keys); Your books, Find and every
 *   saved figure are the server's (`GET …/bank?date=`, read as the date stops changing). Typing the balance or the cash
 *   re-figures at once with the engine's `figureCheck` (lib/bank-check.ts), no round trip, no arithmetic here.
 * ⚖ RULING 3: Save works whether the check matches or is off.
 * ⚖ A DAY THE SERVER WON'T TAKE (before the season started, after today) says its own sentence in place of the band (O5).
 *   "Statements from this season only, since {date}." stays under the fields.
 * ⚖ "Still waiting on {line}?" (ask 2) asks once per item of the latest earlier check — across the rollover, last season's
 *   final check's ("Still waiting across the rollover"): Yes marks it, No drops it for this check. A new date clears both.
 * ⚖ "ADD THE MISSING LINE" opens the Ledger's own Record money window (`onAddLine`), filled with the gap, the statement's day
 *   and the direction (the bank holding more → money in); the Ledger's routes write it, never bank code (ask 1). Its save
 *   bumps the money revision, and the day is read again (the typed balance and cash stay).
 * Only a money-write coach is given this component (K7: `canWrite`, the server's).
 */
import { useEffect, useState, type ReactNode } from 'react';
import DateInput from '@/components/shared/DateInput';
import MoneySummaryBand from '@/components/coaches/MoneySummaryBand';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import { useMoneyRevision } from '@/lib/coach-money-refresh';
import { tournamentToday } from '@/lib/timezone';
import { figureCheck, typedCents, waitingOnCheck, type WaitingItem } from '@/lib/bank-check';
import { BANK_REFUSAL } from '@/lib/bank-check-words';
import { BANK_WORDS as W } from '@/lib/bank-tab-words';
import { bankBandTiles, cents, dayYear, fieldAmount, moved, nameOf } from '@/lib/bank-screen';
import { readTeamBank, saveTeamCheck, type TeamBank, type TeamFigure } from './coachBank';
import CoachBankFind from './CoachBankFind';
import b from './CoachBank.module.css';

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const DEBOUNCE_MS = 350;
const BALANCE_ID = 'coach-bank-balance';

/** The line "Add the missing line" opens the Ledger's add window with: the gap, the statement's day, the way it goes. */
export type MissingLine = { direction: 'in' | 'out'; amount: string; date: string };

export default function CoachBankCheck({ orgSlug, teamId, view, active = true, againDate, onAddLine, onSaved, onTouched }: {
  orgSlug: string;
  teamId: string;
  view: TeamBank;
  /** The Ledger is on screen (the hub keeps it mounted hidden). */
  active?: boolean;
  /** "Check this statement again": the saved check's date; the form starts on it, scrolled to, the cursor in the balance. */
  againDate?: string;
  onAddLine?: (line: MissingLine) => void;
  /** The bank read again after a save, and what to tell the coach. */
  onSaved: (view: TeamBank, text: string) => void;
  /** The coach started typing: the last save's notice goes. */
  onTouched: () => void;
}) {
  const today = tournamentToday();
  const isPhone = useIsPhone();
  const revision = useMoneyRevision();
  const [date, setDate] = useState(againDate ?? today);
  const [asOf, setAsOf] = useState(againDate ?? today); // the day the figure is read for: `date`, once it stops changing
  const [balance, setBalance] = useState('');
  const [cash, setCash] = useState('');
  const [figure, setFigure] = useState<TeamFigure | null>(null);
  const [readError, setReadError] = useState<{ date: string; text: string } | null>(null);
  const [again, setAgain] = useState(0); // "Try again" on a failed read
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // Find: the lines marked Not in the bank yet (in the order marked), and the Still-waiting items answered No.
  const [marked, setMarked] = useState<ReadonlyMap<string, WaitingItem>>(new Map());
  const [dropped, setDropped] = useState<ReadonlySet<string>>(new Set());
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

  const fresh = figure !== null && figure.date === date && !figure.refused ? figure : null;
  const typed = typedCents(balance, { positive: false });
  // Ask 1: optional; an amount above $0.00 or nothing (the server refuses anything else with `bad_amount`'s sentence).
  // "0" is none, as the server takes it (`coachSavePlan`); a negative or unreadable figure is refused before Save.
  const cashTyped = cash.trim() ? typedCents(cash, { positive: false }) : null;
  const cashBad = cash.trim() !== '' && (cashTyped === null || cashTyped < 0);
  const cashCents = !cashBad && cashTyped ? cashTyped : null;
  const items = [...marked.values()];
  // The band is the ENGINE's: with no balance typed yet only "Should be in the bank" is read from it. A team has no
  // online payments on their way (coach-side Stripe is out of the first release, B12).
  const band = fresh && fresh.booksCents !== null
    ? figureCheck({ bankCents: typed ?? 0, booksCents: fresh.booksCents, onItsWayCents: null, waiting: items, cashCents })
    : null;
  const shared = band ? bankBandTiles({ date, figure: band, typed: typed !== null, isPhone }) : null;
  // The coach's phone (drawn): "Your books, less $X cash" on the middle tile when the cash is all that is taken off; the
  // shared (club's, settled) short caption otherwise. Overridden here only, never in the shared tiles (BC7b).
  const cashOnly = cashCents !== null && items.length === 0;
  const tiles = shared && cashOnly
    ? { ...shared, tiles: shared.tiles.map(t => (t.key === 'should' ? { ...t, captionShort: W.coachShouldCashPhone(cents(cashCents)) } : t)) }
    : shared;

  const touch = () => { setError(''); onTouched(); };
  const mark = (w: WaitingItem) => { setMarked(m => new Map(m).set(w.key, w)); touch(); };
  const unmark = (key: string) => { setMarked(m => { const n = new Map(m); n.delete(key); return n; }); touch(); };
  /** A new day is a new check: its marks and answers go (the lines and the earlier check's items are that day's). */
  const pickDate = (v: string) => { setDate(v); setMarked(new Map()); setDropped(new Set()); touch(); };
  const asking = (fresh?.stillWaiting ?? []).filter(w => !marked.has(w.key) && !dropped.has(w.key));

  async function save() {
    if (busy || !fresh) return;
    if (typed === null) { setError(W.balanceMissing); return; }
    if (cashBad) { setError(BANK_REFUSAL.bad_amount); return; }
    setBusy(true); setError('');
    const r = await saveTeamCheck(orgSlug, teamId, {
      date, bankCents: typed, ...(cashCents ? { cashCents } : {}), waiting: [...marked.keys()],
    });
    setBusy(false);
    if (!r.ok) {
      setError(r.error);
      // The books moved under the check (`changed`): read the day again, so the coach sees what would save.
      if (r.code === 'changed') setAgain(n => n + 1);
      return;
    }
    const saved = r.view.checks.find(c => c.date === date);
    onSaved(r.view, saved
      ? saved.figure.result === 'matches' ? W.savedMatches(dayYear(date)) : W.savedOff(dayYear(date), cents(saved.figure.offByCents))
      : W.saved);
    // A fresh form on today, WITHOUT `touch()`: that would clear the notice just given (/review).
    setBalance(''); setCash(''); setDate(today); setAsOf(today); setMarked(new Map()); setDropped(new Set());
  }

  // Save and what saving it means: inline after the fields at a desk; on a phone the card's last thing, full width, with
  // its notes and the season's line under it (drawn: type, read the band, fix in Find, then save, no scroll back up).
  const saveButton = (
    <div className={b.save}>
      <button type="button" className={styles.btnPrimary} onClick={() => void save()} disabled={busy || !fresh}>
        {busy ? W.saving : W.saveCheck}
      </button>
    </div>
  );
  const saveNotes = (
    <>
      {error && <p className={`${styles.errorText} ${b.note}`} role="alert">{error}</p>}
      {band && band.result === 'off' && typed !== null && <p className={`${styles.formHint} ${b.note}`}>{W.saveOffNote(cents(band.offByCents))}</p>}
      {fresh?.replaces && <p className={`${styles.formHint} ${b.note}`}>{W.replacesNote}</p>}
      <p className={`${styles.formHint} ${b.since}`}>{W.coachSince(dayYear(view.season.start))}</p>
    </>
  );

  return (
    <section className={b.card} aria-labelledby="coach-bank-check-title">
      <h2 id="coach-bank-check-title" className={b.cardTitle}>{W.checkTitle}</h2>
      <div className={b.fields}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="coach-bank-date">{W.statementDate} *</label>
          <DateInput id="coach-bank-date" className={styles.input} value={date} max={today} required onChange={pickDate} />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor={BALANCE_ID}>{isPhone ? W.checkBalancePhone : W.checkBalance} *</label>
          <input id={BALANCE_ID} className={styles.input} inputMode="decimal" autoComplete="off" placeholder="0.00" maxLength={16}
            value={balance} onChange={e => { setBalance(e.target.value); touch(); }} aria-required="true" />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="coach-bank-cash">{W.coachCash}</label>
          <input id="coach-bank-cash" className={styles.input} inputMode="decimal" autoComplete="off" placeholder="0.00" maxLength={16}
            value={cash} onChange={e => { setCash(e.target.value); touch(); }} aria-invalid={cashBad || undefined}
            aria-describedby={cashBad ? 'coach-bank-cash-bad' : undefined} />
          {/* Said under the field as it is typed, not only at Save: the band leaves an unreadable figure out (/review). */}
          {cashBad && <p id="coach-bank-cash-bad" className={styles.errorText}>{BANK_REFUSAL.bad_amount}</p>}
        </div>
        {!isPhone && saveButton}
      </div>
      {!isPhone && saveNotes}

      <Status figure={figure} date={date} readError={readError} fresh={!!fresh} onRetry={() => setAgain(n => n + 1)} />

      {fresh && fresh.booksCents !== null && band && tiles && (
        <>
          <div className={b.band} aria-live="polite">
            <MoneySummaryBand ariaLabel={tiles.ariaLabel} tiles={tiles.tiles} />
          </div>
          {/* The sums that make "Should be in the bank", always open (drawn): Your books · each line not in the bank yet
              (with Undo) · Still waiting? · Cash not deposited yet · the total. Signs are the engine's. */}
          <div className={b.sums} role="group" aria-label={W.sumsTitle}>
            <SumRow label={W.sumBooks(dayYear(date))} amount={cents(fresh.booksCents)} />
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
            onAddLine={onAddLine ? () => onAddLine({
              // The gap, the statement's day, and the way it must go to close it: the bank holding more is money in.
              direction: band.direction === 'bank_more' ? 'in' : 'out', amount: fieldAmount(band.offByCents), date,
            }) : undefined} />
        </>
      )}
      {isPhone && saveButton}
      {isPhone && saveNotes}
    </section>
  );
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

/** What stands in for the band while there isn't one: reading, the day's refusal (O5), or a failed read. */
function Status({ figure, date, readError, fresh, onRetry }: {
  figure: TeamFigure | null; date: string; readError: { date: string; text: string } | null; fresh: boolean; onRetry: () => void;
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
  return <p className={b.status} role="status">{W.figuring}</p>;
}
