import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { billingTestLoader } from './_billing-test-loader.ts';

/**
 * Club Website Stage 2, Session 2D (D1, owner 2026-11-26): a rep game at a park with no diamond, marked by two of its
 * diamonds, keeps its mark until the last reopens, and its coach is told EXACTLY ONCE. The real Reopen telling
 * (`reopenTold`, `reopenCoachEmails`) runs against an in-memory database; only the send and the coaches are stood in.
 */
type Row = Record<string, unknown>;
const FAR = '2099-11-29T05:00:00Z';

function harness(o: { sendFails?: () => boolean } = {}) {
  const closures: Row[] = ['A', 'B'].map((id, i) => ({
    id, org_id: 'org', scope: 'diamond', org_venue_id: 'lions', place_name: 'Lions Park', facility_name: `Diamond ${i * 2 + 1}`,
    first_day: '2099-11-28', last_day: '2099-11-28', press_seq: i, reopened_at: null, ends_at: FAR,
  }));
  const marks: Row[] = closures.map((c, i) => ({
    id: `mark-${i}`, org_id: 'org', closure_id: c.id, event_id: 'game', team_id: 'team', marked_starts_at: '2099-11-28T17:30:00Z',
    marked_org_venue_id: 'lions', marked_facility_id: null, marked_place_id: null, marked_location: 'Lions Park',
    coach_emailed_at: '2099-11-20T00:00:00Z', reopen_told_at: null,
  }));
  const tables: Record<string, Row[]> = {
    org_place_closures: closures,
    rep_event_closure_marks: marks,
    rep_team_events: [{ id: 'game', starts_at: '2099-11-28T17:30:00Z', status: 'scheduled', org_venue_id: 'lions', org_venue_facility_id: null, place_id: null, location: 'Lions Park', opponent: 'Marlow Heights' }],
    rep_teams: [{ id: 'team', name: 'U13 Ospreys' }],
  };
  const from = (table: string) => {
    const filters: ((r: Row) => boolean)[] = [];
    let patch: Row | null = null;
    let slice: [number, number] | null = null;
    const run = () => {
      const hit = tables[table].filter(r => filters.every(f => f(r)));
      if (patch) { hit.forEach(r => Object.assign(r, patch)); return { data: hit.map(r => ({ id: r.id })), error: null }; }
      const data = hit.map(r => (table === 'rep_event_closure_marks' ? { ...r, org_place_closures: { ...closures.find(c => c.id === r.closure_id) } } : { ...r }));
      return { data: slice ? data.slice(slice[0], slice[1] + 1) : data, error: null };
    };
    const q = {
      select: () => q,
      update: (p: Row) => { patch = p; return q; },
      eq: (k: string, v: unknown) => { filters.push(r => r[k] === v); return q; },
      in: (k: string, v: unknown[]) => { filters.push(r => v.includes(r[k])); return q; },
      is: (k: string, v: unknown) => { filters.push(r => r[k] === v); return q; },
      order: () => q,
      range: (a: number, b: number) => { slice = [a, b]; return q; },
      // Resolved on a later tick, as a real read or write is, so two runs interleave.
      then: (ok: (v: unknown) => unknown, no: (e: unknown) => unknown) => Promise.resolve().then(run).then(ok, no),
    };
    return q;
  };
  const sent: { severalDiamonds: boolean }[] = [];
  const load = billingTestLoader({
    './supabase-admin': { supabaseAdmin: { from } },
    './db': { getLeagueSeasonById: async () => null, resolveCoachUserIdentities: async () => new Map() },
    './venue-clash-lookup': { getClubVenueLibrary: async () => ({ venues: [] }) },
    './league-game-changes-server': { childrenOnTeams: async () => [] },
    './league-rainout-send': { sendRainout: async () => [] },
    './club-team-board': { loadHeadCoaches: async () => new Map([['team', { people: [{ name: 'Nadia', email: 'coach@example.test' }] }]]) },
    './coach-membership': { listActiveStaffForTeams: async () => [] },
    './place-closures-server': { placeClosureSource: async () => null },
    './place-closure-mail': {
      sendClosureCoachEmails: async (p: { teams: { teamId: string; games: { reopenPark?: string; markIds: string[] }[] }[] }) =>
        p.teams.map(t => {
          const ok = !o.sendFails?.();
          if (ok) sent.push(...t.games.map(g => ({ severalDiamonds: g.reopenPark === 'Lions Park' })));
          return { teamId: t.teamId, sent: ok, markIds: [] };
        }),
    },
  });
  const server = load('lib/place-closure-window-server.ts') as typeof import('../../lib/place-closure-window-server');
  const org = { id: 'org', name: 'Kestrel Bay', slug: 'kestrel', planId: 'club' } as never;
  const actor = { id: 'u', email: 'dana@example.test', role: 'admin' as const, name: 'Dana' };
  /** Reopen as the route does it: the stamp, then whom to tell, then the emails. */
  const stamp = (id: string) => { const c = closures.find(x => x.id === id)!; c.reopened_at ??= '2099-11-28T12:00:00Z'; };
  const tell = async (id: string) => server.reopenCoachEmails({ ...(await server.reopenTold('org', id)), org, actor, closureId: id });
  const reopen = async (id: string) => { stamp(id); return tell(id); };
  return { reopen, stamp, tell, sent, marks, closures };
}

describe('D1 · Reopen tells a game\'s coach once, when the last of its diamonds reopens', () => {
  it('one diamond, then the other: nothing, then one email in /legal\'s park words', async () => {
    const h = harness();
    assert.equal((await h.reopen('A')).teams, 0);
    assert.equal(h.sent.length, 0);
    assert.equal((await h.reopen('B')).teams, 1);
    assert.deepEqual(h.sent, [{ severalDiamonds: true }]);
  });
  it('Reopen pressed again on either, later (a stale tab, a retry), emails nobody', async () => {
    const h = harness();
    await h.reopen('A'); await h.reopen('B');
    await h.reopen('A'); await h.reopen('B');
    assert.equal(h.sent.length, 1);
  });
  it('both diamonds reopened at the same moment: exactly one email', async () => {
    const h = harness();
    h.stamp('A'); h.stamp('B');
    await Promise.all([h.tell('A'), h.tell('B')]);
    assert.equal(h.sent.length, 1);
  });
  it('a failed email gives the claim back, so pressing again sends it', async () => {
    let fail = true;
    const h = harness({ sendFails: () => fail });
    await h.reopen('A'); await h.reopen('B');
    assert.equal(h.sent.length, 0);
    assert.ok(h.marks.every(m => m.reopen_told_at === null));
    fail = false;
    await h.reopen('B');
    assert.equal(h.sent.length, 1);
  });
  it('a closure past its last day holds nothing: reopening the longer one tells the coach', async () => {
    const h = harness();
    h.closures[0].ends_at = '2020-01-01T05:00:00Z';
    assert.equal((await h.reopen('B')).teams, 1, 'A is over: nothing could ever reopen it, so B is the last');
    assert.equal(h.sent.length, 1);
  });
});
