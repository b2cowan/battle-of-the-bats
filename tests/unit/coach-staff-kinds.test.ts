import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  STAFF_KINDS, STAFF_PRESETS, STAFF_KIND_COPY, HELPER_PRESET, ASSISTANT_DEFAULTS,
  resolveCoachCapabilities, sanitizeAssistantGrants, sanitizeStaffKind, staffKindLabel,
  scheduleAccessOf, scheduleGrantsFor, SCHEDULE_VALUES,
  canWritePracticePlans, canManageSchedule, canWriteDevelopment, canReadPastPracticePlans,
  canViewScoutingBook, canJoinStaffChat, hasRecordAccess, hasNonMoneyRecordAccess,
  wouldLeaveNoHeadCoach,
  type CoachCapabilities, type AssistantCapabilityGrants, type StaffKind,
} from '../../lib/coach-capabilities.ts';
import { isCoachNavItemVisible } from '../../lib/coach-nav-visibility.ts';

/**
 * Pass 2 of the staff access plan (owner-approved 2026-09-10; built 2026-09-11) — the four kinds,
 * their presets, the stored label, the schedule three-way, plan writes on schedule edit, and the
 * last-head-coach rule. Each is a contract the screen and the routes depend on; a failure here is
 * a model change, and the fix is a decision, not a new expectation.
 */

const resolve = (grants?: AssistantCapabilityGrants): CoachCapabilities =>
  resolveCoachCapabilities('assistant_coach', grants);
const preset = (kind: StaffKind) => resolve(STAFF_PRESETS[kind]);
const head = () => resolveCoachCapabilities('head_coach');

describe('the four presets are what the plan says they are, and survive the sanitiser', () => {
  it('round-trips every preset through the client sanitiser with nothing lost', () => {
    for (const kind of STAFF_KINDS) {
      const round = sanitizeAssistantGrants(STAFF_PRESETS[kind]);
      assert.deepEqual(round, STAFF_PRESETS[kind], `${kind}: a dropped key would resolve to the assistant default`);
    }
  });

  it('spells out every grant on every preset, so a PATCH from the sheet drops nothing', () => {
    const keys = Object.keys(sanitizeAssistantGrants({
      schedule: true, scheduleManage: true, staffChat: true, attendance: true, lineups: true, rosterPii: true,
      notes: true, announcementsSend: true, tryouts: true, scoutingBook: true, money: 'off', documents: 'off',
    })).sort();
    for (const kind of STAFF_KINDS) {
      assert.deepEqual(Object.keys(STAFF_PRESETS[kind]).sort(), keys, `${kind} must name every grant explicitly`);
    }
  });

  it('keeps the assistant preset equal to the resolver defaults', () => {
    assert.deepEqual(preset('assistant'), resolve());
    assert.deepEqual(preset('assistant'), { ...ASSISTANT_DEFAULTS });
  });

  it('keeps HELPER_PRESET as the helper kind, unchanged from Phase 4', () => {
    assert.equal(HELPER_PRESET, STAFF_PRESETS.helper);
    const h = preset('helper');
    assert.equal(canManageSchedule(h), false);
    assert.equal(canJoinStaffChat(h), false);
    assert.equal(hasRecordAccess(h), false);
    // Owner ruling 2026-09-11: nothing changes for an existing helper until a head coach flips it.
    assert.equal(canViewScoutingBook(h), true);
  });

  it('gives the manager the plan’s §2.2 bundle: schedule edit, chat, documents manage, money edit, contacts, email families', () => {
    const m = preset('manager');
    assert.equal(canManageSchedule(m), true);
    assert.equal(m.staffChat, true);
    assert.equal(m.documents, 'manage');
    assert.equal(m.money, 'write');
    assert.equal(m.rosterPii, true);
    assert.equal(m.announcementsSend, true);
    // Assumption 1 (owner agreed as drawn): no Attendance; and never lineups, notes or tryouts.
    assert.equal(m.attendance, false);
    assert.equal(m.lineups, false);
    assert.equal(m.notes, false);
    assert.equal(m.tryouts, false);
  });

  it('gives the treasurer schedule view + money edit and nothing else', () => {
    const t = preset('treasurer');
    assert.equal(t.schedule, true);
    assert.equal(canManageSchedule(t), false);
    assert.equal(t.money, 'write');
    // Assumption 5 (owner agreed as drawn): contacts off, staff chat off.
    assert.equal(t.rosterPii, false);
    assert.equal(canJoinStaffChat(t), false);
    for (const k of ['attendance', 'lineups', 'notes', 'announcementsSend', 'tryouts'] as const) {
      assert.equal(t[k], false, `${k} must be off for a treasurer`);
    }
    assert.equal(t.documents, 'off');
    /**
     * ⚠ ROUND 3 of the mockup (2026-09-11): the scouting book starts OFF for a treasurer, because
     * since the 09-11 grant the Insights door opens for anyone who can read the pooled book, and
     * the approved plan says a treasurer does not hold Insights. This is the one preset choice
     * that keeps that sentence true.
     */
    assert.equal(canViewScoutingBook(t), false);
  });
});

describe('the doors each kind meets on their first sign-in', () => {
  it('treasurer: Money, Settings and Schedule — not Insights, Tournaments, Chat, Roster-record surfaces beyond the roster page', () => {
    const t = preset('treasurer');
    assert.equal(isCoachNavItemVisible(t, 'Money'), true);
    assert.equal(isCoachNavItemVisible(t, 'Settings'), true);
    assert.equal(isCoachNavItemVisible(t, 'Schedule'), true);
    assert.equal(isCoachNavItemVisible(t, 'Roster'), true, 'money is a record duty — names beside the dues');
    assert.equal(isCoachNavItemVisible(t, 'Insights'), false, 'the "no money in Insights" ruling, and the book is off');
    assert.equal(isCoachNavItemVisible(t, 'Tournaments'), false);
    assert.equal(isCoachNavItemVisible(t, 'Chat'), false);
    assert.equal(isCoachNavItemVisible(t, 'Documents'), false);
    assert.equal(isCoachNavItemVisible(t, 'Email families'), false);
    assert.equal(isCoachNavItemVisible(t, 'Staff'), false);
    assert.equal(hasNonMoneyRecordAccess(t), false);
  });

  it('manager: Schedule, Money, Documents, Chat, Email families, Settings, Tournaments, Roster — Insights via documents, no Lineups/Attendance/Tryouts', () => {
    const m = preset('manager');
    for (const door of ['Schedule', 'Money', 'Documents', 'Chat', 'Email families', 'Settings', 'Tournaments', 'Roster', 'Insights']) {
      assert.equal(isCoachNavItemVisible(m, door), true, `${door} must open for a manager`);
    }
    for (const door of ['Lineups', 'Attendance', 'Tryouts', 'Staff']) {
      assert.equal(isCoachNavItemVisible(m, door), false, `${door} must stay shut for a manager`);
    }
  });

  it('helper: Schedule and Insights (the book tab) only — unchanged from Phase 4 + the 09-11 ruling', () => {
    const h = preset('helper');
    assert.equal(isCoachNavItemVisible(h, 'Schedule'), true);
    assert.equal(isCoachNavItemVisible(h, 'Insights'), true);
    for (const door of ['Money', 'Settings', 'Chat', 'Roster', 'Documents', 'Tournaments', 'Staff', 'Lineups', 'Attendance']) {
      assert.equal(isCoachNavItemVisible(h, door), false, `${door} must stay shut for a helper`);
    }
  });
});

describe('the stored kind is a word the display prefers, never a gate', () => {
  it('prefers the stored kind over the derived shape', () => {
    // A helper granted attendance stays a helper — the exact change that used to relabel them.
    const widened = resolve({ ...HELPER_PRESET, attendance: true });
    assert.equal(staffKindLabel(widened, 'helper'), 'helper');
    // A treasurer given the staff chat is still the treasurer.
    assert.equal(staffKindLabel(resolve({ ...STAFF_PRESETS.treasurer, staffChat: true }), 'treasurer'), 'treasurer');
    // The stored word wins even when the bundle looks like something else entirely.
    assert.equal(staffKindLabel(preset('assistant'), 'manager'), 'manager');
  });

  it('falls back to the Phase 4 derivation for a NULL, so rows written before mig 288 read as they did', () => {
    assert.equal(staffKindLabel(preset('helper'), null), 'helper');
    assert.equal(staffKindLabel(preset('assistant'), null), 'assistant');
    assert.equal(staffKindLabel(preset('assistant')), 'assistant');
    assert.equal(staffKindLabel(resolve({ ...HELPER_PRESET, attendance: true }), null), 'assistant');
  });

  it('never calls a head coach anything else, whatever is stored', () => {
    assert.equal(staffKindLabel(head(), 'helper'), 'head');
    assert.equal(staffKindLabel(head(), null), 'head');
  });

  it('changes no door when the word changes', () => {
    // Same bundle, four different words → the same fifteen answers. The kind gates nothing.
    const caps = preset('assistant');
    const doors = ['Schedule', 'Roster', 'Attendance', 'Lineups', 'Tryouts', 'Money', 'Documents', 'Insights', 'Chat', 'Settings', 'Tournaments', 'Staff', 'Email families'];
    const answers = doors.map(d => isCoachNavItemVisible(caps, d));
    for (const kind of STAFF_KINDS) {
      // The nav takes capabilities only — there is no parameter to pass a kind through, which is
      // the structural half of the guarantee. This pins the behavioural half.
      assert.deepEqual(doors.map(d => isCoachNavItemVisible(caps, d)), answers, `${kind}`);
    }
  });

  it('sanitises a kind from a client: the four words pass, anything else is null', () => {
    for (const k of STAFF_KINDS) assert.equal(sanitizeStaffKind(k), k);
    assert.equal(sanitizeStaffKind('head'), null);
    assert.equal(sanitizeStaffKind('Assistant'), null);
    assert.equal(sanitizeStaffKind(''), null);
    assert.equal(sanitizeStaffKind(undefined), null);
    assert.equal(sanitizeStaffKind(42), null);
  });

  it('has one word, one sentence, one email per kind, and the email promises only what the preset grants', () => {
    for (const kind of STAFF_KINDS) {
      const copy = STAFF_KIND_COPY[kind];
      assert.ok(copy.name && copy.sentence && copy.asA && copy.emailHeading && copy.emailWhat);
      assert.match(copy.emailSubject('Lions'), /Lions/);
    }
    // The treasurer's email must not promise the chat or the lineup it does not grant.
    assert.doesNotMatch(STAFF_KIND_COPY.treasurer.emailWhat, /chat|lineup|attendance/i);
    // The helper's must not promise attendance / lineups / chat either (the Phase 4 lesson).
    assert.doesNotMatch(STAFF_KIND_COPY.helper.emailWhat, /chat|lineup|attendance/i);
    // The manager's must not promise the lineup ("Not the lineup" is its sentence).
    assert.doesNotMatch(STAFF_KIND_COPY.manager.emailWhat, /lineup/i);
  });
});

describe('schedule is one three-way control over the same two keys (R6)', () => {
  it('is a bijection over the three states the product means', () => {
    for (const level of SCHEDULE_VALUES) {
      assert.equal(scheduleAccessOf(scheduleGrantsFor(level)), level);
    }
    assert.deepEqual(scheduleGrantsFor('off'), { schedule: false, scheduleManage: false });
    assert.deepEqual(scheduleGrantsFor('view'), { schedule: true, scheduleManage: false });
    assert.deepEqual(scheduleGrantsFor('manage'), { schedule: true, scheduleManage: true });
  });

  it('reads the nonsense stored state (manage without view) as Hidden, so the control can never re-offer it', () => {
    assert.equal(scheduleAccessOf({ schedule: false, scheduleManage: true }), 'off');
  });

  it('reads the resolver’s legacy fallback correctly', () => {
    assert.equal(scheduleAccessOf(resolve({ schedule: true })), 'manage');
    assert.equal(scheduleAccessOf(resolve({ schedule: false })), 'off');
    assert.equal(scheduleAccessOf(preset('treasurer')), 'view');
    assert.equal(scheduleAccessOf(preset('helper')), 'view');
  });
});

describe('practice-plan writing follows "Schedule: View + edit" (R7)', () => {
  it('is exactly the schedule-manage grant, and no longer the head-only Development gate', () => {
    for (const kind of STAFF_KINDS) {
      const c = preset(kind);
      assert.equal(canWritePracticePlans(c), canManageSchedule(c), kind);
    }
    assert.equal(canWritePracticePlans(head()), true);
    assert.equal(canWritePracticePlans(preset('assistant')), true, 'assumption 3: every existing assistant widens');
    assert.equal(canWritePracticePlans(preset('manager')), true);
    assert.equal(canWritePracticePlans(preset('treasurer')), false);
    assert.equal(canWritePracticePlans(preset('helper')), false);
    // The seam: Skills & Goals writes stay head-only.
    assert.equal(canWriteDevelopment(preset('assistant')), false);
  });

  it('keeps the past-season library imports on BOTH the write and the look-back read', () => {
    const both = (c: CoachCapabilities) => canWritePracticePlans(c) && canReadPastPracticePlans(c);
    assert.equal(both(preset('assistant')), true);
    assert.equal(both(preset('manager')), true, 'documents:manage is a record duty');
    assert.equal(both(preset('helper')), false);
    assert.equal(both(preset('treasurer')), false);
    // A schedule editor with NO record duty can write tonight's plan but not read last season's.
    const editorOnly = resolve({ ...HELPER_PRESET, scheduleManage: true });
    assert.equal(canWritePracticePlans(editorOnly), true);
    assert.equal(both(editorOnly), false);
  });
});

describe('the last-head-coach rule (R8, assumption 2)', () => {
  it('refuses to change or remove the only head coach', () => {
    assert.equal(wouldLeaveNoHeadCoach(1, true), true);
    assert.equal(wouldLeaveNoHeadCoach(0, true), true);
  });
  it('allows it when another head coach remains', () => {
    assert.equal(wouldLeaveNoHeadCoach(2, true), false);
    assert.equal(wouldLeaveNoHeadCoach(3, true), false);
  });
  it('never applies to an assistant', () => {
    assert.equal(wouldLeaveNoHeadCoach(1, false), false);
    assert.equal(wouldLeaveNoHeadCoach(0, false), false);
  });
});
