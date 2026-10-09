import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode, readSource, stripComments } from './_source-code.ts';
import { SERIES_EDIT_ROWS, reachHint, seriesReach } from '../../lib/coach-series-scope.ts';
import type { RepTeamEvent } from '../../lib/types.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════
 * A REPEATING EVENT'S PENCIL ASKS WHICH DATES FIRST (owner ruling 2026-10-09, all four asks as recommended; drawn as
 * artifact 1NaTneZ5YFprr9SCt8bESG; found walking Club Tier §284 W4).
 *
 *   1 The pencil asks This practice only · This & future · All practices BEFORE the form opens — so the form knows
 *     its dates and checks every one for clashes. Asked after Save (the old "Apply your changes to:" foot), the form
 *     had checked only the opened date, and the server's answer for the others arrived after the write, unshown.
 *   2 This & future / All: the Date box gives way to the list of the dates (each keeps its own day — the series write
 *     takes only the time, so the box could never move them).
 *   3 Save names what it saves: "Save 2 practices".
 *   4 The menu always shows three rows, as Delete does; the line under each says which dates it reaches.
 * ══════════════════════════════════════════════════════════════════════════════════════════
 */
const ev = (id: string, startsAt: string, parent: string | null = null, status = 'scheduled'): RepTeamEvent =>
  ({ id, startsAt, recurrenceParentId: parent, isRecurring: true, status }) as unknown as RepTeamEvent;

// Tuesdays at 6:00 p.m. Toronto (22:00Z in October, 23:00Z after the clocks go back on Nov 1).
const oct20 = ev('a', '2026-10-20T22:00:00+00:00');
const oct27 = ev('b', '2026-10-27T22:00:00+00:00', 'a', 'cancelled');
const nov3 = ev('c', '2026-11-03T23:00:00+00:00', 'a');
const nov10 = ev('d', '2026-11-10T23:00:00+00:00', 'a');
const other = ev('x', '2026-11-03T23:00:00+00:00');
const events = [nov10, other, oct20, nov3, oct27];

describe('which dates each answer reaches — the server\'s series write, mirrored', () => {
  it('All is the first event and every one hung off it, in date order; This & future starts at the opened one', () => {
    const r = seriesReach(events, nov3);
    assert.deepEqual(r.one, ['2026-11-03']);
    assert.deepEqual(r.remaining, ['2026-11-03', '2026-11-10']);
    assert.deepEqual(r.all, ['2026-10-20', '2026-10-27', '2026-11-03', '2026-11-10'], 'a cancelled date is counted: the write changes it too');
    assert.ok(!r.all.includes('x'), 'another series on the same night is not this one');
  });
  it('opened on the first date, This & future and All reach the same dates', () => {
    const r = seriesReach(events, oct20);
    assert.deepEqual(r.remaining, r.all);
  });
  it('days are the org\'s, never UTC\'s — an evening event is not a day late', () => {
    const late = ev('late', '2026-11-04T01:30:00+00:00'); // 8:30 p.m. Toronto on Nov 3
    assert.deepEqual(seriesReach([late], late).all, ['2026-11-03']);
  });
  it('the opened event stands in when the list on screen has not caught up with it', () => {
    assert.deepEqual(seriesReach([], nov3), { one: ['2026-11-03'], remaining: ['2026-11-03'], all: ['2026-11-03'] });
  });
});

describe('the line under each answer in the pencil\'s menu', () => {
  it('one date, two dates, and a run', () => {
    assert.equal(reachHint(['2026-11-03'], 'practice'), 'Nov 3');
    assert.equal(reachHint(['2026-11-03', '2026-11-10'], 'practice'), 'Nov 3 and Nov 10 · 2 practices');
    assert.equal(reachHint(['2026-11-03', '2026-11-10', '2026-11-17', '2026-11-24'], 'practice'), 'Nov 3–24 · 4 practices');
    assert.equal(reachHint(['2026-10-20', '2026-10-27', '2026-11-03'], 'game'), 'Oct 20 – Nov 3 · 3 games');
    assert.equal(reachHint(['2026-12-29', '2027-01-05', '2027-01-12'], 'practice'), 'Dec 29, 2026 – Jan 12, 2027 · 3 practices');
    assert.equal(reachHint([], 'practice'), '');
  });
});

describe('the pencil\'s three rows (ask 4) — worded by the event, three every time', () => {
  it('a practice, a game, a scrimmage', () => {
    assert.deepEqual(SERIES_EDIT_ROWS.map(r => r.scope), ['one', 'remaining', 'all']);
    assert.deepEqual(SERIES_EDIT_ROWS.map(r => r.label('practice')), ['This practice only', 'This & future', 'All practices']);
    assert.deepEqual(SERIES_EDIT_ROWS.map(r => r.label('scrimmage')), ['This scrimmage only', 'This & future', 'All scrimmages']);
  });
});

describe('the markup — asked at the pencil, never after Save', () => {
  const sheet = readCode('components/coaches/ScheduleEventSheet.tsx');
  const page = readCode('app/[orgSlug]/coaches/teams/[teamId]/schedule/page.tsx');
  const form = readCode('components/coaches/ScheduleEventForm.tsx');
  const menu = readCode('components/coaches/CoachToolbarMenu.tsx');
  const css = stripComments(readSource('app/[orgSlug]/coaches/coaches.module.css'));
  const header = sheet.slice(sheet.indexOf('const header = ('), sheet.indexOf('const titleBlock ='));

  it('1 · a repeating event\'s pencil is the portal\'s menu, a sheet over the window on a phone; a one-off\'s opens the form', () => {
    assert.match(header, /seriesReach \? \(\s*<CoachToolbarMenu label=\{`Edit this \$\{word\}`\} icon=\{<Pencil size=\{18\} aria-hidden \/>\} variant="glyph"/);
    assert.match(header, /drawerOnPhone title=\{`Edit which \$\{word\}s\?`\} overWindow>/, 'one question, the sheet\'s label on a phone and the panel\'s heading at a desk');
    assert.match(header, /onClick=\{\(\) => onEdit\(ev\)\}/, 'the one-off pencil, unchanged');
    assert.match(page, /seriesReach=\{selectedReach\}/);
    assert.match(page, /const selectedReach = useMemo\(\s*\(\) => \(selectedEvent\?\.isRecurring \? seriesReach\(events, selectedEvent\) : null\),\s*\[events, selectedEvent\],/);
    assert.ok(menu.includes('role="menu" overWindow={overWindow} onClick={pickCloses}>'), 'the menu\'s sheet can sit over a window');
    assert.ok(menu.includes('label={title ?? drawerTitle}'), 'the title is the sheet\'s label on a phone');
    assert.match(menu, /\{title && <CoachToolbarMenuHeading>\{title\}<\/CoachToolbarMenuHeading>\}/, '…and the popover\'s heading at a desk');
  });
  it('4 · the rows are the list above, each naming its dates — and those dates are what the form opens with', () => {
    assert.match(header, /SERIES_EDIT_ROWS\.map\(row => \(/);
    assert.match(header, /hint=\{reachHint\(seriesReach\[row\.scope\], word\)\}/);
    assert.match(header, /onSelect=\{\(\) => editFromMenu\(row\.scope, seriesReach\[row\.scope\]\)\}/);
  });
  it('on a phone a pick lets the menu\'s sheet give its Back step back BEFORE the form opens (/review 2026-10-09)', () => {
    // Opening the form in the commit that closed both the sheet and the window stranded the window's entry, still
    // naming the game: one dead Back, and a reload there reopened it (driven on dev, .probe/series-scope-history.mjs).
    const pick = sheet.slice(sheet.indexOf('const editFromMenu ='), sheet.indexOf('const header = ('));
    assert.match(pick, /if \(!isPhone\) \{ onEdit\(ev, scope, dates\); return; \}/, 'a desk popover stands no step: at once');
    assert.match(pick, /window\.addEventListener\('popstate', open\);/, 'a phone waits for the sheet\'s entry to pop');
    assert.match(pick, /window\.setTimeout\(\(\) => onEdit\(ev, scope, dates\), 0\);/);
    assert.ok(sheet.indexOf('const editFromMenu =') < sheet.indexOf('const header = ('), 'declared before the head that uses it');
  });
  it('the series pencil IS the one-off\'s pencil — a plain trigger wearing `.ppIconBtn`, lit while its menu is open', () => {
    assert.match(header, /plainTrigger triggerClassName=\{styles\.ppIconBtn\}/);
    assert.match(header, /panelMinWidth=\{300\}/, 'wide enough that a row\'s dates stay on one line, as drawn');
    assert.ok(menu.includes('className={plainTrigger ? triggerClassName : ('), 'a plain trigger wears only the caller\'s class');
    assert.match(css, /\.ppIconBtn\[aria-haspopup\]\[aria-expanded="true"\] \{ color: var\(--text-primary\); background: var\(--white-8\); \}/,
      'only a MENU\'s trigger stays lit — the practice plan\'s block chevron carries aria-expanded too (/review 2026-10-09)');
  });
  it('the form opens with the chosen dates; one press saves exactly those', () => {
    assert.match(page, /scopeDates: scope === 'one' \? \[\] : \[\.\.\.dates\]/);
    assert.match(form, /return handleUpdate\(editScope\);/);
    assert.ok(!/Apply your changes to/.test(form), 'the old question after Save is gone');
    assert.ok(!/editScopeOpen/.test(form));
    assert.ok(!/\.editScope\b/.test(css), 'and its styles');
  });
  it('the check covers every date the list shows, and marks each one in it', () => {
    assert.match(form, /const listDates = recurringSeries \? keptDates : seriesEdit \? scopeDates : null;/);
    assert.match(form, /: listDates\s*\? \(form\.startTime \? listDates\.map\(d => \(\{ startsAt: `\$\{d\}T\$\{form\.startTime\}`/);
    assert.match(form, /scopeDates\.length > 1\s*\? seriesSummary\(clashResults, lineCtx, scopeDates\)/, 'an edit\'s own way out');
    assert.match(form, /if \(listDates && clashResults\) \{\s*listDates\.forEach/);
  });
  it('2 · a series edit has no Date box; its dates are Add\'s list, which only Add can remove from', () => {
    assert.match(form, /<div className=\{seriesEdit \? styles\.formTimesGrid : styles\.formSectionGrid3\}>\s*\{!seriesEdit && \(/);
    assert.equal(form.split('{dateList}').length - 1, 2, 'one list, drawn under Add\'s times and under an edit\'s');
    const list = form.slice(form.indexOf('const dateList ='), form.indexOf(') : null;', form.indexOf('const dateList =')));
    assert.match(list, /\{recurringSeries && \(\s*<button/, 'the ✕ is Add\'s alone');
    assert.match(list, /recurringSeries && recurrenceIsGame \? \(/, 'and so is the opponent per date');
    assert.match(css, /\.formTimesGrid \{ display: grid; grid-template-columns: 1fr 1fr; gap: 0\.7rem; \}/);
  });
  it('3 · Save names what it saves, in the event\'s own word', () => {
    assert.match(form, /\? seriesEdit \? `Save \$\{pluralize\(scopeDates\.length, eventWord\(form\)\)\}` : 'Save changes'/);
  });
});
