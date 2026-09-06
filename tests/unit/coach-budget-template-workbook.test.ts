import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import ExcelJS from 'exceljs';
import { buildXLSXWorkbook } from '../../lib/export/xlsx.ts';
import { parseXLSX } from '../../lib/import/xlsx.ts';
import {
  monthGridTemplateHeaders, templateExampleRows, templateChoiceLists, referenceSheetRows,
  TEMPLATE_DATA_SHEET, TEMPLATE_REFERENCE_SHEET, TEMPLATE_LISTS_SHEET, REFERENCE_SHEET_HEADERS,
  MAX_IMPORT_ROWS, type KnownCategory,
} from '../../lib/coach-budget-import.ts';

/**
 * The budget template's workbook, proved by reading back what we actually wrote.
 *
 * ⚠ WHY THIS FILE EXISTS. A template that carries dropdowns and extra sheets makes three claims no
 * static check can see: that the validation landed on the empty rows a coach fills in, that the
 * lookup sheet is hidden, and that OUR OWN importer still reads the file back. A dropdown that
 * silently fails to appear looks exactly like a dropdown nobody opened, and the round trip is the
 * only thing standing between "export it, edit it, import it back" and a claim.
 */

const CATEGORIES: KnownCategory[] = [
  { id: 'c1', name: 'Tournaments', items: [
    { id: 'i1', name: 'Entry Fees', source: 'standard' },
    { id: 'i2', name: 'Charter Bus', source: 'team' },
  ] },
  { id: 'c2', name: 'Officials', items: [{ id: 'i3', name: 'Umpire Fees', source: 'club' }] },
];

const MONTHS = ['2026-09', '2026-10'] as const;

/** Exactly what `BudgetImportSheet.downloadTemplate` hands the writer for a month grid. */
function buildTemplate() {
  const headers = monthGridTemplateHeaders([...MONTHS]);
  const rows = templateExampleRows(CATEGORIES, headers.length);
  const choices = templateChoiceLists(CATEGORIES);

  const columnChoices: (string | undefined)[] = headers.map(() => undefined);
  columnChoices[headers.indexOf('Category')] = `${TEMPLATE_LISTS_SHEET}!$A$2:$A$${choices.categories.length + 1}`;
  columnChoices[headers.indexOf('Line')] = `${TEMPLATE_LISTS_SHEET}!$B$2:$B$${choices.items.length + 1}`;

  const listRows: string[][] = [];
  for (let i = 0; i < Math.max(choices.categories.length, choices.items.length); i += 1) {
    listRows.push([choices.categories[i] ?? '', choices.items[i] ?? '']);
  }

  return buildXLSXWorkbook(headers, rows, TEMPLATE_DATA_SHEET, {
    columnChoices,
    choiceRowCount: MAX_IMPORT_ROWS,
    extraSheets: [
      { name: TEMPLATE_REFERENCE_SHEET, headers: [...REFERENCE_SHEET_HEADERS], rows: referenceSheetRows(CATEGORIES) },
      { name: TEMPLATE_LISTS_SHEET, headers: ['Categories', 'Cost names'], rows: listRows, hidden: true },
    ],
  });
}

async function reload(workbook: ExcelJS.Workbook): Promise<{ book: ExcelJS.Workbook; bytes: ArrayBuffer }> {
  const bytes = await workbook.xlsx.writeBuffer() as ArrayBuffer;
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(Buffer.from(bytes) as never);
  return { book, bytes };
}

describe('the budget template workbook', () => {
  it('carries three sheets, the data one first', async () => {
    const { book } = await reload(buildTemplate());
    assert.deepEqual(book.worksheets.map(w => w.name), ['Data', 'Reference', 'Lists']);
  });

  it('hides the lookup sheet but leaves the reference one readable', async () => {
    const { book } = await reload(buildTemplate());
    assert.equal(book.getWorksheet('Lists')!.state, 'hidden');
    // ⚠ 'hidden', never 'veryHidden' — a coach who spots the tab must be able to look at it.
    assert.notEqual(book.getWorksheet('Reference')!.state, 'hidden');
  });

  it('spells out every category and cost name on the Reference sheet, with no amount anywhere', async () => {
    const { book } = await reload(buildTemplate());
    const sheet = book.getWorksheet('Reference')!;
    const read: string[][] = [];
    sheet.eachRow(row => read.push([1, 2, 3].map(c => String(row.getCell(c).value ?? ''))));
    assert.deepEqual(read, [
      ['Category', 'Cost name', 'Where it comes from'],
      ['Tournaments', 'Entry Fees', 'Standard'],
      ['Tournaments', 'Charter Bus', 'This team'],
      ['Officials', 'Umpire Fees', 'Your club'],
    ]);
    // D-G1: nothing on this sheet can be read as a figure the product proposed.
    for (const row of read) for (const cell of row) assert.equal(/\d/.test(cell), false, `"${cell}" holds a digit`);
  });

  it('puts a dropdown on Category and Line — pointed at a RANGE, and covering every row a coach can fill in', async () => {
    const { book } = await reload(buildTemplate());
    const data = book.getWorksheet('Data')!;

    for (const [column, listColumn] of [[1, '$A$'], [2, '$B$']] as const) {
      // Row 2 is the first fill-in row; MAX_IMPORT_ROWS + 1 is the last one the importer accepts.
      for (const rowNumber of [2, 7, MAX_IMPORT_ROWS + 1]) {
        const validation = data.getRow(rowNumber).getCell(column).dataValidation;
        assert.equal(validation?.type, 'list', `row ${rowNumber} col ${column} has no dropdown`);
        // ⚠ A RANGE, NOT AN INLINE LIST: Excel caps an inline formula at 255 characters and simply
        // drops the dropdown when it is exceeded, with no error anywhere.
        assert.ok(String(validation!.formulae[0]).startsWith(`Lists!${listColumn}`), 'not a Lists range');
        // ⚠ IT OFFERS, IT NEVER REFUSES. A coach must still be able to type a cost we have no
        // word for — that is the reason the importer creates one.
        /* ⚠ OMITTED, NOT `false` — and that is the correct file. OOXML defaults
           `showErrorMessage` to off when the attribute is absent, so ExcelJS drops it on write and
           reads it back as undefined. The contract this asserts is the behaviour: Excel must not
           REFUSE an off-list value, because a coach has to be able to name a cost we have no word
           for. Asserting the literal false would be asserting a serialisation detail. */
        assert.notEqual(validation!.showErrorMessage, true);
        assert.equal(validation!.allowBlank, true);
      }
    }
  });

  it('leaves the month and Notes columns alone', async () => {
    const { book } = await reload(buildTemplate());
    const data = book.getWorksheet('Data')!;
    for (const column of [3, 4, 5]) {
      assert.equal(data.getRow(2).getCell(column).dataValidation, undefined);
    }
  });

  it('ROUND TRIP — our own importer reads the Data sheet and ignores both vocabulary sheets', async () => {
    const { bytes } = await reload(buildTemplate());
    const parsed = await parseXLSX(bytes, MAX_IMPORT_ROWS);

    assert.deepEqual(parsed.headers.slice(0, 2), ['Category', 'Line']);
    // The example rows we ship, and nothing from Reference or Lists.
    assert.equal(parsed.rows.length, templateExampleRows(CATEGORIES, 5).length);
    const names = parsed.rows.map(r => r.values[parsed.headers[1]]);
    assert.deepEqual(names, ['Entry Fees', 'Charter Bus', 'Umpire Fees']);
    // "Umpire Fees" is the giveaway: were Lists being read, its sorted column would appear too.
    assert.equal(names.filter(n => n === 'Umpire Fees').length, 1);
  });

  it('still reads a template downloaded BEFORE this change — one sheet, called Template', async () => {
    const legacy = buildXLSXWorkbook(['Category', 'Line', 'Amount'], [['Tournaments', 'Entry Fees', '']], 'Template');
    const { bytes } = await reload(legacy);
    const parsed = await parseXLSX(bytes, MAX_IMPORT_ROWS);
    assert.deepEqual(parsed.headers, ['Category', 'Line', 'Amount']);
    assert.equal(parsed.rows.length, 1);
  });
});

describe('downloadXLSX’s existing callers are untouched', () => {
  it('a build with neither new option produces one visible sheet and no validation', async () => {
    const plain = buildXLSXWorkbook(['Name', 'Paid'], [['Ava', '$40.00'], ['Ben', '$40.00']], 'Data');
    const { book } = await reload(plain);
    assert.equal(book.worksheets.length, 1);
    assert.notEqual(book.worksheets[0].state, 'hidden');
    assert.equal(book.getWorksheet('Data')!.getRow(2).getCell(1).dataValidation, undefined);
    assert.equal(book.getWorksheet('Data')!.getRow(2).getCell(1).value, 'Ava');
  });
});
