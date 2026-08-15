// The monthly recurrence engine behind recurring payables (plan §6.1/§6.5). Pure date maths, so
// this runs under plain `node --test` with no app, no DB and no clock.
//
// The cases that matter here are not "does it count months" — they are the three places a coach's
// money can quietly go wrong: a short month, a run longer than anyone meant, and a submitted date
// the rule never produced.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  generateMonthlyOccurrences, reviewMonthlyOccurrences, MAX_MONTHLY_OCCURRENCES,
} from '../../lib/coach-monthly-recurrence.ts';

const dates = (rule: Parameters<typeof generateMonthlyOccurrences>[0]) =>
  generateMonthlyOccurrences(rule).map(o => o.date);

describe('monthly recurrence — the short month (§3.3)', () => {
  it('CLAMPS the 31st into February and KEEPS the count', () => {
    // The defect this rule exists to prevent: six months of dome rent producing five payables.
    const run = generateMonthlyOccurrences({ dayOfMonth: 31, startDate: '2026-01-31', end: { count: 6 } });
    assert.deepEqual(run.map(o => o.date), [
      '2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31', '2026-06-30',
    ]);
    assert.equal(run.length, 6, 'six months asked for, six payables produced');
    assert.deepEqual(run.map(o => o.clamped), [false, true, false, true, false, true]);
  });

  it('flags ONLY the months that were actually short', () => {
    const run = generateMonthlyOccurrences({ dayOfMonth: 29, startDate: '2026-11-29', end: { count: 5 } });
    assert.deepEqual(run.map(o => o.date), [
      '2026-11-29', '2026-12-29', '2027-01-29', '2027-02-28', '2027-03-29',
    ]);
    assert.deepEqual(run.filter(o => o.clamped).map(o => o.date), ['2027-02-28']);
  });

  it('the 30th survives a LEAP February by one day, and says it was moved', () => {
    const run = generateMonthlyOccurrences({ dayOfMonth: 30, startDate: '2027-12-30', end: { count: 3 } });
    assert.deepEqual(run.map(o => o.date), ['2027-12-30', '2028-01-30', '2028-02-29']);
    assert.equal(run[2].clamped, true, '2028 has a 29th, but the coach typed the 30th');
  });

  it('"last day" is a real choice, not sugar for the 31st — and never reads as clamped', () => {
    const leap = generateMonthlyOccurrences({ dayOfMonth: 'last', startDate: '2028-01-01', end: { count: 3 } });
    assert.deepEqual(leap.map(o => o.date), ['2028-01-31', '2028-02-29', '2028-03-31']);

    const plain = generateMonthlyOccurrences({ dayOfMonth: 'last', startDate: '2026-01-01', end: { count: 3 } });
    assert.deepEqual(plain.map(o => o.date), ['2026-01-31', '2026-02-28', '2026-03-31']);

    for (const o of [...leap, ...plain]) {
      assert.equal(o.clamped, false, 'the last day IS what was asked for — no note belongs on it');
    }
  });

  it('handles the century leap rule rather than assuming every fourth year', () => {
    assert.deepEqual(dates({ dayOfMonth: 'last', startDate: '2100-02-01', end: { count: 1 } }), ['2100-02-28']);
    assert.deepEqual(dates({ dayOfMonth: 'last', startDate: '2000-02-01', end: { count: 1 } }), ['2000-02-29']);
  });
});

describe('monthly recurrence — where a run starts and ends', () => {
  it('starts at the first matching date ON OR AFTER the start date', () => {
    // Signing up mid-September for "the 1st" means October, not a backdated September payable.
    assert.deepEqual(dates({ dayOfMonth: 1, startDate: '2026-09-15', end: { count: 2 } }), ['2026-10-01', '2026-11-01']);
    // ...but a day still to come this month is this month's.
    assert.deepEqual(dates({ dayOfMonth: 20, startDate: '2026-09-15', end: { count: 2 } }), ['2026-09-20', '2026-10-20']);
  });

  it('crosses a year boundary without losing its place', () => {
    assert.deepEqual(dates({ dayOfMonth: 15, startDate: '2026-11-15', end: { count: 4 } }), [
      '2026-11-15', '2026-12-15', '2027-01-15', '2027-02-15',
    ]);
  });

  it('carries the 31st across December into a new year, clamping only where it must', () => {
    const run = generateMonthlyOccurrences({ dayOfMonth: 31, startDate: '2026-12-31', end: { count: 3 } });
    assert.deepEqual(run.map(o => o.date), ['2026-12-31', '2027-01-31', '2027-02-28']);
    assert.deepEqual(run.map(o => o.clamped), [false, false, true]);
  });

  it('"after 6 payments" and "until the 6th date" produce the SAME list', () => {
    const byCount = dates({ dayOfMonth: 1, startDate: '2026-09-01', end: { count: 6 } });
    const byUntil = dates({ dayOfMonth: 1, startDate: '2026-09-01', end: { until: '2027-02-01' } });
    assert.deepEqual(byCount, [
      '2026-09-01', '2026-10-01', '2026-11-01', '2026-12-01', '2027-01-01', '2027-02-01',
    ]);
    assert.deepEqual(byUntil, byCount, 'the two ways of saying the same run must agree exactly');
  });

  it('treats "until" as inclusive of its own date, and stops the day short of the next', () => {
    assert.deepEqual(dates({ dayOfMonth: 1, startDate: '2026-09-01', end: { until: '2026-10-31' } }), [
      '2026-09-01', '2026-10-01',
    ]);
  });
});

describe('monthly recurrence — the ceiling REFUSES (§3.4)', () => {
  it('allows a run of exactly the ceiling, by either end shape', () => {
    assert.equal(dates({ dayOfMonth: 1, startDate: '2026-01-01', end: { count: MAX_MONTHLY_OCCURRENCES } }).length, 24);
    assert.equal(dates({ dayOfMonth: 1, startDate: '2026-01-01', end: { until: '2027-12-01' } }).length, 24);
  });

  it('refuses one payment past it — and returns NOTHING, never a quiet 24 of 25', () => {
    // A truncated preview is a promise the commit route cannot keep: it enforces the same ceiling
    // and would refuse the rest, so the coach would tick 24 rows believing they had asked for 25.
    assert.deepEqual(generateMonthlyOccurrences({
      dayOfMonth: 1, startDate: '2026-01-01', end: { count: MAX_MONTHLY_OCCURRENCES + 1 },
    }), []);
    assert.deepEqual(generateMonthlyOccurrences({
      dayOfMonth: 1, startDate: '2026-01-01', end: { until: '2028-01-01' },
    }), [], 'the 25th date is one too many');
  });

  it('refuses a rule that would run for years instead of generating forever', () => {
    assert.deepEqual(dates({ dayOfMonth: 1, startDate: '2026-01-01', end: { until: '2036-01-01' } }), []);
  });
});

describe('monthly recurrence — an empty result is not always the ceiling', () => {
  it('returns nothing when the window is too narrow to hold a single occurrence', () => {
    // NOT the ceiling — the opposite. A caller that reports every [] as "your run is too long"
    // would tell this coach exactly the wrong thing, so the module documents all three causes.
    assert.deepEqual(dates({ dayOfMonth: 20, startDate: '2026-03-15', end: { until: '2026-03-18' } }), []);
    // ...and the documented way to tell the two apart: ask for one, and see where it lands.
    const [probe] = generateMonthlyOccurrences({ dayOfMonth: 20, startDate: '2026-03-15', end: { count: 1 } });
    assert.equal(probe.date, '2026-03-20', 'after the until — so the window was empty, not the run too long');
  });
});

describe('monthly recurrence — refuses to guess (§3.9)', () => {
  it('REFUSES a start date that is not a real day on the calendar', () => {
    // The defect this exists for: month 13 stepped on to "2026-14-01" — a string that is not a
    // date at all — and the reconcile then accepted it as a due date to write.
    assert.deepEqual(dates({ dayOfMonth: 1, startDate: '2026-13-01', end: { count: 3 } }), []);
    assert.deepEqual(dates({ dayOfMonth: 1, startDate: '2026-00-01', end: { count: 3 } }), []);
    assert.deepEqual(dates({ dayOfMonth: 1, startDate: '2026-01-32', end: { count: 3 } }), []);
    assert.deepEqual(dates({ dayOfMonth: 1, startDate: '2026-02-30', end: { count: 3 } }), [],
      'the 30th of February passes a format check and is still not a day');
    assert.deepEqual(dates({ dayOfMonth: 1, startDate: '2026-01-00', end: { count: 3 } }), []);
    // 2027 is not a leap year, so its 29th of February does not exist either.
    assert.deepEqual(dates({ dayOfMonth: 1, startDate: '2027-02-29', end: { count: 3 } }), []);
    assert.deepEqual(dates({ dayOfMonth: 1, startDate: '2028-02-29', end: { count: 1 } }), ['2028-03-01'],
      'but 2028 IS a leap year — a real date must still be accepted');
  });

  it('applies the same calendar check to the end date', () => {
    assert.deepEqual(dates({ dayOfMonth: 1, startDate: '2026-01-01', end: { until: '2026-13-01' } }), []);
    assert.deepEqual(dates({ dayOfMonth: 1, startDate: '2026-01-01', end: { until: '2026-02-30' } }), []);
  });

  it('REFUSES a rule that ends two different ways at once', () => {
    // Letting the count silently win leaves an end date showing in the form and doing nothing.
    assert.deepEqual(dates({
      dayOfMonth: 1, startDate: '2026-01-01', end: { count: 6, until: '2026-02-01' } as unknown as { count: number },
    }), []);
  });

  it('ignores a LEFT-BEHIND blank end date — an empty field is not a second answer', () => {
    // A coach who typed a date, then switched to "after N payments", leaves the old input behind.
    assert.deepEqual(dates({
      dayOfMonth: 1, startDate: '2026-01-01', end: { count: 2, until: '  ' } as unknown as { count: number },
    }), ['2026-01-01', '2026-02-01']);
  });

  it('refuses a count run it could not complete rather than returning a short one', () => {
    // Past the year 9999 a five-digit year stops sorting as a date, so the run would silently end
    // early — the five-payables-from-a-six-month-rule failure, wearing a different hat.
    assert.deepEqual(dates({ dayOfMonth: 1, startDate: '9999-11-01', end: { count: 4 } }), []);
  });

  it('returns nothing for a malformed or incomplete rule rather than throwing', () => {
    assert.deepEqual(dates({ dayOfMonth: 1, startDate: 'nope', end: { count: 3 } }), []);
    assert.deepEqual(dates({ dayOfMonth: 0, startDate: '2026-01-01', end: { count: 3 } }), []);
    assert.deepEqual(dates({ dayOfMonth: 32, startDate: '2026-01-01', end: { count: 3 } }), []);
    assert.deepEqual(dates({ dayOfMonth: 1.5, startDate: '2026-01-01', end: { count: 3 } }), []);
    assert.deepEqual(dates({ dayOfMonth: 'first' as unknown as 'last', startDate: '2026-01-01', end: { count: 3 } }), []);
    assert.deepEqual(dates({ dayOfMonth: 1, startDate: '2026-01-01', end: {} as { count: number } }), []);
    assert.deepEqual(dates({ dayOfMonth: 1, startDate: '2026-01-01', end: { count: 0 } }), []);
    assert.deepEqual(dates({ dayOfMonth: 1, startDate: '2026-01-01', end: { until: 'nope' } }), []);
    assert.deepEqual(dates({ dayOfMonth: 1, startDate: '2026-06-01', end: { until: '2026-01-01' } }), [],
      'a run that ends before it starts is a typo, not an empty series');
  });
});

describe('monthly recurrence — the reconcile (§3.5)', () => {
  const rule = { dayOfMonth: 31, startDate: '2026-01-31', end: { count: 6 } };
  // Pinned as LITERALS, never rebuilt by calling the generator: a reconcile test whose input comes
  // from the function under test proves only that the module agrees with itself.
  const RUN = ['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31', '2026-06-30'];
  /** Creating a run: the series holds nothing yet. Extension passes the real count instead. */
  const NEW_SERIES = 0;

  it('accepts the reviewed list and carries each row’s own amount', () => {
    const reviewed = reviewMonthlyOccurrences(rule, RUN.map((date, i) => ({ date, amount: 100 + i })), NEW_SERIES);
    assert.equal(reviewed.exceedsCeiling, false);
    assert.equal(reviewed.seriesTotal, 6);
    assert.equal(reviewed.accepted.length, 6);
    assert.equal(reviewed.accepted[0].amount, 100);
    assert.equal(reviewed.accepted[5].amount, 105);
    assert.deepEqual(reviewed.removed, []);
    assert.deepEqual(reviewed.unknown, []);
  });

  it('takes `clamped` from the FRESH generation, not from the submission', () => {
    // The client could claim anything; the server's own arithmetic decides what February was.
    // The extra property is what a commit route reading raw JSON off the wire could receive, so
    // it is submitted here deliberately — and must be ignored, not trusted.
    const reviewed = reviewMonthlyOccurrences(rule, [
      { date: '2026-02-28', clamped: false } as unknown as { date: string },
      { date: '2026-03-31', clamped: true } as unknown as { date: string },
    ], NEW_SERIES);
    assert.equal(reviewed.accepted[0].clamped, true, 'February WAS clamped, whatever the client said');
    assert.equal(reviewed.accepted[1].clamped, false, 'March was not, whatever the client said');
  });

  it('treats a generated-but-unsubmitted date as a deliberate removal (the month off)', () => {
    const reviewed = reviewMonthlyOccurrences(rule, RUN.filter(d => d !== '2026-04-30').map(date => ({ date })), NEW_SERIES);
    assert.equal(reviewed.accepted.length, 5);
    assert.deepEqual(reviewed.removed, ['2026-04-30'], 'removed — the coach untucked that month');
    assert.deepEqual(reviewed.unknown, [], 'and NOT unknown: a removal must never fail the commit');
  });

  it('REFUSES a date the rule cannot produce — never silently drops it', () => {
    const reviewed = reviewMonthlyOccurrences(rule, [
      { date: '2026-01-31' },
      { date: '2026-02-15' }, // a date this rule has no way of producing
    ], NEW_SERIES);
    assert.deepEqual(reviewed.unknown, ['2026-02-15']);
    assert.equal(reviewed.accepted.length, 1);
  });

  it('refuses the UNCLAMPED date a naive client would have sent for February', () => {
    // "2026-02-31" does not exist; a client that stepped months without the clamp would send it.
    assert.deepEqual(reviewMonthlyOccurrences(rule, [{ date: '2026-02-31' }], NEW_SERIES).unknown, ['2026-02-31']);
  });

  it('refuses a duplicated date rather than billing the same month twice', () => {
    const reviewed = reviewMonthlyOccurrences(rule, [{ date: '2026-01-31' }, { date: '2026-01-31' }], NEW_SERIES);
    assert.equal(reviewed.accepted.length, 1);
    assert.deepEqual(reviewed.unknown, ['2026-01-31']);
  });

  it('returns everything as unknown when the rule itself generates nothing', () => {
    // A rule over the ceiling produces no dates, so nothing submitted against it can be written.
    const reviewed = reviewMonthlyOccurrences(
      { dayOfMonth: 1, startDate: '2026-01-01', end: { count: 99 } },
      [{ date: '2026-01-01' }],
      NEW_SERIES,
    );
    assert.deepEqual(reviewed.accepted, []);
    assert.deepEqual(reviewed.unknown, ['2026-01-01']);
  });

  it('returns the accepted rows in date order, whatever order they arrived in', () => {
    const reviewed = reviewMonthlyOccurrences(rule, [
      { date: '2026-03-31' }, { date: '2026-01-31' }, { date: '2026-02-28' },
    ], NEW_SERIES);
    assert.deepEqual(reviewed.accepted.map(o => o.date), ['2026-01-31', '2026-02-28', '2026-03-31']);
  });

  it('carries no per-occurrence description — §4.6 rules one out, so the shape must not offer it', () => {
    const [accepted] = reviewMonthlyOccurrences(rule, [
      { date: '2026-01-31', description: 'Dome — January' } as unknown as { date: string },
    ], NEW_SERIES).accepted;
    assert.deepEqual(Object.keys(accepted).sort(), ['amount', 'clamped', 'date'],
      'an accepted row is date + clamped + amount; anything more invites a feature the owner excluded');
  });

  it('never invents an amount from an unusable one', () => {
    const reviewed = reviewMonthlyOccurrences(rule, [
      { date: '2026-01-31', amount: Number.NaN },
      { date: '2026-02-28', amount: null },
    ], NEW_SERIES);
    assert.equal(reviewed.accepted[0].amount, null);
    assert.equal(reviewed.accepted[1].amount, null);
  });
});

// ── the SERIES ceiling (§3.4 / §5.3) ─────────────────────────────────────────
// The ceiling counts the series, not the request. Every half of "a run of 20, extended by 6"
// passes a per-request check on its own, which is exactly why the sum is enforced here — in the
// one place every write goes through — rather than left to each route to remember.

describe('monthly recurrence — the ceiling counts the SERIES (§5.3)', () => {
  const extension = { dayOfMonth: 1, startDate: '2027-01-01', end: { count: 6 } };
  const SIX = ['2027-01-01', '2027-02-01', '2027-03-01', '2027-04-01', '2027-05-01', '2027-06-01'];
  const submit = (dates: string[]) => dates.map(date => ({ date }));

  it('REFUSES extending a run of 20 by 6 — the case the plan names', () => {
    const reviewed = reviewMonthlyOccurrences(extension, submit(SIX), 20);
    assert.equal(reviewed.exceedsCeiling, true);
    assert.equal(reviewed.seriesTotal, 26);
  });

  it('FAILS CLOSED — a route that writes `accepted` without reading the flag writes nothing', () => {
    // This is the whole reason the refusal empties the result rather than just setting a flag.
    const reviewed = reviewMonthlyOccurrences(extension, submit(SIX), 20);
    assert.deepEqual(reviewed.accepted, [], 'nothing writable comes back from a refused extension');
    assert.deepEqual(reviewed.removed, []);
    assert.deepEqual(reviewed.unknown, []);
  });

  it('allows the same extension once the coach unticks enough months', () => {
    // The ceiling counts what the series will HOLD, so coming back under it works as expected.
    const reviewed = reviewMonthlyOccurrences(extension, submit(SIX.slice(0, 4)), 20);
    assert.equal(reviewed.exceedsCeiling, false);
    assert.equal(reviewed.seriesTotal, 24, 'exactly the ceiling is allowed');
    assert.equal(reviewed.accepted.length, 4);
  });

  it('refuses by ONE — 19 existing plus 6 is 25', () => {
    assert.equal(reviewMonthlyOccurrences(extension, submit(SIX), 19).exceedsCeiling, true);
    assert.equal(reviewMonthlyOccurrences(extension, submit(SIX), 18).exceedsCeiling, false);
  });

  it('a run that passes on its own is refused once the series it joins is counted', () => {
    // Six is nowhere near the ceiling; the generator is perfectly happy with it on its own.
    assert.equal(generateMonthlyOccurrences(extension).length, 6, 'the run alone is fine');
    assert.equal(reviewMonthlyOccurrences(extension, submit(SIX), 20).exceedsCeiling, true);
  });

  it('treats an unusable existing-count as ALREADY over the ceiling', () => {
    // A route that cannot say how big the series is must not get the benefit of the doubt: a
    // refusal is a message; a 40-row series is money rows deleted by hand.
    for (const bad of [Number.NaN, -1, 1.5, undefined, null]) {
      const reviewed = reviewMonthlyOccurrences(extension, submit(SIX), bad as unknown as number);
      assert.equal(reviewed.exceedsCeiling, true, `an existing-count of ${String(bad)} must not pass`);
      assert.deepEqual(reviewed.accepted, []);
    }
  });
});
