'use client';
import { useState, useEffect, useCallback, useMemo, useRef, use, Fragment } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { BarChart3, Plus, X, ChevronDown, ChevronRight, ArrowLeft, Upload, AlertTriangle } from 'lucide-react';
import { useCoaches, useCoachSeasonPage } from '@/lib/coaches-context';
import CoachPageHeader from '@/components/coaches/CoachPageHeader';
import { useOverlayOpen } from '@/lib/coaches-overlay';
import BudgetItemPicker from '@/components/accounting/BudgetItemPicker';
import BudgetStarterSheet from '@/components/coaches/BudgetStarterSheet';
import SampleBudgetSheet from '@/components/coaches/SampleBudgetSheet';
import BudgetImportSheet from '@/components/coaches/BudgetImportSheet';
import RowEditButton from '@/components/coaches/RowEditButton';
import { monthKeyOf } from '@/lib/coach-budget-months';
import { useMoneyRevision } from '@/lib/coach-money-refresh';
import { BUDGET_LINE_COLUMNS, budgetLineRows } from '@/lib/coach-money-exports';
import { moneySectionHref } from '@/lib/coach-money-links';
import MoneyExportButton from '@/components/coaches/MoneyExportButton';
import { fmtCompact } from '@/lib/coach-money-summary';
import { toggleKey } from '@/lib/toggle-key';
import {
  computeBudgetTotals, LINE_KIND_LABEL, LINE_KIND_HINT, LINE_KIND_SECTION, BUDGET_LINE_KINDS,
  isFundingKind, normalizeBudgetLineKind, FUNDING_LINE_KINDS,
  type BudgetLineKind,
} from '@/lib/coach-budget-totals';
import {
  buildPeriodView, GRANULARITY_LABEL, PERIOD_GRANULARITIES, UNSCHEDULED,
  type PeriodGranularity,
} from '@/lib/coach-budget-periods-view';
import {
  PERIOD_SPLIT_MODES, SPLIT_MODE_LABEL, SPLIT_MODE_NOUN, SPLIT_MODE_STEP_TWO, SPLIT_MODE_COLUMN,
  blankPeriod, nextPeriodDate, fillSeasonPeriods, inferSplitMode, resolvedPeriodLabel,
  derivedPeriodLabel, splitYears, readDate, monthDate, quarterDate, quarterOf,
  type PeriodSplitMode,
} from '@/lib/coach-budget-period-modes';
import CoachEmptyState from '@/components/coaches/CoachEmptyState';
import type {
  RepBudgetPlan,
  RepBudgetLineWithPeriods,
  BudgetCategoryWithItems,
} from '@/lib/types';
import DateField from '../DateField';
import GenerateInstallmentsModal from '../GenerateInstallmentsModal';
import styles from './budget.module.css';
import shared from '../../../../coaches.module.css';
import CoachModalHeader from '@/components/coaches/CoachModalHeader';
import CoachScrollX from '@/components/coaches/CoachScrollX';
import UnsavedChangesGuard from '@/components/shared/UnsavedChangesGuard';
import { useDiscardGuard } from '@/components/coaches/useDiscardGuard';
import { tournamentToday } from '@/lib/timezone';

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

interface LineForm {
  description: string;
  categoryId: string;
  itemId: string | null;
  categoryName: string;
  itemName: string;
  totalAmount: string;
  /** Is this money the team spends, or money it expects to bring in? Chosen first in the form,
   *  because it changes what every field below it means. */
  lineKind: BudgetLineKind;
  notes: string;
  usePeriods: boolean;
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
  lineKind:     'cost',
  notes:        '',
  usePeriods:   false,
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
function BudgetLineRow({
  line, expanded, funding, canWrite, onToggle, onEdit,
}: {
  line: RepBudgetLineWithPeriods;
  expanded: boolean;
  funding: boolean;
  canWrite: boolean;
  onToggle: () => void;
  onEdit: () => void;
}) {
  const moneyClass = funding ? styles.fundingAmount : '';

  /* A line and its expanded periods are siblings inside the category frame — the shared
     `.ledgerRow` draws the rule that separates one line from the next, so no wrapper is needed
     (and a wrapper here would sit between the frame and its rows for no reason). */
  return (
    <>
      {/* The whole row opens the editor for a write coach (owner 2026-08-13) — the pencil stays
          the SEMANTIC control (keyboard, screen reader, and the visible desktop door); the row
          is the pointer/touch shortcut, and on a phone the only visible one. The chevron stops
          propagation so expanding a split line never also opens its form. Delete lives in the
          edit modal now, behind the same confirm as always — one door, full capability inside. */}
      <div
        className={`${shared.ledgerRow} ${canWrite ? shared.rowTappable : ''}`}
        // Selecting text to copy an amount must not open the form — a click that ends a
        // selection is a copy gesture, not a tap (review finding).
        onClick={canWrite ? () => { if (window.getSelection()?.toString()) return; onEdit(); } : undefined}
      >
        <div className={shared.ledgerCell}>
          {line.periods.length > 0
            ? (
              <button
                type="button"
                className={shared.ledgerExpand}
                aria-expanded={expanded}
                aria-label={expanded ? `Hide ${line.description}'s payment periods` : `Show ${line.description}'s payment periods`}
                onClick={e => { e.stopPropagation(); onToggle(); }}
              >
                {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
            )
            : <span className={shared.ledgerExpandSpacer} />}

          <span className={styles.lineInfo}>
            <span className={shared.ledgerDesc}>{line.description}</span>
            {line.notes && <span className={`${shared.ledgerNote} ${shared.wrap640}`}>{line.notes}</span>}
          </span>
        </div>

        <span className={`${shared.ledgerNum} ${shared.ledgerNumStrong} ${moneyClass}`}>{fmt(line.totalAmount)}</span>

        {/* Always rendered so every row keeps the same three tracks. For a write coach the track
            is fixed (.linesCanWrite) so the money column holds still; read-only rows have no
            button and the auto track collapses uniformly instead. */}
        <span className={shared.ledgerActions}>
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
        </span>
      </div>

      {expanded && line.periods.length > 0 && (
        <div className={shared.ledgerSubRows}>
          {line.periods.map((p, i) => (
            <div key={i} className={shared.ledgerSubRow}>
              <span className={shared.ledgerCell}>
                <span className={`${shared.ledgerSubLabel} ${shared.wrap640}`}>{p.periodLabel}</span>
                {p.periodDate && (
                  <span className={shared.ledgerSubMeta}>
                    {new Date(p.periodDate + 'T00:00:00').toLocaleDateString('en-CA', {
                      month: 'short', day: 'numeric', year: 'numeric',
                    })}
                  </span>
                )}
              </span>
              <span className={`${shared.ledgerNum} ${moneyClass}`}>{fmt(p.amount)}</span>
              <span />
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/**
 * The plan read ACROSS time — month or quarter columns, built from the period splits coaches
 * already enter. Read-only by design: this is a way to SEE the plan, and every edit still happens
 * in the list's own form, so there is exactly one place a budget line can be changed.
 */
function PeriodGrid({ view }: { view: ReturnType<typeof buildPeriodView> }) {
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
   */
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const toggleGroup = (key: string) => setClosed(prev => toggleKey(prev, key));

  return (
    <div className={styles.periodGridWrap}>
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
                ⚠ Unscheduled and Total sit under an EMPTY band on purpose — they belong to no
                year, and giving them one would be a tidy lie in a table whose job is to add up. */}
            {view.yearBands.length > 0 && (
              <tr className={styles.periodGridYearRow}>
                <th scope="col" aria-hidden />
                {view.yearBands.map(band => (
                  <th key={band.year} scope="colgroup" colSpan={band.span} className={styles.periodGridYear}>
                    {band.year}
                  </th>
                ))}
                <th scope="col" aria-hidden colSpan={view.hasUnscheduled ? 2 : 1} />
              </tr>
            )}
            <tr>
              {/* Named the same as Budget vs. Actual's month grid — one grid, one word for its
                  first column. It was "Line" here and "Category / line" there. */}
              <th scope="col">Category / line</th>
              {view.columns.map(col => (
                <th key={col.key} scope="col" className={col.unscheduled ? styles.periodGridUnscheduled : ''}>
                  {col.label}
                </th>
              ))}
              <th scope="col">Total</th>
            </tr>
          </thead>
          <tbody>
            {view.groups.map(group => {
              const open = !closed.has(group.key);
              return (
              <Fragment key={group.key}>
                <tr className={`${shared.moneyGridCat} ${isFundingKind(group.lineKind) ? styles.periodGridFunding : ''}`}>
                  <th scope="rowgroup">
                    <button
                      type="button"
                      className={shared.moneyGridToggle}
                      onClick={() => toggleGroup(group.key)}
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
                  {view.columns.map(col => <td key={col.key}>{fmtCell(fundingCell(group.lineKind, group.cells[col.key]))}</td>)}
                  <td>{fmtCell(fundingCell(group.lineKind, group.total))}</td>
                </tr>
                {open && group.rows.map(row => (
                  <tr key={row.id} className={isFundingKind(group.lineKind) ? styles.periodGridFunding : ''}>
                    <th scope="row" className={shared.moneyGridLead}>{row.description}</th>
                    {view.columns.map(col => <td key={col.key}>{fmtCell(fundingCell(row.lineKind, row.cells[col.key]))}</td>)}
                    <td>{fmtCell(fundingCell(row.lineKind, row.total))}</td>
                  </tr>
                ))}
              </Fragment>
              );
            })}
            <tr className={shared.moneyGridTotal}>
              <th scope="row">
                {/* NOT "Player installments" (review finding): this grid spreads the PLAN —
                    itemized costs less fundraising, estimate-blind — and borrowing the card's
                    label would put one name on two different numbers. */}
                {view.groups.some(g => isFundingKind(g.lineKind)) ? 'Costs less fundraising' : 'Total planned budget'}
              </th>
              {view.columns.map(col => <td key={col.key}>{fmtCell(view.totals.cells[col.key])}</td>)}
              <td>{fmtCell(view.totals.total)}</td>
            </tr>
          </tbody>
        </table>
      </CoachScrollX>
      {view.hasUnscheduled && (
        <p className={styles.periodGridNote}>
          <strong>Unscheduled</strong> holds anything without payment dates. Split a line by period
          to move it into a month.
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
function formFromLine(
  line: RepBudgetLineWithPeriods, seasonYear: number, fallbackMode: PeriodSplitMode,
): LineForm {
  const periods: PeriodRow[] = line.periods.map(p => ({
    label: p.periodLabel, date: p.periodDate ?? '', amount: String(p.amount),
  }));
  // A saved line carries no mode — it is READ BACK from the dates and names it holds, so a budget
  // entered by month reopens by month. Inference can be wrong; correcting it costs one tap and
  // rewrites nothing until the coach saves.
  const splitMode = periods.length > 0 ? inferSplitMode(periods) : fallbackMode;
  return {
    description:  line.description,
    categoryId:   line.categoryId ?? '',
    itemId:       line.itemId,
    categoryName: line.categoryName ?? '',
    itemName:     line.itemName    ?? line.description,
    totalAmount:  String(line.totalAmount),
    lineKind:     normalizeBudgetLineKind(line.lineKind),
    notes:        line.notes ?? '',
    usePeriods:   line.periods.length > 0,
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
    || a.lineKind !== b.lineKind
    || a.notes !== b.notes
    || a.usePeriods !== b.usePeriods
    || a.periods.length !== b.periods.length
  ) return false;
  return a.periods.every((p, i) =>
    p.label === b.periods[i].label && p.date === b.periods[i].date && p.amount === b.periods[i].amount);
}

export function BudgetPlanPanel({
  params: paramsPromise,
  embedded = false,
  tabActive = true,
}: {
  params: Promise<{ orgSlug: string; teamId: string }>;
  /** Rendered as a Money hub tab — suppress the standalone "back to Money" affordance. */
  embedded?: boolean;
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
  // Σ of this season's dues schedules — the Dues tab's "assessed" total, echoed here so the plan
  // can show players' side of the funding and read as a complete budget. Display-only: it is never
  // a budget line and never enters computeBudgetTotals (dues are DERIVED from the plan — feeding
  // them back in as funding would be circular).
  const [duesAssessed, setDuesAssessed] = useState(0);
  const [categories, setCategories] = useState<BudgetCategoryWithItems[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');

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
  // One key per money-in KIND (`kind:funding`, `kind:sponsorship`) — built at the render site now
  // that there are two sections. The `kind:` prefix is what keeps a cost category literally named
  // "Expected funding" from sharing a key with the section and collapsing it too (review
  // 2026-08-13, and the reason the prefix exists at all).
  const isClosed = (key: string) => closedSections.has(key);
  const toggleSectionClosed = (key: string) => setClosedSections(prev => toggleKey(prev, key));

  // Reading the plan DOWN a list or ACROSS time. The month columns existed only on Budget vs.
  // Actual, blended with actuals, which is why coaches on this page concluded the plan had none
  // (owner finding 2026-08-12). Both views are built from the payload already loaded — switching
  // never refetches, and quarters are months grouped, so the two can't disagree.
  const [viewMode,    setViewMode]    = useState<'list' | 'period'>('list');
  const [granularity, setGranularity] = useState<PeriodGranularity>('months');

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
  // The dirty baseline for whatever the line modal is currently showing: BLANK for a plain add,
  // the prefilled form for a checklist-chip add, the loaded record for an edit. Set by every
  // path that opens the modal, so the guard can never count OUR prefill as the coach's work and
  // nag on an untouched form (the one-mapping rule, Chunk A — `formFromLine` stays the single
  // form↔record mapping, this is just where its result is remembered).
  const [formBaseline,       setFormBaseline]       = useState<LineForm>(BLANK_FORM);

  // Generate installments — the modal itself is shared with Player Dues (one bulk-dues door,
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
  const filledPeriods = modalOpen && form.usePeriods
    ? form.periods.filter(p => p.label || p.date || p.amount).length
    : 0;
  const closeLineModal = useDiscardGuard({
    dirty: lineDirty,
    close: () => setModalOpen(false),
    noun: 'budget line',
    // Names the work at stake rather than "unsaved changes" — the period split is the
    // whole reason this guard exists, so it gets counted out loud.
    detail: [
      form.totalAmount && 'an amount',
      form.description && 'a description',
      filledPeriods > 0 && `${filledPeriods} payment period${filledPeriods === 1 ? '' : 's'}`,
    ].filter(Boolean).join(' and ') || undefined,
  });

  // The delete confirm holds no typed work, so it closes silently — it just has to clear
  // the failure message so reopening it doesn't show a stale reason.
  const closeDelete = useCallback(() => { setDeletingId(null); setDeleteError(''); }, []);

  // Chunk F — which SEASON is on screen. `page.capabilities` are that season's (rule 1)
  // and `page.canWrite()` folds in read-only, so write flags go through it.
  const seasonSearchParams = useSearchParams();
  const page = useCoachSeasonPage(orgSlug, teamId, seasonSearchParams.get('year'));
  const seasonQuery = page.query;
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
    const out: Array<{ id: string; name: string; categoryId: string; categoryName: string }> = [];
    for (const c of categories) {
      if (!c.isDefault) continue;
      for (const it of c.items) {
        if (!it.isDefault || it.isMisc) continue;
        if (linkedIds.has(it.id) || usedNames.has(it.name.toLowerCase())) continue;
        if (dismissedChecklist.includes(it.id)) continue;
        out.push({ id: it.id, name: it.name, categoryId: c.id, categoryName: c.name });
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

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [planRes, catRes] = await Promise.all([
        fetch(`/api/coaches/${orgSlug}/teams/${teamId}/budget-plan${seasonQuery}`),
        fetch(`/api/coaches/${orgSlug}/budget-items`),
      ]);
      const planData = await planRes.json();
      const catData  = await catRes.json();
      if (!planRes.ok) throw new Error(planData.error ?? 'Failed to load plan');
      setPlan(planData.plan);
      setDuesAssessed(planData.duesAssessed ?? 0);
      setSeasonTotal(planData.seasonBudgetAmount ?? null);
      setSeasonInput(planData.seasonBudgetAmount != null ? String(planData.seasonBudgetAmount) : '');
      if (typeof planData.seasonYear === 'number') setSeasonYear(planData.seasonYear);
      setCategories(catData.categories ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [orgSlug, teamId, seasonQuery]);

  // `moneyRevision` bumps when the hub's Import menu commits rows while this panel is mounted
  // but off-screen — the panel re-READS rather than remounting, so a half-filled line form on
  // another tab is never thrown away. Outside the hub the revision is a constant 0.
  const moneyRevision = useMoneyRevision();
  useEffect(() => { load(); }, [load, moneyRevision]);

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

  // Deep link from the month grid (chunk H): ?line=<id> opens THIS page's existing edit modal
  // on that line, with its payment periods expanded. The grid is a way to REACH the form that
  // already exists — it never grows an editor of its own. Same one-shot recipe as ?generate=1:
  // write-capable only, silently ignored when the line has gone.
  const lineDeepLinkDone = useRef(false);
  useEffect(() => {
    if (lineDeepLinkDone.current || loading || !plan) return;
    const a = assignments.find(x => x.teamId === teamId);
    if (!a) return; // assignments still loading — try again next render
    lineDeepLinkDone.current = true;
    if (a.capabilities.money !== 'write') return;
    if (typeof window === 'undefined') return;
    const q = new URLSearchParams(window.location.search);
    const lineId = q.get('line');
    if (!lineId) return;
    const line = plan.lines.find(l => l.id === lineId);
    if (!line) return;
    const opened = formFromLine(line, seasonYear, lastSplitMode);
    // ?periods=1 arrives from a month cell, where the coach was looking at dates — so the period
    // split opens even on a line that is currently a lump sum. It becomes the BASELINE too: our
    // opening the split is not the coach's work, so an untouched form must still close silently.
    if (q.get('periods') === '1') opened.usePeriods = true;
    setEditingLine(line);
    setForm(opened);
    setFormBaseline(opened);
    resetModalTransients();
    setModalOpen(true);
    // One-shot deep link (guarded by lineDeepLinkDone). `seasonYear`/`lastSplitMode` are read for
    // the opening form only — listing them would re-run this and reopen the modal over whatever
    // the coach is doing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, plan, assignments, teamId]);

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
   *  the dirty baseline, so closing an untouched prefilled form stays silent. */
  function openAddFromChecklist(item: { id: string; name: string; categoryId: string; categoryName: string }) {
    const prefilled: LineForm = {
      ...blankLineForm(seasonYear, lastSplitMode),
      categoryId:   item.categoryId,
      categoryName: item.categoryName,
      itemId:       item.id,
      itemName:     item.name,
    };
    setEditingLine(null);
    setForm(prefilled);
    setFormBaseline(prefilled);
    resetModalTransients();
    setModalOpen(true);
  }

  function openEdit(line: RepBudgetLineWithPeriods) {
    const loaded = formFromLine(line, seasonYear, lastSplitMode);
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
    if (!form.usePeriods || form.periods.length === 0) return null;
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
  function chooseSplitMode(mode: PeriodSplitMode) {
    if (form.splitMode === mode) return;
    rememberSplitMode(mode);
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
    setForm(f => {
      const periods = [...f.periods];
      periods[index] = { ...periods[index], [field]: value };
      return { ...f, periods };
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
      const share = Math.floor((whole / n) * 100) / 100;
      const last = Math.round((whole - share * (n - 1)) * 100) / 100;
      const periods = f.periods.map((p, i) => ({ ...p, amount: String(i === n - 1 ? last : share) }));
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

    // A funding line's description IS its name — no item-name fallback (review finding: a
    // legacy funding line's hidden item name silently stood in for a cleared field, saving
    // the old name instead of raising the error the asterisk promises).
    const named = isFundingKind(form.lineKind)
      ? form.description.trim()
      : form.description.trim() || form.itemName.trim();
    if (!named) {
      out.push({ id: 'desc', message: 'Give this line a description.', focusId: FOCUS_DESC });
    }
    const total = parseFloat(form.totalAmount);
    if (isNaN(total) || total <= 0) {
      out.push({ id: 'total', message: 'Enter a total amount for this line.', focusId: FOCUS_TOTAL });
    }

    if (form.usePeriods) {
      if (form.periods.length === 0) {
        out.push({
          id: 'no-periods',
          message: 'Add at least one period, or turn the split off.',
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

  const problems = modalOpen ? collectProblems() : [];
  const problemIds = new Set(problems.map(p => p.id));
  /** Nothing is drawn as at fault until Save has actually been pressed. */
  const flagged = (id: string) => saveTried && problemIds.has(id);

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

    // Same rule as collectProblems: funding lines save the description alone.
    const description = isFundingKind(form.lineKind)
      ? form.description.trim()
      : form.description.trim() || form.itemName.trim();
    const totalAmount = parseFloat(form.totalAmount);

    setSaving(true);
    setSaveError('');
    try {
      const isEdit = !!editingLine;
      const url    = isEdit
        ? `/api/coaches/${orgSlug}/teams/${teamId}/budget-plan/lines/${editingLine!.id}`
        : `/api/coaches/${orgSlug}/teams/${teamId}/budget-plan/lines`;

      const res  = await fetch(url, {
        method:  isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description,
          // Funding lines never store a category/item — including legacy ones saved before the
          // picker became cost-only, which shed theirs on the next edit.
          categoryId:  isFundingKind(form.lineKind) ? null : form.categoryId || null,
          itemId:      isFundingKind(form.lineKind) ? null : form.itemId,
          totalAmount,
          lineKind:    form.lineKind,
          notes:       form.notes.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to save');

      const lineId = isEdit ? editingLine!.id : data.line.id;

      // Save period distribution (always stored as dollars; % mode converts here)
      if (form.usePeriods && form.periods.length > 0) {
        const dollarAmounts = periodDollarAmounts();
        // The label the coach typed, else the one the form has been showing them all along
        // ("Apr 2027"). The stored column is NOT NULL and the API rejects a blank, so resolving
        // here is what lets the field be optional on screen.
        const periodsPayload = form.periods.map((p, i) => ({
          periodLabel: resolvedPeriodLabel(form.splitMode, p, i),
          periodDate:  p.date || null,
          amount:      dollarAmounts[i],
          sortOrder:   i,
        }));
        await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/budget-plan/lines/${lineId}/periods`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ periods: periodsPayload }),
        });
      } else if (!form.usePeriods && isEdit && editingLine!.periods.length > 0) {
        // Clear periods if user toggled off
        await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/budget-plan/lines/${lineId}/periods`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ periods: [] }),
        });
      }

      setModalOpen(false);
      await load();
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
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

  // Group COST lines by category name for display. Funding lines are deliberately not here:
  // they are money coming IN, and filing them under a spending category would put "Chocolate
  // drive" under "Tournaments". They get one section of their own at the foot of the plan.
  function groupLines(lines: RepBudgetLineWithPeriods[]) {
    const grouped: Map<string, RepBudgetLineWithPeriods[]> = new Map();
    for (const line of lines) {
      if (isFundingKind(line.lineKind)) continue;
      const key = line.categoryName ?? 'Uncategorized';
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(line);
    }
    return [...grouped.entries()];
  }

  if (ctxLoading) return <p className={styles.muted}>Loading…</p>;
  if (!assignment) return <p className={styles.muted}>Team not found.</p>;

  const allLines    = plan?.lines ?? [];
  const groups      = groupLines(allLines);
  const fundingLines = allLines.filter(l => isFundingKind(l.lineKind));
  // Read-only money assistants see the plan but no write affordances (server
  // enforces regardless; this matches the gating on the Dues/BvA pages).
  const moneyCanWrite = page.canWrite(page.capabilities?.money === 'write');

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
  // which names the container. So the create lives in the toolbar below and this header keeps
  // only what is genuinely page-level.
  //
  // ⚠ IMPORT IS HEADER-LEVEL ONLY WHEN THIS PANEL IS ITS OWN PAGE. Inside the hub the constant
  // `Import ▾` menu above the tabs owns it (and lists this dataset by name); rendering a second
  // Import here would be the same door twice, one line apart. On the standalone route there is
  // no such menu, so the button stays — that is rule 8's "single-dataset screens keep plain
  // buttons", and it is what stops the importer becoming unreachable outside the hub.
  const headerActions = !embedded && moneyCanWrite ? (
    <button type="button" className={shared.btnSecondary} onClick={() => setImportOpen(true)} aria-label="Import">
      <Upload size={15} aria-hidden /> <span className={shared.headerBtnLabel}>Import</span>
    </button>
  ) : null;

  // Rule 5, one name one weight: every page's main create is the FILLED LIME button. Add Line
  // was outlined while New Fundraiser one tab away was filled — the same job, two weights.
  const addLineButton = moneyCanWrite ? (
    <button type="button" className={shared.btnPrimary} onClick={openAdd}>
      <Plus size={15} aria-hidden /> Add Line
    </button>
  ) : null;

  /** The plan as it stands, built at click time. Not write-gated: reading is not writing. */
  const planExport = (
    <MoneyExportButton
      label="Budget lines"
      formats={['xlsx', 'csv']}
      build={() => ({
        dataset: 'budget-lines',
        title: 'Season Budget Plan',
        columns: BUDGET_LINE_COLUMNS,
        rows: budgetLineRows(allLines),
        scopeLabel: assignment?.programYearName ?? '',
        teamName: assignment?.teamName ?? '',
        emptyMessage: 'There are no budget lines to export yet — build the plan first.',
      })}
      disabled={allLines.length === 0}
    />
  );

  return (
    <div className={styles.page}>
      {/* Header */}
      {!embedded && (
        <Link href={`${base}/accounting${seasonQuery}`} className={shared.lineupBackLink}>
          <ArrowLeft size={14} aria-hidden /> Back to Money
        </Link>
      )}
      <CoachPageHeader
        variant={embedded ? 'embedded' : 'standard'}
        icon={BarChart3}
        title="Season Budget Plan"
        season={page.season}
        teamBase={page.teamBase}
        actions={headerActions}
        helpLabel="Budget Plan"
        help={{ module: 'coaches', sectionIds: ['premium-money'], subtopicId: 'premium-money-budget', fullGuideHref: `/${orgSlug}/coaches/help#premium-money` }}
      />

      {importMessage && (
        <p className={styles.importedNote} role="status">{importMessage}</p>
      )}

      {loading ? (
        <p className={styles.muted}>Loading…</p>
      ) : error ? (
        <p className={styles.errorText}>{error}</p>
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
          <div className={styles.plan}>
            <div className={styles.planHead}>
              <span className={styles.planCap}>The plan</span>
              {/* The estimate door lives here only until an estimate exists; after that, its
                  Edit link rides the Planned costs caption below. */}
              {seasonTotal == null && !editingSeason && moneyCanWrite && (
                <button type="button" className={styles.ladderLink} onClick={openEstimateEditor}>
                  Set an estimated total
                </button>
              )}
            </div>

            <div className={styles.planRow}>
              <div className={styles.planTerm}>
                <span className={styles.planKey}>
                  Planned costs
                  {seasonTotal == null && totals.costLineCount > 0 && (
                    <span className={styles.planCount}>
                      {totals.costLineCount} line{totals.costLineCount === 1 ? '' : 's'}
                    </span>
                  )}
                </span>
                <span className={styles.planVal}>{fmt(totals.totalPlanned)}</span>
                {/* The estimate wins whenever one is set (ruling 2026-08-12) — so it IS the
                    figure above, and this caption states its relationship to the lines. Lines
                    outgrowing the estimate turn the caption red: as informative as the old
                    ladder row, one line shorter. Clear lives inside the editor. */}
                {seasonTotal != null && (
                  <span className={`${styles.planCapNote} ${totals.overPlanned ? styles.planCapBad : ''}`}>
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
                )}
              </div>

              {/* A team with no fundraising lines simply has no middle category. */}
              {totals.fundingLineCount > 0 && (
                <div className={styles.planTerm}>
                  <span className={styles.planKey}>
                    {LINE_KIND_SECTION.funding}
                    <span className={styles.planCount}>
                      {totals.fundingLineCount} line{totals.fundingLineCount === 1 ? '' : 's'}
                    </span>
                  </span>
                  <span className={`${styles.planVal} ${styles.planValGood}`}>{fmt(totals.expectedFunding)}</span>
                </div>
              )}

              <div className={styles.planTerm}>
                <span className={styles.planKey}>
                  Player installments{' '}
                  <span className={duesAssessed > 0 ? styles.planBadgeOff : styles.planBadgeEst}>
                    {duesAssessed > 0 ? 'Scheduled' : 'Estimated'}
                  </span>
                </span>
                <span className={`${styles.planVal} ${duesAssessed > 0 ? '' : styles.planValEst}`}>
                  {fmt(duesAssessed > 0 ? duesAssessed : totals.fundedByPlayers)}
                </span>
                {duesAssessed > 0 ? (
                  // "Above the plan" needs a plan to be above — a dues-only team gets the bare
                  // Scheduled figure, not a caption calling the whole schedule a buffer.
                  leftToFund < -0.005 && totals.totalPlanned > 0 ? (
                    <span className={styles.planCapNote}>
                      Includes a {fmt(leftToFund)} buffer above the plan
                    </span>
                  ) : leftToFund > 0.005 ? (
                    <span className={`${styles.planCapNote} ${styles.planCapWarn}`}>
                      {fmt(leftToFund)} short of covering the plan
                      {moneyCanWrite && (
                        <>
                          {' · '}
                          <button type="button" className={styles.ladderLink} onClick={() => setGenOpen(true)}>
                            Set dues for all players
                          </button>
                        </>
                      )}
                    </span>
                  ) : null
                ) : (
                  (totals.perPlayer != null || (moneyCanWrite && allLines.length > 0)) && (
                    <span className={styles.planCapNote}>
                      {totals.perPlayer != null && <>≈ {fmt(totals.perPlayer)} per player ÷ {totals.rosterCount}</>}
                      {moneyCanWrite && allLines.length > 0 && (
                        <>
                          {totals.perPlayer != null && ' · '}
                          <button type="button" className={styles.ladderLink} onClick={() => setGenOpen(true)}>
                            Generate installments
                          </button>
                        </>
                      )}
                    </span>
                  )
                )}
              </div>
            </div>

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

          </div>
          )}

          {/* Line items grouped by category */}
          {/* List ⇄ By period. Only offered once there is a plan to look at — a toggle over an
              empty page is furniture. */}
          {allLines.length > 0 && (
            <div className={shared.panelToolbar}>
              <div className={styles.segmented} role="group" aria-label="How to read the plan">
                <button type="button" aria-pressed={viewMode === 'list'} onClick={() => setViewMode('list')}>List</button>
                <button type="button" aria-pressed={viewMode === 'period'} onClick={() => setViewMode('period')}>By period</button>
              </div>
              {viewMode === 'period' && (
                <div className={styles.segmented} role="group" aria-label="Column size">
                  {PERIOD_GRANULARITIES.map(g => (
                    <button key={g} type="button" aria-pressed={granularity === g} onClick={() => setGranularity(g)}>
                      {GRANULARITY_LABEL[g]}
                    </button>
                  ))}
                </div>
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
          ) : viewMode === 'period' ? (
            <PeriodGrid view={buildPeriodView(allLines, granularity)} />
          ) : (
            <div className={`${shared.ledgerList} ${styles.linesContainer} ${moneyCanWrite ? styles.linesCanWrite : ''}`}>
              {/* The column headings the plan never had. They sit in the same track rhythm as the
                  category frames below, which is what makes "Planned" name the column rather than
                  hover over it — and is how Budget vs. Actual next door already reads. */}
              <div className={shared.ledgerHead}>
                <span>Category / line</span>
                <span style={{ textAlign: 'right' }}>Planned</span>
                <span />
              </div>
              {groups.map(([catName, lines]) => (
                <div key={catName} className={shared.ledgerGroup}>
                  {/* ⚠ COLLAPSIBLE, by the same ruling that gave the By-period grid its chevrons
                      (owner 2026-08-13: any hierarchy in a table is collapsible). This was the last
                      hierarchy in Money that could not be closed — Budget vs. Actual's category
                      view already could, which made two views of the same structure behave
                      differently. Closed-set, not open-set, so a newly added category arrives
                      OPEN rather than hidden. */}
                  <button
                    type="button"
                    className={`${shared.ledgerGroupHead} ${shared.ledgerGroupHeadBtn}`}
                    aria-expanded={!isClosed(catKey(catName))}
                    onClick={() => toggleSectionClosed(catKey(catName))}
                  >
                    <span className={shared.ledgerCell}>
                      <span className={shared.ledgerExpandSpacer}>
                        {isClosed(catKey(catName))
                          ? <ChevronRight size={14} aria-hidden />
                          : <ChevronDown size={14} aria-hidden />}
                      </span>
                      <span className={shared.ledgerName}>{catName}</span>
                    </span>
                    <span className={`${shared.ledgerNum} ${shared.ledgerNumStrong}`}>
                      {fmt(lines.reduce((s, l) => s + l.totalAmount, 0))}
                    </span>
                    <span />
                  </button>
                  {!isClosed(catKey(catName)) && lines.map(line => (
                    <BudgetLineRow
                      key={line.id}
                      line={line}
                      funding={false}
                      expanded={expandedLines.has(line.id)}
                      canWrite={moneyCanWrite}
                      onToggle={() => toggleLineExpanded(line.id)}
                      onEdit={() => openEdit(line)}
                    />
                  ))}
                </div>
              ))}

              {/* Chunk G — the permanent "what am I forgetting?" strip. Derived from the
                  standard taxonomy minus what's budgeted minus this device's dismissals;
                  write-gated (it is a write invitation) and self-hides when complete. */}
              {moneyCanWrite && checklistItems.length > 0 && (
                <div className={styles.checklistStrip} data-testid="budget-checklist">
                  <div className={styles.checklistHead}>
                    <span className={styles.checklistLabel}>Not in your plan yet</span>
                    {!checklistExpanded && (
                      <span className={styles.checklistSummary}>
                        {checklistItems.slice(0, 2).map(i => i.name).join(' · ')}
                        {checklistItems.length > 2 ? ` · +${checklistItems.length - 2} more` : ''}
                      </span>
                    )}
                    <button
                      type="button"
                      className={styles.checklistToggle}
                      onClick={() => setChecklistExpanded(v => !v)}
                    >
                      {checklistExpanded ? 'Hide' : 'Review'}
                    </button>
                  </div>
                  {checklistExpanded && (
                    <>
                      <div className={styles.checklistChips}>
                        {checklistItems.map(item => (
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
                      <p className={styles.checklistFoot}>
                        + adds it to your budget — you type the amount. ✕ hides one your team
                        doesn&apos;t pay for.
                      </p>
                    </>
                  )}
                </div>
              )}

              {/* Expected fundraising — one section, always after the costs, shown POSITIVE in
                  green (owner 2026-08-13: the label says the direction; a minus sign made readers
                  re-check arithmetic). It appears only once something is budgeted.
                  ⚠ FUNDING LINES ONLY. This section's total must equal the ladder's "Expected
                  funding" row — same words, same number. Player dues sat inside it briefly and
                  made the section total −$8,000 while the ladder said −$180 (owner catch,
                  2026-08-13); dues are the ANSWER to the plan, not an input, so they close the
                  list below instead. */}
              {/* ⚠ ONE SECTION PER MONEY-IN KIND (2026-08-15). Fundraising and sponsorship count
                  identically — both subtract — but a single merged section could not answer the
                  question the split was made for: "did our sponsorship hit the number?" Each
                  section shows only what it holds, and a team using just one sees exactly what it
                  saw before. */}
              {FUNDING_LINE_KINDS.map(kind => {
                const kindLines = fundingLines.filter(l => normalizeBudgetLineKind(l.lineKind) === kind);
                if (kindLines.length === 0) return null;
                const sectionKey = `kind:${kind}`;
                const sectionTotal = kindLines.reduce((s, l) => s + Number(l.totalAmount ?? 0), 0);
                return (
                  <div key={kind} className={`${shared.ledgerGroup} ${styles.fundingGroup}`}>
                    <button
                      type="button"
                      className={`${shared.ledgerGroupHead} ${shared.ledgerGroupHeadBtn}`}
                      aria-expanded={!isClosed(sectionKey)}
                      onClick={() => toggleSectionClosed(sectionKey)}
                    >
                      <span className={shared.ledgerCell}>
                        <span className={shared.ledgerExpandSpacer}>
                          {isClosed(sectionKey)
                            ? <ChevronRight size={14} aria-hidden />
                            : <ChevronDown size={14} aria-hidden />}
                        </span>
                        <span className={shared.ledgerName}>{LINE_KIND_SECTION[kind]}</span>
                      </span>
                      <span className={`${shared.ledgerNum} ${shared.ledgerNumStrong} ${styles.fundingAmount}`}>
                        {fmt(Math.round(sectionTotal * 100) / 100)}
                      </span>
                      <span />
                    </button>
                    {!isClosed(sectionKey) && kindLines.map(line => (
                      <BudgetLineRow
                        key={line.id}
                        line={line}
                        funding
                        expanded={expandedLines.has(line.id)}
                        canWrite={moneyCanWrite}
                        onToggle={() => toggleLineExpanded(line.id)}
                        onEdit={() => openEdit(line)}
                      />
                    ))}
                  </div>
                );
              })}

              {/* Player installments — the players' side of the plan, once schedules exist. Its
                  own quiet frame between the fundraising inputs and the close: the figure is the
                  Dues tab's assessed total, display-only, never a budget line and never inside
                  Expected fundraising (see the note above). No View-dues link — the hub's Dues
                  tab is two inches up, the same reason the BvA foot link went (owner 08-12). */}
              {duesAssessed > 0 && (
                <div className={`${shared.ledgerGroup} ${styles.fundingGroup}`}>
                  <div className={shared.ledgerRow}>
                    <div className={shared.ledgerCell}>
                      <span className={shared.ledgerExpandSpacer} />
                      <span className={styles.lineInfo}>
                        <span className={shared.ledgerDesc}>Player installments</span>
                        <span className={`${shared.ledgerNote} ${shared.wrap640}`}>
                          What players are scheduled to pay
                        </span>
                      </span>
                    </div>
                    <span className={`${shared.ledgerNum} ${shared.ledgerNumStrong} ${styles.fundingAmount}`}>
                      {fmt(duesAssessed)}
                    </span>
                    <span className={shared.ledgerActions} />
                  </div>
                </div>
              )}

              {/* ONE closing row, in the plan card's vocabulary. Before dues: what the plan asks
                  of players (estimated), or the plain total when nothing offsets it. After dues:
                  the residual — a planned buffer in ordinary ink, a shortfall in amber, and NO
                  row at all when the schedules match the plan (a $0.00 close says nothing). */}
              {duesAssessed > 0 ? (
                Math.abs(leftToFund) >= 0.005 && (
                  <div className={shared.ledgerTotal}>
                    <span>{leftToFund < 0 ? 'Planned buffer' : 'Short of covering the plan'}</span>
                    <span className={`${shared.ledgerTotalNum} ${leftToFund > 0 ? styles.closeWarn : ''}`}>
                      {fmt(leftToFund)}
                    </span>
                    <span />
                  </div>
                )
              ) : (
                <div className={shared.ledgerTotal}>
                  <span>
                    {totals.fundingLineCount > 0 ? 'Player installments (estimated)' : 'Total planned budget'}
                  </span>
                  <span className={shared.ledgerTotalNum}>
                    {fmt(totals.fundingLineCount > 0 ? totals.fundedByPlayers : totals.totalPlanned)}
                  </span>
                  <span />
                </div>
              )}
            </div>
          )}

          {/* Generate Installments CTA. ⚠ duesAssessed too, not just hasInstallments (review
              finding): hand-set schedules never set the budget_generated flag, and this band
              claiming no dues exist under a card saying "Scheduled" was a page disagreeing
              with itself. */}
          {moneyCanWrite && plan && plan.lines.length > 0 && !plan.hasInstallments && duesAssessed === 0 && (
            <div className={styles.generateSection}>
              <div>
                <p className={styles.generateTitle}>Ready to assign dues to players?</p>
                <p className={styles.generateSub}>
                  Generate a player installment schedule based on this budget.
                  Each active roster player gets the same due dates and amounts.
                </p>
              </div>
              <button type="button" className={shared.btnPrimary} onClick={() => setGenOpen(true)}>
                Generate Installments
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
        <div className={shared.modalOverlay} onClick={closeLineModal}>
          {/* A touch wider than the default dialog (the event form's precedent) so the period row's
              three controls — picker, label, amount — are not crushed side by side. */}
          <div
            className={`${shared.modal} ${shared.modalFlushFooter} ${styles.budgetLineModal}`}
            onClick={e => e.stopPropagation()}
          >
            <CoachModalHeader title={editingLine ? 'Edit Budget Line' : 'Add Budget Line'} onClose={closeLineModal} />

            <p className={styles.formHint}><span className={styles.labelRequired}>*</span> Required</p>

            {/* What KIND of line — asked first, because it changes what every field under it
                means. Amounts stay positive either way; the kind carries the sign. */}
            <div className={styles.field}>
              <label className={styles.label}>This line is</label>
              <div className={styles.kindChoice} role="group" aria-label="This line is">
                {BUDGET_LINE_KINDS.map(kind => (
                  <button
                    key={kind}
                    type="button"
                    className={styles.kindOption}
                    aria-pressed={form.lineKind === kind}
                    // Flipping to funding drops any category/item pick: funding lines carry no
                    // category (the picker below is cost-only), and keeping a stale "Tournaments"
                    // pick in form state would silently ride along to the save.
                    onClick={() => setForm(f => (f.lineKind === kind ? f : {
                      ...f,
                      lineKind: kind,
                      ...(isFundingKind(kind)
                        ? { categoryId: '', itemId: null, categoryName: '', itemName: '' }
                        : {}),
                    }))}
                  >
                    {LINE_KIND_LABEL[kind]}
                    <small>{LINE_KIND_HINT[kind]}</small>
                  </button>
                ))}
              </div>
              {isFundingKind(form.lineKind) && (
                <p className={styles.kindHint}>
                  {form.lineKind === 'sponsorship'
                    ? <>Expected sponsorship lowers what players are asked to pay — a business sponsor,
                        a grant, anything given directly rather than raised by selling. It is budgeted
                        apart from fundraising so <strong>Budget vs. Actual</strong> can tell you whether
                        each hit its number.</>
                    : <>Expected fundraising lowers what players are asked to pay — a bottle drive, a
                        chocolate sale, anything the team raises by selling. Enter what you expect the{' '}
                        <strong>team</strong> to keep: if a campaign pays part of what a player raises back
                        to that player, that already lowers their dues and shouldn&apos;t be counted here.</>}
                </p>
              )}
            </div>

            {/* Item picker — COSTS ONLY. A category on a funding line is never used anywhere (the
                plan lists funding flat in one section, and Budget vs. Actual deliberately keeps
                funding out of category matching), and the picker offered a SPENDING taxonomy for
                money coming in — "Sponsorship" filed under "Tournaments". Owner ruling 2026-08-13:
                a funding line is named by its description alone. */}
            {form.lineKind === 'cost' && (
            <div className={styles.field}>
              <label className={styles.label}>Category &amp; Item</label>
              <BudgetItemPicker
                categories={categories}
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
                  // Description stays user-typed only — the save path already falls
                  // back to the item name when it's left blank (no "Misc" stamping).
                  totalAmount:  f.totalAmount || (v.suggestedAmount ? String(v.suggestedAmount) : f.totalAmount),
                }))}
                createItemEndpoint={`/api/coaches/${orgSlug}/budget-items`}
                createItemMode="coach"
                allowCreateCategory
              />
            </div>
            )}

            {/* Description override — for a funding line it IS the name, so it's marked required
                there (a cost line can fall back to its item name). */}
            <div className={styles.field}>
              <label className={styles.label} htmlFor={FOCUS_DESC}>
                Description{isFundingKind(form.lineKind) && <> <span className={styles.labelRequired}>*</span></>}
              </label>
              <input
                id={FOCUS_DESC}
                className={`${styles.input} ${flagged('desc') ? styles.inputBad : ''}`}
                type="text"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value.slice(0, 200) }))}
                placeholder={isFundingKind(form.lineKind)
                  ? 'e.g. Bottle drive, sponsorship, club grant'
                  : form.itemName || 'e.g. May tournament entry fee'}
                maxLength={200}
              />
            </div>

            {/* Total amount + period toggle. This row uses the page's OWN .formRow, which is
                why Batch 1's shared one-column-≤640 reflow never reached it: the amount field
                and the checkbox stayed side by side on a phone, wrapping the label and
                shrinking the input (Chunk A D5). The shared .stack640 supplies the flip. */}
            <div className={`${styles.formRow} ${shared.stack640}`}>
              <div className={styles.field} style={{ flex: 1 }}>
                {/* Associated label — tapping it focuses the field, which matters most on the
                    phone layout where label and input are now on separate lines. */}
                <label className={styles.label} htmlFor={FOCUS_TOTAL}>Total Amount ($) <span className={styles.labelRequired}>*</span></label>
                <input
                  id={FOCUS_TOTAL}
                  className={`${styles.input} ${flagged('total') ? styles.inputBad : ''}`}
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.totalAmount}
                  onChange={e => setForm(f => ({ ...f, totalAmount: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
              <div style={{ paddingTop: '1.6rem' }}>
                <label className={styles.toggleLabel}>
                  <input
                    type="checkbox"
                    checked={form.usePeriods}
                    onChange={e => {
                      const on = e.target.checked;
                      setPeriodUndo(null);
                      // Turning the split on must never land on an empty section — a coach who
                      // cleared the periods and toggled off/on would otherwise face a bare button.
                      setForm(f => ({
                        ...f,
                        usePeriods: on,
                        periods: on && f.periods.length === 0
                          ? [blankPeriod(f.splitMode, seasonYear)]
                          : f.periods,
                      }));
                    }}
                  />{' '}
                  Split by period
                </label>
              </div>
            </div>

            {/* Period distribution */}
            {form.usePeriods && (
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

                {/* Column headings, desktop only — the phone layout labels every field inside the
                    group instead. "Optional" is stated in writing rather than implied by an empty
                    box, because a blank required-looking field is what started all this. */}
                {form.periods.length > 0 && (
                  <div className={styles.periodColHead} aria-hidden>
                    {form.splitMode !== 'names' && (
                      <span className={styles.periodColWhen}>{SPLIT_MODE_COLUMN[form.splitMode]}</span>
                    )}
                    <span className={styles.periodColLabel}>Label (optional)</span>
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
                {form.periods.map((p, i) => (
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

                    {/* The period's identity, and the reason the label could become optional. It is
                        a control of its own that never goes away — carrying the month only in the
                        label's placeholder meant typing a label hid which month the row was. */}
                    {form.splitMode !== 'names' && (
                      <label className={`${styles.periodFieldLabel} ${styles.periodFieldWhen}`}>
                        <span className={styles.periodFieldLabelText}>
                          {SPLIT_MODE_COLUMN[form.splitMode]}
                        </span>
                        {form.splitMode === 'dates' ? (
                          <DateField
                            value={p.date}
                            ariaLabel={`Date for period ${i + 1}`}
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
                    )}

                    <label className={styles.periodFieldLabel}>
                      <span className={styles.periodFieldLabelText}>Label (optional)</span>
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
                    ) : !p.date ? (
                      // Advisory, never a blocker: an undated period simply cannot be placed on a
                      // calendar. That is information the coach needs, not a reason to stop them.
                      <p className={styles.periodRowMsg}>
                        No date — this won&apos;t show in Budget vs. Actual month columns.
                      </p>
                    ) : null}
                  </div>
                ))}

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

            {/* Notes */}
            <div className={styles.field}>
              <label className={styles.label}>Notes</label>
              <input
                className={styles.input}
                type="text"
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Any additional context"
                maxLength={500}
              />
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
        <div className={`${shared.modalOverlay} ${shared.centeredOnMobile}`} onClick={closeDelete}>
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

      {/* ── Generate Installments — the bulk-dues door, shared with Player Dues ── */}
      {genOpen && (
        <GenerateInstallmentsModal
          orgSlug={orgSlug}
          teamId={teamId}
          seasonQuery={seasonQuery}
          budgetHref={moneySectionHref(base, 'budget', undefined, seasonQuery)}
          // ⚠ The HUB tab, not the standalone page one directory down. Those legacy routes still
          // resolve and render without the hub's tab bar, so following this link dropped a coach
          // out of the Money hub onto a page with no way back into it but the browser button.
          duesHref={moneySectionHref(base, 'dues', undefined, seasonQuery)}
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
          categories={categories.map(c => ({ id: c.id, name: c.name, items: c.items.map(i => ({ id: i.id, name: i.name })) }))}
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
