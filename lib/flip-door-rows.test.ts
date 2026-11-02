/**
 * The rows a door offers (Account sheet on a phone, 2026-11-01): the labelled pill's popover and the account sheet's
 * "Go to" block read this ONE answer. `node --test lib/flip-door-rows.test.ts`
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { flipDoorRows, type FlipResolution } from './flip-twins.ts';

const admin = { href: '/riverdale/admin/tournaments/dashboard?tournamentId=t1', label: 'Admin' };
const coach = { href: '/coaches/tournaments/t1', label: 'Coach', sublabel: 'Riverdale 13U' };
const back = { href: '/riverdale/admin/tournaments/schedule', label: 'Admin' };

test('a single door is its one named destination', () => {
  const door: FlipResolution = { kind: 'single', target: admin };
  assert.deepEqual(flipDoorRows(door, null), [admin]);
});

test('a single door with a fresh return memory is the one row that returns, labelled by where it goes', () => {
  const door: FlipResolution = { kind: 'single', target: { href: '/riverdale/t', label: 'Public site' } };
  assert.deepEqual(flipDoorRows(door, back), [back]);
});

test('a chooser lists the same named destinations every time: the return memory is ignored', () => {
  const door: FlipResolution = { kind: 'multi', label: 'Roles', targets: [admin, coach] };
  assert.deepEqual(flipDoorRows(door, null), [admin, coach]);
  assert.deepEqual(flipDoorRows(door, back), [admin, coach]);
});

test('a sublabel rides along only where the target carries one', () => {
  const door: FlipResolution = { kind: 'multi', label: 'Roles', targets: [admin, coach] };
  const rows = flipDoorRows(door, null);
  assert.equal(rows[0].sublabel, undefined);
  assert.equal(rows[1].sublabel, 'Riverdale 13U');
});

test('a door that does not yet know what it is offers nothing', () => {
  assert.deepEqual(flipDoorRows({ kind: 'single', target: admin, pending: true }, back), []);
  assert.deepEqual(flipDoorRows({ kind: 'multi', label: 'Roles', targets: [admin, coach], pending: true }, null), []);
});
