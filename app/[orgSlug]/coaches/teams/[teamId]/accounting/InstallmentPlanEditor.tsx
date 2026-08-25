'use client';
import { useState } from 'react';
import { X } from 'lucide-react';
import {
  generateMonthlyOccurrences, MAX_MONTHLY_OCCURRENCES,
  type MonthlyRecurrenceRule,
} from '@/lib/coach-monthly-recurrence';
import { tooManyInstallments } from '@/lib/expense-ledger';
import type { InstallmentState } from '@/lib/payable-standing';
import { tournamentToday, formatStoredDate } from '@/lib/timezone';
import DateField from './DateField';
// ⚠ TWO STYLESHEETS, AND EACH OWNS A DIFFERENT HALF. `styles` is the budget sheet, which owns the
// numbered installment row this editor is a copy of; `shared` is the portal sheet, which owns the
// form section, its disclosure head and the buttons. The dues sheet splits them the same way, for
// the same reason — the row shape belongs to the thing being reused, the chrome to the form.
// ⚠ One `..` shallower than the panels' copy of the portal sheet: this file sits at the accounting
// root, they sit in a tab folder below it. TypeScript will not catch a wrong depth here (CSS
// modules are wildcard-typed); only the compiler will, at request time.
import styles from './budget/budget.module.css';
import shared from '../../../coaches.module.css';

/** One row of the plan as the FORM holds it — amounts are strings until they are saved. */
export interface PlanRow {
  date: string;
  amount: string;
  /**
   * Did this amount come from the repeat rule rather than from the coach's fingers? Drawn as an
   * **Auto** badge, and cleared on that row alone the moment it is typed over — the December rate
   * rise in the mockup is exactly this, and the badge leaving one row while the others keep theirs
   * is what tells a coach the override took.
   */
  auto: boolean;
  /**
   * ⚠⚠ WHICH STORED INSTALLMENT THIS ROW *IS*, when editing a saved bill — absent on a row the
   * coach has just added. It rides through the save so the server can match the row to itself
   * rather than to whatever now sits at its position: remove a non-trailing row without it and a
   * payment recorded against an earlier piece ends up attached to a later one, and the figure it
   * settled can be rewritten. See `PlanPiece.id` in `lib/payable-plan.ts` for the full account.
   */
  id?: string;
  /**
   * ⚠ WHY THIS DATE IS NOT THE ONE THE RULE ASKED FOR — "the 31st" in a month that has thirty days.
   * The engine reports it (`clamped`); a coach must never be handed a date they did not type
   * without being told why. Cleared the moment they touch the date themselves, because from then
   * on it IS the date they typed.
   */
  note?: string;
}

export const BLANK_PLAN_ROW: PlanRow = { date: '', amount: '', auto: false };

/** The one money formatter this pair shares — `InstallmentScopeSheet` imports it, and its own
 *  import note says why the pure scope module keeps a separate copy. */
export function fmt(n: number) {
  return `$${Math.abs(n).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * 1–31, plus "the last day" as a first-class choice.
 *
 * ⚠ THE LAST DAY IS NOT SUGAR FOR THE 31st, and offering it is what stops most coaches ever meeting
 * the clamp: an invoice term usually means the end of the month, and saying so sidesteps the
 * February question entirely. The 29th, 30th and 31st are still offered, because "the 30th" is an
 * ordinary billing day — they carry the clamp note on the rows it affects.
 */
const DAY_CHOICES: Array<number | 'last'> = [...Array.from({ length: 31 }, (_, i) => i + 1), 'last'];
function dayLabel(d: number | 'last'): string {
  if (d === 'last') return 'The last day';
  const suffix = d % 10 === 1 && d !== 11 ? 'st' : d % 10 === 2 && d !== 12 ? 'nd' : d % 10 === 3 && d !== 13 ? 'rd' : 'th';
  return `The ${d}${suffix}`;
}

/**
 * A commitment's PLAN, 1..n dated pieces — the editor that replaced the deposit/balance pair
 * (Payables Rebuild P4, plan §4.1).
 *
 * ⚠⚠ IT IS THE DUES SHEET'S SHAPE, ON PURPOSE, AND ONE THING DIFFERS. The owner's explicit
 * instruction was that this reuse `Generate Player Installments` verbatim: the numbered
 * `Installment 1..n` list, `+ Add` appending, `Remove` on every row, a due date and an amount per
 * row, amounts filling in automatically and badged **Auto**, and a plain-language reconcile line
 * that is a SENTENCE, NEVER A BARRIER. All of that is here.
 *
 * ⚠ The one deliberate divergence: on the dues sheet an Auto amount is an `<output>` a coach cannot
 * type into, because there it is a genuine consequence (a budget divided by a roster divided by the
 * periods) and a box that swallows keystrokes is the defect that screen was rebuilt to end. Here the
 * rule only SUGGESTS the amount — a rate rise in December is an ordinary thing for a coach to type —
 * so the field stays a live input and the badge is a statement about where the figure came from
 * rather than a lock. The QA walk asks for exactly that ("Type over row 3's amount").
 *
 * ⚠ MONTHLY IS THE ONLY CADENCE, and there is no cadence control (owner ruling 2026-08-20). The
 * plan's §4.1 listed Weekly / Every 2 weeks / Monthly; the proven engine is monthly, the weekly
 * sibling in this codebase disagrees with it on how a run ends and on what an over-long run does,
 * and money going out to a vendor is billed monthly. A refused or disabled option is worse than one
 * that is not there (P3's standing call), so the control simply says what it does.
 */
export default function InstallmentPlanEditor({
  rows, onChange, positionStates = [],
}: {
  rows: PlanRow[];
  onChange: (rows: PlanRow[]) => void;
  /**
   * What the bill's pieces are, in installment-number order, when EDITING a saved one.
   *
   * ⚠⚠ INDEXED BY POSITION, AND THAT IS WHAT MAKES THE "Settled" HINT HONEST. The plan is written
   * positionally — row 1 of this list becomes the piece currently numbered 1, whatever it used to
   * hold — so "position 1 is settled" is a true statement about what saving will do, where "this
   * row is the settled one" would stop being true the moment a row above it is removed.
   */
  positionStates?: InstallmentState[];
}) {
  const today = tournamentToday();
  const [repeatOpen, setRepeatOpen] = useState(false);
  const [dayOfMonth, setDayOfMonth] = useState<number | 'last'>(1);
  const [endMode, setEndMode] = useState<'count' | 'until'>('count');
  const [count, setCount] = useState('6');
  const [until, setUntil] = useState('');
  const [startDate, setStartDate] = useState('');
  const [amountMode, setAmountMode] = useState<'each' | 'total'>('each');
  const [each, setEach] = useState('');
  const [total, setTotal] = useState('');
  const [buildError, setBuildError] = useState('');

  const planTotal = round2(rows.reduce((s, r) => {
    const a = parseFloat(r.amount);
    return s + (Number.isFinite(a) ? a : 0);
  }, 0));

  const set = (at: number, patch: Partial<PlanRow>) =>
    onChange(rows.map((r, i) => (i === at ? { ...r, ...patch } : r)));

  /**
   * Build the list from the rule.
   *
   * ⚠⚠ THE RULE IS SCAFFOLDING, NOT A RECORD (S8). Nothing stores it, nothing reconciles against it
   * afterwards, and the coach is free to remove a month, move a date or retype an amount once the
   * rows exist — the QA walk requires all three. The LIST is what gets saved, and the route
   * validates the list. That is why `reviewMonthlyOccurrences` is deliberately NOT called here,
   * despite being the engine's other half: it exists to reconcile a submission against a rule the
   * server re-derives, which is the right shape for a schedule generator whose dates are fixed and
   * the wrong one for a sheet whose whole point is that they are not. Its CEILING is enforced, in
   * the same sentence, here and at the route.
   */
  function build() {
    setBuildError('');
    if (endMode === 'count' && !(Number(count) > 0)) {
      setBuildError('How many payments? Enter a number.'); return;
    }
    if (endMode === 'until' && !until) {
      setBuildError('When does it stop? Pick the last date.'); return;
    }
    const rule: MonthlyRecurrenceRule = {
      dayOfMonth,
      startDate: startDate || rows[0]?.date || today,
      end: endMode === 'count' ? { count: Number(count) } : { until },
    };
    const occurrences = generateMonthlyOccurrences(rule);
    if (occurrences.length === 0) {
      /* ⚠ AN EMPTY RESULT HAS THREE CAUSES and the coach has to be told which — the engine's own
         header spells out how to tell them apart. With a good rule, a `count` run can only be the
         ceiling; an `until` run is separated by asking the same rule for ONE occurrence and seeing
         whether that date lands after the end, which means the window was too narrow to hold one. */
      if (endMode === 'count') {
        setBuildError(Number(count) > MAX_MONTHLY_OCCURRENCES
          ? tooManyInstallments(Number(count))
          : 'That does not make a schedule. Check the day and the starting date.');
        return;
      }
      /* ⚠ THE `until` RUN HAS ALL THREE CAUSES AND HAS TO SEPARATE THEM (`/review`, 2026-08-20 —
         this branch reported the wrong one). Ask the same rule for ONE occurrence:
           · nothing at all          → the rule's own parts are wrong;
           · a date AFTER `until`    → the window is too narrow to hold even one;
           · a date INSIDE `until`   → the rule is fine and the window is fine, so the only thing
                                       left is the CEILING — a run this long is a mistyped end date.
         That last case used to fall through to "check the day and the dates", which sends a coach
         to look at two things that are both correct. */
      const one = generateMonthlyOccurrences({ ...rule, end: { count: 1 } });
      setBuildError(
        one.length === 0
          ? 'That does not make a schedule. Check the day and the starting date.'
          : one[0].date > until
            ? `${dayLabel(dayOfMonth)} does not come round between then and ${formatStoredDate(until)}. `
              + 'Move the last date out, or pick a different day.'
            : `That runs past ${MAX_MONTHLY_OCCURRENCES} payments — two full seasons of monthly `
              + 'payments. Bring the last date in, or split it into two bills.',
      );
      return;
    }

    /* "Amount each", or a total divided evenly with the ODD CENTS ON THE LAST ROW — never spread,
       and never dropped. A $1,000 total over three payments is 333.33 / 333.33 / 333.34, which adds
       up to the figure the coach typed; three rounded thirds do not. */
    const n = occurrences.length;
    const typed = amountMode === 'each' ? parseFloat(each) : parseFloat(total);
    const usable = Number.isFinite(typed) && typed > 0;
    const per = usable ? (amountMode === 'total' ? round2(typed / n) : typed) : NaN;
    const lastPer = usable && amountMode === 'total' ? round2(typed - per * (n - 1)) : per;

    onChange(occurrences.map((o, at) => ({
      date: o.date,
      amount: usable ? String(at === n - 1 ? lastPer : per) : '',
      auto: usable,
      note: o.clamped
        ? `That month is too short for ${dayLabel(dayOfMonth).toLowerCase()}, so this is its last day.`
        : undefined,
    })));
    setRepeatOpen(false);
  }

  return (
    <section className={shared.formSection}>
      <div className={shared.discHead}>
        <h4 className={shared.formSectionTitle}>Payment schedule</h4>
        <button
          type="button"
          className={repeatOpen ? shared.discHide : styles.periodQuietBtn}
          onClick={() => { setRepeatOpen(o => !o); setBuildError(''); }}
        >
          {repeatOpen ? 'Never mind' : 'Repeat monthly'}
        </button>
      </div>

      {/* ── The rule, when the coach asks for one ─────────────────────────────────────────────
          ⚠ It BUILDS the list and then gets out of the way. Nothing here is stored: a repeating
          cost is a bill with several dated pieces, not a bill with a subscription attached (S8). */}
      {repeatOpen && (
        <div className={styles.repeatBox}>
          <p className={shared.discNote}>
            Gym time on the first, association dues every month, an insurance installment — build the
            whole run at once, then change any row you like before saving.
          </p>
          <div className={styles.repeatRow}>
            <label className={styles.repeatField}>
              <span className={shared.label}>On</span>
              <select
                className={shared.select}
                value={String(dayOfMonth)}
                onChange={e => setDayOfMonth(e.target.value === 'last' ? 'last' : Number(e.target.value))}
              >
                {DAY_CHOICES.map(d => <option key={String(d)} value={String(d)}>{dayLabel(d)}</option>)}
              </select>
            </label>
            <label className={styles.repeatField}>
              <span className={shared.label}>Starting</span>
              <DateField value={startDate} ariaLabel="First payment on or after" onChange={setStartDate} />
            </label>
            <label className={styles.repeatField}>
              <span className={shared.label}>Ends</span>
              <select className={shared.select} value={endMode} onChange={e => setEndMode(e.target.value as 'count' | 'until')}>
                <option value="count">After a number of payments</option>
                <option value="until">On a date</option>
              </select>
            </label>
            {endMode === 'count' ? (
              <label className={styles.repeatField}>
                <span className={shared.label}>Payments</span>
                <input
                  className={shared.input} type="number" min={1} max={MAX_MONTHLY_OCCURRENCES}
                  value={count} onChange={e => setCount(e.target.value)}
                />
              </label>
            ) : (
              <label className={styles.repeatField}>
                <span className={shared.label}>Last payment by</span>
                <DateField value={until} ariaLabel="Last payment on or before" onChange={setUntil} />
              </label>
            )}
            <label className={styles.repeatField}>
              <span className={shared.label}>Amounts</span>
              <select className={shared.select} value={amountMode} onChange={e => setAmountMode(e.target.value as 'each' | 'total')}>
                <option value="each">The same each time</option>
                <option value="total">A total, split evenly</option>
              </select>
            </label>
            <label className={styles.repeatField}>
              <span className={shared.label}>{amountMode === 'each' ? 'Amount each ($)' : 'Total ($)'}</span>
              <input
                className={shared.input} type="number" min="0.01" step="0.01" placeholder="0.00"
                value={amountMode === 'each' ? each : total}
                onChange={e => (amountMode === 'each' ? setEach : setTotal)(e.target.value)}
              />
            </label>
          </div>
          {buildError && <p className={shared.errorText}>{buildError}</p>}
          {/* ⚠ IT REPLACES THE LIST, and says so BEFORE it does — a coach who has already typed
              three rows should not lose them to a button whose label did not warn them. */}
          <div className={styles.repeatActions}>
            <span className={shared.formHint}>
              {rows.some(r => r.date || r.amount)
                ? 'This replaces the rows below.'
                : 'Builds the rows below — change any of them afterwards.'}
            </span>
            <button type="button" className={shared.btnSecondary} onClick={build}>Build the schedule</button>
          </div>
        </div>
      )}

      <div className={styles.genInstallmentsSection}>
        <div className={styles.genInstallmentsHeader}>
          <span className={shared.label}>{rows.length === 1 ? 'One payment' : `${rows.length} payments`}</span>
          <button
            type="button"
            className={styles.addPeriodBtn}
            onClick={() => onChange([...rows, { ...BLANK_PLAN_ROW }])}
          >
            + Add
          </button>
        </div>

        {rows.map((row, at) => (
          <div key={at} className={styles.periodInputRow}>
            <div className={styles.periodGroupHead}>
              <span className={styles.periodGroupNum}>Installment {at + 1}</span>
              {rows.length > 1 && (
                <button
                  type="button"
                  className={styles.periodGroupRemove}
                  onClick={() => onChange(rows.filter((_, i) => i !== at))}
                >
                  Remove <X size={12} aria-hidden />
                </button>
              )}
            </div>
            <span className={styles.installmentNum}>#{at + 1}</span>
            <label className={`${styles.periodFieldLabel} ${styles.periodFieldDate}`}>
              <span className={styles.periodFieldLabelText}>Due date</span>
              <DateField
                value={row.date}
                ariaLabel={`Due date for installment ${at + 1}`}
                onChange={v => set(at, { date: v, note: undefined })}
              />
            </label>
            <label className={styles.periodFieldLabel}>
              <span className={styles.periodFieldLabelText}>Amount ($)</span>
              <span className={styles.amountAutoField}>
                <input
                  className={shared.input}
                  type="number" min="0.01" step="0.01" placeholder="0.00"
                  aria-label={`Amount for installment ${at + 1}`}
                  value={row.amount}
                  /* ⚠ THE BADGE LEAVES THIS ROW ONLY. Typing over December's figure must not make
                     the other five look hand-set — the coach changed one thing, and the screen
                     should say so. */
                  onChange={e => set(at, { amount: e.target.value, auto: false })}
                />
                {row.auto && <span className={styles.autoChipFloat}>Auto</span>}
              </span>
            </label>
            {rows.length > 1 && (
              <button
                type="button"
                className={styles.removePeriodBtn}
                aria-label={`Remove installment ${at + 1}`}
                onClick={() => onChange(rows.filter((_, i) => i !== at))}
              >
                <X size={13} />
              </button>
            )}
            {row.note && <p className={styles.periodRowMsg}>{row.note}</p>}
            {/* ⚖ A SETTLED PIECE IS EDITABLE, AND THIS HINT IS WHY IT IS SAFE TO SHOW IT (owner
                ruling 2026-08-16). The figure is not taken away; the coach is told the books will
                follow it. Read by POSITION — see `positionStates`. */}
            {positionStates[at] === 'settled' && (
              <p className={styles.periodRowMsg}>Settled — a change moves the books.</p>
            )}
            {positionStates[at] === 'partly_paid' && (
              <p className={styles.periodRowMsg}>Part paid — money already recorded stays put.</p>
            )}
          </div>
        ))}
      </div>

      {/* ── What this bill adds up to ────────────────────────────────────────────────────────
          A SENTENCE, NEVER A BARRIER (owner ruling 2026-08-13, carried across). It states the count
          and the total and nothing else: unlike the dues sheet there is no roster figure to measure
          a commitment against — what the team owes a vendor is simply what the vendor is charging. */}
      {planTotal > 0 && (
        <p className={`${styles.reconStrip} ${styles.reconMatch}`}>
          <span aria-hidden className={styles.reconMark}>✓</span>
          <span>
            {rows.length === 1
              ? <>One payment of <strong>{fmt(planTotal)}</strong>.</>
              : <><strong>{rows.length} payments</strong>, <strong>{fmt(planTotal)}</strong> in total.</>}
          </span>
        </p>
      )}
    </section>
  );
}
