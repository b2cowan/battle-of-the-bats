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

export interface RowVerdict {
  outcome: RowOutcome;
  /** Why it is blocked, or what an update will change — always in the coach's language. */
  reason?: string;
  /** The existing budget line this row updates, when matched. */
  matchedLineId?: string;
  /** Worth a look, never blocking. */
  warning?: string;
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
  undated:     ['no date yet', 'no date', 'undated'],
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
 * Understands an explicit year (`2026-09`, `Sep 2026`, `Sep '26` — the app's own export format)
 * and a bare month name. A bare month has no year of its own, so the reader carries one: it
 * starts at the season year and rolls forward when the months wrap round (Sep, Oct, … Jan), which
 * is exactly how a season spreadsheet reads left to right.
 */
export function parseMonthHeader(header: string, carriedYear: number): { month: MonthKey; year: number } | null {
  const text = (header ?? '').trim();
  if (!text) return null;

  const isoish = text.match(/^(\d{4})[-/](\d{1,2})$/);
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

/** The export writes line rows as `  — Entry Fees` under their category. */
function stripLineIndent(value: string): { text: string; indented: boolean } {
  const raw = value ?? '';
  const match = raw.match(/^\s*[—–-]\s*(.*)$/);
  if (match) return { text: match[1].trim(), indented: true };
  return { text: raw.trim(), indented: /^\s{2,}/.test(raw) };
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
      const { text, indented } = stripLineIndent(combined.value);
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
      const { text, indented } = stripLineIndent(combined.value);
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

export interface KnownCategory {
  id: string;
  name: string;
  items: Array<{ id: string; name: string }>;
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
    return { ...base, outcome: 'add' as const };
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

