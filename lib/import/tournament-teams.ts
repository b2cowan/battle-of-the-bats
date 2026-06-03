import crypto from 'node:crypto';
import { getCell, normalizeHeader, normalizeToken } from './tabular.ts';
import type { ImportPreview, ImportPreviewChange, ImportPreviewRow, ParsedImportFile, ParsedImportRow } from './types.ts';

export const TOURNAMENT_TEAM_IMPORT_TYPE = 'tournament_teams';
export const TOURNAMENT_TEAM_IMPORT_MAX_ROWS = 1000;

export const TOURNAMENT_TEAM_IMPORT_HEADERS = [
  'Team ID',
  'Team Name',
  'Division ID',
  'Division Name',
  'Coach Name',
  'Email',
  'Status',
  'Payment Status',
  'Deposit Paid',
  'Total Paid',
  'Waitlist Position',
  'Admin Notes',
] as const;

type TeamStatus = 'pending' | 'accepted' | 'rejected' | 'waitlist';
type PaymentStatus = 'pending' | 'paid';

export type TournamentTeamImportDivision = {
  id: string;
  name: string;
};

export type TournamentTeamImportExistingTeam = {
  id: string;
  divisionId: string;
  name: string;
  coach: string | null;
  email: string | null;
  status: string | null;
  paymentStatus: string | null;
  depositPaid: number | null;
  totalPaid: number | null;
  waitlistPosition: number | null;
  adminNotes: string | null;
};

export type TournamentTeamImportContext = {
  tournamentId: string;
  orgId: string;
  divisions: TournamentTeamImportDivision[];
  existingTeams: TournamentTeamImportExistingTeam[];
};

type NormalizedTeamImportRow = {
  teamId: string;
  teamName: string;
  divisionId: string;
  divisionName: string;
  coachName: string | null;
  email: string | null;
  status: TeamStatus;
  paymentStatus: PaymentStatus;
  depositPaid: number | null;
  totalPaid: number | null;
  waitlistPosition: number | null;
  adminNotes: string | null;
};

const STATUS_ALIASES: Record<string, TeamStatus> = {
  pending: 'pending',
  review: 'pending',
  accepted: 'accepted',
  approved: 'accepted',
  active: 'accepted',
  rejected: 'rejected',
  declined: 'rejected',
  waitlist: 'waitlist',
  waitlisted: 'waitlist',
};

const PAYMENT_ALIASES: Record<string, PaymentStatus> = {
  pending: 'pending',
  unpaid: 'pending',
  no: 'pending',
  paid: 'paid',
  yes: 'paid',
};

function hasHeader(headers: string[], aliases: string[]) {
  const normalized = new Set(headers.map(normalizeHeader));
  return aliases.some(alias => normalized.has(normalizeHeader(alias)));
}

export function validateTournamentTeamImportHeaders(headers: string[]): string[] {
  const errors: string[] = [];
  if (!hasHeader(headers, ['Team Name', 'team_name', 'Name'])) {
    errors.push('Missing required column: Team Name');
  }
  if (!hasHeader(headers, ['Division ID', 'division_id']) && !hasHeader(headers, ['Division Name', 'Division'])) {
    errors.push('Missing required column: Division ID or Division Name');
  }
  return errors;
}

function parseNullableNumber(value: string, label: string, errors: string[]) {
  if (!value.trim()) return null;
  const normalized = value.replace(/[$,\s]/g, '');
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) {
    errors.push(`${label} must be a non-negative number.`);
    return null;
  }
  return parsed;
}

function parseNullableInteger(value: string, label: string, errors: string[]) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    errors.push(`${label} must be a positive whole number.`);
    return null;
  }
  return parsed;
}

function parseStatus(value: string, fallback: TeamStatus, warnings: string[], errors: string[]) {
  if (!value.trim()) {
    warnings.push(`Status was blank; preview assumes ${fallback}.`);
    return fallback;
  }
  const parsed = STATUS_ALIASES[normalizeToken(value)];
  if (!parsed) {
    errors.push('Status must be pending, accepted, rejected, or waitlist.');
    return fallback;
  }
  return parsed;
}

function parsePaymentStatus(value: string, fallback: PaymentStatus, warnings: string[], errors: string[]) {
  if (!value.trim()) return fallback;
  const parsed = PAYMENT_ALIASES[normalizeToken(value)];
  if (!parsed) {
    errors.push('Payment Status must be pending or paid.');
    return fallback;
  }
  return parsed;
}

function resolveDivision(input: { divisionId: string; divisionName: string }, context: TournamentTeamImportContext) {
  if (input.divisionId) {
    const division = context.divisions.find(item => item.id === input.divisionId);
    return division ? { division, error: null } : { division: null, error: 'Division ID does not belong to this tournament.' };
  }

  const token = normalizeToken(input.divisionName);
  const matches = context.divisions.filter(item => normalizeToken(item.name) === token);
  if (matches.length === 1) return { division: matches[0], error: null };
  if (matches.length > 1) return { division: null, error: 'Division Name is ambiguous. Use Division ID.' };
  return { division: null, error: 'Division Name was not found in this tournament.' };
}

function normalizeExisting(team: TournamentTeamImportExistingTeam): Record<string, unknown> {
  return {
    teamName: team.name,
    divisionId: team.divisionId,
    coachName: team.coach ?? '',
    email: team.email ?? '',
    status: team.status ?? 'accepted',
    paymentStatus: team.paymentStatus ?? 'pending',
    depositPaid: team.depositPaid ?? null,
    totalPaid: team.totalPaid ?? null,
    waitlistPosition: team.waitlistPosition ?? null,
    adminNotes: team.adminNotes ?? null,
  };
}

function compare(before: Record<string, unknown>, after: Record<string, unknown>): ImportPreviewChange[] {
  const labels: Record<string, string> = {
    teamName: 'Team Name',
    divisionId: 'Division',
    coachName: 'Coach Name',
    email: 'Email',
    status: 'Status',
    paymentStatus: 'Payment Status',
    depositPaid: 'Deposit Paid',
    totalPaid: 'Total Paid',
    waitlistPosition: 'Waitlist Position',
    adminNotes: 'Admin Notes',
  };

  return Object.keys(labels)
    .filter(key => (before[key] ?? null) !== (after[key] ?? null))
    .map(key => ({ field: labels[key], before: before[key] ?? null, after: after[key] ?? null }));
}

function rawCell(row: ParsedImportRow, aliases: string[]) {
  return getCell(row, aliases).value.trim();
}

function normalizeRow(
  row: ParsedImportRow,
  target: TournamentTeamImportExistingTeam | null,
  context: TournamentTeamImportContext,
  warnings: string[],
  errors: string[],
): NormalizedTeamImportRow {
  const teamId = rawCell(row, ['Team ID', 'team_id', 'ID']);
  const teamName = rawCell(row, ['Team Name', 'team_name', 'Name']);
  const divisionId = rawCell(row, ['Division ID', 'division_id']);
  const divisionName = rawCell(row, ['Division Name', 'Division']);
  const divisionResult = resolveDivision({ divisionId, divisionName }, context);
  if (divisionResult.error) errors.push(divisionResult.error);

  if (!teamName) errors.push('Team Name is required.');

  const fallbackStatus = (target?.status === 'pending' || target?.status === 'accepted' || target?.status === 'rejected' || target?.status === 'waitlist')
    ? target.status
    : 'accepted';
  const fallbackPayment = target?.paymentStatus === 'paid' ? 'paid' : 'pending';

  const status = parseStatus(rawCell(row, ['Status']), fallbackStatus, warnings, errors);
  const paymentStatus = parsePaymentStatus(rawCell(row, ['Payment Status', 'payment_status']), fallbackPayment, warnings, errors);

  return {
    teamId,
    teamName,
    divisionId: divisionResult.division?.id ?? divisionId,
    divisionName: divisionResult.division?.name ?? divisionName,
    coachName: rawCell(row, ['Coach Name', 'Coach', 'Contact Name']) || null,
    email: rawCell(row, ['Email', 'Contact Email']) || null,
    status,
    paymentStatus,
    depositPaid: parseNullableNumber(rawCell(row, ['Deposit Paid', 'deposit_paid']), 'Deposit Paid', errors),
    totalPaid: parseNullableNumber(rawCell(row, ['Total Paid', 'total_paid']), 'Total Paid', errors),
    waitlistPosition: parseNullableInteger(rawCell(row, ['Waitlist Position', 'waitlist_position']), 'Waitlist Position', errors),
    adminNotes: rawCell(row, ['Admin Notes', 'admin_notes', 'Notes']) || null,
  };
}

function afterRecord(normalized: NormalizedTeamImportRow) {
  return {
    teamName: normalized.teamName,
    divisionId: normalized.divisionId,
    coachName: normalized.coachName ?? '',
    email: normalized.email ?? '',
    status: normalized.status,
    paymentStatus: normalized.paymentStatus,
    depositPaid: normalized.depositPaid,
    totalPaid: normalized.totalPaid,
    waitlistPosition: normalized.waitlistPosition,
    adminNotes: normalized.adminNotes,
  };
}

function keyFor(divisionId: string, name: string) {
  return `${divisionId}:${normalizeToken(name)}`;
}

export function buildTournamentTeamImportPreview(
  parsed: ParsedImportFile,
  context: TournamentTeamImportContext,
  batchId: string = crypto.randomUUID(),
): ImportPreview {
  const headerErrors = validateTournamentTeamImportHeaders(parsed.headers);
  const existingById = new Map(context.existingTeams.map(team => [team.id, team]));
  const existingByDivisionName = new Map<string, TournamentTeamImportExistingTeam[]>();
  for (const team of context.existingTeams) {
    const key = keyFor(team.divisionId, team.name);
    existingByDivisionName.set(key, [...(existingByDivisionName.get(key) ?? []), team]);
  }

  const uploadedIds = parsed.rows
    .map(row => rawCell(row, ['Team ID', 'team_id', 'ID']))
    .filter(Boolean);
  const duplicatedUploadedIds = new Set(uploadedIds.filter((id, index) => uploadedIds.indexOf(id) !== index));

  const rows: ImportPreviewRow[] = [];
  const pendingCreateKeys = new Map<string, number>();

  for (const row of parsed.rows) {
    const warnings: string[] = [];
    const errors = [...headerErrors];
    const teamId = rawCell(row, ['Team ID', 'team_id', 'ID']);
    let target: TournamentTeamImportExistingTeam | null = null;

    if (teamId) {
      if (duplicatedUploadedIds.has(teamId)) errors.push('Team ID appears more than once in this file.');
      target = existingById.get(teamId) ?? null;
      if (!target) errors.push('Team ID was not found in this tournament.');
    }

    const preTargetNormalized = normalizeRow(row, target, context, warnings, errors);
    if (!teamId && preTargetNormalized.divisionId && preTargetNormalized.teamName) {
      const matches = existingByDivisionName.get(keyFor(preTargetNormalized.divisionId, preTargetNormalized.teamName)) ?? [];
      if (matches.length === 1) {
        target = matches[0];
        warnings.push('Matched existing team by Team Name and Division. Team ID is safer for future imports.');
      } else if (matches.length > 1) {
        errors.push('Team Name matches multiple existing teams in this division. Use Team ID.');
      }
    }

    const normalized = target ? normalizeRow(row, target, context, warnings, errors) : preTargetNormalized;
    if (!target && normalized.divisionId && normalized.teamName) {
      const createKey = keyFor(normalized.divisionId, normalized.teamName);
      const count = (pendingCreateKeys.get(createKey) ?? 0) + 1;
      pendingCreateKeys.set(createKey, count);
      if (count > 1) errors.push('Another create row in this file uses the same Team Name and Division.');
    }

    if (!normalized.email) warnings.push('Email is blank. Notifications are off for preview, but team contact follow-up may be harder.');
    if (normalized.status !== 'waitlist' && normalized.waitlistPosition != null) {
      warnings.push('Waitlist Position is set but Status is not waitlist.');
    }

    const after = afterRecord(normalized);
    const before = target ? normalizeExisting(target) : undefined;
    const changes = before ? compare(before, after) : Object.entries(after)
      .filter(([, value]) => value !== null && value !== '')
      .map(([field, value]) => ({ field, before: null, after: value }));

    const operation = errors.length > 0
      ? 'blocked'
      : target
        ? changes.length > 0 ? 'update' : 'unchanged'
        : 'create';

    rows.push({
      rowNumber: row.rowNumber,
      operation,
      targetId: target?.id,
      displayName: normalized.teamName || `Row ${row.rowNumber}`,
      raw: row.values,
      normalized,
      before,
      after,
      changes,
      warnings,
      errors,
    });
  }

  const summary = {
    totalRows: rows.length,
    creates: rows.filter(row => row.operation === 'create').length,
    updates: rows.filter(row => row.operation === 'update').length,
    unchanged: rows.filter(row => row.operation === 'unchanged').length,
    warnings: rows.filter(row => row.warnings.length > 0).length,
    blocked: rows.filter(row => row.operation === 'blocked').length,
  };

  return {
    batchId,
    importType: TOURNAMENT_TEAM_IMPORT_TYPE,
    scope: { orgId: context.orgId, tournamentId: context.tournamentId },
    summary,
    rows,
    canCommit: summary.blocked === 0,
  };
}

export function formatTournamentTeamTemplateRows(input: {
  divisions: TournamentTeamImportDivision[];
  teams: TournamentTeamImportExistingTeam[];
}) {
  const divisionNames = new Map(input.divisions.map(division => [division.id, division.name]));
  return input.teams.map(team => [
    team.id,
    team.name,
    team.divisionId,
    divisionNames.get(team.divisionId) ?? '',
    team.coach ?? '',
    team.email ?? '',
    team.status ?? 'accepted',
    team.paymentStatus ?? 'pending',
    team.depositPaid ?? '',
    team.totalPaid ?? '',
    team.waitlistPosition ?? '',
    team.adminNotes ?? '',
  ]);
}
