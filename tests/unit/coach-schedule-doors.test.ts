import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ASSISTANT_DEFAULTS,
  HELPER_PRESET,
  canManageAwards,
  resolveCoachCapabilities,
  sanitizeAssistantGrants,
  type AssistantCapabilityGrants,
  type CoachCapabilities,
} from '../../lib/coach-capabilities.ts';
import { scheduleDrawerDoors, type ScheduleDrawerEvent } from '../../lib/coach-schedule-doors.ts';

/**
 * The schedule's event panel shows a door only to a coach whose grants open it — the rule the
 * staff access review (2026-09-10) found the panel breaking on eight controls at once. These pin
 * the answer per persona so a future control added to the panel has a place to be asserted.
 */

const assistant = (grants?: AssistantCapabilityGrants): CoachCapabilities =>
  resolveCoachCapabilities('assistant_coach', grants);
const helper = () => assistant(HELPER_PRESET);
const head = () => resolveCoachCapabilities('head_coach');
const treasurer = () => assistant(sanitizeAssistantGrants({
  money: 'write', schedule: true, scheduleManage: false, attendance: false, lineups: false,
  staffChat: false, documents: 'off', rosterPii: false, notes: false, announcementsSend: false, tryouts: false,
}));

const game: ScheduleDrawerEvent = { isGame: true, isLineupEvent: true, hasOpponent: true, scoutingAvailable: true };
const tbdGame: ScheduleDrawerEvent = { ...game, hasOpponent: false };
const practice: ScheduleDrawerEvent = { isGame: false, isLineupEvent: false, hasOpponent: false, scoutingAvailable: true };

describe('a helper on a game meets the Scouting tab and nothing else', () => {
  it('holds no tab, no score form, no award button and no lineup door', () => {
    const d = scheduleDrawerDoors(helper(), game);
    assert.equal(d.attendanceTab, false);
    assert.equal(d.lineupTab, false);
    assert.equal(d.scoreForm, false);
    assert.equal(d.awards, false);
    assert.equal(d.editEvent, false);
    assert.equal(d.emailFamilies, false);
    assert.equal(d.seasonAttendanceLink, false);
    // The bench observes — open to every schedule-holder by ruling (2026-08-04).
    assert.equal(d.scoutingTab, true);
  });

  it('meets NO tab on a game with no named opponent — a TBD slot is never a dead end', () => {
    const d = scheduleDrawerDoors(helper(), tbdGame);
    assert.equal(d.scoutingTab, false);
    assert.equal(Object.values(d).some(Boolean), false);
  });
});

describe('a default assistant keeps every door they had', () => {
  it('has both tabs, the score form, awards, editing and the Insights link', () => {
    const d = scheduleDrawerDoors(assistant(), game);
    assert.equal(d.attendanceTab, true);
    assert.equal(d.lineupTab, true);
    assert.equal(d.scoutingTab, true);
    assert.equal(d.scoreForm, true);
    assert.equal(d.awards, true);
    assert.equal(d.editEvent, true);
    assert.equal(d.seasonAttendanceLink, true);
    // Off by default — draft-only until the head coach grants sending.
    assert.equal(d.emailFamilies, false);
    assert.equal(ASSISTANT_DEFAULTS.announcementsSend, false);
  });

  it('has no lineup tab on a practice, whatever they hold', () => {
    const d = scheduleDrawerDoors(assistant(), practice);
    assert.equal(d.lineupTab, false);
    assert.equal(d.scoreForm, false);
    assert.equal(d.awards, false);
    assert.equal(d.attendanceTab, true);
  });
});

describe('a money-only treasurer reads the panel and changes the schedule nowhere on it', () => {
  it('sees no schedule write door and no Insights link, since money is not a player duty', () => {
    const d = scheduleDrawerDoors(treasurer(), game);
    assert.equal(d.attendanceTab, false);
    assert.equal(d.lineupTab, false);
    assert.equal(d.scoreForm, false);
    assert.equal(d.editEvent, false);
    assert.equal(d.seasonAttendanceLink, false);
    assert.equal(d.scoutingTab, true);
    // ⚠ Awards MIRROR the API's own rule (`canManageAwards` = any record duty, money included), so
    // a treasurer holds this door today. Whether money should count towards awards is a question
    // for the capability model, not for the panel — the panel's job is to agree with its route.
    assert.equal(d.awards, canManageAwards(treasurer()));
  });
});

describe('the panel fails closed and a head coach is never narrowed', () => {
  it('shows nothing while capabilities are still loading', () => {
    for (const caps of [undefined, null]) {
      const d = scheduleDrawerDoors(caps, game);
      assert.equal(Object.values(d).some(Boolean), false, 'no door may flash before the grants arrive');
    }
  });

  it('opens every door for a head coach on a game', () => {
    const d = scheduleDrawerDoors(head(), game);
    assert.equal(Object.values(d).every(Boolean), true);
  });
});
