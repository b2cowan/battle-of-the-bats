import assert from 'node:assert/strict';
import { it } from 'node:test';
import { isUuid } from '../../lib/utils.ts';
import { billingTestLoader } from './_billing-test-loader.ts';

it('Undo refuses a malformed game ID before calling the UUID database function', async () => {
  let rpcCalls = 0;
  // Run the real handler with only its auth/database boundary replaced: a UUID cast must never see this input.
  const load = billingTestLoader({
    '@/lib/api-auth': { getAuthContextWithRole: async () => ({ org: { id: 'org' } }) },
    '@/lib/house-league-gate': { houseLeagueRefusal: () => null },
    '@/lib/db': { getLeagueSeasonById: async () => ({ id: 'season' }) },
    '@/lib/supabase-admin': { supabaseAdmin: { rpc: async (_name: string, p: { p_game: string }) => {
      rpcCalls++;
      if (!isUuid(p.p_game)) throw new Error('invalid input syntax for type uuid');
      return { data: 'not_found', error: null };
    } } },
    '@/lib/observability': { withObservability: (handler: unknown) => handler },
  });
  const { POST } = load('app/api/admin/house-league/seasons/[seasonId]/schedule/[gameId]/undo/route.ts') as {
    POST: (req: Request, ctx: { params: Promise<{ seasonId: string; gameId: string }> }) => Promise<Response>;
  };
  const req = new Request('http://localhost/api/admin/house-league/seasons/season/schedule/not-a-uuid/undo?orgSlug=club');
  const response = await POST(req, {
    params: Promise.resolve({ seasonId: 'season', gameId: 'not-a-uuid' }),
  });
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: 'Game not found' });
  assert.equal(rpcCalls, 0);
  const missing = await POST(req, { params: Promise.resolve({ seasonId: 'season', gameId: '00000000-0000-4000-8000-000000000000' }) });
  assert.equal(missing.status, 404);
  assert.equal(rpcCalls, 1, 'valid IDs still reach the database');
});
