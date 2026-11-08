/**
 * THE ACCOUNTANT PACKAGE'S GST/HST FILES (GST/HST Stage 4b Session D). Pure: rows only, no I/O, no rule.
 * Every figure is the engine's worksheet (lib/gst-return-worksheet.ts) or a filing's frozen record (lib/gst-return-filing.ts),
 * in cents turned to dollars the way the Worksheet CSV does it (a plain figure, never a sign: a figure below zero is flagged in
 * the Note column, because csvCell would turn a leading "-" into text). Where each is built: app/api/platform-admin/bookkeeping/package/route.ts.
 *
 *   · gst-hst-worksheet.csv: the Worksheet CSV's rows for the package's dates, plus how many “Before you file” items are open.
 *   · gst-hst-credits.csv: line 106's expenses with their state, and the credits carried from a return already filed.
 *   · gst-hst-as-filed.csv: every revision of every return marked filed inside the package's dates; absent when there is none.
 *   · The sales are NOT here: the package's one invoice file (invoices-and-credit-notes.csv) is the sales record.
 */
import { WORKSHEET_LINES, type Worksheet, type WorksheetPeriod } from './gst-return-worksheet';
import { TAX_TYPES, type CreditState } from './bookkeeping-gst';
import { latestFilings } from './gst-return-filing';
import type { StoredGstReturnFiling } from './bookkeeping-store';
import { CREDIT_STATE_WORDS, PACKAGE_FILES, RETURN_LINES, UNRESOLVED, worksheetCsvRows } from './gst-return-worksheet-text';
import { orgDayKey } from './timezone';

type Cell = string | number;
/** A plain dollar figure with no sign (cents / 100, two places). */
const plain = (cents: number) => (Math.abs(cents) / 100).toFixed(2);
const belowZero = (...cents: (number | null)[]) => (cents.some(c => c != null && c < 0) ? 'Below zero' : '');
const notes = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join('; ');
const stateWords = (state: string) => CREDIT_STATE_WORDS[state as CreditState] ?? state;

// ── gst-hst-worksheet.csv ───────────────────────────────────────────────────────────────────────────────────────────────

export function packageWorksheetRows(worksheet: Worksheet): Cell[][] {
  const rows: Cell[][] = worksheetCsvRows(worksheet);
  const open = worksheet.unresolved.filter(u => u.affects.length > 0).length;
  if (open > 0) rows.push(['', PACKAGE_FILES.openItems(open), '', '']);
  return rows;
}

// ── gst-hst-credits.csv ─────────────────────────────────────────────────────────────────────────────────────────────────

export const CREDITS_FILE_HEADER = [
  'Section', 'Expense ID', 'Revision', 'Supplier', 'Incurred on', 'Saved on', 'Tax', 'GST/HST paid (CAD)',
  'Credit on line 106 (CAD)', 'Credit held (CAD)', 'Credit state', 'Lands on the return covering', 'Filed period', 'Note',
] as const;

/**
 * `filings` (the package's filed returns, optional): a credit on an expense dated inside a filed return that the filing did not claim
 * (a number added, or the expense entered, after it was filed) is counted in these dates' line 106 but is NOT on that filed return, so
 * its Note says so: the accountant sees why the worksheet and the as-filed file differ (it goes on a later return, GST_HST_RETURN_LINES.md §10).
 */
export function creditsFileRows(worksheet: Worksheet, filings: readonly StoredGstReturnFiling[] = []): Cell[][] {
  const rows: Cell[][] = [[...CREDITS_FILE_HEADER]];
  const filed = latestFilings(filings);
  const { credits, earlierCredits } = worksheet.parts[106];
  for (const c of credits) {
    const held = c.state === 'held' ? c.notOnReturn.held ?? 0 : 0;
    const shareLeftOut = c.notOnReturn.shareNotClaimable;
    // A filing whose sources can't be read says nothing about what it claimed, so it is never compared (the route refuses to build with one;
    // this keeps the function from asserting "not on the return" on a guess).
    const found = filed.find(f => c.incurredOn >= f.period.from && c.incurredOn <= f.period.to);
    const covering = found?.sources ? found : undefined;
    const claimed = covering?.sources?.credits.find(x => x.expenseId === c.expenseId)?.creditCents ?? 0;
    rows.push([
      'This period', c.expenseId, c.revision, c.supplier, c.incurredOn, c.savedOn, c.taxTypes.map(t => TAX_TYPES[t].label).join('; '),
      plain(c.gstHstPaid), plain(c.creditCents), held ? plain(held) : '', stateWords(c.state), '', '',
      notes(c.registrationUnchecked && 'Counted for now: the supplier’s registration has not been checked',
        shareLeftOut != null && `${plain(shareLeftOut)} of the GST/HST is not claimable (business use or meals)`,
        covering && c.creditCents > claimed && `${claimed ? `${plain(c.creditCents - claimed)} more than` : 'Not on'} the return filed ${covering.filedOn} for ${covering.period.from} to ${covering.period.to}: added or released after it was filed, so it counts on a later return`,
        // Less than the filed return claimed = over-claimed (GST_HST_RETURN_LINES.md §10): the one change that means adjusting the filed return.
        covering && claimed > c.creditCents && `${plain(claimed - c.creditCents)} less than the return filed ${covering.filedOn} for ${covering.period.from} to ${covering.period.to} claimed: over-claimed, so adjust that filed return in My Business Account`),
    ]);
  }
  for (const c of earlierCredits) {
    rows.push([
      'Carried from a filed return', c.expenseId, c.revision, c.supplier, c.incurredOn, c.savedOn, '', '',
      plain(c.cents), '', 'Counted on line 106 as a credit from an earlier period', c.landsOn, `${c.filedPeriod.from} to ${c.filedPeriod.to}`,
      'Released or entered after that return was filed, so it counts on a later return',
    ]);
  }
  return rows;
}

// ── gst-hst-as-filed.csv ────────────────────────────────────────────────────────────────────────────────────────────────

/** The filings whose dates lie inside the package's dates, oldest period first, each period's revisions oldest first. */
export function filingsInside(filings: readonly StoredGstReturnFiling[], period: WorksheetPeriod): StoredGstReturnFiling[] {
  return filings.filter(f => f.period.from >= period.from && f.period.to <= period.to)
    .sort((a, b) => a.period.from.localeCompare(b.period.from) || a.period.to.localeCompare(b.period.to) || a.periodRevision - b.periodRevision);
}

export const AS_FILED_HEADER = [
  'Filing number', 'Revision', 'Latest revision', 'Period from', 'Period to', 'Filed on', 'Saved on', 'Reason',
  'Part', 'Reference', 'Detail', 'Date', 'Amount before tax (CAD)', 'Amount (CAD)', 'Note',
] as const;

export function asFiledFileRows(filings: readonly StoredGstReturnFiling[]): Cell[][] {
  const rows: Cell[][] = [[...AS_FILED_HEADER]];
  const latest = new Map<string, number>();
  for (const f of filings) {
    const key = `${f.period.from}|${f.period.to}`;
    latest.set(key, Math.max(latest.get(key) ?? 0, f.periodRevision));
  }
  for (const f of filings) {
    const head: Cell[] = [f.filingNo, f.periodRevision, latest.get(`${f.period.from}|${f.period.to}`) === f.periodRevision ? 'Yes' : 'No',
      f.period.from, f.period.to, f.filedOn, orgDayKey(f.createdAt), f.reason ?? ''];
    const add = (part: string, reference: Cell, detail: string, date: string, beforeTax: number | null, amount: number | string | null, note = '') =>
      rows.push([...head, part, reference, detail, date, beforeTax == null ? '' : plain(beforeTax), amount == null ? '' : typeof amount === 'string' ? amount : plain(amount), note]);

    add('Filing', '', 'The return as it was marked filed', '', null, null,
      notes(f.partial && 'The sales lines were partial when filed', f.openItems > 0 && `Filed with ${f.openItems} ${f.openItems === 1 ? 'item' : 'items'} under “Before you file” open`));
    for (const line of WORKSHEET_LINES) {
      const cents = f.lines[line];
      // Line 101 is filed in whole dollars; the others in cents. Net tax (109) says refund or owing instead of a sign.
      const figure = line === 101 ? String(Math.abs(f.wholeDollars101)) : cents;
      add('Line', line, RETURN_LINES[line].caption, '', null, figure,
        notes(line === 101 && 'Whole dollars', line === 109 && cents !== 0 && (cents < 0 ? 'Refund' : 'You owe'), line !== 109 && belowZero(line === 101 ? f.wholeDollars101 : cents)));
    }
    const s = f.sources;
    if (!s) continue;
    for (const i of s.invoices) add('Invoice (lines 101 and 103)', i.invoiceNumber ?? i.invoiceId, 'GST/HST on the invoice', i.issuedOn, i.beforeTaxCad, i.gstHstCad,
      notes(i.gstHstCad == null && 'No exchange rate had been read yet', belowZero(i.beforeTaxCad, i.gstHstCad)));
    for (const n of s.creditNotes) add('Credit note (line 107)', n.noteNumber ?? n.noteId ?? '', `Relief on invoice ${n.invoiceNumber ?? n.invoiceId}`, n.on, null, n.cents);
    for (const b of s.badDebts) add('Bad debt written off (line 107)', b.invoiceNumber ?? b.invoiceId, 'Relief on the unpaid share', b.on, null, b.cents);
    for (const r of s.recoveries) add('Recovered bad debt (line 104)', r.invoiceNumber ?? r.invoiceId, 'Added back when it was paid', r.on, null, r.cents);
    for (const c of s.credits) add('Expense credit (line 106)', c.expenseId, `${c.supplier} · revision ${c.revision}`, c.incurredOn, null, c.creditCents, stateWords(c.state));
    for (const c of s.earlierCredits) add('Credit from an earlier period (line 106)', c.expenseId, `${c.supplier} · revision ${c.revision}`, c.incurredOn, null, c.cents, `Landed on the return covering ${c.landsOn}`);
    for (const o of s.open) add('Open item when filed', o.invoiceId ?? o.expenseId ?? o.noteId ?? '', UNRESOLVED[o.kind].one, '', null, null);
  }
  return rows;
}
