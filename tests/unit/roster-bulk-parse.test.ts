import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseCSV } from '../../lib/import/csv.ts';
import {
  parseRosterPaste,
  rowsFromParsedImportFile,
  validateDraftRoster,
  committableRows,
  MAX_BULK_ROSTER_ROWS,
} from '../../lib/coach-roster-bulk.ts';

describe('coach roster bulk — pasted lines', () => {
  it('reads a jersey number from the head or the tail of a line', () => {
    const rows = parseRosterPaste('12 Jordan Smith\nAvery Chen 8');

    assert.deepEqual(
      rows.map(r => [r.playerNumber, r.playerFirstName, r.playerLastName]),
      [['12', 'Jordan', 'Smith'], ['8', 'Avery', 'Chen']],
    );
  });

  it('accepts a name with no number, and a multi-word surname', () => {
    const rows = parseRosterPaste('Riley Novak\nMaria de la Cruz');

    assert.deepEqual(rows[0], { ...rows[0], playerNumber: '', playerFirstName: 'Riley', playerLastName: 'Novak' });
    assert.equal(rows[1].playerFirstName, 'Maria');
    assert.equal(rows[1].playerLastName, 'de la Cruz');
  });

  it('treats commas and tabs as columns, wherever the jersey sits', () => {
    const rows = parseRosterPaste('Jordan, Smith, 12\n8\tAvery\tChen');

    assert.deepEqual(rows[0].playerNumber, '12');
    assert.deepEqual([rows[0].playerFirstName, rows[0].playerLastName], ['Jordan', 'Smith']);
    assert.deepEqual(rows[1].playerNumber, '8');
    assert.deepEqual([rows[1].playerFirstName, rows[1].playerLastName], ['Avery', 'Chen']);
  });

  it('keeps a single-name line intact rather than inventing a surname', () => {
    const rows = parseRosterPaste('Pelé');

    assert.equal(rows[0].playerFirstName, 'Pelé');
    assert.equal(rows[0].playerLastName, '');
  });

  it('does not mistake a number inside a name for a jersey', () => {
    const rows = parseRosterPaste('Jordan Smith III');

    assert.equal(rows[0].playerNumber, '');
    assert.equal(rows[0].playerLastName, 'Smith III');
  });

  it('accepts alphanumeric jerseys like 00 and 12A', () => {
    const rows = parseRosterPaste('00 Sam Okafor\nDevon Reyes 12A');

    assert.equal(rows[0].playerNumber, '00');
    assert.equal(rows[1].playerNumber, '12A');
  });

  it('skips blank lines and numbers rows by position among the non-blank ones', () => {
    const rows = parseRosterPaste('Jordan Smith\n\n   \nAvery Chen');

    assert.deepEqual(rows.map(r => r.rowNumber), [1, 2]);
  });

  it('never captures contact details out of pasted prose', () => {
    const [row] = parseRosterPaste('Jordan Smith jordan@example.com 416-555-0134');

    assert.equal(row.guardianEmail, '');
    assert.equal(row.guardianPhone, '');
  });

  it('does not invent a player named after a number', () => {
    // "12 12" would otherwise peel the first token as a jersey and name the player "12".
    const rows = parseRosterPaste('12 12');

    assert.equal(rows[0].playerNumber, '12');
    assert.equal(rows[0].playerFirstName, '');
  });

  it('stops at the row ceiling', () => {
    const rows = parseRosterPaste(Array.from({ length: MAX_BULK_ROSTER_ROWS + 25 }, (_, i) => `Player ${i}`).join('\n'));

    assert.equal(rows.length, MAX_BULK_ROSTER_ROWS);
  });
});

describe('coach roster bulk — spreadsheet columns', () => {
  it('maps labelled columns through header aliases regardless of casing or punctuation', () => {
    const parsed = parseCSV(
      'First Name,Last Name,Jersey #,Parent Email,DOB\nJordan,Smith,12,parent@example.com,2012-04-03\n',
      50,
    );
    const [row] = rowsFromParsedImportFile(parsed);

    assert.equal(row.playerFirstName, 'Jordan');
    assert.equal(row.playerLastName, 'Smith');
    assert.equal(row.playerNumber, '12');
    assert.equal(row.guardianEmail, 'parent@example.com');
    assert.equal(row.playerDateOfBirth, '2012-04-03');
  });

  it('splits a single combined name column', () => {
    const parsed = parseCSV('Player,Number\nJordan Smith,12\n', 50);
    const [row] = rowsFromParsedImportFile(parsed);

    assert.equal(row.playerFirstName, 'Jordan');
    assert.equal(row.playerLastName, 'Smith');
  });

  it('leaves a blank last-name column blank instead of splitting the first name', () => {
    const parsed = parseCSV('First Name,Last Name\nJordan Smith,\n', 50);
    const [row] = rowsFromParsedImportFile(parsed);

    assert.equal(row.playerFirstName, 'Jordan Smith');
    assert.equal(row.playerLastName, '');
  });

  it('carries a position as free text without any sport vocabulary', () => {
    const parsed = parseCSV('First Name,Position\nJordan,Left Wing\n', 50);

    assert.equal(rowsFromParsedImportFile(parsed)[0].primaryPosition, 'Left Wing');
  });
});

describe('coach roster bulk — validation', () => {
  const existing = [
    { playerFirstName: 'Casey', playerLastName: 'Lin', playerNumber: '21' },
    { playerFirstName: 'Riley', playerLastName: 'Novak', playerNumber: null },
  ];

  it('blocks a row with no first name and lets every other row through', () => {
    // A line that is only a jersey number: kept so the coach is told, not silently dropped.
    const rows = validateDraftRoster(parseRosterPaste('Jordan Smith\n7'), existing);

    assert.deepEqual(rows[0].errors, []);
    assert.equal(rows[1].playerNumber, '7');
    assert.equal(rows[1].errors.length, 1);
    assert.equal(committableRows(rows).length, 1);
  });

  it('reads a leading separator as punctuation, not as the first name', () => {
    const [row] = validateDraftRoster(parseRosterPaste(', Bianchi'));

    assert.equal(row.playerFirstName, 'Bianchi');
    assert.deepEqual(row.errors, []);
  });

  it('flags a jersey used twice inside the same paste', () => {
    const rows = validateDraftRoster(parseRosterPaste('12 Jordan Smith\n12 Sam Okafor'));

    assert.ok(rows[0].warnings.some(w => w.includes('more than once')));
    assert.ok(rows[1].warnings.some(w => w.includes('more than once')));
  });

  it('flags a jersey already worn on the roster, and names who wears it', () => {
    const [row] = validateDraftRoster(parseRosterPaste('21 Devon Reyes'), existing);

    assert.ok(row.warnings.some(w => w.includes('already worn by Casey Lin')));
    assert.deepEqual(row.errors, []);
  });

  it('matches jersey clashes case-insensitively', () => {
    const [row] = validateDraftRoster(parseRosterPaste('12a Devon Reyes'), [
      { playerFirstName: 'Casey', playerLastName: 'Lin', playerNumber: '12A' },
    ]);

    assert.ok(row.warnings.some(w => w.includes('already worn by Casey Lin')));
  });

  it('flags a name already on the roster without blocking it', () => {
    const [row] = validateDraftRoster(parseRosterPaste('Riley Novak'), existing);

    assert.ok(row.warnings.some(w => w.includes('already on your roster')));
    assert.deepEqual(row.errors, []);
  });

  it('warns about a malformed email but still saves it as typed', () => {
    const rows = validateDraftRoster([
      { ...parseRosterPaste('Jordan Smith')[0], guardianEmail: 'not-an-email' },
    ]);

    assert.ok(rows[0].warnings.some(w => w.includes('doesn’t look right')));
    assert.equal(committableRows(rows).length, 1);
  });

  it('does not warn about jerseys when none are set', () => {
    const rows = validateDraftRoster(parseRosterPaste('Jordan Smith\nAvery Chen'), existing);

    assert.deepEqual(rows.flatMap(r => r.warnings), []);
  });
});
