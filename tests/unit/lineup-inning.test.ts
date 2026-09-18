import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { inspectInning, inningChoiceChanges, playerChoiceChanges, standingFor, type InningPlayer } from '../../lib/lineup-inning.ts';
import { BENCH_POSITION } from '../../lib/lineup-analysis.ts';

const DIAMOND = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'];

function player(over: Partial<InningPlayer> & { playerId: string; position: string }): InningPlayer {
  return {
    preferred: [], never: [], pitcher: null, pitchedInnings: 0, pitcherCap: null,
    ...over,
  };
}

describe('the inning lens — who holds each role, who is idle, who could take an open role', () => {
  it('reads a player’s standing for a role from their own depth chart, Never winning', () => {
    const p = { preferred: ['SS', '2B'], never: ['C'] };
    assert.deepEqual(standingFor(p, 'SS'), { standing: 'best', bestRank: 1 });
    assert.deepEqual(standingFor(p, '2B'), { standing: 'best', bestRank: 2 });
    assert.deepEqual(standingFor(p, 'C'), { standing: 'never', bestRank: null });
    assert.deepEqual(standingFor(p, 'LF'), { standing: 'available', bestRank: null });
  });

  it('the production inning 7: P and LF open, two blank pitchers both under cap — a fact, not a Never diagnosis', () => {
    // Seven field roles filled, three on Bench, Alex and Ashlyn blank. Both pitch (rank 4 and 2),
    // both have pitched 2 of a 4-inning cap. Ashlyn rates LF Best; Alex is merely available there.
    const players: InningPlayer[] = [
      player({ playerId: 'ariella', position: 'SS', preferred: ['SS', '3B'] }),
      player({ playerId: 'alex', position: '', preferred: ['3B', 'CF'], pitcher: { rank: 4, maxInnings: 4 }, pitchedInnings: 2, pitcherCap: 4 }),
      player({ playerId: 'ashlyn', position: '', preferred: ['1B', '3B', 'LF'], pitcher: { rank: 2, maxInnings: 4 }, pitchedInnings: 2, pitcherCap: 4 }),
      player({ playerId: 'sierra', position: '1B', preferred: ['3B', '1B'], pitcher: { rank: 2, maxInnings: null }, pitchedInnings: 0, pitcherCap: 4 }),
      player({ playerId: 'aslyn', position: 'C', preferred: ['LF', 'RF', 'CF', 'C'] }),
      player({ playerId: 'brooke', position: 'CF', preferred: ['LF', 'RF', 'CF'] }),
      player({ playerId: 'jordyn', position: '2B', preferred: ['2B'] }),
      player({ playerId: 'isla', position: '3B', preferred: ['SS', '3B'] }),
      player({ playerId: 'kayla', position: 'RF', preferred: ['RF'] }),
      player({ playerId: 'b1', position: BENCH_POSITION, never: ['P', 'LF'] }),
      player({ playerId: 'b2', position: BENCH_POSITION, never: ['LF'] }),
      player({ playerId: 'b3', position: BENCH_POSITION }),
    ];
    const lens = inspectInning(players, 7, DIAMOND, 'P');

    assert.equal(lens.inning, 7);
    assert.deepEqual(lens.openRoles, ['P', 'LF']);
    assert.deepEqual(lens.clashRoles, []);
    assert.equal(lens.assignedCount, 7);
    assert.deepEqual(lens.bench, ['b1', 'b2', 'b3']);
    assert.deepEqual(lens.undecided, ['alex', 'ashlyn']);
    assert.equal(lens.hasPitchingChart, true);

    // Neither open role has a PROVABLE cause — an eligible idle player exists for each.
    const P = lens.roles.find(r => r.code === 'P')!;
    const LF = lens.roles.find(r => r.code === 'LF')!;
    assert.equal(P.openCause, null);
    assert.equal(LF.openCause, null);

    // The mound lists pitchers with innings left first, by rank: Ashlyn (P2) before Alex (P4);
    // the three benched non-pitchers trail, still selectable.
    assert.deepEqual(P.candidates.map(c => c.playerId), ['ashlyn', 'alex', 'b1', 'b2', 'b3']);
    assert.deepEqual(P.candidates[0].pitching, { pitches: true, used: 2, cap: 4, atCap: false });
    assert.equal(P.candidates[2].pitching?.pitches, false);

    // LF: Ashlyn rates it Best (rank 3), Alex and b3 are available, b1/b2 have it as Never.
    assert.deepEqual(LF.candidates.map(c => [c.playerId, c.standing, c.bestRank]), [
      ['ashlyn', 'best', 3], ['alex', 'available', null], ['b3', 'available', null],
      ['b1', 'never', null], ['b2', 'never', null],
    ]);
    assert.deepEqual(LF.candidates.map(c => c.idleAs), ['open', 'open', 'bench', 'bench', 'bench']);

    // The "why" facts: one entry per undecided player, pitching used/cap, standing at each open
    // field role (the mound is read through `pitching`, never as a Best/Never standing).
    assert.deepEqual(lens.facts, [
      { playerId: 'alex', pitching: { rank: 4, used: 2, cap: 4 }, openRoles: [{ code: 'LF', standing: 'available', bestRank: null }] },
      { playerId: 'ashlyn', pitching: { rank: 2, used: 2, cap: 4 }, openRoles: [{ code: 'LF', standing: 'best', bestRank: 3 }] },
    ]);
  });

  it('reads the holder’s standing on a filled role, and reports a clash as two holders', () => {
    const players: InningPlayer[] = [
      player({ playerId: 'a', position: 'SS', preferred: ['SS'] }),
      player({ playerId: 'b', position: 'SS', never: ['SS'] }),
      player({ playerId: 'c', position: 'C' }),
    ];
    const lens = inspectInning(players, 1, ['C', 'SS'], null);
    const SS = lens.roles.find(r => r.code === 'SS')!;
    assert.deepEqual(SS.holders, [
      { playerId: 'a', standing: 'best', bestRank: 1 },
      { playerId: 'b', standing: 'never', bestRank: null },
    ]);
    assert.deepEqual(lens.clashRoles, ['SS']);
    assert.deepEqual(lens.roles.find(r => r.code === 'C')!.holders, [{ playerId: 'c', standing: 'available', bestRank: null }]);
    assert.equal(lens.assignedCount, 2);
    assert.deepEqual(lens.openRoles, []);
  });

  it('names a cause ONLY when the inputs prove it — every idle player Never here', () => {
    const players: InningPlayer[] = [
      player({ playerId: 'a', position: 'C' }),
      player({ playerId: 'b', position: BENCH_POSITION, never: ['SS'] }),
      player({ playerId: 'c', position: '', never: ['SS'] }),
    ];
    const lens = inspectInning(players, 1, ['C', 'SS'], null);
    assert.equal(lens.roles.find(r => r.code === 'SS')!.openCause, 'all_never');
    // One idle player merely available and the cause is gone — the role is simply open.
    const lens2 = inspectInning([...players, player({ playerId: 'd', position: '' })], 1, ['C', 'SS'], null);
    assert.equal(lens2.roles.find(r => r.code === 'SS')!.openCause, null);
  });

  it('names the pitching causes: every idle pitcher at cap, or no idle pitcher at all', () => {
    const base: InningPlayer[] = [
      player({ playerId: 'c', position: 'C' }),
      player({ playerId: 'ace', position: BENCH_POSITION, pitcher: { rank: 1, maxInnings: 3 }, pitchedInnings: 3, pitcherCap: 3 }),
      player({ playerId: 'x', position: '' }),
    ];
    assert.equal(inspectInning(base, 4, ['P', 'C'], 'P').roles[0].openCause, 'pitchers_at_cap');

    const noIdlePitcher: InningPlayer[] = [
      player({ playerId: 'c', position: 'C', pitcher: { rank: 1, maxInnings: null }, pitchedInnings: 0, pitcherCap: null }),
      player({ playerId: 'x', position: '' }),
    ];
    assert.equal(inspectInning(noIdlePitcher, 4, ['P', 'C'], 'P').roles[0].openCause, 'no_idle_pitchers');

    // A team with NO pitching chart has no mound rule: anyone idle is an ordinary candidate.
    const noChart: InningPlayer[] = [
      player({ playerId: 'c', position: 'C' }),
      player({ playerId: 'x', position: '' }),
    ];
    const lens = inspectInning(noChart, 4, ['P', 'C'], 'P');
    assert.equal(lens.hasPitchingChart, false);
    assert.equal(lens.roles[0].openCause, null);
    assert.equal(lens.roles[0].candidates[0].pitching, null);
  });

  it('a player at DH/EH/OF is neither idle nor a role holder — the lens says where they are', () => {
    const players: InningPlayer[] = [
      player({ playerId: 'a', position: 'C' }),
      player({ playerId: 'dh', position: 'DH' }),
      player({ playerId: 'of', position: 'OF' }),
      player({ playerId: 'b', position: BENCH_POSITION }),
    ];
    const lens = inspectInning(players, 2, ['C', 'SS'], null);
    assert.deepEqual(lens.elsewhere, [{ playerId: 'dh', position: 'DH' }, { playerId: 'of', position: 'OF' }]);
    assert.deepEqual(lens.bench, ['b']);
    assert.deepEqual(lens.undecided, []);
    // Only the benched player is a candidate for the open SS — the DH is not idle.
    assert.deepEqual(lens.roles.find(r => r.code === 'SS')!.candidates.map(c => c.playerId), ['b']);
  });

  it('a short roster: every player on the field and a role still open is `no_idle_players`', () => {
    const players: InningPlayer[] = [
      player({ playerId: 'a', position: 'C' }),
      player({ playerId: 'b', position: 'SS' }),
    ];
    const lens = inspectInning(players, 1, ['C', 'SS', '1B'], null);
    assert.equal(lens.roles.find(r => r.code === '1B')!.openCause, 'no_idle_players');
    assert.deepEqual(lens.facts, []);
  });

  it('an at-cap pitcher stays a candidate (named, never blocked) but sorts behind those with innings left', () => {
    const players: InningPlayer[] = [
      player({ playerId: 'c', position: 'C' }),
      player({ playerId: 'p2', position: '', pitcher: { rank: 2, maxInnings: 2 }, pitchedInnings: 2, pitcherCap: 2 }),
      player({ playerId: 'p3', position: BENCH_POSITION, pitcher: { rank: 3, maxInnings: null }, pitchedInnings: 1, pitcherCap: 4 }),
      player({ playerId: 'n', position: '' }),
    ];
    const P = inspectInning(players, 3, ['P', 'C'], 'P').roles[0];
    assert.deepEqual(P.candidates.map(c => [c.playerId, c.pitching?.atCap ?? null]), [['p3', false], ['p2', true], ['n', false]]);
    assert.equal(P.openCause, null);
  });
});

describe('the pick on a role’s control — the cell changes one gesture makes', () => {
  const pos: Record<string, string> = { h: 'SS', m: '2B', i: '', b: BENCH_POSITION };
  const positionOf = (id: string) => pos[id] ?? '';
  const filled = { code: 'SS', holders: [{ playerId: 'h', standing: 'available' as const, bestRank: null }] };
  const open = { code: 'SS', holders: [] };
  const clash = { code: 'SS', holders: [
    { playerId: 'h', standing: 'available' as const, bestRank: null },
    { playerId: 'm', standing: 'available' as const, bestRank: null },
  ] };

  it('assign: an idle player takes the role and the holder is left open', () => {
    assert.deepEqual(inningChoiceChanges(filled, 'assign:i', positionOf), [
      { playerId: 'h', position: '' }, { playerId: 'i', position: 'SS' },
    ]);
    assert.deepEqual(inningChoiceChanges(open, 'assign:b', positionOf), [{ playerId: 'b', position: 'SS' }]);
  });

  it('move: an on-field player comes here and the holder takes their old role — a swap', () => {
    assert.deepEqual(inningChoiceChanges(filled, 'move:m', positionOf), [
      { playerId: 'h', position: '2B' }, { playerId: 'm', position: 'SS' },
    ]);
    // On an open role the mover's old role simply opens — nobody is put anywhere by inference.
    assert.deepEqual(inningChoiceChanges(open, 'move:m', positionOf), [{ playerId: 'm', position: 'SS' }]);
  });

  it('keep: on a clash the chosen player stays and the others are left open', () => {
    assert.deepEqual(inningChoiceChanges(clash, 'keep:m', positionOf), [{ playerId: 'h', position: '' }]);
  });

  it('clear: every holder comes off, left open — never moved to Bench by inference', () => {
    assert.deepEqual(inningChoiceChanges(filled, 'clear', positionOf), [{ playerId: 'h', position: '' }]);
    assert.deepEqual(inningChoiceChanges(clash, 'clear', positionOf), [{ playerId: 'h', position: '' }, { playerId: 'm', position: '' }]);
  });

  it('the control’s resting value and a malformed value change nothing', () => {
    assert.deepEqual(inningChoiceChanges(filled, 'hold', positionOf), []);
    assert.deepEqual(inningChoiceChanges(filled, '', positionOf), []);
    assert.deepEqual(inningChoiceChanges(filled, 'assign:', positionOf), []);
    assert.deepEqual(inningChoiceChanges(filled, 'teleport:i', positionOf), []);
  });
});

describe('the pick on a PLAYER’s control — the Open and Bench rows under the roles', () => {
  const roles = [
    { code: 'P', holders: [{ playerId: 'ace', standing: 'available' as const, bestRank: null }] },
    { code: 'C', holders: [] },
    { code: 'SS', holders: [
      { playerId: 'a', standing: 'available' as const, bestRank: null },
      { playerId: 'b', standing: 'available' as const, bestRank: null },
    ] },
  ];

  it('bench: a deliberate sit for that player alone', () => {
    assert.deepEqual(playerChoiceChanges('x', 'bench', roles), [{ playerId: 'x', position: BENCH_POSITION }]);
  });

  it('take a filled role: the holder SITS (the option said so) and the player takes it — one whole inning', () => {
    assert.deepEqual(playerChoiceChanges('x', 'take:P', roles), [
      { playerId: 'ace', position: BENCH_POSITION }, { playerId: 'x', position: 'P' },
    ]);
  });

  it('take an open role: nobody is displaced', () => {
    assert.deepEqual(playerChoiceChanges('x', 'take:C', roles), [{ playerId: 'x', position: 'C' }]);
  });

  it('take a clashed role: both holders sit', () => {
    assert.deepEqual(playerChoiceChanges('x', 'take:SS', roles), [
      { playerId: 'a', position: BENCH_POSITION }, { playerId: 'b', position: BENCH_POSITION }, { playerId: 'x', position: 'SS' },
    ]);
  });

  it('the resting value, an unknown role and a malformed value change nothing', () => {
    assert.deepEqual(playerChoiceChanges('x', 'hold', roles), []);
    assert.deepEqual(playerChoiceChanges('x', 'take:', roles), []);
    assert.deepEqual(playerChoiceChanges('x', 'take:DH', roles), []);
    assert.deepEqual(playerChoiceChanges('x', 'teleport:P', roles), []);
  });
});
