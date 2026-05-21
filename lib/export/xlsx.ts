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
 * Build an xlsx workbook from headers + data rows and trigger a browser download.
 *
 * @param filename  - Full filename including .xlsx extension
 * @param headers   - Column header labels (first row)
 * @param rows      - Data rows (2D array of strings/numbers)
 * @param sheetName - Worksheet tab name. Default: 'Data'
 */
export async function downloadXLSX(
  filename: string,
  headers: string[],
  rows: (string | number | null | undefined)[][],
  sheetName = 'Data',
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'FieldLogicHQ';
  workbook.created = new Date();

  const ws = workbook.addWorksheet(sheetName);

  // Header row — bold, colored background
  const headerRow = ws.addRow(headers);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E293B' }, // dark slate — neutral default
  };
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };

  // Data rows
  rows.forEach((row) => {
    ws.addRow(row.map((cell) => (cell === null || cell === undefined ? '' : cell)));
  });

  // Auto-size column widths
  ws.columns.forEach((column, i) => {
    const headerLen = (headers[i] ?? '').length;
    let maxDataLen = 0;
    rows.forEach((row) => {
      const cellLen = String(row[i] ?? '').length;
      if (cellLen > maxDataLen) maxDataLen = cellLen;
    });
    column.width = Math.min(Math.max(headerLen, maxDataLen) + 2, 60);
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
