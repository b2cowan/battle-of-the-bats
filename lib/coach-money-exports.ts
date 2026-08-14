/**
 * lib/coach-money-exports.ts
 * The column contracts and row builders behind every Money export.
 *
 * ⚠ THESE ARE PURE FUNCTIONS OVER DATA THE CALLER ALREADY HAS — they do no fetching, and that is
 * the point. An earlier build had one hub-wide Export menu that fetched each dataset itself, and
 * it could not survive contact with the screens: Budget vs. Actual has two shapes and four
 * readings, Budget Plan has two, Expenses has three sub-tabs and a tag filter. A menu above the
 * tab bar cannot see any of it, so it could only ever offer a generic version and hope that was
 * what the coach meant — which is exactly how Budget vs. Actual ended up with two buttons both
 * saying "Export" and producing different files (owner ruling 2026-08-13, mockup artifact
 * 96675523).
 *
 * So Export now lives on each TAB, beside the switches that decide what it contains, and each tab
 * passes in what is on screen. This module keeps the two things worth sharing: what the columns
 * are called, and how a row is built from a record. One definition each, so the same dataset can
 * never come out two different ways.
 */
import type { ExportColumnDef } from './export';
import {
  buildFilename, serializeHeaders, serializeRows, generateCSV, downloadCSVBlob, downloadXLSX,
  downloadPDF, DEFAULT_PDF_SETTINGS, type OrgPdfSettings,
} from './export';
import { duesStatusLabel } from './dues-status';
import type { RepBudgetLineWithPeriods, RepTeamExpense } from './types';

export type MoneyExportFormat = 'xlsx' | 'csv' | 'pdf';

/** A row is a flat bag of primitives — the shape `serializeRows` consumes. */
export type ExportRow = Record<string, string | number>;

/**
 * Currency for a PDF cell.
 *
 * ⚠ IT KEEPS THE MINUS SIGN, and that is the entire point. A first version of this helper called
 * `Math.abs()` — copied from a screen formatter whose callers print the sign separately — and it
 * silently turned a player $50 IN CREDIT into "$50.00", indistinguishable from a player who OWES
 * $50 (/review finding, 2026-08-13). A spreadsheet cell keeps the raw signed number, so only the
 * PDF path was affected, which is exactly how it would have reached a parent unnoticed.
 *
 * Anything that wants to print the sign itself must pass an absolute value in.
 */
function money(n: number): string {
  const str = Math.abs(n).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n < 0 ? `-$${str}` : `$${str}`;
}

// ── Budget lines ────────────────────────────────────────────────────────────────────────────

export const BUDGET_LINE_COLUMNS: ExportColumnDef[] = [
  { label: 'Category',         key: 'category', format: 'text' },
  { label: 'Line',             key: 'line',     format: 'text' },
  // Costs and expected funding are both positive amounts — the KIND carries the sign
  // (migration 230). A spreadsheet with no kind column would read a $4,000 fundraising target
  // as $4,000 of spending.
  { label: 'Kind',             key: 'kind',     format: 'text' },
  { label: 'Amount',           key: 'amount',   format: 'currency' },
  { label: 'Payment schedule', key: 'schedule', format: 'text' },
  { label: 'Notes',            key: 'notes',    format: 'text' },
];

export function budgetLineRows(lines: RepBudgetLineWithPeriods[]): ExportRow[] {
  return lines.map(l => ({
    category: l.categoryName ?? '',
    line: l.description,
    kind: l.lineKind === 'funding' ? 'Expected fundraising' : 'Cost',
    amount: l.totalAmount,
    // The month split flattened into one readable cell. A column per month would make the
    // sheet's width depend on the season — that is the Budget-vs-Actual month grid's job.
    schedule: (l.periods ?? []).map(p => `${p.periodLabel}: ${money(p.amount)}`).join('; '),
    notes: l.notes ?? '',
  }));
}

// ── Player dues ─────────────────────────────────────────────────────────────────────────────

export const DUES_EXPORT_COLUMNS: ExportColumnDef[] = [
  { label: 'Player',     key: 'player',    format: 'text' },
  { label: 'Total Dues', key: 'totalDues', format: 'currency' },
  { label: 'Credits',    key: 'credits',   format: 'currency' },
  { label: 'Paid',       key: 'paid',      format: 'currency' },
  { label: 'Balance',    key: 'balance',   format: 'currency' },
  { label: 'Status',     key: 'status',    format: 'text' },
];

export type DuesExportPlayer = {
  player: { playerFirstName: string; playerLastName: string | null };
  schedule: { totalAmount: number } | null;
  paidAmount: number;
  totalCredits: number;
  rollingBalance: number;
};

export function duesExportRows(players: DuesExportPlayer[]): ExportRow[] {
  return players.map(p => ({
    player: [p.player.playerFirstName, p.player.playerLastName].filter(Boolean).join(' '),
    totalDues: p.schedule?.totalAmount ?? '',
    credits: p.totalCredits || '',
    paid: p.schedule ? p.paidAmount : '',
    balance: p.schedule ? p.rollingBalance : '',
    // ⚠ The shared word list, so the table and the file cannot call one player two things.
    status: duesStatusLabel(p),
  }));
}

/** Currency pre-formatted as strings — jsPDF has no number formatter. */
export function duesPdfRows(rows: ExportRow[]): (string | number)[][] {
  return rows.map(r => [
    String(r.player),
    r.totalDues !== '' ? money(Number(r.totalDues)) : '—',
    r.credits !== '' ? money(Number(r.credits)) : '—',
    r.paid !== '' ? money(Number(r.paid)) : '—',
    r.balance !== '' ? money(Number(r.balance)) : '—',
    String(r.status),
  ]);
}

// ── Expenses & payables ─────────────────────────────────────────────────────────────────────
// ⚠ NOTES ARE DELIBERATELY OUT. An expense note is free text a coach may have used for anything;
// keeping it off the export leaves this dataset free of any sensitive-field policy.

export const EXPENSE_COLUMNS: ExportColumnDef[] = [
  { label: 'Description',  key: 'description', format: 'text' },
  { label: 'Category',     key: 'category',    format: 'text' },
  { label: 'Amount',       key: 'amount',      format: 'currency' },
  { label: 'Paid',         key: 'paid',        format: 'text' },
  { label: 'Deposit',      key: 'deposit',     format: 'currency' },
  { label: 'Deposit due',  key: 'depositDue',  format: 'date' },
  { label: 'Balance',      key: 'balance',     format: 'currency' },
  { label: 'Balance due',  key: 'balanceDue',  format: 'date' },
  { label: 'Payee',        key: 'payee',       format: 'text' },
];

export function expenseRows(expenses: RepTeamExpense[]): ExportRow[] {
  return expenses.map(e => ({
    description: e.description,
    category: e.category ?? '',
    amount: e.amount,
    // A payable is paid in two parts, so "paid" is a sentence rather than a tick; the
    // deposit/balance columns beside it carry the detail.
    paid: e.expenseType === 'tournament_payable'
      ? [e.depositPaidAt ? 'Deposit paid' : '', e.balancePaidAt ? 'Balance paid' : ''].filter(Boolean).join(' · ') || 'Unpaid'
      : e.expensePaidAt ? 'Paid' : 'Unpaid',
    deposit: e.depositAmount ?? '',
    depositDue: e.depositDueDate ?? '',
    balance: e.balanceAmount ?? '',
    balanceDue: e.balanceDueDate ?? '',
    payee: e.payeePayer ?? '',
  }));
}

/** The payment-schedule sub-tab: one dated commitment per row, across both lanes. */
export const SCHEDULE_COLUMNS: ExportColumnDef[] = [
  { label: 'Due date',    key: 'dueDate',     format: 'date' },
  { label: 'What',        key: 'description', format: 'text' },
  { label: 'From',        key: 'source',      format: 'text' },
  { label: 'Amount',      key: 'amount',      format: 'currency' },
  { label: 'Status',      key: 'status',      format: 'text' },
];

export function scheduleRows(
  rows: Array<{ description: string; amount: number; dueDate: string | null; paid?: boolean; overdue: boolean; source: 'team' | 'org' }>,
): ExportRow[] {
  return rows.map(r => ({
    dueDate: r.dueDate ?? '',
    description: r.description,
    source: r.source === 'org' ? 'Club' : 'Team',
    amount: r.amount,
    status: r.paid ? 'Paid' : r.overdue ? 'Overdue' : 'Due',
  }));
}

// ── Fundraisers ─────────────────────────────────────────────────────────────────────────────
// ⚠ Per-fundraiser totals ONLY — never the per-player breakdown, which names children beside the
// money they raised and stays on the fundraiser's own page.

export const FUNDRAISER_COLUMNS: ExportColumnDef[] = [
  { label: 'Fundraiser',     key: 'name',     format: 'text' },
  { label: 'Rebate %',       key: 'rebate',   format: 'number' },
  { label: 'Starts',         key: 'starts',   format: 'date' },
  { label: 'Ends',           key: 'ends',     format: 'date' },
  { label: 'Total raised',   key: 'raised',   format: 'currency' },
  { label: 'Player credits', key: 'credits',  format: 'currency' },
  { label: 'Team net',       key: 'net',      format: 'currency' },
  { label: 'Players',        key: 'players',  format: 'number' },
];

export function fundraiserRows(
  list: Array<{
    name: string; playerRebatePercent: number; startDate: string | null; endDate: string | null;
    totalRaised: number; totalCredits: number; teamNet: number; playerCount: number;
  }>,
): ExportRow[] {
  return list.map(f => ({
    name: f.name,
    rebate: f.playerRebatePercent,
    starts: f.startDate ?? '',
    ends: f.endDate ?? '',
    raised: f.totalRaised,
    credits: f.totalCredits,
    net: f.teamNet,
    players: f.playerCount,
  }));
}

// ── Org allocations ─────────────────────────────────────────────────────────────────────────
// What the club has billed this team, one INSTALLMENT per row rather than one allocation: a
// treasurer reconciling a bank statement is matching individual payments, not totals.

export const ALLOCATION_COLUMNS: ExportColumnDef[] = [
  { label: 'Allocation', key: 'allocation', format: 'text' },
  { label: 'Due date',   key: 'dueDate',    format: 'date' },
  { label: 'Amount',     key: 'amount',     format: 'currency' },
  { label: 'Status',     key: 'status',     format: 'text' },
  { label: 'Paid on',    key: 'paidAt',     format: 'date' },
];

export function allocationRows(
  splits: Array<{
    allocationDescription: string;
    installments: Array<{ dueDate: string; amount: number; paidAt: string | null }>;
  }>,
  today: string,
): ExportRow[] {
  const rows: ExportRow[] = [];
  for (const s of splits) {
    for (const i of s.installments) {
      rows.push({
        allocation: s.allocationDescription,
        dueDate: i.dueDate,
        amount: i.amount,
        status: i.paidAt ? 'Paid' : i.dueDate < today ? 'Overdue' : 'Due',
        paidAt: i.paidAt ?? '',
      });
    }
  }
  return rows;
}

// ── Payment requests ────────────────────────────────────────────────────────────────────────

export const PAYMENT_REQUEST_COLUMNS: ExportColumnDef[] = [
  { label: 'Raised',      key: 'created',     format: 'date' },
  { label: 'Type',        key: 'type',        format: 'text' },
  { label: 'Description', key: 'description', format: 'text' },
  { label: 'Amount',      key: 'amount',      format: 'currency' },
  { label: 'Method',      key: 'method',      format: 'text' },
  { label: 'Status',      key: 'status',      format: 'text' },
  { label: 'Reviewed',    key: 'reviewed',    format: 'date' },
];

export function paymentRequestRows(
  requests: Array<{
    requestType: 'payment_to_org' | 'charge_to_org'; amount: number; description: string;
    paymentMethod: string | null; status: string; createdAt: string; reviewedAt: string | null;
  }>,
): ExportRow[] {
  return requests.map(r => ({
    created: r.createdAt.slice(0, 10),
    type: r.requestType === 'payment_to_org' ? 'Paying the club' : 'Claiming from the club',
    description: r.description,
    amount: r.amount,
    method: r.paymentMethod ?? '',
    status: r.status.charAt(0).toUpperCase() + r.status.slice(1),
    reviewed: r.reviewedAt ? r.reviewedAt.slice(0, 10) : '',
  }));
}

// ── Budget vs. actual (the CATEGORY table) ──────────────────────────────────────────────────
// ⚠ NOT the month grid. That one's columns depend on the season's months and its cells on the
// chosen reading, so it is built by the panel that owns those switches.

export const BVA_EXPORT_COLUMNS: ExportColumnDef[] = [
  { label: 'Item',     key: 'item',     format: 'text' },
  { label: 'Budgeted', key: 'budgeted', format: 'currency' },
  { label: 'Actual',   key: 'actual',   format: 'currency' },
  { label: 'Variance', key: 'variance', format: 'currency' },
];

export type BvaCategorySource = {
  categories: Array<{
    categoryName: string; categoryEstimated: number; categoryActual: number; categoryVariance: number;
    lines: Array<{ description: string; totalEstimated: number }>;
  }>;
  /** Estimate not yet itemized — real planned money, so it belongs in the file. */
  buffer: number;
  /** Spending that matched no budget category. Omitting it would understate what was spent. */
  unbudgetedActuals: Array<{ description: string; category: string | null; amount: number }>;
  effectiveBudget: number;
  totalActual: number;
  headroom: number;
  funding: {
    budget: number; actual: number;
    lines: Array<{ description: string; amount: number }>;
    fundedByPlayers: number;
  } | null;
};

/**
 * The Budget-vs-Actual CATEGORY table. Both the hub-era export and the panel's own call this, so
 * the same report cannot come out two ways.
 *
 * ⚠ THE BUFFER, THE UNBUDGETED ROWS, THE TOTAL AND THE FUNDING BLOCK ARE PART OF THE REPORT, not
 * decoration. A first draft rebuilt this from the categories alone and shipped a spreadsheet whose
 * totals disagreed with the screen — which is the whole argument for one builder rather than two.
 *
 * ⚠ NOT the month grid: its columns depend on the season and its cells on the chosen reading, so
 * it is built by the panel that owns those switches.
 */
export function bvaCategoryRows(data: BvaCategorySource | null): ExportRow[] {
  if (!data) return [];
  const rows: ExportRow[] = [];
  for (const cat of data.categories ?? []) {
    rows.push({
      item: cat.categoryName,
      budgeted: cat.categoryEstimated,
      actual: cat.categoryActual,
      variance: cat.categoryVariance,
    });
    // Only the BUDGET is known per line — actuals match a category, not a line — so a line row
    // is blank under actual and variance, exactly as it reads on screen.
    for (const line of cat.lines) {
      rows.push({ item: `  — ${line.description}`, budgeted: line.totalEstimated, actual: '', variance: '' });
    }
  }
  if (data.buffer > 0) {
    rows.push({ item: 'Not itemized yet (from your estimate)', budgeted: data.buffer, actual: '', variance: '' });
  }
  for (const u of data.unbudgetedActuals ?? []) {
    rows.push({
      item: `Unbudgeted — ${u.description}${u.category ? ` (${u.category})` : ''}`,
      budgeted: '', actual: u.amount, variance: '',
    });
  }
  rows.push({ item: 'Total', budgeted: data.effectiveBudget, actual: data.totalActual, variance: data.headroom });

  // Expected funding travels with the export, NEGATED, so a spreadsheet ends on the same
  // "funded by players" figure the screen does.
  if (data.funding) {
    rows.push({
      item: 'Expected fundraising (team share)',
      budgeted: -data.funding.budget,
      actual: -data.funding.actual,
      // ⚠ actual − budget, matching the screen. Raising LESS than expected must read as the
      // unfavourable number in both places; written the other way round, a team that came up
      // $1,350 short saw red on screen and a positive figure in the spreadsheet.
      variance: data.funding.actual - data.funding.budget,
    });
    for (const line of data.funding.lines) {
      rows.push({ item: `  — ${line.description}`, budgeted: -line.amount, actual: '', variance: '' });
    }
    // ⚠ Whole totals, INCLUDING unbudgeted spending — the "Total" row above does the same,
    // because this export lists every unbudgeted expense as its own row rather than splitting
    // them into a separate section the way the screen does.
    rows.push({
      item: 'Funded by players',
      budgeted: data.funding.fundedByPlayers,
      actual: data.totalActual - data.funding.actual,
      variance: data.funding.fundedByPlayers - (data.totalActual - data.funding.actual),
    });
  }
  return rows;
}

// ── The one download path ───────────────────────────────────────────────────────────────────

export interface MoneyDownload {
  /** Filename segment: `{org}-{dataset}-{scope}-{date}.{ext}`. */
  dataset: string;
  /** Sheet name, and the title printed at the head of a PDF. */
  title: string;
  columns: ExportColumnDef[];
  rows: ExportRow[];
  /** Currency pre-formatted for jsPDF. Required only when the caller offers PDF. */
  pdfRows?: (rows: ExportRow[]) => (string | number)[][];
  orgLabel: string;
  /** Season name — in the filename, and under a PDF's title. */
  scopeLabel: string;
  teamName: string;
  pdfSettings?: OrgPdfSettings | null;
  /** What to say when there is nothing to write. */
  emptyMessage: string;
}

/**
 * Hand the coach the file.
 *
 * Throws with a coach-readable message when the screen holds nothing — the caller shows it rather
 * than downloading an empty sheet, because a spreadsheet with a header row and no rows looks like
 * the product lost the data.
 */
export async function downloadMoneyExport(format: MoneyExportFormat, spec: MoneyDownload): Promise<void> {
  if (spec.rows.length === 0) throw new Error(spec.emptyMessage);

  const filename = buildFilename(
    { org: spec.orgLabel, dataset: spec.dataset, scope: spec.scopeLabel },
    format,
  );

  if (format === 'pdf') {
    await downloadPDF(
      filename,
      spec.title,
      [spec.teamName, spec.scopeLabel].filter(Boolean).join(' · ') || undefined,
      spec.columns.map(c => c.label),
      spec.pdfRows ? spec.pdfRows(spec.rows) : serializeRows(spec.rows, spec.columns),
      { ...DEFAULT_PDF_SETTINGS, ...(spec.pdfSettings ?? {}) },
    );
    return;
  }

  const headers = serializeHeaders(spec.columns);
  const body = serializeRows(spec.rows, spec.columns);
  if (format === 'csv') downloadCSVBlob(filename, generateCSV(headers, body));
  else await downloadXLSX(filename, headers, body, spec.title);
}
