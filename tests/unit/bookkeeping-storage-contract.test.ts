import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { describe, it } from 'node:test';

const read = (file: string) => readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');

describe('Bookkeeping USD storage and recovery contract', () => {
  it('every expense insert and CSV includes source/rate, with NULL for older backup rows', () => {
    for (const file of ['lib/bookkeeping-store.ts', 'scripts/bookkeeping-backup.mjs', 'scripts/bookkeeping-seed-b2-qa.mjs']) {
      const code = read(file);
      assert.match(code, /conversion_source, conversion_rate/, file);
      assert.match(code, /row\.conversion_source \?\? null/, `${file}: older revisions remain valid`);
      assert.match(code, /row\.conversion_rate \?\? null/, `${file}: older revisions remain valid`);
    }
    for (const file of ['lib/bookkeeping-export.ts', 'scripts/bookkeeping-aws/schema.sql']) {
      assert.match(read(file), /conversion_source/);
      assert.match(read(file), /conversion_rate/);
    }
  });
  it('the additive migration never rewrites historical revisions', () => {
    const statements = read('scripts/bookkeeping-aws/005_conversion_source_rate.sql').replace(/^--.*$/gm, '').split(';').map(value => value.trim()).filter(Boolean);
    assert.equal(statements.length, 2);
    for (const sql of statements) assert.match(sql, /^ALTER TABLE bookkeeping\.expense_revisions ADD COLUMN IF NOT EXISTS conversion_(source|rate) /);
  });
  it('the migration runner refuses any other host before authenticating or connecting', () => {
    const result = spawnSync(process.execPath, ['scripts/bookkeeping-dsql-conversion-migration.mjs', 'apply'], {
      cwd: process.cwd(), encoding: 'utf8', env: { ...process.env, BOOKKEEPING_DSQL_ENDPOINT: 'another-host.invalid', BOOKKEEPING_DSQL_USERNAME: 'admin' },
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /restricted to the local development bookkeeping database/);
    assert.doesNotMatch(result.stderr, /CredentialsProviderError|PostgresError|ENOTFOUND/);
  });
});
