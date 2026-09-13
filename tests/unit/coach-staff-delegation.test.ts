import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  STAFF_PRESETS, STAFF_KINDS, ASSISTANT_DEFAULTS, resolveCoachCapabilities, sanitizeAssistantGrants,
  canManageStaff, type AssistantCapabilityGrants, type CoachCapabilities, type StaffKind,
} from '../../lib/coach-capabilities.ts';
import {
  delegationViolation, clampForDelegate, delegateMayEditRow, delegateMaySet, rank, SENSITIVE_KEYS,
} from '../../lib/coach-staff-delegation.ts';
import { isCoachNavItemVisible } from '../../lib/coach-nav-visibility.ts';

/**
 * Manage staff, delegated (owner ruling 2026-09-13) — the grant, the Manager preset, and THE
 * CEILING. Each `it` is one of the plan's D-rules (`COACH_STAFF_DELEGATION_PLAN.md` §2); a failure
 * is a model change and the fix is a decision, not a new expectation.
 */

type Grants = Required<AssistantCapabilityGrants>;
const resolve = (g?: AssistantCapabilityGrants): CoachCapabilities => resolveCoachCapabilities('assistant_coach', g);
const head = () => resolveCoachCapabilities('head_coach');
const preset = (k: StaffKind): Grants => ({ ...STAFF_PRESETS[k] });
const manager = () => resolve(STAFF_PRESETS.manager);

describe('D1 · the grant exists, defaults off, and a head coach always holds it', () => {
  it('is off in the assistant defaults, on for a head coach, and resolves from an absent key to off', () => {
    assert.equal(ASSISTANT_DEFAULTS.manageStaff, false);
    assert.equal(head().manageStaff, true);
    assert.equal(resolve({ schedule: true }).manageStaff, false, 'a bundle stored before the key existed resolves to off — no migration');
    assert.equal(resolve({ manageStaff: true }).manageStaff, true);
  });
  it('canManageStaff is head OR the grant; the nav door and it agree', () => {
    assert.equal(canManageStaff(head()), true);
    assert.equal(canManageStaff(resolve()), false);
    assert.equal(canManageStaff(resolve({ manageStaff: true })), true);
    assert.equal(isCoachNavItemVisible(resolve({ manageStaff: true }), 'Staff'), true, 'the Staff door opens on the grant alone');
    assert.equal(isCoachNavItemVisible(resolve(), 'Staff'), false);
  });
  it('survives the client sanitiser', () => {
    assert.deepEqual(sanitizeAssistantGrants({ manageStaff: true }), { manageStaff: true });
    assert.deepEqual(sanitizeAssistantGrants({ manageStaff: 'yes' }), {}, 'a non-boolean is dropped, not coerced');
  });
});

describe('D2 · only the Team manager preset starts with it on', () => {
  it('manager ON, the other three OFF — and every preset still round-trips', () => {
    for (const kind of STAFF_KINDS) {
      assert.equal(STAFF_PRESETS[kind].manageStaff, kind === 'manager', `${kind}`);
      assert.deepEqual(sanitizeAssistantGrants(STAFF_PRESETS[kind]), STAFF_PRESETS[kind]);
    }
    assert.equal(isCoachNavItemVisible(resolve(STAFF_PRESETS.treasurer), 'Staff'), false, 'a treasurer has no Staff door');
    assert.equal(isCoachNavItemVisible(resolve(STAFF_PRESETS.helper), 'Staff'), false, 'a helper has no Staff door');
    assert.equal(isCoachNavItemVisible(manager(), 'Staff'), true);
  });
});

describe('D3 · the ceiling — a delegate widens a Sensitive grant only up to what they hold', () => {
  const actor = manager(); // money write · rosterPii · announcementsSend ON; notes · tryouts OFF

  it('widening within the ceiling is allowed', () => {
    const cur = preset('assistant');
    assert.equal(delegationViolation(actor, cur, { ...cur, money: 'write' }), null);
    assert.equal(delegationViolation(actor, cur, { ...cur, rosterPii: true, announcementsSend: true }), null);
  });
  it('widening above the ceiling names the key', () => {
    const cur = preset('assistant');
    assert.deepEqual(delegationViolation(actor, cur, { ...cur, notes: true }), { key: 'notes', reason: 'above_ceiling' });
    assert.deepEqual(delegationViolation(actor, cur, { ...cur, tryouts: true }), { key: 'tryouts', reason: 'above_ceiling' });
    const reader = resolve({ ...STAFF_PRESETS.manager, money: 'read' });
    assert.deepEqual(delegationViolation(reader, cur, { ...cur, money: 'write' }), { key: 'money', reason: 'above_ceiling' }, 'read → write is a widening past a read-only actor');
    assert.equal(delegationViolation(reader, cur, { ...cur, money: 'read' }), null);
  });
  it('keeping or lowering something above the ceiling is always allowed', () => {
    const cur: Grants = { ...preset('assistant'), notes: true, tryouts: true, money: 'write' };
    assert.equal(delegationViolation(actor, cur, cur), null, 'a save that changes nothing sensitive');
    assert.equal(delegationViolation(actor, cur, { ...cur, notes: false, tryouts: false, money: 'off' }), null, 'revoking is never a violation');
  });
  it('everyday grants are not ceilinged — a manager with no Attendance may give Attendance', () => {
    assert.equal(actor.attendance, false);
    const cur = preset('helper');
    assert.equal(delegationViolation(actor, cur, { ...cur, attendance: true, lineups: true, development: true, staffChat: true, documents: 'manage' }), null);
  });
  it('a new invite starts from nothing, so every ON is a widening', () => {
    assert.equal(delegationViolation(actor, null, preset('treasurer')), null, 'treasurer = money write, which the manager holds');
    assert.deepEqual(delegationViolation(actor, null, { ...preset('helper'), notes: true }), { key: 'notes', reason: 'above_ceiling' });
  });
  it('a head coach is never in violation', () => {
    const cur = preset('helper');
    assert.equal(delegationViolation(head(), cur, { ...cur, notes: true, tryouts: true, money: 'write', manageStaff: true }), null);
  });
});

describe('D6 · a delegate never CHANGES Manage staff — on or off', () => {
  it('turning it ON is refused, even from someone who holds it', () => {
    const cur = preset('assistant');
    assert.deepEqual(delegationViolation(manager(), cur, { ...cur, manageStaff: true }), { key: 'manageStaff', reason: 'manage_staff' });
    assert.deepEqual(delegationViolation(manager(), null, preset('manager')), { key: 'manageStaff', reason: 'manage_staff' }, 'inviting a manager from the preset carries it — the clamp pulls it off first');
  });
  it('turning it OFF is refused too — a head coach’s decision is not a delegate’s to undo (/review 2026-09-13)', () => {
    const cur: Grants = { ...preset('manager') };
    assert.deepEqual(delegationViolation(manager(), cur, { ...cur, manageStaff: false }), { key: 'manageStaff', reason: 'manage_staff' });
    // …and a hand-built PARTIAL body resolves the omitted key to the default (off), which is a change.
    const partialResolved: Grants = { ...preset('assistant'), money: 'read' };
    assert.deepEqual(delegationViolation(manager(), cur, partialResolved), { key: 'manageStaff', reason: 'manage_staff' });
  });
  it('a fellow delegate’s row stays EDITABLE — re-sending their Manage staff unchanged is not a violation (/review, Critical)', () => {
    const cur: Grants = { ...preset('manager') }; // holds manageStaff: true
    assert.equal(delegationViolation(manager(), cur, { ...cur, attendance: true }), null, 'toggling Attendance re-sends manageStaff: true — must pass');
    const { grants, clamped } = clampForDelegate(manager(), cur, { ...preset('treasurer') });
    assert.equal(grants.manageStaff, true, 'a preset applied to a fellow manager keeps their key');
    assert.deepEqual(clamped, ['manageStaff']);
  });
  it('the per-control question agrees: locked in both directions for a delegate', () => {
    assert.equal(delegateMaySet(manager(), 'manageStaff', false, true), false);
    assert.equal(delegateMaySet(manager(), 'manageStaff', true, false), false);
    assert.equal(delegateMaySet(manager(), 'manageStaff', true, true), true);
    assert.equal(delegateMaySet(head(), 'manageStaff', false, true), true);
  });
});

describe('D8 · a preset a delegate applies is clamped, not refused', () => {
  it('pulls each violating Sensitive key down to the actor’s level and turns Manage staff off', () => {
    const reader = resolve({ ...STAFF_PRESETS.manager, money: 'read' });
    const { grants, clamped } = clampForDelegate(reader, null, preset('manager'));
    assert.equal(grants.money, 'read', 'write → the actor’s read');
    assert.equal(grants.manageStaff, false);
    assert.deepEqual(clamped.sort(), ['manageStaff', 'money']);
    assert.equal(delegationViolation(reader, null, grants), null, 'the clamped bundle is always accepted');
  });
  it('never takes away what the row already had above the ceiling', () => {
    const cur: Grants = { ...preset('assistant'), notes: true };
    const { grants, clamped } = clampForDelegate(manager(), cur, { ...preset('manager'), notes: true });
    assert.equal(grants.notes, true, 'notes were already on — kept, not revoked');
    assert.equal(grants.manageStaff, false);
    assert.deepEqual(clamped, ['manageStaff']);
  });
  it('clamps a boolean the actor lacks to off', () => {
    const cur = preset('helper');
    const { grants, clamped } = clampForDelegate(manager(), cur, { ...cur, tryouts: true });
    assert.equal(grants.tryouts, false);
    assert.deepEqual(clamped, ['tryouts']);
  });
  it('is a no-op for a head coach', () => {
    const { grants, clamped } = clampForDelegate(head(), null, preset('manager'));
    assert.deepEqual(grants, preset('manager'));
    assert.deepEqual(clamped, []);
  });
});

describe('D4 + D5 · which rows a delegate may open for editing', () => {
  const me = { userId: 'u-priya', isHeadCoach: false };
  it('never a head coach, never themselves, otherwise yes', () => {
    assert.equal(delegateMayEditRow(me, { userId: 'u-jordan', coachRole: 'head_coach' }), false);
    assert.equal(delegateMayEditRow(me, { userId: 'u-priya', coachRole: 'assistant_coach' }), false);
    assert.equal(delegateMayEditRow(me, { userId: 'u-sam', coachRole: 'assistant_coach' }), true);
  });
  it('a head coach may edit anyone but themselves (the route’s existing rule, restated)', () => {
    const boss = { userId: 'u-jordan', isHeadCoach: true };
    assert.equal(delegateMayEditRow(boss, { userId: 'u-other', coachRole: 'head_coach' }), true);
    assert.equal(delegateMayEditRow(boss, { userId: 'u-jordan', coachRole: 'head_coach' }), false);
  });
});

describe('rank — one definition of “wider” for the server and the sheet', () => {
  it('off < view/read < manage/write; booleans 0/1; unknown = 0', () => {
    assert.equal(rank('off'), 0); assert.equal(rank('view'), 1); assert.equal(rank('read'), 1);
    assert.equal(rank('manage'), 2); assert.equal(rank('write'), 2);
    assert.equal(rank(false), 0); assert.equal(rank(true), 1); assert.equal(rank(undefined), 0);
    assert.deepEqual([...SENSITIVE_KEYS], ['money', 'rosterPii', 'notes', 'announcementsSend', 'tryouts', 'tournaments']);
  });
});
