import { ImportParseError, type ParsedImportFile, type ParsedImportRow } from './types.ts';

export function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\([^)]*\)/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function normalizeToken(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function isBlankRecord(values: Record<string, string>) {
  return Object.values(values).every(value => value.trim().length === 0);
}

export function matrixToParsedRows(matrix: unknown[][], maxRows: number): ParsedImportFile {
  const headerRowIndex = matrix.findIndex(row => row.some(cell => String(cell ?? '').trim().length > 0));
  if (headerRowIndex < 0) throw new ImportParseError('The import file is empty.');

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
    const values: Record<string, string> = {};
    headers.forEach((header, index) => {
      if (!header) return;
      values[header] = String(row[index] ?? '').trim();
    });
    if (isBlankRecord(values)) continue;
    rows.push({ rowNumber: i + 1, values });
    if (rows.length > maxRows) {
      throw new ImportParseError(`Imports are limited to ${maxRows} data rows.`);
    }
  }

  return { headers: headers.filter(Boolean), rows };
}

export function getCell(row: ParsedImportRow, aliases: string[]): { value: string; present: boolean } {
  const wanted = new Set(aliases.map(normalizeHeader));
  for (const [header, value] of Object.entries(row.values)) {
    if (wanted.has(normalizeHeader(header))) return { value, present: true };
  }
  return { value: '', present: false };
}
