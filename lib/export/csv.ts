/**
 * lib/export/csv.ts
 * CSV string generation and client-side download.
 * Normalizes the existing downloadCSV() in lib/utils.ts into the shared layer.
 */

/**
 * Serialize headers + rows into a RFC 4180-compliant CSV string.
 * Cells containing commas, double-quotes, or newlines are quoted.
 */
export function generateCSV(
  headers: string[],
  rows: (string | number | null | undefined)[][],
): string {
  return [headers, ...rows]
    .map((row) =>
      row
        .map((cell) => {
          const v = cell === null || cell === undefined ? '' : String(cell);
          return v.includes(',') || v.includes('"') || v.includes('\n')
            ? `"${v.replace(/"/g, '""')}"`
            : v;
        })
        .join(','),
    )
    .join('\n');
}

/**
 * Trigger a browser download of a CSV string as a .csv file.
 */
export function downloadCSVBlob(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
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
