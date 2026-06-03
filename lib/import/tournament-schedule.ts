import crypto from 'node:crypto';
import { checkVenueConflict } from '../schedule-conflict.ts';
import { getCell, normalizeHeader, normalizeToken } from './tabular.ts';
import type { ImportPreview, ImportPreviewChange, ImportPreviewRow, ParsedImportFile, ParsedImportRow } from './types.ts';
import type { Division, Tournament } from '../types.ts';

export const TOURNAMENT_SCHEDULE_IMPORT_TYPE = 'tournament_schedule';
export const TOURNAMENT_SCHEDULE_IMPORT_MAX_ROWS = 1500;
export const TOURNAMENT_SCHEDULE_IMPORT_TEMPLATE_VERSION = '1';

export const TOURNAMENT_SCHEDULE_IMPORT_HEADERS = [
  'Game ID',
  'Game Type',
  'Division ID',
  'Division Name',
  'Home Team ID',
  'Home Team',
  'Away Team ID',
  'Away Team',
  'Game Date',
  'Start Time',
  'Venue ID',
  'Venue Name',
  'Facility ID',
  'Facility Name',
  'Location',
  'Status',
  'Notes',
] as const;

type ScheduleStatus = 'scheduled' | 'cancelled';
type ScheduleGameType = 'pool' | 'playoff';

export type TournamentScheduleImportDivision = {
  id: string;
  name: string;
  settings?: Record<string, unknown> | null;
};

export type TournamentScheduleImportTeam = {
  id: string;
  divisionId: string;
  name: string;
  status: string | null;
};

export type TournamentScheduleImportVenueFacility = {
  id: string;
  venueId: string;
  name: string;
};

export type TournamentScheduleImportVenue = {
  id: string;
  name: string;
  facilities: TournamentScheduleImportVenueFacility[];
};

export type TournamentScheduleImportExistingGame = {
  id: string;
  divisionId: string;
  homeTeamId: string | null;
  awayTeamId: string | null;
  gameDate: string | null;
  startTime: string | null;
  location: string | null;
  venueId: string | null;
  venueFacilityId: string | null;
  scheduleFacilityLaneId: string | null;
  homeScore: number | null;
  awayScore: number | null;
  status: string | null;
  isPlayoff: boolean;
  generatorLocked: boolean;
  homeSlotId: string | null;
  awaySlotId: string | null;
  notes: string | null;
};

export type TournamentScheduleImportContext = {
  tournamentId: string;
  orgId: string;
  tournament: {
    id: string;
    name: string;
    settings?: Record<string, unknown> | null;
  };
  divisions: TournamentScheduleImportDivision[];
  teams: TournamentScheduleImportTeam[];
  venues: TournamentScheduleImportVenue[];
  games: TournamentScheduleImportExistingGame[];
};

export type TournamentScheduleImportNormalizedRow = {
  gameId: string;
  gameType: ScheduleGameType;
  divisionId: string;
  divisionName: string;
  homeTeamId: string;
  homeTeamName: string;
  awayTeamId: string;
  awayTeamName: string;
  gameDate: string;
  startTime: string;
  venueId: string | null;
  venueName: string | null;
  venueFacilityId: string | null;
  venueFacilityName: string | null;
  location: string;
  status: ScheduleStatus;
  notes: string | null;
};

const STATUS_ALIASES: Record<string, ScheduleStatus | 'submitted' | 'completed'> = {
  scheduled: 'scheduled',
  schedule: 'scheduled',
  active: 'scheduled',
  cancelled: 'cancelled',
  canceled: 'cancelled',
  cancel: 'cancelled',
  submitted: 'submitted',
  final: 'completed',
  finalized: 'completed',
  completed: 'completed',
};

const GAME_TYPE_ALIASES: Record<string, ScheduleGameType> = {
  pool: 'pool',
  'round robin': 'pool',
  roundrobin: 'pool',
  regular: 'pool',
  playoff: 'playoff',
  playoffs: 'playoff',
  bracket: 'playoff',
};

const HEADER_ALIASES = [
  ['Game ID', 'game_id', 'ID'],
  ['Game Type', 'Type', 'is_playoff'],
  ['Division ID', 'division_id'],
  ['Division Name', 'Division'],
  ['Home Team ID', 'home_team_id'],
  ['Home Team', 'Home'],
  ['Away Team ID', 'away_team_id'],
  ['Away Team', 'Away'],
  ['Game Date', 'Date'],
  ['Start Time', 'Time', 'Game Time'],
  ['Venue ID', 'venue_id'],
  ['Venue Name', 'Venue'],
  ['Facility ID', 'facility_id', 'Venue Facility ID'],
  ['Facility Name', 'Facility', 'Venue Facility'],
  ['Location'],
  ['Status'],
  ['Notes'],
];

function hasHeader(headers: string[], aliases: string[]) {
  const normalized = new Set(headers.map(normalizeHeader));
  return aliases.some(alias => normalized.has(normalizeHeader(alias)));
}

export function validateTournamentScheduleImportHeaders(headers: string[]): string[] {
  const errors: string[] = [];
  if (!hasHeader(headers, ['Division ID', 'division_id']) && !hasHeader(headers, ['Division Name', 'Division'])) {
    errors.push('Missing required column: Division ID or Division Name');
  }
  if (!hasHeader(headers, ['Home Team ID', 'home_team_id']) && !hasHeader(headers, ['Home Team', 'Home'])) {
    errors.push('Missing required column: Home Team ID or Home Team');
  }
  if (!hasHeader(headers, ['Away Team ID', 'away_team_id']) && !hasHeader(headers, ['Away Team', 'Away'])) {
    errors.push('Missing required column: Away Team ID or Away Team');
  }
  if (!hasHeader(headers, ['Game Date', 'Date'])) {
    errors.push('Missing required column: Game Date');
  }
  if (!hasHeader(headers, ['Start Time', 'Time', 'Game Time'])) {
    errors.push('Missing required column: Start Time');
  }
  return errors;
}

function fileNotices(parsed: ParsedImportFile): string[] {
  const notices: string[] = [];
  const knownHeaders = new Set(HEADER_ALIASES.flat().map(normalizeHeader));
  const extraHeaders = parsed.headers.filter(header => !knownHeaders.has(normalizeHeader(header)));

  if (extraHeaders.length > 0) {
    notices.push(`Ignored extra column${extraHeaders.length === 1 ? '' : 's'}: ${extraHeaders.join(', ')}.`);
  }
  if (!hasHeader(parsed.headers, ['Game ID', 'game_id', 'ID'])) {
    notices.push('Game ID column is missing. Rows without a Game ID preview as creates only.');
  }

  if (parsed.format === 'xlsx') {
    const templateVersion = parsed.metadata?.[normalizeHeader('Template Version')];
    if (!templateVersion) {
      notices.push('This workbook does not include template version metadata. Preview can continue, but downloading a fresh schedule template is safest.');
    } else if (templateVersion !== TOURNAMENT_SCHEDULE_IMPORT_TEMPLATE_VERSION) {
      notices.push(`This workbook uses template version ${templateVersion}; the current schedule template version is ${TOURNAMENT_SCHEDULE_IMPORT_TEMPLATE_VERSION}. Review the preview carefully or download a fresh template.`);
    }
  }

  return notices;
}

function rawCell(row: ParsedImportRow, aliases: string[]) {
  return getCell(row, aliases).value.trim();
}

function normalizeTimeForDisplay(value: string | null | undefined) {
  if (!value) return '';
  const trimmed = String(value).trim();
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(trimmed);
  if (!match) return trimmed;
  return `${match[1].padStart(2, '0')}:${match[2]}`;
}

function parseDate(value: string, errors: string[]) {
  const trimmed = value.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) {
    errors.push('Game Date must use yyyy-mm-dd.');
    return '';
  }

  const date = new Date(`${trimmed}T12:00:00`);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== Number(match[1]) ||
    date.getMonth() + 1 !== Number(match[2]) ||
    date.getDate() !== Number(match[3])
  ) {
    errors.push('Game Date is not a valid calendar date.');
    return '';
  }
  return trimmed;
}

function parseTime(value: string, errors: string[]) {
  const trimmed = value.trim();
  const decimal = Number(trimmed);
  if (trimmed && Number.isFinite(decimal) && decimal >= 0 && decimal < 1) {
    const minutes = Math.round(decimal * 24 * 60);
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  }

  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(trimmed);
  if (!match) {
    errors.push('Start Time must use 24-hour HH:MM.');
    return '';
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) {
    errors.push('Start Time must be a valid 24-hour time.');
    return '';
  }
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function parseStatus(value: string, fallback: ScheduleStatus, warnings: string[], errors: string[]): ScheduleStatus {
  if (!value.trim()) {
    warnings.push(`Status was blank; preview assumes ${fallback}.`);
    return fallback;
  }
  const parsed = STATUS_ALIASES[normalizeToken(value)];
  if (!parsed) {
    errors.push('Status must be scheduled or cancelled.');
    return fallback;
  }
  if (parsed === 'submitted' || parsed === 'completed') {
    errors.push('Schedule imports cannot create or edit submitted/completed games.');
    return fallback;
  }
  return parsed;
}

function parseGameType(value: string, target: TournamentScheduleImportExistingGame | null, errors: string[]) {
  if (!value.trim()) return target?.isPlayoff ? 'playoff' : 'pool';
  const parsed = GAME_TYPE_ALIASES[normalizeToken(value)];
  if (!parsed) {
    errors.push('Game Type must be pool or playoff.');
    return target?.isPlayoff ? 'playoff' : 'pool';
  }
  if (parsed === 'playoff') errors.push('Playoff schedule imports are not supported in this preview.');
  return parsed;
}

function resolveDivision(input: { divisionId: string; divisionName: string }, context: TournamentScheduleImportContext) {
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

function resolveTeam(
  input: { teamId: string; teamName: string; divisionId: string; label: 'Home Team' | 'Away Team' },
  context: TournamentScheduleImportContext,
) {
  if (input.teamId) {
    const team = context.teams.find(item => item.id === input.teamId);
    if (!team) return { team: null, error: `${input.label} ID does not belong to this tournament.`, warning: null };
    if (team.divisionId !== input.divisionId) return { team: null, error: `${input.label} does not belong to the selected division.`, warning: null };
    if (team.status !== 'accepted') return { team: null, error: `${input.label} must be accepted before it can be scheduled.`, warning: null };
    return { team, error: null, warning: null };
  }

  const token = normalizeToken(input.teamName);
  const matches = context.teams.filter(item =>
    item.divisionId === input.divisionId &&
    item.status === 'accepted' &&
    normalizeToken(item.name) === token
  );
  if (matches.length === 1) {
    return { team: matches[0], error: null, warning: `${input.label} matched by name. Team ID is safer for future imports.` };
  }
  if (matches.length > 1) return { team: null, error: `${input.label} name is ambiguous in this division. Use Team ID.`, warning: null };
  return { team: null, error: `${input.label} was not found as an accepted team in this division.`, warning: null };
}

function allFacilities(context: TournamentScheduleImportContext) {
  return context.venues.flatMap(venue => venue.facilities.map(facility => ({ ...facility, venue })));
}

function resolveVenue(input: {
  venueId: string;
  venueName: string;
  facilityId: string;
  facilityName: string;
}, context: TournamentScheduleImportContext) {
  const warnings: string[] = [];
  const errors: string[] = [];
  let venue: TournamentScheduleImportVenue | null = null;
  let facility: TournamentScheduleImportVenueFacility | null = null;

  if (input.venueId) {
    venue = context.venues.find(item => item.id === input.venueId) ?? null;
    if (!venue) errors.push('Venue ID does not belong to this tournament.');
  } else if (input.venueName) {
    const token = normalizeToken(input.venueName);
    const matches = context.venues.filter(item => normalizeToken(item.name) === token);
    if (matches.length === 1) {
      venue = matches[0];
      warnings.push('Venue matched by name. Venue ID is safer for future imports.');
    } else if (matches.length > 1) {
      errors.push('Venue Name is ambiguous. Use Venue ID.');
    } else {
      errors.push('Venue Name was not found in this tournament.');
    }
  }

  if (input.facilityId) {
    const match = allFacilities(context).find(item => item.id === input.facilityId);
    if (!match) {
      errors.push('Facility ID does not belong to this tournament.');
    } else if (venue && match.venue.id !== venue.id) {
      errors.push('Facility ID does not belong to the selected venue.');
    } else {
      facility = match;
      venue = venue ?? match.venue;
    }
  } else if (input.facilityName) {
    const token = normalizeToken(input.facilityName);
    const matches = venue
      ? venue.facilities.filter(item => normalizeToken(item.name) === token).map(item => ({ ...item, venue }))
      : allFacilities(context).filter(item => normalizeToken(item.name) === token);
    if (matches.length === 1) {
      facility = matches[0];
      venue = venue ?? matches[0].venue;
      warnings.push('Facility matched by name. Facility ID is safer for future imports.');
    } else if (matches.length > 1) {
      errors.push('Facility Name is ambiguous. Use Facility ID.');
    } else {
      errors.push('Facility Name was not found in this tournament.');
    }
  }

  return { venue, facility, warnings, errors };
}

function venueDisplay(
  venue: TournamentScheduleImportVenue | null,
  facility: TournamentScheduleImportVenueFacility | null,
  fallback: string,
) {
  if (venue && facility) return `${venue.name} - ${facility.name}`;
  if (venue) return venue.name;
  return fallback.trim();
}

export function normalizeTournamentScheduleExistingGameForImport(game: TournamentScheduleImportExistingGame, context: TournamentScheduleImportContext): Record<string, unknown> {
  const division = context.divisions.find(item => item.id === game.divisionId);
  const home = context.teams.find(item => item.id === game.homeTeamId);
  const away = context.teams.find(item => item.id === game.awayTeamId);
  const venue = context.venues.find(item => item.id === game.venueId);
  const facility = venue?.facilities.find(item => item.id === game.venueFacilityId) ?? null;

  return {
    gameType: game.isPlayoff ? 'playoff' : 'pool',
    divisionId: game.divisionId,
    divisionName: division?.name ?? '',
    homeTeamId: game.homeTeamId ?? '',
    homeTeamName: home?.name ?? '',
    awayTeamId: game.awayTeamId ?? '',
    awayTeamName: away?.name ?? '',
    gameDate: game.gameDate ?? '',
    startTime: normalizeTimeForDisplay(game.startTime),
    venueId: game.venueId ?? null,
    venueName: venue?.name ?? null,
    venueFacilityId: game.venueFacilityId ?? null,
    venueFacilityName: facility?.name ?? null,
    location: game.location ?? '',
    status: game.status ?? 'scheduled',
    notes: game.notes ?? null,
  };
}

function compare(before: Record<string, unknown>, after: Record<string, unknown>): ImportPreviewChange[] {
  const labels: Record<string, string> = {
    divisionId: 'Division',
    homeTeamId: 'Home Team',
    awayTeamId: 'Away Team',
    gameDate: 'Game Date',
    startTime: 'Start Time',
    venueId: 'Venue',
    venueFacilityId: 'Facility',
    location: 'Location',
    status: 'Status',
    notes: 'Notes',
  };

  return Object.keys(labels)
    .filter(key => (before[key] ?? null) !== (after[key] ?? null))
    .map(key => ({ field: labels[key], before: before[key] ?? null, after: after[key] ?? null }));
}

export function buildTournamentScheduleImportAfterRecord(normalized: TournamentScheduleImportNormalizedRow) {
  return {
    gameType: normalized.gameType,
    divisionId: normalized.divisionId,
    divisionName: normalized.divisionName,
    homeTeamId: normalized.homeTeamId,
    homeTeamName: normalized.homeTeamName,
    awayTeamId: normalized.awayTeamId,
    awayTeamName: normalized.awayTeamName,
    gameDate: normalized.gameDate,
    startTime: normalized.startTime,
    venueId: normalized.venueId,
    venueName: normalized.venueName,
    venueFacilityId: normalized.venueFacilityId,
    venueFacilityName: normalized.venueFacilityName,
    location: normalized.location,
    status: normalized.status,
    notes: normalized.notes,
  };
}

function normalizeRow(
  row: ParsedImportRow,
  target: TournamentScheduleImportExistingGame | null,
  context: TournamentScheduleImportContext,
  warnings: string[],
  errors: string[],
): TournamentScheduleImportNormalizedRow {
  const gameId = rawCell(row, ['Game ID', 'game_id', 'ID']);
  const divisionResult = resolveDivision({
    divisionId: rawCell(row, ['Division ID', 'division_id']),
    divisionName: rawCell(row, ['Division Name', 'Division']),
  }, context);
  if (divisionResult.error) errors.push(divisionResult.error);

  const divisionId = divisionResult.division?.id ?? rawCell(row, ['Division ID', 'division_id']);
  const divisionName = divisionResult.division?.name ?? rawCell(row, ['Division Name', 'Division']);

  const homeResult = resolveTeam({
    teamId: rawCell(row, ['Home Team ID', 'home_team_id']),
    teamName: rawCell(row, ['Home Team', 'Home']),
    divisionId,
    label: 'Home Team',
  }, context);
  if (homeResult.error) errors.push(homeResult.error);
  if (homeResult.warning) warnings.push(homeResult.warning);

  const awayResult = resolveTeam({
    teamId: rawCell(row, ['Away Team ID', 'away_team_id']),
    teamName: rawCell(row, ['Away Team', 'Away']),
    divisionId,
    label: 'Away Team',
  }, context);
  if (awayResult.error) errors.push(awayResult.error);
  if (awayResult.warning) warnings.push(awayResult.warning);

  if (homeResult.team && awayResult.team && homeResult.team.id === awayResult.team.id) {
    errors.push('Home Team and Away Team must be different.');
  }

  const venueResult = resolveVenue({
    venueId: rawCell(row, ['Venue ID', 'venue_id']),
    venueName: rawCell(row, ['Venue Name', 'Venue']),
    facilityId: rawCell(row, ['Facility ID', 'facility_id', 'Venue Facility ID']),
    facilityName: rawCell(row, ['Facility Name', 'Facility', 'Venue Facility']),
  }, context);
  errors.push(...venueResult.errors);
  warnings.push(...venueResult.warnings);

  const gameDate = parseDate(rawCell(row, ['Game Date', 'Date']), errors);
  const startTime = parseTime(rawCell(row, ['Start Time', 'Time', 'Game Time']), errors);
  const fallbackStatus = target?.status === 'cancelled' ? 'cancelled' : 'scheduled';
  const status = parseStatus(rawCell(row, ['Status']), fallbackStatus, warnings, errors);
  const gameType = parseGameType(rawCell(row, ['Game Type', 'Type', 'is_playoff']), target, errors);
  const location = venueDisplay(venueResult.venue, venueResult.facility, rawCell(row, ['Location']));

  return {
    gameId,
    gameType,
    divisionId,
    divisionName,
    homeTeamId: homeResult.team?.id ?? rawCell(row, ['Home Team ID', 'home_team_id']),
    homeTeamName: homeResult.team?.name ?? rawCell(row, ['Home Team', 'Home']),
    awayTeamId: awayResult.team?.id ?? rawCell(row, ['Away Team ID', 'away_team_id']),
    awayTeamName: awayResult.team?.name ?? rawCell(row, ['Away Team', 'Away']),
    gameDate,
    startTime,
    venueId: venueResult.venue?.id ?? null,
    venueName: venueResult.venue?.name ?? null,
    venueFacilityId: venueResult.facility?.id ?? null,
    venueFacilityName: venueResult.facility?.name ?? null,
    location,
    status,
    notes: rawCell(row, ['Notes']) || null,
  };
}

function conflictGames(context: TournamentScheduleImportContext) {
  return context.games.map(game => ({
    id: game.id,
    gameDate: game.gameDate,
    startTime: normalizeTimeForDisplay(game.startTime),
    status: game.status,
    venueId: game.venueId,
    venueFacilityId: game.venueFacilityId,
    scheduleFacilityLaneId: game.scheduleFacilityLaneId,
    divisionId: game.divisionId,
  }));
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

function addExistingGameSafetyErrors(target: TournamentScheduleImportExistingGame | null, errors: string[]) {
  if (!target) return;
  if (target.isPlayoff) errors.push('Playoff games are not supported in schedule imports yet.');
  if (target.generatorLocked) errors.push('Generator-locked games must be unlocked in the app before import.');
  if (target.status === 'submitted' || target.status === 'completed' || target.homeScore != null || target.awayScore != null) {
    errors.push('Submitted, completed, or scored games cannot be changed by schedule import.');
  }
}

function addLinkedGameChangeSafetyErrors(
  target: TournamentScheduleImportExistingGame | null,
  before: Record<string, unknown> | undefined,
  after: Record<string, unknown>,
  errors: string[],
) {
  if (!target || !before) return;
  if (
    (target.homeSlotId || target.awaySlotId) &&
    (before.homeTeamId !== after.homeTeamId || before.awayTeamId !== after.awayTeamId || before.divisionId !== after.divisionId)
  ) {
    errors.push('Pool-slot games cannot change division or teams by schedule import. Update the schedule builder first.');
  }
  if (
    target.scheduleFacilityLaneId &&
    (before.venueId !== after.venueId || before.venueFacilityId !== after.venueFacilityId)
  ) {
    errors.push('Facility-lane games cannot change venue or facility by schedule import. Update the schedule builder first.');
  }
}

export function buildTournamentScheduleImportPreview(
  parsed: ParsedImportFile,
  context: TournamentScheduleImportContext,
  batchId: string = crypto.randomUUID(),
): ImportPreview {
  const headerErrors = validateTournamentScheduleImportHeaders(parsed.headers);
  const notices = fileNotices(parsed);
  const existingById = new Map(context.games.map(game => [game.id, game]));
  const uploadedIds = parsed.rows
    .map(row => rawCell(row, ['Game ID', 'game_id', 'ID']))
    .filter(Boolean);
  const duplicatedUploadedIds = new Set(uploadedIds.filter((id, index) => uploadedIds.indexOf(id) !== index));
  const conflictCandidates = conflictGames(context);
  const divisionsForConflict = context.divisions.map(asConflictDivision);

  const rows: ImportPreviewRow[] = [];

  for (const row of parsed.rows) {
    const warnings: string[] = [];
    const errors = [...headerErrors];
    const gameId = rawCell(row, ['Game ID', 'game_id', 'ID']);
    let target: TournamentScheduleImportExistingGame | null = null;

    if (gameId) {
      if (duplicatedUploadedIds.has(gameId)) errors.push('Game ID appears more than once in this file.');
      target = existingById.get(gameId) ?? null;
      if (!target) errors.push('Game ID was not found in this tournament.');
    }

    addExistingGameSafetyErrors(target, errors);
    const normalized = normalizeRow(row, target, context, warnings, errors);
    const after = buildTournamentScheduleImportAfterRecord(normalized);
    const before = target ? normalizeTournamentScheduleExistingGameForImport(target, context) : undefined;
    addLinkedGameChangeSafetyErrors(target, before, after, errors);

    if (normalized.status !== 'cancelled' && (normalized.venueId || normalized.venueFacilityId)) {
      const conflict = checkVenueConflict({
        proposedGame: {
          id: target?.id ?? `import-row-${row.rowNumber}`,
          gameDate: normalized.gameDate,
          startTime: normalized.startTime,
          status: normalized.status,
          venueId: normalized.venueId,
          venueFacilityId: normalized.venueFacilityId,
          divisionId: normalized.divisionId,
        },
        allGames: conflictCandidates,
        divisions: divisionsForConflict,
        tournament: {
          id: context.tournament.id,
          settings: context.tournament.settings ?? {},
        } as unknown as Tournament,
      });
      if (conflict?.kind === 'overlap') {
        errors.push('Venue/time overlaps another scheduled game at this location.');
      } else if (conflict?.kind === 'buffer') {
        warnings.push(`Venue buffer warning. Earliest clean start is ${conflict.availableAt}.`);
      }
    }

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
      displayName: `${normalized.homeTeamName || 'Home'} vs ${normalized.awayTeamName || 'Away'}`,
      raw: row.values,
      normalized,
      before,
      after,
      changes,
      warnings,
      errors,
    });

    if (operation !== 'blocked') {
      conflictCandidates.push({
        id: target?.id ?? `import-row-${row.rowNumber}`,
        gameDate: normalized.gameDate,
        startTime: normalized.startTime,
        status: normalized.status,
        venueId: normalized.venueId,
        venueFacilityId: normalized.venueFacilityId,
        scheduleFacilityLaneId: null,
        divisionId: normalized.divisionId,
      });
    }
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
    importType: TOURNAMENT_SCHEDULE_IMPORT_TYPE,
    notices: [
      'Add/update only. Games missing from this file stay unchanged.',
      ...notices,
    ],
    scope: { orgId: context.orgId, tournamentId: context.tournamentId },
    summary,
    rows,
    canCommit: summary.blocked === 0,
  };
}

export function formatTournamentScheduleTemplateRows(context: TournamentScheduleImportContext) {
  const divisionNames = new Map(context.divisions.map(division => [division.id, division.name]));
  const teamNames = new Map(context.teams.map(team => [team.id, team.name]));
  const venueNames = new Map(context.venues.map(venue => [venue.id, venue.name]));
  const facilityById = new Map<string, TournamentScheduleImportVenueFacility>();
  for (const venue of context.venues) {
    for (const facility of venue.facilities) facilityById.set(facility.id, facility);
  }

  return context.games.map(game => {
    const facility = game.venueFacilityId ? facilityById.get(game.venueFacilityId) : null;
    return [
      game.id,
      game.isPlayoff ? 'playoff' : 'pool',
      game.divisionId,
      divisionNames.get(game.divisionId) ?? '',
      game.homeTeamId ?? '',
      game.homeTeamId ? teamNames.get(game.homeTeamId) ?? '' : '',
      game.awayTeamId ?? '',
      game.awayTeamId ? teamNames.get(game.awayTeamId) ?? '' : '',
      game.gameDate ?? '',
      normalizeTimeForDisplay(game.startTime),
      game.venueId ?? '',
      game.venueId ? venueNames.get(game.venueId) ?? '' : '',
      game.venueFacilityId ?? '',
      facility?.name ?? '',
      game.location ?? '',
      game.status ?? 'scheduled',
      game.notes ?? '',
    ];
  });
}
