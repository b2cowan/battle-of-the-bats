/**
 * THE RULES SCREEN'S FILE STORE TAKES NO BROWSER WRITES (Board Ready W2 fix B, the third access sweep's finding 2,
 * 2026-11-11).
 *
 * The public `resources` bucket granted INSERT and DELETE to any signed-in account (mig 087, kept by mig 311 because the
 * Rules screen wrote from the browser), with flat, listable keys: any account could delete any club's rules file or replace
 * one under the same name. The fix is three parts, and this guard pins each so none can quietly go back:
 *   1. No app, component or lib code touches the `resources` storage bucket — the one route does, with the service role.
 *   2. That route asks the club AND `post_rules` on both verbs, and its delete takes the ROW id (never a path from the
 *      caller), refuses a key outside the caller's club folder, and keeps a file another row still names.
 *   3. Migration 462 drops both authenticated write policies, and no later migration puts a write policy back.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { filesUnder, readCode, readSource } from './_source-code.ts';
import {
  isClubKey, keySpellings, mayRemoveKey, resourceKeyFromUrl, resourceObjectPath, cleanResourceFileName,
  resourceLabelProblem, resourceLinkProblem,
} from '../../lib/resource-file-storage.ts';

const REPO = path.join(import.meta.dirname, '..', '..');
const ROUTE = 'app/api/admin/resources/file/route.ts';

/** A browser-or-server module reaching the bucket through any storage client. */
const TOUCHES_BUCKET = /\bstorage\s*\.from\(\s*(?:['"`]resources['"`]|RESOURCE_BUCKET)\s*\)/;

export function filesTouchingTheBucket(files: Record<string, string>): string[] {
  return Object.entries(files).filter(([, code]) => TOUCHES_BUCKET.test(code)).map(([f]) => f);
}

/** Splits the route into its two verbs' text. */
export function verbs(code: string): { post: string; del: string } {
  const d = code.search(/export const DELETE\b/);
  const p = code.search(/export const POST\b/);
  if (d < 0 || p < 0) throw new Error('the route lost a verb');
  return p < d ? { post: code.slice(p, d), del: code.slice(d) } : { post: code.slice(p), del: code.slice(d, p) };
}

/** What a verb must ask before it writes. */
export function missingChecks(verb: string): string[] {
  const need: Array<[string, RegExp]> = [
    ['the club (getAuthContextWithScope, org required)', /getAuthContextWithScope\(\{[^}]*requireOrgSlug:\s*true/],
    ['the post_rules capability', /hasCapability\([^)]*'post_rules'\)/],
    ['the event scope (scopeGuard)', /scopeGuard\(/],
    ['the event belongs to the club (requireTournamentInOrg)', /requireTournamentInOrg\(/],
  ];
  return need.filter(([, re]) => !re.test(verb)).map(([name]) => name);
}

describe('no client reaches the resources bucket', () => {
  const files: Record<string, string> = {};
  for (const dir of ['app', 'components', 'lib']) {
    for (const ext of ['.ts', '.tsx']) {
      for (const f of filesUnder(dir, ext)) if (f !== ROUTE) files[f] = readCode(f);
    }
  }

  it('finds no storage client on the bucket outside the route', () => {
    assert.deepEqual(filesTouchingTheBucket(files), []);
  });

  it('the route itself does use the bucket (so the scan is looking at something)', () => {
    const code = readCode(ROUTE);
    assert.match(code, /RESOURCE_BUCKET as BUCKET/);
    assert.match(code, /storage\.from\(BUCKET\)/);
  });

  it('kill test: a browser upload or remove on the bucket is caught', () => {
    assert.deepEqual(filesTouchingTheBucket({ a: `await authClient().storage.from('resources').remove([k]);` }), ['a']);
    assert.deepEqual(filesTouchingTheBucket({ a: `supabase.storage\n  .from("resources")\n  .upload(p, f)` }), ['a']);
    assert.deepEqual(filesTouchingTheBucket({ a: `client.storage.from(RESOURCE_BUCKET).remove([k])` }), ['a']);
    assert.deepEqual(filesTouchingTheBucket({ a: `client.from('resources').select('*')` }), [], 'the TABLE is a different thing');
  });
});

describe('the route checks the club and the capability on both verbs', () => {
  const code = readCode(ROUTE);
  const { post, del } = verbs(code);

  it('upload asks everything', () => assert.deepEqual(missingChecks(post), []));

  it('delete asks the capability and the club (the event comes from the ROW)', () => {
    assert.deepEqual(missingChecks(del), []);
  });

  it('delete takes the row id, never a path or an address from the caller', () => {
    assert.match(del, /resourceId/);
    assert.doesNotMatch(del, /body\?\.(?:path|key|url|fileName)\b/);
  });

  it('delete refuses a key outside the club folder and keeps a file another row still names', () => {
    assert.match(del, /mayRemoveKey\(\s*key,\s*ctx\.org\.id,\s*row\.created_at/);
    assert.match(del, /keyStillNamed\(\s*key,\s*ctx\.org\.id\s*\)/);
    assert.match(code, /import \{ keyStillNamed \} from '@\/lib\/resource-file-server'/);
    // The lookup's single home since the club delete shares it (Board Ready Stage 0a).
    const named = readCode('lib/resource-file-server.ts');
    assert.match(named, /count:\s*'exact'/);
    assert.match(named, /\.like\('url'/);
    assert.match(named, /if \(error\) return 'unread';\s*if \(count\) return 'named';/);
    assert.match(named, /return \(await keyNamedState\(key, orgId\)\) !== 'free';/, 'a lookup that fails keeps the file');
  });

  it('upload files under the club and event, with a random name', () => {
    assert.match(post, /resourceObjectPath\(\s*ctx\.org\.id,\s*tournamentId,\s*randomUUID\(\)/);
  });

  it('upload accepts only the bucket’s types and size', () => {
    assert.match(post, /RESOURCE_ALLOWED_MIME\.includes\(file\.type\)/);
    assert.match(post, /file\.size\s*>\s*RESOURCE_MAX_BYTES/);
  });

  it('kill test: a verb missing a check is named', () => {
    assert.deepEqual(missingChecks(post.replace(/hasCapability\([^)]*\)/, 'true')), ['the post_rules capability']);
    assert.deepEqual(missingChecks(post.replace(/requireTournamentInOrg\(/, 'noop(')), ['the event belongs to the club (requireTournamentInOrg)']);
    assert.deepEqual(missingChecks(post.replace('requireOrgSlug: true', 'requireOrgSlug: false')), ['the club (getAuthContextWithScope, org required)']);
  });
});

/**
 * THE LINK ROWS TOO (W2 fix B follow-up). The `resources` TABLE was written from the browser under a policy that asked only
 * "member of the club, in scope" — a capability-less coach row could rewrite the public Rules page's links. A browser-side
 * client (anything but the service-role client) must never insert, update, upsert or delete the table.
 */
const BROWSER_ROW_WRITE = /(?:authClient\(\)|\bclient|\bsupabase|\bsb)\s*\.from\(\s*['"`]resources['"`]\s*\)\s*\.(?:insert|update|upsert|delete)\b/;
export function filesWritingRowsFromTheBrowser(files: Record<string, string>): string[] {
  return Object.entries(files).filter(([, code]) => BROWSER_ROW_WRITE.test(code)).map(([f]) => f);
}

describe('no client writes the link rows', () => {
  const files: Record<string, string> = {};
  for (const dir of ['app', 'components', 'lib']) {
    for (const ext of ['.ts', '.tsx']) for (const f of filesUnder(dir, ext)) files[f] = readCode(f);
  }
  it('finds no browser-side insert, update or delete of the resources table', () => {
    assert.deepEqual(filesWritingRowsFromTheBrowser(files), []);
  });
  it('kill test: a browser write is caught, the service-role client is not', () => {
    assert.deepEqual(filesWritingRowsFromTheBrowser({ a: "await authClient().from('resources').insert({})" }), ['a']);
    assert.deepEqual(filesWritingRowsFromTheBrowser({ a: "await client.from('resources').update({ display_order: 1 })" }), ['a']);
    assert.deepEqual(filesWritingRowsFromTheBrowser({ a: "await supabaseAdmin.from('resources').insert(rows)" }), []);
    assert.deepEqual(filesWritingRowsFromTheBrowser({ a: "await supabase.from('resources').select('*')" }), []);
  });
  it('the row route asks the club and post_rules on both verbs, and checks every row it touches', () => {
    const code = readCode('app/api/admin/resources/route.ts');
    assert.match(code, /getAuthContextWithScope\(\{[^}]*requireOrgSlug:\s*true/);
    assert.match(code, /hasCapability\([^)]*'post_rules'\)/);
    assert.match(code, /export const POST\b/);
    assert.match(code, /export const PATCH\b/);
    assert.equal((code.match(/requireTournamentInOrg\(/g) ?? []).length >= 3, true, 'create, one-row update and reorder each check the event');
    assert.equal((code.match(/scopeGuard\(/g) ?? []).length >= 3, true);
    assert.match(code, /resourceLinkProblem\(/);
    assert.match(code, /resourceLabelProblem\(/);
  });
  it('the db helpers call the row route, not the table', () => {
    const db = readCode('lib/db.ts');
    assert.match(db, /\/api\/admin\/resources\?orgSlug=/);
  });
  it('migration 465 takes the table’s write grants from signed-in accounts and leaves SELECT alone', () => {
    const f = readdirSync(path.join(REPO, 'supabase/migrations')).find(n => n.startsWith('465_'));
    assert.ok(f, 'migration 465 exists');
    const sql = readSource(`supabase/migrations/${f}`).replace(/--.*$/gm, '');
    assert.match(sql, /revoke insert, update, delete on public\.resources from authenticated/i);
    assert.doesNotMatch(sql, /revoke[^;]*\bselect\b/i);
  });
});

describe('what a link may say', () => {
  const HOST = 'https://abc.supabase.co';
  const ORG = '11111111-1111-4111-8111-111111111111';
  const OTHER = '22222222-2222-4222-8222-222222222222';
  it('accepts the placeholder, web addresses and email links', () => {
    for (const u of ['#', 'https://example.com/a', 'http://example.com', 'mailto:rules@example.com']) assert.equal(resourceLinkProblem(u, ORG, HOST), null, u);
  });
  it('refuses code, data, bare words and nothing', () => {
    for (const u of ['javascript:alert(1)', 'data:text/html,x', 'www.example.com', '', '   ', 'ftp://x.com', 5, null]) assert.notEqual(resourceLinkProblem(u, ORG, HOST), null, String(u));
  });
  it('a file address must be in the caller’s own club folder', () => {
    const f = (o: string) => `${HOST}/storage/v1/object/public/resources/${o}/T/x.pdf`;
    assert.equal(resourceLinkProblem(f(ORG), ORG, HOST), null);
    assert.notEqual(resourceLinkProblem(f(OTHER), ORG, HOST), null);
    assert.notEqual(resourceLinkProblem(`${HOST}/storage/v1/object/public/resources/1699-flat.pdf`, ORG, HOST), null, 'a NEW row cannot name an old flat file');
  });
  it('a name must be text and not empty', () => {
    assert.equal(resourceLabelProblem('Rulebook'), null);
    for (const l of ['', '  ', undefined, 5, 'x'.repeat(201)]) assert.notEqual(resourceLabelProblem(l), null);
  });
});

describe('the Rules screen goes through the route', () => {
  const db = readCode('lib/db.ts');
  it('the db helpers call the route, not the storage client', () => {
    assert.match(db, /\/api\/admin\/resources\/file\?orgSlug=/);
  });
  it('the file record passes the club on', () => {
    const rr = readCode('app/[orgSlug]/admin/tournaments/rules/ResourceRecord.tsx');
    assert.match(rr, /uploadResourceFile\(file,\s*tournamentId,\s*orgSlug\)/);
    assert.match(rr, /deleteResource\(resource\.id,\s*orgSlug\)/);
  });
});

describe('the migrations close the bucket and keep it closed', () => {
  const dir = path.join(REPO, 'supabase/migrations');
  const mig462 = readdirSync(dir).find(f => f.startsWith('462_'));

  it('migration 462 drops both write policies and keeps the public read', () => {
    assert.ok(mig462, 'migration 462 exists');
    const sql = readSource(`supabase/migrations/${mig462}`).replace(/--.*$/gm, '');
    assert.match(sql, /drop policy if exists "Authenticated users can upload resources" on storage\.objects/i);
    assert.match(sql, /drop policy if exists "Authenticated users can delete resources" on storage\.objects/i);
    assert.doesNotMatch(sql, /Public can read resources/);
  });

  it('no migration after 462 creates a write policy for the bucket', () => {
    const later = readdirSync(dir).filter(f => /^\d{3}_.*\.sql$/.test(f) && Number(f.slice(0, 3)) > 462);
    for (const f of later) {
      const sql = readSource(`supabase/migrations/${f}`).replace(/--.*$/gm, '');
      for (const stmt of sql.split(';')) {
        if (/create policy/i.test(stmt) && /storage\.objects/i.test(stmt) && /'resources'/.test(stmt) && /for\s+(insert|update|delete|all)/i.test(stmt)) {
          assert.fail(`${f} creates a write policy on the resources bucket`);
        }
      }
    }
  });
});

describe('the pure rules', () => {
  const ORG = '11111111-1111-4111-8111-111111111111';
  const OTHER = '22222222-2222-4222-8222-222222222222';
  const HOST = 'https://abc.supabase.co';
  const pub = (key: string) => `${HOST}/storage/v1/object/public/resources/${key}`;

  it('a new file is filed under the club and event with a random name', () => {
    assert.equal(resourceObjectPath(ORG, 'T1', 'uuid-1', 'Rule book (v2).pdf'), `${ORG}/T1/uuid-1-Rule_book_v2.pdf`);
    assert.equal(cleanResourceFileName('../../etc/passwd'), 'etcpasswd');
    assert.equal(cleanResourceFileName('///'), 'file');
  });

  it('looks for both spellings of an address', () => {
    assert.deepEqual(keySpellings('1699-a.pdf'), ['1699-a.pdf']);
    assert.deepEqual(keySpellings('1699-a b (1).pdf'), ['1699-a b (1).pdf', '1699-a%20b%20(1).pdf']);
  });

  it('reads the key only from this project’s own public address in this bucket', () => {
    assert.equal(resourceKeyFromUrl(pub('1699-rules.pdf'), HOST), '1699-rules.pdf');
    assert.equal(resourceKeyFromUrl(pub(`${ORG}/T1/u-a.pdf?download=x`), HOST), `${ORG}/T1/u-a.pdf`);
    assert.equal(resourceKeyFromUrl('https://evil.supabase.co/storage/v1/object/public/resources/1699-rules.pdf', HOST), null);
    assert.equal(resourceKeyFromUrl('https://example.com/rules.pdf', HOST), null);
    assert.equal(resourceKeyFromUrl('#', HOST), null);
    assert.equal(resourceKeyFromUrl(`${HOST}/storage/v1/object/public/other-bucket/x.pdf`, HOST), null);
    // The address parser folds dot segments, so a crafted path lands on the OTHER club's key, which no club may remove.
    assert.equal(mayRemoveKey(resourceKeyFromUrl(pub(`${ORG}/../${OTHER}/T9/x.pdf`), HOST) ?? '', ORG, '2026-07-27T00:00:00Z'), false);
    assert.equal(resourceKeyFromUrl(pub('a%2F..%2Fb'), HOST), null);
  });

  it('a club may remove its own folder, and a flat key only for a row from before the folders — never another club’s', () => {
    assert.equal(mayRemoveKey(`${ORG}/T1/u-a.pdf`, ORG, '2026-12-01T00:00:00Z'), true);
    assert.equal(mayRemoveKey('1699-rules.pdf', ORG, '2026-07-27T00:00:00Z'), true);
    assert.equal(mayRemoveKey('1699-rules.pdf', ORG, '2026-11-12T00:00:00Z'), false, 'a row made after the folders cannot own a flat file');
    assert.equal(mayRemoveKey('1699-rules.pdf', ORG, null), false, 'when unsure, keep');
    assert.equal(mayRemoveKey('1699-rules.pdf', ORG), false);
    assert.equal(mayRemoveKey(`${OTHER}/T9/u-a.pdf`, ORG, '2026-07-27T00:00:00Z'), false);
    assert.equal(isClubKey(`${ORG}x/T1/a`, ORG), false);
  });
});
