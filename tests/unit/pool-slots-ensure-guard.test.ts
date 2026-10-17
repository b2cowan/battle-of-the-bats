/**
 * THE POOL-SLOTS ROUTE TRUSTS NOTHING IT IS SENT (security fix, 2026-10-16; found by the team-update sweep).
 *
 * The route checked the organization against the request's `tournamentId`, then acted on whatever division, pools,
 * spots and teams it was sent: "ensure" added spots to another organization's pool and read its spots and team names
 * back, "sync-capacity" DELETED another organization's empty spots, "swap" checked one of its two spots, "assign"
 * wrote any team id and "rename" rewrote game labels by spot id past the lock. Those five had no caller and were removed; "ensure", the schedule generator's one call, now checks the
 * division against the tournament and every pool against the division.
 *
 * These cases pin: the generator's payload is admitted (read from its source); anything else refuses; the removed
 * actions stay removed, with no screen posting them; and the route checks before it writes.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_SLOTS_PER_POOL, POOL_SLOT_REFUSALS, ensureOutsideDivision, readEnsureRequest,
} from '../../lib/pool-slots-ensure';
import { readCode } from './_source-code.ts';

const T = '11111111-1111-4111-8111-111111111111';
const D = '22222222-2222-4222-8222-222222222222';
const P1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const P2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ROUTE = 'app/api/admin/pool-slots/route.ts';

const generatorBody = { action: 'ensure', tournamentId: T, divisionId: D, pools: [
  { poolId: P1, slotCount: 4, namePrefix: 'Pool A' }, { poolId: P2, slotCount: 0, namePrefix: '' },
] };

describe('what the schedule generator sends is read', () => {
  it('admits its payload', () => {
    assert.deepEqual(readEnsureRequest(generatorBody), { ok: true, tournamentId: T, divisionId: D, pools: generatorBody.pools });
    assert.deepEqual(readEnsureRequest({ tournamentId: T, divisionId: D, pools: [] }), { ok: true, tournamentId: T, divisionId: D, pools: [] });
    assert.ok(readEnsureRequest({ ...generatorBody, pools: [{ poolId: P1, slotCount: MAX_SLOTS_PER_POOL, namePrefix: 'x' }] }).ok);
  });

  it('the generator still sends exactly these fields (read from its source)', () => {
    const src = readCode('app/[orgSlug]/admin/tournaments/schedule/Generator.tsx');
    const call = src.match(/fetch\(`\/api\/admin\/pool-slots\$\{orgQuery\}`[\s\S]*?body: JSON\.stringify\(\{([\s\S]*?)\}\),\s*\}\);/);
    assert.ok(call, 'found the generator\'s ensure call');
    assert.match(call[1], /action: 'ensure',\s*tournamentId: tournament\.id,\s*divisionId: selectedGroupId,\s*pools: poolList\.map\(pool => \(\{\s*poolId: pool\.id,\s*slotCount: defaultSlotCount\(pool\.id\),\s*namePrefix: pool\.name,\s*\}\)\),/);
  });

  it('refuses anything else', () => {
    const refused = (body: unknown) => { const r = readEnsureRequest(body); return r.ok ? 'ADMITTED' : r.error; };
    assert.equal(refused(null), POOL_SLOT_REFUSALS.shape);
    assert.equal(refused({ ...generatorBody, tournamentId: 'x' }), POOL_SLOT_REFUSALS.shape);
    assert.equal(refused({ ...generatorBody, divisionId: undefined }), POOL_SLOT_REFUSALS.shape);
    assert.equal(refused({ ...generatorBody, pools: 'all' }), POOL_SLOT_REFUSALS.shape);
    assert.equal(refused({ ...generatorBody, pools: [null] }), POOL_SLOT_REFUSALS.shape);
    assert.equal(refused({ ...generatorBody, pools: [{ poolId: 'x),id.not.is.null', slotCount: 1, namePrefix: 'x' }] }), POOL_SLOT_REFUSALS.shape);
    assert.equal(refused({ ...generatorBody, pools: [{ poolId: P1, slotCount: 1, namePrefix: 7 }] }), POOL_SLOT_REFUSALS.shape);
    assert.equal(refused({ ...generatorBody, pools: [{ poolId: P1, slotCount: 1, namePrefix: 'x'.repeat(201) }] }), POOL_SLOT_REFUSALS.shape);
    for (const slotCount of [-1, 1.5, MAX_SLOTS_PER_POOL + 1, '4', Number.NaN, Number.POSITIVE_INFINITY]) {
      assert.equal(refused({ ...generatorBody, pools: [{ poolId: P1, slotCount, namePrefix: 'x' }] }), POOL_SLOT_REFUSALS.count, String(slotCount));
    }
  });
});

describe('the division is the tournament’s, every pool the division’s', () => {
  const read = { tournamentId: T, divisionId: D, pools: generatorBody.pools };
  const own = [{ id: P1, division_id: D }, { id: P2, division_id: D }];

  it('admits the division’s own pools', () => {
    assert.equal(ensureOutsideDivision(read, { tournament_id: T }, own), false);
    assert.equal(ensureOutsideDivision({ ...read, pools: [] }, { tournament_id: T }, []), false);
  });

  it('refuses another tournament’s division, a missing division, another division’s pool, and a missing pool', () => {
    assert.equal(ensureOutsideDivision(read, { tournament_id: 'other' }, own), true);
    assert.equal(ensureOutsideDivision(read, null, own), true);
    assert.equal(ensureOutsideDivision(read, { tournament_id: T }, [{ id: P1, division_id: D }, { id: P2, division_id: 'other' }]), true);
    assert.equal(ensureOutsideDivision(read, { tournament_id: T }, [{ id: P1, division_id: D }]), true);
  });
});

describe('the route', () => {
  const route = readCode(ROUTE);
  const post = route.slice(route.indexOf('export const POST'));
  const ensure = post.slice(post.indexOf("if (action === 'ensure')"), post.indexOf("return new Response(JSON.stringify({ error: 'Unknown action' })"));
  const at = (src: string, needle: string) => { const i = src.indexOf(needle); assert.ok(i >= 0, `found: ${needle}`); return i; };

  it('keeps one action: the generator’s ensure', () => {
    assert.deepEqual([...post.matchAll(/action === '([\w-]+)'/g)].map(m => m[1]), ['ensure']);
    assert.doesNotMatch(route, /\.delete\(/, 'nothing in this route deletes a spot');
    assert.doesNotMatch(route, /from\('games'\)/, 'nothing in this route writes a game');
  });

  it('no screen posts a removed action to it', () => {
    for (const file of [
      'app/[orgSlug]/admin/tournaments/schedule/Generator.tsx',
      'app/[orgSlug]/admin/tournaments/registrations/page.tsx',
      'app/[orgSlug]/admin/tournaments/schedule/page.tsx',
    ]) {
      const src = readCode(file);
      for (const m of src.matchAll(/\/api\/admin\/pool-slots[\s\S]{0,400}?action: '([\w-]+)'/g)) {
        assert.equal(m[1], 'ensure', `${file} posts "${m[1]}" to pool-slots`);
      }
    }
  });

  it('ensure reads the request through the checker, and checks before any write', () => {
    assert.match(ensure, /^if \(action === 'ensure'\) \{\s*const read = readEnsureRequest\(body\);\s*if \(!read\.ok\) return badRequest\(read\.error\);/);
    assert.equal([...ensure.matchAll(/\bbody\b/g)].length, 1, '`body` read once, by readEnsureRequest');
    const firstWrite = at(ensure, ".from('pool_slots').insert(");
    assert.ok(at(ensure, 'const refused = await requireWritableTournament(ctx, tournamentId);\n      if (refused) return refused;') < firstWrite);
    assert.ok(at(ensure, 'if (ensureOutsideDivision(read, division, poolRows ?? [])) return badRequest(POOL_SLOT_REFUSALS.outside);') < firstWrite);
    assert.ok(at(ensure, '.from(\'pool_slots\')\n          .select(\'slot_number\')') > at(ensure, 'ensureOutsideDivision('), 'no pool read before the check');
  });
});
