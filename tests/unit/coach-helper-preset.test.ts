import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ASSISTANT_DEFAULTS,
  HELPER_PRESET,
  resolveCoachCapabilities,
  sanitizeAssistantGrants,
  staffKindLabel,
  canViewSchedule,
  canManageSchedule,
  canJoinStaffChat,
  canSeePlanPlayers,
  canViewRoster,
  hasNoTeamRecordAccess,
  type CoachCapabilities,
  type AssistantCapabilityGrants,
} from '../../lib/coach-capabilities.ts';
import { isCoachNavItemVisible } from '../../lib/coach-nav-visibility.ts';

/**
 * Practice Plans Phase 4 — the HELPER preset.
 *
 * The owner ruling of 2026-08-03 (`BUSINESS_DECISIONS.md`) authorised a helper only on the terms
 * asserted below: a **preset, never a third role**, that shows a parent volunteer the plan and the
 * names at their station and NOTHING else — in particular not the staff chat room, not the power to
 * change the schedule, and not the team's record surfaces.
 *
 * ⚠ These tests are the contract for that ruling. If one fails, the preset has drifted past what
 * was authorised, and the fix is a new decision entry — not a new expectation here.
 */

const assistant = (grants?: AssistantCapabilityGrants): CoachCapabilities =>
  resolveCoachCapabilities('assistant_coach', grants);

const helper = (): CoachCapabilities => assistant(HELPER_PRESET);
const head = (): CoachCapabilities => resolveCoachCapabilities('head_coach');

describe('the helper preset grants exactly what was authorised', () => {
  it('sees the schedule and a practice plan, and can change neither', () => {
    const caps = helper();
    assert.equal(canViewSchedule(caps), true);
    assert.equal(canManageSchedule(caps), false);
  });

  it('sees players’ names ON A PLAN while holding no roster access at all', () => {
    const caps = helper();
    // The ruling: full roster basics on the plan...
    assert.equal(canSeePlanPlayers(caps), true);
    // ...delivered WITHOUT the grant every record surface reads, which is what keeps the roster
    // page, the development board and Insights shut with no new gate anywhere.
    assert.equal(caps.roster, 'off');
    assert.equal(canViewRoster(caps), false);
  });

  it('is never in the staff chat room', () => {
    assert.equal(canJoinStaffChat(helper()), false);
  });

  it('holds nothing sensitive, and nothing that writes', () => {
    const caps = helper();
    assert.equal(caps.rosterPii, false);
    assert.equal(caps.notes, false);
    assert.equal(caps.money, 'off');
    assert.equal(caps.documents, 'off');
    assert.equal(caps.tryouts, false);
    assert.equal(caps.announcementsSend, false);
    assert.equal(caps.attendance, false);
    assert.equal(caps.lineups, false);
    assert.equal(caps.rosterWrite, false);
    assert.equal(caps.isHeadCoach, false);
  });

  it('survives a round trip through the client sanitiser', () => {
    // The preset reaches the database via the invite's `initial_capabilities`, which is sanitised
    // on the way in. A key the sanitiser drops would silently resolve to the ASSISTANT default —
    // and for `staffChat` and `scheduleManage` that default is TRUE, i.e. exactly the two things
    // this preset exists to withhold.
    const round = assistant(sanitizeAssistantGrants(HELPER_PRESET));
    assert.equal(canJoinStaffChat(round), false);
    assert.equal(canManageSchedule(round), false);
    assert.equal(canSeePlanPlayers(round), true);
    assert.equal(round.roster, 'off');
  });
});

describe('a helper meets exactly one door in the portal', () => {
  const DOORS = [
    'Roster', 'Attendance', 'Lineups', 'Tryouts', 'Money', 'Documents',
    'Development', 'Insights', 'Chat', 'Settings', 'Tournaments', 'Staff',
    'Email families',
  ];

  it('hides every door but the schedule', () => {
    const caps = helper();
    assert.equal(isCoachNavItemVisible(caps, 'Schedule'), true);
    for (const door of DOORS) {
      assert.equal(
        isCoachNavItemVisible(caps, door), false,
        `${door} must be hidden from a helper — a door a persona can see but not use is a bug`,
      );
    }
  });

  it('leaves an ordinary assistant’s doors exactly as they were', () => {
    // The whole safety argument for the three new grants is that they change nothing for anyone
    // already invited. Every door an assistant could open before must still open.
    const caps = assistant();
    for (const door of ['Roster', 'Attendance', 'Lineups', 'Documents', 'Development', 'Insights', 'Chat', 'Settings', 'Schedule']) {
      assert.equal(isCoachNavItemVisible(caps, door), true, `${door} must stay open to an assistant`);
    }
    assert.equal(isCoachNavItemVisible(caps, 'Staff'), false);   // head coach only, unchanged
    assert.equal(isCoachNavItemVisible(caps, 'Tryouts'), false); // ungranted by default, unchanged
  });

  it('leaves a head coach untouched', () => {
    const caps = head();
    for (const door of ['Schedule', ...DOORS]) {
      assert.equal(isCoachNavItemVisible(caps, door), true, `${door} must stay open to a head coach`);
    }
  });
});

describe('the three new grants change nothing for existing coaches', () => {
  it('defaults an assistant to BOTH halves of the old schedule capability', () => {
    assert.equal(ASSISTANT_DEFAULTS.schedule, true);
    assert.equal(ASSISTANT_DEFAULTS.scheduleManage, true);
    assert.equal(ASSISTANT_DEFAULTS.staffChat, true);
  });

  it('resolves a bundle STORED BEFORE THE SPLIT to full schedule access', () => {
    // Every assistant invited before 2026-08-03 has `{schedule: true}` and no `scheduleManage`.
    // Resolving that to view-only would take event editing away from live teams on deploy.
    const legacy = assistant({ schedule: true });
    assert.equal(canViewSchedule(legacy), true);
    assert.equal(canManageSchedule(legacy), true);
  });

  it('resolves a legacy bundle with the schedule REVOKED to neither half', () => {
    const legacy = assistant({ schedule: false });
    assert.equal(canViewSchedule(legacy), false);
    assert.equal(canManageSchedule(legacy), false);
  });

  it('gives an ordinary assistant plan names from roster visibility alone', () => {
    // `planPlayerNames` defaults false and must grant nothing on its own: an assistant's names
    // still come from `roster`, exactly as they always have.
    assert.equal(ASSISTANT_DEFAULTS.planPlayerNames, false);
    assert.equal(canSeePlanPlayers(assistant()), true);
    assert.equal(canSeePlanPlayers(assistant({ roster: 'off' })), false);
  });
});

describe('a helper is never routed into the archive', () => {
  it('reports that a helper bundle can open no record surface', () => {
    // The /review finding this guards: a closed team redirects to Season's End, and Season Wrapped
    // labels EVERY player by first name and jersey number, gated on nothing. A helper would have
    // been redirected into it the day the season closed — a disclosure nobody decided to make.
    assert.equal(hasNoTeamRecordAccess(helper()), true);
  });

  it('does NOT report that for an ordinary assistant or a head coach', () => {
    // Both must keep the Overview and Season's End exactly as they have them today.
    assert.equal(hasNoTeamRecordAccess(assistant()), false);
    assert.equal(hasNoTeamRecordAccess(head()), false);
  });

  it('stops matching the moment a helper is granted anything of substance', () => {
    // The altitude choice follows the grants, so a widened helper rejoins the ordinary portal with
    // no list to maintain and nothing to keep in step.
    assert.equal(hasNoTeamRecordAccess(assistant({ ...HELPER_PRESET, roster: 'view' })), false);
    assert.equal(hasNoTeamRecordAccess(assistant({ ...HELPER_PRESET, attendance: true })), false);
  });
});

describe('staffKindLabel is a WORD, never a gate', () => {
  it('names the three bundles', () => {
    assert.equal(staffKindLabel(head()), 'head');
    assert.equal(staffKindLabel(assistant()), 'assistant');
    assert.equal(staffKindLabel(helper()), 'helper');
  });

  it('stops saying "helper" the moment the bundle widens — and that changes no access', () => {
    // A head coach who hand-grants a helper the roster has made them something else. The label
    // follows the grants rather than the other way round, which is the entire reason this is a
    // preset: there is no stored role for the label to contradict.
    const widened = assistant({ ...HELPER_PRESET, roster: 'view' });
    assert.equal(staffKindLabel(widened), 'assistant');
    assert.equal(canViewRoster(widened), true);
    assert.equal(isCoachNavItemVisible(widened, 'Roster'), true);
  });
});
