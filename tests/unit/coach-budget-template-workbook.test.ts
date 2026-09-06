import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import ExcelJS from 'exceljs';
import { buildXLSXWorkbook } from '../../lib/export/xlsx.ts';
import { parseXLSX } from '../../lib/import/xlsx.ts';
import {
  monthGridTemplateHeaders, templateExampleRows, budgetTemplateWorkbook,
  TEMPLATE_DATA_SHEET, REFERENCE_SHEET_NOTE,
  TEMPLATE_CATEGORY_PROMPT, TEMPLATE_LINE_PROMPT,
  NO_COST_NAMES_YET, INCOME_NAMES_ONLY,
  MAX_IMPORT_ROWS, ALIASES, templateGuideLines, LIST_TEMPLATE_HEADERS, PAYABLES_TEMPLATE_HEADERS,
  type KnownCategory, type BudgetImportShape,
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
  // The two blanks that are NOT the same blank — a heading waiting for its first cost name, and a
  // heading whose whole vocabulary sits on the income side this sheet filters out.
  { id: 'c3', name: 'Provincials Trip', items: [] },
  { id: 'c4', name: 'Other Income', items: [], incomeNameCount: 4 },
];

const MONTHS = ['2026-09', '2026-10'] as const;

const HEADERS = monthGridTemplateHeaders([...MONTHS]);

/** THE builder the download button calls — not a copy of it. */
function buildTemplate() {
  const { rows, options } = budgetTemplateWorkbook(HEADERS, CATEGORIES);
  return buildXLSXWorkbook(HEADERS, rows, TEMPLATE_DATA_SHEET, options);
}

async function reload(workbook: ExcelJS.Workbook): Promise<{ book: ExcelJS.Workbook; bytes: ArrayBuffer }> {
  const bytes = await workbook.xlsx.writeBuffer() as ArrayBuffer;
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(Buffer.from(bytes) as never);
  return { book, bytes };
}

describe('the budget template workbook', () => {
  it('opens on the guide, and the grid is the sheet after it', async () => {
    const { book } = await reload(buildTemplate());
    assert.deepEqual(book.worksheets.map(w => w.name), ['Instructions', 'Data', 'Reference', 'Lists']);
    // Landing there is a separate fact from being first: Excel restores the last-active tab.
    assert.equal(book.views[0]?.activeTab, 0);
  });

  it('the guide keeps column B EMPTY — the trap that would feed the parser made-up settings', async () => {
    const { book } = await reload(buildTemplate());
    const guide = book.getWorksheet('Instructions')!;
    /* ⚠ `parseXLSX` reads a sheet called `Instructions` as key/value metadata, column A the key
       and column B the value — that is how the tournament importers carry settings. One sentence
       parked in column B here and this guide starts configuring imports with its own prose. */
    guide.eachRow(row => {
      assert.equal(row.getCell(2).value ?? '', '', `row ${row.number} put something in column B`);
    });
    const said = [] as string[];
    guide.eachRow(row => said.push(String(row.getCell(1).value ?? '')));
    // It has to answer the three things no other surface in this file can.
    assert.ok(said.some(t => t.includes('Data tab')), 'never says which tab to fill in');
    assert.ok(said.some(t => /add it to your team’s list/.test(t)), 'never says a cost name is created');
    assert.ok(said.some(t => /cannot be created/.test(t)), 'never says a category is not');
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

    // The table, then a merged sentence on the last row — asserted apart, because a merged cell
    // reads its master's value back through every column it spans.
    const note = read.pop()!;
    assert.deepEqual(read, [
      ['Category', 'Cost name', 'Where it comes from'],
      ['Tournaments', 'Entry Fees', 'Standard'],
      ['Tournaments', 'Charter Bus', 'This team'],
      ['Officials', 'Umpire Fees', 'Your club'],
      /* ⚠ TWO BLANKS, TWO SENTENCES (owner, 2026-09-06). These rows shipped identical and empty,
         which reads as data that failed to load. The third column stays empty on purpose: it says
         where a cost NAME came from, and there is no name here to answer for. */
      ['Provincials Trip', NO_COST_NAMES_YET, ''],
      ['Other Income', INCOME_NAMES_ONLY, ''],
    ]);
    assert.equal(note[0], REFERENCE_SHEET_NOTE);

    // D-G1: nothing on this sheet can be read as a figure the product proposed.
    for (const row of [...read, note]) {
      for (const cell of row) assert.equal(/\d/.test(cell), false, `"${cell}" holds a digit`);
    }
  });

  it('says, on the cells a coach types into, what each dropdown will and will not create', async () => {
    const { book } = await reload(buildTemplate());
    const data = book.getWorksheet('Data')!;

    for (const [column, expected] of [[1, TEMPLATE_CATEGORY_PROMPT], [2, TEMPLATE_LINE_PROMPT]] as const) {
      for (const rowNumber of [2, MAX_IMPORT_ROWS + 1]) {
        const validation = data.getRow(rowNumber).getCell(column).dataValidation;
        assert.equal(validation?.showInputMessage, true, `row ${rowNumber} col ${column} says nothing`);
        assert.equal(validation!.promptTitle, expected.title);
        assert.equal(validation!.prompt, expected.body);
      }
    }

    /* ⚠ EXCEL TRUNCATES SILENTLY at 32 and 255. A prompt that outgrows either arrives on a coach's
       screen with its last clause missing and nothing anywhere says so. */
    for (const prompt of [TEMPLATE_CATEGORY_PROMPT, TEMPLATE_LINE_PROMPT]) {
      assert.ok(prompt.title.length <= 32, `"${prompt.title}" is over Excel's title limit`);
      assert.ok(prompt.body.length <= 255, 'prompt body is over Excel’s 255-character limit');
    }
  });

  it('puts a dropdown on Category and Line — pointed at a RANGE, and covering every row a coach can fill in', async () => {
    const { book } = await reload(buildTemplate());
    const data = book.getWorksheet('Data')!;

    for (const [column, opensWith] of [[1, 'Lists!$A$'], [2, 'IF(COUNTIF(']] as const) {
      // Row 2 is the first fill-in row; MAX_IMPORT_ROWS + 1 is the last one the importer accepts.
      for (const rowNumber of [2, 7, MAX_IMPORT_ROWS + 1]) {
        const validation = data.getRow(rowNumber).getCell(column).dataValidation;
        assert.equal(validation?.type, 'list', `row ${rowNumber} col ${column} has no dropdown`);
        const formula = String(validation!.formulae[0]);
        // Category is one fixed range; Line is the dependent formula. Neither is an inline list.
        assert.ok(formula.startsWith(opensWith), `row ${rowNumber} col ${column}: ${formula}`);
        /* ⚠ 255 CHARACTERS, AND EXCEL FAILS BY GOING QUIET. Past the cap the dropdown simply does
           not appear — no error, no warning, indistinguishable from a dropdown nobody opened. The
           last row is the longest formula in the file (the widest row number), so it is the one
           that has to be measured. */
        assert.ok(formula.length <= 255, `formula is ${formula.length} chars on row ${rowNumber}`);
        // ⚠ NO LEADING '='. OOXML stores it without one; an '=' here yields '==IF(...)' and Excel
        // drops the dropdown, silently, exactly like the overflow above.
        assert.ok(!formula.startsWith('='), 'validation formula must not start with =');
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

  /* ══════════════════════════════════════════════════════════════════════════════════════════
     THE DEPENDENT LINE DROPDOWN (owner, 2026-09-06)

     ⚠ THIS SUITE EXISTS BECAUSE NOTHING ELSE CAN SEE THIS FEATURE WORK. The list a coach is
     offered is decided by Excel evaluating a formula against a hidden sheet — so a wrong range, an
     off-by-one in the MATCH, or a pair block that stopped being grouped all produce the same
     symptom: a dropdown that opens on the wrong names, or on none, with every gate green. Rather
     than assert the formula's TEXT (which proves only that we wrote what we wrote), these tests
     EVALUATE it against the sheet actually written into the file, the way Excel would.
     ══════════════════════════════════════════════════════════════════════════════════════════ */

  /** The `Lists` sheet as Excel sees it: 1-based sheet rows, cells as strings. */
  function readLists(book: ExcelJS.Workbook): { col: (letter: string, from: number, to: number) => string[] } {
    const sheet = book.getWorksheet('Lists')!;
    const index: Record<string, number> = { A: 1, B: 2, C: 3, D: 4 };
    return {
      col: (letter, from, to) => {
        const out: string[] = [];
        for (let r = from; r <= to; r += 1) out.push(String(sheet.getRow(r).getCell(index[letter]).value ?? ''));
        return out;
      },
    };
  }

  /**
   * Excel's answer to "what does this dropdown offer?", computed from the file's own cells.
   *
   * Implements exactly the three functions the formula uses — COUNTIF, MATCH and OFFSET — with
   * Excel's case-insensitive text comparison, over the ranges parsed out of the formula itself. If
   * the writer changes a range bound, this reads the NEW bound and the assertion still means what
   * it says.
   */
  function offeredNames(formula: string, categoryValue: string, lists: ReturnType<typeof readLists>): string[] {
    const m = formula.match(
      /^IF\(COUNTIF\(Lists!\$C\$2:\$C\$(\d+),\$[A-Z]+\d+\)=0,Lists!\$B\$2:\$B\$(\d+),OFFSET\(Lists!\$D\$2,MATCH\(\$[A-Z]+\d+,Lists!\$C\$2:\$C\$\d+,0\)-1,0,COUNTIF\(Lists!\$C\$2:\$C\$\d+,\$[A-Z]+\d+\),1\)\)$/,
    );
    assert.ok(m, `formula is not the shape this test knows how to evaluate: ${formula}`);
    const [, pairEnd, itemEnd] = m!;

    const pairCats = lists.col('C', 2, Number(pairEnd));
    const pairNames = lists.col('D', 2, Number(pairEnd));
    const allNames = lists.col('B', 2, Number(itemEnd));

    const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase(); // Excel ignores case
    const count = pairCats.filter(c => same(c, categoryValue)).length;
    if (count === 0) return allNames.filter(Boolean); // the IF's fallback leg
    const first = pairCats.findIndex(c => same(c, categoryValue)); // MATCH(...)-1
    return pairNames.slice(first, first + count);                 // OFFSET(..., height, 1)
  }

  it('the Line dropdown offers only the names under the category on ITS OWN row', async () => {
    const { book } = await reload(buildTemplate());
    const data = book.getWorksheet('Data')!;
    const lists = readLists(book);

    const formula = String(data.getRow(2).getCell(2).dataValidation!.formulae[0]);

    // Tournaments holds two names and Officials one — and neither may see the other's.
    assert.deepEqual(offeredNames(formula, 'Tournaments', lists), ['Charter Bus', 'Entry Fees']);
    assert.deepEqual(offeredNames(formula, 'Officials', lists), ['Umpire Fees']);
    // Case is Excel's to ignore, and a coach retyping a category by hand will not match ours.
    assert.deepEqual(offeredNames(formula, 'oFFICIALS', lists), ['Umpire Fees']);
  });

  it('falls back to every name when the row names no category we hold — never to an empty list', async () => {
    const { book } = await reload(buildTemplate());
    const data = book.getWorksheet('Data')!;
    const lists = readLists(book);
    const formula = String(data.getRow(2).getCell(2).dataValidation!.formulae[0]);

    const everything = ['Charter Bus', 'Entry Fees', 'Umpire Fees'];
    /* ⚠ AN EMPTY DROPDOWN WOULD BE THE WORST OUTCOME OF THIS FEATURE — it reads as "you may not
       type anything here" on a field that must stay open. A blank category, a heading the coach
       invented, and a heading that holds no cost names yet all fall back to the full list. */
    assert.deepEqual(offeredNames(formula, '', lists), everything, 'blank category');
    assert.deepEqual(offeredNames(formula, 'Bake Sale', lists), everything, 'a category we do not hold');
    assert.deepEqual(offeredNames(formula, 'Provincials Trip', lists), everything, 'a heading with no cost names');
  });

  it('every fill-in row asks about its own category cell, not row 2’s', async () => {
    const { book } = await reload(buildTemplate());
    const data = book.getWorksheet('Data')!;
    /* ⚠ THE DEFECT THIS CATCHES IS INVISIBLE AND TOTAL: one formula reused down the column pins
       every row's dropdown to whatever row 2 says, so a coach filling in row 40 gets row 2's
       category's names and nothing anywhere looks wrong. */
    for (const rowNumber of [2, 3, 40, MAX_IMPORT_ROWS + 1]) {
      const formula = String(data.getRow(rowNumber).getCell(2).dataValidation!.formulae[0]);
      const referenced = [...formula.matchAll(/\$([A-Z]+)(\d+)\)/g)].map(m => `${m[1]}${m[2]}`);
      assert.ok(referenced.length > 0, `row ${rowNumber} references no category cell`);
      for (const ref of referenced) assert.equal(ref, `A${rowNumber}`, `row ${rowNumber} points at ${ref}`);
    }
  });

  it('the pair block stays GROUPED — the one thing MATCH + COUNTIF cannot survive without', async () => {
    const { book } = await reload(buildTemplate());
    const lists = readLists(book);
    const sheet = book.getWorksheet('Lists')!;
    const cats = lists.col('C', 2, sheet.rowCount).filter(Boolean);

    /* MATCH finds a category's FIRST row and COUNTIF counts ALL of them; the dropdown is that block
       read straight down. Interleave two categories and the block silently spans the wrong names —
       the dropdown still opens, still shows something, and is wrong. */
    const seen = new Set<string>();
    let previous = '';
    for (const name of cats) {
      if (name === previous) continue;
      assert.ok(!seen.has(name), `"${name}" appears in two separate blocks — the pair list is not grouped`);
      seen.add(name);
      previous = name;
    }
  });

  it('TWO CATEGORIES WITH ONE NAME still produce one block, and the right names', async () => {
    /* ⚠ THE DATABASE ALLOWS THIS AND NOTHING IN DEV DATA SHOWS IT — which is exactly why it would
       have shipped. `budget_categories.name` has no unique index; the ordinary way to get a pair is
       a club publishing "Travel" while the platform already ships "Travel", both visible to one
       team. Left as two blocks, MATCH finds the first and COUNTIF counts both, so the dropdown
       serves one over-long slice that reaches into whatever category sits between them. */
    const twins: KnownCategory[] = [
      { id: 'c1', name: 'Travel', items: [{ id: 'i1', name: 'Transport' }] },
      { id: 'c2', name: 'Officials', items: [{ id: 'i2', name: 'Umpire Fees' }] },
      { id: 'c3', name: 'travel', items: [{ id: 'i3', name: 'Accommodation' }] }, // the club's own
    ];
    const { rows, options } = budgetTemplateWorkbook(HEADERS, twins);
    const { book } = await reload(buildXLSXWorkbook(HEADERS, rows, TEMPLATE_DATA_SHEET, options));
    const lists = readLists(book);
    const formula = String(book.getWorksheet('Data')!.getRow(2).getCell(2).dataValidation!.formulae[0]);

    // Both spellings answer to one block holding BOTH categories' names — and never Officials'.
    assert.deepEqual(offeredNames(formula, 'Travel', lists), ['Accommodation', 'Transport']);
    assert.deepEqual(offeredNames(formula, 'travel', lists), ['Accommodation', 'Transport']);
    assert.deepEqual(offeredNames(formula, 'Officials', lists), ['Umpire Fees']);
    // And the Category dropdown lists the name once, not twice.
    const sheet = book.getWorksheet('Lists')!;
    const offered = lists.col('A', 2, sheet.rowCount).filter(Boolean);
    assert.deepEqual(offered, ['Travel', 'Officials']);
  });

  it('no heading on the hidden lookup sheet is a column name the READER recognises', async () => {
    const { book } = await reload(buildTemplate());
    const lists = book.getWorksheet('Lists')!;
    const headings = [1, 2, 3, 4].map(c => String(lists.getRow(1).getCell(c).value ?? ''));

    /* ⚠ THE DEFECT THIS CATCHES SHIPS SILENTLY AND ONLY BITES THE UNLUCKY. This sheet is hidden and
       never read on purpose — but `parseXLSX` falls back to "the first sheet that is not called
       instructions or reference" when there is no `Data` tab, and `Lists` is not on that list. A
       coach who DELETES the Data tab rather than filling it in gets this sheet parsed. While its
       headings match nothing, that fails cleanly and reads as an empty import; the moment one of
       them is a real column name, it succeeds and hands back a page of nonsense built from their
       own vocabulary. Column C was briefly called `Category`, which is exactly that. */
    const known = new Set(Object.values(ALIASES).flat() as string[]);
    for (const heading of headings) {
      assert.ok(heading, 'every lookup column keeps a heading a curious coach can read');
      assert.ok(
        !known.has(heading.trim().toLowerCase()),
        `"${heading}" is a heading the importer recognises — rename it`,
      );
    }
  });

  it('tints a new pairing and an unknown category — in two different colours, on the right columns', async () => {
    const { book } = await reload(buildTemplate());
    const data = book.getWorksheet('Data')!;
    const cf = (data as unknown as { conditionalFormattings: Array<{ ref: string; rules: Array<Record<string, unknown>> }> })
      .conditionalFormattings;

    const byColumn = new Map(cf.map(entry => [entry.ref.charAt(0), entry]));
    assert.deepEqual([...byColumn.keys()].sort(), ['A', 'B'], `tints landed on ${cf.map(c => c.ref)}`);

    for (const [letter, expected] of [['A', 'FFF7DDD4'], ['B', 'FFFCEBD0']] as const) {
      const entry = byColumn.get(letter)!;
      // Every fill-in row, the same span the dropdowns cover — not just the example rows.
      assert.equal(entry.ref, `${letter}2:${letter}${MAX_IMPORT_ROWS + 1}`);
      const rule = entry.rules[0] as { type: string; formulae: string[]; style: { fill: { bgColor: { argb: string } } } };
      assert.equal(rule.type, 'expression');
      assert.equal(rule.style.fill.bgColor.argb, expected);
      /* ⚠ RELATIVE ROW, ABSOLUTE COLUMN. `$A2` lets Excel walk the rule down the range; `$A$2`
         would paint all 300 rows according to row 2 — which looks correct until row 3 is used.
         The Lists ranges ARE fully anchored and must be, so they are taken out of the way first —
         without that, `Lists!$A$2` reads as an anchored row and this assertion passes on nothing. */
      const onDataSheet = rule.formulae[0].replace(/Lists!\$[A-Z]+\$\d+(:\$[A-Z]+\$\d+)?/g, '‹list›');
      assert.ok(onDataSheet.includes('$A2'), onDataSheet);
      assert.ok(!/\$[A-Z]+\$\d+/.test(onDataSheet), `a row is anchored: ${onDataSheet}`);
    }

    /* ⚠ A TINT MEANS NOTHING WITHOUT ITS LEGEND, and the two drift apart silently. The guide's
       swatches are painted from the same constants as the cells, so this proves the colour a coach
       sees explained is the colour they will actually get. */
    const guide = book.getWorksheet('Instructions')!;
    const swatches: string[] = [];
    guide.eachRow(row => {
      const fill = row.getCell(1).fill as { fgColor?: { argb?: string } } | undefined;
      if (fill?.fgColor?.argb) swatches.push(fill.fgColor.argb);
    });
    assert.deepEqual(swatches.sort(), ['FFF7DDD4', 'FFFCEBD0']);
  });

  /* ══════════════════════════════════════════════════════════════════════════════════════════
     ⚠ THE GUIDE MUST DESCRIBE THE SHEET IT IS ATTACHED TO — ALL THREE OF THEM (/review 2026-09-06).
     This shipped one review cycle branching only on "payables or not", which told a coach who chose
     the Simple list template to put each amount in the month they expect to pay it — on a sheet
     whose only money column is called Amount. A guide is the one surface a coach cannot check
     against anything, so a wrong sentence there is worse than no sentence.
     ══════════════════════════════════════════════════════════════════════════════════════════ */
  it('every shape’s guide names that shape’s own columns, and no others', () => {
    const MONTH_GRID_HEADERS = monthGridTemplateHeaders([...MONTHS]);
    const columnsOf: Record<BudgetImportShape, string[]> = {
      'month-grid': MONTH_GRID_HEADERS,
      list: [...LIST_TEMPLATE_HEADERS],
      payables: [...PAYABLES_TEMPLATE_HEADERS],
    };

    for (const shape of ['month-grid', 'list', 'payables'] as const) {
      const said = templateGuideLines(shape).map(l => l.text ?? '').join('\n');
      const headers = columnsOf[shape];

      // Every column the guide names by capitalised name must be a column that sheet actually has.
      for (const named of ['Line', 'Amount', 'Due Date', 'Payee', 'Description', 'Deposit', 'Balance']) {
        if (!said.includes(`${named} `) && !said.includes(`${named} —`)) continue;
        assert.ok(
          headers.some(h => h === named || h.startsWith(named)),
          `the ${shape} guide talks about "${named}", which that template has no column for`,
        );
      }
      // The month columns exist on ONE shape. Naming them anywhere else is the defect above.
      const talksAboutMonths = /month columns/i.test(said);
      assert.equal(talksAboutMonths, shape === 'month-grid', `${shape}: months mentioned wrongly`);
      // And every shape has to say the thing no other surface says.
      assert.ok(said.includes('Data tab'), `${shape} never says which tab to fill in`);
      assert.ok(/cannot be created/.test(said), `${shape} never says a category can’t be invented`);
    }
  });

  it('a template with no cost-name column does not explain the colour it can never show', () => {
    const payables = templateGuideLines('payables');
    const swatches = payables.filter(l => l.fillArgb);
    /* The bills sheet has no Line column, so its sand tint is never written — explaining it would
       send a coach hunting for something that cannot happen. The rust one still applies. */
    assert.deepEqual(swatches.map(l => l.fillArgb), ['FFF7DDD4']);
    assert.equal(templateGuideLines('month-grid').filter(l => l.fillArgb).length, 2);
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
