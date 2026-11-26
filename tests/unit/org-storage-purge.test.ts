/**
 * A DELETED CLUB'S FILES GO WITH IT (Board Ready Stage 0a / GST-HST Stage 6 step 6.5, P7; 2026-11-15).
 *
 *   1. The purge, against a fake storage client: it walks into subfolders, pages past 100 entries, takes a missing bucket as
 *      nothing to do, reports a failed batch instead of throwing, refuses an id that would list a bucket's root, and removes
 *      the legacy flat rules keys it is handed (and only flat ones). A second club's files are never touched.
 *   2. THE SEVENTH BUCKET CANNOT BE FORGOTTEN: every bucket the app names (`.storage.from(…)`, `createBucket(…)`, literal or
 *      constant) is in the purge list or on the short, commented list of platform buckets. A new bucket fails the build here.
 *   3. The delete route reads the legacy keys before the cascade, purges after it, and records the outcome.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { filesUnder, readCode } from './_source-code.ts';
import {
  ORG_FILE_BUCKETS, PLATFORM_BUCKETS_NOT_A_CLUBS, countOrgFiles, isMissingBucket, removeOrgFiles, type StorageLike,
} from '../../lib/org-storage-purge.ts';

const ORG = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';

/** A storage client over an in-memory set of keys per bucket, behaving as Supabase's does: one folder level per list, pages. */
function fakeStorage(buckets: Record<string, string[]>, opts: { failRemoveIn?: string; failListIn?: string; maxPage?: number } = {}) {
  const store = new Map(Object.entries(buckets).map(([b, keys]) => [b, new Set(keys)]));
  const calls = { list: 0, remove: 0, removedBatches: [] as string[][] };
  const storage: StorageLike = {
    from(bucket) {
      return {
        async list(path, { limit, offset }) {
          calls.list++;
          const keys = store.get(bucket);
          if (!keys) return { data: null, error: { message: 'Bucket not found', statusCode: '404' } };
          if (opts.failListIn === bucket) return { data: null, error: { message: 'list broke' } };
          const prefix = path ? `${path}/` : '';
          const names = new Map<string, boolean>(); // name → is a folder
          for (const k of keys) {
            if (!k.startsWith(prefix)) continue;
            const rest = k.slice(prefix.length);
            const slash = rest.indexOf('/');
            if (slash < 0) names.set(rest, false);
            else names.set(rest.slice(0, slash), true);
          }
          const all = [...names.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([name, folder]) => ({ name, id: folder ? null : `id-${name}` }));
          const size = Math.min(limit, opts.maxPage ?? 100);
          return { data: all.slice(offset, offset + size), error: null };
        },
        async remove(paths) {
          calls.remove++;
          if (opts.failRemoveIn === bucket) return { data: null, error: { message: 'remove broke' } };
          const keys = store.get(bucket);
          if (!keys) return { data: null, error: { message: 'Bucket not found' } };
          calls.removedBatches.push(paths);
          const gone = paths.filter(p => keys.delete(p));
          return { data: gone.map(name => ({ name })), error: null };
        },
      };
    },
  };
  const left = (bucket: string, prefix = '') => [...(store.get(bucket) ?? [])].filter(k => k.startsWith(prefix));
  return { storage, calls, left };
}

describe('the purge removes a club’s files and nothing else', () => {
  it('walks into subfolders and pages past 100 entries, leaving a second club untouched', async () => {
    const many = Array.from({ length: 120 }, (_, i) => `${ORG}/T1/R1/f${String(i).padStart(3, '0')}.pdf`);
    const { storage, left } = fakeStorage({
      'org-logos': [`${ORG}/logo.png`, `${ORG}/sponsors/s1.png`, `${ORG}/T1/logo.png`, `${OTHER}/logo.png`],
      'org-assets': [`${ORG}/hero-banner.jpg`],
      resources: [`${ORG}/T1/u-rules.pdf`, '1699-old-rules.pdf', '1700-someone-elses.pdf'],
      'org-permit-documents': [`${ORG}/permits/P1/u-permit.pdf`],
      'rep-team-documents': [`${ORG}/teams/A/players/B/u-medical.pdf`, `${ORG}/templates/team/u-waiver.pdf`, `${OTHER}/teams/X/players/Y/u.pdf`],
      'tournament-registration-files': many,
    });
    const r = await removeOrgFiles({ storage, orgId: ORG, legacyResourceKeys: ['1699-old-rules.pdf'] });
    assert.deepEqual(r.failed, []);
    assert.equal(r.removed, 3 + 1 + 2 + 1 + 2 + 120);
    assert.equal(r.byBucket['tournament-registration-files'], 120);
    for (const b of ORG_FILE_BUCKETS) assert.deepEqual(left(b, `${ORG}/`), [], `${b} is empty under the club`);
    assert.deepEqual(left('resources'), ['1700-someone-elses.pdf'], 'the legacy key went; a flat key it was not handed stays');
    assert.deepEqual(left('org-logos'), [`${OTHER}/logo.png`]);
    assert.equal(left('rep-team-documents').length, 1, 'the other club’s player file stays');
  });

  it('a page smaller than asked for ends the folder (exactly 100 files reads a second, empty page)', async () => {
    const hundred = Array.from({ length: 100 }, (_, i) => `${ORG}/f${String(i).padStart(3, '0')}`);
    const { storage, left } = fakeStorage({ 'org-assets': hundred });
    const r = await removeOrgFiles({ storage, orgId: ORG, buckets: ['org-assets'] });
    assert.equal(r.removed, 100);
    assert.deepEqual(left('org-assets'), []);
  });

  it('a missing bucket is nothing to delete, not a failure', async () => {
    const { storage } = fakeStorage({ 'org-logos': [`${ORG}/logo.png`] });
    const r = await removeOrgFiles({ storage, orgId: ORG });
    assert.deepEqual(r.failed, []);
    assert.equal(r.removed, 1);
    assert.equal(isMissingBucket({ message: 'Bucket not found' }), true);
    assert.equal(isMissingBucket({ message: 'Object not found', statusCode: '404' }), false);
  });

  it('a failed batch is reported with its bucket and the club’s folder, never thrown; the other buckets still go', async () => {
    const { storage, left } = fakeStorage({
      'org-logos': [`${ORG}/logo.png`],
      'rep-team-documents': [`${ORG}/teams/A/players/B/u.pdf`],
    }, { failRemoveIn: 'rep-team-documents' });
    const r = await removeOrgFiles({ storage, orgId: ORG });
    assert.equal(r.failed.length, 1);
    assert.equal(r.failed[0].bucket, 'rep-team-documents');
    assert.equal(r.failed[0].keyOrPrefix, `${ORG}/`);
    assert.match(r.failed[0].message, /1 file not removed: remove broke/);
    assert.deepEqual(left('org-logos'), []);
  });

  it('many failed batches in one bucket are ONE failure line with the total, not one per batch', async () => {
    const keys = Array.from({ length: 250 }, (_, i) => `${ORG}/T/f${i}`);
    const { storage } = fakeStorage({ 'rep-team-documents': keys }, { failRemoveIn: 'rep-team-documents' });
    const r = await removeOrgFiles({ storage, orgId: ORG, buckets: ['rep-team-documents'] });
    assert.equal(r.failed.length, 1);
    assert.match(r.failed[0].message, /^250 files not removed/);
  });

  it('a list that fails is reported too', async () => {
    const { storage } = fakeStorage({ 'org-assets': [`${ORG}/hero-banner.jpg`] }, { failListIn: 'org-assets' });
    const r = await removeOrgFiles({ storage, orgId: ORG, buckets: ['org-assets'] });
    assert.equal(r.failed.length, 1);
    assert.match(r.failed[0].message, /could not list/);
  });

  it('a storage client that throws is caught and reported', async () => {
    const storage: StorageLike = { from: () => { throw new Error('network down'); } };
    const r = await removeOrgFiles({ storage, orgId: ORG, buckets: ['org-logos'] });
    assert.equal(r.failed.length, 1);
    assert.match(r.failed[0].message, /network down/);
  });

  it('an empty or malformed club id refuses, and lists nothing (it would be a bucket’s root)', async () => {
    for (const bad of ['', ' ', '..', `${ORG}/..`, 'not-a-uuid', `${ORG}x`, undefined as unknown as string]) {
      const { storage, calls, left } = fakeStorage({ 'org-logos': [`${ORG}/logo.png`, `${OTHER}/logo.png`] });
      const r = await removeOrgFiles({ storage, orgId: bad });
      assert.equal(r.removed, 0, String(bad));
      assert.match(r.failed[0]?.message ?? '', /refused/);
      assert.equal(calls.list + calls.remove, 0, `${String(bad)}: nothing was listed or removed`);
      assert.equal(left('org-logos').length, 2);
      const c = await countOrgFiles({ storage, orgId: bad });
      assert.match(c.failed[0]?.message ?? '', /refused/);
    }
  });

  it('a legacy key handed in must be flat: a foldered key (another club’s) is never removed through it', async () => {
    const { storage, left } = fakeStorage({ resources: [`${OTHER}/T9/u.pdf`, '1699-a.pdf'] });
    const r = await removeOrgFiles({ storage, orgId: ORG, legacyResourceKeys: [`${OTHER}/T9/u.pdf`, '1699-a.pdf', '', '..'] });
    assert.equal(r.removed, 1);
    assert.deepEqual(left('resources'), [`${OTHER}/T9/u.pdf`]);
  });

  it('the count counts what the purge would remove, and removes nothing', async () => {
    const { storage, calls, left } = fakeStorage({
      'org-logos': [`${ORG}/logo.png`, `${ORG}/sponsors/a.png`],
      resources: ['1699-a.pdf'],
    });
    const c = await countOrgFiles({ storage, orgId: ORG, legacyResourceKeys: ['1699-a.pdf'] });
    assert.equal(c.removed, 3);
    assert.equal(c.byBucket['org-logos'], 2);
    assert.equal(c.byBucket.resources, 1);
    assert.equal(calls.remove, 0);
    assert.equal(left('org-logos').length, 2);
  });
});

// ── 2. The seventh bucket ─────────────────────────────────────────────────────────────────────────────────────────────────

/** A string constant that names a bucket (`const X_BUCKET = 'name'`, `const BUCKET = 'name'`). */
const CONST_RE = /\b(?:export\s+)?const\s+([A-Z][A-Z0-9_]*)\s*=\s*['"`]([a-z0-9][a-z0-9-]*)['"`]/g;
/** `X as BUCKET` in an import. */
const ALIAS_RE = /\b([A-Z][A-Z0-9_]*)\s+as\s+([A-Z][A-Z0-9_]*)\b/g;
/** A use of a bucket: the storage client's `.from(…)` or `createBucket(…)`. */
const USE_RE = /(?:\bstorage\s*\.\s*from|\bcreateBucket)\(\s*(?:(['"`])([^'"`]+)\1|([A-Za-z_$][\w$]*))/g;

/**
 * Every bucket name the code uses, resolved; an argument that cannot be resolved to a name is named as unresolved (the
 * guard cannot vouch for it, so it fails rather than guessing).
 */
export function bucketsUsed(files: Record<string, string>): { names: Set<string>; unresolved: string[] } {
  const globals = new Map<string, string>();
  for (const code of Object.values(files)) for (const m of code.matchAll(CONST_RE)) globals.set(m[1], m[2]);
  const names = new Set<string>();
  const unresolved: string[] = [];
  for (const [file, code] of Object.entries(files)) {
    const local = new Map<string, string>();
    for (const m of code.matchAll(CONST_RE)) local.set(m[1], m[2]);
    const alias = new Map<string, string>();
    for (const m of code.matchAll(ALIAS_RE)) alias.set(m[2], m[1]);
    for (const m of code.matchAll(USE_RE)) {
      if (m[2]) { names.add(m[2]); continue; }
      const ident = m[3];
      const name = local.get(ident) ?? globals.get(alias.get(ident) ?? ident);
      if (name) names.add(name); else unresolved.push(`${file}: ${ident}`);
    }
  }
  return { names, unresolved };
}

/** The buckets the code uses that deleting a club would not reach and nobody said why. */
export function forgottenBuckets(used: Iterable<string>, purge: readonly string[], platform: Readonly<Record<string, string>>): string[] {
  return [...used].filter(b => !purge.includes(b) && !(b in platform)).sort();
}

describe('every bucket the app writes to is purged with the club, or said not to be a club’s', () => {
  const files: Record<string, string> = {};
  for (const dir of ['app', 'lib', 'components']) {
    // The purge itself walks the list by variable; it is the list, not a user of a bucket.
    for (const ext of ['.ts', '.tsx']) for (const f of filesUnder(dir, ext)) if (f !== 'lib/org-storage-purge.ts') files[f] = readCode(f);
  }
  const { names, unresolved } = bucketsUsed(files);

  it('every use resolves to a bucket name', () => assert.deepEqual(unresolved, []));

  it('finds every club bucket in use (so the scan is looking at something)', () => {
    for (const b of ORG_FILE_BUCKETS) assert.ok(names.has(b), `${b} is used somewhere`);
  });

  it('no bucket is forgotten', () => {
    assert.deepEqual(forgottenBuckets(names, ORG_FILE_BUCKETS, PLATFORM_BUCKETS_NOT_A_CLUBS), []);
  });

  it('every platform exclusion says why', () => {
    for (const [b, why] of Object.entries(PLATFORM_BUCKETS_NOT_A_CLUBS)) assert.ok(why.trim().length > 5, b);
    for (const b of ORG_FILE_BUCKETS) assert.ok(!(b in PLATFORM_BUCKETS_NOT_A_CLUBS), `${b} is not both`);
  });

  it('kill test: a bucket dropped from the purge list fails, and so does a new one', () => {
    const without = ORG_FILE_BUCKETS.filter(b => b !== 'rep-team-documents');
    assert.deepEqual(forgottenBuckets(names, without, PLATFORM_BUCKETS_NOT_A_CLUBS), ['rep-team-documents']);
    const seventh = bucketsUsed({ a: `await supabaseAdmin.storage.from('club-videos').upload(p, f)` }).names;
    assert.deepEqual(forgottenBuckets(seventh, ORG_FILE_BUCKETS, PLATFORM_BUCKETS_NOT_A_CLUBS), ['club-videos']);
  });

  it('kill test: constants, aliases, multi-line calls and createBucket all resolve; an unknown variable is unresolved', () => {
    const r = bucketsUsed({
      'x.ts': `export const CLIP_BUCKET = 'clips';`,
      'y.ts': `import { CLIP_BUCKET as BUCKET } from './x';\nsupabase.storage\n  .from(BUCKET).remove([k]);`,
      'z.ts': `const BUCKET = 'scans'; await s.storage.createBucket(BUCKET, {});`,
      'w.ts': `admin.storage.from(bucketName).list('')`,
    });
    assert.deepEqual([...r.names].sort(), ['clips', 'scans']);
    assert.deepEqual(r.unresolved, ['w.ts: bucketName']);
    assert.equal(bucketsUsed({ a: `client.from('resources').select('*')` }).names.size, 0, 'a TABLE is not a bucket');
  });
});

// ── 3. The route ──────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('the delete route removes the files after the club, and records it', () => {
  const code = readCode('app/api/platform-admin/orgs/[id]/delete/route.ts');
  const del = code.slice(code.search(/export const DELETE\b/));
  const at = (re: RegExp) => { const i = del.search(re); assert.ok(i >= 0, `${re} is in the delete`); return i; };

  it('reads the legacy keys before anything changes, and refuses when it cannot', () => {
    const read = at(/readOrgLegacyResourceKeys\(id\)/);
    assert.ok(read < at(/closeClubPayPages\(/), 'before the pay pages close');
    assert.ok(read < at(/sendEmail\(/), 'before the owner is emailed');
    assert.ok(read < at(/'delete_organization',/), 'before the audit row');
    assert.match(del, /if \(!legacyResourceKeys\) \{\s*return NextResponse\.json\(\{ error: [^}]*\}, \{ status: 503 \}\)/);
  });

  it('purges AFTER the organization row is gone, and a failed database delete returns before it', () => {
    const orgDelete = at(/from\('organizations'\)\s*\.delete\(\)/);
    const failedReturn = at(/if \(deleteError\)/);
    const purge = at(/purgeOrgFiles\(id, legacyResourceKeys\)/);
    assert.ok(orgDelete < failedReturn && failedReturn < purge);
  });

  it('writes the outcome, and on a failure the _files_failed row and the error report', () => {
    assert.match(del, /'delete_organization_files_failed'/);
    assert.match(del, /'delete_organization_files',/);
    assert.match(del, /captureError\(new Error\(`org delete: \$\{files\.failed\.length\}/);
    assert.match(del, /filesFailed:/);
  });

  it('the purge checks no other row still names a legacy key before removing it, and reports a lookup that failed', () => {
    // The step lives in one file, shared with the preview removal (Club Website Track P, Session P4).
    assert.match(code, /import \{ purgeOrgFiles \} from '@\/lib\/org-files-purge-server'/);
    const step = readCode('lib/org-files-purge-server.ts');
    assert.match(step, /legacyKeysNoRowNames\(legacyResourceKeys, orgId\)/);
    assert.match(step, /legacyResourceKeys: free/);
    assert.match(step, /if \(unread\.length\) \{\s*result\.failed\.push\(/);
  });

  it('the legacy keys are on the delete_organization row, written before any change (a cut-off purge can be retried)', () => {
    const row = del.slice(del.search(/'delete_organization',/));
    assert.match(row.slice(0, row.search(/\{ reason \}/)), /legacyResourceKeys,/);
    assert.match(code, /export const maxDuration = 300;/);
  });

  it('a public demo club is refused before anything is read or changed (owner 2026-11-15)', () => {
    const refuse = at(/if \(isDemoOrgSlug\(org\.slug\)\) \{\s*return NextResponse\.json\(\{ error: DEMO_DELETE_REFUSAL \}, \{ status: 403 \}\)/);
    assert.ok(refuse < at(/readOutstanding\(id\)/) && refuse < at(/readOrgLegacyResourceKeys\(id\)/));
    assert.match(code, /demoRefusal: isDemoOrgSlug\(org\.slug\)/);
  });

  it('the preview counts the files', () => {
    const get = code.slice(code.search(/export const GET\b/), code.search(/export const DELETE\b/));
    assert.match(get, /countOrgFiles\(/);
    assert.match(get, /fileCount:/);
  });
});
