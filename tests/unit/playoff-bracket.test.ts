import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  generateBracket,
  bracketRoundInfo,
  placementPlaces,
  nextPow2,
  seedOrder,
  displayBracketRefs,
  displayRoundTitle,
  remapTierSeed,
  suggestDefaultTiers,
  validateTierRanges,
  buildPlaceholderOptions,
  descendantBracketCodes,
  findBracketSchedulingViolations,
  nextManualBracketCode,
  computeBracketColumns,
  resolvePlayoffWinner,
  type GeneratedMatchup,
} from '../../lib/playoff-bracket.ts';

// ── helpers ────────────────────────────────────────────────────────────────

function codes(ms: GeneratedMatchup[]): string[] {
  return ms.map(m => m.code);
}

/** All participant references used across the bracket. */
function refs(ms: GeneratedMatchup[]): string[] {
  return ms.flatMap(m => [m.home, m.away]);
}

function seedNumber(ref: string): number | null {
  const m = ref.match(/^Seed #(\d+)$/);
  return m ? Number(m[1]) : null;
}

function refCode(ref: string): string | null {
  const m = ref.match(/^(?:Winner|Loser) (.+)$/);
  return m ? m[1] : null;
}

/**
 * Assert every reference is structurally valid: seeds are 1..n; Winner/Loser
 * refs point at a code that actually exists in the bracket.
 */
function assertReferencesValid(ms: GeneratedMatchup[], n: number) {
  const codeSet = new Set(codes(ms));
  for (const r of refs(ms)) {
    const s = seedNumber(r);
    if (s !== null) {
      assert.ok(s >= 1 && s <= n, `seed ref out of range: ${r} (n=${n})`);
      continue;
    }
    const c = refCode(r);
    assert.ok(c !== null, `unrecognized ref: ${r}`);
    assert.ok(codeSet.has(c!), `ref points at missing code: ${r}`);
  }
}

/** Codes must be unique so Winner/Loser refs are unambiguous. */
function assertUniqueCodes(ms: GeneratedMatchup[]) {
  const cs = codes(ms);
  assert.equal(new Set(cs).size, cs.length, `duplicate codes: ${cs.join(',')}`);
}

/** The set of distinct seeds that actually appear in matchups. */
function seedsPresent(ms: GeneratedMatchup[]): Set<number> {
  const set = new Set<number>();
  for (const r of refs(ms)) {
    const s = seedNumber(r);
    if (s !== null) set.add(s);
  }
  return set;
}

/**
 * Simulate the bracket to count how many games each seed plays. `favorite`
 * decides the winner of a matchup given the two seed numbers.
 * Ignores `ifNecessary` games (they are not part of the guaranteed minimum).
 * Returns games-played keyed by seed number.
 */
function simulate(ms: GeneratedMatchup[], n: number, lowerSeedWins: boolean): Map<number, number> {
  const winnerSeed = new Map<string, number>();
  const loserSeed = new Map<string, number>();
  const games = new Map<number, number>();
  for (let s = 1; s <= n; s += 1) games.set(s, 0);

  const resolve = (ref: string): number | null => {
    const s = seedNumber(ref);
    if (s !== null) return s;
    const c = refCode(ref)!;
    if (ref.startsWith('Winner ')) return winnerSeed.has(c) ? winnerSeed.get(c)! : null;
    return loserSeed.has(c) ? loserSeed.get(c)! : null;
  };

  const pending = ms.filter(m => !m.ifNecessary);
  let guard = pending.length * pending.length + 10;
  const done = new Set<string>();
  while (done.size < pending.length && guard-- > 0) {
    for (const m of pending) {
      if (done.has(m.code)) continue;
      const h = resolve(m.home);
      const a = resolve(m.away);
      if (h === null || a === null) continue;
      games.set(h, (games.get(h) ?? 0) + 1);
      games.set(a, (games.get(a) ?? 0) + 1);
      const hi = Math.min(h, a);
      const lo = Math.max(h, a);
      const win = lowerSeedWins ? hi : lo;
      const lose = lowerSeedWins ? lo : hi;
      winnerSeed.set(m.code, win);
      loserSeed.set(m.code, lose);
      done.add(m.code);
    }
  }
  assert.equal(done.size, pending.length, 'simulation did not resolve all matchups (cyclic/dangling refs)');
  return games;
}

/** A resolver that maps any ref → seed number after simulating all (non-if-necessary) games. */
function buildResolver(ms: GeneratedMatchup[], lowerSeedWins: boolean): (ref: string) => number | null {
  const winnerSeed = new Map<string, number>();
  const loserSeed = new Map<string, number>();
  const resolve = (ref: string): number | null => {
    const s = seedNumber(ref);
    if (s !== null) return s;
    const c = refCode(ref)!;
    return (ref.startsWith('Winner ') ? winnerSeed : loserSeed).get(c) ?? null;
  };
  const pending = ms.filter(m => !m.ifNecessary);
  const done = new Set<string>();
  let guard = pending.length * pending.length + 10;
  while (done.size < pending.length && guard-- > 0) {
    for (const m of pending) {
      if (done.has(m.code)) continue;
      const h = resolve(m.home);
      const a = resolve(m.away);
      if (h === null || a === null) continue;
      winnerSeed.set(m.code, lowerSeedWins ? Math.min(h, a) : Math.max(h, a));
      loserSeed.set(m.code, lowerSeedWins ? Math.max(h, a) : Math.min(h, a));
      done.add(m.code);
    }
  }
  return resolve;
}

/** Refs that are never consumed by a later game — i.e. final landing spots (placements). */
function terminalRefs(ms: GeneratedMatchup[]): string[] {
  const referenced = new Set(refs(ms));
  const terminals: string[] = [];
  for (const m of ms) {
    if (!referenced.has(`Winner ${m.code}`)) terminals.push(`Winner ${m.code}`);
    if (!referenced.has(`Loser ${m.code}`)) terminals.push(`Loser ${m.code}`);
  }
  return terminals;
}

/** Seed that won the main-bracket final (the overall champion) in a simulation. */
function championSeed(ms: GeneratedMatchup[], n: number, lowerSeedWins: boolean): number {
  // re-run and capture FIN/GF winner
  const byCode = new Map(ms.map(m => [m.code, m]));
  const winnerSeed = new Map<string, number>();
  const loserSeed = new Map<string, number>();
  const resolve = (ref: string): number | null => {
    const s = seedNumber(ref);
    if (s !== null) return s;
    const c = refCode(ref)!;
    return (ref.startsWith('Winner ') ? winnerSeed : loserSeed).get(c) ?? null;
  };
  const pending = ms.filter(m => !m.ifNecessary);
  const done = new Set<string>();
  let guard = pending.length * pending.length + 10;
  while (done.size < pending.length && guard-- > 0) {
    for (const m of pending) {
      if (done.has(m.code)) continue;
      const h = resolve(m.home);
      const a = resolve(m.away);
      if (h === null || a === null) continue;
      const win = lowerSeedWins ? Math.min(h, a) : Math.max(h, a);
      winnerSeed.set(m.code, win);
      loserSeed.set(m.code, lowerSeedWins ? Math.max(h, a) : Math.min(h, a));
      done.add(m.code);
    }
  }
  const finalCode = byCode.has('GF') ? 'GF' : 'FIN';
  return winnerSeed.get(finalCode)!;
}

const SIZES = [2, 3, 4, 5, 6, 7, 8, 11, 16];

// ── primitives ───────────────────────────────────────────────────────────

describe('seeding primitives', () => {
  it('nextPow2', () => {
    assert.equal(nextPow2(1), 1);
    assert.equal(nextPow2(2), 2);
    assert.equal(nextPow2(3), 4);
    assert.equal(nextPow2(5), 8);
    assert.equal(nextPow2(8), 8);
    assert.equal(nextPow2(9), 16);
  });

  it('seedOrder separates top seeds (size 8 = 1v8,4v5,2v7,3v6)', () => {
    assert.deepEqual(seedOrder(8), [1, 8, 4, 5, 2, 7, 3, 6]);
    assert.deepEqual(seedOrder(4), [1, 4, 2, 3]);
    // every seed appears exactly once
    const o = seedOrder(16);
    assert.equal(new Set(o).size, 16);
  });
});

// ── single elimination ───────────────────────────────────────────────────

describe('single elimination', () => {
  for (const n of SIZES) {
    it(`N=${n}: valid structure, all teams play, exactly one champion`, () => {
      const ms = generateBracket(n, { format: 'single' });
      assertUniqueCodes(ms);
      assertReferencesValid(ms, n);

      // every team appears
      assert.deepEqual(seedsPresent(ms), new Set(Array.from({ length: n }, (_, i) => i + 1)));

      // # games = N - 1 (single elim, byes don't create games)
      assert.equal(ms.length, n - 1, `expected ${n - 1} games`);

      // exactly one terminal matchup (its winner is never referenced again)
      const referenced = new Set(refs(ms).map(refCode).filter(Boolean) as string[]);
      const terminal = ms.filter(m => !referenced.has(m.code));
      assert.equal(terminal.length, 1, 'should be exactly one final');
      assert.equal(terminal[0].code, 'FIN');

      // everyone plays at least once
      const g = simulate(ms, n, true);
      for (let s = 1; s <= n; s += 1) assert.ok(g.get(s)! >= 1, `seed ${s} played 0 games`);
    });
  }

  it('adds a 3rd-place game when requested', () => {
    const ms = generateBracket(4, { format: 'single', thirdPlace: true });
    assert.ok(ms.some(m => m.code === 'P3' && m.section === 'P'));
    assert.equal(ms.length, 4); // SF1, SF2, FIN, P3
  });

  it('N<2 yields no bracket', () => {
    assert.deepEqual(generateBracket(1, { format: 'single' }), []);
    assert.deepEqual(generateBracket(0, { format: 'single' }), []);
  });
});

// ── consolation (2-game guarantee) ─────────────────────────────────────────

describe('consolation (2-game guarantee)', () => {
  // Guarantee: no team is eliminated after a single game. Every team that does
  // NOT win the championship plays at least twice. (A top seed that byes
  // straight into a one-game final and wins it is the only team that can finish
  // on a single game — it was never eliminated. This only occurs for tiny
  // bye-heavy brackets like N=3; for N>=4 everyone plays at least twice.)
  for (const n of SIZES.filter(s => s >= 3)) {
    it(`N=${n}: no team eliminated after one game (both outcome extremes)`, () => {
      const ms = generateBracket(n, { format: 'consolation' });
      assertUniqueCodes(ms);
      assertReferencesValid(ms, n);
      assert.deepEqual(seedsPresent(ms), new Set(Array.from({ length: n }, (_, i) => i + 1)));

      for (const lowerSeedWins of [true, false]) {
        const g = simulate(ms, n, lowerSeedWins);
        const champ = championSeed(ms, n, lowerSeedWins);
        for (let s = 1; s <= n; s += 1) {
          const min = s === champ ? 1 : 2;
          assert.ok(g.get(s)! >= min, `seed ${s} only played ${g.get(s)} game(s) (champ=${champ}, lowerSeedWins=${lowerSeedWins})`);
        }
      }
    });
  }

  it('N>=4: every team plays at least twice', () => {
    for (const n of [4, 5, 6, 7, 8, 11, 16]) {
      const ms = generateBracket(n, { format: 'consolation' });
      for (const lowerSeedWins of [true, false]) {
        const g = simulate(ms, n, lowerSeedWins);
        for (let s = 1; s <= n; s += 1) {
          assert.ok(g.get(s)! >= 2, `N=${n} seed ${s} played ${g.get(s)} (lowerSeedWins=${lowerSeedWins})`);
        }
      }
    }
  });
});

// ── double elimination ──────────────────────────────────────────────────────

describe('double elimination', () => {
  for (const n of SIZES) {
    it(`N=${n}: valid, every team plays at least twice, single grand final`, () => {
      const ms = generateBracket(n, { format: 'double', grandFinalReset: true });
      assertUniqueCodes(ms);
      assertReferencesValid(ms, n);
      assert.deepEqual(seedsPresent(ms), new Set(Array.from({ length: n }, (_, i) => i + 1)));

      // exactly one grand final and one if-necessary reset
      assert.equal(ms.filter(m => m.code === 'GF').length, 1, 'one grand final');
      const reset = ms.filter(m => m.ifNecessary);
      assert.equal(reset.length, 1, 'one if-necessary reset');
      assert.equal(reset[0].code, 'GF2');

      // double-elim guarantees two games for everyone, in both outcome extremes
      for (const lowerSeedWins of [true, false]) {
        const g = simulate(ms, n, lowerSeedWins);
        for (let s = 1; s <= n; s += 1) {
          assert.ok(g.get(s)! >= 2, `seed ${s} only played ${g.get(s)} game(s) (lowerSeedWins=${lowerSeedWins})`);
        }
      }
    });
  }

  it('reset can be disabled', () => {
    const ms = generateBracket(8, { format: 'double', grandFinalReset: false });
    assert.equal(ms.filter(m => m.ifNecessary).length, 0);
    assert.equal(ms.filter(m => m.code === 'GF').length, 1);
  });
});

// ── full placement ──────────────────────────────────────────────────────────

describe('full placement (every team ranked)', () => {
  for (const n of SIZES) {
    it(`N=${n}: every team finishes with a unique placement 1..N`, () => {
      const ms = generateBracket(n, { format: 'placement' });
      assertUniqueCodes(ms);
      assertReferencesValid(ms, n);
      assert.deepEqual(seedsPresent(ms), new Set(Array.from({ length: n }, (_, i) => i + 1)));

      const expected = Array.from({ length: n }, (_, i) => i + 1);
      for (const lowerSeedWins of [true, false]) {
        const resolve = buildResolver(ms, lowerSeedWins);
        const places = terminalRefs(ms).map(resolve);
        assert.ok(places.every(p => p !== null), 'every final landing spot resolves to a team');
        // Exactly N final spots, one per seed → a complete, unique ranking.
        assert.deepEqual([...places].sort((a, b) => (a! - b!)), expected, `lowerSeedWins=${lowerSeedWins}`);
      }
    });
  }

  it('produces the expected place games for 8 teams', () => {
    const ms = generateBracket(8, { format: 'placement' });
    const codes = new Set(ms.map(m => m.code));
    // championship + 3rd place + 5th/7th place deciders
    for (const c of ['FIN', 'PL3', 'PL5', 'PL7']) assert.ok(codes.has(c), `missing ${c}`);
  });

  it('placementPlaces maps exactly N landing spots to places 1..N, referencing real codes', () => {
    for (const n of SIZES) {
      const ms = generateBracket(n, { format: 'placement' });
      const codeSet = new Set(ms.map(m => m.code));
      const places = placementPlaces(n);
      assert.equal(places.size, n, `N=${n}: expected ${n} placements`);
      assert.deepEqual([...places.values()].sort((a, b) => a - b), Array.from({ length: n }, (_, i) => i + 1), `N=${n}`);
      for (const ref of places.keys()) {
        const c = refCode(ref);
        assert.ok(c !== null && codeSet.has(c), `N=${n}: placement ref points at missing code: ${ref}`);
      }
    }
  });
});

// ── round-info / column grouping ────────────────────────────────────────────

describe('bracketRoundInfo (display grouping)', () => {
  it('maps known codes to titles and ordered ranks', () => {
    assert.equal(bracketRoundInfo('QF1').title, 'Quarterfinals');
    assert.equal(bracketRoundInfo('SF2').title, 'Semifinals');
    assert.equal(bracketRoundInfo('FIN').title, 'Finals');
    assert.equal(bracketRoundInfo('3RD').key, 'FIN'); // 3rd place joins the finals column
    assert.equal(bracketRoundInfo('R16-3').title, 'Round of 16');
    assert.equal(bracketRoundInfo('WB2-1').title, 'Winners Round 2');
    assert.equal(bracketRoundInfo('LB3-1').title, 'Losers Round 3');
    assert.equal(bracketRoundInfo('GF').title, 'Grand Final');
    assert.equal(bracketRoundInfo('GF2').key, 'GF'); // reset shares the grand-final column
    assert.equal(bracketRoundInfo('CON1-2').title, 'Consolation Round 1');
    assert.equal(bracketRoundInfo('PL3').title, '3rd Place');
    assert.equal(bracketRoundInfo('PL5').title, '5th Place');
    assert.equal(bracketRoundInfo('PL5R1-2').title, '5th Place Bracket');
    assert.ok(bracketRoundInfo('FIN').rank < bracketRoundInfo('PL3').rank); // placement games sort after the championship

    // ordering: earlier single-elim rounds first; double-elim WB < LB < GF < CON
    assert.ok(bracketRoundInfo('R16-1').rank < bracketRoundInfo('QF1').rank);
    assert.ok(bracketRoundInfo('QF1').rank < bracketRoundInfo('SF1').rank);
    assert.ok(bracketRoundInfo('SF1').rank < bracketRoundInfo('FIN').rank);
    assert.ok(bracketRoundInfo('WB1-1').rank < bracketRoundInfo('LB1-1').rank);
    assert.ok(bracketRoundInfo('LB9-1').rank < bracketRoundInfo('GF').rank);
    assert.ok(bracketRoundInfo('GF').rank < bracketRoundInfo('CON1-1').rank);
  });

  it('groups a real double-elim bracket into ordered round columns', () => {
    const ms = generateBracket(8, { format: 'double' });
    const cols = new Map<string, { title: string; rank: number }>();
    for (const m of ms) {
      const info = bracketRoundInfo(m.code);
      cols.set(info.key, { title: info.title, rank: info.rank });
    }
    const ordered = [...cols.values()].sort((a, b) => a.rank - b.rank).map(c => c.title);
    // winners rounds first, then losers rounds, grand final last
    assert.equal(ordered[0].startsWith('Winners'), true);
    assert.equal(ordered[ordered.length - 1], 'Grand Final');
    assert.ok(ordered.some(t => t.startsWith('Losers')));
    // far fewer columns than games (proves round grouping, not one-per-match)
    assert.ok(cols.size < ms.length);
  });
});

describe('displayBracketRefs (seed round + winners-bracket renumber)', () => {
  it('relabels WB1-x → SR-x and decrements later winners rounds', () => {
    assert.equal(displayBracketRefs('WB1-1'), 'SR-1');
    assert.equal(displayBracketRefs('WB1-12'), 'SR-12');
    assert.equal(displayBracketRefs('WB2-1'), 'WB1-1');
    assert.equal(displayBracketRefs('WB3-2'), 'WB2-2');
    assert.equal(displayBracketRefs('Winner WB2-1'), 'Winner WB1-1');
    assert.equal(displayBracketRefs('Loser WB1-3'), 'Loser SR-3');
    assert.equal(displayBracketRefs('Winner WB10-1'), 'Winner WB9-1');
    assert.equal(displayBracketRefs('Loser WB11-2'), 'Loser WB10-2');
  });

  it('leaves losers / grand-final / single-elim codes untouched', () => {
    assert.equal(displayBracketRefs('LB1-1'), 'LB1-1');
    assert.equal(displayBracketRefs('Loser LB2-1'), 'Loser LB2-1');
    assert.equal(displayBracketRefs('GF'), 'GF');
    assert.equal(displayBracketRefs('Winner SF1'), 'Winner SF1');
  });

  it('is null/undefined safe', () => {
    assert.equal(displayBracketRefs(null), '');
    assert.equal(displayBracketRefs(undefined), '');
  });
});

describe('displayRoundTitle (winners round renumber)', () => {
  it('maps Winners Round 1 → Seed Round and shifts the rest down', () => {
    assert.equal(displayRoundTitle('Winners Round 1'), 'Seed Round');
    assert.equal(displayRoundTitle('Winners Round 2'), 'Winners Round 1');
    assert.equal(displayRoundTitle('Winners Round 5'), 'Winners Round 4');
  });

  it('passes other titles through unchanged', () => {
    assert.equal(displayRoundTitle('Losers Round 1'), 'Losers Round 1');
    assert.equal(displayRoundTitle('Grand Final'), 'Grand Final');
    assert.equal(displayRoundTitle('Grand Final Game 2 (If Necessary)'), 'Grand Final Game 2 (If Necessary)');
    assert.equal(displayRoundTitle(''), '');
  });
});

// ── Tiered brackets ──────────────────────────────────────────────────────────

describe('remapTierSeed (local → global seed refs)', () => {
  it('shifts a Seed #k ref by the tier offset', () => {
    assert.equal(remapTierSeed('Seed #1', 6), 'Seed #6');
    assert.equal(remapTierSeed('Seed #4', 6), 'Seed #9');
    assert.equal(remapTierSeed('Seed #1', 1), 'Seed #1');
  });
  it('passes Winner/Loser and other refs through unchanged', () => {
    assert.equal(remapTierSeed('Winner SF1', 6), 'Winner SF1');
    assert.equal(remapTierSeed('Loser FIN', 6), 'Loser FIN');
    assert.equal(remapTierSeed('1st Pool A', 6), '1st Pool A');
  });

  it('a 9-team [1–5, 6–9] split remaps to exactly Seed #1..Seed #9 with no dup/gap', () => {
    const tiers = [
      { name: 'Tier 1', fromSeed: 1, toSeed: 5 },
      { name: 'Tier 2', fromSeed: 6, toSeed: 9 },
    ];
    const globalSeeds = new Set<number>();
    for (const t of tiers) {
      const ms = generateBracket(t.toSeed - t.fromSeed + 1, { format: 'single' });
      for (const m of ms) {
        for (const raw of [m.home, m.away]) {
          const remapped = remapTierSeed(raw, t.fromSeed);
          const n = remapped.match(/^Seed #(\d+)$/);
          if (n) globalSeeds.add(Number(n[1]));
        }
      }
    }
    assert.deepEqual([...globalSeeds].sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('Tier 1 of 5 yields a single first-round play-in (seeds 4 v 5) with byes to 1–3', () => {
    // Standard 5-team single-elim: the first round (roundIndex 0) has exactly one
    // game — the 4 v 5 play-in — while seeds 1, 2, 3 receive first-round byes.
    const ms = generateBracket(5, { format: 'single' });
    const firstRound = ms.filter(m => m.section === 'W' && m.roundIndex === 0);
    assert.equal(firstRound.length, 1);
    const pair = [firstRound[0].home, firstRound[0].away].sort();
    assert.deepEqual(pair, ['Seed #4', 'Seed #5']);
  });
});

describe('suggestDefaultTiers', () => {
  it('splits 9 into [1–5, 6–9]', () => {
    assert.deepEqual(
      suggestDefaultTiers(9).map(t => [t.fromSeed, t.toSeed]),
      [[1, 5], [6, 9]],
    );
  });
  it('splits 8 into [1–4, 5–8]', () => {
    assert.deepEqual(
      suggestDefaultTiers(8).map(t => [t.fromSeed, t.toSeed]),
      [[1, 4], [5, 8]],
    );
  });
  it('returns a single tier for <4 teams and nothing for <2', () => {
    assert.equal(suggestDefaultTiers(3).length, 1);
    assert.equal(suggestDefaultTiers(1).length, 0);
  });
});

describe('validateTierRanges', () => {
  const good = [
    { name: 'Tier 1', fromSeed: 1, toSeed: 5 },
    { name: 'Tier 2', fromSeed: 6, toSeed: 9 },
  ];
  it('accepts a contiguous, well-named split within the team count', () => {
    assert.equal(validateTierRanges(good, 9).ok, true);
  });
  it('rejects an empty list', () => {
    assert.equal(validateTierRanges([], 9).ok, false);
  });
  it('rejects a gap', () => {
    const gapped = [
      { name: 'Tier 1', fromSeed: 1, toSeed: 4 },
      { name: 'Tier 2', fromSeed: 6, toSeed: 9 },
    ];
    assert.equal(validateTierRanges(gapped, 9).ok, false);
  });
  it('rejects an overlap', () => {
    const overlap = [
      { name: 'Tier 1', fromSeed: 1, toSeed: 5 },
      { name: 'Tier 2', fromSeed: 5, toSeed: 9 },
    ];
    assert.equal(validateTierRanges(overlap, 9).ok, false);
  });
  it('rejects a duplicate name', () => {
    const dup = [
      { name: 'Tier 1', fromSeed: 1, toSeed: 5 },
      { name: 'Tier 1', fromSeed: 6, toSeed: 9 },
    ];
    assert.equal(validateTierRanges(dup, 9).ok, false);
  });
  it('rejects a single-team tier', () => {
    const tiny = [
      { name: 'Tier 1', fromSeed: 1, toSeed: 5 },
      { name: 'Tier 2', fromSeed: 6, toSeed: 6 },
    ];
    assert.equal(validateTierRanges(tiny, 9).ok, false);
  });
  it('rejects ranges that exceed the accepted-team count', () => {
    assert.equal(validateTierRanges(good, 7).ok, false);
  });
  it('rejects a first tier that does not start at seed #1', () => {
    const offset = [
      { name: 'Tier 1', fromSeed: 2, toSeed: 5 },
      { name: 'Tier 2', fromSeed: 6, toSeed: 9 },
    ];
    assert.equal(validateTierRanges(offset, 9).ok, false);
  });
});

describe('buildPlaceholderOptions (manual bracket wiring)', () => {
  it('emits the canonical strings advancePlayoffs string-matches', () => {
    const { seeds, winners, losers } = buildPlaceholderOptions(4, ['SF1', 'SF2']);
    // Exact format is load-bearing: advancePlayoffs compares ('Winner ' + code),
    // ('Loser ' + code) and parses 'Seed #N' — the space and casing must match.
    assert.deepEqual(seeds, ['Seed #1', 'Seed #2', 'Seed #3', 'Seed #4']);
    assert.deepEqual(winners, ['Winner SF1', 'Winner SF2']);
    assert.deepEqual(losers, ['Loser SF1', 'Loser SF2']);
  });
  it('dedupes bracket codes and drops empties', () => {
    const { winners, losers } = buildPlaceholderOptions(0, ['QF1', 'QF1', '', 'QF2']);
    assert.deepEqual(winners, ['Winner QF1', 'Winner QF2']);
    assert.deepEqual(losers, ['Loser QF1', 'Loser QF2']);
  });
  it('clamps a non-finite or negative seed count to zero seeds', () => {
    assert.deepEqual(buildPlaceholderOptions(-3, []).seeds, []);
    assert.deepEqual(buildPlaceholderOptions(Number.NaN, []).seeds, []);
  });
  it('does not silently cap large seed counts (supports >64-team fields)', () => {
    assert.equal(buildPlaceholderOptions(100, []).seeds.length, 100);
    assert.equal(buildPlaceholderOptions(100, []).seeds[99], 'Seed #100');
  });
});

describe('descendantBracketCodes (no feeding from a future game)', () => {
  // 4-team single-elim: QF1,QF2 → SF1(W QF1) & SF2(W QF2)? Here a simple
  // semis → final shape: SF1/SF2 feed FIN.
  const games = [
    { code: 'QF1', refs: ['Seed #1', 'Seed #4'] },
    { code: 'QF2', refs: ['Seed #2', 'Seed #3'] },
    { code: 'SF1', refs: ['Winner QF1', 'Seed #1'] },
    { code: 'SF2', refs: ['Winner QF2', 'Seed #2'] },
    { code: 'FIN', refs: ['Winner SF1', 'Winner SF2'] },
  ];

  it('includes the game itself plus every game downstream of it', () => {
    // SF1 feeds FIN → both SF1 and FIN are blocked for SF1's own feeders.
    assert.deepEqual([...descendantBracketCodes('SF1', games)].sort(), ['FIN', 'SF1']);
  });
  it('leaves upstream (ancestor) games available', () => {
    // QF1 is an ancestor of SF1, so it is NOT a descendant — SF1 may draw from it.
    assert.ok(!descendantBracketCodes('SF1', games).has('QF1'));
    assert.ok(!descendantBracketCodes('SF1', games).has('QF2'));
  });
  it('blocks the whole downstream chain from a first-round game', () => {
    assert.deepEqual([...descendantBracketCodes('QF1', games)].sort(), ['FIN', 'QF1', 'SF1']);
  });
  it('a leaf game (the final) blocks only itself', () => {
    assert.deepEqual([...descendantBracketCodes('FIN', games)], ['FIN']);
  });
  it('is case-insensitive on the Winner/Loser prefix and ignores non-refs', () => {
    const g = [
      { code: 'A', refs: ['Seed #1', null, undefined] },
      { code: 'B', refs: ['winner A', 'LOSER A'] },
    ];
    assert.deepEqual([...descendantBracketCodes('A', g)].sort(), ['A', 'B']);
  });
  it('terminates on a cyclic wiring instead of looping forever', () => {
    // Malformed data: X feeds Y and Y feeds X. Should still return a finite set.
    const g = [
      { code: 'X', refs: ['Winner Y'] },
      { code: 'Y', refs: ['Winner X'] },
    ];
    assert.deepEqual([...descendantBracketCodes('X', g)].sort(), ['X', 'Y']);
  });
});

describe('findBracketSchedulingViolations (dependent-before-feeder)', () => {
  const sf1 = { code: 'SF1', home: 'Seed #1', away: 'Seed #4', date: '2026-07-05', time: '09:00' };
  const sf2 = { code: 'SF2', home: 'Seed #2', away: 'Seed #3', date: '2026-07-05', time: '11:00' };

  it('passes when the final is later the same day than both semis', () => {
    const fin = { code: 'FIN', home: 'Winner SF1', away: 'Winner SF2', date: '2026-07-05', time: '14:00' };
    assert.deepEqual(findBracketSchedulingViolations([sf1, sf2, fin]), []);
  });
  it('passes when the final is on a later day (no times needed)', () => {
    const fin = { code: 'FIN', home: 'Winner SF1', away: 'Winner SF2', date: '2026-07-06', time: null };
    assert.deepEqual(findBracketSchedulingViolations([sf1, sf2, fin]), []);
  });
  it('flags an earlier-day final', () => {
    const fin = { code: 'FIN', home: 'Winner SF1', away: 'Winner SF2', date: '2026-07-04', time: '14:00' };
    const v = findBracketSchedulingViolations([sf1, sf2, fin]);
    assert.equal(v.length, 2);
    assert.ok(v.every(x => x.game === 'FIN' && x.reason === 'earlier-date'));
  });
  it('flags a same-day final with no times (ordering not guaranteed)', () => {
    const fin = { code: 'FIN', home: 'Winner SF1', away: 'Winner SF2', date: '2026-07-05', time: null };
    const v = findBracketSchedulingViolations([sf1, sf2, fin]);
    assert.equal(v.length, 2);
    assert.ok(v.every(x => x.reason === 'same-day-unordered'));
  });
  it('flags a same-day final that starts before/at a semi', () => {
    const fin = { code: 'FIN', home: 'Winner SF1', away: 'Winner SF2', date: '2026-07-05', time: '09:00' };
    const v = findBracketSchedulingViolations([sf1, sf2, fin]);
    assert.ok(v.some(x => x.feeder === 'SF1' && x.reason === 'same-day-unordered'));
  });
  it('ignores an unscheduled dependent (no date) — structure-only saves', () => {
    const fin = { code: 'FIN', home: 'Winner SF1', away: 'Winner SF2', date: null, time: null };
    assert.deepEqual(findBracketSchedulingViolations([sf1, sf2, fin]), []);
  });
});

// ── resolvePlayoffWinner (J1-083 elimination tie guard) ──────────────────────

describe('resolvePlayoffWinner', () => {
  const g = (homeScore: number, awayScore: number, status = 'completed') =>
    ({ homeTeamId: 'home', awayTeamId: 'away', homeScore, awayScore, status });

  it('advances the higher score (home wins)', () => {
    assert.deepEqual(resolvePlayoffWinner(g(5, 3)), { tie: false, winner: 'home', loser: 'away' });
  });
  it('advances the higher score (away wins)', () => {
    assert.deepEqual(resolvePlayoffWinner(g(2, 7)), { tie: false, winner: 'away', loser: 'home' });
  });
  it('reports a tie on equal scores — does NOT silently advance the away team', () => {
    // The bug: old `home > away ? home : away` advanced 'away' on a 4-4 tie.
    assert.deepEqual(resolvePlayoffWinner(g(4, 4)), { tie: true });
    assert.deepEqual(resolvePlayoffWinner(g(0, 0)), { tie: true });
  });
  it('a forfeit is never a tie even at equal raw scores (decisive by status)', () => {
    // Forfeits carry a nominal margin, but assert the guard keys on status too.
    assert.deepEqual(resolvePlayoffWinner(g(1, 0, 'forfeit')), { tie: false, winner: 'home', loser: 'away' });
    assert.deepEqual(resolvePlayoffWinner(g(0, 1, 'forfeit')), { tie: false, winner: 'away', loser: 'home' });
  });
  it('treats null/undefined scores as 0 → tie', () => {
    assert.deepEqual(
      resolvePlayoffWinner({ homeTeamId: 'home', awayTeamId: 'away', homeScore: null, awayScore: null, status: 'completed' }),
      { tie: true },
    );
  });
});

describe('nextManualBracketCode (auto-assigned wiring code)', () => {
  it('a seeds-only game is Round 1, first index', () => {
    assert.equal(nextManualBracketCode([], 'Seed #1', 'Seed #4'), 'R1-1');
  });

  it('increments the index within the same round', () => {
    const existing = [{ bracketCode: 'R1-1', homePlaceholder: 'Seed #1', awayPlaceholder: 'Seed #4' }];
    assert.equal(nextManualBracketCode(existing, 'Seed #2', 'Seed #3'), 'R1-2');
  });

  it('a game fed by Round 1 winners becomes Round 2', () => {
    const existing = [
      { bracketCode: 'R1-1', homePlaceholder: 'Seed #1', awayPlaceholder: 'Seed #4' },
      { bracketCode: 'R1-2', homePlaceholder: 'Seed #2', awayPlaceholder: 'Seed #3' },
    ];
    assert.equal(nextManualBracketCode(existing, 'Winner R1-1', 'Winner R1-2'), 'R2-1');
  });

  it('depth chains: a game fed by a Round 2 winner is Round 3', () => {
    const existing = [
      { bracketCode: 'R1-1', homePlaceholder: 'Seed #1', awayPlaceholder: 'Seed #4' },
      { bracketCode: 'R1-2', homePlaceholder: 'Seed #2', awayPlaceholder: 'Seed #3' },
      { bracketCode: 'R2-1', homePlaceholder: 'Winner R1-1', awayPlaceholder: 'Winner R1-2' },
    ];
    assert.equal(nextManualBracketCode(existing, 'Winner R2-1', 'Seed #5'), 'R3-1');
  });

  it('resolves round depth even for a legacy (G#) code scheme', () => {
    const existing = [
      { bracketCode: 'G1', homePlaceholder: 'Seed #5', awayPlaceholder: 'Seed #4' },
      { bracketCode: 'G2', homePlaceholder: 'Seed #9', awayPlaceholder: 'Seed #6' },
    ];
    // Fed by a G-coded round-1 winner → Round 2, and the new R2- index is free.
    assert.equal(nextManualBracketCode(existing, 'Winner G1', 'Seed #1'), 'R2-1');
  });

  it('never collides with an existing R{round}-{n} code', () => {
    const existing = [
      { bracketCode: 'R2-1', homePlaceholder: 'Winner R1-1', awayPlaceholder: 'Winner R1-2' },
      { bracketCode: 'R1-1', homePlaceholder: 'Seed #1', awayPlaceholder: 'Seed #4' },
      { bracketCode: 'R1-2', homePlaceholder: 'Seed #2', awayPlaceholder: 'Seed #3' },
    ];
    assert.equal(nextManualBracketCode(existing, 'Winner R1-1', 'Winner R1-2'), 'R2-2');
  });
});

describe('computeBracketColumns (feed-graph layout)', () => {
  it('all-canonical single-elim stays on the code path (keys unchanged)', () => {
    const games = [
      { id: 'a', bracketCode: 'QF1', homePlaceholder: 'Seed #1', awayPlaceholder: 'Seed #8' },
      { id: 'b', bracketCode: 'SF1', homePlaceholder: 'Winner QF1', awayPlaceholder: 'Winner QF2' },
      { id: 'c', bracketCode: 'FIN', homePlaceholder: 'Winner SF1', awayPlaceholder: 'Winner SF2' },
    ];
    const m = computeBracketColumns(games);
    assert.equal(m.get('a')!.key, 'QF');
    assert.equal(m.get('b')!.key, 'SF');
    assert.equal(m.get('c')!.key, 'FIN');
  });

  it('double-elim section codes stay on the code path (WB/LB keys preserved)', () => {
    const games = [
      { id: 'a', bracketCode: 'WB1-1', homePlaceholder: 'Seed #1', awayPlaceholder: 'Seed #4' },
      { id: 'b', bracketCode: 'LB1-1', homePlaceholder: 'Loser WB1-1', awayPlaceholder: 'Loser WB1-2' },
      { id: 'c', bracketCode: 'GF', homePlaceholder: 'Winner WB2-1', awayPlaceholder: 'Winner LB3-1' },
    ];
    const m = computeBracketColumns(games);
    assert.equal(m.get('a')!.key, 'WB1');
    assert.equal(m.get('b')!.key, 'LB1');
    assert.equal(m.get('c')!.key, 'GF');
  });

  it('a renamed code groups with its same-depth peer instead of scattering', () => {
    // The reported bug: SF1 renamed to "test"; without graph layout it lands in its
    // own rank-1000 column to the right of the final.
    const games = [
      { id: 't', bracketCode: 'test', homePlaceholder: 'Seed #1', awayPlaceholder: 'Seed #4' },
      { id: 's', bracketCode: 'SF2', homePlaceholder: 'Seed #2', awayPlaceholder: 'Seed #3' },
      { id: 'f', bracketCode: 'FIN', homePlaceholder: 'Winner test', awayPlaceholder: 'Winner SF2' },
    ];
    const m = computeBracketColumns(games);
    assert.equal(m.get('t')!.key, m.get('s')!.key); // same column
    assert.equal(m.get('t')!.rank, 1);
    assert.equal(m.get('f')!.rank, 2);
    assert.ok(m.get('f')!.rank > m.get('t')!.rank); // final to the RIGHT of its feeders
    assert.equal(m.get('t')!.title, 'Semifinals');
    assert.equal(m.get('f')!.title, 'Finals');
  });

  it('legacy G# codes order by feed-graph depth with named columns', () => {
    const games = [
      { id: 'g1', bracketCode: 'G1', homePlaceholder: 'Seed #5', awayPlaceholder: 'Seed #4' },
      { id: 'g2', bracketCode: 'G2', homePlaceholder: 'Seed #9', awayPlaceholder: 'Seed #6' },
      { id: 'g4', bracketCode: 'G4', homePlaceholder: 'Winner G1', awayPlaceholder: 'Seed #1' },
      { id: 'g7', bracketCode: 'G7', homePlaceholder: 'Winner G4', awayPlaceholder: 'Seed #2' },
    ];
    const m = computeBracketColumns(games);
    assert.equal(m.get('g1')!.rank, 1);
    assert.equal(m.get('g4')!.rank, 2);
    assert.equal(m.get('g7')!.rank, 3);
    assert.equal(m.get('g1')!.title, 'Quarterfinals'); // two rounds from the final
    assert.equal(m.get('g4')!.title, 'Semifinals');
    assert.equal(m.get('g7')!.title, 'Finals');
  });

  it('aligns a seeds-only semifinal with its play-in-fed peer (5-team tier)', () => {
    // The reported bug: a 5-team tier with a play-in (G1) feeding only ONE semifinal
    // (G4). The other semifinal (G5) is seeds-only. Laid out from the START, G5 lands
    // a column LEFT of G4; it must instead sit in the SAME column as G4.
    const games = [
      { id: 'g1', bracketCode: 'G1', homePlaceholder: 'Seed #5', awayPlaceholder: 'Seed #4' }, // play-in
      { id: 'g4', bracketCode: 'G4', homePlaceholder: 'Winner G1', awayPlaceholder: 'Seed #1' }, // SF (fed by play-in)
      { id: 'g5', bracketCode: 'G5', homePlaceholder: 'Seed #3', awayPlaceholder: 'Seed #2' }, // SF (seeds only)
      { id: 'g7', bracketCode: 'G7', homePlaceholder: 'Winner G5', awayPlaceholder: 'Winner G4' }, // final
    ];
    const m = computeBracketColumns(games);
    assert.equal(m.get('g1')!.rank, 1);                       // play-in alone, leftmost
    assert.equal(m.get('g4')!.rank, m.get('g5')!.rank);       // both semifinals TOGETHER
    assert.equal(m.get('g4')!.rank, 2);
    assert.equal(m.get('g4')!.key, m.get('g5')!.key);         // same column key
    assert.equal(m.get('g7')!.rank, 3);                       // final to the right
    assert.equal(m.get('g1')!.title, 'Quarterfinals');
    assert.equal(m.get('g5')!.title, 'Semifinals');
    assert.equal(m.get('g4')!.title, 'Semifinals');
    assert.equal(m.get('g7')!.title, 'Finals');
  });

  it('a not-yet-wired early game stays on the left, not in the final column', () => {
    // While building by hand, an early game is added before its winner is wired
    // forward. It must not jump to the final column just because it feeds nothing yet.
    const games = [
      { id: 'g1', bracketCode: 'G1', homePlaceholder: 'Seed #1', awayPlaceholder: 'Seed #4' }, // wired → SF
      { id: 'g2', bracketCode: 'G2', homePlaceholder: 'Seed #2', awayPlaceholder: 'Seed #3' }, // NOT wired yet
      { id: 'g3', bracketCode: 'G3', homePlaceholder: 'Winner G1', awayPlaceholder: 'Seed #5' }, // final-ish
    ];
    const m = computeBracketColumns(games);
    assert.equal(m.get('g3')!.title, 'Finals');               // deepest game = final column
    assert.ok(m.get('g2')!.rank < m.get('g3')!.rank);         // unwired early game stays LEFT of the final
    assert.equal(m.get('g1')!.rank, m.get('g2')!.rank);       // both first-round games share the left column
  });

  it('a codeless game does not flip a standard bracket into graph mode', () => {
    // Regression guard: one codeless game must NOT re-order/re-title an otherwise
    // canonical QF/SF/FIN bracket — it keeps the code path (own rank-1000 column).
    const games = [
      { id: 'a', bracketCode: 'QF1', homePlaceholder: 'Seed #1', awayPlaceholder: 'Seed #8' },
      { id: 'b', bracketCode: 'SF1', homePlaceholder: 'Winner QF1', awayPlaceholder: 'Winner QF2' },
      { id: 'c', bracketCode: 'FIN', homePlaceholder: 'Winner SF1', awayPlaceholder: 'Winner SF2' },
      { id: 'x', bracketCode: '', homePlaceholder: '', awayPlaceholder: '' },
    ];
    const m = computeBracketColumns(games);
    assert.equal(m.get('a')!.key, 'QF'); // still code path, not 'RND1'
    assert.equal(m.get('b')!.key, 'SF');
    assert.equal(m.get('c')!.key, 'FIN');
  });

  it('a custom round_label overrides the column title, leaving key/rank structural', () => {
    const games = [
      { id: 'a', bracketCode: 'SF1', roundLabel: 'Gold Semis', homePlaceholder: 'Seed #1', awayPlaceholder: 'Seed #4' },
      { id: 'b', bracketCode: 'FIN', roundLabel: 'Championship', homePlaceholder: 'Winner SF1', awayPlaceholder: 'Winner SF2' },
    ];
    const m = computeBracketColumns(games);
    assert.equal(m.get('a')!.title, 'Gold Semis');
    assert.equal(m.get('a')!.key, 'SF'); // structural key unchanged
    assert.equal(m.get('b')!.title, 'Championship');
    assert.equal(m.get('b')!.key, 'FIN');
  });

  it('a label on one game applies to the whole structural column (consistent, no spreading nondeterminism)', () => {
    const games = [
      { id: 'a', bracketCode: 'SF1', roundLabel: 'Gold Semis', homePlaceholder: 'Seed #1', awayPlaceholder: 'Seed #4' },
      { id: 'b', bracketCode: 'SF2', roundLabel: null, homePlaceholder: 'Seed #2', awayPlaceholder: 'Seed #3' },
      { id: 'c', bracketCode: 'FIN', homePlaceholder: 'Winner SF1', awayPlaceholder: 'Winner SF2' },
    ];
    const m = computeBracketColumns(games);
    assert.equal(m.get('a')!.title, 'Gold Semis');
    assert.equal(m.get('b')!.title, 'Gold Semis'); // unlabeled peer inherits the column's label
    assert.equal(m.get('c')!.title, 'Finals');      // a different column is unaffected
  });

  it('an empty/whitespace round_label falls back to the derived title', () => {
    const m = computeBracketColumns([
      { id: 'a', bracketCode: 'FIN', roundLabel: '   ', homePlaceholder: 'Winner SF1', awayPlaceholder: 'Winner SF2' },
    ]);
    assert.equal(m.get('a')!.title, 'Finals');
  });

  it('a custom label also overrides graph-mode (renamed-code) titles', () => {
    const games = [
      { id: 't', bracketCode: 'test', roundLabel: 'Play-in', homePlaceholder: 'Seed #1', awayPlaceholder: 'Seed #4' },
      { id: 'f', bracketCode: 'FIN', roundLabel: '', homePlaceholder: 'Winner test', awayPlaceholder: 'Seed #2' },
    ];
    const m = computeBracketColumns(games);
    assert.equal(m.get('t')!.title, 'Play-in');
    assert.equal(m.get('f')!.title, 'Finals'); // empty label → derived
  });

  it('empty input returns an empty map', () => {
    assert.equal(computeBracketColumns([]).size, 0);
  });
});
