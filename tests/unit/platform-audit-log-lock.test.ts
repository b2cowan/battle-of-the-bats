/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE CHANGE LOG CANNOT BE EDITED OR DELETED (Plans & pricing Stage 0, O11; owner ruling 2026-11-02; migration 429).
 *
 * "Refuse every edit except the blanking (a deleted club's lines lose the club), and refuse deletes. A future privacy
 * erasure would then need the lock lifted on purpose."
 *
 * The lock itself is a database trigger, invisible to the drift check; scripts/platform-audit-log-lock-check.sql proves
 * it on dev. This guard holds the parts a build can see:
 *   1. Migration 429 creates the row trigger and its function, with the exception written as "only org_id, only to
 *      NULL", plus the TRUNCATE refusal. The refusal lives in the trigger, not in a revoke.
 *   2. No code updates, deletes or upserts a line (through the Data API or in raw SQL), so a future writer fails the
 *      build instead of failing in production.
 *   3. A later migration that changes or removes lines lifts the lock on purpose: it disables the trigger and turns it
 *      back on in the same file.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { readCode, readSource, filesUnder } from './_source-code.ts';

const MIGRATION = 'supabase/migrations/429_the_change_log_cannot_be_edited.sql';
const LOCK_NUMBER = 429;

/** SQL with its block and `--` comments removed (a `--` inside a string literal would cut its line: write none). */
const sqlCode = (rel: string) =>
  readSource(rel).replace(/\/\*[\s\S]*?\*\//g, ' ').split('\n').map((l) => l.replace(/--.*$/, '')).join('\n');

describe('migration 429: the change log is append-only', () => {
  const sql = sqlCode(MIGRATION);

  it('creates the refusing function, with no SECURITY DEFINER (it only refuses)', () => {
    assert.match(sql, /CREATE OR REPLACE FUNCTION public\.platform_audit_log_refuse_change\(\)/);
    assert.match(sql, /SET search_path = public/);
    assert.doesNotMatch(sql, /SECURITY DEFINER/);
    assert.match(sql, /REVOKE ALL ON FUNCTION public\.platform_audit_log_refuse_change\(\) FROM PUBLIC, anon, authenticated;/);
  });

  it('refuses every UPDATE and DELETE, row by row', () => {
    assert.match(sql, /CREATE TRIGGER platform_audit_log_append_only\s+BEFORE UPDATE OR DELETE ON public\.platform_audit_log\s+FOR EACH ROW EXECUTE FUNCTION public\.platform_audit_log_refuse_change\(\);/);
  });

  it('keeps ONE exception: only org_id, only to NULL', () => {
    assert.match(sql, /OLD\.org_id IS NOT NULL AND NEW\.org_id IS NULL\s+AND \(to_jsonb\(NEW\) - 'org_id'\) = \(to_jsonb\(OLD\) - 'org_id'\)/);
    // the exception is the only path that lets an UPDATE through
    assert.equal((sql.match(/RETURN NEW;/g) ?? []).length, 1);
    assert.equal((sql.match(/RAISE EXCEPTION/g) ?? []).length, 2);
  });

  it('refuses TRUNCATE (a delete of every line) and takes it from anon and authenticated', () => {
    assert.match(sql, /CREATE TRIGGER platform_audit_log_no_truncate\s+BEFORE TRUNCATE ON public\.platform_audit_log\s+FOR EACH STATEMENT/);
    assert.match(sql, /REVOKE TRUNCATE ON public\.platform_audit_log FROM anon, authenticated;/);
  });

  it('leaves the service role its grants: the trigger is the one place the refusal lives', () => {
    assert.doesNotMatch(sql, /REVOKE[^;]*(UPDATE|DELETE|ALL)[^;]*ON (TABLE )?public\.platform_audit_log\b/i);
  });
});

/**
 * Every `.from('platform_audit_log')` chain in the code, up to the end of its statement. A text scan, so it sees the
 * table named LITERALLY at the call: a name held in a constant is refused below so this scan can always see the call.
 * Its known blind spot is a builder kept in a variable and written to later; the trigger refuses that one at run time
 * (on dev too, so it fails in the first test, not in production).
 */
const CODE_EXT = ['.ts', '.tsx', '.mjs', '.js', '.cjs'];
const CODE_DIRS = ['app', 'lib', 'scripts', 'components', 'hooks'];
const codeFiles = () => CODE_DIRS
  .filter((dir) => existsSync(path.join(import.meta.dirname, '..', '..', dir)))
  .flatMap((dir) => CODE_EXT.flatMap((ext) => filesUnder(dir, ext)));

describe('no code edits or deletes a line', () => {
  const chains: { file: string; chain: string }[] = [];
  const rawSql: string[] = [];
  const constants: string[] = [];
  for (const file of codeFiles()) {
    const code = readCode(file);
    if (/=\s*['"`](public\.)?platform_audit_log['"`]/.test(code)) constants.push(file);
    for (const m of code.matchAll(/\.from\(\s*['"`]platform_audit_log['"`]\s*\)/g)) {
      const rest = code.slice(m.index);
      const end = rest.indexOf(';');
      chains.push({ file, chain: rest.slice(0, end === -1 ? 800 : Math.min(end, 800)) });
    }
    if (/\b(UPDATE|DELETE\s+FROM|TRUNCATE(\s+TABLE)?)\s+(public\.)?platform_audit_log\b/i.test(code)) rawSql.push(file);
  }

  it('finds the known writers (the scan is not vacuous)', () => {
    const inserts = chains.filter((c) => /\.insert\(/.test(c.chain)).map((c) => c.file);
    assert.ok(inserts.includes('lib/platform-audit.ts'), 'lib/platform-audit.ts inserts');
    assert.ok(inserts.includes('lib/billing-retention.ts'), 'lib/billing-retention.ts inserts');
  });

  it('no .update( / .delete( / .upsert( on the table', () => {
    const writers = chains.filter((c) => /\.(update|delete|upsert)\(/.test(c.chain)).map((c) => c.file);
    assert.deepEqual(writers, [], `the change log is append-only (migration ${LOCK_NUMBER}); these would be refused in production`);
  });

  it('no raw UPDATE / DELETE / TRUNCATE of the table in code', () => {
    assert.deepEqual(rawSql, []);
  });

  it('the table is named literally at each call, never through a constant (so the scan above sees every call)', () => {
    assert.deepEqual(constants, []);
  });
});

describe('a later migration lifts the lock on purpose', () => {
  it('any migration after 429 that changes or removes lines disables and re-enables the trigger in the same file', () => {
    const later = readdirSync(path.join(import.meta.dirname, '..', '..', 'supabase', 'migrations'))
      .filter((f) => /^\d+_.*\.sql$/.test(f) && Number(f.split('_')[0]) > LOCK_NUMBER);
    for (const f of later) {
      const sql = sqlCode(`supabase/migrations/${f}`);
      if (!/\b(UPDATE|DELETE\s+FROM)\s+(public\.)?platform_audit_log\b/i.test(sql)) continue;
      assert.match(sql, /DISABLE TRIGGER platform_audit_log_append_only/, `${f} edits the change log without lifting the lock`);
      assert.match(sql, /ENABLE TRIGGER platform_audit_log_append_only/, `${f} lifts the lock and never puts it back`);
    }
  });
});
