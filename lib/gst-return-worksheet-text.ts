/**
 * THE GST/HST RETURN WORKSHEET'S WORDS (GST/HST Stage 4b Session B). Pure: what the screen, "Copy lines" and the Worksheet CSV
 * SAY about the engine's worksheet (lib/gst-return-worksheet.ts). No rule lives here: every figure, part, state and "Before you
 * file" item is the engine's, and this file only words it. Session D's package file `gst-hst-worksheet.csv` takes the same rows.
 *
 * ⚖ The line captions are CRA's own headings on "Instructions for preparing a GST/HST return" (canada.ca, page details
 *   2021-04-27, opened 2026-11-07). They were NOT checked against the return screen in My Business Account (not reachable);
 *   the build prompt's Progress record holds that. The drawings' "Adjustments that increase / decrease net tax" were paraphrases.
 * ⚖ Negative money is written in words ("refund", "you owe", "minus"), never with a sign. "Not available" is never $0.
 */
import { formatCad, type CreditState } from './bookkeeping-gst';
import { provinceName } from './canadian-provinces';
import { formatStoredDate } from './timezone';
import { possessive } from './utils';
import type { LineNumber, NotAvailableWhy, NotOnReturnStep, TaxGroup, UnresolvedKind, Worksheet, WorksheetPeriod } from './gst-return-worksheet';
import type { ChangeEffect, FilingChange, FilingComparison, FilingRefusal } from './gst-return-filing';

export const RETURN_LINES: Record<LineNumber, { caption: string; hint: string }> = {
  101: { caption: 'Total sales and other revenues', hint: 'before tax, includes zero-rated sales' },
  103: { caption: 'GST/HST collected or collectible', hint: 'every invoice issued, paid or not' },
  104: { caption: 'Adjustments to be added to the net tax', hint: 'a bad debt you later recovered' },
  105: { caption: 'Total GST/HST and adjustments for the period', hint: 'line 103 plus line 104' },
  106: { caption: 'GST/HST paid or payable (ITCs)', hint: 'the GST/HST on your expenses that you can claim' },
  107: { caption: 'Adjustments to be deducted when determining the net tax', hint: 'credit notes issued, bad debts written off' },
  108: { caption: 'Total ITCs and adjustments', hint: 'line 106 plus line 107' },
  109: { caption: 'Net tax', hint: 'line 105 minus line 108' },
};

/** Line 104's honest gap (build prompt, design calls): never a silent $0.00. */
export const LINE_104_UNTRACKED = 'Supplier refunds of tax you claimed and the meals add-back aren’t tracked here.';
export const FOOTNOTE = 'Lines 110 to 115 (installments, rebates, refund or balance owing) are worked out on the return itself.';
export const NOT_AVAILABLE = 'Not available';

/** Whole dollars, as line 101 asks for them ("$4,700"). */
export const formatWholeDollars = (dollars: number) =>
  `${dollars < 0 ? 'minus ' : ''}${new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0, minimumFractionDigits: 0 }).format(Math.abs(dollars))}`;
/** Money with no sign: a figure below zero says "minus" (a proration credit can net a sales line below zero). */
export const formatMoney = (cents: number) => `${cents < 0 ? 'minus ' : ''}${formatCad(Math.abs(cents))}`;
/** Net tax in words: positive = you owe (the engine's sign). */
export function netTaxWords(cents: number): string {
  if (cents === 0) return formatCad(0);
  return `${formatCad(Math.abs(cents))} ${cents < 0 ? 'refund' : 'you owe'}`;
}

/** A line's figure as the screen shows it, or null when it is Not available. */
export function lineFigure(worksheet: Worksheet, line: LineNumber): string | null {
  const { cents } = worksheet.lines[line];
  if (cents == null) return null;
  if (line === 101) return formatWholeDollars(worksheet.parts[101].wholeDollars ?? 0);
  if (line === 109) return netTaxWords(cents);
  return formatMoney(cents);
}

/** The same figure as a plain number to type into the return: 101 in whole dollars, the rest with cents, never a sign. */
function plainFigure(worksheet: Worksheet, line: LineNumber): string | null {
  const { cents } = worksheet.lines[line];
  if (cents == null) return null;
  if (line === 101) return String(Math.abs(worksheet.parts[101].wholeDollars ?? 0));
  return (Math.abs(cents) / 100).toFixed(2);
}
/** "refund" / "you owe" / "minus": the word a plain figure needs when it is not a plain positive. */
function plainWord(worksheet: Worksheet, line: LineNumber): string {
  const { cents } = worksheet.lines[line];
  if (cents == null || cents === 0) return '';
  if (line === 109) return cents < 0 ? 'refund' : 'you owe';
  return cents < 0 ? 'minus' : '';
}

export const NOT_AVAILABLE_WHY: Record<NotAvailableWhy, string> = {
  sales_unread: 'sales couldn’t be read',
  registration_unread: 'the registration date couldn’t be read',
  expenses_unread: 'expenses couldn’t be read',
  expenses_too_many: 'too many expense records to add up here',
  filings_unread: 'your filed periods couldn’t be read',
};

const LINES: readonly LineNumber[] = [101, 103, 104, 105, 106, 107, 108, 109];

/** "Copy lines": one line per return line, the figure as you type it. */
export function copyLinesText(worksheet: Worksheet): string {
  return LINES.map(line => {
    const figure = plainFigure(worksheet, line);
    const word = plainWord(worksheet, line);
    const earlier = line === 106 && figure != null && worksheet.parts[106].earlierCents ? ` (${FILING.earlierNote(worksheet.parts[106].earlierCents).toLowerCase()})` : '';
    const status = figure == null ? `${NOT_AVAILABLE} (${NOT_AVAILABLE_WHY[worksheet.lines[line].notAvailable ?? 'sales_unread']})`
      : `${figure}${word ? ` ${word}` : ''}${worksheet.lines[line].partial ? ' (partial)' : ''}${earlier}`;
    return `${line}\t${RETURN_LINES[line].caption}\t${status}`;
  }).join('\n');
}

/** The Worksheet CSV's rows (header first). The amount column is a plain figure; its word and any gap sit in the Note column. */
export function worksheetCsvRows(worksheet: Worksheet): string[][] {
  const rows = [['Line', 'Description', 'Amount (CAD)', 'Note']];
  for (const line of LINES) {
    const l = worksheet.lines[line];
    const figure = plainFigure(worksheet, line);
    const notes = [
      figure == null ? `${NOT_AVAILABLE}: ${NOT_AVAILABLE_WHY[l.notAvailable ?? 'sales_unread']}` : '',
      plainWord(worksheet, line) ? (line === 109 ? (l.cents! < 0 ? 'Refund' : 'You owe') : 'Below zero') : '',
      line === 101 && figure != null ? 'Whole dollars' : '',
      l.calculated ? 'Calculated' : '',
      l.partial ? 'Partial: the period starts before the sales record does' : '',
      line === 104 && figure != null ? LINE_104_UNTRACKED : '',
      line === 106 && figure != null && worksheet.parts[106].earlierCents ? FILING.earlierNote(worksheet.parts[106].earlierCents) : '',
    ].filter(Boolean);
    rows.push([String(line), RETURN_LINES[line].caption, figure ?? '', notes.join('; ')]);
  }
  rows.push(['', `Period ${worksheet.period.from} to ${worksheet.period.to}. Regular method. An aid, not the return: nothing is filed from here.`, '', '']);
  return rows;
}

/** "HST 13%": a tax line's type and rate, the one spelling for the return's windows, its CSVs and the accountant package. */
export const taxRateLabel = (line: { taxType: string; rate: number | null }) =>
  `${line.taxType.toUpperCase()}${line.rate == null ? '' : ` ${Number(line.rate.toFixed(3))}%`}`;

/**
 * The buyer as staff and the accountant read it (/legal STAFF_CROSS_CLUB_BILLING_LISTS.md Recommendation 3): an individual is
 * "Coach", never a person's name; a club by its name when it was read, else "Club".
 */
export function buyerWords(buyerKind: 'club' | 'person' | 'unknown' | null, clubName: string | null | undefined): string {
  if (buyerKind === 'person') return 'Coach';
  return clubName ?? (buyerKind === 'club' ? 'Club' : 'Buyer not recorded');
}

/** "Ontario · HST 13% on $2,400.00". */
export function taxGroupLabel(group: TaxGroup): string {
  const where = provinceName(group.region) ?? group.region ?? 'Province not recorded';
  return `${where} · ${taxRateLabel(group)} on ${formatMoney(group.taxableCad)}`;
}

/**
 * "Before you file": each kind's count words and its window's title. `info` kinds change no line (the engine's `affects` is
 * empty); they sit under "For your information" in the same box.
 */
export const UNRESOLVED: Record<UnresolvedKind, { one: string; many: string; title: string; hint: string }> = {
  sale_missing_answer: { one: 'sale with no GST/HST answer', many: 'sales with no GST/HST answer', title: 'Sales with no GST/HST answer',
    hint: 'Our record couldn’t confirm whether GST/HST applies to each of these. Line 103 counts only the GST/HST the invoice charged. A marked “looked at” sale stays on this list until it has an answer.' },
  sale_no_rate: { one: 'foreign sale with no exchange rate yet', many: 'foreign sales with no exchange rate yet', title: 'Foreign sales with no exchange rate',
    hint: 'The Bank of Canada rate for the invoice day hasn’t been read yet, so these sales aren’t in lines 101 and 103. The daily job reads it.' },
  relief_no_rate: { one: 'adjustment with no exchange rate', many: 'adjustments with no exchange rate', title: 'Adjustments with no exchange rate',
    hint: 'The invoice behind each one has no Bank of Canada rate yet, so its adjustment isn’t in these lines.' },
  write_off_share_unknown: { one: 'write-off whose unpaid share isn’t recorded', many: 'write-offs whose unpaid share isn’t recorded', title: 'Write-offs with the unpaid share unknown',
    hint: 'Part of each invoice was paid before it was written off, and the record doesn’t keep how much. None of these is claimed on line 107; work out the share with your accountant.' },
  recovery_share_unknown: { one: 'recovered write-off whose share isn’t recorded', many: 'recovered write-offs whose share isn’t recorded', title: 'Recoveries with the share unknown',
    hint: 'Each invoice was paid after it was written off, but its write-off couldn’t be worked out, so nothing is added on line 104.' },
  note_without_sale: { one: 'credit note with no invoice record', many: 'credit notes with no invoice record', title: 'Credit notes with no invoice record',
    hint: 'The invoice each note reduces isn’t in the record, so its tax can’t be checked against what was reported. Not claimed on line 107.' },
  credit_held: { one: 'GST/HST number missing', many: 'GST/HST numbers missing', title: 'GST/HST numbers missing',
    hint: 'Open one to add the number from its receipt. If you can’t get it, tick “I can’t get the number” on the expense and the credit is left out.' },
  tax_unknown: { one: 'expense with tax unknown', many: 'expenses with tax unknown', title: 'Expenses with tax unknown',
    hint: 'Open one to record the tax on its receipt, or that no tax was charged.' },
  registration_unchecked: { one: 'supplier’s registration not checked', many: 'suppliers’ registrations not checked', title: 'Supplier registration not checked',
    hint: 'These credits are counted for now. Check each supplier on CRA’s registry; a simplified seller’s tax isn’t claimable.' },
  type_not_set: { one: 'expense with the tax type not set', many: 'expenses with the tax type not set', title: 'Tax type not set',
    hint: 'Open one to say which tax the receipt shows.' },
  dates_to_review: { one: 'expense with dates to review', many: 'expenses with dates to review', title: 'Dates to review',
    hint: 'An expense counts once its dates are confirmed. Open one to confirm when it was incurred and paid.' },
  sale_voided_no_note: { one: 'voided invoice with no credit note', many: 'voided invoices with no credit note', title: 'Voided, no credit note',
    hint: 'Voided, no credit note: its tax stays in line 103. A void alone doesn’t reduce the tax; a credit note does.' },
  sale_before_registration: { one: 'invoice issued before your registration date', many: 'invoices issued before your registration date', title: 'Issued before your registration date',
    hint: 'These sales are outside the return. They move in if your registration date changes.' },
  relief_capped: { one: 'adjustment capped at its invoice’s tax', many: 'adjustments capped at their invoice’s tax', title: 'Adjustments capped',
    hint: 'Credit notes and write-offs on one invoice never take off more than its GST/HST. The amount shown is what was left over.' },
};

/** The order the box lists them in: what can still change a line first, then information. */
export const UNRESOLVED_ORDER: readonly UnresolvedKind[] = [
  'credit_held', 'tax_unknown', 'registration_unchecked', 'type_not_set', 'dates_to_review',
  'sale_missing_answer', 'sale_no_rate', 'relief_no_rate', 'write_off_share_unknown', 'recovery_share_unknown', 'note_without_sale',
  'sale_voided_no_note', 'sale_before_registration', 'relief_capped',
];
export const SALE_KINDS = new Set<UnresolvedKind>([
  'sale_missing_answer', 'sale_no_rate', 'relief_no_rate', 'write_off_share_unknown', 'recovery_share_unknown', 'note_without_sale',
  'sale_voided_no_note', 'sale_before_registration', 'relief_capped',
]);
export const unresolvedCount = (kind: UnresolvedKind, count: number) => `${count} ${count === 1 ? UNRESOLVED[kind].one : UNRESOLVED[kind].many}`;

// ── Mark as filed (Session C; drawings tab 6 state D; the question is not drawn: the house reason question) ───────────────

/** "April 20, 2028" (a timestamp reads as its Ontario day). */
export const longDate = (value: string) => formatStoredDate(value, { longMonth: true });
const periodWords = (p: WorksheetPeriod) => `${longDate(p.from)} to ${longDate(p.to)}`;
const lineList = (lines: readonly number[]) => lines.length === 1 ? `Line ${lines[0]}` : `Lines ${lines.slice(0, -1).join(', ')} and ${lines[lines.length - 1]}`;

export const FILING = {
  door: 'Mark as filed…',
  doorAgain: 'Mark as filed again…',
  eyebrow: 'GST/HST return',
  title: (p: WorksheetPeriod, again: boolean) => `Mark ${periodWords(p)} as filed${again ? ' again' : ''}?`,
  lead: 'This saves these lines exactly as they stand, with the invoices, credit notes and expenses behind them. Later changes show as “Changed since you filed”. Nothing is sent to the CRA.',
  leadAgain: 'Marking it again saves today’s lines as an amended filing. The earlier filing stays in the history.',
  openWarning: (n: number) => `${n} ${n === 1 ? 'item' : 'items'} under “Before you file” ${n === 1 ? 'is' : 'are'} still open. ${n === 1 ? 'It’s' : 'They’re'} saved with the filing.`,
  partialWarning: 'The sales lines are partial: the period starts before the sales record does.',
  dateLabel: 'Date you filed',
  reasonLabel: 'Why are you marking it again?',
  keep: 'Keep it open',
  keepAgain: 'Keep the filing as it is',
  confirm: 'Mark as filed',
  saving: 'Saving…',
  chip: (filedOn: string) => `FILED ${longDate(filedOn).toUpperCase()}`,
  asFiledTitle: 'Figures as you filed them',
  asFiledBody: (savedAt: string) => `Saved ${longDate(savedAt)}. They don’t change when an invoice or expense in this period does.`,
  filedWithOpen: (n: number) => `Filed with ${n} ${n === 1 ? 'item' : 'items'} under “Before you file” still open.`,
  filedPartial: 'The sales lines were partial when you filed.',
  markedAgain: (n: number) => `Marked filed ${n} times; the latest is shown.`,
  history: (n: number) => `Filings · ${n}`,
  historyTitle: 'Filings for this period',
  historyRow: (filedOn: string, savedAt: string, reason: string | null) => `Filed ${longDate(filedOn)} · saved ${longDate(savedAt)}${reason ? ` · ${reason}` : ''}`,
  live: 'Today’s figures for this period',
  overlaps: (p: WorksheetPeriod) => `These dates overlap the period you marked filed, ${periodWords(p)}. The figures here are today’s. To mark that period again, choose exactly its dates.`,
  changedTitle: 'Changed since you filed',
  unchanged: 'Nothing has changed since you filed.',
  cantCompare: {
    lines_not_available: 'Today’s figures can’t all be worked out right now, so they can’t be compared with what you filed.',
    sources_unreadable: 'This filing was saved in a form this screen can’t compare.',
  } as Record<Extract<FilingComparison, { state: 'unknown' }>['why'], string>,
  /** Net tax in words like everywhere else ("refund" / "you owe"); 101 in cents here (its whole dollars are on the table). */
  lineMoved: (line: number, filed: number, today: number) => {
    const words = (cents: number) => (line === 109 ? netTaxWords(cents) : formatMoney(cents));
    return `Line ${line}: ${words(filed)} as filed, ${words(today)} today.`;
  },
  earlierCredits: 'Credits from earlier periods',
  storageNotReady: 'Bookkeeping storage is being updated; try again after the upgrade',
  unreadDoor: 'Marking this period as filed is unavailable until your filed periods can be read.',
  /** The 106 note in "Copy lines" and the Worksheet CSV, so a pasted figure explains itself. */
  earlierNote: (cents: number) => `Includes ${formatMoney(cents)} credits from earlier periods`,
};

/** A filed line's figure, worded as today's are (101 whole dollars, 109 in words). */
export function filedFigure(line: LineNumber, cents: number, wholeDollars101: number): string {
  if (line === 101) return formatWholeDollars(wholeDollars101);
  if (line === 109) return netTaxWords(cents);
  return formatMoney(cents);
}

/** Why a period can't be marked filed now, in words. */
export function refusalWords(r: FilingRefusal): string {
  switch (r.why) {
    case 'not_available': return `${lineList(r.lines)} can’t be worked out right now, so this period can’t be marked as filed. A filing can’t be saved from a figure that isn’t known.`;
    case 'not_ended': return 'You can mark a period as filed once it has ended.';
    case 'filed_on_invalid': return 'Choose the date you filed.';
    case 'filed_on_too_early': return 'Choose a date after the period’s last day: a return is filed once its period has ended.';
    case 'filed_on_future': return 'The date you filed can’t be in the future.';
    case 'overlaps': return `These dates overlap the period you marked filed, ${periodWords(r.with)}. Choose exactly those dates to mark it again, or dates that don’t overlap.`;
    case 'changed': return 'This period’s filing changed while you were looking. Reload before marking it.';
    case 'reason_missing': return 'Say why you’re marking it again, for example an amended return.';
    case 'reason_too_long': return 'Keep the reason to 500 characters.';
    case 'figures_changed': return 'The figures changed while this was open. Check the lines below, then mark it again.';
    case 'busy': return 'Another filing was being saved at the same moment. Try again.';
  }
}

/** What to do, from CRA's rules (GST_HST_RETURN_LINES.md §10). */
export const CHANGE_EFFECT: Record<ChangeEffect, string> = {
  later_return: 'Claim it on a later return.',
  adjust_filed: 'Adjust the filed return in My Business Account.',
  ask_accountant: 'Ask your accountant.',
  info: 'No figure moved.',
};

/** One "Changed since you filed" sentence: what changed, then what to do. */
export function changeSentence(c: FilingChange): string {
  const money = formatMoney(c.cents);
  const number = c.invoiceNumber ?? 'without a number';
  const invoice = `Invoice ${number}`;
  const ofInvoice = `invoice ${number}`;
  const on = c.on ? longDate(c.on) : '';
  switch (c.kind) {
    case 'credit_more': return `${c.released ? `${money} credit released: ${possessive(c.supplier ?? '')} number added ${longDate(c.savedOn!)}.` : `${money} more credit on ${c.supplier} (${on}), saved ${longDate(c.savedOn!)}.`} `
      + (c.carriedIn
        ? `It’s claimed on the return you marked filed for ${periodWords(c.carriedIn)}, on line 106 as “Credits from earlier periods”.`
        : `Claim it on a later return: it shows on line 106 as “Credits from earlier periods” on the return that covers ${longDate(c.landsOn!)}.`);
    case 'credit_less': return `${money} less credit on ${c.supplier} (${on}) than you claimed. ${CHANGE_EFFECT.adjust_filed}`;
    case 'earlier_credit_less': return `${money} of a credit from an earlier period, on ${c.supplier}, no longer counts. ${CHANGE_EFFECT.adjust_filed}`;
    case 'sale_added': return `${invoice} (${on}) was recorded after you filed: ${money} GST/HST. ${CHANGE_EFFECT.adjust_filed}`;
    case 'sale_changed': return c.baseOnly
      ? `${invoice} (${on}): its amount before tax changed by ${money}, so line 101 moved. ${CHANGE_EFFECT[c.effect]}`
      : `${invoice} (${on}) changed by ${money} GST/HST. ${CHANGE_EFFECT[c.effect]}`;
    case 'sale_removed': return `${invoice} (${on}) is no longer in this period’s return, for example because your registration date changed. ${CHANGE_EFFECT.ask_accountant}`;
    case 'note_added': return `Credit note${c.noteNumber ? ` ${c.noteNumber}` : ''} on ${ofInvoice} (${on}) was recorded after you filed: ${money}. ${CHANGE_EFFECT.ask_accountant}`;
    case 'note_removed': return `A credit note on ${ofInvoice} (${on}) no longer counts: ${money}. ${CHANGE_EFFECT.adjust_filed}`;
    case 'write_off_added': return `${invoice} was written off ${on}, recorded after you filed: ${money}. You can claim it on a later return within four years. It isn’t carried there for you: add it to that return’s line 107.`;
    case 'write_off_removed': return `A write-off of ${ofInvoice} (${on}) no longer counts: ${money}. ${CHANGE_EFFECT.adjust_filed}`;
    case 'recovery_added': return `${invoice}, written off and then paid ${on}: ${money} to add back on line 104. ${CHANGE_EFFECT.adjust_filed}`;
    case 'recovery_removed': return `A recovery on ${ofInvoice} (${on}) no longer counts: ${money}. ${CHANGE_EFFECT.ask_accountant}`;
    case 'answer_added': return `${invoice} has its GST/HST answer now. ${CHANGE_EFFECT.info}`;
  }
}

/** Line 106's bridge, in the drawing's order. */
export const NOT_ON_RETURN_STEPS: readonly { key: NotOnReturnStep; label: string }[] = [
  { key: 'simplified', label: 'Charged by simplified sellers' },
  { key: 'notRegistered', label: 'Charged by sellers not registered' },
  { key: 'beforeRegistration', label: 'Before your registration date' },
  { key: 'shareNotClaimable', label: 'Share not claimable (business use, meals)' },
  { key: 'held', label: 'Held · supplier’s number missing' },
  { key: 'notClaimed', label: 'Not claimed · “I can’t get the number”' },
  { key: 'typeNotSet', label: 'Tax type not set' },
];

// ── The accountant package's GST/HST files (Session D) ─────────────────────────────────────────────────────────────────────

/** A credit's state in words, for the package's credits and as-filed files (the credit rules are bookkeeping-gst.ts's). */
export const CREDIT_STATE_WORDS: Record<CreditState, string> = {
  counted: 'Counted on line 106',
  held: 'Held: waiting for the supplier’s number',
  not_claimed: 'Not claimed: “I can’t get the number”',
  not_claimable: 'No credit: this supplier’s tax can’t be claimed',
  before_registration: 'No credit counted: bought before the registration date (equipment, or prepaid time after it, may qualify: ask your accountant)',
  no_credit: 'No credit: the business-use rule gives none',
  type_not_set: 'Tax type not set',
  no_tax: 'No tax',
  not_gst_hst: 'Not GST/HST',
};

export const PACKAGE_FILES = {
  worksheet: 'gst-hst-worksheet.csv',
  credits: 'gst-hst-credits.csv',
  asFiled: 'gst-hst-as-filed.csv',
  /** Appended to the worksheet file when items under “Before you file” can still change a line. */
  openItems: (n: number) => `${n} ${n === 1 ? 'item is' : 'items are'} still open under “Before you file” (Reports › GST/HST return, for these dates) and can change a line.`,
  scope: {
    worksheet: (p: WorksheetPeriod, openEnded = false) => `gst-hst-worksheet.csv: lines 101 to 109 of the GST/HST return for ${p.from} to ${p.to} (Ontario days), regular method, the same figures as Reports › GST/HST return. These are today’s figures; a return marked filed for the same dates keeps its own in gst-hst-as-filed.csv. A line that cannot be worked out reads “${NOT_AVAILABLE}” with its reason, never zero. It uses these dates only: the expense filters below do not narrow it.${openEnded ? ' No start or end was chosen, so this runs from the start of our sales record, or to today, which is not a reporting period: choose the return’s dates to match a return.' : ''} An aid, not the return: nothing is filed from FieldLogicHQ.`,
    credits: 'gst-hst-credits.csv: each expense that feeds line 106 for those dates, with its credit and its state (counted, held for the supplier’s number, or no credit), and any credit carried from a return already marked filed. Supplier names only; the supplier’s GST/HST number is in expenses.csv. A credit that no longer counts after a return was filed is not listed here; Reports › GST/HST return › Changed since you filed lists it.',
    asFiled: (n: number) => `gst-hst-as-filed.csv: ${n === 1 ? 'the return' : `the ${n} returns`} marked as filed inside those dates, every revision, with the lines and the invoices, credit notes and credits behind them exactly as they stood when filed. The latest revision is the one that counts.`,
    noFiled: 'No return was marked as filed inside those dates, so there is no gst-hst-as-filed.csv.',
    filingsUnread: 'Your filed periods could not be read just now, so there is no gst-hst-as-filed.csv and line 106 reads “Not available”.',
    beforeRecord: 'The GST/HST files (gst-hst-worksheet.csv, gst-hst-credits.csv, gst-hst-as-filed.csv) are not included: the chosen dates end before our sales record starts.',
  },
} as const;
