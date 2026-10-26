import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { runDraft, teamAverage, ratingOf, type DraftPlayer } from '../../lib/house-league-draft.ts';

/**
 * CLUB TIER STAGE 9c — THE BALANCED DRAFT, AS DATA (build prompt argument 3; rulings Q8, 9c·3, 9c·8).
 * Snake order, strongest first, locks counted, sizes never uneven because of a lock, and the refusals of copy §4.3.
 */

const players = (ratings: (number | null)[], prefix = 'p'): DraftPlayer[] =>
  ratings.map((rating, i) => ({ id: `${prefix}${i + 1}`, rating, lockedTeamId: null }));

function teamsOf(result: ReturnType<typeof runDraft>, all: DraftPlayer[], teamIds: string[]) {
  assert.ok(result.ok, 'the draft was refused');
  const byTeam = new Map(teamIds.map(t => [t, [] as DraftPlayer[]]));
  for (const p of all) {
    const team = p.lockedTeamId ?? result.deal.get(p.id);
    assert.ok(team, `${p.id} has no team`);
    byTeam.get(team!)!.push(p);
  }
  return byTeam;
}
const sizes = (byTeam: Map<string, DraftPlayer[]>) => [...byTeam.values()].map(t => t.length).sort((a, b) => b - a);
const totals = (byTeam: Map<string, DraftPlayer[]>) => [...byTeam.values()].map(t => t.reduce((s, p) => s + ratingOf(p), 0));

describe('the deal', () => {
  it('the fixture: 5 players into 2 teams is sizes 3 and 2', () => {
    const all = players([4, 2, 5, null, 3]);
    assert.deepEqual(sizes(teamsOf(runDraft(all, ['A', 'B'], 1), all, ['A', 'B'])), [3, 2]);
  });

  it('snake order: 5 5 4 4 3 3 into 2 teams gives each team 5 + 4 + 3', () => {
    const all = players([5, 5, 4, 4, 3, 3]);
    for (const seed of [1, 2, 3, 99]) {
      assert.deepEqual(totals(teamsOf(runDraft(all, ['A', 'B'], seed), all, ['A', 'B'])), [12, 12], `seed ${seed}`);
    }
  });

  it('it is a snake, not a rotation: the second round runs back', () => {
    // A rotation (A B A B …) gives the first team 5+4+3 = 12 against 4+3+2 = 9 here; a snake gives 5+3+2 = 10 and 4+4+3 = 11.
    const all = players([5, 4, 4, 3, 3, 2]);
    const t = totals(teamsOf(runDraft(all, ['A', 'B'], 7), all, ['A', 'B'])).sort();
    assert.deepEqual(t, [10, 11]);
  });

  it('nobody rated: an even deal, at random', () => {
    const all = players(Array(9).fill(null));
    const a = runDraft(all, ['A', 'B', 'C'], 1), b = runDraft(all, ['A', 'B', 'C'], 2);
    assert.deepEqual(sizes(teamsOf(a, all, ['A', 'B', 'C'])), [3, 3, 3]);
    assert.ok(a.ok && b.ok);
    assert.notDeepEqual([...a.deal.entries()], [...b.deal.entries()], 'two seeds dealt the same unrated teams');
  });

  it('the same seed deals the same teams', () => {
    const all = players([3, 3, 4, null, 2, 5, 1]);
    const a = runDraft(all, ['A', 'B'], 42), b = runDraft(all, ['A', 'B'], 42);
    assert.ok(a.ok && b.ok);
    assert.deepEqual([...a.deal.entries()], [...b.deal.entries()]);
  });

  it('37 players into 4 teams: sizes 10 9 9 9, and the totals close', () => {
    const ratings = Array.from({ length: 37 }, (_, i) => (i % 5) + 1);
    const all = players(ratings);
    const byTeam = teamsOf(runDraft(all, ['A', 'B', 'C', 'D'], 5), all, ['A', 'B', 'C', 'D']);
    assert.deepEqual(sizes(byTeam), [10, 9, 9, 9]);
    const t = totals(byTeam);
    // The 10-player team carries one more player, so compare averages, not totals.
    const avgs = [...byTeam.values()].map(p => teamAverage(p)!);
    assert.ok(Math.max(...avgs) - Math.min(...avgs) <= 0.5, `averages too far apart: ${avgs}`);
    assert.equal(t.reduce((a, b) => a + b, 0), ratings.reduce((a, b) => a + b, 0));
  });
});

describe('locks (9c·3)', () => {
  it('a locked player stays, and counts toward the team', () => {
    const all = players([5, 4, 3, 2]);
    all[0].lockedTeamId = 'B';
    const result = runDraft(all, ['A', 'B'], 3);
    assert.ok(result.ok);
    assert.equal(result.deal.has('p1'), false, 'a locked player was dealt');
    const byTeam = teamsOf(result, all, ['A', 'B']);
    assert.deepEqual(sizes(byTeam), [2, 2]);
    // B starts at 5, so A (the lowest locked total) picks first and takes the 4; B gets the 3's partner on the way back.
    assert.deepEqual(totals(byTeam).sort(), [6, 8].sort());
  });

  it('two locks on one team: the other team catches up first, so sizes stay even', () => {
    const all = players([3, 3, 3, 3, 3, 3]);
    all[0].lockedTeamId = 'A';
    all[1].lockedTeamId = 'A';
    assert.deepEqual(sizes(teamsOf(runDraft(all, ['A', 'B'], 11), all, ['A', 'B'])), [3, 3]);
  });

  it('a lock to a team that is not in this draft is ignored, not lost', () => {
    const all = players([3, 3]);
    all[0].lockedTeamId = 'gone';
    const result = runDraft(all, ['A', 'B'], 1);
    assert.ok(result.ok);
    assert.equal(result.deal.size, 2);
  });
});

describe('refusals (copy §4.3)', () => {
  it('no teams', () => assert.deepEqual(runDraft(players([3]), [], 1), { ok: false, refusal: 'noTeams' }));
  it('no players', () => assert.deepEqual(runDraft([], ['A'], 1), { ok: false, refusal: 'noPlayers' }));
  it('fewer players than teams: one team would have nobody', () => {
    assert.deepEqual(runDraft(players([3, 4]), ['A', 'B', 'C'], 1), { ok: false, refusal: 'tooFew' });
  });
  it('every player locked: nothing to deal', () => {
    const all = players([3, 4]);
    all[0].lockedTeamId = 'A'; all[1].lockedTeamId = 'B';
    assert.deepEqual(runDraft(all, ['A', 'B'], 1), { ok: false, refusal: 'lockedFull' });
  });
});

describe('the average (copy §1.4 teams.card.foot)', () => {
  it('counts a not-rated player as a 3, to one decimal', () => assert.equal(teamAverage([{ rating: 4 }, { rating: null }]), 3.5));
  it('is absent when nobody on the team is rated', () => assert.equal(teamAverage([{ rating: null }]), null));
  it('is absent on an empty team', () => assert.equal(teamAverage([]), null));
});
