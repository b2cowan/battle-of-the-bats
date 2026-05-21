/**
 * lib/export/table.ts
 * Core types and utilities shared by all export formats.
 */

export interface ExportColumnDef {
  /** Column header label shown in the exported file */
  label: string;
  /** Key into the row object — must match a property on T */
  key: string;
  /** Hint for output renderers. Default: 'text'. */
  format?: 'text' | 'number' | 'currency' | 'date' | 'datetime';
  /**
   * When true, this column is excluded from the default export output.
   * Guardian contacts, player medical notes, and internal admin notes MUST be
   * marked sensitive: true. They appear only when the user selects the explicit
   * opt-in variant ("Excel with contact details", "Excel with internal notes").
   */
  sensitive?: boolean;
  /** Whether to include this column in PDF exports. Default: true. */
  includeInPDF?: boolean;
}

/**
 * Build a canonical export filename.
 * Pattern: {org-or-tournament}-{dataset}-{scope}-{yyyy-mm-dd}.{ext}
 * Example: milton-bats-registrations-u15-2026-05-20.xlsx
 */
export function buildFilename(
  parts: {
    org?: string;
    tournament?: string;
    dataset: string;
    scope?: string;
  },
  ext: string,
): string {
  const segs = [parts.org ?? parts.tournament, parts.dataset, parts.scope]
    .filter(Boolean)
    .map((s) => s!.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
  const date = new Date().toISOString().split('T')[0];
  return `${segs.join('-')}-${date}.${ext}`;
}

/**
 * Flatten typed row objects into a 2D array of primitives, respecting the
 * sensitive-field policy. Headers are NOT included — callers prepend them.
 *
 * @param rows        - Source data rows
 * @param cols        - Column definitions (order determines output column order)
 * @param includeSensitive - When false (default), sensitive columns are omitted
 */
export function serializeRows<T extends Record<string, unknown>>(
  rows: T[],
  cols: ExportColumnDef[],
  includeSensitive = false,
): (string | number)[][] {
  const activeCols = cols.filter((c) => includeSensitive || !c.sensitive);
  return rows.map((row) =>
    activeCols.map((col) => {
      const v = row[col.key];
      if (v === null || v === undefined) return '';
      if (typeof v === 'number') return v;
      return String(v);
    }),
  );
}

/**
 * Extract just the headers for the active (non-sensitive or opt-in) columns.
 */
export function serializeHeaders(
  cols: ExportColumnDef[],
  includeSensitive = false,
): string[] {
  return cols
    .filter((c) => includeSensitive || !c.sensitive)
    .map((c) => c.label);
}
