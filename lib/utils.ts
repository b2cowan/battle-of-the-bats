export function downloadCSV(filename: string, headers: string[], rows: (string | number | undefined | null)[][]) {
  const content = [
    headers.join(','),
    ...rows.map(row => row.map(cell => {
      const val = cell === null || cell === undefined ? '' : String(cell);
      // Escape commas and quotes
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    }).join(','))
  ].join('\n');

  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
