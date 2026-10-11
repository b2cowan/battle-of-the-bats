/**
 * A weekly series' dates, grouped by what they have to say (owner 2026-10-11, decision sheet
 * https://claude.ai/artifact/NKSa5J2q25Rm13aEXFwk2G, Asks 1–5 as recommended): the grouping rule, the group's one door,
 * and where the coach's form draws the list (after Where and Who — Ask 5).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { groupDoor, seriesDateGroups, SERIES_LIST_WORDS as LW } from '../../lib/series-date-groups.ts';

const OUT = 'Outside the club’s permit';
const CLASH = 'Diamond 2 · 14U AA practice, 5:30–7:30 p.m.';
const dates = ['2026-10-28', '2026-11-04', '2026-11-11', '2026-11-18', '2026-11-25', '2026-12-02', '2026-12-09', '2026-12-16'];

describe('seriesDateGroups — one group per note, the marked ones first', () => {
  it('a series with nothing to say is ONE plain group (no heading is drawn for it)', () => {
    const g = seriesDateGroups(dates, () => undefined);
    assert.equal(g.length, 1);
    assert.deepEqual(g[0], { key: 'plain', clash: null, permit: null, dates });
  });

  it('the screenshot: four outside the permit, then the other dates — each in date order', () => {
    const g = seriesDateGroups(dates, d => (d < '2026-11-25' ? { permit: OUT } : undefined));
    assert.deepEqual(g.map(x => [x.permit, x.dates.length]), [[OUT, 4], [null, 4]]);
    assert.deepEqual(g[0].dates, dates.slice(0, 4));
    assert.deepEqual(g[1].dates, dates.slice(4));
  });

  it('marked groups lead even when the plain dates come first (Ask 2), in the order of their first date', () => {
    const g = seriesDateGroups(dates, d => (d === '2026-12-09' || d === '2026-12-16' ? { clash: CLASH } : d === '2026-11-18' ? { permit: OUT } : undefined));
    assert.deepEqual(g.map(x => x.clash ?? x.permit ?? 'plain'), [OUT, CLASH, 'plain']);
    assert.equal(g[2].dates.length, 5);
  });

  it('a date that clashes AND is outside groups with the dates that say both — never with either alone', () => {
    const g = seriesDateGroups(dates, d => (d === '2026-10-28' ? { clash: CLASH, permit: OUT } : d === '2026-11-04' ? { permit: OUT } : d === '2026-11-11' ? { clash: CLASH, permit: OUT } : undefined));
    const both = g.find(x => x.clash && x.permit);
    assert.deepEqual(both?.dates, ['2026-10-28', '2026-11-11']);
    assert.deepEqual(g.find(x => !x.clash && x.permit)?.dates, ['2026-11-04']);
  });

  it('two different bookings are two groups — two different things to know', () => {
    const other = 'Diamond 2 · 12U AA practice, 6:00–7:30 p.m.';
    const g = seriesDateGroups(dates, d => (d === '2026-11-04' ? { clash: CLASH } : d === '2026-11-11' ? { clash: other } : undefined));
    assert.deepEqual(g.map(x => x.clash), [CLASH, other, null]);
  });

  it('an empty note counts as nothing to say', () => {
    const g = seriesDateGroups(dates.slice(0, 2), () => ({ clash: '', permit: null }));
    assert.equal(g.length, 1);
    assert.equal(g[0].key, 'plain');
  });
});

describe('groupDoor — a marked group\'s one door (Ask 3)', () => {
  it('two or more still in: remove them all, counted', () => {
    assert.deepEqual(groupDoor(4, 4), { act: 'remove', label: 'Remove these 4' });
    assert.deepEqual(groupDoor(4, 2), { act: 'remove', label: 'Remove these 2' });
  });
  it('all removed: put them all back, the whole group counted', () => {
    assert.deepEqual(groupDoor(4, 0), { act: 'restore', label: 'Put these 4 back' });
  });
  it('one still in, or a group of one: no door — the chip is the one tap', () => {
    assert.equal(groupDoor(4, 1), null);
    assert.equal(groupDoor(1, 1), null);
    assert.equal(groupDoor(1, 0), null);
  });
  it('one verb for one act: remove, and put back — never "leave out" (one spelling, owner 2026-08-24)', () => {
    for (const w of Object.values(LW)) {
      const s = typeof w === 'function' ? w(3 as never) : w;
      assert.ok(!/leave (it )?out|left out/i.test(String(s)), String(s));
    }
    assert.equal(LW.removeDate('Oct 28'), 'Remove Oct 28');
    assert.equal(LW.putDateBack('Oct 28'), 'Put Oct 28 back');
  });
});

describe('the coach\'s form draws the grouped list after Where and Who (Ask 5)', () => {
  const form = readFileSync('components/coaches/ScheduleEventForm.tsx', 'utf8');
  const css = readFileSync('app/[orgSlug]/coaches/coaches.module.css', 'utf8');

  it('the list is drawn ONCE, after the Who section and before More — never under the times', () => {
    assert.equal(form.split('{dateList}').length - 1, 1);
    const at = form.indexOf('{dateList && <section className={styles.formSection}>{dateList}</section>}');
    assert.ok(at > form.indexOf('{/* WHO — games only */}'), 'after Who');
    assert.ok(at > form.indexOf('<WhereField'), 'after Where');
    assert.ok(at < form.indexOf('{/* EVERYTHING OPTIONAL'), 'before More');
  });

  it('the check asks about every date (a removed one keeps its mark), the lines count only the kept ones', () => {
    assert.match(form, /const checkDates = recurringSeries \? recurrenceDates : seriesEdit \? scopeDates : null;/);
    assert.match(form, /: checkDates\s*\? \(form\.startTime \? checkDates\.map\(/);
    assert.match(form, /\(c: CoachCheck\) => countFindings\(keptOnly\(c\.findings\)\)/, 'Save stops only for a kept date');
    assert.match(form, /const clashResults = check \? keptOnly\(check\.findings\) : null;/);
    assert.match(form, /const permitResults = check \? keptOnly\(check\.permits\) : null;/);
    assert.match(form, /checkDates\.forEach\(\(d, i\) => \{ const f = check\.findings\[i\];/, 'marks for every asked date');
  });

  it('a game series keeps a row per date, a blank one showing the opponent it will be saved with', () => {
    assert.match(form, /const gameRows = recurringSeries && recurrenceIsGame;/);
    assert.match(form, /placeholder=\{opponentFallback \|\| 'Opponent'\}/);
  });

  it('chips are Add\'s alone; an edit\'s dates are words', () => {
    const list = form.slice(form.indexOf('const dateList ='), form.indexOf(') : null;', form.indexOf('const dateList =')));
    assert.match(list, /\{recurringSeries \? \(\s*<div className=\{styles\.occChips\}>/);
    assert.match(list, /<p className=\{styles\.occGroupDates\}>\{joinWithAnd\(g\.dates\.map\(shortDate\)\)\}<\/p>/);
    assert.ok(!/fmtClock\(form\.startTime\)/.test(form), 'an unmarked date no longer repeats the start time');
  });

  it('a chip is the removable pill, 44px at touch widths', () => {
    assert.match(css, /\.occChip \{[\s\S]*?border-radius: 999px;/);
    assert.match(css, /@media \(max-width: 768px\) \{\s*\.occChip \{ min-height: var\(--tap-min, 44px\);[^}]*\}\s*\.occGroupDoor \{ min-height: var\(--tap-min, 44px\); \}/);
  });

  it('the remove taps are held while the form saves — the save sends the dates as they stood at the press (/review)', () => {
    const list = form.slice(form.indexOf('const dateList ='), form.indexOf(') : null;', form.indexOf('const dateList =')));
    assert.equal((list.match(/disabled=\{saving\}/g) ?? []).length, 3, 'a game row\'s ✕, a group\'s door, a date chip');
  });

  it('every date of a series is checked: the series can never outgrow what the clash check answers (/review)', () => {
    // The check asks about EVERY generated date and pairs each answer to its date by position; the route answers at
    // most its own MAX_OCCURRENCES. Equal today (60 and 60) — raise one without the other and a removed date would
    // shift the permit line's pairing for every date after the cap.
    const recurrence = readFileSync('lib/coach-recurrence.ts', 'utf8');
    const route = readFileSync('app/api/coaches/[orgSlug]/teams/[teamId]/venue-clashes/route.ts', 'utf8');
    const series = Number(/export const MAX_RECURRENCE_OCCURRENCES = (\d+);/.exec(recurrence)?.[1]);
    const answered = Number(/const MAX_OCCURRENCES = (\d+);/.exec(route)?.[1]);
    assert.ok(series > 0 && answered > 0, 'both caps are still declared where this guard reads them');
    assert.ok(series <= answered, `a series of ${series} dates, a check that answers ${answered}`);
  });
});
