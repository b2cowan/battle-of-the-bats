import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { planGames, roundRobinRounds, type GameTeam, type GameTimeSlot } from '../../lib/league-game-generator.ts';

/**
 * HOUSE LEAGUE STAGE 9d-2a — GENERATE GAMES, THE MATCH-UPS (frames c1–c3). The drawing's numbers: U12, 10 teams, holds
 * Tuesdays and Thursdays 6:00–7:30 p.m. on two diamonds and Saturdays 10:00–11:30 a.m. on one, Jun 1 – Aug 31, 2027, with
 * Thu, Jul 1 a date off — 65 slots. Once through is 45 games, 9 each, 4 or 5 at home; twice through needs 90 slots.
 */

let n = 0;
function slot(day: string, start: string, end: string, place: string): GameTimeSlot {
  const wd = ((new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7) + 1;
  return {
    id: `s${String(++n).padStart(3, '0')}`, day, weekday: wd, start, end,
    startsAt: new Date(`${day}T${start}:00-04:00`).toISOString(), endsAt: new Date(`${day}T${end}:00-04:00`).toISOString(),
    place, placeKey: `v1|${place}`, venueId: 'v1', facilityId: place,
  };
}
/** U12's game time in the drawing. */
function drawnTime(): GameTimeSlot[] {
  const out: GameTimeSlot[] = [];
  for (let d = Date.UTC(2027, 5, 1); d <= Date.UTC(2027, 7, 31); d += 86_400_000) {
    const day = new Date(d).toISOString().slice(0, 10);
    if (day === '2027-07-01') continue;
    const wd = ((new Date(d).getUTCDay() + 6) % 7) + 1;
    if (wd === 2 || wd === 4) out.push(slot(day, '18:00', '19:30', 'Diamond 1'), slot(day, '18:00', '19:30', 'Diamond 2'));
    if (wd === 6) out.push(slot(day, '10:00', '11:30', 'Diamond 1'));
  }
  return out;
}
const teams = (count: number): GameTeam[] =>
  Array.from({ length: count }, (_, i) => ({ id: `t${String(i + 1).padStart(2, '0')}`, name: `U12 Team ${i + 1}` }));

/** Each pairing's count, either way round. */
function pairings(games: { homeTeamId: string; awayTeamId: string }[]) {
  const m = new Map<string, number>();
  for (const g of games) { const k = [g.homeTeamId, g.awayTeamId].sort().join('-'); m.set(k, (m.get(k) ?? 0) + 1); }
  return m;
}

describe('the circle method', () => {
  it('meets every pair once, and an odd count sits one team out a round', () => {
    for (const count of [2, 3, 4, 7, 10]) {
      const ids = teams(count).map(t => t.id);
      const rounds = roundRobinRounds(ids);
      const all = rounds.flat();
      assert.equal(all.length, (count * (count - 1)) / 2, `${count} teams`);
      assert.equal(new Set(all.map(p => [...p].sort().join('-'))).size, all.length);
      for (const r of rounds) assert.equal(new Set(r.flat()).size, r.length * 2, 'no team twice in a round');
    }
  });
});

describe('planGames: the drawing', () => {
  const slots = drawnTime();
  it('has 65 slots', () => assert.equal(slots.length, 65));

  it('once through: 45 games on 45 of the 65 slots, the earliest first, 9 each, 4 or 5 at home', () => {
    const p = planGames({ slots, teams: teams(10), through: 1 });
    assert.equal(p.block, null);
    assert.equal(p.games.length, 45);
    assert.equal(p.needed, 45);
    assert.equal(p.slotCount, 65);
    assert.equal(p.gamesEach, 9);
    assert.deepEqual(p.home, { min: 4, max: 5 });
    assert.equal(p.byes, false);
    assert.equal(p.firstDay, '2027-06-01');
    assert.deepEqual(p.warnings, []);
    // One game per slot, only slots the club gave, the earliest 45 of them.
    const usedIds = p.games.map(g => g.slotId);
    assert.equal(new Set(usedIds).size, 45);
    assert.deepEqual([...usedIds].sort(), slots.slice(0, 45).map(s => s.id).sort());
    // A game takes its slot's instants whole (game length = the slot's).
    const byId = new Map(slots.map(s => [s.id, s]));
    for (const g of p.games) {
      assert.equal(g.scheduledAt, byId.get(g.slotId)!.startsAt);
      assert.equal(g.endsAt, byId.get(g.slotId)!.endsAt);
    }
    // Every pair meets once.
    const m = pairings(p.games);
    assert.equal(m.size, 45);
    assert.ok([...m.values()].every(c => c === 1));
  });

  it('shares the rarest time (Saturday mornings) out evenly: every team within one', () => {
    const p = planGames({ slots, teams: teams(10), through: 1 });
    assert.ok(p.share);
    assert.equal(p.share.weekday, 6);
    assert.equal(p.share.start, '10:00');
    assert.ok(p.share.max - p.share.min <= 1, `${p.share.min}–${p.share.max}`);
  });

  it('never puts a team on twice in a day when the slots allow otherwise', () => {
    const p = planGames({ slots, teams: teams(10), through: 1 });
    const byId = new Map(slots.map(s => [s.id, s]));
    const seen = new Set<string>();
    for (const g of p.games) {
      for (const t of [g.homeTeamId, g.awayTeamId]) {
        const k = `${t}|${byId.get(g.slotId)!.day}`;
        assert.ok(!seen.has(k), k);
        seen.add(k);
      }
    }
  });

  it('twice through needs 90 slots: blocked, nothing placed, with the game time\'s last day', () => {
    const p = planGames({ slots, teams: teams(10), through: 2 });
    assert.deepEqual(p.block, { kind: 'short', needed: 90, have: 65, lastDay: '2027-08-31' });
    assert.deepEqual(p.games, []);
  });

  it('twice through a smaller division plays each pairing once at each end', () => {
    const p = planGames({ slots, teams: teams(6), through: 2 });
    assert.equal(p.block, null);
    assert.equal(p.games.length, 30);
    assert.deepEqual(p.home, { min: 5, max: 5 });
    const ends = new Set(p.games.map(g => `${g.homeTeamId}>${g.awayTeamId}`));
    assert.equal(ends.size, 30, 'no pairing hosted twice by the same team');
  });
});

describe('planGames: home and away, byes', () => {
  it('keeps every team within one home game, for every division size', () => {
    for (let count = 2; count <= 14; count++) {
      const p = planGames({ slots: drawnTime(), teams: teams(count), through: 1 });
      if (p.block) continue; // 12+ teams once need more than 65 slots
      assert.ok(p.home.max - p.home.min <= 1, `${count} teams: ${p.home.min}–${p.home.max}`);
    }
  });

  it('9 teams: a bye a round, no team with byes two weeks running', () => {
    const p = planGames({ slots: drawnTime(), teams: teams(9), through: 1 });
    assert.equal(p.byes, true);
    assert.equal(p.games.length, 36);
    assert.deepEqual(p.home, { min: 4, max: 4 });
    assert.deepEqual(p.warnings.filter(w => w.kind === 'byes_back_to_back'), []);
  });

  it('warns a team with byes two weeks running', () => {
    // 4 teams, one slot a week: a round's two games take two weeks, so two teams sit out every week and some sit out two
    // running. Said once per team, with the two weeks' Mondays, one week apart.
    const s = ['2027-06-05', '2027-06-12', '2027-06-19', '2027-06-26', '2027-07-03', '2027-07-10'].map(d => slot(d, '10:00', '11:30', 'Diamond 1'));
    const p = planGames({ slots: s, teams: teams(4), through: 1 });
    assert.equal(p.games.length, 6);
    const byes = p.warnings.flatMap(w => (w.kind === 'byes_back_to_back' ? [w] : []));
    assert.ok(byes.length > 0);
    assert.equal(new Set(byes.map(w => w.teamId)).size, byes.length, 'once per team');
    for (const w of byes) assert.equal(Date.parse(w.weeks[1]) - Date.parse(w.weeks[0]), 7 * 86_400_000);
  });
});

describe('planGames: blocks and the last resort', () => {
  it('blocks a division with fewer than two teams', () => {
    assert.deepEqual(planGames({ slots: drawnTime(), teams: teams(1), through: 1 }).block, { kind: 'teams' });
  });

  it('a single day of slots: twice in a day is used and warned, never two slots at once', () => {
    // 3 teams once = 3 games; one Saturday, four slots, two of them at 10:00.
    const s = [
      slot('2027-06-05', '10:00', '11:30', 'Diamond 1'), slot('2027-06-05', '10:00', '11:30', 'Diamond 2'),
      slot('2027-06-05', '12:00', '13:30', 'Diamond 1'), slot('2027-06-05', '14:00', '15:30', 'Diamond 1'),
    ];
    const p = planGames({ slots: s, teams: teams(3), through: 1 });
    assert.equal(p.block, null);
    assert.equal(p.games.length, 3);
    assert.ok(!p.games.some(g => g.slotId === s[1].id), 'the second 10:00 slot would put a team in two places at once');
    const twice = p.warnings.filter(w => w.kind === 'twice_in_a_day');
    assert.equal(twice.length, 3, 'every team plays twice that day');
  });

  it('enough slots but nowhere for a game to go: crowded, nothing placed', () => {
    // 3 teams once, three slots all at 10:00 on one day: every second game would overlap its team's first.
    const s = ['Diamond 1', 'Diamond 2', 'Diamond 3'].map(f => slot('2027-06-05', '10:00', '11:30', f));
    const p = planGames({ slots: s, teams: teams(3), through: 1 });
    assert.deepEqual(p.block, { kind: 'crowded', needed: 3, placed: 1 });
    assert.deepEqual(p.games, []);
  });

  it('plans the same games from the same inputs, whatever order they arrive in', () => {
    const s = drawnTime();
    const a = planGames({ slots: s, teams: teams(10), through: 1 });
    const b = planGames({ slots: [...s].reverse(), teams: [...teams(10)].reverse(), through: 1 });
    assert.deepEqual(a.games, b.games);
  });
});
