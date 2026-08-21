'use client';
import { Fragment, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight, X, CalendarClock } from 'lucide-react';
import CoachScrollX from '@/components/coaches/CoachScrollX';
import {
  buildCashFlow, lensCell, lensTotal, lensReadsPlan, formatMonthLabel, formatMonthLong,
  type MonthGrid, type MonthKey, type MoneyLens, type CashFlowRow, type GridPlanLine,
} from '@/lib/coach-budget-months';
import { fmtCompact } from '@/lib/coach-money-summary';
import { moneySectionHref } from '@/lib/coach-money-links';
import { toggleKey } from '@/lib/toggle-key';
import shared from '@/app/[orgSlug]/coaches/coaches.module.css';
import styles from './MoneyMonthGrid.module.css';

export type { MoneyLens };

/**
 * ⚠⚠ THE THREE WORDS MEAN THREE DIFFERENT THINGS, AND SINCE 2026-08-20 THEY FINALLY SAY SO
 * (owner ruling, Payables Rebuild P3): **Budget is the overall plan, Actual is what has already
 * been paid, Scheduled is what the team is currently obligated to pay** — past due included.
 *
 * Before the ruling, a Scheduled cell was the plan at FACE VALUE: every installment in its due
 * month whether or not it had been paid, so a month never fell as it was paid down. Two surfaces
 * one tab away meant the remainder by the same word, and the owner read the difference as a defect
 * in the middle of a QA walk. The arithmetic moved (the route drops settled pieces and quotes
 * remainders); these labels did not need to, because they are now true.
 */
export const MONEY_LENSES: Array<{ id: MoneyLens; label: string; short: string }> = [
  { id: 'budget',     label: 'Budget',     short: 'Budget' },
  { id: 'scheduled',  label: 'Scheduled',  short: 'Sched.' },
  { id: 'actual',     label: 'Actual',     short: 'Actual' },
  { id: 'difference', label: 'Difference', short: 'Diff.' },
];

export interface CellDetailItem {
  id: string;
  description: string;
  date: string | null;
  amount: number;
  paid: boolean;
}

/**
 * How many months show at once.
 *
 * ⚠ A CAP, NOT A PROMISE OF NO SCROLLING. Measured 2026-08-21 on the live grid: a month column
 * is 83px at 1440 and the visible area is 1156px, so twelve months plus both pinned ends wants
 * ~1,296px — about 140px more than exists. Roughly ten show at a desk and the last two take a
 * nudge. The arrows are for the COARSE movement; the pinned ends are what keep a reader's place.
 * That measurement is also why nothing else gets pinned: every pinned column costs a visible
 * month at every width.
 */
export const MONTH_WINDOW = 12;

export interface MonthGridPayload {
  monthGrid: MonthGrid;
  cellDetails: Record<string, CellDetailItem[]>;
  moneyIn: { scheduled: Record<string, number>; actual: Record<string, number> };
  todayMonth: MonthKey;
}

function fmt(n: number) {
  return `$${Math.abs(n).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Compact money for a grid cell. Shared with the budget plan's period view — the two money grids
 *  had a copy each of the same formatter. */
const fmtCell = fmtCompact;

function fmtDay(d: string | null) {
  if (!d) return '';
  return new Date(d.slice(0, 10) + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
}

/** The cash-flow strip's three rows — same columns as the grid, so they read as part of it. */
const CASH_ROWS: Array<{
  key: string;
  label: string;
  value: (r: CashFlowRow) => number;
  /** The running balance is the one row where a negative number is the point. */
  emphasis?: boolean;
}> = [
  { key: 'in',      label: 'Money in',        value: r => r.moneyIn },
  { key: 'out',     label: 'Money out',       value: r => r.moneyOut },
  { key: 'running', label: 'Running balance', value: r => r.running, emphasis: true },
];

function signClass(n: number): string {
  if (n > 0.005) return styles.pos;
  if (n < -0.005) return styles.neg;
  return '';
}

export default function MoneyMonthGrid({
  data,
  lens,
  base,
  canWrite,
  monthStart,
}: {
  data: MonthGridPayload;
  lens: MoneyLens;
  /** `/{orgSlug}/coaches/teams/{teamId}` — drill-ins link back into the pages that own the forms. */
  base: string;
  canWrite: boolean;
  /** First month of the visible window. The CALLER owns the control — see `MONTH_WINDOW`. */
  monthStart: number;
  /** The rendering page's season query (`''` or `'?year=<id>'`) — drill-ins from an archived
   *  season must stay in that season, not teleport the reader to the live one. */
}) {
  const { monthGrid: grid, cellDetails, moneyIn, todayMonth } = data;
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<{ title: string; items: CellDetailItem[]; href: string; hrefLabel: string } | null>(null);
  /** "Which line's dates?" — only ever open for a row standing for two or more budget lines. */
  const [chooser, setChooser] = useState<{ item: string; when: string; lines: GridPlanLine[] } | null>(null);

  /* ⚠⚠ THE MONTHS ARE WINDOWED; THE TOTALS ARE NOT (owner ruling 2026-08-21). A repeating cost
     stretches this grid past any screen — fifteen columns the day it was found — and `Total`,
     the one figure a treasurer is looking for, slid off the right edge. Twelve months show at a
     time: the label column stays pinned left, Total stays pinned right (CSS), and neither ever
     scrolls away.

     ⚠⚠ TOTAL IS THE WHOLE SEASON, NEVER THE VISIBLE WINDOW. The Total column, the statement view
     and the chart are held equal by `tests/unit/money-one-arithmetic-guard` — re-totalling to a
     window would let two views of one season disagree. That is why the caller NAMES the visible
     range beside its arrows: a reader who adds up what they can see must be able to tell why it
     does not match. An unlabelled window is how a correct number becomes a support ticket.

     ⚠ THE CONTROL LIVES IN THE CALLER (owner call 2026-08-21) — it belongs in the same row as
     View and Showing, which this component does not own. It is handed a start index. */
  const maxStart = Math.max(0, grid.months.length - MONTH_WINDOW);
  /* ⚠ CLAMPED HERE TOO, however careful the caller is: `grid.months` is the only authority on how
     long the season is, and an out-of-range slice renders an empty grid with no error. */
  const start = Math.min(Math.max(0, monthStart), maxStart);
  const view = grid.months.slice(start, start + MONTH_WINDOW);

  // Undated budget only means anything under a lens that reads the plan.
  const undatedLive = lensReadsPlan(lens);
  /* ⚠ THE COLUMN APPEARS ONLY WHERE IT CAN HOLD SOMETHING (owner ruling 2026-08-21). Undated
     money is PLAN money, so under Actual and Scheduled this could only ever print a full column
     of dashes — paying full width for nothing on a grid that already does not fit. */
  const showUndated = undatedLive && grid.totals.undatedBudget > 0.005;

  // Cash flow follows the lens on screen — the plan under Budget, the commitments under Scheduled,
  // real spending under Actual — and never blends them, which is what keeps a planned estimate and
  // a commitment for the same cost from being counted twice. Meaningless under Difference.
  const cash = useMemo(() => {
    if (lens === 'difference') return null;
    const outByMonth: Record<string, number> = {};
    grid.months.forEach((m, i) => { outByMonth[m] = grid.totals.cells[i][lens]; });
    const inByMonth = lens === 'actual' ? moneyIn.actual : moneyIn.scheduled;
    return buildCashFlow(grid.months, inByMonth, outByMonth);
  }, [grid, lens, moneyIn]);

  function toggle(key: string) { setExpanded(prev => toggleKey(prev, key)); }

  function openDetail(kind: 'actual' | 'scheduled', categoryKey: string, categoryName: string, month: MonthKey) {
    const items = cellDetails[`${kind}|${categoryKey}|${month}`] ?? [];
    if (items.length === 0) return;
    setDetail({
      title: `${kind === 'actual' ? 'Paid in' : 'Due in'} ${formatMonthLong(month)} · ${categoryName}`,
      items,
      /* ⚠ THE TWO LENSES NOW LAND ON DIFFERENT TABS (Money split P1, 2026-08-16), which is what
         the grid was always describing: an "Actual" cell is money that moved and belongs on
         Transactions, a "Scheduled" cell is money still owed and belongs on the Payables schedule.
         They used to be one screen with a sub-tab hop between them. */
      href: kind === 'actual'
        ? moneySectionHref(base, 'transactions', undefined)
        : moneySectionHref(base, 'payables', { tab: 'schedule' }),
      hrefLabel: kind === 'actual' ? 'Open Transactions' : 'Open the payment schedule',
    });
  }

  /** The dates a budget line currently sits on, said the way a coach would say it. */
  function whenLine(l: GridPlanLine): string {
    if (l.dates.length === 0) return 'No date yet';
    if (l.dates.length === 1) return `Currently ${fmtDay(l.dates[0])}`;
    return `Currently split across ${l.dates.length} dates`;
  }

  /**
   * What a PLAN cell does when a coach clicks it — the one answer for both affordances that read the
   * budget: a month's figure ("Edit this line's payment dates") and the "No date yet" figure ("Give
   * this money a date").
   *
   * ⚠⚠ THE ROW IS AN ITEM AND MAY STAND FOR TWO BUDGET LINES (owner ruling 2026-08-15, and the fix
   * approved 2026-08-17). Both cells used to hand the budget page the composite ROW id, which no
   * longer names any line — so it found nothing and returned silently. Both were dead for two days.
   * Now: one line behind the row, go straight to its dates; two or more, ask which. Never guess, or a
   * coach silently edits a line they were not looking at; never withdraw the control, or the teams
   * with the most complex plans lose their only route out of undated budget.
   *
   * ⚠ Both cells share this because they are ONE affordance with two labels. Fixing one and not the
   * other is how they came apart in the first place.
   */
  function planCell(line: { description: string; planLines: GridPlanLine[] }, when: string) {
    const plan = line.planLines;
    if (plan.length === 1) {
      // ?periods=1 opens the payment-date split even on a line that is currently a lump sum — the
      // coach was looking at a month grid, so dates are what they came for.
      return {
        href: moneySectionHref(base, 'budget', { line: plan[0].id, periods: '1' }),
        title: `Edit ${line.description}’s payment dates`,
      };
    }
    if (plan.length > 1) {
      return {
        onClick: () => setChooser({ item: line.description, when, lines: plan }),
        title: `${line.description} has ${plan.length} budget lines — choose whose dates to change`,
      };
    }
    // No budget line at all: a spend-only row. Nothing to edit, so nothing pretends to be clickable.
    return {};
  }

  /** One money cell. Becomes a link or a button only when there is genuinely something behind it. */
  function cellNode(
    value: number | null,
    opts: { onClick?: () => void; href?: string; title?: string; emphasis?: boolean } = {},
  ) {
    // ⚠ ONE MINUS SIGN. `fmtCell` already carries the sign; this also prepended a typographic
    // minus, so every negative rendered as "−-2,000" — two dashes. Only the running balance ever
    // goes negative, which is why it survived until the layout fixture gained budget data
    // (2026-08-13). The swap to the typographic minus stays, applied to the ONE sign there is.
    const text = value === null ? null : fmtCell(value)?.replace('-', '−');
    // Null = "nothing to say here" (a future month under Difference, a lens this row can't
    // answer); zero = "nothing happened". Both read as an em dash — a grid full of $0 is noise.
    if (text == null) return <span className={styles.nil}>—</span>;
    const body = <>{text}</>;
    const cls = `${styles.cellValue} ${opts.emphasis ? signClass(value!) : ''}`;
    if (opts.href) {
      return <Link href={opts.href} className={`${cls} ${styles.cellLink}`} title={opts.title}>{body}</Link>;
    }
    if (opts.onClick) {
      return <button type="button" className={`${cls} ${styles.cellLink}`} onClick={opts.onClick} title={opts.title}>{body}</button>;
    }
    return <span className={cls}>{body}</span>;
  }

  return (
    <div className={styles.wrap}>
      {/* A month grid is a COMPARISON, so it keeps its shape and scrolls with the line name
          pinned rather than stacking into cards (Chunk A D1/D2). */}
      <CoachScrollX sticky hint="Swipe the grid to see later months" className={styles.scroller}>
        {/* ⚠ `styles.grid` is NOT a no-op, however empty its own rule looks. It is the ancestor in
            `.grid thead th.lead` (the pinned header corner's stacking order) and in the two heading
            colours for the "No date yet" and current-month columns. Removing it silently unstyles
            three things a search for `.grid {` will not show you. */}
        <table className={`${shared.moneyGrid} ${styles.grid}`}>
          <thead>
            <tr>
              <th className={styles.lead}>Category / line</th>
              {/* ⚠ NO PRIOR-SEASON COLUMN HERE, and it is not an oversight (owner ruling
                  2026-08-21). A bare year at the head of a row of month columns read as a month
                  of THIS season, and it ignored the Showing lens — so under Scheduled it stood
                  last year's budget next to this year's remaining debt and invited a comparison
                  that was not true. Cross-season belongs in its own view. */}
              {showUndated && <th className={`${styles.num} ${styles.undated}`}>No date yet</th>}
              {view.map(m => (
                <th key={m} className={`${styles.num} ${m === todayMonth ? styles.thisMonth : ''}`}>{formatMonthLabel(m)}</th>
              ))}
              <th className={`${styles.num} ${styles.totalCol}`}>Total</th>
            </tr>
          </thead>

          <tbody>
            {grid.categories.map(cat => {
              const open = expanded.has(cat.categoryKey);
              const catTotal = lensTotal(cat.total, lens);
              return (
                <Fragment key={cat.categoryKey}>
                  <tr className={shared.moneyGridCat}>
                    <th scope="row" className={`${styles.lead} ${styles.catLead}`}>
                      <button
                        type="button"
                        className={shared.moneyGridToggle}
                        onClick={() => toggle(cat.categoryKey)}
                        aria-expanded={open}
                        disabled={cat.lines.length === 0}
                      >
                        {cat.lines.length === 0
                          ? <span className={shared.moneyGridChevronSpacer} aria-hidden />
                          : open ? <ChevronDown size={13} aria-hidden /> : <ChevronRight size={13} aria-hidden />}
                        <span className={shared.wrap640}>{cat.categoryName}</span>
                      </button>
                      {/* ⚠ THE "not in your plan" TAG WAS REMOVED HERE (owner ruling 2026-08-15).
                          A category with nothing budgeted and something actual has already said so
                          in its own figures; the words repeated what the reader could see. Its twin
                          on the Categories view ("not budgeted") went in the same change — one view
                          keeping a label the other dropped is the drift this report has been
                          consolidated twice to remove. */}
                    </th>
                    {showUndated && (
                      <td className={`${styles.num} ${styles.undated}`}>
                        {cellNode(undatedLive && cat.undatedBudget > 0.005 ? cat.undatedBudget : null)}
                      </td>
                    )}
                    {/* ⚠ `k` is the position ON SCREEN, `i` the position in the SEASON. Every cell
                        lookup uses `i`, or a paged grid reads the wrong month's money. */}
                    {view.map((m, k) => {
                      const i = start + k;
                      const v = lensCell(cat.cells[i], lens, m, todayMonth);
                      const drillable = (lens === 'actual' || lens === 'scheduled')
                        && (cellDetails[`${lens}|${cat.categoryKey}|${m}`]?.length ?? 0) > 0;
                      return (
                        <td key={m} className={`${styles.num} ${m === todayMonth ? styles.thisMonth : ''}`}>
                          {cellNode(v, {
                            emphasis: lens === 'difference',
                            onClick: drillable ? () => openDetail(lens as 'actual' | 'scheduled', cat.categoryKey, cat.categoryName, m) : undefined,
                            title: drillable ? `See what makes up ${formatMonthLong(m)}` : undefined,
                          })}
                        </td>
                      );
                    })}
                    <td className={`${styles.num} ${styles.totalCol}`}>{cellNode(catTotal, { emphasis: lens === 'difference' })}</td>
                  </tr>

                  {open && cat.lines.map(line => (
                    <tr key={line.id} className={styles.lineRow}>
                      <th scope="row" className={`${styles.lead} ${shared.moneyGridLead}`}>
                        <span className={shared.wrap640}>{line.description}</span>
                      </th>
                      {showUndated && (
                        <td className={`${styles.num} ${styles.undated}`}>
                          {cellNode(undatedLive && line.undatedBudget > 0.005 ? line.undatedBudget : null, {
                            ...(canWrite && undatedLive && line.undatedBudget > 0.005
                              ? { ...planCell(line, 'with no date yet'), title: 'Give this money a date' }
                              : {}),
                          })}
                        </td>
                      )}
                      {view.map((m, k) => {
                        const i = start + k;   // season index — see the category row above
                        /* ⚠⚠ EVERY LENS, NOT JUST BUDGET (fixed 2026-08-21, owner-found). This read
                           `lens === 'budget' ? … : null` under a comment saying actuals could only be
                           matched to a category — true when written, and untrue since every cost
                           started naming an item. The row now carries its own money, so blanking it
                           here printed a dash over a figure the grid had already worked out.

                           ⚠ It is the SAME `lensCell` the category row above uses. A second way of
                           choosing a cell's value is how a parent and its children start disagreeing. */
                        const v = lensCell(line.cells[i], lens, m, todayMonth);
                        const canEdit = canWrite && lens === 'budget' && line.cells[i].budget > 0.005;
                        return (
                          <td key={m} className={`${styles.num} ${m === todayMonth ? styles.thisMonth : ''}`}>
                            {cellNode(v, canEdit ? planCell(line, `in ${formatMonthLong(m)}`) : {})}
                          </td>
                        );
                      })}
                      <td className={`${styles.num} ${styles.totalCol}`}>
                        {cellNode(lensTotal(line.total, lens))}
                      </td>
                    </tr>
                  ))}
                </Fragment>
              );
            })}

            <tr className={`${shared.moneyGridTotal} ${styles.totalRow}`}>
              <th scope="row" className={styles.lead}>Total</th>
              {showUndated && (
                <td className={`${styles.num} ${styles.undated}`}>
                  {cellNode(undatedLive ? grid.totals.undatedBudget : null)}
                </td>
              )}
              {view.map((m, k) => (
                <td key={m} className={`${styles.num} ${m === todayMonth ? styles.thisMonth : ''}`}>
                  {cellNode(lensCell(grid.totals.cells[start + k], lens, m, todayMonth), { emphasis: lens === 'difference' })}
                </td>
              ))}
              <td className={`${styles.num} ${styles.totalCol}`}>
                {cellNode(lensTotal(grid.totals.total, lens), { emphasis: lens === 'difference' })}
              </td>
            </tr>

            {/* The cash-flow strip: three rows that share the grid's own columns, so a coach
                reads the plan and its consequence in one place instead of two widgets. */}
            {cash && CASH_ROWS.map((row, i) => (
              <tr key={row.key} className={`${shared.moneyGridFlow} ${i === 0 ? shared.moneyGridFlowFirst : ''} ${row.emphasis ? styles.runningRow : ''}`}>
                <th scope="row" className={styles.lead}>{row.label}</th>
                {showUndated && <td className={`${styles.num} ${styles.undated}`}><span className={styles.nil}>—</span></td>}
                {cash.rows.slice(start, start + MONTH_WINDOW).map(r => (
                  <td key={r.month} className={`${styles.num} ${r.month === todayMonth ? styles.thisMonth : ''}`}>
                    {cellNode(row.value(r), { emphasis: row.emphasis })}
                  </td>
                ))}
                {/* A running balance has no meaningful sum across months — only its last value,
                    which is already the final column. */}
                <td className={`${styles.num} ${styles.totalCol}`}>
                  {row.emphasis ? <span className={styles.nil}>—</span> : cellNode(cash.rows.reduce((s, r) => s + row.value(r), 0))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CoachScrollX>

      {/* Every claim the grid makes about its own basis, in one place under it. */}
      <div className={styles.notes}>
        {cash && (
          <p className={styles.note}>
            Cash flow is projected with the <strong>{MONEY_LENSES.find(l => l.id === lens)?.label}</strong> lens
            {lens === 'budget' ? ' — your plan, not your commitments.' : lens === 'scheduled' ? ' — what you’ve committed to, not your plan.' : ' — money actually received and actually paid.'}
            {' '}Money in is player dues only; fundraiser rebates already credit dues, so counting both would count the same dollar twice.
            {showUndated && ` ${fmt(grid.totals.undatedBudget)} with no date yet isn’t in this projection.`}
          </p>
        )}
        {lens === 'difference' && (
          <p className={styles.note}>
            Difference is your plan minus what you’ve actually paid, for months that have already
            happened. A month still ahead shows “—” — money nobody has spent yet isn’t a saving.
          </p>
        )}
        {/* ⚠⚠ THIS NOTE USED TO SAY THE OPPOSITE, and it was the THIRD copy of one stale claim
            (2026-08-21): the same sentence lived in a code comment, in this component’s own cell
            logic, and here in front of the coach. Spending now lands on the item row it names — so
            the line telling a coach to expect a dash was the last thing still asserting the old
            behaviour, and the most expensive, because a reader believes it. */}
        {(lens === 'actual' || lens === 'scheduled') && (
          <p className={styles.note}>
            {lens === 'actual' ? 'Spending' : 'A commitment'} sits on the <strong>item</strong> it names, so a
            category is what its rows add up to. Money recorded without an item sits on that
            category’s <strong>Not itemized</strong> row. Tap a <strong>category’s</strong> figure to see
            what makes it up.
          </p>
        )}
        {grid.truncated && (
          <p className={styles.note}>
            Showing the first {grid.months.length} months. Anything dated outside them still counts in
            the Total column.
          </p>
        )}
      </div>

      {cash?.shortfall && (
        <div className={styles.shortfall}>
          <CalendarClock size={15} aria-hidden />
          <span>
            <strong>On this plan you go short in {formatMonthLong(cash.shortfall.month)} — about {fmt(cash.shortfall.amount)}.</strong>
            {' '}Move a payment, bring dues forward, or plan the gap.
          </span>
        </div>
      )}

      {/* Drill-in: what a single Actual or Scheduled cell is made of. Read-only by design —
          the grid is a way to REACH the forms, never a second editor. Visible to read-only
          coaches, who can already see every number on this page. */}
      {detail && (
        <div className={`${shared.modalOverlay} ${shared.centeredOnMobile}`} onPointerDown={e => { if (e.target === e.currentTarget) (() => setDetail(null))?.(); }}>
          <div className={shared.modal} style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
            <div className={shared.modalHeader}>
              <h3 className={shared.modalTitle}>{detail.title}</h3>
              <button className={shared.modalCloseBtn} onClick={() => setDetail(null)} aria-label="Close"><X size={16} /></button>
            </div>
            <ul className={styles.detailList}>
              {detail.items.map(item => (
                <li key={item.id}>
                  <span className={styles.detailDesc}>
                    {item.description}
                    <span className={styles.detailMeta}>
                      {fmtDay(item.date)}{item.paid ? ' · paid' : ' · unpaid'}
                    </span>
                  </span>
                  <span className={styles.detailAmt}>{fmt(item.amount)}</span>
                </li>
              ))}
              <li className={styles.detailTotal}>
                <span>Total</span>
                <span className={styles.detailAmt}>{fmt(detail.items.reduce((s, i) => s + i.amount, 0))}</span>
              </li>
            </ul>
            <div className={shared.modalFooter}>
              <Link href={detail.href} className={shared.btnSecondary}>{detail.hrefLabel}</Link>
            </div>
          </div>
        </div>
      )}

      {/* "Which line's dates?" — the ambiguous half of the plan-cell affordance (approved 2026-08-17).
          Only reachable from a row standing for two or more budget lines, so a coach with one line per
          item never meets it. It also explains the row: somebody who wrote two lines and reads one
          summed figure learns why, at the moment they are wondering. */}
      {chooser && (
        <div className={`${shared.modalOverlay} ${shared.centeredOnMobile}`} onPointerDown={e => { if (e.target === e.currentTarget) (() => setChooser(null))?.(); }}>
          <div className={shared.modal} style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
            <div className={shared.modalHeader}>
              <h3 className={shared.modalTitle}>Which line’s dates?</h3>
              <button className={shared.modalCloseBtn} onClick={() => setChooser(null)} aria-label="Close"><X size={16} /></button>
            </div>
            <p className={styles.chooserSub}>
              {chooser.item} · {chooser.when}
            </p>
            <ul className={styles.chooserList}>
              {chooser.lines.map(l => (
                <li key={l.id}>
                  <Link
                    href={moneySectionHref(base, 'budget', { line: l.id, periods: '1' })}
                    className={styles.chooserChoice}
                    onClick={() => setChooser(null)}
                  >
                    <span className={styles.chooserWho}>
                      {l.description}
                      <span className={styles.chooserWhen}>{whenLine(l)}</span>
                    </span>
                    <span className={styles.chooserAmt}>{fmt(l.amount)}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <p className={styles.chooserFoot}>
              {chooser.lines.length} lines on this item are shown as one row. Pick the one whose dates
              you want to change.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
