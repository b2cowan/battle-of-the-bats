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
 * Build an xlsx workbook from headers + data rows and trigger a browser download.
 *
 * @param filename  - Full filename including .xlsx extension
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

export async function downloadXLSX(
  filename: string,
  headers: string[],
  rows: (string | number | null | undefined)[][],
  sheetName = 'Data',
  opts?: {
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
  },
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'FieldLogicHQ';
  workbook.created = new Date();

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
