import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  TOURNAMENT_SCHEDULE_IMPORT_HEADERS,
  TOURNAMENT_SCHEDULE_IMPORT_TEMPLATE_VERSION,
  buildTournamentScheduleImportPreview,
  type TournamentScheduleImportContext,
} from '../../lib/import/tournament-schedule.ts';
import {
  TournamentScheduleImportCommitError,
  buildTournamentScheduleGameInsert,
  prepareTournamentScheduleCommitRows,
  summarizeTournamentScheduleCommit,
  validateTournamentScheduleCommitAgainstContext,
} from '../../lib/import/tournament-schedule-commit.ts';
import type { ParsedImportFile } from '../../lib/import/types.ts';

const context: TournamentScheduleImportContext = {
  tournamentId: 'tournament-1',
  orgId: 'org-1',
  tournament: {
    id: 'tournament-1',
    name: 'Summer Classic',
    settings: { game_duration_minutes: 90, buffer_minutes: 15 },
  },
  divisions: [
    { id: 'division-1', name: 'U11' },
    { id: 'division-2', name: 'U13' },
  ],
  teams: [
    { id: 'team-1', divisionId: 'division-1', name: 'Blue Jays', status: 'accepted' },
    { id: 'team-2', divisionId: 'division-1', name: 'Red Hawks', status: 'accepted' },
    { id: 'team-3', divisionId: 'division-1', name: 'Gold Lions', status: 'accepted' },
    { id: 'team-4', divisionId: 'division-2', name: 'U13 North', status: 'accepted' },
    { id: 'team-pending', divisionId: 'division-1', name: 'Pending Team', status: 'pending' },
  ],
  venues: [
    {
      id: 'venue-1',
      name: 'Lions Park',
      facilities: [{ id: 'facility-1', venueId: 'venue-1', name: 'Diamond 1' }],
    },
  ],
  games: [
    {
      id: 'game-1',
      divisionId: 'division-1',
      homeTeamId: 'team-1',
      awayTeamId: 'team-2',
      gameDate: '2026-07-10',
      startTime: '09:00:00',
      location: 'Lions Park - Diamond 1',
      venueId: 'venue-1',
      venueFacilityId: 'facility-1',
      scheduleFacilityLaneId: null,
      homeScore: null,
      awayScore: null,
      status: 'scheduled',
      isPlayoff: false,
      generatorLocked: false,
      homeSlotId: null,
      awaySlotId: null,
      notes: null,
    },
    {
      id: 'game-completed',
      divisionId: 'division-1',
      homeTeamId: 'team-1',
      awayTeamId: 'team-3',
      gameDate: '2026-07-11',
      startTime: '09:00:00',
      location: 'Lions Park - Diamond 1',
      venueId: 'venue-1',
      venueFacilityId: 'facility-1',
      scheduleFacilityLaneId: null,
      homeScore: 4,
      awayScore: 3,
      status: 'completed',
      isPlayoff: false,
      generatorLocked: false,
      homeSlotId: null,
      awaySlotId: null,
      notes: null,
    },
  ],
};

function parsed(rows: Record<string, string>[]): ParsedImportFile {
  return {
    format: 'xlsx',
    headers: [...TOURNAMENT_SCHEDULE_IMPORT_HEADERS],
    metadata: { 'template version': TOURNAMENT_SCHEDULE_IMPORT_TEMPLATE_VERSION },
    rows: rows.map((values, index) => ({ rowNumber: index + 2, values })),
  };
}

function baseRow(overrides: Record<string, string> = {}) {
  return {
    'Game ID': '',
    'Game Type': 'pool',
    'Division ID': 'division-1',
    'Division Name': 'U11',
    'Home Team ID': 'team-1',
    'Home Team': 'Blue Jays',
    'Away Team ID': 'team-2',
    'Away Team': 'Red Hawks',
    'Game Date': '2026-07-12',
    'Start Time': '09:00',
    'Venue ID': 'venue-1',
    'Venue Name': 'Lions Park',
    'Facility ID': 'facility-1',
    'Facility Name': 'Diamond 1',
    Location: 'Lions Park - Diamond 1',
    Status: 'scheduled',
    Notes: '',
    ...overrides,
  };
}

function storedRowsFromPreview(preview: ReturnType<typeof buildTournamentScheduleImportPreview>) {
  return preview.rows.map((row, index) => ({
    id: `stored-row-${index + 1}`,
    row_number: row.rowNumber,
    operation: row.operation,
    target_id: row.targetId ?? null,
    normalized_json: row.normalized,
    before_json: row.before ?? null,
    errors_json: row.errors,
    status: 'previewed',
  }));
}

describe('tournament schedule import preview', () => {
  it('classifies an update by Game ID and reports field changes', () => {
    const preview = buildTournamentScheduleImportPreview(parsed([
      baseRow({
        'Game ID': 'game-1',
        'Game Date': '2026-07-10',
        'Start Time': '11:00',
        Notes: 'Moved later',
      }),
    ]), context, 'batch-1');

    assert.equal(preview.summary.updates, 1);
    assert.equal(preview.rows[0].operation, 'update');
    assert.deepEqual(preview.rows[0].changes.map(change => change.field), ['Start Time', 'Notes']);
    assert.equal(preview.canCommit, true);
  });

  it('allows name matching with warnings when IDs are omitted', () => {
    const preview = buildTournamentScheduleImportPreview(parsed([
      baseRow({
        'Home Team ID': '',
        'Away Team ID': '',
        'Venue ID': '',
        'Facility ID': '',
        'Game Date': '2026-07-12',
        'Start Time': '11:00',
      }),
    ]), context, 'batch-1');

    assert.equal(preview.summary.creates, 1);
    assert(preview.rows[0].warnings.some(warning => warning.includes('Home Team matched by name')));
    assert(preview.rows[0].warnings.some(warning => warning.includes('Venue matched by name')));
  });

  it('blocks venue overlaps and warns on buffer conflicts', () => {
    const preview = buildTournamentScheduleImportPreview(parsed([
      baseRow({ 'Game Date': '2026-07-10', 'Start Time': '10:00' }),
      baseRow({ 'Game Date': '2026-07-10', 'Start Time': '10:40' }),
    ]), context, 'batch-1');

    assert.equal(preview.rows[0].operation, 'blocked');
    assert(preview.rows[0].errors.some(error => error.includes('overlaps')));
    assert.equal(preview.rows[1].operation, 'create');
    assert(preview.rows[1].warnings.some(warning => warning.includes('Venue buffer warning')));
  });

  it('blocks protected existing games and unsupported playoff rows', () => {
    const preview = buildTournamentScheduleImportPreview(parsed([
      baseRow({ 'Game ID': 'game-completed', 'Game Date': '2026-07-11', 'Start Time': '11:00' }),
      baseRow({ 'Game Type': 'playoff', 'Game Date': '2026-07-13', 'Start Time': '09:00' }),
    ]), context, 'batch-1');

    assert.equal(preview.summary.blocked, 2);
    assert(preview.rows[0].errors.some(error => error.includes('Submitted, completed, or scored')));
    assert(preview.rows[1].errors.some(error => error.includes('Playoff')));
  });

  it('blocks duplicate IDs and teams outside the selected division', () => {
    const preview = buildTournamentScheduleImportPreview(parsed([
      baseRow({ 'Game ID': 'game-1', 'Home Team ID': 'team-4', 'Start Time': '11:00' }),
      baseRow({ 'Game ID': 'game-1', 'Start Time': '12:00' }),
    ]), context, 'batch-1');

    assert.equal(preview.summary.blocked, 2);
    assert(preview.rows[0].errors.some(error => error.includes('Game ID appears more than once')));
    assert(preview.rows[0].errors.some(error => error.includes('Home Team does not belong')));
    assert(preview.rows[1].errors.some(error => error.includes('Game ID appears more than once')));
  });

  it('blocks structural changes for slot-linked games', () => {
    const slotContext: TournamentScheduleImportContext = {
      ...context,
      games: context.games.map(game => game.id === 'game-1' ? { ...game, homeSlotId: 'slot-1' } : game),
    };
    const preview = buildTournamentScheduleImportPreview(parsed([
      baseRow({
        'Game ID': 'game-1',
        'Home Team ID': 'team-3',
        'Home Team': 'Gold Lions',
        'Game Date': '2026-07-10',
        'Start Time': '11:00',
      }),
    ]), slotContext, 'batch-1');

    assert.equal(preview.rows[0].operation, 'blocked');
    assert(preview.rows[0].errors.some(error => error.includes('Pool-slot games cannot change')));
    assert.equal(preview.canCommit, false);
  });
});

describe('tournament schedule import commit helpers', () => {
  it('prepares create/update rows and builds safe game payloads', () => {
    const preview = buildTournamentScheduleImportPreview(parsed([
      baseRow({
        'Game ID': 'game-1',
        'Game Date': '2026-07-10',
        'Start Time': '11:00',
        Notes: 'Moved later',
      }),
      baseRow({
        'Game Date': '2026-07-12',
        'Start Time': '11:00',
      }),
    ]), context, 'batch-1');
    const prepared = prepareTournamentScheduleCommitRows(storedRowsFromPreview(preview));

    assert.equal(prepared.updateRows.length, 1);
    assert.equal(prepared.createRows.length, 1);
    assert.doesNotThrow(() => validateTournamentScheduleCommitAgainstContext(prepared, context));
    assert.deepEqual(summarizeTournamentScheduleCommit(prepared), {
      created: 1,
      updated: 1,
      unchanged: 0,
      skipped: 0,
    });

    assert.deepEqual(
      buildTournamentScheduleGameInsert(prepared.createRows[0].normalized, context.tournamentId, 'new-game-1'),
      {
        id: 'new-game-1',
        tournament_id: 'tournament-1',
        division_id: 'division-1',
        home_team_id: 'team-1',
        away_team_id: 'team-2',
        game_date: '2026-07-12',
        game_time: '11:00',
        location: 'Lions Park - Diamond 1',
        diamond_id: 'venue-1',
        venue_facility_id: 'facility-1',
        status: 'scheduled',
        is_playoff: false,
        notes: null,
      },
    );
  });

  it('rejects blocked rows before commit', () => {
    const preview = buildTournamentScheduleImportPreview(parsed([
      baseRow({ 'Game ID': 'game-completed', 'Game Date': '2026-07-11', 'Start Time': '11:00' }),
    ]), context, 'batch-1');

    assert.throws(
      () => prepareTournamentScheduleCommitRows(storedRowsFromPreview(preview)),
      TournamentScheduleImportCommitError,
    );
  });

  it('rejects stale updates and fresh venue overlaps', () => {
    const preview = buildTournamentScheduleImportPreview(parsed([
      baseRow({
        'Game ID': 'game-1',
        'Game Date': '2026-07-10',
        'Start Time': '11:00',
      }),
    ]), context, 'batch-1');
    const prepared = prepareTournamentScheduleCommitRows(storedRowsFromPreview(preview));

    const staleContext: TournamentScheduleImportContext = {
      ...context,
      games: context.games.map(game => game.id === 'game-1' ? { ...game, startTime: '10:00:00' } : game),
    };
    assert.throws(
      () => validateTournamentScheduleCommitAgainstContext(prepared, staleContext),
      /changed since preview/,
    );

    const createPreview = buildTournamentScheduleImportPreview(parsed([
      baseRow({
        'Game Date': '2026-07-12',
        'Start Time': '11:00',
      }),
    ]), context, 'batch-1');
    const createPrepared = prepareTournamentScheduleCommitRows(storedRowsFromPreview(createPreview));
    const conflictContext: TournamentScheduleImportContext = {
      ...context,
      games: [
        ...context.games,
        {
          ...context.games[0],
          id: 'fresh-conflict',
          gameDate: '2026-07-12',
          startTime: '11:00:00',
        },
      ],
    };

    assert.throws(
      () => validateTournamentScheduleCommitAgainstContext(createPrepared, conflictContext),
      /overlap/,
    );
  });

  it('rejects slot-linked team changes at commit time', () => {
    const preview = buildTournamentScheduleImportPreview(parsed([
      baseRow({
        'Game ID': 'game-1',
        'Home Team ID': 'team-3',
        'Home Team': 'Gold Lions',
        'Game Date': '2026-07-10',
        'Start Time': '11:00',
      }),
    ]), context, 'batch-1');
    const prepared = prepareTournamentScheduleCommitRows(storedRowsFromPreview(preview));
    const slotContext: TournamentScheduleImportContext = {
      ...context,
      games: context.games.map(game => game.id === 'game-1' ? { ...game, homeSlotId: 'slot-1' } : game),
    };

    assert.throws(
      () => validateTournamentScheduleCommitAgainstContext(prepared, slotContext),
      /Pool-slot games cannot change/,
    );
  });
});
