import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { teamChanges, isUntold, familyKey, type ChangeChild } from '../../lib/house-league-team-changes.ts';

/**
 * HOUSE LEAGUE TEAM-CHANGE EMAILS (TC·1 to TC·8): which families still need telling, derived from the children.
 * Untold = accepted, on a team, and not the team the family was last told. One row per family (first parent's address).
 */

const A = 'team-a';
const B = 'team-b';
const C = 'team-c';
const T0 = '2026-11-01T10:00:00Z';
const T1 = '2026-11-02T10:00:00Z';

const child = (id: string, first: string, over: Partial<ChangeChild> = {}): ChangeChild => ({
  id,
  firstName: first,
  lastName: 'Kidd',
  guardianEmail: 'kids+family@example.com',
  teamId: A,
  toldTeamId: A,
  toldAt: T0,
  teamChangedAt: null,
  ...over,
});

describe('team changes: who is untold', () => {
  it('nobody is untold when every child stands on the team they were told', () => {
    const r = teamChanges([child('1', 'Ava'), child('2', 'Zane')]);
    assert.deepEqual(r, { families: [], quiet: [], noEmail: [] });
  });

  it('three siblings placed one by one are one family row naming all three', () => {
    const r = teamChanges([
      child('1', 'Zane', { toldTeamId: null, teamId: B }),
      child('2', 'Ava', { toldTeamId: null, teamId: A }),
      child('3', 'Maya', { toldTeamId: null, teamId: C }),
    ]);
    assert.equal(r.families.length, 1);
    assert.deepEqual(r.families[0].children.map(c => c.name), ['Ava Kidd', 'Maya Kidd', 'Zane Kidd']);
    assert.ok(r.families[0].children.every(c => c.kind === 'placed' && c.fromTeamId === null));
  });

  it('a child moved twice (A to B to C) says "from A", the team the family was told', () => {
    const r = teamChanges([child('1', 'Ava', { teamId: C, toldTeamId: A, teamChangedAt: T1 })]);
    assert.deepEqual(r.families[0].children[0], {
      id: '1', name: 'Ava Kidd', kind: 'moved', fromTeamId: A, toTeamId: C,
    });
  });

  it('a child moved and moved back is not a row: the family is quiet', () => {
    const r = teamChanges([child('1', 'Ava', { teamId: A, toldTeamId: A, toldAt: T0, teamChangedAt: T1 })]);
    assert.equal(r.families.length, 0);
    assert.equal(r.quiet.length, 1);
    assert.deepEqual(r.quiet[0].children, [{ id: '1', name: 'Ava Kidd', teamId: A }]);
  });

  it('a family with one untold child and one quiet child is a row for the untold child only', () => {
    const r = teamChanges([
      child('1', 'Ava', { teamId: B, toldTeamId: A, teamChangedAt: T1 }),
      child('2', 'Zane', { teamId: A, toldTeamId: A, toldAt: T0, teamChangedAt: T1 }),
    ]);
    assert.equal(r.families.length, 1);
    assert.deepEqual(r.families[0].children.map(c => c.id), ['1']);
    assert.equal(r.quiet.length, 0);
  });

  it('a late child placed after the others joins the list as new', () => {
    const r = teamChanges([child('1', 'Ava'), child('2', 'Late', { toldTeamId: null, teamId: B })]);
    assert.equal(r.families.length, 1);
    assert.deepEqual(r.families[0].children.map(c => [c.name, c.kind]), [['Late Kidd', 'placed']]);
  });

  it('a child off a team is never untold, never emailed, and never quiet', () => {
    const r = teamChanges([child('1', 'Ava', { teamId: null, toldTeamId: A, teamChangedAt: T1 })]);
    assert.deepEqual(r, { families: [], quiet: [], noEmail: [] });
    assert.equal(isUntold({ teamId: null, toldTeamId: A }), false);
  });

  it('a child with no address is "no email", not a row', () => {
    const r = teamChanges([
      child('1', 'Ava', { guardianEmail: '  ', teamId: B, toldTeamId: null }),
      child('2', 'Zane', { guardianEmail: null, teamId: B, toldTeamId: A }),
    ]);
    assert.equal(r.families.length, 0);
    assert.deepEqual(r.noEmail.map(c => [c.id, c.kind]), [['1', 'placed'], ['2', 'moved']]);
  });

  it('addresses group case- and space-insensitively, like Publish', () => {
    const r = teamChanges([
      child('1', 'Ava', { guardianEmail: 'Kids+Family@Example.com ', toldTeamId: null }),
      child('2', 'Zane', { guardianEmail: ' kids+family@example.com', toldTeamId: null }),
    ]);
    assert.equal(r.families.length, 1);
    assert.equal(r.families[0].email, 'kids+family@example.com');
    assert.equal(r.families[0].children.length, 2);
    assert.equal(familyKey('  A@B.com '), 'a@b.com');
  });

  it('different first-parent addresses are different families (a known limit, same as Publish)', () => {
    const r = teamChanges([
      child('1', 'Ava', { guardianEmail: 'one@example.com', toldTeamId: null }),
      child('2', 'Zane', { guardianEmail: 'two@example.com', toldTeamId: null }),
    ]);
    assert.equal(r.families.length, 2);
  });

  it('a child whose told team was deleted (the FK cleared it) reads as new', () => {
    const r = teamChanges([child('1', 'Ava', { teamId: B, toldTeamId: null, toldAt: T0 })]);
    assert.equal(r.families[0].children[0].kind, 'placed');
  });

  it('families come out in last-name order', () => {
    const r = teamChanges([
      child('1', 'Ava', { lastName: 'Zed', guardianEmail: 'z@example.com', toldTeamId: null }),
      child('2', 'Bo', { lastName: 'Abel', guardianEmail: 'a@example.com', toldTeamId: null }),
    ]);
    assert.deepEqual(r.families.map(f => f.lastName), ['Abel', 'Zed']);
  });
});
