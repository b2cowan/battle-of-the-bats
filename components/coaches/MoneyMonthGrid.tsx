'use client';
import { Fragment, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight, X, CalendarClock } from 'lucide-react';
import CoachScrollX from '@/components/coaches/CoachScrollX';
import {
  buildBandCashFlow, lensCell, lensTotal, lensUndated, lensReadsPlan, balanceShowsMonth,
  categoryHasFigure, hasUndated, isPayoutCategory, cellPanelSpec, panelRowWords, UNDATED_CELL,
  bandTotalLabel, revenueGroupLabel, revenueGroupOf, RETURNED_BAND_LABEL, RETURNED_TOTAL_LABEL,
  formatMonthBare, monthYearBands, MONTH_WINDOW, formatMonthLong, MONEY_LENSES, lensReadsSpendingGrid, scheduledForward,
  type MonthGrid, type MonthKey, type MoneyLens, type GridPlanLine, type GridLineResult,
  type GridCategoryResult, type MoneyRowDirection, type PanelDoor, type PanelSubject,
  type RevenueGroupKey,
} from '@/lib/coach-budget-months';
import { fmtCompact, fmt as fmtSignedAmount } from '@/lib/coach-money-summary';
import { moneySectionHref } from '@/lib/coach-money-links';
import { toggleKey } from '@/lib/toggle-key';
import shared from '@/app/[orgSlug]/coaches/coaches.module.css';
import styles from './MoneyMonthGrid.module.css';

export type { MoneyLens };

/**
 * The Showing vocabulary LIVES IN THE LIB NOW (`lib/coach-budget-months.ts`, moved 2026-09-02 with
 * the fifth reading) so it is testable under plain `node --test` and readable by the check
 * scripts. Re-exported here because every existing consumer imports it from this component.
 *
 * The five words and what each means — Budget is the plan, Scheduled is what the team is
 * currently obligated to pay (past due included), **Cash** (id `actual`) is money that moved,
 * **Season spending** is what the season spent whoever paid, Difference is plan against spending.
 */
export { MONEY_LENSES };

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
/* Re-exported, not redefined — the number lives in the lib now so the Budget tab's by-period grid
   reads the same one. Every existing consumer imports it from here. */
export { MONTH_WINDOW };

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
  /**
   * The RETURNED band — money handed back to families (owner ruling 2026-09-02).
   *
   * ⚠⚠ IT IS NOT PART OF `monthGrid` ANY MORE, and that is the whole change. A payout is never
   * spending: it is revenue going back out, or cash settling a cost the season already counted the
   * day it was incurred. The reasoning — including why it can never be routed to the two — lives
   * beside `PAYOUT_CATEGORY_ID` in `lib/coach-budget-months.ts`.
   *
   * ⚠ RENDERS ON **ACTUAL ONLY**. It has no plan and no schedule, so on Difference it was printing
   * a red figure against a budget that cannot exist.
   * ⚠ IT IS STILL SUBTRACTED BY THE CLOSING BALANCE — it left `Total expenses`, not the season.
   */
  returnedGrid: MonthGrid;
  /**
   * The SEASON-SPENDING band (owner D1, 2026-09-02) — the Statement's expense half by month:
   * `buildMonthGrid` over the route's already-flattened statement movements, on the same month
   * domain and the same plan rows as the expenses band. Its `actual` cells hold spending (a cost
   * the day it was incurred, whoever paid; money back netted in as negatives), so its grand total
   * IS `totalActual` — the Headroom banner's "spent" — to the cent, guarded by
   * `check:money-report`.
   *
   * ⚠ IT ALSO FEEDS **DIFFERENCE** (Q3, ruled 2026-09-02): plan against SPENDING, which is what
   * makes that lens finally tie to Headroom and the Statement's variance column exactly.
   */
  spendingGrid: MonthGrid;
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
  lens: lensChoice,
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
  const { monthGrid: grid, revenueGrid, returnedGrid, spendingGrid, cellDetails, cashOnHand, todayMonth } = data;
  /* ⚠⚠ THE DEPLOY-SKEW BELT (review finding, 2026-09-02). The type says `spendingGrid` is always
     sent — and the live route always sends it — but a payload fetched across a deploy boundary
     (fresh client, stale response) can genuinely lack it, and `difference` is a PRE-EXISTING saved
     preference: without this guard the crash would land on coaches who chose nothing new, as a
     full-page error on the portal's most-read money screen. Degrade instead, for the seconds the
     skew lasts: a `spending` choice renders as Cash (never cash figures under a Season-spending
     heading), and Difference falls back to the cash grid — the exact pre-Q3 basis it always had. */
  const lens: MoneyLens = spendingGrid || lensChoice !== 'spending' ? lensChoice : 'actual';
  /* ⚠⚠ WHICH GRID THE EXPENSES BAND READS IS THE LENS'S CALL (D1 + Q3, 2026-09-02). Cash reads the
     cash grid; **Season spending and Difference read the spending grid** — same plan rows, same
     month domain, but the `actual` cells hold the Statement's movements, which is what makes
     Difference tie to Headroom. Budget and Scheduled keep the cash grid (their fields are
     identical across the two by construction — same lines, same scheduled feed).
     ⚠ THE PREDICATE IS THE LIB'S (`lensReadsSpendingGrid`) — the export asks the same question,
     and two spellings of one band-selection rule is the `hasUndated` drift replayed. */
  const expensesBand = lensReadsSpendingGrid(lens) && spendingGrid ? spendingGrid : grid;
  /** The Season-spending lens is EXPENSES ONLY (owner D1): a cheque back to a family is
   *  settlement, not spending, and revenue is the other half of a question this lens is not
   *  answering. No revenue band, no returned band, no balance rows. */
  const spendingOnly = lens === 'spending';
  /* ⚠ THE BAND IS ACTUAL-ONLY *AND* ONLY WHERE IT HAS SOMETHING TO SAY. A team that has never handed
     a family money back gets no heading, no row and no subtotal — three rows of nothing on the
     narrowest table in the portal. `categoryHasFigure` is the same predicate the revenue band and
     the export use, so the screen and the file cannot disagree about whether the band exists. */
  const showReturned = lens === 'actual'
    && returnedGrid.categories.some(c => categoryHasFigure(c.total, lens));
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
  /**
   * WHAT MAKES UP A PLAN FIGURE — the Budget lens's answer to the same tap every other lens answers
   * (owner ruling 2026-09-04, QA §132).
   *
   * ⚠⚠ THIS WAS "Which line's dates?", AND IT ONLY OPENED FOR A ROW STANDING FOR TWO OR MORE LINES.
   * That is the defect the owner found: one underline, styled identically everywhere, meant THREE
   * different things on this table — open a panel (Cash/Scheduled/Spending), jump straight to the
   * budget form (a plan row with one line), or open this chooser (a plan row with two). Nothing on
   * screen told a coach which they would get, and category rows and the whole revenue band were
   * simply dead under Budget. Now every plan figure opens this, and the edit door lives INSIDE it —
   * so the chooser's old job is just the case where the list has more than one row.
   */
  const [plan, setPlan] = useState<{ title: string; when: string; figure: number | null; lines: GridPlanLine[] } | null>(null);

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
  /* Bands follow the WINDOW, so stepping the months re-groups them — a band describes what is on
     screen, not the season. */
  const bands = monthYearBands(view);

  /* ⚠ THE COLUMN APPEARS ONLY WHERE IT CAN HOLD SOMETHING (owner ruling 2026-08-21) — but the
     rule is now enforced on the FIGURE rather than on the lens's name. Undated money used to be
     plan money and nothing else; the Scheduled forward view gave it a sponsor PLEDGE and a club
     request awaiting an answer (owner ruling 2026-08-23), which have no date because nothing
     records when they land. Hiding the column under Scheduled would leave that money in the Total
     and nowhere a coach can see it. */
  /* ⚠ THE RETURNED BAND IS IN THE LIST even though a cheque always has a day. The column's rule is
     "it appears only where it can hold something", enforced on the FIGURE — asking every band is
     what keeps that true if a future kind of return ever arrives undated.
     ⚠ ON SEASON SPENDING only its own band answers: the others do not render there, and a column
     held open by a band the coach cannot see would be a header over nothing. */
  const showUndated = spendingOnly
    ? hasUndated([spendingGrid], lens)
    : hasUndated([revenueGrid, expensesBand, returnedGrid], lens);

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
  /* ⚠⚠ THE RETURNED BAND IS PASSED IN, NOT ADDED HERE. It left `Total expenses` and did not leave
     the season — every cheque written to a family is still money out of the account. The helper
     owns that subtraction so this screen and the export cannot answer differently. */
  /* ⚠ NO BALANCE ROWS ON DIFFERENCE — and none on SEASON SPENDING either (owner D1): that lens is
     the Statement's expense half, and a balance over half a statement would be an invented figure. */
  const cash = useMemo(
    () => (lens === 'difference' || lens === 'spending'
      ? null
      : buildBandCashFlow(revenueGrid, grid, lens, cashOnHand, opening ?? 0, returnedGrid)),
    [grid, revenueGrid, returnedGrid, lens, cashOnHand, opening]);

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
  /* ⚠ NO PAYOUT EXCEPTION HERE ANY MORE (2026-09-02). This filter used to carry "…unless it is the
     payouts group", which was the band's Actual-only rule living inside another band's row list.
     The payouts are their own band now and answer that question for themselves. */
  const visibleExpenses = expensesBand.categories;
  /** The returned band's own rows — the one group inside it, when it has money under this lens. */
  const visibleReturned = useMemo(
    () => returnedGrid.categories.filter(c => categoryHasFigure(c.total, lens)),
    [returnedGrid, lens]);

  function toggle(key: string) { setExpanded(prev => toggleKey(prev, key)); }

  /**
   * Every record behind ONE cell, filtered to a row when the coach tapped an item's figure.
   *
   * ⚠ THE FILTER IS THE WHOLE MECHANISM (D-2, 2026-08-24). A category's list and its rows' lists are
   * the same records read at two grains — so an item panel narrows the category's list by `row`
   * rather than reading a second map. There is no second map to disagree with.
   */
  function cellItems(kind: 'actual' | 'scheduled' | 'spending', categoryKey: string, when: string, row?: string) {
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

  function openDetail(kind: 'actual' | 'scheduled' | 'spending', cat: PanelCategory, when: string, row: PanelRow) {
    const items = cellItems(kind, cat.categoryKey, when, row?.key);
    if (items.length === 0) return;
    /* ⚠ A SPENDING cell's panel takes the ACTUAL spec — same words, same one Ledger door: the
       records behind it are the statement's own costs and refunds, and Transactions is their book. */
    const spec = cellPanelSpec({ group: cat.group, payout: cat.payout }, kind === 'spending' ? 'actual' : kind, row?.subject ?? null);
    /* A GROUP's panel names each record's own row; a row's panel does not, because its title
       already did. Built from the band this category belongs to, so a family removed from the
       roster mid-season still resolves through the row her money left behind. */
    const subjects: Record<string, string> = {};
    if (!row) {
      /* ⚠⚠ THREE BANDS TO LOOK IN, NOT TWO — and getting this wrong is SILENT (found in review,
         2026-09-02). When the payouts group moved to its own band, this still resolved every
         non-revenue category against the expenses band, so the lookup found nothing and every
         record in the group's panel lost its family name. It could not fail loudly: a payout event
         deliberately carries `description: ''` (see `coach-cash-strip.ts`) precisely BECAUSE the
         name is expected to come from here, so an empty map reads as "these records have nothing
         to say for themselves" rather than as a broken lookup. The panel still opened, still
         totalled correctly, and simply stopped saying who the money went to. */
      const band = cat.group ? revenueGrid : cat.payout ? returnedGrid : expensesBand;
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
   * What a MONEY cell does when a coach taps it — the twin of `planPanel` above, for the lenses
   * that hold records rather than a plan.
   *
   * ⚠ NOTHING PRETENDS TO BE TAPPABLE. The affordance appears only where the payload actually has
   * records behind that cell — the defect two of this grid's own affordances shipped with was a
   * control that looked live and silently did nothing.
   */
  function drill(cat: PanelCategory, when: string, row: PanelRow) {
    // Spending cells open too (D1) — their records live under the `spending|…` keyspace.
    if (lens !== 'actual' && lens !== 'scheduled' && lens !== 'spending') return {};
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
   * What a PLAN figure does when a coach taps it — the Budget lens's twin of `drill`, and the same
   * promise: the tap DESCRIBES the number, it never navigates away from it.
   *
   * ⚠⚠ IT USED TO NAVIGATE, and that was the whole finding (owner, QA §132, 2026-09-04). A plan cell
   * jumped to the budget form, so the one underline on this table meant "show me what's behind this"
   * on three lenses and "take me somewhere else" on the fourth. The edit door still exists — it is
   * now a door inside the panel, one tap further away, which is the price of the underline meaning
   * one thing everywhere.
   *
   * ⚠ THE ROW IS AN ITEM AND MAY STAND FOR TWO BUDGET LINES (owner ruling 2026-08-15). That is no
   * longer a special case with its own modal; it is simply a list with two rows in it. Never guess
   * which line a coach meant — the old bug where both cells handed the budget page the composite ROW
   * id, found nothing and returned silently, is impossible now: every door is built from a real
   * `GridPlanLine.id`.
   *
   * ⚠ NOTHING PRETENDS TO BE TAPPABLE. No plan lines behind the figure — a spend-only row, or a
   * revenue group whose plan is a dues schedule rather than a budget line — and no affordance
   * appears, exactly as on the record lenses.
   */
  function planPanel(
    who: string, lines: GridPlanLine[], when: string, figure: number | null,
  ): { onClick?: () => void; title?: string } {
    if (lines.length === 0) return {};
    return {
      onClick: () => setPlan({ title: who, when, figure, lines }),
      title: when === UNDATED_CELL
        ? `See the budget lines behind ${who} with no date yet`
        : `See the budget lines behind ${who}`,
    };
  }

  /** Every plan line a category stands for, in row order — the category row's answer to the tap. */
  function categoryPlanLines(rows: GridLineResult[]): GridPlanLine[] {
    return rows.flatMap(l => l.planLines ?? []);
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
      {view.map(m => <td key={`${key}-${m}`} className={`${styles.num} ${m === todayMonth ? shared.gridColNow : ''}`} />)}
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
  const bandHeading = (key: string, label: string) => (
    <tr className={styles.bandRow}>
      <th scope="row" className={`${styles.lead} ${styles.bandLead}`}>{label}</th>
      {spacerCells(key)}
    </tr>
  );

  /**
   * A band's closing total, in the lens's own words ("Budgeted revenue", "Scheduled expenses").
   *
   * ⚠ `label` OVERRIDES THE LENS-COMPOSED ONE, for the returned band alone. That band renders on
   * Actual only, so "Total returned" never varies — see `RETURNED_TOTAL_LABEL` for why it is not a
   * third case inside `bandTotalLabel`.
   */
  const bandTotal = (band: MoneyRowDirection, g: MonthGrid, label?: string) => (
    <tr className={`${shared.moneyGridTotal} ${styles.totalRow}`}>
      <th scope="row" className={styles.lead}>{label ?? bandTotalLabel(band, lens)}</th>
      {showUndated && (
        <td className={`${styles.num} ${styles.undated}`}>
          {cellNode(lensUndated(g.totals.undated, lens) || null)}
        </td>
      )}
      {view.map((m, k) => (
        <td key={m} className={`${styles.num} ${m === todayMonth ? shared.gridColNow : ''}`}>
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
              {/* ⚠ THE BUDGET LENS ANSWERS HERE TOO NOW (QA §132). A category row was dead under
                  Budget — `drill` returns nothing for a plan lens — so the one figure a coach most
                  wants explained ("what is the $3,200 of Facilities with no date?") was the one
                  figure that would not open. */}
              {cellNode(Math.abs(catUndated) > 0.005 ? catUndated : null,
                lensReadsPlan(lens)
                  ? planPanel(label, categoryPlanLines(cat.lines), UNDATED_CELL, catUndated)
                  : drill(panelCat, UNDATED_CELL, null))}
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
              <td key={m} className={`${styles.num} ${m === todayMonth ? shared.gridColNow : ''}`}>
                {cellNode(v, {
                  emphasis: lens === 'difference' ? 'signed' : undefined,
                  ...(lensReadsPlan(lens)
                    ? planPanel(label, categoryPlanLines(cat.lines), m, v)
                    : drill(panelCat, m, null)),
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
          /* ⚠ THE ROW'S OWN KEY IS `line.id` — `<categoryKey>|<itemId>`, exactly what the payload
             stamped on each record. Rebuilding it from the parts here would be a second spelling of
             one key, and a panel that quietly resolves to an empty list is how the LAST drill-in on
             this grid broke (a nameless category keyed two ways, silent for weeks). */
          const row = { key: line.id, subject: { id: line.itemId, name: line.description } };
          return (
            <tr key={line.id} className={styles.lineRow}>
              <th scope="row" className={`${styles.lead} ${shared.moneyGridLead}`}>
                <span className={shared.wrap640}>{line.description}</span>
                {/* ⚠⚠ THE ROW-LEVEL "paid by a family" TAG IS GONE (owner ruling 2026-09-04, QA §132)
                    AND MUST NOT COME BACK FROM THE PLAN TEXT, which still describes it (D1,
                    G1-approved 2026-09-02). It fired when ANY record in the row was family-fronted,
                    so a row holding a team-paid cost AND a fronted one was labelled family-paid
                    wholesale — a lie the fixture could not show, because every row in it happened to
                    hold a single record. The fact was never carried here alone and is not lost:
                    each record says "paid by a family" on its own line in the drill-in panel, and the
                    cash sentence above the table itemises the fronted costs BY NAME.
                    ⚠ AND NO SPLIT ROWS, EVER (same ruling): family-fronted and team-paid money share
                    one row, exactly as money back nets into the row it repaid. */}
              </th>
              {showUndated && (
                <td className={`${styles.num} ${styles.undated}`}>
                  {cellNode(Math.abs(lineUndated) > 0.005 ? lineUndated : null, {
                    ...(lensReadsPlan(lens)
                      /* ⚠ NO LONGER GATED ON `canWrite` OR ON THE EXPENSE BAND (QA §132). Reading
                         what a figure is made of is not an edit, so a read-only assistant sees the
                         same panel; and a revenue plan row with real budget lines behind it — a
                         fundraising or other-income line — opens exactly as an expense does. What a
                         revenue GROUP still cannot open is its dues schedule, which is not a budget
                         line: `planPanel` returns nothing when the list is empty. */
                      ? planPanel(line.description, line.planLines ?? [], UNDATED_CELL, lineUndated)
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
                return (
                  <td key={m} className={`${styles.num} ${m === todayMonth ? shared.gridColNow : ''}`}>
                    {cellNode(v, lensReadsPlan(lens)
                      ? planPanel(line.description, line.planLines ?? [], m, v)
                      : drill(panelCat, m, row))}
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
            {/* ⚠⚠ THE YEAR BAND (owner ruling 2026-09-04, QA §133) — this grid was the LAST monthly
                surface still spelling the year into every heading. The Budget tab has grouped them
                under a band since 2026-08-13 (its quarters view too), so two views of one season
                answered "which year is this column?" two different ways, one tab apart.
                ⚠ "No date yet" and Total sit under an EMPTY band on purpose: they belong to no
                year, and labelling them would be a tidy lie in a table whose job is to add up.
                ⚠⚠ THE SPANS ARE LOAD-BEARING AND HAVE NO VISUAL TELL. Get the leading colSpan
                wrong and every year shifts one column while the table still renders perfectly.
                Leading = the name cell plus the undated column when it is showing; trailing =
                Total alone.
                ⚠ Built from the WINDOWED months, never the whole season — a band naming columns
                that are off screen is worse than no band. */}
            {bands.length > 0 && (
              <tr className={styles.yearRow}>
                <th aria-hidden colSpan={showUndated ? 2 : 1} />
                {bands.map(b => (
                  <th key={b.year} scope="colgroup" colSpan={b.span} className={styles.yearBand}>{b.year}</th>
                ))}
                <th aria-hidden />
              </tr>
            )}
            <tr>
              <th className={styles.lead}>Category / line</th>
              {/* ⚠ NO PRIOR-SEASON COLUMN HERE, and it is not an oversight (owner ruling
                  2026-08-21). A bare year at the head of a row of month columns read as a month
                  of THIS season, and it ignored the Showing lens — so under Scheduled it stood
                  last year's budget next to this year's remaining debt and invited a comparison
                  that was not true. Cross-season belongs in its own view. */}
              {showUndated && <th className={`${styles.num} ${styles.undated}`}>No date yet</th>}
              {view.map(m => (
                <th key={m} className={`${styles.num} ${m === todayMonth ? shared.gridColNow : ''}`}>{formatMonthBare(m)}</th>
              ))}
              <th className={`${styles.num} ${styles.totalCol}`}>Total</th>
            </tr>
          </thead>

          <tbody>
            {/* ⚠⚠ TWO BANDS, ONE TABLE — the season's cash statement (owner ruling 2026-08-23).
                Revenue first because that is the order a statement is read and the order the
                arithmetic runs: what came in, what went out, what is left.
                ⚠ EXCEPT ON SEASON SPENDING (owner D1, 2026-09-02), which is ONE band — the
                Statement's expense half by month. No revenue, no returned band, no balances:
                the lens answers "what did the season spend?", and nothing else may ride along. */}
            {!spendingOnly && (
              <>
                {bandHeading('in', 'Revenue')}
                {visibleRevenue.map(cat => renderCategory(cat, 'in'))}
                {bandTotal('in', revenueGrid)}
              </>
            )}

            {/* On the spending lens the lone band takes the lens's own name — a heading reading
                "Expenses" over a total reading "Total spent" would be two vocabularies one inch
                apart. */}
            {bandHeading('out', spendingOnly ? 'Season spending' : 'Expenses')}
            {visibleExpenses.map(cat => renderCategory(cat, 'out'))}
            {bandTotal('out', expensesBand)}

            {/* ⚠⚠ THE THIRD BAND — money returned to families (owner ruling 2026-09-02). It reads
                as a band rather than a row at the foot of Expenses because it is not spending: a
                payout is revenue going back out, or cash settling a cost the season already counted
                the day it was incurred. See `PAYOUT_CATEGORY_ID` for the full reasoning, including
                why it can never be split between those two readings.

                ⚠ ACTUAL ONLY, and it is a defect fix as much as a preference: this group has no
                plan, so under Difference it printed `0 − 195 = −195` in the colour the grid uses
                for bad news — "over budget" against a budget that cannot exist.

                ⚠ IT SITS ABOVE THE BALANCE ROWS BECAUSE IT IS PART OF THEM. Everything between the
                first heading and Opening balance is what moved; the closing figure subtracts this
                band exactly as it always did. */}
            {showReturned && (
              <>
                {bandHeading('returned', RETURNED_BAND_LABEL)}
                {visibleReturned.map(cat => renderCategory(cat, 'out'))}
                {bandTotal('out', returnedGrid, RETURNED_TOTAL_LABEL)}
                {/* ⚠ ONE ROW SAYING VENDORS + FAMILIES = CASH OUT (owner D5.9, 2026-09-02). The
                    returned band's split means `Total expenses` no longer states everything that
                    left the account; this row does, from the SAME assembly the balance rows read
                    (`buildBandCashFlow`), so it cannot disagree with them. It renders only where
                    the two figures genuinely differ — with no returned band it would restate
                    `Total expenses` immediately below itself. */}
                {cash && (
                  <tr className={shared.moneyGridFlow}>
                    <th scope="row" className={styles.lead}>Total cash out</th>
                    {showUndated && (
                      <td className={`${styles.num} ${styles.undated}`}>
                        {cellNode(cash.undated.moneyOut || null)}
                      </td>
                    )}
                    {cash.rows.slice(start, start + MONTH_WINDOW).map(r => (
                      <td key={r.month} className={`${styles.num} ${r.month === todayMonth ? shared.gridColNow : ''}`}>
                        {cellNode(r.moneyOut || null)}
                      </td>
                    ))}
                    <td className={`${styles.num} ${styles.totalCol}`}>
                      {cellNode(cash.totalMoneyOut)}
                    </td>
                  </tr>
                )}
              </>
            )}

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
                    <td key={r.month} className={`${styles.num} ${r.month === todayMonth ? shared.gridColNow : ''}`}>
                      {/* ⚠ A MONTH STILL AHEAD HAS NO ACTUAL BALANCE — see `balanceShowsMonth`. */}
                      {cellNode(balanceShowsMonth(lens, r.month, todayMonth) ? r.opening : null, { emphasis: 'negative' })}
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
                    <td key={r.month} className={`${styles.num} ${r.month === todayMonth ? shared.gridColNow : ''}`}>
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
                    <td key={r.month} className={`${styles.num} ${r.month === todayMonth ? shared.gridColNow : ''}`}>
                      {/* Same rule as Opening — and `Net for the month` above already went quiet here. */}
                      {cellNode(balanceShowsMonth(lens, r.month, todayMonth) ? r.running : null, { emphasis: 'negative' })}
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
        {/* ⚠⚠ REWRITTEN WITH THE THIRD BAND (owner ruling 2026-09-02). The old copy said expenses
            were "bills paid, payments to the club, and money paid back to families", and closed by
            promising a family-fronted cost "lands here the day you pay that family back" — both
            sentences described the arrangement this change ended. Leaving either would have been the
            demo-drift failure happening on the product itself: every figure right, the sentence
            underneath quietly false. */}
        {/* ⚠⚠ THE THREE REWRITTEN BASIS NOTES ARE THE G1 GATE MOCKUP'S, VERBATIM (approved
            2026-09-02) — each shows only under its own reading. */}
        {lens === 'actual' && (
          <p className={styles.note}>
            <strong>Cash is money that moved.</strong> Revenue is every dollar that arrived — dues,
            fundraising and sponsor money received, income and money back you recorded, and anything
            the club sent. <strong>Expenses are what you paid vendors.</strong> A cost a{' '}
            <strong>family paid a vendor directly</strong> is season spending, not cash — flip to{' '}
            <strong>Season spending</strong> to see it. Money you hand back to a family is your cash,
            but it isn’t spending, so it has its own band below.
          </p>
        )}
        {lens === 'spending' && (
          <p className={styles.note}>
            <strong>Season spending is what the season spent</strong> — the Statement, month by month.
            A cost counts the day it happened, <strong>whoever paid it</strong>; a family-paid cost is
            here, tagged. Money back subtracts from the cost it repaid. Cheques you write back to
            families aren’t spending — flip to <strong>Cash</strong> for what your money did.
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
        {/* The other half of the provenance (owner D5.10, 2026-09-02): a season with NO opening
            balance says so, pointing a wrong bank tie-out at its likeliest cause instead of
            leaving a coach to discover the assumed zero by arithmetic. */}
        {opening === null && lens !== 'scheduled' && (
          <p className={styles.note}>
            <strong>No opening balance is set</strong> — the balance rows assume the season started
            from $0. If the team was already holding money on day one, set it in{' '}
            <strong>Team settings → Money</strong>.
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
        {/* ⚠ THE BANNER'S FIGURE, DERIVED OUT LOUD (owner walk feedback, 2026-09-02: the forward
            stat linked here and its number appeared nowhere on this screen). Same helper as the
            banner (`scheduledForward`), so the sentence and the headline cannot disagree; it only
            renders when the two figures genuinely differ — with nothing "possible", the Closing
            balance IS the banner's number and a derivation would explain a gap that isn't there. */}
        {lens === 'scheduled' && cash && (() => {
          const fwd = scheduledForward(revenueGrid, grid, returnedGrid, cashOnHand, opening);
          if (fwd.possible <= 0.005) return null;
          return (
            <p className={styles.note}>
              {/* ⚠ `fmtSignedAmount`, not the sign-stripping local `fmt` — a season can END short,
                  and a negative ending printed as a plain positive would be the exact confusion
                  this sentence exists to remove. */}
              The Closing balance ends the season at <strong>{fmtSignedAmount(fwd.ending)}</strong>;
              take back out the {fmt(fwd.possible)} that’s only possible — the pledges and pending
              asks under <strong>No date yet</strong> — and on what’s certain you end with{' '}
              <strong>{fmtSignedAmount(fwd.headline)}</strong>, the banner’s forward figure.
            </p>
          );
        })()}
        {lens === 'budget' && (
          <p className={styles.note}>
            <strong>Budget is your plan</strong>, not your bills — the dues installments you set,
            your expected funding, and the months you gave your costs.
            {showUndated && ` ${fmt(lensUndated(grid.totals.undated, lens) + lensUndated(revenueGrid.totals.undated, lens))} with no date yet is in the Total and in no month.`}
          </p>
        )}
        {/* ⚠ REWRITTEN FOR Q3 (ruled 2026-09-02): Difference compares plan against SPENDING now,
            which is why it can finally claim Headroom by name. The G1 mockup's copy, verbatim. */}
        {lens === 'difference' && (
          <p className={styles.note}>
            <strong>Difference is your plan against what the season spent</strong>, for months that
            have already happened — it matches Headroom exactly. A positive figure is good news on
            both bands: revenue that <strong>came in ahead</strong>, or spending that came in{' '}
            <strong>under</strong>. A month still ahead shows “—”.
          </p>
        )}
        {/* ⚠⚠ THIS NOTE USED TO SAY THE OPPOSITE, and it was the THIRD copy of one stale claim
            (2026-08-21): the same sentence lived in a code comment, in this component’s own cell
            logic, and here in front of the coach. Spending now lands on the item row it names — so
            the line telling a coach to expect a dash was the last thing still asserting the old
            behaviour, and the most expensive, because a reader believes it. */}
        {(lens === 'actual' || lens === 'scheduled' || lens === 'spending') && (
          <p className={styles.note}>
            {lens === 'scheduled' ? 'A bill' : 'Spending'} sits on the <strong>item</strong> it names, so a
            category is what its rows add up to. Money recorded without an item sits on that
            category’s <strong>Not itemized</strong> row. Tap a <strong>category’s</strong> figure to see
            what makes it up.
          </p>
        )}
        {/* ⚠⚠ THE TWO TRUTHS, NAMED (owner ruling 2026-08-23). Months is CASH and the Statement is
            the season's spending, so their Total expenses can differ — and the coach who spots that
            gap deserves to be told why by the screen rather than by support. The three causes are
            listed because "they use different bases" answers nothing a treasurer can check. */}
        {/* ⚠⚠ THE FIRST CAUSE STOPPED BEING TRUE ON 2026-09-02 AND THE SENTENCE DID NOT NOTICE.
            It read "this view adds money paid back to families" — which is exactly what the returned
            band ended: those cheques are no part of Total expenses any more. A note explaining a gap
            by naming a cause that no longer exists is worse than no note, because a treasurer
            reconciling by hand will look for an adjustment that isn't there. Two causes now, and the
            band is named as the third thing the reader can see rather than as an adjustment. */}
        {lens === 'actual' && (
          <p className={styles.note}>
            Total expenses here can differ from the <strong>Statement</strong>’s and{' '}
            <strong>Season spending</strong>’s: this view leaves out costs a family paid a vendor
            directly, and shows money back as revenue instead of subtracting it from the cost it
            repaid. Money you return to families is in its own band — counted in your balance, never
            in Total expenses.
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
                  {/* ⚠ THE ACCOUNTING BRACKETS, not `fmt` — a spending cell's panel lists the
                      refund that netted into it as a NEGATIVE line, and the local formatter's
                      stripped sign would have printed money coming back as money spent
                      (2026-09-02, with the spending lens). Positive amounts render unchanged. */}
                  <span className={styles.detailAmt}>{fmtSignedAmount(item.amount)}</span>
                </li>
                );
              })}
              <li className={styles.detailTotal}>
                {/* ⚠ "Possible", NEVER "Total", on a pledge or a pending ask — the one word that
                    stops a coach banking money nobody has agreed to send. `cellPanelSpec` owns it. */}
                <span>{detail.totalLabel}</span>
                <span className={styles.detailAmt}>{fmtSignedAmount(Math.round(detail.items.reduce((s, i) => s + i.amount, 0) * 100) / 100)}</span>
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

      {/* WHAT MAKES UP A PLAN FIGURE (owner ruling 2026-09-04, QA §132).
          ⚠⚠ THIS PANEL REPLACED "Which line's dates?", which opened ONLY on a row standing for two
          or more budget lines. Every other shape of plan figure either jumped to the budget form or
          did nothing at all, which is how one underline came to mean three things on one table. Now
          it is the single answer for every plan figure — category or item, revenue or expense — and
          the two-line case is simply a list with two rows in it.
          ⚠ READ-ONLY, LIKE ITS TWIN. The panel opens for everyone; only the DOORS are gated on
          write access, so an assistant reads the same explanation without being shown controls the
          server would refuse. */}
      {plan && (
        <div className={`${shared.modalOverlay} ${shared.centeredOnMobile}`} onPointerDown={e => { if (e.target === e.currentTarget) setPlan(null); }}>
          <div className={shared.modal} style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
            <div className={shared.modalHeader}>
              <h3 className={shared.modalTitle}>
                {plan.title} · {plan.when === UNDATED_CELL ? 'no date yet' : formatMonthLong(plan.when)}
              </h3>
              <button className={shared.modalCloseBtn} onClick={() => setPlan(null)} aria-label="Close"><X size={16} /></button>
            </div>
            {/* The figure the coach actually tapped, said back to them before the breakdown — the
                panel is explaining THIS number, and a list that opens without it makes the reader
                check they are still looking at the right cell.

                ⚠⚠ THE WORD FOLLOWS THE LENS, and it used to say "planned" unconditionally
                (adversarial review, 2026-09-04). Under DIFFERENCE a month cell is not plan money at
                all — it is plan MINUS spending, and it goes negative — so an over-budget cell read
                "($150) planned", describing a gap as if it were budget.

                ⚠⚠ AND THAT CORRECTION OVER-SHOT, WHICH IS THIS LINE'S SECOND FIX (`/review`,
                2026-09-04). It keyed on the LENS when the rule is per COLUMN. `lensUndated` returns
                the raw BUDGET for the "no date yet" column under BOTH plan lenses — deliberately,
                because a difference on undated money compares nothing to nothing — so under
                Difference that cell opened a panel reading "$3,200.00 difference — plan against what
                the season has spent" over a figure with nothing netted against it. A coach reads a
                plain budget total as an overspend. The word follows the CELL: the undated column is
                always plan money, whatever lens is on. */}
            {plan.figure != null && (
              <p className={styles.chooserSub}>
                <strong>{fmt(plan.figure)}</strong>{' '}
                {lens === 'difference' && plan.when !== UNDATED_CELL
                  ? 'difference — plan against what the season has spent'
                  : 'planned'}
              </p>
            )}
            <ul className={styles.chooserList}>
              {plan.lines.map(l => {
                const body = (
                  <>
                    <span className={styles.chooserWho}>
                      {l.description}
                      <span className={styles.chooserWhen}>{whenLine(l)}</span>
                    </span>
                    {/* ⚠ THE LINE'S WHOLE-SEASON TOTAL — see the footer. */}
                    <span className={styles.chooserAmt}>{fmt(l.amount)}</span>
                  </>
                );
                return (
                  <li key={l.id}>
                    {canWrite ? (
                      // ?periods=1 opens the payment-date split even on a line that is currently a
                      // lump sum — the coach was looking at a month grid, so dates are what they
                      // came for.
                      <Link
                        href={moneySectionHref(base, 'budget', { line: l.id, periods: '1' })}
                        className={styles.chooserChoice}
                        onClick={() => setPlan(null)}
                        title={`Edit ${l.description}’s payment dates`}
                      >
                        {body}
                      </Link>
                    ) : (
                      <span className={styles.chooserChoice}>{body}</span>
                    )}
                  </li>
                );
              })}
            </ul>
            {/* ⚠⚠ THIS USED TO CLAIM THE LINES *MAKE UP* THE TAPPED FIGURE, AND THAT IS FALSE
                (adversarial review, 2026-09-04). The figure is one COLUMN's slice — April's share, or
                the undated share — while a line carries its WHOLE-SEASON total and may be spread over
                several months; a category row's panel lists every item in the category besides. So
                "$1,734" would open a list reading "$5,200" beside a sentence insisting they were the
                same money. The figures are right; the claim was not. The panel now says what the
                amounts ARE and asserts no arithmetic a reader can disprove in their head.
                ⚠ IF THIS EVER NEEDS A MONTH'S SHARE PER LINE, that is a payload change —
                `GridPlanLine` carries a season total and a list of dates, and no per-month split.
                Do not fake it by dividing. */}
            <p className={styles.chooserFoot}>
              {plan.lines.length === 1
                ? 'Amount shown is this line’s whole-season total.'
                : `${plan.lines.length} budget lines are shown as one row. Amounts are each line’s whole-season total, not this column’s share.`}
              {canWrite ? (plan.lines.length === 1
                ? ' Open it to change its payment dates.'
                : ' Open one to change its payment dates.') : ''}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
