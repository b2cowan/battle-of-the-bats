import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { keepTogetherGroups, runDraft, type DraftPlayer, type FriendLink } from '../../lib/house-league-draft.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * BOARD READY STAGE 1 PART 3 — FRIENDS IN THE DRAFT, AS DATA (rulings A1, A6, A7, A9; drawings tabs 5, 5b).
 *   · A group is a household joined by confirmed friend links, at most 3 children, brothers and sisters counted.
 *   · Links are kept in the A7 order: Both asked, then a code match, then the earliest confirmed.
 *   · The cap never splits brothers and sisters; locks win, as they do for families; a link kept apart is never joined.
 *   · Evening out never moves a group; the same seed and links give the same teams.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const players = (ratings: (number | null)[]): DraftPlayer[] =>
  ratings.map((rating, i) => ({ id: `p${i + 1}`, rating, lockedTeamId: null, household: `h${i + 1}` }));

let n = 0;
const link = (a: string, b: string, more: Partial<FriendLink> = {}): FriendLink =>
  ({ id: `L${++n}`, a, b, bothAsked: false, code: false, confirmedAt: '2027-03-01T12:00:00Z', apart: false, ...more });

function teamOf(r: ReturnType<typeof runDraft>, all: DraftPlayer[], id: string) {
  assert.ok(r.ok, 'the draft was refused');
  return all.find(p => p.id === id)!.lockedTeamId ?? r.deal.get(id);
}
const together = (r: ReturnType<typeof runDraft>, all: DraftPlayer[], ids: string[]) => new Set(ids.map(id => teamOf(r, all, id))).size === 1;
const dealt = (r: ReturnType<typeof runDraft>) => { assert.ok(r.ok); return [...r.deal.entries()].map(([p, t]) => `${p}:${t}`).join(' '); };
const TEAMS = ['A', 'B', 'C'];

describe('the cap of 3 and the order links are kept in (A1, A7)', () => {
  it('Both asked first, then a code match, then the earliest confirmed: the fourth child is over the cap', () => {
    const all = players([5, 1, 4, 2, 3, 3, 5, 1, 2, 4, 3, 2]);
    const early = link('p3', 'p4', { confirmedAt: '2027-02-01T12:00:00Z' });
    const both = link('p1', 'p2', { bothAsked: true, confirmedAt: '2027-04-01T12:00:00Z' });
    const code = link('p2', 'p3', { code: true, confirmedAt: '2027-04-02T12:00:00Z' });
    for (let seed = 1; seed <= 30; seed++) {
      const r = runDraft(all, TEAMS, seed, { together: true, friends: [early, both, code] });
      assert.ok(r.ok);
      assert.equal(r.links.get(both.id), 'kept');
      assert.equal(r.links.get(code.id), 'kept');
      assert.equal(r.links.get(early.id), 'overCap', 'the earliest typed link loses to Both asked and the code');
      assert.ok(together(r, all, ['p1', 'p2', 'p3']), `seed ${seed}: the group of three split`);
    }
  });

  it('among equals, the earliest confirmed is kept', () => {
    const all = players([3, 3, 3, 3, 3, 3]);
    const later = link('p1', 'p3', { confirmedAt: '2027-03-09T12:00:00Z' });
    const sooner = link('p1', 'p2', { confirmedAt: '2027-03-02T12:00:00Z' });
    const third = link('p2', 'p4', { confirmedAt: '2027-03-05T12:00:00Z' });
    const g = keepTogetherGroups(all, TEAMS, { friends: [later, sooner, third] });
    assert.equal(g.links.get(sooner.id), 'kept');
    assert.equal(g.links.get(third.id), 'kept');
    assert.equal(g.links.get(later.id), 'overCap');
    assert.deepEqual(g.groupOf.get('p1')!.ids, ['p1', 'p2', 'p4']);
  });

  it('two children already in one group are kept, and a Both asked pair is one link', () => {
    const all = players([3, 3, 3, 3]);
    const ab = link('p1', 'p2', { bothAsked: true });
    const bc = link('p2', 'p3');
    const ca = link('p3', 'p1');
    const g = keepTogetherGroups(all, ['A', 'B'], { friends: [ab, bc, ca] });
    assert.deepEqual([...g.links.values()], ['kept', 'kept', 'kept']);
  });
});

describe('brothers and sisters over the cap (A6)', () => {
  it('a family of three is a group with no room for a friend, and the family stays whole', () => {
    const all = players([5, 4, 3, 2, 1, 3, 4, 2, 3]);
    all[0].household = 'bell'; all[1].household = 'bell'; all[2].household = 'bell';
    const friend = link('p1', 'p4');
    for (let seed = 1; seed <= 20; seed++) {
      const r = runDraft(all, TEAMS, seed, { together: true, friends: [friend] });
      assert.ok(r.ok);
      assert.equal(r.links.get(friend.id), 'overCap');
      assert.ok(together(r, all, ['p1', 'p2', 'p3']), `seed ${seed}: the cap split the family`);
    }
  });

  it('a family of two has room for one friend', () => {
    const all = players([5, 4, 3, 2, 1, 3, 4, 2, 3]);
    all[0].household = 'bell'; all[1].household = 'bell';
    const friend = link('p2', 'p5');
    for (let seed = 1; seed <= 20; seed++) {
      const r = runDraft(all, TEAMS, seed, { together: true, friends: [friend] });
      assert.ok(r.ok);
      assert.equal(r.links.get(friend.id), 'kept');
      assert.ok(together(r, all, ['p1', 'p2', 'p5']), `seed ${seed}: the friend went elsewhere`);
    }
  });

  it('Keep families together off: brothers and sisters are not a group, so a friend link may join one of them', () => {
    const all = players([5, 4, 3, 2, 1, 3]);
    all[0].household = 'bell'; all[1].household = 'bell'; all[2].household = 'bell';
    const g = keepTogetherGroups(all, ['A', 'B'], { together: false, friends: [link('p1', 'p4')] });
    assert.deepEqual(g.groupOf.get('p1')!.ids, ['p1', 'p4']);
    assert.deepEqual(g.groupOf.get('p2')!.ids, ['p2']);
  });
});

describe('locks win, as they do for families', () => {
  it('a locked friend pulls the unlocked one onto their team', () => {
    const all = players([3, 3, 3, 3, 3, 3, 3, 3, 3]);
    all[1].lockedTeamId = 'B';
    const friend = link('p1', 'p2');
    for (let seed = 1; seed <= 20; seed++) {
      const r = runDraft(all, TEAMS, seed, { together: true, friends: [friend] });
      assert.ok(r.ok);
      assert.equal(r.links.get(friend.id), 'kept');
      assert.equal(teamOf(r, all, 'p1'), 'B', `seed ${seed}`);
    }
  });

  it('friends locked to two different teams: the locks win and the link reads locked', () => {
    const all = players([3, 3, 3, 3, 3, 3]);
    all[0].lockedTeamId = 'A'; all[1].lockedTeamId = 'B';
    const friend = link('p1', 'p2');
    const r = runDraft(all, ['A', 'B'], 1, { friends: [friend] });
    assert.ok(r.ok);
    assert.equal(r.links.get(friend.id), 'locked');
  });

  it('a lock elsewhere in the group pins the whole group, siblings and friend', () => {
    const all = players([3, 3, 3, 3, 3, 3, 3, 3, 3]);
    all[0].household = 'okafor'; all[1].household = 'okafor'; all[1].lockedTeamId = 'C';
    const friend = link('p1', 'p5');
    for (let seed = 1; seed <= 10; seed++) {
      const r = runDraft(all, TEAMS, seed, { together: true, friends: [friend] });
      assert.equal(teamOf(r, all, 'p1'), 'C');
      assert.equal(teamOf(r, all, 'p5'), 'C');
    }
  });
});

describe('a split, and Draft again (tab 5)', () => {
  it('a link kept apart is never joined, at any seed; the rest of the links still hold', () => {
    const all = players([5, 4, 3, 2, 1, 3, 4, 2, 3, 5, 1, 2]);
    const apart = link('p1', 'p2', { bothAsked: true, apart: true });
    const kept = link('p1', 'p3');
    for (let seed = 1; seed <= 20; seed++) {
      const r = runDraft(all, TEAMS, seed, { together: true, friends: [apart, kept] });
      assert.ok(r.ok);
      assert.equal(r.links.get(apart.id), 'apart');
      assert.equal(r.links.get(kept.id), 'kept');
      assert.ok(together(r, all, ['p1', 'p3']));
    }
    // Kept apart, the two are two groups: the draft is free to deal them anywhere.
    const g = keepTogetherGroups(all, TEAMS, { friends: [apart, kept] });
    assert.notEqual(g.groupOf.get('p1'), g.groupOf.get('p2'));
  });

  it('Draft again reads the same split: a second run with the same links keeps it apart', () => {
    const all = players([3, 4, 2, 5, 1, 3, 3, 4, 2]);
    const apart = link('p4', 'p5', { apart: true });
    const first = runDraft(all, TEAMS, 11, { together: true, friends: [apart] });
    const again = runDraft(all, TEAMS, 12, { together: true, friends: [apart] });
    assert.ok(first.ok && again.ok);
    assert.equal(first.links.get(apart.id), 'apart');
    assert.equal(again.links.get(apart.id), 'apart');
  });

  it('a kept-apart pair is not joined through a mutual friend either, at any seed', () => {
    const all = players([3, 4, 2, 5, 1, 3, 3, 4, 2]);
    const apart = link('p1', 'p2', { apart: true });
    const ac = link('p1', 'p3'), bc = link('p2', 'p3');
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const r = runDraft(all, TEAMS, seed, { friends: [apart, ac, bc] });
      assert.ok(r.ok);
      assert.notEqual(r.deal.get('p1'), r.deal.get('p2'));
    }
  });
});

describe('the same seed, the same teams; nothing to keep, today’s deal', () => {
  const all = (): DraftPlayer[] => players(Array.from({ length: 36 }, (_, i) => (i % 6 === 0 ? null : (i % 5) + 1)));
  const friends = () => [link('p1', 'p2', { bothAsked: true }), link('p3', 'p9', { code: true }), link('p10', 'p11'), link('p11', 'p12'), link('p12', 'p13')];

  it('the same seed and links deal the same teams', () => {
    const f = friends();
    for (const seed of [1, 7, 20261112]) {
      assert.equal(dealt(runDraft(all(), ['A', 'B', 'C', 'D'], seed, { together: true, friends: f })),
        dealt(runDraft(all(), ['A', 'B', 'C', 'D'], seed, { together: true, friends: f })));
    }
  });

  it('no links (or only links to children who are not drafted): the families-together deal, byte for byte', () => {
    const ghost = [link('p1', 'nobody'), link('p2', 'p2')];
    for (const seed of [1, 7, 20261112]) {
      const before = dealt(runDraft(all(), ['A', 'B', 'C', 'D'], seed, { together: true }));
      assert.equal(dealt(runDraft(all(), ['A', 'B', 'C', 'D'], seed, { together: true, friends: [] })), before);
      const r = runDraft(all(), ['A', 'B', 'C', 'D'], seed, { together: true, friends: ghost });
      assert.equal(dealt(r), before);
      assert.ok(r.ok && r.links.size === 0, 'a link to a child not in the draft gets no outcome');
    }
  });

  it('evening out never moves a friend group: every kept group is whole, at every seed, and sizes stay even', () => {
    const f = friends();
    for (let seed = 1; seed <= 30; seed++) {
      const list = all();
      const r = runDraft(list, ['A', 'B', 'C', 'D'], seed, { together: true, friends: f });
      assert.ok(r.ok);
      assert.ok(together(r, list, ['p1', 'p2']), `seed ${seed}: the Both asked pair split`);
      assert.ok(together(r, list, ['p3', 'p9']), `seed ${seed}: the code pair split`);
      assert.ok(together(r, list, ['p10', 'p11', 'p12']), `seed ${seed}: the group of three split`);
      assert.equal(r.links.get(f[4].id), 'overCap');
      const sizes = ['A', 'B', 'C', 'D'].map(t => list.filter(p => teamOf(r, list, p.id) === t).length);
      assert.deepEqual(sizes.sort(), [9, 9, 9, 9], `seed ${seed}: sizes`);
    }
  });
});
