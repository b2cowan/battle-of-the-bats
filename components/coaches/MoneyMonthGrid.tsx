'use client';
import { Fragment, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight, X, CalendarClock } from 'lucide-react';
import CoachScrollX from '@/components/coaches/CoachScrollX';
import {
  buildBandCashFlow, lensCell, lensTotal, lensUndated, lensReadsPlan,
  categoryHasFigure, hasUndated, isPayoutCategory, cellPanelSpec, panelRowWords, UNDATED_CELL,
  bandTotalLabel, revenueGroupLabel, revenueGroupOf,
  formatMonthLabel, formatMonthLong,
  type MonthGrid, type MonthKey, type MoneyLens, type GridPlanLine,
  type GridCategoryResult, type MoneyRowDirection, type PanelDoor, type PanelSubject,
  type RevenueGroupKey,
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
  /** What THIS record says for itself. Empty where it has nothing beyond its kind. */
  description: string;
  /**
   * What KIND of record it is — "Dues payment", "Paid back", "Season sponsorship".
   *
   * ⚠⚠ NOT A SECOND SPELLING OF `description`, and the difference is what stops thirteen families
   * arriving as thirteen identical lines (owner-found 2026-08-25). A ROW's panel is titled with the
   * family, so the kind is a useful lead; a GROUP's panel is titled with the kind, so it must lead
   * with the family instead. No rule inferred from the records themselves can separate the two —
   * three were tried against real data first — so the source states which word is which.
   */
  kind?: string | null;
  date: string | null;
  amount: number;
  /** Absent where "paid"/"unpaid" says nothing — a dues payment did not get paid, it arrived. */
  paid?: boolean;
  /**
   * The meta line, where the record has something the date does not say: the method it came by,
   * the credit a drive gave a family back, the cost a refund repaid, why a family was paid back.
   *
   * ⚠ IT REPLACES paid/unpaid RATHER THAN JOINING IT. Two clauses of housekeeping in front of the
   * one that answers the coach's question is how a meta line stops being read.
   */
  note?: string | null;
  /** "Due", "Asked" — a word before a date that is not the day the money moved. */
  datePrefix?: string;
  /**
   * The grid ROW this record belongs to (`<categoryKey>|<itemId>`).
   *
   * ⚠⚠ AN ITEM'S PANEL IS A FILTER OF ITS CATEGORY'S LIST, never a second copy of it in the
   * payload — the same records would otherwise ship twice on the heaviest read in the portal, and
   * two arrays are two things a future change can put out of step.
   */
  row?: string;
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
  /**
   * ⚠ THE **EXPENSES** BAND. The name predates the second band (Option D, 2026-08-23) and is kept
   * because every reader already speaks it — the export, the panel's own window control and
   * `check:money-report`.
   */
  monthGrid: MonthGrid;
  /**
   * The REVENUE band — the same shape, built by the same function over the SAME months.
   * Its categories are the five revenue GROUPS (dues, drives, sponsors, other income, money back),
   * keyed so `revenueGroupOf` can re-label them per lens.
   */
  revenueGrid: MonthGrid;
  cellDetails: Record<string, CellDetailItem[]>;
  /**
   * Today's real money.
   *
   * ⚠ ONLY THE SCHEDULED LENS READS IT, and that is the forward view's whole character: "what
   * happens next" projected from zero would be fiction. Actual and Budget start from the season's
   * own opening balance instead.
   */
  cashOnHand: number;
  /**
   * What the season was HANDED on day one — money carried forward at `Start next season` (mig 262).
   *
   * ⚠⚠ NULL IS NOT ZERO. A season that carried nothing shows no opening row at all; one carried at
   * exactly $0 shows a row saying so. They are the same number and different facts, and a first
   * season deserves a table with no line about money it never had.
   * ⚠ `cashOnHand` ALREADY INCLUDES IT — the Scheduled lens projects from real money, so adding
   * this to that lens as well would count the carry twice. `buildBandCashFlow` owns that rule.
   */
  openingBalance?: number | null;
  /** The season it came from, when it was carried rather than typed. */
  openingBalanceFrom?: string | null;
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

/**
 * What one record's two lines say, and it depends on WHOSE panel this is (owner-found 2026-08-25).
 *
 * ⚠⚠ A GROUP'S PANEL IS NOT ITS ROW'S PANEL WITH MORE RECORDS IN IT. Open one family and the title
 * already names them, so each row says what the record IS ("Dues payment"). Open the GROUP and the
 * title says "Player dues" — which every record restates — so thirteen families arrived as thirteen
 * identical lines reading "Dues payment". The drawing asked for "every family's payment, NAMED";
 * this is the naming.
 *
 * ⚠ THE WORD THAT IS THE SAME ON EVERY ROW DISTINGUISHES NOTHING, and that is the whole rule for
 * the second line — no flag on the record, no list of which groups are "generic". "Dues payment"
 * repeated thirteen times is furniture; "Home opener gate" beside "Doubleheader gate" is the
 * answer. A panel holding ONE record keeps its words either way: nothing is being distinguished,
 * but the record still has something to say.
 *
 * ⚠ THE DATE CAN BE ABSENT AND THE ROW STILL MEANS SOMETHING — a sponsor's pledge and a club ask
 * have no date, because nothing records when they land. Every line is assembled from whichever
 * parts exist rather than around a date that may not.
 */
/**
 * One record's two lines inside a drill-in panel.
 *
 * ⚠ WHICH WORDS APPEAR IS `panelRowWords`, IN THE LIB, and deliberately not here: that rule has
 * been wrong twice and nothing could assert against it while it lived in a component. What is left
 * here is the assembly — a date this screen knows how to format, and a note.
 * ⚠ THE DATE CAN BE ABSENT AND THE ROW STILL MEANS SOMETHING: a sponsor's pledge and a club ask
 * have none, because nothing records when they land.
 */
function detailLines(
  item: CellDetailItem,
  opts: { subject?: string; group: boolean },
): { lead: string; meta: string } {
  const when = item.date ? `${item.datePrefix ?? ''}${fmtDay(item.date)}` : '';
  const said = item.note?.trim() || (item.paid === undefined ? '' : item.paid ? 'paid' : 'unpaid');
  const { lead, words } = panelRowWords(item, opts);
  return { lead, meta: [words, when, said].filter(Boolean).join(' · ') };
}

/**
 * ⚠⚠ THE STRIP'S "Money in" AND "Money out" ROWS ARE GONE (owner ruling 2026-08-23, Option D).
 * They existed because the grid could not say what came in — so the two figures were bolted under
 * a table that did not contain them, and a coach had to take on faith that the balance underneath
 * was made of the rows above. **The band totals ARE those rows now.** What survives is the
 * consequence a coach cannot work out in their head: the month's net, and the balance it rolls to.
 */

/**
 * How a figure is coloured.
 *
 * ⚠ `negative` IS NOT `signed` WITH HALF THE RULES. On the Difference lens a positive number means
 * the season went well on EITHER band (see `MoneyRowDirection`), so green earns its place. On the
 * Net and Running rows a positive number is just a balance — painting an ordinary month green
 * would make the one figure that IS a warning, a balance below zero, read as one colour among
 * several instead of the only one on the screen (owner, 2026-08-13).
 */
type Emphasis = 'signed' | 'negative';

function signClass(n: number, emphasis: Emphasis): string {
  if (n < -0.005) return styles.neg;
  if (emphasis === 'signed' && n > 0.005) return styles.pos;
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
  const { monthGrid: grid, revenueGrid, cellDetails, cashOnHand, todayMonth } = data;
  const opening = data.openingBalance ?? null;
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<{
    title: string;
    items: CellDetailItem[];
    totalLabel: string;
    doors: PanelDoor[];
    /**
     * Row key → the name of the family / drive / sponsor / source it belongs to, for a GROUP's
     * panel. Empty on a row's own panel, where the title already names the subject.
     *
     * ⚠ RESOLVED FROM THE GRID'S OWN ROWS RATHER THAN SHIPPED ON EVERY RECORD. The rows are on
     * screen already and each carries its name; a copy of that name on every payment would be the
     * same word travelling twice in the portal's heaviest payload, free to disagree with the row it
     * belongs under.
     */
    subjects: Record<string, string>;
    /** The one row this panel is about, when it is about one — absent on a GROUP's panel, which is
     *  also how the row renderer knows which of the two it is drawing. */
    subject?: string;
  } | null>(null);
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

  /** Editing a plan cell is only meaningful under a lens that reads the plan. */
  const undatedLive = lensReadsPlan(lens);
  /* ⚠ THE COLUMN APPEARS ONLY WHERE IT CAN HOLD SOMETHING (owner ruling 2026-08-21) — but the
     rule is now enforced on the FIGURE rather than on the lens's name. Undated money used to be
     plan money and nothing else; the Scheduled forward view gave it a sponsor PLEDGE and a club
     request awaiting an answer (owner ruling 2026-08-23), which have no date because nothing
     records when they land. Hiding the column under Scheduled would leave that money in the Total
     and nowhere a coach can see it. */
  const showUndated = hasUndated([revenueGrid, grid], lens);

  /* ══ The season's net and its running balance ═════════════════════════════════════════════════
     ⚠⚠ BOTH SIDES COME FROM THE BANDS ON SCREEN, which is the Option D ruling made arithmetic
     (owner, 2026-08-23). The strip used to take money-out from the grid's cells and money-in from
     a server map assembled elsewhere — two feeds, and under Actual they were two different
     arithmetics, so "revenue − expenses = balance" was something a coach had to be TOLD rather
     than something they could check. Now the row is literally the two totals above it subtracted.
     Never a blend across lenses: mixing a planned estimate with a commitment for the same cost is
     the double-count the "Scheduled is a separate lens" ruling exists to prevent.

     ⚠ THE OPENING IS THE LENS'S OWN. Actual and Budget start from the season's opening balance
     (nothing carried yet — the carry-forward is its own build item); Scheduled starts from TODAY'S
     REAL MONEY, because a forward view projected from zero would be fiction. */
  const cash = useMemo(
    () => (lens === 'difference' ? null : buildBandCashFlow(revenueGrid, grid, lens, cashOnHand, opening ?? 0)),
    [grid, revenueGrid, lens, cashOnHand, opening]);

  /* ⚠ A REVENUE GROUP RENDERS ONLY WHERE IT HAS SOMETHING TO SAY UNDER THIS LENS, and that is what
     makes Scheduled read as a FORWARD view rather than a restatement: a bottle drive has no
     forward record, so "Fundraising" is simply absent there rather than a row of dashes. The
     EXPENSE band keeps its existing behaviour — a category the coach budgeted for stays visible
     whether or not this lens has anything in it, because its absence is itself the answer.
     ⚠ The predicate is `categoryHasFigure`, shared with the export — see its header. */
  const visibleRevenue = useMemo(
    () => revenueGrid.categories.filter(c => categoryHasFigure(c.total, lens)),
    [revenueGrid, lens]);

  /* ⚠ THE EXPENSE BAND KEEPS EVERY REAL CATEGORY, EMPTY OR NOT — a category you budgeted for and
     have not spent on is answering the question, not failing to. The ONE exception is the synthetic
     payouts group, which has no plan and no schedule and never can; see `isPayoutCategory`. */
  const visibleExpenses = useMemo(
    () => grid.categories.filter(c => !isPayoutCategory(c.categoryKey) || categoryHasFigure(c.total, lens)),
    [grid, lens]);

  function toggle(key: string) { setExpanded(prev => toggleKey(prev, key)); }

  /**
   * Every record behind ONE cell, filtered to a row when the coach tapped an item's figure.
   *
   * ⚠ THE FILTER IS THE WHOLE MECHANISM (D-2, 2026-08-24). A category's list and its rows' lists are
   * the same records read at two grains — so an item panel narrows the category's list by `row`
   * rather than reading a second map. There is no second map to disagree with.
   */
  function cellItems(kind: 'actual' | 'scheduled', categoryKey: string, when: string, row?: string) {
    const all = cellDetails[`${kind}|${categoryKey}|${when}`] ?? [];
    return row ? all.filter(i => i.row === row) : all;
  }

  /**
   * What opens when a coach taps a figure — one rule for every row on the table (owner ruling
   * 2026-08-24, artifact `da5d08b9`).
   *
   * ⚠ READ-ONLY, ALWAYS. The grid reaches the forms; it never becomes a second place to edit, which
   * is why there is no "Record a payment" here and never will be.
   * ⚠ THE DOORS AND THE TOTAL'S WORD ARE NOT DECIDED HERE — `cellPanelSpec` owns both, so the
   * screen and anything that follows it cannot answer differently. "Possible" instead of "Total" on
   * a pledge panel is that rule doing its job.
   */
  /** A cell belongs either to a whole group's month or to ONE row within it. */
  type PanelRow = { key: string; subject: PanelSubject } | null;

  function openDetail(kind: 'actual' | 'scheduled', cat: PanelCategory, when: string, row: PanelRow) {
    const items = cellItems(kind, cat.categoryKey, when, row?.key);
    if (items.length === 0) return;
    const spec = cellPanelSpec({ group: cat.group, payout: cat.payout }, kind, row?.subject ?? null);
    /* A GROUP's panel names each record's own row; a row's panel does not, because its title
       already did. Built from the band this category belongs to, so a family removed from the
       roster mid-season still resolves through the row her money left behind. */
    const subjects: Record<string, string> = {};
    if (!row) {
      const band = cat.group ? revenueGrid : grid;
      const owner = band.categories.find(c => c.categoryKey === cat.categoryKey);
      for (const line of owner?.lines ?? []) subjects[line.id] = line.description;
    }
    setDetail({
      // The drawings' own form: whose money, and when. The lens is named by the control that got here.
      title: `${row?.subject.name ?? cat.label} · ${when === UNDATED_CELL ? 'no date yet' : formatMonthLong(when)}`,
      items,
      totalLabel: spec.totalLabel,
      doors: spec.doors,
      subjects,
      subject: row?.subject.name,
    });
  }

  /**
   * What a MONEY cell does when a coach taps it — the twin of `planCell` above, for the two lenses
   * that hold records rather than a plan.
   *
   * ⚠ NOTHING PRETENDS TO BE TAPPABLE. The affordance appears only where the payload actually has
   * records behind that cell — the defect two of this grid's own affordances shipped with was a
   * control that looked live and silently did nothing.
   */
  function drill(cat: PanelCategory, when: string, row: PanelRow) {
    if (lens !== 'actual' && lens !== 'scheduled') return {};
    if (cellItems(lens, cat.categoryKey, when, row?.key).length === 0) return {};
    const who = row?.subject.name ?? cat.label;
    return {
      onClick: () => openDetail(lens, cat, when, row),
      title: when === UNDATED_CELL
        ? `See what makes up ${who} with no date yet`
        : `See what makes up ${who} in ${formatMonthLong(when)}`,
    };
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
    opts: { onClick?: () => void; href?: string; title?: string; emphasis?: Emphasis } = {},
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
    const cls = `${styles.cellValue} ${opts.emphasis ? signClass(value!, opts.emphasis) : ''}`;
    if (opts.href) {
      return <Link href={opts.href} className={`${cls} ${styles.cellLink}`} title={opts.title}>{body}</Link>;
    }
    if (opts.onClick) {
      return <button type="button" className={`${cls} ${styles.cellLink}`} onClick={opts.onClick} title={opts.title}>{body}</button>;
    }
    return <span className={cls}>{body}</span>;
  }

  /** Which row of the table a panel is being opened from — its identity, its words, and its band. */
  type PanelCategory = { categoryKey: string; label: string; group: RevenueGroupKey | null; payout: boolean };

  /** Every column the table has, so a band heading spans the grid without breaking the pinned ends. */
  const spacerCells = (key: string) => (
    <>
      {showUndated && <td key={`${key}-u`} className={`${styles.num} ${styles.undated}`} />}
      {view.map(m => <td key={`${key}-${m}`} className={`${styles.num} ${m === todayMonth ? styles.thisMonth : ''}`} />)}
      <td className={`${styles.num} ${styles.totalCol}`} />
    </>
  );

  /**
   * One band heading — REVENUE or EXPENSES.
   *
   * ⚠ REAL EMPTY CELLS, NEVER A `colspan`. The Total column is position:sticky and the label column
   * is pinned left; a row that spans them has nothing for either pin to hold, and the heading
   * scrolls out from under a table whose whole point is that its ends do not.
   */
  const bandHeading = (band: MoneyRowDirection) => (
    <tr className={styles.bandRow}>
      <th scope="row" className={`${styles.lead} ${styles.bandLead}`}>
        {band === 'in' ? 'Revenue' : 'Expenses'}
      </th>
      {spacerCells(band)}
    </tr>
  );

  /** A band's closing total, in the lens's own words ("Budgeted revenue", "Scheduled expenses"). */
  const bandTotal = (band: MoneyRowDirection, g: MonthGrid) => (
    <tr className={`${shared.moneyGridTotal} ${styles.totalRow}`}>
      <th scope="row" className={styles.lead}>{bandTotalLabel(band, lens)}</th>
      {showUndated && (
        <td className={`${styles.num} ${styles.undated}`}>
          {cellNode(lensUndated(g.totals.undated, lens) || null)}
        </td>
      )}
      {view.map((m, k) => (
        <td key={m} className={`${styles.num} ${m === todayMonth ? styles.thisMonth : ''}`}>
          {cellNode(lensCell(g.totals.cells[start + k], lens, m, todayMonth, band),
            { emphasis: lens === 'difference' ? 'signed' : undefined })}
        </td>
      ))}
      <td className={`${styles.num} ${styles.totalCol}`}>
        {cellNode(lensTotal(g.totals.total, lens, band),
          { emphasis: lens === 'difference' ? 'signed' : undefined })}
      </td>
    </tr>
  );

  /**
   * One category — the row a coach reads, and its item rows when they expand it.
   *
   * ⚠⚠ ONE RENDERER FOR BOTH BANDS (Option D, 2026-08-23). Revenue could have had its own: it has
   * no plan-cell editing, no drill-in yet, and its labels move with the lens. It does not, because
   * the collapse toggle, the pinned label, the windowed months, the Total column and the undated
   * bucket are five behaviours this grid has already had to have fixed once each — and a second
   * copy is five more places for the next fix to miss. What differs is passed in.
   */
  function renderCategory(cat: GridCategoryResult, band: MoneyRowDirection) {
    const open = expanded.has(cat.categoryKey);
    const group = band === 'in' ? revenueGroupOf(cat.categoryKey) : null;
    const payout = isPayoutCategory(cat.categoryKey);
    // ⚠ The label MOVES WITH THE LENS on revenue — "Player dues" is money received, "Remaining
    // dues instalments" is money still to come, and one name for both would flatten the forward
    // view into a restatement of the past.
    const label = group ? revenueGroupLabel(group, lens) : cat.categoryName;
    const catUndated = lensUndated(cat.undated, lens);
    const panelCat = { categoryKey: cat.categoryKey, label, group, payout };
    /* ⚠⚠ A ROW THAT IS A SUBJECT ONLY SHOWS WHERE IT HAS MONEY UNDER THIS LENS (D-2, 2026-08-24).
       The families, drives, sponsors and requests behind a revenue group — and the families behind
       "Paid back to families" — are RECORDS, not plan lines: a family who has paid nothing this
       season has no row on Actual, and none of them has a Budget figure at all, because a group's
       plan is a dues schedule or a funding line and lives on the group's own row.
       ⚠ AND NONE OF THEM APPEARS UNDER DIFFERENCE, deliberately. There is no per-family plan to
       compare against, so every row would print its whole Actual as "ahead of plan" in the colour
       the grid uses for good news. The comparison the coach wants is the GROUP's, one row up.
       ⚠ THE EXPENSE BAND'S OWN CATEGORIES KEEP EVERY ROW, empty or not — a budgeted item you have
       not spent on is answering the question, not failing to. */
    const subjectRows = band === 'in' || payout;
    const lines = !subjectRows ? cat.lines
      : lens === 'difference' ? []
        : cat.lines.filter(l => categoryHasFigure(l.total, lens));
    return (
      <Fragment key={cat.categoryKey}>
        <tr className={shared.moneyGridCat}>
          <th scope="row" className={`${styles.lead} ${styles.catLead}`}>
            <button
              type="button"
              className={shared.moneyGridToggle}
              onClick={() => toggle(cat.categoryKey)}
              aria-expanded={open}
              disabled={lines.length === 0}
            >
              {lines.length === 0
                ? <span className={shared.moneyGridChevronSpacer} aria-hidden />
                : open ? <ChevronDown size={13} aria-hidden /> : <ChevronRight size={13} aria-hidden />}
              <span className={shared.wrap640}>{label}</span>
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
              {cellNode(Math.abs(catUndated) > 0.005 ? catUndated : null, drill(panelCat, UNDATED_CELL, null))}
            </td>
          )}
          {/* ⚠ `k` is the position ON SCREEN, `i` the position in the SEASON. Every cell
              lookup uses `i`, or a paged grid reads the wrong month's money. */}
          {/* ⚠⚠ EVERY FIGURE ON BOTH BANDS OPENS NOW (owner ruling 2026-08-24). This used to be the
              expense band's alone, with a comment saying revenue had no detail list to open — that
              was true and is the thing D-2 built. */}
          {view.map((m, k) => {
            const i = start + k;
            const v = lensCell(cat.cells[i], lens, m, todayMonth, band);
            return (
              <td key={m} className={`${styles.num} ${m === todayMonth ? styles.thisMonth : ''}`}>
                {cellNode(v, {
                  emphasis: lens === 'difference' ? 'signed' : undefined,
                  ...drill(panelCat, m, null),
                })}
              </td>
            );
          })}
          <td className={`${styles.num} ${styles.totalCol}`}>
            {cellNode(lensTotal(cat.total, lens, band), { emphasis: lens === 'difference' ? 'signed' : undefined })}
          </td>
        </tr>

        {open && lines.map(line => {
          const lineUndated = lensUndated(line.undated, lens);
          const undatedEditable = canWrite && undatedLive && lineUndated > 0.005 && band === 'out';
          /* ⚠ THE ROW'S OWN KEY IS `line.id` — `<categoryKey>|<itemId>`, exactly what the payload
             stamped on each record. Rebuilding it from the parts here would be a second spelling of
             one key, and a panel that quietly resolves to an empty list is how the LAST drill-in on
             this grid broke (a nameless category keyed two ways, silent for weeks). */
          const row = { key: line.id, subject: { id: line.itemId, name: line.description } };
          return (
            <tr key={line.id} className={styles.lineRow}>
              <th scope="row" className={`${styles.lead} ${shared.moneyGridLead}`}>
                <span className={shared.wrap640}>{line.description}</span>
              </th>
              {showUndated && (
                <td className={`${styles.num} ${styles.undated}`}>
                  {cellNode(Math.abs(lineUndated) > 0.005 ? lineUndated : null, {
                    ...(undatedEditable
                      ? { ...planCell(line, 'with no date yet'), title: 'Give this money a date' }
                      /* ⚠ A SPONSOR'S PLEDGE AND A CLUB ASK LIVE ENTIRELY HERE (owner ruling
                         2026-08-23) — in the Total and in no month. Until D-2 this column's figure
                         was the one on the table with nothing behind it. */
                      : drill(panelCat, UNDATED_CELL, row)),
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
                const v = lensCell(line.cells[i], lens, m, todayMonth, band);
                const canEdit = canWrite && lens === 'budget' && band === 'out' && line.cells[i].budget > 0.005;
                return (
                  <td key={m} className={`${styles.num} ${m === todayMonth ? styles.thisMonth : ''}`}>
                    {cellNode(v, canEdit ? planCell(line, `in ${formatMonthLong(m)}`) : drill(panelCat, m, row))}
                  </td>
                );
              })}
              <td className={`${styles.num} ${styles.totalCol}`}>
                {cellNode(lensTotal(line.total, lens, band))}
              </td>
            </tr>
          );
        })}
      </Fragment>
    );
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
            {/* ⚠⚠ TWO BANDS, ONE TABLE — the season's cash statement (owner ruling 2026-08-23).
                Revenue first because that is the order a statement is read and the order the
                arithmetic runs: what came in, what went out, what is left. */}
            {bandHeading('in')}
            {visibleRevenue.map(cat => renderCategory(cat, 'in'))}
            {bandTotal('in', revenueGrid)}

            {bandHeading('out')}
            {visibleExpenses.map(cat => renderCategory(cat, 'out'))}
            {bandTotal('out', grid)}

            {/* The two rows a coach cannot work out by looking: the month's net, and the balance
                it rolls to. They share the grid's own columns, so the plan and its consequence
                are one table rather than two widgets. */}
            {cash && (
              <>
                {/* ⚠⚠ EVERY MONTH SAYS WHAT IT OPENED WITH (owner ruling 2026-08-26, replacing the
                    2026-08-23 single-cell row). The block now reads as a statement — **opening +
                    net = closing**, verifiable in the column a coach is looking at rather than by
                    tracing a cumulative series back to its origin.

                    ⚠⚠ THE WINDOW IS WHY, and it is worth stating because the redundancy is obvious
                    and the reason is not: this grid shows TWELVE months at a time. Scroll to a later
                    window and the closing figures were a running total whose starting point had
                    scrolled off screen — a number the reader was asked to trust rather than check.
                    Each month's opening IS the month before's closing, so on one screen it is the
                    same series twice; on a SCROLLED screen it is the only thing making the visible
                    columns readable. Priced and accepted by the owner.

                    ⚠ SO IT NO LONGER HIDES WHEN NOTHING WAS CARRIED. A first season opens at zero
                    in its first month — which renders as an em dash like every other zero here —
                    but its LATER months open on real money, so the row has something to say for
                    every team. That is one more row on the portal's most-read money screen, taken
                    deliberately.

                    ⚠ SCHEDULED SHOWS IT TOO, and states the thing that lens most needs said: the
                    forward view projects from TODAY'S REAL CASH, and that figure now sits in the
                    table's first column instead of only in a sentence underneath it. */}
                <tr className={`${shared.moneyGridFlow} ${shared.moneyGridFlowFirst}`}>
                  {/* ⚠⚠ NO "carried from {season}" SUB-LABEL HERE, and that is a rule this table
                      already learned the hard way (owner-found 2026-08-24). The label column is the
                      narrowest thing in the grid and every pixel it takes costs a visible month at
                      every width — the balance row's own "from today's $X" hint was deleted for
                      exactly this, being the widest label in the table for an aside only one lens
                      ever showed. The provenance is a SENTENCE, and it goes in the notes under the
                      grid where there is room for one. */}
                  <th scope="row" className={styles.lead}>Opening balance</th>
                  {/* ⚠ A BALANCE IS A MOMENT, AND UNDATED MONEY HAS NONE. A pledge and a club ask
                      reach the Total and no month, so this column alone cannot show opening + net =
                      closing — both balance rows are dashes here while Net carries a figure. True
                      before this change too; stated now that the reader is invited to check the
                      row's arithmetic. */}
                  {showUndated && <td className={`${styles.num} ${styles.undated}`}><span className={styles.nil}>—</span></td>}
                  {cash.rows.slice(start, start + MONTH_WINDOW).map(r => (
                    <td key={r.month} className={`${styles.num} ${r.month === todayMonth ? styles.thisMonth : ''}`}>
                      {cellNode(r.opening, { emphasis: 'negative' })}
                    </td>
                  ))}
                  {/* ⚠ THE SEASON'S OWN OPENING, never the visible window's. The Total column is the
                      whole season on every other row and must not become "the window" on this one. */}
                  <td className={`${styles.num} ${styles.totalCol}`}>
                    {cellNode(cash.opening, { emphasis: 'negative' })}
                  </td>
                </tr>
                <tr className={shared.moneyGridFlow}>
                  <th scope="row" className={styles.lead}>Net for the month</th>
                  {showUndated && (
                    <td className={`${styles.num} ${styles.undated}`}>
                      {cellNode(cash.undated.net || null, { emphasis: 'negative' })}
                    </td>
                  )}
                  {cash.rows.slice(start, start + MONTH_WINDOW).map(r => (
                    <td key={r.month} className={`${styles.num} ${r.month === todayMonth ? styles.thisMonth : ''}`}>
                      {cellNode(r.net, { emphasis: 'negative' })}
                    </td>
                  ))}
                  {/* ⚠ THE SEASON'S OWN NET, undated money included — which is why it is taken from
                      the flow rather than by re-adding the cells on screen. */}
                  <td className={`${styles.num} ${styles.totalCol}`}>
                    {cellNode(cash.net, { emphasis: 'negative' })}
                  </td>
                </tr>
                <tr className={`${shared.moneyGridFlow} ${styles.runningRow}`}>
                  {/* ⚠ THE "from today's $X" HINT WAS DELETED HERE (owner-found 2026-08-24, measured).
                      It was the WIDEST label in the table, and the label column is the narrowest
                      thing in it — so this one aside was stretching the pinned column by ~50px on
                      every lens, squeezing a month column off the screen, while the row it belongs
                      to only shows it on one. And it was already redundant: the Scheduled footnote
                      under the grid states the same figure in a sentence with room for it. */}
                  {/* ⚠ "Closing", NOT "Running" (owner ruling 2026-08-26). The two words describe
                      the same figure and only one of them PAIRS with the Opening row above it —
                      "running" asked the reader to hold a series in their head, "closing" says what
                      the cell is. Each cell always was the month's closing balance. */}
                  <th scope="row" className={styles.lead}>Closing balance</th>
                  {/* A balance is a moment, not a bucket: undated money reaches the Total (it is
                      part of where the season ends up) and no single month. */}
                  {showUndated && <td className={`${styles.num} ${styles.undated}`}><span className={styles.nil}>—</span></td>}
                  {cash.rows.slice(start, start + MONTH_WINDOW).map(r => (
                    <td key={r.month} className={`${styles.num} ${r.month === todayMonth ? styles.thisMonth : ''}`}>
                      {cellNode(r.running, { emphasis: 'negative' })}
                    </td>
                  ))}
                  {/* ⚠⚠ THE ENDING BALANCE, WHERE AN EM DASH USED TO SIT (owner ruling 2026-08-23).
                      "A running balance has no sum" was true and beside the point: the figure a
                      treasurer wants is where it ENDED, this column is pinned, and so Cash on hand
                      is now on screen whatever month has been scrolled to. */}
                  <td className={`${styles.num} ${styles.totalCol}`}>
                    {cellNode(cash.ending, { emphasis: 'negative' })}
                  </td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </CoachScrollX>

      {/* Every claim the grid makes about its own basis, in one place under it. */}
      <div className={styles.notes}>
        {/* ⚠⚠ THE "player dues only… same dollar twice" SENTENCE RETIRED HERE (owner ruling
            2026-08-23, reversing 2026-07-30 — memory/design_decisions.md). Its rationale survived
            three model changes it was no longer true under, restated on screen the whole time; the
            durable lesson is that a footnote explaining a rule is also that rule's expiry
            checklist. Each lens now states its own basis, because they genuinely differ. */}
        {lens === 'actual' && (
          <p className={styles.note}>
            <strong>Actual is cash.</strong> Revenue is every dollar that arrived — dues, fundraising and
            sponsor money received, income and money back you recorded, and anything the club sent.
            Expenses are every dollar that left — bills paid, payments to the club, and money paid back
            to families. A cost a <strong>family paid a vendor directly</strong> is season spending on the
            Statement but isn’t here: no team cash moved. It lands here the day you pay that family back.
          </p>
        )}
        {/* ⚠ THE CARRY EXPLAINS ITSELF WHERE THERE IS ROOM FOR A SENTENCE — see the note on the
            Opening balance row. Shown on the two lenses that start from it; Scheduled projects from
            today's real money, which already contains it. */}
        {opening !== null && lens !== 'scheduled' && (
          <p className={styles.note}>
            <strong>This season opened with {fmt(opening)}</strong>
            {data.openingBalanceFrom
              ? ` — carried from ${data.openingBalanceFrom} when this season was started.`
              : ' that the team was already holding.'}
            {' '}Change it in <strong>Team settings → Money</strong>.
          </p>
        )}
        {lens === 'scheduled' && (
          <p className={styles.note}>
            <strong>Scheduled is what’s still to come.</strong> Dues installments not yet paid, sponsor
            pledges and anything you’ve asked the club for, against what you still owe. A pledge and a
            pending request have no date, so they sit under <strong>No date yet</strong> — in the Total,
            in no month, counted as possible rather than arrived. The running balance starts from
            today’s real money, {fmt(cashOnHand)}.
          </p>
        )}
        {lens === 'budget' && (
          <p className={styles.note}>
            <strong>Budget is your plan</strong>, not your bills — the dues installments you set,
            your expected fundraising and sponsorship, and the months you gave your costs.
            {showUndated && ` ${fmt(lensUndated(grid.totals.undated, lens) + lensUndated(revenueGrid.totals.undated, lens))} with no date yet is in the Total and in no month.`}
          </p>
        )}
        {lens === 'difference' && (
          <p className={styles.note}>
            <strong>Difference is plan against reality</strong>, for months that have already happened.
            A positive figure is good news on both bands: revenue that <strong>came in ahead</strong>, or
            spending that came in <strong>under</strong>. A month still ahead shows “—” — money nobody has
            spent yet isn’t a saving, and dues nobody owes yet aren’t late.
          </p>
        )}
        {/* ⚠⚠ THIS NOTE USED TO SAY THE OPPOSITE, and it was the THIRD copy of one stale claim
            (2026-08-21): the same sentence lived in a code comment, in this component’s own cell
            logic, and here in front of the coach. Spending now lands on the item row it names — so
            the line telling a coach to expect a dash was the last thing still asserting the old
            behaviour, and the most expensive, because a reader believes it. */}
        {(lens === 'actual' || lens === 'scheduled') && (
          <p className={styles.note}>
            {lens === 'actual' ? 'Spending' : 'A bill'} sits on the <strong>item</strong> it names, so a
            category is what its rows add up to. Money recorded without an item sits on that
            category’s <strong>Not itemized</strong> row. Tap a <strong>category’s</strong> figure to see
            what makes it up.
          </p>
        )}
        {/* ⚠⚠ THE TWO TRUTHS, NAMED (owner ruling 2026-08-23). Months is CASH and the Statement is
            the season's spending, so their Total expenses can differ — and the coach who spots that
            gap deserves to be told why by the screen rather than by support. The three causes are
            listed because "they use different bases" answers nothing a treasurer can check. */}
        {lens === 'actual' && (
          <p className={styles.note}>
            Total expenses here can differ from the <strong>Statement</strong>’s: this view adds money
            paid back to families, leaves out costs a family paid a vendor directly, and shows money
            back as revenue instead of subtracting it from the cost it repaid.
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
        /* ⚠⚠ THE TENSE FOLLOWS THE LENS, and it did not until the coach demo was read back with
           the bands in place (2026-08-23). "On this plan you go short" is a PROJECTION's sentence —
           true under Budget and Scheduled, and plainly wrong under Actual, where the money has
           already gone and no plan is being discussed. The advice underneath moves with it: you
           cannot bring dues forward in a month that has already happened. */
        <div className={styles.shortfall}>
          <CalendarClock size={15} aria-hidden />
          {lens === 'actual' ? (
            <span>
              <strong>Your balance went below zero in {formatMonthLong(cash.shortfall.month)} — by about {fmt(cash.shortfall.amount)}.</strong>
              {' '}More went out than had come in by then. Check Scheduled for what’s still to come.
            </span>
          ) : (
            <span>
              <strong>On this plan you go short in {formatMonthLong(cash.shortfall.month)} — about {fmt(cash.shortfall.amount)}.</strong>
              {' '}Move a payment, bring dues forward, or plan the gap.
            </span>
          )}
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
              {detail.items.map(item => {
                /* ⚠ THE ROW'S NAME IS WANTED ON BOTH PANELS, for two different reasons: a GROUP's
                    panel leads with it, and a ROW's panel needs it only to notice when a record's
                    words merely echo it. `subjects` is empty on a row's own panel, so its name
                    comes from the title the panel was opened with. */
                const lines = detailLines(item, {
                  subject: (item.row ? detail.subjects[item.row] : undefined) ?? detail.subject,
                  group: detail.subject === undefined,
                });
                return (
                <li key={item.id}>
                  <span className={styles.detailDesc}>
                    {lines.lead}
                    {/* ⚠⚠ THE META LINE IS WHERE THE ANSWER LIVES on half these rows (owner ruling
                        2026-08-24): what a refund repaid, what a drive credited back to that
                        family's dues, how much of an instalment is already covered, why a family
                        was paid back. A record's own `note` REPLACES paid/unpaid rather than
                        queueing behind it — two clauses of housekeeping in front of the one that
                        answers the question is how a meta line stops being read. */}
                    <span className={styles.detailMeta}>{lines.meta}</span>
                  </span>
                  <span className={styles.detailAmt}>{fmt(item.amount)}</span>
                </li>
                );
              })}
              <li className={styles.detailTotal}>
                {/* ⚠ "Possible", NEVER "Total", on a pledge or a pending ask — the one word that
                    stops a coach banking money nobody has agreed to send. `cellPanelSpec` owns it. */}
                <span>{detail.totalLabel}</span>
                <span className={styles.detailAmt}>{fmt(detail.items.reduce((s, i) => s + i.amount, 0))}</span>
              </li>
            </ul>
            <div className={shared.modalFooter}>
              {detail.doors.map(door => (
                <Link
                  key={door.label}
                  href={moneySectionHref(base, door.section, door.extra)}
                  className={shared.btnSecondary}
                >
                  {door.label}
                </Link>
              ))}
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
