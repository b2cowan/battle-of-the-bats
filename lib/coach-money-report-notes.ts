/**
 * THE SENTENCES UNDER A MONEY REPORT — one home, read by the screen AND by the files.
 *
 * ## Why this module exists
 *
 * Every claim these reports make about their own basis used to live as JSX inside the component
 * that drew the table. That was fine while the only reader was the screen. It stopped being fine
 * on 2026-09-05, when the owner asked for the disclaimers to travel with the Excel and PDF
 * exports: a treasurer downloads Budget vs. Actual, emails it to a board, and the board reads
 * "Total expenses $4,909.98" with no way to know it deliberately excludes costs a family paid a
 * vendor directly. The figures travelled; the caveats did not.
 *
 * The obvious way to fix that — retype the sentences into the export layer — is the failure this
 * report has already had three times. Its own neighbours cite the precedent: the screen and the
 * export having had two different formulas for `hasUndated`, and a note that explained a gap by
 * naming a cause that had stopped existing. **A sentence with two authors drifts.** So the text
 * lives here once, the screen renders it, the files render it, and a wording change lands in both
 * by construction.
 *
 * ## Where the ⚠ rulings went
 *
 * They came WITH the copy, and that is deliberate — every one of them is a ruling about WORDING,
 * so its home is beside the words rather than beside the `<p>` that used to hold them. If you are
 * about to change a sentence here, the note above it is the argument you have to beat.
 *
 * ## What a file drops
 *
 * A clause that names a gesture ("Tap a category's figure…", "See it in the months view") is an
 * instruction nobody can follow in a spreadsheet, so it is marked `screenOnly` and disappears from
 * every export (owner ruling 2026-09-05). The FACT half of such a sentence always stays — the file
 * keeps "Both columns compare a whole season's plan against what has moved so far" and drops only
 * the "tap this to change it" that follows. Dropping the fact would be the export lying by
 * omission; keeping the gesture would be the file telling a reader to tap paper.
 *
 * ## What this module refuses to do
 *
 * **It never formats money and it never does arithmetic.** Every figure arrives pre-formatted from
 * the caller, which already has the report's own formatters and its own sign conventions (`fmt`
 * strips signs because each screen caller prints its own; `fmtSignedAmount` does not). A second
 * formatter here is how one report starts printing one number two ways.
 *
 * Pure: no IO, no React, no Date.
 */

import {
  buildBandCashFlow, hasUndated, lensReadsSpendingGrid, lensUndated, scheduledForward,
  formatMonthLong, type MonthGrid, type MoneyLens,
} from './coach-budget-months';
import { fmt as fmtSignedAmount } from './coach-money-summary';
import type { CompareBasis } from './coach-budget-basis';

/** One run of text inside a note. `bold` is the screen's `<strong>` and the file's bold run. */
export interface NoteSegment {
  text: string;
  bold?: boolean;
  /**
   * Rendered on screen, dropped from every file.
   *
   * Two kinds qualify and nothing else: a CONTROL (a bridge link, a "Set player dues" door), and
   * the prose that only makes sense beside one. A fact is never screen-only — see the module note.
   */
  screenOnly?: boolean;
  /**
   * What the screen draws this run as. Absent = plain text. The screen maps the id to its own
   * handler; this module knows the id and nothing about what it does, which is what keeps a pure
   * module free of the panel's state.
   */
  control?: NoteControl;
}

/** The bridge links these notes can carry. Each screen supplies the handler. */
export type NoteControl = 'compare-to-date' | 'months-view' | 'set-dues';

export interface ReportNote {
  /** Stable key — React's, and the id a test names when it asserts a note is present. */
  id: string;
  /**
   * `note` is the quiet footnote voice every one of these uses. `alert` is the ONE band that is a
   * finding rather than an explanation (the balance going below zero), and it keeps its own
   * treatment in both the screen and the file.
   */
  tone: 'note' | 'alert';
  segments: NoteSegment[];
}

function note(id: string, segments: NoteSegment[]): ReportNote {
  return { id, tone: 'note', segments };
}

/* ─────────────────────────────────────────────────────────────────────────────
   READING A NOTE INTO A FILE
   ───────────────────────────────────────────────────────────────────────────── */

/** The runs a file writes: screen-only clauses removed, adjacent plain runs left alone (Excel's
 *  rich text keeps them as separate runs quite happily, and merging them would lose nothing and
 *  cost a pass). */
export function noteRunsForFile(n: ReportNote): { text: string; bold: boolean }[] {
  return n.segments
    .filter(s => !s.screenOnly)
    .map(s => ({ text: s.text, bold: !!s.bold }));
}

/**
 * A note as one plain string — the PDF's shape, and what a test asserts against.
 *
 * ⚠ THE WHITESPACE IS TIDIED, and it has to be. The segments carry the spacing the SCREEN needs
 * (a leading space before a bridge link, JSX's own `{' '}` joins); dropping a screen-only run out
 * of the middle can leave a double space or a space before a full stop, which looks like a typo in
 * a document a board reads.
 */
export function noteTextForFile(n: ReportNote): string {
  return noteRunsForFile(n)
    .map(r => r.text)
    .join('')
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,;:])/g, '$1')
    .trim();
}

/* ─────────────────────────────────────────────────────────────────────────────
   THE MONTH GRID  (Money → Budget vs. Actual → Months, and the Budget plan's own grid)
   ───────────────────────────────────────────────────────────────────────────── */

export interface MonthGridNoteInput {
  lens: MoneyLens;
  /** Pre-formatted. `null` = no opening balance has been set on this season. */
  opening: string | null;
  /** The season an opening balance was carried from, if it was carried rather than typed. */
  openingFrom: string | null;
  /** Pre-formatted, for the Scheduled lens's running-balance sentence. */
  cashOnHand: string;
  /** The Scheduled lens's forward derivation — omitted when nothing is merely "possible", because
   *  then the Closing balance IS the banner's figure and a derivation explains a gap that is not
   *  there. All three pre-formatted, `ending` and `headline` SIGNED (a season can end short). */
  forward: { ending: string; possible: string; headline: string } | null;
  /** Undated plan money under the Budget lens, pre-formatted. `null` = nothing to say. */
  budgetUndated: string | null;
  /** How many months the grid could show, when it had to stop short. `null` = it showed them all. */
  truncatedMonths: number | null;
  /** The month a running balance first goes negative, and by how much. Both display-ready. */
  shortfall: { month: string; amount: string } | null;
}

/**
 * Every claim the grid makes about its own basis, in the order it makes them.
 *
 * ⚠⚠ THE "player dues only… same dollar twice" SENTENCE WAS RETIRED HERE (owner ruling
 * 2026-08-23, reversing 2026-07-30 — memory/design_decisions.md). Its rationale survived three
 * model changes it was no longer true under, restated on screen the whole time; the durable lesson
 * is that a footnote explaining a rule is also that rule's expiry checklist. Each lens now states
 * its own basis, because they genuinely differ.
 */
export function monthGridNotes(input: MonthGridNoteInput): ReportNote[] {
  const { lens } = input;
  const out: ReportNote[] = [];

  /* ⚠⚠ REWRITTEN WITH THE THIRD BAND (owner ruling 2026-09-02). The old copy said expenses were
     "bills paid, payments to the club, and money paid back to families", and closed by promising a
     family-fronted cost "lands here the day you pay that family back" — both sentences described
     the arrangement that change ended. Leaving either would have been the demo-drift failure
     happening on the product itself: every figure right, the sentence underneath quietly false.
     ⚠⚠ THE THREE REWRITTEN BASIS NOTES ARE THE G1 GATE MOCKUP'S, VERBATIM (approved 2026-09-02) —
     each shows only under its own reading. */
  if (lens === 'actual') {
    out.push(note('basis-actual', [
      { text: 'Cash is money that moved.', bold: true },
      { text: ' Revenue is every dollar that arrived — dues, fundraising and sponsor money received, income and money back you recorded, and anything the club sent. ' },
      { text: 'Expenses are what you paid vendors.', bold: true },
      { text: ' A cost a ' },
      { text: 'family paid a vendor directly', bold: true },
      { text: ' is season spending, not cash — flip to ' },
      { text: 'Season spending', bold: true },
      { text: ' to see it. Money you hand back to a family is your cash, but it isn’t spending, so it has its own band below.' },
    ]));
  }

  if (lens === 'spending') {
    out.push(note('basis-spending', [
      { text: 'Season spending is what the season spent', bold: true },
      { text: ' — the Statement, month by month. A cost counts the day it happened, ' },
      { text: 'whoever paid it', bold: true },
      { text: '; a family-paid cost is here, tagged. Money back subtracts from the cost it repaid. Cheques you write back to families aren’t spending — flip to ' },
      { text: 'Cash', bold: true },
      { text: ' for what your money did.' },
    ]));
  }

  /* ⚠ THE CARRY EXPLAINS ITSELF WHERE THERE IS ROOM FOR A SENTENCE — see the note on the Opening
     balance row. Shown on the two lenses that start from it; Scheduled projects from today's real
     money, which already contains it. */
  if (input.opening !== null && lens !== 'scheduled') {
    out.push(note('opening-set', [
      { text: `This season opened with ${input.opening}`, bold: true },
      {
        text: input.openingFrom
          ? ` — carried from ${input.openingFrom} when this season was started.`
          : ' that the team was already holding.',
      },
      { text: ' Change it in ' },
      { text: 'Team settings → Money', bold: true },
      { text: '.' },
    ]));
  }

  /* The other half of the provenance (owner D5.10, 2026-09-02): a season with NO opening balance
     says so, pointing a wrong bank tie-out at its likeliest cause instead of leaving a coach to
     discover the assumed zero by arithmetic. */
  if (input.opening === null && lens !== 'scheduled') {
    out.push(note('opening-unset', [
      { text: 'No opening balance is set', bold: true },
      { text: ' — the balance rows assume the season started from $0. If the team was already holding money on day one, set it in ' },
      { text: 'Team settings → Money', bold: true },
      { text: '.' },
    ]));
  }

  if (lens === 'scheduled') {
    out.push(note('basis-scheduled', [
      { text: 'Scheduled is what’s still to come.', bold: true },
      { text: ' Dues installments not yet paid, sponsor pledges and anything you’ve asked the club for, against what you still owe. A pledge and a pending request have no date, so they sit under ' },
      { text: 'No date yet', bold: true },
      { text: ` — in the Total, in no month, counted as possible rather than arrived. The running balance starts from today’s real money, ${input.cashOnHand}.` },
    ]));

    /* ⚠ THE BANNER'S FIGURE, DERIVED OUT LOUD (owner walk feedback, 2026-09-02: the forward stat
       linked here and its number appeared nowhere on this screen). The caller passes the same
       helper's output the banner uses, so the sentence and the headline cannot disagree; it only
       arrives when the two figures genuinely differ. */
    if (input.forward) {
      out.push(note('scheduled-forward', [
        { text: 'The Closing balance ends the season at ' },
        { text: input.forward.ending, bold: true },
        { text: `; take back out the ${input.forward.possible} that’s only possible — the pledges and pending asks under ` },
        { text: 'No date yet', bold: true },
        { text: ' — and on what’s certain you end with ' },
        { text: input.forward.headline, bold: true },
        { text: ', the banner’s forward figure.' },
      ]));
    }
  }

  if (lens === 'budget') {
    out.push(note('basis-budget', [
      { text: 'Budget is your plan', bold: true },
      { text: ', not your bills — the dues installments you set, your planned funding, and the months you gave your costs.' },
      ...(input.budgetUndated
        ? [{ text: ` ${input.budgetUndated} with no date yet is in the Total and in no month.` }]
        : []),
    ]));
  }

  /* ⚠ REWRITTEN FOR Q3 (ruled 2026-09-02): Difference compares plan against SPENDING now, which is
     why it can finally claim Headroom by name. The G1 mockup's copy, verbatim. */
  if (lens === 'difference') {
    out.push(note('basis-difference', [
      { text: 'Difference is your plan against what the season spent', bold: true },
      { text: ', for months that have already happened — it matches Headroom exactly. A positive figure is good news on both bands: revenue that ' },
      { text: 'came in ahead', bold: true },
      { text: ', or spending that came in ' },
      { text: 'under', bold: true },
      { text: '. A month still ahead shows “—”.' },
    ]));
  }

  /* ⚠⚠ THIS NOTE USED TO SAY THE OPPOSITE, and it was the THIRD copy of one stale claim
     (2026-08-21): the same sentence lived in a code comment, in the grid's own cell logic, and
     here in front of the coach. Spending now lands on the item row it names — so the line telling
     a coach to expect a dash was the last thing still asserting the old behaviour, and the most
     expensive, because a reader believes it. */
  if (lens === 'actual' || lens === 'scheduled' || lens === 'spending') {
    out.push(note('itemisation', [
      { text: lens === 'scheduled' ? 'A bill' : 'Spending' },
      { text: ' sits on the ' },
      { text: 'item', bold: true },
      { text: ' it names, so a category is what its rows add up to. Money recorded without an item sits on that category’s ' },
      { text: 'Not itemized', bold: true },
      { text: ' row.' },
      /* ⚠ A GESTURE, SO IT NEVER REACHES A FILE (owner ruling 2026-09-05). "Tap a category's
         figure" is unfollowable in a spreadsheet; the two sentences before it are facts about
         where money sits and travel intact. */
      { text: ' Tap a ', screenOnly: true },
      { text: 'category’s', bold: true, screenOnly: true },
      { text: ' figure to see what makes it up.', screenOnly: true },
    ]));
  }

  /* ⚠⚠ THE TWO TRUTHS, NAMED (owner ruling 2026-08-23). Months is CASH and the Statement is the
     season's spending, so their Total expenses can differ — and the coach who spots that gap
     deserves to be told why by the screen rather than by support. The causes are listed because
     "they use different bases" answers nothing a treasurer can check.
     ⚠⚠ THE FIRST CAUSE STOPPED BEING TRUE ON 2026-09-02 AND THE SENTENCE DID NOT NOTICE. It read
     "this view adds money paid back to families" — which is exactly what the returned band ended:
     those cheques are no part of Total expenses any more. A note explaining a gap by naming a
     cause that no longer exists is worse than no note, because a treasurer reconciling by hand
     will look for an adjustment that isn't there. Two causes now, and the band is named as the
     third thing the reader can see rather than as an adjustment. */
  /* ⚠⚠ AND SINCE 2026-09-07 THE TWO VIEWS DIFFER ON REVENUE TOO (owner rulings R2–R4). The
     Statement counts what a family CONTRIBUTED — cash they sent, plus a team bill they paid
     themselves, plus fundraising credited against their dues — because the cost of that bill is
     already counted as the season's spending and counting one side without the other reported the
     season as worse off every time a parent helped. Cash counts what arrived in the account, which
     is a different and equally true number.
     ⚠ THE SENTENCE HAD TO GROW WITH THE CHANGE OR BECOME THE DEFECT ABOVE. It named the expense
     gap only; after R2–R4 a coach can see a dues gap it does not mention, and a footnote that
     explains half of what is on screen sends a treasurer looking for an adjustment that is not
     there — which is exactly how the 2026-09-02 failure happened.

     ⚠⚠ AND IT GREW ONE CLAUSE SHORT, WHICH IS THE SAME FAILURE IN MINIATURE (owner-found
     2026-09-10). The dues half named the two things the Statement ADDS and not the one it SUBTRACTS,
     so a treasurer following it landed above the Statement's figure by exactly the cash handed back
     — $300.00 on the UAT team, against a $1,982.63 gap the sentence claimed to explain. The
     Statement's own `dues-actual` note has said “less money handed back” since the day it was
     written, so for three days one report explained one gap two different ways and only the half
     facing the coach who notices the gap was incomplete.

     ⚠ "adds … and leaves out", NOT "also includes". A list of additions has no grammatical room for
     a subtraction, which is how the clause came to be missing rather than wrong; the pair of verbs
     is what keeps the next editor from dropping it again.

     ⚠⚠ "THEIR OWN cash" AND "STILL credited" — BOTH WORDS ARE LOAD-BEARING (review, 2026-09-10).
     The first draft of the clause said "leaves out cash you have handed back", full stop, and it was
     wrong by exactly the failure it was fixing. This same screen shows a "Money returned to families"
     band holding EVERY cheque back — $600.00 on the UAT team — while the Statement's figure only
     subtracts the $300.00 that was a family's own money; the other $300.00 came back out of a
     fundraising credit and is already absent from "fundraising credited", because that figure counts
     what is STILL standing. A treasurer reading the unscoped sentence against the visible band and
     the visible credited figure lands $300.00 short. "Still credited" says the credit figure is net of
     paybacks; "their own cash" says which paybacks the subtraction is. Both halves — this note and the
     Statement's `dues-actual` — carry the same two words for the same reason. */
  if (lens === 'actual') {
    out.push(note('two-truths', [
      { text: 'These totals can differ from the ' },
      { text: 'Statement', bold: true },
      { text: '’s and ' },
      { text: 'Season spending', bold: true },
      { text: '’s, and both are right. On ' },
      { text: 'expenses', bold: true },
      { text: ', this view leaves out costs a family paid a vendor directly, and shows money back as revenue instead of subtracting it from the cost it repaid. Money you return to families is in its own band — counted in your balance, never in Total expenses. On ' },
      { text: 'player dues', bold: true },
      { text: ', this view counts the cash families sent; the Statement counts what they contributed — which adds a team bill a family paid themselves and fundraising still credited against their dues, and leaves out their own cash you have handed back.' },
    ]));
  }

  if (input.truncatedMonths !== null) {
    out.push(note('truncated', [
      { text: `Showing the first ${input.truncatedMonths} months. Anything dated outside them still counts in the Total column.` },
    ]));
  }

  /* ⚠⚠ THE TENSE FOLLOWS THE LENS, and it did not until the coach demo was read back with the
     bands in place (2026-08-23). "On this plan you go short" is a PROJECTION's sentence — true
     under Budget and Scheduled, and plainly wrong under Actual, where the money has already gone
     and no plan is being discussed. The advice underneath moves with it: you cannot bring dues
     forward in a month that has already happened.
     ⚠ THE ONE `alert`, AND IT TRAVELS (owner ruling 2026-09-05). It is a FINDING rather than an
     explanation, and it is the single most useful line on the page for a board — so unlike the
     gestures above, it is exactly what an emailed file should carry. */
  if (input.shortfall) {
    out.push({
      id: 'shortfall',
      tone: 'alert',
      segments: lens === 'actual'
        ? [
          { text: `Your balance went below zero in ${input.shortfall.month} — by about ${input.shortfall.amount}.`, bold: true },
          { text: ' More went out than had come in by then. Check Scheduled for what’s still to come.' },
        ]
        : [
          { text: `On this plan you go short in ${input.shortfall.month} — about ${input.shortfall.amount}.`, bold: true },
          { text: ' Move a payment, bring dues forward, or plan the gap.' },
        ],
    });
  }

  return out;
}

/* ─────────────────────────────────────────────────────────────────────────────
   ONE DERIVATION, TWO READERS
   ───────────────────────────────────────────────────────────────────────────── */

/** The month payload's fields these notes read — the shape both the grid component and the
 *  Budget-vs-Actual panel already hold. */
export interface MonthGridNoteSource {
  monthGrid: MonthGrid;
  revenueGrid: MonthGrid;
  returnedGrid: MonthGrid;
  spendingGrid: MonthGrid;
  cashOnHand: number;
  openingBalance?: number | null;
  openingBalanceFrom?: string | null;
}

/** Money as the month grid writes it: sign-stripped, because every caller there prints its own
 *  direction. Kept beside the notes so the screen and the file cannot format one figure two ways. */
function money(n: number): string {
  return `$${Math.abs(n).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * The notes under a month grid, derived once and read by BOTH the screen and the export.
 *
 * ⚠⚠ THIS IS THE POINT OF THE MODULE. The panel already re-derives the grid's ROWS for its export
 * (`buildMonthExportRows`), and that duplication has bitten this report before — its own comments
 * name the time the screen and the file had two spellings of one predicate and drifted apart near
 * the rounding threshold. The notes do not get to repeat that: there is one function, and a lens
 * whose sentence changes changes in the spreadsheet on the same line of code.
 *
 * `lens` must already be COERCED the way the grid coerces it (a stale payload with no spending
 * grid falls back to the cash reading) — the caller does that because the fallback belongs to the
 * deploy-skew belt, not to a sentence.
 */
export function monthGridNotesFor(data: MonthGridNoteSource, lens: MoneyLens): ReportNote[] {
  const grid = data.monthGrid;
  const expensesBand = lensReadsSpendingGrid(lens) && data.spendingGrid ? data.spendingGrid : grid;
  const spendingOnly = lens === 'spending';
  const opening = data.openingBalance ?? null;

  /* The screen's own predicate for whether the No date yet column is standing at all — a figure
     quoted for a column the reader cannot see would explain nothing. */
  const showUndated = spendingOnly
    ? hasUndated([data.spendingGrid], lens)
    : hasUndated([data.revenueGrid, expensesBand, data.returnedGrid], lens);

  /* ⚠ NO BALANCE ROWS ON DIFFERENCE OR SEASON SPENDING (owner D1), so no shortfall and no forward
     derivation there either — the same rule the table itself follows. */
  const cash = lens === 'difference' || lens === 'spending'
    ? null
    : buildBandCashFlow(data.revenueGrid, grid, lens, data.cashOnHand, opening ?? 0, data.returnedGrid);

  /* The banner's own helper, so the sentence and the headline cannot disagree; nothing merely
     "possible" means the Closing balance IS the banner's figure and the derivation is dropped. */
  const fwd = lens === 'scheduled' && cash
    ? scheduledForward(data.revenueGrid, grid, data.returnedGrid, data.cashOnHand, opening)
    : null;

  const budgetUndated = lens === 'budget' && showUndated
    ? lensUndated(grid.totals.undated, lens) + lensUndated(data.revenueGrid.totals.undated, lens)
    : null;

  return monthGridNotes({
    lens,
    opening: opening === null ? null : money(opening),
    openingFrom: data.openingBalanceFrom ?? null,
    cashOnHand: money(data.cashOnHand),
    forward: fwd && fwd.possible > 0.005
      ? {
        ending: fmtSignedAmount(fwd.ending),
        possible: money(fwd.possible),
        headline: fmtSignedAmount(fwd.headline),
      }
      : null,
    budgetUndated: budgetUndated === null ? null : money(budgetUndated),
    truncatedMonths: grid.truncated ? grid.months.length : null,
    shortfall: cash?.shortfall
      ? { month: formatMonthLong(cash.shortfall.month), amount: money(cash.shortfall.amount) }
      : null,
  });
}

/* ─────────────────────────────────────────────────────────────────────────────
   THE STATEMENT  (Money → Budget vs. Actual → Statement and By activity)
   ───────────────────────────────────────────────────────────────────────────── */

/** Which of the four things the dues sentence has to say. Mirrors `duesFundingState`. */
export type DuesNoteState = 'unset' | 'covered' | 'short' | 'buffer';

export interface StatementNoteInput {
  basis: CompareBasis;
  /** `null` when the dues sentence does not render at all. All figures pre-formatted. */
  dues: {
    state: DuesNoteState;
    planNeeds: string;
    billed: string;
    /** The absolute gap — the sentence supplies its own direction word. */
    gap: string;
  } | null;
  /** Whether this coach may set dues — decides whether the "Set player dues" door is offered. */
  canWriteDues: boolean;
  /**
   * Does the dues ACTUAL hold anything other than cash — a team bill a family paid themselves, or
   * fundraising credited against their dues? `false` on a season where every dollar arrived as
   * cash, and the note stays away: the figure needs no caption when it is exactly what a coach
   * expects.
   */
  duesNonCash: boolean;
  /**
   * What has been written off the dues PLAN — a forgiven bill or a typed adjustment — pre-formatted,
   * or `null` on a season with neither, which is most seasons (owner R5, 2026-09-09).
   *
   * ⚠ IT DESCRIBES A FIGURE THAT IS ALREADY RIGHT, which is the whole difference between this note
   * and an apology. The plan side is net of these since the same ruling, so the sentence tells a
   * reader why the figure is lower than the bills they remember setting — it is not reconciling a
   * gap between two screens.
   *
   * ⚠ THIS ONE DOES QUOTE A FIGURE, unlike the dues-actual note above it. It has to: the amount is
   * the reader's only way to get back to the gross bill, and unlike the actual's three parts there
   * is no door to tap that adds it up.
   */
  duesPlanWrittenOff: string | null;
  /** Undated plan money, pre-formatted. `null` = nothing to say. */
  undatedPlan: string | null;
}

/**
 * The footnote stack under the Statement, in the order the owner ruled (2026-09-04): the key that
 * says how to read the columns, then what the bottom line means, then what could not be compared.
 *
 * ⚠ THE DUES PAIR STAYS TOGETHER (2026-09-09). What dues bill and what the dues actual counts are
 * two answers about one row, so the second follows the first and both sit ahead of "what could not
 * be compared" — splitting them would put an unrelated sentence between a question and its other
 * half.
 */
export function statementNotes(input: StatementNoteInput): ReportNote[] {
  const out: ReportNote[] = [];

  /* The variance key (owner D5.1, 2026-09-02): one column speaking two dialects finally says so.
     Approved wording from the gate mockup, verbatim. */
  out.push(note('variance-key', [
    { text: 'Variance reads: revenue ' },
    { text: '+/−', bold: true },
    { text: ' against plan · costs ' },
    { text: 'under / over', bold: true },
    { text: ' plan. Good news is always green.' },
  ]));

  if (input.dues) out.push(duesNote(input.basis, input.dues, input.canWriteDues));

  /**
   * WHAT THE DUES ACTUAL COUNTS (owner ruling 2026-09-09).
   *
   * ⚠⚠ THIS WAS A CAPTION ON THE ROW AND IT IS A FOOTNOTE NOW, at the owner's direction: every
   * other claim this report makes about its own basis is said down here, and one row explaining
   * itself in the table was the odd one out — a second voice on a screen whose sentences were
   * deliberately consolidated into one place.
   *
   * ⚠ AND THE CAPTION NEVER REACHED A FILE. It was JSX inside a `<th>`, so a treasurer who
   * downloaded this report and emailed it to a board sent a dues figure that silently counts a
   * team bill a family paid — with nothing beside it saying so. That is the exact failure this
   * module exists to end, still standing on the one sentence that had not moved in.
   *
   * ⚠ IT QUOTES NO FIGURE, so it can never go stale against one — the discipline the dues ladder
   * follows in its columns. The amounts are one tap away on the Actual figure, where they add up.
   *
   * ⚠ IT NAMES THE COLUMN, not just the row. The Budgeted side is the instalment schedule and this
   * says nothing about it; "the Player dues actual" is the whole of what the sentence covers.
   *
   * ⚠⚠ "STILL credited" AND "THEIR OWN cash" — the same two scoping words the Months view's
   * `two-truths` note carries, for the reason argued there (review, 2026-09-10). "Less money handed
   * back" on its own reads as every cheque in the Money returned band, and only the family's own
   * money is subtracted here; the rest is already absent from a credit figure that counts what is
   * still standing. Two halves of one explanation, one vocabulary.
   */
  if (input.duesNonCash) {
    out.push(note('dues-actual', [
      { text: 'The ' },
      { text: 'Player dues', bold: true },
      { text: ' actual includes team bills families paid and fundraising still credited to dues, less their own cash handed back.' },
    ]));
  }

  /**
   * WHAT CAME OFF THE DUES PLAN (owner ruling 2026-09-09 — "a bill lowered is not a collection").
   *
   * ⚠⚠ IT SAYS **PLAN**, AND THE WORD IS THE POINT. Before the ruling this report planned to
   * receive money a coach had already written off, so the variance reported a shortfall the coach
   * themselves had cancelled — a $500 bill forgiven left the season reading $500 behind for the
   * rest of the year. The plan is now the bill as it stands, and this sentence says so.
   *
   * ⚠ IT NAMES WHICHEVER KINDS ARE THERE, and stays away entirely when there are neither — the
   * same rule the dues band's own caption follows, so the two surfaces never describe one season
   * differently. The caller decides the wording; this decides where it sits.
   */
  if (input.duesPlanWrittenOff) {
    out.push(note('dues-plan-written-off', [
      { text: 'The ' },
      { text: 'Player dues', bold: true },
      { text: ' plan is after ' },
      { text: input.duesPlanWrittenOff, bold: true },
      { text: ' — bills lowered with no money behind them.' },
    ]));
  }

  /**
   * HOW MUCH PLAN HAS NO DATE (owner ruling 2026-09-04, QA §132).
   *
   * ⚠⚠ THE VERB IS THE WHOLE DIFFERENCE, and only one of these is honest per basis. Whole season
   * COUNTS undated money in full, so there it is present-but-unplaceable and the sentence says
   * where it sits. Only To date can EXCLUDE it, so only there is "not compared" true — saying it
   * under Whole season would tell a coach their money had been left out of a total it is actually
   * inside. This was a real defect in the first mockup and the owner caught it.
   *
   * ⚠ THE FIGURE IS UNDATED MONEY ONLY — never money dated AFTER today. That is excluded from a
   * to-date reading too, but correctly so: it is the basis working, not a gap, and naming it here
   * would send a coach off to date money that is already dated.
   */
  if (input.undatedPlan) {
    out.push(note('undated-plan', [
      { text: input.undatedPlan, bold: true },
      { text: ' of this plan — money in and money out — has no date' },
      ...(input.basis === 'todate'
        ? [
          { text: ', so it is ' },
          { text: 'not compared here', bold: true },
          { text: '. Give it a month to include it.' },
        ]
        : [{ text: ' on it, so it sits in the season total but in no month.' }]),
      { text: ' ', screenOnly: true },
      { text: 'See it in the months view', control: 'months-view' as const, screenOnly: true },
    ]));
  }

  return out;
}

/**
 * WHAT THE PLAN NEEDS FROM FAMILIES, WHAT DUES BILL, AND WHICH WAY THE GAP RUNS (owner ruling
 * 2026-09-04). Approved wording, verbatim, in all four states.
 *
 * ⚠ It is prose in the footnote voice — **no colour in any state** — because on this report colour
 * belongs to the variance column, and a sentence painted green or red would be a second verdict
 * competing with the figures it explains.
 *
 * ⚠ "BUFFER" AND "SHORT" ARE NOT COINED HERE. The Budget plan page already closes with exactly
 * this pair (*Planned buffer* / *Short of covering the plan*), so the two screens that both answer
 * "do dues cover the plan?" answer it in one vocabulary. Do not invent a third set.
 *
 * ⚠⚠ THE IDENTITY THIS SENTENCE CLAIMS IS TRUE ONLY ON THE WHOLE-SEASON BASIS. "The gap IS the
 * budgeted Season net above" holds because, with D = dues billed, F = other income and E = the
 * plan, (E − F) − D is exactly −((D + F) − E). Every one of those is a WHOLE-SEASON figure. Under
 * **To date** the closing row is revenue-to-date less expenses-to-date — a different quantity with
 * a different name — so the claim stops being true and the sentence must stop making it.
 *
 * ⚠⚠ THE BASIS CLAUSE MOVES WITH THE BASIS. It shipped on 2026-09-04 as an APOLOGY, written
 * deliberately as the honest half of a fix that did not exist yet. It does now, so under **Whole
 * season** the apology becomes a DOOR, and under **To date** it is DELETED, not reworded — there
 * the plan column is no longer a whole season's, so the sentence is simply false.
 *
 * ⚠ In a FILE the fact survives and the door does not: an export keeps "Both columns compare a
 * whole season's plan against what has moved so far" and drops the tap that follows it.
 */
function duesNote(basis: CompareBasis, dues: NonNullable<StatementNoteInput['dues']>, canWrite: boolean): ReportNote {
  /** One clause, so the three sentences that carry it cannot drift apart. */
  const basisClause: NoteSegment[] = basis === 'todate' ? [] : [
    { text: ' Both columns compare a whole season’s plan against what has moved so far.' },
    { text: ' ', screenOnly: true },
    { text: 'Compare to date', control: 'compare-to-date' as const, screenOnly: true },
    { text: ' sets the plan against the same span.', screenOnly: true },
  ];
  const netRef = basis === 'todate' ? ' across the whole season.' : ' the budgeted Season net above.';

  const head: NoteSegment[] = [
    { text: 'This plan needs ' },
    { text: dues.planNeeds, bold: true },
    { text: ' from families and ' },
  ];

  if (dues.state === 'unset') {
    return note('dues', [
      ...head,
      { text: 'no dues are set yet' },
      {
        text: basis === 'todate'
          ? ', so the whole of that gap is still to come.'
          : ', which is the whole of the budgeted Season net above.',
      },
      ...(canWrite
        ? [
          { text: ' ', screenOnly: true },
          { text: 'Set player dues', control: 'set-dues' as const, screenOnly: true },
        ]
        : []),
    ]);
  }

  if (dues.state === 'covered') {
    return note('dues', [...head, { text: 'dues bill exactly that.' }, ...basisClause]);
  }

  const isShort = dues.state === 'short';
  return note('dues', [
    ...head,
    { text: 'dues bill ' },
    { text: dues.billed, bold: true },
    { text: ' — a ' },
    { text: dues.gap, bold: true },
    { text: isShort ? ' gap' : ' buffer above the plan' },
    {
      text: basis === 'todate'
        ? netRef
        : (isShort ? ` is${netRef}` : `, which is${netRef}`),
    },
    ...basisClause,
  ]);
}
