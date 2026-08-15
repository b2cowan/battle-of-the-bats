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
  hasRecordAccess,
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

  /**
   * ⚠ REWRITTEN for A1 (2026-08-03). This used to assert `roster === 'off'` plus a
   * `canSeePlanPlayers` exception. Both are retired: names are baseline, so there is no predicate
   * left to ask, and what keeps the roster page shut is that the preset holds no record duty.
   * The ruling this protects is unchanged — a helper reads names on their plan and nothing else.
   */
  it('holds no record access at all, which is what keeps the roster page shut', () => {
    const caps = helper();
    assert.equal(hasRecordAccess(caps), false);
    assert.equal(hasNoTeamRecordAccess(caps), true);
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
    assert.equal(hasRecordAccess(round), false);
  });

  /**
   * ⚠ A1 (2026-08-03) — the stale-key contract. Rows written before A1 still carry `roster` and
   * `planPlayerNames` in their stored bundle. Nothing migrates them, so the sanitiser dropping
   * unknown keys is the entire reason that is a non-event: a legacy `roster: 'off'` must not
   * survive into a resolved bundle, and must not change what the person can do.
   */
  it('ignores the two keys A1 retired if they are still in a stored bundle', () => {
    const legacyHelper = { ...HELPER_PRESET, roster: 'off', planPlayerNames: true };
    const round = assistant(sanitizeAssistantGrants(legacyHelper));
    assert.equal('roster' in round, false);
    assert.equal('planPlayerNames' in round, false);
    assert.equal(hasRecordAccess(round), false);
    assert.equal(staffKindLabel(round), 'helper');

    // And the mirror case: an ASSISTANT stored with `roster: 'off'` keeps everything else they
    // hold, so A1 takes nothing away from them — it only stops hiding names.
    const legacyAssistant = assistant(sanitizeAssistantGrants({ roster: 'off' }));
    assert.equal(hasRecordAccess(legacyAssistant), true);
    assert.equal(staffKindLabel(legacyAssistant), 'assistant');
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

  /**
   * ⚠ The treasurer. Team settings gained a Money group when the two dues settings (automatic
   * reminders, how credits reduce) moved off the dues page — and money is a SEPARATE grant from
   * managing the schedule, which is what used to decide this door. A head coach who set an
   * assistant up as the team's treasurer and nothing else would otherwise have watched both
   * controls vanish from the product the day they moved.
   *
   * The door opens; the PAGE stays narrow — it renders only the groups the coach's own grants
   * own, so this persona finds Money and nothing else. That half is asserted by the page, not
   * here; what this locks is that the door exists at all.
   */
  it('opens Settings for a money-only treasurer, and nothing else new', () => {
    const treasurer = assistant(sanitizeAssistantGrants({
      money: 'write', scheduleManage: false, schedule: false, attendance: false,
      lineups: false, staffChat: false, documents: 'off', rosterPii: false,
      notes: false, announcementsSend: false, tryouts: false,
    }));
    assert.equal(isCoachNavItemVisible(treasurer, 'Settings'), true);
    assert.equal(isCoachNavItemVisible(treasurer, 'Money'), true);
    // Tournaments shared this gate verbatim until now and must NOT have come along.
    assert.equal(isCoachNavItemVisible(treasurer, 'Tournaments'), false);
    assert.equal(isCoachNavItemVisible(treasurer, 'Staff'), false);
    assert.equal(isCoachNavItemVisible(treasurer, 'Schedule'), false);
  });

  it('keeps Settings shut for a read-only money coach', () => {
    // Settings is where things CHANGE. A coach who may only read the books has nothing to do
    // there, so the door that opened for the treasurer stays closed for them.
    const bookkeeper = assistant(sanitizeAssistantGrants({
      money: 'read', scheduleManage: false, schedule: false, attendance: false,
      lineups: false, staffChat: false, documents: 'off', rosterPii: false,
      notes: false, announcementsSend: false, tryouts: false,
    }));
    assert.equal(isCoachNavItemVisible(bookkeeper, 'Money'), true);
    assert.equal(isCoachNavItemVisible(bookkeeper, 'Settings'), false);
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

  it('keeps every record duty an assistant starts with, so A1 narrowed nobody', () => {
    // A1 removed a switch; it must not have removed access. An assistant on the defaults holds
    // record access through the duties they were always given.
    assert.equal(ASSISTANT_DEFAULTS.attendance, true);
    assert.equal(ASSISTANT_DEFAULTS.lineups, true);
    assert.equal(ASSISTANT_DEFAULTS.documents, 'view');
    assert.equal(hasRecordAccess(assistant()), true);
  });

  /**
   * ⚠ THE ONE PLACE A1 COULD HAVE NARROWED. The past-practice-plan archive door read
   * `notes || roster !== 'off'`; assistants carry `notes: false`, so they passed on the roster half
   * and dropping it would have locked them out of past plans. The route gates on record access now
   * — this asserts the property that fix depends on.
   */
  it('leaves an assistant able to reach past practice plans without notes', () => {
    const caps = assistant();
    assert.equal(caps.notes, false);
    assert.equal(canViewSchedule(caps) && hasRecordAccess(caps), true);
    // ...and still shuts that door on a helper, which is what the gate is for.
    assert.equal(canViewSchedule(helper()) && hasRecordAccess(helper()), false);
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
    assert.equal(hasNoTeamRecordAccess(assistant({ ...HELPER_PRESET, attendance: true })), false);
    assert.equal(hasNoTeamRecordAccess(assistant({ ...HELPER_PRESET, money: 'read' })), false);
  });
});

describe('staffKindLabel is a WORD, never a gate', () => {
  it('names the three bundles', () => {
    assert.equal(staffKindLabel(head()), 'head');
    assert.equal(staffKindLabel(assistant()), 'assistant');
    assert.equal(staffKindLabel(helper()), 'helper');
  });

  it('stops saying "helper" the moment the bundle widens — and that changes no access', () => {
    // A head coach who hand-grants a helper attendance has made them something else. The label
    // follows the grants rather than the other way round, which is the entire reason this is a
    // preset: there is no stored role for the label to contradict.
    const widened = assistant({ ...HELPER_PRESET, attendance: true });
    assert.equal(staffKindLabel(widened), 'assistant');
    assert.equal(hasRecordAccess(widened), true);
    assert.equal(isCoachNavItemVisible(widened, 'Roster'), true);
  });

  /**
   * ⚠ THE REGRESSION A1 WOULD OTHERWISE HAVE SHIPPED. Both mechanisms that recognise a helper were
   * keyed on `roster === 'off'` — the exact state A1 retires. Left alone, every helper would have
   * been relabelled "Assistant" on the staff card AND lost the "This season has finished" screen,
   * which is what keeps the season review shut to them (owner ruling 2026-08-03). Neither is a
   * permission, so neither would have failed loudly.
   */
  /**
   * ⚠ **THE SEASON-REVIEW DOOR** (owner ruling 2026-08-03). Season's End leads with Season Wrapped
   * — the team's whole season, plus a share button that puts a child's first name on an image that
   * leaves the app. A helper ran one station on one Tuesday and has no claim to it.
   *
   * Six paths reach that page (the portal-root sign-in redirect, the archive sidebar, both team
   * switchers, the `?year=` rail, a typed URL) and Phase 4 closed only the one nobody uses. They
   * all funnel through ONE nav label and ONE route, both keyed on `hasRecordAccess` — so this pair
   * of assertions is the whole door.
   */
  it('never sees the Season\'s End door, and cannot pass the gate behind it', () => {
    assert.equal(isCoachNavItemVisible(helper(), "Season's End"), false);
    assert.equal(hasRecordAccess(helper()), false);
    // ...and every real coach keeps it, which is what stops this being a narrowing.
    assert.equal(isCoachNavItemVisible(assistant(), "Season's End"), true);
    assert.equal(isCoachNavItemVisible(head(), "Season's End"), true);
  });

  it('still says "helper" after A1, with no roster grant left to read', () => {
    const caps = helper();
    assert.equal(staffKindLabel(caps), 'helper');
    assert.equal(hasNoTeamRecordAccess(caps), true);
  });
});
