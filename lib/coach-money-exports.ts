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
import type { ExportColumnDef, XlsxRowStyle } from './export';
import {
  buildFilename, serializeHeaders, serializeRows, generateCSV, downloadCSVBlob, downloadXLSX,
  downloadPDF, DEFAULT_PDF_SETTINGS, type OrgPdfSettings,
} from './export';
import { duesStatusLabel } from './dues-status';
import { LINE_KIND_LABEL, normalizeBudgetLineKind } from './coach-budget-totals';
import { KIND_LABEL, SPONSOR_STATUS_LABEL } from './coach-fundraising';
import { REGISTER_KIND_LABEL, type RegisterBookRow } from './coach-register';
import { clubMoneyInWord, type ClubMoneyInMeaning, type ClubRequestType } from './coach-club-money';
import type { RepBudgetLineWithPeriods, RepTeamExpense } from './types';
import type { CommitmentStanding } from './payable-standing';

export type MoneyExportFormat = 'xlsx' | 'csv' | 'pdf';

/** A row is a flat bag of primitives — the shape `serializeRows` consumes. */
export type ExportRow = Record<string, string | number>;

/**
 * What a row IS in a grouped report — how the EXCEL file dresses it (bold bands, collapsible item
 * groups). Kinds are declared by the builder that pushes the row, never guessed from its text.
 *
 * ⚠ THE `  — ` ITEM PREFIX IS STRIPPED FROM THE EXCEL CELLS ONLY (owner call 2026-08-25 — Excel's
 * own indent carries the nesting there). CSV and PDF keep the dash text: they have no indent of
 * their own, and it is what their import path reads. The Excel round trip holds a different way —
 * `parseXLSX` marks each outlined/indented row and `stripLineIndent` accepts that mark as the
 * line-row signal the dash used to carry. The one degradation, accepted with the call: copy-paste
 * an exported Excel file's CELLS into a fresh sheet and the styling (hence the line-vs-category
 * distinction) does not travel; re-importing the downloaded FILE itself is the promise.
 */
export type MoneyRowKind = 'section' | 'category' | 'item' | 'total';

/** What each kind means in Excel. Items nest one outline level down, START CLOSED (the file
 *  opens at category level; the "+" opens a group), with the collapse control on the category
 *  row above them (`summaryBelow: false` — see downloadXLSX). */
const ROW_KIND_STYLE: Record<MoneyRowKind, XlsxRowStyle> = {
  section:  { bold: true },
  category: { bold: true },
  item:     { outlineLevel: 1, indent: 1, collapsed: true },
  total:    { bold: true },
};

/** The item rows' `  — ` label prefix, stripped for the Excel body only — see MoneyRowKind. */
const ITEM_PREFIX = /^\s*(?:—\s*)?/;

/**
 * Excel number formats for a currency column. Display only — the stored value is the raw signed
 * number either way, so a formatted file re-imports identically (parseXLSX reads cell.value).
 *
 *  - `minus`    — `-$1,234.00`, `$0.00`. Matches `money()` and every PDF cell; the default.
 *  - `brackets` — `($1,234.00)`, and zero shows as `—`. The Budget-vs-Actual notation: that
 *    report's binding screen rule is brackets-for-negative and em-dash-for-zero (`fmtCell`), and
 *    its spreadsheet should read like the screen it came from. No other tab's screen uses
 *    brackets, so no other tab passes this.
 */
const CURRENCY_NUMFMT: Record<'minus' | 'brackets', string> = {
  minus:    '$#,##0.00',
  brackets: '$#,##0.00;($#,##0.00);"—"',
};

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
/** The same formatter for the family dues statement (lib/coach-dues-statement.ts) — one spelling
 *  of a dollar amount across every Money document, sign included. */
export { money as formatMoneyCell };

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
    // ⚠ THE LIVE ITEM NAME, not the one captured when the line was written. `description` stores
    // the item's name at creation and is never re-synced, so a club admin renaming a shared item
    // left this file printing the old word while the report printed the new one — one record, two
    // names. The description stays the fallback for a money-in line, which has no item.
    line: l.itemName ?? l.description,
    kind: LINE_KIND_LABEL[normalizeBudgetLineKind(l.lineKind)],
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
  /** Mode-aware derived figures (owner model 2026-08-14) — REQUIRED so the export's status word
   *  takes duesStatusLabel's mode-aware path; without them a keep_separate team's spreadsheet
   *  would read "Settled" beside a family still owing cash (the /review Critical). */
  leftToSend: number;
  owedBack: number;
  outstanding: number;
  /** ⚠ REQUIRED so the spreadsheet can say "Past due" where the screen does. The status word is a
   *  question about TIME since 2026-08-14, and a file that graded season completion while the
   *  table beside it flagged who was behind would be the same one-product-two-answers defect the
   *  shared word list exists to prevent. */
  installments: Array<{ dueDate: string | null; paidAt: string | null; remainingAmount?: number; amount?: number }>;
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
  /* ⚖ `Deposit` / `Deposit due` / `Balance` / `Balance due` ARE RETIRED (Payables Rebuild P4,
     owner-confirmed 2026-08-20), and everything after them has shifted four columns left.
     THIS IS AN OUTWARD-FACING BREAK AND IT WAS TAKEN DELIBERATELY, ONCE.

     A coach's saved spreadsheet, pivot table or accountant's template addresses our columns by
     POSITION, so this reaches work that lives outside the product and that nobody here can see —
     which is exactly why it happens in the release that makes those headings wrong rather than a
     release later. Until now a plan could hold at most two pieces, so the four described it
     truthfully; a bill can now repeat monthly for two seasons, and a column headed `Balance`
     quoting installment 2 of twelve is a lie a reader has no way to detect.

     ⚠ NOTHING IS LOST. `Payments` says how many pieces the plan has and how many payments have
     landed, `Paid to date` and `Still owing` say what they say, and the dated pieces themselves are
     the PAYMENT SCHEDULE export — one row per piece, which is the file that could always answer
     "when is each one due?" for a plan of any length.

     ⚠ THE IMPORT TEMPLATE STILL HAS THEM (`PAYABLES_TEMPLATE_HEADERS`), and that is not drift: an
     imported sheet genuinely states a deposit and a balance, and `composeTwoPieceInstallments` is
     still the rule for what those two columns MEAN. Reading a two-piece sheet in and describing an
     n-piece bill out are different jobs. */
  { label: 'Payments',     key: 'payments',    format: 'text' },
  { label: 'Paid to date', key: 'paidToDate',  format: 'currency' },
  { label: 'Still owing',  key: 'stillOwing',  format: 'currency' },
  { label: 'Payee',        key: 'payee',       format: 'text' },
  // ⚠ TAGS BELONG HERE BECAUSE THE FILTER SITS ON THE SAME TOOLBAR AS EXPORT. A coach could
  // narrow the list to one money tag, export it, and open a spreadsheet with no column saying
  // which tag they had picked — the one fact that made the export worth taking (owner review
  // 2026-08-15, Q on the Tags column). Unlike notes above, a tag is a chosen label from a
  // managed library, never free text a coach may have put anything into.
  { label: 'Tags',         key: 'tags',        format: 'text' },
];

/** What the Paid column says, per state. A lookup rather than a chain, so the three are one list. */
const PAID_STATE_LABEL: Record<CommitmentStanding['state'], string> = {
  settled:     'Paid',
  partly_paid: 'Partly paid',
  unpaid:      'Unpaid',
};

/**
 * @param tagsByExpenseId which money tags each expense carries, as the list panel holds them.
 * @param tagById         the loaded tag library, for turning those ids into names.
 * Both optional: a caller without the tag library still gets every other column, with Tags blank.
 */
export function expenseRows(
  expenses: RepTeamExpense[],
  tagsByExpenseId: Record<string, string[]> = {},
  tagById: Map<string, { name: string }> = new Map(),
  /** Where each commitment stands, keyed by id. Optional: a caller without it still gets every
   *  column the plan does not decide, with the payment columns blank. */
  standings: Readonly<Record<string, CommitmentStanding>> = {},
): ExportRow[] {
  return expenses.map(e => {
    const standing = standings[e.id];
    const pieces = standing?.installments ?? [];
    return {
    description: e.description,
    category: e.category ?? '',
    /* ⚠ R2 — the total is the SUM OF THE PIECES, not a separately typed figure. Falls back to the
       stored amount only when a standing was not supplied, never to reconcile a disagreement. */
    amount: standing ? standing.total : e.amount,
    /* ⚠ R4 — SETTLED MEANS PAID IN FULL. "Partly paid" is a state the old two-word sentence
       ("Deposit paid · Balance paid") could not express at all: a $600 bill with $200 against it
       read as Unpaid, and a coach filtering a spreadsheet for what was still outstanding got the
       full $600 back as the figure to chase. */
    paid: standing ? PAID_STATE_LABEL[standing.state] : PAID_STATE_LABEL.unpaid,
    // How many pieces the plan has, and how many payments have landed against it — the two facts
    // the retired deposit/balance headings could not carry once a commitment can repeat monthly.
    payments: standing ? `${standing.payments.length} of ${pieces.length}` : '',
    paidToDate: standing ? standing.paid : '',
    /* ⚠ R6 — over-payment is stated, not hidden. `remaining` floors at zero, so a commitment paid
       twice would otherwise export as "fully settled, nothing owing" with the extra dollar
       invisible; saying it out loud is what lets a coach find it against a bank statement. */
    stillOwing: standing ? (standing.over > 0 ? -standing.over : standing.remaining) : '',
    payee: e.payeePayer ?? '',
    // Names, not ids, and joined the way the row shows them. A tag the library no longer holds
    // is dropped rather than exported as a bare id.
    tags: (tagsByExpenseId[e.id] ?? [])
      .map(id => tagById.get(id)?.name)
      .filter((n): n is string => !!n)
      .join(', '),
    };
  });
}

/* ⚠ THE `MONEY_IN` DATASET IS GONE (money redesign P3, 2026-08-17), and it is not lost — it is
   SPLIT. It exported income and money back as one file with a Kind column telling them apart, which
   was the honest shape while one list held both. The register separates them into two filters, so
   the same rows now come out as `income` and `refund` files that each mean what their heading says,
   built by `registerExportRows` below from whatever the strip is showing. Do not reinstate a
   combined arrivals export: a heading covering two opposite events is exactly the naming problem
   this release closed. */

// ── The register ────────────────────────────────────────────────────────────────────────────

/**
 * The register's own file — and it REPLACES the Expenses and Money-in datasets rather than joining
 * them (money redesign P3).
 *
 * ⚠ THE FILE IS WHATEVER THE STRIP IS SHOWING. Both retired datasets survive as a filtered export
 * of this one: `Expenses` is the register on its Expenses filter, `Money in` is Income and Refunds
 * as two separate files that finally mean what their headings say. A menu above the tab bar could
 * never have offered that, which is the argument this module's header already makes.
 *
 * ⚠ THE BALANCE COLUMN LEAVES WITH THE SCREEN'S. A running balance over a filtered subset is a
 * number that looks like cash and isn't — and a spreadsheet is exactly where such a column gets
 * summed, sorted and quoted to a club treasurer with no filter chip in sight.
 */
export const REGISTER_COLUMNS: ExportColumnDef[] = [
  { label: 'Date',      key: 'date',     format: 'date' },
  { label: 'What',      key: 'what',     format: 'text' },
  { label: 'Kind',      key: 'kind',     format: 'text' },
  { label: 'Category',  key: 'category', format: 'text' },
  { label: 'Item',      key: 'item',     format: 'text' },
  // ⚠ TWO COLUMNS, POSITIVE IN BOTH. A single signed column is the superseded draft the register
  // exists instead of (plan §2), and in a spreadsheet it is worse still: whatever lands in one
  // column gets summed by someone.
  { label: 'Money out', key: 'moneyOut', format: 'currency' },
  { label: 'Money in',  key: 'moneyIn',  format: 'currency' },
  { label: 'Balance',   key: 'balance',  format: 'currency' },
  { label: 'Status',    key: 'status',   format: 'text' },
  /* ⚠ APPENDED, NEVER INSERTED (money centralization P4). This module's own header records why:
     a coach's saved pivot table or accountant's template addresses these columns by POSITION, so a
     new one goes on the end where nothing shifts under work nobody here can see.
     ⚠ AND IT IS NOT A SECOND COPY OF `Status`. That column says whether team cash moved; this says
     WHOSE money did, which is the fact a treasurer needs to reconcile a household's credit against
     the bill it came from. */
  { label: 'Paid by',   key: 'paidBy',   format: 'text' },
];

export function registerExportRows(
  rows: Array<RegisterBookRow>,
  /** False when the screen is filtered — the column comes out blank, exactly as it is hidden. */
  showBalance: boolean,
): ExportRow[] {
  return rows.map(r => ({
    date: r.date ?? '',
    what: r.description,
    kind: REGISTER_KIND_LABEL[r.kind],
    category: r.categoryName ?? '',
    item: r.itemName ?? '',
    moneyOut: r.moneyOut || '',
    moneyIn: r.moneyIn || '',
    /* ⚠ THE FIGURE, NOT A BLANK, ON A ROW THAT MOVED NO TEAM CASH (/review, 2026-08-17). This read
       `showBalance && r.movesCash ? … : ''`, which emptied the Balance cell on exactly the
       out-of-pocket row the SCREEN deliberately fills in — the register's own rule is that the
       balance repeats unchanged there, because "repeating the previous figure rather than blanking
       it keeps the column readable top to bottom." A coach exporting the book they are looking at
       got a gap where the screen shows a number, in the one place this design says not to. The
       Status column carries the explanation instead: `Settled — no team cash`. */
    balance: showBalance ? r.balance : '',
    /* The two facts a column of figures cannot carry: whether this has happened yet, and whether it
       moved the team's cash at all. Without the second, an out-of-pocket cost reads in a spreadsheet
       as money that left the account. */
    status: r.overdueDays != null ? `Overdue · ${r.overdueDays}d`
      : r.scheduled ? 'Scheduled' : r.movesCash ? 'Settled' : 'Settled — no team cash',
    /* Blank rather than a placeholder on the overwhelming majority of rows the team paid: a
       spreadsheet is filtered and sorted, and "The team" as text would sort in among real names. */
    paidBy: r.paidByName ?? '',
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
  { label: 'Name',           key: 'name',     format: 'text' },
  // ⚠ The KIND leads, so the two total separately in a spreadsheet. A treasurer's question is how
  // much of the season came from families selling things versus from sponsors, and a single
  // undifferentiated list cannot be pivoted to answer it (2026-08-15).
  { label: 'Kind',           key: 'kind',     format: 'text' },
  { label: 'Status',         key: 'status',   format: 'text' },
  // "Credit", never "rebate", in anything a customer reads (vocabulary ruling 2026-08-31 — the
  // dues side already said credit everywhere). The KEY stays `rebate`: it is an identifier.
  { label: 'Credit %',       key: 'rebate',   format: 'number' },
  { label: 'Starts',         key: 'starts',   format: 'date' },
  { label: 'Ends',           key: 'ends',     format: 'date' },
  // ⚠ RECEIVED AND PLEDGED ARE SEPARATE COLUMNS (owner ruling Q15, 2026-08-28 — the forms
  // review's SP-3). The old single "Total raised" mixed cash with promises, so a treasurer
  // pivoting the sheet counted a $2,000 pledge as raised money with only the Status column to
  // save them. Now a sum of Received is money; a sum of Pledged is what is still to come.
  { label: 'Received',       key: 'raised',   format: 'currency' },
  { label: 'Pledged',        key: 'pledged',  format: 'currency' },
  { label: 'Player credits', key: 'credits',  format: 'currency' },
  { label: 'Team net',       key: 'net',      format: 'currency' },
  { label: 'Players',        key: 'players',  format: 'number' },
  // ⚠ The money-in half of the money-tag report (mig 239). The Expenses export has carried a Tags
  // column since 2026-08-15; without the same column here a coach pivoting a spreadsheet by tag
  // sees every dollar that label COST and none of what it BROUGHT IN, which reads as a loss.
  { label: 'Tags',           key: 'tags',     format: 'text' },
];

/**
 * @param tagById the loaded money-tag library, for turning each record's tag ids into names.
 * Optional: a caller without it still gets every other column, with Tags blank.
 */
export function fundraiserRows(
  list: Array<{
    name: string; playerRebatePercent: number; startDate: string | null; endDate: string | null;
    totalRaised: number; totalCredits: number; teamNet: number; playerCount: number;
    kind?: 'fundraiser' | 'sponsor'; sponsorStatus?: 'pledged' | 'received' | null;
    isActive?: boolean; tagIds?: string[]; stillToCome?: number | null;
  }>,
  tagById: Map<string, { name: string }> = new Map(),
): ExportRow[] {
  return list.map(f => ({
    name: f.name,
    kind: KIND_LABEL[f.kind ?? 'fundraiser'],
    // A drive is running or it isn't; a sponsor has arrived or it hasn't. The column carries
    // whichever question applies, because a spreadsheet cannot ask which kind it is looking at.
    status: f.kind === 'sponsor'
      ? SPONSOR_STATUS_LABEL[f.sponsorStatus ?? 'received']
      : (f.isActive === false ? 'Closed' : 'Active'),
    rebate: f.playerRebatePercent,
    starts: f.startDate ?? '',
    ends: f.endDate ?? '',
    raised: f.totalRaised,
    // What is still to come on the promise (mig 268) — zero for a drive or a fully-kept pledge.
    pledged: f.stillToCome ?? 0,
    credits: f.totalCredits,
    net: f.teamNet,
    players: f.playerCount,
    // Names, not ids, joined the way the record shows them — same rule as the expense export.
    tags: (f.tagIds ?? [])
      .map(id => tagById.get(id)?.name)
      .filter((n): n is string => !!n)
      .join(', '),
  }));
}

// ── Org allocations ─────────────────────────────────────────────────────────────────────────
// What the club has billed this team, one INSTALLMENT per row rather than one allocation: a
// treasurer reconciling a bank statement is matching individual payments, not totals.

/* ⚠ THE FILING COLUMNS ARE NEW (mig 250, money redesign P4) and they are the reason a treasurer can
   reconcile this file against Budget vs. Actual at all: until a club record names one of the team's
   own budget words, none of its money reached that report. An unfiled row exports an empty pair
   rather than a placeholder — a spreadsheet is filtered and sorted, and "Not filed" as text would
   sort in among the real category names. */
export const ALLOCATION_COLUMNS: ExportColumnDef[] = [
  { label: 'Allocation', key: 'allocation', format: 'text' },
  { label: 'Category',   key: 'category',   format: 'text' },
  { label: 'Item',       key: 'item',       format: 'text' },
  { label: 'Due date',   key: 'dueDate',    format: 'date' },
  { label: 'Amount',     key: 'amount',     format: 'currency' },
  { label: 'Status',     key: 'status',     format: 'text' },
  { label: 'Paid on',    key: 'paidAt',     format: 'date' },
];

export function allocationRows(
  splits: Array<{
    allocationDescription: string;
    budgetCategoryName?: string | null;
    budgetItemName?: string | null;
    installments: Array<{ dueDate: string; amount: number; paidAt: string | null }>;
  }>,
  today: string,
): ExportRow[] {
  const rows: ExportRow[] = [];
  for (const s of splits) {
    for (const i of s.installments) {
      rows.push({
        allocation: s.allocationDescription,
        // One filing per BILL, repeated on each of its instalment rows — a spreadsheet reader
        // filters on a column, and a value present on only the first row of a group filters wrong.
        category: s.budgetCategoryName ?? '',
        item: s.budgetItemName ?? '',
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
  { label: 'Direction',   key: 'type',        format: 'text' },
  { label: 'Description', key: 'description', format: 'text' },
  // See the note on ALLOCATION_COLUMNS — same two columns, same reason.
  /* ⚠ THE MEANING SITS BEFORE THE FILING, because it is what decides how the filing is READ
     (mig 271). A spreadsheet showing "From the club · Facilities · Diamond Permits · $325" cannot
     be reconciled against the report without it: the same four columns describe a grant that added
     $325 of revenue and a repayment that took $325 off a cost. Blank on anything going TO the club,
     where there is nothing to say. */
  { label: 'New money or money back', key: 'meaning', format: 'text' },
  { label: 'Category',    key: 'category',    format: 'text' },
  { label: 'Item',        key: 'item',        format: 'text' },
  { label: 'Amount',      key: 'amount',      format: 'currency' },
  { label: 'Method',      key: 'method',      format: 'text' },
  { label: 'Status',      key: 'status',      format: 'text' },
  { label: 'Reviewed',    key: 'reviewed',    format: 'date' },
];

/** What a status reads as in the file. ⚠ `pending` says WHO is holding it, matching the screen —
 *  a treasurer opening this spreadsheet a month later needs the same answer the tab gave. */
const REQUEST_STATUS_LABEL: Record<string, string> = {
  pending:  'Awaiting the club',
  approved: 'Approved',
  denied:   'Declined',
};

export function paymentRequestRows(
  requests: Array<{
    requestType: ClubRequestType; moneyInMeaning?: ClubMoneyInMeaning | null;
    amount: number; description: string;
    budgetCategoryName?: string | null; budgetItemName?: string | null;
    paymentMethod: string | null; status: string; createdAt: string; reviewedAt: string | null;
  }>,
): ExportRow[] {
  return requests.map(r => ({
    created: r.createdAt.slice(0, 10),
    // ⚠ "Club", not "Org" (owner ruling 2026-08-17) — the file a coach hands their treasurer must
    // use the same word the screen does, and this pair was the last place saying otherwise.
    type: r.requestType === 'payment_to_org' ? 'To the club' : 'From the club',
    description: r.description,
    /* ⚠ THE SAME TWO WORDS THE ROW PRINTS, from the module that owns them — including what a
       LEGACY row (no answer) reads as, which is decided there rather than here. A blank column and
       a wrong word are both worse than the truth: the report has counted these as repayments since
       they were approved. */
    meaning: clubMoneyInWord(r) ?? '',
    category: r.budgetCategoryName ?? '',
    item: r.budgetItemName ?? '',
    amount: r.amount,
    method: r.paymentMethod ?? '',
    status: REQUEST_STATUS_LABEL[r.status]
      ?? (r.status.charAt(0).toUpperCase() + r.status.slice(1)),
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

/** One category, in either direction — the shape both report sections share. */
type BvaCategory = {
  categoryName: string; budgeted: number; actual: number; variance: number;
  /** False = nothing in this category was budgeted; the file leaves Budgeted blank, as the
   *  screen does, rather than printing a zero that reads like a plan of $0. */
  inPlan: boolean;
  items: Array<{
    itemName: string; budgeted: number; actual: number; variance: number;
    inPlan: boolean; lineCount: number;
    /** Money back netted into the row. The file says so in the row's own label, because a
     *  spreadsheet has no drill-in to put it underneath. */
    refundTotal: number; grossActual: number;
  }>;
};

export type BvaCategorySource = {
  /** Estimate not yet itemized — real planned money, so it belongs in the file. */
  buffer: number;
  /** ⚠ NO LONGER ADDED AS EXTRA ROWS — it is reported as one figure. Every paid dollar, planned or
   *  not, is inside a category row now (mig 240), so listing these again below the total was how a
   *  spreadsheet came out with more spending in it than the team did. */
  unbudgeted: number;
  effectiveBudget: number;
  totalActual: number;
  headroom: number;
  /**
   * The statement, so the file reads as the screen does (mig 243).
   *
   * ⚠ CATEGORY → ITEM, matching the screen (owner ruling 2026-08-15). The file used to list a row
   * per budget LINE, named by whatever description was typed — so a spreadsheet could not be
   * reconciled against the plan any more than the report could.
   *
   * ⚠ THE EXPENSES CATEGORIES COME FROM HERE, not from a second top-level copy. The route shipped
   * both for a while and the payload carried the heaviest part of a season's report twice.
   */
  report: {
    revenue:  { categories: BvaCategory[]; budgeted: number; actual: number; variance: number };
    expenses: { categories: BvaCategory[] };
    /** Measured against the EFFECTIVE budget, so the file's closing rows match the screen's. */
    net: { budgeted: number; actual: number; variance: number };
  };
  funding: { budget: number; actual: number; fundedByPlayers: number } | null;
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
export function bvaCategoryRows(
  data: BvaCategorySource | null,
): { rows: ExportRow[]; kinds: (MoneyRowKind | undefined)[] } {
  const rows: ExportRow[] = [];
  // Index-aligned with `rows` — how the Excel file dresses each one. CSV/PDF never read it.
  const kinds: (MoneyRowKind | undefined)[] = [];
  const push = (row: ExportRow, kind?: MoneyRowKind) => { rows.push(row); kinds.push(kind); };
  if (!data) return { rows, kinds };

  /** One category and its items — the same two levels in both sections. */
  const pushCategory = (cat: BvaCategory) => {
    push({
      item: cat.inPlan ? cat.categoryName : `${cat.categoryName} (not budgeted)`,
      // ⚠ BLANK, NEVER ZERO, where nothing was budgeted. A 0 in a spreadsheet is a plan of nothing;
      // an empty cell is the absence of a plan, and those are different facts a treasurer acts on
      // differently.
      budgeted: cat.inPlan ? cat.budgeted : '',
      actual: cat.actual,
      variance: cat.variance,
    }, 'category');
    // Every item, planned or not — the file carries the same two levels the screen does, so a
    // coach can reconcile one against the other line for line.
    for (const item of cat.items) {
      const label = item.lineCount > 1 ? `${item.itemName} (${item.lineCount} lines)` : item.itemName;
      /* ⚠ MONEY BACK IS SAID IN THE LABEL, NOT GIVEN A ROW. The screen puts "$2,400 paid · $150
         back" underneath the row; a spreadsheet has no underneath, and a second row would make the
         column add up to more spending than the team did — the exact defect that took the
         unbudgeted rows out of this file. */
      const back = item.refundTotal > 0.005
        ? ` — ${item.grossActual.toFixed(2)} less ${item.refundTotal.toFixed(2)} back`
        : '';
      push({
        item: `  — ${label}${item.inPlan ? '' : ' — not budgeted'}${back}`,
        budgeted: item.inPlan ? item.budgeted : '',
        actual:   item.actual,
        variance: item.variance,
      }, 'item');
    }
  };

  /* ⚠ THE FILE IS THE STATEMENT, because the screen is (mig 243). Revenue first with its own
     total, then expenses, then what players still fund — a spreadsheet that grouped the same
     records differently from the report it was downloaded from is the two-buttons-one-name defect
     wearing a different hat. */
  if (data.report.revenue.categories.length > 0) {
    push({ item: 'REVENUE', budgeted: '', actual: '', variance: '' }, 'section');
    for (const cat of data.report.revenue.categories) pushCategory(cat);
    push({
      item: 'Total revenue',
      budgeted: data.report.revenue.budgeted,
      actual: data.report.revenue.actual,
      // ⚠ actual − budget on this side. Raising LESS than expected must read as the unfavourable
      // number here and on screen; written the other way round, a team that came up $1,350 short
      // saw red on screen and a positive figure in the spreadsheet.
      variance: data.report.revenue.variance,
    }, 'total');
    push({ item: 'EXPENSES', budgeted: '', actual: '', variance: '' }, 'section');
  }

  for (const cat of data.report.expenses.categories ?? []) pushCategory(cat);
  if (data.buffer > 0) {
    // 'category' for the bolding: the screen renders this row with the category-header
    // treatment (panel `bufferRow`), and the file should read like the screen (/review find).
    push({ item: 'Not itemized yet (from your estimate)', budgeted: data.buffer, actual: '', variance: '' }, 'category');
  }
  push({
    item: data.report.revenue.categories.length > 0 ? 'Total expenses' : 'Total',
    budgeted: data.effectiveBudget, actual: data.totalActual, variance: data.headroom,
  }, 'total');
  // Named, not added. The rows above already contain every one of these dollars.
  if (data.unbudgeted > 0) {
    push({ item: '  of which never budgeted', budgeted: '', actual: data.unbudgeted, variance: '' }, 'item');
  }

  if (data.funding) {
    // The server's figure, the same one the screen prints — never a fourth recomputation.
    push({
      item: 'Season net',
      budgeted: data.report.net.budgeted,
      actual: data.report.net.actual,
      variance: data.report.net.variance,
    }, 'total');
    // ⚠ Whole totals, INCLUDING unbudgeted spending — the total row above does the same,
    // because this export lists every unbudgeted expense as its own row rather than splitting
    // them into a separate section the way the screen does.
    push({
      item: 'Funded by players',
      budgeted: data.funding.fundedByPlayers,
      actual: data.totalActual - data.funding.actual,
      variance: data.funding.fundedByPlayers - (data.totalActual - data.funding.actual),
    }, 'total');
  }
  return { rows, kinds };
}

// ── The one download path ───────────────────────────────────────────────────────────────────

export interface MoneyDownload {
  /** Filename segment: `{org}-{dataset}-{scope}-{date}.{ext}`. */
  dataset: string;
  /** Sheet name, and the title printed at the head of a PDF. */
  title: string;
  columns: ExportColumnDef[];
  rows: ExportRow[];
  /** What each row IS, index-aligned with `rows` — Excel presentation only (bold bands,
   *  collapsible item groups). Absent = every row plain, which is right for a flat dataset. */
  rowKinds?: (MoneyRowKind | undefined)[];
  /** How the Excel file writes a currency cell. Default `minus` (matches money() and the PDFs);
   *  the Budget-vs-Actual pair passes `brackets`, its binding screen notation. */
  currencyNotation?: 'minus' | 'brackets';
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
      // D1: the header carries the team's name (the identity); the subtitle keeps the season.
      spec.scopeLabel || undefined,
      spec.columns.map(c => c.label),
      spec.pdfRows ? spec.pdfRows(spec.rows) : serializeRows(spec.rows, spec.columns),
      { ...DEFAULT_PDF_SETTINGS, ...(spec.pdfSettings ?? {}) },
      { identity: spec.teamName },
    );
    return;
  }

  const headers = serializeHeaders(spec.columns);
  const body = serializeRows(spec.rows, spec.columns);
  if (format === 'csv') { downloadCSVBlob(filename, generateCSV(headers, body)); return; }

  /* The Excel file gets what the flat formats cannot carry: currency-formatted cells on every
     money column, real dates in month headers, and — where the caller declared row kinds — bold
     section/category/total bands with the item rows grouped, indented and starting CLOSED under
     Excel's own +/− controls. The item rows also shed their `  — ` label prefix here, and ONLY
     here — the indent replaces it (see MoneyRowKind for why the round trip survives that). */
  spec.rowKinds?.forEach((kind, i) => {
    // The label is always the first active column in a grouped dataset; `body` is this call's
    // own serialization, so mutating it cannot reach the CSV or PDF paths above.
    if (kind === 'item') body[i][0] = String(body[i][0]).replace(ITEM_PREFIX, '');
  });
  const numFmt = CURRENCY_NUMFMT[spec.currencyNotation ?? 'minus'];
  // Aligned with `headers` — the same sensitive-column filter serializeHeaders just applied.
  const activeCols = spec.columns.filter(c => !c.sensitive);
  await downloadXLSX(filename, headers, body, spec.title, {
    columnNumFmts: activeCols.map(c => (c.format === 'currency' ? numFmt : undefined)),
    rowStyles: spec.rowKinds?.map(k => (k ? ROW_KIND_STYLE[k] : undefined)),
    // A month column's header becomes the month's real date — UTC midnight, deliberately:
    // ExcelJS converts dates with pure epoch math, so only a UTC boundary shows the right
    // month in every timezone (see the downloadXLSX doc).
    columnHeaderDates: activeCols.map(c => {
      if (!c.headerMonth) return undefined;
      const [y, m] = c.headerMonth.split('-').map(Number);
      // Fail soft on a malformed month: the header keeps its text label rather than
      // writing an Invalid Date into the cell.
      if (!Number.isInteger(y) || !Number.isInteger(m) || m < 1 || m > 12) return undefined;
      return new Date(Date.UTC(y, m - 1, 1));
    }),
  });
}
