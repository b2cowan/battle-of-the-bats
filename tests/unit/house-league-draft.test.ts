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

/**
 * FAMILIES TOGETHER (HOUSE_LEAGUE_DRAFT_BOARD_AT_SCALE A7; the household unit, build prompt argument 2, as the owner
 * approved it 2026-10-26). A household is the same guardian email. With the switch on:
 *   · families are dealt before single players, biggest first — so a family never arrives at a full team late, and the
 *     single players even the sizes out;
 *   · a locked child pulls their unlocked brothers and sisters onto that team;
 *   · children locked to different teams: the locks win; the unlocked ones stay together with each other;
 *   · a child with no email stands alone.
 * With the switch off the deal is TODAY'S, byte for byte (the snapshot below was recorded from the code before A7).
 */
describe('families together (A7)', () => {
  // The frozen fixture: 30 players, two locks, 4 teams — and households, which the switch-off deal must ignore.
  const frozen = (): DraftPlayer[] => {
    const ratings = [5, 4, null, 3, 2, 1, 5, 3, 3, null, 4, 2, 1, 5, 4, 3, null, 2, 2, 3, 4, 5, 1, null, 3, 3, 4, 2, 5, 1];
    const all: DraftPlayer[] = ratings.map((rating, i) => ({ id: `p${i + 1}`, rating, lockedTeamId: null, household: `h${Math.floor(i / 3)}` }));
    all[3].lockedTeamId = 'B'; all[17].lockedTeamId = 'D';
    return all;
  };
  // Recorded 2026-10-26 from runDraft as it stood before A7.
  const BEFORE: Record<number, string> = {
    1: 'p14:C p29:A p7:D p22:B p1:A p11:C p2:C p21:A p27:D p15:B p9:B p16:D p24:A p25:C p3:C p10:A p17:D p8:B p26:B p20:D p19:A p12:C p5:C p28:A p13:D p6:B p23:B p30:D',
    7: 'p22:C p29:A p7:D p14:B p1:A p21:C p27:C p15:A p11:D p2:B p25:B p24:D p17:A p16:C p8:C p10:A p9:D p26:B p3:B p20:D p5:A p19:C p12:C p28:A p30:D p23:B p6:B p13:D',
    20261026: 'p22:A p1:C p7:D p29:B p14:C p11:A p2:A p27:C p15:D p21:B p10:B p9:D p26:C p20:A p17:A p3:C p24:D p16:B p8:B p25:D p12:C p19:A p28:A p5:C p23:D p6:B p13:B p30:D',
  };
  const dealt = (r: ReturnType<typeof runDraft>) => { assert.ok(r.ok); return [...r.deal.entries()].map(([p, t]) => `${p}:${t}`).join(' '); };
  const teamOf = (r: ReturnType<typeof runDraft>, all: DraftPlayer[], id: string) => {
    assert.ok(r.ok);
    return all.find(p => p.id === id)!.lockedTeamId ?? r.deal.get(id);
  };

  it('switch off: today’s deal, byte for byte, households or not', () => {
    for (const seed of [1, 7, 20261026]) {
      assert.equal(dealt(runDraft(frozen(), ['A', 'B', 'C', 'D'], seed)), BEFORE[seed], `seed ${seed}, no options`);
      assert.equal(dealt(runDraft(frozen(), ['A', 'B', 'C', 'D'], seed, { together: false })), BEFORE[seed], `seed ${seed}, off`);
    }
  });

  it('switch on with no family of two or more: the same deal as off', () => {
    const singles = frozen().map((p, i) => ({ ...p, household: `only${i}` }));
    for (const seed of [1, 7]) {
      assert.equal(dealt(runDraft(singles, ['A', 'B', 'C', 'D'], seed, { together: true })), BEFORE[seed]);
    }
  });

  it('a family of 2 and a family of 3 each land on one team, at every seed', () => {
    const all = players([5, 1, 4, 2, 3, 3, 5, 1, 2, 4, 3, null]);
    all[0].household = 'smith'; all[1].household = 'smith';
    all[2].household = 'chen'; all[3].household = 'chen'; all[4].household = 'chen';
    for (let seed = 1; seed <= 40; seed++) {
      const r = runDraft(all, ['A', 'B', 'C'], seed, { together: true });
      assert.equal(teamOf(r, all, 'p1'), teamOf(r, all, 'p2'), `seed ${seed}: the Smiths split`);
      assert.equal(new Set(['p3', 'p4', 'p5'].map(id => teamOf(r, all, id))).size, 1, `seed ${seed}: the Chens split`);
      assert.deepEqual(sizes(teamsOf(r, all, ['A', 'B', 'C'])), [4, 4, 4], `seed ${seed}: sizes`);
    }
  });

  it('the real division: 120 players, 17 families, 10 teams — families whole, sizes 12 each', () => {
    const all = players(Array.from({ length: 120 }, (_, i) => (i % 7 === 0 ? null : (i % 5) + 1)));
    let at = 0;
    for (let f = 0; f < 17; f++) {
      const n = f < 2 ? 3 : 2;
      for (let k = 0; k < n; k++) all[at++].household = `fam${f}`;
    }
    const teams = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
    for (const seed of [1, 2, 3, 4, 5]) {
      const r = runDraft(all, teams, seed, { together: true });
      for (let f = 0; f < 17; f++) {
        const kids = all.filter(p => p.household === `fam${f}`);
        assert.equal(new Set(kids.map(k => teamOf(r, all, k.id))).size, 1, `seed ${seed}: family ${f} split`);
      }
      const byTeam = teamsOf(r, all, teams);
      assert.deepEqual(sizes(byTeam), Array(10).fill(12), `seed ${seed}: sizes`);
      const avgs = [...byTeam.values()].map(p => teamAverage(p)!);
      // Evening out (single players swap between teams) keeps families together from costing the balance.
      assert.ok(Math.max(...avgs) - Math.min(...avgs) <= 0.2 + 1e-9, `seed ${seed}: averages too far apart: ${avgs}`);
    }
  });

  it('a family of 3 never arrives at a team late: dealt first, the singles even the sizes (2 teams, 9 + 3)', () => {
    const all = players([5, 5, 4, 4, 3, 3, 2, 2, 1, 3, 3, 3]);
    all[9].household = 'big'; all[10].household = 'big'; all[11].household = 'big';
    for (const seed of [1, 2, 3]) {
      const r = runDraft(all, ['A', 'B'], seed, { together: true });
      assert.deepEqual(sizes(teamsOf(r, all, ['A', 'B'])), [6, 6], `seed ${seed}`);
      assert.equal(new Set(['p10', 'p11', 'p12'].map(id => teamOf(r, all, id))).size, 1);
    }
  });

  it('a locked child pulls their unlocked brothers and sisters onto that team', () => {
    const all = players([3, 3, 3, 3, 3, 3]);
    all[0].household = 'h'; all[1].household = 'h'; all[2].household = 'h';
    all[0].lockedTeamId = 'B';
    for (const seed of [1, 2, 3, 4]) {
      const r = runDraft(all, ['A', 'B'], seed, { together: true });
      assert.equal(teamOf(r, all, 'p2'), 'B'); assert.equal(teamOf(r, all, 'p3'), 'B');
      assert.deepEqual(sizes(teamsOf(r, all, ['A', 'B'])), [3, 3]);
    }
  });

  it('children locked to different teams: the locks win, and the unlocked two stay together', () => {
    const all = players([3, 3, 3, 3, 3, 3, 3, 3]);
    for (const p of all.slice(0, 4)) p.household = 'h';
    all[0].lockedTeamId = 'A'; all[1].lockedTeamId = 'B';
    for (const seed of [1, 2, 3, 4]) {
      const r = runDraft(all, ['A', 'B'], seed, { together: true });
      assert.ok(r.ok);
      assert.equal(r.deal.has('p1'), false); assert.equal(r.deal.has('p2'), false);
      assert.equal(teamOf(r, all, 'p3'), teamOf(r, all, 'p4'));
      assert.deepEqual(sizes(teamsOf(r, all, ['A', 'B'])), [4, 4]);
    }
  });

  it('a lone unlocked child of a family locked across two teams: nothing to keep together, today’s deal', () => {
    const all = players([3, 3, 3, 4, 2, 5, 1, 3, null, 4]);
    for (const p of all.slice(0, 3)) p.household = 'h';
    all[0].lockedTeamId = 'A'; all[1].lockedTeamId = 'B';
    for (const seed of [1, 2, 3]) {
      assert.equal(dealt(runDraft(all, ['A', 'B', 'C'], seed, { together: true })), dealt(runDraft(all, ['A', 'B', 'C'], seed)));
    }
  });

  it('no email, no family: a blank household deals alone', () => {
    const all = players([3, 3, 3, 3]);
    for (const p of all) p.household = '  ';
    assert.equal(dealt(runDraft(all, ['A', 'B'], 9, { together: true })), dealt(runDraft(all, ['A', 'B'], 9)));
  });

  it('only families, and they cannot even out: the families stay whole and the sizes say so', () => {
    // Three families of 3 into 2 teams: 6 and 3 is the honest answer — splitting a family is what the switch forbids.
    const all = players([3, 3, 3, 3, 3, 3, 3, 3, 3]);
    all.forEach((p, i) => { p.household = `f${Math.floor(i / 3)}`; });
    const r = runDraft(all, ['A', 'B'], 1, { together: true });
    assert.deepEqual(sizes(teamsOf(r, all, ['A', 'B'])), [6, 3]);
  });
});
