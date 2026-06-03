import { normalizeToken } from './tabular.ts';

export type TournamentTeamImportNormalizedRow = {
  teamId: string;
  teamName: string;
  divisionId: string;
  divisionName: string;
  coachName: string | null;
  email: string | null;
  status: 'pending' | 'accepted' | 'rejected' | 'waitlist';
  paymentStatus: 'pending' | 'paid';
  depositPaid: number | null;
  totalPaid: number | null;
  waitlistPosition: number | null;
  adminNotes: string | null;
};

export type StoredTournamentTeamImportRow = {
  id: string;
  row_number: number;
  operation: string;
  target_id: string | null;
  normalized_json: unknown;
  before_json: unknown;
  errors_json: unknown;
  status: string;
};

export type PreparedTournamentTeamCommitRow = {
  id: string;
  rowNumber: number;
  operation: 'create' | 'update' | 'unchanged';
  targetId: string | null;
  normalized: TournamentTeamImportNormalizedRow;
  before: Record<string, unknown> | null;
};

export type TournamentTeamImportCommitPrepared = {
  createRows: PreparedTournamentTeamCommitRow[];
  updateRows: PreparedTournamentTeamCommitRow[];
  unchangedRows: PreparedTournamentTeamCommitRow[];
  allRows: PreparedTournamentTeamCommitRow[];
};

export type TournamentTeamImportCommitSummary = {
  created: number;
  updated: number;
  unchanged: number;
  skipped: number;
};

export class TournamentTeamImportCommitError extends Error {
  status: number;
  rowNumbers: number[];

  constructor(message: string, status = 400, rowNumbers: number[] = []) {
    super(message);
    this.name = 'TournamentTeamImportCommitError';
    this.status = status;
    this.rowNumbers = rowNumbers;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function stringField(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === 'string' ? value : '';
}

function nullableStringField(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function nullableNumberField(record: Record<string, unknown>, key: string) {
  const value = record[key];
  if (value == null || value === '') return null;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function statusField(record: Record<string, unknown>) {
  const value = record.status;
  return value === 'pending' || value === 'accepted' || value === 'rejected' || value === 'waitlist'
    ? value
    : null;
}

function paymentStatusField(record: Record<string, unknown>) {
  return record.paymentStatus === 'paid' ? 'paid' : record.paymentStatus === 'pending' ? 'pending' : null;
}

export function parseTournamentTeamNormalizedRow(value: unknown, rowNumber: number): TournamentTeamImportNormalizedRow {
  if (!isRecord(value)) {
    throw new TournamentTeamImportCommitError(`Row ${rowNumber} is missing normalized import data. Run preview again.`, 409, [rowNumber]);
  }

  const status = statusField(value);
  const paymentStatus = paymentStatusField(value);
  const teamName = stringField(value, 'teamName').trim();
  const divisionId = stringField(value, 'divisionId').trim();

  if (!teamName || !divisionId || !status || !paymentStatus) {
    throw new TournamentTeamImportCommitError(`Row ${rowNumber} is missing required normalized team data. Run preview again.`, 409, [rowNumber]);
  }

  return {
    teamId: stringField(value, 'teamId').trim(),
    teamName,
    divisionId,
    divisionName: stringField(value, 'divisionName').trim(),
    coachName: nullableStringField(value, 'coachName'),
    email: nullableStringField(value, 'email'),
    status,
    paymentStatus,
    depositPaid: nullableNumberField(value, 'depositPaid'),
    totalPaid: nullableNumberField(value, 'totalPaid'),
    waitlistPosition: nullableNumberField(value, 'waitlistPosition'),
    adminNotes: nullableStringField(value, 'adminNotes'),
  };
}

function rowErrors(value: unknown) {
  return Array.isArray(value) ? value.filter(item => typeof item === 'string') : [];
}

export function prepareTournamentTeamCommitRows(rows: StoredTournamentTeamImportRow[]): TournamentTeamImportCommitPrepared {
  const blockedRows: number[] = [];
  const unsupportedRows: number[] = [];
  const invalidStatusRows: number[] = [];
  const invalidTargetRows: number[] = [];
  const prepared: PreparedTournamentTeamCommitRow[] = [];

  for (const row of rows) {
    if (row.status !== 'previewed') invalidStatusRows.push(row.row_number);
    if (row.operation === 'blocked' || rowErrors(row.errors_json).length > 0) blockedRows.push(row.row_number);
    if (row.operation !== 'create' && row.operation !== 'update' && row.operation !== 'unchanged' && row.operation !== 'blocked') {
      unsupportedRows.push(row.row_number);
    }
    if (row.operation === 'create' && row.target_id) invalidTargetRows.push(row.row_number);
    if (row.operation === 'update' && !row.target_id) invalidTargetRows.push(row.row_number);

    if (row.operation === 'create' || row.operation === 'update' || row.operation === 'unchanged') {
      prepared.push({
        id: row.id,
        rowNumber: row.row_number,
        operation: row.operation,
        targetId: row.target_id,
        normalized: parseTournamentTeamNormalizedRow(row.normalized_json, row.row_number),
        before: isRecord(row.before_json) ? row.before_json : null,
      });
    }
  }

  if (invalidStatusRows.length > 0) {
    throw new TournamentTeamImportCommitError('This import batch has already been handled. Run preview again before applying.', 409, invalidStatusRows);
  }
  if (blockedRows.length > 0) {
    throw new TournamentTeamImportCommitError('Resolve blocked rows before applying this import.', 409, blockedRows);
  }
  if (unsupportedRows.length > 0) {
    throw new TournamentTeamImportCommitError('This importer only supports add/update rows. Run preview again before applying.', 409, unsupportedRows);
  }
  if (invalidTargetRows.length > 0) {
    throw new TournamentTeamImportCommitError('One or more rows no longer match a valid add/update target. Run preview again.', 409, invalidTargetRows);
  }

  return {
    createRows: prepared.filter(row => row.operation === 'create'),
    updateRows: prepared.filter(row => row.operation === 'update'),
    unchangedRows: prepared.filter(row => row.operation === 'unchanged'),
    allRows: prepared,
  };
}

export function buildTournamentTeamInsert(
  normalized: TournamentTeamImportNormalizedRow,
  tournamentId: string,
  id: string,
) {
  return {
    id,
    tournament_id: tournamentId,
    division_id: normalized.divisionId,
    name: normalized.teamName,
    coach: normalized.coachName,
    email: normalized.email,
    status: normalized.status,
    payment_status: normalized.paymentStatus,
    deposit_paid: normalized.depositPaid,
    total_paid: normalized.totalPaid,
    waitlist_position: normalized.waitlistPosition,
    admin_notes: normalized.adminNotes,
  };
}

export function buildTournamentTeamUpdate(normalized: TournamentTeamImportNormalizedRow) {
  return {
    division_id: normalized.divisionId,
    name: normalized.teamName,
    coach: normalized.coachName,
    email: normalized.email,
    status: normalized.status,
    payment_status: normalized.paymentStatus,
    deposit_paid: normalized.depositPaid,
    total_paid: normalized.totalPaid,
    waitlist_position: normalized.waitlistPosition,
    admin_notes: normalized.adminNotes,
  };
}

export function tournamentTeamImportIdentityKey(divisionId: string, teamName: string) {
  return `${divisionId}:${normalizeToken(teamName)}`;
}

export function didImportDivisionChange(row: PreparedTournamentTeamCommitRow) {
  return typeof row.before?.divisionId === 'string' && row.before.divisionId !== row.normalized.divisionId;
}

export function summarizeTournamentTeamCommit(input: TournamentTeamImportCommitPrepared): TournamentTeamImportCommitSummary {
  return {
    created: input.createRows.length,
    updated: input.updateRows.length,
    unchanged: input.unchangedRows.length,
    skipped: input.unchangedRows.length,
  };
}
