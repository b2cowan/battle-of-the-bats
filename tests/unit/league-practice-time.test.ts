import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  planPractices, readSettings, PRACTICE_TIME_WORDS as W,
  type PlannedPractice, type PracticeTimeSlot, type PracticeTimeTeam,
} from '../../lib/league-practice-time.ts';
import { partsShapes } from '../../lib/league-time.ts';

/**
 * CLUB TIER STAGE 11b PART 4 — PRACTICE TIME, PLANNED (frame h1). The drawing's numbers: U12 holds Mondays and Wednesdays
 * 6:00–9:00 p.m. on two diamonds (12 hours a week); 60-minute practices, 1 per facility, 10 teams → every team 1 practice
 * a week, 2 slots stay open, "Hand out 10 practices a week", and the early and late times go round week by week.
 */

let n = 0;
/** One slot a week for `weeks` weeks from Mon Jun 7, 2027, on a facility (the club's zone is Eastern, summer -04:00). */
function weekly(weekday: number, start: string, end: string, place: string, weeks = 4, from = 0): PracticeTimeSlot[] {
  return Array.from({ length: weeks }, (_, i) => {
    const day = new Date(Date.UTC(2027, 5, 7 + (from + i) * 7 + weekday - 1)).toISOString().slice(0, 10);
    return { id: `s${++n}`, day, weekday, start, end, startsAt: `${day}T${start}:00-04:00`, place, placeKey: `v1|${place}` };
  });
}
const teams = (count: number): PracticeTimeTeam[] =>
  Array.from({ length: count }, (_, i) => ({ id: `t${String(i + 1).padStart(2, '0')}`, name: `U12 Team ${i + 1}` }));

/** U12's time in the drawing: Mon and Wed, 6:00–9:00 p.m., Diamonds 1 and 2. */
const drawn = (weeks = 4, from = 0) => [
  ...weekly(1, '18:00', '21:00', 'Diamond 1', weeks, from), ...weekly(1, '18:00', '21:00', 'Diamond 2', weeks, from),
  ...weekly(3, '18:00', '21:00', 'Diamond 1', weeks, from), ...weekly(3, '18:00', '21:00', 'Diamond 2', weeks, from),
];

const weekOf = (iso: string) => {
  const d = new Date(iso);
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - ((d.getUTCDay() + 6) % 7)));
  return monday.toISOString().slice(0, 10);
};
const byWeek = (rows: readonly PlannedPractice[]) => {
  const m = new Map<string, PlannedPractice[]>();
  for (const r of rows) m.set(weekOf(r.scheduledAt), [...(m.get(weekOf(r.scheduledAt)) ?? []), r]);
  return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, list]) => list);
};
const clock = (iso: string) => new Date(iso).toISOString().slice(11, 16);

/** The step's two floors (mig 393): no slot holds more than teams-at-once at an instant; no team twice at once. */
function assertFloors(rows: readonly PlannedPractice[], teamsAtOnce: number) {
  for (const a of rows) {
    const together = rows.filter(b => b.slotId === a.slotId && b.scheduledAt <= a.scheduledAt && b.endsAt > a.scheduledAt);
    assert.ok(together.length <= teamsAtOnce, `slot ${a.slotId} holds ${together.length} at ${a.scheduledAt}`);
    const twice = rows.filter(b => b !== a && b.teamId === a.teamId && b.scheduledAt < a.endsAt && a.scheduledAt < b.endsAt);
    assert.equal(twice.length, 0, `${a.teamId} twice at ${a.scheduledAt}`);
  }
  assert.equal(new Set(rows.map(r => `${r.slotId}|${r.teamId}`)).size, rows.length, 'one practice per slot per team');
}

describe('Practice time: the drawing\'s numbers', () => {
  const slots = drawn();
  const plan = planPractices({ slots, teams: teams(10), settings: { practiceMinutes: 60, teamsAtOnce: 1 } });

  it('every team gets 1 practice a week, 2 slots stay open, 10 practices a week', () => {
    assert.equal(plan.seatsAWeek, 12);
    assert.equal(plan.perTeam, 1);
    assert.equal(plan.practicesAWeek, 10);
    assert.equal(plan.openAWeek, 2);
    assert.equal(plan.goWithout, 0);
    assert.equal(W.everyTeam(plan.perTeam), 'Every team gets 1 practice a week.');
    assert.equal(W.open(plan.openAWeek), '2 slots stay open.');
    assert.equal(W.handOut(plan.practicesAWeek), 'Hand out 10 practices a week');
  });

  it('each week: ten practices, every team once, each inside its slot, on the hour', () => {
    const weeks = byWeek(plan.rows);
    assert.equal(weeks.length, 4);
    for (const week of weeks) {
      assert.equal(week.length, 10);
      assert.equal(new Set(week.map(r => r.teamId)).size, 10);
    }
    const slot = new Map(slots.map(s => [s.id, s]));
    for (const r of plan.rows) {
      const s = slot.get(r.slotId)!;
      assert.ok(Date.parse(r.scheduledAt) >= Date.parse(s.startsAt));
      assert.ok(Date.parse(r.endsAt) <= Date.parse(s.startsAt) + 3 * 3600_000);
      assert.equal(Date.parse(r.endsAt) - Date.parse(r.scheduledAt), 3600_000);
    }
    assertFloors(plan.rows, 1);
    assert.deepEqual(new Set(plan.slotIds), new Set(slots.map(s => s.id)));
  });

  it('a team keeps its day and facility, and takes its turn at the early and late times week by week', () => {
    const slot = new Map(slots.map(s => [s.id, s]));
    const partOf = (r: PlannedPractice) => { const s = slot.get(r.slotId)!; return `${s.weekday}|${s.place}`; };
    for (const t of teams(10)) {
      const mine = plan.rows.filter(r => r.teamId === t.id).sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
      assert.equal(new Set(mine.map(partOf)).size, 1, `${t.name} moved part`);
      // Three teams on a part: three weeks in a row are three different times.
      const clocks = mine.map(r => clock(r.scheduledAt));
      const sharers = plan.rows.filter(r => partOf(r) === partOf(mine[0]) && weekOf(r.scheduledAt) === weekOf(mine[0].scheduledAt)).length;
      if (sharers === 3) assert.equal(new Set(clocks.slice(0, 3)).size, 3, `${t.name}: ${clocks.join(', ')}`);
      else assert.equal(new Set(clocks).size, 2, `${t.name} shares the two early times: ${clocks.join(', ')}`);
    }
    assert.equal(plan.turns, true);
    assert.equal(W.turns, 'Teams take turns at the early and late times, week by week.');
  });

  it('the open slots are the late ones on the parts with room to spare', () => {
    for (const week of byWeek(plan.rows)) {
      const late = week.filter(r => clock(r.scheduledAt) === '00:00'); // 8:00 p.m. Eastern = 00:00 UTC
      assert.equal(late.length, 2, 'two parts are full; the two with room leave 8:00 p.m. open');
    }
  });

  it('a second hand-out mid-season keeps the same rotation (the turns follow the calendar)', () => {
    const later = planPractices({ slots: slots.filter(s => s.day >= '2027-06-21'), teams: teams(10), settings: { practiceMinutes: 60, teamsAtOnce: 1 } });
    const key = (r: PlannedPractice) => `${r.slotId}|${r.teamId}|${r.scheduledAt}`;
    assert.deepEqual(later.rows.map(key).sort(), plan.rows.filter(r => r.scheduledAt >= '2027-06-21').map(key).sort());
  });

  it('the same inputs plan the same practices (the server plans again and must agree with the window)', () => {
    const again = planPractices({ slots: [...slots].reverse(), teams: [...teams(10)].reverse(), settings: { practiceMinutes: 60, teamsAtOnce: 1 } });
    assert.deepEqual(again.rows.map(r => `${r.slotId}|${r.teamId}|${r.scheduledAt}`).sort(), plan.rows.map(r => `${r.slotId}|${r.teamId}|${r.scheduledAt}`).sort());
  });

  it('the list row: one shape, 12 hours a week', () => {
    const shapes = partsShapes(slots.map(s => ({ weekday: s.weekday, start: s.start, end: s.end, place: s.place })));
    assert.equal(shapes.length, 1);
    assert.equal(shapes[0].when, 'Mon and Wed · 6:00–9:00 p.m.');
    assert.deepEqual(shapes[0].places, ['Diamond 1', 'Diamond 2']);
    assert.equal(shapes[0].minutesAWeek, 720);
  });
});

describe('Practice time: teams at once', () => {
  const monday = weekly(1, '18:00', '21:00', 'Diamond 1', 3);
  it('2 teams at once halves the practice times needed: 6 teams fit one diamond\'s three hours', () => {
    const one = planPractices({ slots: monday, teams: teams(6), settings: { practiceMinutes: 60, teamsAtOnce: 1 } });
    assert.equal(one.perTeam, 0);
    assert.equal(one.goWithout, 3);
    const two = planPractices({ slots: monday, teams: teams(6), settings: { practiceMinutes: 60, teamsAtOnce: 2 } });
    assert.equal(two.seatsAWeek, 6);
    assert.equal(two.perTeam, 1);
    assert.equal(two.openAWeek, 0);
    for (const week of byWeek(two.rows)) {
      assert.equal(week.length, 6);
      assert.equal(new Set(week.map(r => r.scheduledAt)).size, 3, 'three practice times, two teams each');
    }
    assertFloors(two.rows, 2);
    assert.equal(W.perFacility(2), '2 per facility');
  });
});

describe('Practice time: when the time is short, the teams take turns going without', () => {
  // The club cut its time into 90-minute slots: a 60-minute practice fits once in each (never across two).
  const cut = [1, 3].flatMap(day => ['Diamond 1', 'Diamond 2'].flatMap(place => [
    ...weekly(day, '18:00', '19:30', place, 10), ...weekly(day, '19:30', '21:00', place, 10),
  ]));
  const plan = planPractices({ slots: cut, teams: teams(10), settings: { practiceMinutes: 60, teamsAtOnce: 1 } });

  it('8 seats for 10 teams: 8 a week, 2 go without', () => {
    assert.equal(plan.seatsAWeek, 8);
    assert.equal(plan.perTeam, 0);
    assert.equal(plan.practicesAWeek, 8);
    assert.equal(plan.goWithout, 2);
    assert.equal(plan.openAWeek, 0);
    assert.equal(W.shortLead(8, 10), 'There’s room for 8 of 10 teams each week.');
    assert.equal(W.shortTurns(2), 'The other 2 teams take turns going without, week by week.');
    assert.equal(W.shortTurns(1), 'The other 1 team takes turns going without, week by week.');
  });

  it('over ten weeks every team goes without exactly twice', () => {
    for (const week of byWeek(plan.rows)) assert.equal(week.length, 8);
    for (const t of teams(10)) assert.equal(plan.rows.filter(r => r.teamId === t.id).length, 8, t.name);
    assertFloors(plan.rows, 1);
    assert.equal(plan.turns, true);
  });
});

describe('Practice time: what doesn\'t fit', () => {
  it('a practice longer than every slot fits nowhere — said in words, never a raw error', () => {
    const plan = planPractices({ slots: drawn(), teams: teams(10), settings: { practiceMinutes: 240, teamsAtOnce: 1 } });
    assert.equal(plan.rows.length, 0);
    assert.equal(plan.seatsAWeek, 0);
    assert.equal(plan.practicesAWeek, 0);
    assert.equal(plan.tooShort, 4);
    assert.equal(W.tooLong('U12'), 'Each practice is longer than any of U12’s practice time. Pick a shorter practice.');
  });

  it('a slot shorter than a practice stays open; the rest is planned', () => {
    const slots = [...drawn(), ...weekly(5, '18:00', '18:45', 'Diamond 1')];
    const plan = planPractices({ slots, teams: teams(10), settings: { practiceMinutes: 60, teamsAtOnce: 1 } });
    assert.equal(plan.tooShort, 1);
    assert.equal(plan.seatsAWeek, 12);
    assert.equal(plan.practicesAWeek, 10);
    const friday = new Set(slots.filter(s => s.weekday === 5).map(s => s.id));
    assert.ok(plan.rows.every(r => !friday.has(r.slotId)));
    // Still planned over: a practice left on it from a longer setting goes.
    assert.ok([...friday].every(id => plan.slotIds.includes(id)));
    assert.equal(W.tooShort(1), '1 part is shorter than a practice, so it stays open.');
  });

  it('a division with no practice time plans nothing', () => {
    const plan = planPractices({ slots: [], teams: teams(10), settings: { practiceMinutes: 60, teamsAtOnce: 1 } });
    assert.deepEqual(plan.rows, []);
    assert.deepEqual(plan.slotIds, []);
    assert.equal(plan.seatsAWeek, 0);
    assert.equal(W.empty('U12'), 'U12 has no practice time yet.');
  });

  it('a division with no teams plans nothing over its time', () => {
    const plan = planPractices({ slots: drawn(), teams: [], settings: { practiceMinutes: 60, teamsAtOnce: 1 } });
    assert.equal(plan.rows.length, 0);
    assert.equal(plan.openAWeek, 12);
  });
});

describe('Practice time: two a week, and a week the club took a date back', () => {
  it('5 teams on the drawing\'s time: 2 a week each, on two different days', () => {
    const plan = planPractices({ slots: drawn(), teams: teams(5), settings: { practiceMinutes: 60, teamsAtOnce: 1 } });
    assert.equal(plan.perTeam, 2);
    assert.equal(plan.practicesAWeek, 10);
    assert.equal(plan.openAWeek, 2);
    for (const week of byWeek(plan.rows)) {
      for (const t of teams(5)) {
        const mine = week.filter(r => r.teamId === t.id);
        assert.equal(mine.length, 2);
        assert.notEqual(new Date(mine[0].scheduledAt).getUTCDay(), new Date(mine[1].scheduledAt).getUTCDay(), `${t.name} twice on one day`);
      }
    }
    assertFloors(plan.rows, 1);
  });

  it('a missing Monday on Diamond 1: two of its three teams take that week\'s open seats, the third goes without', () => {
    const slots = drawn();
    const gone = slots.find(s => s.weekday === 1 && s.place === 'Diamond 1' && s.day === '2027-06-14')!;
    const plan = planPractices({ slots: slots.filter(s => s !== gone), teams: teams(10), settings: { practiceMinutes: 60, teamsAtOnce: 1 } });
    const weeks = byWeek(plan.rows);
    assert.equal(weeks[0].length, 10);
    assert.equal(weeks[1].length, 9, 'nine seats that week, all used');
    assert.equal(new Set(weeks[1].map(r => r.teamId)).size, 9);
    assertFloors(plan.rows, 1);
  });
});

describe('Practice time: settings', () => {
  it('reads the step\'s ranges and nothing else', () => {
    assert.deepEqual(readSettings({ practiceMinutes: 60, teamsAtOnce: 1 }), { practiceMinutes: 60, teamsAtOnce: 1 });
    assert.deepEqual(readSettings({ practiceMinutes: '90', teamsAtOnce: '2' }), { practiceMinutes: 90, teamsAtOnce: 2 });
    for (const bad of [{ practiceMinutes: 10, teamsAtOnce: 1 }, { practiceMinutes: 241, teamsAtOnce: 1 }, { practiceMinutes: 60, teamsAtOnce: 5 },
      { practiceMinutes: 60, teamsAtOnce: 0 }, { practiceMinutes: 60.5, teamsAtOnce: 1 }, null, {}]) {
      assert.equal(readSettings(bad), null, JSON.stringify(bad));
    }
  });
});
