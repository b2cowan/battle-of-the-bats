'use client';
import { useState, useEffect, useCallback, useMemo, useRef, use, Fragment } from 'react';
import { useSearchParams } from 'next/navigation';
import { BarChart3, Plus, X, ChevronDown, ChevronRight, AlertTriangle, Settings2 } from 'lucide-react';
import { useCoaches, useCoachSeasonPage } from '@/lib/coaches-context';
import { useOverlayOpen } from '@/lib/coaches-overlay';
import BudgetItemPicker from '@/components/accounting/BudgetItemPicker';
import MoneySummaryBand from '@/components/coaches/MoneySummaryBand';
import BudgetStarterSheet from '@/components/coaches/BudgetStarterSheet';
import SampleBudgetSheet from '@/components/coaches/SampleBudgetSheet';
import BudgetImportSheet from '@/components/coaches/BudgetImportSheet';
import { toKnownCategories } from '@/lib/coach-budget-import';
import BudgetItemManagerModal from '@/components/coaches/BudgetItemManagerModal';
import RowEditButton from '@/components/coaches/RowEditButton';
import { monthKeyOf, monthYearBands, periodRangeLabel, MONTH_WINDOW } from '@/lib/coach-budget-months';
import ColumnPager from '@/components/coaches/ColumnPager';
import SublinedChoice from '@/components/coaches/SublinedChoice';
import { todayLocal } from '@/lib/measurable-format';
import {
  rollupBudget, categoryGroupOf, groupByCategory, groupByItem,
  type CategoryGroupRef,
} from '@/lib/coach-budget-rollup';
import { useBumpMoneyRevision, useOnMoneyRevisionBump } from '@/lib/coach-money-refresh';
import {
  BUDGET_PLAN_COLUMNS, budgetPlanStatementRows, budgetPeriodGridColumns, budgetPeriodGridRows,
  formatMoneyCell, type MoneyExportFormat,
} from '@/lib/coach-money-exports';
import { moneySectionHref } from '@/lib/coach-money-links';
import MoneyExportButton from '@/components/coaches/MoneyExportButton';
import { fmtCompact } from '@/lib/coach-money-summary';
import { toggleKey } from '@/lib/toggle-key';
import {
  computeBudgetTotals, PLAN_LADDER_LABEL, budgetLineKindForItem,
  isFundingKind,
  type BudgetLineKind, type BudgetItemActualSource,
} from '@/lib/coach-budget-totals';
import { newMoneyInWordNote } from '@/lib/coach-budget-totals';
import {
  buildPeriodView, whenSummary, mergedSubLineName, GRANULARITY_LABEL, PERIOD_GRANULARITIES, UNSCHEDULED,
  type PeriodGranularity,
} from '@/lib/coach-budget-periods-view';
import SingleSelectDropdown from '@/components/coaches/SingleSelectDropdown';
import {
  PERIOD_SPLIT_MODES, SPLIT_MODE_LABEL, SPLIT_MODE_NOUN, SPLIT_MODE_STEP_TWO, SPLIT_MODE_COLUMN,
  blankPeriod, nextPeriodDate, fillSeasonPeriods, inferSplitMode, resolvedPeriodLabel,
  evenShares, refitSplit,
  derivedPeriodLabel, splitYears, readDate, monthDate, quarterDate, quarterOf,
  type PeriodSplitMode,
} from '@/lib/coach-budget-period-modes';
import CoachEmptyState from '@/components/coaches/CoachEmptyState';
import type {
  RepBudgetPlan,
  RepBudgetLineWithPeriods,
  BudgetCategoryWithItems,
  BudgetItemDirection,
} from '@/lib/types';
import DateField from '../DateField';
import GenerateInstallmentsModal from '../GenerateInstallmentsModal';
import styles from './budget.module.css';
import CoachLoadError from '@/components/coaches/CoachLoadError';
import CoachLoading from '@/components/coaches/CoachLoading';
import shared from '../../../../coaches.module.css';
import CoachModalHeader from '@/components/coaches/CoachModalHeader';
import CoachScrollX from '@/components/coaches/CoachScrollX';
import UnsavedChangesGuard from '@/components/shared/UnsavedChangesGuard';
import { useDiscardGuard } from '@/components/coaches/useDiscardGuard';
import { useLatestRef } from '@/components/coaches/useLatestRef';
import { tournamentToday } from '@/lib/timezone';

/**
 * ⚠⚠ THE FORM ASKS ONE QUESTION NOW, NOT TWO (mig 280, owner-approved mockup 3913e207).
 *
 * It used to ask "This line is: Expense / Expected fundraising / Expected sponsorship / Expected
 * other income" and THEN "Category & Item". The item picker filters by DIRECTION and never by the
 * kind just chosen, so the two answers could contradict each other and the form allowed it —
 * *Expected sponsorship* with *Tournaments → Concession revenue* is offerable today. That is a
 * trap, not untidiness: the kind decides where the row's ACTUAL comes from, a sponsorship line
 * takes its actual from sponsor arrivals and refuses a typed income record (deliberately, so the
 * same dollar is never counted twice), and the coach ends up with a budget line they can never
 * record their concession takings against, with nothing on screen explaining why.
 *
 * Measured across every money-in budget line on dev AND prod on 2026-09-07: all of them already
 * used the obvious pairing. The second question never carried information; it only ever carried
 * the chance to get it wrong.
 *
 * ⚠ THE THREE SOURCES ARE NOT REMOVED, only moved. "A drive reports it", "a sponsor reports it"
 * and "the coach types it" stay three different things — player rebates and the derived pools
 * depend on it (owner ruling 2026-08-16) — and the stored `line_kind` is still written on every
 * row. What changed is WHERE the answer is declared: it is now a property of the word the coach
 * picks, so it cannot disagree with itself. See `budgetLineKindForItem`.
 *
 * ⚠ A DROPDOWN, NOT TWO RADIO ROWS (owner ruling 2026-09-07, confirming 2026-08-22). The approved
 * mockup drew radios; the standing convention is that a field picking one value is a dropdown, and
 * radio-rows-with-sub-lines are reserved for a choice that CANNOT be changed afterwards. A budget
 * line's direction is correctable forever, so it does not qualify — and two radio rows cost ~90px
 * above every other field on a phone.
 */
const DIRECTION_ANSWERS: { value: BudgetItemDirection; name: string; sub: string }[] = [
  { value: 'out', name: 'Money the team spends', sub: 'Costs and bills' },
  { value: 'in',  name: 'Money coming in',       sub: 'Fundraising, sponsors, anything else' },
];

/**
 * The paragraph under the picker, for the kind the coach's chosen ITEM works out to.
 *
 * ⚠ A RECORD, NOT A TERNARY — and that is the difference between a copy gap and a compile error.
 * This was `lineKind === 'sponsorship' ? … : …`, the exact shape that let a third kind ship while
 * nineteen readers silently filed it as a cost. Keyed exhaustively, a FOURTH kind cannot be added
 * without someone writing its sentence.
 *
 * ⚠ IT IS NOW A CONSEQUENCE, NOT A CAPTION (mig 280). It used to sit under the kind DROPDOWN,
 * explaining the answer the coach had just given. It now sits under the ITEM, and appears once one
 * is chosen — so it reads as "here is what this word means for this line", which is the one thing
 * the old form could never say at the moment it mattered. (Its short sibling `LINE_KIND_LABEL` and
 * the one-line `LINE_KIND_HINT` were deleted with the question: see the headstone in
 * `lib/coach-budget-totals`.)
 */
const KIND_HINT_LONG: Record<BudgetLineKind, React.ReactNode> = {
  cost: null,  // the cost form explains itself — the category picker below it is the explanation
  funding: (
    <>Fundraising lowers what players are asked to pay — a bottle drive, a chocolate sale,
      anything the team raises by selling. Enter what you expect the <strong>team</strong> to keep:
      if a campaign pays part of what a player raises back to that player, that already lowers their
      dues and shouldn&apos;t be counted here.</>
  ),
  sponsorship: (
    <>Sponsorship lowers what players are asked to pay — a business sponsor, a grant,
      anything given directly rather than raised by selling. It is budgeted apart from fundraising
      so <strong>Budget vs. Actual</strong> can tell you whether each hit its number.</>
  ),
  other_income: (
    <>Other income lowers what players are asked to pay — interest, a facility rebate, a
      plain donation: money coming in that nobody raised and no sponsor gave. You record each
      arrival yourself as it lands, the way you record an expense.</>
  ),
};

function fmt(n: number) {
  return `$${Math.abs(n).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function r2(n: number) {
  return Math.round(n * 100) / 100;
}

function today() {
  return tournamentToday();
}

interface PeriodRow { label: string; date: string; amount: string }
const BLANK_PERIOD: PeriodRow = { label: '', date: '', amount: '' };

/**
 * The three answers to "when does this money move?", in the order the coach meets them.
 *
 * `month` and `split` are one storage shape wearing two questions: a month IS a period dated to
 * the 1st, so `month` is simply the split every coach actually wants — one chunk — without the
 * editor. That is deliberate; it means nothing downstream (the report, the month grid, instalment
 * generation) learns a new word, and a line can move between the two answers without a migration.
 */
type WhenAnswer = 'month' | 'split' | 'none';

/** Does this form save periods? `month` does — one of them. Derived, never a second stored flag:
 *  the `usePeriods` boolean this replaced could disagree with the answer beside it, which is the
 *  two-halves-out-of-step defect this file has already shipped twice. */
function usesPeriods(f: Pick<LineForm, 'whenAnswer'>): boolean {
  return f.whenAnswer === 'month' || f.whenAnswer === 'split';
}

/**
 * Reading a saved line back into its answer. No periods = `none`; one period entered as a MONTH =
 * `month`; anything else = `split`.
 *
 * ⚠ THE MODE IS PART OF THE TEST, not just the count. One period in `quarters`, `dates` or `names`
 * mode is a split that happens to have one chunk — reopening it as `month` would silently discard
 * the coach's chosen mode (and, in `dates` mode, the exact day they picked for a reason).
 */
function whenAnswerFor(periods: { date: string }[], mode: PeriodSplitMode): WhenAnswer {
  if (periods.length === 0) return 'none';
  if (mode === 'months' && periods.length === 1) return 'month';
  return 'split';
}

interface LineForm {
  description: string;
  categoryId: string;
  itemId: string | null;
  categoryName: string;
  itemName: string;
  totalAmount: string;
  /**
   * Is this money the team spends, or money it expects to bring in? Asked first, because it
   * changes what every field below it means — and since mig 280 it is the ONLY thing asked about
   * what the line is. The stored kind is worked out from the ITEM (see `formLineKind`).
   */
  direction: BudgetItemDirection;
  /**
   * Who reports the chosen item's actual — carried so the form can show the coach what their word
   * means before they save, and so the derived kind is available without a second lookup.
   *
   * ⚠ NULL IS A REAL STATE, not a missing value: no item chosen yet, or an item the picker's list
   * does not hold (one whose word was deleted, or one belonging to a sport this team no longer
   * plays). The form simply says nothing then; the SERVER derives the stored kind from the row it
   * fetches, so a blank here can never write a wrong kind.
   * ⚠ Deliberately out of `sameLineForm`: it is a property of `itemId`, which is already compared,
   * and a dirty-guard that could fire on a derived field would nag about work nobody did.
   */
  itemActualSource: BudgetItemActualSource | null;
  notes: string;
  /**
   * ⚠⚠ "WHEN DOES THIS MONEY MOVE?" — REQUIRED, AND `null` MEANS UNANSWERED (owner ruling
   * 2026-09-04). It blocks the save exactly as category and item do: one rule, three parts — a
   * line says what it is and when it happens.
   *
   * ⚠ NOTHING IS PRE-SELECTED, and that is the ruling rather than an oversight. The first mockup
   * opened on `month` with a month already highlighted, which makes a plausible-looking date the
   * fastest way OUT of the form — reintroducing, one level up, the exact failure the month grain
   * exists to avoid: a guessed answer is indistinguishable from a known one. `none` stays a real,
   * respectable answer (see §4 of the plan: the undated bucket can never be eliminated, because a
   * season estimate set before any lines exist has no lines to date), so the nudge comes from
   * ORDER and PROMINENCE and never from pre-filling or nagging.
   *
   * ⚠ THIS IS NOT STORED. A line's answer IS its periods — none / one dated month / many — which
   * is what every report already reads. A column recording which answer was picked would let a
   * screen tell "answered no" from "never asked", and no screen wants to: the plan list's fix-it
   * bar and the statement's disclosure sentence both count money that isn't dated, full stop,
   * because their job is "here is what a To date reading leaves out", not "here is what you
   * forgot". See `whenAnswerFor` for the read-back.
   */
  whenAnswer: WhenAnswer | null;
  periodMode: 'amount' | 'percent';
  /** HOW the split is entered — months / quarters / specific dates / just names. Never stored:
   *  the month or quarter the coach picks IS the period's date, so nothing downstream learns a
   *  new word. Re-derived from the saved periods when a line is reopened. */
  splitMode: PeriodSplitMode;
  periods: PeriodRow[];
}

const BLANK_FORM: LineForm = {
  description:  '',
  categoryId:   '',
  itemId:       null,
  categoryName: '',
  itemName:     '',
  totalAmount:  '',
  direction:    'out',
  itemActualSource: null,
  notes:        '',
  whenAnswer:   null,
  periodMode:   'amount',
  splitMode:    'months',
  periods:      [{ ...BLANK_PERIOD }],
};

/** A fresh form, with the split mode the coach used last and the ONE empty period a new split
 *  starts with (owner ruling: one, never zero and never twelve). */
function blankLineForm(seasonYear: number, mode: PeriodSplitMode): LineForm {
  return { ...BLANK_FORM, splitMode: mode, periods: [blankPeriod(mode, seasonYear)] };
}

/** DOM ids for the fields a failed save can jump to. A failed save must MOVE the form — that is
 *  the whole fix for "the button looks broken" — so every blocking field needs a place to land. */
const FOCUS_TOTAL = 'budget-line-total';
const FOCUS_DESC  = 'budget-line-desc';
const FOCUS_ADD   = 'budget-period-add';
/** The item picker's own select — where "pick a category and item" sends a coach (mig 240). */
const FOCUS_ITEM  = 'budget-item-picker';
const FOCUS_WHEN  = 'budget-line-when';

/**
 * The three answers, in the order that does the nudging (owner ruling 2026-09-04). Dating is first
 * and obvious; the exception is last and plain. Both cost exactly one tap — the ordering is the
 * whole of the encouragement, because making the honest answer HARDER to reach is what produces a
 * guessed month, and a guessed month is worse than a gap since the report treats it as fact.
 */
const WHEN_ANSWERS: { id: WhenAnswer; label: string }[] = [
  { id: 'month', label: 'One month' },
  /* ⚠ "periods", NOT "months" (owner ruling 2026-09-05, §145 walk). This answer opens a box
     that splits by month, QUARTER, specific date or name, so "months" named a quarter of what it
     does and told a quarterly budgeter the option was not for them. "Period" is not new jargon:
     the box this reveals is headed "Period Breakdown", its step 2 reads "Add a period for each
     …", and the plan's second view is "By period" — "Split across months" was the odd one out,
     not the word to keep. No customer ever saw the old label: the When question is post-7f21df47. */
  { id: 'split', label: 'Split across periods' },
  /* ⚠ "No date yet", NOT "Not yet known" — ONE SPELLING, and this is the wider word (owner ruling
     2026-09-04). It is what the month grid's column has been called since the same day, and a
     coach who picks an answer has to find their own words in the column it lands in. The column's
     word wins because it also holds a sponsor's pledge and a club ask, which are not budget
     answers at all. Before adding a third phrasing anywhere, grep for both. */
  { id: 'none',  label: 'No date yet' },
];
const focusPeriodAmount = (i: number) => `budget-period-amount-${i}`;

interface FormProblem {
  /** Stable key, also how a field knows to draw itself as at fault. */
  id: string;
  message: string;
  focusId: string;
}

/** A cell's money. The shared compact formatter draws the number; a cell with nothing in it gets
 *  a dash, never $0.00 — a zero and a nothing are different facts. */
function fmtCell(n: number | undefined): string {
  return fmtCompact(n)?.replace('-', '−') ?? '—';
}

/** Money-in cells read POSITIVE (owner 2026-08-13): the green row and its section name say the
 *  direction, and a minus sign made readers re-check arithmetic. The VIEW stays signed — the
 *  grid's totals row is a real subtraction — so the abs happens at the last moment, per cell. */
function fundingCell(kind: BudgetLineKind, n: number | undefined): number | undefined {
  return isFundingKind(kind) && n != null ? Math.abs(n) : n;
}

/**
 * One line of the plan, with its period breakdown underneath.
 *
 * ONE renderer for both kinds. The funding section started as a copy of this markup with a colour
 * class swapped in, which is two places to remember for every future change to a row — a new
 * action, an a11y fix, another field in the period detail. The only thing a funding line does
 * differently is its COLOUR (green = money in): amounts are stored and shown positive for both
 * kinds — the minus sign is gone (owner 2026-08-13: "expenses minus the funding" is intuitive;
 * the section label says the direction, and a sign made readers re-check arithmetic).
 */
/**
 * A line's answer to "when does this money move?", as the plan list paints it.
 *
 * ⚠ TWO INKS, WHICH IS WHY `whenSummary` RETURNS DATA AND NOT A SENTENCE. Undated money is the
 * only actionable thing in this column, so it is the only thing that carries the attention colour
 * — on a line that is entirely undated, and on the undated HALF of a partly-dated one. Everything
 * dated stays quiet. A single string could not be split back apart to paint it.
 *
 * ⚠ ONE SPELLING, THREE SURFACES: "No date yet" here, in the line form's third answer, and as the
 * month grid's column heading. The export says it too, through `whenSummaryText`.
 */
function WhenChip({ line, className, onToggle }: {
  line: RepBudgetLineWithPeriods;
  className?: string;
  /**
   * Fold this line's periods open (owner ruling 2026-09-05).
   *
   * ⚠ THE CHIP IS THE ANSWER TO THE QUESTION THE FOLD ANSWERS, which is the whole reason it got
   * this job. A coach reading "Mar · Nov" wants to know *how much in each* — so the thing that
   * raised the question is the thing to tap, and it is a far bigger target than a 20px chevron.
   *
   * ⚠ A CLICK HANDLER ON A SPAN, DELIBERATELY, NOT A SECOND BUTTON. The chevron stays the one
   * SEMANTIC control — keyboard and screen reader reach the fold through it, and it already
   * carries `aria-expanded` and a real name. A button here would put a second `aria-expanded` on
   * one fold, and an `aria-label` naming the action would REPLACE the chip's own text — which at
   * ≤640 is the only copy of the When answer anywhere on the screen. Same split the row itself
   * already uses: named control for the keyboard, pointer shortcut for everyone else.
   *
   * Passed only when the line HAS a fold — undefined on a one-month or undated line, so the chip
   * never offers to open something that isn't there.
   */
  onToggle?: () => void;
}) {
  const s = whenSummary(line.periods ?? [], Number(line.totalAmount ?? 0) || 0);
  const cls = `${styles.whenChip} ${onToggle ? styles.whenChipTappable : ''} ${className ?? ''}`;
  // Same copy-gesture guard the row carries: a click that ends a text selection is someone
  // lifting a date out of the cell, not asking for the split.
  const onClick = onToggle
    ? (e: React.MouseEvent) => {
      e.stopPropagation();
      if (window.getSelection()?.toString()) return;
      onToggle();
    }
    : undefined;
  if (s.months.length === 0) {
    return <span className={`${cls} ${styles.whenChipNone}`} onClick={onClick}>No date yet</span>;
  }
  return (
    <span className={`${cls} ${styles.whenChipSet}`} onClick={onClick}>
      {s.months.join(' · ')}
      {s.undated > 0.005 && (
        <> · <span className={styles.whenChipPart}>{fmt(s.undated)} no date</span></>
      )}
    </span>
  );
}

function BudgetLineRow({
  line, expanded, funding, canWrite, onToggle, onEdit, hideWhen = false,
}: {
  line: RepBudgetLineWithPeriods;
  expanded: boolean;
  funding: boolean;
  canWrite: boolean;
  onToggle: () => void;
  onEdit: () => void;
  /**
   * Suppress BOTH copies of the schedule on this row — the When cell and the phone chip under the
   * name (owner ruling 2026-09-09, decision B2).
   *
   * ⚠ SET ONLY WHERE THE SCHEDULE HAS BECOME THE NAME. A merged sub-line with no note is titled by
   * its own schedule (`mergedSubLineName`); leaving the cell and the chip in place would print that
   * same answer THREE times on one row. The name IS the When answer, so nothing is lost. A noted
   * sub-line, and every ordinary row, keeps both.
   */
  hideWhen?: boolean;
}) {
  const moneyClass = funding ? styles.fundingAmount : '';
  /* One predicate for "this line has a fold", read by the chevron and by both When chips — they
     must never disagree about whether there is something to open. Same test the chevron already
     used: a single period restates the row above it, so only a real split folds. */
  const canExpand = line.periods.length > 1;
  const foldFromChip = canExpand ? onToggle : undefined;

  /* A line and its expanded periods are siblings inside the category frame — the shared
     `.ledgerRow` draws the rule that separates one line from the next, so no wrapper is needed
     (and a wrapper here would sit between the frame and its rows for no reason). */
  return (
    <>
      {/* The whole row opens the editor for a write coach (owner 2026-08-13) — the pencil stays
          the SEMANTIC control (keyboard, screen reader, and the visible desktop door); the row
          is the pointer/touch shortcut, and on a phone the only visible one. The chevron stops
          propagation so expanding a split line never also opens its form. Delete lives in the
          edit modal now, behind the same confirm as always — one door, full capability inside.

          ⚠⚠ RE-EXAMINED AND KEPT 2026-09-05, and the reasons are worth having here because the
          opposite reading is intuitive: reading a plan is more common than editing it, so why
          doesn't the row fold? Two facts, both about THIS screen:
            1. The fold exists on a MINORITY of rows. A chevron needs two or more periods, so
               "One month" (one) and "No date yet" (none) have nothing to open — and in the coach
               demo's mid-season world every dated line has exactly one period, meaning row-to-fold
               would do nothing at all on the version of this screen a prospect sees. A row that
               ignores a tap is worse than one that does something unasked.
            2. On a phone the pencil is CLIPPED OUT OF THE LAYOUT (its own ruling, so the ledger
               reads clean and the money column reaches the edge). It stays focusable for a keyboard
               and a screen reader, but a thumb cannot see it — so the row is the only edit door a
               phone has. Folding here would leave a coach able to read the plan on their phone and
               unable to change it.
          ⚠ Budget vs. Actual's rows DO fold on a tap, and that screen's comment used to claim it
          was matching this one. It never was. The difference is worklist vs. report — see the note
          on its own row for the full statement. What closed the gap instead is the WHEN CELL below,
          which folds the row without taking the edit door off a phone. */}
      <tr
        className={canWrite ? shared.rowTappable : ''}
        // Selecting text to copy an amount must not open the form — a click that ends a
        // selection is a copy gesture, not a tap (review finding).
        onClick={canWrite ? () => { if (window.getSelection()?.toString()) return; onEdit(); } : undefined}
      >
        <th scope="row" className={`${styles.lead} ${shared.moneyGridLead}`}>
          {/* ⚠ NO EXPANDER ON A ONE-MONTH LINE (2026-09-04). "One month" saves a single period, so
              a lump sum that gained a date would otherwise grow a chevron opening one sub-row that
              restates the row above it — the same empty caption §133 removed from the item rows the
              same week. Two or more chunks still open, because then the sub-rows say something the
              When cell cannot. */}
          {canExpand
            ? (
              <button
                type="button"
                className={shared.moneyGridExpand}
                aria-expanded={expanded}
                aria-label={expanded ? `Hide ${line.description}'s payment periods` : `Show ${line.description}'s payment periods`}
                onClick={e => { e.stopPropagation(); onToggle(); }}
              >
                {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
            )
            : <span className={shared.moneyGridExpandSpacer} />}

          <span className={styles.lineStack}>
            <span className={styles.lineName}>{line.description}</span>
            {line.notes && <span className={`${styles.rowNote} ${shared.wrap640}`}>{line.notes}</span>}
            {/* ⚠⚠ THE PHONE'S ONLY COPY OF THE ANSWER. Below 640 the When column leaves the grid
                entirely (`.schedCell` is display:none and the tracks drop to three), so until
                today a phone said NOTHING about when any of this money moved — on the screen
                whose job is clearing a season's unknowns. A fourth track at 329px would have to
                take room from the line name, which already ellipses, or from the money. The note
                slot is already here, already quiet, and already where a line says something extra
                about itself. */}
            {!hideWhen
              && <WhenChip line={line} className={styles.whenUnderName} onToggle={foldFromChip} />}
          </span>
        </th>

        {/* The When column — was "Schedule" until 2026-09-04, and printed chunk counts over a line
            whose undated half it never mentioned. See `whenSummary` for both defects.
            ⚠ The chip inside it FOLDS THE ROW on a split line (2026-09-05) — see WhenChip. */}
        <td className={styles.schedCell}>
          {!hideWhen && <WhenChip line={line} onToggle={foldFromChip} />}
        </td>

        <td className={moneyClass}>{fmt(line.totalAmount)}</td>

        {/* Always rendered so every row keeps the same four columns. The colgroup fixes the action
            column's width for a write coach, so the money column holds still; a read-only coach
            gets no button and the column collapses uniformly instead. */}
        <td className={shared.ledgerActions}>
          {/* The shared row-edit control (2026-08-15). This screen had the portal's only copy of
              the pencil; the component now carries the markup — crucially the required accessible
              name, which is what a shared CLASS could never enforce. `onPhone="clip"` keeps this
              screen's own ruling: a ledger grid doesn't stack into cards, so the pencil leaves the
              layout at ≤640 and the row is the door. */}
          {canWrite && (
            <RowEditButton
              label={`Edit ${line.description}`}
              title="Edit line"
              onClick={onEdit}
              onPhone="clip"
            />
          )}
        </td>
      </tr>

      {expanded && line.periods.length > 0 && (
        <>
          {line.periods.map((p, i) => (
            <tr key={i} className={styles.periodRow}>
              {/* The period's DATE rides in the name cell, not a column of its own — the outline
                  gave sub-rows their own track set, which a table cannot do. */}
              <th scope="row" className={styles.lead}>
                <span className={shared.wrap640}>{p.periodLabel}</span>
                {p.periodDate && (
                  <span className={styles.periodDate}>
                    {new Date(p.periodDate + 'T00:00:00').toLocaleDateString('en-CA', {
                      month: 'short', day: 'numeric', year: 'numeric',
                    })}
                  </span>
                )}
              </th>
              <td className={styles.schedCell} />
              <td className={moneyClass}>{fmt(p.amount)}</td>
              <td />
            </tr>
          ))}
        </>
      )}
    </>
  );
}

/**
 * The plan read ACROSS time — month or quarter columns, built from the period splits coaches
 * already enter. Read-only by design: this is a way to SEE the plan, and every edit still happens
 * in the list's own form, so there is exactly one place a budget line can be changed.
 */
function PeriodGrid({ view, granularity, monthStart, onMonthStart, closed, onToggle }: {
  view: ReturnType<typeof buildPeriodView>;
  /** Months page; quarters never do — eight columns always fit. Passed rather than inferred from
   *  a column key's shape, so the reason is stated where the decision is made. */
  granularity: PeriodGranularity;
  /** First visible month, or null for "wherever today is". The PANEL owns it (same reason the
   *  folds were lifted in P3): held here, stepping to a later month and flipping to the List and
   *  back would silently return the coach to today. */
  monthStart: number | null;
  onMonthStart: (n: number) => void;
  /**
   * ⚠ COLLAPSED CATEGORIES, tracked as the set that is CLOSED rather than the set that is open
   * (owner ruling 2026-08-13: *"any hierarchy should be collapsable in a table"*).
   *
   * Storing the closed ones is what makes the default "everything showing" survive the plan
   * changing: a coach who adds a category sees it open, because it is simply not in the set. An
   * open-set would have to be re-seeded on every load and a newly added category would arrive
   * collapsed — data quietly missing from a screen whose whole job is to show the spread.
   *
   * ⚠ The DEFAULT differs from the month grid's, deliberately. This view opens showing every line,
   * because that is what it opens for today and collapsing by default would hide figures a coach
   * can currently see. Budget vs. Actual's month grid opens collapsed because twelve month columns
   * times every line is a wall. Same affordance, different starting point, for the column count.
   *
   * ⚠ LIFTED to the panel since P3 (2026-09-02): held here, the component remounted on every
   * List↔By-period toggle and the folds reset with it — and the panel is what remembers them per
   * team+season now.
   */
  closed: Set<string>;
  onToggle: (key: string) => void;
}) {
  /* ⚠⚠ THE MONTH WINDOW (owner ruling 2026-09-04, QA §133) — the same twelve-at-a-time control
     Budget vs. Actual has always had. This grid used to draw EVERY column it had and leave the
     coach swiping: fine at the ten a normal plan produces, unusable at the twenty-four a single
     far-off payment date can produce. That is the worse failure mode of the two — it works right
     up until somebody's real plan breaks it.
     ⚠ The undated column is NOT a month and never pages; it leads, on both grids.
     ⚠ QUARTERS DO NOT PAGE. Two years of quarters is eight columns and always fits, so a control
     there would be furniture that never does anything. */
  const undatedCol = view.columns.find(c => c.unscheduled) ?? null;
  const dateCols = view.columns.filter(c => !c.unscheduled);
  const paged = granularity === 'months' && dateCols.length > MONTH_WINDOW;
  const maxStart = Math.max(0, dateCols.length - MONTH_WINDOW);
  /* Opens on today when today is inside the plan, centred the way the statement centres it, and
     falls back to the start for a plan that has not reached this month. */
  const todayKey = todayLocal().slice(0, 7);
  const here = dateCols.findIndex(c => c.key >= todayKey);
  const defaultStart = !paged || here < 0 ? 0 : Math.max(0, here - Math.floor(MONTH_WINDOW / 2));
  const start = paged ? Math.min(Math.max(0, monthStart ?? defaultStart), maxStart) : 0;
  const windowCols = paged ? dateCols.slice(start, start + MONTH_WINDOW) : dateCols;
  const cols = undatedCol ? [undatedCol, ...windowCols] : windowCols;
  /* The band describes WHAT IS ON SCREEN, so it is rebuilt from the window rather than read off
     the view — a band naming columns a coach cannot see is worse than no band at all. */
  const bands = monthYearBands(windowCols.map(c => c.key));

  /* The two bands' groups, split once (owner ruling 2026-09-08, mockup e94d05d9 round 2). The
     funding subtotal is read into a const so the JSX can narrow it once rather than assert it
     non-null inside every map. */
  const costGroups = view.groups.filter(g => !isFundingKind(g.lineKind));
  const fundingGroups = view.groups.filter(g => isFundingKind(g.lineKind));
  const fundingTotals = view.fundingTotals;
  /** A subtotal or closing row's cells, from a per-column total the view built in the same pass as
   *  the close — money-in read POSITIVE, the way every other cell in that band is painted. */
  const totalCells = (t: { cells: Record<string, number>; total: number }, funding: boolean) => {
    const kind: BudgetLineKind = funding ? 'funding' : 'cost';
    return (
      <>
        {cols.map(col => <td key={col.key}>{fmtCell(fundingCell(kind, t.cells[col.key]))}</td>)}
        <td>{fmtCell(fundingCell(kind, t.total))}</td>
      </>
    );
  };
  /** One group — a cost category or a money-in kind — with its fold. ONE renderer for both bands. */
  const renderGroup = (group: ReturnType<typeof buildPeriodView>['groups'][number]) => {
    const open = !closed.has(group.key);
    return (
      <Fragment key={group.key}>
        <tr className={`${shared.moneyGridCat} ${isFundingKind(group.lineKind) ? styles.periodGridFunding : ''}`}>
          <th scope="rowgroup">
            <button
              type="button"
              className={shared.moneyGridToggle}
              onClick={() => onToggle(group.key)}
              aria-expanded={open}
              disabled={group.rows.length === 0}
            >
              {group.rows.length === 0
                ? <span className={shared.moneyGridChevronSpacer} aria-hidden />
                : open
                  ? <ChevronDown size={13} aria-hidden className={shared.moneyGridChevron} />
                  : <ChevronRight size={13} aria-hidden className={shared.moneyGridChevron} />}
              <span className={shared.wrap640}>{group.name}</span>
            </button>
          </th>
          {cols.map(col => <td key={col.key}>{fmtCell(fundingCell(group.lineKind, group.cells[col.key]))}</td>)}
          <td>{fmtCell(fundingCell(group.lineKind, group.total))}</td>
        </tr>
        {open && group.rows.map(row => (
          <tr key={row.id} className={isFundingKind(group.lineKind) ? styles.periodGridFunding : ''}>
            <th scope="row" className={shared.moneyGridLead}>
              {row.description}
              {/* ⚠ NO "N lines" COUNT ON THIS ROW, and none on the Budget list or the Budget vs.
                  Actual statement either — owner ruling 2026-09-04, QA §133. The full reasoning
                  lives with the gate that enforces it, tests/unit/bva-figure-doors-guard.test.ts.
                  Short version: a fact the coach gets by opening the row does not need a label
                  promising it first. */}
            </th>
            {cols.map(col => <td key={col.key}>{fmtCell(fundingCell(row.lineKind, row.cells[col.key]))}</td>)}
            <td>{fmtCell(fundingCell(row.lineKind, row.total))}</td>
          </tr>
        ))}
      </Fragment>
    );
  };

  return (
    <div className={styles.periodGridWrap}>
      {paged && (
        /* ⚖ THE SHARED CONTROL, not a third copy of it. Budget vs. Actual's month window and the
           By-installment dues grid already read ColumnPager; a hand-rolled pager per panel is
           exactly how the budget and bva header CSS forked before.
           ⚠ The range is NAMED because Total is the whole plan, never the visible twelve months —
           a coach adding up what they can see has to be able to tell why it does not match. */
        <ColumnPager
          unit="month"
          range={<><strong>{periodRangeLabel(windowCols.map(c => c.key))}</strong>{` · of ${dateCols.length} months`}</>}
          onPrev={() => onMonthStart(Math.max(0, start - 1))}
          onNext={() => onMonthStart(Math.min(maxStart, start + 1))}
          prevDisabled={start === 0}
          nextDisabled={start >= maxStart}
        />
      )}
      {/* `sticky` pins the line name; the hint is structural (a grid that scrolls silently
          sideways is the defect CoachScrollX exists to prevent). */}
      <CoachScrollX sticky hint="Swipe the table to see every period">
        <table className={`${shared.moneyGrid} ${styles.periodGrid}`}>
          <thead>
            {/* The YEAR BAND (owner, 2026-08-13). The year used to print on the one column where it
                changed, which made that column taller than its neighbours and read as a glitch —
                and it labelled a single column with something that describes a GROUP of them. The
                band groups instead, and pays for itself on a season crossing New Year: Sep–Dec
                under one year, Jan–Feb under the next, told apart at a glance.
                ⚠ "No date yet" and Total sit under an EMPTY band on purpose — they belong to no
                year, and giving them one would be a tidy lie in a table whose job is to add up.
                ⚠ THE EMPTY SPANS SWAPPED ENDS on 2026-09-04 when the undated column moved to the
                FRONT to match Budget vs. Actual: two blank cells lead (the name and the undated
                column), one trails (Total). Getting this wrong shifts every year one column and
                the table still renders. */}
            {bands.length > 0 && (
              <tr className={styles.periodGridYearRow}>
                <th scope="col" aria-hidden colSpan={view.hasUnscheduled ? 2 : 1} />
                {bands.map(band => (
                  <th key={band.year} scope="colgroup" colSpan={band.span} className={styles.periodGridYear}>
                    {band.year}
                  </th>
                ))}
                <th scope="col" aria-hidden />
              </tr>
            )}
            <tr>
              {/* Named the same as Budget vs. Actual's month grid — one grid, one word for its
                  first column. It was "Line" here and "Category / line" there. */}
              <th scope="col">Category / line</th>
              {cols.map(col => (
                <th key={col.key} scope="col" className={col.unscheduled ? styles.periodGridUnscheduled : ''}>
                  {col.label}
                </th>
              ))}
              <th scope="col">Total</th>
            </tr>
          </thead>
          <tbody>
            {/* ── COSTS → categories → Planned costs; FUNDING → kinds → Planned funding; the close
                (owner ruling 2026-09-08, mockup e94d05d9 round 2 — the same bands and subtotals the
                List draws, so the two readings of one plan share one shape). A band row carries
                real empty cells and never a colSpan: the first column is pinned, and a spanning
                cell gives the pin nothing to hold (the statement's bands learned this first). */}
            {costGroups.length > 0 && (
              <>
                <tr className={shared.moneyGridBand}>
                  <th scope="row">{PLAN_LADDER_LABEL.costsBand}</th>
                  {cols.map(col => <td key={col.key} />)}
                  <td />
                </tr>
                {costGroups.map(renderGroup)}
                {/* ⚠ ONE NAME, ONE NUMBER (the rule this grid's close has carried since 2026-08-13,
                    and which /review caught the subtotal breaking). This grid spreads LINES; an
                    estimate has no dates. When one is set and differs, this row is the lines' sum and
                    reads "Lines so far" — what the List calls the same figure — never "Planned costs",
                    which is the estimate there. */}
                <tr className={shared.moneyGridTotal}>
                  <th scope="row">{view.estimateDiffers ? PLAN_LADDER_LABEL.linesSoFar : PLAN_LADDER_LABEL.plannedCosts}</th>
                  {totalCells(view.costTotals, false)}
                </tr>
              </>
            )}
            {fundingTotals && fundingGroups.length > 0 && (
              <>
                <tr className={shared.moneyGridBand}>
                  <th scope="row">{PLAN_LADDER_LABEL.fundingBand}</th>
                  {cols.map(col => <td key={col.key} />)}
                  <td />
                </tr>
                {fundingGroups.map(renderGroup)}
                <tr className={`${shared.moneyGridTotal} ${styles.periodGridFunding}`}>
                  <th scope="row">{PLAN_LADDER_LABEL.plannedFunding}</th>
                  {totalCells(fundingTotals, true)}
                </tr>
                {/* The close is a real subtraction and keeps the view's SIGNED totals. NOT "Player
                    installments" (review finding, kept): this grid spreads the PLAN, estimate-blind,
                    and borrowing the tile's label would put one name on two different numbers.
                    "Funding", not "fundraising": the row aggregates every money-in kind. */}
                <tr className={shared.moneyGridTotal}>
                  <th scope="row">{PLAN_LADDER_LABEL.costsLessFunding}</th>
                  {totalCells(view.totals, false)}
                </tr>
              </>
            )}
          </tbody>
        </table>
      </CoachScrollX>
      {view.hasUnscheduled && (
        <p className={styles.periodGridNote}>
          <strong>No date yet</strong> holds anything without payment dates. Split a line by period
          to move it into a month.
        </p>
      )}
      {view.estimateDiffers && (
        /* The one thing this grid cannot draw, said once: an estimate has no dates. The cost
           subtotal above reads "Lines so far" for the same reason (one name, one number). */
        <p className={styles.periodGridNote}>
          Your season estimate has no dates, so this grid spreads the lines you have entered. The
          List shows the estimate as Planned costs.
        </p>
      )}
      {view.truncated && (
        <p className={styles.periodGridNote}>
          Your plan spans more than two years — the columns stop there, and everything later is
          counted in the last one.
        </p>
      )}
      {view.columns.length === 1 && view.columns[0].key === UNSCHEDULED && (
        <p className={styles.periodGridNote}>
          None of your lines have payment dates yet, so there is nothing to spread across months.
        </p>
      )}
    </div>
  );
}

/** The saved line as form state. ONE mapping, shared by "open the edit modal" and by the
 *  discard guard's dirty baseline — two copies would drift and the guard would either nag
 *  on an untouched form or miss a real edit. */
/**
 * ⚠ THE DIRECTION IS READ BACK FROM THE STORED KIND (mig 280), never re-derived from the item —
 * this has to reopen the line as it IS, including a pre-280 row whose item was later moved to the
 * other side. The kind the SAVE stores is derived (server-side) from the item; the kind the form
 * OPENS on is the one on the row.
 *
 * `actualSource` is handed in rather than looked up here because that lookup needs the picker's
 * category list, which lives in the component. Null when the word is not in it — see the field.
 */
function formFromLine(
  line: RepBudgetLineWithPeriods, seasonYear: number, fallbackMode: PeriodSplitMode,
  actualSource: BudgetItemActualSource | null,
): LineForm {
  const periods: PeriodRow[] = line.periods.map(p => ({
    label: p.periodLabel, date: p.periodDate ?? '', amount: String(p.amount),
  }));
  // The REMEMBERED mode (mig 274) — the split reopens exactly as it was built. A pre-274 line
  // (null) falls back to reading the dates and names it holds; that guess can be wrong, and
  // correcting it costs one tap and rewrites nothing until the coach saves — after which the
  // choice is stored and the guessing is over for that line.
  const splitMode = line.splitMode
    ?? (periods.length > 0 ? inferSplitMode(periods) : fallbackMode);
  return {
    description:  line.description,
    categoryId:   line.categoryId ?? '',
    itemId:       line.itemId,
    categoryName: line.categoryName ?? '',
    itemName:     line.itemName    ?? line.description,
    totalAmount:  String(line.totalAmount),
    direction:    isFundingKind(line.lineKind) ? 'in' : 'out',
    itemActualSource: actualSource,
    notes:        line.notes ?? '',
    whenAnswer:   whenAnswerFor(periods, splitMode),
    periodMode:   'amount', // stored periods are always dollars
    splitMode,
    periods:      periods.length > 0 ? periods : [blankPeriod(splitMode, seasonYear)],
  };
}

/** Field-by-field equality for the discard guard. Periods are compared positionally, so
 *  reordering or editing one counts as a change. `periodMode` is deliberately excluded:
 *  switching $/% rewrites the period amounts anyway, and toggling it back and forth on an
 *  untouched form must not read as work in progress. `splitMode` is excluded for the same
 *  reason — changing it resets the periods, so any real loss already shows up in `periods`,
 *  and flipping modes on an untouched form must still close silently. */
function sameLineForm(a: LineForm, b: LineForm): boolean {
  if (
    a.description !== b.description
    || a.categoryId !== b.categoryId
    || a.itemId !== b.itemId
    || a.totalAmount !== b.totalAmount
    || a.direction !== b.direction
    || a.notes !== b.notes
    || a.whenAnswer !== b.whenAnswer
    || a.periods.length !== b.periods.length
  ) return false;
  return a.periods.every((p, i) =>
    p.label === b.periods[i].label && p.date === b.periods[i].date && p.amount === b.periods[i].amount);
}

/**
 * Group COST lines CATEGORY → ITEM for display (owner ruling 2026-08-15).
 *
 * ⚠ THE ITEM NAMES THE ROW, AND TWO LINES ON ONE ITEM ARE ONE ROW. This used to group by category
 * and then list lines by their typed description, which is how a coach who picked the item
 * "Entry Fees" ended up reading a plan row called "test". The shared rule lives in
 * `lib/coach-budget-rollup.ts` so this list and Budget vs. Actual cannot group the same plan two
 * different ways — the entire point of making the item the key.
 *
 * Funding lines are deliberately absent: they are money coming IN, carry no category or item, and
 * have their own section at the foot of the plan.
 */
/**
 * Group FUNDING lines by CATEGORY (owner ruling 2026-09-09) — the same identity the cost half above
 * and the Statement already use, through the rollup's one helper. They were grouped by their stored
 * KIND before ("Fundraising · Sponsorship · Other income"), so a concession stand filed under
 * Tournaments read under "Other income" here and under "Tournaments" on Budget vs. Actual. The kind
 * stays a data fact (who fills the number in); it stops naming shelves.
 */
function groupFundingLines(lines: RepBudgetLineWithPeriods[], order: ReadonlyMap<string, number>) {
  return groupByCategory(lines, categoryGroupOf, order).map(({ ref, items }) => ({
    ref,
    lines: items,
    total: Math.round(items.reduce((s, l) => s + Number(l.totalAmount ?? 0), 0) * 100) / 100,
  }));
}

type ChecklistItem = {
  id: string; name: string; categoryId: string; categoryName: string;
  direction: BudgetItemDirection; actualSource: BudgetItemActualSource;
};
type ChecklistCategory = { key: string; ref: CategoryGroupRef; name: string; items: ChecklistItem[] };
type ChecklistSide = { direction: BudgetItemDirection; name: string; count: number; categories: ChecklistCategory[] };

/**
 * The forgetting list as an INDEX (owner ruling 2026-09-09, mockup Option A): the form's two direction
 * answers as headings, one entry per category with its count, the words themselves only inside an
 * opened category. Fifty-seven flat chips — the seven money-in words at positions 2–4 and 46–49, the
 * category only in a desktop tooltip — became fourteen rows. A category holding both kinds of word
 * (Tournaments, Fundraising) appears under both headings, which is the structure telling the truth.
 * ⚠ Money coming in FIRST: the shorter side, and the one a coach most often has not thought about.
 */
function groupChecklist(
  items: ChecklistItem[], order: ReadonlyMap<string, number>,
): { sides: ChecklistSide[]; categoryCount: number } {
  const sides: ChecklistSide[] = [];
  for (const direction of ['in', 'out'] as const) {
    // The form's own words, never retyped — one spelling everywhere a coach reads a direction.
    const answer = DIRECTION_ANSWERS.find(d => d.value === direction)!;
    // A category on both sides appears under both headings — the key carries the direction so the
    // two buttons never share an open state.
    const categories: ChecklistCategory[] = groupByCategory(items.filter(it => it.direction === direction), categoryGroupOf, order)
      .map(({ ref, items: words }) => ({ key: `${direction}:${ref.key}`, ref, name: ref.name, items: words }));
    if (categories.length === 0) continue;
    sides.push({
      direction, name: answer.name,
      count: categories.reduce((s, c) => s + c.items.length, 0),
      categories,
    });
  }
  return { sides, categoryCount: new Set(items.map(i => i.categoryId)).size };
}

function groupLines(lines: RepBudgetLineWithPeriods[]) {
  const byId = new Map(lines.map(l => [l.id, l]));
  const categories = rollupBudget(
    lines.filter(l => !isFundingKind(l.lineKind)).map(l => ({
      id: l.id,
      categoryId: l.categoryId,
      categoryName: l.categoryName,
      itemId: l.itemId,
      itemName: l.itemName,
      totalAmount: l.totalAmount,
      description: l.description,
      notes: l.notes,
      periods: l.periods.map(p => ({
        label: p.periodLabel, date: p.periodDate, amount: p.amount, sortOrder: p.sortOrder,
      })),
    })),
    [],
  );
  // Back to the full line objects the row component needs — the rollup deliberately carries only
  // what the arithmetic needs, so the screen re-attaches what only the screen uses.
  return categories.map(cat => ({
    categoryName: cat.categoryName,
    total: cat.budgeted,
    items: cat.items.map(item => ({
      key: item.itemId ?? `${cat.categoryName}|no-item`,
      itemName: item.itemName,
      total: item.budgeted,
      lines: item.lines.map(l => byId.get(l.id)).filter((l): l is RepBudgetLineWithPeriods => !!l),
    })),
  }));
}

export function BudgetPlanPanel({
  params: paramsPromise,
  tabActive = true,
}: {
  params: Promise<{ orgSlug: string; teamId: string }>;
  /** Is this panel the tab currently on screen? A dirty form left on a tab the coach has
   *  since switched away from must stop intercepting clicks on whatever tab they're
   *  actually looking at — see UnsavedChangesGuard's `interceptClicks`. */
  tabActive?: boolean;
}) {
  const params = use(paramsPromise);
  const { orgSlug, teamId } = params;
  const { assignments, loading: ctxLoading } = useCoaches();
  const base = `/${orgSlug}/coaches/teams/${teamId}`;

  const [plan,       setPlan]       = useState<RepBudgetPlan | null>(null);
  /* The "Bring last season's plan" door's one fact (owner Q8b): an earlier season with lines,
     sent only while the plan is empty. Null = no door. */
  const [priorPlan,  setPriorPlan]  = useState<{ year: number; lineCount: number } | null>(null);
  const [carryBusy,  setCarryBusy]  = useState(false);
  const [carryError, setCarryError] = useState('');
  // Σ of this season's dues schedules — the Dues tab's "assessed" total, echoed here so the plan
  // can show players' side of the funding and read as a complete budget. Display-only: it is never
  // a budget line and never enters computeBudgetTotals (dues are DERIVED from the plan — feeding
  // them back in as funding would be circular).
  const [duesAssessed, setDuesAssessed] = useState(0);
  const [categories, setCategories] = useState<BudgetCategoryWithItems[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');

  /**
   * Who reports a word's actual, from the picker's own list (mig 280).
   *
   * ⚠ NULL RATHER THAN A GUESS when the word is not in the list. That happens for real: an item
   * whose word was deleted, or one tagged for a sport this team no longer plays. Defaulting it to
   * 'typed' would put a confident wrong sentence under a money-in line — and it is not needed,
   * because the SERVER derives the stored kind from the row it fetches, never from this.
   */
  function sourceOfItem(itemId: string | null): BudgetItemActualSource | null {
    if (!itemId) return null;
    for (const c of categories) {
      const hit = c.items.find(i => i.id === itemId);
      if (hit) return hit.actualSource;
    }
    return null;
  }

  /** "Manage our words" — the one door to a team's own vocabulary (mig 246). See `addLineButton`. */
  const [itemManagerOpen, setItemManagerOpen] = useState(false);

  // The optional ESTIMATED TOTAL — what the coach thinks the season costs before it is all
  // itemized. Renamed from "season total" 2026-08-12: the old name said nothing about what it was
  // for, sat beside a total it sometimes overrode, and a value BELOW the lines was stored and then
  // silently ignored. It is now the number that counts whenever it is set, and the gap between it
  // and the lines is a stated row of the summary ladder.
  const [seasonTotal,   setSeasonTotal]   = useState<number | null>(null);
  const [seasonYear,    setSeasonYear]    = useState<number>(() => Number(tournamentToday().slice(0, 4)));
  const [editingSeason, setEditingSeason] = useState(false);
  const [seasonInput,   setSeasonInput]   = useState('');
  const [seasonSaving,  setSeasonSaving]  = useState(false);
  const [seasonError,   setSeasonError]   = useState('');

  const [expandedLines, setExpandedLines] = useState<Set<string>>(new Set());

  /* Which sections are closed in the List view. Closed-set rather than open-set for the same
     reason the By-period grid uses one: the plan opens showing everything, and a category the
     coach adds later arrives open rather than hidden.
     ⚠ Known edge, accepted: the set is not pruned when a category disappears, so deleting a
     category's last line and later re-creating a category with the SAME name reopens it collapsed.
     One click corrects it, and pruning would mean reconciling this against `groups` on every
     render for a case that needs an exact name reuse.
     ⚠ KEYS ARE NAMESPACED BY KIND. Category names are coach-entered free text, so a category
     literally called "Expected funding" would otherwise share a key with the funding SECTION and
     collapse it too — one Set, two meanings. Caught in review 2026-08-13. */
  const [closedSections, setClosedSections] = useState<Set<string>>(new Set());
  const catKey = (name: string) => `cat:${name}`;
  // One key per money-in CATEGORY (`group:id:<uuid>`) — built at the render site. The `group:`
  // prefix is what keeps a cost section from sharing a key with the funding section of the SAME
  // category (Tournaments legitimately has both) and collapsing with it (the reason the prefix has
  // existed since review 2026-08-13, when it was `kind:`).
  const isClosed = (key: string) => closedSections.has(key);
  const toggleSectionClosed = (key: string) => setClosedSections(prev => toggleKey(prev, key));

  // Reading the plan DOWN a list or ACROSS time. The month columns existed only on Budget vs.
  // Actual, blended with actuals, which is why coaches on this page concluded the plan had none
  // (owner finding 2026-08-12). Both views are built from the payload already loaded — switching
  // never refetches, and quarters are months grouped, so the two can't disagree.
  const [viewMode,    setViewMode]    = useState<'list' | 'period'>('list');
  const [granularity, setGranularity] = useState<PeriodGranularity>('months');
  /* The period grid's folds, LIFTED out of PeriodGrid (P3): held inside, the component remounted
     on every List↔By-period toggle and the folds reset with it. Closed-set, same reasoning as
     the List's own — see the prop's note on PeriodGrid. */
  const [gridClosed, setGridClosed] = useState<Set<string>>(new Set());
  const toggleGridGroup = (key: string) => setGridClosed(prev => toggleKey(prev, key));
  /* ⚠ NULL MEANS "wherever today is" (2026-09-04, QA §133) — the same shape the month grid's own
     control uses. Holding the DEFAULT as null rather than a number is what lets the plan change
     underneath without stranding the coach on a month that no longer exists: the default is
     recomputed, a deliberate step is remembered.
     ⚠ Lifted here rather than held in PeriodGrid for the reason the folds were (P3): the component
     unmounts on every List↔By-period toggle, so state held inside it would silently return the
     coach to today every time they checked something on the List and came back. */
  const [gridMonthStart, setGridMonthStart] = useState<number | null>(null);

  // Add/Edit modal
  const [modalOpen,   setModalOpen]   = useState(false);
  const [editingLine, setEditingLine] = useState<RepBudgetLineWithPeriods | null>(null);
  const [form,        setForm]        = useState<LineForm>(BLANK_FORM);
  const [saving,      setSaving]      = useState(false);
  const [saveError,   setSaveError]   = useState('');
  // Has Save been pressed on this form yet? Nothing is marked as at fault before it has — a form
  // that shouts at a coach who is still typing is its own defect. After it, the marks clear live.
  const [saveTried,   setSaveTried]   = useState(false);
  // The way back from a bulk period action (fill the season, clear them all, change the split
  // mode). Undo rather than a confirm dialog: a confirm stops the coach to ask a question they
  // will almost always answer yes to, while this costs nothing when they meant it. Survives only
  // until they do something else.
  const [periodUndo,  setPeriodUndo]  = useState<
    { periods: PeriodRow[]; splitMode: PeriodSplitMode; text: string } | null
  >(null);
  // The split mode the coach used last on this team — device memory, the shipped pattern for quiet
  // per-coach state (checklist dismissals, winding-down dismiss). Worst case across devices: a new
  // line opens on months instead of their usual.
  const [lastSplitMode, setLastSplitMode] = useState<PeriodSplitMode>('months');
  // "I'll adjust it myself" on the rescale banner (P2) — remembers WHICH total it was dismissed
  // for, so editing the total again brings the banner back. Sum validation still blocks the save
  // either way; the banner is the early, actionable version of that refusal.
  const [rescaleDismissedFor, setRescaleDismissedFor] = useState<string | null>(null);
  /**
   * Which of the two money fields the coach edited last — the TOTAL, or the period rows.
   *
   * ⚠ THIS REPLACED "the total differs from the one the modal opened with" (owner, QA §133
   * 2026-09-04), which stranded the coach: rescale a split up to $6,000, type the original $5,200
   * back, and the form decided nothing had changed — so the offer to refit disappeared while the
   * rows still added to $6,000 and the red sum error still blocked the save. The MISMATCH is what
   * the banner is about; the only thing that comparison was really protecting is the coach who is
   * typing in the rows themselves, and that is what this records instead.
   *
   * ⚠⚠ NULL UNTIL THE COACH TOUCHES SOMETHING, and that is load-bearing (/review, same day).
   * Seeding it to 'total' made the banner fire on a modal nobody had typed in yet: the month grid
   * deep-links a lump-sum line here with the split FORCED open, so the form arrives holding one
   * blank period against a real total — a mismatch by construction. The comparison this replaced
   * could not do that, because a value cannot differ from itself at the moment it becomes the
   * baseline; this has to earn the same silence deliberately.
   */
  const [lastMoneyEdit, setLastMoneyEdit] = useState<'total' | 'periods' | null>(null);
  /** Changing what a period is WORTH is the coach adjusting the split by hand. A period's name and
   *  its date are not money and deliberately do not count — dismissing a money warning because
   *  somebody fixed a typo in a label takes the one-tap fix away without fixing anything. */
  const markPeriodsEdited = () => setLastMoneyEdit('periods');

  // Delete confirm. `deleteError` replaces a native alert() (review f7-6) — the last raw
  // browser dialog anywhere in the portal. The confirm modal is STILL OPEN when a delete
  // fails (setDeletingId(null) is only reached on success), so the reason belongs inside
  // it, the same way every other Money form reports a save error. A second dialog on top
  // of the first would be nonsense.
  const [deletingId,  setDeletingId]  = useState<string | null>(null);
  const [deleting,    setDeleting]    = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Chunk G — the budget starter, the sample sheet, and the derived checklist
  // (mockups artifact 77f5175e = binding). The sheets register their own overlay
  // state on mount; the checklist needs no storage at all — see the memo below.
  const [starterOpen,        setStarterOpen]        = useState(false);
  // Chunk H2 — bringing a budget in from a spreadsheet.
  const [importOpen,         setImportOpen]         = useState(false);
  const [importMessage,      setImportMessage]      = useState('');
  const [sampleOpen,         setSampleOpen]         = useState(false);
  const [checklistExpanded,  setChecklistExpanded]  = useState(false);
  const [dismissedChecklist, setDismissedChecklist] = useState<string[]>([]);
  /** Which category of the forgetting list is open (Option A, 2026-09-09) — one at a time, nothing
   *  open on arrival. Plain state, deliberately: the list is a device for one sitting. */
  const [checklistOpenCat, setChecklistOpenCat] = useState<string | null>(null);
  // The dirty baseline for whatever the line modal is currently showing: BLANK for a plain add,
  // the prefilled form for a checklist-chip add, the loaded record for an edit. Set by every
  // path that opens the modal, so the guard can never count OUR prefill as the coach's work and
  // nag on an untouched form (the one-mapping rule, Chunk A — `formFromLine` stays the single
  // form↔record mapping, this is just where its result is remembered).
  const [formBaseline,       setFormBaseline]       = useState<LineForm>(BLANK_FORM);

  // Set dues for all players — the modal itself is shared with Player Dues (one bulk-dues door,
  // owner ruling 2026-08-13), so this panel holds nothing but whether it's open. Its form state,
  // its budget read and its discard guard all live inside the component.
  const [genOpen, setGenOpen] = useState(false);

  // Nav-hide + body-scroll-lock registration for this panel's own modals (mobile sheet default).
  // The generate modal registers itself.
  useOverlayOpen(modalOpen);
  useOverlayOpen(!!deletingId);

  // ── Discard guards (review f7-3/f7-7) ────────────────────────────────────────────
  // The budget line with a period split is the worst thing in the product to retype, and it
  // used to vanish on a backdrop tap. Dirtiness compares the form against the baseline captured
  // when the modal opened — see `formBaseline`.
  const lineDirty = modalOpen && !sameLineForm(form, formBaseline);
  const filledPeriods = modalOpen && usesPeriods(form)
    ? form.periods.filter(p => p.label || p.date || p.amount).length
    : 0;
  // Names the work at stake rather than "unsaved changes" — the period split is the whole reason
  // this guard exists, so it gets counted out loud. ONE sentence, read by BOTH guards below: the
  // coach loses the same work whether they tap the backdrop or arrive from the month grid on top
  // of it, so they have to be told about it in the same words.
  const lineDiscardDetail = [
    form.totalAmount && 'an amount',
    form.description && 'a description',
    filledPeriods > 0 && `${filledPeriods} payment period${filledPeriods === 1 ? '' : 's'}`,
  ].filter(Boolean).join(' and ') || undefined;
  const closeLineModal = useDiscardGuard({
    dirty: lineDirty,
    close: () => setModalOpen(false),
    noun: 'budget line',
    detail: lineDiscardDetail,
  });

  /* ⚠⚠ THE SECOND DISCARD GUARD — AND IT EXISTS BECAUSE OF A DEFECT THIS FILE SHIPPED FOR A FEW
     HOURS, CAUGHT BY TWO INDEPENDENT REVIEW LENSES (/review, 2026-09-04). The month grid's deep
     link (further down) opens a line by writing `form`/`formBaseline` straight from an EFFECT.
     That is not a click, so neither existing guard can see it: `closeLineModal` covers the
     backdrop/X/Cancel, and `UnsavedChangesGuard` covers in-app <a> clicks and beforeunload. The
     browser's BACK button is neither of those. So: type into line A, press Back, tap line B in the
     grid — and A's unsaved amount and payment periods were gone without a word.
     ⚠ The modal overlay outranks the tab bar, which is what makes Back the ONLY way out of a dirty
     form and this guard the only thing standing in front of the loss.
     `pendingDeepLink` carries the line to open: the guard runs it immediately on a clean form, and
     only after "Discard" on a dirty one. Same dialog, same words, same noun as its twin — a second
     way of saying "you are about to lose this" would be a second thing to learn. */
  const pendingDeepLink = useRef<(() => void) | null>(null);
  // Latest-ref because the deep-link effect deliberately does NOT list `lineDirty` in its deps
  // (listing it would re-run the effect on every keystroke) — so the handler it reaches for must be
  // THIS render's, not the one captured when the address last changed.
  const openDeepLinkedLine = useLatestRef(useDiscardGuard({
    dirty: lineDirty,
    close: () => { const go = pendingDeepLink.current; pendingDeepLink.current = null; go?.(); },
    noun: 'budget line',
    detail: lineDiscardDetail,
  }));

  // The delete confirm holds no typed work, so it closes silently — it just has to clear
  // the failure message so reopening it doesn't show a stale reason.
  const closeDelete = useCallback(() => { setDeletingId(null); setDeleteError(''); }, []);

  // Which SEASON is on screen — the team's LIVE one, always. `page.capabilities` are that
  // season's. ⚠ `page.canWrite()` is GONE (2026-08-18): it folded read-only into every write
  // flag, and a closed season no longer renders this screen at all.
  const seasonSearchParams = useSearchParams();
  const page = useCoachSeasonPage(orgSlug, teamId);
  const assignment = assignments.find(a => a.teamId === teamId);

  // Checklist dismissals ("we don't pay for this") are DEVICE memory — localStorage per
  // team+season, the shipped pattern for quiet per-coach state (winding-down dismiss,
  // Moved markers). Worst case cross-device: a dismissed chip quietly reappears.
  const checklistKey = assignment
    ? `flhq-coach-budget-checklist:${teamId}:${assignment.programYearId}`
    : null;
  useEffect(() => {
    if (!checklistKey) return;
    try {
      const raw = localStorage.getItem(checklistKey);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      // Shape-check, not just parse-check: a corrupt value must reset, never crash.
      setDismissedChecklist(Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []);
    } catch {
      setDismissedChecklist([]);
    }
  }, [checklistKey]);

  const splitModeKey = assignment
    ? `flhq-coach-budget-split-mode:${teamId}:${assignment.programYearId}`
    : null;
  useEffect(() => {
    if (!splitModeKey) return;
    try {
      const raw = localStorage.getItem(splitModeKey);
      // Shape-check: an unknown value must fall back, never reach the pickers.
      setLastSplitMode(
        PERIOD_SPLIT_MODES.includes(raw as PeriodSplitMode) ? (raw as PeriodSplitMode) : 'months',
      );
    } catch {
      setLastSplitMode('months');
    }
  }, [splitModeKey]);

  function rememberSplitMode(mode: PeriodSplitMode) {
    setLastSplitMode(mode);
    if (!splitModeKey) return;
    try { localStorage.setItem(splitModeKey, mode); } catch { /* device memory only */ }
  }

  /* P3 — the page remembers how you read it: view, columns, the List's folds and the period
     grid's, per team+season (device memory — the BvA prefs pattern, read-before-write so the
     first render never stomps a remembered choice). */
  const [viewPrefsLoaded, setViewPrefsLoaded] = useState(false);
  const viewPrefsKey = assignment
    ? `flhq-coach-budget-view:${teamId}:${assignment.programYearId}`
    : null;
  useEffect(() => {
    if (!viewPrefsKey) return;
    try {
      const raw = localStorage.getItem(viewPrefsKey);
      const parsed = raw
        ? JSON.parse(raw) as { view?: unknown; granularity?: unknown; closedSections?: unknown; gridClosed?: unknown }
        : {};
      // Shape-check everything: a corrupt value must fall back, never crash or half-apply.
      if (parsed.view === 'list' || parsed.view === 'period') setViewMode(parsed.view);
      if (PERIOD_GRANULARITIES.includes(parsed.granularity as PeriodGranularity)) {
        setGranularity(parsed.granularity as PeriodGranularity);
      }
      if (Array.isArray(parsed.closedSections)) {
        setClosedSections(new Set(parsed.closedSections.filter((x): x is string => typeof x === 'string')));
      }
      if (Array.isArray(parsed.gridClosed)) {
        setGridClosed(new Set(parsed.gridClosed.filter((x): x is string => typeof x === 'string')));
      }
    } catch { /* device memory only */ }
    setViewPrefsLoaded(true);
  }, [viewPrefsKey]);
  useEffect(() => {
    if (!viewPrefsKey || !viewPrefsLoaded) return;
    try {
      localStorage.setItem(viewPrefsKey, JSON.stringify({
        view: viewMode,
        granularity,
        closedSections: [...closedSections],
        gridClosed: [...gridClosed],
      }));
    } catch { /* device memory only */ }
  }, [viewPrefsKey, viewPrefsLoaded, viewMode, granularity, closedSections, gridClosed]);

  // The permanent "what am I forgetting?" — DERIVED, never stored: standard team-scope
  // default items minus what the plan already covers (by item link, or by name for
  // free-text lines) minus what this coach dismissed. A budget line cannot exist
  // without an amount (DB CHECK > 0), which is exactly why "still to price" is a
  // computed checklist rather than $0 sentinel rows.
  const checklistItems = useMemo(() => {
    if (!plan || plan.lines.length === 0) return [];
    const linkedIds = new Set(plan.lines.map(l => l.itemId).filter((id): id is string => !!id));
    const usedNames = new Set(
      plan.lines
        .flatMap(l => [l.description, l.itemName])
        .filter((s): s is string => !!s)
        .map(s => s.toLowerCase()),
    );
    /* ⚠⚠ THE CHIP CARRIES WHICH SIDE ITS WORD IS ON (`/review`, correctness lens, 2026-09-07).
       This list is NOT filtered by direction and should not be — "what am I forgetting?" legitimately
       includes the sponsorship you have not budgeted yet, and migration 243 seeds Fundraising and
       Sponsorship as default categories with default money-IN words under them. What was missing is
       that the chip handed the form only a category and an item, so the form opened on its own
       default side and a money-in word arrived on the SPENDING side. See `openAddFromChecklist`. */
    const out: Array<{
      id: string; name: string; categoryId: string; categoryName: string;
      direction: BudgetItemDirection; actualSource: BudgetItemActualSource;
    }> = [];
    for (const c of categories) {
      if (!c.isDefault) continue;
      for (const it of c.items) {
        if (!it.isDefault || it.isMisc) continue;
        if (linkedIds.has(it.id) || usedNames.has(it.name.toLowerCase())) continue;
        if (dismissedChecklist.includes(it.id)) continue;
        out.push({
          id: it.id, name: it.name, categoryId: c.id, categoryName: c.name,
          direction: it.direction, actualSource: it.actualSource,
        });
      }
    }
    return out;
  }, [plan, categories, dismissedChecklist]);

  /** The months this plan's own payment dates already span — the import template follows them
   *  rather than assuming a season shape the platform doesn't store. */
  const planMonths = useMemo(() => {
    const set = new Set<string>();
    for (const line of plan?.lines ?? []) {
      for (const period of line.periods) {
        const m = monthKeyOf(period.periodDate);
        if (m) set.add(m);
      }
    }
    return [...set].sort();
  }, [plan]);

  function dismissChecklistItem(itemId: string) {
    setDismissedChecklist(prev => {
      const next = prev.includes(itemId) ? prev : [...prev, itemId];
      if (checklistKey) {
        try { localStorage.setItem(checklistKey, JSON.stringify(next)); } catch { /* device memory only */ }
      }
      return next;
    });
  }

  /* Stamp-and-drop + `quiet` — the Money-panel loading convention, written once above
     `useMoneyRevision` in lib/coach-money-refresh.tsx. */
  const loadSeq = useRef(0);
  const load = useCallback(async (quiet = false) => {
    const seq = ++loadSeq.current;
    if (!quiet) { setLoading(true); setError(''); }
    try {
      const [planRes, catRes] = await Promise.all([
        fetch(`/api/coaches/${orgSlug}/teams/${teamId}/budget-plan`),
        // ⚠ teamId, ALWAYS (mig 240): without it the answer excludes this team's own items, so a
        // coach's own vocabulary would vanish from the picker that created it.
        fetch(`/api/coaches/${orgSlug}/budget-items?teamId=${teamId}`),
      ]);
      const planData = await planRes.json();
      const catData  = await catRes.json();
      if (!planRes.ok) throw new Error(planData.error ?? 'Failed to load plan');
      /* ⚠ EVERY BODY IS READ BEFORE ANYTHING IS WRITTEN, so the staleness check has exactly one
         place to sit — above the FIRST setter, never between two of them. A guard part-way down
         leaves the plan written from an old answer and the taxonomy from a new one. */
      if (seq !== loadSeq.current) return;
      setError(''); // a winning load that succeeded means there is no error any more — see the convention
      setPlan(planData.plan);
      setPriorPlan(planData.priorPlan ?? null);
      setDuesAssessed(planData.duesAssessed ?? 0);
      setSeasonTotal(planData.seasonBudgetAmount ?? null);
      setSeasonInput(planData.seasonBudgetAmount != null ? String(planData.seasonBudgetAmount) : '');
      if (typeof planData.seasonYear === 'number') setSeasonYear(planData.seasonYear);
      setCategories(catData.categories ?? []);
    } catch (e: unknown) {
      if (!quiet && seq === loadSeq.current) setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }, [orgSlug, teamId]);

  /** Tells the other mounted money tabs to re-read — see the note on the item manager's `onChanged`. */
  const bumpMoneyRevision = useBumpMoneyRevision();
  /* Mount loud, bump quiet. A bump means the hub's Import menu (or a write on another tab)
     committed rows while this panel sat mounted off-screen — it re-READS rather than remounting,
     so a half-filled line form is never thrown away. Outside the hub there are no bumps. */
  useEffect(() => { load(); }, [load]);
  const quietReload = useCallback(() => { void load(true); }, [load]);
  useOnMoneyRevisionBump(quietReload);

  // Deep link from the Money hub / Dues page: ?generate=1 opens the Generate
  // Installments modal directly (only when the CTA would be shown, which includes
  // money-write capability — read-only coaches never get it). Keyed off the reactive
  // search param (not a mount-only ref latch): under the Money hub this panel stays
  // mounted once visited, so the CTA needs to re-open on a SECOND visit too, not just
  // whichever visit happened to be first.
  const wantsGenerate = seasonSearchParams.get('generate') === '1';
  useEffect(() => {
    if (!wantsGenerate || loading || !plan) return;
    const a = assignments.find(x => x.teamId === teamId);
    if (!a) return; // assignments still loading — try again next render
    if (a.capabilities.money !== 'write') return;
    if (plan.lines.length > 0 && !plan.hasInstallments) setGenOpen(true);
  }, [wantsGenerate, loading, plan, assignments, teamId]);

  // Deep link from the month grid: ?line=<id> opens THIS page's existing edit modal on that line,
  // with its payment periods expanded. The grid is a way to REACH the form that already exists —
  // it never grows an editor of its own. Write-capable only, silently ignored when the line has
  // gone.
  //
  // ⚠⚠ IT RE-ARMS ON THE PARAM, AND A `useRef(false)` ONE-SHOT IS WHY IT SILENTLY STOPPED WORKING
  // (owner, QA §142, 2026-09-04). The grid lives on the Budget-vs-actual TAB, so every one of
  // these links is a cross-tab hop inside the hub — and the hub navigates by `router.replace` on
  // the same route while keeping every visited panel MOUNTED. So the ref was already spent by the
  // time the link arrived: a coach who had opened Budget even once that session landed on the
  // plan list with no drawer and had to hunt for the line by hand. The fire-once-ever guard is
  // only safe on a panel that remounts, and no panel in this hub does — `?starter=1` next door
  // carries the same warning for the same reason.
  //
  // Keyed on the id rather than a boolean so the SAME line can be opened again after a tab
  // round-trip: `line`/`periods` are scrubbed from the address on any other tab's href
  // (ONE_SHOT_KEYS in the hub), which clears the key on the way past. Within one visit it stays
  // held, so a plan refetch — or a save — never reopens the modal over the coach's work.
  const deepLinkLine = seasonSearchParams.get('line');
  const deepLinkPeriods = seasonSearchParams.get('periods') === '1';
  const deepLinkHandled = useRef<string | null>(null);
  useEffect(() => {
    if (!deepLinkLine) { deepLinkHandled.current = null; return; }
    if (deepLinkHandled.current === deepLinkLine || loading || !plan) return;
    const a = assignments.find(x => x.teamId === teamId);
    if (!a) return; // assignments still loading — try again next render
    if (a.capabilities.money !== 'write') return;
    const line = plan.lines.find(l => l.id === deepLinkLine);
    /* ⚠ NOT FOUND IS NOT THE SAME AS HANDLED (/review, 2026-09-04). The key used to be claimed
       above this lookup — so a link that arrived while a QUIET reload was still in flight (a bump
       from another money tab re-READS without ever touching `loading`) met a stale plan, failed
       the lookup, and was swallowed for good: the id was marked done, so the retry could never
       run and the address sat there naming a line nothing would open. Claiming it only once the
       line is in hand costs nothing — in the not-found case the deps are unchanged, so this simply
       re-evaluates when the newer plan lands. */
    if (!line) return;
    deepLinkHandled.current = deepLinkLine;
    const opened = formFromLine(line, seasonYear, lastSplitMode, sourceOfItem(line.itemId));
    // ?periods=1 arrives from a month cell, where the coach was looking at dates — so the period
    // split opens even on a line that is currently a lump sum. It becomes the BASELINE too: our
    // opening the split is not the coach's work, so an untouched form must still close silently.
    if (deepLinkPeriods && opened.whenAnswer !== 'split') opened.whenAnswer = 'split';
    pendingDeepLink.current = () => {
      setEditingLine(line);
      setForm(opened);
      setFormBaseline(opened);
      resetModalTransients();
      setModalOpen(true);
    };
    /* A clean form opens straight away; a dirty one is ASKED about first — see the guard above.
       "Keep editing" DROPS this arrival rather than nagging: the key stays claimed, and the coach
       still reaches the line the ordinary way, because going back to the grid scrubs `line` from
       the address on the way past and re-arms it. */
    void openDeepLinkedLine.current?.();
    // `seasonYear`/`lastSplitMode` are read for the opening form only — listing them would re-run
    // this and reopen the modal over whatever the coach is doing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkLine, deepLinkPeriods, loading, plan, assignments, teamId]);

  // Deep link from the Money hub's plan anchor: ?starter=1 opens the budget starter
  // directly (write-capable + still-empty plan only — the ?generate=1 recipe above).
  // Reactive on the search param for the same reason: the panel can stay mounted
  // across visits under the Money hub, so this needs to re-arm, not fire once ever.
  const wantsStarter = seasonSearchParams.get('starter') === '1';
  useEffect(() => {
    if (!wantsStarter || loading || !plan) return;
    const a = assignments.find(x => x.teamId === teamId);
    if (!a) return; // assignments still loading — try again next render
    if (a.capabilities.money !== 'write') return;
    if (plan.lines.length === 0) setStarterOpen(true);
  }, [wantsStarter, loading, plan, assignments, teamId]);

  /** Write the estimated total, or clear it. `null` is a real value here — clearing must be
   *  possible, and $0 is a different and much louder statement than "I haven't estimated". */
  async function saveSeasonTotal(clear = false) {
    setSeasonError('');
    setSeasonSaving(true);
    try {
      let amount: number | null = null;
      if (!clear) {
        amount = parseFloat(seasonInput);
        if (isNaN(amount) || amount < 0) throw new Error('Enter a valid amount');
      }
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/budget`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ budgetAmount: amount }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Save failed');
      setSeasonTotal(amount);
      if (clear) setSeasonInput('');
      setEditingSeason(false);
    } catch (e: unknown) {
      setSeasonError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSeasonSaving(false);
    }
  }

  /** Everything a freshly-opened modal must forget from the last one it showed. */
  function resetModalTransients() {
    setSaveError('');
    setSaveTried(false);
    setPeriodUndo(null);
    setRescaleDismissedFor(null);
    setLastMoneyEdit(null);
  }

  /** Expand / collapse one line's period breakdown. One definition — the cost rows and the
   *  funding rows had a copy each, and they had already drifted (`&&` vs a ternary). */
  function toggleLineExpanded(lineId: string) {
    setExpandedLines(prev => toggleKey(prev, lineId));
  }

  /**
   * Open the estimated-total editor — from every door, cold start or Edit.
   *
   * ⚠ It RE-SYNCS the field to what is actually stored. Without that, a value typed and then
   * cancelled stayed in the box: estimate $1,000, type $9,000, Cancel, press Edit again and the
   * box offers $9,000 — one unnoticed Save away from overwriting the real number with abandoned
   * scratch. Blank when nothing is set, so the cold-start door reads as an empty field.
   */
  function openEstimateEditor() {
    setSeasonInput(seasonTotal != null ? String(seasonTotal) : '');
    setSeasonError('');
    setEditingSeason(true);
  }

  function openAdd() {
    const fresh = blankLineForm(seasonYear, lastSplitMode);
    setEditingLine(null);
    setForm(fresh);
    setFormBaseline(fresh);
    resetModalTransients();
    setModalOpen(true);
  }

  /** A checklist chip opens the normal Add Line modal with the category + item filled
   *  in and the amount EMPTY — the coach types the number (D-G1). The prefill is also
   *  the dirty baseline, so closing an untouched prefilled form stays silent.
   *
   *  ⚠⚠ IT OPENS ON THE WORD'S OWN SIDE (`/review`, correctness lens, 2026-09-07). This took only
   *  the category and the item and let the form keep its default of "Money the team spends" — so
   *  tapping "+ Grant" or "+ Team sponsorship" (both standard, both money-IN, both legitimately on
   *  this list) opened a form whose first field contradicted the word already chosen underneath it.
   *  That is precisely the contradiction migration 280 exists to remove, arriving through a door the
   *  redesign did not look at. ⚠ It was WORSE before that migration, which is why it went unnoticed:
   *  the server then trusted the client's kind, so the line was STORED as a cost — a money-in word
   *  filed as spending, inflating what every family is asked to pay by its amount. The server now
   *  derives correctly whatever this form says, so the residue was a screen disagreeing with itself
   *  and a line landing in a section the coach did not expect. Both are closed here.
   *  ⚠ The direction comes from the ITEM, never from a guess: it is the same field the picker
   *  filters by, so the prefilled word is one the reopened list actually offers. */
  function openAddFromChecklist(item: {
    id: string; name: string; categoryId: string; categoryName: string;
    direction: BudgetItemDirection; actualSource: BudgetItemActualSource;
  }) {
    const prefilled: LineForm = {
      ...blankLineForm(seasonYear, lastSplitMode),
      direction:    item.direction,
      categoryId:   item.categoryId,
      categoryName: item.categoryName,
      itemId:       item.id,
      itemName:     item.name,
      itemActualSource: item.actualSource,
    };
    setEditingLine(null);
    setForm(prefilled);
    setFormBaseline(prefilled);
    resetModalTransients();
    setModalOpen(true);
  }

  function openEdit(line: RepBudgetLineWithPeriods) {
    const loaded = formFromLine(line, seasonYear, lastSplitMode, sourceOfItem(line.itemId));
    setEditingLine(line);
    setForm(loaded);
    setFormBaseline(loaded);
    resetModalTransients();
    setModalOpen(true);
  }

  function periodSum(): number {
    return form.periods.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
  }

  function periodSumError(): string | null {
    if (form.whenAnswer !== 'split' || form.periods.length === 0) return null;
    const total = parseFloat(form.totalAmount) || 0;
    if (form.periodMode === 'percent') {
      if (total <= 0) return 'Enter the line total first — percentages are computed against it';
      const diff = Math.abs(periodSum() - 100);
      if (diff > 0.1) return `Percentages (${periodSum().toFixed(1)}%) must add up to 100%`;
      return null;
    }
    if (total <= 0) return null;
    const diff = Math.abs(periodSum() - total);
    if (diff > 0.02) return `Period total (${fmt(periodSum())}) must equal line total (${fmt(total)})`;
    return null;
  }

  // Convert the working period values to the DOLLAR amounts we store. In percent
  // mode the last period absorbs the rounding remainder so the sum is exact to
  // the cent; dollar mode passes values through.
  function periodDollarAmounts(): number[] {
    const total = parseFloat(form.totalAmount) || 0;
    const values = form.periods.map(p => parseFloat(p.amount) || 0);
    if (form.periodMode !== 'percent') return values;
    const dollars = values.map(v => Math.round(total * v) / 100);
    if (dollars.length > 0) {
      const allButLast = dollars.slice(0, -1).reduce((s, v) => s + v, 0);
      dollars[dollars.length - 1] = Math.round((total - allButLast) * 100) / 100;
    }
    return dollars;
  }

  // Toggle $ ⇄ % — converting existing values when the line total allows it.
  // The last row absorbs the rounding remainder (an equal 3-way split would
  // otherwise convert to 33.3×3 = 99.9% and spuriously fail validation).
  function switchPeriodMode(mode: 'amount' | 'percent') {
    setPeriodUndo(null);
    setForm(f => {
      if (f.periodMode === mode) return f;
      const total = parseFloat(f.totalAmount) || 0;
      const values = f.periods.map(p => parseFloat(p.amount));
      const allNumeric = total > 0 && values.length > 0 && values.every(v => !isNaN(v));
      const converted = values.map(v => {
        if (isNaN(v) || total <= 0) return null;
        return mode === 'percent'
          ? Math.round((v / total) * 1000) / 10   // $ → %
          : Math.round(total * v) / 100;          // % → $
      });
      if (allNumeric) {
        const whole = mode === 'percent' ? 100 : total;
        const allButLast = converted.slice(0, -1).reduce((s: number, v) => s + (v ?? 0), 0);
        const scale = mode === 'percent' ? 10 : 100; // one decimal for %, cents for $
        converted[converted.length - 1] = Math.round((whole - allButLast) * scale) / scale;
      }
      const periods = f.periods.map((p, i) => ({
        ...p,
        amount: converted[i] == null ? '' : String(converted[i]),
      }));
      return { ...f, periodMode: mode, periods };
    });
  }

  // ── The period split: mode, rows, and the way back ───────────────────────────────
  // Owner ruling 2026-08-12: choosing a mode is a fresh decision about how this line is split, so
  // it RESETS the periods rather than converting them. Converting only works when the shapes
  // correspond and they don't — twelve months mapped onto four quarters piled three rows into each
  // quarter, and mapping back produced three Januaries. One rule, no exception for the one
  // conversion (months → dates) that would have been lossless.
  /**
   * Answering "when does this money move?".
   *
   * ⚠ THE PERIODS FOLLOW THE ANSWER, and the two conversions that lose work are the ones worth
   * reading twice:
   *   · → `month` keeps the FIRST existing period if there is one (so split → one month keeps the
   *     month a coach already picked) and otherwise starts a blank one. Anything beyond the first
   *     is dropped, which is what "one month" means.
   *   · → `none` clears the periods outright.
   * Both are offered `periodUndo`, the same one-tap restore the split-mode chips already use, for
   * the same reason: this is the single worst thing in the product to retype.
   *
   * ⚠ A MONTH'S AMOUNT IS NEVER TYPED. It is the line total, resolved at save (see the payload) —
   * so there is no second money field on this form that could drift out of step with the first.
   */
  function chooseWhenAnswer(next: WhenAnswer) {
    if (form.whenAnswer === next) return;
    setForm(f => {
      const had = f.periods;
      const worthKeeping = usesPeriods(f)
        && (had.length > 1 || had.some(p => p.label.trim() || p.date || p.amount.trim()));
      if (next === 'none') {
        setPeriodUndo(worthKeeping
          ? {
              periods: had,
              splitMode: f.splitMode,
              text: `Marked “No date yet”. The previous ${had.length} `
                + `period${had.length === 1 ? '' : 's'} ${had.length === 1 ? 'was' : 'were'} cleared.`,
            }
          : null);
        markPeriodsEdited();
        return { ...f, whenAnswer: next, periods: [] };
      }
      if (next === 'month') {
        const kept = had[0] ?? blankPeriod('months', seasonYear);
        setPeriodUndo(worthKeeping && had.length > 1
          ? {
              periods: had,
              splitMode: f.splitMode,
              text: `Now one month. The other ${had.length - 1} `
                + `period${had.length === 2 ? '' : 's'} ${had.length === 2 ? 'was' : 'were'} cleared.`,
            }
          : null);
        markPeriodsEdited();
        return { ...f, whenAnswer: next, splitMode: 'months', periods: [kept] };
      }
      /* → split. A coach arriving from `none` needs the one empty period a new split starts with
         (owner ruling: one, never zero and never twelve); one arriving from `month` keeps theirs. */
      setPeriodUndo(null);
      return {
        ...f,
        whenAnswer: next,
        periods: had.length > 0 ? had : [blankPeriod(f.splitMode, seasonYear)],
      };
    });
    setSaveTried(false);
  }

  function chooseSplitMode(mode: PeriodSplitMode) {
    if (form.splitMode === mode) return;
    rememberSplitMode(mode);
    markPeriodsEdited();
    setForm(f => {
      const had = f.periods;
      const worthKeeping = had.length > 1 || had.some(p => p.label.trim() || p.amount.trim());
      setPeriodUndo(worthKeeping
        ? {
            periods: had,
            splitMode: f.splitMode,
            text: `Now splitting by ${SPLIT_MODE_NOUN[mode]}. The previous ${had.length} `
              + `period${had.length === 1 ? '' : 's'} ${had.length === 1 ? 'was' : 'were'} cleared.`,
          }
        : null);
      return { ...f, splitMode: mode, periods: [blankPeriod(mode, seasonYear)] };
    });
    setSaveTried(false);
  }

  function addPeriod() {
    setPeriodUndo(null);
    setForm(f => ({
      ...f,
      periods: [...f.periods, { ...BLANK_PERIOD, date: nextPeriodDate(f.splitMode, f.periods, seasonYear) }],
    }));
  }

  function removePeriod(index: number) {
    setPeriodUndo(null);
    markPeriodsEdited();
    setForm(f => ({ ...f, periods: f.periods.filter((_, j) => j !== index) }));
  }

  function fillSeason() {
    setForm(f => {
      const filled = fillSeasonPeriods(f.splitMode, f.periods, seasonYear);
      const added = filled.length - f.periods.length;
      setPeriodUndo(added > 0
        ? {
            periods: f.periods,
            splitMode: f.splitMode,
            text: `Added ${added} ${f.splitMode === 'months' ? 'month' : 'quarter'}${added === 1 ? '' : 's'}.`,
          }
        : null);
      return added > 0 ? { ...f, periods: filled } : f;
    });
  }

  function clearPeriods() {
    markPeriodsEdited();
    setForm(f => {
      setPeriodUndo({
        periods: f.periods,
        splitMode: f.splitMode,
        text: `Removed ${f.periods.length} period${f.periods.length === 1 ? '' : 's'}.`,
      });
      return { ...f, periods: [] };
    });
  }

  function undoPeriodChange() {
    if (!periodUndo) return;
    // A mode change is undone WHOLE — putting twelve month-rows back into quarter mode would be
    // meaningless.
    rememberSplitMode(periodUndo.splitMode);
    markPeriodsEdited();
    setForm(f => ({ ...f, splitMode: periodUndo.splitMode, periods: periodUndo.periods }));
    setPeriodUndo(null);
  }

  /** The month/quarter picker's value, and what a change to it writes back. The selection IS the
   *  date (months → the 1st, quarters → the first day of the quarter), which is why the split mode
   *  needs no column of its own. */
  function periodSlotValue(row: PeriodRow, mode: PeriodSplitMode): string {
    const ymd = readDate(row.date);
    if (!ymd) return '';
    return `${ymd.year}|${mode === 'months' ? ymd.month : quarterOf(ymd.month)}`;
  }

  function setPeriodSlot(index: number, mode: PeriodSplitMode, value: string) {
    const [yearRaw, slotRaw] = value.split('|');
    const year = Number(yearRaw);
    const slot = Number(slotRaw);
    if (!Number.isFinite(year) || !Number.isFinite(slot)) return;
    const date = mode === 'months' ? monthDate(year, slot) : quarterDate(year, slot);
    setPeriodField(index, 'date', date);
  }

  function setPeriodField(index: number, field: keyof PeriodRow, value: string) {
    if (field === 'amount') markPeriodsEdited();
    setForm(f => {
      const periods = [...f.periods];
      periods[index] = { ...periods[index], [field]: value };
      return { ...f, periods };
    });
  }

  /**
   * "Rescale the split proportionally" (P2, owner Q2) — refit the existing split to the edited
   * total. Each period keeps its share of the old sum, EXCEPT where the rows were uneven only
   * because of rounding, which come back exactly even.
   *
   * ⚠ THE BUTTON USED TO SAY "evenly" AND DID NOT MEAN IT (owner, QA §133 2026-09-04). Both halves
   * were wrong. The word promised a shape the arithmetic never produced — and the arithmetic
   * preserved rounding noise as though it were a decision, so a $5,200 split typed as
   * 1733 / 1733 / 1734 refitted onto $6,000 as 1999.62 / 1999.62 / 2000.76 and a coach who asked
   * for $6,000 across three months was looking at something that wasn't in $2,000 increments.
   * `refitSplit` holds the tolerance that tells a real shape from rounding.
   */
  function rescaleSplit() {
    setPeriodUndo(null);
    setRescaleDismissedFor(null);
    setForm(f => {
      // ⚠ DOLLARS ONLY. The banner that offers this already requires it, but the function must not
      // depend on its one caller staying the only one: refitting percent shares onto a dollar total
      // is nonsense arithmetic that would fail silently (/review).
      if (f.periodMode !== 'amount') return f;
      const total = parseFloat(f.totalAmount) || 0;
      const values = f.periods.map(p => parseFloat(p.amount) || 0);
      if (total <= 0 || f.periods.length === 0) return f;
      const amounts = refitSplit(values, total);
      return { ...f, periods: f.periods.map((p, i) => ({ ...p, amount: String(amounts[i]) })) };
    });
  }

  // Fill periods evenly (in the current mode); the last row absorbs the remainder.
  function splitEvenly() {
    setPeriodUndo(null);
    setForm(f => {
      const n = f.periods.length;
      if (n === 0) return f;
      const total = parseFloat(f.totalAmount) || 0;
      const whole = f.periodMode === 'percent' ? 100 : total;
      if (whole <= 0) return f;
      const shares = evenShares(whole, n);
      const periods = f.periods.map((p, i) => ({ ...p, amount: String(shares[i]) }));
      return { ...f, periods };
    });
  }

  /**
   * Everything that would stop this line saving, in the order the coach meets it on screen.
   *
   * Deliberately short. A period's NAME is derived when left blank and its DATE is optional
   * (an undated period simply can't be placed on a calendar, which the row says out loud), so the
   * only things left that can block a save are the ones that are genuinely wrong: money missing,
   * or money that doesn't add up.
   */
  function collectProblems(): FormProblem[] {
    const out: FormProblem[] = [];

    /* ⚠ EVERY LINE IS NAMED BY ITS ITEM, IN BOTH DIRECTIONS (mig 243). Money in used to be named
       by a typed description, because the 2026-08-13 ruling that "a spending taxonomy has nothing
       to say about a bottle drive" was read as "money in needs its own list" — it does not. A coach
       can already create categories and items, so the same picker serves both directions, and the
       report can finally put a hosted tournament's revenue next to its costs. */
    if (!form.itemId) {
      out.push({
        id: 'item',
        message: 'Pick a category and item — they name this line on your plan and on your report.',
        focusId: FOCUS_ITEM,
      });
    }
    const total = parseFloat(form.totalAmount);
    if (isNaN(total) || total <= 0) {
      out.push({ id: 'total', message: 'Enter a total amount for this line.', focusId: FOCUS_TOTAL });
    }

    /* ⚠⚠ THE THIRD PART OF THE ONE RULE (owner ruling 2026-09-04): a line says what it is
       (category and item), how much it is (total), and WHEN IT HAPPENS. Unanswered blocks the
       save exactly as the first two do. "No date yet" is a complete answer and passes here —
       what is refused is not undated money, it is silence. */
    if (form.whenAnswer === null) {
      out.push({
        id: 'when',
        message: 'Say when this money moves — a month, a split, or “No date yet”.',
        focusId: FOCUS_WHEN,
      });
    }

    /* One month, no month picked. Its own problem rather than a period-amount one: the coach is
       looking at a single select, not at a split, so "Enter an amount for Period 1" would name a
       row that is not on their screen. */
    if (form.whenAnswer === 'month' && !form.periods[0]?.date) {
      out.push({
        id: 'when-month',
        message: 'Pick the month this money moves.',
        focusId: FOCUS_WHEN,
      });
    }

    /* ⚠ THE SPLIT'S OWN CHECKS ARE FOR THE SPLIT ALONE. A one-month line carries a period too,
       but its amount is the line total resolved at save — it is never typed, so it can never be
       blank and can never fail to add up. Running these over it would block a save on a field the
       form does not show. */
    if (form.whenAnswer === 'split') {
      if (form.periods.length === 0) {
        out.push({
          id: 'no-periods',
          message: 'Add at least one period, or choose a different answer above.',
          focusId: FOCUS_ADD,
        });
      }
      form.periods.forEach((p, i) => {
        const amount = parseFloat(p.amount);
        if (isNaN(amount) || amount <= 0) {
          out.push({
            id: `period-${i}`,
            // Names the period the coach is looking at, not "row 4" — which is the whole reason
            // the derived label is shown in the field rather than only written on save.
            message: `Enter an amount for “${resolvedPeriodLabel(form.splitMode, p, i)}”.`,
            focusId: focusPeriodAmount(i),
          });
        }
      });
      // Only worth saying once the amounts are all present: a split with three blank rows cannot
      // add up, and counting that as a thirteenth problem would overstate the work left.
      const anyAmountMissing = out.some(p => p.id.startsWith('period-'));
      const sumErr = anyAmountMissing ? null : periodSumError();
      if (sumErr) out.push({ id: 'sum', message: sumErr, focusId: focusPeriodAmount(0) });
    }
    return out;
  }

  /** The figure the "No date yet" consequence line names. Zero or unparsed means the coach has not
   *  typed an amount yet, and the sentence says "this money" rather than "this $0.00" — a
   *  consequence quoted at $0.00 reads as though nothing is at stake, which is the opposite of
   *  what the line is for. */
  const lineTotalForConsequence = (() => {
    const n = parseFloat(form.totalAmount);
    return Number.isFinite(n) && n > 0 ? n : 0;
  })();

  /**
   * WHAT THIS LINE WILL BE STORED AS — worked out from the coach's one answer and the word they
   * picked (mig 280). Null until a word is picked, or when its source could not be read back.
   *
   * ⚠ FOR THE SCREEN ONLY. The kind that is actually stored is derived on the SERVER, from the row
   * it fetches and authorises — a client-computed kind travelling in the request body would be the
   * second question again, wearing a different hat.
   */
  const formLineKind: BudgetLineKind | null = form.itemId && form.itemActualSource
    ? budgetLineKindForItem({ direction: form.direction, actualSource: form.itemActualSource })
    : null;

  const problems = modalOpen ? collectProblems() : [];
  const problemIds = new Set(problems.map(p => p.id));
  /** Nothing is drawn as at fault until Save has actually been pressed. */
  const flagged = (id: string) => saveTried && problemIds.has(id);

  /* P2 — the coach edited the TOTAL of a line that already had a split, and the split no longer
     adds up. Today's quiet version of this was the silent desync the server now 409s on; the
     banner is the same refusal made early and actionable. Only for a split that EXISTED when the
     modal opened (a fresh split being typed is ordinary work-in-progress, not a mismatch), only in
     dollar mode (percent shares rescale themselves against the total), and only while the TOTAL is
     the field the coach touched last — someone part-way through retyping the rows by hand is
     already adjusting it themselves and does not need to be asked. ⚠ That last clause replaced a
     comparison against the total the modal OPENED with, which stranded the coach who typed the
     original figure back: see `lastMoneyEdit`. */
  const splitOutOfStep = modalOpen
    && form.whenAnswer === 'split'
    && form.periodMode === 'amount'
    && formBaseline.whenAnswer === 'split'
    && form.periods.length > 0
    && lastMoneyEdit === 'total'
    && rescaleDismissedFor !== form.totalAmount
    && (parseFloat(form.totalAmount) || 0) > 0
    && Math.abs(periodSum() - (parseFloat(form.totalAmount) || 0)) > 0.02;

  /**
   * The fix for "the button looks broken": a save that can't go through MOVES the form to the
   * thing at fault and puts the cursor in it. The old behaviour printed a reason into a strip at
   * the bottom of a scrolling body, where it was usually off-screen — so pressing Save appeared to
   * do nothing at all.
   */
  function jumpToProblem(problem: FormProblem) {
    const node = document.getElementById(problem.focusId);
    if (!node) return;
    node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    node.focus({ preventScroll: true });
  }

  async function handleSaveLine() {
    if (problems.length > 0) {
      setSaveTried(true);
      setSaveError('');
      jumpToProblem(problems[0]);
      return;
    }

    /* ⚠⚠ ONE RULE, BOTH DIRECTIONS (owner ruling 2026-09-09). This branched: a money-in line kept
       whatever was typed and did NOT fall back to its word, "because Fundraising drive is a worse
       row label than Chocolate sale". That reasoning outlived the field it depended on — the
       money-in description input was deleted on 2026-08-16, so from that day the branch preserved
       a word no coach could edit and every NEW line fell through to the empty string anyway.
       The word names the row in both directions now, and this column is only the NOT NULL text the
       server keeps synced to it. A coach who wants their own wording makes a word; see the picker's
       hint. */
    const description = form.description.trim() || form.itemName.trim();
    const totalAmount = parseFloat(form.totalAmount);

    setSaving(true);
    setSaveError('');
    try {
      const isEdit = !!editingLine;
      const url    = isEdit
        ? `/api/coaches/${orgSlug}/teams/${teamId}/budget-plan/lines/${editingLine!.id}`
        : `/api/coaches/${orgSlug}/teams/${teamId}/budget-plan/lines`;

      /* ⚠ THE SPLIT RIDES THE SAME REQUEST NOW (P2). This used to be a second POST after the line
         saved, and its response was never read — a PATCH that changed the total whose follow-up
         periods write failed left a split that silently no longer added up. One request, validated
         together on the server, lands whole or not at all. An empty array on an edit is the
         explicit "clear the split" (the toggled-off case); a create simply sends none. */
      const dollarAmounts = periodDollarAmounts();
      // The label the coach typed, else the one the form has been showing them all along
      // ("Apr 2027"). The stored column is NOT NULL and the API rejects a blank, so resolving
      // here is what lets the field be optional on screen.
      /* ⚠ A ONE-MONTH LINE'S PERIOD CARRIES THE WHOLE TOTAL, resolved here rather than typed. It
         is the only place the two figures meet, which is what stops a second money field existing
         on the form at all — and why `periodSumError` and the rescale banner both sit out this
         answer. `dollarAmounts` is the SPLIT's arithmetic (it honours $/% mode); a single month
         has no share to compute. */
      const periodsPayload = !usesPeriods(form) || form.periods.length === 0
        ? []
        : form.whenAnswer === 'month'
          ? [{
              periodLabel: resolvedPeriodLabel('months', form.periods[0], 0),
              periodDate:  form.periods[0].date || null,
              amount:      Math.round((parseFloat(form.totalAmount) || 0) * 100) / 100,
              sortOrder:   0,
            }]
          : form.periods.map((p, i) => ({
              periodLabel: resolvedPeriodLabel(form.splitMode, p, i),
              periodDate:  p.date || null,
              amount:      dollarAmounts[i],
              sortOrder:   i,
            }));

      const res  = await fetch(url, {
        method:  isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description,
          // Both directions carry the taxonomy from mig 243. A pre-243 money-in line has none and
          // keeps working in the "No category / Not itemized" bucket until a coach re-files it.
          categoryId:  form.categoryId || null,
          itemId:      form.itemId,
          totalAmount,
          /* ⚠ NO `lineKind` (mig 280). The server derives it from the item this line is filed
             against, so the impossible pairing is not merely refused — there is nothing left to
             express it with. Sending one would be ignored; sending none says so honestly. */
          notes:       form.notes.trim() || null,
          // HOW the split was built (mig 274) — remembered, so it reopens as it was made.
          splitMode:   periodsPayload.length > 0 ? form.splitMode : null,
          periods:     periodsPayload,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to save');

      setModalOpen(false);
      await load();
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  /** "Bring last season's plan" (owner Q8b) — the later door for a coach who declined the carry
   *  at rollover. The server re-checks emptiness (409) and copies through the same shared helper
   *  the rollover runs, split modes included. */
  async function handleCarryPrior() {
    setCarryBusy(true);
    setCarryError('');
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/budget-plan/carry`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'The carry failed — try again in a moment.');
      const carried = data.carried as { linesCopied: number; periodsCopied: number; failed: number };
      setImportMessage(
        `Brought ${carried.linesCopied} line${carried.linesCopied === 1 ? '' : 's'} forward from the ${data.fromYear} season`
        + `${carried.failed > 0 ? ` — ${carried.failed} could not be copied` : ''}.`,
      );
      await load();
    } catch (e: unknown) {
      setCarryError(e instanceof Error ? e.message : 'The carry failed — try again in a moment.');
    } finally {
      setCarryBusy(false);
    }
  }

  async function handleDelete(lineId: string) {
    setDeleting(true);
    setDeleteError('');
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/budget-plan/lines/${lineId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Failed to delete');
      }
      setDeletingId(null);
      // The edit modal is this dialog's only door now — the deleted line's form must not
      // survive its line. A no-op when the modal wasn't open.
      setModalOpen(false);
      await load();
    } catch (e: unknown) {
      setDeleteError(e instanceof Error ? e.message : "Couldn't delete this line. Try again in a moment.");
    } finally {
      setDeleting(false);
    }
  }


  /* Memoised because the line-edit form lives in this same component: without it, every
     keystroke in the Add/Edit modal re-ran the whole category→item rollup over a plan that had
     not changed. */
  const allLines = useMemo(() => plan?.lines ?? [], [plan]);

  /**
   * "Which lines have no date?" — a FILTER, and deliberately not a sort (owner ruling 2026-09-04).
   * Month names have no useful order: alphabetical puts April first and December second, and
   * chronological is what the By-period view already is. What a coach actually wants from this
   * column is *the subset that still needs an answer*, in one sitting, near season start.
   *
   * ⚠ IT NARROWS THE LIST, NOT THE TOTALS. The plan's own figures above the list are the season's,
   * always — a filtered view whose Headroom moved with it would be the "tag filter" defect this
   * report already refused once (a slice of spending set against the whole plan, so Headroom ROSE
   * as you narrowed).
   */
  const [whenFilter, setWhenFilter] = useState<'all' | 'undated' | 'dated'>('all');

  /** A line counts as undated when ANY of its plan money carries no date — so a partly-dated split
   *  (a dated deposit, an undated balance) is in the "No date yet" set. That is the whole point:
   *  its $1,000 is exactly as absent from a to-date reading as a lump sum's is, and the old column
   *  hid it behind "Mar · 2 chunks". */
  const lineIsUndated = useCallback((l: RepBudgetLineWithPeriods) =>
    whenSummary(l.periods ?? [], Number(l.totalAmount ?? 0) || 0).undated > 0.005, []);

  const undatedLines = useMemo(
    () => allLines.filter(lineIsUndated), [allLines, lineIsUndated]);

  const shownLines = useMemo(() => (
    whenFilter === 'all' ? allLines
      : whenFilter === 'undated' ? allLines.filter(lineIsUndated)
        : allLines.filter(l => !lineIsUndated(l))
  ), [allLines, whenFilter, lineIsUndated]);

  const groups   = useMemo(() => groupLines(shownLines), [shownLines]);
  /** How many of the words in this team's picker the team itself created — the gate on the
   *  "Manage our words" door, since the modal can only ever change those.
   *  ⚠ UP HERE WITH THE OTHER MEMOS, ABOVE THE EARLY RETURNS. It is memoised for the same reason
   *  they are — the line-edit form's state lives in this component, so an un-memoised version
   *  re-scans every category on every keystroke — and a hook below `if (ctxLoading) return` would
   *  change hook order between renders. */
  const ownItemCount = useMemo(
    () => categories.reduce((n, c) => n + c.items.filter(i => i.teamId === teamId).length, 0),
    [categories, teamId]);
  /* The picker's category order, so the funding sections (and the forgetting list's categories) read
     in the order the coach chose them from — the List, the grid and the file all take the same map.
     Memoised with the siblings above, for the same reason: this component's form state re-renders
     on every keystroke, and the forgetting list's open/close state now re-renders it on every tap. */
  const categoryOrder = useMemo(() => new Map(categories.map(c => [c.id, c.sortOrder])), [categories]);
  /* ⚠ THE FILTERED SET, so the money-in sections narrow with the cost ones. Filtering only half the
     list would leave a coach who asked for "No date yet" looking at every dated fundraising line as
     well. */
  const fundingGroups = useMemo(
    () => groupFundingLines(shownLines.filter(l => isFundingKind(l.lineKind)), categoryOrder),
    [shownLines, categoryOrder]);
  const checklistIndex = useMemo(() => groupChecklist(checklistItems, categoryOrder), [checklistItems, categoryOrder]);

  if (ctxLoading) return <CoachLoading label="Loading your budget…" />;
  if (!assignment) return <p className={styles.muted}>Team not found.</p>;

  const { sides: checklistSides, categoryCount: checklistCategoryCount } = checklistIndex;
  // Read-only money assistants see the plan but no write affordances (server
  // enforces regardless; this matches the gating on the Dues/BvA pages).
  const moneyCanWrite = (page.capabilities?.money === 'write');

  /* P3 — Collapse all / Expand all, at the SECTION level: every cost category plus the money-in
     sections. Expand-all clears the whole closed set, item folds included — "show me everything"
     means everything. */
  const sectionKeys = [
    ...groups.map(g => catKey(g.categoryName)),
    ...fundingGroups.map(g => `group:${g.ref.key}`),
  ];
  const allSectionsClosed = sectionKeys.length > 0 && sectionKeys.every(k => closedSections.has(k));
  function toggleAllSections() {
    setClosedSections(allSectionsClosed ? new Set() : new Set(sectionKeys));
  }

  /* ⚠ THE SAME CONTROL SERVES THE OTHER OUTLINE (owner, §133 walk 2026-09-04). The By-period grid
     folds the same categories the List does — it just keeps its own closed set, because the two are
     different shapes — and the button was rendered for the List alone, so a coach in the grid could
     only fold one category at a time. Null here IS "not in the grid": the view builds only where it
     is drawn, and the branch below reads that rather than re-testing the mode. */
  const periodView = viewMode === 'period' ? buildPeriodView(allLines, granularity, { estimatedTotal: seasonTotal, categoryOrder }) : null;
  const gridKeys = periodView ? periodView.groups.map(g => g.key) : [];
  const allGridClosed = gridKeys.length > 0 && gridKeys.every(k => gridClosed.has(k));
  const foldAll = periodView
    ? {
        keys: gridKeys,
        allClosed: allGridClosed,
        toggle: () => setGridClosed(allGridClosed ? new Set() : new Set(gridKeys)),
      }
    : { keys: sectionKeys, allClosed: allSectionsClosed, toggle: toggleAllSections };

  /* P1 — is the form's chosen item already carrying another line on this plan? Then this line is
     a SECOND line on that item, and the Notes field becomes the one question that keeps the fold
     and the export from ever being nameless: "What makes this line different?". Encouraged, never
     blocking — collectProblems never reads it. The editing line itself doesn't count: reopening
     an existing line must not tell a coach their only line is a second one. */
  const itemSiblingCount = modalOpen && form.itemId
    ? allLines.filter(l => l.itemId === form.itemId && l.id !== editingLine?.id).length
    : 0;

  // ONE arithmetic, computed in one place (lib/coach-budget-totals) so the planner, the Money hub
  // and Budget vs. Actual cannot drift apart on the same two numbers. ⚠ The effective total is the
  // ESTIMATE whenever one is set — in both directions (owner ruling 2026-08-12). The old
  // max(itemized, estimate) kept a lower estimate in the database and then ignored it everywhere.
  const totals = computeBudgetTotals({
    lines: allLines,
    estimatedTotal: seasonTotal,
    rosterCount: plan?.rosterCount ?? 0,
  });
  // The plan minus everything already answering for it — funding lines and scheduled dues.
  // Signed on purpose: negative means players are scheduled to pay more than the plan now needs.
  const leftToFund = r2(totals.totalPlanned - totals.expectedFunding - duesAssessed);
  /* THE SUBTOTALS THE TABLE PRINTS SUM THE LINES THE TABLE SHOWS (owner ruling 2026-09-08). Under
     the When filter a subtotal that kept the season's figure would sit over rows that do not add up
     to it — the exact mismatch the ladder exists to remove. The season's own close (Costs less
     funding, installments, short/buffer) belongs to the whole plan and steps aside while a filter
     is on; the tiles above still carry it. The estimate is a season fact, so it rides only the
     unfiltered table. */
  const tableTotals = whenFilter === 'all'
    ? totals
    : computeBudgetTotals({ lines: shownLines, estimatedTotal: null, rosterCount: 0 });
  // The genuinely-blank first visit: no lines AND no estimate. The $0 summary is suppressed so the
  // first-run surface leads; it returns the moment anything exists. ⚠ The summary is also the only
  // UI that SETS an estimate, so "set an estimated total instead" (a first-run door) flips
  // editingSeason and the summary comes back — an estimate-only budget must stay reachable from a
  // cold start (review finding).
  // ⚠ Dues count as "something exists" (review finding): a team whose dues were set by hand
  // before any budget has real scheduled money, and hiding the card would hide it — the same
  // rule the list already applies to funding-only plans.
  const trueEmpty      = allLines.length === 0 && seasonTotal == null && !editingSeason && duesAssessed === 0;

  // Page-level action ruling 2026-08-13: "Add Line" acts on the BUDGET, and the nearest chrome
  // that names the budget is the plan's own control row — not the Money hub header above it,
  // which names the container. So the create lives in the toolbar below.

  // Rule 5, one name one weight: every page's main create is the FILLED LIME button. Add Line
  // was outlined while New Fundraiser one tab away was filled — the same job, two weights.
  const addLineButton = moneyCanWrite ? (
    <>
      <button type="button" className={shared.btnPrimary} onClick={openAdd}>
        <Plus size={15} aria-hidden /> Add Line
      </button>
      {/* ⚠⚠ THE ONE DOOR TO A TEAM'S OWN VOCABULARY, AND IT LIVES HERE ON PURPOSE (Money form P2,
          2026-08-16). Migration 246 made a word's side part of what it is and the picker filters by
          it, so "I put it on the wrong side" needs an answer somewhere. The Budget Plan is where a
          word first becomes a row a coach reads, it is the screen the money redesign leaves
          untouched through P3 and P4, and the shape already exists one tab over — Transactions
          carries "Manage tags" beside its own create, for exactly the same reason. Team Settings was
          considered and refused: these are budget content a coach writes while working, not
          configuration.
          ⚠ Only when the team HAS words of its own — an empty manager is a button that teaches
          nothing, the same gate "Manage tags" applies to its own library. */}
      {ownItemCount > 0 && (
        <button
          type="button"
          className={shared.btnSecondary}
          onClick={() => setItemManagerOpen(true)}
          title="Rename one of your team's own items, or move it to the other side"
        >
          <Settings2 size={15} aria-hidden /> Manage our words
        </button>
      )}
    </>
  ) : null;

  /**
   * The plan as it stands, built at click time — grouped exactly as the screen is grouped, in
   * whichever view is on screen (owner export rider, 2026-09-02). Not write-gated: reading is
   * not writing.
   *
   * ⚠ THE PDF IS ALWAYS THE STATEMENT, even from the period view — the BvA convention (owner
   * ruling 2026-08-21: a season of month columns does not fit paper), announced in the file-type
   * dialog via `pdfHint`, never a surprise in the downloads folder.
   */
  function buildPlanExport(format: MoneyExportFormat) {
    const shared = {
      scopeLabel: assignment?.programYearName ?? '',
      teamName: assignment?.teamName ?? '',
      emptyMessage: 'There are no budget lines to export yet — build the plan first.',
    };
    if (viewMode === 'period' && format !== 'pdf') {
      const view = buildPeriodView(allLines, granularity, { estimatedTotal: seasonTotal, categoryOrder });
      const columns = budgetPeriodGridColumns(view);
      const built = budgetPeriodGridRows(view);
      return {
        dataset: `budget-plan-by-${granularity}`,
        title: `Budget plan by ${GRANULARITY_LABEL[granularity].toLowerCase()}`,
        columns,
        rows: built.rows,
        rowKinds: built.kinds,
        ...shared,
      };
    }
    /* ⚠ THE FILE IS THE WHOLE PLAN, WHATEVER THE WHEN FILTER SHOWS (/review, 2026-09-08). `groups`
       follows the filter; `lines` and `totals` never did — so a filtered export carried a season
       "Planned costs" over a slice of category rows, and a season Funding band under filtered
       costs. A filter is a working view; the file is the record, and its subtotals must sum its
       own rows. */
    const built = budgetPlanStatementRows({
      groups: whenFilter === 'all' ? groups : groupLines(allLines),
      lines: allLines,
      totals,
      duesAssessed,
      leftToFund,
      categoryOrder,
    });
    return {
      dataset: 'budget-plan',
      title: 'Season Budget Plan',
      columns: BUDGET_PLAN_COLUMNS,
      rows: built.rows,
      rowKinds: built.kinds,
      // Currency for jsPDF, which has no number formatter of its own — the shared Money cell
      // spelling, sign kept (a planned buffer's label carries the direction; the figure is abs).
      pdfRows: (rows: Array<Record<string, string | number>>) => rows.map(r => BUDGET_PLAN_COLUMNS.map(c => {
        const v = r[c.key];
        if (c.format !== 'currency') return String(v ?? '');
        // A band heading's money cell is EMPTY, not a dash: a dash says "nothing happened" on a row
        // that carries no money at all (the PDF never reads row kinds, so the blank is the signal).
        if (v === '') return '';
        return v === undefined || v === null ? '—' : formatMoneyCell(Number(v));
      })),
      ...shared,
    };
  }

  const planExport = (
    <MoneyExportButton
      label="Budget plan"
      formats={['xlsx', 'csv', 'pdf']}
      build={buildPlanExport}
      pdfHint={viewMode === 'period'
        ? 'The whole-season plan statement — the period grid is in Excel and CSV'
        : undefined}
      disabled={allLines.length === 0}
    />
  );

  return (
    // The shared width pair, not a local hardcode (P4) — the utility exists, by its own comment,
    // to keep Budget and BvA in lockstep; both tabs now compose it.
    <div className={`${shared.page} ${shared.pageWide}`}>
      {/* ⚰ The "Back to Money" row that stood here is GONE (back-in-header ruling, 2026-08-26).
          It was one of the TWO surviving hand-written copies of the retired back-link style — the
          shared-component pass missed both because they never imported the component. It rendered
          only on the legacy standalone route, and every legacy money route is a permanent redirect
          into the hub, so no coach has seen it since. Deleted as dead code. */}
      {/* ⚰ And so is this panel's own CoachPageHeader (cleanup tranche 6, 2026-09-01). Its title,
          icon and help topic only ever rendered on the standalone route; its Import button was the
          hub's `Import ▾` menu a second time. Inside the hub the header collapsed to an actions row
          this panel had none of, so it rendered nothing at all. The empty state below still offers
          the importer — see `setImportOpen`. Reasoning at the hub's mount in accounting/page.tsx. */}
      {importMessage && (
        <p className={styles.importedNote} role="status">{importMessage}</p>
      )}

      {loading ? (
        <CoachLoading label="Loading your budget…" />
      ) : error ? (
        <CoachLoadError message={error} onRetry={() => { void load(); }} />
      ) : (
        <>
          {/*
            THE PLAN CARD (owner-approved mockup, artifact d37d62e3 round 3, 2026-08-13 —
            supersedes the summary ladder of mockup 30812492). Three categories side by side, no
            operators: Planned costs · Expected fundraising · Player installments. The third
            figure carries the season's story — CALCULATED and tagged "Estimated" until dues
            schedules exist, then it IS the official scheduled figure. A deliberate over-schedule
            is a BUFFER, stated in ordinary caption ink — a coach who planned it must not meet a
            red flag on every visit (owner ruling). Coming up SHORT of the plan is the one
            cautionary state, in amber, with the re-run door beside it. Per player appears only
            beside the ESTIMATE: once real installments exist they are the number, and a computed
            per-player alongside them is exactly the stale figure this card exists to retire.
          */}
          {!trueEmpty && (
          <>
          {/* ⚠ THE SHARED BAND (owner D3, 2026-09-03). This card was approved from its own
              mockup (artifact d37d62e3 round 3, 2026-08-13) and everything that ruling settled
              individually SURVIVES inside the tiles: the Estimated/Scheduled chip, the estimate's
              relationship caption in red when the lines outgrow it, the buffer-not-a-warning
              reading, the amber short-of-plan state and both doors.

              ⚠ WHAT WENT, and only this: the "The plan" panel title (the tab above already names
              the screen) and the inline line-counts, which move from inside the labels into the
              captions where the standard puts a qualifier. The estimate door, homeless once the
              title went, rides the Planned-costs caption in both states rather than only after an
              estimate exists. */}
          <MoneySummaryBand
            ariaLabel="Budget plan summary"
            tiles={[
              {
                key: 'planned',
                label: 'Planned costs',
                figure: fmt(totals.totalPlanned),
                caption: seasonTotal != null ? (
                  <span className={totals.overPlanned ? styles.planCapBad : undefined}>
                    {totals.overPlanned
                      ? <>Your estimate — {fmt(totals.itemized)} itemized is {fmt(totals.difference)} over</>
                      : <>Your estimate · {fmt(totals.itemized)} itemized in {totals.costLineCount} line{totals.costLineCount === 1 ? '' : 's'}</>}
                    {moneyCanWrite && !editingSeason && (
                      <>
                        {' · '}
                        <button type="button" className={styles.ladderLink} onClick={openEstimateEditor}>Edit</button>
                      </>
                    )}
                  </span>
                ) : (
                  <>
                    {totals.costLineCount > 0 && (
                      <>{totals.costLineCount} line{totals.costLineCount === 1 ? '' : 's'}</>
                    )}
                    {!editingSeason && moneyCanWrite && (
                      <>
                        {totals.costLineCount > 0 && ' · '}
                        <button type="button" className={styles.ladderLink} onClick={openEstimateEditor}>
                          set an estimated total
                        </button>
                      </>
                    )}
                  </>
                ),
              },
              {
                /* A team with no money-in lines has no middle tile — it hides rather than
                   printing a zero nobody planned (recipe deviation 2). "Expected FUNDING", not
                   the fundraising section's own name: this AGGREGATES every money-in kind. */
                key: 'funding',
                label: PLAN_LADDER_LABEL.plannedFunding,
                figure: fmt(totals.expectedFunding),
                tone: 'good',
                caption: `${totals.fundingLineCount} line${totals.fundingLineCount === 1 ? '' : 's'}`,
                hidden: !(totals.fundingLineCount > 0),
              },
              {
                key: 'installments',
                label: 'Player installments',
                figure: (
                  <>
                    {fmt(duesAssessed > 0 ? duesAssessed : totals.fundedByPlayers)}
                    {' '}
                    <span className={duesAssessed > 0 ? styles.planBadgeOff : styles.planBadgeEst}>
                      {duesAssessed > 0 ? 'Scheduled' : 'Estimated'}
                    </span>
                  </>
                ),
                caption: duesAssessed > 0 ? (
                  // "Above the plan" needs a plan to be above — a dues-only team gets the bare
                  // Scheduled figure, not a caption calling the whole schedule a buffer.
                  leftToFund < -0.005 && totals.totalPlanned > 0 ? (
                    <>Includes a {fmt(leftToFund)} buffer above the plan</>
                  ) : leftToFund > 0.005 ? (
                    <span className={styles.planCapWarn}>
                      {fmt(leftToFund)} short of covering the plan
                      {moneyCanWrite && (
                        <>
                          {' · '}
                          <button type="button" className={styles.ladderLink} onClick={() => setGenOpen(true)}>
                            set dues
                          </button>
                        </>
                      )}
                    </span>
                  ) : undefined
                ) : (
                  (totals.perPlayer != null || (moneyCanWrite && allLines.length > 0)) ? (
                    <>
                      {totals.perPlayer != null && <>≈ {fmt(totals.perPlayer)} per player ÷ {totals.rosterCount}</>}
                      {moneyCanWrite && allLines.length > 0 && (
                        <>
                          {totals.perPlayer != null && ' · '}
                          <button type="button" className={styles.ladderLink} onClick={() => setGenOpen(true)}>
                            set dues for all players
                          </button>
                        </>
                      )}
                    </>
                  ) : undefined
                ),
              },
            ]}
          />

          {editingSeason && (
            <div className={styles.ladderEditor}>
              <label className={styles.ladderEditorLabel} htmlFor="budget-estimated-total">Estimated total</label>
              {/* Width in CSS, not inline: an inline width outranks any media query, which is
                  what made the old editor overflow its tile on a phone. */}
              <input
                id="budget-estimated-total"
                className={`${styles.input} ${shared.inlineField}`}
                style={{ '--inline-field-w': '120px' } as React.CSSProperties}
                type="number"
                min={0}
                step="0.01"
                value={seasonInput}
                onChange={e => setSeasonInput(e.target.value)}
                autoFocus
              />
              <button type="button" className={shared.btnPrimary} style={{ fontSize: '0.78rem', padding: '0.3rem 0.7rem' }} disabled={seasonSaving} onClick={() => saveSeasonTotal()}>
                {seasonSaving ? '…' : 'Save'}
              </button>
              {/* Disabled while a save is in flight, like its Save/Clear neighbours: closing the
                  editor mid-request left the response to land on whatever the coach opened next
                  — stomping a freshly-typed number with the one they had just cancelled, and
                  sending any failure message to a box that was no longer on screen. */}
              <button type="button" className={shared.btnGhost} style={{ fontSize: '0.78rem', padding: '0.3rem 0.7rem' }} disabled={seasonSaving} onClick={() => { setEditingSeason(false); setSeasonError(''); }}>
                Cancel
              </button>
              {seasonTotal != null && (
                <button type="button" className={styles.ladderLink} disabled={seasonSaving} onClick={() => saveSeasonTotal(true)}>
                  Clear
                </button>
              )}
              {seasonError && <span className={styles.errorText} style={{ fontSize: '0.75rem' }}>{seasonError}</span>}
            </div>
          )}

          </>
          )}

          {/* Line items grouped by category */}
          {/* List ⇄ By period. Only offered once there is a plan to look at — a toggle over an
              empty page is furniture. */}
          {allLines.length > 0 && (
            <div className={shared.panelToolbar}>
              {/* ⚠ THE SAME PILLS BvA USES ONE TAB OVER (P4, owner Q4 — finishing the 2026-08-20
                  "one control shape" ruling, whose adoption list simply never named Budget Plan).
                  View is the arrangement control and takes the lead accent; Columns appears only
                  when there are columns to size. No default moved. */}
              <SingleSelectDropdown
                label="View"
                lead
                value={viewMode}
                options={[
                  { id: 'list', label: 'List' },
                  { id: 'period', label: 'By period' },
                ]}
                onChange={next => setViewMode(next as 'list' | 'period')}
              />
              {viewMode === 'period' && (
                <SingleSelectDropdown
                  label="Columns"
                  value={granularity}
                  options={PERIOD_GRANULARITIES.map(g => ({ id: g, label: GRANULARITY_LABEL[g] }))}
                  onChange={next => setGranularity(next as PeriodGranularity)}
                />
              )}
              {/* ⚠ ONLY WHERE IT CAN DO SOMETHING — the same rule the month pager and Collapse all
                  already follow. A plan with every line dated has nothing to narrow to, and a
                  control that can never change anything is worse than no control.
                  ⚠ LIST ONLY. The By-period view answers "when" with its columns; hiding rows
                  there would empty months a coach is reading across. */}
              {viewMode === 'list' && undatedLines.length > 0 && (
                <SingleSelectDropdown
                  label="When"
                  value={whenFilter}
                  options={[
                    { id: 'all',     label: 'All' },
                    { id: 'undated', label: 'No date yet' },
                    { id: 'dated',   label: 'Dated' },
                  ]}
                  onChange={next => setWhenFilter(next as 'all' | 'undated' | 'dated')}
                />
              )}
              {/* Collapse all / Expand all (P3) — one ghost verb for the whole outline. It acts on
                  the SECTION level (categories and the money-in sections); expanding also reopens
                  any item folds, which is what "show me everything" means.
                  ⚠ ON BOTH VIEWS since the §133 walk, acting on whichever outline is on screen —
                  and only where there is something to fold, the same rule the month pager follows. */}
              {foldAll.keys.length > 0 && (
                <button
                  type="button"
                  className={`${shared.btnGhost} ${styles.collapseAllBtn}`}
                  onClick={foldAll.toggle}
                >
                  {foldAll.allClosed ? 'Expand all' : 'Collapse all'}
                </button>
              )}
              {/* The create joins the row the tab already had (ruling 2026-08-13, decision 2) —
                  no band was added to the page. When the plan is EMPTY this row does not render
                  at all and the first-run card carries the doors, import included, at 390px. */}
              <div className={shared.panelToolbarActions}>
                {planExport}
                {addLineButton}
              </div>
            </div>
          )}

          {/* ⚠ ALL lines, not just cost groups: a plan holding only expected-funding lines is not
              an empty plan, and showing the first-run card over it would hide real money. */}
          {allLines.length === 0 ? (
            // Chunk G: the first-run surface replaces the bare empty state Chunk A left
            // minimal on purpose. Three doors for a write coach — the starter, the sample,
            // and the never-walled manual path. A read-only coach gets the honest version:
            // whose job this is, plus the sample (education, not a write).
            moneyCanWrite ? (
              // The shared empty-state full card — its own contract names "first-run
              // banner" as an intended use; hand-rolling a parallel card here would be
              // the one empty state in the portal a global tweak couldn't reach.
              <div data-testid="budget-first-run">
                <CoachEmptyState
                  icon={<BarChart3 size={22} aria-hidden />}
                  eyebrow="Getting started"
                  headline="Build your starting budget"
                  description="Answer a few quick questions and get the right cost lines for your season. You fill in only the numbers you know — nothing is guessed for you."
                  primaryAction={{ label: 'Start — about a minute', onClick: () => setStarterOpen(true) }}
                  secondaryAction={{ label: 'See a finished example', onClick: () => setSampleOpen(true) }}
                >
                  {/* alignSelf keeps these quiet links from stretching to the .btn height
                      (the actions row's default is stretch). */}
                  <button type="button" className={styles.sampleLink} style={{ alignSelf: 'center' }} onClick={openAdd}>
                    Or add lines yourself
                  </button>
                  {/* Chunk H2: the fourth door. A coach arriving with a season already in a
                      spreadsheet shouldn't have to retype it to get started. */}
                  <button type="button" className={styles.sampleLink} style={{ alignSelf: 'center' }} onClick={() => setImportOpen(true)}>
                    Import a spreadsheet
                  </button>
                  {/* The carry door (owner Q8b) — only when an earlier season actually holds a
                      plan: a door to nothing teaches nothing. The rollover offers this carry by
                      default; this is the second chance for the coach who declined it. */}
                  {priorPlan && (
                    <button
                      type="button"
                      className={styles.sampleLink}
                      style={{ alignSelf: 'center' }}
                      disabled={carryBusy}
                      onClick={handleCarryPrior}
                    >
                      {carryBusy
                        ? 'Bringing last season’s plan…'
                        : `Bring last season’s plan (${priorPlan.lineCount} line${priorPlan.lineCount === 1 ? '' : 's'})`}
                    </button>
                  )}
                  {carryError && (
                    <p className={styles.errorText} style={{ alignSelf: 'center', margin: 0 }}>{carryError}</p>
                  )}
                  {/* The cold-start door to an estimate-only budget. It flips `editingSeason`,
                      which un-sets `trueEmpty` and brings the summary back — the one place the
                      estimate can be set when there are no lines yet (review finding). */}
                  <button type="button" className={styles.sampleLink} style={{ alignSelf: 'center' }} onClick={openEstimateEditor}>
                    Set an estimated total instead
                  </button>
                </CoachEmptyState>
              </div>
            ) : (
              <CoachEmptyState
                icon={<BarChart3 size={22} aria-hidden />}
                eyebrow="Season budget"
                headline="No budget yet"
                description="Building the budget is the head coach's job — every line will show here once they do."
                secondaryAction={{ label: 'See a finished example →', onClick: () => setSampleOpen(true) }}
              />
            )
          ) : periodView ? (
            <PeriodGrid
              view={periodView}
              granularity={granularity}
              monthStart={gridMonthStart}
              onMonthStart={setGridMonthStart}
              closed={gridClosed}
              onToggle={toggleGridGroup}
            />
          ) : (
            <>
            {/* ── "What still has no date?" ────────────────────────────────────────────────
                The one tap that turns the When column into a tool. It renders ONLY while there is
                something to fix, so a fully dated plan is quiet — the same rule as the filter that
                it sets.

                ⚠ ONE FACT, ONE LINE (owner ruling 2026-09-04). It read "N lines have no date. They
                are counted in the season plan and in no month. Show just those →" and the middle
                sentence was cut: that consequence is already told at the moment of choosing, in
                the line form, and again under the Budget vs Actual table. A third telling on a bar
                whose whole job is one tap is filler.

                ⚠ IT COUNTS LINES, NOT DOLLARS, and does not colour the figure. The money is on the
                report; this is a worklist. */}
            {undatedLines.length > 0 && whenFilter !== 'undated' && (
              <p className={styles.undatedBar}>
                <strong>{undatedLines.length} line{undatedLines.length === 1 ? '' : 's'}</strong>
                {' '}{undatedLines.length === 1 ? 'has' : 'have'} no date.
                <button
                  type="button"
                  className={styles.undatedBarDoor}
                  onClick={() => setWhenFilter('undated')}
                >
                  Show just those
                </button>
              </p>
            )}
            {/* The way back out, in the bar's own place, so a coach who narrowed the list is never
                left hunting the toolbar for the control that did it. */}
            {whenFilter !== 'all' && (
              <p className={styles.undatedBar}>
                Showing <strong>{whenFilter === 'undated' ? 'only lines with no date' : 'only dated lines'}</strong>.
                <button
                  type="button"
                  className={styles.undatedBarDoor}
                  onClick={() => setWhenFilter('all')}
                >
                  Show the whole plan
                </button>
              </p>
            )}
            {/* ⚠⚠ THE PLAN IS ONE TABLE (owner ruling 2026-09-05, one-surface pass). It was a stack
                of bordered category cards on the paper ground; it is the same `.moneyGrid` recipe
                the By-period view beside it and Budget vs. Actual next door now use — one white
                surface, a hairline under every row, tints only where they mean structure.
                The When column, the pencil and every behaviour on this screen are unchanged. */}
            <CoachScrollX sticky hint="Swipe the table to see When and Planned">
            <table
              className={`${shared.moneyGrid} ${styles.planTable}`}
              /* Opts the category toggles and line expanders into the 44px floor through the
                 641–768 touch band — see the rule in coaches.module.css for why it is opt-in
                 rather than raised for every money table. */
            >
              {/* The column headings the plan never had — "Planned" names the column rather than
                  hovering over it, which is how Budget vs. Actual next door already reads.

                  ⚠ THE ACTION COLUMN IS FIXED FOR A WRITE COACH so the money column holds still
                  from row to row; a read-only coach has no pencil anywhere, so it collapses to
                  nothing and the figures sit at the edge — aligned either way, no dead gutter.
                  This replaces the `--ledger-cols` / `.linesCanWrite` pair that did the same job
                  on the div grid.

                  ⚠⚠ THE WIDTHS SIT ON THE HEADING CELLS RATHER THAN IN A <colgroup>, AND THE PHONE
                  IS WHY. Below 640 the When column leaves the table entirely — `.schedCell` is
                  display:none on this heading AND on every row's cell, a standing ruling, with the
                  answer riding under the line name as a chip instead. A <col> list is POSITIONAL:
                  with one column's cells gone, the remaining <col> elements shift onto the wrong
                  columns and the money column can inherit the When column's width. A width declared
                  on a cell travels with that cell, so a column that disappears takes its width with
                  it. Budget vs. Actual keeps a <colgroup> because none of its columns ever leaves. */}
              <thead>
                <tr>
                  <th scope="col" className={styles.lead}>Category / line</th>
                  <th scope="col" className={styles.schedCell} style={{ width: 200 }}>When</th>
                  <th scope="col" style={{ width: 150 }}>Planned</th>
                  {/* ⚠ A REAL HEADER CELL NEEDS A NAME. As a div-grid this was an empty <span>
                      with no table semantics; as a <th> a screen reader's table navigation
                      announces it, and an unnamed column header reads as a blank. The label is
                      for assistive tech only — the column is the pencil, which needs no visible
                      heading. */}
                  <th scope="col" aria-label="Row actions" style={{ width: moneyCanWrite ? 48 : 0 }} />
                </tr>
              </thead>
              <tbody>
              {/* ── COSTS — the band (owner ruling 2026-09-08, mockup e94d05d9 round 2). A bare noun:
                  the qualifier lives on the subtotal that closes the band. Three real empty cells,
                  never a colSpan — the first column is pinned inside <CoachScrollX sticky>, the rule
                  the statement's bands and the month grid's already follow. It waits for a cost to
                  head: a funding-only plan (or a filter that leaves none) draws no empty band. */}
              {(groups.length > 0 || tableTotals.estimatedTotal != null) && (
                <tr className={shared.moneyGridBand}>
                  <th scope="row" className={styles.lead}>{PLAN_LADDER_LABEL.costsBand}</th>
                  <td className={styles.schedCell} /><td /><td />
                </tr>
              )}
              {groups.map(({ categoryName: catName, total: catTotal, items }) => (
                <Fragment key={catName}>
                  {/* ⚠ COLLAPSIBLE, by the same ruling that gave the By-period grid its chevrons
                      (owner 2026-08-13: any hierarchy in a table is collapsible). This was the last
                      hierarchy in Money that could not be closed — Budget vs. Actual's category
                      view already could, which made two views of the same structure behave
                      differently. Closed-set, not open-set, so a newly added category arrives
                      OPEN rather than hidden. */}
                  {/* ⚠ THE ROW IS A ROW; THE CONTROL IS INSIDE ITS FIRST CELL. A <button> cannot
                      wrap a <tr>, and the month grid already solved this the same way. */}
                  <tr
                    className={`${shared.moneyGridCat} ${shared.rowTappable}`}
                    onClick={() => { if (window.getSelection()?.toString()) return; toggleSectionClosed(catKey(catName)); }}
                  >
                    <th scope="row" className={styles.lead}>
                      <button
                        type="button"
                        className={shared.moneyGridToggle}
                        aria-expanded={!isClosed(catKey(catName))}
                        onClick={e => { e.stopPropagation(); toggleSectionClosed(catKey(catName)); }}
                      >
                        {isClosed(catKey(catName))
                          ? <ChevronRight size={14} aria-hidden />
                          : <ChevronDown size={14} aria-hidden />}
                        <span>{catName}</span>
                      </button>
                    </th>
                    <td className={styles.schedCell} />
                    <td>{fmt(catTotal)}</td>
                    <td />
                  </tr>
                  {!isClosed(catKey(catName)) && items.map(item => (
                    /* ⚠ ONE ROW PER ITEM. With a single line behind it — which is the ordinary
                       shape — the row IS that line, named by its item, and behaves exactly as it
                       always has: tap to edit, chevron for its payment periods. Two or more lines
                       on one item is the case the owner's SUM ruling exists for, and only then does
                       the row become a group that opens to reveal them. */
                    item.lines.length === 1 ? (
                      <BudgetLineRow
                        key={item.key}
                        line={{ ...item.lines[0], description: item.itemName }}
                        funding={false}
                        expanded={expandedLines.has(item.lines[0].id)}
                        canWrite={moneyCanWrite}
                        onToggle={() => toggleLineExpanded(item.lines[0].id)}
                        onEdit={() => openEdit(item.lines[0])}
                      />
                    ) : (
                      <Fragment key={item.key}>
                        <tr
                          className={shared.rowTappable}
                          onClick={() => { if (window.getSelection()?.toString()) return; toggleSectionClosed(item.key); }}
                        >
                          <th scope="row" className={`${styles.lead} ${shared.moneyGridLead}`}>
                            <button
                              type="button"
                              className={shared.moneyGridToggle}
                              aria-expanded={!isClosed(item.key)}
                              onClick={e => { e.stopPropagation(); toggleSectionClosed(item.key); }}
                            >
                              {isClosed(item.key)
                                ? <ChevronRight size={14} aria-hidden />
                                : <ChevronDown size={14} aria-hidden />}
                              {/* ⚠ NO "N lines" CAPTION (owner ruling 2026-09-04, QA §133) — the
                                  full reasoning sits on the by-period grid above. The chevron says
                                  the row opens; opening it shows the lines. That is enough. */}
                              <span>{item.itemName}</span>
                            </button>
                          </th>
                          <td className={styles.schedCell} />
                          <td>{fmt(item.total)}</td>
                          <td />
                        </tr>
                        {!isClosed(item.key) && item.lines.map(line => {
                          /* ⚠ THE NOTE NAMES THE SUB-LINE, AND WITH NO NOTE ITS SCHEDULE DOES
                             (owner ruling 2026-09-09, decision B2). The old fallback was the
                             line's stored description — which the server keeps synced to the
                             ITEM's name, so a note-less line echoed the row directly above it.
                             On this repo's own fixture "Entry Fees" printed THREE times in one
                             column, on the cost side, and nobody reported it because the rows
                             still added up.
                             ⚠ THE RULE IS SHARED with the money-in section below: fixing one half
                             would leave the identical echo on the surface the other half is being
                             aligned to. Half a fix reads worse than none. */
                          const sub = mergedSubLineName(line);
                          return (
                            <BudgetLineRow
                              key={line.id}
                              line={{ ...line, description: sub.name, notes: null }}
                              funding={false}
                              hideWhen={!sub.showWhen}
                              expanded={expandedLines.has(line.id)}
                              canWrite={moneyCanWrite}
                              onToggle={() => toggleLineExpanded(line.id)}
                              onEdit={() => openEdit(line)}
                            />
                          );
                        })}
                      </Fragment>
                    )
                  ))}
                </Fragment>
              ))}


              {/* ── THE COSTS SUBTOTAL, and the estimate rows above it (owner ruling 2026-09-08,
                  mockup e94d05d9 round 2). THE RULE: the three tiles above this table are its three
                  subtotals, with the same names verbatim — so "Planned costs" here IS the tile's
                  figure: the estimate when one is set, the sum of the lines when not. When an
                  estimate is set and the lines differ, the gap gets two quiet rows ("Lines so far",
                  then "Still to itemize" or "Over your estimate" in the tile's own red) rather than
                  living only in a caption three inches up.
                  ⚠ `tableTotals`, not `totals`: under the When filter these sum the rows on screen. */}
              {(groups.length > 0 || tableTotals.estimatedTotal != null) && (
                <>
                  {tableTotals.hasDifference && (
                    <>
                      <tr className={styles.estimateRow}>
                        <th scope="row" className={styles.lead}>{PLAN_LADDER_LABEL.linesSoFar}</th>
                        <td className={styles.schedCell} />
                        <td>{fmt(tableTotals.itemized)}</td>
                        <td />
                      </tr>
                      <tr className={`${styles.estimateRow} ${tableTotals.overPlanned ? styles.estimateOver : ''}`}>
                        <th scope="row" className={styles.lead}>
                          {tableTotals.overPlanned ? PLAN_LADDER_LABEL.overEstimate : PLAN_LADDER_LABEL.stillToItemize}
                          <span className={styles.rowNote}>
                            Your estimate is {fmt(tableTotals.estimatedTotal ?? 0)}
                            {moneyCanWrite && !editingSeason && (
                              <>
                                {' · '}
                                <button type="button" className={styles.ladderLink} onClick={openEstimateEditor}>Edit</button>
                              </>
                            )}
                          </span>
                        </th>
                        <td className={styles.schedCell} />
                        <td>{fmt(tableTotals.difference)}</td>
                        <td />
                      </tr>
                    </>
                  )}
                  {/* ⚠ ONE NAME, ONE NUMBER. Under the When filter this sums a SLICE, and a slice may
                      not wear the tile's name — "Costs shown" says what it is (/review, 2026-09-08). */}
                  <tr className={shared.moneyGridTotal}>
                    <th scope="row" className={styles.lead}>
                      {whenFilter === 'all' ? PLAN_LADDER_LABEL.plannedCosts : PLAN_LADDER_LABEL.costsShown}
                    </th>
                    <td className={styles.schedCell} />
                    <td>{fmt(tableTotals.totalPlanned)}</td>
                    <td />
                  </tr>
                </>
              )}

              {/* ── FUNDING — the band, one section per money-in kind, the subtotal.
                  Money in is shown POSITIVE in green (owner 2026-08-13: the label says the
                  direction; a minus sign made readers re-check arithmetic).
                  ⚠ ONE SECTION PER MONEY-IN CATEGORY (owner ruling 2026-09-09; one per KIND from
                  2026-08-15 until then). The category is the shelf on both sides of the plan, exactly
                  as the Statement reads it — so "Tournaments" heads the concession stand here too,
                  and "did our sponsorship hit the number?" is still one section's subtotal, because
                  Sponsorship IS a category.
                  ⚠ FUNDING LINES ONLY. Player dues are the ANSWER to the plan, not an input — they
                  briefly sat inside this section and made its total −$8,000 while the ladder said
                  −$180 (owner catch, 2026-08-13); they close the list below instead.
                  ⚠ The subtotal wears the tile's exact name, "Planned funding" (owner ruling
                  2026-09-08) — "funding", not "fundraising", because it aggregates every kind. */}
              {fundingGroups.length > 0 && (
                <>
                  <tr className={shared.moneyGridBand}>
                    <th scope="row" className={styles.lead}>{PLAN_LADDER_LABEL.fundingBand}</th>
                    <td className={styles.schedCell} /><td /><td />
                  </tr>
                  {fundingGroups.map(group => {
                    const sectionKey = `group:${group.ref.key}`;
                    return (
                      <Fragment key={group.ref.key}>
                        <tr
                          className={`${shared.moneyGridCat} ${styles.fundingRow} ${shared.rowTappable}`}
                          onClick={() => { if (window.getSelection()?.toString()) return; toggleSectionClosed(sectionKey); }}
                        >
                          <th scope="row" className={styles.lead}>
                            <button
                              type="button"
                              className={shared.moneyGridToggle}
                              aria-expanded={!isClosed(sectionKey)}
                              onClick={e => { e.stopPropagation(); toggleSectionClosed(sectionKey); }}
                            >
                              {isClosed(sectionKey)
                                ? <ChevronRight size={14} aria-hidden />
                                : <ChevronDown size={14} aria-hidden />}
                              <span>{group.ref.name}</span>
                            </button>
                          </th>
                          <td className={styles.schedCell} />
                          <td className={styles.fundingAmount}>
                            {fmt(group.total)}
                          </td>
                          <td />
                        </tr>
                        {/* ⚠⚠ ONE ROW PER WORD, NOT PER LINE (owner ruling 2026-09-09). This
                            listed one row per line, named by a description no form has offered
                            since mig 243 deleted the field — so a row wore a word a coach could
                            neither see nor change, while the by-period grid and Budget vs. Actual
                            called the same money something else. The cost side has grouped by
                            word since 2026-08-15; `groupByItem` is that rule, shared, so these
                            two cannot drift apart again.
                            ⚠ ALPHABETICAL now, where this kept creation order — one rule for the
                            whole table rather than a special case for half of it (decision A1). */}
                        {!isClosed(sectionKey) && groupByItem(group.lines).map(item => (
                          item.lines.length === 1 ? (
                            /* The ordinary shape: the row IS the line, wearing its word. */
                            <BudgetLineRow
                              key={item.key}
                              line={{ ...item.lines[0], description: item.itemName }}
                              funding
                              expanded={expandedLines.has(item.lines[0].id)}
                              canWrite={moneyCanWrite}
                              onToggle={() => toggleLineExpanded(item.lines[0].id)}
                              onEdit={() => openEdit(item.lines[0])}
                            />
                          ) : (
                            /* Two or more lines on one word: the summed head opens to reveal them,
                               exactly as a cost item does. */
                            <Fragment key={item.key}>
                              <tr
                                className={`${shared.rowTappable} ${styles.fundingRow}`}
                                onClick={() => { if (window.getSelection()?.toString()) return; toggleSectionClosed(item.key); }}
                              >
                                <th scope="row" className={`${styles.lead} ${shared.moneyGridLead}`}>
                                  <button
                                    type="button"
                                    className={shared.moneyGridToggle}
                                    aria-expanded={!isClosed(item.key)}
                                    onClick={e => { e.stopPropagation(); toggleSectionClosed(item.key); }}
                                  >
                                    {isClosed(item.key)
                                      ? <ChevronRight size={14} aria-hidden />
                                      : <ChevronDown size={14} aria-hidden />}
                                    <span>{item.itemName}</span>
                                  </button>
                                </th>
                                <td className={styles.schedCell} />
                                <td className={styles.fundingAmount}>{fmt(item.total)}</td>
                                <td />
                              </tr>
                              {!isClosed(item.key) && item.lines.map(line => {
                                const sub = mergedSubLineName(line);
                                return (
                                  <BudgetLineRow
                                    key={line.id}
                                    line={{ ...line, description: sub.name, notes: null }}
                                    funding
                                    hideWhen={!sub.showWhen}
                                    expanded={expandedLines.has(line.id)}
                                    canWrite={moneyCanWrite}
                                    onToggle={() => toggleLineExpanded(line.id)}
                                    onEdit={() => openEdit(line)}
                                  />
                                );
                              })}
                            </Fragment>
                          )
                        ))}
                      </Fragment>
                    );
                  })}
                  {/* ⚠ `.fundingRow` ON THE ROW is load-bearing: the shared total treatment sets the
                      figure's colour at (0,2,3) and a bare `.fundingAmount` (0,2,0) loses to it — the
                      row class lifts the green to (0,3,1). /review caught this row shipping in plain
                      ink beside green section rows (2026-09-08). Label as above: a slice is "shown". */}
                  <tr className={`${shared.moneyGridTotal} ${styles.fundingRow}`}>
                    <th scope="row" className={styles.lead}>
                      {whenFilter === 'all' ? PLAN_LADDER_LABEL.plannedFunding : PLAN_LADDER_LABEL.fundingShown}
                    </th>
                    <td className={styles.schedCell} />
                    <td className={styles.fundingAmount}>{fmt(tableTotals.expectedFunding)}</td>
                    <td />
                  </tr>
                </>
              )}

              {/* ── THE CLOSE — the season's ladder (owner ruling 2026-09-08). Once dues exist:
                  Costs less funding (what installments have to cover) → Player installments, wearing
                  the tile's Scheduled tag → the residual, a planned buffer in ordinary ink, a
                  shortfall in amber, and NO row when the schedules match the plan (a $0.00 close
                  says nothing). Before dues exist the block is ONE row — the estimated installments
                  figure, saying where it came from and what it means per player, in the tile's own
                  words. ⚠ Only on the UNFILTERED plan: a slice has no shortfall (see `tableTotals`).
                  ⚠ Player installments lost the category ground and the green figure here: it is an
                  INPUT to the ladder now, not a section a coach can open. */}
              {whenFilter === 'all' && (
                duesAssessed > 0 ? (
                  <>
                    {totals.fundingLineCount > 0 && (
                      <tr className={`${styles.ladderRow} ${styles.ladderGap}`}>
                        <th scope="row" className={styles.lead}>
                          {PLAN_LADDER_LABEL.costsLessFunding}
                          <span className={styles.rowNote}>{PLAN_LADDER_LABEL.costsLessFundingNote}</span>
                        </th>
                        <td className={styles.schedCell} />
                        {/* `fundedByPlayers`, not a fresh subtraction: the same figure the tile prints
                            as the Estimated installments, floored at zero — so an over-funded plan
                            reads $0.00 here and in the file alike, never a sign the screen's absolute
                            formatter would have hidden (/review, 2026-09-08). */}
                        <td>{fmt(totals.fundedByPlayers)}</td>
                        <td />
                      </tr>
                    )}
                    <tr className={`${styles.ladderRow} ${totals.fundingLineCount > 0 ? '' : styles.ladderGap}`}>
                      <th scope="row" className={styles.lead}>
                        {PLAN_LADDER_LABEL.installments}
                        <span className={`${styles.planBadgeOff} ${styles.ladderBadge}`}>Scheduled</span>
                      </th>
                      <td className={styles.schedCell} />
                      <td>{fmt(duesAssessed)}</td>
                      <td />
                    </tr>
                    {Math.abs(leftToFund) >= 0.005 && (
                      <tr className={styles.closeRow}>
                        <th scope="row" className={styles.lead}>
                          {leftToFund < 0 ? PLAN_LADDER_LABEL.buffer : PLAN_LADDER_LABEL.shortOfPlan}
                        </th>
                        <td className={styles.schedCell} />
                        <td className={leftToFund > 0 ? styles.closeWarn : ''}>
                          {fmt(leftToFund)}
                        </td>
                        <td />
                      </tr>
                    )}
                  </>
                ) : (
                  <tr className={styles.closeRow}>
                    <th scope="row" className={styles.lead}>
                      {PLAN_LADDER_LABEL.installments}
                      <span className={`${styles.planBadgeEst} ${styles.ladderBadge}`}>Estimated</span>
                      <span className={styles.rowNote}>
                        {totals.fundingLineCount > 0 ? PLAN_LADDER_LABEL.costsLessFunding : PLAN_LADDER_LABEL.plannedCosts}, until dues are set
                        {totals.perPlayer != null && <> · ≈ {fmt(totals.perPlayer)} per player ÷ {totals.rosterCount}</>}
                        {moneyCanWrite && allLines.length > 0 && (
                          <>
                            {' · '}
                            <button type="button" className={styles.ladderLink} onClick={() => setGenOpen(true)}>
                              set dues for all players
                            </button>
                          </>
                        )}
                      </span>
                    </th>
                    <td className={styles.schedCell} />
                    <td>{fmt(totals.fundedByPlayers)}</td>
                    <td />
                  </tr>
                )
              )}
              </tbody>
            </table>
            </CoachScrollX>
            </>
          )}

          {/* Chunk G — the permanent "what am I forgetting?" question. Derived from the standard
              taxonomy minus what's budgeted minus this device's dismissals; write-gated (it is a
              write invitation) and self-hides when complete.

              ⚠⚠ IT WAS A ROW IN THE MIDDLE OF THE PLAN UNTIL THE §133 SECOND LOOK (owner ruling
              2026-09-04, mockup approved). Three things were wrong and they compounded:
                · PLACEMENT. It was added at the end of the cost list, when that WAS the bottom.
                  Everything under it — the money-in sections, "Short of covering the plan" — came
                  later, so it ended up interrupting the plan's arithmetic between what a team
                  spends and what covers it. It belongs after the plan has finished adding up.
                · WEIGHT. A dashed, tinted, full-width bar is the furniture of a category row, and
                  this carries no money and appears in no total. A coach's eye counted it as a line
                  of the plan and then found it wasn't one.
                · WORDS. "Registration revenue · Concession revenue · +40 more" named two arbitrary
                  items out of forty-odd — a truncated list, not an offer. The count is the honest
                  summary, and the question the strip was BUILT to ask ("what am I forgetting?",
                  its own words in the Chunk G plan) is now the control rather than a "Review" verb
                  attached to a label.
              ⚠ List view only, as before: the By-period grid is a different reading of the same
              plan and this has never hung under it. */}
          {moneyCanWrite && viewMode === 'list' && allLines.length > 0 && checklistItems.length > 0 && (
            <div data-testid="budget-checklist">
              <p className={styles.checklistFootnote}>
                <button
                  type="button"
                  className={styles.checklistAsk}
                  aria-expanded={checklistExpanded}
                  onClick={() => setChecklistExpanded(v => !v)}
                >
                  {checklistExpanded ? 'Hide' : 'What am I forgetting?'}
                </button>
                <span className={styles.checklistCount}>
                  · {checklistItems.length} item{checklistItems.length === 1 ? '' : 's'}
                  {' '}in {checklistCategoryCount} categor{checklistCategoryCount === 1 ? 'y' : 'ies'}
                </span>
              </p>
              {/* Option A (owner ruling 2026-09-09, mockup 728dcb1e): an INDEX, not a wall. The
                  form's two direction answers head the list, each category is one button carrying
                  its count, and the words appear only inside the open category — so the seven
                  money-in words a coach most often forgets are on the first screen of a phone
                  instead of a screen and a half down, and "Insurance" twice reads as Admin's and
                  League & Fees' rather than as a duplicate. Colour is not used to carry direction
                  (colour is for cash, 2026-09-02); the heading carries it. */}
              {checklistExpanded && (
                <div>
                  {checklistSides.map(side => (
                    <div key={side.direction} className={styles.checklistSide}>
                      <div className={styles.checklistSideHead}>
                        <span className={styles.checklistSideName}>{side.name}</span>
                        <span className={styles.checklistSideCount}>{side.count}</span>
                      </div>
                      <div className={styles.checklistCats}>
                        {side.categories.map(cat => {
                          const open = checklistOpenCat === cat.key;
                          return (
                            <button
                              key={cat.key}
                              type="button"
                              className={`${styles.checklistCat} ${open ? styles.checklistCatOpen : ''}`}
                              aria-expanded={open}
                              onClick={() => setChecklistOpenCat(open ? null : cat.key)}
                            >
                              {cat.name}
                              <span className={styles.checklistCatCount}>{cat.items.length}</span>
                            </button>
                          );
                        })}
                      </div>
                      {side.categories.filter(cat => cat.key === checklistOpenCat).map(cat => (
                        <div key={cat.key} className={styles.checklistCatBody}>
                          <div className={styles.checklistChips}>
                            {cat.items.map(item => (
                              <span key={item.id} className={styles.checklistChip}>
                                <button
                                  type="button"
                                  className={styles.checklistAdd}
                                  title={item.categoryName}
                                  onClick={() => openAddFromChecklist(item)}
                                >
                                  + {item.name}
                                </button>
                                <button
                                  type="button"
                                  className={styles.checklistDismiss}
                                  aria-label={`We don't pay for ${item.name} — hide it`}
                                  onClick={() => dismissChecklistItem(item.id)}
                                >
                                  <X size={11} aria-hidden />
                                </button>
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                  <p className={styles.checklistFoot}>
                    Open a category to add from it — you type the amount. ✕ hides a word your team
                    doesn&apos;t pay for.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Set-dues CTA (renamed with the one-name ruling, owner Q20 QA §123). ⚠ duesAssessed
              too, not just hasInstallments (review finding): hand-set schedules never set the
              budget_generated flag, and this band claiming no dues exist under a card saying
              "Scheduled" was a page disagreeing with itself. */}
          {moneyCanWrite && plan && plan.lines.length > 0 && !plan.hasInstallments && duesAssessed === 0 && (
            <div className={styles.generateSection}>
              <div>
                <p className={styles.generateTitle}>Ready to assign dues to players?</p>
                <p className={styles.generateSub}>
                  Build a player installment schedule based on this budget.
                  Each active roster player gets the same due dates and amounts.
                </p>
              </div>
              <button type="button" className={shared.btnPrimary} onClick={() => setGenOpen(true)}>
                Set dues for all players
              </button>
            </div>
          )}

          {/* The "✓ installments generated / View dues" banner and the quiet "See a sample budget"
              link both used to close the page here. The banner's fact now lives IN the plan (the
              Player dues row above); the sample is a getting-started aid and stays on the empty
              states only (owner ruling 2026-08-13, superseding D6's "permanent quiet reference"). */}
        </>
      )}

      {/* ── Add / Edit Line Modal ───────────────────────────────────────────── */}
      {modalOpen && (
        <div className={shared.modalOverlay} onPointerDown={e => { if (e.target === e.currentTarget) (closeLineModal)?.(); }}>
          {/* A touch wider than the default dialog (the event form's precedent) so the period row's
              three controls — picker, label, amount — are not crushed side by side. */}
          <div
            className={`${shared.modal} ${shared.modalFlushFooter} ${styles.budgetLineModal}`}
            onClick={e => e.stopPropagation()}
          >
            <CoachModalHeader title={editingLine ? 'Edit Budget Line' : 'Add Budget Line'} onClose={closeLineModal} />

            <p className={styles.formHint}>* Required</p>

            {/* WHICH WAY THE MONEY GOES — the ONE question this form asks about what a line is
                (mig 280). Amounts stay positive either way; the stored kind carries the sign, and
                the stored kind is worked out from the ITEM below rather than asked here.
                ⚠⚠ THERE USED TO BE A SECOND QUESTION AND IT WAS A TRAP. This offered four answers —
                Expense / Expected fundraising / Expected sponsorship / Expected other income — and
                the picker under it filtered by DIRECTION only, so *Expected sponsorship* with
                *Tournaments → Concession revenue* was offerable. The first answer quietly decided
                where the row's actual came from, so that pairing produced a budget line the coach
                could never record their concession takings against, silently. Read the block above
                `DIRECTION_ANSWERS` before reinstating anything here.
                ⚠ THE SHARED CONTROL, not a hand-rolled listbox — the same one the Club tab uses and
                the same CSS the Record conversation's "What happened?" is drawn in.
                ⚠ IT KEEPS ITS DEFAULT rather than opening on "Choose…" (owner ruling 2026-09-04).
                Nearly every budget line is money the team spends, and making a coach answer a
                question they almost always answer identically is a step, not a safeguard. */}
            <div className={styles.field}>
              {/* ⚠ THE VISIBLE LABEL IS THE CALLER'S. SublinedChoice's `label` prop is the
                  ACCESSIBLE name only — it renders no text — so a caller that passes it and stops
                  ships a field with no heading. Caught on the screen, not by any gate. */}
              <label className={styles.label} htmlFor="budget-line-kind">This line is</label>
              <SublinedChoice
                id="budget-line-kind"
                label="This line is"
                options={DIRECTION_ANSWERS}
                value={form.direction}
                /* ⚠ SWITCHING SIDES CLEARS THE WORD, and this is the one place mig 280 makes the
                   old behaviour wrong. Flipping the KIND used to keep the category and item on
                   purpose (mig 243) — every kind drew from the same money-in list, so the pick
                   stayed valid. Direction is different: the picker FILTERS by it (mig 246), so a
                   word kept across a flip is one the list will not offer and the coach cannot see
                   — and it would now decide the line's kind from the WRONG SIDE of the books.
                   ⚠ Everything else the coach has typed survives, the same promise the money form
                   makes one screen over. */
                onChange={dir => setForm(f => (f.direction === dir ? f : {
                  ...f,
                  direction: dir,
                  categoryId: '', categoryName: '', itemId: null, itemName: '',
                  itemActualSource: null,
                }))}
              />
            </div>

            {/* ⚠ THE PICKER SERVES BOTH DIRECTIONS AGAIN (mig 243), and the objection that closed
                it has been answered rather than ignored. It was cost-only from 2026-08-13 because
                the library was a SPENDING taxonomy — "Sponsorship" could only be filed under
                "Tournaments" — and because a category on a money-in line was read by nothing. Both
                are now false: the library ships income words (Registration revenue, Fundraising
                drive, Team sponsorship, Grant), and the report groups money in by category → item
                exactly as it groups money out. */}
            <div className={styles.field}>
              {/* ⚠ REQUIRED SINCE mig 240 — these two ARE the line's name, on the plan, on Budget
                  vs. Actual and in every export. The asterisk is not decoration: a cost line
                  without an item has nothing to be called and nothing for spending to line up
                  against, which is the whole defect this change closes. */}
              <label className={styles.label}>
                Category &amp; Item *
              </label>
              <BudgetItemPicker
                selectId={FOCUS_ITEM}
                invalid={flagged('item')}
                categories={categories}
                teamId={teamId}
                value={form.categoryId ? {
                  categoryId:      form.categoryId,
                  categoryName:    form.categoryName,
                  itemId:          form.itemId,
                  itemName:        form.itemName,
                  suggestedAmount: null,
                } : null}
                onChange={v => setForm(f => ({
                  ...f,
                  categoryId:   v.categoryId,
                  categoryName: v.categoryName,
                  itemId:       v.itemId,
                  itemName:     v.itemName,
                  /* ⚠ TAKEN FROM THE CONTROL, never looked up in `categories` (mig 280). A word
                     the coach just invented in the picker's own create panel does not exist in this
                     screen's list until the next load, so a lookup would say nothing about the one
                     word they most need the consequence line for — the control hands back what it
                     actually chose. Only `?? null` here: the field is optional on the shared type
                     for callers that build a selection from stored columns, and every path that
                     reaches THIS handler sets it. */
                  itemActualSource: v.actualSource ?? null,
                  totalAmount:  f.totalAmount || (v.suggestedAmount ? String(v.suggestedAmount) : f.totalAmount),
                }))}
                createItemEndpoint={`/api/coaches/${orgSlug}/budget-items`}
                createItemMode="coach"
                allowCreateCategory
                /* This form BUILDS A BUDGET LINE, so a suggested amount is a real question here and
                   the `onChange` above pre-fills the line's total with it — one of the two surfaces
                   that opt in (owner ruling 2026-09-02; see `suggestAmount`). */
                suggestAmount
                /* ⚠ THE ONE QUESTION DECIDES WHICH WORDS THIS LINE MAY CHOOSE FROM (mig 246,
                   simplified by mig 280). It is answered one field up — money out, or money in —
                   and passed straight through. It used to be `isFundingKind(form.lineKind)`,
                   translating a four-answer question into a two-sided one; there is nothing left
                   to translate, which is the point. */
                direction={form.direction}
                /* ⚰ THE "From a drive" / "From a sponsor" ROW TAG IS GONE, AND NOTHING REPLACES IT
                   (owner ruling 2026-09-08, mockup 8aa1e633). It shipped with mig 280 to make the
                   one-question form honest — the word chosen here decides the line's kind, so a
                   coach ought to see which rows fill themselves in — and the owner's own question
                   about it is what opened this whole thread: *"why does the row say From a drive
                   under a heading that already says FUNDRAISING?"* The answer is that the note was
                   describing where the app would make them stand three months later. It is a fact
                   about our filing system, not about their money. A coach choosing a budget word is
                   choosing a KIND OF MONEY, not a room. The consequence paragraph under the picker
                   still says, in full, what the chosen word means for this line — see
                   `KIND_HINT_LONG` — which is the sentence that was always doing the work. The
                   shared control's `rowTag` prop went with it: this was its only caller. */
                manageHint="Rename or remove it later from Manage our words — but it stays on this side."
                /* Where a word invented here will report. The money module owns the sentence; this
                   screen just hands it over (the retired row tag's lesson). */
                newItemNote={newMoneyInWordNote}
              />
              {/* ⚠ THIS SENTENCE WAS FALSE FOR MONEY IN UNTIL 2026-09-09, and it was the only thing
                  on the form that said so. A money-in row was named by a stored description this
                  form stopped offering when mig 243 made a word required in both directions — so a
                  coach read "these name this line everywhere" beside a control that named nothing,
                  while their plan showed a word they could not reach. The row now wears its word,
                  and the sentence is true; it also says the one move that gets a coach their own
                  wording, because "you cannot rename this" is a worse answer than "make a word". */}
              <p className={styles.kindHint}>
                This names the line on your plan, your report and your exports. Want it to say
                something else? Add your own word from the picker above.
              </p>
              {/* ⚠ THE CONSEQUENCE OF THE WORD, once there is one (mig 280). It sat under the KIND
                  dropdown until that question was deleted, where it explained the answer the coach
                  had just given; here it explains what their word MEANS for this line — which is
                  the sentence the old two-question form could never say at the moment it mattered.
                  Costs say nothing: the picker above them is its own explanation. */}
              {formLineKind && KIND_HINT_LONG[formLineKind] && (
                <p className={styles.kindHint}>{KIND_HINT_LONG[formLineKind]}</p>
              )}
            </div>

            {/* ⚠ THE TYPED DESCRIPTION IS GONE FROM BOTH DIRECTIONS (mig 243), and its removal from
                the money-in branch is the same ruling that removed it from costs on 2026-08-15: a
                line named by free text produced a plan row called "test" beside an item called
                "Entry Fees", and two reports cannot be lined up on words somebody typed. Notes
                carries whatever is worth saying. */}

            {/* ⚰ "SPLIT BY PERIOD" STOOD BESIDE THIS FIELD AS A CHECKBOX AND IS DELETED (owner
                ruling 2026-09-04). Splitting was an optional extra a coach opted into, which is
                why almost nobody did and why most plan money carried no date at all — the form
                simply never asked. It is now one of the three answers to the required question
                below, so the form loses a control and gains a decision. Do not reinstate it: two
                ways to reach one split is how the two halves start disagreeing. */}
            <div className={styles.field}>
              {/* Associated label — tapping it focuses the field, which matters most on the
                  phone layout where label and input are on separate lines. */}
              {/* "Amount", not "Total Amount ($)" (owner 2026-09-04) — every other money form in the portal
                  says Amount, and the currency marker was a third thing the label was doing that
                  the field itself already says. */}
              <label className={styles.label} htmlFor={FOCUS_TOTAL}>Amount *</label>
              <input
                id={FOCUS_TOTAL}
                className={`${styles.input} ${flagged('total') ? styles.inputBad : ''}`}
                type="number"
                min="0.01"
                step="0.01"
                value={form.totalAmount}
                onChange={e => {
                  setLastMoneyEdit('total');
                  setForm(f => ({ ...f, totalAmount: e.target.value }));
                }}
                placeholder="0.00"
              />
            </div>

            {/* ── When does this money move? (owner ruling 2026-09-04) ─────────────────────
                ⚠ NO SUB-LINES UNDER THE ANSWERS (owner, same day). Each carried a describing
                sentence and all three were cut: "A day is never asked for" was the form defending
                a design decision to the coach, which is the reliable tell for filler, and the
                other two described what the next tap plainly shows. Three labels and a dropdown
                say all of it. The ONE consequence line under "No date yet" survives and is
                sharper for being alone — it now reads as a consequence rather than as the third
                in a row of captions.
                ⚠ NO GROUP HINT EITHER. A disabled "Save Line" already says the form is waiting. */}
            <div className={styles.field}>
              <span className={`${styles.label} ${flagged('when') ? styles.labelBad : ''}`} id={FOCUS_WHEN}>
                When does this money move? *
              </span>
              <div
                className={`${styles.whenAnswers} ${flagged('when') ? styles.whenAnswersBad : ''}`}
                role="radiogroup"
                aria-labelledby={FOCUS_WHEN}
              >
                {WHEN_ANSWERS.map(({ id, label }) => (
                  <div
                    key={id}
                    className={`${styles.whenAnswer} ${form.whenAnswer === id ? styles.whenAnswerOn : ''}`}
                  >
                    {/* The label wraps the input, so the whole row is the target — the portal's
                        own radio idiom, and what keeps this over the 44px floor on a phone
                        without a second rule. */}
                    <label className={styles.whenAnswerHead}>
                      <input
                        type="radio"
                        name="budget-line-when"
                        className={styles.whenRadio}
                        checked={form.whenAnswer === id}
                        onChange={() => chooseWhenAnswer(id)}
                      />
                      <span className={styles.whenAnswerName}>{label}</span>
                    </label>

                    {/* The month, picked with the SPLIT EDITOR'S OWN CONTROL — a select grouped by
                        year, offering the season year and the next (24 options, which is why the
                        approved mockup's chip row could not survive contact: 24 chips is a wall,
                        and a second way to answer one question inside a form that already holds
                        the first). Same control, same words, one place to change it. */}
                    {id === 'month' && form.whenAnswer === 'month' && (
                      <select
                        className={`${styles.select} ${styles.whenMonth} ${flagged('when-month') ? styles.inputBad : ''}`}
                        aria-label="Month this money moves"
                        value={periodSlotValue(form.periods[0] ?? BLANK_PERIOD, 'months')}
                        onChange={e => setPeriodSlot(0, 'months', e.target.value)}
                      >
                        <option value="">Pick a month</option>
                        {splitYears(seasonYear).map(year => (
                          <optgroup key={year} label={String(year)}>
                            {Array.from({ length: 12 }, (_, m) => m).map(slot => (
                              <option key={slot} value={`${year}|${slot}`}>
                                {derivedPeriodLabel('months',
                                  { label: '', amount: '', date: monthDate(year, slot) }, slot)}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    )}

                    {/* ⚠ SAID ONCE, AT THE MOMENT OF CHOOSING, AND NEVER REPEATED. It names the
                        money, what happens to it, and where to fix it later. A form that scolds
                        would teach coaches to guess a month to make it stop — trading an honest
                        gap for a confident lie — and the undated bucket can never be emptied
                        anyway, because a season estimate set before any lines exist has no lines
                        to date. */}
                    {id === 'none' && form.whenAnswer === 'none' && (
                      <p className={styles.whenConsequence}>
                        {lineTotalForConsequence
                          ? <>This <strong>{fmt(lineTotalForConsequence)}</strong> counts in your season total</>
                          : <>This money counts in your season total</>}
                        {' '}and in no month, and a <strong>To date</strong> comparison leaves it
                        out. You can give it a month any time from the plan&apos;s{' '}
                        <strong>When</strong> column.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* P2 — the mismatch banner that replaces the silent desync (owner-approved mockup,
                wording verbatim). "Rescale" is one tap; "I'll adjust it myself" steps aside for
                THIS total and comes back if it changes again. Save stays blocked either way —
                the sum check below is the same fact wearing its enforcement hat. */}
            {splitOutOfStep && (
              <div className={styles.splitWarn} role="alert">
                <p className={styles.splitWarnLead}>
                  This line&apos;s split still adds to {fmt(periodSum())}.
                </p>
                <p className={styles.splitWarnBody}>
                  {form.periods.length === 1
                    ? 'The period below no longer matches the new total.'
                    : `The ${form.periods.length} periods below no longer match the new total.`}
                </p>
                <div className={styles.splitWarnActs}>
                  <button type="button" className={shared.btnPrimary} onClick={rescaleSplit}>
                    Rescale the split proportionally
                  </button>
                  <button
                    type="button"
                    className={shared.btnGhost}
                    onClick={() => setRescaleDismissedFor(form.totalAmount)}
                  >
                    I&apos;ll adjust it myself
                  </button>
                </div>
              </div>
            )}

            {/* Period distribution */}
            {form.whenAnswer === 'split' && (
              <div className={styles.periodsSection}>
                <div className={styles.periodsSectionHeader}>
                  <span className={styles.label}>Period Breakdown</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ display: 'inline-flex', border: '1px solid var(--home-line, rgba(255,255,255,0.15))', borderRadius: 6, overflow: 'hidden' }}>
                      {(['amount', 'percent'] as const).map(mode => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => switchPeriodMode(mode)}
                          style={{
                            padding: '0.2rem 0.6rem', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', border: 'none',
                            background: form.periodMode === mode ? 'var(--home-olive-soft, rgba(255,255,255,0.14))' : 'transparent',
                            color: form.periodMode === mode ? 'var(--home-ink, rgba(255,255,255,0.9))' : 'var(--home-dim, rgba(255,255,255,0.45))',
                          }}
                        >
                          {mode === 'amount' ? '$' : '%'}
                        </button>
                      ))}
                    </span>
                    <button type="button" className={styles.addPeriodBtn} onClick={splitEvenly}>
                      Split evenly
                    </button>
                  </span>
                </div>

                {/* Step 1 — how is this line split? The question the form never used to ask, and
                    the reason an annual budget used to cost twelve trips through a date picker. */}
                <p className={styles.splitStep}>
                  <span className={styles.splitStepNum}>1.</span> Split this line by
                </p>
                <div className={styles.splitModes} role="group" aria-label="Split this line by">
                  {PERIOD_SPLIT_MODES.map(mode => (
                    <button
                      key={mode}
                      type="button"
                      className={styles.splitMode}
                      aria-pressed={form.splitMode === mode}
                      onClick={() => chooseSplitMode(mode)}
                    >
                      {SPLIT_MODE_LABEL[mode]}
                    </button>
                  ))}
                </div>

                <p className={styles.splitStep}>
                  <span className={styles.splitStepNum}>2.</span> {SPLIT_MODE_STEP_TWO[form.splitMode]}
                </p>

                {/* The honest sentence names mode always owed (P2, mockup wording verbatim): a
                    dateless chunk is a real choice with a real consequence, said once up here
                    rather than nagged per row. */}
                {form.splitMode === 'names' && (
                  <p className={styles.kindHint} style={{ margin: '0 0 0.5rem' }}>
                    Chunks are yours to name. A chunk without a date shows under{' '}
                    <strong>Unscheduled</strong> in the By-period view and the month report.
                  </p>
                )}

                {/* Column headings, desktop only — the phone layout labels every field inside the
                    group instead. "Optional" is stated in writing rather than implied by an empty
                    box, because a blank required-looking field is what started all this. In names
                    mode the NAME leads and the optional date sits second (P2 mockup) — the name is
                    the chunk's identity there, the date a bonus. */}
                {form.periods.length > 0 && (
                  <div className={styles.periodColHead} aria-hidden>
                    {form.splitMode === 'names' ? (
                      <>
                        <span className={styles.periodColLabel}>Name</span>
                        <span className={styles.periodColWhen}>{SPLIT_MODE_COLUMN.names}</span>
                      </>
                    ) : (
                      <>
                        <span className={styles.periodColWhen}>{SPLIT_MODE_COLUMN[form.splitMode]}</span>
                        <span className={styles.periodColLabel}>Label (optional)</span>
                      </>
                    )}
                    <span className={styles.periodColAmount}>
                      {form.periodMode === 'percent' ? 'Share' : 'Amount'}
                    </span>
                  </div>
                )}

                {/* On a desktop this is one compact row per period. On a phone it becomes a
                    labelled GROUP: three shrunken inputs in a row (picker / label / amount)
                    was the worst control in Money, and this is exactly the work the coach
                    least wants to redo. The per-period heading and the field labels are
                    rendered always and revealed by CSS at ≤640 — the CoachModalHeader
                    precedent for a control that exists in one form on each side. */}
                {form.periods.map((p, i) => {
                  /* The period's identity, and the reason the label could become optional. It is
                     a control of its own that never goes away — carrying the month only in the
                     label's placeholder meant typing a label hid which month the row was.
                     ⚠ NAMES MODE HAS ONE TOO NOW (P2): an OPTIONAL DateField, per period — so one
                     dateless chunk no longer hides the date controls for its dated siblings. */
                  const whenField = (
                    <label className={`${styles.periodFieldLabel} ${styles.periodFieldWhen}`}>
                      <span className={styles.periodFieldLabelText}>
                        {SPLIT_MODE_COLUMN[form.splitMode]}
                      </span>
                      {form.splitMode === 'dates' || form.splitMode === 'names' ? (
                        <DateField
                          value={p.date}
                          ariaLabel={form.splitMode === 'names'
                            ? `Date for ${resolvedPeriodLabel(form.splitMode, p, i)} (optional)`
                            : `Date for period ${i + 1}`}
                          onChange={v => setPeriodField(i, 'date', v)}
                        />
                      ) : (
                        <select
                          className={styles.select}
                          value={periodSlotValue(p, form.splitMode)}
                          onChange={e => setPeriodSlot(i, form.splitMode, e.target.value)}
                        >
                          {splitYears(seasonYear).map(year => (
                            <optgroup key={year} label={String(year)}>
                              {(form.splitMode === 'months'
                                ? Array.from({ length: 12 }, (_, m) => m)
                                : [0, 1, 2, 3]
                              ).map(slot => (
                                <option key={slot} value={`${year}|${slot}`}>
                                  {derivedPeriodLabel(
                                    form.splitMode,
                                    {
                                      label: '', amount: '',
                                      date: form.splitMode === 'months'
                                        ? monthDate(year, slot)
                                        : quarterDate(year, slot),
                                    },
                                    slot,
                                  )}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                      )}
                    </label>
                  );

                  const nameField = (
                    <label className={styles.periodFieldLabel}>
                      <span className={styles.periodFieldLabelText}>
                        {form.splitMode === 'names' ? 'Name' : 'Label (optional)'}
                      </span>
                      <input
                        className={styles.input}
                        type="text"
                        // The name this period WILL be saved under, shown before it is — so a
                        // coach can see it, and overwrite it, without ever being asked to invent
                        // one. Never a blank box demanding to be filled.
                        placeholder={derivedPeriodLabel(form.splitMode, p, i)}
                        value={p.label}
                        onChange={e => setPeriodField(i, 'label', e.target.value)}
                      />
                    </label>
                  );

                  return (
                  <div key={i} className={styles.periodInputRow}>
                    <div className={styles.periodGroupHead}>
                      <span className={styles.periodGroupNum}>
                        {resolvedPeriodLabel(form.splitMode, p, i)}
                      </span>
                      <button
                        type="button"
                        className={styles.periodGroupRemove}
                        onClick={() => removePeriod(i)}
                      >
                        Remove <X size={12} aria-hidden />
                      </button>
                    </div>

                    {/* Name first in names mode (the name IS the chunk's identity there, the
                        mockup's own order); the date-side control first everywhere else. */}
                    {form.splitMode === 'names'
                      ? <>{nameField}{whenField}</>
                      : <>{whenField}{nameField}</>}

                    <label className={`${styles.periodFieldLabel} ${styles.periodFieldAmount}`}>
                      <span className={styles.periodFieldLabelText}>
                        {form.periodMode === 'percent' ? 'Share (%)' : 'Amount ($)'}
                      </span>
                      <input
                        id={focusPeriodAmount(i)}
                        className={`${styles.input} ${flagged(`period-${i}`) ? styles.inputBad : ''}`}
                        type="number"
                        min="0.01"
                        step="0.01"
                        placeholder={form.periodMode === 'percent' ? '%' : '$'}
                        value={p.amount}
                        onChange={e => setPeriodField(i, 'amount', e.target.value)}
                      />
                    </label>

                    {form.periodMode === 'percent' && (
                      <span className={styles.periodPercentOut}>
                        {(parseFloat(form.totalAmount) || 0) > 0 && parseFloat(p.amount) > 0
                          ? fmt(((parseFloat(form.totalAmount) || 0) * parseFloat(p.amount)) / 100)
                          : '—'}
                      </span>
                    )}

                    <button
                      type="button"
                      className={styles.removePeriodBtn}
                      aria-label={`Remove ${resolvedPeriodLabel(form.splitMode, p, i)}`}
                      onClick={() => removePeriod(i)}
                    >
                      <X size={13} />
                    </button>

                    {flagged(`period-${i}`) ? (
                      <p className={styles.periodRowMsgBad}>
                        Enter an amount for “{resolvedPeriodLabel(form.splitMode, p, i)}”.
                      </p>
                    ) : !p.date && form.splitMode !== 'names' ? (
                      // Advisory, never a blocker: an undated period simply cannot be placed on a
                      // calendar. That is information the coach needs, not a reason to stop them.
                      // Names mode says it ONCE, in the section hint above — every chunk there
                      // starts dateless, and a per-row echo would nag the mode's normal state.
                      <p className={styles.periodRowMsg}>
                        No date — this won&apos;t show in Budget vs. Actual month columns.
                      </p>
                    ) : null}
                  </div>
                  );
                })}

                {form.periods.length === 0 && (
                  <p className={styles.periodEmpty}>No periods yet.</p>
                )}

                <div className={styles.periodAddBar}>
                  <button
                    id={FOCUS_ADD}
                    type="button"
                    className={styles.addPeriodBtn}
                    onClick={addPeriod}
                  >
                    + Add period
                  </button>
                  {(form.splitMode === 'months' || form.splitMode === 'quarters') && (
                    <button type="button" className={styles.periodQuietBtn} onClick={fillSeason}>
                      Fill the season ({form.splitMode === 'months' ? '12 months' : '4 quarters'})
                    </button>
                  )}
                  {form.periods.length >= 2 && (
                    <button type="button" className={styles.periodQuietBtn} onClick={clearPeriods}>
                      Clear all periods
                    </button>
                  )}
                </div>

                {/* The way back from a bulk action. A single × is one click to put back; twelve
                    rows are not, so those get a way home rather than a confirmation dialog. */}
                {periodUndo && (
                  <div className={styles.periodUndo} role="status">
                    <span>{periodUndo.text}</span>
                    <button type="button" onClick={undoPeriodChange}>Undo</button>
                  </div>
                )}

                {(() => {
                  const err = periodSumError();
                  const sum = periodSum();
                  const total = parseFloat(form.totalAmount) || 0;
                  return (
                    <div className={`${styles.periodSumRow} ${err ? styles.periodSumError : ''}`}>
                      <span>Period total</span>
                      <span>
                        {form.periodMode === 'percent'
                          ? <>{sum.toFixed(1)}% {total > 0 && `= ${fmt((total * sum) / 100)}`}</>
                          : <>{fmt(sum)} {total > 0 && `/ ${fmt(total)}`}</>}
                      </span>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Notes — and, on a SECOND line for an item already in the plan, the one question
                that keeps the fold and the export from being nameless (P1, owner Q1). Same field,
                same column: the answer IS the note, so nothing new is stored and an existing note
                edits in place under the sharper label. */}
            <div className={styles.field}>
              <label className={styles.label} htmlFor="budget-line-notes">
                {itemSiblingCount > 0 ? 'What makes this line different?' : 'Notes'}
              </label>
              <input
                id="budget-line-notes"
                className={styles.input}
                type="text"
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder={itemSiblingCount > 0 ? 'e.g. Regional qualifier' : 'Any additional context'}
                maxLength={500}
              />
              {itemSiblingCount > 0 && (
                <p className={styles.kindHint}>
                  {form.itemName || 'This item'} already has {itemSiblingCount === 1
                    ? 'a line' : `${itemSiblingCount} lines`} on this plan, so they share one row —
                  a few words here name this one inside it. Without them it is named by when the
                  money moves.
                </p>
              )}
            </div>

            {saveError && <p className={styles.errorText}>{saveError}</p>}
            <div className={shared.modalFooter}>
              {/* Deleting lives HERE now (owner 2026-08-13) — the rows outside carry only the
                  edit door, so the modal is where a line's full powers are. Opens the same
                  confirm dialog the trash icon used to; a successful delete closes this form
                  too (its line no longer exists). */}
              {editingLine && (
                <button
                  type="button"
                  className={styles.deleteLineBtn}
                  onClick={() => setDeletingId(editingLine.id)}
                >
                  Delete line
                </button>
              )}
              {/* The footer is sticky, so this counter is the one piece of the verdict that is
                  visible however far the form is scrolled — the gap the old bottom-of-the-body
                  message fell through. Clicking it goes back to the first thing at fault. */}
              {saveTried && problems.length > 0 && (
                <button
                  type="button"
                  className={styles.fixCounter}
                  onClick={() => jumpToProblem(problems[0])}
                >
                  <AlertTriangle size={13} aria-hidden />
                  {problems.length} thing{problems.length === 1 ? '' : 's'} to fix
                </button>
              )}
              <button type="button" className={shared.btnGhost} onClick={closeLineModal}>Cancel</button>
              <button type="button" className={shared.btnPrimary} onClick={handleSaveLine} disabled={saving}>
                {saving ? 'Saving…' : editingLine ? 'Save Changes' : 'Add Line'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm — short dialog, opts out of the mobile sheet default ────── */}
      {deletingId && (
        <div className={`${shared.modalOverlay} ${shared.centeredOnMobile}`} onPointerDown={e => { if (e.target === e.currentTarget) (closeDelete)?.(); }}>
          <div className={shared.modal} style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
            <div className={shared.modalHeader}>
              <h3 className={shared.modalTitle}>Delete Budget Line?</h3>
              <button className={shared.modalCloseBtn} aria-label="Close" onClick={closeDelete}><X size={16} /></button>
            </div>
            <p style={{ color: 'var(--home-ink-soft, rgba(255,255,255,0.6))', fontSize: '0.9rem', margin: '0 0 1.25rem' }}>
              This will also remove any period breakdown for this line. This cannot be undone.
            </p>
            {deleteError && (
              <p className={shared.errorText} style={{ margin: '-0.75rem 0 1.25rem' }}>{deleteError}</p>
            )}
            <div className={shared.modalFooter}>
              <button type="button" className={shared.btnGhost} onClick={closeDelete}>Cancel</button>
              <button
                type="button"
                className={shared.btnDanger}
                disabled={deleting}
                onClick={() => handleDelete(deletingId)}
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Set dues for all players — the bulk-dues door, shared with Player Dues ── */}
      {genOpen && (
        <GenerateInstallmentsModal
          orgSlug={orgSlug}
          teamId={teamId}
          budgetHref={moneySectionHref(base, 'budget', undefined)}
          // ⚠ The HUB tab — the legacy standalone page one directory down used to resolve too
          // (without the hub's tab bar, stranding the coach), which is why this link goes through
          // the shared builder. Those routes were deleted outright on 2026-08-31.
          duesHref={moneySectionHref(base, 'dues', undefined)}
          // Must travel with the modal: the hub keeps this panel mounted behind another tab, and
          // a dirty form that can't be seen must not intercept clicks. See the prop's own note.
          tabActive={tabActive}
          onClose={() => setGenOpen(false)}
          onGenerated={load}
        />
      )}

      {/* ── Chunk G sheets — the starter (write-gated) and the sample (education) ── */}
      {starterOpen && moneyCanWrite && (
        <BudgetStarterSheet
          orgSlug={orgSlug}
          teamId={teamId}
          categories={categories}
          onClose={() => setStarterOpen(false)}
          onOpenSample={() => { setStarterOpen(false); setSampleOpen(true); }}
          onCreated={load}
        />
      )}
      {sampleOpen && (
        <SampleBudgetSheet onClose={() => setSampleOpen(false)} />
      )}

      {/* ── Chunk H2 — the spreadsheet importer (write-gated, like every other write door) ── */}
      {importOpen && moneyCanWrite && (
        <BudgetImportSheet
          orgSlug={orgSlug}
          teamId={teamId}
          categories={toKnownCategories(categories)}
          // COST lines only — the same rule the import's write path enforces. A sheet row has no
          // kind, so it is always a cost; offering an expected-funding line as a match target
          // would let "Fundraising" in a spreadsheet overwrite the money the team plans to raise.
          existingLines={(plan?.lines ?? []).filter(l => !isFundingKind(l.lineKind)).map(l => ({
            id: l.id, description: l.description, categoryName: l.categoryName, totalAmount: l.totalAmount,
          }))}
          existingPayableDescriptions={[]}
          seasonYear={seasonYear}
          gridMonths={planMonths}
          todayMonth={today().slice(0, 7)}
          onClose={() => setImportOpen(false)}
          onImported={message => {
            setImportOpen(false);
            setImportMessage(message);
            void load();
          }}
        />
      )}

      {/* ── Our own words — rename one, or move it to the other side (mig 246) ────────────
          ⚠ RELOADS THE TAXONOMY, NOT THE PLAN. A rename changes what every line is CALLED, and the
          plan's rows read their names from this same fetch — so `load()` is what makes the change
          visible on the list behind the modal rather than only inside it. */}
      {itemManagerOpen && moneyCanWrite && (
        <BudgetItemManagerModal
          orgSlug={orgSlug}
          teamId={teamId}
          categories={categories}
          onClose={() => setItemManagerOpen(false)}
          /* ⚠⚠ THE BUMP IS NOT OPTIONAL (/review, concurrency lens, 2026-08-16). `load()` refreshes
             THIS panel only, and the hub keeps every visited tab mounted — so a rename made here
             left the money form's own picker, one tab over, showing the old name and the old side
             for the rest of the session, silently suppressing the "on the other side" badge this
             same release built. Every other money write path in the hub bumps this; the new modal
             simply had not joined them. */
          onChanged={() => { void load(); bumpMoneyRevision(); }}
        />
      )}

      {/* The discard guards cover dismissing a sheet; this covers walking away from one. The
          generate modal carries its own — it is shared, so its protection travels with it. */}
      <UnsavedChangesGuard
        active={lineDirty}
        interceptClicks={lineDirty && tabActive}
        message="You haven't saved what you entered on this form. Leave without saving it?"
      />
    </div>
  );
}
