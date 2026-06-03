import { checkVenueConflict } from '../schedule-conflict.ts';
import type { Division, Tournament } from '../types.ts';
import {
  buildTournamentScheduleImportAfterRecord,
  normalizeTournamentScheduleExistingGameForImport,
  type TournamentScheduleImportContext,
  type TournamentScheduleImportDivision,
  type TournamentScheduleImportExistingGame,
  type TournamentScheduleImportNormalizedRow,
} from './tournament-schedule.ts';

export type StoredTournamentScheduleImportRow = {
  id: string;
  row_number: number;
  operation: string;
  target_id: string | null;
  normalized_json: unknown;
  before_json: unknown;
  errors_json: unknown;
  status: string;
};

export type PreparedTournamentScheduleCommitRow = {
  id: string;
  rowNumber: number;
  operation: 'create' | 'update' | 'unchanged';
  targetId: string | null;
  normalized: TournamentScheduleImportNormalizedRow;
  before: Record<string, unknown> | null;
};

export type TournamentScheduleImportCommitPrepared = {
  createRows: PreparedTournamentScheduleCommitRow[];
  updateRows: PreparedTournamentScheduleCommitRow[];
  unchangedRows: PreparedTournamentScheduleCommitRow[];
  allRows: PreparedTournamentScheduleCommitRow[];
};

export type TournamentScheduleImportCommitSummary = {
  created: number;
  updated: number;
  unchanged: number;
  skipped: number;
};

export class TournamentScheduleImportCommitError extends Error {
  status: number;
  rowNumbers: number[];

  constructor(message: string, status = 400, rowNumbers: number[] = []) {
    super(message);
    this.name = 'TournamentScheduleImportCommitError';
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

function nullableStringField(record: Record<string, unknown>, key: string, rowNumber: number, label: string) {
  const value = record[key];
  if (value == null || value === '') return null;
  if (typeof value === 'string') return value;
  throw new TournamentScheduleImportCommitError(`Row ${rowNumber} has invalid ${label} data. Run preview again.`, 409, [rowNumber]);
}

function scheduleStatusField(record: Record<string, unknown>) {
  return record.status === 'scheduled' || record.status === 'cancelled' ? record.status : null;
}

function scheduleGameTypeField(record: Record<string, unknown>) {
  return record.gameType === 'pool' || record.gameType === 'playoff' ? record.gameType : null;
}

export function parseTournamentScheduleNormalizedRow(value: unknown, rowNumber: number): TournamentScheduleImportNormalizedRow {
  if (!isRecord(value)) {
    throw new TournamentScheduleImportCommitError(`Row ${rowNumber} is missing normalized schedule data. Run preview again.`, 409, [rowNumber]);
  }

  const gameType = scheduleGameTypeField(value);
  const status = scheduleStatusField(value);
  const divisionId = stringField(value, 'divisionId').trim();
  const homeTeamId = stringField(value, 'homeTeamId').trim();
  const awayTeamId = stringField(value, 'awayTeamId').trim();
  const gameDate = stringField(value, 'gameDate').trim();
  const startTime = stringField(value, 'startTime').trim();

  if (!gameType || !status || !divisionId || !homeTeamId || !awayTeamId || !gameDate || !startTime) {
    throw new TournamentScheduleImportCommitError(`Row ${rowNumber} is missing required normalized schedule data. Run preview again.`, 409, [rowNumber]);
  }
  if (gameType !== 'pool') {
    throw new TournamentScheduleImportCommitError('Playoff schedule imports are not supported yet. Remove playoff rows and preview again.', 409, [rowNumber]);
  }

  return {
    gameId: stringField(value, 'gameId').trim(),
    gameType,
    divisionId,
    divisionName: stringField(value, 'divisionName').trim(),
    homeTeamId,
    homeTeamName: stringField(value, 'homeTeamName').trim(),
    awayTeamId,
    awayTeamName: stringField(value, 'awayTeamName').trim(),
    gameDate,
    startTime,
    venueId: nullableStringField(value, 'venueId', rowNumber, 'Venue ID'),
    venueName: nullableStringField(value, 'venueName', rowNumber, 'Venue Name'),
    venueFacilityId: nullableStringField(value, 'venueFacilityId', rowNumber, 'Facility ID'),
    venueFacilityName: nullableStringField(value, 'venueFacilityName', rowNumber, 'Facility Name'),
    location: stringField(value, 'location'),
    status,
    notes: nullableStringField(value, 'notes', rowNumber, 'Notes'),
  };
}

function rowErrors(value: unknown) {
  return Array.isArray(value) ? value.filter(item => typeof item === 'string') : [];
}

export function prepareTournamentScheduleCommitRows(rows: StoredTournamentScheduleImportRow[]): TournamentScheduleImportCommitPrepared {
  if (rows.length === 0) {
    throw new TournamentScheduleImportCommitError('This schedule import preview has no rows to apply. Run preview again before applying.', 409);
  }

  const blockedRows: number[] = [];
  const unsupportedRows: number[] = [];
  const invalidStatusRows: number[] = [];
  const invalidTargetRows: number[] = [];
  const prepared: PreparedTournamentScheduleCommitRow[] = [];

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
        normalized: parseTournamentScheduleNormalizedRow(row.normalized_json, row.row_number),
        before: isRecord(row.before_json) ? row.before_json : null,
      });
    }
  }

  if (invalidStatusRows.length > 0) {
    throw new TournamentScheduleImportCommitError('This schedule import batch has already been handled. Run preview again before applying.', 409, invalidStatusRows);
  }
  if (blockedRows.length > 0) {
    throw new TournamentScheduleImportCommitError('Resolve blocked rows before applying this schedule import.', 409, blockedRows);
  }
  if (unsupportedRows.length > 0) {
    throw new TournamentScheduleImportCommitError('This schedule importer only supports add/update rows. Run preview again before applying.', 409, unsupportedRows);
  }
  if (invalidTargetRows.length > 0) {
    throw new TournamentScheduleImportCommitError('One or more rows no longer match a valid schedule add/update target. Run preview again.', 409, invalidTargetRows);
  }

  return {
    createRows: prepared.filter(row => row.operation === 'create'),
    updateRows: prepared.filter(row => row.operation === 'update'),
    unchangedRows: prepared.filter(row => row.operation === 'unchanged'),
    allRows: prepared,
  };
}

function samePreviewValue(left: unknown, right: unknown) {
  return (left ?? null) === (right ?? null);
}

const SCHEDULE_STALE_KEYS = [
  'gameType',
  'divisionId',
  'divisionName',
  'homeTeamId',
  'homeTeamName',
  'awayTeamId',
  'awayTeamName',
  'gameDate',
  'startTime',
  'venueId',
  'venueName',
  'venueFacilityId',
  'venueFacilityName',
  'location',
  'status',
  'notes',
];

function changedSincePreview(
  row: PreparedTournamentScheduleCommitRow,
  current: TournamentScheduleImportExistingGame,
  context: TournamentScheduleImportContext,
) {
  if (!row.before) return true;
  const snapshot = normalizeTournamentScheduleExistingGameForImport(current, context);
  return SCHEDULE_STALE_KEYS.some(key => !samePreviewValue(row.before?.[key], snapshot[key]));
}

function isProtectedGame(game: TournamentScheduleImportExistingGame) {
  return (
    game.isPlayoff ||
    game.generatorLocked ||
    game.status === 'submitted' ||
    game.status === 'completed' ||
    game.homeScore != null ||
    game.awayScore != null
  );
}

function didChange(row: PreparedTournamentScheduleCommitRow, key: string) {
  const after = buildTournamentScheduleImportAfterRecord(row.normalized);
  return !samePreviewValue(row.before?.[key], (after as Record<string, unknown>)[key]);
}

function asConflictDivision(division: TournamentScheduleImportDivision): Division {
  return {
    id: division.id,
    tournamentId: '',
    name: division.name,
    minAge: null,
    maxAge: null,
    order: 0,
    settings: division.settings && typeof division.settings === 'object'
      ? division.settings as Division['settings']
      : {},
  };
}

function existingConflictGame(game: TournamentScheduleImportExistingGame) {
  return {
    id: game.id,
    gameDate: game.gameDate,
    startTime: game.startTime,
    status: game.status,
    venueId: game.venueId,
    venueFacilityId: game.venueFacilityId,
    scheduleFacilityLaneId: game.scheduleFacilityLaneId,
    divisionId: game.divisionId,
  };
}

function proposedConflictGame(row: PreparedTournamentScheduleCommitRow) {
  return {
    id: row.targetId ?? `import-row-${row.id}`,
    gameDate: row.normalized.gameDate,
    startTime: row.normalized.startTime,
    status: row.normalized.status,
    venueId: row.normalized.venueId,
    venueFacilityId: row.normalized.venueFacilityId,
    scheduleFacilityLaneId: null,
    divisionId: row.normalized.divisionId,
  };
}

export function validateTournamentScheduleCommitAgainstContext(
  prepared: TournamentScheduleImportCommitPrepared,
  context: TournamentScheduleImportContext,
) {
  const activeRows = [...prepared.createRows, ...prepared.updateRows];
  if (activeRows.length === 0) return;

  const divisionIds = new Set(context.divisions.map(division => division.id));
  const teamById = new Map(context.teams.map(team => [team.id, team]));
  const venueById = new Map(context.venues.map(venue => [venue.id, venue]));
  const facilityById = new Map(context.venues.flatMap(venue => venue.facilities.map(facility => [facility.id, facility] as const)));

  const invalidDivisionRows = activeRows.filter(row => !divisionIds.has(row.normalized.divisionId));
  if (invalidDivisionRows.length > 0) {
    throw new TournamentScheduleImportCommitError(
      'One or more rows reference a division that no longer belongs to this tournament. Run preview again before applying.',
      409,
      invalidDivisionRows.map(row => row.rowNumber),
    );
  }

  const invalidTeamRows = activeRows.filter(row => {
    const home = teamById.get(row.normalized.homeTeamId);
    const away = teamById.get(row.normalized.awayTeamId);
    return (
      !home ||
      !away ||
      home.divisionId !== row.normalized.divisionId ||
      away.divisionId !== row.normalized.divisionId ||
      home.status !== 'accepted' ||
      away.status !== 'accepted' ||
      home.id === away.id
    );
  });
  if (invalidTeamRows.length > 0) {
    throw new TournamentScheduleImportCommitError(
      'One or more rows reference teams that are no longer valid for this division. Run preview again before applying.',
      409,
      invalidTeamRows.map(row => row.rowNumber),
    );
  }

  const invalidVenueRows = activeRows.filter(row => {
    if (row.normalized.venueId && !venueById.has(row.normalized.venueId)) return true;
    if (!row.normalized.venueFacilityId) return false;
    const facility = facilityById.get(row.normalized.venueFacilityId);
    if (!facility) return true;
    return Boolean(row.normalized.venueId && facility.venueId !== row.normalized.venueId);
  });
  if (invalidVenueRows.length > 0) {
    throw new TournamentScheduleImportCommitError(
      'One or more rows reference venues or facilities that no longer belong to this tournament. Run preview again before applying.',
      409,
      invalidVenueRows.map(row => row.rowNumber),
    );
  }

  const gameById = new Map(context.games.map(game => [game.id, game]));
  const missingUpdateRows = prepared.updateRows.filter(row => !row.targetId || !gameById.has(row.targetId));
  if (missingUpdateRows.length > 0) {
    throw new TournamentScheduleImportCommitError('One or more games changed since preview. Run preview again before applying.', 409, missingUpdateRows.map(row => row.rowNumber));
  }

  const protectedRows = prepared.updateRows.filter(row => {
    const current = row.targetId ? gameById.get(row.targetId) : null;
    return current ? isProtectedGame(current) : false;
  });
  if (protectedRows.length > 0) {
    throw new TournamentScheduleImportCommitError(
      'Submitted, completed, scored, generator-locked, or playoff games cannot be changed by schedule import.',
      409,
      protectedRows.map(row => row.rowNumber),
    );
  }

  const staleRows = prepared.updateRows.filter(row => {
    const current = row.targetId ? gameById.get(row.targetId) : null;
    return current ? changedSincePreview(row, current, context) : false;
  });
  if (staleRows.length > 0) {
    throw new TournamentScheduleImportCommitError('One or more games changed since preview. Run preview again before applying.', 409, staleRows.map(row => row.rowNumber));
  }

  const slotLinkedRows = prepared.updateRows.filter(row => {
    const current = row.targetId ? gameById.get(row.targetId) : null;
    return Boolean(
      current &&
      (current.homeSlotId || current.awaySlotId) &&
      (didChange(row, 'divisionId') || didChange(row, 'homeTeamId') || didChange(row, 'awayTeamId')),
    );
  });
  if (slotLinkedRows.length > 0) {
    throw new TournamentScheduleImportCommitError(
      'Pool-slot games cannot change division or teams by schedule import. Update the schedule builder first.',
      409,
      slotLinkedRows.map(row => row.rowNumber),
    );
  }

  const laneLinkedRows = prepared.updateRows.filter(row => {
    const current = row.targetId ? gameById.get(row.targetId) : null;
    return Boolean(
      current?.scheduleFacilityLaneId &&
      (didChange(row, 'venueId') || didChange(row, 'venueFacilityId')),
    );
  });
  if (laneLinkedRows.length > 0) {
    throw new TournamentScheduleImportCommitError(
      'Facility-lane games cannot change venue or facility by schedule import. Update the schedule builder first.',
      409,
      laneLinkedRows.map(row => row.rowNumber),
    );
  }

  const conflictCandidates = new Map(context.games.map(game => [game.id, existingConflictGame(game)]));
  const divisionsForConflict = context.divisions.map(asConflictDivision);
  const conflictRows: number[] = [];

  for (const row of activeRows) {
    const proposed = proposedConflictGame(row);
    if (proposed.status !== 'cancelled' && (proposed.venueId || proposed.venueFacilityId)) {
      const conflict = checkVenueConflict({
        proposedGame: proposed,
        allGames: Array.from(conflictCandidates.values()),
        divisions: divisionsForConflict,
        tournament: {
          id: context.tournament.id,
          settings: context.tournament.settings ?? {},
        } as unknown as Tournament,
      });
      if (conflict?.kind === 'overlap') conflictRows.push(row.rowNumber);
    }
    conflictCandidates.set(proposed.id, proposed);
  }

  if (conflictRows.length > 0) {
    throw new TournamentScheduleImportCommitError(
      'One or more rows now overlap another scheduled game at the same venue or facility. Run preview again before applying.',
      409,
      conflictRows,
    );
  }
}

export function buildTournamentScheduleGameInsert(
  normalized: TournamentScheduleImportNormalizedRow,
  tournamentId: string,
  id: string,
) {
  return {
    id,
    tournament_id: tournamentId,
    division_id: normalized.divisionId,
    home_team_id: normalized.homeTeamId,
    away_team_id: normalized.awayTeamId,
    game_date: normalized.gameDate,
    game_time: normalized.startTime,
    location: normalized.location,
    diamond_id: normalized.venueId,
    venue_facility_id: normalized.venueFacilityId,
    status: normalized.status,
    is_playoff: false,
    notes: normalized.notes,
  };
}

export function buildTournamentScheduleGameUpdate(normalized: TournamentScheduleImportNormalizedRow) {
  return {
    division_id: normalized.divisionId,
    home_team_id: normalized.homeTeamId,
    away_team_id: normalized.awayTeamId,
    game_date: normalized.gameDate,
    game_time: normalized.startTime,
    location: normalized.location,
    diamond_id: normalized.venueId,
    venue_facility_id: normalized.venueFacilityId,
    status: normalized.status,
    notes: normalized.notes,
  };
}

export function summarizeTournamentScheduleCommit(input: TournamentScheduleImportCommitPrepared): TournamentScheduleImportCommitSummary {
  return {
    created: input.createRows.length,
    updated: input.updateRows.length,
    unchanged: input.unchangedRows.length,
    skipped: input.unchangedRows.length,
  };
}
