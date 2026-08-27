export type ImportFormat = 'xlsx' | 'csv';
export type ImportOperation = 'create' | 'update' | 'unchanged' | 'blocked';

export type ParsedImportRow = {
  rowNumber: number;
  values: Record<string, string>;
  /**
   * The spreadsheet itself marked this row as nested — an Excel outline level or a first-cell
   * indent (parseXLSX reads both; CSV has neither). The app's own Excel exports write line rows
   * this way with NO textual marker since 2026-08-25, so shape readers that used to recognize a
   * line row by its `— `/leading-space prefix must accept this flag as the same signal
   * (`stripLineIndent` in lib/coach-budget-import.ts does).
   */
  indented?: boolean;
};

export type ParsedImportFile = {
  format?: ImportFormat;
  headers: string[];
  metadata?: Record<string, string>;
  rows: ParsedImportRow[];
};

export type ImportPreviewChange = {
  field: string;
  before: unknown;
  after: unknown;
};

export type ImportPreviewRow = {
  rowNumber: number;
  operation: ImportOperation;
  targetId?: string;
  displayName: string;
  raw: Record<string, string>;
  normalized: Record<string, unknown>;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  changes: ImportPreviewChange[];
  warnings: string[];
  errors: string[];
};

export type ImportPreview = {
  batchId: string;
  importType: string;
  notices?: string[];
  scope: Record<string, string>;
  summary: {
    totalRows: number;
    creates: number;
    updates: number;
    unchanged: number;
    warnings: number;
    blocked: number;
  };
  /**
   * Schedule imports only: typed location names that did NOT exactly match one of the
   * tournament's fields (trim + case-fold — the one sanctioned auto-resolution). These
   * rows import as typed text and are never checked for double-bookings, so the summary
   * names them instead of staying quiet. Never blocks the file.
   */
  unmatchedLocations?: Array<{ name: string; rows: number; ambiguous?: boolean }>;
  rows: ImportPreviewRow[];
  canCommit: boolean;
};

export type ImportCommitResult = {
  batchId: string;
  summary: {
    created: number;
    updated: number;
    unchanged: number;
    skipped: number;
  };
  /** Coaches emailed a portal-claim link (opt-in at commit). Absent/0 when the toggle was off. */
  emailsSent?: number;
};

export class ImportParseError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'ImportParseError';
    this.status = status;
  }
}
