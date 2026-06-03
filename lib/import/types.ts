export type ImportFormat = 'xlsx' | 'csv';
export type ImportOperation = 'create' | 'update' | 'unchanged' | 'blocked';

export type ParsedImportRow = {
  rowNumber: number;
  values: Record<string, string>;
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
};

export class ImportParseError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'ImportParseError';
    this.status = status;
  }
}
