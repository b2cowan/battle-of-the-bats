import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseCSV } from '../../lib/import/csv.ts';
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
    // Location appears because the stored game carries the legacy hyphen label while the
    // derived string is the canonical em dash — the one-time write-through unification.
    assert.deepEqual(preview.rows[0].changes.map(change => change.field), ['Start Time', 'Location', 'Notes']);
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

  it('accepts alias headers in any order and normalizes Excel decimal time values', () => {
    const parsedFile = parseCSV(
      'Division,Home,Away,Date,Time,Venue,Facility,Status\nU11,Blue Jays,Red Hawks,2026-07-13,0.5,Lions Park,Diamond 1,scheduled\n',
      10,
    );
    const preview = buildTournamentScheduleImportPreview(parsedFile, context, 'batch-1');

    assert.equal(preview.summary.creates, 1);
    assert.equal(preview.rows[0].operation, 'create');
    assert.equal(preview.rows[0].normalized.startTime, '12:00');
    assert(preview.rows[0].warnings.some(warning => warning.includes('Home Team matched by name')));
    assert(preview.notices?.some(notice => notice.includes('Game ID column is missing')));
  });

  it('blocks invalid date, time, status, and game type values', () => {
    const preview = buildTournamentScheduleImportPreview(parsed([
      baseRow({
        'Game Type': 'scrimmage',
        'Game Date': '2026-02-30',
        'Start Time': '24:00',
        Status: 'postponed',
      }),
    ]), context, 'batch-1');

    assert.equal(preview.summary.blocked, 1);
    assert(preview.rows[0].errors.some(error => error.includes('calendar date')));
    assert(preview.rows[0].errors.some(error => error.includes('24-hour time')));
    assert(preview.rows[0].errors.some(error => error.includes('Status')));
    assert(preview.rows[0].errors.some(error => error.includes('Game Type')));
  });

  it('blocks ambiguous team and venue name matches when IDs are omitted', () => {
    const ambiguousContext: TournamentScheduleImportContext = {
      ...context,
      teams: [
        ...context.teams,
        {
          id: 'team-duplicate',
          divisionId: 'division-1',
          name: 'Blue Jays',
          status: 'accepted',
        },
      ],
      venues: [
        ...context.venues,
        {
          id: 'venue-duplicate',
          name: 'Lions Park',
          facilities: [{ id: 'facility-duplicate', venueId: 'venue-duplicate', name: 'Diamond 2' }],
        },
      ],
    };
    const preview = buildTournamentScheduleImportPreview(parsed([
      baseRow({
        'Home Team ID': '',
        'Venue ID': '',
      }),
    ]), ambiguousContext, 'batch-1');

    assert.equal(preview.summary.blocked, 1);
    assert(preview.rows[0].errors.some(error => error.includes('Home Team name is ambiguous')));
    assert(preview.rows[0].errors.some(error => error.includes('Venue Name is ambiguous')));
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

  it('adds file-level notices for extra columns, missing IDs, and old XLSX template metadata', () => {
    const preview = buildTournamentScheduleImportPreview({
      format: 'xlsx',
      headers: ['Division Name', 'Home Team', 'Away Team', 'Game Date', 'Start Time', 'Mystery Column'],
      metadata: { 'template version': '0' },
      rows: [{
        rowNumber: 2,
        values: {
          'Division Name': 'U11',
          'Home Team': 'Blue Jays',
          'Away Team': 'Red Hawks',
          'Game Date': '2026-07-13',
          'Start Time': '09:00',
          'Mystery Column': 'ignored',
        },
      }],
    }, context, 'batch-1');

    assert(preview.notices?.some(notice => notice.includes('Ignored extra column')));
    assert(preview.notices?.some(notice => notice.includes('Game ID column is missing')));
    assert(preview.notices?.some(notice => notice.includes(`current schedule template version is ${TOURNAMENT_SCHEDULE_IMPORT_TEMPLATE_VERSION}`)));
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
        location: 'Lions Park — Diamond 1',
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

  /**
   * A typed field name is a strong hint, not a certainty — it rests on a spelling convention in
   * someone else's spreadsheet rather than on a field record. Because ONE blocked row rejects the
   * whole upload, an uncertain match must warn rather than block: two unrelated rows that both say
   * "Home Field" must not be able to reject a thousand good ones. A structured match still blocks.
   */
  it('warns but does not block an upload when the clash is on a typed field name', () => {
    const typedTextRow = baseRow({
      'Game Date': '2026-07-12',
      'Start Time': '11:00',
      // Typed field name only — no venue or facility picked.
      'Venue ID': '',
      'Venue Name': '',
      'Facility ID': '',
      'Facility Name': '',
      Location: 'Diamond 7',
    });

    const typedTextContext: TournamentScheduleImportContext = {
      ...context,
      games: [
        ...context.games,
        {
          ...context.games[0],
          id: 'typed-text-clash',
          gameDate: '2026-07-12',
          startTime: '11:00:00',
          location: 'Diamond 7',
          venueId: null,
          venueFacilityId: null,
        },
      ],
    };

    const preview = buildTournamentScheduleImportPreview(parsed([typedTextRow]), typedTextContext, 'batch-1');
    const row = preview.rows[0];

    // Seen and said out loud — proves the existing typed-text game is visible as a clash partner.
    assert.ok(
      row.warnings.some(warning => /typed field name/i.test(warning)),
      `expected a typed-field-name warning, got ${JSON.stringify(row.warnings)}`,
    );
    // …but not fatal: the row still imports.
    assert.equal(row.operation, 'create');
    assert.deepEqual(row.errors, []);

    const prepared = prepareTournamentScheduleCommitRows(storedRowsFromPreview(preview));
    assert.doesNotThrow(() => validateTournamentScheduleCommitAgainstContext(prepared, typedTextContext));
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

/**
 * Phase 2: a bare Location cell — the way most third-party files name a field — resolves on
 * EXACT match (trim + case-fold; punctuation flattened, so our own hyphen-exported labels and
 * the live em-dash labels read the same) against the tournament's fields. It is the ONE
 * sanctioned auto-resolution of typed text. Anything ambiguous or unmatched stays typed text,
 * never blocks the file, and is NAMED in the preview's unmatched-locations report.
 */
describe('tournament schedule import — bare Location cell resolution', () => {
  const noVenueColumns = {
    'Venue ID': '',
    'Venue Name': '',
    'Facility ID': '',
    'Facility Name': '',
  };

  it('resolves an exact combined label, across separator and casing variants', () => {
    for (const cell of ['Lions Park - Diamond 1', 'Lions Park — Diamond 1', '  lions park -   DIAMOND 1 ']) {
      const preview = buildTournamentScheduleImportPreview(parsed([
        baseRow({ ...noVenueColumns, Location: cell }),
      ]), context, 'batch-1');
      const normalized = preview.rows[0].normalized as Record<string, unknown>;
      assert.equal(normalized.venueId, 'venue-1', `cell ${JSON.stringify(cell)} should resolve the venue`);
      assert.equal(normalized.venueFacilityId, 'facility-1');
      // The stored display string is DERIVED from the records, in the one canonical format.
      assert.equal(normalized.location, 'Lions Park — Diamond 1');
      assert.equal(preview.unmatchedLocations, undefined);
    }
  });

  it('resolves a bare facility name when it is unique in the tournament', () => {
    const preview = buildTournamentScheduleImportPreview(parsed([
      baseRow({ ...noVenueColumns, Location: 'diamond 1' }),
    ]), context, 'batch-1');
    const normalized = preview.rows[0].normalized as Record<string, unknown>;
    assert.equal(normalized.venueFacilityId, 'facility-1');
    assert.equal(normalized.location, 'Lions Park — Diamond 1');
  });

  it('resolves a bare venue name to the venue alone', () => {
    const preview = buildTournamentScheduleImportPreview(parsed([
      baseRow({ ...noVenueColumns, Location: 'LIONS PARK' }),
    ]), context, 'batch-1');
    const normalized = preview.rows[0].normalized as Record<string, unknown>;
    assert.equal(normalized.venueId, 'venue-1');
    assert.equal(normalized.venueFacilityId, null);
    assert.equal(normalized.location, 'Lions Park');
  });

  it('leaves an ambiguous name as typed text, warns, and flags it in the report', () => {
    const twoDiamondOnes: TournamentScheduleImportContext = {
      ...context,
      venues: [
        ...context.venues,
        { id: 'venue-2', name: 'Community Park', facilities: [{ id: 'facility-9', venueId: 'venue-2', name: 'Diamond 1' }] },
      ],
    };
    const preview = buildTournamentScheduleImportPreview(parsed([
      baseRow({ ...noVenueColumns, Location: 'Diamond 1' }),
    ]), twoDiamondOnes, 'batch-1');
    const row = preview.rows[0];
    const normalized = row.normalized as Record<string, unknown>;
    assert.equal(normalized.venueId, null);
    assert.equal(normalized.location, 'Diamond 1');
    assert.ok(row.warnings.some(warning => /more than one/i.test(warning)));
    assert.equal(row.operation, 'create'); // never blocks
    assert.deepEqual(preview.unmatchedLocations, [{ name: 'Diamond 1', rows: 1, ambiguous: true }]);
  });

  it('aggregates unmatched names by count, and never lets them block the file', () => {
    const preview = buildTournamentScheduleImportPreview(parsed([
      baseRow({ ...noVenueColumns, Location: 'Diamond 7', 'Start Time': '09:00' }),
      baseRow({ ...noVenueColumns, Location: ' diamond 7 ', 'Start Time': '11:00', 'Home Team ID': 'team-3', 'Home Team': 'Gold Lions' }),
      baseRow({ ...noVenueColumns, Location: 'Main Field', 'Start Time': '13:00' }),
    ]), context, 'batch-1');

    assert.deepEqual(preview.unmatchedLocations, [
      { name: 'Diamond 7', rows: 2 },
      { name: 'Main Field', rows: 1 },
    ]);
    assert.equal(preview.summary.blocked, 0);
    assert.equal(preview.canCommit, true);
  });

  it('does not report placeholder text — "TBD" names no field at all (R2)', () => {
    const preview = buildTournamentScheduleImportPreview(parsed([
      baseRow({ ...noVenueColumns, Location: 'TBD' }),
    ]), context, 'batch-1');
    assert.equal(preview.unmatchedLocations, undefined);
  });

  it('never second-guesses the explicit Venue/Facility columns', () => {
    // Venue columns used → the Location cell is only a fallback string, not a lookup.
    const preview = buildTournamentScheduleImportPreview(parsed([
      baseRow({ Location: 'Some Unrelated Words' }),
    ]), context, 'batch-1');
    const normalized = preview.rows[0].normalized as Record<string, unknown>;
    assert.equal(normalized.venueId, 'venue-1');
    assert.equal(normalized.location, 'Lions Park — Diamond 1');
    assert.equal(preview.unmatchedLocations, undefined);
  });
});
