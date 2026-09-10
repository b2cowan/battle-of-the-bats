import { getCell } from './import/tabular.ts';
import type { ParsedImportFile, ParsedImportRow } from './import/types.ts';
import type { XlsxOptions, XlsxColumnChoice, XlsxColumnFlag, XlsxGuideLine } from './export/xlsx.ts';
import { formatMonthLabel, type MonthKey } from './coach-budget-months.ts';
import { PLAN_LADDER_LABEL } from './coach-budget-totals';

/**
 * Spreadsheet intake for the coach's budget (Coach Portal chunk H2).
 *
 * Three shapes, one machine: parse → normalise → match → a per-row outcome the coach reviews
 * before anything is written. Only the column map and the writer differ per shape.
 *
 *   month-grid — a row per cost line, a column per month → a budget line with dated payment periods
 *   list       — Category · Line · Amount · Notes                → a lump-sum budget line
 *   payables   — Payee · Description · Category · Amount · Due   → a payable
 *
 * TWO hard rules this module exists to keep:
 *
 *  1. **No product-supplied dollar figure (D-G1).** The downloadable templates carry column
 *     headings and nothing else — every amount cell ships EMPTY. A template with an example
 *     dollar in it is the product proposing a number, which is forbidden across all of Money.
 *  2. **Names and numbers only — never guess data out of prose.** A row whose category we don't
 *     recognise is handed back to the coach to fix, never quietly filed somewhere plausible.
 *
 * The month-grid reader deliberately also understands the app's OWN month-grid export — its
 * combined "Category / line" column, its indented line rows, its derived columns and its total /
 * cash-flow rows. That is what makes "export it, edit it, import it back" a real round trip
 * rather than a claim.
 */

/** Upper bound on one intake, mirroring the roster importer's guard. */
export const MAX_IMPORT_ROWS = 300;

export type BudgetImportShape = 'month-grid' | 'list' | 'payables';

export type RowOutcome = 'add' | 'update' | 'blocked';

export interface DraftPeriod {
  month: MonthKey;
  amount: string;
}

export interface DraftBudgetRow {
  /** 1-based position in the source, shown in the preview and in commit results. */
  rowNumber: number;
  categoryName: string;
  lineName: string;
  /** Kept as the coach typed it so the preview can show a bad value back to them. */
  amount: string;
  notes: string;
  /** month-grid only. Empty = a lump sum with no date. */
  periods: DraftPeriod[];
  /**
   * Which side of the plan this row belongs to, read from the file's own BAND rows.
   *
   * ⚠ MONEY OUT IS THE DEFAULT AND ALWAYS WILL BE. A sheet with no band row — every hand-built
   * one, every template download, every plan file written before 2026-09-08 — is a spending sheet,
   * exactly as this importer has always read it. Only a file that says otherwise, in the words the
   * plan screen itself prints, is read otherwise. See `bandOf`.
   *
   * ⚠ Typed inline rather than as `BudgetItemDirection`: this module stays free of `lib/types` so
   * it can be pulled into a client bundle unchanged (the same reason `budgetLineKindForItem` does).
   */
  direction: 'in' | 'out';
}

export interface DraftPayableRow {
  rowNumber: number;
  payee: string;
  description: string;
  categoryName: string;
  amount: string;
  depositAmount: string;
  depositDueDate: string;
  balanceAmount: string;
  balanceDueDate: string;
}

/**
 * A one-tap correction offered beside a warning — "Use “Entry Fees”".
 *
 * Exactly one of `lineName` / `categoryName` is set: the fix is either "you meant this word" or
 * "this word lives under that heading". `label` is the name the button says, so the UI never has
 * to work out which field the suggestion is about.
 */
export interface RowSuggestion {
  lineName?: string;
  categoryName?: string;
  label: string;
}

export interface RowVerdict {
  outcome: RowOutcome;
  /** Why it is blocked, or what an update will change — always in the coach's language. */
  reason?: string;
  /** The existing budget line this row updates, when matched. */
  matchedLineId?: string;
  /** Worth a look, never blocking. */
  warning?: string;
  /** Offered with a warning, never on its own. */
  suggestion?: RowSuggestion;
}

export type ReviewedBudgetRow = DraftBudgetRow & RowVerdict & { total: number };
export type ReviewedPayableRow = DraftPayableRow & RowVerdict & { total: number };

// ── shared parsing helpers ───────────────────────────────────────────────────

const MONTH_NAMES = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** Column headings the readers recognise, in their canonical spelling plus common variants. */
export const ALIASES = {
  category:    ['category', 'cat', 'budget category'],
  line:        ['line', 'line item', 'item', 'description', 'cost', 'what'],
  combined:    ['category / line', 'category line', 'category or line'],
  /* ⚠ 'planned' IS THE PLAN FILE'S OWN MONEY COLUMN, and its absence here made the whole statement
     export unreadable. The column was renamed `Planned` on 2026-09-02 (§133, the Budget tab
     revamp); `getCell` matches a header EXACTLY, so from that day every row of a re-imported plan
     arrived with no amount and was blocked "No amount. Add one here, or leave the row out." — the
     file the product itself writes, refused by the door it was written for. Nothing could see it:
     the reader's tests spell their own headers, and the header they spelled was `Amount`.
     ⚠ A ROUND-TRIP TEST NOW BUILDS ITS SHEET FROM `BUDGET_PLAN_COLUMNS` rather than typing the
     headers out, which is the only shape of test that can catch a rename. */
  amount:      ['amount', 'total', 'cost', 'budget', 'estimated', 'estimate', 'planned'],
  notes:       ['notes', 'note', 'comment', 'comments'],
  /* ⚠ 'unscheduled' IS HERE FOR THE FILES ALREADY ON PEOPLE'S MACHINES. The by-period export wrote
     that heading until 2026-09-04 and nothing here matched it, so those sheets round-tripped with
     every undated amount dropped. Renaming the export fixes tomorrow's files; this line fixes the
     ones already downloaded, and must not be removed as tidy-up. */
  undated:     ['no date yet', 'no date', 'undated', 'unscheduled'],
  payee:       ['payee', 'pay to', 'paid to', 'vendor', 'supplier'],
  description: ['description', 'what', 'what for', 'item'],
  dueDate:     ['due date', 'due', 'date due'],
  deposit:     ['deposit', 'deposit amount'],
  depositDue:  ['deposit due', 'deposit due date'],
  balance:     ['balance', 'balance amount'],
  balanceDue:  ['balance due', 'balance due date'],
} as const;

/**
 * Read a money cell. Accepts what a spreadsheet actually produces — `$1,200.00`, `1 200`,
 * `(450)` for a negative, a stray trailing space. Returns '' when there is nothing to read, so
 * an empty cell and a zero stay distinguishable.
 */
export function parseMoneyCell(raw: string): string {
  const text = (raw ?? '').trim();
  if (!text) return '';
  const negative = /^\(.*\)$/.test(text);
  const cleaned = text.replace(/[()]/g, '').replace(/[$\s, ]/g, '');
  if (!cleaned || !/^-?\d*\.?\d+$/.test(cleaned)) return text; // hand the junk back for the coach to see
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return text;
  return String(negative ? -n : n);
}

/** A money cell that is a usable positive number, or null. */
export function moneyValue(raw: string): number | null {
  const parsed = parseMoneyCell(raw);
  if (!parsed) return null;
  const n = Number(parsed);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

/**
 * A date cell → `YYYY-MM-DD`, or '' when unreadable.
 *
 * Deliberately strict: ISO, or a spreadsheet's own `YYYY-MM-DD` (which is what the XLSX parser
 * hands over for a real date cell). An ambiguous `03/04/2026` is NOT guessed — a wrong due date
 * chases a family or misses a tournament deposit, so it is returned blank and flagged.
 */
export function parseDateCell(raw: string): string {
  const text = (raw ?? '').trim();
  if (!text) return '';
  const iso = text.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : '';
}

/**
 * A month column heading → `YYYY-MM`.
 *
 * Understands an explicit year (`2026-09`, `Sep 2026`, `Sep '26` — the CSV export format — and a
 * full ISO date like `2026-02-01`, which is what parseXLSX hands over for the Excel export's
 * date-valued month headers) and a bare month name. A bare month has no year of its own, so the
 * reader carries one: it starts at the season year and rolls forward when the months wrap round
 * (Sep, Oct, … Jan), which is exactly how a season spreadsheet reads left to right.
 */
export function parseMonthHeader(header: string, carriedYear: number): { month: MonthKey; year: number } | null {
  const text = (header ?? '').trim();
  if (!text) return null;

  // The optional day (a real date cell) is read and dropped — a month column is a month.
  const isoish = text.match(/^(\d{4})[-/](\d{1,2})(?:[-/]\d{1,2})?$/);
  if (isoish) {
    const m = Number(isoish[2]);
    if (m < 1 || m > 12) return null;
    return { month: `${isoish[1]}-${String(m).padStart(2, '0')}`, year: Number(isoish[1]) };
  }

  const named = text.toLowerCase().match(/^([a-z]{3,9})\.?\s*'?(\d{2}|\d{4})?$/);
  if (!named) return null;
  const idx = MONTH_NAMES.indexOf(named[1].slice(0, 3));
  if (idx < 0) return null;

  let year = carriedYear;
  if (named[2]) {
    year = named[2].length === 2 ? 2000 + Number(named[2]) : Number(named[2]);
  }
  return { month: `${year}-${String(idx + 1).padStart(2, '0')}`, year };
}

/**
 * Rows the app's own export adds that are derived, not data.
 *
 * ⚠ THE PLAN'S LADDER ROWS ARE READ FROM `PLAN_LADDER_LABEL`, NEVER RETYPED (/review, 2026-09-08).
 * The statement export gained subtotals, a closing ladder and two estimate rows ("Lines so far",
 * "Still to itemize"); an importer that did not know those words would have re-imported the
 * team's own file with two phantom budget LINES worth the itemized sum and the estimate gap. Every
 * label the ladder prints is skipped here by construction, so a new ladder word cannot be born
 * without the importer learning it. The two band headings ("Costs", "Funding") are deliberately NOT
 * in this set — a coach may legitimately own a category by either name, and as non-indented rows
 * they only ever act as a category name that the next real category row replaces before any line
 * attaches. "Total planned budget" is the retired close, kept so a file exported before 2026-09-08
 * still reads back clean.
 */
const PLAN_LADDER_DERIVED = Object.entries(PLAN_LADDER_LABEL)
  .filter(([key]) => key !== 'costsBand' && key !== 'fundingBand' && key !== 'costsLessFundingNote')
  .map(([, label]) => label.toLowerCase());
const DERIVED_ROW_LABELS = new Set([
  'total', 'money in', 'money out', 'running balance', 'grand total',
  'total planned budget',
  ...PLAN_LADDER_DERIVED,
]);

function isDerivedRow(label: string): boolean {
  return DERIVED_ROW_LABELS.has(label.trim().toLowerCase().replace(/^[—–-]\s*/, ''));
}

/**
 * The plan file's two BANDS, read as the switch that says which side a row is on.
 *
 * ⚠⚠ THIS IS WHY THE PRODUCT CAN READ THE FILE IT WROTE. Until 2026-09-10 every row of a plan file
 * was a cost by construction, so exporting a plan and importing it back turned every fundraiser,
 * sponsor and tournament-revenue line into a NEW COST inside a revenue category — planned costs up
 * by the size of the plan's own funding, and a spending word minted on the wrong side of the
 * library. `/review` found it 2026-09-09; the walk step that documented it as a known gap is now a
 * check. See docs/projects/active/COACH_BUDGET_IMPORT_TWO_BANDS_PLAN.md.
 *
 * ⚠ NO NEW COLUMN, DELIBERATELY (plan §2). An export's shape is its screen's shape (QA §146 F2) and
 * the plan screen has two bands, not a direction column — and the band is already sitting in every
 * file a coach has on disk, which a column added today would not be.
 *
 * ⚠⚠ THE "NO MONEY ON IT" CLAUSE IS LOAD-BEARING, NOT A TIDINESS CHECK. A club may legitimately own
 * a category called "Funding" or "Costs" — that is exactly why these two labels were kept OUT of
 * `DERIVED_ROW_LABELS` — and a category row always carries its own total while a band heading never
 * does (`budgetPlanStatementRows` writes `planned: ''`, `budgetPeriodGridRows`'s `band()` blanks
 * every cell). Without the clause, that club's plan would import with half its costs read as income.
 */
const BAND_LABELS: Array<{ label: string; direction: 'in' | 'out' }> = [
  { label: PLAN_LADDER_LABEL.costsBand.toLowerCase(),   direction: 'out' },
  { label: PLAN_LADDER_LABEL.fundingBand.toLowerCase(), direction: 'in' },
];

/**
 * Is this row one of the file's band headings? The band it switches to, or null for "an ordinary
 * row" — which is every row of every sheet that has no bands at all, so a hand-built spending sheet
 * reads exactly as it always has.
 *
 * `label` is the row's text with any line indent already stripped; `indented` is that same reader's
 * verdict, because a band heading is never nested.
 */
function bandOf(label: string, indented: boolean, source: ParsedImportRow): 'in' | 'out' | null {
  if (indented) return null;
  const text = label.trim().toLowerCase();
  const band = BAND_LABELS.find(b => b.label === text);
  if (!band) return null;
  /* Any figure anywhere on the row disqualifies it — the month columns of a by-period file as much
     as a single Amount column, which is why this reads the row's own values rather than a column
     list it would have to be kept in step with. The label cell needs no exclusion: "FUNDING" is not
     a number, and `moneyValue` hands junk back rather than pretending it read one. */
  const carriesMoney = Object.values(source.values).some(v => moneyValue(v ?? '') != null);
  return carriesMoney ? null : band.direction;
}

/**
 * The CSV export writes line rows as `  — Entry Fees` under their category; the Excel export
 * (since 2026-08-25) writes them dash-free and nested by STYLING instead — an outline level and a
 * cell indent, which parseXLSX reads and hands over as the row's `indented` flag. Both spellings
 * of the same fact, accepted equally; a hand-typed dash works too.
 *
 * ⚠ LEADING SPACES ALONE DO NOT — and never have. Every real path pre-trims cell values
 * (`matrixToParsedRows` trims each cell for xlsx and CSV alike), so the whitespace fallback
 * below is dead on arrival; it is kept only for a hypothetical untrimmed caller. A coach nesting
 * hand-typed rows needs the dash (or, in Excel, a real cell indent / outline group) (/review).
 */
function stripLineIndent(value: string, styledIndent?: boolean): { text: string; indented: boolean } {
  const raw = value ?? '';
  const match = raw.match(/^\s*[—–-]\s*(.*)$/);
  if (match) return { text: match[1].trim(), indented: true };
  return { text: raw.trim(), indented: !!styledIndent || /^\s{2,}/.test(raw) };
}

// ── month-grid reader ────────────────────────────────────────────────────────

/**
 * Map a parsed sheet onto draft budget rows with dated periods.
 *
 * Month columns are discovered from the HEADERS, so a coach can hand us Sep–Aug, Jan–Dec, or the
 * five months their season actually runs. Everything that isn't a month and isn't a known column
 * (a prior-season column, a Total column) is ignored rather than misread.
 */
export function rowsFromMonthGrid(file: ParsedImportFile, seasonYear: number): DraftBudgetRow[] {
  // Discover the month columns left to right, carrying the year across a wrap.
  const monthColumns: Array<{ header: string; month: MonthKey }> = [];
  let carriedYear = seasonYear;
  let previousMonthNumber = 0;
  for (const header of file.headers) {
    const parsed = parseMonthHeader(header, carriedYear);
    if (!parsed) continue;
    let month = parsed.month;
    const monthNumber = Number(month.slice(5, 7));
    // A bare month name that goes BACKWARDS means the season crossed a year boundary.
    if (!/\d{2,4}\s*$/.test(header.trim()) && previousMonthNumber && monthNumber < previousMonthNumber) {
      carriedYear += 1;
      month = `${carriedYear}-${month.slice(5)}`;
    } else {
      carriedYear = parsed.year;
    }
    previousMonthNumber = monthNumber;
    monthColumns.push({ header, month });
  }

  const rows: DraftBudgetRow[] = [];
  let currentCategory = '';
  let band: 'in' | 'out' = 'out';

  for (const source of file.rows) {
    const combined = getCell(source, [...ALIASES.combined]);
    const explicitCategory = getCell(source, [...ALIASES.category]);
    const explicitLine = getCell(source, [...ALIASES.line]);

    let categoryName = explicitCategory.value.trim();
    let lineName = explicitLine.value.trim();

    if (combined.present && !explicitLine.present) {
      // The app's own export shape: one column, categories flush and lines indented under them.
      const { text, indented } = stripLineIndent(combined.value, source.indented);
      if (!text) continue;
      if (isDerivedRow(text)) continue;
      const switched = bandOf(text, indented, source);
      if (switched) {
        /* ⚠ AND IT FORGETS THE CATEGORY. A band heading used to BECOME `currentCategory` and rely
           on the next real category row replacing it before any line attached. Now that it means
           something, a line sitting under a bare band heading with no category between them must
           be blocked ("No category. Pick one to import this row.") rather than inherit the
           category from the OTHER band, which is what carrying the old value would do. */
        band = switched;
        currentCategory = '';
        continue;
      }
      if (indented) {
        lineName = text;
        categoryName = currentCategory;
      } else {
        // A category header row carries the category's totals, which are derived from its lines —
        // remembering the name is the only thing to take from it.
        currentCategory = text;
        continue;
      }
    } else {
      if (categoryName) currentCategory = categoryName;
      if (!categoryName) categoryName = currentCategory;
      if (isDerivedRow(lineName) || (!lineName && !categoryName)) continue;
    }

    const periods: DraftPeriod[] = [];
    for (const col of monthColumns) {
      const value = parseMoneyCell(source.values[col.header] ?? '');
      const n = Number(value);
      if (!value || !Number.isFinite(n) || n <= 0) continue;
      periods.push({ month: col.month, amount: String(n) });
    }

    // Undated money — from the export's own "No date yet" column, or from a plain Amount column
    // on a sheet that also has months.
    const undated = moneyValue(getCell(source, [...ALIASES.undated]).value) ?? 0;
    const periodTotal = periods.reduce((s, p) => s + Number(p.amount), 0);
    const total = Math.round((periodTotal + undated) * 100) / 100;

    rows.push({
      rowNumber: rows.length + 1,
      categoryName,
      lineName,
      amount: total > 0 ? String(total) : '',
      notes: getCell(source, [...ALIASES.notes]).value.trim(),
      periods,
      direction: band,
    });
    if (rows.length >= MAX_IMPORT_ROWS) break;
  }

  return rows;
}

// ── simple-list reader ───────────────────────────────────────────────────────

/** Category · Line · Amount · Notes → lump-sum budget lines. */
export function rowsFromList(file: ParsedImportFile): DraftBudgetRow[] {
  const rows: DraftBudgetRow[] = [];
  let currentCategory = '';
  let band: 'in' | 'out' = 'out';

  for (const source of file.rows) {
    const combined = getCell(source, [...ALIASES.combined]);
    let categoryName = getCell(source, [...ALIASES.category]).value.trim();
    let lineName = getCell(source, [...ALIASES.line]).value.trim();

    if (combined.present && !lineName) {
      const { text, indented } = stripLineIndent(combined.value, source.indented);
      if (!text || isDerivedRow(text)) continue;
      // The band switch, and it forgets the category with it — see the twin in `rowsFromMonthGrid`.
      const switched = bandOf(text, indented, source);
      if (switched) { band = switched; currentCategory = ''; continue; }
      if (indented) { lineName = text; categoryName = currentCategory; }
      else { currentCategory = text; continue; }
    } else {
      if (categoryName) currentCategory = categoryName;
      if (!categoryName) categoryName = currentCategory;
      if (isDerivedRow(lineName)) continue;
    }

    rows.push({
      rowNumber: rows.length + 1,
      categoryName,
      lineName,
      amount: parseMoneyCell(getCell(source, [...ALIASES.amount]).value),
      notes: getCell(source, [...ALIASES.notes]).value.trim(),
      periods: [],
      direction: band,
    });
    if (rows.length >= MAX_IMPORT_ROWS) break;
  }

  return rows;
}

// ── payables reader ──────────────────────────────────────────────────────────

/**
 * Payee · Description · Category · Amount · Due date (+ optional deposit/balance split).
 *
 * A single amount with one due date is recorded the way the payable form already records it —
 * as the deposit half with no balance — so nothing new has to exist in the data for this to work.
 */
export function rowsFromPayables(file: ParsedImportFile): DraftPayableRow[] {
  const rows: DraftPayableRow[] = [];
  for (const source of file.rows) {
    const description = getCell(source, [...ALIASES.description]).value.trim()
      || getCell(source, [...ALIASES.line]).value.trim();
    if (!description && !getCell(source, [...ALIASES.payee]).value.trim()) continue;
    if (isDerivedRow(description)) continue;

    const deposit = parseMoneyCell(getCell(source, [...ALIASES.deposit]).value);
    const balance = parseMoneyCell(getCell(source, [...ALIASES.balance]).value);
    const depositDue = parseDateCell(getCell(source, [...ALIASES.depositDue]).value);
    const balanceDue = parseDateCell(getCell(source, [...ALIASES.balanceDue]).value);
    const singleDue = parseDateCell(getCell(source, [...ALIASES.dueDate]).value);
    const amount = parseMoneyCell(getCell(source, [...ALIASES.amount]).value);

    // No explicit split → the whole amount is due on the one date, stored as the deposit half.
    const hasSplit = !!deposit || !!balance;
    rows.push({
      rowNumber: rows.length + 1,
      payee: getCell(source, [...ALIASES.payee]).value.trim(),
      description,
      categoryName: getCell(source, [...ALIASES.category]).value.trim(),
      amount,
      depositAmount: hasSplit ? deposit : amount,
      depositDueDate: hasSplit ? depositDue : singleDue,
      balanceAmount: hasSplit ? balance : '',
      balanceDueDate: hasSplit ? balanceDue : '',
    });
    if (rows.length >= MAX_IMPORT_ROWS) break;
  }
  return rows;
}

// ── review ───────────────────────────────────────────────────────────────────

/** Where a word came from, for the template's Reference sheet. */
export type BudgetWordSource = 'standard' | 'club' | 'team';

export interface KnownItem {
  id: string;
  name: string;
  /** Only the template needs this; the readers and the writer never look at it. */
  source?: BudgetWordSource;
}

/**
 * The vocabulary an import may match against, ONE LIST PER SIDE.
 *
 * ⚠ THE SIDES ARE HELD APART, NEVER MERGED. Migration 248 made a word's SIDE part of what
 * identifies it — "Grant" the income and "Grant" the application fee are two different words, and
 * the coach's own picker shows one side at a time — so a row must only ever match the side it is
 * on. A single merged list would let a spending row attach itself to an income word the coach was
 * never offered, which is the defect mig 248 exists to make unexpressible.
 *
 * ⚠ `items` KEEPS ITS MEANING — the COST words — because the template, its Reference sheet and its
 * Excel dropdowns are spending-only by design and say so in their own words. Widening those is a
 * design question about the template, not part of reading a plan file back.
 */
export interface KnownCategory {
  id: string;
  name: string;
  /** The COST words under this heading. */
  items: KnownItem[];
  /**
   * The MONEY-IN words under this heading — the ones `items` deliberately drops.
   *
   * ⚠ THIS REPLACED AN `incomeNameCount` NUMBER (2026-09-10). The count existed so the template's
   * Reference sheet could tell two blanks apart — a heading waiting for its first cost name
   * ("Provincials Trip", freshly created) from an income heading whose full vocabulary this sheet
   * is simply not about ("Other Income", "Sponsorship"). It still answers that, as `.length`, and
   * one field cannot fall out of step with itself the way two that must agree eventually do.
   */
  incomeItems: KnownItem[];
}

/**
 * The words a row of THIS side may match — the one answer, so the snapper, the new-word verdict,
 * the preview's type-ahead and the writer cannot disagree about what a row is allowed to become.
 */
export function wordsFor(category: KnownCategory, direction: 'in' | 'out'): KnownItem[] {
  return direction === 'in' ? category.incomeItems : category.items;
}

/**
 * The one place a budget taxonomy becomes an import vocabulary.
 *
 * Structurally typed rather than importing `BudgetCategoryWithItems`, so this module stays free of
 * `lib/types` and can be pulled into a client bundle unchanged.
 *
 * ⚠ THE DIRECTION SPLIT IS THE POINT OF HAVING THIS FUNCTION AT ALL. Three screens mount the
 * import sheet and each used to write the mapping out by hand; the day one of them needed a filter,
 * all three needed it, and nothing would have said so.
 *
 * ⚠⚠ AND THE IMPORT ROUTE NOW CALLS IT TOO (2026-09-10). That route built its own `KnownCategory`
 * inline — the "second place in the product that builds one", as its own comment warned — so this
 * change would otherwise have had to be made correctly twice, in two files, by two people. It is
 * made once.
 */
export function toKnownCategories(
  categories: Array<{
    id: string;
    name: string;
    items: Array<{ id: string; name: string; orgId: string | null; teamId: string | null; direction: string }>;
  }>,
): KnownCategory[] {
  // The three tiers migration 240 built, said in words a coach reads.
  const word = (i: { id: string; name: string; orgId: string | null; teamId: string | null }): KnownItem => ({
    id: i.id,
    name: i.name,
    source: (i.orgId === null ? 'standard' : i.teamId === null ? 'club' : 'team') as BudgetWordSource,
  });
  return categories.map(c => ({
    id: c.id,
    name: c.name,
    items: c.items.filter(i => i.direction === 'out').map(word),
    incomeItems: c.items.filter(i => i.direction === 'in').map(word),
  }));
}

export interface ExistingBudgetLine {
  id: string;
  description: string;
  categoryName: string | null;
  totalAmount: number;
  /**
   * Which side of the plan this line is already on, so a sheet row matches only its own.
   *
   * ⚠ THIS REPLACED A COST-ONLY FILTER AT THE CALLER, and it is strictly the safer shape. The old
   * filter stopped a sheet row called "Fundraising" overwriting the team's funding line — a real
   * defect — but it did it by hiding those lines, which also made every money-in row look new. The
   * rule that actually holds is *match your own side*, which stops that overwrite in BOTH
   * directions and leaves a money-in row able to find the line it came from.
   */
  direction: 'in' | 'out';
}

function key(value: string): string {
  return value.trim().toLowerCase();
}

// ── the coach's spelling vs. the library's ───────────────────────────────────

/**
 * A word reduced to the letters and digits that carry its meaning.
 *
 * ⚠ WHY THIS EXISTS. Matching used to be `trim().toLowerCase()` and nothing else, so `Entry Fees`,
 * `Entry  Fees`, `Entry-Fees` and `Entry Fees.` were four different words. The first one matched
 * the library; the other three each MINTED A NEW BUDGET ITEM for the team, silently, and the
 * coach's Budget vs. Actual then split one cost across two rows for the rest of the season. A
 * coach typing a heading into a spreadsheet is not choosing between a hyphen and a space.
 *
 * Apostrophes are removed rather than spaced, so `Coach's Gear` and `Coachs Gear` agree.
 */
export function normalizeWord(value: string): string {
  return (value ?? '')
    .toLowerCase()
    .replace(/['‘’ʼ´`]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Levenshtein distance, abandoned as soon as it cannot come in under `limit`.
 *
 * The bound is the point: this runs over every library word for every imported row, and the only
 * answer anyone wants is "closer than two edits or not".
 */
function editDistance(a: string, b: string, limit: number): number {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const value = Math.min(row[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
      row.push(value);
      if (value < best) best = value;
    }
    if (best > limit) return limit + 1;
    prev = row;
  }
  return prev[b.length];
}

/** How wrong a name may be and still be worth offering a correction for. */
function nearnessLimit(normalized: string): number {
  return normalized.length <= 8 ? 1 : 2;
}

/** Is `typed` close enough to `known` that a coach probably meant `known`? */
function isNearMatch(typed: string, known: string): boolean {
  if (!typed || !known) return false;
  // A shortened or extended form of the same word — "Entry" for "Entry Fees", "Tournament Entry
  // Fees" for "Entry Fees" — which edit distance alone would score as miles apart.
  if (typed.length >= 4 && known.length >= 4 && (known.startsWith(typed) || typed.startsWith(known))) return true;
  return editDistance(typed, known, nearnessLimit(typed)) <= nearnessLimit(typed);
}

/**
 * The one library entry a typed name reduces to, or null when the answer is not one.
 *
 * ⚠ AMBIGUITY SNAPS NOTHING. Migration 248 keys item uniqueness on `lower(name)`, so a team can
 * genuinely hold both `Entry Fees` and `Entry-Fees`; picking one of those for the coach would be
 * a guess dressed as a correction. Two candidates means we leave the word alone and let the
 * review step ask.
 */
function soleMatch(typed: string, names: string[]): string | null {
  const wanted = normalizeWord(typed);
  if (!wanted) return null;
  const hits = names.filter(n => normalizeWord(n) === wanted);
  return hits.length === 1 ? hits[0] : null;
}

/**
 * Rewrite category and cost names to the library's own spelling wherever the difference is only
 * punctuation, spacing or case.
 *
 * ⚠ THIS RUNS ON THE DRAFT THE COACH IS ABOUT TO LOOK AT, never on the way to the database. The
 * corrected spelling lands in the preview's own cells, so the coach sees what we did and can type
 * it back before anything is written. That is the difference between a correction and a liberty.
 *
 * The cost name is only snapped once the CATEGORY is known — an item's name means nothing without
 * the heading it sits under, and two categories can hold the same word.
 */
export function snapBudgetRowsToLibrary(rows: DraftBudgetRow[], categories: KnownCategory[]): DraftBudgetRow[] {
  const categoryNames = categories.map(c => c.name);
  return rows.map(row => {
    const categoryName = soleMatch(row.categoryName, categoryNames) ?? row.categoryName;
    const category = categories.find(c => key(c.name) === key(categoryName));
    // Its own side's words only — a bottle drive must never be snapped onto a cost called
    // "Bottle Drive", which mig 248 says is a different word entirely.
    const lineName = category
      ? soleMatch(row.lineName, wordsFor(category, row.direction).map(i => i.name)) ?? row.lineName
      : row.lineName;
    return categoryName === row.categoryName && lineName === row.lineName
      ? row
      : { ...row, categoryName, lineName };
  });
}

/** The same courtesy for a bills sheet, which carries a category but no cost name. */
export function snapPayableRowsToLibrary(rows: DraftPayableRow[], categories: KnownCategory[]): DraftPayableRow[] {
  const categoryNames = categories.map(c => c.name);
  return rows.map(row => {
    const categoryName = soleMatch(row.categoryName, categoryNames) ?? row.categoryName;
    return categoryName === row.categoryName ? row : { ...row, categoryName };
  });
}

/**
 * What to say about a cost name the library does not hold — and, where we can see it, what the
 * coach probably meant.
 *
 * ⚠ NEVER BLOCKING. A coach must be able to name a cost we have never heard of; the importer
 * creates the word for them precisely so the line is not left nameless and invisible to Budget vs.
 * Actual. What was missing was being TOLD, which is all this adds.
 */
function newWordVerdict(
  lineName: string,
  category: KnownCategory,
  categories: KnownCategory[],
  direction: 'in' | 'out',
): { warning: string; suggestion?: RowSuggestion } | null {
  const typed = normalizeWord(lineName);
  if (!typed) return null;
  /* ⚠ EVERY QUESTION THIS ASKS IS ASKED OF THE ROW'S OWN SIDE. A money-in row told "did you mean
     Entry Fees?" would be offered a word it cannot legally become, and taking the suggestion would
     file a bottle drive as spending. `wordsFor` is the one answer to which list. */
  if (wordsFor(category, direction).some(i => normalizeWord(i.name) === typed)) return null;

  // The exact word, under a different heading. A stronger signal than any fuzzy match here, so it
  // is tested first: the coach knows the word, they have filed it in the wrong place.
  const elsewhere = categories.find(
    c => c.id !== category.id && wordsFor(c, direction).some(i => normalizeWord(i.name) === typed),
  );
  if (elsewhere) {
    return {
      warning: `“${lineName}” is already under ${elsewhere.name} — this adds a second one under ${category.name}.`,
      suggestion: { categoryName: elsewhere.name, label: elsewhere.name },
    };
  }

  const near = wordsFor(category, direction).filter(i => isNearMatch(typed, normalizeWord(i.name)));
  // One candidate or none. Two words this close to the typed one means we cannot tell which was
  // meant, and a coin-toss suggestion is worse than none.
  if (near.length === 1) {
    return {
      warning: `New name — did you mean “${near[0].name}”?`,
      suggestion: { lineName: near[0].name, label: near[0].name },
    };
  }

  return { warning: `New name — adds “${lineName}” to your ${category.name} list.` };
}

/**
 * Attach an outcome to every budget row: does it add a line, update one, or can it not be read?
 *
 * A row is matched to an existing line on category + line name, both case-insensitive — the same
 * pairing the coach sees on the budget page. The match is SHOWN in the preview and the coach can
 * change their mind before anything is written; nothing is merged behind their back.
 */
export function reviewBudgetRows(
  rows: DraftBudgetRow[],
  categories: KnownCategory[],
  existing: ExistingBudgetLine[],
): ReviewedBudgetRow[] {
  const categoryByName = new Map(categories.map(c => [key(c.name), c]));
  /* ⚠ THE SIDE IS PART OF THE KEY, exactly as mig 248 made it part of a word's identity. A plan may
     hold "Tournaments · Entry Fees" as a cost and "Tournaments · Tournament revenue" as income;
     keying on category+name alone was safe only while every row was a cost, and the moment a file's
     funding band could be read it would let a money-in row update a cost line of the same name. */
  const pairKey = (categoryName: string, lineName: string, direction: 'in' | 'out') =>
    `${direction}|${key(categoryName)}|${key(lineName)}`;
  const existingByPair = new Map<string, ExistingBudgetLine>();
  for (const line of existing) {
    existingByPair.set(pairKey(line.categoryName ?? '', line.description, line.direction), line);
  }

  // Two rows in one sheet that name the same line would fight each other on commit.
  const seen = new Map<string, number>();
  for (const row of rows) {
    const pair = pairKey(row.categoryName, row.lineName, row.direction);
    seen.set(pair, (seen.get(pair) ?? 0) + 1);
  }

  return rows.map(row => {
    const total = moneyValue(row.amount) ?? 0;
    const pair = pairKey(row.categoryName, row.lineName, row.direction);
    const base = { ...row, total };

    if (!row.lineName) {
      return {
        ...base,
        outcome: 'blocked' as const,
        reason: row.direction === 'in'
          ? 'No name for this money in — add one, or leave the row out.'
          : 'No name for this cost — add one, or leave the row out.',
      };
    }
    if (!row.categoryName) {
      return { ...base, outcome: 'blocked' as const, reason: 'No category. Pick one to import this row.' };
    }
    if (!categoryByName.has(key(row.categoryName))) {
      return {
        ...base,
        outcome: 'blocked' as const,
        reason: `No category called “${row.categoryName}”. Pick one we recognise, or create it on the budget page first.`,
      };
    }
    if (total <= 0) {
      return {
        ...base,
        outcome: 'blocked' as const,
        reason: row.periods.length > 0
          ? 'No amount in any month column. Add one here, or leave the row out.'
          : 'No amount. Add one here, or leave the row out.',
      };
    }
    if ((seen.get(pair) ?? 0) > 1) {
      return { ...base, outcome: 'blocked' as const, reason: 'This line appears more than once in the sheet — keep one.' };
    }

    const match = existingByPair.get(pair);
    if (match) {
      return {
        ...base,
        outcome: 'update' as const,
        matchedLineId: match.id,
        reason: Math.abs(match.totalAmount - total) > 0.005
          ? `Updates “${match.description}” — was $${match.totalAmount.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          : `Updates “${match.description}” — same total, new dates`,
      };
    }
    /* ⚠ ADDS ONLY, DELIBERATELY. An `update` matched an existing budget LINE, so its name is
       already whatever the plan calls it and the coach is editing, not inventing — and `Verdict`
       renders `reason ?? warning`, so a warning there would be invisible anyway. The word this
       warning is about gets created on the ADD path, which is the one a coach can still change
       their mind about. */
    const category = categoryByName.get(key(row.categoryName))!;
    const verdict = newWordVerdict(row.lineName, category, categories, row.direction);
    return { ...base, outcome: 'add' as const, ...verdict };
  });
}

/**
 * Attach an outcome to every payable row.
 *
 * Payables are always ADDS. A commitment has no stable identity in a spreadsheet — two deposits to
 * the same tournament are two real rows — so silently overwriting one would destroy a record the
 * coach still needs. A row that looks like something already on file is flagged, not merged.
 */
export function reviewPayableRows(
  rows: DraftPayableRow[],
  categories: KnownCategory[],
  existingDescriptions: string[],
): ReviewedPayableRow[] {
  const categoryByName = new Map(categories.map(c => [key(c.name), c]));
  const existing = new Set(existingDescriptions.map(key));

  return rows.map(row => {
    const deposit = moneyValue(row.depositAmount) ?? 0;
    const balance = moneyValue(row.balanceAmount) ?? 0;
    const stated = moneyValue(row.amount) ?? 0;
    const total = Math.round((stated > 0 ? stated : deposit + balance) * 100) / 100;
    const base = { ...row, total };

    if (!row.description) {
      return { ...base, outcome: 'blocked' as const, reason: 'No description — what is this payment for?' };
    }
    if (total <= 0) {
      return { ...base, outcome: 'blocked' as const, reason: 'No amount. Add one here, or leave the row out.' };
    }
    if (row.categoryName && !categoryByName.has(key(row.categoryName))) {
      return {
        ...base,
        outcome: 'blocked' as const,
        reason: `No category called “${row.categoryName}”. Pick one we recognise, or clear it.`,
      };
    }
    if (!row.depositDueDate && !row.balanceDueDate) {
      return {
        ...base,
        outcome: 'blocked' as const,
        reason: 'No due date we could read. Use YYYY-MM-DD, or a real date cell in Excel.',
      };
    }
    if (deposit + balance > 0.005 && stated > 0 && Math.abs(deposit + balance - stated) > 0.02) {
      return {
        ...base,
        outcome: 'blocked' as const,
        reason: 'The deposit and balance don’t add up to the total. Fix one of the three.',
      };
    }

    return {
      ...base,
      outcome: 'add' as const,
      warning: existing.has(key(row.description))
        ? 'A payable with this description already exists — this adds a second one.'
        : undefined,
    };
  });
}

/** Rows that will actually be written. */
export function committable<T extends { outcome: RowOutcome }>(rows: T[]): T[] {
  return rows.filter(r => r.outcome !== 'blocked');
}

// ── templates ────────────────────────────────────────────────────────────────

/**
 * Column headings for the downloadable templates.
 *
 * ⚠ THESE ARE HEADINGS ONLY. No template ever ships an example amount: a dollar figure the
 * product puts in a file is a dollar figure the product suggested (D-G1). The template says WHAT
 * to budget for; the coach says how much.
 */
export function monthGridTemplateHeaders(months: MonthKey[]): string[] {
  return ['Category', 'Line', ...months.map(formatMonthLabel), 'Notes'];
}

export const LIST_TEMPLATE_HEADERS = ['Category', 'Line', 'Amount', 'Notes'] as const;

export const PAYABLES_TEMPLATE_HEADERS = [
  'Payee', 'Description', 'Category', 'Amount', 'Due Date',
  'Deposit', 'Deposit Due', 'Balance', 'Balance Due',
] as const;

/**
 * Example ROWS for a template — category and line names drawn from the coach's own taxonomy, with
 * every amount cell left blank. Structure, never numbers: the same rule the budget starter follows.
 */
export function templateExampleRows(
  categories: KnownCategory[],
  columnCount: number,
  limit = 6,
): string[][] {
  const rows: string[][] = [];
  for (const category of categories) {
    for (const item of category.items) {
      rows.push([category.name, item.name, ...Array(Math.max(0, columnCount - 2)).fill('')]);
      if (rows.length >= limit) return rows;
    }
  }
  return rows;
}

// ── the template's own vocabulary sheets ─────────────────────────────────────

/**
 * ⚠ THE FILL-IN SHEET IS CALLED `Data`, AND THAT NAME IS LOAD-BEARING. `parseXLSX` resolves the
 * sheet to read as `getWorksheet('Data')` first, then the first sheet not named instructions or
 * reference, then sheet one. Naming it `Data` means the two vocabulary sheets below can never be
 * mistaken for the grid, whatever order they end up in. (A template downloaded before this change
 * is called `Template` and still parses through the second rule — nothing on disk is invalidated.)
 */
export const TEMPLATE_DATA_SHEET = 'Data';
/** Human-readable. Skipped by the parser BY NAME. */
export const TEMPLATE_REFERENCE_SHEET = 'Reference';
/**
 * The page the file opens on. Skipped by the parser BY NAME — which it must be, since it sits
 * FIRST and would otherwise be exactly what the "first sheet that isn't instructions or reference"
 * fallback picks up on a file whose Data tab a coach renamed.
 */
export const TEMPLATE_GUIDE_SHEET = 'Instructions';
/** Hidden. Feeds the dropdowns, and is never read back. */
export const TEMPLATE_LISTS_SHEET = 'Lists';

export const REFERENCE_SHEET_HEADERS = ['Category', 'Cost name', 'Where it comes from'] as const;

/**
 * The two messages Excel shows beside a cell the moment a coach selects it.
 *
 * ⚠ THIS IS THE ONLY PLACE THE FILL-IN SHEET CAN SPEAK (owner, 2026-09-06). The file ships a
 * Reference tab pairing every cost name with its heading, and nothing on the grid a coach types
 * into mentioned that it exists — so a flat Line list looked like a claim that the pairing does not
 * matter. A sentence anywhere else on that sheet is read back as data on import; a validation
 * prompt is not.
 *
 * ⚠ THEY SAY THE OPPOSITE THINGS ON PURPOSE, because the two columns behave differently and a
 * coach cannot see why. A cost name we have never heard of is CREATED on import. A category we
 * have never heard of BLOCKS the row — the importer will not invent one — and the only place to
 * add it is the Budget page. That asymmetry has always been there and has never been said.
 *
 * ⚠ THE WORD IS "CATEGORY", NEVER "HEADING" (/review, 2026-09-06). These sentences shipped for one
 * review cycle calling it a heading, on a tooltip attached to a column literally titled `Category`,
 * while both money screens say "Pick a category and item". Two words for one thing is a product
 * bug, not a synonym — and it is the exact drift the one-spelling rule exists to catch.
 *
 * Excel truncates at 32 / 255 characters; the writer clips to match, so keep both under.
 */
export const TEMPLATE_CATEGORY_PROMPT = {
  title: 'Pick a category from the list',
  body:
    'Unlike cost names, we can’t create a new category for you at import. If the one you want isn’t '
    + 'here, add it on your Budget page first, then download a fresh template.',
} as const;

export const TEMPLATE_LINE_PROMPT = {
  title: 'Pick the category first',
  body:
    'This list follows the category beside it — choose that, and these names narrow to the ones '
    + 'under it. Leave the category blank and you get every name your team uses. A name we don’t '
    + 'have yet is still fine: type it, and we add it when you import.',
} as const;

const SOURCE_LABELS: Record<BudgetWordSource, string> = {
  standard: 'Standard',
  club: 'Your club',
  team: 'This team',
};

/**
 * Every category and every cost name this team may use, one row each.
 *
 * ⚠ NO AMOUNT COLUMN, AND THERE NEVER WILL BE (D-G1). This sheet answers *what can we budget
 * for*; the coach answers *how much*. A category with no cost names still gets a row, so a coach
 * can see the heading exists rather than concluding we do not have one.
 *
 * ⚠ AND IT SAYS WHICH KIND OF EMPTY IT IS (owner, 2026-09-06). Three headings arrived on a real
 * team's sheet as three identical blank rows, and they were not one thing: one was a club heading
 * with no cost names yet, two were income headings whose every word this spending sheet filters
 * out. A blank cell reads as data that failed to load — the coach's fair conclusion was "I can't
 * budget under these", when in fact they can budget under all three by typing the cost themselves.
 */
export const NO_COST_NAMES_YET = 'No cost names yet — type your own';
export const INCOME_NAMES_ONLY = 'Income names only — type your own';

/** The sentence under the Reference table, saying once what the two labels above imply.
 *
 * ⚠ THE SECOND SENTENCE KEEPS THE FIRST ONE TRUE (2026-09-10). The template is still built for
 * spending — its Line dropdown offers cost names and nothing else — but the importer now reads the
 * plan file's two bands, so "spending only" had quietly become half a fact: a coach CAN plan money
 * in from this sheet, by typing the band row the plan file itself writes. Saying so is cheaper than
 * a coach discovering it from a support answer, and far cheaper than the sentence going stale. */
export const REFERENCE_SHEET_NOTE =
  'This template plans spending. A category with no cost names still works — type the cost '
  + 'yourself and we add it to your list when you import. To plan money coming in as well, add a '
  + 'row that says FUNDING and list those lines under it, the way your exported plan does.';

export function referenceSheetRows(categories: KnownCategory[]): string[][] {
  const rows: string[][] = [];
  for (const category of categories) {
    if (category.items.length === 0) {
      /* The third column stays blank DELIBERATELY: it says where a cost NAME came from, and there
         is no name on this row to answer for. Filling it with the category's own provenance would
         be a different question answered in the same column. */
      rows.push([
        category.name,
        category.incomeItems.length > 0 ? INCOME_NAMES_ONLY : NO_COST_NAMES_YET,
        '',
      ]);
      continue;
    }
    for (const item of category.items) {
      rows.push([category.name, item.name, item.source ? SOURCE_LABELS[item.source] : '']);
    }
  }
  return rows;
}

/**
 * The columns the Excel dropdowns point at.
 *
 * `categories` keeps the library's own order, because that is the order the coach's picker shows
 * them in. `items` is every cost name once, sorted — the fallback list, used on a row whose
 * category is blank or is a name we do not hold. `pairs` is the same vocabulary written out one
 * row per category-and-name, GROUPED, which is what makes the Line dropdown follow column A.
 *
 * ⚠ THE LIST USED TO BE FLAT, AND THAT WAS THE WRONG CALL (owner, 2026-09-06). The note here
 * argued a dependent list needed `INDIRECT()` over one defined name per category, that an Excel
 * name cannot hold a space or an `&` ("League & Fees", "Team Gear"), and that sanitizing collides.
 * All true, and all beside the point: `OFFSET`+`MATCH` over a grouped pair block needs no defined
 * names at all, so the constraint that ruled the feature out never applied to the way it is
 * actually built. A coach reading "Team Gear" in column A was being offered "Entry Fees",
 * "Insurance" and "League registration" for a whole season of rows.
 *
 * ⚠ GROUPING IS LOAD-BEARING, NOT TIDINESS. `MATCH` finds a category's FIRST pair row and
 * `COUNTIF` counts how many it has; the dropdown is that block. Interleave two categories and the
 * block silently spans the wrong names. Category order here must therefore stay stable, and items
 * are sorted only WITHIN a category, never across.
 */
export function templateChoiceLists(categories: KnownCategory[]): {
  categories: string[];
  items: string[];
  pairs: Array<[string, string]>;
} {
  /* ⚠⚠ SAME-NAMED CATEGORIES ARE MERGED FIRST, AND THIS IS THE LOAD-BEARING STEP (/review,
     2026-09-06). `budget_categories.name` has NO unique index — the dictionary says duplicates are
     silently allowed, and the ordinary way to get one is a club publishing "Travel" while the
     platform already ships "Travel", both of which a team can see. Grouped per CATEGORY OBJECT that
     produces two separate blocks under one name, and the dropdown formula cannot survive it: MATCH
     finds the FIRST block while COUNTIF counts BOTH, so OFFSET returns one over-long slice starting
     at the first — quietly serving an unrelated category's cost names. Merging by NAME is also the
     granularity everything else here already uses: the importer matches a row's category by name,
     not by id. */
  const merged = new Map<string, { name: string; names: string[] }>();
  for (const category of categories) {
    const ck = key(category.name);
    if (!ck) continue;
    const entry = merged.get(ck) ?? { name: category.name, names: [] };
    for (const item of category.items) if (key(item.name)) entry.names.push(item.name);
    merged.set(ck, entry);
  }

  const seen = new Set<string>();
  const items: string[] = [];
  const pairs: Array<[string, string]> = [];
  for (const entry of merged.values()) {
    const withinBlock = new Set<string>();
    const names = entry.names
      .filter(name => {
        const k = key(name);
        if (withinBlock.has(k)) return false; // the merge can hand us the same word twice
        withinBlock.add(k);
        return true;
      })
      .sort((a, b) => a.localeCompare(b, 'en-CA'));
    for (const name of names) {
      pairs.push([entry.name, name]);
      const k = key(name);
      if (seen.has(k)) continue;
      seen.add(k);
      items.push(name);
    }
  }
  return {
    // De-duplicated too, so the Category dropdown never lists one name twice.
    categories: [...merged.values()].map(e => e.name),
    items: items.sort((a, b) => a.localeCompare(b, 'en-CA')),
    pairs,
  };
}

/**
 * The two colours the template paints on itself, and the sentences that explain them.
 *
 * ⚠ NEITHER ONE MEANS "WRONG", AND THEY DO NOT MEAN THE SAME THING — which is the entire reason
 * they are two colours rather than one. Sand on a cost name says *we are about to create this*;
 * the import proceeds and the coach gets a new word in their list. Rust on a category says *we
 * cannot file this at all*; the importer will not invent a category, so that row is refused. One
 * colour for both would tell a coach their perfectly good new cost name was an error.
 *
 * ⚠ THE LEGEND IS RENDERED IN THESE SAME VALUES on the guide sheet, so a colour cannot drift from
 * its own explanation — the swatch a coach reads is painted from the constant that paints the cell.
 */
export const NEW_NAME_TINT = { fill: 'FFFCEBD0', font: 'FF7A5310' } as const;
export const NO_SUCH_CATEGORY_TINT = { fill: 'FFF7DDD4', font: 'FF8C3B22' } as const;

/** `0 → 'A'`, `26 → 'AA'`. The category column is always low, but the formula must not assume it. */
function columnLetter(index: number): string {
  let n = index;
  let out = '';
  do {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
}

/**
 * The Line column's dropdown source for ONE row: the cost names under whatever category that row
 * names, falling back to every name when it names none we hold.
 *
 * Reading it left to right: if the category cell matches nothing in the pair block, offer the whole
 * de-duplicated list (what a coach got before, and the right answer for an empty row or a brand-new
 * category). Otherwise walk down the pair block to that category's first row and take as many rows
 * as it has.
 *
 * ⚠ IT NARROWS WHAT IS OFFERED, NEVER WHAT IS ACCEPTED. The writer keeps `showErrorMessage` off, so
 * a coach can still type a cost this team has no word for — the importer exists to create it. A
 * dependent list that refused would turn a convenience into a wall, on the one field that must stay
 * open.
 *
 * ⚠ NO LEADING `=`, and the whole thing must stay under 255 characters — see `XlsxColumnChoice`.
 * With four-digit row numbers this lands near 150, so there is room, but a longer formula fails by
 * DISAPPEARING rather than erroring.
 */
export function lineChoiceFormula(
  sheetRow: number,
  categoryColumnIndex: number,
  itemCount: number,
  pairCount: number,
): string {
  const cat = `$${columnLetter(categoryColumnIndex)}${sheetRow}`;
  const pairCats = `${TEMPLATE_LISTS_SHEET}!$C$2:$C$${pairCount + 1}`;
  const allNames = `${TEMPLATE_LISTS_SHEET}!$B$2:$B$${itemCount + 1}`;
  const found = `COUNTIF(${pairCats},${cat})`;
  return `IF(${found}=0,${allNames},OFFSET(${TEMPLATE_LISTS_SHEET}!$D$2,MATCH(${cat},${pairCats},0)-1,0,${found},1))`;
}

/**
 * When to tint a cost name: both cells filled, and this exact pairing is not one we hold.
 *
 * ⚠ BOTH CELLS, DELIBERATELY. Tinting a cost name typed before its category would light up half
 * the sheet while a coach is still filling it in, and the thing it would be complaining about is
 * the coach not having finished yet.
 *
 * ⚠ Written for the FIRST fill-in row only — Excel shifts a conditional rule down its own range.
 * See `XlsxColumnFlag`.
 */
export function newNameFlagFormula(
  firstDataRow: number,
  categoryColumnIndex: number,
  lineColumnIndex: number,
  pairCount: number,
): string {
  const cat = `$${columnLetter(categoryColumnIndex)}${firstDataRow}`;
  const line = `$${columnLetter(lineColumnIndex)}${firstDataRow}`;
  const pairs = `${TEMPLATE_LISTS_SHEET}!$C$2:$C$${pairCount + 1},${cat},${TEMPLATE_LISTS_SHEET}!$D$2:$D$${pairCount + 1},${line}`;
  return `AND(${cat}<>"",${line}<>"",COUNTIFS(${pairs})=0)`;
}

/** When to tint a category: something is typed there, and it is not a category this team has. */
export function unknownCategoryFlagFormula(
  firstDataRow: number,
  categoryColumnIndex: number,
  categoryCount: number,
): string {
  const cat = `$${columnLetter(categoryColumnIndex)}${firstDataRow}`;
  return `AND(${cat}<>"",COUNTIF(${TEMPLATE_LISTS_SHEET}!$A$2:$A$${categoryCount + 1},${cat})=0)`;
}

/**
 * The page a coach lands on when the file opens.
 *
 * ⚠ POINT FORM, AND SHORT ENOUGH TO BE READ ONCE (owner, 2026-09-06). A guide sheet costs every
 * coach one extra click on every download, forever — so it has to earn that click by answering the
 * three things this template cannot say anywhere else: which tab to type in, that a cost name may
 * be invented but a category may not, and what the two colours mean.
 *
 * ⚠ EVERY LINE LIVES IN COLUMN A. `parseXLSX` reads a sheet called `Instructions` as key/value
 * metadata off columns A and B — see `XlsxGuideSheet`. A legend entry therefore wears its colour as
 * its OWN cell fill rather than sitting beside a swatch, which is the layout that would have put
 * text in column B.
 */
export function templateGuideLines(shape: BudgetImportShape): XlsxGuideLine[] {
  const bullet = (text: string): XlsxGuideLine => ({ text, as: 'bullet' });

  /* ⚠ THREE SHAPES, THREE ANSWERS — NOT "payables and everything else" (/review, 2026-09-06). This
     read `isPayables ? … : …` for one review cycle, which told a coach downloading the Simple list
     template to "put each amount in the month you expect to pay it" on a sheet whose only money
     column is called Amount. A guide describing columns that are not there is worse than no guide:
     it is the one surface a coach has no way to check against. */
  const perShape: Record<BudgetImportShape, { unit: string; columns: XlsxGuideLine[]; hasCostNames: boolean }> = {
    'month-grid': {
      unit: 'one cost line per row',
      hasCostNames: true,
      columns: [
        bullet('Category — pick from the dropdown.'),
        bullet('Line — the cost’s name. The list narrows to the category you picked on that row.'),
        bullet('The month columns — put each amount in the month you expect to pay it. A row with no amount anywhere is held back for you to fix.'),
      ],
    },
    list: {
      unit: 'one cost line per row',
      hasCostNames: true,
      columns: [
        bullet('Category — pick from the dropdown.'),
        bullet('Line — the cost’s name. The list narrows to the category you picked on that row.'),
        bullet('Amount — the whole cost, with no date attached. You can schedule it later on your Budget page.'),
      ],
    },
    payables: {
      unit: 'one bill per row',
      hasCostNames: false,
      columns: [
        bullet('Payee and Description — who you owe, and what for. Both are your own words.'),
        bullet('Category — pick from the dropdown.'),
        bullet('Due Date — use YYYY-MM-DD. An ambiguous date is left blank rather than guessed.'),
        bullet('Deposit and Balance — fill these in only when the bill is paid in two parts.'),
      ],
    },
  };
  const plan = perShape[shape];

  return [
    { text: 'How to use this template', as: 'title' },
    { text: `Fill in the Data tab — ${plan.unit}. Nothing is saved until you upload it and check it on screen.` },
    {},
    { text: 'The columns', as: 'heading' },
    ...plan.columns,
    /* ⚠ NAMES THE THREE FIELDS THE REVIEW SCREEN CAN ACTUALLY EDIT, and no more. A row's category,
       cost name and amount are all editable there; a total already added up from month columns is
       shown read-only, because editing it would disagree with the schedule it is about to write.
       "Fix anything on screen" would have promised the one thing the screen does not do. */
    bullet('Leave anything you don’t know blank — category, name and amount can all be set on screen before anything is saved.'),
    {},
    { text: 'Your own words', as: 'heading' },
    ...(plan.hasCostNames
      ? [bullet('A cost name we don’t have is fine — type it, and we add it to your team’s list when you import.')]
      : [bullet('Payee and Description are free text — write them however your team says them.')]),
    bullet('A category cannot be created this way. If the one you want isn’t in the dropdown, add it on your Budget page first, then download the template again.'),
    {},
    { text: 'What the colours mean', as: 'heading' },
    /* ⚠ ONLY THE COLOURS THIS SHEET CAN ACTUALLY SHOW. The bills template has no cost-name column,
       so its sand tint can never fire — explaining it there sends a coach looking for something
       that will not happen. */
    ...(plan.hasCostNames
      ? [{
        /* ⚠ SAYS "ISN'T ALREADY UNDER", NOT "IS NEW" (/review, 2026-09-06). Excel can only compare
           the text exactly; the importer is more forgiving — it forgives punctuation, doubled
           spaces and case, and snaps a near-miss to the word you already have. So "Entry-Fees"
           tints, and is then MATCHED rather than created. Promising "we'll create it" would be
           wrong in exactly the cases a coach is most likely to hit by typing. */
        text: 'A cost name that isn’t already under that category. Nothing is wrong — the review screen says whether we match it to one you have or add it as new.',
        as: 'bullet' as const,
        fillArgb: NEW_NAME_TINT.fill,
        fontArgb: NEW_NAME_TINT.font,
      }]
      : []),
    {
      text: 'A category we don’t have. This row will be held back — pick one from the dropdown, or add it on your Budget page.',
      as: 'bullet',
      fillArgb: NO_SUCH_CATEGORY_TINT.fill,
      fontArgb: NO_SUCH_CATEGORY_TINT.font,
    },
    {},
    { text: 'Reference tab', as: 'heading' },
    /* ⚠ THE THREE WORDS THE REFERENCE TAB ACTUALLY PRINTS (`SOURCE_LABELS`), not a paraphrase of
       them. This said "came from us, your club, or this team", which leaves a coach to work out
       for themselves that "us" is the column reading "Standard". */
    bullet('Every category and cost name your team can use, and whether each is marked Standard, Your club, or This team.'),
  ];
}

/**
 * The whole Excel template, assembled once: its example rows, its dropdowns, the sentence each
 * dropdown says, and its two vocabulary sheets.
 *
 * ⚠ IT LIVES HERE SO THE TEST CAN OPEN THE REAL FILE. The workbook test used to rebuild this by
 * hand under a comment claiming it was "exactly what the sheet hands the writer" — which is a claim
 * that decays silently, and was about to, since this template gained cell messages and a note the
 * copy knew nothing about. One builder, two callers, no second version to keep true.
 *
 * The CSV path deliberately does not come through here: a CSV carries no second tab and no
 * dropdown, so there is nowhere to put any of it.
 */
export function budgetTemplateWorkbook(
  headers: string[],
  categories: KnownCategory[],
  shape: BudgetImportShape = 'month-grid',
): { rows: string[][]; options: XlsxOptions } {
  const rows = templateExampleRows(categories, headers.length);
  const choices = templateChoiceLists(categories);

  const columnChoices: (XlsxColumnChoice | undefined)[] = headers.map(() => undefined);
  const columnChoicePrompts: ({ title: string; body: string } | undefined)[] = headers.map(() => undefined);

  const categoryColumn = headers.indexOf('Category');
  // The bills sheet has no Line column — a payable's description is genuinely free text.
  const lineColumn = headers.indexOf('Line');

  if (categoryColumn >= 0 && choices.categories.length > 0) {
    columnChoices[categoryColumn] = `${TEMPLATE_LISTS_SHEET}!$A$2:$A$${choices.categories.length + 1}`;
    columnChoicePrompts[categoryColumn] = { ...TEMPLATE_CATEGORY_PROMPT };
  }
  if (lineColumn >= 0 && choices.items.length > 0) {
    /* ⚠ A FUNCTION, BECAUSE THIS LIST FOLLOWS THE ROW. Every other dropdown in the product is one
       range for a whole column; this one has to name the category cell BESIDE it, which is a
       different formula on every row. It degrades to the old flat list on any row whose category
       is blank or unrecognised, so a coach who fills the sheet out of order is never stuck. */
    columnChoices[lineColumn] = categoryColumn >= 0 && choices.pairs.length > 0
      ? (sheetRow: number) => lineChoiceFormula(
        sheetRow, categoryColumn, choices.items.length, choices.pairs.length,
      )
      : `${TEMPLATE_LISTS_SHEET}!$B$2:$B$${choices.items.length + 1}`;
    columnChoicePrompts[lineColumn] = { ...TEMPLATE_LINE_PROMPT };
  }

  /* Four columns, two jobs. A and B are the plain lists (categories, and every cost name once).
     C and D are the same vocabulary paired and grouped, which is the only thing the dependent
     dropdown can read — see `templateChoiceLists` for why the grouping cannot be disturbed. */
  const listRows: string[][] = [];
  const listDepth = Math.max(choices.categories.length, choices.items.length, choices.pairs.length);
  for (let i = 0; i < listDepth; i += 1) {
    listRows.push([
      choices.categories[i] ?? '',
      choices.items[i] ?? '',
      choices.pairs[i]?.[0] ?? '',
      choices.pairs[i]?.[1] ?? '',
    ]);
  }

  /* ── The tints ────────────────────────────────────────────────────────────────────────────
     Written for the FIRST fill-in row, which on every template shape is the row under the header;
     Excel walks the rule down the column itself. See `XlsxColumnFlag`. */
  const columnFlags: (XlsxColumnFlag | undefined)[] = headers.map(() => undefined);
  if (categoryColumn >= 0 && choices.categories.length > 0) {
    columnFlags[categoryColumn] = {
      formula: first => unknownCategoryFlagFormula(first, categoryColumn, choices.categories.length),
      fillArgb: NO_SUCH_CATEGORY_TINT.fill,
      fontArgb: NO_SUCH_CATEGORY_TINT.font,
    };
  }
  if (lineColumn >= 0 && categoryColumn >= 0 && choices.pairs.length > 0) {
    columnFlags[lineColumn] = {
      formula: first => newNameFlagFormula(first, categoryColumn, lineColumn, choices.pairs.length),
      fillArgb: NEW_NAME_TINT.fill,
      fontArgb: NEW_NAME_TINT.font,
    };
  }

  return {
    rows,
    options: {
      columnChoices,
      columnChoicePrompts,
      columnFlags,
      guideSheet: { name: TEMPLATE_GUIDE_SHEET, lines: templateGuideLines(shape) },
      // Every row a coach could fill in, not just the examples we ship.
      choiceRowCount: MAX_IMPORT_ROWS,
      extraSheets: [
        {
          name: TEMPLATE_REFERENCE_SHEET,
          headers: [...REFERENCE_SHEET_HEADERS],
          rows: referenceSheetRows(categories),
          note: REFERENCE_SHEET_NOTE,
        },
        {
          name: TEMPLATE_LISTS_SHEET,
          /* ⚠⚠ NOT ONE OF THESE MAY BE A COLUMN NAME THE READER RECOGNISES (/review, 2026-09-06).
             Column C was briefly called `Category`, which is an exact `ALIASES.category` match. This
             sheet is hidden, but `parseXLSX`'s fallback skips sheets called instructions/reference
             BY NAME and knows nothing about `Lists` — so a coach who DELETES the Data tab had their
             lookup table parsed as a budget, and because the header now matched, it produced
             plausible rows full of real category names instead of failing cleanly. Guarded by a
             test; keep every heading here outside `ALIASES`. */
          headers: ['Categories', 'All cost names', 'Paired category', 'Paired cost name'],
          rows: listRows,
          hidden: true,
        },
      ],
    },
  };
}

/** A month range for a template when the team has no dated money yet: a year from this month. */
export function templateMonths(existing: MonthKey[], todayMonth: MonthKey, span = 12): MonthKey[] {
  if (existing.length > 0) return existing;
  const out: MonthKey[] = [];
  let year = Number(todayMonth.slice(0, 4));
  let month = Number(todayMonth.slice(5, 7));
  for (let i = 0; i < span; i++) {
    out.push(`${year}-${String(month).padStart(2, '0')}`);
    month += 1;
    if (month > 12) { month = 1; year += 1; }
  }
  return out;
}

