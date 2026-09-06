import { getCell } from './import/tabular.ts';
import type { ParsedImportFile } from './import/types.ts';
import { formatMonthLabel, type MonthKey } from './coach-budget-months.ts';

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
const ALIASES = {
  category:    ['category', 'cat', 'budget category'],
  line:        ['line', 'line item', 'item', 'description', 'cost', 'what'],
  combined:    ['category / line', 'category line', 'category or line'],
  amount:      ['amount', 'total', 'cost', 'budget', 'estimated', 'estimate'],
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

/** Rows the app's own export adds that are derived, not data. */
const DERIVED_ROW_LABELS = new Set(['total', 'money in', 'money out', 'running balance', 'grand total']);

function isDerivedRow(label: string): boolean {
  return DERIVED_ROW_LABELS.has(label.trim().toLowerCase().replace(/^[—–-]\s*/, ''));
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

  for (const source of file.rows) {
    const combined = getCell(source, [...ALIASES.combined]);
    let categoryName = getCell(source, [...ALIASES.category]).value.trim();
    let lineName = getCell(source, [...ALIASES.line]).value.trim();

    if (combined.present && !lineName) {
      const { text, indented } = stripLineIndent(combined.value, source.indented);
      if (!text || isDerivedRow(text)) continue;
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
 * The vocabulary an import may match against.
 *
 * ⚠ COST WORDS ONLY. Every caller filters `direction` to `out` before building this, because the
 * importer writes cost lines and nothing else. Migration 248 made a word's SIDE part of what
 * identifies it — "Grant" the income and "Grant" the application fee are two different words, and
 * the coach's own picker shows one side at a time — so an unfiltered list lets a cost row attach
 * itself to an income word the coach was never offered.
 */
export interface KnownCategory {
  id: string;
  name: string;
  items: KnownItem[];
}

/**
 * The one place a budget taxonomy becomes an import vocabulary.
 *
 * Structurally typed rather than importing `BudgetCategoryWithItems`, so this module stays free of
 * `lib/types` and can be pulled into a client bundle unchanged.
 *
 * ⚠ THE DIRECTION FILTER IS THE POINT OF HAVING THIS FUNCTION AT ALL. Three screens mount the
 * import sheet and each used to write the mapping out by hand; the day one of them needed a filter,
 * all three needed it, and nothing would have said so.
 */
export function toKnownCategories(
  categories: Array<{
    id: string;
    name: string;
    items: Array<{ id: string; name: string; orgId: string | null; teamId: string | null; direction: string }>;
  }>,
): KnownCategory[] {
  return categories.map(c => ({
    id: c.id,
    name: c.name,
    items: c.items
      .filter(i => i.direction === 'out')
      .map(i => ({
        id: i.id,
        name: i.name,
        // The three tiers migration 240 built, said in words a coach reads.
        source: (i.orgId === null ? 'standard' : i.teamId === null ? 'club' : 'team') as BudgetWordSource,
      })),
  }));
}

export interface ExistingBudgetLine {
  id: string;
  description: string;
  categoryName: string | null;
  totalAmount: number;
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
    const lineName = category
      ? soleMatch(row.lineName, category.items.map(i => i.name)) ?? row.lineName
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
): { warning: string; suggestion?: RowSuggestion } | null {
  const typed = normalizeWord(lineName);
  if (!typed) return null;
  if (category.items.some(i => normalizeWord(i.name) === typed)) return null;

  // The exact word, under a different heading. A stronger signal than any fuzzy match here, so it
  // is tested first: the coach knows the word, they have filed it in the wrong place.
  const elsewhere = categories.find(
    c => c.id !== category.id && c.items.some(i => normalizeWord(i.name) === typed),
  );
  if (elsewhere) {
    return {
      warning: `“${lineName}” is already under ${elsewhere.name} — this adds a second one under ${category.name}.`,
      suggestion: { categoryName: elsewhere.name, label: elsewhere.name },
    };
  }

  const near = category.items.filter(i => isNearMatch(typed, normalizeWord(i.name)));
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
  const existingByPair = new Map<string, ExistingBudgetLine>();
  for (const line of existing) {
    existingByPair.set(`${key(line.categoryName ?? '')}|${key(line.description)}`, line);
  }

  // Two rows in one sheet that name the same line would fight each other on commit.
  const seen = new Map<string, number>();
  for (const row of rows) {
    const pair = `${key(row.categoryName)}|${key(row.lineName)}`;
    seen.set(pair, (seen.get(pair) ?? 0) + 1);
  }

  return rows.map(row => {
    const total = moneyValue(row.amount) ?? 0;
    const pair = `${key(row.categoryName)}|${key(row.lineName)}`;
    const base = { ...row, total };

    if (!row.lineName) {
      return { ...base, outcome: 'blocked' as const, reason: 'No name for this cost — add one, or leave the row out.' };
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
    const verdict = newWordVerdict(row.lineName, category, categories);
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
/** Hidden. Feeds the dropdowns, and is never read back. */
export const TEMPLATE_LISTS_SHEET = 'Lists';

export const REFERENCE_SHEET_HEADERS = ['Category', 'Cost name', 'Where it comes from'] as const;

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
 */
export function referenceSheetRows(categories: KnownCategory[]): string[][] {
  const rows: string[][] = [];
  for (const category of categories) {
    if (category.items.length === 0) {
      rows.push([category.name, '', '']);
      continue;
    }
    for (const item of category.items) {
      rows.push([category.name, item.name, item.source ? SOURCE_LABELS[item.source] : '']);
    }
  }
  return rows;
}

/**
 * The de-duplicated columns the Excel dropdowns point at.
 *
 * Categories keep the library's own order, because that is the order the coach's picker shows
 * them in. Cost names are sorted, because the list is FLAT — one dropdown holding every word,
 * rather than one that changes with the category chosen in that row.
 *
 * ⚠ FLAT IS A DECISION, NOT A SHORTCUT. A dependent list needs `INDIRECT()` over one defined name
 * per category, and an Excel defined name cannot contain a space or an `&` — "League & Fees" and
 * "Team Gear" both break it, two sanitised names can collide, and none of it survives a trip
 * through Google Sheets. A flat list kills the typo, which is the whole point; a name paired with
 * the wrong heading is then caught in the review step, which can say something more useful than a
 * greyed-out cell ("Entry Fees is already under Tournaments").
 */
export function templateChoiceLists(categories: KnownCategory[]): { categories: string[]; items: string[] } {
  const seen = new Set<string>();
  const items: string[] = [];
  for (const category of categories) {
    for (const item of category.items) {
      const k = key(item.name);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      items.push(item.name);
    }
  }
  return {
    categories: categories.map(c => c.name),
    items: items.sort((a, b) => a.localeCompare(b, 'en-CA')),
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

