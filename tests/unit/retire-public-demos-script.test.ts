/**
 * The one-off demo retirement script (Retire the public demos, Phase 2) deletes the two demo clubs by the SAME purge the
 * platform-admin delete runs, without calling the route (whose demo refusal stays until Phase 3). That promise holds only
 * while the script's table deletes and the route's match, so this pins them together: a table the route learns to clear
 * before the organization row must be cleared by the script too, in the same order.
 *
 * Retired with the script itself (Phase 3 deletes both).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readCode, functionBody } from './_source-code.ts';

const ROUTE = 'app/api/platform-admin/orgs/[id]/delete/route.ts';
const SCRIPT = 'scripts/retire-public-demos.mjs';

describe('retire-public-demos.mjs runs the console delete\'s purge', () => {
  const route = readCode(ROUTE);
  const script = readCode(SCRIPT);

  it('clears the same tables before the organization row, in the same order', () => {
    const del = route.slice(route.indexOf('export const DELETE'));
    const orgRow = del.search(/from\('organizations'\)\s*\.delete\(\)/);
    assert.ok(orgRow > 0, 'the route deletes the organization row');
    const routeTables = [...del.slice(0, orgRow).matchAll(/from\('([a-z_]+)'\)\.delete\(\)\.eq\('org_id', id\)/g)].map(m => m[1]);
    const list = /const ORG_PRE_DELETES = \[([^\]]*)\]/.exec(script)?.[1] ?? '';
    const scriptTables = [...list.matchAll(/'([a-z_]+)'/g)].map(m => m[1]);
    assert.ok(routeTables.length > 0, 'the route clears at least one table first');
    assert.deepEqual(scriptTables, routeTables);
  });

  it('runs the table deletes it lists, by the club\'s id', () => {
    assert.match(script, /for \(const table of ORG_PRE_DELETES\) \{\s*const \{ error \} = await db\.from\(table\)\.delete\(\)\.eq\('org_id', id\);/);
  });

  it('removes the club\'s stored files after its rows, through the shared helpers', () => {
    const purge = functionBody(script, 'purgeFiles');
    assert.ok(purge.indexOf('legacyKeysNoRowNames(') >= 0 && purge.indexOf('legacyKeysNoRowNames(') < purge.indexOf('removeOrgFiles({'),
      'a legacy rules file another club names is kept');
    assert.equal(script.split('removeOrgFiles({').length - 1, 1, 'files are removed only through purgeFiles');
    const orgRow = script.search(/from\('organizations'\)\.delete\(\)/);
    assert.ok(orgRow > 0 && orgRow < script.indexOf('purgeFiles(e.slug, id,'), 'files after the organization row');
  });

  it('never calls the console route, refuses before any change, and changes nothing without --apply', () => {
    assert.doesNotMatch(script, /orgs\/\[id\]\/delete|\/api\/platform-admin\/orgs/);
    const refused = script.indexOf('if (refusals.length)');
    const dryExit = script.indexOf('if (!apply)');
    assert.ok(refused > 0 && refused < dryExit, 'a refusal stops the run before the dry-run exit');
    assert.doesNotMatch(script.slice(0, dryExit), /\.delete\(\)|deleteUser\(|purgeFiles\(e\./, 'nothing is deleted before the dry-run exit');
  });

  it('finds the shared account through its club, never by listing every account (the production-read rule)', () => {
    assert.doesNotMatch(script, /listUsers\(/);
    assert.match(functionBody(script, 'accountById'), /toLowerCase\(\) === email/);
  });

  it('runs against production only with --prod, and dev only without it', () => {
    assert.match(script, /if \(wantProd && ref !== PROD_PROJECT_REF\)/);
    assert.match(script, /if \(!wantProd && ref !== DEV_PROJECT_REF\)/);
    assert.ok(script.indexOf('process.loadEnvFile(ENV_FILE)') < script.indexOf("import('../lib/supabase-admin.ts')"),
      'the env file is loaded before the admin client is built');
  });
});
