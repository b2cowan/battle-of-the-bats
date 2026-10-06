'use client';
/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE PLAN BY PERIOD — PROMOTED, NEVER COPIED (Club Tier Stage 3b, 2026-10-06, owner Ask 5).
 *
 * The coach's Budget › By period grid and the helpers it shares with the List (the compact cell, the
 * money-in cell, the balance figure, the plan's notes) moved here BYTE FOR BYTE from the coach's panel
 * (app/[orgSlug]/coaches/teams/[teamId]/accounting/budget/panel.tsx), comments and rulings included, so
 * the club's Budget › By period renders THE SAME GRID rather than a drawing of it. The coach's screen is
 * unchanged: same component, same two stylesheets (imported here by path, so the class names are the ones
 * the panel always had).
 *
 * ⚖ WHAT THE CLUB PASSES THAT THE COACH DOESN'T (each optional; absent, the grid is exactly the coach's):
 *   · the lead revenue row — "From the teams" read from the allocations, where the coach's is Player
 *     installments read from the dues schedule (the grid's `installments` row, renamed and re-doored);
 *   · the year's words — "the year's Total", the opening worked out from the books — where the coach's
 *     notes speak of a season and its carried opening;
 *   · a sentence of its own under the notes (From the teams spreads by its installments' due dates).
 * The view itself is the coach's `buildPeriodView`, fed the club's plan on the server (one arithmetic).
 *
 * ⚖ A PHONE OPENS ON THIS MONTH (owner, Club Tier Stage 3b fix 2, 2026-10-06 — both portals): at touch
 * widths the grid scrolls its own frame to the month a reader is standing in (`useOpenOnNow`). A desk is
 * unchanged.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import { Fragment, useRef, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronDown, ChevronRight } from 'lucide-react';
import ColumnPager from '@/components/coaches/ColumnPager';
import CoachScrollX from '@/components/coaches/CoachScrollX';
import { useOpenOnNow } from '@/components/coaches/useOpenOnNow';
import { todayLocal } from '@/lib/measurable-format';
import { monthYearBands, periodRangeLabel, formatMonthLabel, MONTH_WINDOW, type MonthKey } from '@/lib/coach-budget-months';
import { fmtCompact, fmt as fmtSigned } from '@/lib/coach-money-summary';
import { PLAN_LADDER_LABEL, isFundingKind, type BudgetLineKind } from '@/lib/coach-budget-totals';
import {
  UNSCHEDULED, PREVIEW_GROUP_NAME, NO_DATE_LABEL, REVENUE_EMPTY_PROMPT, EXPENSES_EMPTY_PROMPT, quarterKeyOf,
  type PeriodGranularity, type PeriodTotals, type PeriodView, type PeriodBalance,
} from '@/lib/coach-budget-periods-view';
import styles from '@/app/[orgSlug]/coaches/teams/[teamId]/accounting/budget/budget.module.css';
import shared from '@/app/[orgSlug]/coaches/coaches.module.css';


export function fmt(n: number) {
  return `$${Math.abs(n).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** A cell's money. The shared compact formatter draws the number; a cell with nothing in it gets
 *  a dash, never $0.00 — a zero and a nothing are different facts.
 *
 *  ⚰ THE HAND-ROLLED TYPOGRAPHIC MINUS IS GONE (owner ruling 2026-09-09). This used to
 *  `.replace('-', '−')` on the way out, which made this grid the only surface in the portal
 *  printing a third notation for a negative. The shared formatter brackets now, like every other
 *  money string a coach reads. Do not reintroduce a sign swap here. */
export function fmtCell(n: number | undefined): string {
  return fmtCompact(n) ?? '—';
}

/** Money-in cells read POSITIVE (owner 2026-08-13): the green row and its section name say the
 *  direction, and a minus sign made readers re-check arithmetic. The VIEW stays signed — the
 *  grid's totals row is a real subtraction — so the abs happens at the last moment, per cell. */
export function fundingCell(kind: BudgetLineKind, n: number | undefined): number | undefined {
  return isFundingKind(kind) && n != null ? Math.abs(n) : n;
}

/**
 * A BALANCE figure — Opening / Net / Closing — signed, and RED in brackets below zero.
 *
 * ⚠⚠ THIS IS BUDGET VS. ACTUAL'S RULE, NOT THE OLD PLAN-CLOSE'S (owner decisions A–D, 2026-09-12).
 * The deleted Shortfall (Buffer) row painted its brackets GREEN, because there a bracket meant
 * money landing ahead of the bills. These rows are balances: a bracket is the account below zero,
 * the warning colour, exactly as the month grid one tab over paints the same three rows. Same
 * notation, opposite meaning — decided by the row, never by the formatter. `periodGridAhead` (the
 * old row's green) must never be applied to a balance cell.
 *
 * ⚠ `fmtSigned`, NOT this file's `fmt`: the local one is `Math.abs()`, right for a figure whose
 * LABEL carries the direction ("Over your estimate") and wrong for a balance, whose label does not
 * — an over-spent season would read "Closing balance $2,000.00", the opposite of the truth. The
 * shared formatter brackets a negative; `fmtCell` is its compact twin for a grid column. Pinned by
 * tests/unit/budget-ladder-sign-guard.test.ts.
 */
export function balanceFigure(n: number | undefined, compact = true): React.ReactNode {
  const text = compact ? fmtCell(n) : (n == null ? '—' : fmtSigned(n));
  return n != null && n < -0.005 ? <span className={styles.periodGridBelow}>{text}</span> : text;
}

/** The Scheduled / Draft tag on the Player installments row — one spelling on both views; the
 *  class differs because each table drops the tag on a phone by its own rule. */
export function duesBadge(badgeClass: string, draft: boolean): React.ReactNode {
  return <span className={`${styles.planBadgeOff} ${badgeClass}`}>{draft ? 'Draft' : 'Scheduled'}</span>;
}

/** The index of the first month at or after today, or 0 when today is past the plan — the month
 *  a coach is most likely asking about. Shared by the grid's opening window and the trial's default. */
/** "the $1,200.00 of expenses and $300.00 of revenue" — what sits past the two-year window, for the
 *  note under the grid. Both sides only when both carry money; one side reads alone. */
export function beyondWindowPhrase(b: NonNullable<PeriodView['beyondWindow']>): string {
  const parts: string[] = [];
  if (b.moneyOut > 0.005) parts.push(`${fmt(b.moneyOut)} of expenses`);
  if (b.moneyIn > 0.005) parts.push(`${fmt(b.moneyIn)} of revenue`);
  return parts.length > 0 ? ` the ${parts.join(' and ')}` : ' everything';
}

export function monthAtOrAfterToday(monthKeys: readonly string[]): number {
  const todayKey = todayLocal().slice(0, 7);
  const here = monthKeys.findIndex(k => k >= todayKey);
  return here < 0 ? 0 : here;
}

/**
 * The notes both views print under the plan, in the same words (`/simplify` 2026-09-12 — they
 * were written twice, byte for byte). Where the opening balance starts; what the Player
 * installments row is net of; what a bracket means. The grid and the List each add their own
 * caveats after these (the undated note differs by view; endpoints and quarters are grid-only).
 */
export function balanceNotes(opts: {
  balance: PeriodBalance;
  /** The installments row is on screen and it is the SAVED schedule — a draft is not net of anything yet. */
  installmentsNetOf: string | null;
  hasNegative: boolean;
  /** The Net row's name on this view — "Net" on the grid, "Season net" on the List. */
  netWord: string;
  /** "period" on the grid (a month or a quarter), "season" on the List. */
  spanWord: string;
  /**
   * Where the opening balance comes from, in the plan's own words — the CLUB's (Club Tier Stage 3b): its
   * year opens on what its books held on the year's first day, worked out from the books, never carried
   * or typed. Absent, the coach's sentence about the season's carried balance (Team settings → Money).
   */
  openingNote?: ReactNode;
}): React.ReactNode {
  const { balance } = opts;
  return (
    <>
      <p className={styles.periodGridNote}>
        {opts.openingNote ?? (balance.openingUnset ? (
          /* ⚠ THE SAME SENTENCE Budget vs. Actual prints for the same fact (owner D5.10): a season
             with no opening balance says so, pointing a wrong bank tie-out at its likeliest cause
             instead of leaving a coach to discover the assumed zero by arithmetic. */
          <><strong>No opening balance is set</strong> — the balance rows assume the season started from $0. If the team was already holding money on day one, set it in <strong>Team settings → Money</strong>.</>
        ) : (
          <><strong>Opening balance</strong> {fmtSigned(balance.seasonOpening)} is this season&apos;s carried balance (Team settings → Money). Revenue and expenses are planned; receipts are assumed to arrive on their planned dates.</>
        ))}
      </p>
      {/* ⚠ THE SAME CLAUSE AS THE tile above, never a second wording (owner ruling §160 Part F2). */}
      {opts.installmentsNetOf && (
        <p className={styles.periodGridNote}>
          The Player installments row is {opts.installmentsNetOf} — bills lowered with no money behind
          them.
        </p>
      )}
      {opts.hasNegative && (
        /* ⚠ ONLY WHEN A BRACKET IS ON SCREEN (owner F2, §164: keep the legend, update its
           explanation for the new rows). Written for the balance rows — the only rows here that
           can go negative — in the mockup's own words. */
        <p className={styles.periodGridNote}>
          <strong>Brackets mean a negative figure.</strong> On {opts.netWord}, more goes out than comes
          in. On Closing balance, the plan ends the {opts.spanWord} below zero.
        </p>
      )}
    </>
  );
}

/**
 * The plan read ACROSS time — month or quarter columns, built from the period splits coaches
 * already enter. Read-only by design: this is a way to SEE the plan, and every edit still happens
 * in the list's own form, so there is exactly one place a budget line can be changed.
 */
export function PeriodGrid({
  view, granularity, monthStart, onMonthStart, closed, onToggle, onEditLine, duesHref, writtenOffClause, duesDraft,
  leadRow, spanWord = 'season', openingNote, beyondNote, closingNote,
}: {
  view: PeriodView;
  /**
   * The CLUB's lead revenue row (Club Tier Stage 3b): "From the teams", read from the allocations the
   * club billed, spread by its installments' due dates — the view's `installments` row, renamed, with no
   * tag, opening the allocations it adds up rather than Player Dues. Absent = the coach's Player
   * installments row exactly as it was.
   */
  leadRow?: { name: string; title: string; onOpen: () => void };
  /** "season" (the coach's plan) or "year" (the club's) — the words the notes under the grid use. */
  spanWord?: 'season' | 'year';
  /** The club's opening sentence — see `balanceNotes`. */
  openingNote?: ReactNode;
  /** The club's sentence for money dated outside its year (the coach's speaks of the two-year window). */
  beyondNote?: ReactNode;
  /** One more sentence at the foot of the notes (the club's: how From the teams spreads). */
  closingNote?: ReactNode;
  /**
   * Where the Player installments row goes: the Player Dues tab — the schedule's own room (owner
   * ruling F, 2026-09-13, mockup round 2 option A). ⚠ NOT the Set-dues sheet. A schedule that has
   * gone out to families stays all year; the whole-roster re-run is the rare, disruptive act, and it
   * lives on Player Dues with its own warning — available, never the plan's default tap. A READ
   * door, so it is offered to every coach who can read money.
   */
  duesHref: string;
  /** "after $17.00 of adjustments" etc. — the same clause the tile above states beside its figure
   *  (owner ruling §160 Part F2). Computed in the panel, which already holds the write-off data;
   *  passed down rather than re-derived so the two surfaces cannot read two different write-offs. */
  writtenOffClause?: string | null;
  /** The Player installments row is the Set-dues sheet's PREVIEW, not the saved schedule (decision
   *  D). Its tag reads Draft instead of Scheduled; nothing else about the row changes. */
  duesDraft?: boolean;
  /**
   * Open a line's edit form (owner, 2026-09-10: *"should I be able to click a number in the report
   * and open up the edit modal? why am I only allowed to edit on the list view?"*).
   *
   * ⚠⚠ THE ANSWER IS THE **ROW**, NOT THE NUMBER, and the difference matters. Underlining figures
   * would put a second meaning on the one notation Budget vs. Actual spent three rounds of rulings
   * settling — there an underlined figure means *"show me what is behind this"* and it opens a
   * panel. This tab has never used that notation: the List's rows have opened the form on a tap
   * anywhere since 2026-08-13, and this is the same worklist wearing a different view, so it
   * borrows the gesture it already has. A coach who clicks the number gets the form, because the
   * number is inside the row.
   *
   * ⚠ NO INTERMEDIATE PANEL, and that is only true since migration 286. While a word could carry
   * several lines a cell genuinely could not name one, which is why the month grid asks first. One
   * word carries one line now, so asking would be a tap that tells the coach what the row above
   * them already says.
   *
   * Absent for a coach who cannot write money — the rows then carry no affordance at all, rather
   * than offering a form the server would refuse.
   */
  onEditLine?: (lineId: string) => void;
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
  const router = useRouter();
  const undatedCol = view.columns.find(c => c.unscheduled) ?? null;
  const dateCols = view.columns.filter(c => !c.unscheduled);
  const paged = granularity === 'months' && dateCols.length > MONTH_WINDOW;
  const maxStart = Math.max(0, dateCols.length - MONTH_WINDOW);
  /* Opens on today when today is inside the plan, centred the way the statement centres it, and
     falls back to the start for a plan that has not reached this month. */
  const defaultStart = !paged ? 0 : Math.max(0, monthAtOrAfterToday(dateCols.map(c => c.key)) - Math.floor(MONTH_WINDOW / 2));
  const start = paged ? Math.min(Math.max(0, monthStart ?? defaultStart), maxStart) : 0;
  const windowCols = paged ? dateCols.slice(start, start + MONTH_WINDOW) : dateCols;
  const cols = undatedCol ? [undatedCol, ...windowCols] : windowCols;
  /* The band describes WHAT IS ON SCREEN, so it is rebuilt from the window rather than read off
     the view — a band naming columns a coach cannot see is worse than no band at all. */
  const bands = monthYearBands(windowCols.map(c => c.key));
  /* ⚖ A PHONE OPENS ON THIS MONTH (owner, Club Tier Stage 3b fix 2, 2026-10-06 — both portals): the column
     at or after today, in the window on screen (a quarter: the one holding today). On a plan that has
     not reached today, or has passed it, that is its first column and nothing moves. */
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const todayKey = todayLocal().slice(0, 7);
  const nowKey = granularity === 'months'
    ? windowCols[monthAtOrAfterToday(windowCols.map(c => c.key))]?.key ?? null
    : windowCols.find(c => c.key >= quarterKeyOf(todayKey as MonthKey))?.key ?? null;
  useOpenOnNow(scrollerRef, `${granularity}|${windowCols[0]?.key ?? ''}|${windowCols.length}`);

  /* The two bands' groups, split once (owner ruling 2026-09-08, mockup e94d05d9 round 2; the
     order flipped to Revenue → Expenses by decisions A–D, 2026-09-12). The revenue subtotal is read
     into a const so the JSX can narrow it once rather than assert it non-null inside every map. */
  const revenueGroups = view.groups.filter(g => isFundingKind(g.lineKind));
  const costGroups = view.groups.filter(g => !isFundingKind(g.lineKind));
  const revenueTotals = view.revenueTotals;
  const { balance } = view;
  const L = PLAN_LADDER_LABEL;
  /**
   * A subtotal row's cells, from a per-column total the view built in the same pass as the close.
   *
   * ⚠ `revenueTotals` IS ALREADY POSITIVE in the view (the money-in GROUPS are the signed ones,
   * abs()ed per cell by `fundingCell` below), so a subtotal here is drawn as it comes — no sign
   * rule at all. A second negation would print the Revenue subtotal as a bracketed negative.
   */
  const totalCells = (t: PeriodTotals) => (
    <>
      {cols.map(col => <td key={col.key}>{fmtCell(t.cells[col.key])}</td>)}
      <td>{fmtCell(t.total)}</td>
    </>
  );
  /**
   * A BALANCE row's cells (owner decisions A–D, 2026-09-12): Opening, Net, Closing — signed, red
   * in brackets below zero, exactly as Budget vs. Actual's own three rows. The undated column is a
   * DASH on Opening and Closing (a balance is a moment, and undated money has none) and carries the
   * undated net on Net, so that column alone cannot show opening + net = closing — stated in the
   * note under the table. The Total column is the SEASON's figure: opening, net (undated money
   * included), closing — endpoints, never a sum of the period cells.
   */
  const balanceCells = (
    byColumn: Record<string, number>, season: number, undated: number | null,
  ) => (
    <>
      {cols.map(col => (
        <td key={col.key}>
          {col.unscheduled
            ? (undated == null ? '—' : balanceFigure(undated))
            : balanceFigure(byColumn[col.key])}
        </td>
      ))}
      <td>{balanceFigure(season)}</td>
    </>
  );
  /**
   * THE TWO DERIVED ROWS — Player installments (first in Revenue) and the trial (last in Expenses).
   * Neither is a category: nothing to fold, no line beneath, and their cells render SIGNED rather
   * than through `fundingCell`'s abs() (§164 /review finding #2, a real state: the installments
   * row's undated cell carries whatever the dated instalments do NOT cover, which goes negative
   * whenever a schedule is lowered after its instalments were generated — abs()ed, the overshoot
   * printed as a positive and the row stopped summing to its own Total).
   *
   * The installments row's control is a LINK to Player Dues (owner ruling F, 2026-09-13) — the
   * same shape a line row uses one level down: the row is the pointer shortcut, the link is the
   * keyboard's. The trial row carries no door: there is no record to open.
   */
  const derivedRow = (
    key: string, name: string, t: PeriodTotals, green: boolean, badge: React.ReactNode, href: string | null,
  ) => (
    <tr
      key={key}
      className={`${shared.moneyGridCat} ${green ? styles.periodGridFunding : ''} ${href ? shared.rowTappable : ''}`}
      onClick={href ? () => { if (window.getSelection()?.toString()) return; router.push(href); } : undefined}
    >
      <th scope="rowgroup">
        {href ? (
          <Link
            href={href}
            className={shared.moneyGridToggle}
            onClick={e => { e.stopPropagation(); if (window.getSelection()?.toString()) e.preventDefault(); }}
            title="Open Player Dues"
          >
            <span className={shared.moneyGridChevronSpacer} aria-hidden />
            <span className={shared.wrap640}>{name}</span>
            {badge}
          </Link>
        ) : (
          <span className={shared.moneyGridToggle}>
            <span className={shared.moneyGridChevronSpacer} aria-hidden />
            <span className={shared.wrap640}>{name}</span>
            {badge}
          </span>
        )}
      </th>
      {cols.map(col => <td key={col.key}>{fmtCell(t.cells[col.key])}</td>)}
      <td>{fmtCell(t.total)}</td>
    </tr>
  );
  /**
   * The club's lead row (`leadRow`): the derived row's shape, green, untagged, and a BUTTON rather than a
   * link — it opens the window listing the allocations it adds up, on the page it is on (as the List's
   * From the teams row does). The row is the pointer shortcut; the button is the keyboard's.
   */
  const clubLeadRow = (lead: NonNullable<typeof leadRow>, t: PeriodTotals) => (
    <tr
      key="lead"
      className={`${shared.moneyGridCat} ${styles.periodGridFunding} ${shared.rowTappable}`}
      onClick={() => { if (window.getSelection()?.toString()) return; lead.onOpen(); }}
    >
      <th scope="rowgroup">
        <button
          type="button"
          className={shared.moneyGridToggle}
          onClick={e => { e.stopPropagation(); if (window.getSelection()?.toString()) return; lead.onOpen(); }}
          title={lead.title}
        >
          <span className={shared.moneyGridChevronSpacer} aria-hidden />
          <span className={shared.wrap640}>{lead.name}</span>
        </button>
      </th>
      {cols.map(col => <td key={col.key}>{fmtCell(t.cells[col.key])}</td>)}
      <td>{fmtCell(t.total)}</td>
    </tr>
  );
  /** One CATEGORY group, on either side, with its fold. ONE renderer for both bands. */
  const renderGroup = (group: PeriodView['groups'][number]) => {
    const open = !closed.has(group.key);
    return (
      <Fragment key={group.key}>
        {/* ⚠ THE WHOLE CATEGORY ROW FOLDS, exactly as it does on the List (2026-09-10). A grid
            whose line rows open on a tap anywhere while the category above them answers only to a
            13px chevron is one table teaching two rules — the defect QA §132 named on the
            statement. The chevron stays the SEMANTIC control (keyboard, screen reader,
            `aria-expanded`); the row is the pointer shortcut, so it stops propagation below.
            A category with nothing under it has nothing to fold and takes no affordance. */}
        <tr
          className={`${shared.moneyGridCat} ${isFundingKind(group.lineKind) ? styles.periodGridFunding : ''} ${group.rows.length > 0 ? shared.rowTappable : ''}`}
          onClick={group.rows.length > 0
            ? () => { if (window.getSelection()?.toString()) return; onToggle(group.key); }
            : undefined}
        >
          <th scope="rowgroup">
            <button
              type="button"
              className={shared.moneyGridToggle}
              /* ⚠ THE SELECTION GUARD BELONGS ON THE BUTTON TOO, and putting it only on the row
                 is a guard that never runs (`/review` correctness lens, 2026-09-10). This control
                 is a full-width flex box filling its cell, so a drag across the category name ends
                 its mouseup HERE, not on bare cell — the click is swallowed by `stopPropagation`
                 and the row's own guard is never reached. Both halves, or neither works. */
              onClick={e => {
                e.stopPropagation();
                if (window.getSelection()?.toString()) return;
                onToggle(group.key);
              }}
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
        {open && group.rows.map(row => {
          /* ⚠ BUILT FROM THE LINE ID, NEVER FROM `row.id` — that one is `group|rowKey`, a name for
             a position in this view that matches no record. The month grid shipped exactly that
             door once: it handed the budget page a composite id, found nothing and returned in
             silence. Null here is the word-LESS bucket, which stands for several lines and so
             names none; it stays plain text rather than opening one of them at random. */
          const lineId = row.lineId;
          const openLine = onEditLine && lineId ? () => onEditLine(lineId) : null;
          return (
          <tr
            key={row.id}
            className={`${isFundingKind(group.lineKind) ? styles.periodGridFunding : ''} ${openLine ? shared.rowTappable : ''}`}
            // The List's own copy-gesture guard: a click that ends a text selection is somebody
            // lifting an amount out of the cell, not asking for the form.
            onClick={openLine ? () => { if (window.getSelection()?.toString()) return; openLine(); } : undefined}
          >
            <th scope="row" className={shared.moneyGridLead}>
              {/* ⚠ THE KEYBOARD'S DOOR, and the row's tap is the pointer shortcut over the top of
                  it — the same split the List uses with its pencil, and the category row above
                  with its chevron. Without a real control in here the form would be reachable by
                  thumb and mouse and by nothing else, on the one view that just gained it.
                  ⚠⚠ `title`, NOT `aria-label`, AND THE REASON IS THIS CELL (`/review`
                  accessibility lens, 2026-09-10). An `aria-label` was written here first and it
                  quietly made things WORSE for the exact readers the button was added for: this
                  button is the SOLE content of a `<th scope="row">`, and a labelled descendant
                  contributes its own accessible NAME when the header's name is computed from
                  content — so the row header became "Edit Dome Time", and a screen reader paging
                  across the period columns re-announced the verb against every figure in the row
                  ("Edit Dome Time, $500 · Edit Dome Time, $300 …"). `title` cannot do that: with
                  text content present it never becomes the name, so the header stays "Dome Time"
                  and the verb travels as the button's DESCRIPTION, read on focus where it is
                  actually wanted. It buys a native tooltip for a mouse as well, which is the only
                  visible cue this door has.

                  ⚠⚠ `moneyGridToggle`, THE SHARED CLASS, AND THE NAME IS A DELIBERATE MISNOMER —
                  it dresses the category chevron two rows up, and this opens a form. A local copy
                  was written first and the rendered sweep caught it at 26px against a 44px floor:
                  the shared rule sits inside the ≤768 touch band, and a fresh copy inherits none
                  of the fixes the original has collected. The tombstone in budget.module.css
                  keeps the full reasoning. It is invisible until focus, by design: the ROW is the
                  affordance, and a name that underlined itself would announce a second, different
                  door in a table whose other view keeps the same name as plain text. */}
              {openLine ? (
                <button
                  type="button"
                  className={shared.moneyGridToggle}
                  /* Same pair as the category toggle above: this button fills the cell, so it is
                     where a drag across the LINE NAME ends — and the row's guard behind it never
                     gets the click. Before today selecting this text was safe because nothing on
                     the row listened; it listens now. */
                  onClick={e => {
                    e.stopPropagation();
                    if (window.getSelection()?.toString()) return;
                    openLine();
                  }}
                  title={`Edit ${row.description}`}
                >
                  {row.description}
                </button>
              ) : row.description}
              {/* ⚠ NO "N lines" COUNT ON THIS ROW, and none on the Budget list or the Budget vs.
                  Actual statement either — owner ruling 2026-09-04, QA §133. The full reasoning
                  lives with the gate that enforces it, tests/unit/bva-figure-doors-guard.test.ts.
                  Short version: a fact the coach gets by opening the row does not need a label
                  promising it first. */}
            </th>
            {cols.map(col => <td key={col.key}>{fmtCell(fundingCell(row.lineKind, row.cells[col.key]))}</td>)}
            <td>{fmtCell(fundingCell(row.lineKind, row.total))}</td>
          </tr>
          );
        })}
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
      <CoachScrollX sticky hint="Swipe the table to see every period" scrollerRef={scrollerRef}>
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
                <th key={col.key} scope="col" className={col.unscheduled ? styles.periodGridUnscheduled : ''} data-now={col.key === nowKey ? '' : undefined}>
                  {col.label}
                </th>
              ))}
              <th scope="col">Total</th>
            </tr>
          </thead>
          <tbody>
            {/* ── REVENUE → Player installments, the money-in categories → Total revenue;
                EXPENSES → categories, the trial, the estimate rows → Total expenses; then the
                balance (owner decisions A–D, 2026-09-12 — the approved mockup's order, replacing
                Costs → Funding → the Shortfall (Buffer) ladder of 2026-09-09). The same bands and
                subtotals the List draws, so the two readings of one plan share one shape. A band
                row carries real empty cells and never a colSpan: the first column is pinned, and a
                spanning cell gives the pin nothing to hold (the statement's bands learned this
                first).
                ⚠ THE REVENUE BAND ALWAYS DRAWS, even with nothing in it (mockup: "Revenue and
                Expenses have useful empty states"). A costs-only plan reads a one-line prompt
                where its money in would be, rather than a table that starts at Expenses and
                leaves a coach wondering whether the sponsor they entered went missing. */}
            <tr className={shared.moneyGridBand}>
              <th scope="row">{L.revenueBand}</th>
              {cols.map(col => <td key={col.key} />)}
              <td />
            </tr>
            {/* ⚠ `periodGridBadge`, NOT the List's `ladderBadge` (/review, 2026-09-10): that class
                only does anything under a `.planTable` ancestor, which this table does not have —
                the tag stayed inline in a nowrap sticky column and widened it, pushing period
                columns off a phone's first view. The approved mockup drops the tag on the narrow
                frame instead. Scheduled = the saved schedule; Draft = the Set-dues sheet's preview
                standing in for it (decision D). */}
            {view.installments && (leadRow ? clubLeadRow(leadRow, view.installments) : derivedRow(
              'installments', PLAN_LADDER_LABEL.installments, view.installments, true,
              duesBadge(styles.periodGridBadge, duesDraft === true), duesHref,
            ))}
            {revenueGroups.map(renderGroup)}
            {!view.installments && revenueGroups.length === 0 && (
              <tr>
                <td className={styles.periodGridPrompt}>{REVENUE_EMPTY_PROMPT}</td>
                {cols.map(col => <td key={col.key} />)}
                <td />
              </tr>
            )}
            <tr className={`${shared.moneyGridTotal} ${styles.periodGridFunding}`}>
              <th scope="row">{L.totalRevenue}</th>
              {revenueTotals
                ? totalCells(revenueTotals)
                : <>{cols.map(col => <td key={col.key}>—</td>)}<td>—</td></>}
            </tr>

            <tr className={shared.moneyGridBand}>
              <th scope="row">{L.expensesBand}</th>
              {cols.map(col => <td key={col.key} />)}
              <td />
            </tr>
            {costGroups.map(renderGroup)}
            {view.trial && derivedRow(
              'trial', PREVIEW_GROUP_NAME, view.trial, false,
              <span className={`${styles.planBadgeEst} ${styles.periodGridBadge}`}>Preview</span>, null,
            )}
            {costGroups.length === 0 && !view.trial && !view.estimateRows && (
              <tr>
                <td className={styles.periodGridPrompt}>{EXPENSES_EMPTY_PROMPT}</td>
                {cols.map(col => <td key={col.key} />)}
                <td />
              </tr>
            )}
            {/* ⚠ ONE NAME, ONE NUMBER, AND THE GRID EARNS IT BY SHOWING THE MONEY (owner ruling
                2026-09-09; kept unchanged by decision A, 2026-09-12). This subtotal used to read
                "Lines so far" whenever an estimate differed, because the estimate has no dates and
                the grid left its un-itemized remainder out. The remainder is a real row now, in the
                column built to hold undated money, so the subtotal IS the estimate and wears its own
                name in every state. These two rows are copied from the List verbatim; if that
                wording ever changes it changes on BOTH views, never by this grid inventing a third
                vocabulary. */}
            {view.estimateRows && (
              <>
                <tr>
                  <th scope="row" className={shared.moneyGridLead}>{L.linesSoFar}</th>
                  {totalCells(view.estimateRows.linesSoFar)}
                </tr>
                {/* ⚠ AND THE RED COMES WITH THE WORDING (/review, 2026-09-10). Copying the List's
                    two rows meant copying the STATE, not just the label: lines above the estimate
                    is the one thing on this plan drawn in danger ink. The remainder itself is drawn
                    signed — a negative, line-less No date yet cell is exactly plan §4's edge case
                    (over the estimate with nothing undated to net against), and it renders as a
                    bracketed figure in that column rather than being special-cased. */}
                <tr className={view.estimateRows.remainder.total < 0 ? styles.periodGridOver : undefined}>
                  <th scope="row" className={shared.moneyGridLead}>
                    {view.estimateRows.remainder.total < 0 ? L.overEstimate : L.stillToItemize}
                  </th>
                  {totalCells(view.estimateRows.remainder)}
                </tr>
              </>
            )}
            <tr className={shared.moneyGridTotal}>
              <th scope="row">{L.totalExpenses}</th>
              {totalCells(view.expenseTotals)}
            </tr>

            {/* ── THE BALANCE (owner decisions A–D, 2026-09-12): Opening + Net = Closing, in the
                column a coach is looking at — Budget vs. Actual's own three rows, walked by the
                same function. A negative wears red brackets here, because these are balances and a
                bracket is the account below zero; the old plan-close's green bracket is gone with
                the row it decorated. The shared projection-row recipe (`moneyGridFlow`), so the
                two grids' balance blocks are one treatment. */}
            <tr className={`${shared.moneyGridFlow} ${shared.moneyGridFlowFirst}`}>
              <th scope="row">{L.openingBalance}</th>
              {cols.map(col => (
                <td key={col.key}>{col.unscheduled ? '—' : balanceFigure(balance.opening[col.key])}</td>
              ))}
              {/* ⚠ NULL ≠ ZERO. A season that never carried an opening balance says so, in words,
                  where a $0.00 would claim the team started with exactly nothing — the same
                  distinction Team settings → Money and Budget vs. Actual's note make. */}
              <td>
                {balance.openingUnset
                  ? <span className={styles.periodGridNil}>None carried</span>
                  : balanceFigure(balance.seasonOpening)}
              </td>
            </tr>
            <tr className={shared.moneyGridFlow}>
              <th scope="row">{granularity === 'months' ? L.netForMonth : L.netForQuarter}</th>
              {balanceCells(balance.net, balance.seasonNet, balance.undatedNet)}
            </tr>
            <tr className={`${shared.moneyGridFlow} ${styles.periodGridClosing}`}>
              <th scope="row">{L.closingBalance}</th>
              {balanceCells(balance.closing, balance.seasonClosing, null)}
            </tr>
          </tbody>
        </table>
      </CoachScrollX>
      {/* ⚠ THE NOTES, IN READING ORDER: where the balance starts, what the installments row is net
          of, what the undated column holds and why the season closing differs from the last dated
          one, what a bracket means (only when one is on screen), how the endpoints work, then the
          two range caveats. Each renders only when its condition is true — a note explaining a
          notation the coach cannot see is furniture. The mockup's own footnotes, one for one.
          ⚠ In the shared `reportNotes` stack (owner ruling 2026-09-13): this view's spacing is the
          standard every money report's disclaimers now take. */}
      <div className={`${shared.reportNotes} ${styles.reportNotesInWrap}`}>
      {balanceNotes({
        balance,
        installmentsNetOf: view.installments && !duesDraft ? (writtenOffClause ?? null) : null,
        hasNegative: view.hasNegative,
        netWord: 'Net',
        spanWord: 'period',
        openingNote,
      })}
      {view.hasUnscheduled && spanWord === 'year' && (
        /* The club's reading of the same sentence (Club Tier Stage 3b): its plan has no dues and no estimate,
           so the column holds only lines without dates, and the span is the year. */
        <p className={styles.periodGridNote}>
          <strong>{NO_DATE_LABEL}</strong> holds anything without payment dates. It counts in the year&apos;s Total
          and in no dated balance
          {balance.months.length > 0 && (
            <>: the last dated closing is {fmtSigned(balance.months[balance.months.length - 1].closing)}; including the {NO_DATE_LABEL} amounts, the year closes at {fmtSigned(balance.seasonClosing)}</>
          )}. Split a line by period to move it into a month.
        </p>
      )}
      {view.hasUnscheduled && spanWord === 'season' && (
        /* ⚠ The wording widened with the column's contents (2026-09-09): it also holds the
           un-itemized part of a season estimate and any dues not yet on a dated schedule. And since
           the balance rows landed (2026-09-12) it says the thing a reader checking the arithmetic
           will otherwise trip on: undated money reaches the season Total and no dated balance, so
           the last dated closing and the season closing differ by exactly that (plan §5). */
        <p className={styles.periodGridNote}>
          <strong>{NO_DATE_LABEL}</strong> holds anything without payment dates — costs, revenue, and
          any dues not yet on a schedule. It counts in the season Total and in no dated balance
          {balance.months.length > 0 && (
            <>: the last dated closing is {fmtSigned(balance.months[balance.months.length - 1].closing)}; including the {NO_DATE_LABEL} amounts, the season closes at {fmtSigned(balance.seasonClosing)}</>
          )}. Split a line by period to move it into a month.
        </p>
      )}
      {balance.months.length > 0 && (
        <p className={styles.periodGridNote}>
          The {spanWord}&apos;s opening and closing are endpoints, not sums of the period balances; each
          dated column reads opening + net = closing.
          {granularity === 'quarters' && (
            <> A quarter opens on its first month and closes on its last; a month that dips below zero is still flagged above even inside a quarter that ends above it.</>
          )}
        </p>
      )}
      {/* ⚰ THE ESTIMATE NOTE IS GONE (owner ruling 2026-09-09) — the grid draws the remainder in
          the No-date-yet column. ⚰ AND SO IS "Set dues and they appear here" (2026-09-12): the
          Required-player-dues helper under the table carries that door now, on both views. */}
      {/* ⚠ RULING 0 (owner, 2026-09-13): money dated past the two-year window sits under No date
          yet — on the row AND in the balance, which used to disagree here (the row said "last
          month", the balance said "no month"). The note names the amount and the month it is past,
          so a coach reading a dated line under "No date yet" is told why. */}
      {view.beyondWindow && beyondNote && <p className={styles.periodGridNote}>{beyondNote}</p>}
      {view.beyondWindow && !beyondNote && (
        <p className={styles.periodGridNote}>
          Your plan runs past the two years shown — the columns stop at {formatMonthLabel(view.beyondWindow.after)}, and
          {beyondWindowPhrase(view.beyondWindow)} dated after that {view.beyondWindow.moneyIn > 0.005 && view.beyondWindow.moneyOut > 0.005 ? 'sit' : 'sits'} under {NO_DATE_LABEL}:
          in the season Total, in no month.
        </p>
      )}
      {view.columns.length === 1 && view.columns[0].key === UNSCHEDULED && (
        <p className={styles.periodGridNote}>
          None of your lines have payment dates yet, so there is nothing to spread across months.
        </p>
      )}
      {closingNote != null && <p className={styles.periodGridNote}>{closingNote}</p>}
      </div>
    </div>
  );
}
