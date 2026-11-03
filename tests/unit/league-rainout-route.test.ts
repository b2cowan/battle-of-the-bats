import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isUuid } from '../../lib/utils.ts';
import { RAIN_WORDS as W } from '../../lib/league-rainout.ts';
import { billingTestLoader } from './_billing-test-loader.ts';

/**
 * House League 9e-2 Part 3: the Rainout routes run for real, with only the auth and database boundary replaced. Every
 * refusal is decided before the all-or-nothing database function is called, and the database's own refusals come back in
 * the copy's words.
 */
const G1 = '00000000-0000-4000-8000-000000000001';
const G2 = '00000000-0000-4000-8000-000000000002';
const DAY = '2027-06-17';
const AT = `${DAY}T22:00:00+00:00`;

type Row = { id: string; division_id: string; home_team_id: string; away_team_id: string; status: string; scheduled_at: string | null;
  league_divisions: { schedule_published_at: string | null } };
const row = (id: string, o: Partial<Row> = {}): Row => ({
  id, division_id: 'd1', home_team_id: `${id}-h`, away_team_id: `${id}-a`, status: 'scheduled', scheduled_at: AT,
  league_divisions: { schedule_published_at: '2027-05-01T00:00:00Z' }, ...o,
});

function harness(o: { rows?: Row[]; refusal?: string | null; plan?: string; backAnswer?: string | null } = {}) {
  const calls = { rpc: [] as { name: string; args: Record<string, unknown> }[], reads: 0, sends: [] as unknown[] };
  const chain = (result: unknown) => {
    const c: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'in']) c[m] = () => c;
    c.then = (resolve: (v: unknown) => void) => resolve(result);
    return c;
  };
  const load = billingTestLoader({
    '@/lib/api-auth': { getAuthContextWithRole: async () => ({ org: { id: 'org', planId: o.plan ?? 'club' }, user: { id: 'user' } }) },
    '@/lib/house-league-gate': { houseLeagueRefusal: () => null },
    '@/lib/db': { getLeagueSeasonById: async () => ({ id: 'season', name: '2027 Season' }) },
    '@/lib/observability': { withObservability: (handler: unknown) => handler },
    '@/lib/supabase-admin': { supabaseAdmin: {
      from: () => { calls.reads++; return chain({ data: o.rows ?? [row(G1), row(G2)], error: null }); },
      rpc: async (name: string, args: Record<string, unknown>) => {
        calls.rpc.push({ name, args });
        if (name === 'league_rainout_put_back') {
          if (!isUuid(args.p_rainout)) throw new Error('invalid input syntax for type uuid');
          return { data: o.backAnswer ?? null, error: null };
        }
        const refusal = o.refusal ?? null;
        return { data: [{ refusal, rainout: refusal ? null : 'r1' }], error: null };
      },
    } },
    '@/lib/league-rainout-server': {
      rainoutSource: async () => ({ today: DAY }),
      rainoutOf: async () => ({ id: 'r1', game_ids: [G1, G2], division_ids: ['d1'], change_ids: ['c1', 'c2'], put_back_at: null }),
    },
    '@/lib/league-rainout-send': { sendRainout: async (p: unknown) => { calls.sends.push(p); return [{ divisionId: 'd1', outcome: 'told', emails: 9 }]; } },
  });
  const { POST, GET } = load('app/api/admin/house-league/seasons/[seasonId]/schedule/rainout/route.ts') as Record<string,
    (req: Request, ctx: { params: Promise<{ seasonId: string }> }) => Promise<Response>>;
  const back = (load('app/api/admin/house-league/seasons/[seasonId]/schedule/rainout/[rainoutId]/route.ts') as Record<string,
    (req: Request, ctx: { params: Promise<{ seasonId: string; rainoutId: string }> }) => Promise<Response>>).POST;
  const press = (body: unknown) => POST(new Request('http://localhost/x?orgSlug=club', { method: 'POST', body: JSON.stringify(body) }),
    { params: Promise.resolve({ seasonId: 'season' }) });
  const putBack = (rainoutId: string, action = 'back') => back(new Request('http://localhost/x?orgSlug=club', { method: 'POST', body: JSON.stringify({ action }) }),
    { params: Promise.resolve({ seasonId: 'season', rainoutId }) });
  const read = () => GET(new Request('http://localhost/x?orgSlug=club'), { params: Promise.resolve({ seasonId: 'season' }) });
  return { calls, press, putBack, read };
}
const body = (o: Record<string, unknown> = {}) => ({
  verb: 'postponed', day: DAY, line: 'Rain: the fields are closed tonight.', emailNow: false,
  games: [{ id: G1, seen: '2027-06-01T00:00:00.123456+00:00' }, { id: G2, seen: '2027-06-01T00:00:00.123456+00:00' }], ...o,
});

describe('the Rainout press refuses before the database function', () => {
  it('a line over 120 characters', async () => {
    const h = harness();
    const r = await h.press(body({ line: 'x'.repeat(121) }));
    assert.equal(r.status, 400);
    assert.equal(h.calls.rpc.length, 0);
  });
  it('a line of 120 characters, and spaces that collapse into a shorter one, are fine', async () => {
    const h = harness();
    assert.equal((await h.press(body({ line: 'x'.repeat(120) }))).status, 200);
    assert.equal((await h.press(body({ line: `${'x'.repeat(100)}${' '.repeat(40)}y` }))).status, 200);
  });
  it('a malformed game id, a bad verb, a bad day', async () => {
    const h = harness();
    assert.equal((await h.press(body({ games: [{ id: 'not-a-uuid', seen: 'x' }] }))).status, 400);
    assert.equal((await h.press(body({ verb: 'moved' }))).status, 400);
    assert.equal((await h.press(body({ day: 'tonight' }))).status, 400);
    assert.equal(h.calls.rpc.length, 0);
  });
  it('a null entry or an unreadable stamp is a 400, a day already gone is refused (review 2026-11-03)', async () => {
    const h = harness();
    assert.equal((await h.press(body({ games: [null] }))).status, 400);
    assert.equal((await h.press(body({ games: [{ id: G1, seen: 'not a time' }] }))).status, 400);
    const past = await h.press(body({ day: '2020-01-01' }));
    assert.equal(past.status, 409);
    assert.equal((await past.json()).error, W.errChanged);
    assert.equal(h.calls.rpc.length, 0);
  });
  it('no game ticked', async () => {
    const h = harness();
    const r = await h.press(body({ games: [] }));
    assert.equal(r.status, 400);
    assert.equal((await r.json()).error, W.tickOne);
  });
  it('a game from another season (or org) is not found', async () => {
    const h = harness({ rows: [row(G1)] });
    assert.equal((await h.press(body())).status, 404);
    assert.equal(h.calls.rpc.length, 0);
  });
  it('a draft division\'s game', async () => {
    const h = harness({ rows: [row(G1), row(G2, { league_divisions: { schedule_published_at: null } })] });
    const r = await h.press(body());
    assert.equal(r.status, 409);
    assert.equal((await r.json()).code, 'draft');
    assert.equal(h.calls.rpc.length, 0);
  });
  it('a game already postponed, or on another day', async () => {
    for (const bad of [row(G2, { status: 'postponed' }), row(G2, { scheduled_at: '2027-06-18T22:00:00+00:00' })]) {
      const h = harness({ rows: [row(G1), bad] });
      const r = await h.press(body());
      assert.equal(r.status, 409);
      assert.deepEqual(await r.json(), { error: W.errChanged, code: 'changed' });
      assert.equal(h.calls.rpc.length, 0);
    }
  });
  it('a plan without the feature: absent, never an upgrade sentence', async () => {
    const h = harness({ plan: 'tournament' });
    const r = await h.press(body());
    assert.equal(r.status, 404);
    assert.doesNotMatch(JSON.stringify(await r.json()), /plus|upgrade|plan/i);
    assert.equal((await h.read()).status, 404);
    assert.equal(h.calls.reads, 0);
  });
});

describe('the press, and what follows', () => {
  it('a game changed under the window: the database\'s `changed` in the copy\'s words', async () => {
    const h = harness({ refusal: 'changed' });
    const r = await h.press(body());
    assert.equal(r.status, 409);
    assert.equal((await r.json()).error, W.errChanged);
  });
  it('a finished season: 423', async () => {
    const r = await harness({ refusal: 'finished' }).press(body());
    assert.equal(r.status, 423);
    assert.equal((await r.json()).error, W.errFinished('2027 Season'));
  });
  it('held: the line goes to the database trimmed, nothing is sent', async () => {
    const h = harness();
    const r = await h.press(body({ line: '  Rain:\n the fields are closed tonight.  ' }));
    assert.equal(r.status, 200);
    const json = await r.json();
    assert.equal(json.held, true);
    assert.equal(json.games, 2);
    assert.equal(json.teams, 4);
    assert.equal(h.calls.rpc[0].args.p_line, 'Rain: the fields are closed tonight.');
    assert.equal(h.calls.sends.length, 0);
  });
  it('email now: one send for the rainout\'s divisions, after the save', async () => {
    const h = harness();
    const json = await (await h.press(body({ emailNow: true }))).json();
    assert.equal(json.held, false);
    assert.equal(h.calls.sends.length, 1);
    assert.deepEqual((h.calls.sends[0] as { divisionIds: string[] }).divisionIds, ['d1']);
    assert.equal(json.divisions[0].outcome, 'told');
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
  it('Send the changes from the held sheet sends the rainout\'s divisions', async () => {
    const h = harness();
    const r = await h.putBack(G1, 'send');
    assert.equal(r.status, 200);
    assert.equal(h.calls.sends.length, 1);
  });
});
