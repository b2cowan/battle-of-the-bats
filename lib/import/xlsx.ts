import ExcelJS from 'exceljs';
import { matrixToParsedRows } from './tabular.ts';
import type { ParsedImportFile } from './types.ts';

function cellToString(value: ExcelJS.CellValue): string {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    if ('text' in value && typeof value.text === 'string') return value.text;
    if ('hyperlink' in value && typeof value.hyperlink === 'string') return value.hyperlink;
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map(part => part.text ?? '').join('');
    }
    if ('result' in value) return cellToString(value.result as ExcelJS.CellValue);
  }
  return String(value);
}

export async function parseXLSX(buffer: ArrayBuffer, maxRows: number): Promise<ParsedImportFile> {
  const workbook = new ExcelJS.Workbook();
  const workbookBuffer = Buffer.from(buffer) as unknown as Parameters<typeof workbook.xlsx.load>[0];
  await workbook.xlsx.load(workbookBuffer);

  const worksheet =
    workbook.getWorksheet('Data') ??
    workbook.worksheets.find(sheet => !['instructions', 'reference'].includes(sheet.name.trim().toLowerCase())) ??
    workbook.worksheets[0];

  if (!worksheet) throw new Error('The workbook has no worksheets.');

  const matrix: string[][] = [];
  worksheet.eachRow({ includeEmpty: true }, row => {
    const values: string[] = [];
    for (let col = 1; col <= worksheet.columnCount; col += 1) {
      values.push(cellToString(row.getCell(col).value).trim());
    }
    matrix.push(values);
  });

  return matrixToParsedRows(matrix, maxRows);
}
