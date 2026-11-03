import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SCORE_WORDS as W } from '../../lib/league-coach-scores.ts';
import { billingTestLoader } from './_billing-test-loader.ts';

/**
 * House League 9e-3 Part 3: the coach's score and report routes, and the club's Keep, run for real with only the auth and
 * database boundary replaced. Every refusal the route can decide is decided before the all-or-nothing database function
 * is called; the database's own refusals come back in the copy's words (COPY §9).
 */
const TEAM_H = '00000000-0000-4000-8000-0000000000a1';
const TEAM_A = '00000000-0000-4000-8000-0000000000a2';
const GAME = '00000000-0000-4000-8000-000000000001';
const SEEN = '2027-06-17T22:00:00.123456+00:00';

type Link = { team_id: string; user_id: string; accepted_at: string | null; removed_at: string | null; name: string };
const seat = (team: string, o: Partial<Link> = {}): Link => ({ team_id: team, user_id: 'me', accepted_at: '2027-05-01', removed_at: null, name: 'Morgan Reid', ...o });

function harness(o: {
  user?: { id: string } | null; links?: Link[]; refusal?: string | null; orgSlug?: string; season?: { status: string; finishedAt: string | null };
  game?: { id: string; home_team_id: string; away_team_id: string } | null;
} = {}) {
  const calls = { rpc: [] as { name: string; args: Record<string, unknown> }[] };
  const chain = (result: unknown) => {
    const c: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'in']) c[m] = () => c;
    c.maybeSingle = async () => result;
    c.then = (resolve: (v: unknown) => void) => resolve(result);
    return c;
  };
  const game = o.game === undefined ? { id: GAME, home_team_id: TEAM_H, away_team_id: TEAM_A } : o.game;
  const supabaseAdmin = {
    from: (table: string) => table === 'league_games' ? chain({ data: game, error: null })
      : table === 'league_team_coaches' ? chain({ data: o.links ?? [seat(TEAM_H)], error: null })
      : chain({ data: [{ id: TEAM_H, name: 'Twins' }, { id: TEAM_A, name: 'Royals' }], error: null }),
    rpc: async (name: string, args: Record<string, unknown>) => { calls.rpc.push({ name, args }); return { data: o.refusal ?? null, error: null }; },
  };
  const team = (id: string) => ({
    card: { orgSlug: o.orgSlug ?? 'club', seasonSlug: 'summer', orgId: 'org', teamName: id === TEAM_H ? 'Twins' : 'Royals', seasonName: 'Summer 2027' },
    seasonId: 'season', season: o.season ?? { status: 'active', finishedAt: null },
  });
  const load = billingTestLoader({
    './supabase-admin': { supabaseAdmin },
    '@/lib/supabase-admin': { supabaseAdmin },
    './api-auth': { getAuthenticatedUser: async () => (o.user === undefined ? { id: 'me' } : o.user) },
    '@/lib/api-auth': { getAuthContextWithRole: async () => ({ org: { id: 'org' }, user: { id: 'staff', email: 'sam@example.invalid', user_metadata: {} } }) },
    './house-league-coach': { readCoachFeedTeam: async (id: string) => team(id) },
    './member-names': { memberDisplayName: async () => 'Sam Lee' },
    '@/lib/house-league-gate': { houseLeagueRefusal: () => null },
    '@/lib/db': { getLeagueSeasonById: async () => ({ id: 'season' }) },
    '@/lib/observability': { withObservability: (handler: unknown) => handler },
    '@/lib/public-form-throttle': { throttlePublicForm: () => null },
  });
  type Handler = (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;
  const score = (load('app/api/league/[orgSlug]/[seasonSlug]/team/[teamId]/games/[gameId]/score/route.ts') as { POST: Handler }).POST;
  const report = (load('app/api/league/[orgSlug]/[seasonSlug]/team/[teamId]/games/[gameId]/report/route.ts') as { POST: Handler }).POST;
  const keep = (load('app/api/admin/house-league/seasons/[seasonId]/schedule/[gameId]/keep/route.ts') as { POST: Handler }).POST;
  const post = (h: Handler, body: unknown, p: Record<string, string>) =>
    h(new Request('http://localhost/x?orgSlug=club', { method: 'POST', body: JSON.stringify(body) }), { params: Promise.resolve(p) });
  const at = (teamId: string, gameId = GAME) => ({ orgSlug: 'club', seasonSlug: 'summer', teamId, gameId });
  return {
    calls,
    score: (body: unknown, teamId = TEAM_H, gameId = GAME) => post(score, body, at(teamId, gameId)),
    report: (body: unknown, teamId = TEAM_A) => post(report, body, at(teamId)),
    keep: (body: unknown, gameId = GAME) => post(keep, body, { seasonId: 'season', gameId }),
  };
}

const ok = { homeScore: 7, awayScore: 4, seen: SEEN };

describe('the home coach enters the score', () => {
  it('a malformed id is not found, before any read of the game', async () => {
    const h = harness();
    assert.equal((await h.score(ok, 'nope')).status, 404);
    assert.equal((await h.score(ok, TEAM_H, 'nope')).status, 404);
    assert.equal(h.calls.rpc.length, 0);
  });

  it('signed out: 401', async () => {
    assert.equal((await harness({ user: null }).score(ok)).status, 401);
  });

  it("another club's team, or a game of another team, is not found", async () => {
    assert.equal((await harness({ orgSlug: 'other' }).score(ok)).status, 404);
    const h = harness({ game: { id: GAME, home_team_id: 'x', away_team_id: 'y' } });
    assert.equal((await h.score(ok)).status, 404);
    assert.equal((await harness({ game: null }).score(ok)).status, 404);
  });

  it('never coached the team: not found; removed: the gone sentence', async () => {
    assert.equal((await harness({ links: [] }).score(ok)).status, 404);
    const gone = await harness({ links: [seat(TEAM_H, { removed_at: '2027-06-01' })] }).score(ok);
    assert.equal(gone.status, 403);
    assert.equal((await gone.json()).error, W.err.gone('Twins'));
  });

  it('a finished season is refused in words', async () => {
    const r = await harness({ season: { status: 'completed', finishedAt: new Date().toISOString() } }).score(ok);
    assert.equal(r.status, 409);
    assert.equal((await r.json()).error, W.err.finished('Summer 2027'));
  });

  it('the away coach cannot enter it', async () => {
    const h = harness({ links: [seat(TEAM_A)] });
    const r = await h.score(ok, TEAM_A);
    assert.equal(r.status, 403);
    assert.equal((await r.json()).error, 'Only Twins’ coach enters the score.');
    assert.equal(h.calls.rpc.length, 0);
  });

  it('one score alone, or no seen, is refused before the database', async () => {
    const h = harness();
    assert.equal((await h.score({ homeScore: 7, awayScore: null, seen: SEEN })).status, 400);
    assert.equal((await h.score({ homeScore: 7, seen: SEEN })).status, 400);
    assert.equal((await h.score({ homeScore: 7, awayScore: 4 })).status, 400);
    assert.equal((await h.score({ homeScore: 7.5, awayScore: 4, seen: SEEN })).status, 400);
    assert.equal(h.calls.rpc.length, 0);
  });

  it('saves through the function: the home team, the seat name, what the window saw', async () => {
    const h = harness();
    const r = await h.score(ok);
    assert.equal(r.status, 200);
    assert.deepEqual(h.calls.rpc, [{ name: 'league_game_coach_score', args: {
      p_org: 'org', p_game: GAME, p_team: TEAM_H, p_user: 'me', p_name: 'Morgan Reid', p_home: 7, p_away: 4, p_seen: SEEN,
    } }]);
  });

  it('clearing both boxes sends both as null', async () => {
    const h = harness();
    assert.equal((await h.score({ homeScore: null, awayScore: null, seen: SEEN })).status, 200);
    assert.equal(h.calls.rpc[0].args.p_home, null);
  });

  it('a coach of both teams enters from the away page as the home coach', async () => {
    const h = harness({ links: [seat(TEAM_A, { name: 'M. Reid' }), seat(TEAM_H)] });
    assert.equal((await h.score(ok, TEAM_A)).status, 200);
    assert.equal(h.calls.rpc[0].args.p_team, TEAM_H);
    assert.equal(h.calls.rpc[0].args.p_name, 'Morgan Reid');
  });

  for (const [refusal, status, error] of [
    ['changed', 409, W.err.changed], ['closed', 409, W.err.closed], ['calledOff', 409, W.err.calledOff],
    ['notStarted', 409, W.err.notStarted], ['notFound', 404, 'Not found'],
  ] as const) {
    it(`the database's ${refusal} comes back in words`, async () => {
      const r = await harness({ refusal }).score(ok);
      assert.equal(r.status, status);
      assert.deepEqual(await r.json(), { error, code: refusal });
    });
  }
});

describe('the away coach reports it', () => {
  const away = [seat(TEAM_A, { name: 'Sam Blake' })];

  it('from the home team page: not found', async () => {
    const h = harness();
    assert.equal((await h.report({ seen: SEEN }, TEAM_H)).status, 404);
    assert.equal(h.calls.rpc.length, 0);
  });

  it('a coach of both teams has no report of their own score', async () => {
    const h = harness({ links: [...away, seat(TEAM_H)] });
    const r = await h.report({ seen: SEEN });
    assert.equal(r.status, 409);
    assert.equal(h.calls.rpc.length, 0);
  });

  it('a note over 280 characters is refused; a note is trimmed; an empty one is none', async () => {
    const h = harness({ links: away });
    assert.equal((await h.report({ note: 'x'.repeat(281), seen: SEEN })).status, 400);
    assert.equal((await h.report({ note: '  We had it 6–4.  ', seen: SEEN })).status, 200);
    assert.equal(h.calls.rpc[0].args.p_note, 'We had it 6–4.');
    assert.equal(h.calls.rpc[0].args.p_name, 'Sam Blake');
    assert.equal(h.calls.rpc[0].args.p_team, TEAM_A);
    await h.report({ note: '   ', seen: SEEN });
    assert.equal(h.calls.rpc[1].args.p_note, null);
  });

  it('a score already looked at is closed', async () => {
    const r = await harness({ links: away, refusal: 'closed' }).report({ seen: SEEN });
    assert.equal(r.status, 409);
    assert.equal((await r.json()).error, W.err.closed);
  });
});

describe('the league admin keeps it', () => {
  it('a malformed game id is not found before the database', async () => {
    const h = harness();
    assert.equal((await h.keep({ seen: SEEN }, 'nope')).status, 404);
    assert.equal(h.calls.rpc.length, 0);
  });

  it('keeps, snapshotting the staff name', async () => {
    const h = harness();
    assert.equal((await h.keep({ seen: SEEN })).status, 200);
    assert.deepEqual(h.calls.rpc[0], { name: 'league_game_score_keep', args: { p_org: 'org', p_game: GAME, p_user: 'staff', p_name: 'Sam Lee', p_seen: SEEN } });
  });

  it('a window out of date reads again', async () => {
    for (const refusal of ['changed', 'nothing']) {
      const r = await harness({ refusal }).keep({ seen: SEEN });
      assert.equal(r.status, 409);
      assert.equal((await r.json()).code, 'changed');
    }
  });
});
