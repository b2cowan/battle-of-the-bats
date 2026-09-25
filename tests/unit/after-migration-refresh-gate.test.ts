import assert from 'node:assert/strict';
import os from 'node:os';
import { describe, it } from 'node:test';
import { shouldRefreshSnapshots, appliedStampPath } from '../../scripts/lib/migration-refresh-gate.mjs';

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

  // ── the /review findings (2026-09-25) ────────────────────────────────────────────────────────

  it('fires on a path with a space or a capitalised folder (the second machine keeps the repo under "Robert Cowan")', () => {
    assert.equal(shouldRefreshSnapshots(bash('node "C:\\Users\\Robert Cowan\\Documents\\tournament-website\\scripts\\apply-migration-api.mjs" x.sql --prod', ok('prod'))), true);
    assert.equal(shouldRefreshSnapshots({ tool_name: 'PowerShell', tool_input: { command: '& node "C:\\Users\\Robert Cowan\\Documents\\tournament-website\\scripts\\apply-migration-api.mjs" x.sql' }, tool_response: ok('dev') }), true);
    assert.equal(shouldRefreshSnapshots(bash('node Scripts\\apply-migration-api.mjs x.sql', ok('dev'))), true);
  });

  it('stays instant on any command — it runs after every loop command in every session', () => {
    // The old flag-group pattern backtracked exponentially here: 22 flags took 640 ms, ~30 would hang
    // the agent for the hook's whole 180 s timeout.
    const flags = Array.from({ length: 60 }, (_, i) => `--flag${i}=v${i}`).join(' ');
    const long = [
      `node ${flags} scripts/apply-migration-api-old.mjs`,
      `for i in $(seq 1 50); do node ${flags} scripts/other.mjs; done`,
      'node '.repeat(5000) + 'apply-migration-api',
    ];
    for (const command of long) {
      const t = performance.now();
      assert.equal(shouldRefreshSnapshots(bash(command, '')), false);
      assert.ok(performance.now() - t < 50, `took ${Math.round(performance.now() - t)} ms: ${command.slice(0, 60)}…`);
    }
  });

  it('fires on the success STAMP when the agent trimmed or redirected the output that carries the line', () => {
    const trimmed = bash('node scripts/apply-migration-api.mjs x.sql --prod | tail -3', '     • node scripts/check-prod-migration-drift.mjs …\n     • update docs/agents/db/DATA_DICTIONARY.md …\n');
    const redirected = bash('node scripts/apply-migration-api.mjs x.sql > apply.log', '');
    assert.equal(shouldRefreshSnapshots(trimmed), false, 'without the stamp the trimmed output proves nothing');
    assert.equal(shouldRefreshSnapshots(trimmed, { appliedStamp: true }), true);
    assert.equal(shouldRefreshSnapshots(redirected, { appliedStamp: true }), true);
  });

  it('never fires on the stamp alone — the command must still be an apply', () => {
    assert.equal(shouldRefreshSnapshots(bash('for i in 1; do echo x; done', 'x\n'), { appliedStamp: true }), false);
    assert.equal(shouldRefreshSnapshots(bash('git log -S "apply-migration-api"', ''), { appliedStamp: true }), false);
  });

  it('keys the stamp per checkout, in the temp dir, whatever the path casing', () => {
    assert.equal(appliedStampPath('/work/Tournament-Website'), appliedStampPath('/work/tournament-website'));
    assert.notEqual(appliedStampPath('/work/tournament-website'), appliedStampPath('/work/other-checkout'));
    assert.ok(appliedStampPath('/work/x').startsWith(os.tmpdir()));
  });
});
