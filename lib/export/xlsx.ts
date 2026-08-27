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
export async function downloadXLSX(
  filename: string,
  headers: string[],
  rows: (string | number | null | undefined)[][],
  sheetName = 'Data',
  opts?: {
    columnNumFmts?: (string | undefined)[];
    rowStyles?: (XlsxRowStyle | undefined)[];
    columnHeaderDates?: (Date | undefined)[];
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

  // Auto-size column widths
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

  // Freeze the header row
  ws.views = [{ state: 'frozen', ySplit: 1 }];

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
