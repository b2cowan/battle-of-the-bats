'use client';
/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE STATEMENT'S ROWS — PROMOTED, NEVER COPIED (Club Tier Stage 3b, 2026-10-06, owner Ask 2).
 *
 * The coach's Budget vs. Actual statement rows — the category fold, the item rows with their two
 * figure doors, the bands and subtotals — moved here BYTE FOR BYTE from the coach's panel
 * (app/[orgSlug]/coaches/teams/[teamId]/accounting/budget-vs-actual/panel.tsx), comments and rulings
 * included, so the club's Budget vs. Actual renders THE SAME ROWS rather than a drawing of them. The
 * coach's screen is unchanged: same components, same two stylesheets (imported here by path, so the
 * class names are the ones the panel always had).
 *
 * ⚠ WHAT STAYED IN EACH PORTAL: the panel a figure opens. Rows know nothing about where a door goes —
 * `openBehind(item, side)` is the caller's — so the coach's `RecordsBehind` / `DuesBehind` and the
 * club's own panel (its doors are the club's Ledger, a line's window, an allocation's page) each live
 * with their own screen. The rule they share is the row's: exactly two controls open a panel, the
 * Budget figure and the Actual figure (tests/unit/bva-figure-doors-guard.test.ts reads this file).
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import { Fragment, type ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
// The coach-money accounting-bracket formatter, shared with the settlement and payout sheets.
import { fmt as fmtBrackets } from '@/lib/coach-money-summary';
import type { DerivedArrivals } from '@/lib/coach-budget-rollup';
import { budgetedOn, varianceOn, type CompareBasis } from '@/lib/coach-budget-basis';
import styles from '@/app/[orgSlug]/coaches/teams/[teamId]/accounting/budget-vs-actual/bva.module.css';
import shared from '@/app/[orgSlug]/coaches/coaches.module.css';


/* ⚠ THE REPORT IS TWO LEVELS: CATEGORY → ITEM (owner ruling 2026-08-15). It used to be category →
   budget line, named by whatever description a coach had typed, which is why a line filed under the
   item "Entry Fees" could render as a row called "test" and why the plan and the books could never
   be matched to each other. The shapes below mirror `lib/coach-budget-rollup.ts`, which owns the
   grouping for this screen and for the route together. */
/**
 * One slot of the PLAN's own schedule.
 *
 * ⚠⚠ NOTHING RENDERS THESE, AND THEY ARE STILL LOAD-BEARING (owner ruling 2026-09-10, "Things, not
 * dates"). The item fold that drew them as rows is gone from both report shapes — but the dates
 * drive the **To date** comparison basis (`budgetedOn`, via `rebaseReport`), and `RecordsBehind`
 * lists them behind a Budget figure, where they are the plan's schedule and claim nothing about
 * when money moved. Drop them from the payload and every to-date reading silently becomes a
 * whole-season one.
 *
 * ⚠ IT NO LONGER CARRIES AN `actual`. Real money used to be swept onto these planned dates, so a
 * line planned once in February reported August money as February. The sweep is deleted at source
 * (`mergeSchedules` in lib/coach-budget-rollup.ts), not merely unrendered.
 */
export interface PeriodResult {
  label: string;
  date: string | null;
  amount: number;
}

export interface ItemResult {
  /** Null = the "Not itemized" bucket: lines or costs in this category naming no item. */
  itemId: string | null;
  itemName: string;
  /** Which section this row belongs to. One item may legitimately appear as two rows (mig 243). */
  direction: 'in' | 'out';
  budgeted: number;
  actual: number;
  /** What moved before money back — the "$2,400 paid" half of "$2,400 paid · $150 back". */
  grossActual: number;
  refundTotal: number;
  /** ⚠ GOOD-NEWS-POSITIVE, per direction. The formula differs (revenue: actual − budget; a cost:
   *  the reverse) and is decided ONCE in the rollup, so this screen has one colour rule and
   *  changes only its wording per section. */
  variance: number;
  /** Two or more budget lines summed into this row. ⚠ NOTHING RENDERS THIS ANY MORE — the caption
   *  it existed for was removed from every surface (owner ruling 2026-09-04, QA §133). Kept because
   *  `lines` is optional across a rolling deploy and this is the one field that still says "this
   *  row is a merge" without it; delete it only together with that guard. */
  lineCount: number;
  /** ⚠ DERIVED, never stored: is there a budget line for this category+item? False = the team was
   *  charged for something it never planned, which is the row this whole change exists to show. */
  inPlan: boolean;
  periods: PeriodResult[];
  /** The money back netted into this row, so it can show what came back and when. */
  refunds: Array<{ id: string; description: string; amount: number; receivedDate: string | null }>;
  /** The budget lines summed into this row — what the Budget figure opens (QA §132). One entry
   *  when `lineCount` is 1, so the panel never has to reason about a missing list. */
  /** ⚠ OPTIONAL ON PURPOSE (adversarial review, 2026-09-04). This field is NEWER THAN THE CLIENT
   *  that may be asking for it: the route stripped it until this release, the report is fetched in a
   *  separate request after the bundle loads, and a rolling deploy really does pair a new bundle
   *  with an old route. Typed as possibly-absent so the compiler forces the guard rather than
   *  leaving it to whoever writes the next reader. */
  lines?: Array<{ id: string; description: string; notes: string | null; totalAmount: number }>;
  /** The individual payments summed into this row — what the ACTUAL figure opens (QA §132 round
   *  three). ⚠ NOT ALL OF THESE ARE RECORDS A COACH CAN OPEN: a payable contributes one entry per
   *  instalment and club money arrives as a synthetic id, so most rows state rather than link.
   *  ⚠⚠ THE EXCEPTION IS `derived`, AND IT IS WHY THE OLD BLANKET RULE EXPIRED — this comment used
   *  to say the derived pools were "a NAME with no record at all"; since 2026-09-07 there is one
   *  row per DRIVE OR SPONSOR, each with a room of its own. Those rows link; see `RecordsBehind`.
   *  ⚠⚠ OPTIONAL FOR THE SAME REASON `lines` IS, AND IT WAS MISSED ON THE FIRST PASS (`/review`,
   *  2026-09-04). Both fields were stripped by the SAME deleted helper, so both are newer than a
   *  client that may be asking for them — but only `lines` was typed possibly-absent. Reading
   *  `item.costs.length` unguarded runs for EVERY row on every render, so during a rolling deploy
   *  (new bundle, old route) the whole statement threw before a single figure painted. A guarded
   *  read degrades to a plain number; an unguarded one takes the page down. */
  costs?: Array<{
    id: string; description: string; amount: number; paidDate: string | null;
    /** Set only on a drive's or sponsor's row, which sums several arrivals rather than being one.
     *  ⚠ Optional on the SAME rolling-deploy reasoning as the two fields above: an old route
     *  answering a new bundle sends rows without it, and every reader here must degrade to the
     *  plain dated row rather than throw. */
    derived?: DerivedArrivals | null;
  }>;
  /**
   * ⚠⚠ PRESENT ON A **PLAYER DUES** ROW AND ON NOTHING ELSE, and its presence is how this screen
   * tells a family apart from a budget item (owner ruling 2026-09-10).
   *
   * Player dues stopped being a hand-rolled row and became an ordinary category folding to one row
   * per family. A family's ACTUAL is not a list of records — it is three kinds of contribution —
   * so its figure opens `DuesBehind` where every other row opens `RecordsBehind`. The three sum to
   * `actual` by construction (lib/coach-dues-actual.ts), which is what lets the panel state a total
   * a coach can check against the number that opened it.
   *
   * ⚠ OPTIONAL FOR THE SAME ROLLING-DEPLOY REASON `lines` AND `costs` ARE — it is newer than a
   * bundle that may be asking for it, and every read here degrades to a plain figure rather than
   * throwing. A player row against an old route is a number with no door, which is exactly what the
   * row was yesterday.
   */
  duesParts?: { cashKept: number; familyPaidCosts: number; fundraisingCredited: number };
}

export interface CategoryResult {
  categoryId: string | null;
  categoryName: string;
  direction: 'in' | 'out';
  budgeted: number;
  /** Net of any money back its items carry. The "paid · back" caption is a ROW's, not a category's. */
  actual: number;
  variance: number;
  /** False when nothing in this category was ever budgeted — the whole heading is unplanned. */
  inPlan: boolean;
  items: ItemResult[];
}

export interface ReportSection {
  direction: 'in' | 'out';
  categories: CategoryResult[];
  budgeted: number;
  actual: number;
  variance: number;
}

/**
 * Money in a report cell. ⚠ A negative reads as BRACKETS, never a minus sign — the notation the
 * budget importer already understands, so the product has one and not two (money-back plan §4.3).
 *
 * ⚠ THE SHARED FORMATTER, not a second bracket rule. `fmtBrackets` (lib/coach-money-summary.ts) is
 * what the settlement sheet, the payout sheet, the Money overview and the money rail already print
 * accounting negatives with; a local re-derivation would be the same convention maintained in two
 * places. The half-cent deadband is this screen's own: a rounding tail must not render `($0.00)`
 * beside figures a coach can see are equal.
 */
export function fmtCell(n: number): string {
  return Math.abs(n) <= 0.005 ? fmt(0) : fmtBrackets(n);
}

/**
 * ⚠⚠ VARIANCE READS DIFFERENTLY IN EACH SECTION, AND THAT IS THE FIX, NOT A QUIRK.
 *
 * Over budget is good news on income and bad news on a cost. The retired design ran both formulas
 * behind one column heading, distinguished only by a two-letter IN/OUT tag — registration revenue
 * showed `+$400` meaning *actual − budget* while entry fees showed `+$150` meaning *budget −
 * actual*, both green, both positive. The arithmetic is settled in the rollup (always
 * good-news-positive); what is settled HERE is the wording, which is what a reader actually uses:
 * revenue varies **up and down**, costs run **over and under**.
 *
 * ⚠ COLOUR NEVER CARRIES IT ALONE. Our overrun and healthy tones are near-identical to a deutan
 * eye, so the sign and the word do the work and the hue is decoration on top.
 */
export function varianceText(v: number, direction: 'in' | 'out', actual?: number): string {
  if (Math.abs(v) <= 0.005) return '—';
  if (direction === 'in') return fmtVariance(v);
  /* ⚠⚠ A NEGATIVE COST NEVER READS AS "UNDER BUDGET" — the plan warned about this by name (§4.5:
     "the over/under styling must cope, or a negative renders as a triumphant 'under budget'"), and
     the arithmetic walks straight into it: an item budgeted $0 that took $150 back has an actual of
     −$150 and therefore a variance of +$150, which the wording below would print as "$150 under",
     indistinguishable from an ordinary underspend. It is not an underspend — nothing was spent.
     The bracketed actual beside it is the fact worth reading, and it is almost always the signal
     the refund is filed against the wrong item, so the variance says nothing rather than something
     congratulatory (/review, correctness lens).
     ⚠ SINCE 2026-09-02 (owner D5.4) THE GUARD PRINTS "refund only" RATHER THAN A BARE EM-DASH —
     the odd refund is named, not hidden, and the muted ink (see `varianceInk`) keeps it from
     reading as a verdict. */
  if (actual != null && actual < -0.005) return 'refund only';
  return `${fmt(v)} ${v > 0 ? 'under' : 'over'}`;
}

/**
 * The colour that goes WITH `varianceText` — the pair travels together, or the "refund only"
 * guard word would arrive painted in the success green its variance happens to compute to.
 */
export function varianceInk(v: number, direction: 'in' | 'out', actual?: number): string {
  if (direction === 'out' && actual != null && actual < -0.005 && Math.abs(v) > 0.005) {
    return 'var(--home-ink-soft, rgba(255,255,255,0.6))';
  }
  return varianceColor(v);
}

// The category table's columns and rows are NOT declared here — they live in
// `lib/coach-money-exports` beside the Money hub's own "Budget vs. actual" export, so the two
// cannot become two different spreadsheets. Only the MONTH-GRID export is local to this file,
// because its shape depends on the view and lens the coach chose (rule 12).

/** Money to the cent, once for the whole module — three local copies of this lambda had
 *  accumulated by the time `/simplify` looked (2026-09-02). */
export function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** ⚠ STRIPS THE SIGN — every screen caller prints its own (`fmtVariance`), and a figure that can
 *  genuinely go negative (Collected, Cash on hand) uses `fmtSigned` below. */
export function fmt(n: number) {
  return `$${Math.abs(n).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function varianceColor(v: number): string {
  if (v > 0.005) return 'var(--success-light)';
  if (v < -0.005) return 'var(--danger-light)';
  return 'var(--home-ink-soft, rgba(255,255,255,0.6))';
}

/** A variance's sign, on the same half-cent deadband as its colour — the two must agree, and
 *  five hand-written copies of the ternary were one epsilon edit away from disagreeing. */
export function signPrefix(v: number): string {
  if (v > 0.005) return '+';
  if (v < -0.005) return '-';
  return '';
}

/** A variance rendered whole: sign, then magnitude. */
export function fmtVariance(v: number): string {
  return `${signPrefix(v)}${fmt(Math.abs(v))}`;
}

/**
 * How a category is addressed for expand state, React keys and `aria-describedby`.
 *
 * ⚠ THE DIRECTION IS PART OF THE KEY: one category appears in BOTH sections of the statement, and
 * keying by name alone would give those two rows one shared toggle.
 *
 * ⚠ AND SO IS THE ID. The rollup buckets by category ID when there is one, so a club that has
 * created its own "Officials" alongside the platform's gets two legitimate rows with the same name
 * and the same direction — which a name-only key collapsed into one React key, one expand toggle
 * and one duplicated element id, so opening either opened both (/review, correctness lens). This
 * is the same collision the route's own `learnCategory` fix chased in 2026-08-15, one layer up.
 */
export function catKeyOf(cat: CategoryResult): string {
  return `${cat.direction}|${cat.categoryId ?? `name:${cat.categoryName}`}`;
}

/**
 * DOES THIS HEADING HAVE ANYTHING TO FOLD TO? — one rule, four readers (`/simplify`, 2026-09-10).
 *
 * ⚠⚠ IT IS NAMED BECAUSE IT HAS **TWO** READERS PER SHAPE, AND THEY MUST NOT PART. Each row asks it
 * to decide whether to draw a chevron at all (`CatFoldRow.foldable`), and **Expand all / Collapse
 * all** asks it again to decide which keys that control can reach. Written out twice per shape — as
 * it was on the first pass — a future exception lands on one and not the other, and the failure is
 * silent in both directions: a control stuck on one word because it counts a row that draws no
 * chevron, or a fold a coach can open that "Expand all" refuses to touch.
 *
 * ⚠ THIS IS THE RULE THAT REPLACED A SENTINEL. Both readers used to exclude the dues row by its id,
 * because it was the one heading with nothing underneath it. Dues folds to families now, so the
 * honest question is cardinality rather than identity — and the only row still answering "nothing"
 * is a team that has not set dues up, which is exactly the row that should not offer a fold.
 */
export function catFoldable(cat: CategoryResult): boolean {
  return cat.items.length > 0;
}

/** Which side of the row a coach asked about: the plan, or what actually moved. */
export type BehindSide = 'plan' | 'actual';

/**
 * The item rows of one category — shared by both shapes, so the statement and the by-activity
 * lens can never render one row two different ways.
 *
 * ⚠⚠ EVERY FIGURE ON THE ROW IS A DOOR, AND THE ROW ITSELF OPENS (owner ruling 2026-09-04,
 * QA §132 round three). Three things were wrong at once and they were one thing:
 *   · the ACTUAL figure explained itself with a permanent sub-row — "$815.00 paid · $125.00 back" —
 *     hanging under a row that, for an item with no dated periods, had no expander at all. It read
 *     as the expansion of something that could not be expanded, and it was WHITE against the tint
 *     of the rows above it. Worse, it was the only thing the Actual column ever said: WHICH
 *     payments made that figure was unanswerable on this screen under every data shape.
 *   · the BUDGET figure had a door ("N lines") and the actual figure did not, so one report
 *     answered "what is behind this number?" on one column and refused on the other.
 *   · the category bar opened on a click anywhere; the item row opened only on its 13px chevron.
 * Both figures open the same shape of panel, and the sub-row is gone — its two figures moved INTO
 * the panel, where they are the sentence naming what the list adds up to.
 *
 * ⚠⚠ AND THE ROW NO LONGER FOLDS AT ALL (owner ruling 2026-09-10, "Things, not dates", raised on
 * the §157 walk). It used to open onto the PLAN's periods with real money swept onto them: each
 * amount landing in the first planned slot on or after the day it moved. On a line planned across
 * five months that read correctly; on `Fundraising · Merchandise sales`, planned once in February,
 * it reported money that arrived Aug 31 and Sep 10 as **Feb 2027**.
 *
 * ⚠ IT COULD NOT BE REPAIRED, ONLY REMOVED, and the argument is a proof rather than a preference:
 * dating one side honestly requires dating the other, and dating the other means a row per line per
 * month on BOTH halves of a report a treasurer is meant to read in one screen. There is no version
 * of the fold that is both truthful and short.
 *
 * ⚠⚠ NOTHING IS LOST THAT THE ROW DID NOT ALREADY ANSWER BETTER. The fold was a THIRD answer on a
 * row that has two: the Budget figure opens the plan (its schedule included — that is the PLAN's
 * dates, claiming nothing about when money moved), and the Actual figure opens the records that
 * made it, which on a revenue row are the drives and sponsors BY NAME, each linking to its room.
 * The one question that genuinely leaves the product is *"we are over on ice time — which month?"*;
 * Months answers by category rather than by line, and the owner accepted that trade explicitly.
 *
 * ⚠ CATEGORY ROWS STILL FOLD. That is a fold onto THINGS, which is the whole point — and since
 * 2026-09-10 Player dues is one of them, folding to one row per family.
 *
 * ⚠⚠ THE BUILD ENFORCES THE ABSENCE — tests/unit/bva-no-dates-guard.test.ts. This rule will be
 * re-added by a future session with a perfectly good local reason (the "N lines" caption changed
 * hands three times in three days before the owner ended it); that test is where to argue first.
 */
export function ItemRows({
  cat, openBehind,
}: {
  cat: CategoryResult;
  /** Opens "what is behind this figure?" for one side of the row — see `RecordsBehind`. */
  openBehind: (item: ItemResult, side: BehindSide) => void;
}) {
  const catKey = catKeyOf(cat);
  return (
    <>
      {cat.items.map(item => {
        const key = `${catKey}|${item.itemId ?? 'none'}`;
        /* What each figure has to SHOW, which is not the same as whether it is non-zero: a row can
           hold only money back (actual negative, nothing "paid"), and an unplanned row has no lines
           at all. A figure with an empty list behind it stays a plain number — a door onto nothing
           is the politer face of the same dead end this change exists to close. */
        /* ⚠⚠ `item.lines?.length`, NOT `.length` — see the field's own note. This predicate runs
           on every row of the statement, so an unguarded read against a stale payload would not
           merely break the panel, it would take the whole table down before a figure rendered. */
        /* ⚠⚠ AND IT IS WHAT GIVES A **PLAYER ROW** A PLAIN BUDGETED FIGURE, with no special case
           written anywhere: a family's row carries no budget lines, so this is false and the number
           stays a number. That is the report's existing rule applying, not an exception to it — a
           family's bill is one assessed figure, not a pile of records, and the instalment dates
           behind it live on Player Dues, which is where a coach goes to chase. */
        const planBehind = (item.lines?.length ?? 0) > 0;
        /* ⚠ `item.costs?.length`, NOT `.length` — same deploy-skew note as `lines`, and the same
           predicate position: this runs unconditionally for every row. `refunds` needs no guard,
           it was never stripped. */
        /* ⚠⚠ THE THIRD CLAUSE IS THE PLAYER ROW'S DOOR, AND IT KEEPS THE OLD PREDICATE EXACTLY
           (owner ruling 2026-09-10). The dues composition panel moved DOWN from the category figure
           onto each family's Actual, and its "only when there is something to explain" rule came
           with it: a family whose every dollar arrived as cash has one line to show, and a panel
           with one row restating the figure that opened it is furniture. So the predicate is the
           two NON-CASH parts, never `actual > 0`. */
        const actualBehind = (item.costs?.length ?? 0) > 0 || item.refunds.length > 0
          || duesDoorOpens(item);
        return (
          <Fragment key={key}>
            {/* ⚰ THE ROW WAS TAPPABLE AND CARRIED A CHEVRON, AND BOTH ARE GONE WITH THE FOLD (owner
                ruling 2026-09-10). There is nothing left for a tap on the row to mean: the two
                figures are the doors, and each is its own control. A row-level handler with no
                behaviour is worse than none — it teaches a gesture that does nothing.

                ⚠ THE SPACER STAYS, AND IT IS NOT LEFTOVER. It is what lines every item name up
                under the chevron of the CATEGORY row above it, which still folds. Remove it and
                every line item shifts 13px left of the heading it belongs to.

                ⚠⚠ DO NOT "RESTORE PARITY" WITH THE BUDGET PLAN'S ROWS. Over there the row opens the
                EDITOR, because that screen is the WORKLIST and its pencil is clipped out of the
                layout on a phone, so the row is the only edit door a thumb has. This is the REPORT:
                nothing on it can be edited. The two screens differ on purpose. */}
            <tr>
              <th scope="row" className={`${styles.lead} ${shared.moneyGridLead}`}>
                <span className={shared.moneyGridExpandSpacer} />
                <span className={styles.lineName}>{item.itemName}</span>
                {/* ⚠⚠ THE "N lines" CAPTION IS GONE — FROM EVERY SURFACE (owner ruling 2026-09-04,
                    QA §133), together with its twins on the Budget list and the by-period grid. It
                    had changed hands three times in three days: a caption, then a door, then a
                    caption again, each time argued from "nothing else on the row says the row is a
                    merge". The owner ended the argument by rejecting its premise — *"we can spiral
                    with logic like that; I don't know how much gas is in my car until I turn it on"*.
                    Nothing bad happens when a coach opens a row and only then sees two lines. The
                    words were over-explaining, and over-explaining is what fills these screens with
                    text a coach has to read past.
                    ⚠ The build enforces the absence: tests/unit/bva-figure-doors-guard.test.ts. If
                    you are about to re-add it in ANY form, that test is where to argue first. */}
                {/* ⚠⚠ THE VISIBLE "not planned" WORD IS GONE (owner ruling 2026-09-04, QA §132
                    round three) — a deliberate RE-REVERSAL of D5.5 (2026-09-02), taken on the built
                    screen rather than on a plan, and the help article had been carrying the owner's
                    reason all along before D5.5 briefly contradicted it: *the empty Budget figure is
                    the whole answer*.
                    ⚠⚠ AND THE ROW TINT THAT REPLACED IT IS NOW GONE TOO (owner ruling 2026-09-05).
                    The 09-04 note argued the tint "keeps the row honest at a glance" while
                    conceding in the same breath that it had started reading as GROUPING rather than
                    status. On one white surface it has nothing left to be confused with, so the
                    fact sits on the figure that states it: the Budget cell's dash, in amber.
                    ⚠ THE SENTENCE STAYS FOR A SCREEN READER, because a dash and an ink are not
                    readable — the same reason the category row carries one. */}
                {!item.inPlan && (
                  <span className={styles.srOnly}> — not planned</span>
                )}
              </th>
              {/* ⚠ BOTH FIGURES ARE THE SAME CONTROL. They differ only in which list they open, so
                  a coach meeting them has one habit to learn rather than two. */}
              <td className={item.inPlan ? '' : styles.unplannedDash}>
                {item.inPlan && planBehind ? (
                  <button
                    type="button"
                    className={styles.figureBtn}
                    onClick={e => { e.stopPropagation(); openBehind(item, 'plan'); }}
                    title={`See what ${item.itemName} plans`}
                  >
                    {fmt(item.budgeted)}
                  </button>
                ) : item.inPlan ? fmt(item.budgeted) : '—'}
              </td>
              <td>
                {actualBehind ? (
                  <button
                    type="button"
                    className={styles.figureBtn}
                    onClick={e => { e.stopPropagation(); openBehind(item, 'actual'); }}
                    /* ⚠ A FAMILY DID NOT "COST" ANYTHING. The dues rows are the one place on this
                       table where the Actual figure is a contribution rather than a movement, and
                       the tooltip is the only words the control has. */
                    title={item.duesParts
                      ? `See what ${item.itemName} has contributed`
                      : `See what ${item.itemName} has actually cost`}
                  >
                    {fmtCell(item.actual)}
                  </button>
                ) : fmtCell(item.actual)}
              </td>
              <td style={{ color: varianceInk(item.variance, item.direction, item.actual) }}>
                {varianceText(item.variance, item.direction, item.actual)}
              </td>
            </tr>

            {/* ⚰ THE PERIOD SUB-ROWS STOOD HERE — a row per planned slot, carrying that slot's
                date, its planned amount, and the real money swept onto it. Deleted 2026-09-10, and
                with them the last date on either report.

                ⚠⚠ DO NOT REBUILD THEM FROM `item.periods`, WHICH IS STILL IN THE PAYLOAD AND STILL
                HAS TO BE. Those dates are the PLAN's schedule: they drive the To date comparison
                basis and they are the list behind a Budget figure, where a date claims nothing about
                when money moved. What was wrong was pairing them with an ACTUAL — the plan dated on
                one side, the money swept onto it on the other, which reported August takings as
                February on any line with a single planned slot.

                ⚠ THE THREE HONEST ANSWERS, so you do not need this one: the **Months view** dates
                both sides the same way and is built on time; the **Actual** figure's panel dates
                each RECORD by the day it moved; and the **Budget** figure's panel lists the plan's
                own schedule. Between them there is no question this fold answered. */}
          </Fragment>
        );
      })}
    </>
  );
}

/**
 * THE FOLDABLE CATEGORY ROW — the tinted bar that names a category and totals it, shared by BOTH
 * shapes (owner ruling 2026-09-06).
 *
 * ⚠⚠ IT IS SHARED FOR THE SAME REASON `ItemRows` IS: the statement and the by-activity lens must
 * not be able to render one row two different ways. By activity had no fold at all until this date
 * — an inert heading with a blank chevron-width gap where a control was not — so one report had two
 * grammars for one object, and the gesture a coach learned on the statement died on the next tab.
 *
 * ⚠ THE THREE FIGURE CELLS ARE THE CALLER'S, and that is not laziness. A category's Budgeted is
 * always positive (the direction carries the sign) and takes `fmt` plus the unplanned dash; an
 * activity's is a NET that can go negative and takes `fmtCell`'s brackets. Passing the cells in
 * keeps one row drawing without pretending two different figures are one.
 *
 * ⚠ THE ROW IS A ROW; THE BUTTON IS INSIDE ITS FIRST CELL. The outline made the whole category bar
 * a <button>, which a table cannot do — a <button> is not valid inside <tr>, and wrapping the row
 * would break the pinned first column out of the table's own layout. The month grid already solved
 * this the same way (`.moneyGridToggle`): the name cell holds a real control that carries
 * `aria-expanded`, and the figures sit beside it as data.
 *
 * ⚠ THE ROW IS THE POINTER/TOUCH SHORTCUT, the button is the SEMANTIC control — the same split the
 * item rows use, and what the outline's full-width category bar gave for free. Converting that bar
 * to a button-inside-a-cell shrank the target from the whole row to the width of the name; the
 * tap-floor gate measures HEIGHT, so nothing caught it.
 * ⚠ THE INNER BUTTON MUST stopPropagation, or a click on it runs both handlers and toggles twice —
 * which reads as a row that ignores you.
 */
export function CatFoldRow({
  name, open, onToggle, noteId, note, foldable = true, caption, children,
}: {
  name: string;
  open: boolean;
  onToggle: () => void;
  /** Set together with `note` when the row needs a screen-reader explanation for its dash. */
  noteId?: string;
  note?: string;
  /**
   * ⚠⚠ FALSE WHEN THERE IS NOTHING UNDERNEATH TO FOLD TO — a chevron promising a list and opening
   * on nothing is the exact dead end this report has spent three rulings removing.
   *
   * Exactly one row reaches this today: **Player dues on a team that has not set any** (2026-09-10).
   * Every other category exists because it has a line or a payment in it, so it always has at least
   * one item. The spacer keeps its name aligned with the rows that do open.
   */
  foldable?: boolean;
  /**
   * A second line under the category's name.
   *
   * ⚠ ONE CATEGORY USES IT, AND IT IS A FACT A COACH MAY GENUINELY NOT KNOW: *"Not set yet · Set
   * player dues"*. Every other category on this report says nothing (owner ruling 2026-09-06,
   * QA §146 — a caption naming the screen a thing was set on tells a coach what they just did).
   * The exception survives because "no dues schedule exists" is the reason the Plan cell shows a
   * dash, and the row is where a coach is looking when they wonder why.
   */
  caption?: ReactNode;
  /** The three figure cells — Budgeted, Actual, Variance. */
  children: ReactNode;
}) {
  return (
    <tr
      className={[
        shared.moneyGridCat,
        foldable ? shared.rowTappable : '',
        caption ? styles.catTwoLine : '',
      ].filter(Boolean).join(' ')}
      // Selecting text to copy a figure must not fold the row — a click that ends a selection is
      // a copy gesture, not a tap (the same guard every other row on this report carries).
      onClick={foldable ? () => { if (window.getSelection()?.toString()) return; onToggle(); } : undefined}
    >
      <th scope="row" className={styles.lead}>
        {foldable ? (
          <button
            type="button"
            className={shared.moneyGridToggle}
            aria-expanded={open}
            aria-describedby={noteId}
            onClick={e => { e.stopPropagation(); onToggle(); }}
          >
            {open ? <ChevronDown size={14} aria-hidden /> : <ChevronRight size={14} aria-hidden />}
            <span>{name}</span>
          </button>
        ) : (
          /* ⚠ THE SPACER IS WHAT KEEPS AN UNFOLDABLE HEADING'S NAME IN LINE with the categories
             above and below it, which all carry a 14px chevron. Without it the one row that cannot
             open is also the one row whose name starts in a different place. */
          <>
            <span className={shared.moneyGridChevronSpacer} aria-hidden />
            {/* ⚠ THE DESCRIPTION RIDES THE NAME WHEN THERE IS NO BUTTON TO HANG IT ON. `aria-describedby`
                lived only on the foldable branch's button, so an unfoldable heading rendered the
                hidden sentence with NOTHING referencing it — a description a screen reader meets as
                loose prose rather than as this row's explanation (`/review`, 2026-09-10). */}
            <span aria-describedby={noteId}>{name}</span>
          </>
        )}
        {caption}
        {/* No visible "not planned" word here either — see the item rows' note. The dash in the
            Budget cell says it, and this sentence says it for a screen reader.
            ⚠⚠ OUTSIDE THE BUTTON, AND THAT IS NOT COSMETIC. A button's accessible NAME comes from
            its contents, so a description nested inside it is read as part of the name — the
            rendered sweep caught the control announcing itself as
            "TournamentsNothing in Tournaments was bu…". `aria-describedby` can point anywhere in
            the document; it does not have to be a child. */}
        {noteId && <span id={noteId} className={styles.srOnly}>{note}</span>}
      </th>
      {children}
    </tr>
  );
}

/** A category: its collapsible header, then its items. */
export function CategoryGroup({
  cat, expandedCats, toggleCat, openBehind, caption, spanWord = 'season',
}: {
  cat: CategoryResult;
  expandedCats: Set<string>;
  toggleCat: (id: string) => void;
  openBehind: (item: ItemResult, side: BehindSide) => void;
  /** See `CatFoldRow.caption` — one category on this report has a second line, and it is dues. */
  caption?: ReactNode;
  /** The span the off-plan sentence names: the coach's season, the club's year (Club Tier Stage 3b). */
  spanWord?: 'season' | 'year';
}) {
  const catKey = catKeyOf(cat);
  /* ⚠ A CATEGORY NOBODY BUDGETED FOR IS THE POINT, NOT AN EDGE CASE (owner ruling 2026-08-15). It
     carries no Budgeted figure at all, so the row is flagged and the dash is explained by the flag
     rather than left to read as a lost number. The sentence rides the header via aria-describedby:
     a screen reader meeting a bare em-dash would otherwise get no explanation, because the flag is
     a visual one (/review, 2026-08-15). */
  /* ⚠⚠ A CAPTION REPLACES THE NOTE, IT DOES NOT JOIN IT (`/review`, 2026-09-10). The generic
     sentence explains an em-dash under Budgeted with "nothing here was budgeted for this season" —
     which is TRUE of an unplanned category and FALSE of Player dues, where a dash means no schedule
     has been set. A not-set dues row satisfies `!inPlan`, so it used to render both: a visible
     "Not set yet · Set player dues" and, for a screen reader only, a contradicting sentence about
     budgeting. The caption is the truer half and it is the one every reader gets. */
  const noteId = cat.inPlan || caption ? undefined : `bva-cat-note-${catKey.replace(/\W+/g, '-')}`;
  const open = expandedCats.has(catKey);
  return (
    <>
      <CatFoldRow
        name={cat.categoryName}
        open={open}
        onToggle={() => toggleCat(catKey)}
        noteId={noteId}
        note={`Nothing in ${cat.categoryName} was budgeted for this ${spanWord}.`}
        /* ⚠ A CATEGORY WITH NOTHING IN IT DOES NOT OFFER A FOLD — see `CatFoldRow.foldable`. Only
           the not-set Player dues row reaches this; every other category owes its existence to
           having at least one line or payment in it. */
        foldable={catFoldable(cat)}
        caption={caption}
      >
        {/* ⚠⚠ A CATEGORY'S FIGURES ARE PLAIN CELLS, AND SINCE 2026-09-10 THERE ARE NO EXCEPTIONS
            (owner ruling — the rule the dues change settles report-wide): **a door lives on an ITEM
            number, never on a CATEGORY number.** Player dues was the report's only violation: a
            synthetic category carrying a drill-in on a category row. Folding it to players moved
            that door DOWN onto each family's Actual, which is where every other door already sits —
            so the rule is now true by construction rather than by everyone remembering it. */}
        <td className={cat.inPlan ? '' : styles.unplannedDash}>
          {cat.inPlan ? fmt(cat.budgeted) : '—'}
        </td>
        <td>{fmtCell(cat.actual)}</td>
        <td style={{ color: varianceInk(cat.variance, cat.direction, cat.actual) }}>
          {varianceText(cat.variance, cat.direction, cat.actual)}
        </td>
      </CatFoldRow>
      {open && <ItemRows cat={cat} openBehind={openBehind} />}
    </>
  );
}

/**
 * A band heading — "Revenue" / "Expenses" on the statement, an activity's own name on the other
 * shape. It names the half of the report the rows under it belong to and carries no figures.
 *
 * ⚠ THREE REAL EMPTY CELLS, NEVER A `colSpan`. The first column is pinned inside
 * <CoachScrollX sticky>; a row that spans the table has nothing for that pin to hold, so the
 * heading scrolls out from under a table whose whole point is that its first column does not.
 * The month grid's band learned this first — same rule, same reason.
 */
export function SectionBand({ label }: { label: string }) {
  return (
    <tr className={shared.moneyGridBand}>
      <th scope="row" className={styles.lead}>{label}</th>
      <td /><td /><td />
    </tr>
  );
}

/**
 * The quiet inner label of an activity block — "Revenue" or "Expenses".
 *
 * ⚠ NOT A BAND, and the difference is the whole reason By activity got shorter. As a band each of
 * these was a full-height tinted bar, so a block cost three rows before its first figure. It is a
 * sub-label now: no ground, no rule, smaller than the line it introduces.
 */
export function SubLabelRow({ label }: { label: string }) {
  return (
    <tr className={styles.subRow}>
      {/* ⚠ NO `.subLead` HERE — it does not exist. The sub-label's whole treatment lives on
          `.reportTable tbody tr.subRow th.lead` (0,2,3), because a bare class lost to the shared
          row-heading reset; the class name stayed in the markup after that fix and resolved to
          `undefined`, which React writes into the attribute as the literal word. Harmless, and
          exactly the "markup with no rule" trap this file warns about one screen over. */}
      <th scope="row" className={styles.lead}>{label}</th>
      <td /><td /><td />
    </tr>
  );
}

/** A band's closing total — "Total revenue", "Total expenses". */
export function SubtotalRow({
  label, budgeted, actual, variance, direction,
}: {
  label: string; budgeted: number; actual: number; variance: number; direction: 'in' | 'out';
}) {
  return (
    <tr className={shared.moneyGridTotal}>
      <th scope="row" className={styles.lead}>{label}</th>
      <td>{fmtCell(budgeted)}</td>
      <td>{fmtCell(actual)}</td>
      <td style={{ color: varianceInk(variance, direction, actual) }}>
        {varianceText(variance, direction, actual)}
      </td>
    </tr>
  );
}

/**
 * Does this row's ACTUAL figure open the dues composition panel?
 *
 * ⚠⚠ ONLY WHEN THERE IS SOMETHING TO EXPLAIN — the predicate came down from the category row
 * unchanged (owner ruling 2026-09-04, carried to the family row 2026-09-10). On a family whose
 * every dollar arrived as cash the panel would have ONE line restating the figure that opened it,
 * which is furniture. So it is the two NON-CASH parts, never `actual > 0`.
 *
 * ⚠ THE SAME PREDICATE STILL DECIDES THE `dues-actual` FOOTNOTE, one level up and team-wide. That
 * pairing survives the move: the team total of a non-negative part is above zero exactly when at
 * least one family's is, so a report can never carry the footnote with no door beneath it, nor a
 * door with no footnote explaining the category figure.
 */
export function duesDoorOpens(item: ItemResult): boolean {
  const p = item.duesParts;
  return !!p && (Math.abs(p.familyPaidCosts) > 0.005 || Math.abs(p.fundraisingCredited) > 0.005);
}


/** One block of the by-activity lens: what a category earned, what it cost, what it netted. */
export interface ActivityBlock {
  categoryId: string | null;
  categoryName: string;
  revenue: CategoryResult | null;
  costs: CategoryResult | null;
  net: { budgeted: number; actual: number; variance: number };
  inPlan: boolean;
}

export interface MoneyReport {
  revenue: ReportSection;
  expenses: ReportSection;
  activities: ActivityBlock[];
  /** Where BOTH shapes end. Variance is actual − budgeted: more net is the good news. */
  net: { budgeted: number; actual: number; variance: number };
}

/**
 * The whole report, re-cut onto a comparison basis — ONE pass, so every figure the two shapes draw
 * comes from the same arithmetic and no render site has to know which basis it is in.
 *
 * ⚠ THIS IS WHY THE BASIS DID NOT NEED A SERVER CHANGE. `ItemResult.periods` already ships every
 * period with its date and amount (it feeds the row's own expander), so "plan dated on or before
 * today" is a filter over data the report has always carried. Re-deriving it on the server would
 * have created a second source for a figure the Months view also plots — the drift this report has
 * been consolidated twice to remove.
 *
 * ⚠⚠ TOTALS ARE RE-SUMMED FROM THE ITEMS UP, never scaled. A category's to-date plan is the sum of
 * its items' to-date plans; a section's is the sum of its categories'. Anything else lets a
 * category disagree with the rows a coach can open underneath it.
 *
 * ⚰ THE DUES ROW WAS THE ONE SPECIAL CASE AND IS NOT ANY MORE (owner ruling 2026-09-10, "Things,
 * not dates"). It read a whole-team `dues.billedToDate` off the payload, because dues are not budget
 * lines and the synthetic category carried NO ITEMS to re-sum — so the generic rule would have
 * reported $0.00 for the season's largest money in.
 *
 * ⚠⚠ THE SPECIAL CASE DIED OF THE RULING RATHER THAN BEING CLEANED UP, and that order matters. Dues
 * now fold to ONE ROW PER FAMILY, and each of those rows carries that family's own instalment dates
 * as its `periods` — so "plan dated on or before today" is exactly the rule every other row obeys,
 * and it lands on the identical figure. The route still ships `dues.billedToDate`; the guard script
 * reads it, and it is the second derivation this one is proved against.
 *
 * ⚠ IF YOU EVER MAKE THE DUES CATEGORY ITEM-LESS AGAIN, THIS BREAKS SILENTLY — the to-date revenue
 * band would read $0.00 on a team billing perfectly on schedule, with nothing on screen saying so.
 * That is the whole reason the items exist rather than a display convenience.
 */
export function rebaseReport(
  report: MoneyReport, basis: CompareBasis, today: string,
): MoneyReport {
  if (basis === 'season') return report;

  const rebaseItem = (it: ItemResult): ItemResult => {
    const budgeted = budgetedOn('todate', it.budgeted, it.periods, today);
    return { ...it, budgeted, variance: varianceOn(it.direction, budgeted, it.actual) };
  };

  const rebaseCat = (cat: CategoryResult): CategoryResult => {
    const items = cat.items.map(rebaseItem);
    const budgeted = r2(items.reduce((s, i) => s + i.budgeted, 0));
    return { ...cat, items, budgeted, variance: varianceOn(cat.direction, budgeted, cat.actual) };
  };

  const rebaseSection = (sec: ReportSection): ReportSection => {
    const categories = sec.categories.map(rebaseCat);
    const budgeted = r2(categories.reduce((s, c) => s + c.budgeted, 0));
    return { ...sec, categories, budgeted, variance: varianceOn(sec.direction, budgeted, sec.actual) };
  };

  const revenue  = rebaseSection(report.revenue);
  const expenses = rebaseSection(report.expenses);

  const activities = report.activities.map(block => {
    const rev = block.revenue ? rebaseCat(block.revenue) : null;
    const cst = block.costs   ? rebaseCat(block.costs)   : null;
    const budgeted = r2((rev?.budgeted ?? 0) - (cst?.budgeted ?? 0));
    const actual   = r2((rev?.actual ?? 0) - (cst?.actual ?? 0));
    /* A block's net is money IN less money OUT, so more of it is the good news — the same rule the
       report's own closing row uses, and the reason both take direction 'in'. */
    return { ...block, revenue: rev, costs: cst,
      net: { budgeted, actual, variance: varianceOn('in', budgeted, actual) } };
  });

  const netBudget = r2(revenue.budgeted - expenses.budgeted);
  return {
    revenue, expenses, activities,
    net: {
      budgeted: netBudget,
      actual: report.net.actual,
      variance: varianceOn('in', netBudget, report.net.actual),
    },
  };
}
