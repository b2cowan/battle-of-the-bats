import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { shouldRefreshSnapshots } from '../../scripts/lib/migration-refresh-gate.mjs';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════
 * THE SNAPSHOT HOOK FIRES ON A MIGRATION AND NOTHING ELSE (2026-09-25,
 * docs/projects/active/DB_SNAPSHOT_REFRESH_LOAD_PLAN.md step 2).
 *
 * The previous hook trusted `"if": "Bash(*apply-migration-api*)"`, and that gate fails open: a
 * one-line `for` loop that only echoed fired a full dev+prod snapshot refresh, as did any command
 * that mentioned the script's name. Up to ~580 refreshes a day pinned both databases' CPU. These
 * cases are the ones that fooled it, plus the real applies it must still catch.
 * ══════════════════════════════════════════════════════════════════════════════════════════
 */

const ok = (target: 'dev' | 'prod', file = '310_example.sql') =>
  `\n📄 Applying ${file} to ${target} (ref)…\n\n✅ Migration applied successfully to ${target}.\n\n📌 Next: refresh snapshots…\n`;
const bash = (command: string, stdout: string) => ({
  tool_name: 'Bash',
  tool_input: { command },
  tool_response: { stdout, stderr: '', interrupted: false, isImage: false },
});

describe('the migration-refresh gate', () => {
  it('ignores a shell loop that applies nothing (the case the settings `if` let through)', () => {
    assert.equal(shouldRefreshSnapshots(bash('for i in 1; do echo "loop-test $i"; done', 'loop-test 1\n')), false);
  });

  it('ignores commands that only mention the script', () => {
    assert.equal(shouldRefreshSnapshots(bash('git log --format="%h %s" -S "apply-migration-api" -- .claude/settings.json', 'd7b965d4 chore(db): …\n')), false);
    assert.equal(shouldRefreshSnapshots(bash(`node scripts/db-query.mjs --dev -q "select 'apply-migration-api'"`, '[]\n')), false);
  });

  it('ignores a grep that quotes a whole invocation, because the source never holds the RENDERED success line', () => {
    const command = 'grep -rn "node scripts/apply-migration-api.mjs" scripts/apply-migration-api.mjs';
    const stdout = "110:  console.log(`✅ Migration applied successfully to ${target}.`);\n";
    assert.equal(shouldRefreshSnapshots(bash(command, stdout)), false);
  });

  it('ignores a failed apply', () => {
    const stdout = '\n📄 Applying 310_example.sql to dev (ref)…\n\n❌ Migration failed (HTTP 400):\n   syntax error\n';
    assert.equal(shouldRefreshSnapshots(bash('node scripts/apply-migration-api.mjs supabase/migrations/310_example.sql', stdout)), false);
  });

  it('fires on a real apply to dev or prod, however the command is written', () => {
    assert.equal(shouldRefreshSnapshots(bash('node scripts/apply-migration-api.mjs supabase/migrations/310_example.sql', ok('dev'))), true);
    assert.equal(shouldRefreshSnapshots(bash('cd "C:/Users/me/tournament-website" && node scripts/apply-migration-api.mjs supabase/migrations/310_example.sql --prod', ok('prod'))), true);
    assert.equal(shouldRefreshSnapshots(bash('node --env-file=.env.local ./scripts/apply-migration-api.mjs x.sql', ok('dev'))), true);
    assert.equal(shouldRefreshSnapshots({ tool_name: 'PowerShell', tool_input: { command: 'node .\\scripts\\apply-migration-api.mjs supabase\\migrations\\310_example.sql --prod' }, tool_response: ok('prod') }), true);
  });

  it('fires on a loop that applies migrations — a loop is not the problem, a loop that applies nothing is', () => {
    const command = 'for f in supabase/migrations/310_*.sql supabase/migrations/311_*.sql; do node scripts/apply-migration-api.mjs "$f"; done';
    assert.equal(shouldRefreshSnapshots(bash(command, ok('dev', '310_a.sql') + ok('dev', '311_b.sql'))), true);
  });

  it('never throws on a payload it does not recognise', () => {
    assert.equal(shouldRefreshSnapshots(undefined as never), false);
    assert.equal(shouldRefreshSnapshots({} as never), false);
    assert.equal(shouldRefreshSnapshots({ tool_input: { command: 'node scripts/apply-migration-api.mjs x.sql' } }), false);
  });
});
