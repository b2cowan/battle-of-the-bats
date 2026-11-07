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
  it('every column schema.sql declares is written by the app insert and by the backup restore insert (GST/HST 4a)', () => {
    const schema = read('scripts/bookkeeping-aws/schema.sql');
    const columns = (table: string) => {
      const body = schema.match(new RegExp(`CREATE TABLE bookkeeping\\.${table} \\(([\\s\\S]*?)\\n\\);`))![1];
      return body.split('\n').map(line => line.trim()).filter(line => /^[a-z_]+ /.test(line) && !/^(PRIMARY|CHECK)\b/.test(line))
        .map(line => line.split(' ')[0]);
    };
    const insertColumns = (code: string, table: string) => [...code.matchAll(new RegExp(`INSERT INTO [^(]*${table}[^(]* \\(([^)]*)\\)`, 'g'))]
      .map(match => match[1].split(',').map(name => name.trim()));
    const expenseColumns = columns('expense_revisions');
    for (const required of ['tax_answer', 'supplier_tax_number', 'supplier_registration', 'purchase_kind', 'number_unobtainable']) {
      assert.ok(expenseColumns.includes(required), `schema.sql lists ${required}`);
    }
    const store = read('lib/bookkeeping-store.ts');
    const [appInsert] = insertColumns(store, 'expense_revisions');
    // created_at is the database's own clock for a new revision; only a restore writes it.
    assert.deepEqual(expenseColumns.filter(column => column !== 'created_at' && !appInsert.includes(column)), [], 'app insert');
    const backup = read('scripts/bookkeeping-backup.mjs');
    const [restoreInsert] = [...backup.matchAll(/INSERT INTO \$\{sql\('bookkeeping'\)\}\.\$\{sql\(table\)\} \(([^)]*)\)/g)].map(match => match[1].split(',').map(name => name.trim()));
    assert.deepEqual(expenseColumns.filter(column => !restoreInsert.includes(column)), [], 'restore insert');
    for (const column of ['tax_answer', 'supplier_tax_number', 'supplier_registration', 'purchase_kind', 'number_unobtainable']) {
      for (const [file, code] of [['lib/bookkeeping-store.ts', store], ['scripts/bookkeeping-backup.mjs', backup], ['scripts/bookkeeping-seed-b2-qa.mjs', read('scripts/bookkeeping-seed-b2-qa.mjs')]]) {
        assert.match(code, new RegExp(`row\\.${column} \\?\\? null`), `${file}: ${column} is NULL for an older revision or archive`);
      }
    }
    const lineColumns = columns('expense_tax_lines');
    assert.deepEqual(lineColumns, ['expense_id', 'revision', 'line_no', 'tax_type', 'cents', 'created_at']);
    assert.match(backup, /\(expense_id, revision, line_no, tax_type, cents, created_at\)/);
    assert.deepEqual(columns('gst_registration_revisions'), ['revision', 'effective_date', 'reason', 'created_at', 'created_by']);
    assert.match(backup, /\(revision, effective_date, reason, created_at, created_by\)/);
    // The lines are written with their revision in ONE transaction, by the app and by every script that writes one.
    assert.match(store, /db\(\)\.begin\(async tx => \{[\s\S]*INSERT INTO bookkeeping\.expense_revisions[\s\S]*INSERT INTO bookkeeping\.expense_tax_lines/);
    for (const file of ['scripts/bookkeeping-dsql-smoke.mjs', 'scripts/bookkeeping-restore-drill.mjs', 'scripts/bookkeeping-seed-b2-qa.mjs']) {
      assert.match(read(file), /begin\(async tx => \{[\s\S]*expense_revisions[\s\S]*expense_tax_lines/, file);
    }
  });
  it('a backup carries the tax lines and registration history, and checks the sum rule', () => {
    const backup = read('scripts/bookkeeping-backup.mjs');
    for (const type of ['tax_line', 'gst_registration_revision']) assert.match(backup, new RegExp(`type: '${type}'`));
    assert.match(backup, /format: 3/);
    assert.match(backup, /\[1, 2, 3\]\.includes\(item\.format\)/, 'older archives still verify');
    // A record type accepted from format N must stay accepted from every later format (format 3 once rejected owner transfers).
    assert.doesNotMatch(backup, /meta\.format === \d/, 'record types are gated with >=, never ===');
    assert.match(backup, /Tax lines do not add up to their revision/);
    assert.match(backup, /total === undefined && row\.tax_answer === 'shown'/, 'an archive that lost a receipt’s tax lines does not verify');
    const store = read('lib/bookkeeping-store.ts');
    assert.match(store, /row\.tax_answer === 'shown' && !lines\.length/, 'the store refuses a shown answer with no lines');
    assert.match(backup, /registrationsToRestore/, 'the migration-seeded revision 1 does not block a restore');
  });
  it('migration 006 only adds: columns, two tables and the one seed revision', () => {
    const statements = read('scripts/bookkeeping-aws/006_gst_tax_lines.sql').replace(/^--.*$/gm, '').split(';').map(value => value.trim()).filter(Boolean);
    for (const sql of statements) assert.match(sql, /^(ALTER TABLE bookkeeping\.expense_revisions ADD COLUMN IF NOT EXISTS |CREATE TABLE IF NOT EXISTS |REVOKE ALL |GRANT SELECT, INSERT |INSERT INTO bookkeeping\.gst_registration_revisions )/);
    assert.doesNotMatch(read('scripts/bookkeeping-aws/006_gst_tax_lines.sql'), /\b(UPDATE|DELETE|DROP)\b/);
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
