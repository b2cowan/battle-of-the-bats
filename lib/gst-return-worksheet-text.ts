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
import { formatCad } from './bookkeeping-gst';
import { provinceName } from './canadian-provinces';
import type { LineNumber, NotAvailableWhy, NotOnReturnStep, TaxGroup, UnresolvedKind, Worksheet } from './gst-return-worksheet';

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
};

const LINES: readonly LineNumber[] = [101, 103, 104, 105, 106, 107, 108, 109];

/** "Copy lines": one line per return line, the figure as you type it. */
export function copyLinesText(worksheet: Worksheet): string {
  return LINES.map(line => {
    const figure = plainFigure(worksheet, line);
    const word = plainWord(worksheet, line);
    const status = figure == null ? `${NOT_AVAILABLE} (${NOT_AVAILABLE_WHY[worksheet.lines[line].notAvailable ?? 'sales_unread']})`
      : `${figure}${word ? ` ${word}` : ''}${worksheet.lines[line].partial ? ' (partial)' : ''}`;
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
      line === 101 ? 'Whole dollars' : '',
      l.calculated ? 'Calculated' : '',
      l.partial ? 'Partial: the period starts before the sales record does' : '',
      line === 104 && figure != null ? LINE_104_UNTRACKED : '',
    ].filter(Boolean);
    rows.push([String(line), RETURN_LINES[line].caption, figure ?? '', notes.join('; ')]);
  }
  rows.push(['', `Period ${worksheet.period.from} to ${worksheet.period.to}. Regular method. An aid, not the return: nothing is filed from here.`, '', '']);
  return rows;
}

/** "Ontario · HST 13% on $2,400.00". */
export function taxGroupLabel(group: TaxGroup): string {
  const where = provinceName(group.region) ?? group.region ?? 'Province not recorded';
  const rate = group.rate == null ? '' : ` ${Number(group.rate.toFixed(3))}%`;
  return `${where} · ${group.taxType.toUpperCase()}${rate} on ${formatMoney(group.taxableCad)}`;
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
