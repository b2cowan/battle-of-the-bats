import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseCSV } from '../../lib/import/csv.ts';
import {
  TOURNAMENT_TEAM_IMPORT_HEADERS,
  buildTournamentTeamImportPreview,
  type TournamentTeamImportContext,
} from '../../lib/import/tournament-teams.ts';
import {
  TournamentTeamImportCommitError,
  buildTournamentTeamInsert,
  buildTournamentTeamUpdate,
  prepareTournamentTeamCommitRows,
  summarizeTournamentTeamCommit,
  type StoredTournamentTeamImportRow,
} from '../../lib/import/tournament-teams-commit.ts';
import type { ParsedImportFile } from '../../lib/import/types.ts';

const context: TournamentTeamImportContext = {
  tournamentId: 'tournament-1',
  orgId: 'org-1',
  divisions: [
    { id: 'division-1', name: 'U11' },
    { id: 'division-2', name: 'U13' },
  ],
  existingTeams: [
    {
      id: 'team-1',
      divisionId: 'division-1',
      name: 'Blue Jays',
      coach: 'Avery',
      email: 'avery@example.com',
      status: 'pending',
      paymentStatus: 'pending',
      depositPaid: 0,
      totalPaid: 0,
      waitlistPosition: null,
      adminNotes: null,
    },
  ],
};

function parsed(rows: Record<string, string>[]): ParsedImportFile {
  return {
    headers: [...TOURNAMENT_TEAM_IMPORT_HEADERS],
    rows: rows.map((values, index) => ({ rowNumber: index + 2, values })),
  };
}

describe('tournament team import preview', () => {
  it('classifies an update by Team ID and reports field changes', () => {
    const preview = buildTournamentTeamImportPreview(parsed([{
      'Team ID': 'team-1',
      'Team Name': 'Blue Jays',
      'Division ID': 'division-1',
      'Division Name': 'U11',
      'Coach Name': 'Morgan',
      Email: 'avery@example.com',
      Status: 'accepted',
      'Payment Status': 'pending',
      'Deposit Paid': '0',
      'Total Paid': '0',
      'Waitlist Position': '',
      'Admin Notes': '',
    }]), context, 'batch-1');

    assert.equal(preview.summary.updates, 1);
    assert.equal(preview.rows[0].operation, 'update');
    assert.deepEqual(preview.rows[0].changes.map(change => change.field), ['Coach Name', 'Status']);
  });

  it('matches by unique team name and division with a warning', () => {
    const preview = buildTournamentTeamImportPreview(parsed([{
      'Team ID': '',
      'Team Name': 'Blue Jays',
      'Division ID': 'division-1',
      'Division Name': 'U11',
      'Coach Name': 'Avery',
      Email: 'new@example.com',
      Status: 'pending',
      'Payment Status': 'pending',
      'Deposit Paid': '0',
      'Total Paid': '0',
      'Waitlist Position': '',
      'Admin Notes': '',
    }]), context, 'batch-1');

    assert.equal(preview.rows[0].operation, 'update');
    assert.equal(preview.rows[0].targetId, 'team-1');
    assert(preview.rows[0].warnings.some(warning => warning.includes('Matched existing team')));
  });

  it('blocks rows with invalid division and invalid status', () => {
    const preview = buildTournamentTeamImportPreview(parsed([{
      'Team ID': '',
      'Team Name': 'New Team',
      'Division ID': 'missing-division',
      'Division Name': '',
      'Coach Name': '',
      Email: '',
      Status: 'maybe',
      'Payment Status': 'pending',
      'Deposit Paid': '',
      'Total Paid': '',
      'Waitlist Position': '',
      'Admin Notes': '',
    }]), context, 'batch-1');

    assert.equal(preview.summary.blocked, 1);
    assert(preview.rows[0].errors.some(error => error.includes('Division ID')));
    assert(preview.rows[0].errors.some(error => error.includes('Status')));
  });

  it('blocks duplicate create rows in the same division', () => {
    const preview = buildTournamentTeamImportPreview(parsed([
      {
        'Team ID': '',
        'Team Name': 'New Team',
        'Division ID': 'division-2',
        'Division Name': 'U13',
        'Coach Name': '',
        Email: '',
        Status: 'accepted',
        'Payment Status': 'pending',
        'Deposit Paid': '',
        'Total Paid': '',
        'Waitlist Position': '',
        'Admin Notes': '',
      },
      {
        'Team ID': '',
        'Team Name': 'New Team',
        'Division ID': 'division-2',
        'Division Name': 'U13',
        'Coach Name': '',
        Email: '',
        Status: 'accepted',
        'Payment Status': 'pending',
        'Deposit Paid': '',
        'Total Paid': '',
        'Waitlist Position': '',
        'Admin Notes': '',
      },
    ]), context, 'batch-1');

    assert.equal(preview.summary.creates, 1);
    assert.equal(preview.summary.blocked, 1);
    assert(preview.rows[1].errors.some(error => error.includes('same Team Name')));
  });

  it('parses quoted CSV cells for preview input', () => {
    const parsedFile = parseCSV('Team Name,Division Name,Status\n"Comma, Team",U11,accepted\n', 10);
    assert.equal(parsedFile.rows[0].values['Team Name'], 'Comma, Team');
    assert.equal(parsedFile.rows[0].values['Division Name'], 'U11');
  });
});

const normalized = {
  teamId: '',
  teamName: 'New Team',
  divisionId: 'division-2',
  divisionName: 'U13',
  coachName: 'Coach',
  email: 'coach@example.com',
  status: 'accepted',
  paymentStatus: 'pending',
  depositPaid: 25,
  totalPaid: null,
  waitlistPosition: null,
  adminNotes: 'Imported',
} as const;

function storedRow(overrides: Partial<StoredTournamentTeamImportRow>): StoredTournamentTeamImportRow {
  return {
    id: 'row-1',
    row_number: 2,
    operation: 'create',
    target_id: null,
    normalized_json: normalized,
    before_json: null,
    errors_json: [],
    status: 'previewed',
    ...overrides,
  };
}

describe('tournament team import commit helpers', () => {
  it('prepares create, update, and unchanged rows without any delete operation', () => {
    const prepared = prepareTournamentTeamCommitRows([
      storedRow({ id: 'row-create', operation: 'create', target_id: null }),
      storedRow({ id: 'row-update', operation: 'update', target_id: 'team-1', before_json: { teamName: 'Old Team', divisionId: 'division-2' } }),
      storedRow({ id: 'row-unchanged', operation: 'unchanged', target_id: 'team-2' }),
    ]);

    assert.equal(prepared.createRows.length, 1);
    assert.equal(prepared.updateRows.length, 1);
    assert.equal(prepared.unchangedRows.length, 1);
    assert.deepEqual(summarizeTournamentTeamCommit(prepared), {
      created: 1,
      updated: 1,
      unchanged: 1,
      skipped: 1,
    });
  });

  it('rejects blocked rows before commit', () => {
    assert.throws(
      () => prepareTournamentTeamCommitRows([storedRow({ operation: 'blocked', errors_json: ['Division ID was not found.'] })]),
      (error: unknown) => error instanceof TournamentTeamImportCommitError && error.status === 409,
    );
  });

  it('rejects unsupported operations such as delete', () => {
    assert.throws(
      () => prepareTournamentTeamCommitRows([storedRow({ operation: 'delete' })]),
      (error: unknown) => error instanceof TournamentTeamImportCommitError && error.status === 409,
    );
  });

  it('maps normalized data to team insert and update payloads', () => {
    assert.deepEqual(buildTournamentTeamInsert(normalized, 'tournament-1', 'team-new'), {
      id: 'team-new',
      tournament_id: 'tournament-1',
      division_id: 'division-2',
      name: 'New Team',
      coach: 'Coach',
      email: 'coach@example.com',
      status: 'accepted',
      payment_status: 'pending',
      deposit_paid: 25,
      total_paid: null,
      waitlist_position: null,
      admin_notes: 'Imported',
    });
    assert.deepEqual(buildTournamentTeamUpdate(normalized), {
      division_id: 'division-2',
      name: 'New Team',
      coach: 'Coach',
      email: 'coach@example.com',
      status: 'accepted',
      payment_status: 'pending',
      deposit_paid: 25,
      total_paid: null,
      waitlist_position: null,
      admin_notes: 'Imported',
    });
  });
});
