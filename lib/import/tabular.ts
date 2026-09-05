import { normalizeToken } from '../normalize-token.ts';
import { ImportParseError, type ImportFormat, type ParsedImportFile, type ParsedImportRow } from './types.ts';

// Re-exported so the many existing `from './tabular.ts'` importers keep working. The rule itself
// now lives at lib root — it decides venue-name identity too, so it cannot belong to import.
export { normalizeToken };

export function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\([^)]*\)/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function isBlankRecord(values: Record<string, string>) {
  return Object.values(values).every(value => value.trim().length === 0);
}

function hasContent(row: unknown[]): boolean {
  return row.some(cell => String(cell ?? '').trim().length > 0);
}

/**
 * A TITLE ROW ABOVE THE TABLE — skipped when looking for the column row.
 *
 * ⚠ WHY THIS EXISTS. Real spreadsheets open with a banner: a coach's own budget from their club,
 * a statement from their bank, and — since 2026-09-05 — our own money reports, which now carry a
 * masthead naming the team, the report and the day it was true. Without this, the first non-empty
 * row IS the header row, so a titled sheet failed with **"Duplicate column header: <the title>"** —
 * an error naming something the reader never typed, on a file that is obviously fine.
 *
 * ⚠ THE DUPLICATE IS THE TELL, and it is not a coincidence. A banner is a MERGED cell, and a
 * merged cell reads back with its value mirrored into every cell of the merge — so the row arrives
 * as the same string N times. That is a shape a genuine header row can never have: two identical
 * column names are refused a few lines below, so a row like this could only ever have been an
 * error. Recognising it costs nothing and can misread nothing.
 *
 * ⚠ TWO CELLS MINIMUM. A single-column file's one header is trivially "all the same value", and
 * eating it would leave the file with no columns at all.
 */
function isBannerRow(row: unknown[]): boolean {
  const filled = row.map(cell => String(cell ?? '').trim()).filter(v => v.length > 0);
  return filled.length > 1 && filled.every(v => v === filled[0]);
}

export function matrixToParsedRows(
  matrix: unknown[][],
  maxRows: number,
  options: {
    format?: ImportFormat;
    metadata?: Record<string, string>;
    /** MATRIX indices of rows the spreadsheet marked as nested (outline level / cell indent) —
     *  carried onto each ParsedImportRow as `indented`. Only parseXLSX supplies this. */
    indentedRows?: Set<number>;
  } = {},
): ParsedImportFile {
  const headerRowIndex = matrix.findIndex(row => hasContent(row) && !isBannerRow(row));
  if (headerRowIndex < 0) {
    // A file of nothing but banner rows has no column row at all, and "empty" is the honest word
    // for it from the reader's side — there is no data in it either way.
    throw new ImportParseError('The import file is empty.');
  }

  const headers = matrix[headerRowIndex].map(cell => String(cell ?? '').trim());
  if (headers.every(header => header.length === 0)) throw new ImportParseError('The import file has no header row.');

  const seenHeaders = new Set<string>();
  for (const header of headers) {
    if (!header) continue;
    const normalized = normalizeHeader(header);
    if (seenHeaders.has(normalized)) {
      throw new ImportParseError(`Duplicate column header: ${header}`);
    }
    seenHeaders.add(normalized);
  }

  const rows: ParsedImportRow[] = [];
  for (let i = headerRowIndex + 1; i < matrix.length; i += 1) {
    const row = matrix[i];
    /* ⚠ THE FOOT OF THE FILE IS SKIPPED THE SAME WAY THE TOP IS. Our money reports close with
       merged footnote rows explaining the report's basis, and a branding line under them; a
       coach's own sheet often ends in a "prepared by" line the same way. Every one of them arrives
       as one string mirrored across the columns — so they are the same shape as a title row, and
       reading them as data would put a whole sentence into a budget line's name. */
    if (isBannerRow(row)) continue;
    const values: Record<string, string> = {};
    headers.forEach((header, index) => {
      if (!header) return;
      values[header] = String(row[index] ?? '').trim();
    });
    if (isBlankRecord(values)) continue;
    rows.push({ rowNumber: i + 1, values, ...(options.indentedRows?.has(i) ? { indented: true } : {}) });
    if (rows.length > maxRows) {
      throw new ImportParseError(`Imports are limited to ${maxRows} data rows.`);
    }
  }

  if (rows.length === 0) {
    throw new ImportParseError('The import file has no data rows.');
  }

  return { format: options.format, headers: headers.filter(Boolean), metadata: options.metadata, rows };
}

export function getCell(row: ParsedImportRow, aliases: string[]): { value: string; present: boolean } {
  const wanted = new Set(aliases.map(normalizeHeader));
  for (const [header, value] of Object.entries(row.values)) {
    if (wanted.has(normalizeHeader(header))) return { value, present: true };
  }
  return { value: '', present: false };
}
