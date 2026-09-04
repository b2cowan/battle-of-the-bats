'use client';
import { useMemo } from 'react';
import { ChevronRight, ChevronDown, AlertTriangle } from 'lucide-react';
import { fmt } from '@/lib/coach-money-summary';
import { formatStoredDate, tournamentToday } from '@/lib/timezone';
import { buildInstallmentColumns, installmentToSend } from '@/lib/dues-installment-view';
import type { BreakdownPlayer } from './InstallmentBreakdown';
import styles from '../../../../coaches.module.css';

/**
 * THE COLLECTION SCHEDULE — every instalment of the season, in one row (owner ruling 2026-09-03,
 * D5; mockup artifact `2b5bd78b-cbc5-4c5c-b7e0-d3956121caf6` rev 4).
 *
 * ⚠⚠ IT USED TO BE A COLUMN KEY AND IT IS NOT ONE ANY MORE, which is the whole reason it moved.
 * The old strip was one detailed CELL per instalment, living inside the By-installment view because
 * each cell described a grid column beneath it. On a ten-instalment schedule that wrapped to two
 * rows and ~330px of header before the table began, repeating the same sentence ten times. Rebuilt
 * as a TIMELINE it describes the season's collection rather than a set of columns — equally true
 * under either table — so it renders on BOTH views, in the header, beside the summary band.
 *
 * ⚠ FIXED HEIGHT AT ANY LENGTH. Two instalments or twelve, this is one row of segments; the layout
 * does not change shape at a threshold, because a layout that does is one a coach has to re-learn.
 *
 * ⚠⚠ THE BAR IS TWO-TONE, AND THAT IS A DEFECT FIX RATHER THAN DECORATION. The old cell printed
 * CASH collected ("$0.00 of $970.80") beside a meter filled with everything COVERED — cash plus the
 * credits a drive earned — so an instalment settled by fundraising rendered as a zero next to a
 * half-full bar, two millimetres apart, saying different things. Solid is cash; the lighter band is
 * credit. The difference is now legible instead of contradictory.
 */
export interface CollectionScheduleProps {
  players: BreakdownPlayer[];
  /** Open state is the CALLER's — it is remembered per device beside the tab's other prefs. */
  open: boolean;
  onToggle: (next: boolean) => void;
}

export default function CollectionSchedule({ players, open, onToggle }: CollectionScheduleProps) {
  const today = tournamentToday();
  const columns = useMemo(() => buildInstallmentColumns(players, today), [players, today]);

  /**
   * The one instalment a coach can act on: the earliest still owed. An overdue piece outranks a
   * future one — a debt is more actionable than a plan.
   *
   * ⚠ LATE IS THE COLUMN'S OWN `behindCount` — money still to send on a bill past THAT PLAYER'S
   * due date. Re-deriving it from the heading's common date would call a hand-edited schedule late
   * on the team's day rather than the family's, and would call a credit-covered piece late when
   * nothing is owed on it at all. Same reason "N families to go" runs through `installmentToSend`:
   * it cannot be allowed to disagree with the row figures or with what a reminder email asks for.
   */
  const focus = useMemo(() => {
    let late: (typeof columns)[number] | null = null;
    let next: (typeof columns)[number] | null = null;
    for (const col of columns) {
      if (col.remaining <= 0.005) continue;
      if (col.behindCount > 0) { if (!late) late = col; continue; }
      if (!next) next = col;
    }
    return late ?? next ?? null;
  }, [columns]);

  /** How many families still owe something on the focused piece — the number a coach chases. */
  const familiesToGo = useMemo(() => {
    if (!focus) return 0;
    let n = 0;
    for (const p of players) {
      const inst = p.installments.find(i => i.installmentNumber === focus.installmentNumber);
      if (!inst || inst.paidAt) continue;
      if (installmentToSend(inst, p.coverage.find(c => c.installmentId === inst.id)) > 0.005) n += 1;
    }
    return n;
  }, [players, focus]);

  if (columns.length === 0) return null;

  /* ⚠⚠ THE SHUT SUMMARY CARRIES THE ANSWER, which is what makes the fold honest. A collapsed strip
     that said only "Collection schedule" would hide the one fact a coach opens this tab for; this
     line names the piece, its day, what is in and how many families are left — so closed costs a
     reader nothing but the per-instalment comparison. */
  const summary = focus
    ? (
      <>
        <strong>Installment {focus.installmentNumber}</strong>
        {focus.commonDueDate
          ? <> due {formatStoredDate(focus.commonDueDate, { withYear: false })}</>
          : <> (dates vary)</>}
        {' — '}<strong>{fmt(focus.collected)}</strong> of <strong>{fmt(focus.assessed)}</strong> in
        {familiesToGo > 0 && <>, <strong>{familiesToGo} famil{familiesToGo === 1 ? 'y' : 'ies'}</strong> to go</>}
      </>
    )
    : <>Every installment is fully collected.</>;

  /** Credits only earn a legend where a credit actually exists — see the two-tone note above. */
  const anyCredit = columns.some(c => c.assessed - c.remaining - c.collected > 0.005);

  return (
    <section className={styles.schedule}>
      <button
        type="button"
        className={styles.scheduleBar}
        aria-expanded={open}
        onClick={() => onToggle(!open)}
      >
        {open ? <ChevronDown size={13} aria-hidden /> : <ChevronRight size={13} aria-hidden />}
        <span className={styles.scheduleCap}>Collection schedule</span>
        <span className={styles.scheduleSummary}>{summary}</span>
        <span className={styles.scheduleCount}>
          {columns.length} installment{columns.length === 1 ? '' : 's'}
        </span>
      </button>

      {open && (
        <div className={styles.scheduleBody}>
          {/* ⚠ ONE TRACK PER INSTALMENT, EQUAL WIDTH. The count rides a custom property rather than
              N classes so a twelve-piece schedule needs no new rule. */}
          <div
            className={styles.scheduleTrack}
            style={{ '--schedule-terms': columns.length } as React.CSSProperties}
          >
            {columns.map(col => {
              const covered = col.assessed - col.remaining;
              const cashPct = col.assessed > 0 ? Math.min(100, (col.collected / col.assessed) * 100) : 0;
              const creditPct = col.assessed > 0
                ? Math.max(0, Math.min(100 - cashPct, ((covered - col.collected) / col.assessed) * 100))
                : 0;
              const overdue = col.behindCount > 0;
              const isFocus = focus?.installmentNumber === col.installmentNumber;
              return (
                <div
                  key={col.installmentNumber}
                  className={styles.scheduleTerm}
                  data-state={overdue ? 'late' : isFocus ? 'now' : undefined}
                  /* The whole story of one piece, for a reader who hovers rather than counts. */
                  title={`Installment ${col.installmentNumber}${col.commonDueDate ? ` · due ${formatStoredDate(col.commonDueDate, { withYear: false })}` : ' · dates vary'} — ${fmt(col.collected)} of ${fmt(col.assessed)} in`}
                >
                  <span className={styles.scheduleNum}>
                    {overdue && <AlertTriangle size={10} aria-hidden />}
                    {col.installmentNumber}
                  </span>
                  <span className={styles.scheduleBarTrack}>
                    <span className={styles.scheduleCash} style={{ width: `${cashPct}%` }} />
                    <span className={styles.scheduleCredit} style={{ width: `${creditPct}%` }} />
                  </span>
                  {/* ⚠ THE DATE IS THE FIRST THING TO GO ON A PHONE (see the stylesheet): ten
                      segments across 375px cannot carry one, and the summary line above already
                      names the only date a coach acts on. */}
                  <span className={styles.scheduleDate}>
                    {col.dueDateVaries ? 'varies'
                      : col.commonDueDate ? formatStoredDate(col.commonDueDate, { withYear: false })
                        : '—'}
                  </span>
                </div>
              );
            })}
          </div>

          {anyCredit && (
            <p className={styles.scheduleLegend}>
              <span className={`${styles.scheduleKey} ${styles.scheduleKeyCash}`} aria-hidden />
              <span>cash in</span>
              <span className={`${styles.scheduleKey} ${styles.scheduleKeyCredit}`} aria-hidden />
              <span>covered by credits</span>
            </p>
          )}
        </div>
      )}
    </section>
  );
}

