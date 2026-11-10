import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/**
 * ONE WAY TO MAKE A LOGIN IN A SCRIPT OR A UAT SPEC (GST/HST Stage 6 step 6.3, Chunk C; owner-logged 2026-11-09).
 *
 * A fixture or seed account must record acceptance of the Terms, or it meets the sign-in screen once the legal pages are on.
 * That call used to be hand-placed beside ~30 `auth.admin.createUser(` sites, so a new seed could forget it silently. Now a
 * script makes its login through `ensureFixtureUser` (scripts/lib/fixture-user.mjs) and a UAT spec through `createFixtureUser`
 * (tests/uat/helpers/fixture-user.ts); both record acceptance as part of making the account. This test walks `scripts/` and
 * `tests/uat/` and fails when any other file calls `auth.admin.createUser(`. Staff and the two demo seeds are exempt
 * (`lib/legal-acceptance-exempt.ts`) and keep their own — listed below, each with its reason.
 *
 * The census keys on the NAMED call, asserts the list EXACTLY, and fails loudly when blind (the history-guard shape).
 */

const root = resolve(import.meta.dirname, '../..');
const read = (file: string) => readFileSync(resolve(root, file), 'utf8');
/** Code only: block and line comments removed (a `//` after a colon is a URL, not a comment). */
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(resolve(root, dir))) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const rel = `${dir}/${name}`;
    if (statSync(resolve(root, rel)).isDirectory()) walk(rel, out);
    else if (/\.(mjs|cjs|js|ts)$/.test(name)) out.push(rel);
  }
  return out;
}

const FILES = ['scripts', 'tests/uat'].flatMap(d => walk(d));
const sourceOf = new Map(FILES.map(f => [f, code(read(f))]));
const filesMatching = (re: RegExp) => FILES.filter(f => re.test(sourceOf.get(f)!)).sort();

// Whitespace-tolerant: a line-broken chain (`auth\n.admin\n.createUser(`) is still a createUser.
const CREATE_USER = /auth\s*\.\s*admin\s*\.\s*createUser\s*\(/;

const SCRIPT_CREATOR = 'scripts/lib/fixture-user.mjs';
const UAT_CREATOR = 'tests/uat/helpers/fixture-user.ts';
const CREATORS = [SCRIPT_CREATOR, UAT_CREATOR];
/** Staff and demo accounts never tick (`lib/legal-acceptance-exempt.ts`), so they keep their own `createUser`. */
const EXEMPT: Record<string, string> = {
  'scripts/seed-platform-staff.mjs': 'staff — exempt (R4)',
  'scripts/seed-demo-tournament.mjs': 'demo — exempt (R4)',
  'scripts/seed-demo-coach.mjs': 'demo — exempt (R4)',
};
const HOW = 'make the login through ensureFixtureUser (scripts) or createFixtureUser (UAT), so it records Terms acceptance — or list it as exempt (staff/demo only)';

describe('one way to make a login in a script or a UAT spec (6.3 Chunk C)', () => {
  it('is not blind: it walks scripts and UAT files, and finds both creators', () => {
    assert.ok(FILES.length > 50, `only ${FILES.length} files walked — the census is blind`);
    for (const creator of CREATORS) {
      assert.ok(FILES.includes(creator), `${creator} was not walked`);
      assert.match(sourceOf.get(creator)!, CREATE_USER,`${creator} no longer calls auth.admin.createUser( — the census would be blind to it`);
    }
  });

  it('every file that calls auth.admin.createUser( is a creator or on the exempt list, exactly', () => {
    const found = filesMatching(CREATE_USER);
    const allowed = [...CREATORS, ...Object.keys(EXEMPT)].sort();
    const stray = found.filter(f => !allowed.includes(f));
    assert.deepEqual(stray, [], `${stray.join(', ')} call auth.admin.createUser( directly: ${HOW}`);
    const gone = allowed.filter(f => !found.includes(f));
    assert.deepEqual(gone, [], `${gone.join(', ')} no longer call auth.admin.createUser( — remove them from this list so it stays exact`);
  });

  it('both creators record Terms acceptance, and the exempt files do not pretend to', () => {
    for (const creator of CREATORS) {
      assert.match(sourceOf.get(creator)!, /recordLegalAcceptance\(/, `${creator} must call recordLegalAcceptance( after it creates or finds the account`);
    }
    for (const file of Object.keys(EXEMPT)) {
      assert.ok(existsSync(resolve(root, file)), `${file} is listed as exempt (${EXEMPT[file]}) but does not exist`);
    }
  });

  it('every file importing a creator resolves it to the real creator file', () => {
    const importers: Array<{ file: string; name: string; creator: string }> = [];
    for (const file of FILES) {
      for (const m of sourceOf.get(file)!.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g)) {
        const names = m[1].split(',').map(s => s.trim().split(/\s+as\s+/)[0]);
        for (const name of ['ensureFixtureUser', 'createFixtureUser']) {
          if (names.includes(name)) importers.push({ file, name, creator: m[2] });
        }
      }
    }
    assert.ok(importers.length >= 25, `only ${importers.length} importers found — the census is blind`);
    for (const { file, name, creator } of importers) {
      assert.ok(creator.startsWith('.'), `${file} imports ${name} from '${creator}' — it must be a relative path to the creator`);
      const target = resolve(root, dirname(file), creator);
      const expected = name === 'ensureFixtureUser' ? SCRIPT_CREATOR : UAT_CREATOR;
      const hit = [target, `${target}.ts`, `${target}.mjs`].find(p => existsSync(p) && statSync(p).isFile());
      assert.ok(hit, `${file} imports ${name} from '${creator}', which does not exist`);
      assert.equal(join(hit!).split('\\').join('/'), resolve(root, expected).split('\\').join('/'), `${file} imports ${name} from the wrong file`);
    }
  });

  it('nothing outside the creators aliases the auth admin client (a createUser through an alias would slip the census)', () => {
    const aliasing = filesMatching(/=\s*\w+\.auth\.admin\b(?!\.)|\{\s*admin\s*\}\s*=\s*\w+\.auth\b/).filter(f => !CREATORS.includes(f));
    assert.deepEqual(aliasing, [], `${aliasing.join(', ')} alias the auth admin client: call auth.admin.* in place so the census can see it, or ${HOW}`);
  });
});
