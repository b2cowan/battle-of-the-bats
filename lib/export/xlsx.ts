/**
 * lib/export/xlsx.ts
 * Excel workbook generation and client-side download using ExcelJS.
 *
 * NOTE: Uses ExcelJS (MIT, actively maintained) instead of SheetJS/xlsx,
 * which had two open HIGH CVEs (GHSA-4r6h-8v6p-xvw6, GHSA-5pgg-2g8v-p4x9)
 * with no fix available in its frozen community-edition release. Decision
 * documented in MERGED_EXPORTS_IMPLEMENTATION_PLAN.md Phase B6.
 *
 * ExcelJS is async (uses writeBuffer internally), so downloadXLSX returns
 * a Promise. Call it with `await` inside async handlers; it is safe to call
 * without await as fire-and-forget when no error handling is needed.
 */

import ExcelJS from 'exceljs';

/**
 * Presentation hints for one data row. All optional — an absent style is a plain row, so a caller
 * that passes nothing produces the exact file this module always has.
 */
/**
 * One footnote written under the table — a report's own caveats, travelling with its figures.
 *
 * `runs` carry the bold the screen carries, so the emphasis cannot drift between the page and the
 * file. `tone` is the one distinction that matters here: `alert` is a FINDING (a balance going
 * below zero) rather than an explanation, and it keeps the attention colour it has on screen.
 */
export type XlsxNote = {
  runs: { text: string; bold?: boolean }[];
  tone?: 'note' | 'alert';
};

/**
 * THE BLOCK ABOVE THE TABLE — whose money, what report, on what settings, true as of when.
 *
 * ⚠ WHY IT EXISTS (owner ruling 2026-09-05). Everything identifying an export lived in its
 * FILENAME, which is the first thing lost when somebody saves the attachment or pastes the table
 * into an email. A board member opening the file cold could not tell whose season it was, which
 * reading produced the figures, or what day they were true — and on a part-year reading, the date
 * is not decoration, it is what the numbers MEAN.
 *
 * ⚠⚠ NEVER PUT ONE ON A FILE THE PRODUCT RE-IMPORTS. The importer takes the FIRST NON-EMPTY ROW as
 * the column header, so a masthead is read as the header and the import fails on a file this
 * product produced. Reports are safe; the budget plan and bills templates are not.
 *
 * ⚠ NO FIGURES UP HERE. A spreadsheet's opening rows sum into whatever a treasurer later pivots or
 * selects — the same reason the PDF's board block was deliberately kept out of Excel — and a
 * headline goes stale inside its own file the moment anyone filters the rows beneath it.
 */
export type XlsxMasthead = {
  /** Line 1, large and bold: the team and season. */
  title: string;
  /** Line 2: the report and every setting that shaped it. */
  subtitle?: string;
  /** Line 3, quiet: the day the figures were true. */
  meta?: string;
  /** The CLUB's logo (a data URL), drawn beside the title. Never ours — see `footer`. */
  logoDataUrl?: string;
};

/** The line under everything, where a document says who produced it. Ours, not the club's. */
export type XlsxFooterMark = {
  text: string;
  logoDataUrl?: string;
};

/**
 * A second (or third) worksheet alongside the data one — a reference list, a legend, a lookup
 * source for dropdowns.
 *
 * ⚠ MIND WHAT `parseXLSX` DOES WITH THESE on a file the product re-imports. It resolves the sheet
 * to read as `getWorksheet('Data')` first, then the first sheet NOT named instructions/reference,
 * then sheet one. So on a re-importable file: name the data sheet `Data`, and name an extra sheet
 * `Reference` (or hide it) unless you want it to become a candidate.
 */
export type XlsxExtraSheet = {
  name: string;
  headers: string[];
  rows: (string | number | null | undefined)[][];
  /**
   * One quiet sentence under this sheet's table, after a blank spacer row.
   *
   * ⚠ SAFE HERE IN A WAY IT IS NOT ON THE DATA SHEET, and that asymmetry is the whole reason it
   * lives on this type rather than being written as a `note` on the main table. `parseXLSX` skips a
   * sheet called `Reference` BY NAME, so prose on one can never be read back; the same sentence
   * under the fill-in grid returns as a row with a category and no cost name, which the review step
   * blocks — a template manufacturing its own error.
   *
   * ⚠ THE SECOND GUARD NEEDS TWO COLUMNS (/review, 2026-09-06). A merged note reads its own text
   * back through every column it spans, which is what `isBannerRow` in the tabular reader keys on
   * to throw a sentence away. On a ONE-column extra sheet nothing is merged, so that backstop is
   * not there and only the sheet's name is holding the line. Keep a noted sheet at two columns or
   * wider, or make sure its name is one the parser skips.
   */
  note?: string;
  /** Hidden from the tab strip. A hidden sheet still works as a dropdown source. */
  hidden?: boolean;
};

/**
 * Where one dropdown's values come from: a fixed range for the whole column, or — for a list that
 * narrows with a neighbouring cell — a function handed the sheet row, returning that row's formula.
 *
 * ⚠ NO LEADING `=`. OOXML stores a validation formula without one; ExcelJS writes the string
 * through verbatim, so an `=` here produces `==IF(...)` and Excel drops the dropdown silently.
 *
 * ⚠ 255 CHARACTERS, formula included. Past that Excel does not complain — the dropdown simply
 * never appears, which looks exactly like a dropdown nobody opened.
 */
export type XlsxColumnChoice = string | ((sheetRow: number) => string);

/**
 * A conditional tint on one column's fill-in cells — Excel paints the cell when the formula is
 * TRUE, and repaints it the moment the coach changes anything it depends on.
 *
 * ⚠ WRITE THE FORMULA FOR THE FIRST FILL-IN ROW. Unlike a validation formula (one per cell), a
 * conditional rule is one rule over the whole range, and Excel shifts its relative references down
 * for you — so `$A2` on a range starting at row 2 means "this row's column A" all the way down.
 * Anchoring the row (`$A$2`) instead would paint every row according to row 2, which looks like
 * the feature working right up until the first coach fills in row 3.
 *
 * ⚠ A TINT IS NOT A REFUSAL, and the colour has to carry that. It marks a cell the product will
 * ACCEPT and act on — a name it is about to create, a category it is about to reject — so it earns
 * a legend somewhere the coach can read, or it is just an unexplained colour on their spreadsheet.
 */
export type XlsxColumnFlag = {
  /**
   * A function is handed the sheet's ACTUAL first fill-in row and returns the formula for it.
   *
   * ⚠ PREFER THE FUNCTION. A literal string has to hard-code that row, which is only ever right
   * because no re-importable file carries a masthead — and the day one does, the dropdowns keep
   * working (the writer derives their row from the live sheet) while these tints silently paint
   * the wrong rows. The function ties the two together.
   */
  formula: string | ((firstDataRow: number) => string);
  fillArgb: string;
  fontArgb?: string;
};

/** One line of a guide sheet. `as` decides how it reads; a fill makes it wear a colour it explains. */
export type XlsxGuideLine = {
  text?: string;
  as?: 'title' | 'heading' | 'bullet' | 'body';
  /** Paint this line's own cell — a legend entry rendered IN the colour it is describing. */
  fillArgb?: string;
  fontArgb?: string;
};

/**
 * A page of prose in front of the data sheet — what this file is and how to fill it in.
 *
 * ⚠ COLUMN A ONLY, AND THAT IS A HARD RULE, NOT A LAYOUT PREFERENCE. `parseXLSX` reads a sheet
 * named `Instructions` as key/value METADATA, taking column A as the key and column B as the
 * value (that is how the tournament importers carry settings). Put anything in column B here and
 * this guide starts feeding the parser made-up settings from its own sentences.
 *
 * ⚠ The name must stay one the parser skips — `Instructions` or `Reference` — because this sheet
 * sits FIRST in the tab strip, which is exactly where the "first sheet that is not instructions or
 * reference" fallback would otherwise land.
 */
export type XlsxGuideSheet = {
  name: string;
  lines: XlsxGuideLine[];
  /** Width of the single column, in characters. Defaults to a comfortable reading measure. */
  width?: number;
};

/**
 * `0 → 'A'`. Deliberately a second copy of the helper in `coach-budget-import.ts` rather than a
 * shared import: that module is pulled into a server route that has no business bundling ExcelJS,
 * and one exported function from here would drag the whole library across.
 */
function colLetter(index: number): string {
  let n = index;
  let out = '';
  do {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
}

export type XlsxRowStyle = {
  /** Bold the whole row — section headings, category rows, totals. */
  bold?: boolean;
  /**
   * Excel outline (grouping) level. 1 nests the row under the nearest level-0 row above it and
   * puts the +/− collapse control in the sheet margin. 0 / absent = top level.
   */
  outlineLevel?: number;
  /** Excel's own indent on the FIRST cell — visual nesting that lives in the cell, not its text. */
  indent?: number;
  /**
   * Start this row's group closed: the row opens hidden and the reader expands it with the "+".
   * Only meaningful with an outlineLevel. The row is HIDDEN, not absent — a re-imported file
   * still carries every collapsed row (parseXLSX iterates hidden rows like any other).
   *
   * ⚠ ALL-OR-NOTHING PER OUTLINE LEVEL. ExcelJS models the folded state as one sheet-wide
   * threshold (`Row.collapsed` is `outlineLevel >= properties.outlineLevelRow`), not a per-group
   * flag — so every group at a given level shares it. Do not mix open and closed groups at one
   * level, and do not use `outlineLevel` without `collapsed` on a sheet that also collapses that
   * level: the threshold would stamp the open rows' folded state too (/review, 2026-08-25).
   */
  collapsed?: boolean;
};

/**
 * Column and row options shared by the builder and the download wrapper.
 *
 * @param headers   - Column header labels (first row)
 * @param rows      - Data rows (2D array of strings/numbers)
 * @param sheetName - Worksheet tab name. Default: 'Data'
 * @param opts.columnNumFmts - Excel number-format strings, index-aligned with `headers`.
 *   Applied to data cells only — DISPLAY only, the stored value is untouched, so a formatted
 *   file re-imports identically to an unformatted one (`parseXLSX` reads `cell.value`).
 * @param opts.rowStyles - Presentation per data row, index-aligned with `rows` (the header row
 *   is not counted).
 * @param opts.columnHeaderDates - Real DATE values for header cells, index-aligned with
 *   `headers`, displayed as month + year ("Feb 2026"). Where set, the header cell stores the
 *   date instead of the label string — so a coach gets a genuine date to sort/pivot on, and a
 *   re-imported file hands the parser an ISO date it already reads. Pass UTC-midnight dates:
 *   ExcelJS converts with pure epoch math (no timezone shift), so only a UTC boundary lands
 *   exactly on the intended day in every locale.
 */
/**
 * A `data:` URL split into what ExcelJS wants. Null for anything else — an org that has never set a
 * logo, or a URL some future settings screen stores by reference rather than inline.
 *
 * ⚠ FAILS SOFT, ALWAYS. A malformed logo must cost a picture, never the download: this is the last
 * step before a treasurer gets their file, and throwing here would turn a cosmetic problem into
 * "the Export button is broken".
 */
function parseDataUrl(url: string): { base64: string; extension: 'png' | 'jpeg' | 'gif' } | null {
  const match = /^data:image\/(png|jpe?g|gif);base64,([A-Za-z0-9+/=\s]+)$/.exec(url.trim());
  if (!match) return null;
  const ext = match[1] === 'png' ? 'png' : match[1] === 'gif' ? 'gif' : 'jpeg';
  return { base64: match[2].replace(/\s/g, ''), extension: ext };
}

export type XlsxOptions = {
    columnNumFmts?: (string | undefined)[];
    rowStyles?: (XlsxRowStyle | undefined)[];
    columnHeaderDates?: (Date | undefined)[];
    /** The report's own footnotes, written under the table as merged, wrapped cells. See the
     *  block that renders them for the layout rules and for why the height is set by hand. */
    notes?: XlsxNote[];
    /** A title block above the header row. ⚠ Never on a file the product re-imports — see the type. */
    masthead?: XlsxMasthead;
    /** Our own mark, under the notes. Governed by the club's branding switch at the call site. */
    footer?: XlsxFooterMark;
    /** Extra worksheets after the data one. See `XlsxExtraSheet` for the re-import caveat. */
    extraSheets?: XlsxExtraSheet[];
    /**
     * Excel dropdowns on a column's data cells, index-aligned with `headers`. Each entry is a
     * RANGE REFERENCE into the workbook — `Lists!$A$2:$A$40` — not a list of values.
     *
     * ⚠ A RANGE, NEVER AN INLINE LIST. Excel caps an inline validation formula at 255 characters
     * total, which forty short names blow straight through; the failure is a dropdown that simply
     * does not appear, with no error anywhere.
     *
     * ⚠ THE DROPDOWN OFFERS, IT NEVER REFUSES — `showErrorMessage` is off and blanks are allowed,
     * so a value that is not on the list still types in. Every list this repo puts in front of a
     * coach is a convenience over a field that must still accept a word we have never heard of.
     * That is doubly true of a DEPENDENT list: narrowing what is offered must never narrow what is
     * accepted, or the narrowing becomes a refusal the coach cannot argue with.
     *
     * ⚠ A FUNCTION MAKES THE LIST DEPEND ON THE ROW. A plain string is one range for the whole
     * column. A function is handed the sheet row and returns that row's own source, which is what a
     * list keyed to a neighbouring cell needs — the formula has to name `$A5` on row 5. Excel reads
     * a validation formula relative to the cell it is attached to, and this writer attaches one per
     * cell, so the row the function is given is the row the formula must name.
     */
    columnChoices?: (XlsxColumnChoice | undefined)[];
    /**
     * The message Excel pops beside a cell the moment it is SELECTED, index-aligned with `headers`.
     * Only meaningful where `columnChoices` also has an entry — it rides the same validation object.
     *
     * ⚠ THIS IS HOW A RE-IMPORTED TEMPLATE EXPLAINS ITSELF. Every other way of writing a sentence
     * on a fill-in sheet — a note under the table, a masthead, a longer column heading — is either
     * read back as data or breaks the header match. A validation prompt is presentation on the
     * cell: the parser reads `cell.value` and never sees it, and a coach cannot type over it.
     *
     * ⚠ EXCEL TRUNCATES: 32 characters for the title, 255 for the body. Longer text is not
     * rejected, it is silently cut, so keep both short enough to read whole.
     */
    columnChoicePrompts?: ({ title: string; body: string } | undefined)[];
    /**
     * Conditional tints on the fill-in cells, index-aligned with `headers`. Applied over the same
     * row span the dropdowns cover, so `choiceRowCount` governs both.
     */
    columnFlags?: (XlsxColumnFlag | undefined)[];
    /**
     * A prose sheet placed FIRST and opened first. See `XlsxGuideSheet` for the two rules that keep
     * it from being mistaken for data.
     */
    guideSheet?: XlsxGuideSheet;
    /**
     * How many rows below the header the dropdowns cover. Defaults to the data rows actually
     * written, which is almost never what a template wants — a template's whole point is the empty
     * rows underneath.
     */
    choiceRowCount?: number;
};

/**
 * Build the workbook, without touching the DOM.
 *
 * ⚠ SPLIT OUT FROM `downloadXLSX` SO A TEST CAN READ WHAT WE ACTUALLY WROTE. A template that
 * carries dropdowns and extra sheets makes claims no static check can see — that the validation
 * landed, that the hidden sheet is hidden, that our own importer still reads the file back — and
 * every one of those is only provable by reloading the bytes.
 */
export function buildXLSXWorkbook(
  headers: string[],
  rows: (string | number | null | undefined)[][],
  sheetName = 'Data',
  opts?: XlsxOptions,
): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'FieldLogicHQ';
  workbook.created = new Date();

  /* ── The guide, BEFORE the data sheet ──────────────────────────────────────────────────────
     ⚠ CREATED FIRST BECAUSE THAT IS THE ONLY WAY TO ORDER IT. ExcelJS fixes a sheet's position at
     `addWorksheet`, so a page meant to be read before the grid cannot be appended with the other
     extra sheets — it has to exist before the grid does.
     ⚠ Ordering does NOT change what the importer reads: `parseXLSX` resolves `Data` by name first,
     and only falls back to tab order when there is no sheet by that name. */
  if (opts?.guideSheet) {
    const guide = workbook.addWorksheet(opts.guideSheet.name);
    guide.getColumn(1).width = opts.guideSheet.width ?? 96;
    for (const line of opts.guideSheet.lines) {
      const row = guide.addRow([]);
      if (!line.text) { row.height = 6; continue; } // a spacer, not a sentence
      const cell = row.getCell(1);
      cell.value = line.as === 'bullet' ? `•   ${line.text}` : line.text;
      cell.font = {
        bold: line.as === 'title' || line.as === 'heading',
        size: line.as === 'title' ? 14 : 10.5,
        color: { argb: line.fontArgb ?? (line.as === 'heading' ? 'FF1E293B' : 'FF3A3730') },
      };
      cell.alignment = { wrapText: true, vertical: 'middle', indent: line.as === 'bullet' ? 1 : 0 };
      if (line.fillArgb) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: line.fillArgb } };
      }
      // A wrapped cell is auto-fitted by Excel only when it is NOT merged; these are not, so one
      // line's worth of height is enough until the text outgrows the column.
      // The `+ 4` cushion is the one the report notes already use — a wrapped line that lands one
      // character over an estimate reads as a clipped sentence, and costs only whitespace to avoid.
      row.height = Math.max(line.as === 'title' ? 22 : 15, Math.ceil(cell.value.toString().length / 90) * 14 + 4);
    }
  }

  const ws = workbook.addWorksheet(sheetName);

  // Our summary rows (a category) sit ABOVE the rows they group — Excel's default assumes the
  // opposite and would hang the collapse control off the row BELOW the group.
  if (opts?.rowStyles?.some((s) => (s?.outlineLevel ?? 0) > 0)) {
    ws.properties.outlineProperties = { summaryBelow: false, summaryRight: false };
  }

  /* ── The masthead ──────────────────────────────────────────────────────────────────────────
     Three merged lines and a spacer, above the header row. Merged so a long team name spans the
     table instead of spilling across neighbouring columns and printing over them.

     ⚠ THE IMAGE IS ANCHORED TO THESE CELLS, not floated over the grid. A floating picture in a
     spreadsheet stays put when rows are inserted and does not travel when the range is copied —
     containing it in the block is what keeps that harmless, and the masthead is the one part of
     the file nobody pivots.
     ⚠ THE TEXT BLOCK HAS TO LOOK FINISHED WITHOUT IT, because most clubs have never uploaded a
     logo. A layout with a hole where a crest belongs is worse than one that never expected one, so
     the logo widens nothing and moves nothing — it sits in the left margin the merge already has. */
  const mastWidth = Math.max(1, headers.length);
  let logoImageId: number | undefined;
  if (opts?.masthead?.logoDataUrl) {
    const parsed = parseDataUrl(opts.masthead.logoDataUrl);
    if (parsed) logoImageId = workbook.addImage(parsed);
  }
  if (opts?.masthead) {
    const { title, subtitle, meta } = opts.masthead;
    const lines: Array<{ text: string; size: number; bold: boolean; color: string; height: number }> = [
      { text: title, size: 14, bold: true, color: 'FF1B1A17', height: 21 },
    ];
    if (subtitle) lines.push({ text: subtitle, size: 11, bold: true, color: 'FF1B1A17', height: 16 });
    if (meta) lines.push({ text: meta, size: 9, bold: false, color: 'FF56534B', height: 14 });
    for (const line of lines) {
      const row = ws.addRow([]);
      const cell = row.getCell(1);
      cell.value = line.text;
      cell.font = { size: line.size, bold: line.bold, color: { argb: line.color } };
      cell.alignment = { vertical: 'middle', indent: logoImageId !== undefined ? 8 : 0 };
      if (mastWidth > 1) ws.mergeCells(row.number, 1, row.number, mastWidth);
      row.height = line.height;
    }
    // A blank row, so the header band is not welded to the masthead above it.
    ws.addRow([]);
    if (logoImageId !== undefined) {
      /* Two-cell anchored inside the block: it moves and sizes with the rows it belongs to rather
         than hovering at a fixed offset from the sheet's corner. */
      ws.addImage(logoImageId, {
        tl: { col: 0.15, row: 0.12 },
        ext: { width: 52, height: 52 },
        editAs: 'oneCell',
      });
    }
  }

  // Header row — bold, colored background
  const headerRow = ws.addRow(headers);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E293B' }, // dark slate — neutral default
  };
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };

  // A dated header cell stores the real date; its display format carries the month + year.
  opts?.columnHeaderDates?.forEach((date, colIndex) => {
    if (!date) return;
    const cell = headerRow.getCell(colIndex + 1);
    cell.value = date;
    cell.numFmt = 'mmm yyyy';
  });

  // Data rows
  let maxCollapsedLevel = 0;
  rows.forEach((row, rowIndex) => {
    const added = ws.addRow(row.map((cell) => (cell === null || cell === undefined ? '' : cell)));

    // Number formats go on each DATA cell, never on the column object — column styles and cell
    // styles interact ambiguously in ExcelJS, and a column format would also hit the header cell.
    opts?.columnNumFmts?.forEach((fmt, colIndex) => {
      if (fmt) added.getCell(colIndex + 1).numFmt = fmt;
    });

    const style = opts?.rowStyles?.[rowIndex];
    if (style?.bold) added.font = { bold: true };
    if (style?.outlineLevel) added.outlineLevel = style.outlineLevel;
    // Merge, don't replace — the alignment setter overwrites the whole object, and a future
    // style that also set e.g. wrapText here would otherwise silently drop the indent.
    if (style?.indent) {
      const first = added.getCell(1);
      first.alignment = { ...first.alignment, indent: style.indent };
    }
    if (style?.collapsed && style.outlineLevel) {
      added.hidden = true;
      maxCollapsedLevel = Math.max(maxCollapsedLevel, style.outlineLevel);
    }
  });

  // ExcelJS derives a row's collapsed="1" attribute from this sheet property (row.collapsed is a
  // getter over it) — without it, hidden grouped rows reopen without their "+" state written.
  if (maxCollapsedLevel > 0) ws.properties.outlineLevelRow = maxCollapsedLevel;

  /* ── The footnotes, under the table (owner ruling 2026-09-05) ───────────────────────────────
     A money report's caveats used to stay on the screen while its figures were emailed to a board
     — so the board read "Total expenses" with no way to know which costs it deliberately leaves
     out. They travel now, and they are laid out to read as the FOOT OF A REPORT rather than as
     more data: a blank spacer row, then one merged cell per note across the table's full width,
     wrapped, in the quiet grey the screen uses.

     ⚠ MERGED AND WRAPPED, not one long cell. An unmerged sentence spills across neighbouring
     columns and prints over them; a merged one that does not wrap is a single 900-character line
     that stretches the sheet sideways forever.

     ⚠ THE ROW HEIGHT IS ESTIMATED RATHER THAN LEFT TO EXCEL. A merged cell is the one case Excel
     does NOT auto-fit the row for — it is a documented gap in the format, not in this code — so a
     wrapped note in a merged cell renders as one clipped line unless the height is set. The
     estimate is deliberately generous; a note with a blank line under it reads fine, a note with
     its second half cut off does not.

     ⚠ RICH TEXT, so the phrase the screen bolds is the phrase the file bolds. A note whose
     emphasis moved would be a second voice. */
  if (opts?.notes?.length) {
    const width = Math.max(1, headers.length);
    /* Rough characters per line at the widths this sheet ends up with. Only used to pick a row
       height, so being a little wrong costs whitespace and never text. */
    const perLine = Math.max(40, width * 14);
    ws.addRow([]);
    for (const note of opts.notes) {
      const row = ws.addRow([]);
      const cell = row.getCell(1);
      cell.value = {
        richText: note.runs.map(run => ({
          text: run.text,
          font: {
            bold: run.bold,
            size: 9,
            color: { argb: note.tone === 'alert' ? 'FF8C2F1E' : 'FF56534B' },
          },
        })),
      };
      cell.alignment = { wrapText: true, vertical: 'top' };
      if (width > 1) ws.mergeCells(row.number, 1, row.number, width);
      const chars = note.runs.reduce((n, r) => n + r.text.length, 0);
      row.height = Math.max(14, Math.ceil(chars / perLine) * 12 + 4);
    }
  }

  /* ── Our own mark, at the foot ─────────────────────────────────────────────────────────────
     ⚠ THE FOOT, NOT THE MASTHEAD, and the distinction is the ruling (owner, 2026-09-05). The top
     of a document is letterhead — it says WHOSE this is, and a team's financial statement is the
     club's. The foot is where a document says who PRODUCED it. Putting our mark up top would be a
     vendor's name on the statement a treasurer is showing the people they answer to.
     ⚠ It also costs the header row nothing, so the frozen pane and the masthead are untouched, and
     it sits below everything anyone pivots, filters or copies.
     ⚠ The caller decides whether this is passed at all — it rides the club's own branding switch,
     the same one that governs the PDF footer. */
  if (opts?.footer) {
    const width = Math.max(1, headers.length);
    ws.addRow([]);
    const row = ws.addRow([]);
    const cell = row.getCell(1);
    cell.value = opts.footer.text;
    cell.font = { size: 8.5, color: { argb: 'FF6C6559' } };
    cell.alignment = { vertical: 'middle', indent: opts.footer.logoDataUrl ? 5 : 0 };
    if (width > 1) ws.mergeCells(row.number, 1, row.number, width);
    const parsed = opts.footer.logoDataUrl ? parseDataUrl(opts.footer.logoDataUrl) : null;
    // The row has to be taller than the mark or the mark hangs out of the bottom of the sheet.
    row.height = parsed ? 30 : 20;
    if (parsed) {
      ws.addImage(workbook.addImage(parsed), {
        tl: { col: 0.1, row: row.number - 1 + 0.1 },
        ext: { width: 26, height: 26 },
        editAs: 'oneCell',
      });
    }
  }

  /* Auto-size column widths.
     ⚠ FROM THE HEADERS AND DATA ONLY — never from the masthead or the notes. Both are merged
     sentences hundreds of characters long living in column A; measuring them would stretch the
     line-name column to the 60-character cap on every file that has one, and push every figure off
     the first screen. They are merged precisely so they do not need the room. */
  ws.columns.forEach((column, i) => {
    const headerLen = (headers[i] ?? '').length;
    let maxDataLen = 0;
    rows.forEach((row) => {
      const cellLen = String(row[i] ?? '').length;
      if (cellLen > maxDataLen) maxDataLen = cellLen;
    });
    // A formatted number renders wider than its raw digits ($ sign, thousands separators).
    const pad = opts?.columnNumFmts?.[i] ? 5 : 2;
    column.width = Math.min(Math.max(headerLen, maxDataLen) + pad, 60);
  });

  /* Freeze the header row — WHEREVER IT ENDED UP.
     ⚠ It was hard-coded to row 1, which was right until the masthead pushed the headers down. Left
     as it was, a reader scrolling a wide grid would lose the month names and be left with a frozen
     team name instead — the one thing that makes this table readable, traded for the one thing
     that does not need to stay on screen. */
  ws.views = [{ state: 'frozen', ySplit: headerRow.number }];

  /* ── Dropdowns ─────────────────────────────────────────────────────────────────────────────
     Written per CELL rather than per column: ExcelJS models validation on the cell, and a column
     object's style does not carry it. `getRow` past the last written row creates it on demand,
     which is exactly what a template wants — the empty rows are the ones a coach fills in. */
  const flagLastRow = headerRow.number + Math.max(opts?.choiceRowCount ?? rows.length, 1);

  /* ── Conditional tints ─────────────────────────────────────────────────────────────────────
     ONE rule per column over the whole fill-in span, not one per cell: Excel shifts a conditional
     formula's relative references down the range itself, which is both far smaller in the file and
     the only way the rule keeps working after a coach inserts a row. */
  if (opts?.columnFlags?.some(Boolean)) {
    opts.columnFlags.forEach((flag, colIndex) => {
      if (!flag) return;
      const letter = colLetter(colIndex);
      ws.addConditionalFormatting({
        ref: `${letter}${headerRow.number + 1}:${letter}${flagLastRow}`,
        rules: [{
          type: 'expression',
          priority: colIndex + 1,
          formulae: [
            typeof flag.formula === 'function' ? flag.formula(headerRow.number + 1) : flag.formula,
          ],
          style: {
            fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: flag.fillArgb } },
            ...(flag.fontArgb ? { font: { color: { argb: flag.fontArgb } } } : {}),
          },
        }],
      });
    });
  }

  if (opts?.columnChoices?.some(Boolean)) {
    const lastRow = flagLastRow;
    opts.columnChoices.forEach((source, colIndex) => {
      if (!source) return;
      const hint = opts.columnChoicePrompts?.[colIndex];
      for (let r = headerRow.number + 1; r <= lastRow; r += 1) {
        // A fixed range is the same string on every row; a dependent list is asked for this row's.
        const formula = typeof source === 'function' ? source(r) : source;
        ws.getRow(r).getCell(colIndex + 1).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [formula],
          showErrorMessage: false,
          // Excel's own limits, enforced here so a long sentence is caught in review rather than
          // arriving on a coach's screen with its last clause missing.
          ...(hint ? {
            showInputMessage: true,
            promptTitle: hint.title.slice(0, 32),
            prompt: hint.body.slice(0, 255),
          } : {}),
        };
      }
    });
  }

  /* ── Extra sheets ──────────────────────────────────────────────────────────────────────────
     Added last so the data sheet stays first in the tab strip and stays the one a reader lands on.
     Deliberately plain: a bold header row and auto-sized columns, no masthead, no notes, no
     number formats — these are reference material, not a report. */
  for (const extra of opts?.extraSheets ?? []) {
    const sheet = workbook.addWorksheet(extra.name);
    const head = sheet.addRow(extra.headers);
    head.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    extra.rows.forEach(row => sheet.addRow(row.map(cell => (cell === null || cell === undefined ? '' : cell))));
    sheet.columns.forEach((column, i) => {
      let widest = (extra.headers[i] ?? '').length;
      extra.rows.forEach(row => { widest = Math.max(widest, String(row[i] ?? '').length); });
      column.width = Math.min(widest + 2, 60);
    });
    /* The sheet's one sentence, merged across its width — added AFTER the widths are measured, for
       the same reason the main table's notes are excluded from them: a merged sentence is why it
       does not need the room, and measuring it would stretch column A to the cap. */
    if (extra.note) {
      const width = Math.max(1, extra.headers.length);
      sheet.addRow([]);
      const row = sheet.addRow([]);
      const cell = row.getCell(1);
      cell.value = extra.note;
      cell.font = { size: 9, color: { argb: 'FF56534B' } };
      cell.alignment = { wrapText: true, vertical: 'top' };
      if (width > 1) sheet.mergeCells(row.number, 1, row.number, width);
      // Excel does not auto-fit a merged cell's row — the one documented gap that turns a wrapped
      // note into a single clipped line. Generously estimated, as on the main table.
      row.height = Math.max(16, Math.ceil(extra.note.length / Math.max(40, width * 14)) * 12 + 6);
    }
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    // ⚠ 'veryHidden' would put it beyond the sheet-unhide menu. A coach who finds this tab and
    // wonders what it is should be able to look at it, not be locked out of their own file.
    if (extra.hidden) sheet.state = 'hidden';
  }

  /* Open ON the guide. Being sheet one is not enough — Excel restores whichever tab was active
     when the file was last saved, and a freshly written file has no such record to restore. */
  if (opts?.guideSheet) {
    workbook.views = [{
      x: 0, y: 0, width: 20000, height: 20000, firstSheet: 0, activeTab: 0, visibility: 'visible',
    }];
  }

  return workbook;
}

/**
 * Build an xlsx workbook from headers + data rows and trigger a browser download.
 *
 * @param filename  - Full filename including .xlsx extension
 * Everything else is `buildXLSXWorkbook`'s, documented there and on `XlsxOptions`.
 */
export async function downloadXLSX(
  filename: string,
  headers: string[],
  rows: (string | number | null | undefined)[][],
  sheetName = 'Data',
  opts?: XlsxOptions,
): Promise<void> {
  const workbook = buildXLSXWorkbook(headers, rows, sheetName, opts);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), {
    href: url,
    download: filename,
    style: 'visibility:hidden',
  });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
