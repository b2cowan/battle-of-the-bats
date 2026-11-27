import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { billingTestLoader } from './_billing-test-loader.ts';
import { COACH_MAIL, type CoachMailGame } from '../../lib/place-closure-mail-words.ts';

/**
 * Club Website Stage 2, Session 2D (D1, owner 2026-11-26): a rep game at a park with no diamond, marked by two of its
 * diamonds, keeps its mark until the last reopens, and its coach is told EXACTLY ONCE. The real Reopen telling
 * (`reopenTold`, `reopenCoachEmails`) runs against an in-memory database; only the send and the coaches are stood in.
 */
type Row = Record<string, unknown>;
const FAR = '2099-11-29T05:00:00Z';

/**
 * `apart`: the game the two diamonds hold is instead TWO games of one team, one on each diamond (S5: one email listing
 * both). `stampFails`: the closure whose stamp throws (a set reopen's part failure).
 */
function harness(o: { sendFails?: () => boolean; apart?: boolean; stampFails?: string } = {}) {
  const closures: Row[] = ['A', 'B'].map((id, i) => ({
    id, org_id: 'org', scope: 'diamond', org_venue_id: 'lions', place_name: 'Lions Park', facility_name: `Diamond ${i * 2 + 1}`,
    first_day: '2099-11-28', last_day: '2099-11-28', press_seq: i, reopened_at: null, ends_at: FAR,
  }));
  const games = o.apart ? ['game-1', 'game-3'] : ['game', 'game'];
  const marks: Row[] = closures.map((c, i) => ({
    id: `mark-${i}`, org_id: 'org', closure_id: c.id, event_id: games[i], team_id: 'team', marked_starts_at: `2099-11-28T1${7 + i}:30:00Z`,
    marked_org_venue_id: 'lions', marked_facility_id: o.apart ? `f${i * 2 + 1}` : null, marked_place_id: null, marked_location: 'Lions Park',
    coach_emailed_at: '2099-11-20T00:00:00Z', reopen_told_at: null,
  }));
  if (!o.apart) marks[1].marked_starts_at = marks[0].marked_starts_at;
  const events = o.apart
    ? games.map((id, i) => ({ id, starts_at: `2099-11-28T1${7 + i}:30:00Z`, status: 'scheduled', org_venue_id: 'lions', org_venue_facility_id: `f${i * 2 + 1}`, place_id: null, location: 'Lions Park', opponent: 'Marlow Heights' }))
    : [{ id: 'game', starts_at: '2099-11-28T17:30:00Z', status: 'scheduled', org_venue_id: 'lions', org_venue_facility_id: null, place_id: null, location: 'Lions Park', opponent: 'Marlow Heights' }];
  const tables: Record<string, Row[]> = {
    org_place_closures: closures,
    rep_event_closure_marks: marks,
    rep_team_events: events,
    rep_teams: [{ id: 'team', name: 'U13 Ospreys' }],
    org_venues: [{ id: 'lions', org_id: 'org', name: 'Lions Park' }],
    org_venue_facilities: [{ id: 'f1', org_id: 'org', name: 'Diamond 1' }, { id: 'f3', org_id: 'org', name: 'Diamond 3' }],
  };
  const from = (table: string) => {
    const filters: ((r: Row) => boolean)[] = [];
    let patch: Row | null = null;
    let slice: [number, number] | null = null;
    const run = () => {
      const hit = (tables[table] ?? []).filter(r => filters.every(f => f(r)));
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
      gt: (k: string, v: string) => { filters.push(r => String(r[k]) > v); return q; },
      order: () => q,
      range: (a: number, b: number) => { slice = [a, b]; return q; },
      // Resolved on a later tick, as a real read or write is, so two runs interleave.
      then: (ok: (v: unknown) => unknown, no: (e: unknown) => unknown) => Promise.resolve().then(run).then(ok, no),
    };
    return q;
  };
  const sent: { severalDiamonds: boolean }[] = [];
  /** Each email as the coach reads it: one per team sent. */
  const emails: { subject: string; body: string }[] = [];
  const load = billingTestLoader({
    './supabase-admin': { supabaseAdmin: { from } },
    './db': { getLeagueSeasonById: async () => null, resolveCoachUserIdentities: async () => new Map() },
    './venue-clash-lookup': { getClubVenueLibrary: async () => ({ venues: [] }) },
    './league-game-changes-server': { childrenOnTeams: async () => [] },
    './league-rainout-send': { sendRainout: async () => [] },
    './club-team-board': { loadHeadCoaches: async () => new Map([['team', { people: [{ name: 'Nadia', email: 'coach@example.test' }] }]]) },
    './coach-membership': { listActiveStaffForTeams: async () => [] },
    './place-closures-server': {
      placeClosureSource: async () => null,
      reopenPlaceClosure: async (_org: string, id: string) => {
        if (id === o.stampFails) throw new Error('the stamp did not save');
        const c = closures.find(x => x.id === id);
        if (!c) return { refusal: 'not_found' };
        const already = !!c.reopened_at;
        c.reopened_at ??= '2099-11-28T12:00:00Z';
        return { refusal: null, reopenedAt: c.reopened_at, already };
      },
    },
    './place-closure-mail': {
      sendClosureCoachEmails: async (p: { teams: { teamId: string; teamName: string; games: (CoachMailGame & { reopenPark?: string; markIds: string[] })[] }[] }) =>
        p.teams.map(t => {
          const ok = !o.sendFails?.();
          if (ok) {
            sent.push(...t.games.map(g => ({ severalDiamonds: g.reopenPark === 'Lions Park' })));
            emails.push({ subject: COACH_MAIL.reopenSubject(t.teamName, t.games), body: COACH_MAIL.reopenBody('Kestrel Bay', t.games) });
          }
          return { teamId: t.teamId, sent: ok, markIds: [] };
        }),
    },
  });
  const server = load('lib/place-closure-window-server.ts') as typeof import('../../lib/place-closure-window-server');
  const org = { id: 'org', name: 'Kestrel Bay', slug: 'kestrel', planId: 'club' } as never;
  const actor = { id: 'u', email: 'dana@example.test', role: 'admin' as const, name: 'Dana' };
  /** Reopen as the route does it: the stamp, then whom to tell, then the emails. */
  const stamp = (id: string) => { const c = closures.find(x => x.id === id)!; c.reopened_at ??= '2099-11-28T12:00:00Z'; };
  const tell = async (id: string) => server.reopenCoachEmails({ ...(await server.reopenTold('org', [id])), org, actor, closureIds: [id] });
  const reopen = async (id: string) => { stamp(id); return tell(id); };
  /** S5: one press over a set, as the route does it. */
  const reopenSet = (ids: string[]) => server.reopenClosures({ org, actor, ids });
  return { reopen, reopenSet, stamp, tell, sent, emails, marks, closures };
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
  it('S5 · both diamonds in one press: one email, in the park words', async () => {
    const h = harness();
    const r = await h.reopenSet(['A', 'B']);
    assert.ok(r.refusal === null);
    assert.equal(r.coaches, 1);
    assert.deepEqual(h.sent, [{ severalDiamonds: true }]);
  });
  it('a closure past its last day holds nothing: reopening the longer one tells the coach', async () => {
    const h = harness();
    h.closures[0].ends_at = '2020-01-01T05:00:00Z';
    assert.equal((await h.reopen('B')).teams, 1, 'A is over: nothing could ever reopen it, so B is the last');
    assert.equal(h.sent.length, 1);
  });
});

describe('S5 · one press over several closures, one email per coach (Session B)', () => {
  it('a coach with a game on each of two diamonds gets ONE email naming both (/legal 2026-11-26)', async () => {
    const h = harness({ apart: true });
    const r = await h.reopenSet(['A', 'B']);
    assert.ok(r.refusal === null && r.coaches === 1);
    assert.equal(h.emails.length, 1);
    assert.equal(h.emails[0].subject, 'Diamond 1 and Diamond 3 at Lions Park reopened: U13 Ospreys games weren’t moved');
    assert.match(h.emails[0].body, /^Kestrel Bay reopened Diamond 1 and Diamond 3 at Lions Park\. Your games on .+ and .+ weren’t moved\. Keep them or move them\.$/);
  });
  it('one diamond reopened while the other stays: the email names the game\'s own place', async () => {
    const h = harness({ apart: true });
    await h.reopenSet(['A']);
    assert.equal(h.emails.length, 1);
    assert.match(h.emails[0].subject, /^Diamond 1 at Lions Park reopened: U13 Ospreys game wasn’t moved$/);
  });
  it('a repeated press, and two at the same moment, email nobody twice', async () => {
    const h = harness({ apart: true });
    await Promise.all([h.reopenSet(['A', 'B']), h.reopenSet(['A', 'B'])]);
    await h.reopenSet(['A', 'B']);
    assert.equal(h.emails.length, 1);
  });
  it('part failure: one stamp fails, the other\'s coach is still told, and the failure is said', async () => {
    const h = harness({ apart: true, stampFails: 'B' });
    const r = await h.reopenSet(['A', 'B']);
    assert.ok(r.refusal === null);
    assert.deepEqual(r.reopened, ['A']);
    assert.deepEqual(r.failed, ['B']);
    assert.equal(h.emails.length, 1, 'the game on Diamond 1 is no longer closed: its coach is told now');
    assert.equal(h.closures.find(c => c.id === 'B')!.reopened_at, null);
  });
  it('a closure that isn\'t the club\'s refuses the whole press: nothing is stamped', async () => {
    const h = harness();
    const r = await h.reopenSet(['A', 'Z']);
    assert.equal(r.refusal, 'not_found');
    assert.ok(h.closures.every(c => c.reopened_at === null));
  });
});
