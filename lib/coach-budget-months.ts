/**
 * Money by Month (Coach Portal chunk H) — the month grid's arithmetic, with no IO.
 *
 * The Budget-vs-Actual route already buckets a monthly series for its cumulative chart. This
 * module is the same idea done honestly for a GRID, where every cell is read individually:
 *
 *  • Budget with NO date is NOT smeared across the months (what the chart used to do). It goes
 *    into an explicit "no date yet" bucket, because a coach reading a cell must never see money
 *    in a month they did not choose. (Owner decision D-H3, 2026-07-30.)
 *  • "Scheduled" (what the team has COMMITTED to pay, by due date) is a separate lens and never
 *    merges into the budget estimate — nothing double-counts and no payable↔line link is needed.
 *    (Owner ruling, 2026-07-30.)
 *  • "Difference" is only meaningful for months that have already happened; a future month with
 *    no spending is not a saving. The caller blanks those using `isElapsed`.
 *
 * The season has no stored start/end date (`rep_program_years` carries a year and a name only),
 * so the month range is DERIVED from the team's own dated money — see `deriveMonthRange`.
 *
 * ⚠⚠ CATEGORY IDENTITY IS NOT THIS MODULE's TO DECIDE (2026-08-17). It comes from
 * `coach-budget-rollup`'s `categoryKey`, which the statement uses — id first, name only as a
 * fallback. This module used to key by lowercased name alone, which is how Months and the statement
 * bucketed one report two ways; the header on that function has the two shapes it broke.
 */
/* ⚠ THE `.ts` EXTENSION IS LOAD-BEARING. Both modules are pure, and `scripts/check-demos.mjs` loads
   this one under plain Node — where an extensionless specifier does not resolve and the demo check
   dies with ERR_MODULE_NOT_FOUND rather than anything about money. Same reason the other pure
   `lib/coach-*` modules spell it out. */
import {
  categoryKey as categoryIdentity, displayCategoryName, NO_CATEGORY_LABEL,
} from './coach-budget-rollup.ts';
/* ⚠ TYPE-ONLY, and that is what keeps this module pure: the section NAMES are a shared vocabulary,
   the href builder is not imported and never should be (see `PanelDoor`). */
import type { CoachMoneySection } from './coach-money-links.ts';

/** A month key, always `YYYY-MM`. */
export type MonthKey = string;

/**
 * Where a drill-in files a record that has NO DATE — the "No date yet" column's own panel.
 *
 * ⚠ DELIBERATELY NOT A MONTH-KEY SHAPE. It shares one keyspace with real months (a cell's detail
 * list is addressed `<lens>|<category>|<when>`), so it has to be something `monthKeyOf` can never
 * return and no reader can mistake for a month — including `check:money-report`, which reads those
 * keys to find out what a fixture contains.
 */
export const UNDATED_CELL = 'no-date';

// ── the two bands (Option D, owner ruling 2026-08-23) ────────────────────────

/**
 * The REVENUE band's groups, in the order the screen shows them — the Statement's own vocabulary.
 *
 * ⚠ FIXED, NOT DERIVED FROM THE DATA. Revenue is grouped by WHERE THE MONEY CAME FROM, not by the
 * budget category a coach happened to file it under: a dues payment and a bottle drive are two
 * different answers to "how does this team fund itself", and filing them both under "Fundraising"
 * because a plan line says so would hide the distinction the band exists to draw.
 */
export const REVENUE_GROUPS = ['dues', 'fundraising', 'sponsorship', 'other', 'moneyback'] as const;
export type RevenueGroupKey = (typeof REVENUE_GROUPS)[number];

/**
 * A revenue group's identity, as the grid keys a category.
 *
 * ⚠ AN ID, NEVER A NAME. `categoryKey` keys on the id when there is one, and a group's LABEL
 * changes with the lens (a dues row reads "Player dues" under Actual and "Remaining dues
 * installments" under Scheduled) — keying on the words would make one group two rows the moment a
 * label moved.
 */
export const REVENUE_CATEGORY_PREFIX = 'revenue:';
export function revenueCategoryId(group: RevenueGroupKey): string {
  return `${REVENUE_CATEGORY_PREFIX}${group}`;
}
export function revenueGroupOf(categoryKeyOrId: string | null | undefined): RevenueGroupKey | null {
  // The grid returns `id:<categoryId>`; the route holds the bare id. Both answer here.
  const raw = (categoryKeyOrId ?? '').replace(/^id:/, '');
  if (!raw.startsWith(REVENUE_CATEGORY_PREFIX)) return null;
  const key = raw.slice(REVENUE_CATEGORY_PREFIX.length) as RevenueGroupKey;
  return REVENUE_GROUPS.includes(key) ? key : null;
}

/**
 * Money handed BACK to a family (mig 234) — its own group at the foot of the EXPENSES band.
 *
 * ⚠ NOT A BUDGET CATEGORY, and it never becomes one. A payout is not a cost the team planned; it is
 * the team returning money it holds. It has no plan and no schedule, so it only ever carries an
 * Actual figure — which is why it arrives as an event with this synthetic placement rather than
 * being filed against the taxonomy like a bill.
 */
export const PAYOUT_CATEGORY_ID = 'cash:payouts';
export const PAYOUT_CATEGORY_NAME = 'Paid back to families';

/**
 * Is this expense row the SYNTHETIC payouts group rather than a real budget category?
 *
 * ⚠⚠ IT IS THE ONE EXPENSE ROW ALLOWED TO DISAPPEAR (design pass 2026-08-24, owner-approved), and
 * the distinction is worth stating because the standing rule runs the other way. A category the
 * coach BUDGETED for stays visible on every lens even when empty — "you planned it and haven't
 * spent it" is real information, and hiding it would hide the plan. This group has no plan and no
 * schedule and never can, so its dashes under Budget and Scheduled say nothing at all; they are two
 * lenses' worth of noise in the band a treasurer reads most closely.
 */
export function isPayoutCategory(categoryKeyOrId: string | null | undefined): boolean {
  return (categoryKeyOrId ?? '').replace(/^id:/, '') === PAYOUT_CATEGORY_ID;
}

/**
 * What a revenue group is CALLED under the lens on screen.
 *
 * ⚠⚠ A GROUP IS RENAMED ONLY WHERE THE FORWARD VIEW IS A DIFFERENT OBJECT (owner ruling
 * 2026-08-24, narrowing the 2026-08-23 rule that let every label move with the lens).
 *
 * The first version renamed on principle — "Player dues" became "Remaining dues instalments" under
 * Scheduled — and the owner rejected it on sight: a dues instalment still to come IS player dues,
 * so the rename made one thing look like two as you flip lenses, and spent ~90px of the narrowest
 * column saying what the lens already says. What survives is the case the rule was really for: a
 * request the club has not answered is genuinely NOT money back, so it keeps its own name.
 */
export function revenueGroupLabel(group: RevenueGroupKey, lens: MoneyLens): string {
  /* ⚠⚠ EXACTLY ONE GROUP IS RENAMED BY A LENS, AND IT IS THE ONLY ONE THAT CHANGES WHAT IT IS.
     Player dues and Sponsorships keep their names everywhere (owner rulings 2026-08-24): an unpaid
     instalment is still dues and an unhonoured pledge is still sponsorship — the same object, read
     forward — so renaming them made one thing look like two as a coach flipped lenses, and spent
     the narrowest column in the table saying what the lens already says.

     A request the club has NOT ANSWERED is the genuine exception: it is not money back, it is a
     question. That is what earns it a name of its own. */
  if (lens === 'scheduled' && group === 'moneyback') {
    /* ⚠ TRIMMED FROM "Asked of the club — awaiting answer" (owner, 2026-08-24) — the trailing
       clause repeated what the lens means: everything on Scheduled is awaiting something. */
    return 'Asked of the club';
  }
  switch (group) {
    case 'dues':        return 'Player dues';
    case 'fundraising': return 'Fundraising';
    case 'sponsorship': return 'Sponsorships';
    case 'other':       return 'Other income';
    case 'moneyback':   return 'Money back & reimbursements';
  }
}

/**
 * The label on a band's total row, which takes the lens's own adjective.
 *
 * ⚠ ONE DEFINITION FOR THE SCREEN AND THE FILE. The export writes these rows into a spreadsheet
 * that outlives the session, and "Total expenses" on screen against "Scheduled expenses" in the
 * download is the kind of drift nobody notices until a treasurer asks which one is the season.
 */
export function bandTotalLabel(band: MoneyRowDirection, lens: MoneyLens): string {
  const noun = band === 'in' ? 'revenue' : 'expenses';
  const adjective = lens === 'budget' ? 'Budgeted' : lens === 'scheduled' ? 'Scheduled' : 'Total';
  return `${adjective} ${noun}`;
}

// ── what opens behind a figure (owner ruling 2026-08-24, from the drawings) ───

/**
 * A door out of a drill-in panel.
 *
 * ⚠ THE SECTION, NEVER THE HREF. This module is pure and framework-free (`check:demos` loads it
 * under plain Node); `moneySectionHref` needs the team's base path, which only a rendering surface
 * has. The caller turns these into links — the RULE about which doors a panel offers lives here,
 * once, so the grid and anything that follows it cannot answer differently.
 */
export interface PanelDoor {
  section: CoachMoneySection;
  extra?: Record<string, string>;
  label: string;
}

export interface CellPanelSpec {
  /**
   * The word over the panel's own sum.
   *
   * ⚠⚠ "Possible" IS NOT A SYNONYM FOR "Total" (owner ruling 2026-08-24). A pledge and a request
   * the club has not answered add up to money NOBODY HAS AGREED TO SEND — and one word is what
   * stops a coach banking it. "Total raised" and "Still to come" are the same rule applied twice
   * more: the panel says what kind of money it just added up.
   */
  totalLabel: string;
  /**
   * ⚠⚠ AT MOST TWO: the ledger, and the thing itself. Transactions is the book of record; the
   * second door is the drive, the sponsor, the family, the club. A panel with five doors is a menu,
   * not an answer. ⚠ SOME ROWS EARN ONLY ONE, and the asymmetry is meaningful rather than an
   * omission — a typed arrival and a refund a coach recorded have no "thing itself" behind them.
   */
  doors: PanelDoor[];
}

/* ⚖ One Ledger since the fold (2026-08-28): the book door lands on the Timeline view, the
   schedule door (below) on By due date — both stated explicitly so the panel's per-device view
   memory can never re-aim a link. */
const TRANSACTIONS_DOOR: PanelDoor = { section: 'ledger', extra: { view: 'timeline' }, label: 'Open the Ledger' };
const DUES_DOOR: PanelDoor = { section: 'dues', label: 'Open Player Dues' };
const CLUB_DOOR: PanelDoor = { section: 'club', label: 'Open Club' };
const SPONSORS_DOOR: PanelDoor = { section: 'fundraisers', extra: { kind: 'sponsor' }, label: 'Open Sponsors' };
const FUNDRAISERS_DOOR: PanelDoor = { section: 'fundraisers', extra: { kind: 'fundraiser' }, label: 'Open Fundraisers' };

/** The drive or sponsor itself, when the panel is about ONE of them; else that hub. */
function subjectDoor(subject: PanelSubject | null, hub: PanelDoor): PanelDoor {
  return subject?.id
    ? { section: 'fundraisers', extra: { fundraiser: subject.id }, label: `Open ${subject.name}` }
    : hub;
}

/** Which family / drive / sponsor / filing a panel is about, or null for a whole group's month. */
export interface PanelSubject { id: string | null; name: string }

/**
 * What a drill-in panel says over its sum, and where it lets a coach out.
 *
 * ⚠⚠ ONE RULE, NINE ROWS (owner ruling 2026-08-24, drawn in artifact `da5d08b9`). The chevron opens
 * where the money came from; the NUMBER opens what makes it up — individual records, dated, always
 * READ-ONLY. The grid reaches the forms; it never becomes a second place to edit, which is why no
 * door here is a "Record a payment".
 *
 * ⚠ THE EXPENSE BAND'S OWN TWO ANSWERS LIVE HERE TOO, and they used to be written inline at the one
 * call site. They are the same decision — which book does this figure belong to — and keeping them
 * apart is how the revenue half and the expense half would drift into two vocabularies.
 */
export function cellPanelSpec(
  row: { group: RevenueGroupKey | null; payout?: boolean },
  lens: 'actual' | 'scheduled',
  subject: PanelSubject | null,
): CellPanelSpec {
  if (row.group === null) {
    /* ⚠ MONEY PAID BACK TO A FAMILY IS AN EXPENSE THAT ANSWERS TO DUES. Dues says who is owed; this
       says who was repaid; Transactions is the book both settle into. */
    if (row.payout) return { totalLabel: 'Total', doors: [DUES_DOOR, TRANSACTIONS_DOOR] };
    return lens === 'actual'
      ? { totalLabel: 'Total', doors: [TRANSACTIONS_DOOR] }
      /* ⚠ THE TWO LENSES LAND ON DIFFERENT VIEWS of the one Ledger (fold, 2026-08-28 — they were
         different TABS from the 2026-08-16 split until then), which is what the grid was always
         describing: an Actual cell is money that moved (Timeline), a Scheduled cell is money still
         owed (the payment schedule, By due date). */
      : { totalLabel: 'Total', doors: [{ section: 'ledger', extra: { view: 'due' }, label: 'Open the payment schedule' }] };
  }
  if (lens === 'scheduled') {
    switch (row.group) {
      case 'dues':        return { totalLabel: 'Still to come', doors: [DUES_DOOR] };
      case 'sponsorship': return { totalLabel: 'Possible', doors: [SPONSORS_DOOR] };
      case 'moneyback':   return { totalLabel: 'Possible', doors: [CLUB_DOOR] };
      /* Neither a drive nor typed income has a forward record, so neither row exists on this lens —
         but a spec is returned rather than null, because a caller that renders one anyway must get
         an honest panel instead of a crash. */
      default:            return { totalLabel: 'Possible', doors: [TRANSACTIONS_DOOR] };
    }
  }
  switch (row.group) {
    case 'dues':
      return { totalLabel: 'Total', doors: [DUES_DOOR, TRANSACTIONS_DOOR] };
    case 'fundraising':
      /* ⚠ "Here is the ledger entry" and "here is the thing that earned it" are different answers,
         and a coach chasing a drive wants the second. */
      return { totalLabel: 'Total raised', doors: [subjectDoor(subject, FUNDRAISERS_DOOR), TRANSACTIONS_DOOR] };
    case 'sponsorship':
      return { totalLabel: 'Total', doors: [subjectDoor(subject, SPONSORS_DOOR), TRANSACTIONS_DOOR] };
    case 'other':
      /* ⚠ ONE DOOR. There is no "thing itself" to open — the RECORD is the thing. */
      return { totalLabel: 'Total', doors: [TRANSACTIONS_DOOR] };
    case 'moneyback':
      /* ⚠ CLUB MONEY HAS A CLUB SCREEN; A REFUND YOU TYPED IN DOES NOT. Same group, two sources,
         two different numbers of doors — see `MONEY_BACK_CLUB` in lib/coach-cash-strip.ts. */
      return subject?.id === 'moneyback:club'
        ? { totalLabel: 'Total', doors: [CLUB_DOOR, TRANSACTIONS_DOOR] }
        : { totalLabel: 'Total', doors: [TRANSACTIONS_DOOR] };
  }
}

/** Two strings that say the same thing, however the coach happened to capitalise it. */
function sameWords(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * Which words a drill-in row leads with, and which follow on its meta line.
 *
 * ⚠⚠ ONE RULE: NOTHING ON A ROW RESTATES WHAT THE READER CAN ALREADY SEE. The panel's title has
 * just named either the group ("Player dues") or the row ("Gate / admission"), and a record that
 * repeats it fills the screen with an answer to a question nobody asked.
 *
 * ⚠ IT HAS BEEN WRONG TWICE, WHICH IS WHY IT LIVES HERE RATHER THAN INSIDE THE GRID. First the
 * record's KIND echoed the group — thirteen families arrived as thirteen lines reading "Dues
 * payment". Then the coach's OWN words echoed the row — an arrival filed under "Gate / admission"
 * and described as "Gate / admission" printed the phrase twice, once in the title and once beneath
 * it. Both are the same rule applied to a different word, and both were found by a person looking
 * at a screen, because a helper inside a component is one nothing can assert against.
 *
 * ⚠ ONLY ONE GROUP CAN ECHO ITS ROW, and it is worth knowing which: dues, drives and sponsors have
 * PEOPLE and DRIVES for rows, so a record's words cannot coincide with them. Other income's rows
 * are budget ITEMS — and a coach with nothing more to say than the item's own name is the ordinary
 * case there, not the edge.
 */
export function panelRowWords(
  record: { description?: string | null; kind?: string | null },
  opts: { subject?: string; group: boolean },
): { lead: string; words: string } {
  const own = record.description?.trim() ?? '';
  const words = opts.subject && sameWords(own, opts.subject) ? '' : own;
  /* A ROW's panel is already titled with its subject, so the record's own words lead — falling back
     to its kind when it has none, or when they only echoed the title. A record whose subject has no
     row of its own (money nobody could attribute) lands here too rather than leading with a blank. */
  if (!opts.group) return { lead: words || record.kind?.trim() || '', words: '' };
  /* A GROUP's panel leads with the ROW and never prints the kind — the title already said it. */
  return { lead: opts.subject ?? own, words };
}

export interface DatedAmount {
  /** `YYYY-MM-DD`, or null when the amount carries no date (→ the "no date yet" bucket). */
  date: string | null;
  amount: number;
}

/**
 * One budget line standing behind a grid row, so the row can send a coach to the right editor.
 *
 * ⚠⚠ THE ROW IS AN ITEM, NOT A LINE, AND THAT IS WHY THIS EXISTS (owner-approved fix, 2026-08-17).
 * A grid row's own `id` stopped being a budget line id on 2026-08-15, when the rows began coming from
 * the report rollup so that Months and the statement could not group one plan two different ways. Two
 * budget lines on one item are ONE row by owner ruling — so the row has no single line to address, and
 * the "Edit this line's payment dates" link went on handing the composite row id to the budget page,
 * which looked for a line, found none, and returned **silently**. Two affordances were dead for two
 * days: that link and, worse, the "No date yet" cell, which is the grid's only route out of undated
 * budget.
 *
 * The rule: **the link addresses the ITEM and the item answers for its lines.** One line behind the
 * row → open that line's dates. Two or more → ask which. Never guess (a coach would silently edit a
 * line they were not looking at), and never withdraw the control (that would strand exactly the teams
 * whose plans are most complex).
 */
export interface GridPlanLine {
  /* ⚠ THE TABLE THIS ID BELONGS TO IS DELIBERATELY NOT NAMED HERE. `budget-line-kind-guard` scans for
     modules that read the budget-lines table without accounting for a line's KIND, and it flagged this
     file for the mention alone. Naming it and taking an exemption would have switched that guard off
     for this module permanently — including for a future edit that really did read the table. This
     module receives already-partitioned rows and never queries anything, so the honest fix was to stop
     saying the table's name. */
  /** The real budget-line id — what the budget page's deep link resolves against the plan. */
  id: string;
  /** The line's own typed description, which is how a coach tells two lines on one item apart. */
  description: string;
  amount: number;
  /** The dates it is currently split across. Empty = undated, which is worth saying out loud. */
  dates: string[];
}

export interface GridLine {
  id: string;
  description: string;
  categoryName: string;
  /** The category's real identity, when it has one. Absent = keyed by name (see the module header). */
  categoryId?: string | null;
  /** The budget lines this row stands for — see `GridPlanLine`. Absent on a spend-only row. */
  planLines?: GridPlanLine[];
  /** Taxonomy item link, when the line has one. THE KEY MONEY IS FILED UNDER: spending carries
   *  the same item, which is how a row gets its own figures rather than a dash. */
  itemId: string | null;
  totalAmount: number;
  /**
   * Is this row actually IN the plan? (mig 240.)
   *
   * ⚠ IT EXISTS BECAUSE THE ROWS STOPPED BEING BUDGET LINES. The grid used to be fed raw budget
   * lines, so a category with no line simply never appeared and `unplanned` could be read off the
   * map. It is now fed the report rollup, which emits a zero-budget row for every item the team
   * SPENT on — so every spending category has a row and the map can no longer tell the two apart.
   * Absent reads as true, which keeps every pre-240 caller honest.
   */
  inPlan?: boolean;
  /** Dated splits of `totalAmount`. Empty = the whole total is undated. */
  periods: DatedAmount[];
}

/** A paid expense or a commitment, already reduced to (category, date, amount). */
export interface CategoryEvent {
  categoryName: string | null;
  /** As on `GridLine` — the identity the statement grouped this money by, when it has one. */
  categoryId?: string | null;
  /**
   * ⚠⚠ WHICH ITEM THIS MONEY IS FOR (2026-08-21, owner-found). Without it the grid could only ever
   * put spending on a CATEGORY, so every item row showed a dash in its money columns — reading as
   * "no money here" on the very row the money belonged to, while the Statement view of the same
   * report itemised it correctly.
   *
   * ⚠ The join was always available and simply was not carried: every cost names an item (required
   * on the form and re-enforced by the server), and every grid row IS an item and already knows its
   * id. A stale comment claiming there was no such link outlived the migration that created it.
   *
   * Absent/null means genuinely unattributed — only reachable on rows predating the item
   * requirement — and lands in the category’s own bucket rather than being dropped.
   */
  itemId?: string | null;
  date: string | null;
  amount: number;
}

export interface MonthCell {
  budget: number;
  scheduled: number;
  actual: number;
}

export interface GridLineResult {
  id: string;
  description: string;
  /**
   * The taxonomy item — or, on a revenue group and the payouts group, the SUBJECT (the family, the
   * drive, the sponsor, the request) this row stands for.
   *
   * ⚠ CARRIED RATHER THAN PARSED BACK OUT OF `id`. The row id is `<categoryKey>|<itemId>` and a
   * category name may legitimately contain a pipe, so every reader that wanted the item was one
   * split-from-the-wrong-end away from a silent mismatch. The drill-in behind a cell needs it (a
   * drive's panel opens THAT drive), which is what made a second reader exist at all.
   */
  itemId: string | null;
  /** Carried straight through so a cell can address a real budget line — see `GridPlanLine`. */
  planLines: GridPlanLine[];
  /** Per-month cells, index-aligned with `months`. */
  cells: MonthCell[];
  /**
   * The "no date yet" bucket, under every lens.
   *
   * ⚠⚠ IT USED TO BE `undatedBudget: number`, AND WIDENING IT IS THE OPTION D FORWARD VIEW
   * (owner ruling 2026-08-23). Undated money was plan money and nothing else, so one figure said
   * it all — but a sponsor PLEDGE and a club request awaiting an answer have no date either, and
   * the Scheduled lens now carries both. They belong in the Total and in no month, which is
   * exactly what this bucket has always meant; there was simply no field to put them in.
   */
  undated: MonthCell;
  /** Row totals, for the trailing Total column. */
  total: MonthCell;
}

export interface GridCategoryResult {
  categoryName: string;
  /** Lowercased/trimmed name — the same key the actuals join on, and the key a drill-in uses to
   *  find a cell's detail list. Returned rather than re-derived on the client so the two can't
   *  drift apart. */
  categoryKey: string;
  cells: MonthCell[];
  /** As on the row — the bucket for money in the Total and in no month. */
  undated: MonthCell;
  total: MonthCell;
  lines: GridLineResult[];
  /** True when this category exists only because something is scheduled or paid against it —
   *  the coach has no budget line for it at all. Worth seeing, never worth hiding. */
  unplanned: boolean;
}

export interface MonthGrid {
  months: MonthKey[];
  /** True when the derived range was longer than the column cap and had to be cut. */
  truncated: boolean;
  categories: GridCategoryResult[];
  totals: {
    cells: MonthCell[];
    undated: MonthCell;
    total: MonthCell;
  };
}

// ── month key helpers ────────────────────────────────────────────────────────

/** `YYYY-MM-DD` (or an ISO timestamp) → `YYYY-MM`. Pure string work: no Date, no timezone. */
export function monthKeyOf(date: string | null | undefined): MonthKey | null {
  if (!date || date.length < 7) return null;
  const key = date.slice(0, 7);
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(key) ? key : null;
}

export function addMonths(key: MonthKey, n: number): MonthKey {
  const year = Number(key.slice(0, 4));
  const month = Number(key.slice(5, 7));
  const total = year * 12 + (month - 1) + n;
  const y = Math.floor(total / 12);
  const m = total % 12;
  return `${String(y).padStart(4, '0')}-${String(m + 1).padStart(2, '0')}`;
}

/** Inclusive month count between two keys (`monthSpan('2026-03','2026-03') === 1`). */
export function monthSpan(from: MonthKey, to: MonthKey): number {
  const a = Number(from.slice(0, 4)) * 12 + Number(from.slice(5, 7));
  const b = Number(to.slice(0, 4)) * 12 + Number(to.slice(5, 7));
  return b - a + 1;
}

export const MIN_MONTH_COLUMNS = 6;
export const MAX_MONTH_COLUMNS = 24;

/**
 * The columns of the grid.
 *
 * Contiguous by design — a spreadsheet has no gaps, and a month with nothing in it is itself
 * information ("we pay nothing in June"). Derived from every dated money event the team has,
 * because the season stores no date span. A team with no dated money at all still gets a usable
 * window anchored on today so the grid is never a single column.
 */
export function deriveMonthRange(
  dates: Array<string | null | undefined>,
  todayMonth: MonthKey,
  opts: { min?: number; max?: number } = {},
): { months: MonthKey[]; truncated: boolean } {
  const min = opts.min ?? MIN_MONTH_COLUMNS;
  const max = opts.max ?? MAX_MONTH_COLUMNS;

  const keys = dates
    .map(monthKeyOf)
    .filter((k): k is MonthKey => k !== null)
    .sort();

  let first = keys[0] ?? todayMonth;
  let last = keys[keys.length - 1] ?? todayMonth;

  // Degenerate range — nothing dated, or everything dated in one month — gets a readable window
  // so a new plan is never a one-column grid. Extended FORWARD, because a budget's future is the
  // part a coach can still act on. A team with a genuine range keeps exactly that range: padding a
  // real five-month season out to six would invent a column nothing lives in.
  if (first === last) last = addMonths(first, min - 1);

  // A season in progress should show the month the coach is standing in, even when nothing is
  // dated there — otherwise "this month" is missing from the treasurer's own view.
  if (todayMonth < first) first = todayMonth;
  if (todayMonth > last) last = todayMonth;

  let truncated = false;
  if (monthSpan(first, last) > max) {
    last = addMonths(first, max - 1);
    truncated = true;
  }

  const months: MonthKey[] = [];
  for (let m = first; m <= last; m = addMonths(m, 1)) months.push(m);
  return { months, truncated };
}

// ── bucketing ────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** The shared identity, applied to whatever a line or an event happens to carry. */
function categoryKey(what: { categoryId?: string | null; categoryName: string | null | undefined }): string {
  return categoryIdentity(what.categoryId ?? null, what.categoryName ?? null);
}

function blankCells(count: number): MonthCell[] {
  return Array.from({ length: count }, () => ({ budget: 0, scheduled: 0, actual: 0 }));
}

function addCell(target: MonthCell, source: MonthCell): void {
  target.budget = round2(target.budget + source.budget);
  target.scheduled = round2(target.scheduled + source.scheduled);
  target.actual = round2(target.actual + source.actual);
}

export function buildMonthGrid(input: {
  lines: GridLine[];
  /** Paid amounts, by the date they were paid. */
  actuals: CategoryEvent[];
  /** Commitments, by the date they fall due (paid or not — a commitment is scheduled either way). */
  scheduled: CategoryEvent[];
  /**
   * BUDGET that arrives as dated events rather than as a line's periods (Option D, 2026-08-23).
   *
   * ⚠⚠ A PLAN IS NOT ALWAYS A BUDGET LINE, and the REVENUE band is the proof. What a season plans
   * to collect in dues is its dues INSTALMENT SCHEDULE — real dated amounts a coach set on the
   * Player Dues tab, never a row in the budget planner. Feeding it through the same `place()` that
   * files spending is what lets one band builder serve both sides; the alternative was a second
   * bucketing pass for revenue, which is the "parallel copy" this module exists not to have.
   *
   * ⚠ A CATEGORY IS FED ONE WAY OR THE OTHER, NEVER BOTH. Expense categories carry their plan on
   * their lines' periods; revenue groups have no lines and carry it here. Mixing them on one row
   * would double the plan, so the totals below deliberately read the CELLS rather than
   * `line.totalAmount`, which makes both paths add up identically.
   */
  budgets?: CategoryEvent[];
  todayMonth: MonthKey;
  maxMonths?: number;
  /**
   * The column domain, when the CALLER owns it (Option D: the revenue and expense bands are two
   * calls that must line up column for column, so the months are derived once over both bands'
   * dates and handed to each).
   *
   * ⚠ DERIVE IT WITH `deriveMonthRange` — passing an arbitrary list here is how a band ends up
   * with columns its sibling does not have, and every cell after the first mismatch reads the
   * wrong month.
   */
  months?: MonthKey[];
  /** Paired with `months`: whether that derivation had to cut the range. */
  truncated?: boolean;
  /**
   * ESTIMATE dollars not yet covered by any line (`rep_program_years.budget_amount` above the
   * itemized sum). The category view already shows this as a "Not itemized yet" row; the month
   * grid must too, or the same page would report two different budget totals. It has no date by
   * definition, so it lands in the "no date yet" column. Positive only — an estimate BELOW the
   * lines has nothing unallocated to stand in for, and a negative row here would read as a refund.
   */
  bufferAmount?: number;
  /* ⚠⚠ `cashDates` LIVED HERE AND IS GONE (Option D, 2026-08-23). It existed so the grid would grow
     a column for a month where only cash moved (owner ruling, Exhibit C) back when this function
     derived its own month range and the route had no say. Option D made the CALLER derive the range
     once over both bands and hand it to each — so the route feeds cash days straight into
     `deriveMonthRange` and this parameter had no production reader left, only a unit test keeping an
     unreachable branch alive. **The ruling is unchanged and still enforced**: `deriveMonthRange` is
     tested directly, and `check:money-report` fails out loud if cash moved in a month the grid grew
     no column for. */
}): MonthGrid {
  const { lines, actuals, scheduled, todayMonth } = input;
  const budgets = input.budgets ?? [];
  const bufferAmount = round2(input.bufferAmount ?? 0);

  const { months, truncated } = input.months
    ? { months: input.months, truncated: input.truncated ?? false }
    : deriveMonthRange(
      [
        ...lines.flatMap(l => l.periods.map(p => p.date)),
        ...actuals.map(a => a.date),
        ...scheduled.map(s => s.date),
        ...budgets.map(b => b.date),
      ],
      todayMonth,
      { max: input.maxMonths ?? MAX_MONTH_COLUMNS },
    );
  const monthIndex = new Map(months.map((m, i) => [m, i]));

  // ── categories from the budget plan ──────────────────────────────────────
  const catOrder: string[] = [];
  const catLines = new Map<string, GridLine[]>();
  const catDisplay = new Map<string, string>();
  for (const line of lines) {
    const key = categoryKey(line);
    if (!catLines.has(key)) {
      catLines.set(key, []);
      catOrder.push(key);
      catDisplay.set(key, displayCategoryName(line.categoryName));
    }
    catLines.get(key)!.push(line);
  }

  // ── money events, bucketed to (category, month) ──────────────────────────
  const eventCells = new Map<string, MonthCell[]>();
  /* ⚠ ONE MAP, THREE FIELDS. It was two maps keyed by field (`undatedActual`, `undatedScheduled`)
     until budget could arrive as an event too; a third parallel map would have been three places to
     remember on every read, and the category roll-up below already had to walk both. */
  const undatedEvents = new Map<string, MonthCell>();

  function cellsFor(key: string): MonthCell[] {
    let c = eventCells.get(key);
    if (!c) { c = blankCells(months.length); eventCells.set(key, c); }
    return c;
  }
  function undatedFor(key: string): MonthCell {
    let c = undatedEvents.get(key);
    if (!c) { c = { budget: 0, scheduled: 0, actual: 0 }; undatedEvents.set(key, c); }
    return c;
  }

  /* ⚠⚠ MONEY IS KEYED BY CATEGORY *AND* ITEM, and the shape matches `GridLine.id` exactly so a
     movement lands on the row it belongs to. Keyed by category alone, every item row showed a dash
     while its category carried the total (owner-found 2026-08-21). `no-item` is the same fallback
     the row ids use, so unattributed money still has somewhere honest to sit. */
  const eventKey = (e: CategoryEvent) => `${categoryKey(e)}|${e.itemId ?? 'no-item'}`;

  /* ⚠ SPLIT FROM THE RIGHT. A category key can be `name:<the name>` and a category name may
     legitimately contain a pipe; the item suffix never can (a uuid, or the literal `no-item`),
     so the LAST separator is the only safe one to cut on. */
  const catOf = (rowKey: string) => rowKey.slice(0, rowKey.lastIndexOf('|'));

  /* ⚠ THE ROW’S MONEY KEY IS BUILT FROM WHAT THE ROW *IS*, never from `line.id`. The caller’s id
     happens to be the same shape today, and depending on that would be a silent coupling: a caller
     numbering its rows differently would get money that lands nowhere, with no error. */
  const lineKey = (l: { categoryId?: string | null; categoryName: string | null; itemId: string | null }) =>
    `${categoryKey(l)}|${l.itemId ?? 'no-item'}`;

  function place(events: CategoryEvent[], field: keyof MonthCell) {
    for (const e of events) {
      if (!e.amount) continue;
      const key = eventKey(e);
      const m = monthKeyOf(e.date);
      const i = m != null ? monthIndex.get(m) : undefined;
      if (i === undefined) {
        // Outside the window (only possible when the range was truncated) or genuinely undated —
        // never silently dropped, never smeared.
        const undated = undatedFor(key);
        undated[field] = round2(undated[field] + e.amount);
        continue;
      }
      const cells = cellsFor(key);
      cells[i][field] = round2(cells[i][field] + e.amount);
    }
  }
  place(actuals, 'actual');
  place(scheduled, 'scheduled');
  place(budgets, 'budget');

  // A category the team spends or owes on but has never budgeted still gets a row.
  const unplannedKeys: string[] = [];
  // ⚠ The maps are keyed by row (category|item) now, so the CATEGORY has to be read back out —
  // comparing a row key against `catLines` would never match and every category would look new.
  for (const rowKey of [...eventCells.keys(), ...undatedEvents.keys()]) {
    const key = catOf(rowKey);
    if (catLines.has(key) || unplannedKeys.includes(key)) continue;
    unplannedKeys.push(key);
  }
  const eventDisplay = new Map<string, string>();
  for (const e of [...actuals, ...scheduled, ...budgets]) {
    const key = categoryKey(e);
    if (!eventDisplay.has(key)) eventDisplay.set(key, displayCategoryName(e.categoryName));
  }

  // ── assemble ─────────────────────────────────────────────────────────────
  const categories: GridCategoryResult[] = [];

  for (const key of [...catOrder, ...unplannedKeys]) {
    const ownLines = catLines.get(key) ?? [];
    // A category is unplanned when NOTHING in it is in the plan — not merely when it has no rows,
    // which stopped being the same question once spend-only rows started arriving (see GridLine).
    const unplanned = ownLines.length === 0 || ownLines.every(l => l.inPlan === false);

    /* ⚠ ONE ROW CLAIMS A KEY. Two rows in one category sharing an item (or both item-less) would
       otherwise each add the same money, and the category — the sum of its rows — would double it. */
    const claimed = new Set<string>();
    const lineResults: GridLineResult[] = ownLines.map(line => {
      const cells = blankCells(months.length);
      const undated: MonthCell = { budget: 0, scheduled: 0, actual: 0 };

      if (line.periods.length === 0) {
        undated.budget = round2(line.totalAmount);
      } else {
        let placed = 0;
        for (const p of line.periods) {
          const m = monthKeyOf(p.date);
          const i = m != null ? monthIndex.get(m) : undefined;
          if (i === undefined) { undated.budget = round2(undated.budget + p.amount); continue; }
          cells[i].budget = round2(cells[i].budget + p.amount);
          placed = round2(placed + p.amount);
        }
        // Periods are validated to sum to the line total (±$0.02) on write, but a line edited
        // after its periods were set can drift. Anything unaccounted for is undated, not lost.
        const remainder = round2(line.totalAmount - placed - undated.budget);
        if (remainder > 0.005) undated.budget = round2(undated.budget + remainder);
      }

      /* ⚠⚠ THE ROW'S OWN MONEY, which it never used to get (owner-found 2026-08-21). Spending was
         placed on the CATEGORY, so every item row showed a dash in its money columns — reading as
         "no money here" on the exact row the money belonged to, while the Statement view of the
         same report itemised it correctly. ⚠ Keyed by `lineKey(line)` — what the row IS —
         never by `line.id`; see the rule above `eventKey`. */
      const mine = claimed.has(lineKey(line)) ? null : lineKey(line);
      claimed.add(lineKey(line));
      const own = mine ? eventCells.get(mine) : undefined;
      if (own) for (let i = 0; i < months.length; i++) addCell(cells[i], own[i]);
      const ownUndated = mine ? undatedEvents.get(mine) : undefined;
      if (ownUndated) addCell(undated, ownUndated);

      /* ⚠⚠ THE TOTAL READS THE CELLS, NOT `line.totalAmount` (Option D, 2026-08-23). It is the same
         number — the loop above places the whole total, sending anything undated or off-window to
         the undated bucket — and reading it this way is what lets a row whose plan arrived as
         EVENTS (a revenue group's dues schedule) total correctly instead of reporting zero. */
      const sum = (field: keyof MonthCell) =>
        round2(cells.reduce((t, c) => t + c[field], 0) + undated[field]);
      const total: MonthCell = {
        // Undated money is in the total but in no column — the same shape the category uses.
        budget: sum('budget'), scheduled: sum('scheduled'), actual: sum('actual'),
      };
      return {
        id: line.id,
        description: line.description,
        itemId: line.itemId,
        planLines: line.planLines ?? [],
        cells,
        undated,
        total,
      };
    });

    /* ⚠⚠ THE CATEGORY IS NOW THE SUM OF ITS ROWS — which is what a reader always assumed it was.
       It used to carry the money itself while its rows showed dashes; the old comment here said
       there was no link from a cost to a row, and that was true when written and stopped being
       true when every cost started naming an item. Both sides have carried the key ever since.

       ⚠ ORPHANS STILL LAND SOMEWHERE. Money whose item has no row in this category (only
       reachable for costs predating the item requirement, which key as `no-item`) is added at
       the category level rather than dropped — so the grand total is unchanged either way. */
    const cells = blankCells(months.length);
    for (const lr of lineResults) {
      for (let i = 0; i < months.length; i++) addCell(cells[i], lr.cells[i]);
    }
    /* Every undated entry belonging to this category, whether or not it found a row — the rows'
       own buckets, plus anything orphaned. The cells above already hold all the DATED money, so
       these two together are the whole remainder. */
    const undated: MonthCell = { budget: 0, scheduled: 0, actual: 0 };
    for (const lr of lineResults) addCell(undated, lr.undated);

    const rowKeys = new Set(ownLines.map(lineKey));
    for (const [rowKey, ev] of eventCells) {
      if (catOf(rowKey) !== key || rowKeys.has(rowKey)) continue;
      for (let i = 0; i < months.length; i++) addCell(cells[i], ev[i]);
    }
    for (const [rowKey, u] of undatedEvents) {
      if (catOf(rowKey) !== key || rowKeys.has(rowKey)) continue;
      addCell(undated, u);
    }

    const total: MonthCell = {
      budget: round2(cells.reduce((s, c) => s + c.budget, 0) + undated.budget),
      scheduled: round2(cells.reduce((s, c) => s + c.scheduled, 0) + undated.scheduled),
      actual: round2(cells.reduce((s, c) => s + c.actual, 0) + undated.actual),
    };

    /* ⚠ BUDGET COUNTS AS SOMETHING TO SHOW. It could not before — an unplanned category is by
       definition one with no budget — but a REVENUE group carries its plan as events, so a group
       that is only ever budgeted (a sponsorship line with nothing raised yet) would have been
       dropped from the Budget lens it exists to appear on. */
    if (
      unplanned
      && total.budget === 0 && total.scheduled === 0 && total.actual === 0
    ) continue; // nothing to show

    categories.push({
      // ⚠ The last fallback is the statement's own word for a nameless category, not a second
      // spelling of it. "Uncategorized" here against "No category" there is how one bucket read as
      // two rows on one screen.
      categoryName: catDisplay.get(key) ?? eventDisplay.get(key) ?? NO_CATEGORY_LABEL,
      categoryKey: key,
      cells,
      undated,
      total,
      lines: lineResults,
      unplanned,
    });
  }

  if (bufferAmount > 0.005) {
    categories.push({
      categoryName: 'Not itemized yet',
      categoryKey: '__buffer__',
      cells: blankCells(months.length),
      undated: { budget: bufferAmount, scheduled: 0, actual: 0 },
      total: { budget: bufferAmount, scheduled: 0, actual: 0 },
      lines: [],
      unplanned: false,
    });
  }

  // ── grand totals ─────────────────────────────────────────────────────────
  const totalCells = blankCells(months.length);
  for (const c of categories) for (let i = 0; i < months.length; i++) addCell(totalCells[i], c.cells[i]);
  const grandTotal: MonthCell = { budget: 0, scheduled: 0, actual: 0 };
  const grandUndated: MonthCell = { budget: 0, scheduled: 0, actual: 0 };
  for (const c of categories) { addCell(grandTotal, c.total); addCell(grandUndated, c.undated); }

  return {
    months,
    truncated,
    categories,
    totals: {
      cells: totalCells,
      undated: grandUndated,
      total: grandTotal,
    },
  };
}

// ── cash flow ────────────────────────────────────────────────────────────────

export interface CashFlowRow {
  month: MonthKey;
  moneyIn: number;
  moneyOut: number;
  /** Revenue less expenses for this month alone — the "Net for the month" row. */
  net: number;
  /**
   * What this month STARTED with — the month before it closed on, or the season's own opening
   * balance in the first month (owner ruling 2026-08-26).
   *
   * ⚠⚠ IT IS THE PREVIOUS ROW'S `running` AND THAT REDUNDANCY IS THE POINT, priced and accepted.
   * The grid WINDOWS to twelve months: scroll to a later window and the closing figures are a
   * cumulative series whose origin is off screen, so a coach was asked to trust a running total
   * they could not check. With the opening stated per column, every window reads on its own and
   * `opening + net = closing` is verifiable in the month a coach is actually looking at.
   */
  opening: number;
  /** What it CLOSED on. Named `running` because every reader already speaks it; the screen calls
   *  it "Closing balance" now that an opening sits above it. */
  running: number;
}

export interface CashFlowResult {
  rows: CashFlowRow[];
  /** Where the running balance starts: a carried opening balance, or today's cash under Scheduled. */
  opening: number;
  /**
   * Money the lens knows about but cannot date — a sponsor pledge, a club request awaiting an
   * answer. It reaches the TOTAL and no month (owner ruling 2026-08-23, drawn): counted as
   * possible, never as arrived.
   */
  undated: { moneyIn: number; moneyOut: number; net: number };
  /** The season's own net — every month plus the undated bucket. The `Net for the month` Total. */
  net: number;
  /**
   * Where the balance ENDS: opening + net.
   *
   * ⚠⚠ THIS IS WHAT THE RUNNING BALANCE'S TOTAL CELL CARRIES (owner ruling 2026-08-23), where it
   * used to print an em dash on the reasoning that a running balance has no sum. True, and beside
   * the point: the figure a treasurer is looking for is where the balance ENDED, the Total column
   * is pinned, and so Cash on hand is now on screen whatever month you have scrolled to.
   */
  ending: number;
  /** The first month the running balance goes negative — the whole point of the strip. */
  shortfall: { month: MonthKey; amount: number } | null;
}

/**
 * The season's net and running balance across the grid's months.
 *
 * Both sides come from whichever lens the coach is reading — the plan under Budget, what is still
 * owed and still expected under Scheduled, real cash under Actual. Never a blend: mixing a planned
 * estimate with a commitment for the same cost is exactly the double-count the "Scheduled is a
 * separate lens" ruling exists to prevent.
 */
export function buildCashFlow(
  months: MonthKey[],
  moneyInByMonth: Record<string, number>,
  moneyOutByMonth: Record<string, number>,
  openingBalance = 0,
  undatedFlow: { moneyIn?: number; moneyOut?: number } = {},
): CashFlowResult {
  const opening = round2(openingBalance);
  let running = opening;
  let shortfall: CashFlowResult['shortfall'] = null;

  const rows = months.map(month => {
    const moneyIn = round2(moneyInByMonth[month] ?? 0);
    const moneyOut = round2(moneyOutByMonth[month] ?? 0);
    const net = round2(moneyIn - moneyOut);
    /* ⚠ CAPTURED BEFORE THE MONTH MOVES IT — this is what the team was holding on the first of the
       month, which is the month before's close, which is the season's opening in month one. */
    const opening = running;
    running = round2(running + net);
    if (running < -0.005 && !shortfall) shortfall = { month, amount: round2(Math.abs(running)) };
    return { month, moneyIn, moneyOut, net, opening, running };
  });

  const undatedIn = round2(undatedFlow.moneyIn ?? 0);
  const undatedOut = round2(undatedFlow.moneyOut ?? 0);
  const undated = { moneyIn: undatedIn, moneyOut: undatedOut, net: round2(undatedIn - undatedOut) };
  /* ⚠ THE UNDATED NET IS IN THE TOTALS AND IN NO MONTH — so it never moves a month's running
     balance and never triggers the shortfall sentence. A pledge cannot rescue a February the team
     has to get through without it. */
  const net = round2(rows.reduce((s, r) => s + r.net, 0) + undated.net);

  return { rows, opening, undated, net, ending: round2(opening + net), shortfall };
}

/**
 * The season's net and running balance, read off the two BANDS on screen.
 *
 * ⚠⚠ THE ASSEMBLY IS THE PART WORTH SHARING, not the sum underneath it (`/simplify`, 2026-08-23).
 * The screen and the export both had to answer the same three questions — which cells feed which
 * side, where the balance STARTS, and what happens to money nobody can date — and both had written
 * their own answer. `buildCashFlow` being shared was not enough: a change to the opening-balance
 * rule would have had two call sites, and a spreadsheet whose Net and Running rows disagreed with
 * the screen it was exported from is the exact failure the Option D ruling exists to prevent.
 *
 * ⚠⚠ THE OPENING IS THE LENS'S OWN, AND SINCE 2026-08-24 A SEASON CAN CARRY ONE (owner ruling).
 * Actual and Budget start from the season's own opening balance — money the team was holding on
 * day one, carried forward at `Start next season` and correctable in Team settings → Money.
 * Scheduled starts from TODAY'S REAL MONEY, because a forward view projected from zero would be
 * fiction — and `cashOnHand` ALREADY INCLUDES the carried balance, so adding it again here would
 * count it twice. That is the one way this pair can go wrong, and it is why the opening is passed
 * as two separate facts rather than one number the caller adds up.
 *
 * ⚠ BOTH BANDS MUST SHARE A MONTH DOMAIN — `buildMonthGrid`'s `months` input is how the caller
 * guarantees it. Index `i` addresses the same month on both sides here, so a mismatch would
 * subtract April's costs from May's revenue.
 */
export function buildBandCashFlow(
  revenue: MonthGrid,
  expenses: MonthGrid,
  lens: Exclude<MoneyLens, 'difference'>,
  cashOnHand: number,
  openingBalance = 0,
): CashFlowResult {
  const moneyInByMonth: Record<string, number> = {};
  const moneyOutByMonth: Record<string, number> = {};
  /* ⚠ NO `?? 0` ON THE REVENUE SIDE, DELIBERATELY. The two bands share a month domain by
     construction, so a missing cell here is not a case to absorb — it means a caller built the
     bands over different ranges, and every figure below it would be wrong money quietly. Let that
     throw. A defensive zero would turn a broken caller into a silently understated balance. */
  expenses.months.forEach((m, i) => {
    moneyInByMonth[m] = revenue.totals.cells[i][lens];
    moneyOutByMonth[m] = expenses.totals.cells[i][lens];
  });
  return buildCashFlow(
    expenses.months, moneyInByMonth, moneyOutByMonth,
    lens === 'scheduled' ? cashOnHand : openingBalance,
    { moneyIn: revenue.totals.undated[lens], moneyOut: expenses.totals.undated[lens] },
  );
}

// ── lenses ───────────────────────────────────────────────────────────────────

/** What a cell shows. One payload serves all four, so flipping a lens never refetches. */
export type MoneyLens = 'budget' | 'scheduled' | 'actual' | 'difference';

/**
 * Which way a row's money moves — the REVENUE band or the EXPENSES band (Option D, 2026-08-23).
 *
 * ⚠⚠ IT EXISTS FOR ONE REASON: THE SIGN OF "DIFFERENCE" FLIPS. Under budget on a cost is good news;
 * under budget on dues is a shortfall. Computed the same way for both, a revenue row that came in
 * $900 light would print a positive figure in the same colour the grid uses for "you saved money".
 * So costs read plan − actual and revenue reads actual − plan: on both bands, a positive number is
 * the season going well, which is the only rule a reader can hold in their head.
 */
export type MoneyRowDirection = 'in' | 'out';

/** Has this month already happened? Drives the Difference lens blanking future months. */
export function isElapsed(month: MonthKey, todayMonth: MonthKey): boolean {
  return month <= todayMonth;
}

/**
 * The value one MONTH cell shows under a lens, or null for "nothing to say here".
 *
 * Difference is Budget − Actual and ONLY for months that have already happened: a future month
 * with nothing spent in it is not a saving, and showing the whole budget as "under" would flatter
 * a coach into a shortfall (owner decision D-H5, 2026-07-30). Shared by the grid and its export
 * so the file a coach downloads can never disagree with the screen they downloaded it from.
 */
export function lensCell(
  cell: MonthCell, lens: MoneyLens, month: MonthKey, todayMonth: MonthKey,
  direction: MoneyRowDirection = 'out',
): number | null {
  if (lens !== 'difference') return cell[lens];
  if (!isElapsed(month, todayMonth)) return null;
  return lensDifference(cell, direction);
}

/** The same for a ROW total, where every month has already been rolled in. */
export function lensTotal(
  total: MonthCell, lens: MoneyLens, direction: MoneyRowDirection = 'out',
): number {
  return lens === 'difference' ? lensDifference(total, direction) : total[lens];
}

/** Plan against reality, signed so that positive is good news on either band — see `MoneyRowDirection`. */
function lensDifference(cell: MonthCell, direction: MoneyRowDirection): number {
  return direction === 'in'
    ? round2(cell.actual - cell.budget)
    : round2(cell.budget - cell.actual);
}

/**
 * The "no date yet" figure a lens can show, or null when it has nothing to put there.
 *
 * ⚠ THE COLUMN APPEARS ONLY WHERE IT CAN HOLD SOMETHING (owner ruling 2026-08-21) — which used to
 * mean "the plan lenses", because undated money was plan money. Option D's forward view gave
 * Scheduled its own undated bucket (a sponsor pledge, a club request awaiting an answer), so the
 * rule is now enforced on the FIGURE rather than on the lens's name. Difference stays plan-only:
 * comparing an undated plan against an undated arrival is not a comparison anyone asked for.
 */
export function lensUndated(undated: MonthCell, lens: MoneyLens): number {
  return lens === 'difference' ? undated.budget : undated[lens];
}

/** Does this lens read the PLAN? */
export function lensReadsPlan(lens: MoneyLens): boolean {
  return lens === 'budget' || lens === 'difference';
}

/**
 * Has this row anything to say under the lens on screen?
 *
 * ⚠⚠ ONE PREDICATE, TWO READERS, AND THAT IS THE WHOLE REASON IT IS HERE. The screen filters the
 * REVENUE band with it (a bottle drive has no forward record, so "Fundraising" is absent from the
 * Scheduled view rather than a row of dashes) and the EXPORT has to filter identically — a file
 * listing a row the screen never showed gives a reader no way to tell an empty row from a missing
 * one. Written out twice it was one edit away from the two disagreeing, which is the defect class
 * this whole report has been consolidated twice to remove.
 *
 * ⚠ THE EXPENSE BAND DOES NOT USE THIS. A category the coach budgeted for stays visible whether or
 * not the lens has anything in it, because its emptiness is itself the answer.
 */
export function categoryHasFigure(total: MonthCell, lens: MoneyLens): boolean {
  if (lens === 'difference') {
    return Math.abs(total.budget) > 0.005 || Math.abs(total.actual) > 0.005;
  }
  return Math.abs(total[lens]) > 0.005;
}

/**
 * Is there anything for the "No date yet" column to hold under this lens, on either band?
 *
 * ⚠⚠ THE SCREEN AND THE FILE HAD TWO DIFFERENT FORMULAS FOR THIS, and they were not equivalent
 * (`/simplify`, 2026-08-23): the screen asked "is EITHER band's figure over a cent?" and the export
 * asked "is the SUM of both over a cent?" — so two bands holding three-tenths of a cent each gave a
 * column in the download and none on screen. Nobody would ever have seen it, and that is exactly
 * why it is worth deleting: the rule is *"the column appears only where it can hold something"*
 * (owner ruling 2026-08-21), and a rule with two spellings has already started drifting.
 */
export function hasUndated(bands: MonthGrid[], lens: MoneyLens): boolean {
  return bands.some(b => Math.abs(lensUndated(b.totals.undated, lens)) > 0.005);
}

/** "2026-03" → "Mar '26". Short by necessity: this is a column header on a phone. */
export function formatMonthLabel(month: MonthKey): string {
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const m = Number(month.slice(5, 7));
  return `${names[m - 1] ?? month} '${month.slice(2, 4)}`;
}

/** "2026-03" → "March 2026", for prose (the shortfall sentence, a drill-in panel title). */
export function formatMonthLong(month: MonthKey): string {
  const names = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const m = Number(month.slice(5, 7));
  return `${names[m - 1] ?? month} ${month.slice(0, 4)}`;
}
