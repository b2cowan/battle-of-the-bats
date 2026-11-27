import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CLOSE_WORDS as W, mayCloseEveryPlace } from '../../lib/place-closure-window.ts';
import { billingTestLoader } from './_billing-test-loader.ts';

/**
 * Club Website Stage 2, Session 2B: Close a place's routes run for real with only the auth and database boundary replaced
 * (K1 who, K14 the gate, the refusals in the window's words), and the guards that hold the window, the doors and the email
 * to the rulings.
 */
const ROOT = join(import.meta.dirname, '..', '..');
/** A source as LF text: a Windows checkout writes CRLF, and the guards' patterns read lines. */
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const DAY = '2099-11-28';

type Press = Record<string, unknown>;
/** The club's own season, as the T1 server check finds it (`getLeagueSeasonById`). */
const SEASON = U(50);
function harness(o: { plan?: string; role?: string; refusal?: string | null; replay?: boolean; addons?: string[]; venues?: number } = {}) {
  const calls = { press: [] as Press[], sends: [] as unknown[], reopen: [] as { ids: string[] }[], preview: [] as { role: string; ids: string[] }[] };
  const showing = [{ id: U(9), scope: 'place', venueId: U(1), placeName: 'Lions Park', facilityName: null, firstDay: DAY, lastDay: DAY,
    verb: 'postponed', closedAt: `${DAY}T12:10:00Z`, closedBy: 'Dana Reyes' }];
  const load = billingTestLoader({
    '@/lib/api-auth': {
      getAuthContextWithScope: async () => ({
        org: { id: 'org', name: 'Kestrel Bay', slug: 'kestrel', planId: o.plan ?? 'club', subscriptionStatus: 'active', enabledAddons: o.addons ?? [] },
        user: { id: 'user', email: 'dana@example.test' }, role: o.role ?? 'admin', capabilities: null, assignedTournamentIds: null,
      }),
      unauthorized: () => Response.json({ error: 'Unauthorized' }, { status: 401 }),
      forbidden: () => Response.json({ error: 'Forbidden' }, { status: 403 }),
    },
    '@/lib/observability': { withObservability: (handler: unknown) => handler },
    '@/lib/db': { resolveCoachUserIdentities: async () => new Map([['user', { displayName: 'Dana Reyes', email: 'dana@example.test' }]]) },
    '@/lib/place-closures-server': {
      pressPlaceClosure: async (p: Press) => {
        calls.press.push(p);
        if (o.refusal === 'changed') return { refusal: 'changed', changed: [U(5)] };
        if (o.refusal) return { refusal: o.refusal };
        return { refusal: null, closureIds: [U(9)], rainoutIds: [U(8)], marks: 1, replay: !!o.replay };
      },
    },
    '@/lib/place-closure-window-server': {
      closeFrame: async () => ({ today: DAY, venues: Array.from({ length: o.venues ?? 0 }, (_, i) => ({ id: U(60 + i), name: `P${i}`, facilities: [], allDiamonds: false })), canAll: true, rep: true }),
      mayCloseEveryPlaceHere: async (_org: unknown, role: Parameters<typeof mayCloseEveryPlace>[0], venues: number, seasonId: unknown) =>
        mayCloseEveryPlace(role, { noPlaces: venues === 0, fromSeason: seasonId === SEASON }),
      closeSource: async () => ({ places: [], rep: [{ id: U(3) }] }),
      seasonPlacesOn: async () => [],
      showingClosureFacts: async () => showing.map(closure => ({ closure, calledOff: [], markEvents: [] })),
      sendAfterPress: async (p: unknown) => { calls.sends.push(p); return { league: { verb: 'postponed', games: 0, teams: 0, divisions: [], unsent: false }, rep: { games: 1, held: 0, teams: [{ teamId: 'ospreys-id', name: 'U13 Ospreys', reach: 'head', sent: true }] } }; },
      reopenPreview: async (_org: unknown, role: string, ids: string[]) => {
        calls.preview.push({ role, ids });
        return { marksOff: 1, coaches: 1, team: null, kept: 0, keptWhile: [], stillWaiting: 4, seasonIds: ['s1'] };
      },
      reopenClosures: async (p: { ids: string[] }) => {
        calls.reopen.push(p);
        return { refusal: null, reopened: p.ids, failed: [], coaches: 1, stillWaiting: 4, seasonIds: ['s1'] };
      },
    },
  });
  const main = load('app/api/admin/org/place-closures/route.ts') as Record<string, (req: Request) => Promise<Response>>;
  const set = load('app/api/admin/org/place-closures/reopen/route.ts') as Record<string, (req: Request) => Promise<Response>>;
  const url = (qs = '') => `http://localhost/api/admin/org/place-closures?orgSlug=kestrel${qs}`;
  const reopenUrl = (qs = '') => `http://localhost/api/admin/org/place-closures/reopen?orgSlug=kestrel${qs}`;
  return {
    calls,
    get: (qs = '') => main.GET(new Request(url(qs))),
    press: (body: unknown) => main.POST(new Request(url(), { method: 'POST', body: JSON.stringify(body) })),
    reopen: (ids: unknown = [U(9)]) => set.POST(new Request(reopenUrl(), { method: 'POST', body: JSON.stringify({ ids }) })),
    preview: (ids = U(9)) => set.GET(new Request(reopenUrl(`&ids=${ids}`))),
  };
}
const body = (o: Record<string, unknown> = {}) => ({
  pressKey: U(77), places: [{ venueId: U(1), facilityId: null }], firstDay: DAY, lastDay: DAY, verb: 'postponed', line: 'The fields are flooded.',
  league: [{ id: U(2), seen: '2099-11-20T00:00:00Z' }], rep: [{ id: U(3), seen: '2099-11-20T00:00:00Z' }], links: [], ...o,
});

describe('K14 · the places gate, on the server', () => {
  it('below League Plus every door answers 404 and nothing is pressed or reopened', async () => {
    for (const plan of ['tournament', 'tournament_plus', 'team']) {
      const h = harness({ plan });
      assert.equal((await h.get()).status, 404, plan);
      assert.equal((await h.press(body())).status, 404, plan);
      assert.equal((await h.reopen()).status, 404, plan);
      assert.equal(h.calls.press.length + h.calls.reopen.length, 0);
    }
  });
  it('League Plus, Club and Club · Association press', async () => {
    for (const plan of ['league', 'club', 'club_large']) {
      const h = harness({ plan, ...(plan === 'league' ? {} : {}) });
      const r = await h.press(body(plan === 'league' ? { rep: [] } : {}));
      assert.equal(r.status, 200, plan);
    }
  });
  it('the rep steps are refused where the club runs no rep teams (League Plus)', async () => {
    const h = harness({ plan: 'league' });
    assert.equal((await h.press(body())).status, 400);
    assert.equal(h.calls.press.length, 0);
  });
});

describe('K1 · who', () => {
  it('only the Rainout\'s people: a coach, staff or the treasurer is refused', async () => {
    for (const role of ['coach', 'staff', 'treasurer', 'league_registrar']) {
      const h = harness({ role });
      assert.equal((await h.press(body())).status, 403, role);
      assert.equal((await h.reopen()).status, 403, role);
    }
  });
  it('a house league admin presses, marks rep games, but never closes every place or links a rep game', async () => {
    assert.equal((await harness({ role: 'league_admin' }).press(body())).status, 200);
    assert.equal((await harness({ role: 'league_admin' }).press(body({ places: [{ venueId: null, facilityId: null }] }))).status, 403);
    assert.equal((await harness({ role: 'league_admin' }).press(body({ links: [{ kind: 'rep', id: U(4), venueId: U(1) }] }))).status, 403);
    assert.equal((await harness({ role: 'league_admin' }).get('&places=all&first=' + DAY)).status, 403);
  });
  it('T1 · in a club with no places, a house league admin closes every place from a season — and only so', async () => {
    const all = { places: [{ venueId: null, facilityId: null }] };
    assert.equal((await harness({ role: 'league_admin' }).press(body({ ...all, seasonId: SEASON }))).status, 200);
    assert.equal((await harness({ role: 'league_admin' }).get(`&places=all&first=${DAY}&from=${SEASON}`)).status, 200);
    assert.equal((await harness({ role: 'league_admin' }).press(body({ ...all, seasonId: U(51) }))).status, 403, 'not the club\'s season');
    assert.equal((await harness({ role: 'league_admin', venues: 2 }).press(body({ ...all, seasonId: SEASON }))).status, 403, 'K1 where places are listed');
    assert.equal((await harness({ role: 'league_admin', venues: 2 }).get(`&places=all&first=${DAY}&from=${SEASON}`)).status, 403);
    assert.equal((await harness({ role: 'admin', venues: 2 }).press(body(all))).status, 200, 'an admin, as before');
    // The window offers "All our fields" exactly where the server allows it.
    const canAll = async (role: string, qs: string, venues = 0) => (await (await harness({ role, venues }).get(qs)).json()).frame.canAll;
    assert.equal(await canAll('league_admin', `&from=${SEASON}`), true);
    assert.equal(await canAll('league_admin', ''), false);
    assert.equal(await canAll('league_admin', `&from=${SEASON}`, 2), false);
    assert.equal(await canAll('owner', '', 2), true);
  });
  it('a house league admin marks only the rep games the window offers them (on the place, not started)', async () => {
    const h = harness({ role: 'league_admin' });
    assert.equal((await h.press(body({ rep: [{ id: U(6), seen: '2099-11-20T00:00:00Z' }] }))).status, 403);
    assert.equal(h.calls.press.length, 0);
  });
  it('a house league admin reads the press\'s rep result as counts: no team name or id leaves the server', async () => {
    const d = await (await harness({ role: 'league_admin' }).press(body())).json();
    assert.equal(d.rep.teams[0].name, '');
    assert.notEqual(d.rep.teams[0].teamId, 'ospreys-id');
    const a = await (await harness({ role: 'admin' }).press(body())).json();
    assert.equal(a.rep.teams[0].name, 'U13 Ospreys');
  });
  it('the Venue library\'s read carries the closures and their rows, and no team at all (S4)', async () => {
    const d = await (await harness({ role: 'league_admin' }).get()).json();
    assert.equal(d.closures.length, 1);
    assert.equal(d.rows.length, 1);
    assert.equal(d.rows[0].title, 'Lions Park');
    assert.doesNotMatch(JSON.stringify(d.rows), /calledOff|markEvents/, 'the game ids stay on the server');
    assert.doesNotMatch(JSON.stringify(d.closures), /markTeam|Ospreys/);
  });
  it('Reopen\'s figures are counted on the server for the person asking (K1: the role decides the team\'s name)', async () => {
    const h = harness({ role: 'league_admin' });
    assert.equal((await h.preview(`${U(9)},${U(10)}`)).status, 200);
    assert.deepEqual(h.calls.preview, [{ role: 'league_admin', ids: [U(9), U(10)] }]);
    assert.match(read('lib/place-closure-window-server.ts'), /if \(teams\.length === 1 && seesEveryProgram\(role\)\)/);
  });
});

describe('the press', () => {
  it('a malformed body never reaches the database step', async () => {
    for (const bad of [{ pressKey: 'x' }, { verb: 'held' }, { lastDay: '2099-12-30' }, { line: 'x'.repeat(121) }, { league: [{ id: 'x', seen: 'y' }] }, { places: [] }]) {
      const h = harness();
      assert.equal((await h.press(body(bad))).status, 400, JSON.stringify(bad));
      assert.equal(h.calls.press.length, 0);
    }
  });
  it('"past" is the press\'s own refusal, decided after its replay check (a retried press after midnight still replays)', async () => {
    const h = harness({ refusal: 'past' });
    const r = await h.press(body({ firstDay: '2020-01-01', lastDay: '2020-01-01' }));
    assert.equal(r.status, 409);
    assert.equal(h.calls.press.length, 1);
    assert.equal(h.calls.sends.length, 0);
    assert.equal((await harness({ replay: true }).press(body({ firstDay: '2020-01-01', lastDay: '2020-01-01' }))).status, 200);
  });
  it('the database\'s refusals come back in the window\'s words, and nothing is sent', async () => {
    const want: Record<string, [number, string]> = {
      changed: [409, W.errChanged], past: [409, W.errPast], draft: [409, W.errDraft], finished: [409, W.errFinished], not_found: [404, W.errNotFound],
    };
    for (const [refusal, [status, words]] of Object.entries(want)) {
      const h = harness({ refusal });
      const r = await h.press(body());
      assert.equal(r.status, status, refusal);
      assert.equal((await r.json()).error, words);
      assert.equal(h.calls.sends.length, 0);
    }
  });
  it('K5 · a press that wrote sends at once (no hold), with the admin as the sender', async () => {
    const h = harness();
    const r = await h.press(body());
    assert.equal(r.status, 200);
    assert.equal(h.calls.sends.length, 1);
    const sent = h.calls.sends[0] as { actor: { name: string; email: string }; closureIds: string[]; rainoutIds: string[] };
    assert.deepEqual(sent.closureIds, [U(9)]);
    assert.deepEqual(sent.rainoutIds, [U(8)]);
    assert.equal(sent.actor.name, 'Dana Reyes');
    assert.equal((h.calls.press[0] as { line: string }).line, 'The fields are flooded.');
  });
});

describe('K11 · Reopen, a set at a time (S5, S6)', () => {
  it('one press over the set, its figures back; a malformed set never reaches the database', async () => {
    const h = harness();
    const r = await h.reopen([U(9), U(10), U(9)]);
    assert.equal(r.status, 200);
    const d = await r.json();
    assert.equal(d.coaches, 1);
    assert.equal(d.stillWaiting, 4);
    assert.deepEqual(h.calls.reopen.map(c => c.ids), [[U(9), U(10)]], 'once, each closure once');
    for (const ids of [['nope'], [], 'x', Array.from({ length: 101 }, (_, i) => U(100 + i))]) {
      const bad = harness();
      assert.equal((await bad.reopen(ids)).status, 400, JSON.stringify(ids).slice(0, 40));
      assert.equal(bad.calls.reopen.length, 0);
    }
    assert.equal((await harness().preview('nope')).status, 400);
  });
  it('the old one-closure door is gone: every Reopen window uses the set\'s', () => {
    assert.doesNotMatch(read('components/admin/kit/club/places/ReopenPlaceWindow.tsx'), /place-closures\/\$\{/);
    assert.match(read('components/admin/kit/club/places/ReopenPlaceWindow.tsx'), /place-closures\/reopen\?/);
  });
});

describe('the guards', () => {
  const WINDOW = read('components/admin/kit/club/places/ClosePlaceWindow.tsx');
  const PAGE = read('app/[orgSlug]/admin/house-league/seasons/[seasonId]/schedule/page.tsx');
  const MAIL = read('lib/place-closure-mail-words.ts');
  const SEND = read('lib/place-closure-mail.ts');
  it('K15 · the house league button opens Close a place, on the places gate, under that name (owner 2026-11-26)', () => {
    assert.match(PAGE, /<CloudRain size=\{16\} aria-hidden \/>\{CLOSE_WORDS\.door\}/);
    assert.match(PAGE, /import ClosePlaceWindow from '@\/components\/admin\/kit\/club\/places\/ClosePlaceWindow'/);
    assert.doesNotMatch(PAGE, /RainoutWindow/);
    assert.match(PAGE, /hasOrgVenueLibrary\(currentOrg\.planId\)/);
    assert.match(PAGE, /<ClosePlaceWindow[\s\S]*?season=\{season \?/);
  });
  it('K5 · the window offers no hold: no "Email the families now", no emailNow', () => {
    assert.doesNotMatch(WINDOW, /emailNow|Email the families now|W\.email\b/);
  });
  it('K10 · the coach email writes no anchor, carries no unsubscribe, and goes from "{Club} via FieldLogicHQ" with the admin as reply-to', () => {
    assert.doesNotMatch(MAIL, /<a[\s>]|href/);
    assert.match(MAIL, /fromName: MAIL\.from\(i\.club\)/);
    assert.match(SEND, /replyTo: p\.actor\.email \?\? null, fromName: mail\.fromName/);
    assert.match(SEND, /kind: 'place_closure_coach'/);
  });
  it('K16 · the admin\'s line never reaches the strip: the preview is built from place words and days', () => {
    assert.match(WINDOW, /closePreview\(source\.places, firstDay/);
    assert.doesNotMatch(read('lib/place-closure-window.ts').split('export function closePreview')[1].split('\n}\n')[0], /line/);
    assert.doesNotMatch(read('lib/place-closures.ts').split('export function toStripClosure')[1].split('\n}\n')[0], /line/);
  });
  it('T1 · every place at once is asked of the server on the window\'s read AND the press (the press checks no role)', () => {
    const ROUTE = read('app/api/admin/org/place-closures/route.ts');
    assert.match(ROUTE, /const canAll = await mayCloseEveryPlaceHere\(ctx\.org, ctx\.role, read\.venues\.length, q\.get\('from'\)\);\n {2}const frame = \{ \.\.\.read, canAll \};/);
    assert.match(ROUTE, /if \(places\[0\]\.venueId === null && !canAll\) return forbidden\(\);/);
    assert.match(ROUTE, /if \(!\(await mayCloseEveryPlaceHere\(ctx\.org, ctx\.role, venues, body\.seasonId\)\)\) return forbidden\(\);/);
    const SERVER = read('lib/place-closure-window-server.ts');
    assert.match(SERVER, /if \(venues > 0 \|\| typeof seasonId !== 'string' \|\| !isUuid\(seasonId\)\) return false;/);
    assert.match(SERVER, /getLeagueSeasonById\(seasonId, org\.id\)/, 'the club\'s own season');
    assert.match(WINDOW, /const allOnly = noPlaces && frame!\.canAll;/, 'the window offers what the server says');
    assert.match(WINDOW, /\$\{seasonId \? `&from=\$\{seasonId\}` : ''\}/, 'the frame read names the season');
  });
  it('K13 · nothing here moves a tournament game: the route never writes `games`, the window only links its Rain delay', () => {
    for (const f of ['app/api/admin/org/place-closures/route.ts', 'lib/place-closure-window-server.ts']) {
      assert.doesNotMatch(read(f), /from\('games'\)\s*\.(update|insert|delete|upsert)/);
    }
    assert.match(WINDOW, /tool: 'rain-delay', day: firstDay/);
  });
  it('the spelling check holds "Rainout" as one word (K15)', () => {
    assert.match(read('scripts/check-spelling-consistency.mjs'), /id: 'rainout-one-word',\s+pattern: \/\\b\[Rr\]ain\[- \]outs\?\\b\/g/);
  });
});
