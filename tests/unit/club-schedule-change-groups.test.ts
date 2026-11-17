import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  changeCount, changeGroupLists, changeGroups, changesEmail, changesTotal, labelGroup, linesAsGroups, mergeChangeTeams, type TeamChange,
} from '../../lib/club-schedule-words.ts';
import { readCode } from './_source-code.ts';

/**
 * ⚖ A TEAM'S CHANGES ARE SAID AS GROUPS, NEVER ONE LINE PER DATE (owner 2026-11-17, artifact YLos6rKun1mA612uRsChsG, asks
 * 1–7 ruled as recommended). Needs attention's Unsent change row, the Send the changes window and the coaches' email read
 * the same groups. A run collapses ONLY when every change in it is the same change (ask 1).
 */

// The test's clock is UTC: a change at 2026-12-01T19:00Z is "Tue, Dec 1, 7:00 p.m.".
const clockOf = (ms: number) => { const d = new Date(ms).toISOString(); return { day: d.slice(0, 10), time: d.slice(11, 16) }; };
const at = (day: string, time = '19:00') => Date.parse(`${day}T${time}:00Z`);
const gains = (day: string, place = 'Prospect Park · Diamond 1', time = '19:00'): TeamChange => ({ kind: 'gains', startMs: at(day, time), endMs: at(day, time) + 5400000, place });
const tueThu = ['2026-12-03', '2026-12-08', '2026-12-10', '2026-12-15', '2027-01-05', '2027-01-07'];

describe('a run collapses only when it is the same change (ask 1)', () => {
  it('the same time and place on Tuesdays and Thursdays is one group, its dates by month', () => {
    const [g] = changeGroups(tueThu.map(d => gains(d)), clockOf);
    assert.equal(g.head, 'Gains 6 practices');
    assert.equal(g.pattern, 'Tue and Thu · 7:00 p.m. · Prospect Park · Diamond 1 · Dec 3 – Jan 7');
    assert.deepEqual(g.months, [{ month: 'Dec', days: '3 · 8 · 10 · 15' }, { month: 'Jan', days: '5 · 7' }]);
    assert.equal(g.count, 6);
    assert.equal(g.firstDay, '2026-12-03');
  });
  it('a different place or time is its own group; a group of one is the change\'s own line', () => {
    const groups = changeGroups([gains('2026-12-01'), gains('2026-12-08'), gains('2026-12-09', 'Prospect Park · Diamond 2'), gains('2026-12-15', undefined, '18:00')], clockOf);
    assert.deepEqual(groups.map(g => [g.head, g.pattern]), [
      ['Gains 2 practices', 'Tue · 7:00 p.m. · Prospect Park · Diamond 1 · Dec 1 – 8'],
      ['Gains Wed, Dec 9, 7:00 p.m. · Prospect Park · Diamond 2', null],
      ['Gains Tue, Dec 15, 6:00 p.m. · Prospect Park · Diamond 1', null],
    ]);
  });
  it('the same move on every date collapses; a move by a different number of days does not', () => {
    const move = (day: string, toDay: string, toTime = '19:00'): TeamChange => ({ kind: 'moved', fromStartMs: at(day), fromPlace: 'Lane 2', toStartMs: at(toDay, toTime), toEndMs: at(toDay, toTime) + 3600000, toPlace: 'Lane 2' });
    const groups = changeGroups([move('2026-11-24', '2026-11-26'), move('2026-12-01', '2026-12-03'), move('2026-12-08', '2026-12-09')], clockOf);
    assert.equal(groups.length, 2);
    assert.equal(groups[0].head, 'Moves 2 practices');
    assert.equal(groups[0].pattern, 'Tue, 7:00 p.m. → Thu, 7:00 p.m. · Lane 2 · was Nov 24 – Dec 1');
    assert.equal(groups[1].pattern, null);
  });
  it('a run of moves says its dates are the ones it moves from, and sorts by the soonest day it touches', () => {
    const move = (day: string, toDay: string): TeamChange => ({ kind: 'moved', fromStartMs: at(day), fromPlace: 'Lane 2', toStartMs: at(toDay, '19:00'), toEndMs: at(toDay, '19:00') + 3600000, toPlace: 'Lane 2' });
    const earlier = changeGroups([move('2026-12-03', '2026-12-01'), move('2026-12-10', '2026-12-08')], clockOf);
    assert.match(earlier[0].pattern ?? '', /· was Dec 3 – 10$/);
    assert.equal(earlier[0].firstDay, '2026-12-01');
    assert.deepEqual(changeGroupLists(earlier)[0].items, ['Was Dec 3 · 10']);
  });
  it('an unknown place leaves no empty segment, and a place with a bar in it never merges two changes', () => {
    const none = changeGroups([gains('2026-12-01', ''), gains('2026-12-08', '')], clockOf);
    assert.equal(none[0].pattern, 'Tue · 7:00 p.m. · Dec 1 – 8');
    assert.equal(changeGroups([gains('2026-12-01', 'a|19:00|b'), gains('2026-12-08', 'a')], clockOf).length, 2);
  });
  it('kinds never mix, and the groups read soonest first (ask 3)', () => {
    const loses: TeamChange = { kind: 'loses', startMs: at('2026-12-03', '18:00'), endMs: at('2026-12-03', '19:00'), place: 'Prospect Park · Diamond A' };
    const groups = changeGroups([gains('2026-12-08'), gains('2026-12-10'), loses], clockOf);
    assert.deepEqual(groups.map(g => g.head), ['No longer Thu, Dec 3, 6:00 p.m. · Prospect Park · Diamond A', 'Gains 2 practices']);
  });
});

describe('the label, the merge and the totals', () => {
  it('a part\'s label is said once per group: on the pattern of a run, on the line of a group of one', () => {
    const [run] = changeGroups([gains('2026-12-01'), gains('2026-12-08')], clockOf);
    const [one] = changeGroups([gains('2026-12-01')], clockOf);
    assert.equal(labelGroup(run, 'Time added Nov 17').pattern, 'Tue · 7:00 p.m. · Prospect Park · Diamond 1 · Dec 1 – 8 · Time added Nov 17');
    assert.equal(labelGroup(one, 'Time added Nov 17').head, 'Gains Tue, Dec 1, 7:00 p.m. · Prospect Park · Diamond 1 · Time added Nov 17');
  });
  it('a team two members change reads once; teams soonest first; a carried house-league line after the dated ones', () => {
    const teams = mergeChangeTeams([
      { teamId: 'aa14', teamName: '14U AA', groups: changeGroups([gains('2026-12-03')], clockOf) },
      { teamId: 'aa15', teamName: '15U AA', groups: changeGroups([gains('2026-12-01'), gains('2026-12-08')], clockOf) },
      { teamId: 'aa14', teamName: '14U AA', groups: changeGroups([gains('2026-12-10', 'Kinsmen')], clockOf) },
      { teamId: 'reds', teamName: 'Reds', groups: linesAsGroups(['Sundays from Nov 8: Field 1 → Field 3']) },
      { teamId: 'none', teamName: 'Empty', groups: [] },
    ]);
    assert.deepEqual(teams.map(t => [t.teamName, t.groups.length]), [['15U AA', 1], ['14U AA', 2], ['Reds', 1]]);
    assert.equal(changeCount(teams), 5);
    assert.equal(changesTotal(teams), '3 teams · 4 practices gained, 1 other change');
  });
  it('the total names each kind once, gains first', () => {
    const loses: TeamChange = { kind: 'loses', startMs: at('2026-12-03'), endMs: at('2026-12-03'), place: 'Diamond A' };
    const groups = changeGroups([...tueThu.map(d => gains(d)), loses], clockOf);
    assert.equal(changesTotal([{ groups }]), '1 team · 6 practices gained, 1 lost');
  });
});

describe('the email lists the groups with every date written out (ask 7)', () => {
  it('a run is a titled list of its months; groups of one gather in an untitled list', () => {
    const loses: TeamChange = { kind: 'loses', startMs: at('2026-12-02'), endMs: at('2026-12-02'), place: 'Diamond A' };
    const lists = changeGroupLists(changeGroups([loses, ...tueThu.map(d => gains(d)), gains('2027-02-02', 'Kinsmen')], clockOf));
    assert.deepEqual(lists, [
      { title: null, items: ['No longer Wed, Dec 2, 7:00 p.m. · Diamond A'] },
      { title: 'Gains 6 practices: Tue and Thu · 7:00 p.m. · Prospect Park · Diamond 1 · Dec 3 – Jan 7', items: ['Dec 3 · 8 · 10 · 15', 'Jan 5 · 7'] },
      { title: null, items: ['Gains Tue, Feb 2, 7:00 p.m. · Kinsmen'] },
    ]);
  });
  it('changesEmail lists the groups when given them, the lines when not', () => {
    const base = { orgName: 'Harbourtown', scheduleName: 'Fall practices', teamName: '14U AA', recipientNames: ['Taylor Brooks'], billedCents: null, lost: null, link: '/x' };
    const lines = tueThu.map(d => `Gains ${d}`);
    assert.deepEqual(changesEmail({ ...base, lines }).lists[0], { title: null, items: lines });
    const grouped = changesEmail({ ...base, lines, groups: changeGroups(tueThu.map(d => gains(d)), clockOf) });
    assert.equal(grouped.lists.length, 1);
    assert.deepEqual(grouped.lists[0].items, ['Dec 3 · 8 · 10 · 15', 'Jan 5 · 7']);
  });
});

describe('both screens read the same block', () => {
  const attention = readCode('components/admin/kit/club/schedules/ScheduleAttention.tsx');
  const css = readCode('components/admin/kit/club/schedules/Schedules.module.css');
  it('a team\'s name and a month stay on their line (the row makes every <b> a block)', () => {
    assert.match(css, /\.attentionBody \.chHead b \{ display: inline;/);
    assert.match(css, /\.attentionDetails > summary \{/, 'the outer disclosure styles its own line, not the nested Show dates');
  });
  const send = readCode('components/admin/kit/club/schedules/SendWindow.tsx');
  it('Needs attention lists teams, never a line per date, and folds after three', () => {
    assert.match(attention, /<ChangeTeamBlock key=\{t\.teamId\} team=\{t\} named \/>/);
    // The list starts CLOSED behind "All 36 changes", as it did before (owner browser check, 2026-11-17).
    assert.match(attention, /<details className=\{sch\.attentionDetails\} data-unsent-list>\s*<summary>\{W\.allChanges\(changes\)\}<\/summary>/);
    assert.doesNotMatch(attention, /data-unsent-list open/);
    assert.match(attention, /const FIRST_TEAMS = 3;/);
    assert.doesNotMatch(attention, /changeLines/);
  });
  it('the Send window shows the groups BELOW the row\'s label (Show dates never ticks the team), money on its own line', () => {
    assert.match(send, /below=\{changesBelow\(t\)\}/);
    assert.match(send, /<ChangeTeamBlock team=\{t\} \/>/);
    assert.match(send, /className=\{sch\.chMoney\}/);
    assert.doesNotMatch(send, /return \[t\.lines\.join\('; '\), \.\.\.money2\]/);
  });
});
