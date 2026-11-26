import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { isUuid } from '../../lib/utils.ts';
import { RAIN_WORDS as W } from '../../lib/league-rainout.ts';
import { billingTestLoader } from './_billing-test-loader.ts';

/**
 * House League 9e-2 Part 3, as Club Website Stage 2 left it (K14: Close a place replaces the Rainout everywhere). The
 * one-season press route is RETIRED — the house league Rainout button opens Close a place, whose press is one database step
 * across every season (`tests/unit/place-closure-window*.test.ts`). What stays is the record's own route: Put all back for
 * a Rainout held before Close a place shipped (the evidence that one can still exist: the old window's "Email the families
 * now" untick), and Send for any record still waiting. A closed place's record is never put back (K5).
 */
const ROOT = join(import.meta.dirname, '..', '..');
const G1 = '00000000-0000-4000-8000-000000000001';
const G2 = '00000000-0000-4000-8000-000000000002';

function harness(o: { backAnswer?: string | null; closureId?: string | null } = {}) {
  const calls = { rpc: [] as { name: string; args: Record<string, unknown> }[], sends: [] as unknown[] };
  const load = billingTestLoader({
    '@/lib/api-auth': { getAuthContextWithRole: async () => ({ org: { id: 'org', planId: 'club' }, user: { id: 'user' } }) },
    '@/lib/house-league-gate': { houseLeagueRefusal: () => null },
    '@/lib/db': { getLeagueSeasonById: async () => ({ id: 'season', name: '2027 Season' }) },
    '@/lib/observability': { withObservability: (handler: unknown) => handler },
    '@/lib/supabase-admin': { supabaseAdmin: {
      rpc: async (name: string, args: Record<string, unknown>) => {
        calls.rpc.push({ name, args });
        if (!isUuid(args.p_rainout)) throw new Error('invalid input syntax for type uuid');
        return { data: o.backAnswer ?? null, error: null };
      },
    } },
    '@/lib/league-rainout-server': {
      rainoutOf: async () => ({ id: 'r1', game_ids: [G1, G2], division_ids: ['d1'], change_ids: ['c1', 'c2'], put_back_at: null, closure_id: o.closureId ?? null }),
    },
    '@/lib/league-rainout-send': { sendRainout: async (p: unknown) => { calls.sends.push(p); return [{ divisionId: 'd1', outcome: 'told', emails: 9 }]; } },
  });
  const back = (load('app/api/admin/house-league/seasons/[seasonId]/schedule/rainout/[rainoutId]/route.ts') as Record<string,
    (req: Request, ctx: { params: Promise<{ seasonId: string; rainoutId: string }> }) => Promise<Response>>).POST;
  const putBack = (rainoutId: string, action = 'back') => back(new Request('http://localhost/x?orgSlug=club', { method: 'POST', body: JSON.stringify({ action }) }),
    { params: Promise.resolve({ seasonId: 'season', rainoutId }) });
  return { calls, putBack };
}

describe('the one-season Rainout press is retired (K14)', () => {
  it('its route and its window are gone; nothing can make a new held Rainout', () => {
    assert.equal(existsSync(join(ROOT, 'app/api/admin/house-league/seasons/[seasonId]/schedule/rainout/route.ts')), false);
    assert.equal(existsSync(join(ROOT, 'components/admin/kit/club/league/schedule/RainoutWindow.tsx')), false);
  });
});

describe('Put all back', () => {
  it('a malformed id never reaches the database', async () => {
    const h = harness();
    const r = await h.putBack('not-a-uuid');
    assert.equal(r.status, 404);
    assert.equal(h.calls.rpc.length, 0);
  });
  it('restored; already sent; a game changed since', async () => {
    assert.equal((await harness().putBack(G1)).status, 200);
    const gone = await harness({ backAnswer: 'gone' }).putBack(G1);
    assert.equal(gone.status, 409);
    assert.equal((await gone.json()).error, W.backGone);
    const refused = await harness({ backAnswer: 'refused' }).putBack(G1);
    assert.equal(refused.status, 409);
    assert.equal((await refused.json()).error, W.backRefused);
  });
  it('a closed place\'s record is never put back (K5), and never reaches the database', async () => {
    const h = harness({ closureId: G2 });
    const r = await h.putBack(G1);
    assert.equal(r.status, 409);
    assert.equal((await r.json()).error, W.backClosure);
    assert.equal(h.calls.rpc.length, 0);
  });
  it('Send from the banner sends the record\'s divisions, a closed place\'s too', async () => {
    for (const closureId of [null, G2]) {
      const h = harness({ closureId });
      const r = await h.putBack(G1, 'send');
      assert.equal(r.status, 200);
      assert.equal(h.calls.sends.length, 1);
    }
  });
});
