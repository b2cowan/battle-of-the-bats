import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseCSV } from '../../lib/import/csv.ts';
import { ImportParseError } from '../../lib/import/types.ts';

describe('tabular import parsing', () => {
  it('skips blank leading rows and blank records while preserving source row numbers', () => {
    const parsed = parseCSV('\r\nTeam Name,Division Name,Status\n,,\nBlue Jays,U11,accepted\n  , , \nRed Hawks,U11,pending', 10);

    assert.deepEqual(parsed.headers, ['Team Name', 'Division Name', 'Status']);
    assert.deepEqual(parsed.rows.map(row => row.rowNumber), [4, 6]);
    assert.equal(parsed.rows[0].values['Team Name'], 'Blue Jays');
    assert.equal(parsed.rows[1].values.Status, 'pending');
  });

  it('preserves escaped quotes and embedded line breaks inside quoted CSV cells', () => {
    const parsed = parseCSV('Name,Notes\r\n"Blue ""A"" Team","Line 1\r\nLine 2"\r\n', 10);

    assert.equal(parsed.rows[0].values.Name, 'Blue "A" Team');
    assert.equal(parsed.rows[0].values.Notes, 'Line 1\r\nLine 2');
  });

  it('rejects duplicate column headers after normalization', () => {
    assert.throws(
      () => parseCSV('Team Name,team_name\nBlue Jays,U11\n', 10),
      (error: unknown) => error instanceof ImportParseError && error.message.includes('Duplicate column header'),
    );
  });

  it('enforces data row limits after skipping blank rows', () => {
    assert.throws(
      () => parseCSV('Name\nAlpha\n\nBravo\n', 1),
      (error: unknown) => error instanceof ImportParseError && error.message.includes('limited to 1 data rows'),
    );
  });
});
