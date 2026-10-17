/**
 * THE PUBLIC STATS DOOR ANSWERS ONE PUBLIC TOURNAMENT'S COUNTS, AND NOTHING ELSE (security fix, 2026-10-16; the second
 * sweep's first finding). Anonymous `?teamId=x,id.not.is.null` returned every game in every organization: the team
 * branch built a PostgREST filter string from the raw parameter on a service-role client. No screen used it; it was
 * removed. These cases pin that it stays removed, that the counts are for one public tournament, and that no public
 * route builds a filter string from a template again.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { readCode } from './_source-code.ts';

const ROUTE = 'app/api/public/stats/route.ts';
const at = (src: string, needle: string) => { const i = src.indexOf(needle); assert.ok(i >= 0, `found: ${needle}`); return i; };

describe('the public stats door', () => {
  const route = readCode(ROUTE);

  it('has no team branch — no teamId, no games read', () => {
    assert.doesNotMatch(route, /teamId/);
    assert.doesNotMatch(route, /from\('games'\)/);
    assert.doesNotMatch(route, /\.or\(/);
  });

  it('serves counts only for one well-formed, public (active or completed) tournament, checked before the teams read', () => {
    const teamsRead = at(route, ".from('teams')");
    assert.ok(at(route, "if (!tournamentId || !isUuid(tournamentId)) return NextResponse.json({});") < teamsRead);
    assert.ok(at(route, "if (!tournament || (tournament.status !== 'active' && tournament.status !== 'completed')) {") < teamsRead);
    assert.match(route, /\.from\('teams'\)\s*\.select\('division_id, status'\)\s*\.eq\('tournament_id', tournamentId\);/);
  });

  it('its one caller asks for a tournament’s counts', () => {
    const page = readCode('components/public/RegisterContent.tsx');
    const calls = [...page.matchAll(/\/api\/public\/stats\?([a-z_]+)=/g)].map(m => m[1]);
    assert.deepEqual(calls, ['tournament_id']);
  });
});

describe('no public route builds a database filter string from a template', () => {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = path.join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (name === 'route.ts') files.push(p.split(path.sep).join('/'));
    }
  };
  walk('app/api/public');

  it('reads every public route', () => assert.ok(files.length >= 5, `found ${files.length} public routes`));

  for (const file of files) {
    it(file, () => {
      const src = readCode(file);
      assert.doesNotMatch(src, /\.(or|filter|not|match)\(\s*`[^`]*\$\{/, 'a PostgREST filter string built from a template');
    });
  }
});
