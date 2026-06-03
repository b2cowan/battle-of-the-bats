import { matrixToParsedRows } from './tabular.ts';
import type { ParsedImportFile } from './types.ts';

export function parseCSV(content: string, maxRows: number): ParsedImportFile {
  const rows: string[][] = [];
  let current = '';
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];
    const next = content[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === ',' && !inQuotes) {
      row.push(current);
      current = '';
      continue;
    }
    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(current);
      rows.push(row);
      row = [];
      current = '';
      continue;
    }
    current += char;
  }

  row.push(current);
  rows.push(row);
  return matrixToParsedRows(rows, maxRows);
}

export function generateCSV(headers: string[], rows: (string | number | null | undefined)[][]): string {
  return [headers, ...rows]
    .map(row =>
      row.map(cell => {
        const value = cell == null ? '' : String(cell);
        return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
      }).join(',')
    )
    .join('\n');
}
